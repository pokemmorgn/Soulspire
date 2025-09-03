import mongoose from "mongoose";

// Interface pour les statistiques communes
export interface IForgeStats {
  totalOperations: number;
  totalGoldSpent: number;
  totalGemsSpent: number;
  successRate: number;
  lastOperation?: Date;
}

// Ressources nécessaires pour les opérations de forge
export interface IForgeResourceCost {
  gold: number;
  gems: number;
  materials?: { [materialId: string]: number };
}

// Résultat standard des opérations de forge
export interface IForgeOperationResult {
  success: boolean;
  cost: IForgeResourceCost;
  message: string;
  data?: any;
}

// Configuration de base pour tous les modules de forge
export interface IForgeModuleConfig {
  enabled: boolean;
  baseGoldCost: number;
  baseGemCost: number;
  materialRequirements?: { [rarity: string]: { [materialId: string]: number } };
  levelRestrictions?: {
    minPlayerLevel: number;
    maxPlayerLevel?: number;
  };
}

// Interface pour la validation des objets
export interface IItemValidationResult {
  valid: boolean;
  reason?: string;
  itemData?: any;
  ownedItem?: any;
}

export interface IForgeCoreOptions {
  // Placeholder for future options
}

export abstract class ForgeCore {
  protected playerId: string;
  protected stats: IForgeStats;
  protected config: IForgeModuleConfig;

  constructor(playerId: string) {
    this.playerId = playerId;
    this.stats = {
      totalOperations: 0,
      totalGoldSpent: 0,
      totalGemsSpent: 0,
      successRate: 0
    } as IForgeStats;
  }

  // === VALIDATION DES OBJETS ===

  /**
   * Valide qu'un objet peut être utilisé dans les opérations de forge
   */
  async validateItem(itemInstanceId: string, requiredCategory?: string): Promise<IItemValidationResult> {
    try {
      const Inventory = mongoose.model('Inventory');
      const Item = mongoose.model('Item');

      // Récupérer l'inventaire du joueur
      const inventory = await Inventory.findOne({ playerId: this.playerId });
      if (!inventory) {
        return { valid: false, reason: "Inventory not found" };
      }

      // Trouver l'objet dans l'inventaire
      const ownedItem = inventory.getItem(itemInstanceId);
      if (!ownedItem) {
        return { valid: false, reason: "Item not found in inventory" };
      }

      // Récupérer les données de base de l'objet
      const baseItem = await Item.findOne({ itemId: ownedItem.itemId });
      if (!baseItem) {
        return { valid: false, reason: "Base item data not found" };
      }

      // Vérifier la catégorie si spécifiée
      if (requiredCategory && baseItem.category !== requiredCategory) {
        return {
          valid: false,
          reason: `Item must be of category ${requiredCategory}, found ${baseItem.category}`
        };
      }

      // Vérifier que l'objet n'est pas équipé (sauf si on permet la forge d'objets équipés)
      if (ownedItem.isEquipped) {
        return {
          valid: false,
          reason: "Item is currently equipped"
        };
      }

      return {
        valid: true,
        itemData: baseItem,
        ownedItem
      };
    } catch (error: any) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Valide qu'un joueur peut se permettre un certain coût.
   * Peut recevoir une session mongoose optionnelle pour les checks en transaction.
   */
  async validatePlayerResources(cost: IForgeResourceCost, session?: mongoose.ClientSession): Promise<boolean> {
    try {
      const Player = mongoose.model('Player');
      const Inventory = mongoose.model('Inventory');

      // Récupérer le joueur (avec session si fourni)
      const playerQuery = Player.findById(this.playerId);
      if (session) playerQuery.session(session);
      const player = await playerQuery.exec();
      if (!player) return false;

      // Vérifier les monnaies de base via la méthode du modèle (player.canAfford)
      // player.canAfford doit être une méthode synchrone/instanciée : on suppose qu'elle lit les fields.
      if (!player.canAfford(cost)) return false;

      // Vérifier les matériaux si nécessaire
      if (cost.materials && Object.keys(cost.materials).length > 0) {
        const invQuery = Inventory.findOne({ playerId: this.playerId });
        if (session) invQuery.session(session);
        const inventory = await invQuery.exec();
        if (!inventory) return false;

        for (const [materialId, requiredAmount] of Object.entries(cost.materials)) {
          if (!inventory.hasItem(materialId, requiredAmount)) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Dépense les ressources du joueur (non-transactionnel).
   * Si vous avez besoin d'atomicité use spendResourcesTransactional().
   * Toute la logique suppose que les méthodes appelées (player.spendCurrency, inventory.removeItem)
   * effectuent des modifications en mémoire et qu'on appellera save après.
   */
  async spendResources(cost: IForgeResourceCost): Promise<boolean> {
    try {
      const Player = mongoose.model('Player');
      const Inventory = mongoose.model('Inventory');

      const [player, inventory] = await Promise.all([
        Player.findById(this.playerId),
        Inventory.findOne({ playerId: this.playerId })
      ]);

      if (!player || !inventory) return false;

      // Vérifier une dernière fois avant de dépenser
      if (!await this.validatePlayerResources(cost)) return false;

      // Dépenser les monnaies
      await player.spendCurrency(cost);

      // Dépenser les matériaux (utilise inventory.removeItem qui peut sauvegarder)
      if (cost.materials) {
        for (const [materialId, amount] of Object.entries(cost.materials)) {
          const materialItem = (inventory.storage.craftingMaterials || []).find(
            (item: any) => item.itemId === materialId
          );
          if (materialItem) {
            // removeItem peut sauvegarder l'inventaire ; garder la logique existante
            await inventory.removeItem(materialItem.instanceId, amount);
          } else {
            // Matériel manquant — rollback manuel (on ne rollbacks pas ici: c'est non-transactionnel)
            return false;
          }
        }
      }

      // Sauvegarder les changements
      await Promise.all([player.save(), inventory.save()]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Dépense les ressources du joueur en utilisant une transaction MongoDB.
   * NOTE: pour que la transaction soit réellement atomique, certaines méthodes (ex: inventory.removeItem)
   * doivent pouvoir accepter et utiliser la session lors des opérations et lors du save().
   * Si inventory.removeItem effectue ses propres save() sans session, il faudra adapter Inventory ensuite.
   */
  async spendResourcesTransactional(cost: IForgeResourceCost): Promise<{ success: boolean; message?: string }> {
    const session = await mongoose.startSession();
    try {
      let result = { success: false, message: "Unknown error" };
      await session.withTransaction(async () => {
        const Player = mongoose.model('Player');
        const Inventory = mongoose.model('Inventory');

        // Charger les documents dans la session
        const player = await Player.findById(this.playerId).session(session);
        const inventory = await Inventory.findOne({ playerId: this.playerId }).session(session);

        if (!player || !inventory) {
          throw new Error("Player or inventory not found");
        }

        // Valider avec session
        const canAfford = await this.validatePlayerResources(cost, session);
        if (!canAfford) {
          throw new Error("Insufficient resources or missing materials");
        }

        // Dépenser les monnaies via méthode du modèle
        // IMPORTANT: player.spendCurrency doit modifier les champs et ne pas faire save() interne, ou
        // accepter la session si elle effectue l'appel de save elle-même.
        if (typeof player.spendCurrency === 'function') {
          // On applique directement et on sauvegarde plus bas avec la session
          await player.spendCurrency(cost);
        } else {
          // Fallbacks si la méthode n'existe pas
          if (cost.gold) player.gold -= cost.gold;
          if (cost.gems) player.gems -= cost.gems;
          if (cost.paidGems) player.paidGems = (player.paidGems || 0) - (cost as any).paidGems || 0;
        }

        // Dépenser les matériaux — idéalement inventory.removeItem prendra un param session
        if (cost.materials) {
          for (const [materialId, amount] of Object.entries(cost.materials)) {
            const materialItem = (inventory.storage.craftingMaterials || []).find(
              (item: any) => item.itemId === materialId
            );
            if (!materialItem) {
              throw new Error(`Missing material ${materialId}`);
            }

            // Si inventory.removeItem accepte une session, on devrait passer session.
            // Exemple: await inventory.removeItem(materialItem.instanceId, amount, { session });
            // Pour l'instant on appelle removeItem et on s'appuie sur le fait qu'il ne sauvegarde sans session.
            if (typeof inventory.removeItem === 'function') {
              // Try to call with session if supported
              try {
                // @ts-ignore - optional parameter may exist
                await inventory.removeItem(materialItem.instanceId, amount, session);
              } catch (e) {
                // Fallback: modify storage array manually (safer within transaction)
                // décrémente quantity ou supprime l'instance si nécessaire
                const idx = inventory.storage.craftingMaterials.findIndex((it: any) => it.instanceId === materialItem.instanceId);
                if (idx >= 0) {
                  const target = inventory.storage.craftingMaterials[idx];
                  target.quantity = (target.quantity || 1) - amount;
                  if (target.quantity <= 0) inventory.storage.craftingMaterials.splice(idx, 1);
                } else {
                  throw new Error(`Failed to remove material ${materialId}`);
                }
              }
            } else {
              throw new Error("Inventory.removeItem not available");
            }
          }
        }

        // Sauvegarder les changements avec la session
        await Promise.all([player.save({ session }), inventory.save({ session })]);

        result = { success: true, message: "Resources spent successfully" };
      }, {
        // options
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' }
      });

      await session.endSession();
      return result;
    } catch (error: any) {
      await session.endSession();
      return { success: false, message: error?.message || String(error) };
    }
  }

  /**
   * Met à jour les statistiques du module
   */
  protected async updateStats(cost: IForgeResourceCost, success: boolean): Promise<void> {
    this.stats.totalOperations++;
    if (success) {
      this.stats.totalGoldSpent += cost.gold || 0;
      this.stats.totalGemsSpent += cost.gems || 0;
    }
    this.stats.successRate = this.stats.totalOperations > 0 ?
      (this.stats.totalOperations - (this.stats.totalOperations - this.stats.totalGoldSpent)) / this.stats.totalOperations : 0;
    this.stats.lastOperation = new Date();
  }

  /**
   * Retourne les statistiques du module
   */
  getStats(): IForgeStats {
    return { ...this.stats };
  }

  // === MÉTHODES D'ACCÈS RAPIDE AUX MODÈLES ===

  protected async getPlayer() {
    const Player = mongoose.model('Player');
    return await Player.findById(this.playerId);
  }

  protected async getInventory() {
    const Inventory = mongoose.model('Inventory');
    return await Inventory.findOne({ playerId: this.playerId });
  }

  /**
   * Log une opération pour les statistiques
   */
  async logOperation(
    operationType: string,
    itemInstanceId: string,
    cost: IForgeResourceCost,
    success: boolean,
    additionalData?: any
  ): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Forge Operation: ${operationType}`, {
          playerId: this.playerId,
          itemInstanceId,
          cost,
          success,
          timestamp: new Date().toISOString(),
          ...additionalData
        });
      }
    } catch (error) {
      // Ne pas faire échouer l'opération si le logging échoue
    }
  }
}

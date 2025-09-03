import mongoose from "mongoose";
import {
  ForgeModuleBase,
  IForgeModuleConfig,
  IForgeOperationResult,
  IForgeResourceCost
} from "./ForgeCore";

/**
 * Module de fusion d'équipements (inspiré d'AFK Arena)
 *
 * Intégration avec le modèle Inventory du repo :
 * - utilise inventory.removeItem(...) pour détruire les instances consommées
 * - ajoute le nouvel objet directement dans inventory.storage (même logique que inventory.addItem)
 * - ne tente pas d'écrire des champs non définis dans le schéma ownedItem (ex: `rarity` ou `stats`) ;
 *   ces valeurs sont calculées et retournées dans le résultat, mais le stockage conserve la référence itemId
 *
 * Notes d'implémentation :
 * - L'Item de base est utilisé pour déterminer la catégorie/slot où ajouter l'instance
 * - Si vous avez des templates distincts par rareté (itemId différents), il faudrait fournir un mapping
 *   pour sélectionner le bon itemId cible (non disponible dans les schemas actuels)
 */

export interface IFusionOptions {
  recipeCount?: number; // nombre d'items requis (par défaut 3)
  consumeMaterials?: boolean; // si true, on exige les matériaux configurés
}

export class ForgeFusion extends ForgeModuleBase {
  // mapping de montée en rareté
  protected rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"];

  // par défaut : 3 -> next rarity (AFK-like)
  protected defaultRecipeCount = 3;

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "fusion";
  }

  /**
   * Retourne la rareté suivante ou null si déjà max
   */
  protected getNextRarity(currentRarity: string): string | null {
    const idx = this.rarityOrder.indexOf(currentRarity);
    if (idx < 0 || idx >= this.rarityOrder.length - 1) return null;
    return this.rarityOrder[idx + 1];
  }

  /**
   * Calcule le coût (gold/gems + matériaux) pour une fusion
   */
  async calculateFusionCost(sampleItemInstanceId: string, options?: IFusionOptions): Promise<IForgeResourceCost | null> {
    const validation = await this.validateItem(sampleItemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

    const baseItem: any = validation.itemData;
    const currentRarity = baseItem.rarity || "Common";
    const nextRarity = this.getNextRarity(currentRarity);
    if (!nextRarity) return null;

    const recipeCount = options?.recipeCount ?? this.defaultRecipeCount;

    // Coût de base : scaling en fonction de la rareté cible et du nombre d'items
    const baseGold = this.config.baseGoldCost || 200;
    const baseGems = this.config.baseGemCost || 0;

    const rarityMultipliers: { [key: string]: number } = {
      "Common": 1,
      "Rare": 1.5,
      "Epic": 2.5,
      "Legendary": 4,
      "Mythic": 7,
      "Ascended": 12
    };

    const targetMultiplier = rarityMultipliers[nextRarity] || 1;
    const countMultiplier = 1 + (recipeCount - 1) * 0.5;

    const gold = Math.floor(baseGold * targetMultiplier * countMultiplier);
    const gems = Math.floor(baseGems * targetMultiplier * countMultiplier);

    const materials = this.getMaterialRequirements(nextRarity, "fusion");
    const finalMaterials = options?.consumeMaterials === false ? {} : materials;

    return { gold, gems, materials: finalMaterials };
  }

  /**
   * Tentative de fusion : utilise le modèle Inventory existant pour supprimer les items
   * et ajouter le nouvel item dans la catégorie adéquate.
   *
   * Retourne l'instance créée (owned item) telle qu'elle est stockée + les stats recalculées dans `data`.
   */
  async attemptFusion(itemInstanceIds: string[], options?: IFusionOptions): Promise<IForgeOperationResult> {
    if (!this.isEnabled()) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Fusion module disabled", data: null };
    }

    if (!Array.isArray(itemInstanceIds) || itemInstanceIds.length < 2) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "At least two items required for fusion", data: null };
    }

    const recipeCount = options?.recipeCount ?? this.defaultRecipeCount;
    if (itemInstanceIds.length !== recipeCount) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: `This recipe requires exactly ${recipeCount} items`, data: null };
    }

    // Validation des items
    const ownedItems: Array<{ base: any; owned: any }> = [];
    for (const iid of itemInstanceIds) {
      const validation = await this.validateItem(iid, undefined);
      if (!validation.valid || !validation.itemData || !validation.ownedItem) {
        return { success: false, cost: { gold: 0, gems: 0 }, message: `Invalid item: ${iid} (${validation.reason || "unknown"})`, data: validation };
      }
      ownedItems.push({ base: validation.itemData, owned: validation.ownedItem });
    }

    // Vérifier uniformité : même itemId & même catégorie & même rareté
    const firstBase = ownedItems[0].base;
    const firstOwned = ownedItems[0].owned;
    const sameItemId = ownedItems.every(x => x.base.itemId === firstBase.itemId);
    const sameCategory = ownedItems.every(x => x.base.category === firstBase.category);
    const sameRarity = ownedItems.every(x => (x.base.rarity || "Common") === (firstBase.rarity || "Common"));

    if (!sameItemId || !sameCategory || !sameRarity) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "All items must be the same equipment and rarity", data: null };
    }

    const currentRarity = firstBase.rarity || "Common";
    const nextRarity = this.getNextRarity(currentRarity);
    if (!nextRarity) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Item is already at maximum rarity; cannot fuse further", data: { currentRarity } };
    }

    // Calculer coût
    const cost = await this.calculateFusionCost(itemInstanceIds[0], options);
    if (!cost) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Unable to compute fusion cost", data: null };
    }

    // Vérifier ressources joueur
    const canAfford = await this.validatePlayerResources(cost);
    if (!canAfford) {
      return { success: false, cost, message: "Insufficient resources for fusion", data: null };
    }

    // Dépenser ressources
    const spent = await this.spendResources(cost);
    if (!spent) {
      return { success: false, cost, message: "Failed to spend resources", data: null };
    }

    // Récupérer l'inventaire (modification via les méthodes du modèle Inventory)
    const inventory = await this.getInventory();
    if (!inventory) {
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, false, { reason: "Inventory not found after spend" });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "Inventory not found after spending resources", data: null };
    }

    // Supprimer les items de base en utilisant inventory.removeItem(instanceId)
    try {
      for (const { owned } of ownedItems) {
        const removed = await inventory.removeItem(owned.instanceId, 1);
        if (!removed) {
          throw new Error(`Failed to remove item instance ${owned.instanceId}`);
        }
      }
    } catch (err: any) {
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, false, { reason: "Failed to remove base items", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "Failed to remove base items", data: { error: err?.message || err } };
    }

    // Construire la nouvelle instance à ajouter : respecter le schéma ownedItem (éviter d'écrire des champs non définis)
    try {
      // Déterminer la catégorie de stockage comme le fait inventory.addItem
      const ItemModel = mongoose.model("Item");
      // Essayer de trouver un template cible (itemId) pour la prochaine rareté si existe
      let targetItemTemplate = await ItemModel.findOne({ itemId: firstBase.itemId, rarity: nextRarity });

      // Si aucun template par rareté, on conservera le même itemId (aucune conversion d'itemId automatisée)
      const targetItemId = targetItemTemplate ? targetItemTemplate.itemId : firstBase.itemId;

      // Niveau du nouvel item : on choisit la moyenne arrondie des niveaux des consommés, ou 1 si indéterminé
      const itemLevel = Math.max(1, Math.round(ownedItems.reduce((s, x) => s + (x.owned.level || 1), 0) / ownedItems.length));

      // Construire la nouvelle owned item conforme au schéma
      const newOwnedItem: any = {
        itemId: targetItemId,
        instanceId: this.generateOperationId(),
        quantity: 1,
        level: itemLevel,
        enhancement: 0,
        isEquipped: false,
        acquiredDate: new Date()
      };

      // Déterminer la catégorie de stockage pour le push
      let storageCategory: string | undefined;
      if (firstBase.category === "Equipment") {
        const slotMap: { [key: string]: string } = {
          "Weapon": "weapons",
          "Helmet": "helmets",
          "Armor": "armors",
          "Boots": "boots",
          "Gloves": "gloves",
          "Accessory": "accessories"
        };
        storageCategory = slotMap[firstBase.equipmentSlot];
      } else if (firstBase.category === "Artifact") {
        storageCategory = "artifacts";
      } else {
        // Par défaut on place dans artifacts si catégorie inconnue (rare)
        storageCategory = "artifacts";
      }

      if (!storageCategory || !Array.isArray(inventory.storage[storageCategory])) {
        // fallback : push dans artifacts
        storageCategory = "artifacts";
        if (!Array.isArray(inventory.storage[storageCategory])) {
          inventory.storage[storageCategory] = [];
        }
      }

      // Ajouter l'instance dans l'inventaire
      (inventory.storage as any)[storageCategory].push(newOwnedItem);
      await inventory.save();

      // Recalculer les stats pour la nouvelle rareté afin de renvoyer au client (ne sera pas persisté dans ownedItem car schema ne définit pas 'stats')
      const baseStats = (targetItemTemplate && targetItemTemplate.baseStats) ? targetItemTemplate.baseStats : (firstBase.baseStats || {});
      const statsPerLevel = (targetItemTemplate && targetItemTemplate.statsPerLevel) ? targetItemTemplate.statsPerLevel : (firstBase.statsPerLevel || {});

      const rarityMultipliers: { [key: string]: number } = {
        "Common": 1,
        "Rare": 1.5,
        "Epic": 2.5,
        "Legendary": 4,
        "Mythic": 7,
        "Ascended": 12
      };
      const rarityMultiplier = rarityMultipliers[nextRarity] || 1;

      const recalculatedBaseStats: any = {};
      for (const [k, v] of Object.entries(baseStats)) {
        if (typeof v === "number") {
          recalculatedBaseStats[k] = Math.floor((v as number) * rarityMultiplier);
        } else {
          recalculatedBaseStats[k] = v;
        }
      }

      const computedStats = this.calculateItemStatsWithEnhancement(recalculatedBaseStats, statsPerLevel, itemLevel, 0);

      // Log & stats
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, true, {
        createdInstanceId: newOwnedItem.instanceId,
        newRarity: nextRarity,
        consumed: itemInstanceIds
      });
      await this.updateStats(cost, true);

      return {
        success: true,
        cost,
        message: `Fusion success: created ${nextRarity} ${firstBase.name || firstBase.itemId}`,
        data: {
          newInstance: newOwnedItem,
          newInstanceId: newOwnedItem.instanceId,
          newRarity: nextRarity,
          consumedItems: itemInstanceIds,
          computedStats
        }
      };
    } catch (err: any) {
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, false, { reason: "Failed to create fused item", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "Failed to create fused item", data: { error: err?.message || err } };
    }
  }
}

export default ForgeFusion;

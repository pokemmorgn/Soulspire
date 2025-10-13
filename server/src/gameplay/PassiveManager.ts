// server/src/gameplay/PassiveManager.ts
import { BasePassive, IPassiveTriggerContext, IPassiveResult } from "./base/BasePassive";
import { IBattleParticipant } from "../models/Battle";
import { AutoPassiveLoader } from "./AutoPassiveLoader";

/**
 * Gestionnaire centralisé pour tous les passifs
 * Gère l'enregistrement, le déclenchement et le cooldown des passifs
 * ✨ NOUVEAU : Utilise AutoPassiveLoader pour l'auto-découverte
 */
export class PassiveManager {
  private static passives: Map<string, BasePassive> = new Map();
  private static initialized: boolean = false;
  
  /**
   * Initialiser le gestionnaire de passifs avec auto-découverte
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log("✨ Initialisation du PassiveManager avec auto-découverte...");
    
    // ✨ NOUVEAU : Auto-découverte et chargement de tous les passifs
    await AutoPassiveLoader.autoLoadPassives();
    
    // Copier les passifs auto-chargés dans notre registre
    const autoLoadedPassives = AutoPassiveLoader.getAllPassives();
    for (const passive of autoLoadedPassives) {
      this.passives.set(passive.config.id, passive);
    }
    
    this.initialized = true;
    console.log(`✅ PassiveManager initialisé - ${this.passives.size} passif(s) chargé(s)`);
    
    // Validation en développement
    if (process.env.NODE_ENV === 'development') {
      AutoPassiveLoader.validateLoadedPassives();
    }
    
    // Vérifier qu'au moins un passif a été chargé
    if (this.passives.size === 0) {
      console.warn("⚠️ ATTENTION: Aucun passif n'a pu être chargé par l'AutoPassiveLoader !");
    }
  }
  
  /**
   * Enregistrer un passif manuellement (pour les cas spéciaux)
   * ⚠️ À éviter : préférer l'auto-découverte via AutoPassiveLoader
   */
  static registerPassive(passive: BasePassive): void {
    if (this.passives.has(passive.config.id)) {
      console.warn(`⚠️ Passif ${passive.config.id} déjà enregistré, écrasé`);
    }
    
    this.passives.set(passive.config.id, passive);
    console.log(`📜 Passif enregistré manuellement: ${passive.config.name} (${passive.config.id})`);
  }
  
  /**
   * Récupérer un passif par son ID
   */
  static getPassive(passiveId: string): BasePassive | undefined {
    if (!this.initialized) {
      console.warn("⚠️ PassiveManager non initialisé - initialisation synchrone limitée");
      this.initialized = true;
    }
    return this.passives.get(passiveId);
  }
  
  /**
   * Vérifier et déclencher les passifs d'un participant
   * @param context - Contexte du déclenchement
   * @param passiveId - ID du passif du participant
   * @param passiveLevel - Niveau du passif
   * @returns Résultat du déclenchement (null si pas déclenché)
   */
  static checkAndTrigger(
    context: IPassiveTriggerContext,
    passiveId: string,
    passiveLevel: number
  ): IPassiveResult | null {
    const passive = this.getPassive(passiveId);
    if (!passive) {
      console.warn(`⚠️ Passif inconnu: ${passiveId}`);
      return null;
    }
    
    // Vérifier si peut se déclencher
    if (!passive.canTrigger(context, passiveLevel)) {
      return null;
    }
    
    // Déclencher le passif
    console.log(`⚡ Déclenchement du passif: ${passive.config.name} (${context.actor.name})`);
    return passive.trigger(context, passiveLevel);
  }
  
  /**
   * Vérifier les passifs de tous les participants pour un événement donné
   * @param participants - Liste des participants à vérifier
   * @param context - Contexte du déclenchement
   * @param heroPassives - Map heroId -> { passiveId, level }
   * @returns Liste des résultats de passifs déclenchés
   */
  static checkAllPassives(
    participants: IBattleParticipant[],
    context: IPassiveTriggerContext,
    heroPassives: Map<string, { passiveId: string; level: number }>
  ): Array<{ participant: IBattleParticipant; result: IPassiveResult }> {
    const results: Array<{ participant: IBattleParticipant; result: IPassiveResult }> = [];
    
    for (const participant of participants) {
      if (!participant.status.alive) continue;
      
      const passiveData = heroPassives.get(participant.heroId);
      if (!passiveData) continue;
      
      // Créer un contexte spécifique pour ce participant
      const participantContext: IPassiveTriggerContext = {
        ...context,
        actor: participant
      };
      
      const result = this.checkAndTrigger(
        participantContext,
        passiveData.passiveId,
        passiveData.level
      );
      
      if (result && result.triggered) {
        results.push({ participant, result });
      }
    }
    
    return results;
  }
  
  /**
   * Vérifier un passif spécifique pour un type de déclenchement
   * Utile pour les hooks dans BattleEngine
   */
  static checkPassiveForTriggerType(
    participant: IBattleParticipant,
    passiveId: string,
    passiveLevel: number,
    triggerType: string,
    context: IPassiveTriggerContext
  ): IPassiveResult | null {
    const passive = this.getPassive(passiveId);
    if (!passive) return null;
    
    // Vérifier si le type de déclenchement correspond
    if (passive.config.triggerType !== triggerType) {
      return null;
    }
    
    return this.checkAndTrigger(context, passiveId, passiveLevel);
  }
  
  /**
   * Obtenir les modificateurs de stats d'un passif "always_active"
   */
  static getStatModifiers(passiveId: string, passiveLevel: number): {
    atk?: number;
    def?: number;
    speed?: number;
    [key: string]: number | undefined;
  } | null {
    const passive = this.getPassive(passiveId);
    if (!passive) return null;
    
    if (passive.config.triggerType !== "always_active") {
      return null;
    }
    
    if (passive.getStatModifiers) {
      return passive.getStatModifiers(passiveLevel);
    }
    
    return null;
  }
  
  /**
   * Vérifier si un passif est en cooldown
   */
  static isOnCooldown(passiveId: string, heroId: string, currentTurn: number): boolean {
    const passive = this.getPassive(passiveId);
    if (!passive) return false;
    
    return passive.isOnCooldown(heroId, currentTurn);
  }
  
  /**
   * Obtenir le cooldown restant d'un passif
   */
  static getCooldownRemaining(passiveId: string, heroId: string, currentTurn: number): number {
    const passive = this.getPassive(passiveId);
    if (!passive) return 0;
    
    return passive.getCooldownRemaining(heroId, currentTurn);
  }
  
  /**
   * Réinitialiser le cooldown d'un passif (pour tests ou mécaniques spéciales)
   */
  static resetCooldown(passiveId: string, heroId: string): void {
    const passive = this.getPassive(passiveId);
    if (passive) {
      passive.resetCooldown(heroId);
    }
  }
  
  /**
   * Obtenir tous les passifs enregistrés
   */
  static getAllPassives(): BasePassive[] {
    return Array.from(this.passives.values());
  }
  
  /**
   * Obtenir les statistiques sur les passifs
   */
  static getStats(): {
    totalPassives: number;
    passivesByTriggerType: { [key: string]: number };
    passivesList: { [key: string]: string };
  } {
    const baseStats = {
      totalPassives: this.passives.size,
      passivesByTriggerType: this.getPassivesByTriggerType(),
      passivesList: this.getPassivesList()
    };

    // Ajouter les stats de l'auto-loader si disponible
    try {
      return {
        ...baseStats,
        autoLoaderStats: AutoPassiveLoader.getStats()
      } as any;
    } catch {
      return baseStats;
    }
  }
  
  private static getPassivesByTriggerType(): { [key: string]: number } {
    const passivesByTriggerType: { [key: string]: number } = {};
    
    for (const passive of this.passives.values()) {
      const triggerType = passive.config.triggerType;
      passivesByTriggerType[triggerType] = (passivesByTriggerType[triggerType] || 0) + 1;
    }
    
    return passivesByTriggerType;
  }
  
  private static getPassivesList(): { [key: string]: string } {
    const passivesList: { [key: string]: string } = {};
    
    for (const [id, passive] of this.passives.entries()) {
      passivesList[id] = passive.config.name;
    }
    
    return passivesList;
  }
  
  /**
   * Diagnostiquer le système de passifs
   */
  static diagnose(): void {
    console.log("🔍 === DIAGNOSTIC SYSTÈME DE PASSIFS ===");
    console.log(`📊 Passifs enregistrés: ${this.passives.size}`);
    
    try {
      const stats = AutoPassiveLoader.getDetailedStats();
      console.log("⚡ Répartition par type de déclenchement:", stats.byTriggerType);
      console.log("⏱️ Répartition par cooldown:", stats.byCooldown);
      console.log("🔮 Répartition par élément:", stats.byElement);
      console.log(`📊 Cooldown moyen: ${stats.averageCooldown} tours`);
      console.log("✅ Validation:", AutoPassiveLoader.validateLoadedPassives() ? "OK" : "ERREUR");
    } catch {
      console.log("📚 Mode manuel - auto-loader indisponible");
      console.log("📜 Liste des passifs:", this.getPassivesList());
    }
  }
  
  /**
   * Reset pour les tests
   */
  static reset(): void {
    this.passives.clear();
    this.initialized = false;
  }
  
  // === NOUVELLES MÉTHODES AVEC AUTO-LOADER ===
  
  /**
   * Rechargement à chaud des passifs (développement)
   */
  static async hotReload(): Promise<void> {
    if (!this.initialized) return;
    
    try {
      console.log("🔄 Rechargement à chaud du système de passifs...");
      await AutoPassiveLoader.hotReload();
      
      // Recharger dans notre registre
      this.passives.clear();
      const reloadedPassives = AutoPassiveLoader.getAllPassives();
      for (const passive of reloadedPassives) {
        this.passives.set(passive.config.id, passive);
      }
      
      console.log(`🔥 ${this.passives.size} passif(s) rechargé(s) à chaud`);
    } catch (error) {
      console.error("❌ Erreur lors du rechargement à chaud:", error);
    }
  }
  
  /**
   * Obtenir passifs par type de déclenchement via auto-loader
   */
  static getPassivesFromTriggerType(triggerType: string): BasePassive[] {
    try {
      return AutoPassiveLoader.getPassivesByTriggerType(triggerType);
    } catch {
      // Fallback si auto-loader pas disponible
      return Array.from(this.passives.values()).filter(
        passive => passive.config.triggerType === triggerType
      );
    }
  }
}

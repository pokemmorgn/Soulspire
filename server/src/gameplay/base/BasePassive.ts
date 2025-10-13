// server/src/gameplay/base/BasePassive.ts
import { IBattleParticipant } from "../../models/Battle";

// Types de déclenchement
export type PassiveTriggerType = 
  | "on_hp_threshold"     // Se déclenche sous X% HP
  | "on_damaged"          // Se déclenche en prenant des dégâts
  | "on_attack"           // Se déclenche en attaquant
  | "on_critical"         // Se déclenche sur coup critique
  | "on_kill"             // Se déclenche en tuant un ennemi
  | "on_ally_damaged"     // Se déclenche quand un allié prend des dégâts
  | "on_turn_start"       // Se déclenche au début de chaque tour
  | "always_active";      // Passif toujours actif (stat modifier permanent)

// Configuration d'un passif
export interface IPassiveConfig {
  id: string;
  name: string;
  description: string;
  
  // Type de déclenchement
  triggerType: PassiveTriggerType;
  
  // Cooldown interne (en tours) - 0 si pas de cooldown
  internalCooldown: number;
  
  // Paramètres de déclenchement selon le type
  triggerConditions?: {
    hpThresholdPercent?: number;  // Pour on_hp_threshold (ex: 50 = sous 50% HP)
    minDamageTaken?: number;       // Pour on_damaged (dégâts minimum requis)
    canTriggerOnSelf?: boolean;    // Si le passif peut se déclencher sur le possesseur
  };
  
  // Élément et rôle
  element?: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  requiresRole?: string[];
  
  // Niveau max
  maxLevel: number;
}

// Résultat du déclenchement d'un passif
export interface IPassiveResult {
  triggered: boolean;
  message?: string;
  effects?: Array<{
    effectId: string;
    targetId: string;
    duration: number;
    stacks?: number;
  }>;
  damage?: number;
  healing?: number;
  statModifiers?: {
    atk?: number;
    def?: number;
    speed?: number;
    [key: string]: number | undefined;
  };
}

// Contexte de déclenchement
export interface IPassiveTriggerContext {
  currentTurn: number;
  actor: IBattleParticipant;
  target?: IBattleParticipant;
  damageTaken?: number;
  damageDealt?: number;
  wasCritical?: boolean;
  wasKill?: boolean;
  allAllies?: IBattleParticipant[];
  allEnemies?: IBattleParticipant[];
}

/**
 * Classe de base abstraite pour tous les passifs
 */
export abstract class BasePassive {
  public config: IPassiveConfig;
  private lastTriggerTurn: Map<string, number>; // heroId -> dernier tour de déclenchement
  
  constructor(config: IPassiveConfig) {
    this.config = config;
    this.lastTriggerTurn = new Map();
  }
  
  /**
   * Vérifier si le passif peut se déclencher
   * @param context - Contexte du déclenchement
   * @param passiveLevel - Niveau du passif
   * @returns true si les conditions sont remplies
   */
canTrigger(context: IPassiveTriggerContext, passiveLevel: number): boolean {
    const owner = context.actor;
    
    // Vérifier si le possesseur est vivant
    if (!owner.status.alive) {
      console.log(`❌ ${this.config.name}: ${owner.name} n'est pas vivant`);
      return false;
    }
    
    // Vérifier le cooldown interne
    if (this.config.internalCooldown > 0) {
      const lastTrigger = this.lastTriggerTurn.get(owner.heroId) || 0;
      const turnsSinceLastTrigger = context.currentTurn - lastTrigger;
      
      console.log(`🔎 ${this.config.name}: Cooldown check - Last trigger: tour ${lastTrigger}, Current: tour ${context.currentTurn}, Turns since: ${turnsSinceLastTrigger}/${this.config.internalCooldown}`);
      
      if (turnsSinceLastTrigger < this.config.internalCooldown) {
        console.log(`⏰ ${this.config.name}: En cooldown (${this.config.internalCooldown - turnsSinceLastTrigger} tours restants)`);
        return false; // Encore en cooldown
      }
    }
    
    // Vérifier les conditions selon le type de déclenchement
    switch (this.config.triggerType) {
      case "on_hp_threshold":
        const canTriggerHp = this.checkHpThreshold(owner);
        console.log(`🔎 ${this.config.name}: HP threshold result = ${canTriggerHp}`);
        return canTriggerHp;
        
      case "on_damaged":
        return this.checkDamaged(context);
        
      case "on_attack":
        return context.damageDealt !== undefined && context.damageDealt > 0;
        
      case "on_critical":
        return context.wasCritical === true;
        
      case "on_kill":
        return context.wasKill === true;
        
      case "on_ally_damaged":
        return context.target !== undefined && 
               context.damageTaken !== undefined && 
               context.damageTaken > 0;
        
      case "on_turn_start":
        return true; // Se déclenche toujours au début du tour
        
      case "always_active":
        return false; // Les passifs toujours actifs ne "se déclenchent" pas
        
      default:
        return false;
    }
  }
  
  /**
   * Vérifier le seuil de HP
   */
  private checkHpThreshold(owner: IBattleParticipant): boolean {
    const threshold = this.config.triggerConditions?.hpThresholdPercent || 50;
    const currentHpPercent = (owner.currentHp / owner.stats.maxHp) * 100;
    
    console.log(`🔎 HP Threshold check: ${owner.name} at ${currentHpPercent.toFixed(1)}% HP, threshold: ${threshold}%`);
    
    // ✅ FIX : Vérifier simplement si sous le seuil
    // Le cooldown est déjà géré dans canTrigger() AVANT d'appeler cette méthode
    return currentHpPercent < threshold;
  }
  
  /**
   * Vérifier la prise de dégâts
   */
  private checkDamaged(context: IPassiveTriggerContext): boolean {
    if (!context.damageTaken || context.damageTaken <= 0) return false;
    
    const minDamage = this.config.triggerConditions?.minDamageTaken || 0;
    return context.damageTaken >= minDamage;
  }
  
  /**
   * Déclencher le passif
   * @param context - Contexte du déclenchement
   * @param passiveLevel - Niveau du passif
   * @returns Résultat du déclenchement
   */
  trigger(context: IPassiveTriggerContext, passiveLevel: number): IPassiveResult {
    // Enregistrer le tour de déclenchement pour le cooldown
    if (this.config.internalCooldown > 0) {
      this.lastTriggerTurn.set(context.actor.heroId, context.currentTurn);
    }
    
    // Appeler l'implémentation spécifique du passif
    return this.onTrigger(context, passiveLevel);
  }
  
  /**
   * Méthode abstraite : implémentation spécifique de chaque passif
   * DOIT être implémentée par les classes enfants
   */
  protected abstract onTrigger(
    context: IPassiveTriggerContext,
    passiveLevel: number
  ): IPassiveResult;
  
  /**
   * Réinitialiser le cooldown (pour tests ou mécaniques spéciales)
   */
  resetCooldown(heroId: string): void {
    this.lastTriggerTurn.delete(heroId);
  }
  
  /**
   * Obtenir le temps restant avant prochain déclenchement
   */
  getCooldownRemaining(heroId: string, currentTurn: number): number {
    if (this.config.internalCooldown === 0) return 0;
    
    const lastTrigger = this.lastTriggerTurn.get(heroId) || 0;
    const turnsSinceLastTrigger = currentTurn - lastTrigger;
    
    return Math.max(0, this.config.internalCooldown - turnsSinceLastTrigger);
  }
  
  /**
   * Vérifier si le passif est en cooldown
   */
  isOnCooldown(heroId: string, currentTurn: number): boolean {
    return this.getCooldownRemaining(heroId, currentTurn) > 0;
  }
  
  /**
   * Pour les passifs toujours actifs, obtenir les modificateurs de stats
   */
  getStatModifiers?(passiveLevel: number): {
    atk?: number;
    def?: number;
    speed?: number;
    [key: string]: number | undefined;
  };
}

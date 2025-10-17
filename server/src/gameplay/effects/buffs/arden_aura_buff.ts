// server/src/gameplay/effects/buffs/arden_aura_buff.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Arden Aura Buff (Buff d'Aura Ardente)
 * - Se met sur les alliés affectés par l'Aura Ardente de Pyra
 * - Augmente attaque et vitesse d'attaque
 * - Lié à la source (si Pyra perd l'aura, les buffs disparaissent)
 * - Non stackable
 * - Durée : Synchronisée avec l'aura source
 * - Utilisé par : Tous les alliés dans l'aura de Pyra
 */
export class ArdenAuraBuffEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "arden_aura_buff",
      name: "Aura Ardente (Buff)",
      description: "Bonus d'attaque et vitesse de l'Aura Ardente",
      type: "buff",
      category: "stat_modifier",
      stackable: false,
      maxStacks: 1,
      baseDuration: 6
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    const bonuses = this.getBonuses(target);
    
    return {
      message: `🔥⚡ ${target.name} est renforcé par l'Aura Ardente ! (+${bonuses.attackBonus}% ATK, +${bonuses.speedBonus}% vitesse)`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const bonuses = this.getBonuses(target);
    
    return {
      message: `🔥⚡ ${target.name} bénéficie de l'Aura Ardente (+${bonuses.attackBonus}% ATK, +${bonuses.speedBonus}% vitesse)`,
      statModifiers: {
        atk: bonuses.attackBonus,
        speed: bonuses.speedBonus
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 ${target.name} perd les bénéfices de l'Aura Ardente`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Peut être appliqué à tous les alliés vivants
    return target.status.alive;
  }
  
  /**
   * Obtenir les bonus d'attaque et vitesse
   */
  private getBonuses(target: IBattleParticipant): {
    attackBonus: number;
    speedBonus: number;
  } {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return { attackBonus: 0, speedBonus: 0 };
    
    const buffEffect = activeEffects.find((effect: any) => effect.id === "arden_aura_buff");
    if (!buffEffect || !buffEffect.metadata) return { attackBonus: 0, speedBonus: 0 };
    
    return {
      attackBonus: buffEffect.metadata.attackBonus || 12,
      speedBonus: buffEffect.metadata.speedBonus || 12
    };
  }
  
  /**
   * Vérifier si une cible a le buff d'Aura Ardente
   */
  static hasAuraBuff(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "arden_aura_buff");
  }
  
  /**
   * Obtenir les bonus actuels (méthode statique)
   */
  static getCurrentBonuses(target: IBattleParticipant): {
    attackBonus: number;
    speedBonus: number;
  } {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return { attackBonus: 0, speedBonus: 0 };
    
    const buffEffect = activeEffects.find((effect: any) => effect.id === "arden_aura_buff");
    if (!buffEffect || !buffEffect.metadata) return { attackBonus: 0, speedBonus: 0 };
    
    return {
      attackBonus: buffEffect.metadata.attackBonus || 12,
      speedBonus: buffEffect.metadata.speedBonus || 12
    };
  }
  
  /**
   * Appliquer les bonus de stats (pour BattleEngine)
   */
  static applyStatModifiers(target: IBattleParticipant): {
    atkMultiplier: number;
    speedMultiplier: number;
  } {
    if (!this.hasAuraBuff(target)) {
      return { atkMultiplier: 1.0, speedMultiplier: 1.0 };
    }
    
    const bonuses = this.getCurrentBonuses(target);
    
    return {
      atkMultiplier: 1 + (bonuses.attackBonus / 100),
      speedMultiplier: 1 + (bonuses.speedBonus / 100)
    };
  }
  
  /**
   * Calculer l'ATK effective avec le buff
   */
  static getEffectiveAttack(target: IBattleParticipant): number {
    const modifiers = this.applyStatModifiers(target);
    return Math.floor(target.stats.atk * modifiers.atkMultiplier);
  }
  
  /**
   * Calculer la vitesse effective avec le buff
   */
  static getEffectiveSpeed(target: IBattleParticipant): number {
    const baseSpeed = (target.stats as any).vitesse || target.stats.speed || 80;
    const modifiers = this.applyStatModifiers(target);
    return Math.floor(baseSpeed * modifiers.speedMultiplier);
  }
  
  /**
   * Vérifier la source de l'aura (pour maintenance de cohérence)
   */
  static checkAuraSource(target: IBattleParticipant, allAllies: IBattleParticipant[]): boolean {
    if (!this.hasAuraBuff(target)) return true; // Pas de buff = OK
    
    const activeEffect = (target as any).activeEffects?.find(
      (e: any) => e.id === "arden_aura_buff"
    );
    
    if (!activeEffect || !activeEffect.metadata) return false;
    
    const sourceId = activeEffect.metadata.sourceId;
    if (!sourceId) return true; // Pas de source = OK pour compatibilité
    
    // Vérifier que la source a encore l'aura active
    const source = allAllies.find(ally => ally.heroId === sourceId);
    if (!source || !source.status.alive) return false;
    
    // Vérifier que la source a encore arden_aura actif
    const sourceEffects = (source as any).activeEffects as any[];
    if (!sourceEffects) return false;
    
    return sourceEffects.some((e: any) => e.id === "arden_aura");
  }
  
  /**
   * Nettoyer les buffs orphelins (source disparue)
   */
  static cleanupOrphanedBuffs(allParticipants: IBattleParticipant[]): number {
    let removedCount = 0;
    
    for (const participant of allParticipants) {
      if (!this.hasAuraBuff(participant)) continue;
      
      const isValid = this.checkAuraSource(participant, allParticipants);
      
      if (!isValid) {
        // Retirer le buff orphelin
        const activeEffects = (participant as any).activeEffects as any[];
        if (activeEffects) {
          const index = activeEffects.findIndex((e: any) => e.id === "arden_aura_buff");
          if (index > -1) {
            activeEffects.splice(index, 1);
            console.log(`💨 Buff Aura Ardente orphelin retiré de ${participant.name}`);
            removedCount++;
          }
        }
      }
    }
    
    return removedCount;
  }
}

// Export de l'instance pour EffectManager
export const ardenAuraBuffEffect = new ArdenAuraBuffEffect();

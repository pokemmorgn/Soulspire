// server/src/gameplay/effects/buffs/flame_resistance.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Flame Resistance (Résistance au Feu)
 * - Augmente la résistance aux dégâts de feu
 * - Réduit la durée des brûlures existantes
 * - Immunité partielle aux nouvelles brûlures
 * - Stackable (jusqu'à 3 stacks)
 * - Durée : 4 tours (base)
 * - Utilisé par : RestoringFlameSpell (Pyra)
 */
export class FlameResistanceEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "flame_resistance",
      name: "Résistance au Feu",
      description: "Résistance accrue aux dégâts et effets de feu",
      type: "buff",
      category: "stat_modifier",
      stackable: true,
      maxStacks: 3,
      baseDuration: 4
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    const resistance = this.getFireResistance(target);
    
    return {
      message: `🔥🛡️ ${target.name} développe une résistance au feu ! (${resistance}% résistance)`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const resistance = this.getFireResistance(target);
    const burnImmunity = this.getBurnImmunityChance(target);
    
    return {
      message: `🔥🛡️ ${target.name} résiste au feu (${resistance}% résistance, ${burnImmunity}% immunité brûlure)`,
      statModifiers: {
        fireResistance: resistance,
        burnImmunity: burnImmunity
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 La résistance au feu de ${target.name} s'estompe`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    return target.status.alive;
  }
  
  /**
   * Obtenir le pourcentage de résistance au feu
   */
  private getFireResistance(target: IBattleParticipant): number {
    const stacks = this.getStacks(target);
    
    // 15% par stack (15%, 30%, 45% max)
    return Math.min(50, stacks * 15);
  }
  
  /**
   * Obtenir la chance d'immunité aux brûlures
   */
  private getBurnImmunityChance(target: IBattleParticipant): number {
    const stacks = this.getStacks(target);
    
    // 25% par stack (25%, 50%, 75% max)
    return Math.min(80, stacks * 25);
  }
  
  /**
   * Obtenir le nombre de stacks
   */
  private getStacks(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "flame_resistance");
    if (!resistanceEffect) return 0;
    
    return resistanceEffect.stacks || 1;
  }
  
  /**
   * Vérifier si une cible a la résistance au feu
   */
  static hasFlameResistance(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "flame_resistance");
  }
  
  /**
   * Obtenir le pourcentage de résistance au feu (méthode statique)
   */
  static getFireResistance(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "flame_resistance");
    if (!resistanceEffect) return 0;
    
    const stacks = resistanceEffect.stacks || 1;
    return Math.min(50, stacks * 15);
  }
  
  /**
   * Obtenir la chance d'immunité aux brûlures (méthode statique)
   */
  static getBurnImmunityChance(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "flame_resistance");
    if (!resistanceEffect) return 0;
    
    const stacks = resistanceEffect.stacks || 1;
    return Math.min(80, stacks * 25);
  }
  
  /**
   * Appliquer la résistance aux dégâts de feu
   * À utiliser dans BattleEngine quand des dégâts de feu sont infligés
   */
  static applyFireDamageReduction(target: IBattleParticipant, fireDamage: number): number {
    if (!this.hasFlameResistance(target)) return fireDamage;
    
    const resistance = this.getFireResistance(target);
    const reducedDamage = Math.floor(fireDamage * (1 - resistance / 100));
    
    console.log(`🔥🛡️ Résistance au Feu réduit les dégâts de ${target.name} de ${resistance}% (${fireDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Vérifier l'immunité aux brûlures
   * À utiliser avant d'appliquer une brûlure
   */
  static rollBurnImmunity(target: IBattleParticipant): boolean {
    if (!this.hasFlameResistance(target)) return false;
    
    const immunityChance = this.getBurnImmunityChance(target);
    const roll = Math.random() * 100;
    
    const immune = roll < immunityChance;
    
    if (immune) {
      console.log(`🔥🛡️ ${target.name} résiste à la brûlure (${immunityChance}% chance, roll: ${roll.toFixed(1)})`);
    }
    
    return immune;
  }
  
  /**
   * Réduire la durée des brûlures existantes
   * À appliquer quand Flame Resistance est appliqué
   */
  static reduceBurnDuration(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const burnEffect = activeEffects.find((effect: any) => effect.id === "burn");
    if (!burnEffect) return 0;
    
    const originalDuration = burnEffect.duration;
    const reduction = Math.min(2, Math.floor(originalDuration / 2)); // Réduit de moitié, max 2 tours
    
    burnEffect.duration = Math.max(1, burnEffect.duration - reduction);
    
    console.log(`🔥🛡️ Résistance au Feu réduit la brûlure de ${target.name} (${originalDuration} → ${burnEffect.duration} tours)`);
    
    return reduction;
  }
  
  /**
   * Obtenir les stats complètes de résistance
   */
  static getResistanceStats(target: IBattleParticipant): {
    stacks: number;
    fireResistance: number;
    burnImmunity: number;
    hasResistance: boolean;
  } {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) {
      return { stacks: 0, fireResistance: 0, burnImmunity: 0, hasResistance: false };
    }
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "flame_resistance");
    if (!resistanceEffect) {
      return { stacks: 0, fireResistance: 0, burnImmunity: 0, hasResistance: false };
    }
    
    const stacks = resistanceEffect.stacks || 1;
    
    return {
      stacks,
      fireResistance: Math.min(50, stacks * 15),
      burnImmunity: Math.min(80, stacks * 25),
      hasResistance: true
    };
  }
  
  /**
   * Calculer l'efficacité contre les dégâts élémentaires
   */
  static calculateElementalEffectiveness(
    target: IBattleParticipant,
    elementType: string,
    baseDamage: number
  ): number {
    if (elementType !== "Fire") return baseDamage;
    
    return this.applyFireDamageReduction(target, baseDamage);
  }
}

// Export de l'instance pour EffectManager
export const flameResistanceEffect = new FlameResistanceEffect();

// server/src/gameplay/effects/dot/bleed.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Bleed (Saignement)
 * - DoT physique qui inflige des dégâts chaque tour
 * - Les dégâts sont DOUBLÉS si la cible attaque pendant le saignement
 * - Stackable jusqu'à 3 fois
 * - Dégâts basés sur ATK du caster + % HP cible
 * - Résistance : Aucune élémentaire (physique pur)
 */
export class BleedEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "bleed",
      name: "Saignement",
      description: "Dégâts physiques sur la durée - Doublés si la cible attaque",
      type: "dot",
      category: "damage_over_time",
      stackable: true,
      maxStacks: 3,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🩸 ${target.name} saigne !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Dégâts de base : 5% des HP max + ATK du caster
    const baseHpDamage = Math.floor(target.stats.maxHp * 0.05);
    const casterAtkBonus = Math.floor(appliedBy.stats.atk * 0.3);
    const baseDamage = baseHpDamage + casterAtkBonus;
    
    // Multiplicateur par stack (1x, 1.5x, 2x)
    const stackMultiplier = 1 + (stacks - 1) * 0.5;
    
    let totalDamage = Math.floor(baseDamage * stackMultiplier);
    
    // Note: Le doublement si attaque sera géré dans BattleEngine
    // Ici on calcule juste les dégâts de base
    
    // Minimum 1 dégât
    totalDamage = Math.max(1, totalDamage);
    
    return {
      damage: totalDamage,
      message: `🩸 ${target.name} subit ${totalDamage} dégâts de saignement (${stacks} stack${stacks > 1 ? 's' : ''})`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `🩹 Le saignement de ${target.name} s'arrête`
    };
  }
  
  // Vérifier si la cible peut saigner
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité générale
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    // Immunité spécifique au saignement
    if (target.status.buffs.includes("bleed_immunity") || target.status.buffs.includes("blood_seal")) {
      console.log(`🛡️ ${target.name} est immunisé au saignement`);
      return false;
    }
    
    // Les créatures sans sang (élémentaires, golems, etc.) devraient être immunisés
    // Note: Nécessiterait un tag "bloodless" ou similaire
    const isBloodless = (target as any).isBloodless || false;
    if (isBloodless) {
      console.log(`🛡️ ${target.name} n'a pas de sang (Bloodless)`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Vérifier si une cible saigne (pour doubler les dégâts si elle attaque)
   * À utiliser dans BattleEngine quand un participant attaque
   */
  static isBleeding(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "bleed");
  }
  
  /**
   * Obtenir le nombre de stacks de Bleed
   */
  static getBleedStacks(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const bleedEffect = activeEffects.find((effect: any) => effect.id === "bleed");
    return bleedEffect ? bleedEffect.stacks : 0;
  }
  
  /**
   * Appliquer les dégâts bonus de Bleed quand la cible attaque
   * À appeler dans BattleEngine après qu'un participant saignant attaque
   */
  static applyBleedMovementDamage(target: IBattleParticipant): number {
    if (!this.isBleeding(target)) return 0;
    
    const stacks = this.getBleedStacks(target);
    
    // Dégâts bonus : 2% HP max par stack
    const bonusDamage = Math.floor(target.stats.maxHp * 0.02 * stacks);
    
    console.log(`🩸 ${target.name} aggrave son saignement en attaquant ! (+${bonusDamage} dégâts)`);
    
    return bonusDamage;
  }
}

// Export de l'instance pour EffectManager
export const bleedEffect = new BleedEffect();

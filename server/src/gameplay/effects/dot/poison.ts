// server/src/gameplay/effects/dot/poison.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Poison (Empoisonnement)
 * - DoT qui inflige des dégâts chaque tour
 * - Réduit les soins reçus de 10% par stack
 * - Stackable jusqu'à 5 fois
 * - Dégâts basés sur % HP max + intelligence du caster
 * - Les héros Nature/Wind résistent mieux
 */
export class PoisonEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "poison",
      name: "Empoisonné",
      description: "Inflige des dégâts et réduit les soins reçus",
      type: "dot",
      category: "damage_over_time",
      stackable: true,
      maxStacks: 5,
      baseDuration: 4
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `☠️ ${target.name} est empoisonné !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Dégâts de base : 3% des HP max par tick
    const baseDamage = this.getBaseDamageFromStats(target, appliedBy, 0.03);
    
    // Multiplicateur par stack (1x, 1.4x, 1.8x, 2.2x, 2.6x)
    const stackMultiplier = 1 + (stacks - 1) * 0.4;
    
    let totalDamage = Math.floor(baseDamage * stackMultiplier);
    
    // Résistance élémentaire
    // Nature/Wind résistent mieux au poison
    if (target.element === "Wind" || target.element === "Nature") {
      totalDamage = Math.floor(totalDamage * 0.6); // 40% de réduction
    }
    
    // Minimum 1 dégât
    totalDamage = Math.max(1, totalDamage);
    
    // Calculer la réduction de soins
    const healingReduction = stacks * 10; // 10% par stack
    
    return {
      damage: totalDamage,
      message: `☠️ ${target.name} subit ${totalDamage} dégâts de poison (${stacks} stack${stacks > 1 ? 's' : ''}, -${healingReduction}% soins)`,
      statModifiers: {
        healingReceived: -healingReduction // Pour référence
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💚 ${target.name} n'est plus empoisonné`
    };
  }
  
  // Vérifier si la cible peut être empoisonnée
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité générale
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    // Immunité spécifique au poison
    if (target.status.buffs.includes("poison_immunity") || target.status.buffs.includes("antidote")) {
      console.log(`🛡️ ${target.name} est immunisé au poison`);
      return false;
    }
    
    // Les héros Nature/Wind ont 25% de chance de résister complètement
    if (target.element === "Wind" || target.element === "Nature") {
      const resistanceChance = 0.25; // 25%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au poison (${target.element} resistance)`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculer la réduction de soins pour l'effet Poison
   * À utiliser dans BattleEngine lors de l'application de soins
   */
  static getHealingReduction(target: IBattleParticipant): number {
    // Vérifier si la cible est empoisonnée
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const poisonEffect = activeEffects.find((effect: any) => effect.id === "poison");
    if (!poisonEffect) return 0;
    
    // 10% de réduction par stack
    return poisonEffect.stacks * 10;
  }
}

// Export de l'instance pour EffectManager
export const poisonEffect = new PoisonEffect();

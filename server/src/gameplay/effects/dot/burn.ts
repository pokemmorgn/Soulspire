// server/src/gameplay/effects/burn.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Burn (Brûlure)
 * - DoT de feu infligeant des dégâts chaque tour
 * - Stackable jusqu'à 5 fois
 * - Dégâts basés sur % HP max + intelligence du caster
 * - Résistance pour les héros Fire, vulnérabilité pour Water
 */
export class BurnEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "burn",
      name: "Brûlure",
      description: "Inflige des dégâts de feu chaque tour",
      type: "dot",
      category: "damage_over_time",
      stackable: true,
      maxStacks: 5,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🔥 ${target.name} prend feu !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Dégâts de base : 4% des HP max par tick
    const baseDamage = this.getBaseDamageFromStats(target, appliedBy, 0.04);
    
    // Multiplicateur par stack (1x, 1.5x, 2x, 2.5x, 3x)
    const stackMultiplier = 1 + (stacks - 1) * 0.5;
    
    let totalDamage = Math.floor(baseDamage * stackMultiplier);
    
    // Résistance élémentaire
    if (target.element === "Fire") {
      totalDamage = Math.floor(totalDamage * 0.5); // 50% de résistance
    } else if (target.element === "Water") {
      totalDamage = Math.floor(totalDamage * 1.3); // 30% de vulnérabilité
    }
    
    // Minimum 1 dégât
    totalDamage = Math.max(1, totalDamage);
    
    return {
      damage: totalDamage,
      message: `🔥 ${target.name} subit ${totalDamage} dégâts de brûlure (${stacks} stack${stacks > 1 ? 's' : ''})`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 La brûlure de ${target.name} s'éteint`
    };
  }
  
  // Vérifier si la cible peut être brûlée
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Les héros Fire ont une chance de résister complètement
    if (target.element === "Fire") {
      const resistanceChance = 0.3; // 30% de chance de résister
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste à la brûlure (Fire resistance)`);
        return false;
      }
    }
    
    // Vérifier immunité aux debuffs (si implémenté plus tard)
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const burnEffect = new BurnEffect();

// Réexport des types pour compatibilité avec l'ancien code
export { IEffect, EffectResult } from "../base/BaseEffect";

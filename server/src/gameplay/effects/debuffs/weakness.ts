// server/src/gameplay/effects/debuffs/weakness.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Weakness (Faiblesse)
 * - Réduit l'attaque de 15% par stack
 * - Stackable jusqu'à 3 fois (max -45% ATK)
 * - Durée moyenne (3 tours)
 * - Affecte toutes les sources de dégâts (attaque, sorts, ultimate)
 */
export class WeaknessEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "weakness",
      name: "Faiblesse",
      description: "Réduit l'attaque de la cible",
      type: "debuff",
      category: "stat_modifier",
      stackable: true,
      maxStacks: 3,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `💔 ${target.name} est affaibli !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Weakness n'a pas d'effet par tour (pas de dégâts)
    // L'effet est appliqué lors du calcul des dégâts dans BattleEngine
    
    const attackReduction = stacks * 15; // 15% par stack
    
    return {
      message: `💔 ${target.name} est affaibli (-${attackReduction}% ATK)`,
      statModifiers: {
        atk: -attackReduction
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💪 ${target.name} retrouve sa force`
    };
  }
  
  // Vérifier si la cible peut être affaiblie
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité générale
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    // Immunité spécifique (rage, berserk = résiste à la faiblesse)
    if (target.status.buffs.includes("rage") || target.status.buffs.includes("berserk")) {
      console.log(`🛡️ ${target.name} résiste à la faiblesse (Rage active)`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculer la réduction d'attaque pour l'effet Weakness
   * @param target - Cible affaiblie
   * @returns Pourcentage de réduction (0-100)
   */
  static getAttackReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const weaknessEffect = activeEffects.find((effect: any) => effect.id === "weakness");
    if (!weaknessEffect) return 0;
    
    // 15% de réduction par stack
    return weaknessEffect.stacks * 15;
  }
  
  /**
   * Appliquer la réduction d'attaque aux dégâts
   * @param target - Attaquant affaibli
   * @param baseDamage - Dégâts de base
   * @returns Dégâts après réduction
   */
  static applyAttackReduction(target: IBattleParticipant, baseDamage: number): number {
    const reduction = this.getAttackReduction(target);
    if (reduction === 0) return baseDamage;
    
    const reducedDamage = Math.floor(baseDamage * (1 - reduction / 100));
    return Math.max(1, reducedDamage); // Minimum 1 dégât
  }
}

// Export de l'instance pour EffectManager
export const weaknessEffect = new WeaknessEffect();

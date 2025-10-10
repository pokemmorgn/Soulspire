// server/src/gameplay/effects/buffs/ash_rampart.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Ash Rampart (Rempart de Cendres)
 * - Réduit les dégâts subis de X% (stocké dans metadata)
 * - Non stackable
 * - Durée : 5 tours (base)
 * - Utilisé par : Korran (Rare Tank)
 * - Similar à Incandescent Guard mais plus puissant (25% vs 20%)
 */
export class AshRampartEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "ash_rampart",
      name: "Rempart de Cendres",
      description: "Réduit les dégâts subis de 25%",
      type: "buff",
      category: "stat_modifier",
      stackable: false,
      maxStacks: 1,
      baseDuration: 5
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🔥🛡️ ${target.name} dresse un Rempart de Cendres !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const damageReduction = this.getDamageReduction(target);
    
    return {
      message: `🔥🛡️ ${target.name} est protégé par le Rempart de Cendres (-${damageReduction}% dégâts)`,
      statModifiers: {
        damageReduction: damageReduction
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 Le Rempart de Cendres de ${target.name} s'effondre`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    return true;
  }
  
  /**
   * Obtenir le pourcentage de réduction de dégâts
   */
  private getDamageReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const rampartEffect = activeEffects.find((effect: any) => effect.id === "ash_rampart");
    if (!rampartEffect || !rampartEffect.metadata) return 0;
    
    return rampartEffect.metadata.damageReduction || 25;
  }
  
  /**
   * Vérifier si une cible a le Rempart de Cendres actif
   */
  static hasAshRampart(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "ash_rampart");
  }
  
  /**
   * Obtenir le pourcentage de réduction de dégâts (méthode statique)
   */
  static getDamageReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const rampartEffect = activeEffects.find((effect: any) => effect.id === "ash_rampart");
    if (!rampartEffect || !rampartEffect.metadata) return 0;
    
    return rampartEffect.metadata.damageReduction || 25;
  }
  
  /**
   * Appliquer la réduction de dégâts
   * À utiliser dans BattleEngine.calculateDamage()
   */
  static applyDamageReduction(target: IBattleParticipant, baseDamage: number): number {
    if (!this.hasAshRampart(target)) return baseDamage;
    
    const reduction = this.getDamageReduction(target);
    const reducedDamage = Math.floor(baseDamage * (1 - reduction / 100));
    
    console.log(`🔥🛡️ Rempart de Cendres réduit les dégâts de ${target.name} de ${reduction}% (${baseDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
}

// Export de l'instance pour EffectManager
export const ashRampartEffect = new AshRampartEffect();

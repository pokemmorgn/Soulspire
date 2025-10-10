// server/src/gameplay/effects/buffs/incandescent_guard.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Incandescent Guard (Garde Incandescente)
 * - Réduit les dégâts subis de X% (stocké dans metadata)
 * - Contre-attaque : Brûle les attaquants en mêlée
 * - Non stackable
 * - Durée : 4 tours (base)
 * - Utilisé par : Brakka (Common Tank)
 */
export class IncandescentGuardEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "incandescent_guard",
      name: "Garde Incandescente",
      description: "Réduit les dégâts subis et brûle les attaquants mêlée",
      type: "buff",
      category: "stat_modifier",
      stackable: false,
      maxStacks: 1,
      baseDuration: 4
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🔥🛡️ ${target.name} lève son bouclier incandescent !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const damageReduction = this.getDamageReduction(target);
    
    return {
      message: `🔥🛡️ ${target.name} est protégé par la Garde Incandescente (-${damageReduction}% dégâts)`,
      statModifiers: {
        damageReduction: damageReduction
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 La Garde Incandescente de ${target.name} s'éteint`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Pas de restrictions particulières
    return true;
  }
  
  /**
   * Obtenir le pourcentage de réduction de dégâts
   */
  private getDamageReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const guardEffect = activeEffects.find((effect: any) => effect.id === "incandescent_guard");
    if (!guardEffect || !guardEffect.metadata) return 0;
    
    return guardEffect.metadata.damageReduction || 20;
  }
  
  /**
   * Vérifier si une cible a la Garde Incandescente active
   */
  static hasIncandescentGuard(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "incandescent_guard");
  }
  
  /**
   * Obtenir le pourcentage de réduction de dégâts (méthode statique)
   */
  static getDamageReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const guardEffect = activeEffects.find((effect: any) => effect.id === "incandescent_guard");
    if (!guardEffect || !guardEffect.metadata) return 0;
    
    return guardEffect.metadata.damageReduction || 20;
  }
  
  /**
   * Appliquer la réduction de dégâts
   * À utiliser dans BattleEngine.calculateDamage()
   */
  static applyDamageReduction(target: IBattleParticipant, baseDamage: number): number {
    if (!this.hasIncandescentGuard(target)) return baseDamage;
    
    const reduction = this.getDamageReduction(target);
    const reducedDamage = Math.floor(baseDamage * (1 - reduction / 100));
    
    console.log(`🔥🛡️ Garde Incandescente réduit les dégâts de ${target.name} de ${reduction}% (${baseDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Obtenir les données de contre-attaque
   * Retourne null si pas de garde active
   */
  static getCounterAttackData(target: IBattleParticipant): {
    burnDuration: number;
    burnStacks: number;
  } | null {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    const guardEffect = activeEffects.find((effect: any) => effect.id === "incandescent_guard");
    if (!guardEffect || !guardEffect.metadata) return null;
    
    return {
      burnDuration: guardEffect.metadata.counterBurnDuration || 2,
      burnStacks: guardEffect.metadata.counterBurnStacks || 1
    };
  }
  
  /**
   * Déclencher la contre-attaque (brûlure sur l'attaquant)
   * À appeler dans BattleEngine après qu'un attaquant mêlée frappe la cible
   * @param defender - Cible avec Garde Incandescente
   * @param attacker - Attaquant mêlée
   * @param isMeleeAttack - true si attaque mêlée
   * @returns true si contre-attaque déclenchée
   */
  static triggerCounterAttack(
    defender: IBattleParticipant,
    attacker: IBattleParticipant,
    isMeleeAttack: boolean
  ): boolean {
    // Vérifier si garde active
    if (!this.hasIncandescentGuard(defender)) return false;
    
    // Vérifier si attaque mêlée
    if (!isMeleeAttack) return false;
    
    // Obtenir données de contre-attaque
    const counterData = this.getCounterAttackData(defender);
    if (!counterData) return false;
    
    // Appliquer brûlure à l'attaquant
    // Note: Ceci sera géré dans BattleEngine via EffectManager
    console.log(`🔥⚔️ ${attacker.name} est brûlé par la Garde Incandescente de ${defender.name} !`);
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const incandescentGuardEffect = new IncandescentGuardEffect();

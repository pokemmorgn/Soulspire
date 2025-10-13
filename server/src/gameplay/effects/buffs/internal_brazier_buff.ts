// server/src/gameplay/effects/buffs/internal_brazier_buff.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Internal Brazier Buff (Brasier Intérieur activé)
 * - Réduit les dégâts subis de 15%
 * - Renvoie 10% des dégâts mêlée subis
 * - Non stackable
 * - Durée : 4 tours (base)
 * - Utilisé par : Korran (Rare Tank) via son passif
 */
export class InternalBrazierBuffEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "internal_brazier_buff",
      name: "Brasier Intérieur",
      description: "Résistance accrue et reflect damage",
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
      message: `🔥💪 L'armure de ${target.name} s'embrase !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const damageReduction = this.getDamageReduction(target);
    const reflectPercent = this.getReflectPercent(target);
    
    return {
      message: `🔥💪 ${target.name} est enveloppé de flammes (-${damageReduction}% dégâts, ${reflectPercent}% reflect)`,
      statModifiers: {
        damageReduction: damageReduction,
        reflectDamage: reflectPercent
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 Les flammes autour de ${target.name} s'éteignent`
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
    
    const brazierEffect = activeEffects.find((effect: any) => effect.id === "internal_brazier_buff");
    if (!brazierEffect || !brazierEffect.metadata) return 0;
    
    return brazierEffect.metadata.damageReduction || 15;
  }
  
  /**
   * Obtenir le pourcentage de reflect damage
   */
  private getReflectPercent(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const brazierEffect = activeEffects.find((effect: any) => effect.id === "internal_brazier_buff");
    if (!brazierEffect || !brazierEffect.metadata) return 0;
    
    return brazierEffect.metadata.reflectPercent || 10;
  }
  
  /**
   * Vérifier si une cible a le Brasier Intérieur actif
   */
  static hasInternalBrazier(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "internal_brazier_buff");
  }
  
  /**
   * Obtenir le pourcentage de réduction de dégâts (méthode statique)
   */
  static getDamageReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const brazierEffect = activeEffects.find((effect: any) => effect.id === "internal_brazier_buff");
    if (!brazierEffect || !brazierEffect.metadata) return 0;
    
    return brazierEffect.metadata.damageReduction || 15;
  }
  
  /**
   * Appliquer la réduction de dégâts
   * À utiliser dans BattleEngine.calculateDamage()
   */
  static applyDamageReduction(target: IBattleParticipant, baseDamage: number): number {
    if (!this.hasInternalBrazier(target)) return baseDamage;
    
    const reduction = this.getDamageReduction(target);
    const reducedDamage = Math.floor(baseDamage * (1 - reduction / 100));
    
    console.log(`🔥💪 Brasier Intérieur réduit les dégâts de ${target.name} de ${reduction}% (${baseDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Obtenir les données de reflect damage
   * Retourne null si pas de brasier actif
   */
  static getReflectData(target: IBattleParticipant): {
    reflectPercent: number;
  } | null {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    const brazierEffect = activeEffects.find((effect: any) => effect.id === "internal_brazier_buff");
    if (!brazierEffect || !brazierEffect.metadata) return null;
    
    return {
      reflectPercent: brazierEffect.metadata.reflectPercent || 10
    };
  }
  
  /**
   * Calculer les dégâts de reflect
   * @param target - Défenseur avec Brasier Intérieur
   * @param damageTaken - Dégâts reçus
   * @param isMeleeAttack - true si attaque mêlée
   * @returns Dégâts à renvoyer (0 si pas de reflect)
   */
  static calculateReflectDamage(
    target: IBattleParticipant,
    damageTaken: number,
    isMeleeAttack: boolean
  ): number {
    // Reflect uniquement sur attaques mêlée
    if (!isMeleeAttack) return 0;
    
    const reflectData = this.getReflectData(target);
    if (!reflectData) return 0;
    
    const reflectDamage = Math.floor(damageTaken * (reflectData.reflectPercent / 100));
    
    console.log(`🔥⚔️ Brasier Intérieur renvoie ${reflectDamage} dégâts (${reflectData.reflectPercent}% de ${damageTaken})`);
    
    return reflectDamage;
  }
}

// Export de l'instance pour EffectManager
export const internalBrazierBuffEffect = new InternalBrazierBuffEffect();

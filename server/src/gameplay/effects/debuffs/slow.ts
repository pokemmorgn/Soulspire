// server/src/gameplay/effects/debuffs/slow.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Slow (Ralentissement)
 * - Réduit la vitesse de 30% par stack
 * - Stackable jusqu'à 2 fois (max -60% vitesse)
 * - Durée moyenne (3 tours)
 * - Affecte l'ordre des tours (agit plus tard)
 * - Les héros rapides sont plus affectés
 */
export class SlowEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "slow",
      name: "Ralenti",
      description: "Réduit la vitesse de la cible",
      type: "debuff",
      category: "stat_modifier",
      stackable: true,
      maxStacks: 2,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🐌 ${target.name} est ralenti !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Slow n'a pas d'effet par tour (pas de dégâts)
    // L'effet est appliqué lors du calcul de l'ordre des tours dans BattleEngine
    
    const speedReduction = stacks * 30; // 30% par stack
    
    return {
      message: `🐌 ${target.name} est ralenti (-${speedReduction}% vitesse)`,
      statModifiers: {
        speed: -speedReduction
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `⚡ ${target.name} retrouve sa vitesse normale`
    };
  }
  
  // Vérifier si la cible peut être ralentie
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité générale
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    // Immunité spécifique (haste, swift = résiste au ralentissement)
    if (target.status.buffs.includes("haste") || target.status.buffs.includes("swift")) {
      console.log(`🛡️ ${target.name} est trop rapide pour être ralenti`);
      return false;
    }
    
    // Les héros Wind ont 25% de résistance (rapides et agiles)
    if (target.element === "Wind") {
      const resistanceChance = 0.25; // 25%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au ralentissement (Wind agility)`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Obtenir la réduction de vitesse pour l'effet Slow
   * @param target - Cible ralentie
   * @returns Pourcentage de réduction (0-100)
   */
  static getSpeedReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const slowEffect = activeEffects.find((effect: any) => effect.id === "slow");
    if (!slowEffect) return 0;
    
    // 30% de réduction par stack (max 2 stacks = 60%)
    return slowEffect.stacks * 30;
  }
  
  /**
   * Appliquer la réduction de vitesse aux calculs
   * @param target - Cible ralentie
   * @param baseSpeed - Vitesse de base
   * @returns Vitesse après réduction
   */
  static applySpeedReduction(target: IBattleParticipant, baseSpeed: number): number {
    const reduction = this.getSpeedReduction(target);
    if (reduction === 0) return baseSpeed;
    
    const reducedSpeed = Math.floor(baseSpeed * (1 - reduction / 100));
    return Math.max(1, reducedSpeed); // Minimum 1 vitesse
  }
  
  /**
   * Vérifier si une cible est ralentie
   * @param target - Cible à vérifier
   * @returns true si ralentie
   */
  static isSlowed(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "slow");
  }
}

// Export de l'instance pour EffectManager
export const slowEffect = new SlowEffect();

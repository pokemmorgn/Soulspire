// server/src/gameplay/effects/debuffs/armor_break.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Armor Break (Brisure d'armure)
 * - Réduit la défense de 30% (non stackable)
 * - Durée moyenne (3 tours)
 * - Plus puissant que Corrosion mais ne stack pas
 * - Différence avec Corrosion : Burst immédiat vs accumulation progressive
 */
export class ArmorBreakEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "armor_break",
      name: "Armure brisée",
      description: "Réduit fortement la défense de la cible",
      type: "debuff",
      category: "stat_modifier",
      stackable: false,
      maxStacks: 1,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🔨 L'armure de ${target.name} se brise !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Armor Break n'a pas d'effet par tour (pas de dégâts)
    // L'effet est appliqué lors du calcul des dégâts dans BattleEngine
    
    return {
      message: `🔨 L'armure de ${target.name} est brisée (-30% DEF)`,
      statModifiers: {
        def: -30
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `🛡️ L'armure de ${target.name} se répare`
    };
  }
  
  // Vérifier si la cible peut subir une brisure d'armure
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité générale
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    // Immunité spécifique (unbreakable armor, adamantine = résiste)
    if (target.status.buffs.includes("unbreakable") || target.status.buffs.includes("adamantine")) {
      console.log(`🛡️ ${target.name} a une armure incassable`);
      return false;
    }
    
    // Les Tanks en armure lourde ont 15% de résistance
    if (target.role === "Tank") {
      const resistanceChance = 0.15; // 15%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste à la brisure d'armure (Heavy armor)`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Vérifier si une cible a son armure brisée
   * @param target - Cible à vérifier
   * @returns true si armure brisée
   */
  static hasArmorBreak(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "armor_break");
  }
  
  /**
   * Obtenir la réduction de défense pour Armor Break
   * @param target - Cible avec armure brisée
   * @returns Pourcentage de réduction (0 ou 30)
   */
  static getDefenseReduction(target: IBattleParticipant): number {
    return this.hasArmorBreak(target) ? 30 : 0;
  }
  
  /**
   * Appliquer la réduction de défense d'Armor Break
   * @param target - Cible avec armure brisée
   * @param baseDefense - Défense de base
   * @returns Défense après réduction
   */
  static applyArmorBreak(target: IBattleParticipant, baseDefense: number): number {
    if (!this.hasArmorBreak(target)) return baseDefense;
    
    const reducedDefense = Math.floor(baseDefense * 0.7); // -30%
    console.log(`🔨 Armor Break réduit la défense de ${target.name} de 30% (${baseDefense} → ${reducedDefense})`);
    
    return Math.max(1, reducedDefense); // Minimum 1 DEF
  }
}

// Export de l'instance pour EffectManager
export const armorBreakEffect = new ArmorBreakEffect();

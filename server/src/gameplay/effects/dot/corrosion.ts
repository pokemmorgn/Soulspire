// server/src/gameplay/effects/dot/corrosion.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Corrosion (Corrosion/Acide)
 * - DoT qui inflige des dégâts chaque tour
 * - Réduit la défense de 5% par stack (cumulatif)
 * - Stackable jusqu'à 5 fois (max -25% DEF)
 * - Dégâts basés sur % HP max + intelligence du caster
 * - Les héros métalliques/armurés sont plus vulnérables
 */
export class CorrosionEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "corrosion",
      name: "Corrosion",
      description: "Inflige des dégâts et réduit la défense",
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
      message: `🧪 ${target.name} est rongé par la corrosion !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Dégâts de base : 3.5% des HP max par tick
    const baseDamage = this.getBaseDamageFromStats(target, appliedBy, 0.035);
    
    // Multiplicateur par stack (1x, 1.3x, 1.6x, 1.9x, 2.2x)
    const stackMultiplier = 1 + (stacks - 1) * 0.3;
    
    let totalDamage = Math.floor(baseDamage * stackMultiplier);
    
    // Bonus contre les Tanks (armure métallique)
    if (target.role === "Tank") {
      totalDamage = Math.floor(totalDamage * 1.2); // +20% dégâts
    }
    
    // Minimum 1 dégât
    totalDamage = Math.max(1, totalDamage);
    
    // Calculer la réduction de défense
    const defenseReduction = stacks * 5; // 5% par stack
    
    return {
      damage: totalDamage,
      message: `🧪 ${target.name} subit ${totalDamage} dégâts de corrosion (${stacks} stack${stacks > 1 ? 's' : ''}, -${defenseReduction}% DEF)`,
      statModifiers: {
        def: -defenseReduction // Pour référence
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `✨ La corrosion de ${target.name} disparaît`
    };
  }
  
  // Vérifier si la cible peut être corrodée
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité générale
    if (target.status.buffs.includes("immunity")) {
      console.log(`🛡️ ${target.name} est immunisé aux debuffs`);
      return false;
    }
    
    // Immunité spécifique à la corrosion
    if (target.status.buffs.includes("acid_immunity") || target.status.buffs.includes("corrosion_proof")) {
      console.log(`🛡️ ${target.name} est immunisé à la corrosion`);
      return false;
    }
    
    // Les créatures éthérées/spirituelles résistent (pas de corps physique)
    const isEthereal = (target as any).isEthereal || false;
    if (isEthereal) {
      console.log(`🛡️ ${target.name} est éthéré, la corrosion n'a pas d'effet`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculer la réduction de défense pour l'effet Corrosion
   * À utiliser dans BattleEngine lors du calcul des dégâts
   */
  static getDefenseReduction(target: IBattleParticipant): number {
    // Vérifier si la cible est corrodée
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const corrosionEffect = activeEffects.find((effect: any) => effect.id === "corrosion");
    if (!corrosionEffect) return 0;
    
    // 5% de réduction par stack
    return corrosionEffect.stacks * 5;
  }
  
  /**
   * Appliquer la réduction de défense aux stats de combat
   * Retourne la défense modifiée
   */
  static applyDefenseReduction(target: IBattleParticipant, baseDef: number): number {
    const reduction = this.getDefenseReduction(target);
    if (reduction === 0) return baseDef;
    
    const reducedDef = Math.floor(baseDef * (1 - reduction / 100));
    return Math.max(1, reducedDef); // Minimum 1 DEF
  }
}

// Export de l'instance pour EffectManager
export const corrosionEffect = new CorrosionEffect();

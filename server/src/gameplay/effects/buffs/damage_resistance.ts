// server/src/gameplay/effects/buffs/damage_resistance.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Damage Resistance (Résistance aux Dégâts)
 * - Réduit tous les types de dégâts reçus d'un pourcentage
 * - Effet générique utilisable par plusieurs sorts
 * - Non stackable (le plus récent remplace)
 * - Durée variable selon la source
 * - Utilisé par : SouffleDesBraises, potentiellement d'autres sorts défensifs
 */
export class DamageResistanceEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "damage_resistance",
      name: "Résistance aux Dégâts",
      description: "Réduit tous les dégâts reçus d'un pourcentage",
      type: "buff",
      category: "stat_modifier",
      stackable: false,
      maxStacks: 1,
      baseDuration: 4
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    const resistance = this.getDamageResistance(target);
    const source = this.getSourceSpell(target);
    
    return {
      message: `🛡️ ${target.name} développe une résistance ! (-${resistance}% dégâts${source ? ` via ${source}` : ''})`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const resistance = this.getDamageResistance(target);
    
    return {
      message: `🛡️ ${target.name} résiste aux dégâts (-${resistance}% dégâts)`,
      statModifiers: {
        damageResistance: resistance
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 La résistance aux dégâts de ${target.name} s'estompe`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    return target.status.alive;
  }
  
  /**
   * Obtenir le pourcentage de résistance aux dégâts
   */
  private getDamageResistance(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "damage_resistance");
    if (!resistanceEffect || !resistanceEffect.metadata) return 0;
    
    return resistanceEffect.metadata.damageReduction || 10;
  }
  
  /**
   * Obtenir la source du sort qui a appliqué la résistance
   */
  private getSourceSpell(target: IBattleParticipant): string | null {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "damage_resistance");
    if (!resistanceEffect || !resistanceEffect.metadata) return null;
    
    return resistanceEffect.metadata.sourceSpell || null;
  }
  
  /**
   * Vérifier si une cible a une résistance aux dégâts active
   */
  static hasDamageResistance(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "damage_resistance");
  }
  
  /**
   * Obtenir le pourcentage de résistance aux dégâts (méthode statique)
   */
  static getDamageResistance(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "damage_resistance");
    if (!resistanceEffect || !resistanceEffect.metadata) return 0;
    
    return resistanceEffect.metadata.damageReduction || 10;
  }
  
  /**
   * Appliquer la résistance aux dégâts
   * À utiliser dans BattleEngine.calculateDamage()
   */
  static applyDamageResistance(target: IBattleParticipant, baseDamage: number): number {
    if (!this.hasDamageResistance(target)) return baseDamage;
    
    const resistance = this.getDamageResistance(target);
    const reducedDamage = Math.floor(baseDamage * (1 - resistance / 100));
    
    console.log(`🛡️ Résistance aux Dégâts réduit les dégâts de ${target.name} de ${resistance}% (${baseDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Obtenir les métadonnées complètes de l'effet
   */
  static getResistanceData(target: IBattleParticipant): {
    damageReduction: number;
    sourceSpell: string | null;
    isActive: boolean;
    remainingDuration?: number;
  } {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) {
      return { damageReduction: 0, sourceSpell: null, isActive: false };
    }
    
    const resistanceEffect = activeEffects.find((effect: any) => effect.id === "damage_resistance");
    if (!resistanceEffect) {
      return { damageReduction: 0, sourceSpell: null, isActive: false };
    }
    
    return {
      damageReduction: resistanceEffect.metadata?.damageReduction || 10,
      sourceSpell: resistanceEffect.metadata?.sourceSpell || null,
      isActive: true,
      remainingDuration: resistanceEffect.duration
    };
  }
  
  /**
   * Vérifier si la résistance provient d'une source spécifique
   */
  static isFromSource(target: IBattleParticipant, sourceSpell: string): boolean {
    const data = this.getResistanceData(target);
    return data.isActive && data.sourceSpell === sourceSpell;
  }
  
  /**
   * Appliquer ou mettre à jour une résistance avec source
   */
  static applyResistanceWithSource(
    target: IBattleParticipant,
    damageReduction: number,
    duration: number,
    sourceSpell: string,
    appliedBy: IBattleParticipant
  ): boolean {
    // Vérifier si une résistance existe déjà
    const currentData = this.getResistanceData(target);
    
    if (currentData.isActive) {
      // Si la nouvelle résistance est plus forte ou de la même source, remplacer
      if (damageReduction >= currentData.damageReduction || currentData.sourceSpell === sourceSpell) {
        // Retirer l'ancienne résistance
        const activeEffects = (target as any).activeEffects as any[];
        const index = activeEffects.findIndex((e: any) => e.id === "damage_resistance");
        if (index > -1) {
          activeEffects.splice(index, 1);
        }
        
        return true; // Indiquer qu'on peut appliquer la nouvelle
      } else {
        console.log(`🛡️ Résistance existante plus forte (${currentData.damageReduction}% > ${damageReduction}%), conservée`);
        return false;
      }
    }
    
    return true; // Pas de résistance existante, on peut appliquer
  }
  
  /**
   * Calculer l'efficacité selon le type de dégâts
   */
  static calculateResistanceEfficiency(
    target: IBattleParticipant,
    damageType: "physical" | "magical" | "true",
    baseDamage: number
  ): {
    finalDamage: number;
    damageBlocked: number;
    efficiency: number;
  } {
    if (!this.hasDamageResistance(target)) {
      return {
        finalDamage: baseDamage,
        damageBlocked: 0,
        efficiency: 0
      };
    }
    
    // La résistance aux dégâts fonctionne sur tous les types sauf "true damage"
    if (damageType === "true") {
      return {
        finalDamage: baseDamage,
        damageBlocked: 0,
        efficiency: 0
      };
    }
    
    const resistance = this.getDamageResistance(target);
    const finalDamage = this.applyDamageResistance(target, baseDamage);
    const damageBlocked = baseDamage - finalDamage;
    const efficiency = (damageBlocked / baseDamage) * 100;
    
    return {
      finalDamage,
      damageBlocked,
      efficiency
    };
  }
  
  /**
   * Nettoyer les résistances expirées ou conflictuelles
   */
  static cleanupExpiredResistances(participants: IBattleParticipant[]): number {
    let removedCount = 0;
    
    for (const participant of participants) {
      const activeEffects = (participant as any).activeEffects as any[];
      if (!activeEffects) continue;
      
      const resistanceEffects = activeEffects.filter((e: any) => e.id === "damage_resistance");
      
      // Si plusieurs résistances (ne devrait pas arriver), garder la plus forte
      if (resistanceEffects.length > 1) {
        const strongest = resistanceEffects.reduce((best: any, current: any) => 
          (current.metadata?.damageReduction || 0) > (best.metadata?.damageReduction || 0) ? current : best
        );
        
        // Retirer les autres
        for (let i = activeEffects.length - 1; i >= 0; i--) {
          const effect = activeEffects[i];
          if (effect.id === "damage_resistance" && effect !== strongest) {
            activeEffects.splice(i, 1);
            removedCount++;
          }
        }
        
        if (removedCount > 0) {
          console.log(`🛡️ ${removedCount} résistances en doublon nettoyées sur ${participant.name}`);
        }
      }
    }
    
    return removedCount;
  }
}

// Export de l'instance pour EffectManager
export const damageResistanceEffect = new DamageResistanceEffect()

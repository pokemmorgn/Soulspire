// server/src/gameplay/DebuffManager.ts
import { IBattleParticipant } from "../models/Battle";
import { WeaknessEffect } from "./effects/debuffs/weakness";
import { VulnerabilityEffect } from "./effects/debuffs/vulnerability";
import { ArmorBreakEffect } from "./effects/debuffs/armor_break";
import { SlowEffect } from "./effects/debuffs/slow";

/**
 * Gestionnaire centralisé pour tous les effets secondaires des Debuffs
 * Évite de polluer le BattleEngine avec des imports multiples
 */
export class DebuffManager {
  
  /**
   * Appliquer la réduction d'attaque de Weakness
   * @param attacker - Participant qui attaque (possiblement affaibli)
   * @param baseDamage - Dégâts de base
   * @returns Dégâts après réduction
   */
  static applyWeakness(attacker: IBattleParticipant, baseDamage: number): number {
    const reduction = WeaknessEffect.getAttackReduction(attacker);
    
    if (reduction > 0) {
      const reducedDamage = WeaknessEffect.applyAttackReduction(attacker, baseDamage);
      console.log(`💔 Weakness réduit les dégâts de ${attacker.name} de ${reduction}% (${baseDamage} → ${reducedDamage})`);
      return reducedDamage;
    }
    
    return baseDamage;
  }
  
  /**
   * Appliquer le multiplicateur de Vulnerability
   * @param target - Cible qui reçoit les dégâts (possiblement vulnérable)
   * @param baseDamage - Dégâts de base
   * @returns Dégâts après multiplicateur
   */
  static applyVulnerability(target: IBattleParticipant, baseDamage: number): number {
    if (VulnerabilityEffect.isVulnerable(target)) {
      return VulnerabilityEffect.applyVulnerability(target, baseDamage);
    }
    
    return baseDamage;
  }
  
  /**
   * Appliquer la réduction de défense d'Armor Break
   * @param target - Cible dont on calcule la défense (possiblement armure brisée)
   * @param baseDefense - Défense de base
   * @returns Défense après réduction
   */
  static applyArmorBreak(target: IBattleParticipant, baseDefense: number): number {
    if (ArmorBreakEffect.hasArmorBreak(target)) {
      return ArmorBreakEffect.applyArmorBreak(target, baseDefense);
    }
    
    return baseDefense;
  }
  
  /**
   * Appliquer la réduction de vitesse de Slow
   * @param target - Cible dont on calcule la vitesse (possiblement ralentie)
   * @param baseSpeed - Vitesse de base
   * @returns Vitesse après réduction
   */
  static applySlowEffect(target: IBattleParticipant, baseSpeed: number): number {
    const reduction = SlowEffect.getSpeedReduction(target);
    
    if (reduction > 0) {
      const reducedSpeed = SlowEffect.applySpeedReduction(target, baseSpeed);
      // Log uniquement si appelé dans un contexte approprié (tri de vitesse)
      return reducedSpeed;
    }
    
    return baseSpeed;
  }
  
  /**
   * Vérifier si une cible a un debuff actif
   * @param target - Cible à vérifier
   * @param debuffId - ID du debuff ("weakness", "vulnerability", "armor_break", "slow")
   * @returns true si le debuff est actif
   */
  static hasDebuff(target: IBattleParticipant, debuffId: string): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === debuffId);
  }
  
  /**
   * Obtenir tous les debuffs actifs d'une cible
   * @param target - Cible à analyser
   * @returns Liste des IDs de debuffs actifs
   */
  static getActiveDebuffs(target: IBattleParticipant): string[] {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return [];
    
    const debuffIds = ["weakness", "vulnerability", "armor_break", "slow"];
    return activeEffects
      .filter((effect: any) => debuffIds.includes(effect.id))
      .map((effect: any) => effect.id);
  }
  
  /**
   * Calculer l'impact total des debuffs sur les stats d'une cible
   * Utile pour l'UI ou les estimations
   * @param target - Cible à analyser
   * @returns Objet avec les modifications de stats
   */
  static calculateDebuffImpact(target: IBattleParticipant): {
    atkReduction: number;
    defReduction: number;
    speedReduction: number;
    damageAmplification: number;
  } {
    return {
      atkReduction: WeaknessEffect.getAttackReduction(target),
      defReduction: ArmorBreakEffect.getDefenseReduction(target),
      speedReduction: SlowEffect.getSpeedReduction(target),
      damageAmplification: VulnerabilityEffect.isVulnerable(target) ? 25 : 0
    };
  }
  
  /**
   * Obtenir un résumé des debuffs actifs pour l'UI
   * @param target - Cible à analyser
   * @returns Résumé lisible
   */
  static getDebuffSummary(target: IBattleParticipant): string {
    const activeDebuffs = this.getActiveDebuffs(target);
    
    if (activeDebuffs.length === 0) {
      return "Aucun debuff actif";
    }
    
    const impact = this.calculateDebuffImpact(target);
    const parts: string[] = [];
    
    if (impact.atkReduction > 0) {
      parts.push(`💔 Weakness (-${impact.atkReduction}% ATK)`);
    }
    if (impact.damageAmplification > 0) {
      parts.push(`🎯 Vulnerability (+${impact.damageAmplification}% dégâts reçus)`);
    }
    if (impact.defReduction > 0) {
      parts.push(`🔨 Armor Break (-${impact.defReduction}% DEF)`);
    }
    if (impact.speedReduction > 0) {
      parts.push(`🐌 Slow (-${impact.speedReduction}% vitesse)`);
    }
    
    return parts.join(", ");
  }
  
  /**
   * Vérifier si une cible est fortement debuffée (3+ debuffs actifs)
   * Utile pour des achievements ou mécaniques spéciales
   * @param target - Cible à vérifier
   * @returns true si 3+ debuffs actifs
   */
  static isHeavilyDebuffed(target: IBattleParticipant): boolean {
    return this.getActiveDebuffs(target).length >= 3;
  }
  
  /**
   * Calculer la puissance offensive réelle après Weakness
   * @param attacker - Attaquant
   * @param baseAtk - ATK de base
   * @returns ATK effective
   */
  static getEffectiveAttack(attacker: IBattleParticipant, baseAtk: number): number {
    return this.applyWeakness(attacker, baseAtk);
  }
  
  /**
   * Calculer la défense réelle après Armor Break
   * @param defender - Défenseur
   * @param baseDef - DEF de base
   * @returns DEF effective
   */
  static getEffectiveDefense(defender: IBattleParticipant, baseDef: number): number {
    return this.applyArmorBreak(defender, baseDef);
  }
  
  /**
   * Calculer la vitesse réelle après Slow
   * @param participant - Participant
   * @param baseSpeed - Vitesse de base
   * @returns Vitesse effective
   */
  static getEffectiveSpeed(participant: IBattleParticipant, baseSpeed: number): number {
    return this.applySlowEffect(participant, baseSpeed);
  }
}

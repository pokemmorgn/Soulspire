// server/src/gameplay/BuffManager.ts
import { IBattleParticipant } from "../models/Battle";
import { ShieldEffect } from "./effects/buffs/shield";
import { IncandescentGuardEffect } from "./effects/buffs/incandescent_guard";
import { AshRampartEffect } from "./effects/buffs/ash_rampart";

/**
 * Gestionnaire centralisé pour tous les effets secondaires des Buffs
 * Évite de polluer le BattleEngine avec des imports multiples
 */
export class BuffManager {
  
  /**
   * Appliquer l'absorption du bouclier aux dégâts
   * @param target - Cible qui reçoit les dégâts
   * @param incomingDamage - Dégâts entrants
   * @returns Objet avec dégâts finaux et dégâts bloqués
   */
  static applyShieldAbsorption(
    target: IBattleParticipant,
    incomingDamage: number
  ): { damageTaken: number; damageBlocked: number } {
    if (!ShieldEffect.hasShield(target)) {
      return {
        damageTaken: incomingDamage,
        damageBlocked: 0
      };
    }
    
    return ShieldEffect.absorbDamage(target, incomingDamage);
  }
  
  /**
   * Appliquer la réduction de dégâts de la Garde Incandescente
   * @param target - Cible qui reçoit les dégâts
   * @param baseDamage - Dégâts de base
   * @returns Dégâts après réduction
   */
  static applyIncandescentGuard(target: IBattleParticipant, baseDamage: number): number {
    if (!IncandescentGuardEffect.hasIncandescentGuard(target)) {
      return baseDamage;
    }
    
    return IncandescentGuardEffect.applyDamageReduction(target, baseDamage);
  }
  
  /**
   * Déclencher la contre-attaque de la Garde Incandescente
   * @param defender - Défenseur avec Garde Incandescente
   * @param attacker - Attaquant mêlée
   * @param isMeleeAttack - true si attaque mêlée
   * @returns Données de contre-attaque si déclenchée, null sinon
   */
  static triggerIncandescentGuardCounter(
    defender: IBattleParticipant,
    attacker: IBattleParticipant,
    isMeleeAttack: boolean
  ): { burnDuration: number; burnStacks: number } | null {
    if (!IncandescentGuardEffect.triggerCounterAttack(defender, attacker, isMeleeAttack)) {
      return null;
    }
    
    return IncandescentGuardEffect.getCounterAttackData(defender);
  }
  
  /**
   * Vérifier si une cible a un bouclier actif
   * @param target - Cible à vérifier
   * @returns true si bouclier actif
   */
  static hasShield(target: IBattleParticipant): boolean {
    return ShieldEffect.hasShield(target);
  }
  
  /**
   * Obtenir les HP actuels du bouclier
   * @param target - Cible avec bouclier
   * @returns HP du bouclier (0 si pas de bouclier)
   */
  static getShieldHp(target: IBattleParticipant): number {
    return ShieldEffect.getShieldHp(target);
  }
  
  /**
   * Appliquer un bouclier sur une cible
   * Gère la logique de remplacement (le plus grand garde)
   * @param target - Cible
   * @param shieldHp - HP du bouclier
   * @param duration - Durée en tours
   * @param appliedBy - Caster
   * @returns true si bouclier appliqué/remplacé
   */
  static applyShield(
    target: IBattleParticipant,
    shieldHp: number,
    duration: number,
    appliedBy: IBattleParticipant
  ): boolean {
    const currentShieldHp = ShieldEffect.getShieldHp(target);
    
    // Si pas de bouclier ou nouveau bouclier plus grand
    if (currentShieldHp === 0 || shieldHp > currentShieldHp) {
      // Retirer l'ancien bouclier si existe
      if (currentShieldHp > 0) {
        this.removeShield(target);
      }
      
      // Le sort doit appeler EffectManager.applyEffect() puis définir metadata
      // On retourne true pour signaler que l'application doit se faire
      return true;
    } else {
      console.log(`🛡️ Bouclier existant plus grand (${currentShieldHp} > ${shieldHp}), conservé`);
      return false;
    }
  }
  
  /**
   * Retirer manuellement le bouclier d'une cible
   * @param target - Cible
   */
  static removeShield(target: IBattleParticipant): void {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return;
    
    const index = activeEffects.findIndex((effect: any) => effect.id === "shield");
    if (index > -1) {
      activeEffects.splice(index, 1);
      console.log(`🛡️ Bouclier de ${target.name} retiré manuellement`);
    }
  }
  
  /**
   * Obtenir tous les buffs actifs d'une cible
   * @param target - Cible à analyser
   * @returns Liste des IDs de buffs actifs
   */
  static getActiveBuffs(target: IBattleParticipant): string[] {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return [];
    
    const buffIds = ["shield", "incandescent_guard", "haste", "fortify", "rage", "regeneration"];
    return activeEffects
      .filter((effect: any) => buffIds.includes(effect.id))
      .map((effect: any) => effect.id);
  }
  
  /**
   * Vérifier si une cible a un buff spécifique
   * @param target - Cible à vérifier
   * @param buffId - ID du buff
   * @returns true si le buff est actif
   */
  static hasBuff(target: IBattleParticipant, buffId: string): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === buffId);
  }
  
  /**
   * Obtenir un résumé des buffs actifs pour l'UI
   * @param target - Cible à analyser
   * @returns Résumé lisible
   */
  static getBuffSummary(target: IBattleParticipant): string {
    const activeBuffs = this.getActiveBuffs(target);
    
    if (activeBuffs.length === 0) {
      return "Aucun buff actif";
    }
    
    const parts: string[] = [];
    
    // Shield
    if (activeBuffs.includes("shield")) {
      const shieldHp = this.getShieldHp(target);
      parts.push(`🛡️ Bouclier (${shieldHp} HP)`);
    }
    
    // Incandescent Guard
    if (activeBuffs.includes("incandescent_guard")) {
      const reduction = IncandescentGuardEffect.getDamageReduction(target);
      parts.push(`🔥🛡️ Garde Incandescente (-${reduction}% dégâts)`);
    }
    
    // Autres buffs (à implémenter)
    if (activeBuffs.includes("haste")) {
      parts.push("⚡ Célérité");
    }
    if (activeBuffs.includes("fortify")) {
      parts.push("🛡️ Fortifié");
    }
    if (activeBuffs.includes("rage")) {
      parts.push("😡 Rage");
    }
    if (activeBuffs.includes("regeneration")) {
      parts.push("💚 Régénération");
    }
    
    return parts.join(", ");
  }
  
  /**
   * Calculer l'impact total des buffs sur les stats d'une cible
   * Utile pour l'UI ou les estimations
   * @param target - Cible à analyser
   * @returns Objet avec les modifications de stats
   */
  static calculateBuffImpact(target: IBattleParticipant): {
    shieldHp: number;
    damageReduction: number;
    atkBonus: number;
    defBonus: number;
    speedBonus: number;
    healingPerTurn: number;
  } {
    return {
      shieldHp: this.getShieldHp(target),
      damageReduction: IncandescentGuardEffect.getDamageReduction(target),
      atkBonus: 0, // TODO: Rage, autres buffs d'attaque
      defBonus: 0, // TODO: Fortify
      speedBonus: 0, // TODO: Haste
      healingPerTurn: 0 // TODO: Regeneration
    };
  }
  
  /**
   * Vérifier si une cible est fortement buffée (3+ buffs actifs)
   * Utile pour des achievements ou mécaniques spéciales
   * @param target - Cible à vérifier
   * @returns true si 3+ buffs actifs
   */
  static isHeavilyBuffed(target: IBattleParticipant): boolean {
    return this.getActiveBuffs(target).length >= 3;
  }
  
  /**
   * Obtenir le pourcentage de bouclier restant
   * @param target - Cible
   * @param maxShieldHp - HP max du bouclier initial
   * @returns Pourcentage (0-100)
   */
  static getShieldPercentage(target: IBattleParticipant, maxShieldHp: number): number {
    return ShieldEffect.getShieldPercentage(target, maxShieldHp);
  }
  
  /**
   * Appliquer les effets de tous les buffs sur le calcul des stats
   * À utiliser dans BattleEngine pour modifier les stats temporairement
   * @param participant - Participant dont on calcule les stats
   * @returns Stats modifiées
   */
  static applyBuffModifiers(participant: IBattleParticipant): {
    atk: number;
    def: number;
    speed: number;
  } {
    const baseStats = participant.stats;
    let modifiedStats = {
      atk: baseStats.atk,
      def: baseStats.def,
      speed: (baseStats as any).vitesse || 80
    };
    
    // TODO: Appliquer les modificateurs des buffs actifs
    // Exemple : Si Rage actif → atk × 1.3
    // Exemple : Si Fortify actif → def × 1.2
    // Exemple : Si Haste actif → speed × 1.25
    
    return modifiedStats;
  }
}

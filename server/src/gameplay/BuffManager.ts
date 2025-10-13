// server/src/gameplay/BuffManager.ts
import { IBattleParticipant } from "../models/Battle";
import { ShieldEffect } from "./effects/buffs/shield";
import { IncandescentGuardEffect } from "./effects/buffs/incandescent_guard";
import { AshRampartEffect } from "./effects/buffs/ash_rampart";
import { InternalBrazierBuffEffect } from "./effects/buffs/internal_brazier_buff";

/**
 * Gestionnaire centralisé pour tous les effets secondaires des Buffs
 * Évite de polluer le BattleEngine avec des imports multiples
 */
export class BuffManager {
  
  /**
   * Appliquer l'absorption du bouclier aux dégâts
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
   */
  static applyIncandescentGuard(target: IBattleParticipant, baseDamage: number): number {
    if (!IncandescentGuardEffect.hasIncandescentGuard(target)) {
      return baseDamage;
    }
    
    return IncandescentGuardEffect.applyDamageReduction(target, baseDamage);
  }
  
  /**
   * Appliquer la réduction de dégâts du Rempart de Cendres
   */
  static applyAshRampart(target: IBattleParticipant, baseDamage: number): number {
    if (!AshRampartEffect.hasAshRampart(target)) {
      return baseDamage;
    }
    
    return AshRampartEffect.applyDamageReduction(target, baseDamage);
  }
  
  /**
   * Appliquer la réduction de dégâts du Brasier Intérieur
   */
  static applyInternalBrazier(target: IBattleParticipant, baseDamage: number): number {
    if (!InternalBrazierBuffEffect.hasInternalBrazier(target)) {
      return baseDamage;
    }
    
    return InternalBrazierBuffEffect.applyDamageReduction(target, baseDamage);
  }
  
  /**
   * Calculer et appliquer le reflect damage du Brasier Intérieur
   */
  static triggerInternalBrazierReflect(
    defender: IBattleParticipant,
    attacker: IBattleParticipant,
    damageTaken: number,
    isMeleeAttack: boolean
  ): number {
    const reflectDamage = InternalBrazierBuffEffect.calculateReflectDamage(
      defender,
      damageTaken,
      isMeleeAttack
    );
    
    if (reflectDamage > 0 && attacker.status.alive) {
      attacker.currentHp = Math.max(0, attacker.currentHp - reflectDamage);
      
      if (attacker.currentHp === 0) {
        attacker.status.alive = false;
        console.log(`💀 ${attacker.name} meurt des dégâts de reflect du Brasier Intérieur !`);
      }
    }
    
    return reflectDamage;
  }
  
  /**
   * Déclencher la contre-attaque de la Garde Incandescente
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
   */
  static hasShield(target: IBattleParticipant): boolean {
    return ShieldEffect.hasShield(target);
  }
  
  /**
   * Obtenir les HP actuels du bouclier
   */
  static getShieldHp(target: IBattleParticipant): number {
    return ShieldEffect.getShieldHp(target);
  }
  
  /**
   * Appliquer un bouclier sur une cible
   */
  static applyShield(
    target: IBattleParticipant,
    shieldHp: number,
    duration: number,
    appliedBy: IBattleParticipant
  ): boolean {
    const currentShieldHp = ShieldEffect.getShieldHp(target);
    
    if (currentShieldHp === 0 || shieldHp > currentShieldHp) {
      if (currentShieldHp > 0) {
        this.removeShield(target);
      }
      return true;
    } else {
      console.log(`🛡️ Bouclier existant plus grand (${currentShieldHp} > ${shieldHp}), conservé`);
      return false;
    }
  }
  
  /**
   * Retirer manuellement le bouclier d'une cible
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
   */
  static getActiveBuffs(target: IBattleParticipant): string[] {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return [];
    
    const buffIds = ["shield", "incandescent_guard", "ash_rampart", "internal_brazier_buff", "haste", "fortify", "rage", "regeneration"];
    return activeEffects
      .filter((effect: any) => buffIds.includes(effect.id))
      .map((effect: any) => effect.id);
  }
  
  /**
   * Vérifier si une cible a un buff spécifique
   */
  static hasBuff(target: IBattleParticipant, buffId: string): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === buffId);
  }
  
  /**
   * Obtenir un résumé des buffs actifs pour l'UI
   */
  static getBuffSummary(target: IBattleParticipant): string {
    const activeBuffs = this.getActiveBuffs(target);
    
    if (activeBuffs.length === 0) {
      return "Aucun buff actif";
    }
    
    const parts: string[] = [];
    
    if (activeBuffs.includes("shield")) {
      const shieldHp = this.getShieldHp(target);
      parts.push(`🛡️ Bouclier (${shieldHp} HP)`);
    }
    
    if (activeBuffs.includes("incandescent_guard")) {
      const reduction = IncandescentGuardEffect.getDamageReduction(target);
      parts.push(`🔥🛡️ Garde Incandescente (-${reduction}% dégâts)`);
    }
    
    if (activeBuffs.includes("ash_rampart")) {
      const reduction = AshRampartEffect.getDamageReduction(target);
      parts.push(`🔥🛡️ Rempart de Cendres (-${reduction}% dégâts)`);
    }
    
    if (activeBuffs.includes("internal_brazier_buff")) {
      const reduction = InternalBrazierBuffEffect.getDamageReduction(target);
      const reflectData = InternalBrazierBuffEffect.getReflectData(target);
      const reflectPercent = reflectData?.reflectPercent || 10;
      parts.push(`🔥💪 Brasier Intérieur (-${reduction}% dégâts, ${reflectPercent}% reflect)`);
    }
    
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
   */
  static calculateBuffImpact(target: IBattleParticipant): {
    shieldHp: number;
    damageReduction: number;
    atkBonus: number;
    defBonus: number;
    speedBonus: number;
    healingPerTurn: number;
  } {
    const incandescentReduction = IncandescentGuardEffect.getDamageReduction(target);
    const ashRampartReduction = AshRampartEffect.getDamageReduction(target);
    const brazierReduction = InternalBrazierBuffEffect.getDamageReduction(target);
    const totalReduction = Math.max(incandescentReduction, ashRampartReduction, brazierReduction);
    
    return {
      shieldHp: this.getShieldHp(target),
      damageReduction: totalReduction,
      atkBonus: 0,
      defBonus: 0,
      speedBonus: 0,
      healingPerTurn: 0
    };
  }
  
  /**
   * Vérifier si une cible est fortement buffée
   */
  static isHeavilyBuffed(target: IBattleParticipant): boolean {
    return this.getActiveBuffs(target).length >= 3;
  }
  
  /**
   * Obtenir le pourcentage de bouclier restant
   */
  static getShieldPercentage(target: IBattleParticipant, maxShieldHp: number): number {
    return ShieldEffect.getShieldPercentage(target, maxShieldHp);
  }
  
  /**
   * Appliquer les effets de tous les buffs sur le calcul des stats
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
    
    return modifiedStats;
  }
}

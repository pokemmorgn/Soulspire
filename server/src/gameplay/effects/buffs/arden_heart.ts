// server/src/gameplay/effects/buffs/arden_heart.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Arden Heart (Cœur Ardent)
 * - Augmente la résistance aux dégâts
 * - Renvoie un pourcentage des dégâts mêlée subis
 * - Auto-dégâts initiaux lors de l'activation
 * - Non stackable
 * - Durée : 6 tours (base)
 * - Utilisé par : ArdenHeartSpell (Rhyzann - Tank Légendaire)
 */
export class ArdenHeartEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "arden_heart",
      name: "Cœur Ardent",
      description: "Résistance accrue et reflect damage mêlée",
      type: "buff",
      category: "stat_modifier",
      stackable: false,
      maxStacks: 1,
      baseDuration: 6
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    const resistance = this.getDamageResistance(target);
    const reflectPercent = this.getReflectPercent(target);
    
    return {
      message: `🔥💥 ${target.name} active son Cœur Ardent ! (+${resistance}% résistance, ${reflectPercent}% reflect)`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const resistance = this.getDamageResistance(target);
    const reflectPercent = this.getReflectPercent(target);
    
    return {
      message: `🔥💥 Le Cœur Ardent de ${target.name} pulse (+${resistance}% résistance, ${reflectPercent}% reflect)`,
      statModifiers: {
        damageResistance: resistance,
        reflectDamage: reflectPercent
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 Le Cœur Ardent de ${target.name} s'éteint`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Principalement pour les tanks, mais pas de restriction stricte
    return target.status.alive;
  }
  
  /**
   * Obtenir le pourcentage de résistance aux dégâts
   */
  private getDamageResistance(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const heartEffect = activeEffects.find((effect: any) => effect.id === "arden_heart");
    if (!heartEffect || !heartEffect.metadata) return 0;
    
    return heartEffect.metadata.damageResistance || 19;
  }
  
  /**
   * Obtenir le pourcentage de reflect damage
   */
  private getReflectPercent(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const heartEffect = activeEffects.find((effect: any) => effect.id === "arden_heart");
    if (!heartEffect || !heartEffect.metadata) return 0;
    
    return heartEffect.metadata.reflectPercent || 26;
  }
  
  /**
   * Vérifier si une cible a le Cœur Ardent actif
   */
  static hasArdenHeart(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "arden_heart");
  }
  
  /**
   * Obtenir le pourcentage de résistance aux dégâts (méthode statique)
   */
  static getDamageResistance(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const heartEffect = activeEffects.find((effect: any) => effect.id === "arden_heart");
    if (!heartEffect || !heartEffect.metadata) return 0;
    
    return heartEffect.metadata.damageResistance || 19;
  }
  
  /**
   * Obtenir le pourcentage de reflect damage (méthode statique)
   */
  static getReflectPercent(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const heartEffect = activeEffects.find((effect: any) => effect.id === "arden_heart");
    if (!heartEffect || !heartEffect.metadata) return 0;
    
    return heartEffect.metadata.reflectPercent || 26;
  }
  
  /**
   * Appliquer la résistance aux dégâts
   * À utiliser dans BattleEngine.calculateDamage()
   */
  static applyDamageResistance(target: IBattleParticipant, baseDamage: number): number {
    if (!this.hasArdenHeart(target)) return baseDamage;
    
    const resistance = this.getDamageResistance(target);
    const reducedDamage = Math.floor(baseDamage * (1 - resistance / 100));
    
    console.log(`🔥💥 Cœur Ardent réduit les dégâts de ${target.name} de ${resistance}% (${baseDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Calculer les dégâts de reflect
   * @param target - Défenseur avec Cœur Ardent
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
    
    if (!this.hasArdenHeart(target)) return 0;
    
    const reflectPercent = this.getReflectPercent(target);
    const reflectDamage = Math.floor(damageTaken * (reflectPercent / 100));
    
    console.log(`🔥⚔️ Cœur Ardent renvoie ${reflectDamage} dégâts (${reflectPercent}% de ${damageTaken})`);
    
    return reflectDamage;
  }
  
  /**
   * Obtenir les données complètes du Cœur Ardent
   */
  static getHeartData(target: IBattleParticipant): {
    damageResistance: number;
    reflectPercent: number;
    isActive: boolean;
  } {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) {
      return { damageResistance: 0, reflectPercent: 0, isActive: false };
    }
    
    const heartEffect = activeEffects.find((effect: any) => effect.id === "arden_heart");
    if (!heartEffect || !heartEffect.metadata) {
      return { damageResistance: 0, reflectPercent: 0, isActive: false };
    }
    
    return {
      damageResistance: heartEffect.metadata.damageResistance || 19,
      reflectPercent: heartEffect.metadata.reflectPercent || 26,
      isActive: true
    };
  }
  
  /**
   * Calculer les auto-dégâts d'activation (onde ardente)
   * Utilisé par ArdenHeartSpell lors de l'activation
   */
  static calculateActivationDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Formule similaire à ArdenHeartSpell
    const basePercent = 14 + (spellLevel - 1) * 0.5; // 14-18.5%
    const selfDamage = Math.floor(caster.stats.maxHp * (basePercent / 100));
    
    console.log(`🔥💥 Onde ardente d'activation : ${selfDamage} dégâts (${basePercent}% HP max)`);
    
    return selfDamage;
  }
  
  /**
   * Vérifier si les conditions d'activation sont remplies
   */
  static canActivate(caster: IBattleParticipant): boolean {
    // Ne peut pas être activé si déjà actif
    if (this.hasArdenHeart(caster)) {
      console.log(`⚠️ ${caster.name} a déjà un Cœur Ardent actif`);
      return false;
    }
    
    // Ne peut pas être activé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      console.log(`⚠️ ${caster.name} est silencé - impossible d'activer Cœur Ardent`);
      return false;
    }
    
    // Doit avoir au moins 20% HP pour éviter le suicide
    const hpPercent = (caster.currentHp / caster.stats.maxHp) * 100;
    if (hpPercent < 20) {
      console.log(`⚠️ ${caster.name} a trop peu de HP pour activer Cœur Ardent (${hpPercent.toFixed(1)}%)`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Appliquer l'effet complet (activation + metadata)
   */
  static applyFullEffect(
    target: IBattleParticipant,
    spellLevel: number,
    duration: number
  ): {
    activationDamage: number;
    damageResistance: number;
    reflectPercent: number;
  } {
    const activationDamage = this.calculateActivationDamage(target, spellLevel);
    
    // Calculer les bonus selon le niveau
    const damageResistance = Math.min(25, 19 + (spellLevel - 1) * 0.7); // 19-25%
    const reflectPercent = Math.min(35, 26 + (spellLevel - 1) * 1); // 26-35%
    
    return {
      activationDamage,
      damageResistance,
      reflectPercent
    };
  }
}

// Export de l'instance pour EffectManager
export const ardenHeartEffect = new ArdenHeartEffect(

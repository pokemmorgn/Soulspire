// server/src/gameplay/effects/buffs/arden_aura.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Arden Aura (Aura Ardente)
 * - Source de l'aura : reste sur Pyra pendant la durée
 * - Dégâts AoE aux ennemis proches chaque tour
 * - Buff les alliés via "arden_aura_buff" séparé
 * - Non stackable
 * - Durée : 6 tours (base)
 * - Utilisé par : Pyra (Legendary Support)
 */
export class ArdenAuraEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "arden_aura",
      name: "Aura Ardente (Source)",
      description: "Source de l'aura, inflige dégâts AoE aux ennemis",
      type: "buff",
      category: "special_mechanic",
      stackable: false,
      maxStacks: 1,
      baseDuration: 6
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🔥✨ ${target.name} rayonne d'une Aura Ardente !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Cette méthode sera appelée par EffectManager
    // Les dégâts AoE seront gérés via ArdenAuraSpell.processAuraTick()
    const auraDamage = this.getAuraDamage(target);
    
    return {
      message: `🔥✨ L'Aura Ardente de ${target.name} pulse (~${auraDamage} dégâts AoE)`,
      statModifiers: {
        auraActive: 1 // Marquer que l'aura est active
      }
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `💨 L'Aura Ardente de ${target.name} s'estompe`
    };
  }
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Seul Pyra peut avoir cette aura (ou autres supports feu)
    return target.element === "Fire" && target.role === "Support";
  }
  
  /**
   * Obtenir les dégâts de l'aura (pour estimation)
   */
  private getAuraDamage(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const auraEffect = activeEffects.find((effect: any) => effect.id === "arden_aura");
    if (!auraEffect || !auraEffect.metadata) return 0;
    
    return auraEffect.metadata.auraDamage || 50;
  }
  
  /**
   * Vérifier si une cible a l'Aura Ardente active
   */
  static hasArdenAura(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "arden_aura");
  }
  
  /**
   * Obtenir les métadonnées de l'aura
   */
  static getAuraMetadata(target: IBattleParticipant): {
    attackBonus: number;
    speedBonus: number;
    auraDamage: number;
    turnsActive: number;
  } | null {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    const auraEffect = activeEffects.find((effect: any) => effect.id === "arden_aura");
    if (!auraEffect || !auraEffect.metadata) return null;
    
    return {
      attackBonus: auraEffect.metadata.attackBonus || 12,
      speedBonus: auraEffect.metadata.speedBonus || 12,
      auraDamage: auraEffect.metadata.auraDamage || 50,
      turnsActive: auraEffect.metadata.turnsActive || 0
    };
  }
  
  /**
   * Mettre à jour le compteur de tours actifs
   */
  static incrementTurnsActive(target: IBattleParticipant): void {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return;
    
    const auraEffect = activeEffects.find((effect: any) => effect.id === "arden_aura");
    if (!auraEffect || !auraEffect.metadata) return;
    
    auraEffect.metadata.turnsActive = (auraEffect.metadata.turnsActive || 0) + 1;
  }
  
  /**
   * Obtenir la portée de l'aura (pour déterminer les ennemis affectés)
   */
  static getAuraRange(): number {
    // En turn-based, "proches" = tous les ennemis vivants
    // Peut être ajusté plus tard avec un système de positions
    return 999; // Portée infinie pour le moment
  }
  
  /**
   * Calculer les dégâts de l'aura selon le niveau
   */
  static calculateAuraDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Formule similaire à ArdenAuraSpell.getAuraDamage()
    const baseDamage = Math.floor(30 + (spellLevel - 1) * 5);
    const atkBonus = Math.floor(caster.stats.atk * 0.15);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Vérifier si l'aura peut affecter une cible
   */
  static canAffectTarget(
    caster: IBattleParticipant, 
    target: IBattleParticipant, 
    isAlly: boolean
  ): boolean {
    if (!target.status.alive) return false;
    
    // Alliés : reçoivent les buffs
    if (isAlly) return true;
    
    // Ennemis : subissent les dégâts AoE
    if (!isAlly) {
      // Vérifier immunités élémentaires
      if (target.element === "Fire") {
        // Résistance partielle au feu
        return true; // Mais dégâts réduits
      }
      return true;
    }
    
    return false;
  }
}

// Export de l'instance pour EffectManager
export const ardenAuraEffect = new ArdenAuraEffect();

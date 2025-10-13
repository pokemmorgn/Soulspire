// server/src/gameplay/actives/MagmaSkinSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Peau de Magma - Grathul (Epic Tank)
 * 
 * Description originale :
 * "Grathul concentre la chaleur de son noyau, renforçant sa structure.
 * Réduit les dégâts subis de 30% pendant 5 secondes et 
 * renvoie 15% des dégâts de mêlée sous forme de feu."
 * 
 * Adaptation turn-based :
 * - Durée : 5 secondes → 5 tours
 * - Réduction dégâts : 30%
 * - Reflect damage : 15% des dégâts mêlée
 * - Recharge : 12 tours
 * - Coût : 40 énergie
 */
class MagmaSkinSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "magma_skin",
      name: "Peau de Magma",
      description: "Réduction dégâts 30% et reflect 15% dégâts mêlée",
      type: "active",
      category: "buff",
      targetType: "self",
      
      energyCost: 40,
      baseCooldown: 12,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "magma_armor",
      soundEffect: "magma_skin_cast"
    };
    
    super(config);
  }
  
  execute(
    caster: IBattleParticipant,
    targets: IBattleParticipant[],
    spellLevel: number,
    battleContext?: any
  ): IBattleAction {
    const turn = battleContext?.currentTurn || 1;
    const action = this.createBaseAction(caster, [caster], "skill", turn);
    
    // Coût en énergie
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 8; // Gain modéré pour sort défensif
    action.buffsApplied = [];
    
    const duration = this.getDuration(spellLevel);
    const damageReduction = this.getDamageReduction(spellLevel);
    const reflectPercent = this.getReflectPercent(spellLevel);
    
    // Créer un buff "magma_skin" personnalisé
    // On utilise un pseudo-effet pour tracker la durée et les bonus
    const magmaSkinEffect = {
      id: "magma_skin",
      duration: duration,
      stacks: 1,
      appliedBy: caster,
      metadata: {
        damageReduction: damageReduction,  // 30%
        reflectPercent: reflectPercent     // 15%
      }
    };
    
    // Ajouter aux effets actifs
    if (!(caster as any).activeEffects) {
      (caster as any).activeEffects = [];
    }
    (caster as any).activeEffects.push(magmaSkinEffect);
    
    // Ajouter le buff au status
    if (!caster.status.buffs.includes("magma_skin")) {
      caster.status.buffs.push("magma_skin");
      action.buffsApplied.push("magma_skin");
    }
    
    console.log(`🌋🛡️ ${caster.name} active Peau de Magma ! (-${damageReduction}% dégâts, ${reflectPercent}% reflect)`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Durée de l'effet
   * 5 secondes → 5 tours
   */
  private getDuration(spellLevel: number): number {
    // Base 5 tours, +1 tous les 4 niveaux (max 7 tours)
    return Math.min(7, 5 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Pourcentage de réduction de dégâts
   */
  private getDamageReduction(spellLevel: number): number {
    // 30% base, +2% par niveau (max 48% au niveau 10)
    return Math.min(50, 30 + (spellLevel - 1) * 2);
  }
  
  /**
   * Pourcentage de reflect damage
   */
  private getReflectPercent(spellLevel: number): number {
    // 15% base, +1% par niveau (max 24% au niveau 10)
    return Math.min(25, 15 + (spellLevel - 1));
  }
  
  /**
   * Vérifier si une cible a Peau de Magma active
   * Méthode statique pour utilisation dans BuffManager/BattleEngine
   */
  static hasMagmaSkin(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "magma_skin");
  }
  
  /**
   * Obtenir le pourcentage de réduction de dégâts
   */
  static getDamageReduction(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const magmaEffect = activeEffects.find((effect: any) => effect.id === "magma_skin");
    if (!magmaEffect || !magmaEffect.metadata) return 0;
    
    return magmaEffect.metadata.damageReduction || 0;
  }
  
  /**
   * Appliquer la réduction de dégâts
   */
  static applyDamageReduction(target: IBattleParticipant, baseDamage: number): number {
    if (!this.hasMagmaSkin(target)) return baseDamage;
    
    const reduction = this.getDamageReduction(target);
    const reducedDamage = Math.floor(baseDamage * (1 - reduction / 100));
    
    console.log(`🌋🛡️ Peau de Magma réduit les dégâts de ${target.name} de ${reduction}% (${baseDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Obtenir les données de reflect damage
   */
  static getReflectData(target: IBattleParticipant): { reflectPercent: number } | null {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    const magmaEffect = activeEffects.find((effect: any) => effect.id === "magma_skin");
    if (!magmaEffect || !magmaEffect.metadata) return null;
    
    return {
      reflectPercent: magmaEffect.metadata.reflectPercent || 0
    };
  }
  
  /**
   * Calculer les dégâts de reflect
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
    
    console.log(`🌋🔥 Peau de Magma renvoie ${reflectDamage} dégâts (${reflectData.reflectPercent}% de ${damageTaken})`);
    
    return reflectDamage;
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    // Ne peut pas être lancé si déjà actif (éviter stack)
    if (MagmaSkinSpell.hasMagmaSkin(caster)) {
      console.log(`⚠️ ${caster.name} a déjà Peau de Magma active`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const magmaSkinSpell = new MagmaSkinSpell();
export { MagmaSkinSpell };

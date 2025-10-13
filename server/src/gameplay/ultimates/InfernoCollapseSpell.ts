// server/src/gameplay/ultimates/InfernoCollapseSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Inferno Collapse (Effondrement Infernal) - Ignara (Rare DPS Ranged)
 * 
 * Description originale :
 * "Ignara concentre toutes les flammes du champ de bataille et provoque une explosion massive.
 * Inflige des dégâts de feu élevés à tous les ennemis.
 * Les ennemis affectés par Brûlure subissent immédiatement les dégâts restants de leur Brûlure 
 * et voient celle-ci renouvelée pendant 2 tours."
 * 
 * Adaptation turn-based :
 * - AoE, dégâts élevés
 * - Si cible brûlée : dégâts de Brûlure instantanés + renouvelle Brûlure (2 tours)
 * - Recharge : 5 tours
 * - Coût : 100 énergie
 */
class InfernoCollapseSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "inferno_collapse",
      name: "Effondrement Infernal",
      description: "Explosion massive, déclenche et renouvelle Brûlure",
      type: "ultimate",
      category: "damage",
      targetType: "all_enemies",
      
      energyCost: 100,
      baseCooldown: 5,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["DPS Ranged", "Mage"],
      
      animationType: "inferno_explosion",
      soundEffect: "inferno_collapse_cast"
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
    const action = this.createBaseAction(caster, targets, "ultimate", turn);
    
    // Dégâts de base de l'explosion
    const baseDamage = this.getBaseDamage(spellLevel);
    
    action.damage = 0;
    action.energyCost = 100;
    action.energyGain = 0; // Ultimate ne génère pas d'énergie
    action.debuffsApplied = [];
    action.critical = true; // Ultimates sont visuellement toujours "critiques"
    
    // Stocker dégâts par cible pour l'UI
    (action as any).perTargetDamage = {};
    (action as any).burnTriggered = []; // Liste des cibles dont la brûlure a été déclenchée
    
    for (const target of targets) {
      if (!target.status.alive) continue;
      
      // Calculer dégâts de base de l'explosion
      let totalDamage = this.calculateDamage(caster, target, baseDamage, spellLevel, "magical");
      
      // Vérifier si la cible est brûlée
      const burnEffect = this.getBurnEffect(target);
      
      if (burnEffect) {
        // 1. Calculer les dégâts de Brûlure restants
        const remainingBurnDamage = this.calculateRemainingBurnDamage(
          target, 
          caster, 
          burnEffect.stacks, 
          burnEffect.duration
        );
        
        console.log(`🔥💥 ${target.name} subit ${remainingBurnDamage} dégâts de Brûlure instantanés !`);
        
        // Ajouter aux dégâts totaux
        totalDamage += remainingBurnDamage;
        
        // 2. Retirer l'ancienne Brûlure
        EffectManager.removeEffect(target, "burn");
        
        // 3. Réappliquer Brûlure pour 2 tours
        const newBurnDuration = this.getNewBurnDuration(spellLevel);
        EffectManager.applyEffect("burn", target, caster, newBurnDuration, burnEffect.stacks);
        
        console.log(`🔥🔄 Brûlure de ${target.name} renouvelée (${burnEffect.stacks} stacks, ${newBurnDuration} tours)`);
        
        (action as any).burnTriggered.push(target.heroId);
      }
      
      // Stocker dégâts finaux
      (action as any).perTargetDamage[target.heroId] = totalDamage;
      action.damage += totalDamage;
      
      // Marquer qu'on a appliqué/renouvelé Brûlure
      if (!action.debuffsApplied.includes("burn")) {
        action.debuffsApplied.push("burn");
      }
    }
    
    console.log(`🔥💥 Inferno Collapse inflige ${action.damage} dégâts totaux !`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Dégâts de base de l'explosion
   * Ultimate AoE = dégâts élevés
   */
  private getBaseDamage(spellLevel: number): number {
    // Dégâts élevés AoE : niveau 1: 200 → niveau 10: 450
    return Math.floor(200 + (spellLevel - 1) * 28);
  }
  
  /**
   * Durée de la Brûlure renouvelée
   */
  private getNewBurnDuration(spellLevel: number): number {
    // Base 2 tours, +1 tous les 5 niveaux
    return Math.min(4, 2 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Obtenir l'effet Brûlure actif sur une cible
   */
  private getBurnEffect(target: IBattleParticipant): { stacks: number; duration: number } | null {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    const burnEffect = activeEffects.find((effect: any) => effect.id === "burn");
    if (!burnEffect) return null;
    
    return {
      stacks: burnEffect.stacks,
      duration: burnEffect.duration
    };
  }
  
  /**
   * Calculer les dégâts de Brûlure restants
   * Approximation : dégâts par tour × tours restants
   */
  private calculateRemainingBurnDamage(
    target: IBattleParticipant,
    caster: IBattleParticipant,
    stacks: number,
    duration: number
  ): number {
    // Formule similaire à burn.ts
    const baseHpDamage = Math.floor(target.stats.maxHp * 0.04);
    const casterBonus = Math.floor(((caster.stats as any).intelligence || 70) * 0.1);
    const baseDamage = baseHpDamage + casterBonus;
    
    // Multiplicateur par stack (1x, 1.5x, 2x, 2.5x, 3x)
    const stackMultiplier = 1 + (stacks - 1) * 0.5;
    
    let damagePerTick = Math.floor(baseDamage * stackMultiplier);
    
    // Résistance élémentaire
    if (target.element === "Fire") {
      damagePerTick = Math.floor(damagePerTick * 0.5);
    } else if (target.element === "Water") {
      damagePerTick = Math.floor(damagePerTick * 1.3);
    }
    
    // Total = dégâts par tick × tours restants
    const totalRemainingDamage = damagePerTick * duration;
    
    return Math.max(1, totalRemainingDamage);
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    // Vérifier énergie
    if (caster.energy < 100) {
      console.log(`⚠️ ${caster.name} n'a pas assez d'énergie pour Inferno Collapse (${caster.energy}/100)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const infernoCollapseSpell = new InfernoCollapseSpell();
export { InfernoCollapseSpell };

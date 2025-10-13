// server/src/gameplay/actives/FirelashSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Firelash (Fouet de Flammes) - Ignara (Rare DPS Ranged)
 * 
 * Description originale :
 * "Ignara invoque un fouet de flammes et frappe un ennemi, 
 * infligeant de lourds dégâts de feu à une seule cible.
 * Si la cible est sous l'effet de Brûlure, l'attaque prolonge 
 * la durée de Brûlure de 1 tour."
 * 
 * Adaptation turn-based :
 * - Single target, gros dégâts magiques
 * - Si cible brûlée : +1 tour à la durée de Brûlure
 * - Recharge : 6 tours
 * - Coût : 40 énergie
 */
class FirelashSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "firelash",
      name: "Fouet de Flammes",
      description: "Lourds dégâts mono-cible, prolonge Brûlure si présente",
      type: "active",
      category: "damage",
      targetType: "single_enemy",
      
      energyCost: 40,
      baseCooldown: 6,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["DPS Ranged", "Mage"],
      
      animationType: "fire_whip",
      soundEffect: "firelash_cast"
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
    const target = targets[0];
    
    if (!target || !target.status.alive) {
      throw new Error("Firelash requires a valid living target");
    }
    
    // Créer l'action de base
    const action = this.createBaseAction(caster, [target], "skill", turn);
    
    // Calculer les dégâts (lourds = high damage)
    const baseDamage = this.getBaseDamage(spellLevel);
    const finalDamage = this.calculateDamage(caster, target, baseDamage, spellLevel, "magical");
    
    // Vérifier le critique
    const critChance = this.getCriticalChance(caster, spellLevel);
    const isCritical = Math.random() < critChance;
    
    // Appliquer le critique si applicable
    const actualDamage = isCritical ? Math.floor(finalDamage * 1.8) : finalDamage;
    
    // Remplir l'action
    action.damage = actualDamage;
    action.critical = isCritical;
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 10; // Bon gain pour single target puissant
    action.elementalAdvantage = this.getElementalAdvantage(caster.element, target.element);
    action.debuffsApplied = [];
    
    // Vérifier si la cible est déjà brûlée
    const hasBurn = this.targetHasBurn(target);
    
    if (hasBurn) {
      // Prolonger la durée de Brûlure de 1 tour
      this.extendBurnDuration(target);
      console.log(`🔥🞂 Firelash prolonge la Brûlure de ${target.name} de 1 tour !`);
    }
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Dégâts de base du fouet
   * "Lourds dégâts" = high single target damage
   */
  private getBaseDamage(spellLevel: number): number {
    // Dégâts élevés single target : niveau 1: 180 → niveau 10: 400
    return Math.floor(180 + (spellLevel - 1) * 24);
  }
  
  /**
   * Chance de critique pour Firelash
   */
  private getCriticalChance(caster: IBattleParticipant, spellLevel: number): number {
    const casterStats = caster.stats as any;
    const baseChance = 0.18; // 18% de base (sort puissant)
    const vitesseBonus = (casterStats.vitesse || 80) / 1000;
    const levelBonus = (spellLevel - 1) * 0.02; // +2% par niveau
    const intelligenceBonus = (casterStats.intelligence || 70) / 2000;
    
    return Math.min(0.65, baseChance + vitesseBonus + levelBonus + intelligenceBonus);
  }
  
  /**
   * Vérifier si la cible a l'effet Brûlure
   */
  private targetHasBurn(target: IBattleParticipant): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "burn");
  }
  
  /**
   * Prolonger la durée de Brûlure de 1 tour
   */
  private extendBurnDuration(target: IBattleParticipant): void {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return;
    
    const burnEffect = activeEffects.find((effect: any) => effect.id === "burn");
    if (burnEffect) {
      burnEffect.duration += 1;
      console.log(`🔥⏱️ Brûlure de ${target.name} prolongée : ${burnEffect.duration} tours restants`);
    }
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    return true;
  }
}

// Exports
export const firelashSpell = new FirelashSpell();
export { FirelashSpell };

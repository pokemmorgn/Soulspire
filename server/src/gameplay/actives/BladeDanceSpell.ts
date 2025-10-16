// server/src/gameplay/actives/BladeDanceSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Danse des Lames - Saryel (Légendaire DPS Melee)
 * 
 * Description originale :
 * "Saryel effectue une série de 3 frappes rapides infligeant chacune 60% 
 * de son attaque en dégâts de feu. La dernière frappe repousse légèrement 
 * l'ennemi et applique une brûlure pendant 3 secondes."
 * 
 * Adaptation turn-based :
 * - 3 frappes successives : 60% ATK chacune
 * - Dernière frappe : repousse + brûlure 3 tours
 * - Combo rapide avec accumulation de dégâts
 * - Recharge : 8 tours
 * - Coût : 35 énergie
 */
class BladeDanceSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "blade_dance",
      name: "Danse des Lames",
      description: "3 frappes rapides + repousse + brûlure finale",
      type: "active",
      category: "damage",
      targetType: "single_enemy",
      
      energyCost: 35,
      baseCooldown: 8,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["DPS Melee"],
      
      animationType: "blade_dance_combo",
      soundEffect: "blade_dance_cast"
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
    const target = this.selectTargets(caster, battleContext?.allPlayers || [], battleContext?.allEnemies || [])[0];
    const action = this.createBaseAction(caster, [target], "skill", turn);
    
    // Coût en énergie
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 15; // Bonne récupération pour combo rapide
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.damage = 0;
    action.healing = 0;
    
    if (!target.status.alive) {
      console.log(`⚔️ ${caster.name} tente une Danse des Lames sur une cible morte`);
      return action;
    }
    
    // Calculer les dégâts de base (60% ATK par frappe)
    const strikePercent = this.getStrikePercent(spellLevel);
    const baseStrikeDamage = Math.floor(caster.stats.atk * (strikePercent / 100));
    
    let totalDamage = 0;
    let finalStrikeBonus = 0;
    
    console.log(`⚔️🔥 ${caster.name} commence la Danse des Lames sur ${target.name} !`);
    
    // Frappe 1
    const strike1Damage = this.calculateDamage(caster, target, baseStrikeDamage, spellLevel, "physical");
    target.currentHp = Math.max(0, target.currentHp - strike1Damage);
    totalDamage += strike1Damage;
    
    console.log(`⚔️1️⃣ Première lame : ${strike1Damage} dégâts`);
    
    if (target.currentHp === 0) {
      target.status.alive = false;
      action.damage = totalDamage;
      console.log(`💀 ${target.name} tombe dès la première lame !`);
      return action;
    }
    
    // Frappe 2
    const strike2Damage = this.calculateDamage(caster, target, baseStrikeDamage, spellLevel, "physical");
    target.currentHp = Math.max(0, target.currentHp - strike2Damage);
    totalDamage += strike2Damage;
    
    console.log(`⚔️2️⃣ Deuxième lame : ${strike2Damage} dégâts`);
    
    if (target.currentHp === 0) {
      target.status.alive = false;
      action.damage = totalDamage;
      console.log(`💀 ${target.name} succombe à la deuxième lame !`);
      return action;
    }
    
    // Frappe 3 finale (avec bonus)
    finalStrikeBonus = this.getFinalStrikeBonus(spellLevel);
    const finalStrikeDamage = Math.floor(baseStrikeDamage * (1 + finalStrikeBonus / 100));
    const strike3Damage = this.calculateDamage(caster, target, finalStrikeDamage, spellLevel, "physical");
    
    target.currentHp = Math.max(0, target.currentHp - strike3Damage);
    totalDamage += strike3Damage;
    
    console.log(`⚔️3️⃣ Lame finale (+${finalStrikeBonus}% bonus) : ${strike3Damage} dégâts`);
    
    // Repousse (effet cosmétique en turn-based)
    console.log(`💨 ${target.name} est repoussé par la lame finale !`);
    
    // Appliquer brûlure si la cible survit
    if (target.currentHp > 0) {
      const burnDuration = this.getBurnDuration(spellLevel);
      const burnResult = EffectManager.applyEffect(
        "burn",
        target,
        caster,
        burnDuration,
        1 // 1 stack de brûlure
      );
      
      if (burnResult && burnResult.message) {
        console.log(`🔥 ${target.name} prend feu pendant ${burnDuration} tours !`);
        action.debuffsApplied.push("burn");
      }
    } else {
      target.status.alive = false;
      console.log(`💀 ${target.name} est achevé par la lame finale enflammée !`);
    }
    
    action.damage = totalDamage;
    
    // Vérifier si critique (chance sur l'ensemble du combo)
    const isCritical = this.rollCritical(caster);
    if (isCritical) {
      action.critical = true;
      console.log(`✨ COMBO CRITIQUE ! Danse des Lames perfecte !`);
    }
    
    console.log(`⚔️🔥 Danse des Lames terminée ! Dégâts totaux : ${totalDamage} (3 frappes)`);
    
    return action;
  }
  
  // ----- Méthodes utilitaires -----
  
  /**
   * Vérifier si Saryel peut enchaîner les frappes
   */
  static canPerformFullCombo(saryel: IBattleParticipant): boolean {
    // Vérifier état : vivante, pas étourdie, pas gelée
    if (!saryel.status.alive) return false;
    if (saryel.status.debuffs.includes("stunned")) return false;
    if (saryel.status.debuffs.includes("frozen")) return false;
    
    return true;
  }
  
  /**
   * Calculer les dégâts optimaux du combo
   */
  static calculateComboDamage(
    saryel: IBattleParticipant,
    target: IBattleParticipant,
    spellLevel: number
  ): number {
    const strikePercent = 60 + (spellLevel - 1) * 2; // 60-78%
    const finalBonus = 10 + (spellLevel - 1) * 2; // 10-28%
    
    const baseStrikeDamage = Math.floor(saryel.stats.atk * (strikePercent / 100));
    const finalStrikeDamage = Math.floor(baseStrikeDamage * (1 + finalBonus / 100));
    
    // Approximation (sans défense pour estimation)
    return (baseStrikeDamage * 2) + finalStrikeDamage;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Pourcentage d'ATK par frappe
   */
  private getStrikePercent(spellLevel: number): number {
    // 60% base, +2% par niveau (max 78% au niveau 10)
    return Math.min(80, 60 + (spellLevel - 1) * 2);
  }
  
  /**
   * Bonus de la frappe finale
   */
  private getFinalStrikeBonus(spellLevel: number): number {
    // 10% bonus base, +2% par niveau (max 28% au niveau 10)
    return Math.min(30, 10 + (spellLevel - 1) * 2);
  }
  
  /**
   * Durée de la brûlure finale
   * 3 secondes → 3 tours
   */
  private getBurnDuration(spellLevel: number): number {
    // Base 3 tours, +1 tous les 4 niveaux
    return Math.min(5, 3 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Chance de critique pour le combo
   */
  private rollCritical(caster: IBattleParticipant): boolean {
    // Chance de critique légèrement augmentée pour les combos
    const baseChance = 0.12; // 12% au lieu de 8%
    const vitesseBonus = ((caster.stats as any).vitesse || 80) / 1000;
    
    // Utiliser la méthode héritée pour éviter le conflit
    const rarityBonus = this.getElementalAdvantage("Fire", "Wind") * 0.02;
    
    const totalChance = Math.min(0.4, baseChance + vitesseBonus + rarityBonus);
    return Math.random() < totalChance;
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    // Vérifier si peut effectuer le combo complet
    if (!BladeDanceSpell.canPerformFullCombo(caster)) {
      console.log(`⚠️ ${caster.name} ne peut pas effectuer la Danse des Lames (contrôlée)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const bladeDanceSpell = new BladeDanceSpell();
export { BladeDanceSpell };

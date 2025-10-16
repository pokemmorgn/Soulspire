// server/src/gameplay/passives/TelluricFuryPassive.ts
import { BasePassive, IPassiveConfig, IPassiveTriggerContext, IPassiveResult } from "../base/BasePassive";
import { IBattleParticipant } from "../../models/Battle";

/**
 * Fureur Tellurique - Rhyzann (Légendaire Tank)
 * 
 * Description originale :
 * "Chaque fois que Rhyzann subit un coup critique ou perd 5% de ses PV max, 
 * il gagne 1 charge de Magma (jusqu'à 6). Chaque charge augmente ses dégâts 
 * de feu de 4% et sa réduction de dégâts de 3%. À 6 charges, il libère un 
 * rugissement volcanique, infligeant de lourds dégâts de feu en zone et 
 * étourdissant tous les ennemis proches pendant 1 seconde. L'explosion 
 * consomme toutes les charges, et Rhyzann devient immunisé aux contrôles 
 * pendant 2 secondes."
 * 
 * Adaptation turn-based :
 * - Trigger : Coup critique reçu OU perte 5% PV max
 * - Effet : +1 charge Magma (max 6)
 * - Bonus par charge : +4-7% dégâts feu, +3-5% réduction dégâts
 * - À 6 charges : Explosion AoE + stun + immunité contrôles 2 tours
 * - Cooldown : 0 (accumulation continue)
 */
export class TelluricFuryPassive extends BasePassive {
  constructor() {
    const config: IPassiveConfig = {
      id: "telluric_fury",
      name: "Fureur Tellurique",
      description: "Accumulation de charges Magma → explosion volcanique",
      triggerType: "on_damaged",
      internalCooldown: 0, // Pas de cooldown, accumulation continue
      
      triggerConditions: {
        minDamageTaken: 1, // N'importe quel dégât peut déclencher
        canTriggerOnSelf: true
      },
      
      element: "Fire",
      requiresRole: ["Tank"],
      maxLevel: 10
    };
    
    super(config);
  }
  
  protected onTrigger(context: IPassiveTriggerContext, passiveLevel: number): IPassiveResult {
    const rhyzann = context.actor;
    const damageTaken = context.damageTaken || 0;
    const wasCritical = context.wasCritical || false;
    
    // Vérifier les conditions de déclenchement
    const shouldTrigger = this.checkTriggerConditions(rhyzann, damageTaken, wasCritical, passiveLevel);
    
    if (!shouldTrigger) {
      return { triggered: false };
    }
    
    // Obtenir les charges actuelles
    const currentCharges = this.getCurrentCharges(rhyzann);
    const maxCharges = this.getMaxCharges(passiveLevel);
    
    if (currentCharges >= maxCharges) {
      // À 6 charges : déclencher l'explosion
      return this.triggerVolcanicExplosion(rhyzann, context, passiveLevel);
    } else {
      // Ajouter une charge
      return this.addMagmaCharge(rhyzann, passiveLevel);
    }
  }
  
  /**
   * Vérifier les conditions de déclenchement
   */
  private checkTriggerConditions(
    rhyzann: IBattleParticipant,
    damageTaken: number,
    wasCritical: boolean,
    passiveLevel: number
  ): boolean {
    // Condition 1: Coup critique reçu
    if (wasCritical) {
      console.log(`🌋⚡ ${rhyzann.name} subit un coup critique ! Fureur Tellurique activée`);
      return true;
    }
    
    // Condition 2: Perte de 5% PV max ou plus
    const hpThreshold = this.getHpThreshold(passiveLevel);
    const thresholdDamage = Math.floor(rhyzann.stats.maxHp * (hpThreshold / 100));
    
    if (damageTaken >= thresholdDamage) {
      console.log(`🌋💥 ${rhyzann.name} perd ${damageTaken} HP (≥${hpThreshold}% seuil) ! Fureur Tellurique activée`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Ajouter une charge de Magma
   */
  private addMagmaCharge(rhyzann: IBattleParticipant, passiveLevel: number): IPassiveResult {
    // Initialiser ou récupérer les charges
    if (!(rhyzann as any).telluricCharges) {
      (rhyzann as any).telluricCharges = 0;
    }
    
    (rhyzann as any).telluricCharges += 1;
    const newCharges = (rhyzann as any).telluricCharges;
    const maxCharges = this.getMaxCharges(passiveLevel);
    
    const fireBonus = this.getFireDamageBonus(passiveLevel);
    const defenseBonus = this.getDamageReduction(passiveLevel);
    
    console.log(`🌋🔥 ${rhyzann.name} gagne 1 charge Magma ! (${newCharges}/${maxCharges})`);
    console.log(`🌋⚡ Bonus actuels: +${fireBonus * newCharges}% dégâts feu, +${defenseBonus * newCharges}% réduction dégâts`);
    
    if (newCharges >= maxCharges) {
      console.log(`🌋💥 ATTENTION ! ${rhyzann.name} atteint ${maxCharges} charges ! Explosion imminente !`);
    }
    
    return {
      triggered: true,
      message: `🌋 ${rhyzann.name} accumule la fureur tellurique ! (${newCharges}/${maxCharges} charges)`,
      statModifiers: {
        fireDamageBonus: fireBonus * newCharges,
        damageReduction: defenseBonus * newCharges
      }
    };
  }
  
  /**
   * Déclencher l'explosion volcanique à 6 charges
   */
  private triggerVolcanicExplosion(
    rhyzann: IBattleParticipant,
    context: IPassiveTriggerContext,
    passiveLevel: number
  ): IPassiveResult {
    const allEnemies = context.allEnemies || [];
    const aliveEnemies = allEnemies.filter(e => e.status.alive);
    
    // Consommer toutes les charges
    (rhyzann as any).telluricCharges = 0;
    
    const explosionDamage = this.getExplosionDamage(rhyzann, passiveLevel);
    const stunDuration = this.getStunDuration(passiveLevel);
    const immunityDuration = this.getImmunityDuration(passiveLevel);
    
    console.log(`🌋💥💥 RUGISSEMENT VOLCANIQUE ! ${rhyzann.name} explose avec ${explosionDamage} dégâts AoE !`);
    
    // Appliquer dégâts et stun aux ennemis
    const effects = [];
    for (const enemy of aliveEnemies) {
      // Calculer dégâts avec défense
      const defense = enemy.stats.def;
      let finalDamage = Math.max(1, explosionDamage - Math.floor(defense / 2));
      
      // Avantage élémentaire
      if (enemy.element === "Wind") {
        finalDamage = Math.floor(finalDamage * 1.3);
      }
      
      // Appliquer dégâts
      enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
      console.log(`🌋🔥 ${enemy.name} subit ${finalDamage} dégâts de l'explosion volcanique`);
      
      // Ajouter stun si vivant
      if (enemy.status.alive) {
        effects.push({
          effectId: "stunned",
          targetId: enemy.heroId,
          duration: stunDuration,
          stacks: 1
        });
        console.log(`🌋😵 ${enemy.name} est étourdi pendant ${stunDuration} tours`);
      } else {
        console.log(`💀 ${enemy.name} est anéanti par l'explosion volcanique !`);
      }
    }
    
    // Immunité contrôles pour Rhyzann
    if (!rhyzann.status.buffs.includes("cc_immunity")) {
      rhyzann.status.buffs.push("cc_immunity");
    }
    
    // Programmer la fin de l'immunité (géré par un effet temporaire)
    effects.push({
      effectId: "cc_immunity",
      targetId: rhyzann.heroId,
      duration: immunityDuration,
      stacks: 1
    });
    
    return {
      triggered: true,
      message: `🌋💥 RUGISSEMENT VOLCANIQUE ! ${rhyzann.name} explose, étourdit ${aliveEnemies.length} ennemis et devient immunisé !`,
      damage: explosionDamage,
      effects: effects,
      statModifiers: {
        fireDamageBonus: 0, // Reset après explosion
        damageReduction: 0  // Reset après explosion
      }
    };
  }
  
  /**
   * Obtenir les charges actuelles
   */
  private getCurrentCharges(participant: IBattleParticipant): number {
    return (participant as any).telluricCharges || 0;
  }
  
  /**
   * Obtenir les bonus actuels de dégâts de feu
   */
  static getCurrentFireDamageBonus(participant: IBattleParticipant, passiveLevel: number): number {
    const charges = (participant as any).telluricCharges || 0;
    const bonusPerCharge = 4 + (passiveLevel - 1) * 0.5; // 4-8.5%
    return charges * bonusPerCharge;
  }
  
  /**
   * Obtenir les bonus actuels de réduction de dégâts
   */
  static getCurrentDamageReduction(participant: IBattleParticipant, passiveLevel: number): number {
    const charges = (participant as any).telluricCharges || 0;
    const bonusPerCharge = 3 + (passiveLevel - 1) * 0.25; // 3-5.25%
    return charges * bonusPerCharge;
  }
  
  // ----- Détails de calcul -----
  
  private getHpThreshold(passiveLevel: number): number {
    // 5% base, -0.2% par niveau (plus facile à déclencher)
    return Math.max(3, 5 - (passiveLevel - 1) * 0.2);
  }
  
  private getMaxCharges(passiveLevel: number): number {
    // Base 6 charges, +1 tous les 5 niveaux
    return Math.min(8, 6 + Math.floor((passiveLevel - 1) / 5));
  }
  
  private getFireDamageBonus(passiveLevel: number): number {
    // 4% base, +0.5% par niveau
    return Math.min(8, 4 + (passiveLevel - 1) * 0.5);
  }
  
  private getDamageReduction(passiveLevel: number): number {
    // 3% base, +0.25% par niveau
    return Math.min(5, 3 + (passiveLevel - 1) * 0.25);
  }
  
  private getExplosionDamage(caster: IBattleParticipant, passiveLevel: number): number {
    // Dégâts lourds : niveau 1: 250 → niveau 10: 450
    const baseDamage = Math.floor(250 + (passiveLevel - 1) * 22);
    const atkBonus = Math.floor(caster.stats.atk * 0.8);
    return baseDamage + atkBonus;
  }
  
  private getStunDuration(passiveLevel: number): number {
    // 1 seconde → 1 tour, +1 tous les 5 niveaux
    return Math.min(3, 1 + Math.floor((passiveLevel - 1) / 5));
  }
  
  private getImmunityDuration(passiveLevel: number): number {
    // 2 secondes → 2 tours, +1 tous les 5 niveaux
    return Math.min(4, 2 + Math.floor((passiveLevel - 1) / 5));
  }
}

// Export
export const telluricFuryPassive = new TelluricFuryPassive();

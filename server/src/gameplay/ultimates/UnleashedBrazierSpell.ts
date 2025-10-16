// server/src/gameplay/ultimates/UnleashedBrazierSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Brasier Déchaîné - Saryel (Légendaire DPS Melee)
 * 
 * Description originale :
 * "Saryel libère toute sa puissance, entourée d'un tourbillon de flammes pendant 6 secondes.
 * - Ses attaques de base infligent des dégâts de zone.
 * - Elle gagne +20% de vitesse d'attaque et +15% de vol de vie.
 * - À la fin de la durée, elle libère une explosion finale infligeant des dégâts 
 *   massifs de feu à tous les ennemis."
 * 
 * Adaptation turn-based :
 * - Durée : 6 secondes → 6 tours
 * - Buff : +20% vitesse attaque, +15% vol de vie, attaques AoE
 * - Explosion finale : Dégâts massifs AoE après expiration
 * - Recharge : 25 tours
 * - Coût : 100 énergie
 */
class UnleashedBrazierSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "unleashed_brazier",
      name: "Brasier Déchaîné",
      description: "Transformation temporaire : attaques AoE + buffs + explosion finale",
      type: "ultimate",
      category: "buff",
      targetType: "self",
      
      energyCost: 100,
      baseCooldown: 25,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["DPS Melee"],
      
      animationType: "fire_tornado_transformation",
      soundEffect: "unleashed_brazier_cast"
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
    const action = this.createBaseAction(caster, [caster], "ultimate", turn);
    
    // Coût en énergie
    action.energyCost = 100;
    action.energyGain = 0; // Ultimate ne génère pas d'énergie
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.healing = 0;
    action.damage = 0;
    
    // Appliquer l'effet Brasier Déchaîné
    const duration = this.getEffectDuration(spellLevel);
    const blazeResult = EffectManager.applyEffect(
      "unleashed_brazier",
      caster,
      caster,
      duration
    );
    
    if (blazeResult && blazeResult.message) {
      console.log(`🔥⚔️ ${blazeResult.message}`);
      action.buffsApplied.push("unleashed_brazier");
    }
    
    // Configurer les métadonnées de l'effet
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    if (activeEffect) {
      activeEffect.metadata = {
        attackSpeedBonus: this.getAttackSpeedBonus(spellLevel),
        lifeStealBonus: this.getLifeStealBonus(spellLevel),
        aoeAttacks: true,
        explosionDamage: this.getExplosionDamage(caster, spellLevel),
        isUnleashedBrazier: true
      };
    }
    
    // Ajouter les buffs au status pour compatibilité
    if (!caster.status.buffs.includes("unleashed_brazier")) {
      caster.status.buffs.push("unleashed_brazier");
    }
    
    console.log(`🔥⚔️ ${caster.name} déclenche Brasier Déchaîné ! Transformation pendant ${duration} tours`);
    console.log(`🔥⚡ Bonus: +${this.getAttackSpeedBonus(spellLevel)}% vitesse attaque, +${this.getLifeStealBonus(spellLevel)}% vol de vie, attaques AoE`);
    
    return action;
  }
  
  // ----- Méthodes statiques pour intégration BattleEngine -----
  
  /**
   * Vérifier si un participant est sous l'effet Brasier Déchaîné
   */
  static isUnleashed(participant: IBattleParticipant): boolean {
    if (!participant.status.alive) return false;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Obtenir les bonus de vitesse d'attaque
   */
  static getAttackSpeedBonus(participant: IBattleParticipant): number {
    if (!this.isUnleashed(participant)) return 0;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    return activeEffect?.metadata?.attackSpeedBonus || 20;
  }
  
  /**
   * Obtenir les bonus de vol de vie
   */
  static getLifeStealBonus(participant: IBattleParticipant): number {
    if (!this.isUnleashed(participant)) return 0;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    return activeEffect?.metadata?.lifeStealBonus || 15;
  }
  
  /**
   * Vérifier si les attaques doivent être AoE
   */
  static hasAoEAttacks(participant: IBattleParticipant): boolean {
    if (!this.isUnleashed(participant)) return false;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    return activeEffect?.metadata?.aoeAttacks === true;
  }
  
  /**
   * Appliquer vol de vie sur une attaque
   */
  static applyLifeSteal(
    attacker: IBattleParticipant, 
    damageDealt: number
  ): number {
    if (!this.isUnleashed(attacker) || damageDealt <= 0) return 0;
    
    const lifeStealPercent = this.getLifeStealBonus(attacker);
    const healingAmount = Math.floor(damageDealt * (lifeStealPercent / 100));
    
    if (healingAmount > 0) {
      attacker.currentHp = Math.min(
        attacker.stats.maxHp, 
        attacker.currentHp + healingAmount
      );
      
      console.log(`🔥🩸 ${attacker.name} récupère ${healingAmount} HP via vol de vie (${lifeStealPercent}%)`);
    }
    
    return healingAmount;
  }
  
  /**
   * Déclencher l'explosion finale quand l'effet expire
   */
  static triggerFinalExplosion(
    caster: IBattleParticipant,
    allEnemies: IBattleParticipant[]
  ): void {
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    if (!activeEffect || !activeEffect.metadata) return;
    
    const explosionDamage = activeEffect.metadata.explosionDamage || 0;
    const aliveEnemies = allEnemies.filter(enemy => enemy.status.alive);
    
    console.log(`🔥💥 EXPLOSION FINALE ! ${caster.name} libère ${explosionDamage} dégâts AoE massifs`);
    
    for (const enemy of aliveEnemies) {
      // Calculer dégâts avec défense de l'ennemi
      const defense = enemy.stats.def;
      let finalDamage = Math.max(1, explosionDamage - Math.floor(defense / 3));
      
      // Avantage élémentaire
      const elementalBonus = caster.element === "Fire" && enemy.element === "Wind" ? 1.5 : 1.0;
      finalDamage = Math.floor(finalDamage * elementalBonus);
      
      // Variation aléatoire
      finalDamage = Math.floor(finalDamage * (0.9 + Math.random() * 0.2));
      
      enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
      console.log(`🔥💥 ${enemy.name} subit ${finalDamage} dégâts de l'explosion finale`);
      
      if (enemy.currentHp === 0) {
        enemy.status.alive = false;
        console.log(`💀 ${enemy.name} est anéanti par l'explosion !`);
      }
    }
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Durée de l'effet
   * 6 secondes → 6 tours
   */
  private getEffectDuration(spellLevel: number): number {
    // Base 6 tours, +1 tous les 4 niveaux
    return Math.min(8, 6 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Bonus de vitesse d'attaque
   */
  private getAttackSpeedBonus(spellLevel: number): number {
    // 20% base, +2% par niveau (max 38% au niveau 10)
    return Math.min(40, 20 + (spellLevel - 1) * 2);
  }
  
  /**
   * Bonus de vol de vie
   */
  private getLifeStealBonus(spellLevel: number): number {
    // 15% base, +1% par niveau (max 24% au niveau 10)
    return Math.min(25, 15 + (spellLevel - 1) * 1);
  }
  
  /**
   * Dégâts de l'explosion finale
   * "Dégâts massifs de feu"
   */
  private getExplosionDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts massifs : niveau 1: 300 → niveau 10: 600
    const baseDamage = Math.floor(300 + (spellLevel - 1) * 35);
    
    // Gros bonus selon ATK du caster (DPS ultimate)
    const atkBonus = Math.floor(caster.stats.atk * 1.5);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    // Ne peut pas se cumuler avec un autre Brasier Déchaîné
    if (UnleashedBrazierSpell.isUnleashed(caster)) {
      console.log(`⚠️ ${caster.name} est déjà sous l'effet de Brasier Déchaîné`);
      return false;
    }
    
    // Vérifier énergie
    if (caster.energy < 100) {
      console.log(`⚠️ ${caster.name} n'a pas assez d'énergie pour Brasier Déchaîné (${caster.energy}/100)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const unleashedBrazierSpell = new UnleashedBrazierSpell();
export { UnleashedBrazierSpell };

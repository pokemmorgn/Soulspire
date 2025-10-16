// server/src/gameplay/actives/RestoringFlameSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Flamme Restauratrice - Pyra (Légendaire Support)
 * 
 * Description originale :
 * "Pyra invoque une sphère de feu purifiant qui soigne tous les alliés de 8% 
 * de leurs PV max et applique une brûlure légère aux ennemis proches.
 * Les alliés touchés gagnent un bonus de 10% de résistance aux dégâts pendant 4 secondes."
 * 
 * Adaptation turn-based :
 * - Soin : 8-15% PV max tous alliés
 * - Buff : +10-18% résistance dégâts pendant 4 tours
 * - Dégâts secondaires : Brûlure légère aux ennemis proches
 * - Recharge : 10 tours
 * - Coût : 45 énergie
 */
class RestoringFlameSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "restoring_flame",
      name: "Flamme Restauratrice",
      description: "Soin AoE + résistance + brûlure ennemis",
      type: "active",
      category: "heal",
      targetType: "all_allies",
      
      energyCost: 45,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "purifying_fire_sphere",
      soundEffect: "restoring_flame_cast"
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
    const action = this.createBaseAction(caster, targets, "skill", turn);
    
    // Coût en énergie
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 8; // Récupération d'énergie modérée
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.healing = 0;
    action.damage = 0;
    
    // Partie 1 : Soigner tous les alliés vivants
    const aliveAllies = targets.filter(ally => ally.status.alive);
    
    for (const ally of aliveAllies) {
      // Calculer le soin (% PV max + soins de base)
      const percentHealing = this.getPercentHealing(spellLevel);
      const baseHealing = this.getBaseHealing(ally, spellLevel);
      const totalHealing = Math.floor(ally.stats.maxHp * (percentHealing / 100)) + baseHealing;
      
      // Appliquer le soin
      const finalHealing = this.calculateHealing(caster, ally, totalHealing, spellLevel);
      ally.currentHp = Math.min(ally.stats.maxHp, ally.currentHp + finalHealing);
      action.healing += finalHealing;
      
      console.log(`🔥💚 ${ally.name} soigné de ${finalHealing} HP (${percentHealing}% PV max)`);
      
      // Appliquer le buff de résistance
      const resistanceDuration = this.getResistanceDuration(spellLevel);
      const resistanceResult = EffectManager.applyEffect(
        "flame_resistance",
        ally,
        caster,
        resistanceDuration
      );
      
      if (resistanceResult) {
        // Configurer les métadonnées du buff
        const activeEffect = (ally as any).activeEffects?.find(
          (e: any) => e.id === "flame_resistance"
        );
        
        if (activeEffect) {
          activeEffect.metadata = {
            damageResistance: this.getResistanceBonus(spellLevel),
            isRestoringFlame: true
          };
        }
        
        // Ajouter le buff au status
        if (!ally.status.buffs.includes("flame_resistance")) {
          ally.status.buffs.push("flame_resistance");
        }
        
        if (!action.buffsApplied.includes("flame_resistance")) {
          action.buffsApplied.push("flame_resistance");
        }
        
        console.log(`🔥🛡️ ${ally.name} gagne +${this.getResistanceBonus(spellLevel)}% résistance pendant ${resistanceDuration} tours`);
      }
    }
    
    // Partie 2 : Brûlure légère aux ennemis proches
    const allEnemies = battleContext?.allEnemies || [];
    const aliveEnemies = allEnemies.filter((enemy: IBattleParticipant) => enemy.status.alive);
    
    for (const enemy of aliveEnemies) {
      // Appliquer brûlure légère
      const burnDuration = this.getBurnDuration(spellLevel);
      const burnResult = EffectManager.applyEffect(
        "burn",
        enemy,
        caster,
        burnDuration,
        1 // 1 stack seulement (brûlure légère)
      );
      
      if (burnResult && burnResult.message) {
        console.log(`🔥 ${enemy.name} : brûlure légère pendant ${burnDuration} tours`);
        
        if (!action.debuffsApplied.includes("burn")) {
          action.debuffsApplied.push("burn");
        }
        
        // Ajouter l'ennemi aux cibles
        if (!action.targetIds.includes(enemy.heroId)) {
          action.targetIds.push(enemy.heroId);
        }
      }
    }
    
    console.log(`🔥💚 ${caster.name} invoque Flamme Restauratrice ! ${action.healing} HP soignés, ${aliveAllies.length} alliés protégés, ${aliveEnemies.length} ennemis brûlés`);
    
    return action;
  }
  
  // ----- Méthodes statiques pour intégration -----
  
  /**
   * Vérifier si un participant a la résistance de Flamme Restauratrice
   */
  static hasFlameResistance(participant: IBattleParticipant): boolean {
    if (!participant.status.alive) return false;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "flame_resistance"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Obtenir le bonus de résistance
   */
  static getResistanceBonus(participant: IBattleParticipant): number {
    if (!this.hasFlameResistance(participant)) return 0;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "flame_resistance"
    );
    
    return activeEffect?.metadata?.damageResistance || 10;
  }
  
  /**
   * Appliquer la résistance aux dégâts
   */
  static applyFlameResistance(
    defender: IBattleParticipant,
    incomingDamage: number
  ): number {
    if (!this.hasFlameResistance(defender) || incomingDamage <= 0) return incomingDamage;
    
    const resistance = this.getResistanceBonus(defender);
    const reducedDamage = Math.floor(incomingDamage * (1 - resistance / 100));
    
    console.log(`🔥🛡️ Flamme Restauratrice: -${resistance}% dégâts (${incomingDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Pourcentage de soin par rapport aux PV max
   */
  private getPercentHealing(spellLevel: number): number {
    // 8% base, +0.8% par niveau (max 15.2% au niveau 10)
    return Math.min(16, 8 + (spellLevel - 1) * 0.8);
  }
  
  /**
   * Soins de base indépendants du % PV
   */
  private getBaseHealing(target: IBattleParticipant, spellLevel: number): number {
    // Soins de base : niveau 1: 40 → niveau 10: 115
    const baseAmount = Math.floor(40 + (spellLevel - 1) * 8);
    return baseAmount;
  }
  
  /**
   * Bonus de résistance aux dégâts
   */
  private getResistanceBonus(spellLevel: number): number {
    // 10% base, +1% par niveau (max 19% au niveau 10)
    return Math.min(20, 10 + (spellLevel - 1) * 1);
  }
  
  /**
   * Durée de la résistance
   * 4 secondes → 4 tours
   */
  private getResistanceDuration(spellLevel: number): number {
    // Base 4 tours, +1 tous les 4 niveaux
    return Math.min(6, 4 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Durée de la brûlure légère
   */
  private getBurnDuration(spellLevel: number): number {
    // Base 2 tours, +1 tous les 5 niveaux
    return Math.min(4, 2 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    return true;
  }
}

// Exports
export const restoringFlameSpell = new RestoringFlameSpell();
export { RestoringFlameSpell };

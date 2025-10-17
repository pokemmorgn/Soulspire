// server/src/gameplay/actives/SouffleDesBreisesSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Souffle des Braises - Pyrrhos (Epic Support)
 * 
 * Description originale :
 * "Pyrrhos libère une onde de chaleur bienfaisante autour de lui.
 * Soigne tous les alliés proches de 8% de leurs PV max et leur confère +10% 
 * de résistance aux dégâts pendant 4 secondes.
 * Les ennemis touchés par la vague subissent une brûlure légère pendant 2 secondes."
 * 
 * Adaptation turn-based :
 * - Soins AoE : 8% HP max tous alliés
 * - Buff défensif : +10% résistance aux dégâts (4 tours)
 * - Brûlure ennemis : 2 tours de DoT
 * - Recharge : 10 tours
 * - Coût : 40 énergie (maintenant 0 grâce au fix)
 */
class SouffleDesBreisesSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "souffle_des_braises",
      name: "Souffle des Braises",
      description: "Soins AoE + résistance alliés + brûlure ennemis",
      type: "active",
      category: "heal",
      targetType: "all",
      
      energyCost: 40,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "ember_breath_aura",
      soundEffect: "souffle_braises_cast"
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
    const allParticipants = [...(battleContext?.allPlayers || []), ...(battleContext?.allEnemies || [])];
    const action = this.createBaseAction(caster, allParticipants, "skill", turn);
    
    // Identifier alliés et ennemis
    const isPlayerTeam = (battleContext?.allPlayers || []).includes(caster);
    const allies = isPlayerTeam ? 
      (battleContext?.allPlayers || []).filter((p: IBattleParticipant) => p.status.alive) :
      (battleContext?.allEnemies || []).filter((p: IBattleParticipant) => p.status.alive);
    
    const enemies = isPlayerTeam ? 
      (battleContext?.allEnemies || []).filter((p: IBattleParticipant) => p.status.alive) :
      (battleContext?.allPlayers || []).filter((p: IBattleParticipant) => p.status.alive);
    
    // Initialiser l'action
    action.energyCost = 0; // Fix: sorts actifs coûtent 0
    action.energyGain = 18; // Généreux pour un support
    action.damage = 0;
    action.healing = 0;
    action.buffsApplied = [];
    action.debuffsApplied = [];
    
    console.log(`🔥💨 ${caster.name} libère un Souffle des Braises bienfaisant !`);
    
    // === PHASE 1 : SOIGNER LES ALLIÉS ===
    
    let totalHealing = 0;
    const resistanceDuration = this.getResistanceDuration(spellLevel);
    const resistanceBonus = this.getResistanceBonus(spellLevel);
    
    for (const ally of allies) {
      // Calculer soins (8% HP max)
      const healingAmount = this.calculateHealing(
        caster, 
        ally, 
        Math.floor(ally.stats.maxHp * this.getHealingPercent(spellLevel) / 100), 
        spellLevel
      );
      
      // Appliquer soins
      ally.currentHp = Math.min(ally.stats.maxHp, ally.currentHp + healingAmount);
      totalHealing += healingAmount;
      
      console.log(`🔥💚 ${ally.name} soigné de ${healingAmount} HP (${this.getHealingPercent(spellLevel)}% PV max)`);
      
      // Appliquer résistance aux dégâts
      const resistanceResult = EffectManager.applyEffect(
        "damage_resistance",
        ally,
        caster,
        resistanceDuration
      );
      
      if (resistanceResult) {
        // Configurer les métadonnées de résistance
        const activeEffect = (ally as any).activeEffects?.find(
          (e: any) => e.id === "damage_resistance"
        );
        
        if (activeEffect) {
          activeEffect.metadata = {
            damageReduction: resistanceBonus,
            sourceSpell: "souffle_des_braises",
            isEmberBreath: true
          };
        }
        
        console.log(`🔥🛡️ ${ally.name} gagne +${resistanceBonus}% résistance pendant ${resistanceDuration} tours`);
        
        if (!action.buffsApplied.includes("damage_resistance")) {
          action.buffsApplied.push("damage_resistance");
        }
      }
    }
    
    action.healing = totalHealing;
    
    // === PHASE 2 : BRÛLER LES ENNEMIS ===
    
    const burnDuration = this.getBurnDuration(spellLevel);
    let enemiesBurned = 0;
    
    for (const enemy of enemies) {
      // Vérifier résistance aux brûlures
      if (this.checkBurnResistance(enemy)) {
        console.log(`🛡️ ${enemy.name} résiste à la brûlure (Fire resistance)`);
        continue;
      }
      
      // Appliquer brûlure légère
      const burnResult = EffectManager.applyEffect(
        "burn",
        enemy,
        caster,
        burnDuration,
        1 // 1 stack de brûlure légère
      );
      
      if (burnResult && burnResult.message) {
        console.log(`🔥 ${enemy.name} : brûlure légère pendant ${burnDuration} tours`);
        enemiesBurned++;
        
        if (!action.debuffsApplied.includes("burn")) {
          action.debuffsApplied.push("burn");
        }
      }
    }
    
    // === RÉSUMÉ DE L'ACTION ===
    
    console.log(`🔥💨 Souffle des Braises : ${totalHealing} HP soignés, ${allies.length} alliés protégés, ${enemiesBurned} ennemis brûlés`);
    
    return action;
  }
  
  // ----- Méthodes statiques pour intégration -----
  
  /**
   * Vérifier si un participant a la résistance du Souffle des Braises
   */
  static hasEmberBreathResistance(participant: IBattleParticipant): boolean {
    const activeEffects = (participant as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    const resistanceEffect = activeEffects.find((effect: any) => 
      effect.id === "damage_resistance" && 
      effect.metadata?.isEmberBreath === true
    );
    
    return resistanceEffect !== undefined;
  }
  
  /**
   * Obtenir le bonus de résistance actuel
   */
  static getResistanceBonus(participant: IBattleParticipant): number {
    const activeEffects = (participant as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const resistanceEffect = activeEffects.find((effect: any) => 
      effect.id === "damage_resistance" && 
      effect.metadata?.isEmberBreath === true
    );
    
    return resistanceEffect?.metadata?.damageReduction || 0;
  }
  
  /**
   * Calculer l'efficacité optimale du sort
   */
  static calculateOptimalTargeting(
    caster: IBattleParticipant,
    allies: IBattleParticipant[],
    enemies: IBattleParticipant[],
    spellLevel: number
  ): {
    healingPotential: number;
    alliesAffected: number;
    enemiesBurnable: number;
    priority: number;
  } {
    const aliveAllies = allies.filter(a => a.status.alive);
    const aliveEnemies = enemies.filter(e => e.status.alive);
    
    // Calculer potentiel de soins
    const healingPercent = 8 + (spellLevel - 1) * 0.5;
    let healingPotential = 0;
    let criticalAllies = 0;
    
    for (const ally of aliveAllies) {
      const missingHp = ally.stats.maxHp - ally.currentHp;
      const potentialHealing = Math.min(missingHp, ally.stats.maxHp * (healingPercent / 100));
      healingPotential += potentialHealing;
      
      // Alliés en danger critique
      if ((ally.currentHp / ally.stats.maxHp) < 0.3) {
        criticalAllies++;
      }
    }
    
    // Calculer ennemis brûlables
    const enemiesBurnable = aliveEnemies.filter(e => !e.status.debuffs.includes("burn")).length;
    
    // Calculer priorité globale
    let priority = 50; // Base
    priority += criticalAllies * 30; // Très prioritaire si alliés en danger
    priority += aliveAllies.length * 5; // Plus d'alliés = plus utile
    priority += enemiesBurnable * 3; // Bonus pour brûlure
    
    return {
      healingPotential,
      alliesAffected: aliveAllies.length,
      enemiesBurnable,
      priority
    };
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Pourcentage de soins selon le niveau
   */
  private getHealingPercent(spellLevel: number): number {
    // 8% base, +0.5% par niveau (max 12.5% au niveau 10)
    return Math.min(13, 8 + (spellLevel - 1) * 0.5);
  }
  
  /**
   * Bonus de résistance aux dégâts
   */
  private getResistanceBonus(spellLevel: number): number {
    // 10% base, +1% par niveau (max 19% au niveau 10)
    return Math.min(20, 10 + (spellLevel - 1) * 1);
  }
  
  /**
   * Durée de la résistance aux dégâts
   * 4 secondes → 4 tours
   */
  private getResistanceDuration(spellLevel: number): number {
    // Base 4 tours, +1 tous les 4 niveaux
    return Math.min(6, 4 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Durée de la brûlure sur les ennemis
   * 2 secondes → 2 tours
   */
  private getBurnDuration(spellLevel: number): number {
    // Base 2 tours, +1 tous les 5 niveaux
    return Math.min(4, 2 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Vérifier la résistance aux brûlures d'un ennemi
   */
  private checkBurnResistance(enemy: IBattleParticipant): boolean {
    // Résistance élémentaire (Fire vs Fire)
    if (enemy.element === "Fire") {
      return Math.random() < 0.4; // 40% de résistance
    }
    
    // Résistance via flame_resistance
    const hasFlameRes = (enemy as any).activeEffects?.some(
      (e: any) => e.id === "flame_resistance"
    );
    
    if (hasFlameRes) {
      // Utiliser la logique de FlameResistanceEffect si disponible
      return Math.random() < 0.5; // 50% de résistance
    }
    
    return false;
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    // Vérifier qu'il y a au moins un allié vivant à soigner
    // (cette vérification sera faite dans BattleEngine avec le contexte)
    
    return true;
  }
}

// Exports
export const souffleDesBreisesSpell = new SouffleDesBreisesSpell();
export { SouffleDesBreisesSpell };

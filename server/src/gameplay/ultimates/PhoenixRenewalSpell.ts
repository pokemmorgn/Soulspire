// server/src/gameplay/ultimates/PhoenixRenewalSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Renaissance de la Flamme - Pyra (Légendaire Support)
 * 
 * Description originale :
 * "Pyra concentre toute son énergie et déclenche une vague de feu sacré.
 * Soigne tous les alliés de 25% de leurs PV manquants, leur accorde un bouclier 
 * égal à 15% de leurs PV max pendant 6 secondes, et purifie toutes les altérations.
 * Les ennemis proches subissent de lourds dégâts de feu."
 * 
 * Adaptation turn-based :
 * - Soin : 25% des PV manquants
 * - Bouclier : 15% PV max pendant 6 tours
 * - Purification : Retire tous les debuffs
 * - Dégâts AoE : Dégâts de feu lourds aux ennemis
 * - Recharge : 25 tours
 * - Coût : 100 énergie
 */
class PhoenixRenewalSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "phoenix_renewal",
      name: "Renaissance de la Flamme",
      description: "Soin massif + bouclier + purification alliés, dégâts AoE ennemis",
      type: "ultimate",
      category: "heal",
      targetType: "all_allies",
      
      energyCost: 100,
      baseCooldown: 25,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "phoenix_fire_wave",
      soundEffect: "phoenix_renewal_cast"
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
    
    // Coût en énergie
    action.energyCost = 100;
    action.energyGain = 0; // Ultimate ne génère pas d'énergie
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.healing = 0;
    action.damage = 0;
    
    // Partie 1 : Soigner et protéger tous les alliés
    const aliveAllies = targets.filter(ally => ally.status.alive);
    
    for (const ally of aliveAllies) {
      // 1. Calculer le soin (25% des PV manquants)
      const missingHp = ally.stats.maxHp - ally.currentHp;
      const healingAmount = this.calculateHealing(
        caster, 
        ally, 
        this.getBaseHealing(spellLevel), 
        spellLevel
      );
      
      // Appliquer bonus PV manquants
      const missingHpHealing = Math.floor(missingHp * 0.25);
      const totalHealing = healingAmount + missingHpHealing;
      
      ally.currentHp = Math.min(ally.stats.maxHp, ally.currentHp + totalHealing);
      action.healing += totalHealing;
      
      console.log(`🔥💚 ${ally.name} soigné de ${totalHealing} HP (${healingAmount} base + ${missingHpHealing} manquants)`);
      
      // 2. Appliquer le bouclier (15% PV max)
      const shieldDuration = this.getShieldDuration(spellLevel);
      const shieldResult = EffectManager.applyEffect(
        "shield",
        ally,
        caster,
        shieldDuration
      );
      
      if (shieldResult && shieldResult.message) {
        console.log(`🔥🛡️ ${shieldResult.message}`);
        if (!action.buffsApplied.includes("shield")) {
          action.buffsApplied.push("shield");
        }
      }
      
      // Définir les HP du bouclier
      const activeShield = (ally as any).activeEffects?.find(
        (e: any) => e.id === "shield"
      );
      
      if (activeShield) {
        const shieldHp = this.getShieldAmount(ally, spellLevel);
        activeShield.metadata = { 
          shieldHp,
          isPhoenixRenewal: true // Marquer l'origine
        };
        console.log(`🔥🛡️ ${ally.name} reçoit un bouclier de ${shieldHp} HP`);
      }
      
      // 3. Purifier toutes les altérations négatives
      const removedDebuffs = [...ally.status.debuffs];
      if (removedDebuffs.length > 0) {
        // Retirer tous les debuffs du status
        ally.status.debuffs = [];
        
        // Retirer tous les effets négatifs actifs
        if ((ally as any).activeEffects) {
          const negativeEffects = ["burn", "poison", "bleed", "corrosion", "stunned", "frozen", "silenced", "weakness", "vulnerability", "armor_break"];
          
          for (const effectId of negativeEffects) {
            EffectManager.removeEffect(ally, effectId);
          }
        }
        
        console.log(`🔥✨ ${ally.name} purifié ! Debuffs retirés: ${removedDebuffs.join(", ")}`);
      }
    }
    
    // Partie 2 : Dégâts AoE aux ennemis proches
    const allEnemies = battleContext?.allEnemies || [];
    const aliveEnemies = allEnemies.filter((enemy: IBattleParticipant) => enemy.status.alive);
    
    if (aliveEnemies.length > 0) {
      const aoeDamage = this.getAoEDamage(caster, spellLevel);
      
      for (const enemy of aliveEnemies) {
        const damage = this.calculateDamage(caster, enemy, aoeDamage, spellLevel, "magical");
        
        enemy.currentHp = Math.max(0, enemy.currentHp - damage);
        action.damage += damage;
        
        // Marquer les ennemis comme cibles secondaires
        if (!action.targetIds.includes(enemy.heroId)) {
          action.targetIds.push(enemy.heroId);
        }
        
        console.log(`🔥💥 ${enemy.name} subit ${damage} dégâts de feu sacré`);
        
        if (enemy.currentHp === 0) {
          enemy.status.alive = false;
          console.log(`💀 ${enemy.name} est consumé par les flammes sacrées !`);
        }
      }
    }
    
    console.log(`🔥⭐ ${caster.name} déclenche Renaissance de la Flamme ! (${action.healing} soins, ${action.damage} dégâts AoE)`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Soins de base
   * Support Légendaire = soins élevés
   */
  private getBaseHealing(spellLevel: number): number {
    // Soins élevés : niveau 1: 120 → niveau 10: 280
    return Math.floor(120 + (spellLevel - 1) * 18);
  }
  
  /**
   * Montant du bouclier (15% PV max)
   */
  private getShieldAmount(target: IBattleParticipant, spellLevel: number): number {
    // 15% base, +1% par niveau (max 24% au niveau 10)
    const percent = Math.min(25, 15 + (spellLevel - 1) * 1);
    return Math.floor(target.stats.maxHp * (percent / 100));
  }
  
  /**
   * Durée du bouclier
   * 6 secondes → 6 tours
   */
  private getShieldDuration(spellLevel: number): number {
    // Base 6 tours, +1 tous les 3 niveaux
    return Math.min(9, 6 + Math.floor((spellLevel - 1) / 3));
  }
  
  /**
   * Dégâts AoE aux ennemis
   * "Lourds dégâts de feu"
   */
  private getAoEDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts lourds mais secondaires : niveau 1: 180 → niveau 10: 400
    const baseDamage = Math.floor(180 + (spellLevel - 1) * 25);
    
    // Bonus selon ATK du caster
    const atkBonus = Math.floor(caster.stats.atk * 0.8);
    
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
    
    // Vérifier énergie
    if (caster.energy < 100) {
      console.log(`⚠️ ${caster.name} n'a pas assez d'énergie pour Renaissance de la Flamme (${caster.energy}/100)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const phoenixRenewalSpell = new PhoenixRenewalSpell();
export { PhoenixRenewalSpell };

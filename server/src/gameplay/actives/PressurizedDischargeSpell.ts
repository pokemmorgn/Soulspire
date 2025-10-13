// server/src/gameplay/actives/PressurizedDischargeSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Décharge Pressurisée - Albert (Rare Support)
 * 
 * Description originale :
 * "Albert libère la vapeur accumulée dans ses dispositifs, créant une onde de chaleur 
 * qui soigne légèrement tous les alliés et repousse les ennemis proches.
 * Le soin équivaut à 5% des PV max des alliés affectés."
 * 
 * Adaptation turn-based :
 * - Soins : 5% HP max sur tous les alliés
 * - Contrôle : Applique "repousse" (léger stun/slow) aux ennemis proches
 * - Recharge : 12 tours
 * - Coût : 45 énergie
 */
class PressurizedDischargeSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "pressurized_discharge",
      name: "Décharge Pressurisée",
      description: "Soigne les alliés, repousse les ennemis proches",
      type: "active",
      category: "heal",
      targetType: "all_allies",
      
      energyCost: 45,
      baseCooldown: 12,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "steam_wave",
      soundEffect: "pressurized_discharge_cast"
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
    action.energyGain = 8; // Bon gain pour sort support
    action.healing = 0;
    action.damage = 0;
    action.buffsApplied = [];
    action.debuffsApplied = [];
    
    // Soigner tous les alliés
    for (const ally of targets) {
      if (!ally.status.alive) continue;
      
      const healAmount = this.calculateHealing(caster, ally, 0, spellLevel);
      action.healing += healAmount;
      
      console.log(`💚🔧 ${ally.name} récupère ${healAmount} HP (Décharge Pressurisée)`);
    }
    
    // Repousser les ennemis proches (appliquer slow)
    const isPlayerTeam = battleContext?.allPlayers?.includes(caster);
    const enemies = isPlayerTeam ? battleContext?.allEnemies : battleContext?.allPlayers;
    
    if (enemies && enemies.length > 0) {
      const knockbackDuration = this.getKnockbackDuration(spellLevel);
      const knockbackTargets: IBattleParticipant[] = [];
      
      // Cibler tous les ennemis vivants (simplification du "proches")
      for (const enemy of enemies) {
        if (!enemy.status.alive) continue;
        
        // Appliquer slow (simule le repousse + désorientation)
        const slowResult = EffectManager.applyEffect(
          "slow",
          enemy,
          caster,
          knockbackDuration,
          1 // 1 stack = -30% vitesse
        );
        
        if (slowResult && slowResult.message) {
          console.log(`💨 ${slowResult.message}`);
          if (!action.debuffsApplied.includes("slow")) {
            action.debuffsApplied.push("slow");
          }
        }
        
        knockbackTargets.push(enemy);
        
        // Ajouter aux cibles de l'action pour l'UI
        if (!action.targetIds.includes(enemy.heroId)) {
          action.targetIds.push(enemy.heroId);
        }
      }
      
      if (knockbackTargets.length > 0) {
        console.log(`💨🔧 ${knockbackTargets.length} ennemis repoussés par la décharge !`);
      }
    }
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
/**
   * Calculer les soins
   * Override de BaseSpell.calculateHealing pour utiliser % HP max
   */
  protected calculateHealing(
    caster: IBattleParticipant,
    target: IBattleParticipant,
    baseHealing: number,
    spellLevel: number
  ): number {
    // Base : 5% des HP max de l'allié
    const hpPercent = this.getHealingPercent(spellLevel);
    let totalHealing = Math.floor(target.stats.maxHp * (hpPercent / 100));
    
    // Bonus d'intelligence du caster
    const casterStats = caster.stats as any;
    const intBonus = Math.floor((casterStats.intelligence || 70) * 0.2);
    totalHealing += intBonus;
    
    // Multiplicateur de rareté (inline car méthode privée dans BaseSpell)
    const rarityMultipliers: { [key: string]: number } = {
      Common: 1.0,
      Rare: 1.15,
      Epic: 1.35,
      Legendary: 1.7
    };
    totalHealing *= (rarityMultipliers[caster.rarity] || 1.0);
    
    // Variation aléatoire réduite
    totalHealing *= (0.95 + Math.random() * 0.1);
    
    return Math.floor(totalHealing);
  }
  
  /**
   * Pourcentage de soins
   */
  private getHealingPercent(spellLevel: number): number {
    // 5% base, +0.5% par niveau (max 9.5% au niveau 10)
    return Math.min(10, 5 + (spellLevel - 1) * 0.5);
  }
  
  /**
   * Durée du knockback (slow)
   */
  private getKnockbackDuration(spellLevel: number): number {
    // Base 2 tours, +1 tous les 5 niveaux
    return Math.min(4, 2 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Multiplicateur de rareté (copié de BaseSpell)
   */
  private getRarityMultiplier(rarity: string): number {
    const multipliers: { [key: string]: number } = {
      Common: 1.0,
      Rare: 1.15,
      Epic: 1.35,
      Legendary: 1.7
    };
    return multipliers[rarity] || 1.0;
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
export const pressurizedDischargeSpell = new PressurizedDischargeSpell();
export { PressurizedDischargeSpell };

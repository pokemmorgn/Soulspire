// server/src/gameplay/actives/EmberBashSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Ember Bash (Rempart de Cendres) - Korran
 * 
 * Description originale :
 * "Korran plante son bouclier dans le sol, créant une barrière de flammes devant lui.
 * Réduit les dégâts subis de 25% pendant 5 secondes et inflige de légers dégâts 
 * de feu aux ennemis proches à l'activation."
 * 
 * Adaptation turn-based :
 * - Réduction de dégâts : 25% pendant 5 tours
 * - Dégâts zone : Dégâts de feu légers à tous les ennemis proches (AoE)
 * - Self-cast avec effet AoE offensif
 */
class EmberBashSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "ember_bash",
      name: "Rempart de Cendres",
      description: "Réduit les dégâts subis de 25% et inflige des dégâts de feu en zone",
      type: "active",
      category: "buff",
      targetType: "self",
      
      energyCost: 35,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "shield_slam",
      soundEffect: "ember_bash_cast"
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
    action.energyGain = 8; // Gain modéré pour sort défensif avec dégâts
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.damage = 0;
    
    // 1. Appliquer l'effet "Ash Rampart" (réduction de dégâts)
    const duration = this.getRampartDuration(spellLevel);
    const damageReduction = this.getDamageReduction(spellLevel);
    
    const rampartResult = EffectManager.applyEffect(
      "ash_rampart", 
      caster, 
      caster, 
      duration
    );
    
    if (rampartResult && rampartResult.message) {
      console.log(`🔥🛡️ ${rampartResult.message}`);
      action.buffsApplied.push("ash_rampart");
    }
    
    // Stocker metadata pour la réduction de dégâts
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "ash_rampart"
    );
    
    if (activeEffect) {
      activeEffect.metadata = {
        damageReduction: damageReduction // 25% de base
      };
    }
    
    // 2. Infliger des dégâts de feu en zone aux ennemis proches
    const isPlayerTeam = battleContext?.allPlayers?.includes(caster);
    const enemies = isPlayerTeam ? battleContext?.allEnemies : battleContext?.allPlayers;
    
    if (enemies && enemies.length > 0) {
      const baseDamage = this.getAoEDamage(spellLevel);
      let totalDamage = 0;
      
      // Cibler tous les ennemis vivants
      const aliveEnemies = enemies.filter((e: IBattleParticipant) => e.status.alive);
      action.targetIds = [...action.targetIds, ...aliveEnemies.map((e: IBattleParticipant) => e.heroId)];
      
      for (const enemy of aliveEnemies) {
        const damage = this.calculateDamage(caster, enemy, baseDamage, spellLevel, "magical");
        totalDamage += damage;
        
        // Stocker dégâts par cible (pour UI)
        if (!(action as any).perTargetDamage) {
          (action as any).perTargetDamage = {};
        }
        (action as any).perTargetDamage[enemy.heroId] = damage;
      }
      
      action.damage = totalDamage;
      
      console.log(`🔥💥 Rempart de Cendres inflige ${totalDamage} dégâts de feu total aux ennemis proches`);
    }
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Durée du rempart
   * 5 secondes → 5 tours
   */
  private getRampartDuration(spellLevel: number): number {
    // Base 5 tours, +1 tous les 3 niveaux
    return Math.min(7, 5 + Math.floor((spellLevel - 1) / 3));
  }
  
  /**
   * Pourcentage de réduction de dégâts
   * Base 25%, scaling avec niveau
   */
  private getDamageReduction(spellLevel: number): number {
    // 25% base, +1% par niveau (max 34% au niveau 10)
    return Math.min(35, 25 + (spellLevel - 1));
  }
  
  /**
   * Dégâts AoE de base
   * "Légers dégâts de feu"
   */
  private getAoEDamage(spellLevel: number): number {
    // Dégâts légers : niveau 1: 60 → niveau 10: 150
    return Math.floor(60 + (spellLevel - 1) * 10);
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé si déjà actif (éviter stack)
    const activeEffects = (caster as any).activeEffects as any[];
    if (activeEffects) {
      const hasRampart = activeEffects.some((e: any) => e.id === "ash_rampart");
      if (hasRampart) {
        console.log(`⚠️ ${caster.name} a déjà un Rempart de Cendres actif`);
        return false;
      }
    }
    
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    return true;
  }
}

// Exports
export const emberBashSpell = new EmberBashSpell();
export { EmberBashSpell };

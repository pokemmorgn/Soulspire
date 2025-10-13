// server/src/gameplay/actives/BurningChainsSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Chaînes Ardentes - Grathul (Epic Tank)
 * 
 * Description originale :
 * "Grathul lance ses chaînes enflammées sur l'ennemi le plus éloigné, 
 * l'attirant à lui et infligeant des dégâts de feu modérés.
 * L'ennemi touché est étourdi pendant 1,5 seconde."
 * 
 * Adaptation turn-based :
 * - Cible : Ennemi le plus éloigné (back-line priority)
 * - Dégâts : Modérés
 * - CC : Stun 1 tour (1.5s → 1-2 tours selon niveau)
 * - Recharge : 10 tours
 * - Coût : 35 énergie
 */
class BurningChainsSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "burning_chains",
      name: "Chaînes Ardentes",
      description: "Attire l'ennemi éloigné et l'étourdit",
      type: "active",
      category: "control",
      targetType: "single_enemy",
      
      energyCost: 35,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "chains_pull",
      soundEffect: "burning_chains_cast"
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
    
    // Sélectionner l'ennemi le plus éloigné (back-line)
    const allEnemies = battleContext?.allEnemies || targets;
    const farthestEnemy = this.selectFarthestEnemy(caster, allEnemies, battleContext);
    const target = farthestEnemy || targets[0];
    
    if (!target || !target.status.alive) {
      throw new Error("Burning Chains requires a valid living target");
    }
    
    // Créer l'action de base
    const action = this.createBaseAction(caster, [target], "skill", turn);
    
    // Calculer les dégâts
    const baseDamage = this.getBaseDamage(spellLevel);
    const finalDamage = this.calculateDamage(caster, target, baseDamage, spellLevel, "magical");
    
    // Vérifier le critique
    const critChance = 0.10; // 10% pour un sort de contrôle
    const isCritical = Math.random() < critChance;
    
    // Appliquer le critique si applicable
    const actualDamage = isCritical ? Math.floor(finalDamage * 1.5) : finalDamage;
    
    // Remplir l'action
    action.damage = actualDamage;
    action.critical = isCritical;
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 12; // Bon gain pour Tank avec contrôle
    action.elementalAdvantage = 1.0; // Déjà calculé dans calculateDamage
    action.debuffsApplied = [];
    
    // Appliquer Stun
    const stunDuration = this.getStunDuration(spellLevel);
    const stunResult = EffectManager.applyEffect(
      "stun",
      target,
      caster,
      stunDuration
    );
    
    if (stunResult && stunResult.message) {
      console.log(`⛓️💫 ${stunResult.message}`);
      action.debuffsApplied.push("stun");
    }
    
    console.log(`⛓️🔥 ${caster.name} attire ${target.name} avec ses chaînes ardentes !`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Dégâts de base
   * "Modérés" = medium damage
   */
  private getBaseDamage(spellLevel: number): number {
    // Dégâts modérés : niveau 1: 120 → niveau 10: 280
    return Math.floor(120 + (spellLevel - 1) * 18);
  }
  
  /**
   * Durée du stun
   * 1.5 secondes → 1-2 tours selon niveau
   */
  private getStunDuration(spellLevel: number): number {
    // Base 1 tour, +1 tous les 5 niveaux (max 2 tours)
    return Math.min(2, 1 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Sélectionner l'ennemi le plus éloigné (back-line priority)
   */
  private selectFarthestEnemy(
    caster: IBattleParticipant,
    enemies: IBattleParticipant[],
    battleContext?: any
  ): IBattleParticipant | null {
    const aliveEnemies = enemies.filter(e => e.status.alive);
    if (aliveEnemies.length === 0) return null;
    
    // Obtenir les positions
    const isPlayerTeam = battleContext?.allPlayers?.includes(caster);
    const enemyPositions = isPlayerTeam ? 
      (battleContext as any)?.enemyPositions : 
      (battleContext as any)?.playerPositions;
    
    if (!enemyPositions) {
      // Fallback : sélectionner un support ou DPS ranged
      const backlineTargets = aliveEnemies.filter(e => 
        e.role === "Support" || e.role === "DPS Ranged"
      );
      return backlineTargets.length > 0 ? backlineTargets[0] : aliveEnemies[0];
    }
    
    // Trouver l'ennemi avec la position la plus élevée (back-line = positions 3-5)
    let farthestEnemy = aliveEnemies[0];
    let maxPosition = enemyPositions.get(farthestEnemy.heroId) || 0;
    
    for (const enemy of aliveEnemies) {
      const position = enemyPositions.get(enemy.heroId) || 0;
      if (position > maxPosition) {
        maxPosition = position;
        farthestEnemy = enemy;
      }
    }
    
    return farthestEnemy;
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
export const burningChainsSpell = new BurningChainsSpell();
export { BurningChainsSpell };

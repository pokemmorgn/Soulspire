// server/src/gameplay/actives/ThermalTurretSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Tourelle de Protection Thermique - Albert (Rare Support)
 * 
 * Description originale :
 * "Albert déploie une tourelle générant une barrière de chaleur protectrice pendant 6 secondes.
 * Tant qu'elle est active, tous les alliés gagnent un bouclier équivalant à 8% de leurs PV max 
 * et 10% de résistance aux dégâts.
 * À la fin de la durée, la tourelle explose, infligeant de légers dégâts de feu aux ennemis proches."
 * 
 * Adaptation turn-based :
 * - Durée : 6 secondes → 6 tours
 * - Bouclier : 8% HP max sur tous les alliés
 * - Résistance : 10% réduction dégâts (buff séparé ou via shield metadata)
 * - Explosion finale : Dégâts légers AoE
 * - Recharge : 10 tours
 * - Coût : 40 énergie
 */
class ThermalTurretSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "thermal_turret",
      name: "Tourelle de Protection Thermique",
      description: "Bouclier + résistance sur tous les alliés, explose en fin de durée",
      type: "active",
      category: "buff",
      targetType: "all_allies",
      
      energyCost: 40,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "turret_deploy",
      soundEffect: "thermal_turret_cast"
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
    action.energyGain = 5; // Petit gain pour sort support
    action.buffsApplied = [];
    
    const duration = this.getDuration(spellLevel);
    const damageResistance = this.getDamageResistance(spellLevel);
    
    // Appliquer bouclier + résistance sur tous les alliés
    for (const ally of targets) {
      if (!ally.status.alive) continue;
      
      // Calculer le bouclier (8% HP max de l'allié)
      const shieldHp = this.getShieldAmount(ally, spellLevel);
      
      // Appliquer le bouclier
      const shieldResult = EffectManager.applyEffect(
        "shield",
        ally,
        caster,
        duration
      );
      
      if (shieldResult && shieldResult.message) {
        console.log(`🛡️🔧 ${shieldResult.message}`);
        if (!action.buffsApplied.includes("shield")) {
          action.buffsApplied.push("shield");
        }
      }
      
      // Définir les HP du bouclier + marquer comme tourelle
      const activeEffect = (ally as any).activeEffects?.find(
        (e: any) => e.id === "shield"
      );
      
      if (activeEffect) {
        activeEffect.metadata = { 
          shieldHp,
          isThermalTurret: true, // Marquer pour l'explosion finale
          explosionDamage: this.getExplosionDamage(caster, spellLevel),
          damageResistance: damageResistance // 10% réduction dégâts
        };
      }
      
      console.log(`🔧🛡️ ${ally.name} reçoit un bouclier de ${shieldHp} HP et ${damageResistance}% de résistance`);
    }
    
    console.log(`🔧 Tourelle de Protection déployée ! (Durée: ${duration} tours)`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Montant du bouclier
   * Base 8% HP max de l'allié, scaling avec niveau
   */
  private getShieldAmount(ally: IBattleParticipant, spellLevel: number): number {
    // 8% base, +1% par niveau (max 17% au niveau 10)
    const percent = Math.min(18, 8 + (spellLevel - 1));
    return Math.floor(ally.stats.maxHp * (percent / 100));
  }
  
  /**
   * Durée de l'effet
   * 6 secondes → 6 tours
   */
  private getDuration(spellLevel: number): number {
    // Base 6 tours, +1 tous les 4 niveaux
    return Math.min(8, 6 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Pourcentage de résistance aux dégâts
   */
  private getDamageResistance(spellLevel: number): number {
    // 10% base, +1% par niveau (max 19% au niveau 10)
    return Math.min(20, 10 + (spellLevel - 1));
  }
  
  /**
   * Dégâts de l'explosion finale
   * "Légers dégâts" = low AoE damage
   */
  private getExplosionDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts légers : niveau 1: 80 → niveau 10: 180
    const baseDamage = Math.floor(80 + (spellLevel - 1) * 11);
    
    // Bonus selon INT du caster
    const intBonus = Math.floor(((caster.stats as any).intelligence || 70) * 0.3);
    
    return baseDamage + intBonus;
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
export const thermalTurretSpell = new ThermalTurretSpell();
export { ThermalTurretSpell };

// server/src/gameplay/passives/InternalBrazierPassive.ts
import { BasePassive, IPassiveConfig, IPassiveTriggerContext, IPassiveResult } from "../base/BasePassive";

/**
 * Internal Brazier (Brasier Intérieur) - Korran
 * 
 * Description originale :
 * "Lorsque les PV de Korran tombent sous 50%, son armure s'embrase, 
 * augmentant sa résistance aux dégâts de 15% pendant 4 secondes et 
 * renvoyant 10% des dégâts de mêlée subis.
 * Ne peut se déclencher qu'une fois toutes les 12 secondes."
 * 
 * Adaptation turn-based :
 * - Déclenchement : Sous 50% HP
 * - Effet 1 : +15% résistance aux dégâts pendant 4 tours
 * - Effet 2 : Renvoie 10% dégâts mêlée pendant 4 tours
 * - Cooldown interne : 12 tours
 */
class InternalBrazierPassive extends BasePassive {
  constructor() {
    const config: IPassiveConfig = {
      id: "internal_brazier",
      name: "Brasier Intérieur",
      description: "Sous 50% HP, gagne résistance et renvoie les dégâts mêlée",
      
      triggerType: "on_hp_threshold",
      internalCooldown: 12, // 12 tours entre chaque déclenchement
      
      triggerConditions: {
        hpThresholdPercent: 50 // Se déclenche sous 50% HP
      },
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      maxLevel: 10
    };
    
    super(config);
  }
  
  protected onTrigger(context: IPassiveTriggerContext, passiveLevel: number): IPassiveResult {
    const owner = context.actor;
    
    // Calculer la durée et les valeurs selon le niveau
    const duration = this.getEffectDuration(passiveLevel);
    const damageReduction = this.getDamageReduction(passiveLevel);
    const reflectPercent = this.getReflectPercent(passiveLevel);
    
    console.log(`🔥 ${owner.name} active Brasier Intérieur ! (${damageReduction}% résistance, ${reflectPercent}% reflect)`);
    
    // Créer le résultat
    return {
      triggered: true,
      message: `🔥 ${owner.name} s'embrase ! Son armure brille de mille feux !`,
      effects: [
        {
          effectId: "internal_brazier_buff",
          targetId: owner.heroId,
          duration: duration,
          stacks: 1
        }
      ],
      statModifiers: {
        damageReduction: damageReduction,
        reflectDamage: reflectPercent
      }
    };
  }
  
  /**
   * Durée de l'effet
   * 4 secondes → 4 tours
   */
  private getEffectDuration(passiveLevel: number): number {
    // Base 4 tours, +1 tous les 4 niveaux
    return Math.min(6, 4 + Math.floor((passiveLevel - 1) / 4));
  }
  
  /**
   * Pourcentage de réduction de dégâts
   * Base 15%, scaling avec niveau
   */
  private getDamageReduction(passiveLevel: number): number {
    // 15% base, +1% par niveau (max 24% au niveau 10)
    return Math.min(25, 15 + (passiveLevel - 1));
  }
  
  /**
   * Pourcentage de reflect damage
   * Base 10%, scaling avec niveau
   */
  private getReflectPercent(passiveLevel: number): number {
    // 10% base, +1% par niveau (max 19% au niveau 10)
    return Math.min(20, 10 + (passiveLevel - 1));
  }
}

// Exports
export const internalBrazierPassive = new InternalBrazierPassive();
export { InternalBrazierPassive };

// server/src/gameplay/passives/SalvationGlowPassive.ts
import { BasePassive, IPassiveConfig, IPassiveTriggerContext, IPassiveResult } from "../base/BasePassive";
import { IBattleParticipant } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Lueur Salvatrice - Pyra (Légendaire Support)
 * 
 * Description originale :
 * "Lorsque la vie d'un allié tombe sous 30%, Pyra crée automatiquement une barrière 
 * de feu protectrice autour de lui, absorbant des dégâts équivalant à 10% de ses PV max 
 * pendant 3 secondes. Cet effet peut se produire une fois toutes les 10 secondes par allié."
 * 
 * Adaptation turn-based :
 * - Trigger : Allié < 30% HP
 * - Effet : Bouclier 10-18% PV max pendant 3 tours
 * - Cooldown : 10 tours par allié
 * - Type : Passif réactif
 */
export class SalvationGlowPassive extends BasePassive {
  constructor() {
    const config: IPassiveConfig = {
      id: "salvation_glow",
      name: "Lueur Salvatrice",
      description: "Bouclier automatique sur alliés critiques",
      triggerType: "on_ally_damaged",
      internalCooldown: 10, // 10 tours par allié
      
      triggerConditions: {
        hpThresholdPercent: 30,
        canTriggerOnSelf: false // Ne se déclenche que sur les alliés
      },
      
      element: "Fire",
      requiresRole: ["Support"],
      maxLevel: 10
    };
    
    super(config);
  }
  
  protected onTrigger(context: IPassiveTriggerContext, passiveLevel: number): IPassiveResult {
    const pyra = context.actor;
    const ally = context.target;
    
    if (!ally || ally === pyra) {
      return { triggered: false };
    }
    
    // Vérifier seuil HP
    const hpPercent = (ally.currentHp / ally.stats.maxHp) * 100;
    const threshold = this.getHpThreshold(passiveLevel);
    
    if (hpPercent >= threshold) {
      return { triggered: false };
    }
    
    // Vérifier que l'allié n'a pas déjà ce bouclier
    if (EffectManager.hasEffect(ally, "shield")) {
      return { triggered: false };
    }
    
    // Appliquer le bouclier
    const shieldDuration = this.getShieldDuration(passiveLevel);
    const shieldResult = EffectManager.applyEffect("shield", ally, pyra, shieldDuration);
    
    if (shieldResult) {
      // Configurer les métadonnées du bouclier
      const activeShield = (ally as any).activeEffects?.find((e: any) => e.id === "shield");
      
      if (activeShield) {
        const shieldHp = this.getShieldAmount(ally, passiveLevel);
        activeShield.metadata = {
          shieldHp,
          isSalvationGlow: true,
          visualEffect: "fire_barrier"
        };
        
        console.log(`🔥✨ Lueur Salvatrice ! ${ally.name} reçoit un bouclier de ${shieldHp} HP`);
      }
      
      return {
        triggered: true,
        message: `🔥✨ Lueur Salvatrice ! ${pyra.name} protège ${ally.name} avec une barrière de feu`,
        effects: [{
          effectId: "shield",
          targetId: ally.heroId,
          duration: shieldDuration,
          stacks: 1
        }]
      };
    }
    
    return { triggered: false };
  }
  
  /**
   * Vérifier si le passif peut se déclencher pour un allié spécifique
   */
  static canTriggerForAlly(
    pyra: IBattleParticipant,
    ally: IBattleParticipant,
    passiveLevel: number,
    currentTurn: number
  ): boolean {
    if (!ally.status.alive || ally === pyra) return false;
    
    // Vérifier seuil HP
    const threshold = 30 - (passiveLevel - 1) * 1; // 30% → 21% au niveau 10
    const hpPercent = (ally.currentHp / ally.stats.maxHp) * 100;
    if (hpPercent >= threshold) return false;
    
    // Vérifier cooldown par allié (géré dans BasePassive)
    const cooldownKey = `${ally.heroId}`;
    const salvationPassive = new SalvationGlowPassive();
    if (salvationPassive.isOnCooldown(cooldownKey, currentTurn)) return false;
    
    // Vérifier que l'allié n'a pas déjà ce bouclier
    if (EffectManager.hasEffect(ally, "shield")) return false;
    
    return true;
  }
  
  /**
   * Obtenir le montant du bouclier
   */
  private getShieldAmount(target: IBattleParticipant, passiveLevel: number): number {
    // 10% base, +1% par niveau (max 19% au niveau 10)
    const percent = Math.min(20, 10 + (passiveLevel - 1) * 1);
    return Math.floor(target.stats.maxHp * (percent / 100));
  }
  
  /**
   * Durée du bouclier
   */
  private getShieldDuration(passiveLevel: number): number {
    // Base 3 tours, +1 tous les 5 niveaux
    return Math.min(5, 3 + Math.floor((passiveLevel - 1) / 5));
  }
  
  /**
   * Seuil HP pour déclencher
   */
  private getHpThreshold(passiveLevel: number): number {
    // 30% base, -1% par niveau (plus facile à déclencher)
    return Math.max(20, 30 - (passiveLevel - 1) * 1);
  }
}

// Export
export const salvationGlowPassive = new SalvationGlowPassive();

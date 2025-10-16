// server/src/gameplay/passives/ArdenRagePassive.ts
import { BasePassive, IPassiveConfig, IPassiveTriggerContext, IPassiveResult } from "../base/BasePassive";
import { IBattleParticipant } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Rage Ardente - Saryel (Légendaire DPS Melee)
 * 
 * Description originale :
 * "Chaque fois que Saryel inflige un coup critique, elle gagne 5% de vitesse d'attaque 
 * pendant 5 secondes (cumulable 3 fois). À 3 cumuls, elle devient insensible aux 
 * ralentissements pendant la durée restante de l'effet."
 * 
 * Adaptation turn-based :
 * - Trigger : Coup critique infligé
 * - Effet : +5-9% vitesse d'attaque pendant 5 tours (stackable ×3)
 * - Bonus : À 3 stacks → immunité ralentissements
 * - Type : Passif d'accumulation
 */
export class ArdenRagePassive extends BasePassive {
  constructor() {
    const config: IPassiveConfig = {
      id: "arden_rage",
      name: "Rage Ardente",
      description: "Vitesse d'attaque croissante sur coups critiques",
      triggerType: "on_critical",
      internalCooldown: 0, // Pas de cooldown, accumulation continue
      
      triggerConditions: {
        canTriggerOnSelf: true
      },
      
      element: "Fire",
      requiresRole: ["DPS Melee"],
      maxLevel: 10
    };
    
    super(config);
  }
  
  protected onTrigger(context: IPassiveTriggerContext, passiveLevel: number): IPassiveResult {
    const saryel = context.actor;
    
    if (!context.wasCritical) {
      return { triggered: false };
    }
    
    const duration = this.getEffectDuration(passiveLevel);
    const currentStacks = EffectManager.getEffectStacks(saryel, "arden_rage");
    const maxStacks = this.getMaxStacks(passiveLevel);
    
    // Vérifier si on peut ajouter des stacks
    if (currentStacks >= maxStacks) {
      // Juste rafraîchir la durée
      EffectManager.applyEffect("arden_rage", saryel, saryel, duration, 0);
      return {
        triggered: true,
        message: `🔥⚡ Rage Ardente rafraîchie ! ${saryel.name} maintient ${currentStacks} stacks`
      };
    }
    
    // Appliquer l'effet Rage Ardente
    const rageResult = EffectManager.applyEffect("arden_rage", saryel, saryel, duration, 1);
    
    if (rageResult) {
      const newStacks = currentStacks + 1;
      const speedBonus = this.getSpeedBonus(passiveLevel);
      
      console.log(`🔥⚡ Rage Ardente ! ${saryel.name} gagne +${speedBonus}% vitesse (${newStacks}/${maxStacks} stacks)`);
      
      // Vérifier immunité ralentissements à max stacks
      if (newStacks >= maxStacks) {
        if (!saryel.status.buffs.includes("slow_immunity")) {
          saryel.status.buffs.push("slow_immunity");
          console.log(`🔥🛡️ ${saryel.name} devient immunisée aux ralentissements !`);
        }
      }
      
      return {
        triggered: true,
        message: `🔥⚡ Coup critique ! ${saryel.name} gagne en vitesse (${newStacks}/${maxStacks})`,
        effects: [{
          effectId: "arden_rage",
          targetId: saryel.heroId,
          duration: duration,
          stacks: 1
        }],
        statModifiers: {
          attackSpeedBonus: speedBonus * newStacks
        }
      };
    }
    
    return { triggered: false };
  }
  
  /**
   * Obtenir le bonus de vitesse total actuel
   */
  static getCurrentSpeedBonus(participant: IBattleParticipant, passiveLevel: number): number {
    const stacks = EffectManager.getEffectStacks(participant, "arden_rage");
    if (stacks === 0) return 0;
    
    const bonusPerStack = 5 + (passiveLevel - 1) * 0.5; // 5-9.5%
    return stacks * bonusPerStack;
  }
  
  /**
   * Vérifier l'immunité aux ralentissements
   */
  static hasSlowImmunity(participant: IBattleParticipant): boolean {
    return participant.status.buffs.includes("slow_immunity") ||
           EffectManager.getEffectStacks(participant, "arden_rage") >= 3;
  }
  
  /**
   * Nettoyer l'immunité quand l'effet expire
   */
  static cleanupOnExpire(participant: IBattleParticipant): void {
    if (participant.status.buffs.includes("slow_immunity")) {
      const index = participant.status.buffs.indexOf("slow_immunity");
      participant.status.buffs.splice(index, 1);
      console.log(`🔥📉 ${participant.name} perd l'immunité aux ralentissements`);
    }
  }
  
  // ----- Détails de calcul -----
  
  private getSpeedBonus(passiveLevel: number): number {
    // 5% base, +0.5% par niveau (max 9.5% au niveau 10)
    return Math.min(10, 5 + (passiveLevel - 1) * 0.5);
  }
  
  private getMaxStacks(passiveLevel: number): number {
    // Base 3 stacks, +1 tous les 5 niveaux
    return Math.min(5, 3 + Math.floor((passiveLevel - 1) / 5));
  }
  
  private getEffectDuration(passiveLevel: number): number {
    // Base 5 tours, +1 tous les 3 niveaux
    return Math.min(8, 5 + Math.floor((passiveLevel - 1) / 3));
  }
}

// Export
export const ardenRagePassive = new ArdenRagePassive();

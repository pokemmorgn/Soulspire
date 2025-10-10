// server/src/gameplay/effects/control/sleep.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Sleep (Sommeil)
 * - Empêche toute action (comme Stun)
 * - SE RÉVEILLE si prend des dégâts
 * - Non stackable
 * - Durée moyenne (2-3 tours si non interrompu)
 * - Pas de résistance spéciale
 */
export class SleepEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "sleep",
      name: "Endormi",
      description: "Impossible d'agir - Se réveille si frappé",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "sleeping" aux debuffs
    if (!target.status.debuffs.includes("sleeping")) {
      target.status.debuffs.push("sleeping");
    }
    
    return {
      message: `😴 ${target.name} s'endort profondément...`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le sleep n'a pas d'effet par tour (pas de dégâts)
    // L'effet est géré dans BattleEngine.isControlled()
    
    // Vérifier si le HP a baissé depuis le dernier tick (a pris des dégâts)
    // Note: Cette vérification devrait être faite dans executeAction() du BattleEngine
    // On retourne juste le message ici
    
    return {
      message: `😴 ${target.name} dort paisiblement...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "sleeping" des debuffs
    const index = target.status.debuffs.indexOf("sleeping");
    if (index > -1) {
      target.status.debuffs.splice(index, 1);
    }
    
    return {
      message: `👁️ ${target.name} se réveille`
    };
  }
  
  // Vérifier si la cible peut être endormie
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Les boss ont 40% de résistance aux CC
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.4; // 40%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste au sommeil (Boss resistance)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const sleepEffect = new SleepEffect();

// server/src/gameplay/effects/control/stun.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Stun (Étourdissement)
 * - Empêche toute action (attaque, sort, ultimate)
 * - Non stackable
 * - Durée courte (1-2 tours)
 * - Les Tanks ont 20% de résistance naturelle
 */
export class StunEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "stun",
      name: "Étourdi",
      description: "Impossible d'agir - Skip le tour complètement",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 1
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "stunned" aux debuffs pour que BattleEngine puisse vérifier
    if (!target.status.debuffs.includes("stunned")) {
      target.status.debuffs.push("stunned");
    }
    
    return {
      message: `💫 ${target.name} est étourdi et ne peut pas agir !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le stun n'a pas d'effet par tour (pas de dégâts)
    // L'effet est géré dans BattleEngine.isControlled()
    return {
      message: `💫 ${target.name} est toujours étourdi...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "stunned" des debuffs
    const index = target.status.debuffs.indexOf("stunned");
    if (index > -1) {
      target.status.debuffs.splice(index, 1);
    }
    
    return {
      message: `✨ ${target.name} reprend ses esprits`
    };
  }
  
  // Vérifier si la cible peut être stun
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Les Tanks ont une résistance naturelle de 20%
    if (target.role === "Tank") {
      const resistanceChance = 0.2; // 20%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au stun (Tank resistance)`);
        return false;
      }
    }
    
    // Les boss ont 50% de résistance aux CC
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.5; // 50%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste au stun (Boss resistance)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const stunEffect = new StunEffect();
export { StunEffect };

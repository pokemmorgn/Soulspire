// server/src/gameplay/effects/control/silence.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Silence (Silence)
 * - Empêche de lancer des sorts (actifs et ultimate)
 * - Autorise les attaques basiques uniquement
 * - Non stackable
 * - Durée moyenne (2-3 tours)
 * - Les Supports ont 30% de résistance naturelle
 */
export class SilenceEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "silence",
      name: "Silence",
      description: "Impossible de lancer des sorts - Attaque basique uniquement",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 2
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "silenced" aux debuffs pour que BattleEngine puisse vérifier
    if (!target.status.debuffs.includes("silenced")) {
      target.status.debuffs.push("silenced");
    }
    
    return {
      message: `🤐 ${target.name} est réduit au silence et ne peut plus lancer de sorts !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le silence n'a pas d'effet par tour (pas de dégâts)
    // L'effet est géré dans SpellManager lors du cast
    return {
      message: `🤐 ${target.name} est toujours silencé...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "silenced" des debuffs
    const index = target.status.debuffs.indexOf("silenced");
    if (index > -1) {
      target.status.debuffs.splice(index, 1);
    }
    
    return {
      message: `🗣️ ${target.name} peut à nouveau lancer des sorts`
    };
  }
  
  // Vérifier si la cible peut être silenced
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Les Supports ont une résistance naturelle de 30% (ils dépendent des sorts)
    if (target.role === "Support") {
      const resistanceChance = 0.3; // 30%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au silence (Support resistance)`);
        return false;
      }
    }
    
    // Les héros DPS Ranged ont 20% de résistance (ils utilisent beaucoup de sorts)
    if (target.role === "DPS Ranged") {
      const resistanceChance = 0.2; // 20%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au silence (Ranged DPS resistance)`);
        return false;
      }
    }
    
    // Les boss ont 40% de résistance aux CC
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.4; // 40%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste au silence (Boss resistance)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const silenceEffect = new SilenceEffect();

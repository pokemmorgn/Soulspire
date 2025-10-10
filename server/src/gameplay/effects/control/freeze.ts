// server/src/gameplay/effects/control/freeze.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Freeze (Gel)
 * - Empêche toute action (comme Stun)
 * - Après dégel : applique Slow (-50% vitesse pendant 2 tours)
 * - Non stackable
 * - Durée courte (1-2 tours)
 * - Les héros Water ont 50% de résistance naturelle
 * - Vulnérabilité pour les héros Fire (+30% chance d'application)
 */
export class FreezeEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "freeze",
      name: "Gelé",
      description: "Impossible d'agir - Ralentit après dégel",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 2
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "frozen" aux debuffs pour que BattleEngine puisse vérifier
    if (!target.status.debuffs.includes("frozen")) {
      target.status.debuffs.push("frozen");
    }
    
    return {
      message: `❄️ ${target.name} est gelé et ne peut plus bouger !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le freeze n'a pas d'effet par tour (pas de dégâts)
    // L'effet est géré dans BattleEngine.isControlled()
    return {
      message: `❄️ ${target.name} est pris dans la glace...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "frozen" des debuffs
    const frozenIndex = target.status.debuffs.indexOf("frozen");
    if (frozenIndex > -1) {
      target.status.debuffs.splice(frozenIndex, 1);
    }
    
    // ✨ AFTER-EFFECT : Appliquer Slow après le dégel
    // On va ajouter un effet "slow" temporaire
    if (!target.status.debuffs.includes("chilled")) {
      target.status.debuffs.push("chilled");
    }
    
    // Stocker dans metadata qu'on doit appliquer slow
    // (sera géré par EffectManager si on crée l'effet Slow plus tard)
    
    return {
      message: `🌨️ ${target.name} dégèle mais reste ralenti par le froid`,
      additionalEffects: ["chilled"] // Signal pour appliquer un slow
    };
  }
  
  // Vérifier si la cible peut être freeze
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Les héros Water ont 50% de résistance au gel
    if (target.element === "Water") {
      const resistanceChance = 0.5; // 50%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au gel (Water resistance)`);
        return false;
      }
    }
    
    // Les héros Fire sont plus vulnérables (pas de résistance, au contraire)
    // Cette vérification est inversée - on accepte toujours pour Fire
    if (target.element === "Fire") {
      console.log(`🔥 ${target.name} est vulnérable au gel (Fire weakness)`);
      // Pas de return false, on laisse passer
    }
    
    // Les boss ont 40% de résistance aux CC
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.4; // 40%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste au gel (Boss resistance)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const freezeEffect = new FreezeEffect();

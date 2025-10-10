// server/src/gameplay/effects/control/root.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Root (Enracinement)
 * - Peut attaquer normalement
 * - Peut lancer des sorts à distance
 * - Ne peut PAS se déplacer (pas d'impact en tour-based, mais affecte le ciblage)
 * - Les attaques de mêlée peuvent être limitées selon la position
 * - Non stackable
 * - Durée courte (2 tours)
 * - Les héros Wind ont 30% de résistance
 */
export class RootEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "root",
      name: "Enraciné",
      description: "Immobilisé mais peut attaquer et lancer des sorts",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 2
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "rooted" aux debuffs
    if (!target.status.debuffs.includes("rooted")) {
      target.status.debuffs.push("rooted");
    }
    
    return {
      message: `🌿 ${target.name} est enraciné et ne peut plus se déplacer !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le root n'a pas d'effet par tour (pas de dégâts)
    // L'effet limite les options de ciblage/mouvement
    // Dans un système turn-based, cela peut limiter les attaques de mêlée
    
    return {
      message: `🌿 ${target.name} est toujours enraciné...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "rooted" des debuffs
    const index = target.status.debuffs.indexOf("rooted");
    if (index > -1) {
      target.status.debuffs.splice(index, 1);
    }
    
    return {
      message: `🍃 ${target.name} se libère des racines`
    };
  }
  
  // Vérifier si la cible peut être enracinée
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Les héros Wind ont 30% de résistance (libres comme le vent)
    if (target.element === "Wind") {
      const resistanceChance = 0.3; // 30%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste à l'enracinement (Wind resistance)`);
        return false;
      }
    }
    
    // Les héros volants/éthérés devraient être immunisés (si tag existe)
    const isFlying = (target as any).isFlying || false;
    if (isFlying) {
      console.log(`🛡️ ${target.name} ne peut pas être enraciné (Flying)`);
      return false;
    }
    
    // Les boss ont 30% de résistance (moins restrictif que stun/freeze)
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.3; // 30%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste à l'enracinement (Boss resistance)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const rootEffect = new RootEffect();

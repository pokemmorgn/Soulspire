// server/src/gameplay/effects/control/disarm.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Disarm (Désarmement)
 * - Impossible d'attaquer (attaque basique bloquée)
 * - Peut lancer des sorts et ultimates normalement
 * - Inverse de Silence (bloque attaques, permet sorts)
 * - Non stackable
 * - Durée courte (2 tours)
 * - Les héros DPS Melee ont 30% de résistance
 */
export class DisarmEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "disarm",
      name: "Désarmé",
      description: "Impossible d'attaquer - Sorts uniquement",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 2
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "disarmed" aux debuffs
    if (!target.status.debuffs.includes("disarmed")) {
      target.status.debuffs.push("disarmed");
    }
    
    return {
      message: `⚔️ ${target.name} est désarmé et ne peut plus attaquer !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le disarm n'a pas d'effet par tour (pas de dégâts)
    // L'effet bloque les attaques basiques mais pas les sorts
    
    return {
      message: `⚔️ ${target.name} est toujours désarmé...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "disarmed" des debuffs
    const index = target.status.debuffs.indexOf("disarmed");
    if (index > -1) {
      target.status.debuffs.splice(index, 1);
    }
    
    return {
      message: `⚔️ ${target.name} récupère son arme`
    };
  }
  
  // Vérifier si la cible peut être désarmée
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Les héros DPS Melee ont 30% de résistance (leur arme est leur vie)
    if (target.role === "DPS Melee") {
      const resistanceChance = 0.3; // 30%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au désarmement (Melee DPS resistance)`);
        return false;
      }
    }
    
    // Les Tanks ont 20% de résistance (maîtrisent leur arme)
    if (target.role === "Tank") {
      const resistanceChance = 0.2; // 20%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste au désarmement (Tank resistance)`);
        return false;
      }
    }
    
    // Les boss ont 35% de résistance
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.35; // 35%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste au désarmement (Boss resistance)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const disarmEffect = new DisarmEffect();

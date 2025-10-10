// server/src/gameplay/effects/control/fear.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Fear (Peur/Terreur)
 * - Empêche toute action (comme Stun)
 * - Le participant "fuit" et ne peut rien faire
 * - Non stackable
 * - Durée très courte (1-2 tours)
 * - Les Tanks ont 40% de résistance (courageux)
 * - Les boss ont 60% de résistance (intimidants)
 */
export class FearEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "fear",
      name: "Terrifié",
      description: "Empêche toute action par la terreur",
      type: "control",
      category: "crowd_control",
      stackable: false,
      maxStacks: 1,
      baseDuration: 1
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    // Ajouter "feared" aux debuffs
    if (!target.status.debuffs.includes("feared")) {
      target.status.debuffs.push("feared");
    }
    
    return {
      message: `😱 ${target.name} est terrifié et tente de fuir !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Le fear n'a pas d'effet par tour (pas de dégâts)
    // L'effet est géré dans BattleEngine.isControlled()
    
    return {
      message: `😱 ${target.name} est toujours pris de panique...`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer "feared" des debuffs
    const index = target.status.debuffs.indexOf("feared");
    if (index > -1) {
      target.status.debuffs.splice(index, 1);
    }
    
    return {
      message: `💪 ${target.name} surmonte sa peur`
    };
  }
  
  // Vérifier si la cible peut être terrifiée
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Immunité aux CC
    if (target.status.buffs.includes("immunity") || target.status.buffs.includes("cc_immunity")) {
      console.log(`🛡️ ${target.name} est immunisé au contrôle`);
      return false;
    }
    
    // Immunité spécifique à la peur (héros courageux)
    if (target.status.buffs.includes("fearless") || target.status.buffs.includes("bravery")) {
      console.log(`🛡️ ${target.name} est sans peur`);
      return false;
    }
    
    // Les Tanks ont 40% de résistance (courageux, protègent l'équipe)
    if (target.role === "Tank") {
      const resistanceChance = 0.4; // 40%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste à la peur (Tank courage)`);
        return false;
      }
    }
    
    // Les héros Light ont 25% de résistance (lumière vs ténèbres)
    if (target.element === "Light") {
      const resistanceChance = 0.25; // 25%
      if (Math.random() < resistanceChance) {
        console.log(`🛡️ ${target.name} résiste à la peur (Light resistance)`);
        return false;
      }
    }
    
    // Les héros Dark sont plus sensibles à Fear (-20% résistance = +20% chance)
    // Pas de vérification ici, juste un bonus d'application côté lanceur
    
    // Les boss ont 60% de résistance (intimidants, pas facilement effrayés)
    const isBoss = (target as any).isBoss || false;
    if (isBoss) {
      const bossResistance = 0.6; // 60%
      if (Math.random() < bossResistance) {
        console.log(`🛡️ ${target.name} résiste à la peur (Boss intimidation)`);
        return false;
      }
    }
    
    return true;
  }
}

// Export de l'instance pour EffectManager
export const fearEffect = new FearEffect();

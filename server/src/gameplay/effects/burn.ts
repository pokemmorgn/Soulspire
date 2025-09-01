import { IBattleParticipant } from "../../models/Battle";

// Interface pour tous les effets (DOT, buff, debuff, etc.)
export interface IEffect {
  id: string;
  name: string;
  description: string;
  type: "dot" | "hot" | "buff" | "debuff" | "special";
  stackable: boolean;
  maxStacks: number;
  baseDuration: number;
  
  // Appliquer l'effet chaque tour
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult;
  
  // Quand l'effet est appliqué
  onApply?(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult;
  
  // Quand l'effet expire
  onRemove?(target: IBattleParticipant): EffectResult;
}

// Résultat de l'application d'un effet
export interface EffectResult {
  damage?: number;
  healing?: number;
  message?: string;
  additionalEffects?: string[]; // Autres effets à appliquer
  removeEffect?: boolean; // Si l'effet doit être retiré
}

// Classe de base pour tous les effets
export abstract class BaseEffect implements IEffect {
  public id: string;
  public name: string;
  public description: string;
  public type: "dot" | "hot" | "buff" | "debuff" | "special";
  public stackable: boolean;
  public maxStacks: number;
  public baseDuration: number;
  
  constructor(config: {
    id: string;
    name: string;
    description: string;
    type: "dot" | "hot" | "buff" | "debuff" | "special";
    stackable?: boolean;
    maxStacks?: number;
    baseDuration: number;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.type = config.type;
    this.stackable = config.stackable || false;
    this.maxStacks = config.maxStacks || 1;
    this.baseDuration = config.baseDuration;
  }
  
  abstract onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult;
  
  onApply?(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult;
  onRemove?(target: IBattleParticipant): EffectResult;
}

// === EFFET BURN ===
export class BurnEffect extends BaseEffect {
  constructor() {
    super({
      id: "burn",
      name: "Brûlure",
      description: "Inflige des dégâts de feu chaque tour",
      type: "dot",
      stackable: true,
      maxStacks: 5,
      baseDuration: 3
    });
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `${target.name} prend feu ! 🔥`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // Dégâts basés sur les HP max du target + stats du caster
    const baseDamage = Math.floor(target.stats.maxHp * 0.04); // 4% des HP max
    const casterBonus = Math.floor(((appliedBy.stats as any).intelligence || 70) * 0.1);
    
    // Multiplicateur par stack (1x, 1.5x, 2x, 2.5x, 3x)
    const stackMultiplier = 1 + (stacks - 1) * 0.5;
    
    const totalDamage = Math.floor((baseDamage + casterBonus) * stackMultiplier);
    
    // Résistance au feu (si le target est de l'élément feu)
    let finalDamage = totalDamage;
    if (target.element === "Fire") {
      finalDamage = Math.floor(finalDamage * 0.5); // 50% de résistance
    } else if (target.element === "Water") {
      finalDamage = Math.floor(finalDamage * 1.3); // 30% de vulnérabilité
    }
    
    // Minimum 1 dégât
    finalDamage = Math.max(1, finalDamage);
    
    return {
      damage: finalDamage,
      message: `${target.name} subit ${finalDamage} dégâts de brûlure 🔥 (${stacks} stack${stacks > 1 ? 's' : ''})`
    };
  }
  
  onRemove(target: IBattleParticipant): EffectResult {
    return {
      message: `La brûlure de ${target.name} s'éteint`
    };
  }
}

// === GESTIONNAIRE D'EFFETS ===
export class EffectManager {
  private static effects: Map<string, BaseEffect> = new Map();
  
  // Enregistrer tous les effets disponibles
  static initialize() {
    const burnEffect = new BurnEffect();
    this.effects.set(burnEffect.id, burnEffect);
    
    // TODO: Ajouter d'autres effets (poison, freeze, etc.)
    console.log(`✨ ${this.effects.size} effets enregistrés`);
  }
  
  // Récupérer un effet par son ID
  static getEffect(effectId: string): BaseEffect | undefined {
    return this.effects.get(effectId);
  }
  
  // Appliquer un effet à une cible
  static applyEffect(
    effectId: string,
    target: IBattleParticipant,
    appliedBy: IBattleParticipant,
    duration?: number,
    stacks: number = 1
  ): EffectResult | null {
    const effect = this.getEffect(effectId);
    if (!effect) {
      console.warn(`⚠️ Effet inconnu: ${effectId}`);
      return null;
    }
    
    // Vérifier si l'effet existe déjà sur la cible
    const existingEffect = this.getTargetEffect(target, effectId);
    
    if (existingEffect && effect.stackable) {
      // Augmenter les stacks
      existingEffect.stacks = Math.min(effect.maxStacks, existingEffect.stacks + stacks);
      existingEffect.duration = Math.max(existingEffect.duration, duration || effect.baseDuration);
      
      return {
        message: `${effect.name} renforcé sur ${target.name} (${existingEffect.stacks} stacks)`
      };
      
    } else if (!existingEffect) {
      // Appliquer un nouvel effet
      const newEffect: ActiveEffect = {
        id: effectId,
        stacks: stacks,
        duration: duration || effect.baseDuration,
        appliedBy: appliedBy
      };
      
      // Ajouter aux effets actifs du target
      if (!(target as any).activeEffects) {
        (target as any).activeEffects = [];
      }
      (target as any).activeEffects.push(newEffect);
      
      // Appeler onApply si défini
      return effect.onApply ? effect.onApply(target, appliedBy) : { message: `${effect.name} appliqué à ${target.name}` };
      
    } else {
      // Effet non stackable déjà présent, rafraîchir la durée
      existingEffect.duration = duration || effect.baseDuration;
      
      return {
        message: `${effect.name} rafraîchi sur ${target.name}`
      };
    }
  }
  
  // Traiter tous les effets actifs d'une cible (appelé chaque tour)
  static processEffects(target: IBattleParticipant): EffectResult[] {
    if (!(target as any).activeEffects) return [];
    
    const results: EffectResult[] = [];
    const activeEffects = (target as any).activeEffects as ActiveEffect[];
    
    // Traiter chaque effet
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const activeEffect = activeEffects[i];
      const effect = this.getEffect(activeEffect.id);
      
      if (!effect) {
        // Nettoyer les effets inconnus
        activeEffects.splice(i, 1);
        continue;
      }
      
      // Appliquer l'effet
      const result = effect.onTick(target, activeEffect.stacks, activeEffect.appliedBy);
      if (result.message || result.damage || result.healing) {
        results.push(result);
      }
      
      // Réduire la durée
      activeEffect.duration--;
      
      // Retirer l'effet si expiré
      if (activeEffect.duration <= 0 || result.removeEffect) {
        if (effect.onRemove) {
          const removeResult = effect.onRemove(target);
          if (removeResult.message) results.push(removeResult);
        }
        activeEffects.splice(i, 1);
      }
    }
    
    return results;
  }
  
  // Récupérer un effet actif spécifique d'une cible
  private static getTargetEffect(target: IBattleParticipant, effectId: string): ActiveEffect | undefined {
    if (!(target as any).activeEffects) return undefined;
    
    const activeEffects = (target as any).activeEffects as ActiveEffect[];
    return activeEffects.find(effect => effect.id === effectId);
  }
  
  // Retirer un effet spécifique d'une cible
  static removeEffect(target: IBattleParticipant, effectId: string): boolean {
    if (!(target as any).activeEffects) return false;
    
    const activeEffects = (target as any).activeEffects as ActiveEffect[];
    const index = activeEffects.findIndex(effect => effect.id === effectId);
    
    if (index !== -1) {
      const effect = this.getEffect(effectId);
      if (effect && effect.onRemove) {
        effect.onRemove(target);
      }
      activeEffects.splice(index, 1);
      return true;
    }
    
    return false;
  }
  
  // Nettoyer tous les effets d'une cible
  static clearAllEffects(target: IBattleParticipant) {
    if ((target as any).activeEffects) {
      (target as any).activeEffects = [];
    }
  }
}

// Interface pour les effets actifs sur un participant
interface ActiveEffect {
  id: string;
  stacks: number;
  duration: number;
  appliedBy: IBattleParticipant;
}

// Initialiser le gestionnaire d'effets
EffectManager.initialize();

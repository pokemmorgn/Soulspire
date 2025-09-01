import { IBattleParticipant } from "../models/Battle";

// Réexport des interfaces depuis burn.ts pour compatibilité
export { IEffect, EffectResult } from "./effects/burn";

// Interface pour les effets actifs sur un participant
interface ActiveEffect {
  id: string;
  stacks: number;
  duration: number;
  appliedBy: IBattleParticipant;
}

// === GESTIONNAIRE CENTRAL DES EFFETS ===
export class EffectManager {
  private static effects: Map<string, any> = new Map(); // any = IEffect mais évite les imports circulaires
  private static initialized: boolean = false;
  
  // Initialiser tous les effets disponibles
  static initialize() {
    if (this.initialized) return;
    
    console.log("✨ Initialisation du gestionnaire d'effets...");
    
    // Charger automatiquement tous les effets disponibles
    this.loadEffects();
    
    this.initialized = true;
    console.log(`✅ ${this.effects.size} effets chargés`);
  }
  
  // Charger tous les modules d'effets disponibles
  private static loadEffects() {
    try {
      // Import du module burn.ts
      const burnModule = require("./effects/burn");
      
      // Récupérer les effets exportés (BurnEffect, etc.)
      if (burnModule.BurnEffect) {
        const burnEffect = new burnModule.BurnEffect();
        this.registerEffect(burnEffect);
      }
      
      // TODO: Ajouter d'autres imports automatiques quand ils existent
      // const poisonModule = require("./effects/poison");
      // const stunModule = require("./effects/stun");
      // etc...
      
    } catch (error) {
      console.warn("⚠️ Erreur lors du chargement des effets:", error);
    }
  }
  
  // Enregistrer un effet
  private static registerEffect(effect: any) {
    this.effects.set(effect.id, effect);
    console.log(`🎭 Effet enregistré: ${effect.name} (${effect.id})`);
  }
  
  // Récupérer un effet par son ID
  static getEffect(effectId: string): any | undefined {
    if (!this.initialized) this.initialize();
    return this.effects.get(effectId);
  }
  
  // Récupérer tous les effets disponibles
  static getAllEffects(): any[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.effects.values());
  }
  
  // Appliquer un effet à une cible
  static applyEffect(
    effectId: string,
    target: IBattleParticipant,
    appliedBy: IBattleParticipant,
    duration?: number,
    stacks: number = 1
  ): any | null {
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
  static processEffects(target: IBattleParticipant): any[] {
    if (!(target as any).activeEffects) return [];
    
    const results: any[] = [];
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
  
  // Vérifier si une cible a un effet spécifique
  static hasEffect(target: IBattleParticipant, effectId: string): boolean {
    return this.getTargetEffect(target, effectId) !== undefined;
  }
  
  // Obtenir des statistiques sur les effets
  static getStats(): any {
    return {
      totalEffects: this.effects.size,
      availableEffects: Array.from(this.effects.keys())
    };
  }
  
  // Reset pour les tests
  static reset() {
    this.effects.clear();
    this.initialized = false;
  }
}

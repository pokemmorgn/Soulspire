// server/src/gameplay/EffectManager.ts
import { IBattleParticipant } from "../models/Battle";
import { BaseEffect, EffectResult } from "./effects/base/BaseEffect";
import { AutoEffectLoader } from "./effects/AutoEffectLoader";

// Réexport des interfaces pour compatibilité
export { IEffect, EffectResult } from "./effects/base/BaseEffect";

// Interface pour les effets actifs sur un participant
interface ActiveEffect {
  id: string;
  stacks: number;
  duration: number;
  appliedBy: IBattleParticipant;
  metadata?: any; // Données additionnelles (ex: Shield HP restants)
}

// === GESTIONNAIRE CENTRAL DES EFFETS ===
export class EffectManager {
  private static effects: Map<string, BaseEffect> = new Map();
  private static initialized: boolean = false;
  
  // Initialiser tous les effets disponibles avec auto-découverte
  static async initialize() {
    if (this.initialized) return;
    
    console.log("✨ Initialisation du gestionnaire d'effets avec auto-découverte...");
    
    // Auto-découverte et chargement de tous les effets
    await AutoEffectLoader.autoLoadEffects();
    
    // Copier les effets auto-chargés dans notre registre
    const autoLoadedEffects = AutoEffectLoader.getAllEffects();
    for (const effect of autoLoadedEffects) {
      this.effects.set(effect.id, effect);
    }
    
    this.initialized = true;
    console.log(`✅ ${this.effects.size} effets auto-chargés + gestionnaire initialisé`);
    
    // Validation en développement
    if (process.env.NODE_ENV === 'development') {
      AutoEffectLoader.validateLoadedEffects();
    }
    
    // Vérifier qu'au moins un effet a été chargé
    if (this.effects.size === 0) {
      console.warn("⚠️ ATTENTION: Aucun effet n'a pu être chargé par l'AutoEffectLoader !");
    }
  }
  
  // Récupérer un effet par son ID
  static getEffect(effectId: string): BaseEffect | undefined {
    if (!this.initialized) {
      console.warn("⚠️ EffectManager non initialisé - initialisation synchrone limitée");
      this.initialized = true;
    }
    return this.effects.get(effectId);
  }
  
  // Récupérer tous les effets disponibles
  static getAllEffects(): BaseEffect[] {
    if (!this.initialized) {
      console.warn("⚠️ EffectManager non initialisé");
    }
    return Array.from(this.effects.values());
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

    // Vérifier si l'effet peut être appliqué (immunités, résistances)
    if (effect.canApplyTo && !effect.canApplyTo(target, appliedBy)) {
      return {
        message: `🛡️ ${target.name} résiste à ${effect.name}`
      };
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
        appliedBy: appliedBy,
        metadata: {} // Initialiser metadata vide
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
  
  // Vérifier si une cible a un effet spécifique
  static hasEffect(target: IBattleParticipant, effectId: string): boolean {
    return this.getTargetEffect(target, effectId) !== undefined;
  }
  
  // Obtenir le nombre de stacks d'un effet
  static getEffectStacks(target: IBattleParticipant, effectId: string): number {
    const effect = this.getTargetEffect(target, effectId);
    return effect ? effect.stacks : 0;
  }
  
  // Obtenir les données d'un effet actif (incluant metadata)
  static getEffectData(target: IBattleParticipant, effectId: string): ActiveEffect | undefined {
    return this.getTargetEffect(target, effectId);
  }
  
  // Obtenir des statistiques sur les effets
  static getStats(): any {
    const baseStats = {
      totalEffects: this.effects.size,
      effectsByCategory: this.getEffectsByCategory()
    };

    // Ajouter les stats de l'auto-loader si disponible
    try {
      return {
        ...baseStats,
        autoLoaderStats: AutoEffectLoader.getStats()
      };
    } catch {
      return baseStats;
    }
  }
  
  private static getEffectsByCategory(): { [key: string]: number } {
    const categories: { [key: string]: number } = {};
    
    for (const effect of this.effects.values()) {
      categories[effect.type] = (categories[effect.type] || 0) + 1;
    }
    
    return categories;
  }
  
  // Reset pour les tests
  static reset() {
    this.effects.clear();
    this.initialized = false;
  }
  
  // === NOUVELLES MÉTHODES AVEC AUTO-LOADER ===
  
  // Rechargement à chaud des effets (développement)
  static async hotReload() {
    if (!this.initialized) return;
    
    try {
      console.log("🔄 Rechargement à chaud du système d'effets...");
      await AutoEffectLoader.hotReload();
      
      // Recharger dans notre registre
      this.effects.clear();
      const reloadedEffects = AutoEffectLoader.getAllEffects();
      for (const effect of reloadedEffects) {
        this.effects.set(effect.id, effect);
      }
      
      console.log(`🔥 ${this.effects.size} effets rechargés à chaud`);
    } catch (error) {
      console.error("❌ Erreur lors du rechargement à chaud:", error);
    }
  }
  
  // Obtenir effets par catégorie via auto-loader
  static getEffectsFromCategory(category: 'dot' | 'control' | 'debuff' | 'buff' | 'special'): BaseEffect[] {
    try {
      return AutoEffectLoader.getEffectsByCategory(category);
    } catch {
      // Fallback si auto-loader pas disponible
      return Array.from(this.effects.values()).filter(effect => effect.type === category);
    }
  }
  
  // Diagnostic du système d'effets
  static diagnose(): void {
    console.log("🔍 === DIAGNOSTIC SYSTÈME D'EFFETS ===");
    console.log(`📊 Effets chargés: ${this.effects.size}`);
    
    try {
      const stats = AutoEffectLoader.getStats();
      console.log("🎭 Répartition par catégorie:", stats.categories);
      console.log("✅ Validation:", AutoEffectLoader.validateLoadedEffects() ? "OK" : "ERREUR");
    } catch {
      console.log("📚 Mode manuel - auto-loader indisponible");
    }
  }
}

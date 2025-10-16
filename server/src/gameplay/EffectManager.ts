// server/src/gameplay/EffectManager.ts
import { IBattleParticipant } from "../models/Battle";
import { BaseEffect, EffectResult } from "./effects/base/BaseEffect";
import { AutoEffectLoader } from "./effects/AutoEffectLoader";

// Import des nouveaux ultimates pour les hooks
import { UnleashedBrazierSpell } from "./ultimates/UnleashedBrazierSpell";
import { VolcanicEruptionSpell } from "./ultimates/VolcanicEruptionSpell";

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
  
  // ✨ AMÉLIORÉ : Traiter tous les effets actifs avec auto-gestion des ultimates
  static processEffects(target: IBattleParticipant, battleContext?: any): EffectResult[] {
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
      
      // ✨ AUTO-GESTION : Hooks ultimates intégrés dans les effets
      const result = effect.onTick(target, activeEffect.stacks, activeEffect.appliedBy);
      
      // Hooks spéciaux pour ultimates avec contexte
      if (battleContext && activeEffect.metadata) {
        this.processUltimateHooks(target, activeEffect, battleContext, results);
      }
      
      if (result.message || result.damage || result.healing) {
        results.push(result);
      }
      
      // Réduire la durée
      activeEffect.duration--;
      
      // Retirer l'effet si expiré
      if (activeEffect.duration <= 0 || result.removeEffect) {
        
        // Hooks d'expiration pour ultimates
        if (battleContext && activeEffect.metadata) {
          this.processUltimateExpiration(target, activeEffect, battleContext, results);
        }
        
        if (effect.onRemove) {
          const removeResult = effect.onRemove(target);
          if (removeResult.message) results.push(removeResult);
        }
        activeEffects.splice(i, 1);
      }
    }
    
    return results;
  }
  
  // ✨ NOUVEAU : Auto-gestion des hooks ultimates (remplace les méthodes statiques)
  private static processUltimateHooks(
    target: IBattleParticipant, 
    activeEffect: ActiveEffect, 
    battleContext: any, 
    results: EffectResult[]
  ): void {
    try {
      switch (activeEffect.id) {
        case "volcanic_eruption":
          this.processVolcanicEruptionTick(target, activeEffect, battleContext, results);
          break;
        case "unleashed_brazier":
          // Le Brasier Déchaîné est géré via les buffs de combat dans BattleEngine
          break;
      }
    } catch (error) {
      console.error(`❌ Erreur processUltimateHooks (${activeEffect.id}):`, error);
    }
  }
  
  private static processUltimateExpiration(
    target: IBattleParticipant, 
    activeEffect: ActiveEffect, 
    battleContext: any, 
    results: EffectResult[]
  ): void {
    try {
      switch (activeEffect.id) {
        case "unleashed_brazier":
          this.processUnleashedBrazierExplosion(target, activeEffect, battleContext, results);
          break;
      }
    } catch (error) {
      console.error(`❌ Erreur processUltimateExpiration (${activeEffect.id}):`, error);
    }
  }
  
  // Geysers Éruption Primordiale
  private static processVolcanicEruptionTick(
    caster: IBattleParticipant,
    activeEffect: ActiveEffect,
    battleContext: any,
    results: EffectResult[]
  ): void {
    if (!activeEffect.metadata || !battleContext.allEnemies) return;
    
    const geyserDamage = activeEffect.metadata.geyserDamage || 0;
    const healingPerEnemy = activeEffect.metadata.healingPerEnemy || 0;
    const aliveEnemies = battleContext.allEnemies.filter((e: any) => e.status.alive);
    
    activeEffect.metadata.turnsActive = (activeEffect.metadata.turnsActive || 0) + 1;
    
    let totalDamage = 0;
    let totalHealing = 0;
    
    console.log(`🌋💥 Geysers de feu ! Tour ${activeEffect.metadata.turnsActive}`);
    
    // Dégâts AoE aux ennemis
    for (const enemy of aliveEnemies) {
      const defense = Math.floor(enemy.stats.def * 0.7); // Bypass partiel défense
      let finalDamage = Math.max(1, geyserDamage - Math.floor(defense / 2));
      
      // Avantage élémentaire
      if (caster.element === "Fire" && enemy.element === "Wind") {
        finalDamage = Math.floor(finalDamage * 1.3);
      }
      
      // Variation aléatoire réduite
      finalDamage = Math.floor(finalDamage * (0.95 + Math.random() * 0.1));
      
      enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
      totalDamage += finalDamage;
      
      console.log(`🌋🔥 ${enemy.name} subit ${finalDamage} dégâts de geyser`);
      
      if (enemy.currentHp === 0) {
        enemy.status.alive = false;
        console.log(`💀 ${enemy.name} est consumé par l'éruption !`);
      }
    }
    
    // Soins pour le caster
    if (aliveEnemies.length > 0) {
      const totalHealingAmount = healingPerEnemy * aliveEnemies.length;
      caster.currentHp = Math.min(caster.stats.maxHp, caster.currentHp + totalHealingAmount);
      totalHealing = totalHealingAmount;
      
      console.log(`🌋💚 ${caster.name} se soigne de ${totalHealingAmount} HP (${aliveEnemies.length} ennemis)`);
    }
    
    if (totalDamage > 0 || totalHealing > 0) {
      results.push({
        damage: 0, // Déjà appliqué
        healing: 0, // Déjà appliqué
        message: `🌋💥 Geysers volcanique : ${totalDamage} dégâts AoE, ${totalHealing} HP récupérés`
      });
    }
  }
  
  // Explosion finale Brasier Déchaîné
  private static processUnleashedBrazierExplosion(
    caster: IBattleParticipant,
    activeEffect: ActiveEffect,
    battleContext: any,
    results: EffectResult[]
  ): void {
    if (!activeEffect.metadata || !battleContext.allEnemies) return;
    
    const explosionDamage = activeEffect.metadata.explosionDamage || 0;
    const aliveEnemies = battleContext.allEnemies.filter((e: any) => e.status.alive);
    
    console.log(`🔥💥 EXPLOSION FINALE ! ${caster.name} libère ${explosionDamage} dégâts AoE massifs`);
    
    for (const enemy of aliveEnemies) {
      const defense = enemy.stats.def;
      let finalDamage = Math.max(1, explosionDamage - Math.floor(defense / 3));
      
      // Avantage élémentaire
      if (caster.element === "Fire" && enemy.element === "Wind") {
        finalDamage = Math.floor(finalDamage * 1.5);
      }
      
      // Variation aléatoire
      finalDamage = Math.floor(finalDamage * (0.9 + Math.random() * 0.2));
      
      enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
      console.log(`🔥💥 ${enemy.name} subit ${finalDamage} dégâts de l'explosion finale`);
      
      if (enemy.currentHp === 0) {
        enemy.status.alive = false;
        console.log(`💀 ${enemy.name} est anéanti par l'explosion !`);
      }
    }
    
    results.push({
      damage: 0, // Déjà appliqué
      message: `🔥💥 EXPLOSION FINALE ! Brasier Déchaîné explose avec ${explosionDamage} dégâts !`
    });
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
  
  // ✨ AMÉLIORÉ : Hooks unifiés pour BattleEngine (remplacent les méthodes statiques)
  
  /**
   * Vérifier protection globale sur dégâts reçus (Éruption Primordiale + autres)
   */
  static applyGlobalProtection(defender: IBattleParticipant, incomingDamage: number): number {
    if (incomingDamage <= 0) return incomingDamage;
    
    let damage = incomingDamage;
    
    // Éruption Primordiale
    const volcanicEffect = this.getEffectData(defender, "volcanic_eruption");
    if (volcanicEffect?.metadata?.damageReduction) {
      const reduction = volcanicEffect.metadata.damageReduction;
      damage = Math.floor(damage * (1 - reduction / 100));
      console.log(`🌋🛡️ Éruption Primordiale: -${reduction}% dégâts (${incomingDamage} → ${damage})`);
    }
    
    return Math.max(1, damage);
  }
  
  /**
   * Appliquer vol de vie post-dégâts (Brasier Déchaîné + autres)
   */
  static applyPostDamageEffects(attacker: IBattleParticipant, damageDealt: number): number {
    if (damageDealt <= 0) return 0;
    
    let totalHealing = 0;
    
    // Brasier Déchaîné - Vol de vie
    const brazierEffect = this.getEffectData(attacker, "unleashed_brazier");
    if (brazierEffect?.metadata?.lifeStealBonus) {
      const lifeStealPercent = brazierEffect.metadata.lifeStealBonus;
      const healingAmount = Math.floor(damageDealt * (lifeStealPercent / 100));
      
      if (healingAmount > 0) {
        attacker.currentHp = Math.min(attacker.stats.maxHp, attacker.currentHp + healingAmount);
        totalHealing += healingAmount;
        console.log(`🔥🩸 ${attacker.name} récupère ${healingAmount} HP via vol de vie (${lifeStealPercent}%)`);
      }
    }
    
    return totalHealing;
  }
  
  /**
   * Vérifier si les attaques doivent être AoE (Brasier Déchaîné)
   */
  static shouldAttackBeAoE(attacker: IBattleParticipant): boolean {
    const brazierEffect = this.getEffectData(attacker, "unleashed_brazier");
    return brazierEffect?.metadata?.aoeAttacks === true;
  }
  
  /**
   * Vérifier immunité contrôles globale
   */
  static hasControlImmunity(participant: IBattleParticipant): boolean {
    // Éruption Primordiale
    if (this.hasEffect(participant, "volcanic_eruption")) return true;
    
    // Autres sources d'immunité
    if (participant.status.buffs.includes("cc_immunity")) return true;
    
    return false;
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

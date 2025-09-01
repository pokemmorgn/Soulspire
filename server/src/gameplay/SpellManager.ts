import { BaseSpell } from "./base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../models/Battle";
import { EffectManager } from "./effects/burn";

// Imports des sorts - Déclaration temporaire pour éviter les erreurs de compilation
// import { fireballSpell } from "./actives/fireball";

// Interface pour les cooldowns actifs
interface SpellCooldown {
  spellId: string;
  remainingTurns: number;
  heroId: string;
}

// Interface pour les sorts équipés sur un héros
export interface HeroSpells {
  spell1?: { id: string; level: number };
  spell2?: { id: string; level: number };
  spell3?: { id: string; level: number };
  ultimate?: { id: string; level: number };
  passive?: { id: string; level: number };
}

export class SpellManager {
  private static spells: Map<string, BaseSpell> = new Map();
  private static cooldowns: SpellCooldown[] = [];
  private static initialized: boolean = false;

  // Initialiser tous les sorts du jeu
  static async initialize() {
    if (this.initialized) return;

    console.log("🧙‍♂️ Initialisation du SpellManager avec auto-découverte...");

    // Auto-découverte et chargement de tous les sorts
    await AutoSpellLoader.autoLoadSpells();
    
    // Copier les sorts auto-chargés dans notre registre
    const autoLoadedSpells = AutoSpellLoader.getAllSpells();
    for (const spell of autoLoadedSpells) {
      this.spells.set(spell.config.id, spell);
    }

    // Initialiser le gestionnaire d'effets
    EffectManager.initialize();

    this.initialized = true;
    console.log(`✨ ${this.spells.size} sorts auto-chargés + effets initialisés`);
    
    // Validation optionnelle
    if (process.env.NODE_ENV === 'development') {
      AutoSpellLoader.validateLoadedSpells();
    }
  }

  // Enregistrer un sort
  private static registerSpell(spell: BaseSpell) {
    this.spells.set(spell.config.id, spell);
    console.log(`📜 Sort enregistré: ${spell.config.name} (${spell.config.id})`);
  }

  // Récupérer un sort par son ID
  static getSpell(spellId: string): BaseSpell | undefined {
    if (!this.initialized) this.initialize();
    return this.spells.get(spellId);
  }

  // Récupérer tous les sorts disponibles
  static getAllSpells(): BaseSpell[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.spells.values());
  }

  // Lancer un sort
  static castSpell(
    spellId: string,
    caster: IBattleParticipant,
    targets: IBattleParticipant[],
    spellLevel: number,
    battleContext?: any
  ): IBattleAction {
    const spell = this.getSpell(spellId);
    if (!spell) {
      throw new Error(`Sort inconnu: ${spellId}`);
    }

    // Vérifier si le sort peut être lancé
    if (!spell.canCast(caster, spellLevel)) {
      throw new Error(`${caster.name} ne peut pas lancer ${spell.config.name}`);
    }

    // Vérifier le cooldown
    if (this.isOnCooldown(caster.heroId, spellId)) {
      const remaining = this.getCooldownRemaining(caster.heroId, spellId);
      throw new Error(`${spell.config.name} est en cooldown (${remaining} tours restants)`);
    }

    // Sélectionner les cibles si nécessaire
    const finalTargets = targets.length > 0 ? targets : 
      spell.selectTargets(caster, 
        battleContext?.allPlayers || [], 
        battleContext?.allEnemies || []
      );

    // Exécuter le sort
    const action = spell.execute(caster, finalTargets, spellLevel, battleContext);

    // Appliquer le cooldown
    if (spell.config.type === "active") {
      const effectiveCooldown = spell.getEffectiveCooldown(caster, spellLevel);
      this.setCooldown(caster.heroId, spellId, effectiveCooldown);
    }

    console.log(`⚡ ${caster.name} lance ${spell.config.name} niveau ${spellLevel}`);

    return action;
  }

  // Déterminer le meilleur sort à utiliser pour un héros (IA)
  static determineBestSpell(
    caster: IBattleParticipant,
    heroSpells: HeroSpells,
    allPlayers: IBattleParticipant[],
    allEnemies: IBattleParticipant[],
    battleContext?: any
  ): { spellId: string; spellLevel: number; priority: number } | null {
    const availableSpells: Array<{ id: string; level: number; priority: number }> = [];

    // Vérifier l'ultimate en priorité si énergie = 100
    if (caster.energy >= 100 && heroSpells.ultimate) {
      const ultimateSpell = this.getSpell(heroSpells.ultimate.id);
      if (ultimateSpell && ultimateSpell.canCast(caster, heroSpells.ultimate.level)) {
        return {
          spellId: heroSpells.ultimate.id,
          spellLevel: heroSpells.ultimate.level,
          priority: 1000 // Priorité maximale
        };
      }
    }

    // Vérifier les sorts actifs
    [heroSpells.spell1, heroSpells.spell2, heroSpells.spell3].forEach((spellData, index) => {
      if (!spellData) return;

      const spell = this.getSpell(spellData.id);
      if (!spell) return;

      // Vérifier si le sort peut être utilisé
      if (!spell.canCast(caster, spellData.level)) return;
      if (this.isOnCooldown(caster.heroId, spellData.id)) return;

      // Calculer la priorité selon le contexte
      const priority = this.calculateSpellPriority(spell, caster, allPlayers, allEnemies, battleContext);
      
      availableSpells.push({
        id: spellData.id,
        level: spellData.level,
        priority
      });
    });

    // Retourner le sort avec la plus haute priorité
    if (availableSpells.length === 0) return null;

    const bestSpell = availableSpells.reduce((best, current) => 
      current.priority > best.priority ? current : best
    );

    return {
      spellId: bestSpell.id,
      spellLevel: bestSpell.level,
      priority: bestSpell.priority
    };
  }

  // Calculer la priorité d'un sort selon la situation
  private static calculateSpellPriority(
    spell: BaseSpell,
    caster: IBattleParticipant,
    allPlayers: IBattleParticipant[],
    allEnemies: IBattleParticipant[],
    battleContext?: any
  ): number {
    const isPlayerTeam = allPlayers.includes(caster);
    const allies = isPlayerTeam ? allPlayers : allEnemies;
    const enemies = isPlayerTeam ? allEnemies : allPlayers;

    let priority = 50; // Base

    // Priorité selon la catégorie du sort
    switch (spell.config.category) {
      case "damage":
        // Plus il y a d'ennemis vivants, plus c'est prioritaire
        priority += enemies.filter(e => e.status.alive).length * 10;
        // Bonus si des ennemis sont faibles
        const weakEnemies = enemies.filter(e => e.status.alive && (e.currentHp / e.stats.maxHp) < 0.3);
        priority += weakEnemies.length * 20;
        break;

      case "heal":
        // Plus il y a d'alliés blessés, plus c'est prioritaire
        const injuredAllies = allies.filter(a => a.status.alive && (a.currentHp / a.stats.maxHp) < 0.6);
        priority += injuredAllies.length * 25;
        
        // Très prioritaire si un allié est en danger critique
        const criticalAllies = allies.filter(a => a.status.alive && (a.currentHp / a.stats.maxHp) < 0.2);
        priority += criticalAllies.length * 50;
        break;

      case "buff":
        // Plus prioritaire en début de combat
        priority += Math.max(0, 30 - (battleContext?.currentTurn || 0) * 2);
        break;

      case "debuff":
      case "control":
        // Prioritaire contre les ennemis dangereux
        const dangerousEnemies = enemies.filter(e => 
          e.status.alive && (e.role.includes("DPS") || e.role === "Support")
        );
        priority += dangerousEnemies.length * 15;
        break;
    }

    // Bonus selon le coût en énergie (sorts moins chers = plus prioritaires)
    priority += Math.max(0, 60 - spell.getEnergyCost(1));

    // Bonus élémentaire
    const hasAdvantage = enemies.some(e => 
      spell.config.element && this.hasElementalAdvantage(spell.config.element, e.element)
    );
    if (hasAdvantage) priority += 15;

    return Math.max(0, priority);
  }

  // === GESTION DES COOLDOWNS ===

  // Définir un cooldown
  private static setCooldown(heroId: string, spellId: string, turns: number) {
    // Retirer l'ancien cooldown s'il existe
    this.cooldowns = this.cooldowns.filter(cd => 
      !(cd.heroId === heroId && cd.spellId === spellId)
    );

    // Ajouter le nouveau
    if (turns > 0) {
      this.cooldowns.push({
        heroId,
        spellId,
        remainingTurns: turns
      });
    }
  }

  // Vérifier si un sort est en cooldown
  static isOnCooldown(heroId: string, spellId: string): boolean {
    return this.cooldowns.some(cd => 
      cd.heroId === heroId && cd.spellId === spellId && cd.remainingTurns > 0
    );
  }

  // Récupérer le temps de cooldown restant
  static getCooldownRemaining(heroId: string, spellId: string): number {
    const cooldown = this.cooldowns.find(cd => 
      cd.heroId === heroId && cd.spellId === spellId
    );
    return cooldown ? cooldown.remainingTurns : 0;
  }

  // Réduire tous les cooldowns (appelé à chaque tour)
  static reduceCooldowns() {
    for (let i = this.cooldowns.length - 1; i >= 0; i--) {
      const cooldown = this.cooldowns[i];
      cooldown.remainingTurns--;

      if (cooldown.remainingTurns <= 0) {
        this.cooldowns.splice(i, 1);
      }
    }
  }

  // Récupérer tous les cooldowns d'un héros
  static getHeroCooldowns(heroId: string): SpellCooldown[] {
    return this.cooldowns.filter(cd => cd.heroId === heroId);
  }

  // Nettoyer les cooldowns d'un héros (quand il meurt)
  static clearHeroCooldowns(heroId: string) {
    this.cooldowns = this.cooldowns.filter(cd => cd.heroId !== heroId);
  }

  // === UTILITAIRES ===

  // Vérifier l'avantage élémentaire
  private static hasElementalAdvantage(spellElement: string, targetElement: string): boolean {
    const advantages: { [key: string]: string[] } = {
      Fire: ["Wind"],
      Water: ["Fire"],
      Wind: ["Electric"],
      Electric: ["Water"],
      Light: ["Dark"],
      Dark: ["Light"]
    };

    return advantages[spellElement]?.includes(targetElement) || false;
  }

  // Obtenir des statistiques sur les sorts
  static getSpellStats(): any {
    return {
      totalSpells: this.spells.size,
      activeCooldowns: this.cooldowns.length,
      autoLoaderStats: AutoSpellLoader.getStats(),
      spellsByCategory: this.getSpellsByCategory(),
      spellsByElement: this.getSpellsByElement()
    };
  }

  private static getSpellsByCategory(): { [key: string]: number } {
    const categories: { [key: string]: number } = {};
    
    for (const spell of this.spells.values()) {
      categories[spell.config.category] = (categories[spell.config.category] || 0) + 1;
    }
    
    return categories;
  }

  private static getSpellsByElement(): { [key: string]: number } {
    const elements: { [key: string]: number } = {};
    
    for (const spell of this.spells.values()) {
      if (spell.config.element) {
        elements[spell.config.element] = (elements[spell.config.element] || 0) + 1;
      }
    }
    
    return elements;
  }

  // Reset complet (pour les tests)
  static reset() {
    this.spells.clear();
    this.cooldowns = [];
    this.initialized = false;
  }
  
  // NOUVELLES méthodes avec auto-loader
  
  // Rechargement à chaud des sorts (développement)
  static async hotReload() {
    console.log("🔄 Rechargement à chaud du système de sorts...");
    await AutoSpellLoader.hotReload();
    
    // Recharger dans notre registre
    this.spells.clear();
    const reloadedSpells = AutoSpellLoader.getAllSpells();
    for (const spell of reloadedSpells) {
      this.spells.set(spell.config.id, spell);
    }
    
    console.log(`🔥 ${this.spells.size} sorts rechargés à chaud`);
  }
  
  // Obtenir sorts par catégorie via auto-loader
  static getSpellsFromCategory(category: 'active' | 'ultimate' | 'passive' | 'utility'): BaseSpell[] {
    return AutoSpellLoader.getSpellsByCategory(category);
  }
  
  // Diagnostic du système de sorts
  static diagnose(): void {
    console.log("🔍 === DIAGNOSTIC SYSTÈME DE SORTS ===");
    console.log(`📊 Sorts chargés: ${this.spells.size}`);
    console.log(`⏰ Cooldowns actifs: ${this.cooldowns.length}`);
    
    const stats = AutoSpellLoader.getStats();
    console.log("🔮 Répartition par catégorie:", stats.categories);
    console.log("✅ Validation:", AutoSpellLoader.validateLoadedSpells() ? "OK" : "ERREUR");
    
    // Afficher les sorts manquants par héros (si applicable)
    this.checkForMissingSpells();
  }
  
  private static checkForMissingSpells(): void {
    const requiredSpells = [
      'fireball', 'heal', 'shield', 'lightning_bolt', 
      'ice_shard', 'wind_slash', 'holy_light', 'dark_bolt'
    ];
    
    const missingSpells = requiredSpells.filter(id => !this.spells.has(id));
    
    if (missingSpells.length > 0) {
      console.warn("⚠️ Sorts manquants:", missingSpells);
      console.log("💡 Créez ces fichiers dans gameplay/actives/ pour compléter le système");
    }
  }
}

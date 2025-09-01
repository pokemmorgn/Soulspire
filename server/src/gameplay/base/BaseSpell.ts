import { IBattleParticipant, IBattleAction } from "../../models/Battle";

// Types de sorts
export type SpellType = "active" | "ultimate" | "passive";
export type SpellCategory = "damage" | "heal" | "buff" | "debuff" | "control" | "utility";
export type TargetType = "single_enemy" | "all_enemies" | "single_ally" | "all_allies" | "self" | "all";

// Interface pour les effets de sort
export interface ISpellEffect {
  type: "damage" | "heal" | "dot" | "hot" | "buff" | "debuff" | "special";
  value: number;
  duration?: number; // En tours
  stackable?: boolean;
  elementalType?: string;
}

// Interface pour la configuration d'un sort
export interface ISpellConfig {
  id: string;
  name: string;
  description: string;
  type: SpellType;
  category: SpellCategory;
  targetType: TargetType;
  
  // Coûts et cooldowns
  energyCost: number;
  baseCooldown: number;
  
  // Scaling par niveau
  maxLevel: number;
  scalingType: "linear" | "exponential" | "custom";
  
  // Éléments et conditions
  element?: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  requiresRole?: string[];
  
  // Animation et effets visuels
  animationType?: string;
  soundEffect?: string;
}

// Interface principale pour tous les sorts
export abstract class BaseSpell {
  public config: ISpellConfig;
  
  constructor(config: ISpellConfig) {
    this.config = config;
  }
  
  // Méthode principale : exécuter le sort
  abstract execute(
    caster: IBattleParticipant,
    targets: IBattleParticipant[],
    spellLevel: number,
    battleContext?: any
  ): IBattleAction;
  
  // Vérifier si le sort peut être lancé
  canCast(caster: IBattleParticipant, spellLevel: number): boolean {
    // Vérifications de base
    if (!caster.status.alive) return false;
    if (caster.energy < this.getEnergyCost(spellLevel)) return false;
    
    // Vérifications spécialisées (override dans les classes filles)
    return this.additionalCanCastChecks(caster, spellLevel);
  }
  
  // Vérifications supplémentaires (à override)
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    return true;
  }
  
  // Calculer le coût en énergie selon le niveau
  getEnergyCost(spellLevel: number): number {
    const baseEnergy = this.config.energyCost;
    return Math.floor(baseEnergy * (1 + (spellLevel - 1) * 0.1));
  }
  
  // Calculer le cooldown effectif
  getEffectiveCooldown(caster: IBattleParticipant, spellLevel: number): number {
    const baseCooldown = this.config.baseCooldown;
    const reductionPercent = ((caster.stats as any).reductionCooldown || 0) / 100;
    
    return Math.max(1, Math.ceil(baseCooldown * (1 - reductionPercent)));
  }
  
  // Sélectionner les cibles selon le type de sort
  selectTargets(
    caster: IBattleParticipant,
    allPlayers: IBattleParticipant[],
    allEnemies: IBattleParticipant[],
    specificTarget?: IBattleParticipant
  ): IBattleParticipant[] {
    const isPlayerTeam = allPlayers.includes(caster);
    const allies = isPlayerTeam ? allPlayers : allEnemies;
    const enemies = isPlayerTeam ? allEnemies : allPlayers;
    
    switch (this.config.targetType) {
      case "single_enemy":
        return specificTarget && enemies.includes(specificTarget) 
          ? [specificTarget] 
          : [this.selectOptimalTarget(enemies, "enemy")];
          
      case "all_enemies":
        return enemies.filter(e => e.status.alive);
        
      case "single_ally":
        return specificTarget && allies.includes(specificTarget) 
          ? [specificTarget] 
          : [this.selectOptimalTarget(allies, "ally")];
          
      case "all_allies":
        return allies.filter(a => a.status.alive);
        
      case "self":
        return [caster];
        
      case "all":
        return [...allies, ...enemies].filter(p => p.status.alive);
        
      default:
        return [];
    }
  }
  
  // Sélection intelligente de cible
  private selectOptimalTarget(
    candidates: IBattleParticipant[], 
    targetType: "ally" | "enemy"
  ): IBattleParticipant {
    const aliveCandidates = candidates.filter(c => c.status.alive);
    if (aliveCandidates.length === 0) return candidates[0]; // Fallback
    if (aliveCandidates.length === 1) return aliveCandidates[0];
    
    if (targetType === "enemy") {
      // Pour les ennemis : prioriser les supports, puis les DPS fragiles
      const supports = aliveCandidates.filter(c => c.role === "Support");
      if (supports.length > 0) return supports[0];
      
      const dpsRanged = aliveCandidates.filter(c => c.role === "DPS Ranged");
      if (dpsRanged.length > 0) return dpsRanged[0];
      
      // Sinon, le plus faible en HP relatif
      return aliveCandidates.reduce((weakest, current) => 
        (current.currentHp / current.stats.maxHp) < (weakest.currentHp / weakest.stats.maxHp) 
          ? current : weakest
      );
    } else {
      // Pour les alliés : prioriser celui qui a le moins de HP relatif
      return aliveCandidates.reduce((mostInjured, current) => 
        (current.currentHp / current.stats.maxHp) < (mostInjured.currentHp / mostInjured.stats.maxHp) 
          ? current : mostInjured
      );
    }
  }
  
  // Calculer les dégâts avec scaling
  protected calculateDamage(
    caster: IBattleParticipant,
    target: IBattleParticipant,
    baseDamage: number,
    spellLevel: number,
    damageType: "physical" | "magical" = "magical"
  ): number {
    const casterStats = caster.stats as any;
    const targetStats = target.stats as any;
    
    // Attaque de base + scaling par niveau
    let totalAttack = baseDamage * (1 + (spellLevel - 1) * 0.2);
    
    // Ajouter les stats du caster
    if (damageType === "magical") {
      totalAttack += (casterStats.intelligence || 70) * 0.5;
      totalAttack += casterStats.atk * 0.8;
    } else {
      totalAttack += (casterStats.force || 80) * 0.6;
      totalAttack += casterStats.atk * 1.2;
    }
    
    // Défense du target
    const defense = damageType === "magical" 
      ? (targetStats.defMagique || targetStats.def * 0.8)
      : targetStats.def;
    
    // Calcul final
    let damage = Math.max(1, totalAttack - defense / 2);
    
    // Avantage élémentaire
    if (this.config.element) {
      damage *= this.getElementalAdvantage(this.config.element, target.element);
    }
    
    // Multiplicateur de rareté du caster
    damage *= this.getRarityMultiplier(caster.rarity);
    
    // Variation aléatoire
    damage *= (0.9 + Math.random() * 0.2);
    
    return Math.floor(damage);
  }
  
  // Calculer les soins avec scaling
  protected calculateHealing(
    caster: IBattleParticipant,
    target: IBattleParticipant,
    baseHealing: number,
    spellLevel: number
  ): number {
    const casterStats = caster.stats as any;
    
    let totalHealing = baseHealing * (1 + (spellLevel - 1) * 0.25);
    
    // Bonus d'intelligence et d'attaque
    totalHealing += (casterStats.intelligence || 70) * 0.6;
    totalHealing += casterStats.atk * 0.4;
    
    // Multiplicateur de rareté
    totalHealing *= this.getRarityMultiplier(caster.rarity);
    
    // Variation aléatoire réduite pour les soins
    totalHealing *= (0.95 + Math.random() * 0.1);
    
    return Math.floor(totalHealing);
  }
  
  // Utilitaires
  private getElementalAdvantage(spellElement: string, targetElement: string): number {
    const advantages: { [key: string]: string[] } = {
      Fire: ["Wind"],
      Water: ["Fire"],
      Wind: ["Electric"],
      Electric: ["Water"],
      Light: ["Dark"],
      Dark: ["Light"]
    };
    
    if (advantages[spellElement]?.includes(targetElement)) return 1.5;
    if (advantages[targetElement]?.includes(spellElement)) return 0.75;
    return 1.0;
  }
  
  private getRarityMultiplier(rarity: string): number {
    const multipliers: { [key: string]: number } = {
      Common: 1.0,
      Rare: 1.15,
      Epic: 1.35,
      Legendary: 1.7
    };
    return multipliers[rarity] || 1.0;
  }
  
  // Créer une action de base
  protected createBaseAction(
    caster: IBattleParticipant,
    targets: IBattleParticipant[],
    actionType: "attack" | "skill" | "ultimate",
    turn: number
  ): IBattleAction {
    return {
      turn,
      actionType,
      actorId: caster.heroId,
      actorName: caster.name,
      targetIds: targets.map(t => t.heroId),
      critical: false,
      elementalAdvantage: 1.0,
      buffsApplied: [],
      debuffsApplied: [],
      participantsAfter: {}
    };
  }
}

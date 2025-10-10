// server/src/gameplay/effects/base/BaseEffect.ts
import { IBattleParticipant } from "../../../models/Battle";

// Types de base pour les effets
export type EffectType = "dot" | "hot" | "buff" | "debuff" | "control" | "special";
export type EffectCategory = 
  | "damage_over_time" 
  | "heal_over_time"
  | "stat_modifier"
  | "crowd_control"
  | "special_mechanic";

// Résultat de l'application d'un effet
export interface EffectResult {
  damage?: number;
  healing?: number;
  message?: string;
  additionalEffects?: string[]; // Autres effets à appliquer
  removeEffect?: boolean; // Si l'effet doit être retiré immédiatement
  statModifiers?: {
    atk?: number;
    def?: number;
    speed?: number;
    [key: string]: number | undefined;
  };
}

// Interface pour tous les effets
export interface IEffect {
  id: string;
  name: string;
  description: string;
  type: EffectType;
  category: EffectCategory;
  stackable: boolean;
  maxStacks: number;
  baseDuration: number;
  
  // Appliquer l'effet chaque tour
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult;
  
  // Quand l'effet est appliqué pour la première fois
  onApply?(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult;
  
  // Quand l'effet expire ou est retiré
  onRemove?(target: IBattleParticipant): EffectResult;
  
  // Vérifier si l'effet peut être appliqué (immunités, résistances)
  canApplyTo?(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean;
}

// Configuration pour créer un effet
export interface IEffectConfig {
  id: string;
  name: string;
  description: string;
  type: EffectType;
  category: EffectCategory;
  stackable?: boolean;
  maxStacks?: number;
  baseDuration: number;
}

// Classe de base abstraite pour tous les effets
export abstract class BaseEffect implements IEffect {
  public id: string;
  public name: string;
  public description: string;
  public type: EffectType;
  public category: EffectCategory;
  public stackable: boolean;
  public maxStacks: number;
  public baseDuration: number;
  
  constructor(config: IEffectConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.type = config.type;
    this.category = config.category;
    this.stackable = config.stackable !== undefined ? config.stackable : false;
    this.maxStacks = config.maxStacks || 1;
    this.baseDuration = config.baseDuration;
  }
  
  // Méthode abstraite : doit être implémentée par chaque effet
  abstract onTick(
    target: IBattleParticipant, 
    stacks: number, 
    appliedBy: IBattleParticipant
  ): EffectResult;
  
  // Méthodes optionnelles avec implémentation par défaut
  onApply?(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult;
  onRemove?(target: IBattleParticipant): EffectResult;
  
  // Vérification par défaut : toujours applicable
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Par défaut, tout le monde peut recevoir l'effet
    // Les classes enfants peuvent override pour ajouter des vérifications
    return true;
  }
  
  // Utilitaires pour les calculs
  protected calculateElementalResistance(
    target: IBattleParticipant, 
    effectElement?: string
  ): number {
    // Si l'effet a un élément, vérifier la résistance
    if (!effectElement) return 0;
    
    // Résistance élémentaire basique
    if (target.element === effectElement) {
      return 0.5; // 50% de résistance à son propre élément
    }
    
    // Avantage/désavantage élémentaire
    const weaknesses: { [key: string]: string[] } = {
      Fire: ["Water"],
      Water: ["Electric"],
      Electric: ["Wind"],
      Wind: ["Fire"],
      Light: ["Dark"],
      Dark: ["Light"]
    };
    
    if (weaknesses[target.element]?.includes(effectElement)) {
      return -0.3; // 30% plus vulnérable
    }
    
    return 0; // Neutre
  }
  
  protected getBaseDamageFromStats(
    target: IBattleParticipant,
    appliedBy: IBattleParticipant,
    percentOfMaxHp: number
  ): number {
    const maxHpDamage = Math.floor(target.stats.maxHp * percentOfMaxHp);
    const casterBonus = Math.floor(((appliedBy.stats as any).intelligence || 70) * 0.1);
    return maxHpDamage + casterBonus;
  }
}

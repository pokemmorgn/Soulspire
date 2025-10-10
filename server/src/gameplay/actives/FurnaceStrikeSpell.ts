// server/src/gameplay/actives/FurnaceStrikeSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Furnace Strike (Garde Incandescente) - Brakka
 * 
 * Description originale :
 * "Brakka lève son bouclier chauffé à blanc, réduisant les dégâts subis de 20% 
 * pendant 4 secondes. Les ennemis qui la frappent en mêlée subissent une brûlure 
 * légère, infligeant des dégâts de feu chaque seconde pendant 2 secondes."
 * 
 * Adaptation turn-based :
 * - Réduction de dégâts : 20% pendant 4 tours
 * - Contre-attaque : Brûlure (1 stack) sur attaquants mêlée pendant 2 tours
 * - Self-cast uniquement (Tank défensif)
 */
class FurnaceStrikeSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "furnace_strike",
      name: "Garde Incandescente",
      description: "Réduit les dégâts subis de 20% et brûle les attaquants en mêlée",
      type: "active",
      category: "buff",
      targetType: "self",
      
      energyCost: 30,
      baseCooldown: 8,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "shield_up",
      soundEffect: "furnace_strike_cast"
    };
    
    super(config);
  }
  
  execute(
    caster: IBattleParticipant,
    targets: IBattleParticipant[],
    spellLevel: number,
    battleContext?: any
  ): IBattleAction {
    const turn = battleContext?.currentTurn || 1;
    const action = this.createBaseAction(caster, [caster], "skill", turn);
    
    // Coût en énergie
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 5; // Petit gain pour sort défensif
    action.buffsApplied = [];
    
    // 1. Appliquer l'effet "Incandescent Guard" (réduction de dégâts)
    const duration = this.getGuardDuration(spellLevel);
    const damageReduction = this.getDamageReduction(spellLevel);
    
    const guardResult = EffectManager.applyEffect(
      "incandescent_guard", 
      caster, 
      caster, 
      duration
    );
    
    if (guardResult && guardResult.message) {
      console.log(`🔥 ${guardResult.message}`);
      action.buffsApplied.push("incandescent_guard");
    }
    
    // Stocker metadata pour la réduction de dégâts et contre-attaque
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "incandescent_guard"
    );
    
    if (activeEffect) {
      activeEffect.metadata = {
        damageReduction: damageReduction, // 20% de base
        counterBurnDuration: 2, // Durée de la brûlure contre-attaque
        counterBurnStacks: 1 // 1 stack de brûlure
      };
    }
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Durée de la garde
   * 4 secondes → 4 tours
   */
  private getGuardDuration(spellLevel: number): number {
    // Base 4 tours, +1 tous les 3 niveaux
    return Math.min(6, 4 + Math.floor((spellLevel - 1) / 3));
  }
  
  /**
   * Pourcentage de réduction de dégâts
   * Base 20%, scaling léger avec niveau
   */
  private getDamageReduction(spellLevel: number): number {
    // 20% base, +1% par niveau (max 29% au niveau 10)
    return Math.min(30, 20 + (spellLevel - 1));
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé si déjà actif (éviter stack)
    const activeEffects = (caster as any).activeEffects as any[];
    if (activeEffects) {
      const hasGuard = activeEffects.some((e: any) => e.id === "incandescent_guard");
      if (hasGuard) {
        console.log(`⚠️ ${caster.name} a déjà une Garde Incandescente active`);
        return false;
      }
    }
    
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    return true;
  }
}

// Exports
export const furnaceStrikeSpell = new FurnaceStrikeSpell();
export { FurnaceStrikeSpell };

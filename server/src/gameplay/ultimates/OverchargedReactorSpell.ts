// server/src/gameplay/ultimates/OverchargedReactorSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Réacteur Surchauffé - Albert (Rare Support)
 * 
 * Description originale :
 * "Albert surcharge ses mécanismes, amplifiant les effets de ses créations pendant 8 secondes.
 * Pendant cette durée :
 * - Tous les alliés gagnent 15% de bouclier supplémentaire sur leurs protections existantes.
 * - Les compétences d'Albert soignent 50% de plus.
 * - Ses tourelles attaquent plus vite."
 * 
 * Adaptation turn-based :
 * - Durée : 8 secondes → 8 tours
 * - Buff "overcharged" qui amplifie les effets d'Albert
 * - +15% bouclier sur boucliers existants
 * - +50% soins sur ses sorts
 * - Recharge : 20 tours
 * - Coût : 100 énergie
 */
class OverchargedReactorSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "overcharged_reactor",
      name: "Réacteur Surchauffé",
      description: "Amplifie les effets des mécanismes d'Albert",
      type: "ultimate",
      category: "utility",
      targetType: "self",
      
      energyCost: 100,
      baseCooldown: 20,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "reactor_overcharge",
      soundEffect: "overcharged_reactor_cast"
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
    const action = this.createBaseAction(caster, [caster], "ultimate", turn);
    
    // Coût en énergie
    action.energyCost = 100;
    action.energyGain = 0; // Ultimate ne génère pas d'énergie
    action.buffsApplied = [];
    
    const duration = this.getDuration(spellLevel);
    const shieldBonus = this.getShieldBonus(spellLevel);
    const healingBonus = this.getHealingBonus(spellLevel);
    
    // Créer un buff "overcharged" personnalisé
    // Note: On pourrait créer un effet dédié, mais pour simplifier on stocke dans un buff custom
    if (!caster.status.buffs.includes("overcharged")) {
      caster.status.buffs.push("overcharged");
      action.buffsApplied.push("overcharged");
    }
    
    // Stocker les métadonnées du buff dans les activeEffects
    // On crée un pseudo-effet pour tracker la durée et les bonus
    const overchargedEffect = {
      id: "overcharged_reactor",
      duration: duration,
      stacks: 1,
      appliedBy: caster,
      metadata: {
        shieldBonus: shieldBonus,    // +15%
        healingBonus: healingBonus,  // +50%
        turretSpeedBonus: 30         // +30% vitesse tourelle (flavor)
      }
    };
    
    // Ajouter aux effets actifs
    if (!(caster as any).activeEffects) {
      (caster as any).activeEffects = [];
    }
    (caster as any).activeEffects.push(overchargedEffect);
    
    // Amplifier les boucliers existants sur tous les alliés
    const isPlayerTeam = battleContext?.allPlayers?.includes(caster);
    const allies = isPlayerTeam ? battleContext?.allPlayers : battleContext?.allEnemies;
    
    if (allies && allies.length > 0) {
      for (const ally of allies) {
        if (!ally.status.alive) continue;
        
        // Vérifier si l'allié a un bouclier
        const shieldEffect = this.getShieldEffect(ally);
        if (shieldEffect && shieldEffect.metadata?.shieldHp) {
          const currentShieldHp = shieldEffect.metadata.shieldHp;
          const bonusShield = Math.floor(currentShieldHp * (shieldBonus / 100));
          shieldEffect.metadata.shieldHp = currentShieldHp + bonusShield;
          
          console.log(`🔧⚡ Bouclier de ${ally.name} amplifié : +${bonusShield} HP (${currentShieldHp} → ${shieldEffect.metadata.shieldHp})`);
        }
      }
    }
    
    console.log(`🔧⚡ Réacteur Surchauffé activé ! (Durée: ${duration} tours, Bonus: +${shieldBonus}% bouclier, +${healingBonus}% soins)`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Durée de l'effet
   * 8 secondes → 8 tours
   */
  private getDuration(spellLevel: number): number {
    // Base 8 tours, +1 tous les 5 niveaux
    return Math.min(10, 8 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Bonus de bouclier
   */
  private getShieldBonus(spellLevel: number): number {
    // 15% base, +2% par niveau (max 33% au niveau 10)
    return Math.min(35, 15 + (spellLevel - 1) * 2);
  }
  
  /**
   * Bonus de soins
   */
  private getHealingBonus(spellLevel: number): number {
    // 50% base, +3% par niveau (max 77% au niveau 10)
    return Math.min(80, 50 + (spellLevel - 1) * 3);
  }
  
  /**
   * Obtenir l'effet bouclier d'un allié
   */
  private getShieldEffect(ally: IBattleParticipant): any {
    const activeEffects = (ally as any).activeEffects as any[];
    if (!activeEffects) return null;
    
    return activeEffects.find((effect: any) => effect.id === "shield");
  }
  
  /**
   * Vérifier si Albert a le buff Overcharged actif
   * Méthode statique pour être utilisée dans d'autres sorts d'Albert
   */
  static isOvercharged(caster: IBattleParticipant): boolean {
    const activeEffects = (caster as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === "overcharged_reactor");
  }
  
  /**
   * Obtenir le bonus de soins actif
   */
  static getHealingBonus(caster: IBattleParticipant): number {
    const activeEffects = (caster as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const overchargedEffect = activeEffects.find((effect: any) => effect.id === "overcharged_reactor");
    if (!overchargedEffect || !overchargedEffect.metadata) return 0;
    
    return overchargedEffect.metadata.healingBonus || 0;
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    // Vérifier énergie
    if (caster.energy < 100) {
      console.log(`⚠️ ${caster.name} n'a pas assez d'énergie pour Réacteur Surchauffé (${caster.energy}/100)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const overchargedReactorSpell = new OverchargedReactorSpell();
export { OverchargedReactorSpell };

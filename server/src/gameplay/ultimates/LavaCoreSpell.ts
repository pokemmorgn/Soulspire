// server/src/gameplay/ultimates/LavaCoreSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Cœur de Lave - Korran (Rare Tank)
 * 
 * Description originale :
 * "Korran canalise l'énergie de la terre en fusion. Pendant 6 secondes, 
 * il devient insensible aux contrôles et gagne un bouclier équivalant à 20% de ses PV max.
 * À la fin de la durée, le bouclier explose, infligeant des dégâts de feu modérés 
 * à tous les ennemis proches."
 * 
 * Adaptation turn-based :
 * - Durée : 6 secondes → 6 tours
 * - Bouclier : 20% HP max
 * - CC Immunity : Buff temporaire
 * - Explosion finale : Dégâts AoE modérés
 * - Recharge : 20 secondes → 20 tours
 * - Coût : 100 énergie
 */
class LavaCoreSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "lava_core",
      name: "Cœur de Lave",
      description: "Bouclier + immunité contrôle, explose en fin de durée",
      type: "ultimate",
      category: "utility",
      targetType: "self",
      
      energyCost: 100,
      baseCooldown: 20,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "lava_shield",
      soundEffect: "lava_core_cast"
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
    action.debuffsApplied = [];
    
    // 1. Calculer le bouclier (20% HP max)
    const shieldHp = this.getShieldAmount(caster, spellLevel);
    const duration = this.getEffectDuration(spellLevel);
    
    // 2. Appliquer le bouclier
    const shieldResult = EffectManager.applyEffect(
      "shield",
      caster,
      caster,
      duration
    );
    
    if (shieldResult && shieldResult.message) {
      console.log(`🌋 ${shieldResult.message}`);
      action.buffsApplied.push("shield");
    }
    
    // Définir les HP du bouclier
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "shield"
    );
    
    if (activeEffect) {
      activeEffect.metadata = { 
        shieldHp,
        isLavaCore: true, // Marquer pour l'explosion finale
        explosionDamage: this.getExplosionDamage(caster, spellLevel)
      };
    }
    
    // 3. Appliquer l'immunité aux contrôles
    // Note: On pourrait créer un effet "cc_immunity" dédié
    // Pour l'instant, on ajoute juste au status
    if (!caster.status.buffs.includes("cc_immunity")) {
      caster.status.buffs.push("cc_immunity");
      action.buffsApplied.push("cc_immunity");
    }
    
    // 4. Planifier l'explosion finale
    // Note: L'explosion sera gérée dans BattleEngine quand le shield expire
    // On stocke les infos dans metadata
    
    console.log(`🌋 ${caster.name} active Cœur de Lave ! (Bouclier: ${shieldHp} HP, Durée: ${duration} tours)`);
    
    return action;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Montant du bouclier
   * Base 20% HP max, scaling avec niveau
   */
  private getShieldAmount(caster: IBattleParticipant, spellLevel: number): number {
    // 20% base, +2% par niveau (max 38% au niveau 10)
    const percent = Math.min(40, 20 + (spellLevel - 1) * 2);
    return Math.floor(caster.stats.maxHp * (percent / 100));
  }
  
  /**
   * Durée de l'effet
   * 6 secondes → 6 tours
   */
  private getEffectDuration(spellLevel: number): number {
    // Base 6 tours, +1 tous les 5 niveaux
    return Math.min(8, 6 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Dégâts de l'explosion finale
   * Dégâts modérés AoE
   */
  private getExplosionDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts modérés : niveau 1: 150 → niveau 10: 350
    const baseDamage = Math.floor(150 + (spellLevel - 1) * 22);
    
    // Bonus selon ATK du caster
    const atkBonus = Math.floor(caster.stats.atk * 0.5);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    // Vérifier énergie (déjà fait dans canCast de base, mais double-check)
    if (caster.energy < 100) {
      console.log(`⚠️ ${caster.name} n'a pas assez d'énergie pour Cœur de Lave (${caster.energy}/100)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const lavaCoreSpell = new LavaCoreSpell();
export { LavaCoreSpell };

// server/src/gameplay/effects/special/UnleashedBrazierEffect.ts
import { BaseEffect, EffectResult } from "../base/BaseEffect";
import { IBattleParticipant } from "../../../models/Battle";

/**
 * Effet Brasier Déchaîné (Saryel)
 * 
 * Fonctionnalités :
 * - Transformation : attaques de base deviennent AoE
 * - Bonus vitesse d'attaque et vol de vie
 * - Explosion finale à l'expiration
 * - Gestion via metadata : attackSpeedBonus, lifeStealBonus, explosionDamage, etc.
 */
export class UnleashedBrazierEffect extends BaseEffect {
  constructor() {
    super({
      id: "unleashed_brazier",
      name: "Brasier Déchaîné",
      description: "Transformation ardente : attaques AoE + buffs + explosion finale",
      type: "special",
      category: "special_mechanic",
      stackable: false,
      maxStacks: 1,
      baseDuration: 6
    });
  }

  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🔥⚔️ ${target.name} s'embrase ! Un tourbillon de flammes l'entoure...`
    };
  }

  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // L'effet principal (buffs de combat) est géré par UnleashedBrazierSpell
    // Ici on maintient juste l'effet actif
    
    const activeEffect = (target as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    if (!activeEffect || !activeEffect.metadata) {
      return { message: "🔥⚔️ Brasier Déchaîné sans métadonnées" };
    }
    
    const remainingTurns = activeEffect.duration;
    const attackSpeedBonus = activeEffect.metadata.attackSpeedBonus || 20;
    const lifeStealBonus = activeEffect.metadata.lifeStealBonus || 15;
    
    return {
      message: `🔥⚔️ ${target.name} brûle de puissance ! (+${attackSpeedBonus}% vitesse, +${lifeStealBonus}% vol de vie, ${remainingTurns} tours restants)`
    };
  }

  onRemove(target: IBattleParticipant): EffectResult {
    // Récupérer les données de l'explosion finale
    const activeEffect = (target as any).activeEffects?.find(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    // Retirer le buff principal
    if (target.status.buffs.includes("unleashed_brazier")) {
      const index = target.status.buffs.indexOf("unleashed_brazier");
      target.status.buffs.splice(index, 1);
    }
    
    // L'explosion finale sera gérée par UnleashedBrazierSpell.triggerFinalExplosion()
    // dans BattleEngine quand l'effet expire
    
    return {
      message: `🔥💥 Le brasier de ${target.name} atteint son paroxysme ! EXPLOSION FINALE !`
    };
  }

  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Vérifier que la cible n'a pas déjà cet effet
    const hasEffect = (target as any).activeEffects?.some(
      (e: any) => e.id === "unleashed_brazier"
    );
    
    return !hasEffect && target.status.alive && target.role === "DPS Melee";
  }
}

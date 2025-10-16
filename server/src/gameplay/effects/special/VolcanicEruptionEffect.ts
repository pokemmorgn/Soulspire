// server/src/gameplay/effects/special/VolcanicEruptionEffect.ts
import { BaseEffect, EffectResult } from "../base/BaseEffect";
import { IBattleParticipant } from "../../../models/Battle";

/**
 * Effet Éruption Primordiale (Rhyzann)
 * 
 * Fonctionnalités :
 * - Geysers de feu récurrents (dégâts AoE chaque tour)
 * - Soins selon le nombre d'ennemis touchés
 * - Réduction de dégâts + immunité contrôles
 * - Gestion via metadata : geyserDamage, healingPerEnemy, etc.
 */
export class VolcanicEruptionEffect extends BaseEffect {
  constructor() {
    super({
      id: "volcanic_eruption",
      name: "Éruption Primordiale",
      description: "Zone volcanique : geysers récurrents + protection + immunité contrôles",
      type: "special",
      stackable: false,
      maxStacks: 1,
      baseDuration: 5,
      isPositive: true
    });
  }

  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🌋 ${target.name} déclenche une Éruption Primordiale ! Le sol tremble de fureur volcanique...`
    };
  }

  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    // L'effet principal est géré par VolcanicEruptionSpell.triggerGeyserTick()
    // Ici on ne fait que maintenir l'effet actif et les métadonnées
    
    // Récupérer les métadonnées
    const activeEffect = (target as any).activeEffects?.find(
      (e: any) => e.id === "volcanic_eruption"
    );
    
    if (!activeEffect || !activeEffect.metadata) {
      return { message: "🌋 Éruption Primordiale sans métadonnées" };
    }
    
    // Incrémenter le compteur de tours
    activeEffect.metadata.turnsActive = (activeEffect.metadata.turnsActive || 0) + 1;
    
    return {
      message: `🌋 Zone volcanique active (Tour ${activeEffect.metadata.turnsActive})`
    };
  }

  onRemove(target: IBattleParticipant): EffectResult {
    // Retirer l'immunité aux contrôles
    if (target.status.buffs.includes("cc_immunity")) {
      const index = target.status.buffs.indexOf("cc_immunity");
      target.status.buffs.splice(index, 1);
    }
    
    // Retirer le buff principal
    if (target.status.buffs.includes("volcanic_eruption")) {
      const index = target.status.buffs.indexOf("volcanic_eruption");
      target.status.buffs.splice(index, 1);
    }
    
    return {
      message: `🌋 L'éruption volcanique de ${target.name} s'apaise. Le calme revient...`
    };
  }

  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    // Vérifier que la cible n'a pas déjà cet effet
    const hasEffect = (target as any).activeEffects?.some(
      (e: any) => e.id === "volcanic_eruption"
    );
    
    return !hasEffect && target.status.alive;
  }
}

import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

class BlazingSurgeSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "blazing_surge",
      name: "Blazing Surge",
      description:
        "Inflige des dégâts magiques de zone et applique Brûlure. Si la cible brûle déjà, les dégâts sont augmentés de 25%.",
      type: "active",
      category: "damage",
      targetType: "all_enemies",

      energyCost: 45,
      baseCooldown: 3,

      maxLevel: 10,
      scalingType: "linear",

      element: "Fire",
      requiresRole: ["DPS Ranged", "Mage"],

      animationType: "explosion_fire",
      soundEffect: "blazing_surge_cast",
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
    const action = this.createBaseAction(caster, targets, "skill", turn);

    const baseDamage = this.getBaseDamage(spellLevel);

    action.damage = 0;
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 8; // AoE -> plus de récupération d'énergie
    action.debuffsApplied = [];
    action.perTargetDamage = {}; // ✅ nouveau champ utile pour stocker dégâts par cible

    for (const target of targets) {
      if (!target.status.alive) continue;

      // Calcul des dégâts individuels
      let damage = this.calculateDamage(caster, target, baseDamage, spellLevel, "magical");

      // Bonus si la cible est déjà brûlée
      if (target.status.debuffs.includes("burn")) {
        damage = Math.floor(damage * 1.25);
      }

      // Stocker les dégâts dans l’action
      action.perTargetDamage[target.heroId] = damage;
      action.damage += damage;

      // Application de la brûlure
      const burnDuration = this.getBurnDuration(spellLevel);
      const burnStacks = 1;

      const burnResult = EffectManager.applyEffect("burn", target, caster, burnDuration, burnStacks);
      if (burnResult && burnResult.message) {
        console.log(`🔥 ${burnResult.message}`);
      }

      action.debuffsApplied.push("burn");
    }

    return action;
  }

  // ----- Détails de calcul -----

  private getBaseDamage(spellLevel: number): number {
    // Dégâts modérés AoE : niveau 1: 90 → niveau 10: 200
    return Math.floor(90 + (spellLevel - 1) * 12);
  }

  private getBurnDuration(spellLevel: number): number {
    // Fixe à 2 tours selon la description
    return 2;
  }

  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    return !caster.status.debuffs.includes("silence");
  }
}

export const blazingSurgeSpell = new BlazingSurgeSpell();
export { BlazingSurgeSpell };

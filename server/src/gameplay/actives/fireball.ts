import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../effects/burn";

export class FireballSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "fireball",
      name: "Boule de Feu",
      description: "Lance une boule de feu qui inflige des dégâts et applique Brûlure",
      type: "active",
      category: "damage",
      targetType: "single_enemy",
      
      energyCost: 35,
      baseCooldown: 3,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["DPS Ranged", "Support"], // Ignara peut l'utiliser
      
      animationType: "projectile_fire",
      soundEffect: "fireball_cast"
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
    const target = targets[0]; // Fireball = single target
    
    if (!target || !target.status.alive) {
      throw new Error("Fireball requires a valid living target");
    }
    
    // Créer l'action de base
    const action = this.createBaseAction(caster, [target], "skill", turn);
    
    // Calculer les dégâts
    const baseDamage = this.getBaseDamage(spellLevel);
    const finalDamage = this.calculateDamage(caster, target, baseDamage, spellLevel, "magical");
    
    // Vérifier le critique (bonus pour les sorts de feu)
    const critChance = this.getCriticalChance(caster, spellLevel);
    const isCritical = Math.random() < critChance;
    
    // Appliquer le critique si applicable
    const actualDamage = isCritical ? Math.floor(finalDamage * 1.8) : finalDamage;
    
    // Chance d'appliquer Brûlure
    const burnChance = this.getBurnChance(caster, spellLevel, isCritical);
    const willBurn = Math.random() < burnChance;
    
    // Remplir l'action
    action.damage = actualDamage;
    action.critical = isCritical;
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 5; // Petit gain d'énergie pour les sorts actifs
    action.elementalAdvantage = this.getFireballElementalAdvantage("Fire", target.element);
    
    // Appliquer l'effet Brûlure si déclenché
    if (willBurn) {
      action.debuffsApplied = ["burn"];
      
      // Appliquer immédiatement l'effet via l'EffectManager
      const burnDuration = this.getBurnDuration(spellLevel);
      const burnStacks = isCritical ? 2 : 1; // Critique = 2 stacks
      
      const burnResult = EffectManager.applyEffect("burn", target, caster, burnDuration, burnStacks);
      if (burnResult && burnResult.message) {
        console.log(`🔥 ${burnResult.message}`);
      }
    }
    
    return action;
  }
  
  // Vérifications supplémentaires pour Fireball
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Fireball ne peut pas être lancé si le caster est gelé ou silencé
    if (caster.status.debuffs.includes("freeze") || caster.status.debuffs.includes("silence")) {
      return false;
    }
    
    // Bonus si le caster a des buffs de feu
    return true;
  }
  
  // Dégâts de base selon le niveau du sort
  private getBaseDamage(spellLevel: number): number {
    // Niveau 1: 120, Niveau 10: 300
    return Math.floor(120 + (spellLevel - 1) * 20);
  }
  
  // Chance de critique pour Fireball
  private getCriticalChance(caster: IBattleParticipant, spellLevel: number): number {
    const casterStats = caster.stats as any;
    const baseChance = 0.15; // 15% de base pour les sorts
    const vitesseBonus = (casterStats.vitesse || 80) / 1000;
    const levelBonus = (spellLevel - 1) * 0.02; // +2% par niveau
    const intelligenceBonus = (casterStats.intelligence || 70) / 2000; // Bonus d'intelligence
    
    return Math.min(0.6, baseChance + vitesseBonus + levelBonus + intelligenceBonus);
  }
  
  // Chance d'appliquer Brûlure
  private getBurnChance(caster: IBattleParticipant, spellLevel: number, isCritical: boolean): number {
    const casterStats = caster.stats as any;
    let baseChance = 0.65; // 65% de base
    
    // Bonus par niveau du sort
    baseChance += (spellLevel - 1) * 0.05; // +5% par niveau
    
    // Bonus d'intelligence
    baseChance += (casterStats.intelligence || 70) / 500; // Bonus mineur d'intelligence
    
    // Critique garantit la brûlure
    if (isCritical) baseChance = 1.0;
    
    // Malus contre les ennemis Fire (résistance)
    // Note: target n'est pas accessible ici, sera vérifié dans EffectManager
    
    return Math.min(0.95, baseChance); // Max 95%
  }
  
  // Durée de la brûlure
  private getBurnDuration(spellLevel: number): number {
    return Math.min(6, 3 + Math.floor((spellLevel - 1) / 3)); // 3-6 tours selon niveau
  }
  
  // Override pour calculer l'avantage élémentaire avec bonus Fireball
  private getFireballElementalAdvantage(spellElement: string, targetElement: string): number {
    const advantages: { [key: string]: string[] } = {
      Fire: ["Wind"],
      Water: ["Fire"],
      Wind: ["Electric"],
      Electric: ["Water"],
      Light: ["Dark"],
      Dark: ["Light"]
    };
    
    if (advantages[spellElement]?.includes(targetElement)) {
      return 1.6; // Bonus pour Fireball vs Wind
    }
    if (advantages[targetElement]?.includes(spellElement)) {
      return 0.7; // Malus contre Water
    }
    
    // Fireball est moins efficace contre Fire mais fait quand même des dégâts
    if (targetElement === "Fire") {
      return 0.8; // Résistance partielle au feu
    }
    
    return 1.0; // Neutre contre autres éléments
  }
}

// Export pour l'enregistrement dans le SpellManager
export const fireballSpell = new FireballSpell();

export { FireballSpell };

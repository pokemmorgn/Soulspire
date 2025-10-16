// server/src/gameplay/ultimates/VolcanicEruptionSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Éruption Primordiale - Rhyzann (Légendaire Tank Offensif)
 * 
 * Description originale :
 * "Rhyzann enfonce ses bras dans le sol et invoque la colère du volcan ancestral.
 * Pendant 5 secondes, des geysers de feu jaillissent autour de lui à intervalles réguliers,
 * infligeant d'énormes dégâts de feu à tous les ennemis proches.
 * Chaque ennemi touché soigne Rhyzann de 3% de ses PV max.
 * Pendant toute la durée, il est insensible aux contrôles et subit 25% de dégâts en moins."
 * 
 * Adaptation turn-based :
 * - Durée : 5 secondes → 5 tours
 * - Geysers : Dégâts AoE chaque tour pendant la durée
 * - Soins : 3% PV max par ennemi touché à chaque activation
 * - Immunité contrôles + réduction dégâts 25%
 * - Recharge : 25 tours
 * - Coût : 100 énergie
 */
class VolcanicEruptionSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "volcanic_eruption",
      name: "Éruption Primordiale",
      description: "Zone de danger continue : dégâts AoE récurrents + immunité + soins",
      type: "ultimate",
      category: "utility",
      targetType: "self",
      
      energyCost: 100,
      baseCooldown: 25,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "volcanic_eruption_field",
      soundEffect: "volcanic_eruption_cast"
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
    action.healing = 0;
    action.damage = 0;
    
    // Appliquer l'effet Éruption Primordiale
    const duration = this.getEffectDuration(spellLevel);
    const eruptionResult = EffectManager.applyEffect(
      "volcanic_eruption",
      caster,
      caster,
      duration
    );
    
    if (eruptionResult && eruptionResult.message) {
      console.log(`🌋 ${eruptionResult.message}`);
      action.buffsApplied.push("volcanic_eruption");
    }
    
    // Configurer les métadonnées de l'effet
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "volcanic_eruption"
    );
    
    if (activeEffect) {
      activeEffect.metadata = {
        geyserDamage: this.getGeyserDamage(caster, spellLevel),
        healingPerEnemy: this.getHealingPerEnemy(caster, spellLevel),
        damageReduction: this.getDamageReduction(spellLevel),
        ccImmunity: true,
        isVolcanicEruption: true,
        turnsActive: 0 // Compteur pour les activations
      };
    }
    
    // Ajouter les buffs au status pour compatibilité
    if (!caster.status.buffs.includes("volcanic_eruption")) {
      caster.status.buffs.push("volcanic_eruption");
    }
    
    // Ajouter immunité contrôles
    if (!caster.status.buffs.includes("cc_immunity")) {
      caster.status.buffs.push("cc_immunity");
      action.buffsApplied.push("cc_immunity");
    }
    
    console.log(`🌋 ${caster.name} déclenche Éruption Primordiale ! Zone volcanique pendant ${duration} tours`);
    console.log(`🌋🛡️ Immunité contrôles + ${this.getDamageReduction(spellLevel)}% réduction dégâts`);
    
    return action;
  }
  
  // ----- Méthodes statiques pour intégration BattleEngine -----
  
  /**
   * Vérifier si un participant est sous l'effet Éruption Primordiale
   */
  static isErupting(participant: IBattleParticipant): boolean {
    if (!participant.status.alive) return false;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "volcanic_eruption"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Obtenir la réduction de dégâts
   */
  static getDamageReduction(participant: IBattleParticipant): number {
    if (!this.isErupting(participant)) return 0;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "volcanic_eruption"
    );
    
    return activeEffect?.metadata?.damageReduction || 25;
  }
  
  /**
   * Appliquer la réduction de dégâts de l'éruption
   */
  static applyVolcanicProtection(
    defender: IBattleParticipant, 
    incomingDamage: number
  ): number {
    if (!this.isErupting(defender) || incomingDamage <= 0) return incomingDamage;
    
    const reductionPercent = this.getDamageReduction(defender);
    const reducedDamage = Math.floor(incomingDamage * (1 - reductionPercent / 100));
    
    console.log(`🌋🛡️ Éruption Primordiale: -${reductionPercent}% dégâts (${incomingDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Déclencher les geysers de feu (à appeler chaque tour)
   */
  static triggerGeyserTick(
    caster: IBattleParticipant,
    allEnemies: IBattleParticipant[]
  ): { damage: number; healing: number } {
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "volcanic_eruption"
    );
    
    if (!activeEffect || !activeEffect.metadata) {
      return { damage: 0, healing: 0 };
    }
    
    // Incrémenter le compteur
    activeEffect.metadata.turnsActive = (activeEffect.metadata.turnsActive || 0) + 1;
    
    const geyserDamage = activeEffect.metadata.geyserDamage || 0;
    const healingPerEnemy = activeEffect.metadata.healingPerEnemy || 0;
    const aliveEnemies = allEnemies.filter(enemy => enemy.status.alive);
    
    let totalDamage = 0;
    let totalHealing = 0;
    
    console.log(`🌋💥 Geysers de feu ! Tour ${activeEffect.metadata.turnsActive}`);
    
    // Dégâts AoE aux ennemis
    for (const enemy of aliveEnemies) {
      // Calculer dégâts avec défense réduite (geysers = magie de terre)
      const defense = Math.floor(enemy.stats.def * 0.7); // Bypass partiel défense
      let finalDamage = Math.max(1, geyserDamage - Math.floor(defense / 2));
      
      // Avantage élémentaire
      const elementalBonus = caster.element === "Fire" && enemy.element === "Wind" ? 1.3 : 1.0;
      finalDamage = Math.floor(finalDamage * elementalBonus);
      
      // Variation aléatoire réduite (geysers = réguliers)
      finalDamage = Math.floor(finalDamage * (0.95 + Math.random() * 0.1));
      
      enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
      totalDamage += finalDamage;
      
      console.log(`🌋🔥 ${enemy.name} subit ${finalDamage} dégâts de geyser`);
      
      if (enemy.currentHp === 0) {
        enemy.status.alive = false;
        console.log(`💀 ${enemy.name} est consumé par l'éruption !`);
      }
    }
    
    // Soins pour Rhyzann (3% PV max par ennemi touché)
    if (aliveEnemies.length > 0) {
      const totalHealingAmount = healingPerEnemy * aliveEnemies.length;
      caster.currentHp = Math.min(
        caster.stats.maxHp, 
        caster.currentHp + totalHealingAmount
      );
      totalHealing = totalHealingAmount;
      
      console.log(`🌋💚 ${caster.name} se soigne de ${totalHealingAmount} HP (${aliveEnemies.length} ennemis × ${healingPerEnemy} HP)`);
    }
    
    return { damage: totalDamage, healing: totalHealing };
  }
  
  /**
   * Vérifier l'immunité aux contrôles
   */
  static hasControlImmunity(participant: IBattleParticipant): boolean {
    return this.isErupting(participant);
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Durée de l'effet
   * 5 secondes → 5 tours
   */
  private getEffectDuration(spellLevel: number): number {
    // Base 5 tours, +1 tous les 5 niveaux
    return Math.min(7, 5 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Dégâts des geysers par activation
   * "Énormes dégâts de feu"
   */
  private getGeyserDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts énormes mais répartis : niveau 1: 200 → niveau 10: 450
    const baseDamage = Math.floor(200 + (spellLevel - 1) * 28);
    
    // Bonus selon ATK du caster
    const atkBonus = Math.floor(caster.stats.atk * 0.9);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Soins par ennemi touché
   * 3% PV max par ennemi
   */
  private getHealingPerEnemy(caster: IBattleParticipant, spellLevel: number): number {
    // 3% base, +0.5% par niveau (max 7.5% au niveau 10)
    const percent = Math.min(8, 3 + (spellLevel - 1) * 0.5);
    return Math.floor(caster.stats.maxHp * (percent / 100));
  }
  
  /**
   * Réduction de dégâts pendant l'effet
   */
  private getDamageReduction(spellLevel: number): number {
    // 25% base, +2% par niveau (max 43% au niveau 10)
    return Math.min(45, 25 + (spellLevel - 1) * 2);
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    // Ne peut pas se cumuler avec une autre Éruption Primordiale
    if (VolcanicEruptionSpell.isErupting(caster)) {
      console.log(`⚠️ ${caster.name} a déjà une Éruption Primordiale active`);
      return false;
    }
    
    // Vérifier énergie
    if (caster.energy < 100) {
      console.log(`⚠️ ${caster.name} n'a pas assez d'énergie pour Éruption Primordiale (${caster.energy}/100)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const volcanicEruptionSpell = new VolcanicEruptionSpell();
export { VolcanicEruptionSpell };

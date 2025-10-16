// server/src/gameplay/actives/IncandescentRushSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Ruée Incandescente - Saryel (Légendaire DPS Melee)
 * 
 * Description originale :
 * "Saryel se propulse vers la cible, traversant les ennemis sur son passage 
 * et infligeant des dégâts de feu en ligne. Si elle touche au moins 3 ennemis, 
 * son prochain Danse des Lames ne consomme pas d'énergie."
 * 
 * Adaptation turn-based :
 * - Charge linéaire : traverse et frappe les ennemis en ligne
 * - Bonus conditionnel : Si ≥3 ennemis touchés → prochain sort gratuit
 * - Mobilité + dégâts en ligne droite
 * - Recharge : 10 tours
 * - Coût : 40 énergie
 */
class IncandescentRushSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "incandescent_rush",
      name: "Ruée Incandescente",
      description: "Charge linéaire + bonus énergie conditionnelle",
      type: "active",
      category: "damage",
      targetType: "all_enemies",
      
      energyCost: 40,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["DPS Melee"],
      
      animationType: "fire_charge_line",
      soundEffect: "incandescent_rush_cast"
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
    
    // Coût en énergie
    action.energyCost = this.getEnergyCost(spellLevel);
    action.energyGain = 12; // Récupération d'énergie modérée
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.damage = 0;
    action.healing = 0;
    
    // Sélectionner les ennemis en ligne de charge
    const lineTargets = this.selectChargeLineTargets(caster, targets, battleContext);
    action.targetIds = lineTargets.map(t => t.heroId);
    
    if (lineTargets.length === 0) {
      console.log(`🔥💨 ${caster.name} charge dans le vide ! Aucune cible en ligne`);
      return action;
    }
    
    console.log(`🔥💨 ${caster.name} charge ! Ruée Incandescente à travers ${lineTargets.length} ennemis`);
    
    // Appliquer dégâts aux cibles en ligne
    let enemiesHit = 0;
    const lineDamage = this.getLineDamage(caster, spellLevel);
    
    for (const target of lineTargets) {
      if (!target.status.alive) continue;
      
      // Calculer dégâts (réduits pour AoE)
      const damage = this.calculateDamage(caster, target, lineDamage, spellLevel, "physical");
      
      target.currentHp = Math.max(0, target.currentHp - damage);
      action.damage += damage;
      enemiesHit++;
      
      console.log(`🔥⚔️ ${target.name} traversé ! ${damage} dégâts de feu`);
      
      if (target.currentHp === 0) {
        target.status.alive = false;
        console.log(`💀 ${target.name} est pulvérisé par la charge ardente !`);
      }
    }
    
    // Vérifier bonus conditionnel (≥3 ennemis touchés)
    const requiredHits = this.getRequiredHits(spellLevel);
    if (enemiesHit >= requiredHits) {
      // Appliquer l'effet "énergie gratuite"
      const energyBonusDuration = this.getEnergyBonusDuration(spellLevel);
      const energyResult = EffectManager.applyEffect(
        "free_energy",
        caster,
        caster,
        energyBonusDuration
      );
      
      if (energyResult) {
        // Configurer les métadonnées
        const activeEffect = (caster as any).activeEffects?.find(
          (e: any) => e.id === "free_energy"
        );
        
        if (activeEffect) {
          activeEffect.metadata = {
            freeSpells: this.getFreeSpellsCount(spellLevel),
            isIncandescentRush: true,
            validSpells: ["blade_dance"] // Valide pour Danse des Lames
          };
        }
        
        // Ajouter le buff au status
        if (!caster.status.buffs.includes("free_energy")) {
          caster.status.buffs.push("free_energy");
        }
        
        action.buffsApplied.push("free_energy");
        
        console.log(`🔥⚡ CHARGE MASSIVE ! ${caster.name} gagne des sorts gratuits (${enemiesHit} ennemis touchés ≥ ${requiredHits})`);
      }
    } else {
      console.log(`🔥📉 Charge insuffisante (${enemiesHit}/${requiredHits} ennemis) - pas de bonus`);
    }
    
    console.log(`🔥💨 Ruée Incandescente terminée ! ${enemiesHit} ennemis traversés, ${action.damage} dégâts totaux`);
    
    return action;
  }
  
  // ----- Logique de ciblage linéaire -----
  
  /**
   * Sélectionner les ennemis en ligne de charge
   * Simule une charge qui traverse plusieurs ennemis
   */
  private selectChargeLineTargets(
    caster: IBattleParticipant,
    allTargets: IBattleParticipant[],
    battleContext?: any
  ): IBattleParticipant[] {
    const aliveTargets = allTargets.filter(t => t.status.alive);
    
    if (aliveTargets.length === 0) return [];
    
    // Logique de charge : traverse plusieurs ennemis selon leur position
    const isPlayerTeam = battleContext?.allPlayers?.includes(caster) || false;
    const targetPositions = isPlayerTeam ? 
      (battleContext?.enemyPositions || new Map()) : 
      (battleContext?.playerPositions || new Map());
    
    // Trier les cibles par position pour simuler la traversée
    const sortedTargets = aliveTargets.sort((a, b) => {
      const posA = targetPositions.get?.(a.heroId) || 1;
      const posB = targetPositions.get?.(b.heroId) || 1;
      return posA - posB; // Du front vers le back
    });
    
    // Calculer combien d'ennemis peuvent être traversés
    const maxTargets = this.getMaxTargets(sortedTargets.length);
    const lineTargets = sortedTargets.slice(0, maxTargets);
    
    console.log(`🔥💨 Charge à travers ${lineTargets.length} ennemis (positions: ${lineTargets.map(t => targetPositions.get?.(t.heroId) || '?').join(', ')})`);
    
    return lineTargets;
  }
  
  /**
   * Calculer le nombre maximum de cibles traversables
   */
  private getMaxTargets(totalEnemies: number): number {
    // Maximum 3-4 ennemis selon la charge
    if (totalEnemies <= 2) return totalEnemies; // Traverse tous si peu
    if (totalEnemies <= 4) return totalEnemies - 1; // Laisse 1 derrière
    return 4; // Maximum 4 ennemis
  }
  
  // ----- Méthodes statiques pour intégration -----
  
  /**
   * Vérifier si Saryel a le bonus énergie gratuite
   */
  static hasFreeEnergy(saryel: IBattleParticipant): boolean {
    if (!saryel.status.alive) return false;
    
    const activeEffect = (saryel as any).activeEffects?.find(
      (e: any) => e.id === "free_energy"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Vérifier si un sort peut être lancé gratuitement
   */
  static canCastForFree(saryel: IBattleParticipant, spellId: string): boolean {
    if (!this.hasFreeEnergy(saryel)) return false;
    
    const activeEffect = (saryel as any).activeEffects?.find(
      (e: any) => e.id === "free_energy"
    );
    
    const validSpells = activeEffect?.metadata?.validSpells || [];
    const freeSpells = activeEffect?.metadata?.freeSpells || 0;
    
    return freeSpells > 0 && validSpells.includes(spellId);
  }
  
  /**
   * Consommer une utilisation gratuite
   */
  static consumeFreeSpell(saryel: IBattleParticipant): boolean {
    if (!this.hasFreeEnergy(saryel)) return false;
    
    const activeEffect = (saryel as any).activeEffects?.find(
      (e: any) => e.id === "free_energy"
    );
    
    if (activeEffect?.metadata?.freeSpells > 0) {
      activeEffect.metadata.freeSpells--;
      console.log(`🔥💰 Sort gratuit consommé ! Restants: ${activeEffect.metadata.freeSpells}`);
      
      // Retirer l'effet si plus d'utilisations
      if (activeEffect.metadata.freeSpells <= 0) {
        EffectManager.removeEffect(saryel, "free_energy");
      }
      
      return true;
    }
    
    return false;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Dégâts de la charge linéaire
   */
  private getLineDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts modérés (AoE) : niveau 1: 100 → niveau 10: 280
    const baseDamage = Math.floor(100 + (spellLevel - 1) * 20);
    
    // Bonus selon ATK du caster
    const atkBonus = Math.floor(caster.stats.atk * 0.7);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Nombre d'ennemis requis pour le bonus
   */
  private getRequiredHits(spellLevel: number): number {
    // Base 3 ennemis, -1 tous les 5 niveaux (minimum 2)
    return Math.max(2, 3 - Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Nombre de sorts gratuits accordés
   */
  private getFreeSpellsCount(spellLevel: number): number {
    // 1 sort gratuit base, +1 tous les 5 niveaux
    return Math.min(3, 1 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Durée du bonus énergie gratuite
   */
  private getEnergyBonusDuration(spellLevel: number): number {
    // Base 3 tours, +1 tous les 4 niveaux
    return Math.min(5, 3 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    // Ne peut pas charger si immobilisée
    if (caster.status.debuffs.includes("rooted") || caster.status.debuffs.includes("stunned")) {
      console.log(`⚠️ ${caster.name} ne peut pas charger (immobilisée)`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const incandescentRushSpell = new IncandescentRushSpell();
export { IncandescentRushSpell };

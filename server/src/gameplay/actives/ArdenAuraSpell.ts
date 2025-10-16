// server/src/gameplay/actives/ArdenAuraSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Aura Ardente - Pyra (Légendaire Support)
 * 
 * Description originale :
 * "Pyra crée un halo de feu autour d'elle pendant 6 secondes, augmentant 
 * l'attaque et la vitesse d'attaque de tous les alliés de 12%.
 * Les ennemis proches subissent de légers dégâts de feu chaque seconde."
 * 
 * Adaptation turn-based :
 * - Aura : +12-20% attaque et vitesse pendant 6 tours
 * - DoT : Dégâts de feu légers aux ennemis chaque tour
 * - Zone : Effet persistant autour de Pyra
 * - Recharge : 12 tours
 * - Coût : 50 énergie
 */
class ArdenAuraSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "arden_aura",
      name: "Aura Ardente",
      description: "Aura de buff alliés + DoT ennemis proches",
      type: "active",
      category: "buff",
      targetType: "self",
      
      energyCost: 50,
      baseCooldown: 12,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Support"],
      
      animationType: "fire_halo_aura",
      soundEffect: "arden_aura_cast"
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
    action.energyGain = 6; // Récupération d'énergie faible (aura coûteuse)
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.healing = 0;
    action.damage = 0;
    
    // Appliquer l'aura ardente
    const duration = this.getAuraDuration(spellLevel);
    const auraResult = EffectManager.applyEffect(
      "arden_aura",
      caster,
      caster,
      duration
    );
    
    if (auraResult && auraResult.message) {
      console.log(`🔥✨ ${auraResult.message}`);
      action.buffsApplied.push("arden_aura");
    }
    
    // Configurer les métadonnées de l'aura
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "arden_aura"
    );
    
    if (activeEffect) {
      activeEffect.metadata = {
        attackBonus: this.getAttackBonus(spellLevel),
        speedBonus: this.getSpeedBonus(spellLevel),
        auraDamage: this.getAuraDamage(caster, spellLevel),
        isArdenAura: true,
        turnsActive: 0
      };
    }
    
    // Ajouter le buff au status pour compatibilité
    if (!caster.status.buffs.includes("arden_aura")) {
      caster.status.buffs.push("arden_aura");
    }
    
    // Effet immédiat : appliquer les buffs à tous les alliés
    const allAllies = battleContext?.allPlayers || [caster];
    const aliveAllies = allAllies.filter((ally: IBattleParticipant) => ally.status.alive);
    
    for (const ally of aliveAllies) {
      // Appliquer le buff d'aura
      const allyBuffResult = EffectManager.applyEffect(
        "arden_aura_buff",
        ally,
        caster,
        duration
      );
      
      if (allyBuffResult) {
        const allyEffect = (ally as any).activeEffects?.find(
          (e: any) => e.id === "arden_aura_buff"
        );
        
        if (allyEffect) {
          allyEffect.metadata = {
            attackBonus: this.getAttackBonus(spellLevel),
            speedBonus: this.getSpeedBonus(spellLevel),
            sourceId: caster.heroId
          };
        }
        
        if (!ally.status.buffs.includes("arden_aura_buff")) {
          ally.status.buffs.push("arden_aura_buff");
        }
        
        if (!action.targetIds.includes(ally.heroId)) {
          action.targetIds.push(ally.heroId);
        }
        
        console.log(`🔥⚡ ${ally.name} bénéficie de l'Aura Ardente ! (+${this.getAttackBonus(spellLevel)}% ATK, +${this.getSpeedBonus(spellLevel)}% vitesse)`);
      }
    }
    
    console.log(`🔥✨ ${caster.name} active Aura Ardente ! ${aliveAllies.length} alliés renforcés pendant ${duration} tours`);
    
    return action;
  }
  
  // ----- Méthodes statiques pour intégration EffectManager -----
  
  /**
   * Vérifier si Pyra a l'aura active
   */
  static hasArdenAura(pyra: IBattleParticipant): boolean {
    if (!pyra.status.alive) return false;
    
    const activeEffect = (pyra as any).activeEffects?.find(
      (e: any) => e.id === "arden_aura"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Traitement de l'aura chaque tour (pour EffectManager)
   */
  static processAuraTick(
    pyra: IBattleParticipant,
    allEnemies: IBattleParticipant[]
  ): { damage: number; enemiesAffected: number } {
    if (!this.hasArdenAura(pyra)) return { damage: 0, enemiesAffected: 0 };
    
    const activeEffect = (pyra as any).activeEffects?.find(
      (e: any) => e.id === "arden_aura"
    );
    
    if (!activeEffect?.metadata) return { damage: 0, enemiesAffected: 0 };
    
    const auraDamage = activeEffect.metadata.auraDamage || 0;
    const aliveEnemies = allEnemies.filter(enemy => enemy.status.alive);
    
    // Incrémenter le compteur
    activeEffect.metadata.turnsActive = (activeEffect.metadata.turnsActive || 0) + 1;
    
    let totalDamage = 0;
    let enemiesAffected = 0;
    
    console.log(`🔥✨ Aura Ardente pulse ! Tour ${activeEffect.metadata.turnsActive}`);
    
    // Appliquer dégâts légers à tous les ennemis
    for (const enemy of aliveEnemies) {
      // Calculer dégâts avec défense réduite (aura = magie légère)
      const defense = Math.floor(enemy.stats.def * 0.8);
      let finalDamage = Math.max(1, auraDamage - Math.floor(defense / 3));
      
      // Avantage élémentaire
      if (pyra.element === "Fire" && enemy.element === "Wind") {
        finalDamage = Math.floor(finalDamage * 1.2);
      }
      
      // Variation aléatoire réduite (aura = constante)
      finalDamage = Math.floor(finalDamage * (0.9 + Math.random() * 0.2));
      
      enemy.currentHp = Math.max(0, enemy.currentHp - finalDamage);
      totalDamage += finalDamage;
      enemiesAffected++;
      
      console.log(`🔥💨 ${enemy.name} subit ${finalDamage} dégâts de l'aura ardente`);
      
      if (enemy.currentHp === 0) {
        enemy.status.alive = false;
        console.log(`💀 ${enemy.name} est consumé par l'aura !`);
      }
    }
    
    return { damage: totalDamage, enemiesAffected };
  }
  
  /**
   * Obtenir les bonus actuels pour un allié
   */
  static getCurrentBonuses(participant: IBattleParticipant): {
    attackBonus: number;
    speedBonus: number;
  } {
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "arden_aura_buff"
    );
    
    if (!activeEffect?.metadata) {
      return { attackBonus: 0, speedBonus: 0 };
    }
    
    return {
      attackBonus: activeEffect.metadata.attackBonus || 0,
      speedBonus: activeEffect.metadata.speedBonus || 0
    };
  }
  
  /**
   * Vérifier si un participant bénéficie de l'aura
   */
  static hasAuraBuff(participant: IBattleParticipant): boolean {
    return participant.status.buffs.includes("arden_aura_buff");
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Bonus d'attaque de l'aura
   */
  private getAttackBonus(spellLevel: number): number {
    // 12% base, +1% par niveau (max 21% au niveau 10)
    return Math.min(22, 12 + (spellLevel - 1) * 1);
  }
  
  /**
   * Bonus de vitesse d'attaque de l'aura
   */
  private getSpeedBonus(spellLevel: number): number {
    // 12% base, +1% par niveau (max 21% au niveau 10)
    return Math.min(22, 12 + (spellLevel - 1) * 1);
  }
  
  /**
   * Dégâts de l'aura par tour
   */
  private getAuraDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts légers : niveau 1: 30 → niveau 10: 75
    const baseDamage = Math.floor(30 + (spellLevel - 1) * 5);
    
    // Petit bonus selon ATK du caster
    const atkBonus = Math.floor(caster.stats.atk * 0.15);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Durée de l'aura
   * 6 secondes → 6 tours
   */
  private getAuraDuration(spellLevel: number): number {
    // Base 6 tours, +1 tous les 4 niveaux
    return Math.min(8, 6 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    // Ne peut pas se cumuler avec une autre Aura Ardente
    if (ArdenAuraSpell.hasArdenAura(caster)) {
      console.log(`⚠️ ${caster.name} a déjà une Aura Ardente active`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const ardenAuraSpell = new ArdenAuraSpell();
export { ArdenAuraSpell };

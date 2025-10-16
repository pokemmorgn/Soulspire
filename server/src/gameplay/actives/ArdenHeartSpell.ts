// server/src/gameplay/actives/ArdenHeartSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Cœur Ardent - Rhyzann (Légendaire Tank)
 * 
 * Description originale :
 * "Rhyzann concentre la chaleur de son noyau et libère une onde de feu autour de lui,
 * infligeant des dégâts de feu modérés à tous les ennemis proches.
 * Pendant 6 secondes, il gagne +15% de résistance aux dégâts et renvoie 20% des 
 * dégâts de mêlée subis sous forme de feu."
 * 
 * Adaptation turn-based :
 * - Dégâts AoE modérés + onde de feu initiale
 * - Buff défensif : +15-25% résistance pendant 6 tours
 * - Reflect damage : 20-35% des dégâts mêlée renvoyés
 * - Recharge : 10 tours
 * - Coût : 40 énergie
 */
class ArdenHeartSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "arden_heart",
      name: "Cœur Ardent",
      description: "Onde de feu + buff défensif + reflect damage",
      type: "active",
      category: "buff",
      targetType: "self",
      
      energyCost: 40,
      baseCooldown: 10,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "fire_heart_aura",
      soundEffect: "arden_heart_cast"
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
    action.energyGain = 10; // Récupération d'énergie modérée
    action.buffsApplied = [];
    action.debuffsApplied = [];
    action.damage = 0;
    action.healing = 0;
    
    // Partie 1 : Onde de feu initiale (dégâts AoE)
    const allEnemies = battleContext?.allEnemies || [];
    const aliveEnemies = allEnemies.filter((enemy: IBattleParticipant) => enemy.status.alive);
    
    if (aliveEnemies.length > 0) {
      const aoeDamage = this.getAoEDamage(caster, spellLevel);
      
      for (const enemy of aliveEnemies) {
        const damage = this.calculateDamage(caster, enemy, aoeDamage, spellLevel, "magical");
        
        enemy.currentHp = Math.max(0, enemy.currentHp - damage);
        action.damage += damage;
        
        // Ajouter les ennemis comme cibles
        if (!action.targetIds.includes(enemy.heroId)) {
          action.targetIds.push(enemy.heroId);
        }
        
        console.log(`🔥💥 ${enemy.name} subit ${damage} dégâts de l'onde ardente`);
        
        if (enemy.currentHp === 0) {
          enemy.status.alive = false;
          console.log(`💀 ${enemy.name} est consumé par le cœur ardent !`);
        }
      }
    }
    
    // Partie 2 : Appliquer l'effet défensif Cœur Ardent
    const duration = this.getEffectDuration(spellLevel);
    const heartResult = EffectManager.applyEffect(
      "arden_heart",
      caster,
      caster,
      duration
    );
    
    if (heartResult && heartResult.message) {
      console.log(`🔥🛡️ ${heartResult.message}`);
      action.buffsApplied.push("arden_heart");
    }
    
    // Configurer les métadonnées de l'effet
    const activeEffect = (caster as any).activeEffects?.find(
      (e: any) => e.id === "arden_heart"
    );
    
    if (activeEffect) {
      activeEffect.metadata = {
        damageResistance: this.getDamageResistance(spellLevel),
        reflectPercent: this.getReflectPercent(spellLevel),
        isArdenHeart: true
      };
    }
    
    // Ajouter le buff au status pour compatibilité
    if (!caster.status.buffs.includes("arden_heart")) {
      caster.status.buffs.push("arden_heart");
    }
    
    console.log(`🔥⚡ ${caster.name} active Cœur Ardent ! (${action.damage} dégâts AoE, +${this.getDamageResistance(spellLevel)}% résistance, ${this.getReflectPercent(spellLevel)}% reflect)`);
    
    return action;
  }
  
  // ----- Méthodes statiques pour intégration BattleEngine -----
  
  /**
   * Vérifier si un participant a l'effet Cœur Ardent
   */
  static hasArdenHeart(participant: IBattleParticipant): boolean {
    if (!participant.status.alive) return false;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "arden_heart"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Obtenir la résistance aux dégâts
   */
  static getDamageResistance(participant: IBattleParticipant): number {
    if (!this.hasArdenHeart(participant)) return 0;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "arden_heart"
    );
    
    return activeEffect?.metadata?.damageResistance || 15;
  }
  
  /**
   * Appliquer la résistance aux dégâts
   */
  static applyDamageResistance(
    defender: IBattleParticipant,
    incomingDamage: number
  ): number {
    if (!this.hasArdenHeart(defender) || incomingDamage <= 0) return incomingDamage;
    
    const resistance = this.getDamageResistance(defender);
    const reducedDamage = Math.floor(incomingDamage * (1 - resistance / 100));
    
    console.log(`🔥🛡️ Cœur Ardent: -${resistance}% dégâts (${incomingDamage} → ${reducedDamage})`);
    
    return Math.max(1, reducedDamage);
  }
  
  /**
   * Déclencher le reflect damage sur attaques mêlée
   */
  static triggerReflectDamage(
    defender: IBattleParticipant,
    attacker: IBattleParticipant,
    damageReceived: number,
    isMeleeAttack: boolean
  ): number {
    if (!this.hasArdenHeart(defender) || !isMeleeAttack || damageReceived <= 0) return 0;
    if (!attacker.status.alive) return 0;
    
    const activeEffect = (defender as any).activeEffects?.find(
      (e: any) => e.id === "arden_heart"
    );
    
    const reflectPercent = activeEffect?.metadata?.reflectPercent || 20;
    const reflectDamage = Math.floor(damageReceived * (reflectPercent / 100));
    
    if (reflectDamage > 0) {
      attacker.currentHp = Math.max(0, attacker.currentHp - reflectDamage);
      console.log(`🔥⚔️ Cœur Ardent : ${attacker.name} subit ${reflectDamage} dégâts de feu réfléchis (${reflectPercent}%)`);
      
      if (attacker.currentHp === 0) {
        attacker.status.alive = false;
        console.log(`💀 ${attacker.name} est consumé par les flammes réfléchies !`);
      }
    }
    
    return reflectDamage;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Dégâts AoE de l'onde initiale
   */
  private getAoEDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts modérés : niveau 1: 120 → niveau 10: 300
    const baseDamage = Math.floor(120 + (spellLevel - 1) * 20);
    
    // Bonus selon ATK du caster
    const atkBonus = Math.floor(caster.stats.atk * 0.6);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Résistance aux dégâts
   */
  private getDamageResistance(spellLevel: number): number {
    // 15% base, +1% par niveau (max 24% au niveau 10)
    return Math.min(25, 15 + (spellLevel - 1) * 1);
  }
  
  /**
   * Pourcentage de reflect damage
   */
  private getReflectPercent(spellLevel: number): number {
    // 20% base, +1.5% par niveau (max 33.5% au niveau 10)
    return Math.min(35, 20 + (spellLevel - 1) * 1.5);
  }
  
  /**
   * Durée de l'effet
   * 6 secondes → 6 tours
   */
  private getEffectDuration(spellLevel: number): number {
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
    
    // Ne peut pas se cumuler avec un autre Cœur Ardent
    if (ArdenHeartSpell.hasArdenHeart(caster)) {
      console.log(`⚠️ ${caster.name} a déjà l'effet Cœur Ardent actif`);
      return false;
    }
    
    return true;
  }
}

// Exports
export const ardenHeartSpell = new ArdenHeartSpell();
export { ArdenHeartSpell };

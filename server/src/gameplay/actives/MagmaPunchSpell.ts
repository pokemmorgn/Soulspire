// server/src/gameplay/actives/MagmaPunchSpell.ts
import { BaseSpell, ISpellConfig } from "../base/BaseSpell";
import { IBattleParticipant, IBattleAction } from "../../models/Battle";
import { EffectManager } from "../EffectManager";

/**
 * Poing de Magma - Rhyzann (Légendaire Tank)
 * 
 * Description originale :
 * "Rhyzann frappe le sol de toutes ses forces, provoquant une fissure de lave 
 * en ligne droite. Inflige des dégâts de feu élevés et étourdit les ennemis 
 * touchés pendant 1,2 seconde. S'il touche au moins un ennemi, il gagne +10% 
 * de défense pendant 5 secondes."
 * 
 * Adaptation turn-based :
 * - Dégâts en ligne droite (frappe linéaire)
 * - Stun : 1-2 tours sur ennemis touchés
 * - Self-buff : +10-18% défense pendant 5 tours si hit
 * - Recharge : 12 tours
 * - Coût : 45 énergie
 */
class MagmaPunchSpell extends BaseSpell {
  constructor() {
    const config: ISpellConfig = {
      id: "magma_punch",
      name: "Poing de Magma",
      description: "Fissure linéaire + stun + buff défense conditionnelle",
      type: "active",
      category: "control",
      targetType: "all_enemies",
      
      energyCost: 45,
      baseCooldown: 12,
      
      maxLevel: 10,
      scalingType: "linear",
      
      element: "Fire",
      requiresRole: ["Tank"],
      
      animationType: "lava_fissure_line",
      soundEffect: "magma_punch_cast"
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
    
    // Sélectionner les ennemis en ligne droite
    const lineTargets = this.selectLineTargets(caster, targets, battleContext);
    action.targetIds = lineTargets.map(t => t.heroId);
    
    if (lineTargets.length === 0) {
      console.log(`🌋👊 ${caster.name} frappe le vide ! Aucune cible en ligne`);
      return action;
    }
    
    // Appliquer dégâts et stun aux cibles en ligne
    let enemiesHit = 0;
    const stunDuration = this.getStunDuration(spellLevel);
    
    for (const target of lineTargets) {
      if (!target.status.alive) continue;
      
      // Calculer et appliquer dégâts
      const baseDamage = this.getLineDamage(caster, spellLevel);
      const damage = this.calculateDamage(caster, target, baseDamage, spellLevel, "physical");
      
      target.currentHp = Math.max(0, target.currentHp - damage);
      action.damage += damage;
      enemiesHit++;
      
      console.log(`🌋👊 ${target.name} subit ${damage} dégâts de la fissure de lave`);
      
      // Appliquer stun si la cible survit
      if (target.currentHp > 0) {
        const stunResult = EffectManager.applyEffect(
          "stunned",
          target,
          caster,
          stunDuration
        );
        
        if (stunResult && stunResult.message) {
          console.log(`🌋😵 ${target.name} est étourdi pendant ${stunDuration} tours`);
          action.debuffsApplied.push("stunned");
        }
      } else {
        target.status.alive = false;
        console.log(`💀 ${target.name} est pulvérisé par le poing de magma !`);
      }
    }
    
    // Buff défense si au moins un ennemi touché
    if (enemiesHit > 0) {
      const defenseBonus = this.getDefenseBonus(spellLevel);
      const defenseDuration = this.getDefenseDuration(spellLevel);
      
      const defenseResult = EffectManager.applyEffect(
        "magma_defense",
        caster,
        caster,
        defenseDuration
      );
      
      if (defenseResult) {
        // Configurer les métadonnées de l'effet
        const activeEffect = (caster as any).activeEffects?.find(
          (e: any) => e.id === "magma_defense"
        );
        
        if (activeEffect) {
          activeEffect.metadata = {
            defenseBonus: defenseBonus,
            isMagmaPunch: true
          };
        }
        
        // Ajouter le buff au status
        if (!caster.status.buffs.includes("magma_defense")) {
          caster.status.buffs.push("magma_defense");
        }
        
        action.buffsApplied.push("magma_defense");
        console.log(`🌋🛡️ ${caster.name} gagne +${defenseBonus}% défense pendant ${defenseDuration} tours`);
      }
    }
    
    console.log(`🌋👊 ${caster.name} frappe le sol ! Fissure de lave : ${enemiesHit} ennemis touchés, ${action.damage} dégâts totaux`);
    
    return action;
  }
  
  // ----- Logique de ciblage linéaire -----
  
  /**
   * Sélectionner les ennemis en ligne droite
   * Simule une attaque linéaire traversante
   */
  private selectLineTargets(
    caster: IBattleParticipant,
    allTargets: IBattleParticipant[],
    battleContext?: any
  ): IBattleParticipant[] {
    const aliveTargets = allTargets.filter(t => t.status.alive);
    
    if (aliveTargets.length === 0) return [];
    
    // Pour simplifier : tous les ennemis en front-line sont touchés
    // En ligne droite = positions 1-2 prioritaires, puis 3-5
    const isPlayerTeam = battleContext?.allPlayers?.includes(caster) || false;
    const targetPositions = isPlayerTeam ? 
      (battleContext?.enemyPositions || new Map()) : 
      (battleContext?.playerPositions || new Map());
    
    // Séparer front et back
    const frontLine = aliveTargets.filter(t => {
      const pos = targetPositions.get?.(t.heroId) || 1;
      return pos <= 2; // Positions 1-2
    });
    
    const backLine = aliveTargets.filter(t => {
      const pos = targetPositions.get?.(t.heroId) || 3;
      return pos >= 3; // Positions 3-5
    });
    
    // Logique linéaire : frappe le front d'abord, puis peut atteindre le back
    const lineTargets: IBattleParticipant[] = [];
    
    // Toujours toucher le front-line
    lineTargets.push(...frontLine);
    
    // Si peu d'ennemis en front, l'attaque traverse vers le back
    if (frontLine.length <= 1 && backLine.length > 0) {
      // Prendre 1-2 ennemis du back-line aussi
      const backTargets = backLine.slice(0, 2);
      lineTargets.push(...backTargets);
      
      console.log(`🌋⚡ Fissure puissante ! L'attaque traverse vers l'arrière`);
    }
    
    return lineTargets;
  }
  
  // ----- Méthodes statiques pour intégration -----
  
  /**
   * Vérifier si un participant a le buff de défense Magma
   */
  static hasMagmaDefense(participant: IBattleParticipant): boolean {
    if (!participant.status.alive) return false;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "magma_defense"
    );
    
    return activeEffect !== undefined;
  }
  
  /**
   * Obtenir le bonus de défense actuel
   */
  static getDefenseBonus(participant: IBattleParticipant): number {
    if (!this.hasMagmaDefense(participant)) return 0;
    
    const activeEffect = (participant as any).activeEffects?.find(
      (e: any) => e.id === "magma_defense"
    );
    
    return activeEffect?.metadata?.defenseBonus || 10;
  }
  
  /**
   * Appliquer le bonus de défense aux calculs
   */
  static applyDefenseBonus(
    defender: IBattleParticipant,
    baseDefense: number
  ): number {
    if (!this.hasMagmaDefense(defender)) return baseDefense;
    
    const bonus = this.getDefenseBonus(defender);
    const enhancedDefense = Math.floor(baseDefense * (1 + bonus / 100));
    
    console.log(`🌋🛡️ Défense Magma: +${bonus}% défense (${baseDefense} → ${enhancedDefense})`);
    
    return enhancedDefense;
  }
  
  // ----- Détails de calcul -----
  
  /**
   * Dégâts de la fissure linéaire
   */
  private getLineDamage(caster: IBattleParticipant, spellLevel: number): number {
    // Dégâts élevés : niveau 1: 180 → niveau 10: 400
    const baseDamage = Math.floor(180 + (spellLevel - 1) * 25);
    
    // Bonus selon ATK du caster (attaque physique)
    const atkBonus = Math.floor(caster.stats.atk * 0.9);
    
    return baseDamage + atkBonus;
  }
  
  /**
   * Durée du stun
   * 1.2 secondes → 1-2 tours
   */
  private getStunDuration(spellLevel: number): number {
    // Base 1 tour, +1 tous les 5 niveaux
    return Math.min(3, 1 + Math.floor((spellLevel - 1) / 5));
  }
  
  /**
   * Bonus de défense conditionnel
   */
  private getDefenseBonus(spellLevel: number): number {
    // 10% base, +1% par niveau (max 19% au niveau 10)
    return Math.min(20, 10 + (spellLevel - 1) * 1);
  }
  
  /**
   * Durée du buff de défense
   * 5 secondes → 5 tours
   */
  private getDefenseDuration(spellLevel: number): number {
    // Base 5 tours, +1 tous les 4 niveaux
    return Math.min(7, 5 + Math.floor((spellLevel - 1) / 4));
  }
  
  /**
   * Vérifications supplémentaires
   */
  protected additionalCanCastChecks(caster: IBattleParticipant, spellLevel: number): boolean {
    // Ne peut pas être lancé sous silence
    if (caster.status.debuffs.includes("silenced")) {
      return false;
    }
    
    return true;
  }
}

// Exports
export const magmaPunchSpell = new MagmaPunchSpell();
export { MagmaPunchSpell };

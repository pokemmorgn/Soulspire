import { IBattleParticipant, IBattleAction, IBattleResult } from "../models/Battle";

export class BattleEngine {
  private playerTeam: IBattleParticipant[];
  private enemyTeam: IBattleParticipant[];
  private actions: IBattleAction[];
  private currentTurn: number;
  private battleStartTime: number;

  constructor(playerTeam: IBattleParticipant[], enemyTeam: IBattleParticipant[]) {
    this.playerTeam = [...playerTeam];
    this.enemyTeam = [...enemyTeam];
    this.actions = [];
    this.currentTurn = 1;
    this.battleStartTime = Date.now();
    
    // Initialiser l'état de combat pour tous les participants
    this.initializeBattleState();
  }

  // Initialise l'état de combat (HP, énergie, etc.)
  private initializeBattleState(): void {
    const allParticipants = [...this.playerTeam, ...this.enemyTeam];
    
    for (const participant of allParticipants) {
      participant.currentHp = participant.stats.hp;
      participant.energy = 0;
      participant.status = {
        alive: true,
        buffs: [],
        debuffs: []
      };
    }
  }

  // Lance le combat complet et retourne le résultat
  public simulateBattle(): IBattleResult {
    console.log("🔥 Combat démarré !");
    
    while (!this.isBattleOver()) {
      this.processTurn();
      this.currentTurn++;
      
      // Sécurité : éviter les combats infinis
      if (this.currentTurn > 100) {
        console.warn("⚠️ Combat arrêté après 100 tours");
        break;
      }
    }

    const result = this.generateBattleResult();
    console.log(`🏆 Combat terminé ! Victoire: ${result.victory ? "Joueur" : "Ennemi"}`);
    
    return result;
  }

  // Traite un tour de combat
  private processTurn(): void {
    // Récupérer tous les participants vivants
    const aliveParticipants = this.getAllAliveParticipants();
    
    // Trier par vitesse (plus rapide agit en premier)
    aliveParticipants.sort((a, b) => b.stats.speed - a.stats.speed);
    
    // Chaque participant agit
    for (const participant of aliveParticipants) {
      if (!participant.status.alive) continue;
      
      const action = this.determineAction(participant);
      this.executeAction(action);
      
      // Vérifier si le combat est terminé après chaque action
      if (this.isBattleOver()) break;
    }
    
    // Appliquer les effets de fin de tour (DOT, buffs/debuffs)
    this.applyEndOfTurnEffects();
  }

  // Détermine quelle action un participant va effectuer
  private determineAction(participant: IBattleParticipant): IBattleAction {
    const isPlayerTeam = this.playerTeam.includes(participant);
    const targets = isPlayerTeam ? this.getAliveEnemies() : this.getAlivePlayers();
    
    // Si peut utiliser l'ultimate (énergie = 100)
    if (participant.energy >= 100) {
      return this.createUltimateAction(participant, targets);
    }
    
    // Sinon, attaque normale
    return this.createAttackAction(participant, targets);
  }

  // Crée une action d'attaque normale
  private createAttackAction(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleAction {
    // Choisir la cible (pour l'instant, cible aléatoire)
    const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    
    const baseDamage = actor.stats.atk;
    const defense = target.stats.def;
    const elementalMultiplier = this.getElementalAdvantage(actor.element, target.element);
    
    // Calcul des dégâts : (ATQ - DEF/2) * multiplicateur élémentaire
    let damage = Math.max(1, Math.floor((baseDamage - defense / 2) * elementalMultiplier));
    
    // Chance de critique (10% base + bonus selon rareté)
    const critChance = this.getCriticalChance(actor);
    const isCritical = Math.random() < critChance;
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
    }
    
    return {
      turn: this.currentTurn,
      actionType: "attack",
      actorId: actor.heroId,
      actorName: actor.name,
      targetIds: [target.heroId],
      damage,
      energyGain: 15, // Gain d'énergie par attaque
      critical: isCritical,
      elementalAdvantage: elementalMultiplier,
      buffsApplied: [],
      debuffsApplied: [],
      participantsAfter: {} // Sera rempli dans executeAction
    };
  }

  // Crée une action d'ultimate
  private createUltimateAction(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleAction {
    const baseDamage = actor.stats.atk * 2.5; // Ultimate = 2.5x dégâts
    
    // Ultimate peut cibler tous les ennemis (AoE)
    const damage = Math.floor(baseDamage * this.getRarityMultiplier(actor.rarity));
    
    return {
      turn: this.currentTurn,
      actionType: "ultimate",
      actorId: actor.heroId,
      actorName: actor.name,
      targetIds: possibleTargets.map(t => t.heroId),
      damage,
      energyGain: 0,
      energyCost: 100, // Coûte toute l'énergie
      critical: true, // Ultimate = toujours critique
      elementalAdvantage: 1.2, // Bonus élémentaire sur ultimate
      buffsApplied: [],
      debuffsApplied: [],
      participantsAfter: {}
    };
  }

  // Exécute une action et applique ses effets
  private executeAction(action: IBattleAction): void {
    // Appliquer les dégâts
    if (action.damage && action.damage > 0) {
      for (const targetId of action.targetIds) {
        const target = this.findParticipant(targetId);
        if (target && target.status.alive) {
          target.currentHp = Math.max(0, target.currentHp - action.damage);
          
          if (target.currentHp === 0) {
            target.status.alive = false;
            console.log(`💀 ${target.name} est KO !`);
          }
        }
      }
    }
    
    // Modifier l'énergie de l'acteur
    const actor = this.findParticipant(action.actorId);
    if (actor) {
      if (action.energyGain) {
        actor.energy = Math.min(100, actor.energy + action.energyGain);
      }
      if (action.energyCost) {
        actor.energy = Math.max(0, actor.energy - action.energyCost);
      }
    }
    
    // Capturer l'état après l'action
    action.participantsAfter = this.captureParticipantsState();
    
    // Ajouter l'action à l'historique
    this.actions.push(action);
    
    console.log(`⚔️ ${action.actorName} utilise ${action.actionType} et inflige ${action.damage} dégâts`);
  }

  // Capture l'état actuel de tous les participants
  private captureParticipantsState(): any {
    const state: any = {};
    const allParticipants = [...this.playerTeam, ...this.enemyTeam];
    
    for (const participant of allParticipants) {
      state[participant.heroId] = {
        currentHp: participant.currentHp,
        energy: participant.energy,
        buffs: [...participant.status.buffs],
        debuffs: [...participant.status.debuffs],
        alive: participant.status.alive
      };
    }
    
    return state;
  }

  // Applique les effets de fin de tour (DOT, buffs expirés, etc.)
  private applyEndOfTurnEffects(): void {
    // Pour l'instant, juste nettoyer les effets expirés
    // TODO: Implémenter les DOT, buffs temporaires, etc.
  }

  // Vérifie si le combat est terminé
  private isBattleOver(): boolean {
    const alivePlayers = this.getAlivePlayers().length;
    const aliveEnemies = this.getAliveEnemies().length;
    
    return alivePlayers === 0 || aliveEnemies === 0;
  }

  // Génère le résultat final du combat
  private generateBattleResult(): IBattleResult {
    const alivePlayers = this.getAlivePlayers().length;
    const victory = alivePlayers > 0;
    const battleDuration = Date.now() - this.battleStartTime;
    
    // Calculer les statistiques
    const stats = this.calculateBattleStats();
    
    // Calculer les récompenses (si victoire)
    const rewards = victory ? this.calculateRewards() : {
      experience: 0,
      gold: 0,
      items: [],
      fragments: []
    };
    
    return {
      victory,
      winnerTeam: victory ? "player" : "enemy",
      totalTurns: this.currentTurn - 1,
      battleDuration,
      rewards,
      stats
    };
  }

  // Calcule les statistiques du combat
  private calculateBattleStats() {
    let totalDamageDealt = 0;
    let totalHealingDone = 0;
    let criticalHits = 0;
    let ultimatesUsed = 0;
    
    for (const action of this.actions) {
      if (action.damage) totalDamageDealt += action.damage;
      if (action.healing) totalHealingDone += action.healing;
      if (action.critical) criticalHits++;
      if (action.actionType === "ultimate") ultimatesUsed++;
    }
    
    return {
      totalDamageDealt,
      totalHealingDone,
      criticalHits,
      ultimatesUsed
    };
  }

  // Calcule les récompenses de victoire
  private calculateRewards() {
    // Récompenses basiques pour l'instant
    const baseExp = 100;
    const baseGold = 50;
    
    return {
      experience: baseExp,
      gold: baseGold,
      items: [],
      fragments: []
    };
  }

  // Utilitaires pour les calculs de combat
  private getElementalAdvantage(attackerElement: string, defenderElement: string): number {
    const advantages: { [key: string]: string[] } = {
      Fire: ["Wind"],
      Water: ["Fire"],
      Wind: ["Electric"],
      Electric: ["Water"],
      Light: ["Dark"],
      Dark: ["Light"]
    };
    
    if (advantages[attackerElement]?.includes(defenderElement)) return 1.5;
    if (advantages[defenderElement]?.includes(attackerElement)) return 0.75;
    return 1.0;
  }

  private getCriticalChance(participant: IBattleParticipant): number {
    const baseChance = 0.1; // 10%
    const rarityBonus = this.getRarityMultiplier(participant.rarity) * 0.05;
    return Math.min(0.5, baseChance + rarityBonus); // Max 50%
  }

  private getRarityMultiplier(rarity: string): number {
    const multipliers: { [key: string]: number } = {
      Common: 1.0,
      Rare: 1.25,
      Epic: 1.5,
      Legendary: 2.0
    };
    return multipliers[rarity] || 1.0;
  }

  // Utilitaires pour trouver les participants
  private findParticipant(heroId: string): IBattleParticipant | undefined {
    return [...this.playerTeam, ...this.enemyTeam].find(p => p.heroId === heroId);
  }

  private getAllAliveParticipants(): IBattleParticipant[] {
    return [...this.playerTeam, ...this.enemyTeam].filter(p => p.status.alive);
  }

  private getAlivePlayers(): IBattleParticipant[] {
    return this.playerTeam.filter(p => p.status.alive);
  }

  private getAliveEnemies(): IBattleParticipant[] {
    return this.enemyTeam.filter(p => p.status.alive);
  }

  // Getter pour récupérer les actions (pour le replay)
  public getActions(): IBattleAction[] {
    return [...this.actions];
  }
}

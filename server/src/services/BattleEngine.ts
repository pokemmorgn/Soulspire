import { IBattleParticipant, IBattleAction, IBattleResult } from "../models/Battle";
import { SpellManager, HeroSpells } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/effects/burn";

export class BattleEngine {
  private playerTeam: IBattleParticipant[];
  private enemyTeam: IBattleParticipant[];
  private actions: IBattleAction[];
  private currentTurn: number;
  private battleStartTime: number;
  private playerSpells: Map<string, HeroSpells>; // heroId -> sorts du héros
  private enemySpells: Map<string, HeroSpells>;

  constructor(
    playerTeam: IBattleParticipant[], 
    enemyTeam: IBattleParticipant[],
    playerSpells?: Map<string, HeroSpells>,
    enemySpells?: Map<string, HeroSpells>
  ) {
    this.playerTeam = [...playerTeam];
    this.enemyTeam = [...enemyTeam];
    this.actions = [];
    this.currentTurn = 1;
    this.battleStartTime = Date.now();
    this.playerSpells = playerSpells || new Map();
    this.enemySpells = enemySpells || new Map();
    
    // Initialiser l'état de combat pour tous les participants
    this.initializeBattleState();
    
    // Initialiser le SpellManager
    SpellManager.initialize();
  }

  // Initialise l'état de combat (HP, énergie, effets, etc.)
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
      
      // Initialiser les effets actifs
      (participant as any).activeEffects = [];
    }
  }

  // Lance le combat complet et retourne le résultat
  public simulateBattle(): IBattleResult {
    console.log("🔥 Combat démarré !");
    
    while (!this.isBattleOver()) {
      this.processTurn();
      this.currentTurn++;
      
      // Sécurité : éviter les combats infinis
      if (this.currentTurn > 200) {
        console.warn("⚠️ Combat arrêté après 200 tours");
        break;
      }
    }

    const result = this.generateBattleResult();
    console.log(`🏆 Combat terminé ! Victoire: ${result.victory ? "Joueur" : "Ennemi"}`);
    
    return result;
  }

  // Traite un tour de combat
  private processTurn(): void {
    // Réduire les cooldowns des sorts
    SpellManager.reduceCooldowns();
    
    // Récupérer tous les participants vivants et les trier par vitesse
    const aliveParticipants = this.getAllAliveParticipants()
      .sort((a, b) => {
        // Vitesse + petit bonus aléatoire pour éviter les égalités
        const speedA = a.stats.speed + Math.random() * 10;
        const speedB = b.stats.speed + Math.random() * 10;
        return speedB - speedA; // Plus rapide en premier
      });
    
    // Chaque participant agit selon sa vitesse
    for (const participant of aliveParticipants) {
      if (!participant.status.alive) continue;
      
      // Générer de l'énergie en début de tour
      this.generateEnergy(participant);
      
      // Traiter les effets actifs (DOT, etc.)
      this.processParticipantEffects(participant);
      
      // Si le participant meurt des effets, passer au suivant
      if (!participant.status.alive) continue;
      
      // Déterminer et exécuter l'action
      const action = this.determineAction(participant);
      if (action) {
        this.executeAction(action);
      }
      
      // Vérifier si le combat est terminé après chaque action
      if (this.isBattleOver()) break;
    }
    
    console.log(`🔄 Tour ${this.currentTurn} terminé`);
  }

  // Génère de l'énergie pour un participant selon son moral
  private generateEnergy(participant: IBattleParticipant): void {
    if (!participant.status.alive) return;
    
    // Énergie basée sur le moral + petite part aléatoire
    const baseGeneration = Math.floor(10 + ((participant.stats as any).moral || 60) / 8);
    const energyGain = Math.floor(baseGeneration + Math.random() * 5);
    
    participant.energy = Math.min(100, participant.energy + energyGain);
  }

  // Traite les effets actifs d'un participant
  private processParticipantEffects(participant: IBattleParticipant): void {
    const effectResults = EffectManager.processEffects(participant);
    
    for (const result of effectResults) {
      if (result.damage && result.damage > 0) {
        participant.currentHp = Math.max(0, participant.currentHp - result.damage);
        
        if (participant.currentHp === 0) {
          participant.status.alive = false;
          console.log(`💀 ${participant.name} succombe aux effets !`);
        }
      }
      
      if (result.healing && result.healing > 0) {
        participant.currentHp = Math.min(participant.stats.maxHp, participant.currentHp + result.healing);
      }
      
      if (result.message) {
        console.log(result.message);
      }
    }
  }

  // Détermine quelle action un participant va effectuer
  private determineAction(participant: IBattleParticipant): IBattleAction | null {
    const isPlayerTeam = this.playerTeam.includes(participant);
    const targets = isPlayerTeam ? this.getAliveEnemies() : this.getAlivePlayers();
    const allies = isPlayerTeam ? this.getAlivePlayers() : this.getAliveEnemies();
    
    // Récupérer les sorts du héros
    const heroSpells = isPlayerTeam ? 
      this.playerSpells.get(participant.heroId) : 
      this.enemySpells.get(participant.heroId);
    
    if (!heroSpells) {
      // Pas de sorts configurés, attaque basique
      return this.createAttackAction(participant, targets);
    }
    
    // Utiliser le SpellManager pour déterminer le meilleur sort
    const battleContext = {
      currentTurn: this.currentTurn,
      allPlayers: this.getAlivePlayers(),
      allEnemies: this.getAliveEnemies()
    };
    
    const bestSpell = SpellManager.determineBestSpell(
      participant,
      heroSpells,
      allies,
      targets,
      battleContext
    );
    
    if (bestSpell) {
      try {
        // Lancer le sort via SpellManager
        return SpellManager.castSpell(
          bestSpell.spellId,
          participant,
          targets,
          bestSpell.spellLevel,
          battleContext
        );
      } catch (error) {
        console.warn(`⚠️ Erreur lors du cast de ${bestSpell.spellId}: ${error}`);
        // Fallback sur attaque basique
        return this.createAttackAction(participant, targets);
      }
    }
    
    // Aucun sort disponible, attaque basique
    return this.createAttackAction(participant, targets);
  }

  // Crée une action d'attaque normale
  private createAttackAction(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleAction {
    const target = this.selectTarget(actor, possibleTargets);
    
    const damage = this.calculateDamage(actor, target, "attack");
    const isCritical = this.rollCritical(actor);
    const finalDamage = isCritical ? Math.floor(damage * 1.75) : damage;
    
    return {
      turn: this.currentTurn,
      actionType: "attack",
      actorId: actor.heroId,
      actorName: actor.name,
      targetIds: [target.heroId],
      damage: finalDamage,
      energyGain: Math.floor(12 + Math.random() * 8), // 12-20 énergie
      critical: isCritical,
      elementalAdvantage: this.getElementalAdvantage(actor.element, target.element),
      buffsApplied: [],
      debuffsApplied: [],
      participantsAfter: {}
    };
  }

  // Supprime toutes les anciennes méthodes de création de sorts
  // Elles sont maintenant gérées par SpellManager

  // Crée une action d'ultimate
  private createUltimateAction(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleAction {
    const baseUltimateDamage = actor.stats.atk * 3.5 * this.getRarityMultiplier(actor.rarity);
    
    // Ultimate peut être single-target ou AoE selon le rôle
    const isAoE = actor.role === "DPS Ranged" || Math.random() < 0.4;
    const targets = isAoE ? possibleTargets : [this.selectTarget(actor, possibleTargets)];
    const damageMultiplier = isAoE ? 0.8 : 1.2;
    
    const damage = Math.floor(baseUltimateDamage * damageMultiplier);
    
    return {
      turn: this.currentTurn,
      actionType: "ultimate",
      actorId: actor.heroId,
      actorName: actor.name,
      targetIds: targets.map(t => t.heroId),
      damage,
      energyGain: 0,
      energyCost: 100,
      critical: true, // Ultimate = toujours critique
      elementalAdvantage: 1.5, // Bonus élémentaire sur ultimate
      buffsApplied: isAoE ? [] : ["devastation"],
      debuffsApplied: isAoE ? ["burn", "weakness"] : ["armor_break"],
      participantsAfter: {}
    };
  }

  // Calcule les dégâts en tenant compte des nouvelles stats
  private calculateDamage(
    attacker: IBattleParticipant, 
    defender: IBattleParticipant, 
    attackType: "attack" | "skill" | "ultimate"
  ): number {
    const attackerStats = attacker.stats as any;
    const defenderStats = defender.stats as any;
    
    // Attaque de base
    let baseAttack = attackerStats.atk;
    
    // Bonus selon le type d'attaque
    if (attackType === "skill") {
      baseAttack += Math.floor((attackerStats.intelligence || 70) * 0.4);
      baseAttack *= 1.6; // Compétence = 60% de bonus
    } else if (attackType === "ultimate") {
      baseAttack += Math.floor((attackerStats.intelligence || 70) * 0.6);
      baseAttack *= 2.5; // Ultimate = 150% de bonus
    }
    
    // Bonus de force pour les attaques physiques
    if (attacker.role === "DPS Melee" || attacker.role === "Tank") {
      baseAttack += Math.floor((attackerStats.force || 80) * 0.3);
    }
    
    // Défense applicable (physique ou magique)
    let defense = defenderStats.def;
    if (attackType === "skill" || attackType === "ultimate") {
      // Attaques magiques utilisent la défense magique
      defense = Math.floor((defenderStats.defMagique || defense) * 0.7 + defense * 0.3);
    }
    
    // Calcul des dégâts : (Attaque - Défense/2) avec minimum de 1
    let damage = Math.max(1, baseAttack - Math.floor(defense / 2));
    
    // Multiplicateur élémentaire
    damage *= this.getElementalAdvantage(attacker.element, defender.element);
    
    // Multiplicateur de rareté
    damage *= this.getRarityMultiplier(attacker.rarity);
    
    // Variation aléatoire (±10%)
    damage *= (0.9 + Math.random() * 0.2);
    
    return Math.floor(damage);
  }

  // Sélectionne une cible intelligemment
  private selectTarget(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleParticipant {
    if (possibleTargets.length === 1) return possibleTargets[0];
    
    // IA simple : cibler selon le rôle
    if (actor.role === "DPS Melee" || actor.role === "DPS Ranged") {
      // DPS ciblent les supports puis les autres DPS
      const supports = possibleTargets.filter(t => t.role === "Support");
      if (supports.length > 0) return supports[0];
      
      const otherDps = possibleTargets.filter(t => t.role.includes("DPS"));
      if (otherDps.length > 0) return otherDps[0];
    }
    
    // Cibler l'ennemi avec le moins de HP relatif
    return possibleTargets.reduce((weakest, target) => 
      (target.currentHp / target.stats.maxHp) < (weakest.currentHp / weakest.stats.maxHp) ? target : weakest
    );
  }

  // Teste si un critique est réussi
  private rollCritical(participant: IBattleParticipant): boolean {
    const baseChance = 0.08; // 8% de base
    const vitesseBonus = ((participant.stats as any).vitesse || 80) / 1000; // Bonus de vitesse
    const rarityBonus = this.getRarityMultiplier(participant.rarity) * 0.02;
    
    const totalChance = Math.min(0.5, baseChance + vitesseBonus + rarityBonus); // Max 50%
    return Math.random() < totalChance;
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
    
    // Appliquer les soins
    if (action.healing && action.healing > 0) {
      for (const targetId of action.targetIds) {
        const target = this.findParticipant(targetId);
        if (target && target.status.alive) {
          target.currentHp = Math.min(target.stats.maxHp, target.currentHp + action.healing);
        }
      }
    }
    
    // Appliquer les buffs
    if (action.buffsApplied && action.buffsApplied.length > 0) {
      for (const targetId of action.targetIds) {
        const target = this.findParticipant(targetId);
        if (target && target.status.alive) {
          for (const buff of action.buffsApplied) {
            if (!target.status.buffs.includes(buff)) {
              target.status.buffs.push(buff);
            }
          }
        }
      }
    }
    
    // Appliquer les debuffs
    if (action.debuffsApplied && action.debuffsApplied.length > 0) {
      for (const targetId of action.targetIds) {
        const target = this.findParticipant(targetId);
        if (target && target.status.alive) {
          for (const debuff of action.debuffsApplied) {
            if (!target.status.debuffs.includes(debuff)) {
              target.status.debuffs.push(debuff);
            }
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
    
    const actionDesc = action.actionType === "ultimate" ? "ULTIMATE" :
                      action.actionType === "skill" ? "compétence" : "attaque";
    console.log(`⚔️ ${action.actorName} utilise ${actionDesc} et inflige ${action.damage || 0} dégâts${action.healing ? `, soigne ${action.healing}` : ""}`);
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

  // Applique les effets de fin de tour
  private applyEndOfTurnEffects(): void {
    const allParticipants = [...this.playerTeam, ...this.enemyTeam];
    
    for (const participant of allParticipants) {
      if (!participant.status.alive) continue;
      
      // Appliquer les DOT (damage over time)
      if (participant.status.debuffs.includes("burn")) {
        const dotDamage = Math.floor(participant.stats.maxHp * 0.05);
        participant.currentHp = Math.max(0, participant.currentHp - dotDamage);
        console.log(`🔥 ${participant.name} subit ${dotDamage} dégâts de brûlure`);
      }
      
      if (participant.status.debuffs.includes("poison")) {
        const dotDamage = Math.floor(participant.stats.maxHp * 0.03);
        participant.currentHp = Math.max(0, participant.currentHp - dotDamage);
        console.log(`☠️ ${participant.name} subit ${dotDamage} dégâts de poison`);
      }
      
      // Appliquer les HOT (heal over time)
      if (participant.status.buffs.includes("regeneration")) {
        const hotHeal = Math.floor(participant.stats.maxHp * 0.08);
        participant.currentHp = Math.min(participant.stats.maxHp, participant.currentHp + hotHeal);
        console.log(`💚 ${participant.name} récupère ${hotHeal} HP par régénération`);
      }
      
      // Vérifier si le participant meurt des DOT
      if (participant.currentHp === 0) {
        participant.status.alive = false;
        console.log(`💀 ${participant.name} succombe aux effets !`);
      }
      
      // Nettoyer certains effets temporaires (50% de chance)
      if (Math.random() < 0.3) {
        participant.status.buffs = participant.status.buffs.filter(buff => 
          !["attack_boost", "defense_up", "speed_up"].includes(buff)
        );
        participant.status.debuffs = participant.status.debuffs.filter(debuff => 
          !["slow", "weakness", "confusion"].includes(debuff)
        );
      }
    }
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
      // Compter seulement les actions du joueur
      if (this.playerTeam.some(p => p.heroId === action.actorId)) {
        if (action.damage) totalDamageDealt += action.damage;
        if (action.healing) totalHealingDone += action.healing;
        if (action.critical) criticalHits++;
        if (action.actionType === "ultimate") ultimatesUsed++;
      }
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
    const baseExp = 80 + this.currentTurn * 2;
    const baseGold = 40 + this.currentTurn;
    
    // Bonus selon la performance
    const performanceMultiplier = this.currentTurn < 10 ? 1.5 : this.currentTurn < 20 ? 1.2 : 1.0;
    
    return {
      experience: Math.floor(baseExp * performanceMultiplier),
      gold: Math.floor(baseGold * performanceMultiplier),
      items: [],
      fragments: []
    };
  }

  // === UTILITAIRES ===
  
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

  private getRarityMultiplier(rarity: string): number {
    const multipliers: { [key: string]: number } = {
      Common: 1.0,
      Rare: 1.15,
      Epic: 1.35,
      Legendary: 1.7
    };
    return multipliers[rarity] || 1.0;
  }

  // Supprime les anciennes méthodes utilitaires de sorts
  // Maintenant gérées par SpellManager et BaseSpell

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

  // Méthode utilitaire pour debug
  public getTeamsStatus(): { playerTeam: any[], enemyTeam: any[] } {
    return {
      playerTeam: this.playerTeam.map(p => ({
        name: p.name,
        hp: `${p.currentHp}/${p.stats.maxHp}`,
        energy: p.energy,
        alive: p.status.alive
      })),
      enemyTeam: this.enemyTeam.map(p => ({
        name: p.name,
        hp: `${p.currentHp}/${p.stats.maxHp}`,
        energy: p.energy,
        alive: p.status.alive
      }))
    };
  }
}

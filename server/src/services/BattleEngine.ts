import { IBattleParticipant, IBattleAction, IBattleResult } from "../models/Battle";
import { SpellManager, HeroSpells } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";

// Interface pour les options de combat
export interface IBattleOptions {
  mode: "auto" | "manual";
  speed: 1 | 2 | 3;
  playerVipLevel?: number; // Pour vérifier les droits de vitesse
}

// Interface pour les actions manuelles en attente
export interface IPendingManualAction {
  heroId: string;
  actionType: "ultimate" | "skill";
  targetIds?: string[];
  timestamp: number;
}

export class BattleEngine {
  private playerTeam: IBattleParticipant[];
  private enemyTeam: IBattleParticipant[];
  private actions: IBattleAction[];
  private currentTurn: number;
  private battleStartTime: number;
  private playerSpells: Map<string, HeroSpells>;
  private enemySpells: Map<string, HeroSpells>;
  
  // NOUVEAU: Options de combat
  private battleOptions: IBattleOptions;
  private pendingManualActions: IPendingManualAction[];
  private actualBattleDuration: number; // Durée réelle sans accélération
  
  // NOUVEAU: Callback pour demander actions manuelles (optionnel)
  private onRequestManualAction?: (heroId: string, availableActions: string[]) => Promise<IPendingManualAction | null>;

  constructor(
    playerTeam: IBattleParticipant[], 
    enemyTeam: IBattleParticipant[],
    playerSpells?: Map<string, HeroSpells>,
    enemySpells?: Map<string, HeroSpells>,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ) {
    this.playerTeam = [...playerTeam];
    this.enemyTeam = [...enemyTeam];
    this.actions = [];
    this.currentTurn = 1;
    this.battleStartTime = Date.now();
    this.playerSpells = playerSpells || new Map();
    this.enemySpells = enemySpells || new Map();
    
    // NOUVEAU: Initialiser les options de combat
    this.battleOptions = this.validateBattleOptions(battleOptions);
    this.pendingManualActions = [];
    this.actualBattleDuration = 0;
    
    this.initializeBattleState();
    SpellManager.initialize();
    
    console.log(`🎮 Combat démarré en mode ${this.battleOptions.mode} (vitesse x${this.battleOptions.speed})`);
  }
  
  // NOUVEAU: Valide et ajuste les options de combat selon les privilèges
  private validateBattleOptions(options: IBattleOptions): IBattleOptions {
    const validated = { ...options };
    
    // Vérifier les droits de vitesse
    const vipLevel = options.playerVipLevel || 0;
    const maxSpeed = this.getMaxAllowedSpeed(vipLevel);
    
    if (validated.speed > maxSpeed) {
      console.warn(`⚠️ Vitesse x${validated.speed} non autorisée (VIP ${vipLevel}), limitée à x${maxSpeed}`);
      validated.speed = maxSpeed as 1 | 2 | 3;
    }
    
    return validated;
  }
  
  // NOUVEAU: Détermine la vitesse maximale selon le niveau VIP
  private getMaxAllowedSpeed(vipLevel: number): number {
    if (vipLevel >= 5) return 3; // VIP 5+ : x3
    if (vipLevel >= 2) return 2; // VIP 2+ : x2
    return 1; // Gratuit : x1 seulement
  }
  
  // NOUVEAU: Setter pour le callback d'actions manuelles
  public setManualActionCallback(callback: (heroId: string, availableActions: string[]) => Promise<IPendingManualAction | null>) {
    this.onRequestManualAction = callback;
  }
  
  // NOUVEAU: Ajouter une action manuelle en attente
  public addManualAction(action: IPendingManualAction): boolean {
    // Vérifier que l'action est valide
    if (!this.isValidManualAction(action)) {
      console.warn(`⚠️ Action manuelle invalide:`, action);
      return false;
    }
    
    // Supprimer les anciennes actions du même héros
    this.pendingManualActions = this.pendingManualActions.filter(a => a.heroId !== action.heroId);
    
    // Ajouter la nouvelle action
    this.pendingManualActions.push(action);
    console.log(`🎯 Action manuelle ajoutée: ${action.actionType} pour ${action.heroId}`);
    
    return true;
  }
  
  // NOUVEAU: Valide qu'une action manuelle est possible
  private isValidManualAction(action: IPendingManualAction): boolean {
    const hero = this.findParticipant(action.heroId);
    if (!hero || !hero.status.alive) return false;
    
    // Vérifier que le héros est dans l'équipe du joueur
    if (!this.playerTeam.includes(hero)) return false;
    
    // Vérifier l'énergie pour l'ultimate
    if (action.actionType === "ultimate" && hero.energy < 100) return false;
    
    // Vérifier le cooldown pour les skills
    if (action.actionType === "skill") {
      const heroSpells = this.playerSpells.get(hero.heroId);
      if (!heroSpells) return false;
      
      // Vérifier qu'au moins un sort est disponible
      const hasAvailableSkill = [heroSpells.spell1, heroSpells.spell2, heroSpells.spell3]
        .some(spell => spell && !SpellManager.isOnCooldown(hero.heroId, spell.id));
      
      if (!hasAvailableSkill) return false;
    }
    
    return true;
  }

  // Initialise l'état de combat (inchangé)
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
      
      (participant as any).activeEffects = [];
    }
  }

  // Lance le combat complet et retourne le résultat
  public simulateBattle(): IBattleResult {
    console.log("🔥 Combat démarré !");
    const battleStartTime = Date.now();
    
    while (!this.isBattleOver()) {
      this.processTurn();
      this.currentTurn++;
      
      // Sécurité : éviter les combats infinis
      if (this.currentTurn > 200) {
        console.warn("⚠️ Combat arrêté après 200 tours");
        break;
      }
    }

    // NOUVEAU: Calculer la durée réelle vs accélérée
    this.actualBattleDuration = Date.now() - battleStartTime;
    const simulatedDuration = Math.floor(this.actualBattleDuration / this.battleOptions.speed);

    const result = this.generateBattleResult();
    // NOUVEAU: Ajouter les infos de combat dans le résultat
    (result as any).battleOptions = this.battleOptions;
    (result as any).actualDuration = this.actualBattleDuration;
    
    console.log(`🏆 Combat terminé ! Victoire: ${result.victory ? "Joueur" : "Ennemi"}`);
    console.log(`⏱️ Durée: ${simulatedDuration}ms (réelle: ${this.actualBattleDuration}ms, vitesse x${this.battleOptions.speed})`);
    
    return result;
  }

  // MODIFIÉ: Traite un tour de combat avec support manuel
  private processTurn(): void {
    SpellManager.reduceCooldowns();
    
    const aliveParticipants = this.getAllAliveParticipants()
      .sort((a, b) => {
        const speedA = a.stats.speed + Math.random() * 10;
        const speedB = b.stats.speed + Math.random() * 10;
        return speedB - speedA;
      });
    
    for (const participant of aliveParticipants) {
      if (!participant.status.alive) continue;
      
      this.generateEnergy(participant);
      this.processParticipantEffects(participant);
      
      if (!participant.status.alive) continue;
      
      // NOUVEAU: Déterminer l'action selon le mode
      const action = this.determineActionWithMode(participant);
      if (action) {
        this.executeAction(action);
      }
      
      if (this.isBattleOver()) break;
    }
    
    console.log(`🔄 Tour ${this.currentTurn} terminé`);
  }
  
  // NOUVEAU: Détermine l'action selon le mode auto/manuel
  private determineActionWithMode(participant: IBattleParticipant): IBattleAction | null {
    const isPlayerTeam = this.playerTeam.includes(participant);
    
    // Pour les ennemis, toujours en mode auto
    if (!isPlayerTeam) {
      return this.determineAction(participant);
    }
    
    // Pour les héros du joueur, selon le mode
    if (this.battleOptions.mode === "auto") {
      return this.determineAction(participant);
    } else {
      // Mode manuel : vérifier s'il y a une action en attente
      return this.determineManualAction(participant);
    }
  }
  
  // NOUVEAU: Détermine l'action en mode manuel
  private determineManualAction(participant: IBattleParticipant): IBattleAction | null {
    // Chercher une action manuelle en attente pour ce héros
    const manualActionIndex = this.pendingManualActions.findIndex(a => a.heroId === participant.heroId);
    
    if (manualActionIndex !== -1) {
      const manualAction = this.pendingManualActions[manualActionIndex];
      
      // Supprimer l'action de la file d'attente
      this.pendingManualActions.splice(manualActionIndex, 1);
      
      try {
        // Exécuter l'action manuelle
        return this.executeManualAction(participant, manualAction);
      } catch (error) {
        console.warn(`⚠️ Erreur action manuelle: ${error}`);
        // Fallback sur attaque basique
        return this.createAttackAction(participant, this.getAliveEnemies());
      }
    }
    
    // Pas d'action manuelle en attente
    if (participant.energy >= 100) {
      // Ultimate disponible mais en attente d'action manuelle
      console.log(`⏳ ${participant.name} attend une action manuelle (Ultimate disponible)`);
      
      // Si on a un callback, demander l'action
      if (this.onRequestManualAction) {
        // Note: En mode serveur, on ne peut pas attendre de réponse asynchrone
        // Cette partie sera gérée côté client
      }
      
      // Pour l'instant, attaque basique
      return this.createAttackAction(participant, this.getAliveEnemies());
    }
    
    // Vérifier les skills disponibles
    const heroSpells = this.playerSpells.get(participant.heroId);
    if (heroSpells) {
      const availableSkills = [heroSpells.spell1, heroSpells.spell2, heroSpells.spell3]
        .filter(spell => spell && !SpellManager.isOnCooldown(participant.heroId, spell.id));
      
      if (availableSkills.length > 0) {
        console.log(`⏳ ${participant.name} attend une action manuelle (${availableSkills.length} skills disponibles)`);
        // En attente d'action manuelle, attaque basique pour l'instant
        return this.createAttackAction(participant, this.getAliveEnemies());
      }
    }
    
    // Aucun sort disponible, attaque basique
    return this.createAttackAction(participant, this.getAliveEnemies());
  }
  
  // NOUVEAU: Exécute une action manuelle spécifique
  private executeManualAction(participant: IBattleParticipant, manualAction: IPendingManualAction): IBattleAction {
    const targets = this.getAliveEnemies();
    const allies = this.getAlivePlayers();
    
    if (manualAction.actionType === "ultimate") {
      const heroSpells = this.playerSpells.get(participant.heroId);
      if (heroSpells?.ultimate) {
        const battleContext = {
          currentTurn: this.currentTurn,
          allPlayers: allies,
          allEnemies: targets
        };
        
        return SpellManager.castSpell(
          heroSpells.ultimate.id,
          participant,
          targets,
          heroSpells.ultimate.level,
          battleContext
        );
      }
    } else if (manualAction.actionType === "skill") {
      // Utiliser le meilleur sort disponible (pour simplifier)
      const heroSpells = this.playerSpells.get(participant.heroId);
      if (heroSpells) {
        const bestSpell = SpellManager.determineBestSpell(
          participant,
          heroSpells,
          allies,
          targets,
          { currentTurn: this.currentTurn, allPlayers: allies, allEnemies: targets }
        );
        
        if (bestSpell) {
          return SpellManager.castSpell(
            bestSpell.spellId,
            participant,
            targets,
            bestSpell.spellLevel,
            { currentTurn: this.currentTurn, allPlayers: allies, allEnemies: targets }
          );
        }
      }
    }
    
    // Fallback : attaque basique
    return this.createAttackAction(participant, targets);
  }

  // Génère de l'énergie pour un participant (inchangé)
  private generateEnergy(participant: IBattleParticipant): void {
    if (!participant.status.alive) return;
    
    const baseGeneration = Math.floor(10 + ((participant.stats as any).moral || 60) / 8);
    const energyGain = Math.floor(baseGeneration + Math.random() * 5);
    
    participant.energy = Math.min(100, participant.energy + energyGain);
  }

  // Traite les effets actifs d'un participant (inchangé)
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

  // INCHANGÉ: Détermine quelle action un participant va effectuer (mode auto)
  private determineAction(participant: IBattleParticipant): IBattleAction | null {
    const isPlayerTeam = this.playerTeam.includes(participant);
    const targets = isPlayerTeam ? this.getAliveEnemies() : this.getAlivePlayers();
    const allies = isPlayerTeam ? this.getAlivePlayers() : this.getAliveEnemies();
    
    const heroSpells = isPlayerTeam ? 
      this.playerSpells.get(participant.heroId) : 
      this.enemySpells.get(participant.heroId);
    
    if (!heroSpells) {
      return this.createAttackAction(participant, targets);
    }
    
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
        return SpellManager.castSpell(
          bestSpell.spellId,
          participant,
          targets,
          bestSpell.spellLevel,
          battleContext
        );
      } catch (error) {
        console.warn(`⚠️ Erreur lors du cast de ${bestSpell.spellId}: ${error}`);
        return this.createAttackAction(participant, targets);
      }
    }
    
    return this.createAttackAction(participant, targets);
  }

  // INCHANGÉ: Reste du code existant...
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
      energyGain: Math.floor(12 + Math.random() * 8),
      critical: isCritical,
      elementalAdvantage: this.getElementalAdvantage(actor.element, target.element),
      buffsApplied: [],
      debuffsApplied: [],
      participantsAfter: {}
    };
  }

  private createUltimateAction(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleAction {
    const baseUltimateDamage = actor.stats.atk * 3.5 * this.getRarityMultiplier(actor.rarity);
    
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
      critical: true,
      elementalAdvantage: 1.5,
      buffsApplied: isAoE ? [] : ["devastation"],
      debuffsApplied: isAoE ? ["burn", "weakness"] : ["armor_break"],
      participantsAfter: {}
    };
  }

  private calculateDamage(
    attacker: IBattleParticipant, 
    defender: IBattleParticipant, 
    attackType: "attack" | "skill" | "ultimate"
  ): number {
    const attackerStats = attacker.stats as any;
    const defenderStats = defender.stats as any;
    
    let baseAttack = attackerStats.atk;
    
    if (attackType === "skill") {
      baseAttack += Math.floor((attackerStats.intelligence || 70) * 0.4);
      baseAttack *= 1.6;
    } else if (attackType === "ultimate") {
      baseAttack += Math.floor((attackerStats.intelligence || 70) * 0.6);
      baseAttack *= 2.5;
    }
    
    if (attacker.role === "DPS Melee" || attacker.role === "Tank") {
      baseAttack += Math.floor((attackerStats.force || 80) * 0.3);
    }
    
    let defense = defenderStats.def;
    if (attackType === "skill" || attackType === "ultimate") {
      defense = Math.floor((defenderStats.defMagique || defense) * 0.7 + defense * 0.3);
    }
    
    let damage = Math.max(1, baseAttack - Math.floor(defense / 2));
    damage *= this.getElementalAdvantage(attacker.element, defender.element);
    damage *= this.getRarityMultiplier(attacker.rarity);
    damage *= (0.9 + Math.random() * 0.2);
    
    return Math.floor(damage);
  }

  private selectTarget(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleParticipant {
    if (possibleTargets.length === 1) return possibleTargets[0];
    
    if (actor.role === "DPS Melee" || actor.role === "DPS Ranged") {
      const supports = possibleTargets.filter(t => t.role === "Support");
      if (supports.length > 0) return supports[0];
      
      const otherDps = possibleTargets.filter(t => t.role.includes("DPS"));
      if (otherDps.length > 0) return otherDps[0];
    }
    
    return possibleTargets.reduce((weakest, target) => 
      (target.currentHp / target.stats.maxHp) < (weakest.currentHp / weakest.stats.maxHp) ? target : weakest
    );
  }

  private rollCritical(participant: IBattleParticipant): boolean {
    const baseChance = 0.08;
    const vitesseBonus = ((participant.stats as any).vitesse || 80) / 1000;
    const rarityBonus = this.getRarityMultiplier(participant.rarity) * 0.02;
    
    const totalChance = Math.min(0.5, baseChance + vitesseBonus + rarityBonus);
    return Math.random() < totalChance;
  }

  private executeAction(action: IBattleAction): void {
    // NOUVEAU: Appliquer la vitesse de combat
    const speedMultiplier = this.battleOptions.speed;
    const baseActionDelay = 1000; // 1 seconde par action de base
    const actualDelay = Math.floor(baseActionDelay / speedMultiplier);
    
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
    
    if (action.healing && action.healing > 0) {
      for (const targetId of action.targetIds) {
        const target = this.findParticipant(targetId);
        if (target && target.status.alive) {
          target.currentHp = Math.min(target.stats.maxHp, target.currentHp + action.healing);
        }
      }
    }
    
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
    
    const actor = this.findParticipant(action.actorId);
    if (actor) {
      if (action.energyGain) {
        actor.energy = Math.min(100, actor.energy + action.energyGain);
      }
      if (action.energyCost) {
        actor.energy = Math.max(0, actor.energy - action.energyCost);
      }
    }
    
    action.participantsAfter = this.captureParticipantsState();
    this.actions.push(action);
    
    const actionDesc = action.actionType === "ultimate" ? "ULTIMATE" :
                      action.actionType === "skill" ? "compétence" : "attaque";
    console.log(`⚔️ ${action.actorName} utilise ${actionDesc} et inflige ${action.damage || 0} dégâts${action.healing ? `, soigne ${action.healing}` : ""}`);
  }

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

  private isBattleOver(): boolean {
    const alivePlayers = this.getAlivePlayers().length;
    const aliveEnemies = this.getAliveEnemies().length;
    
    return alivePlayers === 0 || aliveEnemies === 0;
  }

  private generateBattleResult(): IBattleResult {
    const alivePlayers = this.getAlivePlayers().length;
    const victory = alivePlayers > 0;
    
    // NOUVEAU: Utiliser la durée simulée selon la vitesse
    const simulatedDuration = Math.floor(this.actualBattleDuration / this.battleOptions.speed);
    
    const stats = this.calculateBattleStats();
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
      battleDuration: simulatedDuration, // Durée ajustée selon la vitesse
      rewards,
      stats
    };
  }

  private calculateBattleStats() {
    let totalDamageDealt = 0;
    let totalHealingDone = 0;
    let criticalHits = 0;
    let ultimatesUsed = 0;
    
    for (const action of this.actions) {
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

  private calculateRewards() {
    const baseExp = 80 + this.currentTurn * 2;
    const baseGold = 40 + this.currentTurn;
    
    const performanceMultiplier = this.currentTurn < 10 ? 1.5 : this.currentTurn < 20 ? 1.2 : 1.0;
    
    return {
      experience: Math.floor(baseExp * performanceMultiplier),
      gold: Math.floor(baseGold * performanceMultiplier),
      items: [],
      fragments: []
    };
  }

  // Utilitaires inchangés
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

  // NOUVEAU: Getters pour les nouvelles propriétés
  public getBattleOptions(): IBattleOptions {
    return { ...this.battleOptions };
  }
  
  public getPendingManualActions(): IPendingManualAction[] {
    return [...this.pendingManualActions];
  }
  
  public getActualDuration(): number {
    return this.actualBattleDuration;
  }

  // Getter pour récupérer les actions (pour le replay) - inchangé
  public getActions(): IBattleAction[] {
    return [...this.actions];
  }

  // NOUVEAU: Méthode pour obtenir les actions disponibles pour un héros en mode manuel
  public getAvailableManualActions(heroId: string): string[] {
    const hero = this.findParticipant(heroId);
    if (!hero || !hero.status.alive || !this.playerTeam.includes(hero)) {
      return [];
    }
    
    const available: string[] = [];
    
    // Ultimate disponible ?
    if (hero.energy >= 100) {
      available.push("ultimate");
    }
    
    // Skills disponibles ?
    const heroSpells = this.playerSpells.get(heroId);
    if (heroSpells) {
      const availableSkills = [heroSpells.spell1, heroSpells.spell2, heroSpells.spell3]
        .filter(spell => spell && !SpellManager.isOnCooldown(heroId, spell.id));
      
      if (availableSkills.length > 0) {
        available.push("skill");
      }
    }
    
    return available;
  }
  
  // NOUVEAU: Méthode pour obtenir le statut de tous les héros du joueur
  public getPlayerHeroesStatus(): Array<{
    heroId: string;
    name: string;
    currentHp: number;
    maxHp: number;
    energy: number;
    alive: boolean;
    availableActions: string[];
  }> {
    return this.playerTeam.map(hero => ({
      heroId: hero.heroId,
      name: hero.name,
      currentHp: hero.currentHp,
      maxHp: hero.stats.maxHp,
      energy: hero.energy,
      alive: hero.status.alive,
      availableActions: this.getAvailableManualActions(hero.heroId)
    }));
  }

  // Méthode utilitaire pour debug - MISE À JOUR
  public getTeamsStatus(): { playerTeam: any[], enemyTeam: any[], battleOptions: IBattleOptions } {
    return {
      playerTeam: this.playerTeam.map(p => ({
        name: p.name,
        hp: `${p.currentHp}/${p.stats.maxHp}`,
        energy: p.energy,
        alive: p.status.alive,
        availableActions: this.getAvailableManualActions(p.heroId)
      })),
      enemyTeam: this.enemyTeam.map(p => ({
        name: p.name,
        hp: `${p.currentHp}/${p.stats.maxHp}`,
        energy: p.energy,
        alive: p.status.alive
      })),
      battleOptions: this.battleOptions
    };
  }

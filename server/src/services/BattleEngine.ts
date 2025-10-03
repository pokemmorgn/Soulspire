import { IBattleParticipant, IBattleAction, IBattleResult, IWaveData } from "../models/Battle";
import { SpellManager, HeroSpells } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";

export interface IBattleOptions {
  mode: "auto" | "manual";
  speed: 1 | 2 | 3;
  playerVipLevel?: number;
}

export interface IWaveConfig {
  waveNumber: number;
  enemies: IBattleParticipant[];
  delay: number;
  isBossWave?: boolean;
  waveRewards?: {
    experience: number;
    gold: number;
    items?: string[];
    fragments?: { heroId: string; quantity: number }[];
  };
}

export interface IPendingManualAction {
  heroId: string;
  actionType: "ultimate";
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
  private battleOptions: IBattleOptions;
  private pendingManualActions: IPendingManualAction[];
  private actualBattleDuration: number;

  private playerPositions: Map<string, number>;
  private enemyPositions: Map<string, number>;
  private waveConfigs?: IWaveConfig[];
  private currentWave: number;
  private totalWaves: number;
  private waveData?: IWaveData;
  private isWaveBattle: boolean;
constructor(
    playerTeam: IBattleParticipant[], 
    enemyTeam: IBattleParticipant[],
    playerSpells?: Map<string, HeroSpells>,
    enemySpells?: Map<string, HeroSpells>,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 },
    waveConfigs?: IWaveConfig[]
  ) {
    this.playerTeam = [...playerTeam];
    this.enemyTeam = [...enemyTeam];
    this.actions = [];
    this.currentTurn = 1;
    this.battleStartTime = Date.now();
    this.playerSpells = playerSpells || new Map();
    this.enemySpells = enemySpells || new Map();
    this.battleOptions = this.validateBattleOptions(battleOptions);
    this.pendingManualActions = [];
    this.actualBattleDuration = 0;
    this.playerPositions = new Map();
    this.enemyPositions = new Map();
    this.waveConfigs = waveConfigs;
    this.currentWave = 1;
    this.totalWaves = waveConfigs?.length || 1;
    this.isWaveBattle = (waveConfigs && waveConfigs.length > 1) || false;
    
    if (this.isWaveBattle && this.waveConfigs) {
      this.waveData = {
        totalWaves: this.totalWaves,
        completedWaves: 0,
        currentWave: 1,
        waveRewards: [],
        playerStatePerWave: []
      };
      
      console.log(`🌊 Combat multi-vagues initialisé: ${this.totalWaves} vagues`);
    }
      // Stocker les positions des héros
      for (const hero of this.playerTeam) {
        this.playerPositions.set(hero.heroId, hero.position);
      }
      
      for (const enemy of this.enemyTeam) {
        this.enemyPositions.set(enemy.heroId, enemy.position);
      }
    this.initializeBattleState();
    SpellManager.initialize();
    
    console.log(`🎮 Combat démarré en mode ${this.battleOptions.mode} (vitesse x${this.battleOptions.speed})`);
    console.log(`👥 Formation joueur: ${this.getFormationSummary(this.playerTeam, this.playerPositions)}`);
    console.log(`👹 Formation ennemie: ${this.getFormationSummary(this.enemyTeam, this.enemyPositions)}`);
  }
  
  private validateBattleOptions(options: IBattleOptions): IBattleOptions {
    const validated = { ...options };
    const vipLevel = options.playerVipLevel || 0;
    const maxSpeed = this.getMaxAllowedSpeed(vipLevel);
    
    if (validated.speed > maxSpeed) {
      throw new Error(`Vitesse x${validated.speed} nécessite VIP ${this.getRequiredVipForSpeed(validated.speed)}+ (vous êtes VIP ${vipLevel})`);
    }
    
    return validated;
  }
  
  private getMaxAllowedSpeed(vipLevel: number): number {
    if (vipLevel >= 5) return 3;
    if (vipLevel >= 2) return 2;
    return 1;
  }
  
  private getRequiredVipForSpeed(speed: number): number {
    if (speed >= 3) return 5;
    if (speed >= 2) return 2;
    return 0;
  }
  
  public addManualUltimate(heroId: string): boolean {
    const hero = this.findParticipant(heroId);
    if (!hero || !hero.status.alive || !this.playerTeam.includes(hero) || hero.energy < 100) {
      return false;
    }
    
    this.pendingManualActions = this.pendingManualActions.filter(a => a.heroId !== heroId);
    this.pendingManualActions.push({
      heroId,
      actionType: "ultimate",
      timestamp: Date.now()
    });
    
    console.log(`🎯 Ultimate manuel ajouté pour ${hero.name}`);
    return true;
  }

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

  public simulateBattle(): IBattleResult {
      console.log("🔥 Combat démarré !");
      const battleStartTime = Date.now();
      
      // ✨ NOUVEAU : Combat multi-vagues
      if (this.isWaveBattle && this.waveConfigs) {
        return this.simulateWaveBattle();
      }
      
      // Combat classique (existant)
      while (!this.isBattleOver()) {
        this.processTurn();
        this.currentTurn++;
        
        if (this.currentTurn > 200) {
          console.warn("⚠️ Combat arrêté après 200 tours");
          break;
        }
      }

    this.actualBattleDuration = Date.now() - battleStartTime;
    const simulatedDuration = Math.floor(this.actualBattleDuration / this.battleOptions.speed);

    const result = this.generateBattleResult();
    (result as any).battleOptions = this.battleOptions;
    (result as any).actualDuration = this.actualBattleDuration;
    
    console.log(`🏆 Combat terminé ! Victoire: ${result.victory ? "Joueur" : "Ennemi"}`);
    console.log(`⏱️ Durée: ${simulatedDuration}ms (réelle: ${this.actualBattleDuration}ms, vitesse x${this.battleOptions.speed})`);
    
    return result;
  }

  // ✨ NOUVEAU : Simulation de combat avec vagues
  private simulateWaveBattle(): IBattleResult {
    console.log(`🌊 Combat multi-vagues: ${this.totalWaves} vagues`);
    const battleStartTime = Date.now();
    
    for (let wave = 1; wave <= this.totalWaves; wave++) {
      this.currentWave = wave;
      const waveConfig = this.waveConfigs![wave - 1];
      
      console.log(`\n🌊 === VAGUE ${wave}/${this.totalWaves} ${waveConfig.isBossWave ? '(BOSS)' : ''} ===`);
      
      // Spawn des ennemis de la vague
      this.spawnWaveEnemies(waveConfig.enemies);
      
      // Simuler le délai de spawn (en temps réel, pas en simulation)
      if (wave > 1 && waveConfig.delay > 0) {
        console.log(`⏳ Délai avant vague: ${waveConfig.delay}ms`);
        // Note: Le délai est conceptuel, on ne fait pas vraiment de setTimeout
      }
      
      // Combat jusqu'à victoire ou défaite de la vague
      let waveTurnLimit = 100; // Limite de tours par vague
      while (!this.isWaveOver() && waveTurnLimit > 0) {
        this.processTurn();
        this.currentTurn++;
        waveTurnLimit--;
        
        if (waveTurnLimit === 0) {
          console.warn(`⚠️ Vague ${wave} arrêtée après 100 tours`);
          break;
        }
      }
      
      // Vérifier le résultat de la vague
      const playerAlive = this.getAlivePlayers().length > 0;
      
      if (playerAlive) {
        // Victoire de la vague
        console.log(`✅ Vague ${wave} terminée!`);
        
        // Sauvegarder l'état des héros à la fin de la vague
        this.captureWaveState(wave);
        
        // Appliquer les récompenses de vague
        if (waveConfig.waveRewards && this.waveData) {
          this.waveData.waveRewards.push({
            waveNumber: wave,
            rewards: waveConfig.waveRewards
          });
          console.log(`💰 Récompenses vague ${wave}: ${waveConfig.waveRewards.gold} or, ${waveConfig.waveRewards.experience} XP`);
        }
        
        this.waveData!.completedWaves = wave;
        
        // Si c'était la dernière vague, victoire totale
        if (wave === this.totalWaves) {
          console.log(`🏆 Toutes les vagues terminées! VICTOIRE!`);
          break;
        }
        
        // Sinon, continuer avec la prochaine vague
        this.waveData!.currentWave = wave + 1;
        
      } else {
        // Défaite
        console.log(`💀 Défaite à la vague ${wave}`);
        this.waveData!.completedWaves = wave - 1; // Vague actuelle non complétée
        break;
      }
    }
    
    // Calcul de la durée
    this.actualBattleDuration = Date.now() - battleStartTime;
    const simulatedDuration = Math.floor(this.actualBattleDuration / this.battleOptions.speed);
    
    const result = this.generateBattleResult();
    (result as any).battleOptions = this.battleOptions;
    (result as any).actualDuration = this.actualBattleDuration;
    (result as any).waveData = this.waveData;
    
    console.log(`🏁 Combat terminé! Vagues complétées: ${this.waveData?.completedWaves}/${this.totalWaves}`);
    
    return result;
  }

  // ✨ NOUVEAU : Spawn des ennemis d'une vague
  private spawnWaveEnemies(newEnemies: IBattleParticipant[]): void {
    // Remplacer l'équipe ennemie par les nouveaux ennemis
    this.enemyTeam = [...newEnemies];
    
    // Réinitialiser les positions des ennemis
    this.enemyPositions.clear();
    for (const enemy of this.enemyTeam) {
      this.enemyPositions.set(enemy.heroId, enemy.position);
      
      // Initialiser l'état de combat
      enemy.currentHp = enemy.stats.hp;
      enemy.energy = 0;
      enemy.status = {
        alive: true,
        buffs: [],
        debuffs: []
      };
    }
    
    console.log(`👹 ${this.enemyTeam.length} ennemis spawned`);
  }

  // ✨ NOUVEAU : Vérifier si la vague actuelle est terminée
  private isWaveOver(): boolean {
    const aliveEnemies = this.getAliveEnemies().length;
    return aliveEnemies === 0;
  }

  // ✨ NOUVEAU : Capturer l'état de l'équipe à la fin d'une vague
  private captureWaveState(waveNumber: number): void {
    if (!this.waveData) return;
    
    const playerState = this.playerTeam.map(hero => ({
      heroId: hero.heroId,
      currentHp: hero.currentHp,
      energy: hero.energy,
      alive: hero.status.alive
    }));
    
    this.waveData.playerStatePerWave!.push({
      waveNumber,
      heroes: playerState
    });
    
    console.log(`📊 État équipe sauvegardé (vague ${waveNumber})`);
  }

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
      
      const action = this.determineActionWithMode(participant);
      if (action) {
        this.executeAction(action);
      }
      
      if (this.isBattleOver()) break;
    }
    
    console.log(`🔄 Tour ${this.currentTurn} terminé`);
  }
  
  private determineActionWithMode(participant: IBattleParticipant): IBattleAction | null {
    const isPlayerTeam = this.playerTeam.includes(participant);
    
    if (!isPlayerTeam) {
      return this.determineAction(participant);
    }
    
    if (this.battleOptions.mode === "auto") {
      return this.determineAction(participant);
    } else {
      return this.determineManualAction(participant);
    }
  }
  
  private determineManualAction(participant: IBattleParticipant): IBattleAction | null {
    const manualActionIndex = this.pendingManualActions.findIndex(a => a.heroId === participant.heroId);
    
    if (manualActionIndex !== -1 && participant.energy >= 100) {
      const manualAction = this.pendingManualActions[manualActionIndex];
      this.pendingManualActions.splice(manualActionIndex, 1);
      
      try {
        return this.executeManualUltimate(participant);
      } catch (error) {
        console.warn(`⚠️ Erreur ultimate manuel: ${error}`);
        return this.determineAction(participant);
      }
    }
    
    if (participant.energy >= 100) {
      console.log(`⏳ ${participant.name} attend un ultimate manuel`);
      return this.determineAction(participant, true);
    }
    
    return this.determineAction(participant);
  }
  
  private executeManualUltimate(participant: IBattleParticipant): IBattleAction {
    const targets = this.getAliveEnemies();
    const heroSpells = this.playerSpells.get(participant.heroId);
    
    if (heroSpells?.ultimate) {
      const battleContext = {
        currentTurn: this.currentTurn,
        allPlayers: this.getAlivePlayers(),
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
    
    return this.createUltimateAction(participant, targets);
  }

  private generateEnergy(participant: IBattleParticipant): void {
    if (!participant.status.alive) return;
    
    const baseGeneration = Math.floor(10 + ((participant.stats as any).moral || 60) / 8);
    const energyGain = Math.floor(baseGeneration + Math.random() * 5);
    
    participant.energy = Math.min(100, participant.energy + energyGain);
  }

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

private determineAction(participant: IBattleParticipant, skipUltimate: boolean = false): IBattleAction | null {
  const isPlayerTeam = this.playerTeam.includes(participant);
  
  // ✅ NOUVEAU : Utiliser getAvailableTargets pour respecter la protection du back-line
  const allEnemies = isPlayerTeam ? this.getAliveEnemies() : this.getAlivePlayers();
  const targets = this.getAvailableTargets(participant, allEnemies);
  
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
    
    if (bestSpell && (!skipUltimate || bestSpell.spellId !== heroSpells.ultimate?.id)) {
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

/**
 * Sélectionner une cible en fonction de la position et du rôle
 */
private selectTarget(actor: IBattleParticipant, possibleTargets: IBattleParticipant[]): IBattleParticipant {
  if (possibleTargets.length === 1) return possibleTargets[0];
  
  const isPlayerTeam = this.playerTeam.includes(actor);
  const actorPosition = isPlayerTeam ? 
    this.playerPositions.get(actor.heroId) : 
    this.enemyPositions.get(actor.heroId);
  
  const targetPositions = isPlayerTeam ? this.enemyPositions : this.playerPositions;
  
  // ✅ NOUVEAU : Logique de ciblage basée sur les positions
  
  // 1. Séparer front-line et back-line des cibles
  const frontLineTargets = possibleTargets.filter(t => {
    const pos = targetPositions.get(t.heroId);
    return pos !== undefined && pos <= 2; // Positions 1-2 = front
  });
  
  const backLineTargets = possibleTargets.filter(t => {
    const pos = targetPositions.get(t.heroId);
    return pos !== undefined && pos >= 3; // Positions 3-5 = back
  });
  
  // 2. Si acteur est en front (positions 1-2), il attaque prioritairement le front ennemi
  if (actorPosition !== undefined && actorPosition <= 2) {
    if (frontLineTargets.length > 0) {
      // Attaquer le front ennemi
      return this.selectBestTargetByRole(actor, frontLineTargets);
    }
    // Si pas de front, attaquer le back
    return this.selectBestTargetByRole(actor, backLineTargets);
  }
  
  // 3. Si acteur est en back (positions 3-5), il peut cibler n'importe où
  if (actorPosition !== undefined && actorPosition >= 3) {
    // DPS Range et Support visent souvent le back ennemi
    if (actor.role === "DPS Ranged" || actor.role === "Support") {
      // Priorité aux supports ennemis
      const enemySupports = backLineTargets.filter(t => t.role === "Support");
      if (enemySupports.length > 0) {
        return this.selectWeakestTarget(enemySupports);
      }
      
      // Sinon, viser le back
      if (backLineTargets.length > 0) {
        return this.selectBestTargetByRole(actor, backLineTargets);
      }
    }
    
    // Sinon, cibler selon le rôle (logique classique)
    return this.selectBestTargetByRole(actor, possibleTargets);
  }
  
  // 4. Fallback : sélection classique
  return this.selectBestTargetByRole(actor, possibleTargets);
}

/**
 * Sélectionner la meilleure cible selon le rôle de l'acteur
 */
private selectBestTargetByRole(actor: IBattleParticipant, targets: IBattleParticipant[]): IBattleParticipant {
  if (targets.length === 0) return targets[0];
  
  // DPS et Tanks visent les supports en priorité
  if (actor.role === "DPS Melee" || actor.role === "DPS Ranged" || actor.role === "Tank") {
    const supports = targets.filter(t => t.role === "Support");
    if (supports.length > 0) {
      return this.selectWeakestTarget(supports);
    }
    
    // Sinon, viser les autres DPS
    const otherDps = targets.filter(t => t.role.includes("DPS"));
    if (otherDps.length > 0) {
      return this.selectWeakestTarget(otherDps);
    }
  }
  
  // Support vise le plus faible (pour focus fire)
  return this.selectWeakestTarget(targets);
}

/**
 * Sélectionner la cible la plus faible (% HP)
 */
private selectWeakestTarget(targets: IBattleParticipant[]): IBattleParticipant {
  return targets.reduce((weakest, target) => 
    (target.currentHp / target.stats.maxHp) < (weakest.currentHp / weakest.stats.maxHp) ? target : weakest
  );
}

  /**
 * Obtenir les cibles disponibles (avec protection du back-line)
 */
private getAvailableTargets(attacker: IBattleParticipant, allTargets: IBattleParticipant[]): IBattleParticipant[] {
  const isPlayerTeam = this.playerTeam.includes(attacker);
  const targetPositions = isPlayerTeam ? this.enemyPositions : this.playerPositions;
  
  // Séparer front et back
  const frontLine = allTargets.filter(t => {
    const pos = targetPositions.get(t.heroId);
    return t.status.alive && pos !== undefined && pos <= 2;
  });
  
  const backLine = allTargets.filter(t => {
    const pos = targetPositions.get(t.heroId);
    return t.status.alive && pos !== undefined && pos >= 3;
  });
  
  // ✅ RÈGLE PRINCIPALE : Si le front-line est vivant, le back-line est protégé
  if (frontLine.length > 0) {
    // Seul le front est ciblable
    return frontLine;
  } else {
    // Front mort = back exposé, tout est ciblable
    if (backLine.length > 0) {
      console.log(`🛡️ Front-line éliminé ! Back-line maintenant exposé.`);
    }
    return allTargets.filter(t => t.status.alive);
  }
}
  private rollCritical(participant: IBattleParticipant): boolean {
    const baseChance = 0.08;
    const vitesseBonus = ((participant.stats as any).vitesse || 80) / 1000;
    const rarityBonus = this.getRarityMultiplier(participant.rarity) * 0.02;
    
    const totalChance = Math.min(0.5, baseChance + vitesseBonus + rarityBonus);
    return Math.random() < totalChance;
  }

  private executeAction(action: IBattleAction): void {
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
    if (this.isWaveBattle) {
      (action as any).waveNumber = this.currentWave;
    }
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
      battleDuration: simulatedDuration,
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

  public getBattleOptions(): IBattleOptions {
    return { ...this.battleOptions };
  }
  
  public getPendingManualActions(): IPendingManualAction[] {
    return [...this.pendingManualActions];
  }
  
  public getActualDuration(): number {
    return this.actualBattleDuration;
  }

  public getActions(): IBattleAction[] {
    return [...this.actions];
  }

  public getAvailableUltimates(): string[] {
    const available: string[] = [];
    
    for (const hero of this.playerTeam) {
      if (hero.status.alive && hero.energy >= 100) {
        available.push(hero.heroId);
      }
    }
    
    return available;
  }
  
  public getPlayerHeroesStatus(): Array<{
    heroId: string;
    name: string;
    currentHp: number;
    maxHp: number;
    energy: number;
    alive: boolean;
    canUltimate: boolean;
  }> {
    return this.playerTeam.map(hero => ({
      heroId: hero.heroId,
      name: hero.name,
      currentHp: hero.currentHp,
      maxHp: hero.stats.maxHp,
      energy: hero.energy,
      alive: hero.status.alive,
      canUltimate: hero.energy >= 100
    }));
  }

  public getTeamsStatus(): { playerTeam: any[], enemyTeam: any[], battleOptions: IBattleOptions } {
    return {
      playerTeam: this.playerTeam.map(p => ({
        name: p.name,
        hp: `${p.currentHp}/${p.stats.maxHp}`,
        energy: p.energy,
        alive: p.status.alive,
        canUltimate: p.energy >= 100
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
  /**
 * Résumé de formation pour les logs
 */
private getFormationSummary(team: IBattleParticipant[], positions: Map<string, number>): string {
  const summary = team.map(hero => `${hero.name}(${positions.get(hero.heroId)})`).join(", ");
  return summary;
}
public getWaveData(): IWaveData | undefined {
    return this.waveData;
  }
  
public isMultiWaveBattle(): boolean {
    return this.isWaveBattle;
  }
}

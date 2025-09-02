import { IBattleParticipant, IBattleAction, IBattleResult } from "../models/Battle";
import { SpellManager, HeroSpells } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";

export interface IBattleOptions {
  mode: "auto" | "manual";
  speed: 1 | 2 | 3;
  playerVipLevel?: number;
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
    this.battleOptions = this.validateBattleOptions(battleOptions);
    this.pendingManualActions = [];
    this.actualBattleDuration = 0;
    
    this.initializeBattleState();
    SpellManager.initialize();
    
    console.log(`🎮 Combat démarré en mode ${this.battleOptions.mode} (vitesse x${this.battleOptions.speed})`);
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
}

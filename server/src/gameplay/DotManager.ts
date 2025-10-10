// server/src/gameplay/DotManager.ts
import { IBattleParticipant } from "../models/Battle";
import { PoisonEffect } from "./effects/dot/poison";
import { BleedEffect } from "./effects/dot/bleed";
import { CorrosionEffect } from "./effects/dot/corrosion";

/**
 * Gestionnaire centralisé pour tous les effets secondaires des DoT
 * Évite de polluer le BattleEngine avec des imports multiples
 */
export class DotManager {
  
  /**
   * Appliquer la réduction de soins du Poison
   * @param target - Cible qui reçoit les soins
   * @param baseHealing - Montant de soins de base
   * @returns Montant de soins après réduction
   */
  static applyHealingReduction(target: IBattleParticipant, baseHealing: number): number {
    const poisonReduction = PoisonEffect.getHealingReduction(target);
    
    if (poisonReduction > 0) {
      const reducedAmount = Math.floor(baseHealing * (poisonReduction / 100));
      const finalHealing = baseHealing - reducedAmount;
      
      console.log(`☠️ Poison réduit les soins de ${target.name} de ${poisonReduction}% (-${reducedAmount} HP)`);
      
      return finalHealing;
    }
    
    return baseHealing;
  }
  
  /**
   * Appliquer les dégâts de Bleed si la cible attaque
   * @param actor - Participant qui effectue une attaque
   * @returns Dégâts de saignement aggravé (0 si pas de bleed)
   */
  static applyBleedMovementDamage(actor: IBattleParticipant): number {
    if (!BleedEffect.isBleeding(actor)) {
      return 0;
    }
    
    const bleedDamage = BleedEffect.applyBleedMovementDamage(actor);
    
    if (bleedDamage > 0) {
      actor.currentHp = Math.max(0, actor.currentHp - bleedDamage);
      
      if (actor.currentHp === 0) {
        actor.status.alive = false;
        console.log(`💀 ${actor.name} meurt de son saignement aggravé !`);
      }
    }
    
    return bleedDamage;
  }
  
  /**
   * Appliquer la réduction de défense de la Corrosion
   * @param target - Cible dont on calcule la défense
   * @param baseDefense - Défense de base
   * @returns Défense après réduction
   */
  static applyDefenseReduction(target: IBattleParticipant, baseDefense: number): number {
    const corrosionReduction = CorrosionEffect.getDefenseReduction(target);
    
    if (corrosionReduction > 0) {
      const finalDefense = CorrosionEffect.applyDefenseReduction(target, baseDefense);
      console.log(`🧪 Corrosion réduit la défense de ${target.name} de ${corrosionReduction}% (${baseDefense} → ${finalDefense})`);
      return finalDefense;
    }
    
    return baseDefense;
  }
  
  /**
   * Vérifier si une cible a un DoT actif
   * @param target - Cible à vérifier
   * @param dotId - ID du DoT ("burn", "poison", "bleed", "corrosion")
   * @returns true si le DoT est actif
   */
  static hasDoT(target: IBattleParticipant, dotId: string): boolean {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return false;
    
    return activeEffects.some((effect: any) => effect.id === dotId);
  }
  
  /**
   * Obtenir tous les DoT actifs d'une cible
   * @param target - Cible à analyser
   * @returns Liste des IDs de DoT actifs
   */
  static getActiveDoTs(target: IBattleParticipant): string[] {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return [];
    
    const dotIds = ["burn", "poison", "bleed", "corrosion"];
    return activeEffects
      .filter((effect: any) => dotIds.includes(effect.id))
      .map((effect: any) => effect.id);
  }
  
  /**
   * Calculer les dégâts totaux de DoT par tour pour une cible
   * Utile pour l'UI ou les estimations
   * @param target - Cible à analyser
   * @returns Estimation des dégâts par tour
   */
  static estimateTotalDoTDamage(target: IBattleParticipant): number {
    // Note: Estimation approximative, les vrais dégâts dépendent de onTick()
    const activeDoTs = this.getActiveDoTs(target);
    let totalEstimate = 0;
    
    for (const dotId of activeDoTs) {
      const effect = (target as any).activeEffects.find((e: any) => e.id === dotId);
      if (!effect) continue;
      
      // Estimation grossière basée sur % HP
      switch (dotId) {
        case "burn":
          totalEstimate += target.stats.maxHp * 0.04 * (1 + (effect.stacks - 1) * 0.5);
          break;
        case "poison":
          totalEstimate += target.stats.maxHp * 0.03 * (1 + (effect.stacks - 1) * 0.4);
          break;
        case "bleed":
          totalEstimate += target.stats.maxHp * 0.05 * (1 + (effect.stacks - 1) * 0.5);
          break;
        case "corrosion":
          totalEstimate += target.stats.maxHp * 0.035 * (1 + (effect.stacks - 1) * 0.3);
          break;
      }
    }
    
    return Math.floor(totalEstimate);
  }
  
  /**
   * Obtenir un résumé des DoT actifs pour l'UI
   * @param target - Cible à analyser
   * @returns Résumé lisible
   */
  static getDoTSummary(target: IBattleParticipant): string {
    const activeDoTs = this.getActiveDoTs(target);
    
    if (activeDoTs.length === 0) {
      return "Aucun DoT actif";
    }
    
    const summary = activeDoTs.map(dotId => {
      const effect = (target as any).activeEffects.find((e: any) => e.id === dotId);
      const emoji = dotId === "burn" ? "🔥" : 
                    dotId === "poison" ? "☠️" : 
                    dotId === "bleed" ? "🩸" : "🧪";
      return `${emoji} ${dotId} x${effect.stacks}`;
    }).join(", ");
    
    const estimatedDamage = this.estimateTotalDoTDamage(target);
    
    return `${summary} (~${estimatedDamage} dégâts/tour)`;
  }
}

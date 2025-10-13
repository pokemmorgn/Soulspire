// server/src/gameplay/effects/buffs/shield.ts
import { IBattleParticipant } from "../../../models/Battle";
import { BaseEffect, IEffectConfig, EffectResult } from "../base/BaseEffect";

/**
 * Effet Shield (Bouclier)
 * - Absorbe des dégâts avant qu'ils n'affectent les HP
 * - Non stackable (le plus grand bouclier remplace)
 * - Durée variable (2-6 tours)
 * - Peut être brisé avant expiration
 * - Utilisé par : Brakka, Korran, Albert, Grathul, Pyra
 */
export class ShieldEffect extends BaseEffect {
  constructor() {
    const config: IEffectConfig = {
      id: "shield",
      name: "Bouclier",
      description: "Absorbe des dégâts avant les HP",
      type: "buff",
      category: "special_mechanic",
      stackable: false,
      maxStacks: 1,
      baseDuration: 3
    };
    
    super(config);
  }
  
  onApply(target: IBattleParticipant, appliedBy: IBattleParticipant): EffectResult {
    return {
      message: `🛡️ ${target.name} reçoit un bouclier protecteur !`
    };
  }
  
  onTick(target: IBattleParticipant, stacks: number, appliedBy: IBattleParticipant): EffectResult {
    const shieldHp = this.getShieldHp(target);
    
    return {
      message: `🛡️ ${target.name} est protégé par un bouclier (${shieldHp} HP restants)`
    };
  }
  
onRemove(target: IBattleParticipant): EffectResult {
  const activeEffects = (target as any).activeEffects as any[];
  if (!activeEffects) {
    return { message: `💔 Le bouclier de ${target.name} se brise` };
  }
  
  const shieldEffect = activeEffects.find((e: any) => e.id === "shield");
  
  // Si c'est un bouclier Lava Core, déclencher l'explosion
  if (shieldEffect?.metadata?.isLavaCore && shieldEffect.metadata.explosionDamage) {
    return {
      message: `💥🌋 Le Cœur de Lave de ${target.name} explose !`,
      damage: shieldEffect.metadata.explosionDamage
    };
  }
  
  // ✅ NOUVEAU : Si c'est une Tourelle Thermique, déclencher l'explosion
  if (shieldEffect?.metadata?.isThermalTurret && shieldEffect.metadata.explosionDamage) {
    return {
      message: `💥🔧 La Tourelle de ${target.name} explose !`,
      damage: shieldEffect.metadata.explosionDamage
    };
  }
  
  // Sinon, message normal
  return {
    message: `💔 Le bouclier de ${target.name} se brise`
  };
}
  
  canApplyTo(target: IBattleParticipant, appliedBy: IBattleParticipant): boolean {
    return true;
  }
  
  /**
   * Obtenir les HP actuels du bouclier d'une cible
   */
  static getShieldHp(target: IBattleParticipant): number {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return 0;
    
    const shieldEffect = activeEffects.find((effect: any) => effect.id === "shield");
    if (!shieldEffect || !shieldEffect.metadata) return 0;
    
    return shieldEffect.metadata.shieldHp || 0;
  }
  
  private getShieldHp(target: IBattleParticipant): number {
    return ShieldEffect.getShieldHp(target);
  }
  
  /**
   * Définir les HP du bouclier
   */
  static setShieldHp(target: IBattleParticipant, shieldHp: number): void {
    const activeEffects = (target as any).activeEffects as any[];
    if (!activeEffects) return;
    
    const shieldEffect = activeEffects.find((effect: any) => effect.id === "shield");
    if (!shieldEffect) return;
    
    if (!shieldEffect.metadata) {
      shieldEffect.metadata = {};
    }
    
    shieldEffect.metadata.shieldHp = Math.max(0, shieldHp);
    
    if (shieldEffect.metadata.shieldHp === 0) {
      const index = activeEffects.indexOf(shieldEffect);
      if (index > -1) {
        activeEffects.splice(index, 1);
        console.log(`💔 Le bouclier de ${target.name} se brise complètement`);
      }
    }
  }
  
  /**
   * Vérifier si une cible a un bouclier actif
   */
  static hasShield(target: IBattleParticipant): boolean {
    return this.getShieldHp(target) > 0;
  }
  
  /**
   * Absorber des dégâts avec le bouclier
   */
  static absorbDamage(target: IBattleParticipant, incomingDamage: number): {
    damageTaken: number;
    damageBlocked: number;
  } {
    const shieldHp = this.getShieldHp(target);
    
    if (shieldHp === 0) {
      return {
        damageTaken: incomingDamage,
        damageBlocked: 0
      };
    }
    
    if (incomingDamage <= shieldHp) {
      this.setShieldHp(target, shieldHp - incomingDamage);
      
      console.log(`🛡️ Le bouclier de ${target.name} absorbe ${incomingDamage} dégâts (${shieldHp - incomingDamage} HP restants)`);
      
      return {
        damageTaken: 0,
        damageBlocked: incomingDamage
      };
    } else {
      const remainingDamage = incomingDamage - shieldHp;
      this.setShieldHp(target, 0);
      
      console.log(`🛡️💔 Le bouclier de ${target.name} absorbe ${shieldHp} dégâts puis se brise ! ${remainingDamage} dégâts passent.`);
      
      return {
        damageTaken: remainingDamage,
        damageBlocked: shieldHp
      };
    }
  }
  
  /**
   * Appliquer un nouveau bouclier ou remplacer l'existant si plus grand
   */
  static applyOrReplaceShield(
    target: IBattleParticipant,
    newShieldHp: number,
    duration: number,
    appliedBy: IBattleParticipant
  ): boolean {
    const currentShieldHp = this.getShieldHp(target);
    
    if (currentShieldHp === 0 || newShieldHp > currentShieldHp) {
      console.log(`🛡️ Nouveau bouclier appliqué : ${newShieldHp} HP (ancien: ${currentShieldHp})`);
      return true;
    } else {
      console.log(`🛡️ Bouclier existant plus grand (${currentShieldHp} > ${newShieldHp}), conservé`);
      return false;
    }
  }
  
  /**
   * Obtenir le pourcentage de bouclier restant
   */
  static getShieldPercentage(target: IBattleParticipant, maxShieldHp: number): number {
    const currentShieldHp = this.getShieldHp(target);
    if (maxShieldHp === 0) return 0;
    
    return Math.floor((currentShieldHp / maxShieldHp) * 100);
  }
}

export const shieldEffect = new ShieldEffect();

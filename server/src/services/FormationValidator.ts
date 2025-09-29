// server/src/services/FormationValidator.ts
import Player from "../models/Player";
import Formation from "../models/Formation";
import { IFormationSlot } from "../models/Formation";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FormationValidationOptions {
  allowEmpty?: boolean;
  checkHeroOwnership?: boolean;
  checkDuplicatePositions?: boolean;
  checkPositionRange?: boolean;
  checkMaxSlots?: boolean;
  checkHeroAvailability?: boolean;
}

export class FormationValidator {
  private static readonly MAX_SLOTS = 5;
  private static readonly MIN_POSITION = 1;
  private static readonly MAX_POSITION = 5;
  private static readonly FRONT_LINE_POSITIONS = [1, 2];
  private static readonly BACK_LINE_POSITIONS = [3, 4, 5];

  /**
   * Validation complète d'une formation
   */
  static async validateFormation(
    playerId: string,
    serverId: string,
    slots: IFormationSlot[],
    options: FormationValidationOptions = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Options par défaut
    const opts = {
      allowEmpty: false,
      checkHeroOwnership: true,
      checkDuplicatePositions: true,
      checkPositionRange: true,
      checkMaxSlots: true,
      checkHeroAvailability: true,
      ...options
    };

    // 1. Vérifier que la formation n'est pas vide
    if (!opts.allowEmpty && slots.length === 0) {
      errors.push("Formation cannot be empty");
      return { valid: false, errors, warnings };
    }

    // 2. Vérifier le nombre maximum de slots
    if (opts.checkMaxSlots && slots.length > this.MAX_SLOTS) {
      errors.push(`Formation cannot have more than ${this.MAX_SLOTS} heroes`);
    }

    // 3. Vérifier les positions valides
    if (opts.checkPositionRange) {
      for (const slot of slots) {
        if (slot.slot < this.MIN_POSITION || slot.slot > this.MAX_POSITION) {
          errors.push(`Invalid position ${slot.slot}. Must be between ${this.MIN_POSITION} and ${this.MAX_POSITION}`);
        }
      }
    }

    // 4. Vérifier les doublons de position
    if (opts.checkDuplicatePositions) {
      const positions = slots.map(s => s.slot);
      const uniquePositions = new Set(positions);
      if (positions.length !== uniquePositions.size) {
        const duplicates = positions.filter((pos, index) => positions.indexOf(pos) !== index);
        errors.push(`Duplicate positions found: ${[...new Set(duplicates)].join(', ')}`);
      }
    }

    // 5. Vérifier que les héros appartiennent au joueur
    if (opts.checkHeroOwnership) {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      
      if (!player) {
        errors.push("Player not found");
        return { valid: false, errors, warnings };
      }

      for (const slot of slots) {
        const heroOwned = player.heroes.find((h: any) => 
          h._id?.toString() === slot.heroId
        );
        
        if (!heroOwned) {
          errors.push(`Hero ${slot.heroId} is not owned by player`);
        } else {
          // Vérifier que le héros a des données valides
          const heroData = heroOwned.heroId;
          if (!heroData || typeof heroData === 'string') {
            errors.push(`Hero ${slot.heroId} data not found`);
          }
        }
      }
    }

    // 6. Vérifier qu'un héros n'est pas utilisé deux fois
    const heroIds = slots.map(s => s.heroId);
    const uniqueHeroIds = new Set(heroIds);
    if (heroIds.length !== uniqueHeroIds.size) {
      const duplicates = heroIds.filter((id, index) => heroIds.indexOf(id) !== index);
      errors.push(`Same hero used multiple times: ${[...new Set(duplicates)].join(', ')}`);
    }

    // 7. Vérifier que les héros ne sont pas dans une autre formation active
    if (opts.checkHeroAvailability) {
      const activeFormation = await Formation.findOne({
        playerId,
        serverId,
        isActive: true
      });

      if (activeFormation) {
        const usedHeroIds = activeFormation.slots.map(s => s.heroId);
        const conflicts = slots.filter(slot => usedHeroIds.includes(slot.heroId));
        
        if (conflicts.length > 0) {
          warnings.push(
            `${conflicts.length} hero(es) are in the active formation and will be moved`
          );
        }
      }
    }

    // 8. Warnings pour composition d'équipe
    if (slots.length > 0 && opts.checkHeroOwnership) {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      
      if (player) {
        const compositionWarnings = this.checkTeamComposition(slots, player.heroes);
        warnings.push(...compositionWarnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validation rapide (sans accès DB)
   */
  static validateFormationStructure(slots: IFormationSlot[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifier le nombre de slots
    if (slots.length > this.MAX_SLOTS) {
      errors.push(`Formation cannot have more than ${this.MAX_SLOTS} heroes`);
    }

    // Vérifier les positions
    for (const slot of slots) {
      if (slot.slot < this.MIN_POSITION || slot.slot > this.MAX_POSITION) {
        errors.push(`Invalid position ${slot.slot}`);
      }

      if (!slot.heroId || typeof slot.heroId !== 'string' || slot.heroId.trim() === '') {
        errors.push(`Invalid heroId for position ${slot.slot}`);
      }
    }

    // Vérifier les doublons de position
    const positions = slots.map(s => s.slot);
    const uniquePositions = new Set(positions);
    if (positions.length !== uniquePositions.size) {
      errors.push("Duplicate positions found");
    }

    // Vérifier les doublons de héros
    const heroIds = slots.map(s => s.heroId);
    const uniqueHeroIds = new Set(heroIds);
    if (heroIds.length !== uniqueHeroIds.size) {
      errors.push("Same hero used multiple times");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Vérifier qu'un nom de formation est valide
   */
  static validateFormationName(name: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name || typeof name !== 'string') {
      errors.push("Formation name is required");
      return { valid: false, errors, warnings };
    }

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      errors.push("Formation name cannot be empty");
    }

    if (trimmedName.length > 30) {
      errors.push("Formation name cannot exceed 30 characters");
    }

    // Caractères interdits
    const invalidChars = /[<>\/\\]/;
    if (invalidChars.test(trimmedName)) {
      errors.push("Formation name contains invalid characters");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Vérifier qu'un joueur peut créer une nouvelle formation
   */
  static async canCreateFormation(
    playerId: string,
    serverId: string,
    maxFormations: number = 10
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const formationCount = await Formation.countDocuments({ playerId, serverId });

      if (formationCount >= maxFormations) {
        errors.push(`Maximum number of formations reached (${maxFormations})`);
      } else if (formationCount >= maxFormations - 2) {
        warnings.push(`Approaching maximum formations (${formationCount}/${maxFormations})`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push("Error checking formation count");
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Vérifier la composition de l'équipe et donner des warnings
   */
  private static checkTeamComposition(slots: IFormationSlot[], playerHeroes: any[]): string[] {
    const warnings: string[] = [];

    if (slots.length === 0) return warnings;

    // Compter les rôles
    const roles: Record<string, number> = {
      "Tank": 0,
      "DPS Melee": 0,
      "DPS Ranged": 0,
      "Support": 0
    };

    for (const slot of slots) {
      const heroInstance = playerHeroes.find((h: any) => 
        h._id?.toString() === slot.heroId
      );
      
      if (heroInstance) {
        const heroData = typeof heroInstance.heroId === 'string' ? 
          null : heroInstance.heroId;
        
        if (heroData && heroData.role) {
          roles[heroData.role] = (roles[heroData.role] || 0) + 1;
        }
      }
    }

    // Warnings sur la composition
    if (roles.Tank === 0 && slots.length >= 3) {
      warnings.push("No tank in formation - front line may be vulnerable");
    }

    if (roles.Support === 0 && slots.length >= 4) {
      warnings.push("No support in formation - limited healing/buffs");
    }

    const totalDPS = roles["DPS Melee"] + roles["DPS Ranged"];
    if (totalDPS === 0 && slots.length >= 3) {
      warnings.push("No DPS in formation - low damage output");
    }

    if (slots.length === 5 && totalDPS >= 4) {
      warnings.push("Formation is very DPS-heavy - may lack survivability");
    }

    // Vérifier la répartition front/back
    const frontLineSlots = slots.filter(s => this.FRONT_LINE_POSITIONS.includes(s.slot));
    const backLineSlots = slots.filter(s => this.BACK_LINE_POSITIONS.includes(s.slot));

    if (frontLineSlots.length === 0 && slots.length >= 3) {
      warnings.push("No heroes in front line (positions 1-2)");
    }

    if (backLineSlots.length === 0 && slots.length >= 3) {
      warnings.push("No heroes in back line (positions 3-5)");
    }

    // Vérifier les tanks en front line
    const tanksInBack = backLineSlots.filter(slot => {
      const heroInstance = playerHeroes.find((h: any) => 
        h._id?.toString() === slot.heroId
      );
      if (!heroInstance) return false;
      const heroData = typeof heroInstance.heroId === 'string' ? 
        null : heroInstance.heroId;
      return heroData && heroData.role === "Tank";
    });

    if (tanksInBack.length > 0) {
      warnings.push("Tank(s) placed in back line - consider moving to front");
    }

    return warnings;
  }

  /**
   * Vérifier si une position est en front line
   */
  static isFrontLine(position: number): boolean {
    return this.FRONT_LINE_POSITIONS.includes(position);
  }

  /**
   * Vérifier si une position est en back line
   */
  static isBackLine(position: number): boolean {
    return this.BACK_LINE_POSITIONS.includes(position);
  }

  /**
   * Obtenir la zone d'une position
   */
  static getPositionZone(position: number): "front" | "back" | "invalid" {
    if (this.FRONT_LINE_POSITIONS.includes(position)) return "front";
    if (this.BACK_LINE_POSITIONS.includes(position)) return "back";
    return "invalid";
  }
}

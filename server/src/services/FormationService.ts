// server/src/services/FormationService.ts
import Player from "../models/Player";
import Formation, { IFormationSlot } from "../models/Formation";
import Hero from "../models/Hero";
import { FormationValidator, ValidationResult } from "./FormationValidator";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

export interface FormationCreateData {
  name: string;
  slots: IFormationSlot[];
  setAsActive?: boolean;
}

export interface FormationUpdateData {
  name?: string;
  slots?: IFormationSlot[];
}

export interface FormationStats {
  totalPower: number;
  heroCount: number;
  roleDistribution: Record<string, number>;
  elementDistribution: Record<string, number>;
  averageLevel: number;
  averageStars: number;
  frontLineCount: number;
  backLineCount: number;
}

export interface FormationResult {
  success: boolean;
  formation?: any;
  stats?: FormationStats;
  validation?: ValidationResult;
  error?: string;
  code?: string;
}

export class FormationService {
  private static readonly MAX_FORMATIONS_PER_PLAYER = 10;

  /**
   * Créer une nouvelle formation
   */
  static async createFormation(
    playerId: string,
    serverId: string,
    formationData: FormationCreateData
  ): Promise<FormationResult> {
    try {
      // 1. Vérifier que le joueur existe
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      // 2. Vérifier le nombre maximum de formations
      const canCreate = await FormationValidator.canCreateFormation(
        playerId, 
        serverId, 
        this.MAX_FORMATIONS_PER_PLAYER
      );

      if (!canCreate.valid) {
        return { 
          success: false, 
          error: canCreate.errors[0], 
          code: "MAX_FORMATIONS_REACHED",
          validation: canCreate
        };
      }

      // 3. Valider le nom
      const nameValidation = FormationValidator.validateFormationName(formationData.name);
      if (!nameValidation.valid) {
        return { 
          success: false, 
          error: nameValidation.errors[0], 
          code: "INVALID_NAME",
          validation: nameValidation
        };
      }

      // 4. Vérifier qu'il n'y a pas déjà une formation avec ce nom
      const existingFormation = await Formation.findOne({
        playerId,
        serverId,
        name: formationData.name.trim()
      });

      if (existingFormation) {
        return { 
          success: false, 
          error: "A formation with this name already exists", 
          code: "DUPLICATE_NAME"
        };
      }

      // 5. Valider la structure de la formation
      const validation = await FormationValidator.validateFormation(
        playerId,
        serverId,
        formationData.slots,
        { allowEmpty: true, checkHeroAvailability: false }
      );

      if (!validation.valid) {
        return { 
          success: false, 
          error: validation.errors[0], 
          code: "INVALID_FORMATION",
          validation
        };
      }

      // 6. Si setAsActive, désactiver les autres formations
      if (formationData.setAsActive) {
        await Formation.updateMany(
          { playerId, serverId },
          { $set: { isActive: false } }
        );
      }

      // 7. Créer la formation
      const formation = new Formation({
        playerId,
        serverId,
        name: formationData.name.trim(),
        slots: formationData.slots,
        isActive: formationData.setAsActive || false,
        lastUsed: formationData.setAsActive ? new Date() : undefined
      });

      await formation.save();

      // 8. Calculer les stats
      const stats = await this.calculateFormationStats(formation, player.heroes);

      // 9. Mettre à jour les missions/events
      await this.updateProgressTracking(playerId, serverId, "formation_created");

      console.log(`✅ Formation créée: "${formation.name}" pour ${playerId}`);

      return {
        success: true,
        formation: {
          _id: formation._id,
          name: formation.name,
          slots: formation.slots,
          isActive: formation.isActive,
          lastUsed: formation.lastUsed,
          createdAt: formation.createdAt
        },
        stats,
        validation
      };

    } catch (error: any) {
      console.error("❌ Erreur création formation:", error);
      return { success: false, error: error.message, code: "CREATION_FAILED" };
    }
  }

  /**
   * Récupérer toutes les formations d'un joueur
   */
  static async getPlayerFormations(
    playerId: string,
    serverId: string
  ): Promise<FormationResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const formations = await Formation.find({ playerId, serverId })
        .sort({ isActive: -1, lastUsed: -1, createdAt: -1 });

      const formationsWithStats = await Promise.all(
        formations.map(async (formation) => {
          const stats = await this.calculateFormationStats(formation, player.heroes);
          return {
            _id: formation._id,
            name: formation.name,
            slots: formation.slots,
            isActive: formation.isActive,
            lastUsed: formation.lastUsed,
            createdAt: formation.createdAt,
            stats
          };
        })
      );

      return {
        success: true,
        formation: formationsWithStats
      };

    } catch (error: any) {
      console.error("❌ Erreur récupération formations:", error);
      return { success: false, error: error.message, code: "GET_FORMATIONS_FAILED" };
    }
  }

  /**
   * Récupérer une formation spécifique
   */
  static async getFormation(
    formationId: string,
    playerId: string,
    serverId: string
  ): Promise<FormationResult> {
    try {
      const formation = await Formation.findOne({ _id: formationId, playerId, serverId });
      if (!formation) {
        return { success: false, error: "Formation not found", code: "FORMATION_NOT_FOUND" };
      }

      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const stats = await this.calculateFormationStats(formation, player.heroes);
      const heroes = formation.getHeroesInFormation(player.heroes);

      return {
        success: true,
        formation: {
          _id: formation._id,
          name: formation.name,
          slots: formation.slots,
          isActive: formation.isActive,
          lastUsed: formation.lastUsed,
          createdAt: formation.createdAt,
          heroes
        },
        stats
      };

    } catch (error: any) {
      console.error("❌ Erreur récupération formation:", error);
      return { success: false, error: error.message, code: "GET_FORMATION_FAILED" };
    }
  }

  /**
   * Mettre à jour une formation
   */
  static async updateFormation(
    formationId: string,
    playerId: string,
    serverId: string,
    updateData: FormationUpdateData
  ): Promise<FormationResult> {
    try {
      const formation = await Formation.findOne({ _id: formationId, playerId, serverId });
      if (!formation) {
        return { success: false, error: "Formation not found", code: "FORMATION_NOT_FOUND" };
      }

      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      // Valider le nouveau nom si fourni
      if (updateData.name !== undefined) {
        const nameValidation = FormationValidator.validateFormationName(updateData.name);
        if (!nameValidation.valid) {
          return { 
            success: false, 
            error: nameValidation.errors[0], 
            code: "INVALID_NAME",
            validation: nameValidation
          };
        }

        // Vérifier les doublons de nom
        const existingFormation = await Formation.findOne({
          playerId,
          serverId,
          name: updateData.name.trim(),
          _id: { $ne: formationId }
        });

        if (existingFormation) {
          return { 
            success: false, 
            error: "A formation with this name already exists", 
            code: "DUPLICATE_NAME"
          };
        }

        formation.name = updateData.name.trim();
      }

      // Valider les nouveaux slots si fournis
      if (updateData.slots !== undefined) {
        const validation = await FormationValidator.validateFormation(
          playerId,
          serverId,
          updateData.slots,
          { allowEmpty: true, checkHeroAvailability: false }
        );

        if (!validation.valid) {
          return { 
            success: false, 
            error: validation.errors[0], 
            code: "INVALID_FORMATION",
            validation
          };
        }

        formation.slots = updateData.slots;
      }

      await formation.save();

      const stats = await this.calculateFormationStats(formation, player.heroes);

      console.log(`✅ Formation mise à jour: "${formation.name}" pour ${playerId}`);

      return {
        success: true,
        formation: {
          _id: formation._id,
          name: formation.name,
          slots: formation.slots,
          isActive: formation.isActive,
          lastUsed: formation.lastUsed,
          updatedAt: formation.updatedAt
        },
        stats
      };

    } catch (error: any) {
      console.error("❌ Erreur mise à jour formation:", error);
      return { success: false, error: error.message, code: "UPDATE_FAILED" };
    }
  }

  /**
   * Supprimer une formation
   */
  static async deleteFormation(
    formationId: string,
    playerId: string,
    serverId: string
  ): Promise<FormationResult> {
    try {
      const formation = await Formation.findOne({ _id: formationId, playerId, serverId });
      if (!formation) {
        return { success: false, error: "Formation not found", code: "FORMATION_NOT_FOUND" };
      }

      if (formation.isActive) {
        return { 
          success: false, 
          error: "Cannot delete active formation. Set another formation as active first.", 
          code: "CANNOT_DELETE_ACTIVE"
        };
      }

      await Formation.deleteOne({ _id: formationId });

      console.log(`✅ Formation supprimée: "${formation.name}" pour ${playerId}`);

      return {
        success: true,
        formation: {
          _id: formation._id,
          name: formation.name,
          deleted: true
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur suppression formation:", error);
      return { success: false, error: error.message, code: "DELETE_FAILED" };
    }
  }

  /**
   * Activer une formation
   */
  static async activateFormation(
    formationId: string,
    playerId: string,
    serverId: string
  ): Promise<FormationResult> {
    try {
      const formation = await Formation.findOne({ _id: formationId, playerId, serverId });
      if (!formation) {
        return { success: false, error: "Formation not found", code: "FORMATION_NOT_FOUND" };
      }

      if (formation.isEmpty()) {
        return { 
          success: false, 
          error: "Cannot activate empty formation", 
          code: "EMPTY_FORMATION"
        };
      }

      // Désactiver toutes les autres formations
      await Formation.updateMany(
        { playerId, serverId, _id: { $ne: formationId } },
        { $set: { isActive: false } }
      );

      // Activer cette formation
      formation.isActive = true;
      formation.lastUsed = new Date();
      await formation.save();

      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const stats = await this.calculateFormationStats(formation, player.heroes);

      console.log(`✅ Formation activée: "${formation.name}" pour ${playerId}`);

      return {
        success: true,
        formation: {
          _id: formation._id,
          name: formation.name,
          slots: formation.slots,
          isActive: formation.isActive,
          lastUsed: formation.lastUsed
        },
        stats
      };

    } catch (error: any) {
      console.error("❌ Erreur activation formation:", error);
      return { success: false, error: error.message, code: "ACTIVATION_FAILED" };
    }
  }

  /**
   * Valider une formation avant sauvegarde
   */
  static async validateFormation(
    playerId: string,
    serverId: string,
    slots: IFormationSlot[]
  ): Promise<ValidationResult> {
    try {
      return await FormationValidator.validateFormation(
        playerId,
        serverId,
        slots
      );
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Calculer les stats d'une formation
   */
  static async calculateFormationStats(
    formation: any,
    playerHeroes: any[]
  ): Promise<FormationStats> {
    try {
      const totalPower = await formation.getTotalPower(playerHeroes);
      const roleDistribution = formation.getRoleDistribution(playerHeroes);
      const elementDistribution = formation.getElementDistribution(playerHeroes);

      let totalLevel = 0;
      let totalStars = 0;
      let heroCount = 0;
      let frontLineCount = 0;
      let backLineCount = 0;

      for (const slot of formation.slots) {
        const heroInstance = playerHeroes.find((h: any) => 
          h._id?.toString() === slot.heroId
        );

        if (heroInstance) {
          totalLevel += heroInstance.level || 1;
          totalStars += heroInstance.stars || 1;
          heroCount++;

          if (FormationValidator.isFrontLine(slot.slot)) {
            frontLineCount++;
          } else if (FormationValidator.isBackLine(slot.slot)) {
            backLineCount++;
          }
        }
      }

      return {
        totalPower,
        heroCount,
        roleDistribution,
        elementDistribution,
        averageLevel: heroCount > 0 ? Math.round((totalLevel / heroCount) * 10) / 10 : 0,
        averageStars: heroCount > 0 ? Math.round((totalStars / heroCount) * 10) / 10 : 0,
        frontLineCount,
        backLineCount
      };

    } catch (error) {
      console.error("Error calculating formation stats:", error);
      return {
        totalPower: 0,
        heroCount: 0,
        roleDistribution: {},
        elementDistribution: {},
        averageLevel: 0,
        averageStars: 0,
        frontLineCount: 0,
        backLineCount: 0
      };
    }
  }

  /**
   * Obtenir la formation active d'un joueur
   */
  static async getActiveFormation(
    playerId: string,
    serverId: string
  ): Promise<FormationResult> {
    try {
      const formation = await Formation.findOne({ playerId, serverId, isActive: true });
      
      if (!formation) {
        return { 
          success: false, 
          error: "No active formation found", 
          code: "NO_ACTIVE_FORMATION"
        };
      }

      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const stats = await this.calculateFormationStats(formation, player.heroes);
      const heroes = formation.getHeroesInFormation(player.heroes);

      return {
        success: true,
        formation: {
          _id: formation._id,
          name: formation.name,
          slots: formation.slots,
          isActive: formation.isActive,
          lastUsed: formation.lastUsed,
          heroes
        },
        stats
      };

    } catch (error: any) {
      console.error("❌ Erreur récupération formation active:", error);
      return { success: false, error: error.message, code: "GET_ACTIVE_FORMATION_FAILED" };
    }
  }

  /**
   * Dupliquer une formation
   */
  static async duplicateFormation(
    formationId: string,
    playerId: string,
    serverId: string,
    newName?: string
  ): Promise<FormationResult> {
    try {
      const formation = await Formation.findOne({ _id: formationId, playerId, serverId });
      if (!formation) {
        return { success: false, error: "Formation not found", code: "FORMATION_NOT_FOUND" };
      }

      // Vérifier le nombre maximum
      const canCreate = await FormationValidator.canCreateFormation(
        playerId, 
        serverId, 
        this.MAX_FORMATIONS_PER_PLAYER
      );

      if (!canCreate.valid) {
        return { 
          success: false, 
          error: canCreate.errors[0], 
          code: "MAX_FORMATIONS_REACHED"
        };
      }

      // Générer un nom unique
      const baseName = newName || `${formation.name} (Copy)`;
      let finalName = baseName;
      let counter = 1;

      while (await Formation.findOne({ playerId, serverId, name: finalName })) {
        finalName = `${baseName} ${counter}`;
        counter++;
      }

      // Créer la copie
      return await this.createFormation(playerId, serverId, {
        name: finalName,
        slots: [...formation.slots],
        setAsActive: false
      });

    } catch (error: any) {
      console.error("❌ Erreur duplication formation:", error);
      return { success: false, error: error.message, code: "DUPLICATION_FAILED" };
    }
  }

  /**
   * Mise à jour des missions/events
   */
  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    action: string
  ) {
    try {
      await Promise.all([
        MissionService.updateProgress(playerId, serverId, "formation_actions", 1, { action }),
        EventService.updatePlayerProgress(playerId, serverId, "formation_actions", 1, { action })
      ]);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression formation:", error);
    }
  }
}

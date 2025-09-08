// src/utils/idGenerator.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Générateur d'IDs unifié pour le projet
 * Utilise UUID v4 avec des préfixes pour maintenir la lisibilité
 */
export class IdGenerator {
  
  /**
   * Génère un ID de compte unique
   * Format: ACC_[uuid-sans-tirets]
   */
  static generateAccountId(): string {
    return `ACC_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un ID de joueur unique
   * Format: PLAYER_[uuid-sans-tirets]
   */
  static generatePlayerId(): string {
    return `PLAYER_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un ID de héros unique pour un joueur
   * Format: HERO_[uuid-sans-tirets]
   */
  static generateHeroId(): string {
    return `HERO_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un ID de formation unique
   * Format: FORM_[uuid-sans-tirets]
   */
  static generateFormationId(): string {
    return `FORM_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un ID de transaction unique
   * Format: TXN_[uuid-sans-tirets]
   */
  static generateTransactionId(): string {
    return `TXN_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un ID de guilde unique
   * Format: GUILD_[uuid-sans-tirets]
   */
  static generateGuildId(): string {
    return `GUILD_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un ID d'événement unique
   * Format: EVENT_[uuid-sans-tirets]
   */
  static generateEventId(): string {
    return `EVENT_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Génère un UUID brut (sans préfixe) pour usage général
   */
  static generateUUID(): string {
    return uuidv4();
  }

  /**
   * Génère un UUID sans tirets pour usage compact
   */
  static generateCompactUUID(): string {
    return uuidv4().replace(/-/g, '');
  }

  /**
   * Valide si un ID respecte le format attendu
   */
  static validateId(id: string, expectedPrefix?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    
    if (expectedPrefix) {
      if (!id.startsWith(expectedPrefix + '_')) return false;
      const uuidPart = id.slice(expectedPrefix.length + 1);
      return this.isValidUUIDFormat(uuidPart);
    }
    
    // Validation générale pour les anciens formats ou nouveaux
    return id.length > 10; // Minimum de sécurité
  }

  /**
   * Vérifie si une chaîne respecte le format UUID (avec ou sans tirets)
   */
  private static isValidUUIDFormat(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$/i;
    const uuidWithDashesRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    return uuidRegex.test(str) || uuidWithDashesRegex.test(str);
  }

  /**
   * Extrait le UUID d'un ID avec préfixe
   */
  static extractUUID(id: string): string | null {
    if (!id.includes('_')) return null;
    
    const parts = id.split('_');
    if (parts.length < 2) return null;
    
    return parts.slice(1).join('_'); // Au cas où il y aurait plusieurs underscores
  }

  /**
   * Génère un ID de session temporaire
   * Format: SESS_[timestamp]_[uuid-court]
   */
  static generateSessionId(): string {
    const timestamp = Date.now();
    const shortUuid = uuidv4().split('-')[0]; // Premier segment seulement
    return `SESS_${timestamp}_${shortUuid}`;
  }

  /**
   * Génère un ID de log/trace pour debugging
   * Format: LOG_[timestamp]_[uuid-court]
   */
  static generateLogId(): string {
    const timestamp = Date.now();
    const shortUuid = uuidv4().split('-')[0];
    return `LOG_${timestamp}_${shortUuid}`;
  }
}

// Export de fonctions utilitaires pour compatibilité
export const {
  generateAccountId,
  generatePlayerId,
  generateHeroId,
  generateFormationId,
  generateTransactionId,
  generateGuildId,
  generateEventId,
  generateUUID,
  generateCompactUUID,
  validateId,
  extractUUID,
  generateSessionId,
  generateLogId
} = IdGenerator;

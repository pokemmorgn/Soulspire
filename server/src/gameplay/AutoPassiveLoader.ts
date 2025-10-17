// server/src/gameplay/AutoPassiveLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { BasePassive } from './base/BasePassive';

interface PassiveModule {
  [key: string]: any;
}

interface PassiveInfo {
  id: string;
  name: string;
  triggerType: string;
  instance: BasePassive;
}

export class AutoPassiveLoader {
  private static loadedPassives: Map<string, BasePassive> = new Map();
  private static passivesByTrigger: Map<string, string[]> = new Map();
  
  // ✅ AJOUT : Protection contre le double chargement
  private static initialized: boolean = false;
  private static loadedFiles: Set<string> = new Set();
  
  /**
   * Auto-découverte et chargement de tous les passifs
   */
  static async autoLoadPassives(): Promise<void> {
    // ✅ NOUVEAU : Éviter le rechargement multiple
    if (this.initialized) {
      console.log(`✅ Passifs déjà chargés (${this.loadedPassives.size}), skip reload`);
      return;
    }
    
    console.log("🔍 Auto-découverte des passifs...");
    
    const passivesDirectory = './passives';
    const loaded = await this.loadPassivesFromDirectory(passivesDirectory);
    
    console.log(`✨ ${loaded} passif(s) auto-chargé(s)`);
    this.displayLoadedPassives();
    
    // ✅ NOUVEAU : Marquer comme initialisé
    this.initialized = true;
  }
  
  /**
   * Charge tous les passifs d'un répertoire
   */
  private static async loadPassivesFromDirectory(dirPath: string): Promise<number> {
    const fullPath = path.resolve(__dirname, dirPath);
    
    // Vérifier si le répertoire existe
    if (!fs.existsSync(fullPath)) {
      console.log(`📂 Répertoire ${dirPath} non trouvé - création automatique`);
      this.createDirectoryStructure(fullPath);
      return 0;
    }
    
    let loadedCount = 0;
    
    try {
      const files = fs.readdirSync(fullPath);
      const passiveFiles = files.filter(file => 
        (file.endsWith('.ts') || file.endsWith('.js')) && 
        !file.endsWith('.d.ts') &&
        file !== 'index.ts' &&
        file !== 'index.js' &&
        file !== 'README.md'
      );
      
      for (const file of passiveFiles) {
        const filePath = path.join(fullPath, file);
        
        // ✅ NOUVEAU : Éviter de charger le même fichier plusieurs fois
        if (this.loadedFiles.has(filePath)) {
          console.log(`📋 Fichier ${file} déjà chargé, skip`);
          continue;
        }
        
        const loaded = await this.loadPassiveFromFile(filePath);
        if (loaded) {
          loadedCount++;
          this.loadedFiles.add(filePath);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Erreur lors du scan du répertoire ${dirPath}:`, error);
    }
    
    return loadedCount;
  }
  
  /**
   * Charge un passif depuis un fichier
   */
  private static async loadPassiveFromFile(filePath: string): Promise<boolean> {
    try {
      // Convertir le chemin absolu en chemin relatif correct
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      
      // Supprimer l'extension pour l'import
      const moduleImportPath = './' + relativePath.replace(/\.(ts|js)$/, '');
      
      console.log(`🔍 Tentative de chargement: ${moduleImportPath}`);
      
      // ✅ NOUVEAU : Gestion du cache pour éviter les conflits
      delete require.cache[require.resolve(moduleImportPath)];
      
      // Import dynamique du module
      const module: PassiveModule = await import(moduleImportPath);
      
      // Chercher les exports qui sont des instances de BasePassive
      const passiveInstances = this.extractPassivesFromModule(module);
      
      if (passiveInstances.length === 0) {
        console.warn(`⚠️ Aucun passif valide trouvé dans ${path.basename(filePath)}`);
        return false;
      }
      
      // Enregistrer tous les passifs trouvés (avec déduplication)
      let registeredCount = 0;
      for (const passive of passiveInstances) {
        if (this.registerPassive(passive)) {
          registeredCount++;
        }
      }
      
      if (registeredCount > 0) {
        console.log(`📜 ${registeredCount} passif(s) chargé(s) depuis ${path.basename(filePath)}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de ${path.basename(filePath)}:`, error);
      return false;
    }
  }
  
  /**
   * Extrait les passifs valides d'un module
   */
  private static extractPassivesFromModule(module: PassiveModule): BasePassive[] {
    const passives: BasePassive[] = [];
    const processedIds = new Set<string>(); // ✅ NOUVEAU : Éviter les doublons dans le même fichier
    
    for (const [exportName, exportValue] of Object.entries(module)) {
      let passiveInstance: BasePassive | null = null;
      
      // Vérifier si c'est une instance de BasePassive
      if (this.isValidPassiveInstance(exportValue)) {
        passiveInstance = exportValue as BasePassive;
      }
      // Vérifier si c'est une classe qui étend BasePassive
      else if (this.isPassiveClass(exportValue)) {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidPassiveInstance(instance)) {
            passiveInstance = instance;
          }
        } catch (error) {
          console.warn(`⚠️ Impossible d'instancier ${exportName}:`, error);
        }
      }
      
      // ✅ NOUVEAU : Ajouter le passif si valide et pas encore traité
      if (passiveInstance && !processedIds.has(passiveInstance.config.id)) {
        passives.push(passiveInstance);
        processedIds.add(passiveInstance.config.id);
      }
    }
    
    return passives;
  }
  
  /**
   * Vérifie si un objet est une instance valide de BasePassive
   */
  private static isValidPassiveInstance(obj: any): boolean {
    return obj && 
           typeof obj === 'object' && 
           obj.config && 
           typeof obj.config.id === 'string' &&
           typeof obj.config.name === 'string' &&
           typeof obj.config.triggerType === 'string' &&
           typeof obj.trigger === 'function' &&
           typeof obj.canTrigger === 'function';
  }
  
  /**
   * Vérifie si un export est une classe de passif
   */
  private static isPassiveClass(obj: any): boolean {
    return typeof obj === 'function' && 
           obj.prototype && 
           typeof obj.prototype.trigger === 'function';
  }
  
  /**
   * Enregistre un passif (✅ NOUVEAU : avec déduplication)
   */
  private static registerPassive(passive: BasePassive): boolean {
    const passiveId = passive.config.id;
    
    if (this.loadedPassives.has(passiveId)) {
      console.warn(`⚠️ Passif dupliqué ignoré: ${passiveId}`);
      return false;
    }
    
    this.loadedPassives.set(passiveId, passive);
    
    // Organiser par type de déclenchement
    const triggerType = passive.config.triggerType;
    if (!this.passivesByTrigger.has(triggerType)) {
      this.passivesByTrigger.set(triggerType, []);
    }
    this.passivesByTrigger.get(triggerType)!.push(passiveId);
    
    console.log(`✅ ${passive.config.name} (${passiveId}) enregistré - Trigger: ${triggerType}`);
    return true;
  }
  
  /**
   * Affiche un résumé des passifs chargés
   */
  private static displayLoadedPassives(): void {
    console.log("\n📊 === RÉSUMÉ DES PASSIFS CHARGÉS ===");
    
    for (const [triggerType, passiveIds] of this.passivesByTrigger.entries()) {
      console.log(`⚡ ${triggerType}: ${passiveIds.length} passif(s)`);
      passiveIds.forEach(id => {
        const passive = this.loadedPassives.get(id);
        if (passive) {
          const cooldown = passive.config.internalCooldown > 0 ? 
            ` (CD: ${passive.config.internalCooldown} tours)` : '';
          console.log(`   • ${passive.config.name} (${id})${cooldown}`);
        }
      });
    }
    
    console.log(`\n💫 Total: ${this.loadedPassives.size} passif(s) chargé(s) automatiquement`);
  }
  
  /**
   * Crée la structure de répertoires si elle n'existe pas
   */
  private static createDirectoryStructure(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      
      // Créer un fichier README dans le répertoire
      const readmeContent = `# Passives

Ce répertoire contient tous les passifs du jeu.

## Convention de nommage :
- Fichier : \`PassiveNamePassive.ts\`
- Export : \`export const passiveNamePassive = new PassiveNamePassive();\`
- Classe : \`class PassiveNamePassive extends BasePassive\`

## Types de déclenchement disponibles :
- \`on_hp_threshold\` : Se déclenche sous X% HP
- \`on_damaged\` : Se déclenche en prenant des dégâts
- \`on_attack\` : Se déclenche en attaquant
- \`on_critical\` : Se déclenche sur coup critique
- \`on_kill\` : Se déclenche en tuant un ennemi
- \`on_ally_damaged\` : Se déclenche quand un allié prend des dégâts
- \`on_turn_start\` : Se déclenche au début de chaque tour
- \`always_active\` : Passif toujours actif (modificateur de stats)

## Auto-découverte :
Les passifs dans ce répertoire sont automatiquement chargés par l'AutoPassiveLoader.
`;
      
      fs.writeFileSync(path.join(dirPath, 'README.md'), readmeContent);
      
    } catch (error) {
      console.warn(`⚠️ Impossible de créer ${dirPath}:`, error);
    }
  }
  
  /**
   * API publique pour récupérer les passifs
   */
  static getPassive(passiveId: string): BasePassive | undefined {
    return this.loadedPassives.get(passiveId);
  }
  
  static getAllPassives(): BasePassive[] {
    return Array.from(this.loadedPassives.values());
  }
  
  static getPassivesByTriggerType(triggerType: string): BasePassive[] {
    const passiveIds = this.passivesByTrigger.get(triggerType) || [];
    return passiveIds.map(id => this.loadedPassives.get(id)).filter(Boolean) as BasePassive[];
  }
  
  static getLoadedPassiveIds(): string[] {
    return Array.from(this.loadedPassives.keys());
  }
  
  static getTriggerTypes(): string[] {
    return Array.from(this.passivesByTrigger.keys());
  }
  
  static getStats(): any {
    return {
      totalPassives: this.loadedPassives.size,
      triggerTypes: Object.fromEntries(
        Array.from(this.passivesByTrigger.entries()).map(([type, passives]) => [type, passives.length])
      ),
      passivesList: Object.fromEntries(
        Array.from(this.loadedPassives.entries()).map(([id, passive]) => [id, passive.config.name])
      ),
      filesLoaded: this.loadedFiles.size,
      initialized: this.initialized
    };
  }
  
  /**
   * ✅ NOUVEAU : Vérifier l'état d'initialisation
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Rechargement à chaud (pour le développement)
   */
  static async hotReload(): Promise<void> {
    console.log("🔄 Rechargement à chaud des passifs...");
    this.loadedPassives.clear();
    this.passivesByTrigger.clear();
    this.loadedFiles.clear();
    this.initialized = false;
    await this.autoLoadPassives();
  }
  
  /**
   * Validation de l'intégrité des passifs chargés
   */
  static validateLoadedPassives(): boolean {
    let allValid = true;
    const duplicateIds = new Set<string>();
    const seenIds = new Set<string>();
    
    for (const [id, passive] of this.loadedPassives.entries()) {
      // Vérifier la validité du passif
      if (!this.validatePassive(passive)) {
        console.error(`❌ Passif invalide: ${id}`);
        allValid = false;
      }
      
      // Vérifier les doublons d'ID
      if (seenIds.has(id)) {
        duplicateIds.add(id);
        allValid = false;
      }
      seenIds.add(id);
    }
    
    if (duplicateIds.size > 0) {
      console.error(`❌ IDs dupliqués détectés: ${Array.from(duplicateIds).join(', ')}`);
    }
    
    if (allValid) {
      console.log("✅ Tous les passifs chargés sont valides");
    }
    
    return allValid;
  }
  
  /**
   * Valide un passif individuel
   */
  private static validatePassive(passive: BasePassive): boolean {
    const config = passive.config;
    
    // Vérifications de base
    if (!config.id || typeof config.id !== 'string') {
      console.error(`❌ ID manquant ou invalide`);
      return false;
    }
    
    if (!config.name || typeof config.name !== 'string') {
      console.error(`❌ Nom manquant ou invalide pour ${config.id}`);
      return false;
    }
    
    // Vérifier le type de déclenchement
    const validTriggerTypes = [
      'on_hp_threshold',
      'on_damaged',
      'on_attack',
      'on_critical',
      'on_kill',
      'on_ally_damaged',
      'on_turn_start',
      'always_active'
    ];
    
    if (!validTriggerTypes.includes(config.triggerType)) {
      console.error(`❌ Type de déclenchement invalide pour ${config.id}: ${config.triggerType}`);
      return false;
    }
    
    // Vérifier le cooldown
    if (typeof config.internalCooldown !== 'number' || config.internalCooldown < 0) {
      console.error(`❌ Cooldown invalide pour ${config.id}`);
      return false;
    }
    
    // Vérifier les méthodes
    if (typeof passive.trigger !== 'function') {
      console.error(`❌ Méthode trigger manquante pour ${config.id}`);
      return false;
    }
    
    if (typeof passive.canTrigger !== 'function') {
      console.error(`❌ Méthode canTrigger manquante pour ${config.id}`);
      return false;
    }
    
    // Vérifier maxLevel
    if (typeof config.maxLevel !== 'number' || config.maxLevel < 1) {
      console.error(`❌ maxLevel invalide pour ${config.id}`);
      return false;
    }
    
    // Vérifications spécifiques selon le trigger type
    if (config.triggerType === 'on_hp_threshold') {
      if (!config.triggerConditions?.hpThresholdPercent) {
        console.error(`❌ hpThresholdPercent manquant pour ${config.id}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Obtenir des statistiques détaillées
   */
  static getDetailedStats(): {
    totalPassives: number;
    byTriggerType: { [key: string]: number };
    byCooldown: { [key: string]: number };
    byElement: { [key: string]: number };
    averageCooldown: number;
  } {
    const stats = {
      totalPassives: this.loadedPassives.size,
      byTriggerType: {} as { [key: string]: number },
      byCooldown: { 'no_cooldown': 0, 'short_cd': 0, 'medium_cd': 0, 'long_cd': 0 } as { [key: string]: number },
      byElement: {} as { [key: string]: number },
      averageCooldown: 0
    };
    
    let totalCooldown = 0;
    
    for (const passive of this.loadedPassives.values()) {
      const config = passive.config;
      
      // Par trigger type
      stats.byTriggerType[config.triggerType] = (stats.byTriggerType[config.triggerType] || 0) + 1;
      
      // Par cooldown
      if (config.internalCooldown === 0) {
        stats.byCooldown.no_cooldown++;
      } else if (config.internalCooldown <= 5) {
        stats.byCooldown.short_cd++;
      } else if (config.internalCooldown <= 10) {
        stats.byCooldown.medium_cd++;
      } else {
        stats.byCooldown.long_cd++;
      }
      
      totalCooldown += config.internalCooldown;
      
      // Par élément
      if (config.element) {
        stats.byElement[config.element] = (stats.byElement[config.element] || 0) + 1;
      }
    }
    
    stats.averageCooldown = this.loadedPassives.size > 0 ? 
      Math.round(totalCooldown / this.loadedPassives.size * 10) / 10 : 0;
    
    return stats;
  }
  
  /**
   * ✅ NOUVEAU : Reset complet pour les tests
   */
  static reset(): void {
    this.loadedPassives.clear();
    this.passivesByTrigger.clear();
    this.loadedFiles.clear();
    this.initialized = false;
  }
  
  /**
   * ✅ NOUVEAU : Diagnostic détaillé
   */
  static diagnose(): void {
    console.log("🔧 DIAGNOSTIC AUTOPASSIVELOADER");
    console.log(`Initialisé: ${this.initialized}`);
    console.log(`Passifs chargés: ${this.loadedPassives.size}`);
    console.log(`Fichiers traités: ${this.loadedFiles.size}`);
    console.log(`Types de trigger: ${this.passivesByTrigger.size}`);
    
    if (this.loadedPassives.size === 0) {
      console.log("⚠️ ATTENTION: Aucun passif chargé !");
    }
    
    this.validateLoadedPassives();
  }

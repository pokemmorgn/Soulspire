// server/src/gameplay/effects/AutoEffectLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { BaseEffect } from './base/BaseEffect';

// Interface pour les modules d'effets auto-découverts
interface EffectModule {
  [key: string]: any;
}

// Interface pour les informations d'un effet
interface EffectInfo {
  id: string;
  name: string;
  category: string;
  instance: BaseEffect;
}

export class AutoEffectLoader {
  private static loadedEffects: Map<string, BaseEffect> = new Map();
  private static effectCategories: Map<string, string[]> = new Map();
  private static initialized: boolean = false;
  private static loadedFiles: Set<string> = new Set(); // Cache des fichiers déjà chargés
  
  // Auto-découverte et chargement de tous les effets
  static async autoLoadEffects(): Promise<void> {
    // Éviter le rechargement multiple
    if (this.initialized) {
      console.log(`Effets déjà chargés (${this.loadedEffects.size}), skip reload`);
      return;
    }
    
    console.log("Auto-découverte des effets...");
    
    const effectDirectories = [
      { path: './dot', category: 'dot' },
      { path: './control', category: 'control' },
      { path: './debuffs', category: 'debuff' },
      { path: './buffs', category: 'buff' },
      { path: './special', category: 'special' }
    ];
    
    let totalLoaded = 0;
    
    for (const dir of effectDirectories) {
      const loaded = await this.loadEffectsFromDirectory(dir.path, dir.category);
      totalLoaded += loaded;
    }
    
    console.log(`${totalLoaded} effets auto-chargés dans ${effectDirectories.length} catégories`);
    this.displayLoadedEffects();
    
    this.initialized = true;
  }
  
  // Charge tous les effets d'un répertoire
  private static async loadEffectsFromDirectory(dirPath: string, category: string): Promise<number> {
    const fullPath = path.resolve(__dirname, dirPath);
    
    // Vérifier si le répertoire existe
    if (!fs.existsSync(fullPath)) {
      console.log(`Répertoire ${dirPath} non trouvé - création automatique`);
      this.createDirectoryStructure(fullPath);
      return 0;
    }
    
    let loadedCount = 0;
    
    try {
      const files = fs.readdirSync(fullPath);
      const effectFiles = files.filter(file => 
        (file.endsWith('.ts') || file.endsWith('.js')) && 
        !file.endsWith('.d.ts') &&
        file !== 'index.ts' &&
        file !== 'index.js' &&
        file !== 'README.md'
      );
      
      for (const file of effectFiles) {
        const filePath = path.join(fullPath, file);
        
        // Éviter de charger le même fichier plusieurs fois
        if (this.loadedFiles.has(filePath)) {
          console.log(`Fichier ${file} déjà chargé, skip`);
          continue;
        }
        
        const loaded = await this.loadEffectFromFile(filePath, category);
        if (loaded) {
          loadedCount++;
          this.loadedFiles.add(filePath);
        }
      }
      
    } catch (error) {
      console.warn(`Erreur lors du scan du répertoire ${dirPath}:`, error);
    }
    
    return loadedCount;
  }
  
  // Charge un effet depuis un fichier
  private static async loadEffectFromFile(filePath: string, category: string): Promise<boolean> {
    try {
      // Convertir le chemin absolu en chemin relatif
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      
      // Supprimer l'extension pour l'import
      const moduleImportPath = './' + relativePath.replace(/\.(ts|js)$/, '');
      
      console.log(`Tentative de chargement: ${moduleImportPath}`);
      
      // Import dynamique du module avec gestion du cache
      delete require.cache[require.resolve(moduleImportPath)];
      const module: EffectModule = await import(moduleImportPath);
      
      // Chercher les exports qui sont des instances de BaseEffect
      const effectInstances = this.extractEffectsFromModule(module, path.basename(filePath));
      
      if (effectInstances.length === 0) {
        console.warn(`Aucun effet valide trouvé dans ${path.basename(filePath)}`);
        return false;
      }
      
      // Enregistrer tous les effets trouvés (avec déduplication)
      let registeredCount = 0;
      for (const effect of effectInstances) {
        if (this.registerEffect(effect, category)) {
          registeredCount++;
        }
      }
      
      if (registeredCount > 0) {
        console.log(`${registeredCount} effet(s) chargé(s) depuis ${path.basename(filePath)}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`Erreur lors du chargement de ${path.basename(filePath)}:`, error);
      return false;
    }
  }
  
  // Extrait les effets valides d'un module (version optimisée)
  private static extractEffectsFromModule(module: EffectModule, fileName: string): BaseEffect[] {
    const effects: BaseEffect[] = [];
    const processedIds = new Set<string>(); // Éviter les doublons dans le même fichier
    
    for (const [exportName, exportValue] of Object.entries(module)) {
      let effectInstance: BaseEffect | null = null;
      
      // Vérifier si c'est une instance de BaseEffect
      if (this.isValidEffectInstance(exportValue)) {
        effectInstance = exportValue as BaseEffect;
      }
      // Vérifier si c'est une classe qui étend BaseEffect
      else if (this.isEffectClass(exportValue)) {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidEffectInstance(instance)) {
            effectInstance = instance;
          }
        } catch (error) {
          console.warn(`Impossible d'instancier ${exportName} dans ${fileName}:`, error);
        }
      }
      
      // Ajouter l'effet si valide et pas encore traité
      if (effectInstance && !processedIds.has(effectInstance.id)) {
        effects.push(effectInstance);
        processedIds.add(effectInstance.id);
      }
    }
    
    return effects;
  }
  
  // Vérifie si un objet est une instance valide de BaseEffect
  private static isValidEffectInstance(obj: any): boolean {
    return obj && 
           typeof obj === 'object' && 
           typeof obj.id === 'string' && 
           typeof obj.name === 'string' &&
           typeof obj.onTick === 'function' &&
           ['dot', 'hot', 'buff', 'debuff', 'control', 'special'].includes(obj.type);
  }
  
  // Vérifie si un export est une classe d'effet
  private static isEffectClass(obj: any): boolean {
    return typeof obj === 'function' && 
           obj.prototype && 
           typeof obj.prototype.onTick === 'function';
  }
  
  // Enregistre un effet (version optimisée avec déduplication)
  private static registerEffect(effect: BaseEffect, category: string): boolean {
    const effectId = effect.id;
    
    if (this.loadedEffects.has(effectId)) {
      console.warn(`Effet dupliqué ignoré: ${effectId}`);
      return false;
    }
    
    this.loadedEffects.set(effectId, effect);
    
    // Organiser par catégorie
    if (!this.effectCategories.has(category)) {
      this.effectCategories.set(category, []);
    }
    this.effectCategories.get(category)!.push(effectId);
    
    console.log(`${effect.name} (${effectId}) enregistré dans ${category}`);
    return true;
  }
  
  // Affiche un résumé des effets chargés (version condensée)
  private static displayLoadedEffects(): void {
    console.log("\nRÉSUMÉ DES EFFETS CHARGÉS");
    
    for (const [category, effectIds] of this.effectCategories.entries()) {
      console.log(`${category}: ${effectIds.length} effet(s)`);
      effectIds.forEach(id => {
        const effect = this.loadedEffects.get(id);
        if (effect) {
          console.log(`   • ${effect.name} (${id})`);
        }
      });
    }
    
    console.log(`\nTotal: ${this.loadedEffects.size} effets chargés automatiquement`);
  }
  
  // Crée la structure de répertoires si elle n'existe pas
  private static createDirectoryStructure(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      
      // Créer un fichier README dans chaque répertoire
      const readmeContent = `# ${path.basename(dirPath)} Effects

Ce répertoire contient les effets de type ${path.basename(dirPath)}.

## Convention de nommage :
- Fichier : \`effect_name.ts\`
- Export : \`export const effectNameEffect = new EffectNameEffect();\`
- Classe : \`class EffectNameEffect extends BaseEffect\`

## Auto-découverte :
Les effets dans ce répertoire sont automatiquement chargés par l'AutoEffectLoader.
`;
      
      fs.writeFileSync(path.join(dirPath, 'README.md'), readmeContent);
      
    } catch (error) {
      console.warn(`Impossible de créer ${dirPath}:`, error);
    }
  }
  
  // API publique pour récupérer les effets
  static getEffect(effectId: string): BaseEffect | undefined {
    return this.loadedEffects.get(effectId);
  }
  
  static getAllEffects(): BaseEffect[] {
    return Array.from(this.loadedEffects.values());
  }
  
  static getEffectsByCategory(category: string): BaseEffect[] {
    const effectIds = this.effectCategories.get(category) || [];
    return effectIds.map(id => this.loadedEffects.get(id)).filter(Boolean) as BaseEffect[];
  }
  
  static getLoadedEffectIds(): string[] {
    return Array.from(this.loadedEffects.keys());
  }
  
  static getCategories(): string[] {
    return Array.from(this.effectCategories.keys());
  }
  
  static getStats(): any {
    return {
      totalEffects: this.loadedEffects.size,
      categories: Object.fromEntries(
        Array.from(this.effectCategories.entries()).map(([cat, effects]) => [cat, effects.length])
      ),
      effectsList: Object.fromEntries(
        Array.from(this.loadedEffects.entries()).map(([id, effect]) => [id, effect.name])
      ),
      filesLoaded: this.loadedFiles.size,
      initialized: this.initialized
    };
  }
  
  // Rechargement à chaud (pour le développement)
  static async hotReload(): Promise<void> {
    console.log("Rechargement à chaud des effets...");
    this.loadedEffects.clear();
    this.effectCategories.clear();
    this.loadedFiles.clear();
    this.initialized = false;
    await this.autoLoadEffects();
  }
  
  // Validation de l'intégrité des effets chargés
  static validateLoadedEffects(): boolean {
    let allValid = true;
    const duplicateIds = new Set<string>();
    const seenIds = new Set<string>();
    
    for (const [id, effect] of this.loadedEffects.entries()) {
      // Vérifier la validité de l'effet
      if (!this.validateEffect(effect)) {
        console.error(`Effet invalide: ${id}`);
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
      console.error(`IDs dupliqués détectés: ${Array.from(duplicateIds).join(', ')}`);
    }
    
    if (allValid) {
      console.log("Tous les effets chargés sont valides");
    }
    
    return allValid;
  }
  
  private static validateEffect(effect: BaseEffect): boolean {
    if (!effect.id || typeof effect.id !== 'string') return false;
    if (!effect.name || typeof effect.name !== 'string') return false;
    if (!['dot', 'hot', 'buff', 'debuff', 'control', 'special'].includes(effect.type)) return false;
    if (typeof effect.baseDuration !== 'number' || effect.baseDuration < 0) return false;
    if (typeof effect.onTick !== 'function') return false;
    
    return true;
  }
  
  // Diagnostic détaillé
  static diagnose(): void {
    console.log("DIAGNOSTIC AUTOEFFECTLOADER");
    console.log(`Initialisé: ${this.initialized}`);
    console.log(`Effets chargés: ${this.loadedEffects.size}`);
    console.log(`Fichiers traités: ${this.loadedFiles.size}`);
    console.log(`Catégories: ${this.effectCategories.size}`);
    
    if (this.loadedEffects.size === 0) {
      console.log("ATTENTION: Aucun effet chargé !");
    }
    
    this.validateLoadedEffects();
  }
  
  // Reset complet pour les tests
  static reset(): void {
    this.loadedEffects.clear();
    this.effectCategories.clear();
    this.loadedFiles.clear();
    this.initialized = false;
  }
}

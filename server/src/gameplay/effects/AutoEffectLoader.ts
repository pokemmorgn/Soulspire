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
  
  // Auto-découverte et chargement de tous les effets
  static async autoLoadEffects(): Promise<void> {
    console.log("🔍 Auto-découverte des effets...");
    
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
    
    console.log(`✨ ${totalLoaded} effets auto-chargés dans ${effectDirectories.length} catégories`);
    this.displayLoadedEffects();
  }
  
  // Charge tous les effets d'un répertoire
  private static async loadEffectsFromDirectory(dirPath: string, category: string): Promise<number> {
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
      const effectFiles = files.filter(file => 
        (file.endsWith('.ts') || file.endsWith('.js')) && 
        !file.endsWith('.d.ts') &&
        file !== 'index.ts' &&
        file !== 'index.js'
      );
      
      for (const file of effectFiles) {
        const loaded = await this.loadEffectFromFile(path.join(fullPath, file), category);
        if (loaded) loadedCount++;
      }
      
    } catch (error) {
      console.warn(`⚠️ Erreur lors du scan du répertoire ${dirPath}:`, error);
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
      
      console.log(`🔍 Tentative de chargement: ${moduleImportPath}`);
      
      // Import dynamique du module
      const module: EffectModule = await import(moduleImportPath);
      
      // Chercher les exports qui sont des instances de BaseEffect
      const effectInstances = this.extractEffectsFromModule(module);
      
      if (effectInstances.length === 0) {
        console.warn(`⚠️ Aucun effet valide trouvé dans ${path.basename(filePath)}`);
        return false;
      }
      
      // Enregistrer tous les effets trouvés
      for (const effect of effectInstances) {
        this.registerEffect(effect, category);
      }
      
      console.log(`🎭 ${effectInstances.length} effet(s) chargé(s) depuis ${path.basename(filePath)}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de ${path.basename(filePath)}:`, error);
      return false;
    }
  }
  
  // Extrait les effets valides d'un module
  private static extractEffectsFromModule(module: EffectModule): BaseEffect[] {
    const effects: BaseEffect[] = [];
    
    for (const [exportName, exportValue] of Object.entries(module)) {
      // Vérifier si c'est une instance de BaseEffect
      if (this.isValidEffectInstance(exportValue)) {
        effects.push(exportValue as BaseEffect);
      }
      // Vérifier si c'est une classe qui étend BaseEffect
      else if (this.isEffectClass(exportValue)) {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidEffectInstance(instance)) {
            effects.push(instance);
          }
        } catch (error) {
          console.warn(`⚠️ Impossible d'instancier ${exportName}:`, error);
        }
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
  
  // Enregistre un effet
  private static registerEffect(effect: BaseEffect, category: string): void {
    const effectId = effect.id;
    
    if (this.loadedEffects.has(effectId)) {
      console.warn(`⚠️ Effet dupliqué ignoré: ${effectId}`);
      return;
    }
    
    this.loadedEffects.set(effectId, effect);
    
    // Organiser par catégorie
    if (!this.effectCategories.has(category)) {
      this.effectCategories.set(category, []);
    }
    this.effectCategories.get(category)!.push(effectId);
    
    console.log(`✅ ${effect.name} (${effectId}) enregistré dans ${category}`);
  }
  
  // Affiche un résumé des effets chargés
  private static displayLoadedEffects(): void {
    console.log("\n📊 === RÉSUMÉ DES EFFETS CHARGÉS ===");
    
    for (const [category, effectIds] of this.effectCategories.entries()) {
      console.log(`🎭 ${category}: ${effectIds.length} effet(s)`);
      effectIds.forEach(id => {
        const effect = this.loadedEffects.get(id);
        if (effect) {
          console.log(`   • ${effect.name} (${id})`);
        }
      });
    }
    
    console.log(`\n💫 Total: ${this.loadedEffects.size} effets chargés automatiquement`);
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
      console.warn(`⚠️ Impossible de créer ${dirPath}:`, error);
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
      )
    };
  }
  
  // Rechargement à chaud (pour le développement)
  static async hotReload(): Promise<void> {
    console.log("🔄 Rechargement à chaud des effets...");
    this.loadedEffects.clear();
    this.effectCategories.clear();
    await this.autoLoadEffects();
  }
  
  // Validation de l'intégrité des effets chargés
  static validateLoadedEffects(): boolean {
    let allValid = true;
    
    for (const [id, effect] of this.loadedEffects.entries()) {
      if (!this.validateEffect(effect)) {
        console.error(`❌ Effet invalide: ${id}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log("✅ Tous les effets chargés sont valides");
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
}

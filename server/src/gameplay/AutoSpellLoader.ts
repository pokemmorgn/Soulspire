// server/src/gameplay/AutoSpellLoader.ts - VERSION AMÉLIORÉE
import * as fs from 'fs';
import * as path from 'path';
import { BaseSpell } from './base/BaseSpell';

interface SpellModule {
  [key: string]: any;
}

export class AutoSpellLoader {
  private static loadedSpells: Map<string, BaseSpell> = new Map();
  private static spellCategories: Map<string, string[]> = new Map();
  private static initialized: boolean = false;
  private static loadedFiles: Set<string> = new Set(); // ✅ Cache des fichiers
  
  static async autoLoadSpells(): Promise<void> {
    // ✅ PROTECTION contre double initialisation
    if (this.initialized) {
      console.log(`🔄 AutoSpellLoader déjà initialisé (${this.loadedSpells.size} sorts), skip`);
      return;
    }
    
    console.log("🔍 Auto-découverte des sorts...");
    
    const spellDirectories = [
      { path: './actives', category: 'active' },
      { path: './ultimates', category: 'ultimate' },
      { path: './passives', category: 'passive' },
      { path: './utilities', category: 'utility' }
    ];
    
    let totalLoaded = 0;
    
    for (const dir of spellDirectories) {
      const loaded = await this.loadSpellsFromDirectory(dir.path, dir.category);
      totalLoaded += loaded;
    }
    
    this.initialized = true; // ✅ Marquer comme initialisé
    console.log(`✨ ${totalLoaded} sorts auto-chargés dans ${spellDirectories.length} catégories`);
    this.displayLoadedSpells();
  }
  
  private static async loadSpellFromFile(filePath: string, category: string): Promise<boolean> {
    try {
      // ✅ PROTECTION contre double chargement du même fichier
      if (this.loadedFiles.has(filePath)) {
        console.log(`⏭️ Fichier ${path.basename(filePath)} déjà chargé, skip`);
        return false;
      }
      
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      const moduleImportPath = './' + relativePath.replace(/\.(ts|js)$/, '');
      
      console.log(`🔍 Tentative de chargement: ${moduleImportPath}`);
      
      // ✅ Nettoyer le cache require pour éviter les anciens imports
      delete require.cache[require.resolve(moduleImportPath)];
      
      const module: SpellModule = await import(moduleImportPath);
      
      // ✅ AMÉLIORATION: Extraction plus intelligente
      const spellInstances = this.extractSpellsFromModuleSmarter(module, path.basename(filePath));
      
      if (spellInstances.length === 0) {
        console.warn(`⚠️ Aucun sort valide trouvé dans ${path.basename(filePath)}`);
        return false;
      }
      
      // Enregistrer tous les sorts trouvés
      let registeredCount = 0;
      for (const spell of spellInstances) {
        if (this.registerSpell(spell, category)) {
          registeredCount++;
        }
      }
      
      if (registeredCount > 0) {
        this.loadedFiles.add(filePath); // ✅ Marquer comme chargé
        console.log(`📜 ${registeredCount} sort(s) chargé(s) depuis ${path.basename(filePath)}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de ${path.basename(filePath)}:`, error);
      return false;
    }
  }
  
  // ✅ NOUVELLE MÉTHODE: Extraction plus intelligente
  private static extractSpellsFromModuleSmarter(module: SpellModule, fileName: string): BaseSpell[] {
    const spells: BaseSpell[] = [];
    const processedIds = new Set<string>(); // Éviter les doublons dans le même fichier
    
    for (const [exportName, exportValue] of Object.entries(module)) {
      let spellInstance: BaseSpell | null = null;
      
      // ✅ PRIORISER les instances directes (exportName finit par "Spell")
      if (this.isValidSpellInstance(exportValue)) {
        spellInstance = exportValue as BaseSpell;
        
        // ✅ FILTRER: Si c'est une classe ET qu'on a déjà l'instance, skip la classe
        const spellId = spellInstance.config.id;
        if (processedIds.has(spellId)) {
          console.log(`⏭️ Sort ${spellId} déjà traité dans ${fileName}, skip export "${exportName}"`);
          continue;
        }
      }
      // Vérifier si c'est une classe SEULEMENT si on n'a pas encore trouvé l'instance
      else if (this.isSpellClass(exportValue)) {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidSpellInstance(instance)) {
            const spellId = instance.config.id;
            
            // ✅ SKIP si on a déjà une instance de ce sort
            if (!processedIds.has(spellId)) {
              spellInstance = instance;
            } else {
              console.log(`⏭️ Instance de ${spellId} déjà trouvée, skip classe "${exportName}"`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Impossible d'instancier ${exportName} dans ${fileName}:`, error);
        }
      }
      
      // Ajouter l'instance si valide et pas encore traitée
      if (spellInstance && !processedIds.has(spellInstance.config.id)) {
        spells.push(spellInstance);
        processedIds.add(spellInstance.config.id);
        console.log(`✅ ${spellInstance.config.name} (${spellInstance.config.id}) extrait depuis ${exportName}`);
      }
    }
    
    return spells;
  }
  
  // ✅ AMÉLIORATION: Meilleure détection des instances
  private static isValidSpellInstance(obj: any): boolean {
    return obj && 
           typeof obj === 'object' && 
           obj.config && 
           typeof obj.config.id === 'string' && 
           typeof obj.config.name === 'string' &&
           typeof obj.execute === 'function' &&
           typeof obj.canCast === 'function' &&
           // ✅ Vérifier que ce n'est pas une classe (pas de prototype.constructor)
           !obj.prototype;
  }
  
  private static registerSpell(spell: BaseSpell, category: string): boolean {
    const spellId = spell.config.id;
    
    if (this.loadedSpells.has(spellId)) {
      console.warn(`⚠️ Sort dupliqué ignoré: ${spellId}`);
      return false;
    }
    
    this.loadedSpells.set(spellId, spell);
    
    if (!this.spellCategories.has(category)) {
      this.spellCategories.set(category, []);
    }
    this.spellCategories.get(category)!.push(spellId);
    
    console.log(`✅ ${spell.config.name} (${spellId}) enregistré dans ${category}`);
    return true;
  }
  
  // ✅ NOUVEAU: Méthode de reset pour les tests
  static reset(): void {
    this.loadedSpells.clear();
    this.spellCategories.clear();
    this.loadedFiles.clear();
    this.initialized = false;
    console.log("🔄 AutoSpellLoader reseté");
  }
  
  // ✅ NOUVEAU: Hot reload amélioré
  static async hotReload(): Promise<void> {
    console.log("🔄 Rechargement à chaud des sorts...");
    this.reset();
    await this.autoLoadSpells();
  }
  
  // ... resto des méthodes existantes (getSpell, getAllSpells, etc.)
  static getSpell(spellId: string): BaseSpell | undefined {
    return this.loadedSpells.get(spellId);
  }
  
  static getAllSpells(): BaseSpell[] {
    return Array.from(this.loadedSpells.values());
  }
  
  static getSpellsByCategory(category: string): BaseSpell[] {
    const spellIds = this.spellCategories.get(category) || [];
    return spellIds.map(id => this.loadedSpells.get(id)).filter(Boolean) as BaseSpell[];
  }
  
  private static displayLoadedSpells(): void {
    console.log("\n📊 === RÉSUMÉ DES SORTS CHARGÉS ===");
    
    for (const [category, spellIds] of this.spellCategories.entries()) {
      console.log(`🔮 ${category}: ${spellIds.length} sorts`);
      spellIds.forEach(id => {
        const spell = this.loadedSpells.get(id);
        if (spell) {
          console.log(`   • ${spell.config.name} (${id})`);
        }
      });
    }
    
    console.log(`\n💫 Total: ${this.loadedSpells.size} sorts chargés automatiquement`);
  }
}

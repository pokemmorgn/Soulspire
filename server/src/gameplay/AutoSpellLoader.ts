// server/src/gameplay/AutoSpellLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { BaseSpell } from './base/BaseSpell';

interface SpellModule {
  [key: string]: any;
}

interface SpellInfo {
  id: string;
  name: string;
  category: string;
  instance: BaseSpell;
}

export class AutoSpellLoader {
  private static loadedSpells: Map<string, BaseSpell> = new Map();
  private static spellCategories: Map<string, string[]> = new Map();
  
  // ✅ AJOUT : Protection contre le double chargement
  private static initialized: boolean = false;
  private static loadedFiles: Set<string> = new Set();
  
  // Auto-découverte et chargement de tous les sorts
  static async autoLoadSpells(): Promise<void> {
    // ✅ NOUVEAU : Éviter le rechargement multiple
    if (this.initialized) {
      console.log(`✅ Sorts déjà chargés (${this.loadedSpells.size}), skip reload`);
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
    
    console.log(`✨ ${totalLoaded} sorts auto-chargés dans ${spellDirectories.length} catégories`);
    this.displayLoadedSpells();
    
    // ✅ NOUVEAU : Marquer comme initialisé
    this.initialized = true;
  }
  
  // Charge tous les sorts d'un répertoire
  private static async loadSpellsFromDirectory(dirPath: string, category: string): Promise<number> {
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
      const spellFiles = files.filter(file => 
        (file.endsWith('.ts') || file.endsWith('.js')) && 
        !file.endsWith('.d.ts') &&
        file !== 'index.ts' &&
        file !== 'index.js'
      );
      
      for (const file of spellFiles) {
        const filePath = path.join(fullPath, file);
        
        // ✅ NOUVEAU : Éviter de charger le même fichier plusieurs fois
        if (this.loadedFiles.has(filePath)) {
          console.log(`📋 Fichier ${file} déjà chargé, skip`);
          continue;
        }
        
        const loaded = await this.loadSpellFromFile(filePath, category);
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
  
  // Charge un sort depuis un fichier
  private static async loadSpellFromFile(filePath: string, category: string): Promise<boolean> {
    try {
      // Convertir le chemin absolu en chemin relatif correct depuis AutoSpellLoader.ts
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      
      // Supprimer l'extension pour l'import
      const moduleImportPath = './' + relativePath.replace(/\.(ts|js)$/, '');
      
      console.log(`🔍 Tentative de chargement: ${moduleImportPath}`);
      
      // ✅ NOUVEAU : Gestion du cache pour éviter les conflits
      delete require.cache[require.resolve(moduleImportPath)];
      
      // Import dynamique du module
      const module: SpellModule = await import(moduleImportPath);
      
      // Chercher les exports qui sont des instances de BaseSpell
      const spellInstances = this.extractSpellsFromModule(module);
      
      if (spellInstances.length === 0) {
        console.warn(`⚠️ Aucun sort valide trouvé dans ${path.basename(filePath)}`);
        return false;
      }
      
      // Enregistrer tous les sorts trouvés (avec déduplication)
      let registeredCount = 0;
      for (const spell of spellInstances) {
        if (this.registerSpell(spell, category)) {
          registeredCount++;
        }
      }
      
      if (registeredCount > 0) {
        console.log(`📜 ${registeredCount} sort(s) chargé(s) depuis ${path.basename(filePath)}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de ${path.basename(filePath)}:`, error);
      return false;
    }
  }
  
  // Extrait les sorts valides d'un module
  private static extractSpellsFromModule(module: SpellModule): BaseSpell[] {
    const spells: BaseSpell[] = [];
    const processedIds = new Set<string>(); // ✅ NOUVEAU : Éviter les doublons dans le même fichier
    
    for (const [exportName, exportValue] of Object.entries(module)) {
      let spellInstance: BaseSpell | null = null;
      
      // Vérifier si c'est une instance de BaseSpell
      if (this.isValidSpellInstance(exportValue)) {
        spellInstance = exportValue as BaseSpell;
      }
      // Vérifier si c'est une classe qui étend BaseSpell
      else if (this.isSpellClass(exportValue)) {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidSpellInstance(instance)) {
            spellInstance = instance;
          }
        } catch (error) {
          console.warn(`⚠️ Impossible d'instancier ${exportName}:`, error);
        }
      }
      
      // ✅ NOUVEAU : Ajouter l'effet si valide et pas encore traité
      if (spellInstance && !processedIds.has(spellInstance.config.id)) {
        spells.push(spellInstance);
        processedIds.add(spellInstance.config.id);
      }
    }
    
    return spells;
  }
  
  // Vérifie si un objet est une instance valide de BaseSpell
  private static isValidSpellInstance(obj: any): boolean {
    return obj && 
           typeof obj === 'object' && 
           obj.config && 
           typeof obj.config.id === 'string' && 
           typeof obj.execute === 'function' &&
           typeof obj.canCast === 'function';
  }
  
  // Vérifie si un export est une classe de sort
  private static isSpellClass(obj: any): boolean {
    return typeof obj === 'function' && 
           obj.prototype && 
           typeof obj.prototype.execute === 'function';
  }
  
  // Enregistre un sort (✅ NOUVEAU : avec déduplication)
  private static registerSpell(spell: BaseSpell, category: string): boolean {
    const spellId = spell.config.id;
    
    if (this.loadedSpells.has(spellId)) {
      console.warn(`⚠️ Sort dupliqué ignoré: ${spellId}`);
      return false;
    }
    
    this.loadedSpells.set(spellId, spell);
    
    // Organiser par catégorie
    if (!this.spellCategories.has(category)) {
      this.spellCategories.set(category, []);
    }
    this.spellCategories.get(category)!.push(spellId);
    
    console.log(`✅ ${spell.config.name} (${spellId}) enregistré dans ${category}`);
    return true;
  }
  
  // Affiche un résumé des sorts chargés
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
  
  // Crée la structure de répertoires si elle n'existe pas
  private static createDirectoryStructure(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      
      // Créer un fichier README dans chaque répertoire
      const readmeContent = `# ${path.basename(dirPath)} Spells

Ce répertoire contient les sorts de type ${path.basename(dirPath)}.

## Convention de nommage :
- Fichier : \`spell_name.ts\`
- Export : \`export const spellNameSpell = new SpellNameSpell();\`
- Classe : \`class SpellNameSpell extends BaseSpell\`

## Auto-découverte :
Les sorts dans ce répertoire sont automatiquement chargés par l'AutoSpellLoader.
`;
      
      fs.writeFileSync(path.join(dirPath, 'README.md'), readmeContent);
      
    } catch (error) {
      console.warn(`⚠️ Impossible de créer ${dirPath}:`, error);
    }
  }
  
  // API publique pour récupérer les sorts
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
  
  static getLoadedSpellIds(): string[] {
    return Array.from(this.loadedSpells.keys());
  }
  
  static getCategories(): string[] {
    return Array.from(this.spellCategories.keys());
  }
  
  static getStats(): any {
    return {
      totalSpells: this.loadedSpells.size,
      categories: Object.fromEntries(
        Array.from(this.spellCategories.entries()).map(([cat, spells]) => [cat, spells.length])
      ),
      spellsList: Object.fromEntries(
        Array.from(this.loadedSpells.entries()).map(([id, spell]) => [id, spell.config.name])
      ),
      filesLoaded: this.loadedFiles.size,
      initialized: this.initialized
    };
  }
  
  // ✅ NOUVEAU : Vérifier l'état d'initialisation
  static isInitialized(): boolean {
    return this.initialized;
  }
  
  // Rechargement à chaud (pour le développement)
  static async hotReload(): Promise<void> {
    console.log("🔄 Rechargement à chaud des sorts...");
    this.loadedSpells.clear();
    this.spellCategories.clear();
    this.loadedFiles.clear();
    this.initialized = false;
    await this.autoLoadSpells();
  }
  
  // Validation de l'intégrité des sorts chargés
  static validateLoadedSpells(): boolean {
    let allValid = true;
    
    for (const [id, spell] of this.loadedSpells.entries()) {
      if (!this.validateSpell(spell)) {
        console.error(`❌ Sort invalide: ${id}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log("✅ Tous les sorts chargés sont valides");
    }
    
    return allValid;
  }
  
  private static validateSpell(spell: BaseSpell): boolean {
    const config = spell.config;
    
    if (!config.id || typeof config.id !== 'string') return false;
    if (!config.name || typeof config.name !== 'string') return false;
    if (!['active', 'ultimate', 'passive'].includes(config.type)) return false;
    if (typeof config.energyCost !== 'number' || config.energyCost < 0) return false;
    if (typeof spell.execute !== 'function') return false;
    if (typeof spell.canCast !== 'function') return false;
    
    return true;
  }
  
  // ✅ NOUVEAU : Reset complet pour les tests
  static reset(): void {
    this.loadedSpells.clear();
    this.spellCategories.clear();
    this.loadedFiles.clear();
    this.initialized = false;
  }
  
  // ✅ NOUVEAU : Diagnostic détaillé
  static diagnose(): void {
    console.log("🔧 DIAGNOSTIC AUTOSPELLLOADER");
    console.log(`Initialisé: ${this.initialized}`);
    console.log(`Sorts chargés: ${this.loadedSpells.size}`);
    console.log(`Fichiers traités: ${this.loadedFiles.size}`);
    console.log(`Catégories: ${this.spellCategories.size}`);
    
    if (this.loadedSpells.size === 0) {
      console.log("⚠️ ATTENTION: Aucun sort chargé !");
    }
    
    this.validateLoadedSpells();
  }
}

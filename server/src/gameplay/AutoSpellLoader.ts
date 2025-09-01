import * as fs from 'fs';
import * as path from 'path';
import { BaseSpell } from './base/BaseSpell';

// Interface pour les modules de sorts auto-découverts
interface SpellModule {
  [key: string]: any;
}

// Interface pour les informations d'un sort
interface SpellInfo {
  id: string;
  name: string;
  category: string;
  instance: BaseSpell;
}

export class AutoSpellLoader {
  private static loadedSpells: Map<string, BaseSpell> = new Map();
  private static spellCategories: Map<string, string[]> = new Map();
  
  // Auto-découverte et chargement de tous les sorts
  static async autoLoadSpells(): Promise<void> {
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
        const loaded = await this.loadSpellFromFile(path.join(fullPath, file), category);
        if (loaded) loadedCount++;
      }
      
    } catch (error) {
      console.warn(`⚠️ Erreur lors du scan du répertoire ${dirPath}:`, error);
    }
    
    return loadedCount;
  }
  
  // Charge un sort depuis un fichier
  private static async loadSpellFromFile(filePath: string, category: string): Promise<boolean> {
    try {
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      const modulePath = relativePath.replace(/\.(ts|js)$/, '');
      
      // Import dynamique du module
      const module: SpellModule = await import(modulePath);
      
      // Chercher les exports qui sont des instances de BaseSpell
      const spellInstances = this.extractSpellsFromModule(module);
      
      if (spellInstances.length === 0) {
        console.warn(`⚠️ Aucun sort valide trouvé dans ${path.basename(filePath)}`);
        return false;
      }
      
      // Enregistrer tous les sorts trouvés
      for (const spell of spellInstances) {
        this.registerSpell(spell, category);
      }
      
      console.log(`📜 ${spellInstances.length} sort(s) chargé(s) depuis ${path.basename(filePath)}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erreur lors du chargement de ${path.basename(filePath)}:`, error);
      return false;
    }
  }
  
  // Extrait les sorts valides d'un module
  private static extractSpellsFromModule(module: SpellModule): BaseSpell[] {
    const spells: BaseSpell[] = [];
    
    for (const [exportName, exportValue] of Object.entries(module)) {
      // Vérifier si c'est une instance de BaseSpell
      if (this.isValidSpellInstance(exportValue)) {
        spells.push(exportValue as BaseSpell);
      }
      // Vérifier si c'est une classe qui étend BaseSpell
      else if (this.isSpellClass(exportValue)) {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidSpellInstance(instance)) {
            spells.push(instance);
          }
        } catch (error) {
          console.warn(`⚠️ Impossible d'instancier ${exportName}:`, error);
        }
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
  
  // Enregistre un sort
  private static registerSpell(spell: BaseSpell, category: string): void {
    const spellId = spell.config.id;
    
    if (this.loadedSpells.has(spellId)) {
      console.warn(`⚠️ Sort dupliqué ignoré: ${spellId}`);
      return;
    }
    
    this.loadedSpells.set(spellId, spell);
    
    // Organiser par catégorie
    if (!this.spellCategories.has(category)) {
      this.spellCategories.set(category, []);
    }
    this.spellCategories.get(category)!.push(spellId);
    
    console.log(`✅ ${spell.config.name} (${spellId}) enregistré dans ${category}`);
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
      )
    };
  }
  
  // Rechargement à chaud (pour le développement)
  static async hotReload(): Promise<void> {
    console.log("🔄 Rechargement à chaud des sorts...");
    this.loadedSpells.clear();
    this.spellCategories.clear();
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
}

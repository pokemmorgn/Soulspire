/**
 * MonstersForm - Gestion du formulaire de création/édition de monstres
 * Avec import JSON assisté par ChatGPT
 */
class MonstersForm {
  constructor() {
    this.currentMode = null;
    this.currentMonster = null;
  }

  /**
   * Rendre le modal HTML
   */
  renderModal() {
    return `
      <div id="monsterFormModal" class="modal">
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2 id="monsterFormTitle">Create Monster</h2>
            <span class="modal-close" onclick="MonstersForm.closeModal()">&times;</span>
          </div>
          <div class="modal-body" id="monsterFormBody"></div>
        </div>
      </div>
    `;
  }

  /**
   * Afficher le modal en mode création
   */
  showCreateModal() {
    this.currentMode = 'create';
    this.currentMonster = null;
    
    document.getElementById('monsterFormTitle').textContent = '🆕 Create New Monster';
    document.getElementById('monsterFormBody').innerHTML = this.renderForm();
    document.getElementById('monsterFormModal').style.display = 'block';
  }

  /**
   * Afficher le modal en mode édition
   */
  showEditModal(monster) {
    this.currentMode = 'edit';
    this.currentMonster = monster;
    
    document.getElementById('monsterFormTitle').textContent = `✏️ Edit Monster: ${monster.name}`;
    document.getElementById('monsterFormBody').innerHTML = this.renderForm(monster);
    document.getElementById('monsterFormModal').style.display = 'block';
  }

  /**
   * Rendre le formulaire
   */
  renderForm(monster = null) {
    const isEdit = !!monster;
    
    return `
      <form id="monsterForm" class="monster-form">
        <!-- Onglets -->
        <div class="form-tabs">
          <button type="button" class="form-tab active" onclick="MonstersForm.switchTab('jsonImport')">🤖 JSON Import</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('basic')">📋 Basic Info</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('stats')">📊 Base Stats</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('spells')">✨ Spells</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('appearance')">🎨 Appearance</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('advanced')">⚙️ Advanced</button>
        </div>

        <!-- Tab: JSON Import -->
        <div id="formTabJsonImport" class="form-tab-content active">
          ${this.renderJsonImportTab()}
        </div>

        <!-- Tab: Basic Info -->
        <div id="formTabBasic" class="form-tab-content">
          ${this.renderBasicInfoTab(monster)}
        </div>

        <!-- Tab: Stats -->
        <div id="formTabStats" class="form-tab-content">
          ${this.renderStatsTab(monster)}
        </div>

        <!-- Tab: Spells -->
        <div id="formTabSpells" class="form-tab-content">
          ${this.renderSpellsTab(monster)}
        </div>

        <!-- Tab: Appearance -->
        <div id="formTabAppearance" class="form-tab-content">
          ${this.renderAppearanceTab(monster)}
        </div>

        <!-- Tab: Advanced -->
        <div id="formTabAdvanced" class="form-tab-content">
          ${this.renderAdvancedTab(monster)}
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="MonstersForm.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            ${isEdit ? '💾 Update Monster' : '✨ Create Monster'}
          </button>
        </div>
      </form>
    `;
  }

  /**
   * 🆕 Tab: JSON Import avec prompt ChatGPT
   */
  renderJsonImportTab() {
    const promptTemplate = this.generateChatGPTPrompt();
    
    return `
      <div class="form-section json-import-section">
        <h3>🤖 Quick Monster Creation with ChatGPT</h3>
        
        <div class="alert info" style="margin-bottom: 20px;">
          <strong>ℹ️ How it works:</strong>
          <ol style="margin: 10px 0 0 20px; padding: 0;">
            <li>Copy the prompt below</li>
            <li>Paste it to ChatGPT with your monster details</li>
            <li>Copy the JSON response from ChatGPT</li>
            <li>Paste it in the JSON input below</li>
            <li>Click "Parse JSON" to auto-fill the form</li>
          </ol>
        </div>

        <!-- ChatGPT Prompt -->
        <div class="form-group">
          <label for="chatgptPrompt">
            📋 ChatGPT Prompt Template
            <button type="button" class="btn btn-small btn-info" onclick="MonstersForm.copyChatGPTPrompt()" style="margin-left: 10px;">
              📋 Copy Prompt
            </button>
          </label>
          <textarea id="chatgptPrompt" class="form-control" rows="12" readonly>${promptTemplate}</textarea>
          <small style="color: #666; margin-top: 5px; display: block;">
            Copy this prompt and send it to ChatGPT with your monster description
          </small>
        </div>

        <!-- JSON Input -->
        <div class="form-group">
          <label for="jsonInput">
            🤖 Paste ChatGPT JSON Response Here
            <button type="button" class="btn btn-small btn-success" onclick="MonstersForm.parseJSON()" style="margin-left: 10px;">
              ✨ Parse JSON
            </button>
            <button type="button" class="btn btn-small btn-secondary" onclick="MonstersForm.clearJSON()" style="margin-left: 5px;">
              🗑️ Clear
            </button>
          </label>
          <textarea id="jsonInput" class="form-control" rows="15" 
                    placeholder='Paste the JSON from ChatGPT here...

Example format:
{
  "monsterId": "MON_fire_goblin",
  "name": "Fire Goblin",
  "type": "normal",
  ...
}'></textarea>
          <small style="color: #666; margin-top: 5px; display: block;">
            The JSON will automatically fill all the form fields
          </small>
        </div>

        <!-- Preview Zone -->
        <div id="jsonPreview" class="json-preview" style="display: none;">
          <h4>✅ JSON Parsed Successfully!</h4>
          <div id="jsonPreviewContent"></div>
          <p style="margin-top: 15px; color: #28a745; font-weight: 600;">
            → Switch to other tabs to review the auto-filled data, or click "Create Monster" to submit.
          </p>
        </div>

        <!-- Example -->
        <div class="form-group" style="margin-top: 30px;">
          <button type="button" class="btn btn-small btn-secondary" onclick="MonstersForm.loadExampleJSON()">
            📝 Load Example JSON
          </button>
          <small style="margin-left: 10px; color: #666;">
            Load an example to see the expected format
          </small>
        </div>
      </div>
    `;
  }

  /**
   * 🆕 Générer le prompt ChatGPT
   */
  generateChatGPTPrompt() {
    return `You are a game designer assistant. I need you to create a monster for my idle RPG game.

**IMPORTANT INSTRUCTIONS:**
1. Generate a complete monster data in JSON format
2. Follow the exact structure provided below
3. Be creative with stats, spells, and descriptions
4. Ensure all required fields are present
5. Return ONLY the JSON object, no additional text

**Monster Information I'm Providing:**
[PASTE YOUR MONSTER DESCRIPTION HERE - e.g., "A fierce fire goblin warrior with high attack"]

**Required JSON Structure:**
\`\`\`json
{
  "monsterId": "MON_[element]_[name]",
  "name": "Monster Name",
  "displayName": "Monster Display Name",
  "type": "normal|elite|boss",
  "element": "Fire|Water|Wind|Electric|Light|Dark",
  "role": "Tank|DPS Melee|DPS Ranged|Support",
  "rarity": "Common|Rare|Epic|Legendary|Mythic",
  "description": "Detailed monster description",
  "visualTheme": "forest|beast|undead|demon|elemental|construct|celestial|shadow|dragon|giant|insect|aquatic|corrupted",
  "spriteId": "monster_sprite_id",
  "animationSet": "animation_set_name",
  "baseStats": {
    "hp": 1000,
    "atk": 100,
    "def": 50,
    "crit": 5,
    "critDamage": 50,
    "vitesse": 80,
    "dodge": 0,
    "accuracy": 0,
    "moral": 60
  },
  "spells": {
    "ultimate": {
      "id": "spell_ultimate_id",
      "level": 1
    },
    "passive": {
      "id": "spell_passive_id",
      "level": 1
    },
    "spell1": {
      "id": "spell_1_id",
      "level": 1
    }
  },
  "worldTags": [1, 2, 3],
  "minWorldLevel": 1,
  "maxWorldLevel": 5,
  "isUnique": false,
  "isSummonable": false,
  "canSummon": false
}
\`\`\`

**Rules for Monster Creation:**
- Monster ID format: MON_[element]_[name] (lowercase, underscores)
- HP range: 500-20000 based on role (Tank = high HP)
- ATK range: 50-4000 based on role (DPS = high ATK)
- DEF range: 20-2000 based on role (Tank = high DEF)
- Crit: 0-30% (most monsters 5-15%)
- Crit Damage: 50-200%
- Speed: 50-200 (average 80-100)
- Spell IDs should be descriptive (e.g., "fire_storm", "shadow_strike")

**Please generate the complete JSON now based on the monster description I provided above.**`;
  }

  /**
   * 🆕 Copier le prompt ChatGPT
   */
  copyChatGPTPrompt() {
    const promptElement = document.getElementById('chatgptPrompt');
    promptElement.select();
    document.execCommand('copy');
    
    AdminCore.showAlert('✅ Prompt copied to clipboard! Paste it in ChatGPT.', 'success', 3000);
  }

  /**
   * 🆕 Parser le JSON et remplir le formulaire
   */
  parseJSON() {
    try {
      const jsonInput = document.getElementById('jsonInput').value.trim();
      
      if (!jsonInput) {
        AdminCore.showAlert('Please paste JSON data first', 'error');
        return;
      }

      // Nettoyer le JSON (enlever les backticks markdown si présents)
      let cleanedJSON = jsonInput
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      // Parser le JSON
      const data = JSON.parse(cleanedJSON);

      // Validation basique
      if (!data.monsterId || !data.name) {
        throw new Error('Missing required fields: monsterId or name');
      }

      // Remplir tous les champs du formulaire
      this.fillFormFromJSON(data);

      // Afficher la preview
      this.showJSONPreview(data);

      AdminCore.showAlert('✅ JSON parsed successfully! Form fields auto-filled.', 'success', 5000);

    } catch (error) {
      console.error('JSON Parse Error:', error);
      AdminCore.showAlert('❌ Invalid JSON format: ' + error.message, 'error', 8000);
    }
  }

  /**
   * 🆕 Remplir le formulaire depuis JSON
   */
  fillFormFromJSON(data) {
    // Basic Info
    if (data.monsterId) document.getElementById('monsterId').value = data.monsterId;
    if (data.name) document.getElementById('monsterName').value = data.name;
    if (data.type) document.getElementById('monsterType').value = data.type;
    if (data.element) document.getElementById('monsterElement').value = data.element;
    if (data.role) document.getElementById('monsterRole').value = data.role;
    if (data.rarity) document.getElementById('monsterRarity').value = data.rarity;
    if (data.description) document.getElementById('monsterDescription').value = data.description;

    // Base Stats
    if (data.baseStats) {
      if (data.baseStats.hp) document.getElementById('statHp').value = data.baseStats.hp;
      if (data.baseStats.atk) document.getElementById('statAtk').value = data.baseStats.atk;
      if (data.baseStats.def) document.getElementById('statDef').value = data.baseStats.def;
      if (data.baseStats.crit !== undefined) document.getElementById('statCrit').value = data.baseStats.crit;
      if (data.baseStats.critDamage) document.getElementById('statCritDamage').value = data.baseStats.critDamage;
      if (data.baseStats.vitesse) document.getElementById('statVitesse').value = data.baseStats.vitesse;
      if (data.baseStats.dodge !== undefined) document.getElementById('statDodge').value = data.baseStats.dodge;
      if (data.baseStats.accuracy !== undefined) document.getElementById('statAccuracy').value = data.baseStats.accuracy;
      if (data.baseStats.moral) document.getElementById('statMoral').value = data.baseStats.moral;
    }

    // Spells
    if (data.spells) {
      if (data.spells.ultimate?.id) document.getElementById('spellUltimate').value = data.spells.ultimate.id;
      if (data.spells.passive?.id) document.getElementById('spellPassive').value = data.spells.passive.id;
      if (data.spells.spell1?.id) document.getElementById('spell1').value = data.spells.spell1.id;
      if (data.spells.spell2?.id) document.getElementById('spell2').value = data.spells.spell2.id;
      if (data.spells.spell3?.id) document.getElementById('spell3').value = data.spells.spell3.id;
    }

    // Appearance
    if (data.visualTheme) document.getElementById('visualTheme').value = data.visualTheme;
    if (data.spriteId) document.getElementById('spriteId').value = data.spriteId;
    if (data.animationSet) document.getElementById('animationSet').value = data.animationSet;

    // Advanced
    if (data.worldTags) {
      document.getElementById('worldTags').value = data.worldTags.join(',');
    }
    if (data.minWorldLevel) document.getElementById('minWorldLevel').value = data.minWorldLevel;
    if (data.maxWorldLevel) document.getElementById('maxWorldLevel').value = data.maxWorldLevel;
    if (data.isUnique !== undefined) document.getElementById('isUnique').checked = data.isUnique;
    if (data.isSummonable !== undefined) document.getElementById('isSummonable').checked = data.isSummonable;
    if (data.canSummon !== undefined) document.getElementById('canSummon').checked = data.canSummon;
  }

  /**
   * 🆕 Afficher la preview du JSON parsé
   */
  showJSONPreview(data) {
    const preview = document.getElementById('jsonPreview');
    const content = document.getElementById('jsonPreviewContent');
    
    content.innerHTML = `
      <div class="json-preview-grid">
        <div class="preview-item">
          <strong>Monster:</strong> ${data.name}
        </div>
        <div class="preview-item">
          <strong>Type:</strong> ${data.type}
        </div>
        <div class="preview-item">
          <strong>Element:</strong> ${MonstersUI.getElementIcon(data.element)} ${data.element}
        </div>
        <div class="preview-item">
          <strong>Role:</strong> ${MonstersUI.getRoleIcon(data.role)} ${data.role}
        </div>
        <div class="preview-item">
          <strong>HP:</strong> ${data.baseStats?.hp || 'N/A'}
        </div>
        <div class="preview-item">
          <strong>ATK:</strong> ${data.baseStats?.atk || 'N/A'}
        </div>
        <div class="preview-item">
          <strong>DEF:</strong> ${data.baseStats?.def || 'N/A'}
        </div>
        <div class="preview-item">
          <strong>Ultimate:</strong> ${data.spells?.ultimate?.id || 'N/A'}
        </div>
      </div>
    `;
    
    preview.style.display = 'block';
  }

  /**
   * 🆕 Charger un exemple JSON
   */
  loadExampleJSON() {
    const example = {
      "monsterId": "MON_fire_goblin_warrior",
      "name": "Fire Goblin Warrior",
      "displayName": "Fire Goblin Warrior",
      "type": "normal",
      "element": "Fire",
      "role": "DPS Melee",
      "rarity": "Common",
      "description": "A fierce goblin warrior wielding flames. Quick and aggressive, it overwhelms enemies with rapid fire attacks.",
      "visualTheme": "beast",
      "spriteId": "monster_fire_goblin_01",
      "animationSet": "goblin_melee",
      "baseStats": {
        "hp": 800,
        "atk": 120,
        "def": 40,
        "crit": 8,
        "critDamage": 60,
        "vitesse": 95,
        "dodge": 5,
        "accuracy": 0,
        "moral": 70
      },
      "spells": {
        "ultimate": {
          "id": "fire_storm",
          "level": 1
        },
        "passive": {
          "id": "flame_aura",
          "level": 1
        },
        "spell1": {
          "id": "fire_strike",
          "level": 1
        }
      },
      "worldTags": [1, 2, 3],
      "minWorldLevel": 1,
      "maxWorldLevel": 5,
      "isUnique": false,
      "isSummonable": false,
      "canSummon": false
    };

    document.getElementById('jsonInput').value = JSON.stringify(example, null, 2);
    AdminCore.showAlert('✅ Example JSON loaded! Click "Parse JSON" to fill the form.', 'info', 5000);
  }

  /**
   * 🆕 Effacer le JSON
   */
  clearJSON() {
    document.getElementById('jsonInput').value = '';
    document.getElementById('jsonPreview').style.display = 'none';
    AdminCore.showAlert('JSON cleared', 'info', 2000);
  }

  // [... Le reste des méthodes existantes reste identique ...]
  // renderBasicInfoTab, renderStatsTab, renderSpellsTab, etc.
}

// Créer l'instance globale
window.MonstersForm = new MonstersForm();

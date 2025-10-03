/**
 * MonstersForm - Gestion du formulaire de création/édition de monstres
 * Avec import JSON assisté par ChatGPT
 */
class MonstersForm {
  constructor() {
    this.currentMode = null; // 'create' ou 'edit'
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
          <strong>📝 Simple 3-Step Process:</strong>
          <ol style="margin: 10px 0 0 20px; padding: 0; line-height: 1.8;">
            <li><strong>Copy the prompt below</strong> and replace the <code>[...]</code> placeholders with your monster info</li>
            <li><strong>Paste it to ChatGPT</strong> and let it generate the complete JSON</li>
            <li><strong>Copy the JSON response</strong> and paste it in the textarea below, then click "Parse JSON"</li>
          </ol>
        </div>

        <!-- Example Guide -->
        <div class="example-guide" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ffc107;">
          <h4 style="margin-top: 0; color: #856404;">📋 Example of what to replace in the prompt:</h4>
          <div class="example-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">
            <div class="example-item" style="background: white; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 600; color: #667eea;">Monster ID:</span><br>
              <code style="font-size: 12px;">MON_fire_goblin</code>
            </div>
            <div class="example-item" style="background: white; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 600; color: #667eea;">Name:</span><br>
              <code style="font-size: 12px;">Fire Goblin Warrior</code>
            </div>
            <div class="example-item" style="background: white; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 600; color: #667eea;">Type:</span><br>
              <code style="font-size: 12px;">Normal</code>
            </div>
            <div class="example-item" style="background: white; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 600; color: #667eea;">Element:</span><br>
              <code style="font-size: 12px;">Fire</code>
            </div>
            <div class="example-item" style="background: white; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 600; color: #667eea;">Role:</span><br>
              <code style="font-size: 12px;">DPS Melee</code>
            </div>
            <div class="example-item" style="background: white; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 600; color: #667eea;">Rarity:</span><br>
              <code style="font-size: 12px;">Common</code>
            </div>
          </div>
        </div>

        <!-- ChatGPT Prompt -->
        <div class="form-group">
          <label for="chatgptPrompt">
            <strong>📋 Step 1: Copy this prompt for ChatGPT</strong>
            <button type="button" class="btn btn-small btn-info" onclick="MonstersForm.copyChatGPTPrompt()" style="margin-left: 10px;">
              📋 Copy Prompt
            </button>
          </label>
          <textarea id="chatgptPrompt" class="form-control" rows="10" readonly>${promptTemplate}</textarea>
          <small style="color: #666; margin-top: 5px; display: block;">
            ✏️ Copy this, replace the [...] parts with your monster info, then paste to ChatGPT
          </small>
        </div>

        <!-- JSON Input -->
        <div class="form-group" style="margin-top: 30px;">
          <label for="jsonInput">
            <strong>🤖 Step 2 & 3: Paste ChatGPT JSON Response Here</strong>
            <button type="button" class="btn btn-small btn-success" onclick="MonstersForm.parseJSON()" style="margin-left: 10px;">
              ✨ Parse JSON
            </button>
            <button type="button" class="btn btn-small btn-secondary" onclick="MonstersForm.clearJSON()" style="margin-left: 5px;">
              🗑️ Clear
            </button>
          </label>
          <textarea id="jsonInput" class="form-control" rows="15" 
                    placeholder='Paste the complete JSON from ChatGPT here...

Example:
{
  "monsterId": "MON_fire_goblin",
  "name": "Fire Goblin Warrior",
  "type": "normal",
  ...
}'></textarea>
          <small style="color: #666; margin-top: 5px; display: block;">
            💡 The JSON will automatically fill all form fields. You can review/modify them in other tabs.
          </small>
        </div>

        <!-- Preview Zone -->
        <div id="jsonPreview" class="json-preview" style="display: none;">
          <h4>✅ JSON Parsed Successfully!</h4>
          <div id="jsonPreviewContent"></div>
          <p style="margin-top: 15px; color: #28a745; font-weight: 600;">
            → Switch to other tabs to review the auto-filled data, or click "Create Monster" to submit directly.
          </p>
        </div>

        <!-- Quick Actions -->
        <div class="form-group" style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef;">
          <button type="button" class="btn btn-small btn-secondary" onclick="MonstersForm.loadExampleJSON()">
            📝 Load Example JSON
          </button>
          <small style="margin-left: 10px; color: #666;">
            Load a complete example to see the expected format
          </small>
        </div>
      </div>
    `;
  }

  /**
   * 🆕 Générer le prompt ChatGPT simplifié
   */
  generateChatGPTPrompt() {
    return `You are a game designer assistant for an idle RPG game. Generate a monster based on the information below.

**Monster Information to Fill:**
- Monster ID: [e.g., MON_fire_goblin]
- Name: [e.g., Fire Goblin Warrior]
- Type: [Normal / Elite / Boss]
- Element: [Fire / Water / Wind / Electric / Light / Dark]
- Role: [Tank / DPS Melee / DPS Ranged / Support]
- Rarity: [Common / Rare / Epic / Legendary / Mythic]
- Description: [Brief description of the monster]

**IMPORTANT INSTRUCTIONS:**
1. Replace ALL [...] placeholders above with actual values
2. Return ONLY valid JSON, no markdown code blocks
3. Generate appropriate stats based on role (Tank = high HP, DPS = high ATK, etc.)
4. Create thematic spell IDs based on element and name
5. Use lowercase with underscores for IDs (e.g., fire_strike, shadow_bolt)

**Expected JSON Output:**
{
  "monsterId": "MON_[element]_[name]",
  "name": "Monster Full Name",
  "type": "normal",
  "element": "Fire",
  "role": "DPS Melee",
  "rarity": "Common",
  "description": "Your monster description here",
  "visualTheme": "beast",
  "spriteId": "monster_sprite_id",
  "animationSet": "animation_set",
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
    "ultimate": { "id": "element_ultimate", "level": 1 },
    "passive": { "id": "element_passive", "level": 1 },
    "spell1": { "id": "element_spell1", "level": 1 }
  },
  "worldTags": [1, 2, 3],
  "minWorldLevel": 1,
  "maxWorldLevel": 5,
  "isUnique": false,
  "isSummonable": false,
  "canSummon": false
}

**Now generate the complete JSON for my monster.**`;
  }

  /**
   * Tab: Basic Info
   */
  renderBasicInfoTab(monster) {
    return `
      <div class="form-section">
        <h3>Basic Information</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label for="monsterId">Monster ID *</label>
            <input type="text" id="monsterId" class="form-control" 
                   placeholder="MON_fire_goblin" 
                   value="${monster?.monsterId || ''}" 
                   ${monster ? 'readonly' : ''} required>
            <small>Format: MON_[element]_[name] (lowercase, no spaces)</small>
          </div>

          <div class="form-group">
            <label for="monsterName">Name *</label>
            <input type="text" id="monsterName" class="form-control" 
                   placeholder="Fire Goblin" 
                   value="${MonstersUI.escapeHtml(monster?.name || '')}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="monsterType">Type *</label>
            <select id="monsterType" class="form-control" required>
              <option value="normal" ${monster?.type === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="elite" ${monster?.type === 'elite' ? 'selected' : ''}>Elite</option>
              <option value="boss" ${monster?.type === 'boss' ? 'selected' : ''}>Boss</option>
            </select>
          </div>

          <div class="form-group">
            <label for="monsterElement">Element *</label>
            <select id="monsterElement" class="form-control" required>
              <option value="Fire" ${monster?.element === 'Fire' ? 'selected' : ''}>🔥 Fire</option>
              <option value="Water" ${monster?.element === 'Water' ? 'selected' : ''}>💧 Water</option>
              <option value="Wind" ${monster?.element === 'Wind' ? 'selected' : ''}>💨 Wind</option>
              <option value="Electric" ${monster?.element === 'Electric' ? 'selected' : ''}>⚡ Electric</option>
              <option value="Light" ${monster?.element === 'Light' ? 'selected' : ''}>✨ Light</option>
              <option value="Dark" ${monster?.element === 'Dark' ? 'selected' : ''}>🌑 Dark</option>
            </select>
          </div>

          <div class="form-group">
            <label for="monsterRole">Role *</label>
            <select id="monsterRole" class="form-control" required>
              <option value="Tank" ${monster?.role === 'Tank' ? 'selected' : ''}>🛡️ Tank</option>
              <option value="DPS Melee" ${monster?.role === 'DPS Melee' ? 'selected' : ''}>⚔️ DPS Melee</option>
              <option value="DPS Ranged" ${monster?.role === 'DPS Ranged' ? 'selected' : ''}>🏹 DPS Ranged</option>
              <option value="Support" ${monster?.role === 'Support' ? 'selected' : ''}>💚 Support</option>
            </select>
          </div>

          <div class="form-group">
            <label for="monsterRarity">Rarity *</label>
            <select id="monsterRarity" class="form-control" required>
              <option value="Common" ${monster?.rarity === 'Common' ? 'selected' : ''}>Common</option>
              <option value="Rare" ${monster?.rarity === 'Rare' ? 'selected' : ''}>Rare</option>
              <option value="Epic" ${monster?.rarity === 'Epic' ? 'selected' : ''}>Epic</option>
              <option value="Legendary" ${monster?.rarity === 'Legendary' ? 'selected' : ''}>Legendary</option>
              <option value="Mythic" ${monster?.rarity === 'Mythic' ? 'selected' : ''}>Mythic</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="monsterDescription">Description</label>
          <textarea id="monsterDescription" class="form-control" rows="3" 
                    placeholder="A fierce goblin warrior wielding flames...">${MonstersUI.escapeHtml(monster?.description || '')}</textarea>
        </div>
      </div>
    `;
  }

  /**
   * Tab: Stats
   */
  renderStatsTab(monster) {
    const stats = monster?.baseStats || {};
    
    return `
      <div class="form-section">
        <h3>Base Stats (Level 1, 1 Star)</h3>
        
        <div class="alert info" style="margin-bottom: 20px;">
          <strong>ℹ️ Info:</strong> These are base stats at level 1 with 1 star. Stats will scale automatically with level and stars.
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="statHp">HP *</label>
            <input type="number" id="statHp" class="form-control" min="100" max="20000" 
                   value="${stats.hp || 1000}" required>
          </div>

          <div class="form-group">
            <label for="statAtk">ATK *</label>
            <input type="number" id="statAtk" class="form-control" min="10" max="4000" 
                   value="${stats.atk || 100}" required>
          </div>

          <div class="form-group">
            <label for="statDef">DEF *</label>
            <input type="number" id="statDef" class="form-control" min="10" max="2000" 
                   value="${stats.def || 50}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="statCrit">Crit % (0-100)</label>
            <input type="number" id="statCrit" class="form-control" min="0" max="100" step="0.1" 
                   value="${stats.crit || 5}">
          </div>

          <div class="form-group">
            <label for="statCritDamage">Crit Damage %</label>
            <input type="number" id="statCritDamage" class="form-control" min="0" 
                   value="${stats.critDamage || 50}">
          </div>

          <div class="form-group">
            <label for="statVitesse">Speed (50-200)</label>
            <input type="number" id="statVitesse" class="form-control" min="50" max="200" 
                   value="${stats.vitesse || 80}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="statDodge">Dodge % (0-100)</label>
            <input type="number" id="statDodge" class="form-control" min="0" max="100" step="0.1" 
                   value="${stats.dodge || 0}">
          </div>

          <div class="form-group">
            <label for="statAccuracy">Accuracy % (0-100)</label>
            <input type="number" id="statAccuracy" class="form-control" min="0" max="100" step="0.1" 
                   value="${stats.accuracy || 0}">
          </div>

          <div class="form-group">
            <label for="statMoral">Moral (30-200)</label>
            <input type="number" id="statMoral" class="form-control" min="30" max="200" 
                   value="${stats.moral || 60}">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tab: Spells (ultimate optionnel avec défaut)
   */
  renderSpellsTab(monster) {
    const spells = monster?.spells || {};
    
    return `
      <div class="form-section">
        <h3>Monster Spells</h3>
        
        <div class="alert info" style="margin-bottom: 20px;">
          <strong>ℹ️ Note:</strong> If you leave Ultimate empty, a default "basic_attack" spell will be used. Other spells are optional.
        </div>

        <div class="form-group">
          <label for="spellUltimate">Ultimate Spell ID</label>
          <input type="text" id="spellUltimate" class="form-control" 
                 placeholder="fire_storm (leave empty for default: basic_attack)" 
                 value="${spells.ultimate?.id || ''}">
          <small>Leave empty to use default "basic_attack" spell</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="spellPassive">Passive Spell ID</label>
            <input type="text" id="spellPassive" class="form-control" 
                   placeholder="flame_aura" 
                   value="${spells.passive?.id || ''}">
          </div>

          <div class="form-group">
            <label for="spell1">Spell 1 ID</label>
            <input type="text" id="spell1" class="form-control" 
                   placeholder="fire_strike" 
                   value="${spells.spell1?.id || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="spell2">Spell 2 ID</label>
            <input type="text" id="spell2" class="form-control" 
                   placeholder="flame_dash" 
                   value="${spells.spell2?.id || ''}">
          </div>

          <div class="form-group">
            <label for="spell3">Spell 3 ID</label>
            <input type="text" id="spell3" class="form-control" 
                   placeholder="burning_shield" 
                   value="${spells.spell3?.id || ''}">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tab: Appearance
   */
  renderAppearanceTab(monster) {
    return `
      <div class="form-section">
        <h3>Visual & Thematic</h3>
        
        <div class="form-group">
          <label for="visualTheme">Visual Theme *</label>
          <select id="visualTheme" class="form-control" required>
            <option value="forest" ${monster?.visualTheme === 'forest' ? 'selected' : ''}>🌲 Forest</option>
            <option value="beast" ${monster?.visualTheme === 'beast' ? 'selected' : ''}>🐺 Beast</option>
            <option value="undead" ${monster?.visualTheme === 'undead' ? 'selected' : ''}>💀 Undead</option>
            <option value="demon" ${monster?.visualTheme === 'demon' ? 'selected' : ''}>👿 Demon</option>
            <option value="elemental" ${monster?.visualTheme === 'elemental' ? 'selected' : ''}>🌟 Elemental</option>
            <option value="construct" ${monster?.visualTheme === 'construct' ? 'selected' : ''}>🗿 Construct</option>
            <option value="celestial" ${monster?.visualTheme === 'celestial' ? 'selected' : ''}>👼 Celestial</option>
            <option value="shadow" ${monster?.visualTheme === 'shadow' ? 'selected' : ''}>🌑 Shadow</option>
            <option value="dragon" ${monster?.visualTheme === 'dragon' ? 'selected' : ''}>🐉 Dragon</option>
            <option value="giant" ${monster?.visualTheme === 'giant' ? 'selected' : ''}>🏔️ Giant</option>
            <option value="insect" ${monster?.visualTheme === 'insect' ? 'selected' : ''}>🐛 Insect</option>
            <option value="aquatic" ${monster?.visualTheme === 'aquatic' ? 'selected' : ''}>🐟 Aquatic</option>
            <option value="corrupted" ${monster?.visualTheme === 'corrupted' ? 'selected' : ''}>🧟 Corrupted</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="spriteId">Sprite ID</label>
            <input type="text" id="spriteId" class="form-control" 
                   placeholder="monster_fire_goblin_01" 
                   value="${monster?.spriteId || ''}">
            <small>Unity sprite asset ID</small>
          </div>

          <div class="form-group">
            <label for="animationSet">Animation Set</label>
            <input type="text" id="animationSet" class="form-control" 
                   placeholder="goblin_basic" 
                   value="${monster?.animationSet || ''}">
            <small>Unity animation controller name</small>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tab: Advanced
   */
  renderAdvancedTab(monster) {
    const worldTags = monster?.worldTags || [];
    const worldTagsStr = worldTags.join(',');
    
    return `
      <div class="form-section">
        <h3>Advanced Settings</h3>
        
        <div class="form-group">
          <label for="worldTags">World Tags (comma-separated)</label>
          <input type="text" id="worldTags" class="form-control" 
                 placeholder="1,2,3,4,5" 
                 value="${worldTagsStr}">
          <small>Leave empty for all worlds, or specify: 1,2,3 (worlds where this monster appears)</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="minWorldLevel">Min World Level</label>
            <input type="number" id="minWorldLevel" class="form-control" min="1" max="20" 
                   value="${monster?.minWorldLevel || ''}" placeholder="Optional">
          </div>

          <div class="form-group">
            <label for="maxWorldLevel">Max World Level</label>
            <input type="number" id="maxWorldLevel" class="form-control" min="1" max="20" 
                   value="${monster?.maxWorldLevel || ''}" placeholder="Optional">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>
              <input type="checkbox" id="isUnique" ${monster?.isUnique ? 'checked' : ''}>
              Unique Boss (cannot be duplicated)
            </label>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="isSummonable" ${monster?.isSummonable ? 'checked' : ''}>
              Can be summoned by others
            </label>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="canSummon" ${monster?.canSummon ? 'checked' : ''}>
              Can summon other monsters
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Changer d'onglet
   */
  switchTab(tabName) {
    // Désactiver tous les tabs
    document.querySelectorAll('.form-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.form-tab-content').forEach(content => content.classList.remove('active'));
    
    // Activer le tab sélectionné
    document.querySelector(`.form-tab[onclick*="${tabName}"]`)?.classList.add('active');
    document.getElementById(`formTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');
  }

  /**
   * 🆕 Copier le prompt ChatGPT
   */
  copyChatGPTPrompt() {
    const promptElement = document.getElementById('chatgptPrompt');
    promptElement.select();
    document.execCommand('copy');
    
    AdminCore.showAlert('✅ Prompt copied to clipboard! Now paste it in ChatGPT and replace the [...] parts.', 'success', 5000);
  }

  /**
   * 🆕 Parser le JSON et remplir le formulaire
   */
  parseJSON() {
    try {
      const jsonInput = document.getElementById('jsonInput').value.trim();
      
      if (!jsonInput) {
        AdminCore.showAlert('❌ Please paste JSON data first', 'error');
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

      AdminCore.showAlert('✅ JSON parsed successfully! All form fields have been auto-filled.', 'success', 5000);} catch (error) {
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
          <strong>Monster ID:</strong><br>
          <code>${data.monsterId}</code>
        </div>
        <div class="preview-item">
          <strong>Name:</strong><br>
          ${data.name}
        </div>
        <div class="preview-item">
          <strong>Type:</strong><br>
          <span class="badge badge-${data.type === 'boss' ? 'danger' : data.type === 'elite' ? 'warning' : 'secondary'}">${data.type}</span>
        </div>
        <div class="preview-item">
          <strong>Element:</strong><br>
          ${MonstersUI.getElementIcon(data.element)} ${data.element}
        </div>
        <div class="preview-item">
          <strong>Role:</strong><br>
          ${MonstersUI.getRoleIcon(data.role)} ${data.role}
        </div>
        <div class="preview-item">
          <strong>Rarity:</strong><br>
          <span class="badge ${MonstersUI.getRarityClass(data.rarity)}">${data.rarity}</span>
        </div>
        <div class="preview-item">
          <strong>HP:</strong><br>
          ${data.baseStats?.hp || 'N/A'}
        </div>
        <div class="preview-item">
          <strong>ATK:</strong><br>
          ${data.baseStats?.atk || 'N/A'}
        </div>
        <div class="preview-item">
          <strong>DEF:</strong><br>
          ${data.baseStats?.def || 'N/A'}
        </div>
        <div class="preview-item">
          <strong>Ultimate:</strong><br>
          <code style="font-size: 11px;">${data.spells?.ultimate?.id || 'basic_attack (default)'}</code>
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

  /**
   * Collecter les données du formulaire
   */
  collectFormData() {
    // World tags
    const worldTagsStr = document.getElementById('worldTags').value.trim();
    const worldTags = worldTagsStr ? worldTagsStr.split(',').map(w => parseInt(w.trim())).filter(w => !isNaN(w)) : [];

    const data = {
      monsterId: document.getElementById('monsterId').value.trim(),
      name: document.getElementById('monsterName').value.trim(),
      type: document.getElementById('monsterType').value,
      element: document.getElementById('monsterElement').value,
      role: document.getElementById('monsterRole').value,
      rarity: document.getElementById('monsterRarity').value,
      description: document.getElementById('monsterDescription').value.trim(),
      visualTheme: document.getElementById('visualTheme').value,
      spriteId: document.getElementById('spriteId').value.trim() || undefined,
      animationSet: document.getElementById('animationSet').value.trim() || undefined,
      
      baseStats: {
        hp: parseInt(document.getElementById('statHp').value),
        atk: parseInt(document.getElementById('statAtk').value),
        def: parseInt(document.getElementById('statDef').value),
        crit: parseFloat(document.getElementById('statCrit').value),
        critDamage: parseFloat(document.getElementById('statCritDamage').value),
        vitesse: parseInt(document.getElementById('statVitesse').value),
        dodge: parseFloat(document.getElementById('statDodge').value),
        accuracy: parseFloat(document.getElementById('statAccuracy').value),
        moral: parseInt(document.getElementById('statMoral').value),
        critResist: 0,
        reductionCooldown: 0,
        healthleech: 0,
        healingBonus: 0,
        shieldBonus: 0,
        energyRegen: 10
      },
      
      spells: {},
      
      worldTags,
      minWorldLevel: parseInt(document.getElementById('minWorldLevel').value) || undefined,
      maxWorldLevel: parseInt(document.getElementById('maxWorldLevel').value) || undefined,
      isUnique: document.getElementById('isUnique').checked,
      isSummonable: document.getElementById('isSummonable').checked,
      canSummon: document.getElementById('canSummon').checked
    };

    // 🆕 Ultimate avec défaut "basic_attack"
    const ultimateId = document.getElementById('spellUltimate').value.trim();
    data.spells.ultimate = {
      id: ultimateId || 'basic_attack',
      level: 1
    };

    // Spells optionnels
    const passiveId = document.getElementById('spellPassive').value.trim();
    if (passiveId) {
      data.spells.passive = { id: passiveId, level: 1 };
    }

    const spell1Id = document.getElementById('spell1').value.trim();
    if (spell1Id) {
      data.spells.spell1 = { id: spell1Id, level: 1 };
    }

    const spell2Id = document.getElementById('spell2').value.trim();
    if (spell2Id) {
      data.spells.spell2 = { id: spell2Id, level: 1 };
    }

    const spell3Id = document.getElementById('spell3').value.trim();
    if (spell3Id) {
      data.spells.spell3 = { id: spell3Id, level: 1 };
    }

    return data;
  }

  /**
   * Soumettre le formulaire
   */
  async submitForm(event) {
    event.preventDefault();
    
    try {
      const data = this.collectFormData();
      
      // Validation basique
      if (!data.monsterId || !data.name || !data.element || !data.role) {
        AdminCore.showAlert('❌ Please fill all required fields', 'error');
        return;
      }

      // Validation Monster ID format
      if (!/^MON_[a-z_]+$/.test(data.monsterId)) {
        AdminCore.showAlert('❌ Monster ID must follow format: MON_[element]_[name] (lowercase, underscores only)', 'error');
        return;
      }

      // Note: ultimate a maintenant toujours une valeur (default = basic_attack)
      
      let response;
      
      if (this.currentMode === 'create') {
        response = await AdminCore.makeRequest('/api/admin/monsters', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } else {
        response = await AdminCore.makeRequest(`/api/admin/monsters/${this.currentMonster.monsterId}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }

      if (response.data.success) {
        AdminCore.showAlert(
          this.currentMode === 'create' 
            ? `✅ Monster "${data.name}" created successfully!` 
            : `✅ Monster "${data.name}" updated successfully!`,
          'success'
        );
        
        this.closeModal();
        
        // Recharger la liste
        if (window.MonstersModule) {
          window.MonstersModule.loadMonstersList();
        }
      } else {
        throw new Error(response.data.message || 'Operation failed');
      }

    } catch (error) {
      console.error('Submit form error:', error);
      AdminCore.showAlert('❌ Failed to save monster: ' + error.message, 'error');
    }
  }

  /**
   * Fermer le modal
   */
  closeModal() {
    document.getElementById('monsterFormModal').style.display = 'none';
    this.currentMode = null;
    this.currentMonster = null;
  }

  /**
   * Initialiser le formulaire
   */
  init() {
    // Setup du gestionnaire de soumission
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'monsterForm') {
        this.submitForm(e);
      }
    });
  }
}

// Créer l'instance globale
window.MonstersForm = new MonstersForm();

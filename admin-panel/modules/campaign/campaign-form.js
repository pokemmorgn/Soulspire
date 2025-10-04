/**
 * CampaignForm - Gestion des formulaires d'édition de campagne
 * Logique pour éditer les niveaux et sélectionner les monstres
 */
class CampaignForm {
  constructor() {
    this.currentWorld = null;
    this.currentLevel = null;
    this.availableMonsters = [];
    this.selectedMonsters = [];
    this.originalConfig = null;
  }

  /**
   * Initialiser le module
   */
  init() {
    console.log('📝 Campaign Form Module initialized');
  }

  /**
   * 🎬 MODAL D'ÉDITION DE NIVEAU
   */
  
  async showEditLevelModal(worldId, levelIndex) {
    try {
      console.log(`📝 Opening level editor: World ${worldId}, Level ${levelIndex}`);

      // Charger les données du niveau
      const { data } = await AdminCore.makeRequest(`/api/admin/campaign/worlds/${worldId}/levels/${levelIndex}`);
      
      this.currentWorld = data.world;
      this.currentLevel = data.level;
      this.originalConfig = JSON.parse(JSON.stringify(data.level));

      // Initialiser les monstres sélectionnés
      if (data.level.monsters && data.level.monsters.length > 0) {
        this.selectedMonsters = data.level.monsterDetails || [];
      } else {
        this.selectedMonsters = [];
      }

      // Charger les monstres disponibles
      await this.loadAvailableMonsters(worldId);

      // Afficher le modal
      this.renderEditLevelModal();
      document.getElementById('campaignLevelModal').style.display = 'block';

    } catch (error) {
      console.error('❌ Error opening level editor:', error);
      AdminCore.showAlert('Failed to load level editor: ' + error.message, 'error');
    }
  }

  async loadAvailableMonsters(worldId) {
    try {
      const { data } = await AdminCore.makeRequest(`/api/admin/campaign/monsters/available?worldId=${worldId}`);
      this.availableMonsters = data.monsters || [];
      console.log(`✅ Loaded ${this.availableMonsters.length} available monsters`);
    } catch (error) {
      console.error('❌ Error loading monsters:', error);
      this.availableMonsters = [];
    }
  }

  renderEditLevelModal() {
    const level = this.currentLevel;
    const world = this.currentWorld;

    const modalHTML = `
      <div class="modal-header">
        <h2>✏️ Edit Level ${world.worldId}-${level.levelIndex}</h2>
        <span class="modal-close" onclick="CampaignForm.closeEditModal()">&times;</span>
      </div>
      
      <div class="modal-body campaign-level-editor">
        <!-- Level Info -->
        <div class="level-info-section">
          <h3>📍 Level Information</h3>
          <div class="level-info-grid">
            <div class="info-item">
              <label>World:</label>
              <span>${world.name}</span>
            </div>
            <div class="info-item">
              <label>Level:</label>
              <span>${level.levelIndex} - ${CampaignUI.escapeHtml(level.name)}</span>
            </div>
            <div class="info-item">
              <label>Type:</label>
              <span>${CampaignUI.getTypeIcon(level.enemyType || CampaignUI.guessEnemyType(level.levelIndex))} ${level.enemyType || CampaignUI.guessEnemyType(level.levelIndex)}</span>
            </div>
            <div class="info-item">
              <label>Difficulty:</label>
              <span>${(level.difficultyMultiplier || 1.0).toFixed(2)}x</span>
            </div>
          </div>
        </div>

        <!-- Tabs pour configuration -->
        <div class="campaign-edit-tabs">
          <button class="campaign-tab active" data-tab="monsters" onclick="CampaignForm.switchTab('monsters')">
            👹 Monsters
          </button>
          <button class="campaign-tab" data-tab="settings" onclick="CampaignForm.switchTab('settings')">
            ⚙️ Settings
          </button>
          <button class="campaign-tab" data-tab="rewards" onclick="CampaignForm.switchTab('rewards')">
            💰 Rewards
          </button>
          <button class="campaign-tab" data-tab="json" onclick="CampaignForm.switchTab('json')">
            📄 JSON
          </button>
        </div>

        <!-- Tab Content -->
        <div class="campaign-tab-content">
          <!-- Monsters Tab -->
          <div id="monstersTab" class="tab-content active">
            ${CampaignUI.renderLevelConfigSection(level, this.selectedMonsters)}
            
            <div class="available-monsters-section">
              <h3>Available Monsters</h3>
              <div id="availableMonstersContainer">
                ${CampaignUI.renderMonsterList(this.availableMonsters)}
              </div>
            </div>
          </div>

          <!-- Settings Tab -->
          <div id="settingsTab" class="tab-content">
            ${this.renderSettingsTab(level)}
          </div>

          <!-- Rewards Tab -->
          <div id="rewardsTab" class="tab-content">
            ${this.renderRewardsTab(level)}
          </div>

          <!-- JSON Tab -->
          <div id="jsonTab" class="tab-content">
            ${this.renderJsonTab(level)}
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="CampaignForm.closeEditModal()">
            Cancel
          </button>
          <button class="btn btn-info" onclick="CampaignForm.previewConfig()">
            👁️ Preview
          </button>
          <button class="btn btn-success" onclick="CampaignForm.saveLevelConfig()">
            💾 Save Changes
          </button>
        </div>
      </div>
    `;

    document.getElementById('campaignLevelModalContent').innerHTML = modalHTML;
  }

  renderSettingsTab(level) {
    return `
      <div class="settings-tab-content">
        <div class="form-section">
          <h4>Basic Settings</h4>
          
          <div class="form-group">
            <label for="levelName">Level Name:</label>
            <input type="text" id="levelName" class="form-control" value="${CampaignUI.escapeHtml(level.name)}">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="enemyType">Enemy Type:</label>
              <select id="enemyType" class="form-control">
                <option value="normal" ${level.enemyType === 'normal' ? 'selected' : ''}>Normal</option>
                <option value="elite" ${level.enemyType === 'elite' ? 'selected' : ''}>Elite</option>
                <option value="boss" ${level.enemyType === 'boss' ? 'selected' : ''}>Boss</option>
              </select>
            </div>

            <div class="form-group">
              <label for="difficultyMultiplier">Difficulty Multiplier:</label>
              <input type="number" id="difficultyMultiplier" class="form-control" 
                     min="0.1" max="10" step="0.1" value="${level.difficultyMultiplier || 1.0}">
            </div>

            <div class="form-group">
              <label for="staminaCost">Stamina Cost:</label>
              <input type="number" id="staminaCost" class="form-control" 
                     min="1" max="20" value="${level.staminaCost || 6}">
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Modifiers (Optional)</h4>
          
          <div class="form-group">
            <label for="elementalAura">Elemental Aura:</label>
            <select id="elementalAura" class="form-control">
              <option value="">None</option>
              <option value="Fire" ${level.modifiers?.elementalAura === 'Fire' ? 'selected' : ''}>🔥 Fire</option>
              <option value="Water" ${level.modifiers?.elementalAura === 'Water' ? 'selected' : ''}>💧 Water</option>
              <option value="Wind" ${level.modifiers?.elementalAura === 'Wind' ? 'selected' : ''}>💨 Wind</option>
              <option value="Electric" ${level.modifiers?.elementalAura === 'Electric' ? 'selected' : ''}>⚡ Electric</option>
              <option value="Light" ${level.modifiers?.elementalAura === 'Light' ? 'selected' : ''}>✨ Light</option>
              <option value="Dark" ${level.modifiers?.elementalAura === 'Dark' ? 'selected' : ''}>🌑 Dark</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="atkBuffPct">ATK Buff %:</label>
              <input type="number" id="atkBuffPct" class="form-control" 
                     min="0" max="100" step="5" value="${(level.modifiers?.atkBuffPct || 0) * 100}" placeholder="0">
            </div>

            <div class="form-group">
              <label for="defBuffPct">DEF Buff %:</label>
              <input type="number" id="defBuffPct" class="form-control" 
                     min="0" max="100" step="5" value="${(level.modifiers?.defBuffPct || 0) * 100}" placeholder="0">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderRewardsTab(level) {
    const rewards = level.rewards || {};
    return `
      <div class="rewards-tab-content">
        <div class="form-section">
          <h4>Base Rewards</h4>
          
          <div class="form-row">
            <div class="form-group">
              <label for="rewardExp">Experience:</label>
              <input type="number" id="rewardExp" class="form-control" 
                     min="0" value="${rewards.experience || 0}">
            </div>

            <div class="form-group">
              <label for="rewardGold">Gold:</label>
              <input type="number" id="rewardGold" class="form-control" 
                     min="0" value="${rewards.gold || 0}">
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Item Drops (Optional)</h4>
          <div class="form-group">
            <label>Items (one per line):</label>
            <textarea id="rewardItems" class="form-control" rows="4" placeholder="ITEM_health_potion
ITEM_mana_crystal">${(rewards.items || []).join('\n')}</textarea>
          </div>
        </div>

        <div class="form-section">
          <h4>Hero Fragments (Optional)</h4>
          <div id="fragmentsContainer">
            ${this.renderFragmentsList(rewards.fragments || [])}
          </div>
          <button class="btn btn-small btn-primary" onclick="CampaignForm.addFragment()">
            ➕ Add Fragment
          </button>
        </div>
      </div>
    `;
  }

  renderFragmentsList(fragments) {
    if (fragments.length === 0) {
      return '<div class="no-data">No fragments configured</div>';
    }

    return `
      <div class="fragments-list">
        ${fragments.map((frag, idx) => `
          <div class="fragment-item">
            <input type="text" placeholder="heroId" value="${frag.heroId || ''}" 
                   onchange="CampaignForm.updateFragment(${idx}, 'heroId', this.value)">
            <input type="number" min="1" placeholder="Quantity" value="${frag.quantity || 1}"
                   onchange="CampaignForm.updateFragment(${idx}, 'quantity', parseInt(this.value))">
            <button class="btn btn-small btn-danger" onclick="CampaignForm.removeFragment(${idx})">
              🗑️
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderJsonTab(level) {
    const config = {
      monsters: this.selectedMonsters.map(m => ({
        monsterId: m.monsterId,
        count: m.count || 1,
        position: m.position,
        levelOverride: m.levelOverride,
        starsOverride: m.starsOverride || 3
      })),
      autoGenerate: level.autoGenerate
    };

    return `
      <div class="json-tab-content">
        <div class="alert info">
          <strong>ℹ️ JSON Configuration</strong>
          <p>You can directly edit the JSON configuration or copy it for use elsewhere.</p>
        </div>

        <div class="form-group">
          <label>Current Configuration:</label>
          <textarea id="jsonConfig" class="form-control" rows="20" style="font-family: monospace; font-size: 12px;">${JSON.stringify(config, null, 2)}</textarea>
        </div>

        <div class="json-actions">
          <button class="btn btn-info" onclick="CampaignForm.copyJsonToClipboard()">
            📋 Copy to Clipboard
          </button>
          <button class="btn btn-warning" onclick="CampaignForm.importFromJson()">
            📥 Import from JSON
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 👹 GESTION DES MONSTRES
   */

  addMonster(monsterId) {
    if (this.selectedMonsters.length >= 5) {
      AdminCore.showAlert('Maximum 5 monsters per level', 'warning');
      return;
    }

    if (this.selectedMonsters.find(m => m.monsterId === monsterId)) {
      AdminCore.showAlert('Monster already added', 'warning');
      return;
    }

    const monster = this.availableMonsters.find(m => m.monsterId === monsterId);
    if (!monster) {
      AdminCore.showAlert('Monster not found', 'error');
      return;
    }

    this.selectedMonsters.push({
      monsterId: monster.monsterId,
      count: 1,
      position: this.selectedMonsters.length + 1,
      starsOverride: 3,
      monsterData: monster
    });

    this.updateMonstersDisplay();
    AdminCore.showAlert(`${monster.name} added!`, 'success', 2000);
  }

  removeMonster(monsterId) {
    this.selectedMonsters = this.selectedMonsters.filter(m => m.monsterId !== monsterId);
    this.updateMonstersDisplay();
    AdminCore.showAlert('Monster removed', 'info', 2000);
  }

  updateMonsterConfig(monsterId, field, value) {
    const monster = this.selectedMonsters.find(m => m.monsterId === monsterId);
    if (monster) {
      monster[field] = value;
      console.log(`Updated ${monsterId} ${field} to ${value}`);
    }
  }

  updateMonstersDisplay() {
    const container = document.getElementById('selectedMonstersGrid');
    if (!container) return;

    if (this.selectedMonsters.length === 0) {
      container.innerHTML = '<div class="empty-selection">No monsters selected. Click "Add" on monsters below to add them.</div>';
    } else {
      container.innerHTML = this.selectedMonsters.map((m, idx) => 
        CampaignUI.renderSelectedMonster(m, idx + 1)
      ).join('');
    }
  }

  /**
   * 🔄 FILTRES ET RECHERCHE
   */

  filterMonsters() {
    const search = document.getElementById('monsterSearch')?.value.toLowerCase() || '';
    const element = document.getElementById('filterElement')?.value || '';
    const type = document.getElementById('filterType')?.value || '';
    const rarity = document.getElementById('filterRarity')?.value || '';

    const filtered = this.availableMonsters.filter(monster => {
      const matchSearch = !search || 
        monster.name.toLowerCase().includes(search) || 
        monster.monsterId.toLowerCase().includes(search);
      const matchElement = !element || monster.element === element;
      const matchType = !type || monster.type === type;
      const matchRarity = !rarity || monster.rarity === rarity;

      return matchSearch && matchElement && matchType && matchRarity;
    });

    const container = document.getElementById('availableMonstersContainer');
    if (container) {
      container.innerHTML = CampaignUI.renderMonsterList(filtered);
    }
  }

  clearFilters() {
    document.getElementById('monsterSearch').value = '';
    document.getElementById('filterElement').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterRarity').value = '';
    this.filterMonsters();
  }

  /**
   * 🎛️ MODES DE CONFIGURATION
   */

  switchConfigMode(mode) {
    const manualSection = document.getElementById('manualConfigSection');
    const autoSection = document.getElementById('autoConfigSection');

    if (mode === 'manual') {
      manualSection.style.display = 'block';
      autoSection.style.display = 'none';
    } else {
      manualSection.style.display = 'none';
      autoSection.style.display = 'block';
    }
  }

  switchTab(tabName) {
    // Désactiver tous les tabs
    document.querySelectorAll('.campaign-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Activer le tab sélectionné
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}Tab`)?.classList.add('active');
  }

  /**
   * 💾 SAUVEGARDE
   */

  async saveLevelConfig() {
    try {
      const configMode = document.querySelector('input[name="configMode"]:checked')?.value || 'manual';

      let updates = {
        name: document.getElementById('levelName')?.value || this.currentLevel.name,
        enemyType: document.getElementById('enemyType')?.value,
        difficultyMultiplier: parseFloat(document.getElementById('difficultyMultiplier')?.value || 1.0),
        staminaCost: parseInt(document.getElementById('staminaCost')?.value || 6)
      };

      // Monsters configuration
      if (configMode === 'manual') {
        updates.monsters = this.selectedMonsters.map(m => ({
          monsterId: m.monsterId,
          count: m.count || 1,
          position: m.position,
          levelOverride: m.levelOverride,
          starsOverride: m.starsOverride || 3
        }));
        updates.autoGenerate = undefined;
      } else {
        updates.monsters = [];
        updates.autoGenerate = {
          useWorldPool: true,
          count: parseInt(document.getElementById('autoGenCount')?.value || 3),
          enemyType: document.getElementById('autoGenType')?.value || 'normal'
        };
      }

      // Modifiers
      const elementalAura = document.getElementById('elementalAura')?.value;
      const atkBuff = parseFloat(document.getElementById('atkBuffPct')?.value || 0) / 100;
      const defBuff = parseFloat(document.getElementById('defBuffPct')?.value || 0) / 100;

      if (elementalAura || atkBuff > 0 || defBuff > 0) {
        updates.modifiers = {
          elementalAura: elementalAura || undefined,
          atkBuffPct: atkBuff || undefined,
          defBuffPct: defBuff || undefined
        };
      }

      // Rewards
      const rewardExp = parseInt(document.getElementById('rewardExp')?.value || 0);
      const rewardGold = parseInt(document.getElementById('rewardGold')?.value || 0);
      const rewardItems = document.getElementById('rewardItems')?.value.split('\n').filter(i => i.trim());

      updates.rewards = {
        experience: rewardExp,
        gold: rewardGold,
        items: rewardItems,
        fragments: []
      };

      console.log('💾 Saving level config:', updates);

      await AdminCore.makeRequest(
        `/api/admin/campaign/worlds/${this.currentWorld.worldId}/levels/${this.currentLevel.levelIndex}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates)
        }
      );

      AdminCore.showAlert('Level configuration saved successfully!', 'success');
      this.closeEditModal();
      
      // Recharger la vue du monde
      if (window.CampaignModule) {
        CampaignModule.viewWorld(this.currentWorld.worldId);
      }

    } catch (error) {
      console.error('❌ Save error:', error);
      AdminCore.showAlert('Failed to save: ' + error.message, 'error');
    }
  }

  previewConfig() {
    const preview = {
      selectedMonsters: this.selectedMonsters.length,
      monsters: this.selectedMonsters.map(m => ({
        name: m.monsterData?.name || m.monsterId,
        count: m.count || 1,
        position: m.position
      }))
    };

    alert('Configuration Preview:\n\n' + JSON.stringify(preview, null, 2));
  }

  /**
   * 🗂️ JSON IMPORT/EXPORT
   */

  copyJsonToClipboard() {
    const textarea = document.getElementById('jsonConfig');
    if (textarea) {
      textarea.select();
      document.execCommand('copy');
      AdminCore.showAlert('JSON copied to clipboard!', 'success', 2000);
    }
  }

  importFromJson() {
    const textarea = document.getElementById('jsonConfig');
    if (!textarea) return;

    try {
      const config = JSON.parse(textarea.value);
      
      if (config.monsters) {
        // TODO: Valider et charger les monstres
        AdminCore.showAlert('JSON import not yet fully implemented', 'warning');
      }

    } catch (error) {
      AdminCore.showAlert('Invalid JSON: ' + error.message, 'error');
    }
  }

  /**
   * 🚪 FERMETURE
   */

  closeEditModal() {
    document.getElementById('campaignLevelModal').style.display = 'none';
    this.currentWorld = null;
    this.currentLevel = null;
    this.selectedMonsters = [];
    this.availableMonsters = [];
  }

  /**
   * 📋 FRAGMENTS (Rewards)
   */

  addFragment() {
    const container = document.getElementById('fragmentsContainer');
    if (!container) return;

    // TODO: Implémenter l'ajout de fragments
    AdminCore.showAlert('Fragment management coming soon', 'info');
  }

  updateFragment(index, field, value) {
    console.log(`Update fragment ${index} ${field} = ${value}`);
  }

  removeFragment(index) {
    console.log(`Remove fragment ${index}`);
  }
}

// Créer l'instance globale
window.CampaignForm = new CampaignForm();

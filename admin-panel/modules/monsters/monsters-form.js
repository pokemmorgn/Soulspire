/**
 * MonstersForm - Gestion du formulaire de création/édition de monstres
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
          <button type="button" class="form-tab active" onclick="MonstersForm.switchTab('basic')">📋 Basic Info</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('stats')">📊 Base Stats</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('spells')">✨ Spells</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('appearance')">🎨 Appearance</button>
          <button type="button" class="form-tab" onclick="MonstersForm.switchTab('advanced')">⚙️ Advanced</button>
        </div>

        <!-- Tab: Basic Info -->
        <div id="formTabBasic" class="form-tab-content active">
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
   * Tab: Spells
   */
  renderSpellsTab(monster) {
    const spells = monster?.spells || {};
    
    return `
      <div class="form-section">
        <h3>Monster Spells</h3>
        
        <div class="alert warning" style="margin-bottom: 20px;">
          <strong>⚠️ Note:</strong> Spell IDs must exist in your spell database. Leave empty if no spell.
        </div>

        <div class="form-group">
          <label for="spellUltimate">Ultimate Spell ID *</label>
          <input type="text" id="spellUltimate" class="form-control" 
                 placeholder="fire_storm" 
                 value="${spells.ultimate?.id || ''}" required>
          <small>Required spell - main powerful ability</small>
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
      
      spells: {
        ultimate: {
          id: document.getElementById('spellUltimate').value.trim(),
          level: 1
        }
      },
      
      worldTags,minWorldLevel: parseInt(document.getElementById('minWorldLevel').value) || undefined,
      maxWorldLevel: parseInt(document.getElementById('maxWorldLevel').value) || undefined,
      isUnique: document.getElementById('isUnique').checked,
      isSummonable: document.getElementById('isSummonable').checked,
      canSummon: document.getElementById('canSummon').checked
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
        AdminCore.showAlert('Please fill all required fields', 'error');
        return;
      }

      if (!data.spells.ultimate?.id) {
        AdminCore.showAlert('Ultimate spell is required', 'error');
        return;
      }

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
          this.currentMode === 'create' ? 'Monster created successfully!' : 'Monster updated successfully!',
          'success'
        );
        
        this.closeModal();
        
        // Recharger la liste
        if (window.MonstersModule) {
          window.MonstersModule.loadMonstersList();
        }
      }

    } catch (error) {
      console.error('Submit form error:', error);
      AdminCore.showAlert('Failed to save monster: ' + error.message, 'error');
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

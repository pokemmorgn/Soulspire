/**
 * CampaignUI - Helpers et utilitaires UI pour le Campaign Level Editor
 * Interface visuelle pour gérer les mondes et niveaux
 */
class CampaignUI {
  
  /**
   * 🎨 ICÔNES ET BADGES
   */
  
  getElementIcon(element) {
    const icons = {
      'Fire': '🔥',
      'Water': '💧',
      'Wind': '💨',
      'Electric': '⚡',
      'Light': '✨',
      'Dark': '🌑'
    };
    return icons[element] || '❓';
  }

  getTypeIcon(type) {
    const icons = {
      'normal': '⚔️',
      'elite': '👑',
      'boss': '🐉'
    };
    return icons[type] || '⚔️';
  }

  getRarityColor(rarity) {
    const colors = {
      'Common': '#adb5bd',
      'Rare': '#339af0',
      'Epic': '#9775fa',
      'Legendary': '#ffd43b',
      'Mythic': '#ff6b6b'
    };
    return colors[rarity] || '#adb5bd';
  }

  getThemeIcon(theme) {
    const icons = {
      'forest': '🌲',
      'beast': '🐺',
      'undead': '💀',
      'demon': '👿',
      'elemental': '🌟',
      'construct': '🗿',
      'celestial': '👼',
      'shadow': '🌑',
      'dragon': '🐉',
      'giant': '🏔️',
      'insect': '🐛',
      'aquatic': '🐟',
      'corrupted': '🧟'
    };
    return icons[theme] || '❓';
  }

  /**
   * 🗺️ RENDU DES MONDES
   */

  renderWorldCard(world) {
    const configPercent = world.stats ? 
      Math.round((world.stats.configuredLevels / world.stats.totalLevels) * 100) : 0;
    
    const progressClass = configPercent >= 80 ? 'progress-high' : 
                          configPercent >= 40 ? 'progress-medium' : 'progress-low';

    return `
      <div class="campaign-world-card" onclick="CampaignModule.viewWorld(${world.worldId})">
        <div class="world-card-header">
          <h3>🌍 ${this.escapeHtml(world.name)}</h3>
          <span class="badge badge-secondary">World ${world.worldId}</span>
        </div>
        
        <div class="world-card-body">
          <div class="world-info">
            <div class="info-item">
              <span class="info-icon">🎯</span>
              <span class="info-label">Min Level:</span>
              <span class="info-value">${world.minPlayerLevel}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">📍</span>
              <span class="info-label">Levels:</span>
              <span class="info-value">${world.levelCount}</span>
            </div>
            ${world.elementBias && world.elementBias.length > 0 ? `
              <div class="info-item">
                <span class="info-icon">⚡</span>
                <span class="info-label">Elements:</span>
                <span class="info-value">
                  ${world.elementBias.map(e => this.getElementIcon(e)).join(' ')}
                </span>
              </div>
            ` : ''}
          </div>

          ${world.stats ? `
            <div class="world-progress">
              <div class="progress-header">
                <span>Configuration Progress</span>
                <span class="progress-percent ${progressClass}">${configPercent}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${progressClass}" style="width: ${configPercent}%"></div>
              </div>
              <div class="progress-stats">
                <span>✅ ${world.stats.configuredLevels} configured</span>
                <span>🤖 ${world.stats.autoGenLevels} auto-gen</span>
                <span>❌ ${world.stats.unconfiguredLevels} empty</span>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="world-card-footer">
          <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); CampaignModule.viewWorld(${world.worldId})">
            📋 Edit Levels
          </button>
          <button class="btn btn-small btn-info" onclick="event.stopPropagation(); CampaignModule.editWorldPool(${world.worldId})">
            👹 Monster Pool
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 📍 RENDU DES NIVEAUX EN GRILLE
   */

  renderLevelGrid(levels, worldId) {
    if (!levels || levels.length === 0) {
      return '<div class="no-data">No levels found</div>';
    }

    return `
      <div class="campaign-levels-grid">
        ${levels.map(level => this.renderLevelTile(level, worldId)).join('')}
      </div>
    `;
  }

  renderLevelTile(level, worldId) {
    const isConfigured = level.isConfigured || false;
    const hasMonsters = level.monsters && level.monsters.length > 0;
    const isAutoGen = level.autoGenerate && level.autoGenerate.useWorldPool;
    
    const enemyType = level.enemyType || this.guessEnemyType(level.levelIndex);
    const typeIcon = this.getTypeIcon(enemyType);
    const typeClass = `level-type-${enemyType}`;

    let statusBadge = '';
    if (hasMonsters) {
      statusBadge = `<span class="status-badge status-configured">✅ Configured</span>`;
    } else if (isAutoGen) {
      statusBadge = `<span class="status-badge status-auto">🤖 Auto-Gen</span>`;
    } else {
      statusBadge = `<span class="status-badge status-empty">❌ Empty</span>`;
    }

    const monsterCount = hasMonsters ? level.monsters.length : 
                        isAutoGen ? (level.autoGenerate.count || 3) : 0;

    return `
      <div class="campaign-level-tile ${typeClass} ${isConfigured ? 'configured' : 'empty'}" 
           onclick="CampaignModule.editLevel(${worldId}, ${level.levelIndex})">
        <div class="level-tile-header">
          <span class="level-number">${level.levelIndex}</span>
          <span class="level-type-icon" title="${enemyType}">${typeIcon}</span>
        </div>
        
        <div class="level-tile-body">
          <div class="level-name">${this.escapeHtml(level.name)}</div>
          ${statusBadge}
          
          ${monsterCount > 0 ? `
            <div class="level-monster-count">
              <span class="monster-count-icon">👹</span>
              <span class="monster-count-value">${monsterCount}</span>
            </div>
          ` : ''}
        </div>

        <div class="level-tile-footer">
          <button class="btn btn-small btn-warning" onclick="event.stopPropagation(); CampaignModule.editLevel(${worldId}, ${level.levelIndex})">
            ✏️ Edit
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 👹 RENDU DES MONSTRES
   */

  renderMonsterCard(monster, isSelected = false, position = null) {
    const elementIcon = this.getElementIcon(monster.element);
    const typeIcon = this.getTypeIcon(monster.type);
    const themeIcon = this.getThemeIcon(monster.visualTheme);
    const rarityColor = this.getRarityColor(monster.rarity);

    return `
      <div class="monster-card ${isSelected ? 'selected' : ''}" 
           data-monster-id="${monster.monsterId}"
           style="border-left: 4px solid ${rarityColor}">
        
        <div class="monster-card-header">
          <div class="monster-icons">
            <span class="monster-element" title="${monster.element}">${elementIcon}</span>
            <span class="monster-type" title="${monster.type}">${typeIcon}</span>
            <span class="monster-theme" title="${monster.visualTheme}">${themeIcon}</span>
          </div>
          ${position !== null ? `<span class="position-badge">Pos ${position}</span>` : ''}
        </div>

        <div class="monster-card-body">
          <h4 class="monster-name">${this.escapeHtml(monster.name)}</h4>
          <div class="monster-id">${monster.monsterId}</div>
          <span class="badge" style="background: ${rarityColor}; color: ${this.getContrastColor(rarityColor)}">
            ${monster.rarity}
          </span>
        </div>

        ${monster.baseStats ? `
          <div class="monster-card-stats">
            <span title="HP">❤️ ${this.formatNumber(monster.baseStats.hp)}</span>
            <span title="ATK">⚔️ ${this.formatNumber(monster.baseStats.atk)}</span>
            <span title="DEF">🛡️ ${this.formatNumber(monster.baseStats.def)}</span>
          </div>
        ` : ''}

        ${isSelected ? `
          <div class="monster-card-actions">
            <button class="btn btn-small btn-danger" onclick="CampaignForm.removeMonster('${monster.monsterId}')">
              🗑️ Remove
            </button>
          </div>
        ` : `
          <div class="monster-card-actions">
            <button class="btn btn-small btn-success" onclick="CampaignForm.addMonster('${monster.monsterId}')">
              ➕ Add
            </button>
          </div>
        `}
      </div>
    `;
  }

  renderMonsterList(monsters, filterOptions = {}) {
    if (!monsters || monsters.length === 0) {
      return '<div class="no-data">No monsters found</div>';
    }

    return `
      <div class="monster-list-container">
        ${this.renderMonsterFilters(filterOptions)}
        <div class="monster-grid">
          ${monsters.map(m => this.renderMonsterCard(m, false)).join('')}
        </div>
      </div>
    `;
  }

  renderMonsterFilters(options = {}) {
    return `
      <div class="monster-filters">
        <div class="filter-group">
          <input type="text" 
                 id="monsterSearch" 
                 placeholder="🔍 Search monsters..."
                 value="${options.search || ''}"
                 onkeyup="CampaignForm.filterMonsters()">
        </div>
        
        <div class="filter-group">
          <select id="filterElement" onchange="CampaignForm.filterMonsters()">
            <option value="">All Elements</option>
            <option value="Fire">🔥 Fire</option>
            <option value="Water">💧 Water</option>
            <option value="Wind">💨 Wind</option>
            <option value="Electric">⚡ Electric</option>
            <option value="Light">✨ Light</option>
            <option value="Dark">🌑 Dark</option>
          </select>
        </div>

        <div class="filter-group">
          <select id="filterType" onchange="CampaignForm.filterMonsters()">
            <option value="">All Types</option>
            <option value="normal">⚔️ Normal</option>
            <option value="elite">👑 Elite</option>
            <option value="boss">🐉 Boss</option>
          </select>
        </div>

        <div class="filter-group">
          <select id="filterRarity" onchange="CampaignForm.filterMonsters()">
            <option value="">All Rarities</option>
            <option value="Common">Common</option>
            <option value="Rare">Rare</option>
            <option value="Epic">Epic</option>
            <option value="Legendary">Legendary</option>
            <option value="Mythic">Mythic</option>
          </select>
        </div>

        <button class="btn btn-small btn-secondary" onclick="CampaignForm.clearFilters()">
          Clear Filters
        </button>
      </div>
    `;
  }

  /**
   * 🎛️ RENDU DE CONFIGURATION DE NIVEAU
   */

  renderLevelConfigSection(level, selectedMonsters = []) {
    return `
      <div class="level-config-section">
        <div class="config-header">
          <h3>Monster Configuration</h3>
          <div class="config-mode">
            <label>
              <input type="radio" name="configMode" value="manual" 
                     ${!level.autoGenerate || !level.autoGenerate.useWorldPool ? 'checked' : ''}
                     onchange="CampaignForm.switchConfigMode('manual')">
              Manual Selection
            </label>
            <label>
              <input type="radio" name="configMode" value="auto" 
                     ${level.autoGenerate && level.autoGenerate.useWorldPool ? 'checked' : ''}
                     onchange="CampaignForm.switchConfigMode('auto')">
              Auto Generate
            </label>
          </div>
        </div>

        <div id="manualConfigSection" style="display: ${!level.autoGenerate || !level.autoGenerate.useWorldPool ? 'block' : 'none'}">
          ${this.renderManualConfig(selectedMonsters)}
        </div>

        <div id="autoConfigSection" style="display: ${level.autoGenerate && level.autoGenerate.useWorldPool ? 'block' : 'none'}">
          ${this.renderAutoConfig(level.autoGenerate)}
        </div>
      </div>
    `;
  }

  renderManualConfig(selectedMonsters) {
    return `
      <div class="manual-config">
        <div class="selected-monsters-area">
          <h4>Selected Monsters (${selectedMonsters.length}/5)</h4>
          <div class="selected-monsters-grid" id="selectedMonstersGrid">
            ${selectedMonsters.length === 0 ? 
              '<div class="empty-selection">No monsters selected. Click "Add" on monsters below to add them.</div>' :
              selectedMonsters.map((m, idx) => this.renderSelectedMonster(m, idx + 1)).join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  renderSelectedMonster(monsterConfig, position) {
    const monster = monsterConfig.monsterData;
    if (!monster) {
      return `<div class="selected-monster error">Monster ${monsterConfig.monsterId} not found</div>`;
    }

    return `
      <div class="selected-monster" data-monster-id="${monster.monsterId}">
        <div class="selected-monster-header">
          <span class="position-badge">Position ${position}</span>
          <button class="btn-icon btn-danger" onclick="CampaignForm.removeMonster('${monster.monsterId}')" title="Remove">
            ✖
          </button>
        </div>
        
        <div class="selected-monster-body">
          <div class="monster-preview">
            <span class="monster-icon-large">${this.getElementIcon(monster.element)}</span>
            <h5>${this.escapeHtml(monster.name)}</h5>
          </div>

          <div class="monster-config-fields">
            <div class="config-field">
              <label>Count:</label>
              <input type="number" min="1" max="5" value="${monsterConfig.count || 1}"
                     onchange="CampaignForm.updateMonsterConfig('${monster.monsterId}', 'count', parseInt(this.value))">
            </div>
            <div class="config-field">
              <label>Position:</label>
              <input type="number" min="1" max="5" value="${monsterConfig.position || position}"
                     onchange="CampaignForm.updateMonsterConfig('${monster.monsterId}', 'position', parseInt(this.value))">
            </div>
            <div class="config-field">
              <label>Level Override:</label>
              <input type="number" min="1" max="100" value="${monsterConfig.levelOverride || ''}" placeholder="Default"
                     onchange="CampaignForm.updateMonsterConfig('${monster.monsterId}', 'levelOverride', this.value ? parseInt(this.value) : null)">
            </div>
            <div class="config-field">
              <label>Stars:</label>
              <input type="number" min="1" max="6" value="${monsterConfig.starsOverride || 3}"
                     onchange="CampaignForm.updateMonsterConfig('${monster.monsterId}', 'starsOverride', parseInt(this.value))">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAutoConfig(autoGenerate = {}) {
    return `
      <div class="auto-config">
        <div class="alert info">
          <strong>ℹ️ Auto Generate Mode</strong>
          <p>Monsters will be automatically selected from the world's default monster pool when the level starts.</p>
        </div>

        <div class="form-group">
          <label>Monster Count:</label>
          <input type="number" id="autoGenCount" min="1" max="5" value="${autoGenerate.count || 3}">
        </div>

        <div class="form-group">
          <label>Enemy Type:</label>
          <select id="autoGenType">
            <option value="normal" ${autoGenerate.enemyType === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="elite" ${autoGenerate.enemyType === 'elite' ? 'selected' : ''}>Elite</option>
            <option value="boss" ${autoGenerate.enemyType === 'boss' ? 'selected' : ''}>Boss</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * 🛠️ UTILITAIRES
   */

  guessEnemyType(levelIndex) {
    if (levelIndex % 10 === 0) return 'boss';
    if (levelIndex % 5 === 0) return 'elite';
    return 'normal';
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getContrastColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#000' : '#fff';
  }

  showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="alert error">
          <strong>Error:</strong> ${this.escapeHtml(message)}
        </div>
      `;
    }
  }

  showSuccess(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="alert success">
          <strong>✅ Success:</strong> ${this.escapeHtml(message)}
        </div>
      `;
    }
  }
}

// Créer l'instance globale
window.CampaignUI = new CampaignUI();

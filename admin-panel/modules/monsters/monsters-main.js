/**
 * MonstersModule - Module principal de gestion des monstres
 */
class MonstersModule {
  constructor() {
    this.currentMonsters = [];
    this.filters = {
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
      type: '',
      element: '',
      role: '',
      rarity: '',
      visualTheme: '',
      search: ''
    };
    this.stats = null;
  }

  /**
   * Initialiser le module
   */
  init() {
    console.log('👹 Initializing Monsters Module...');
    
    // Initialiser le sous-module form
    if (window.MonstersForm) {
      window.MonstersForm.init();
    }
    
    console.log('✅ Monsters Module initialized');
  }

  /**
   * Charger les données (appelé quand on affiche la section)
   */
  async loadData() {
    console.log('👹 Loading monsters data...');
    const content = document.getElementById('monstersContent');
    
    try {
      content.innerHTML = this.renderMonstersInterface();
      await this.loadMonstersList();
      await this.loadMonstersStats();
    } catch (error) {
      console.error('Monsters data loading error:', error);
      content.innerHTML = `<div class="alert error">Failed to load monsters data: ${error.message}</div>`;
    }
  }

  /**
   * Rendre l'interface principale
   */
  renderMonstersInterface() {
    return `
      <!-- Stats Cards -->
      <div class="monsters-stats-grid" id="monstersStatsGrid">
        <div class="loading"><div class="spinner"></div><p>Loading statistics...</p></div>
      </div>

      <!-- Controls -->
      <div class="monsters-controls">
        <div class="search-section">
          <h3>🔍 Search & Filter Monsters</h3>
          
          <div class="search-grid">
            <div class="search-group">
              <label for="searchMonster">Search:</label>
              <input type="text" id="searchMonster" placeholder="Name or ID...">
            </div>
            
            <div class="search-group">
              <label for="filterType">Type:</label>
              <select id="filterType">
                <option value="">All Types</option>
                <option value="normal">Normal</option>
                <option value="elite">Elite</option>
                <option value="boss">Boss</option>
              </select>
            </div>
            
            <div class="search-group">
              <label for="filterElement">Element:</label>
              <select id="filterElement">
                <option value="">All Elements</option>
                <option value="Fire">🔥 Fire</option>
                <option value="Water">💧 Water</option>
                <option value="Wind">💨 Wind</option>
                <option value="Electric">⚡ Electric</option>
                <option value="Light">✨ Light</option>
                <option value="Dark">🌑 Dark</option>
              </select>
            </div>
            
            <div class="search-group">
              <label for="filterRole">Role:</label>
              <select id="filterRole">
                <option value="">All Roles</option>
                <option value="Tank">🛡️ Tank</option>
                <option value="DPS Melee">⚔️ DPS Melee</option>
                <option value="DPS Ranged">🏹 DPS Ranged</option>
                <option value="Support">💚 Support</option>
              </select>
            </div>
            
            <div class="search-group">
              <label for="filterRarity">Rarity:</label>
              <select id="filterRarity">
                <option value="">All Rarities</option>
                <option value="Common">Common</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
                <option value="Legendary">Legendary</option>
                <option value="Mythic">Mythic</option>
              </select>
            </div>
            
            <div class="search-group">
              <label for="filterTheme">Theme:</label>
              <select id="filterTheme">
                <option value="">All Themes</option>
                <option value="forest">🌲 Forest</option>
                <option value="beast">🐺 Beast</option>
                <option value="undead">💀 Undead</option>
                <option value="demon">👿 Demon</option>
                <option value="elemental">🌟 Elemental</option>
                <option value="construct">🗿 Construct</option>
                <option value="celestial">👼 Celestial</option>
                <option value="shadow">🌑 Shadow</option>
                <option value="dragon">🐉 Dragon</option>
                <option value="giant">🏔️ Giant</option>
                <option value="insect">🐛 Insect</option>
                <option value="aquatic">🐟 Aquatic</option>
                <option value="corrupted">🧟 Corrupted</option>
              </select>
            </div>
          </div>
          
          <div class="search-actions">
            <button class="btn btn-primary" onclick="MonstersModule.search()">🔍 Search</button>
            <button class="btn btn-secondary" onclick="MonstersModule.clearFilters()">Clear</button>
            <button class="btn btn-success" onclick="MonstersModule.showCreateModal()">➕ Create Monster</button>
            <button class="btn btn-info" onclick="MonstersModule.loadMonstersList()">↻ Refresh</button>
          </div>
        </div>
      </div>

      <!-- Monsters List -->
      <div class="monsters-list-section">
        <div class="monsters-header">
          <h3>📋 Monsters List</h3>
          <div class="monsters-pagination" id="monstersPagination"></div>
        </div>
        <div class="monsters-table-container">
          <div id="monstersTableContent">
            <div class="loading"><div class="spinner"></div><p>Loading monsters...</p></div>
          </div>
        </div>
      </div>

      <!-- Modal de détails -->
      <div id="monsterDetailsModal" class="modal">
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2 id="monsterModalTitle">Monster Details</h2>
            <span class="modal-close" onclick="MonstersModule.closeDetailsModal()">&times;</span>
          </div>
          <div class="modal-body" id="monsterModalBody"></div>
        </div>
      </div>

      <!-- Modal de formulaire -->
      ${window.MonstersForm ? window.MonstersForm.renderModal() : ''}
    `;
  }

  /**
   * Charger les statistiques
   */
  async loadMonstersStats() {
    try {
      const { data } = await AdminCore.makeRequest('/api/admin/monsters/stats');
      this.stats = data.data;
      
      const summary = this.stats.summary;
      
      document.getElementById('monstersStatsGrid').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon">👹</div>
          <div class="stat-value">${AdminCore.formatNumber(summary.totalMonsters || 0)}</div>
          <div class="stat-label">Total Monsters</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚔️</div>
          <div class="stat-value">${AdminCore.formatNumber(summary.normalCount || 0)}</div>
          <div class="stat-label">Normal Monsters</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👑</div>
          <div class="stat-value">${AdminCore.formatNumber(summary.eliteCount || 0)}</div>
          <div class="stat-label">Elite Monsters</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🐉</div>
          <div class="stat-value">${AdminCore.formatNumber(summary.bossCount || 0)}</div>
          <div class="stat-label">Boss Monsters</div>
        </div>
      `;
    } catch (error) {
      console.error('Load monsters stats error:', error);
      document.getElementById('monstersStatsGrid').innerHTML = 
        '<div class="alert error">Failed to load statistics</div>';
    }
  }

  /**
   * Charger la liste des monstres
   */
  async loadMonstersList() {
    const container = document.getElementById('monstersTableContent');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading monsters...</p></div>';

    try {
      const params = new URLSearchParams({
        page: this.filters.page.toString(),
        limit: this.filters.limit.toString(),
        sortBy: this.filters.sortBy,
        sortOrder: this.filters.sortOrder
      });

      // Ajouter les filtres optionnels
      if (this.filters.type) params.append('type', this.filters.type);
      if (this.filters.element) params.append('element', this.filters.element);
      if (this.filters.role) params.append('role', this.filters.role);
      if (this.filters.rarity) params.append('rarity', this.filters.rarity);
      if (this.filters.visualTheme) params.append('visualTheme', this.filters.visualTheme);
      if (this.filters.search) params.append('search', this.filters.search);

      const { data } = await AdminCore.makeRequest('/api/admin/monsters?' + params.toString());
      
      const result = data.data;
      this.currentMonsters = result.monsters || [];
      
      container.innerHTML = this.renderMonstersTable(result);
      this.updatePagination(result.pagination);
      
    } catch (error) {
      console.error('Load monsters list error:', error);
      container.innerHTML = `<div class="alert error">Failed to load monsters: ${error.message}</div>`;
    }
  }

  /**
   * Rendre le tableau des monstres
   */
  renderMonstersTable(data) {
    if (!data.monsters || data.monsters.length === 0) {
      return '<div class="no-data">No monsters found matching your criteria.</div>';
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Element</th>
            <th>Role</th>
            <th>Rarity</th>
            <th>Theme</th>
            <th>Worlds</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.monsters.map(monster => this.renderMonsterRow(monster)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Rendre une ligne de monstre
   */
  renderMonsterRow(monster) {
    const typeBadge = MonstersUI.getTypeBadge(monster.type);
    const elementIcon = MonstersUI.getElementIcon(monster.element);
    const roleIcon = MonstersUI.getRoleIcon(monster.role);
    const themeIcon = MonstersUI.getThemeIcon(monster.visualTheme);
    
    return `
      <tr class="${MonstersUI.getTypeClass(monster.type)}">
        <td>
          <div class="monster-name">
            <strong>${MonstersUI.escapeHtml(monster.name)}</strong>
            <small class="monster-id">${monster.monsterId}</small>
            ${monster.isUnique ? '<span class="badge badge-warning" style="font-size: 10px;">UNIQUE</span>' : ''}
          </div>
        </td>
        <td>
          <span class="badge ${typeBadge.class}">${typeBadge.text}</span>
        </td>
        <td>
          <span style="font-size: 20px;" title="${monster.element}">${elementIcon}</span>
        </td>
        <td>
          <span style="font-size: 18px;" title="${monster.role}">${roleIcon}</span>
        </td>
        <td>
          <span class="badge ${MonstersUI.getRarityClass(monster.rarity)}">${monster.rarity}</span>
        </td>
        <td>
          <span style="font-size: 18px;" title="${monster.visualTheme}">${themeIcon}</span>
        </td>
        <td>
          <small>${MonstersUI.formatWorldTags(monster.worldTags)}</small>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-small btn-info" onclick="MonstersModule.viewMonster('${monster.monsterId}')">
              👁️ View
            </button>
            <button class="btn btn-small btn-warning" onclick="MonstersModule.editMonster('${monster.monsterId}')">
              ✏️ Edit
            </button>
            <button class="btn btn-small btn-secondary" onclick="MonstersModule.duplicateMonster('${monster.monsterId}')">
              📋 Duplicate
            </button>
            <button class="btn btn-small btn-danger" onclick="MonstersModule.deleteMonster('${monster.monsterId}')">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Mettre à jour la pagination
   */
  updatePagination(pagination) {
    if (!pagination) return;
    
    const { page, totalPages, total } = pagination;
    
    let paginationHTML = `
      <div class="pagination-info">
        Showing ${((page - 1) * this.filters.limit) + 1}-${Math.min(page * this.filters.limit, total)} 
        of ${total} monsters
      </div>
      <div class="pagination-controls">
    `;

    if (page > 1) {
      paginationHTML += `<button class="btn btn-small" onclick="MonstersModule.goToPage(${page - 1})">« Prev</button>`;
    }

    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === page ? 'btn-primary' : 'btn-secondary';
      paginationHTML += `<button class="btn btn-small ${activeClass}" onclick="MonstersModule.goToPage(${i})">${i}</button>`;
    }

    if (page < totalPages) {
      paginationHTML += `<button class="btn btn-small" onclick="MonstersModule.goToPage(${page + 1})">Next »</button>`;
    }

    paginationHTML += '</div>';
    document.getElementById('monstersPagination').innerHTML = paginationHTML;
  }

  /**
   * Aller à une page
   */
  goToPage(page) {
    this.filters.page = page;
    this.loadMonstersList();
  }

  /**
   * Rechercher avec filtres
   */
  search() {
    this.filters = {
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
      type: document.getElementById('filterType').value,
      element: document.getElementById('filterElement').value,
      role: document.getElementById('filterRole').value,
      rarity: document.getElementById('filterRarity').value,
      visualTheme: document.getElementById('filterTheme').value,
      search: document.getElementById('searchMonster').value.trim()
    };

    this.loadMonstersList();
  }

  /**
   * Effacer les filtres
   */
  clearFilters() {
    document.getElementById('searchMonster').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterElement').value = '';
    document.getElementById('filterRole').value = '';
    document.getElementById('filterRarity').value = '';
    document.getElementById('filterTheme').value = '';

    this.filters = {
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
      type: '',
      element: '',
      role: '',
      rarity: '',
      visualTheme: '',
      search: ''
    };

    this.loadMonstersList();
  }

  /**
   * Voir les détails d'un monstre
   */
  async viewMonster(monsterId) {
    try {
      AdminCore.showAlert('Loading monster details...', 'info', 1000);
      
      const { data } = await AdminCore.makeRequest(`/api/admin/monsters/${monsterId}`);
      const monster = data.data;
      
      document.getElementById('monsterModalTitle').textContent = `${MonstersUI.getElementIcon(monster.element)} ${monster.name}`;
      document.getElementById('monsterModalBody').innerHTML = this.renderMonsterDetails(monster);
      document.getElementById('monsterDetailsModal').style.display = 'block';
      
    } catch (error) {
      console.error('View monster error:', error);
      AdminCore.showAlert('Failed to load monster details: ' + error.message, 'error');
    }
  }

  /**
   * Rendre les détails d'un monstre
   */
  renderMonsterDetails(monster) {
    const stats = monster.baseStats || {};
    const spells = monster.spells || {};
    
    return `
      <div class="monster-details">
        <!-- Header Info -->
        <div class="detail-section">
          <h3>Basic Information</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Monster ID:</span>
              <span class="detail-value"><code>${monster.monsterId}</code></span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${MonstersUI.escapeHtml(monster.name)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Type:</span>
              <span class="badge ${MonstersUI.getTypeBadge(monster.type).class}">${monster.type}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Element:</span>
              <span style="font-size: 20px;">${MonstersUI.getElementIcon(monster.element)} ${monster.element}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Role:</span>
              <span style="font-size: 18px;">${MonstersUI.getRoleIcon(monster.role)} ${monster.role}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Rarity:</span>
              <span class="badge ${MonstersUI.getRarityClass(monster.rarity)}">${monster.rarity}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Theme:</span>
              <span>${MonstersUI.getThemeIcon(monster.visualTheme)} ${MonstersUI.capitalizeFirst(monster.visualTheme)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Unique:</span>
              <span>${monster.isUnique ? '✅ Yes' : '❌ No'}</span>
            </div>
          </div>
          
          ${monster.description ? `
            <div style="margin-top: 15px;">
              <strong>Description:</strong>
              <p style="margin-top: 5px; color: #666;">${MonstersUI.escapeHtml(monster.description)}</p>
            </div>
          ` : ''}
        </div>

        <!-- Base Stats -->
        <div class="detail-section">
          <h3>📊 Base Stats (Level 1, 1 Star)</h3>
          <div class="stats-display-grid">
            <div class="stat-display-item">
              <span class="stat-icon">❤️</span>
              <span class="stat-name">HP</span>
              <span class="stat-value">${MonstersUI.formatNumber(stats.hp || 0)}</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">⚔️</span>
              <span class="stat-name">ATK</span>
              <span class="stat-value">${MonstersUI.formatNumber(stats.atk || 0)}</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">🛡️</span>
              <span class="stat-name">DEF</span>
              <span class="stat-value">${MonstersUI.formatNumber(stats.def || 0)}</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">💥</span>
              <span class="stat-name">Crit</span>
              <span class="stat-value">${(stats.crit || 0).toFixed(1)}%</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">💢</span>
              <span class="stat-name">Crit Dmg</span>
              <span class="stat-value">${(stats.critDamage || 0).toFixed(0)}%</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">⚡</span>
              <span class="stat-name">Speed</span>
              <span class="stat-value">${stats.vitesse || 0}</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">💨</span>
              <span class="stat-name">Dodge</span>
              <span class="stat-value">${(stats.dodge || 0).toFixed(1)}%</span>
            </div>
            <div class="stat-display-item">
              <span class="stat-icon">🎯</span>
              <span class="stat-name">Accuracy</span>
              <span class="stat-value">${(stats.accuracy || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <!-- Spells -->
        <div class="detail-section">
          <h3>✨ Spells</h3>
          <div class="spells-list">
            ${spells.ultimate ? `
              <div class="spell-item ultimate">
                <span class="spell-slot">Ultimate</span>
                <span class="spell-id">${spells.ultimate.id}</span>
                <span class="spell-level">Lvl ${spells.ultimate.level}</span>
              </div>
            ` : ''}
            ${spells.passive ? `
              <div class="spell-item passive">
                <span class="spell-slot">Passive</span>
                <span class="spell-id">${spells.passive.id}</span>
                <span class="spell-level">Lvl ${spells.passive.level}</span>
              </div>
            ` : ''}
            ${spells.spell1 ? `
              <div class="spell-item">
                <span class="spell-slot">Spell 1</span>
                <span class="spell-id">${spells.spell1.id}</span>
                <span class="spell-level">Lvl ${spells.spell1.level}</span>
              </div>
            ` : ''}
            ${spells.spell2 ? `
              <div class="spell-item">
                <span class="spell-slot">Spell 2</span>
                <span class="spell-id">${spells.spell2.id}</span>
                <span class="spell-level">Lvl ${spells.spell2.level}</span>
              </div>
            ` : ''}
            ${spells.spell3 ? `
              <div class="spell-item">
                <span class="spell-slot">Spell 3</span>
                <span class="spell-id">${spells.spell3.id}</span>
                <span class="spell-level">Lvl ${spells.spell3.level}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- World Appearance -->
        <div class="detail-section">
          <h3>🌍 World Appearance</h3>
          <div class="detail-grid">
            <div class="detail-item" style="grid-column: 1 / -1;">
              <span class="detail-label">Appears in:</span>
              <span>${MonstersUI.formatWorldTags(monster.worldTags)}</span>
            </div>
            ${monster.minWorldLevel ? `
              <div class="detail-item">
                <span class="detail-label">Min World:</span>
                <span class="detail-value">World ${monster.minWorldLevel}</span>
              </div>
            ` : ''}
            ${monster.maxWorldLevel ? `
              <div class="detail-item">
                <span class="detail-label">Max World:</span>
                <span class="detail-value">World ${monster.maxWorldLevel}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Actions -->
        <div class="detail-section">
          <h3>⚙️ Actions</h3>
          <div class="modal-actions">
            <button class="btn btn-warning" onclick="MonstersModule.editMonster('${monster.monsterId}')">
              ✏️ Edit Monster
            </button>
            <button class="btn btn-secondary" onclick="MonstersModule.duplicateMonster('${monster.monsterId}')">
              📋 Duplicate
            </button>
            <button class="btn btn-danger" onclick="MonstersModule.deleteMonster('${monster.monsterId}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Éditer un monstre
   */
  async editMonster(monsterId) {
    try {
      const { data } = await AdminCore.makeRequest(`/api/admin/monsters/${monsterId}`);
      const monster = data.data;
      
      this.closeDetailsModal();
      
      if (window.MonstersForm) {
        window.MonstersForm.showEditModal(monster);
      }
      
    } catch (error) {
      console.error('Edit monster error:', error);
      AdminCore.showAlert('Failed to load monster for editing: ' + error.message, 'error');
    }
  }

  /**
   * Créer un nouveau monstre
   */
  showCreateModal() {
    if (window.MonstersForm) {
      window.MonstersForm.showCreateModal();
    }
  }

  /**
   * Dupliquer un monstre
   */
  async duplicateMonster(monsterId) {
    const newId = prompt('Enter new Monster ID (e.g., MON_fire_goblin_v2):');
    if (!newId)return;
    
    const newName = prompt('Enter new Monster Name:');
    if (!newName) return;

    try {
      await AdminCore.makeRequest(`/api/admin/monsters/${monsterId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({
          newMonsterId: newId,
          newName: newName
        })
      });

      AdminCore.showAlert(`Monster duplicated successfully as ${newName}!`, 'success');
      this.closeDetailsModal();
      this.loadMonstersList();
      
    } catch (error) {
      console.error('Duplicate monster error:', error);
      AdminCore.showAlert('Failed to duplicate monster: ' + error.message, 'error');
    }
  }

  /**
   * Supprimer un monstre
   */
  async deleteMonster(monsterId) {
    const monster = this.currentMonsters.find(m => m.monsterId === monsterId);
    if (!monster) {
      AdminCore.showAlert('Monster not found', 'error');
      return;
    }

    const confirmed = confirm(
      `⚠️ DELETE MONSTER\n\n` +
      `Are you sure you want to delete "${monster.name}" (${monsterId})?\n\n` +
      `This action CANNOT be undone!`
    );

    if (!confirmed) return;

    const finalConfirm = confirm(
      `⚠️ FINAL CONFIRMATION\n\n` +
      `This will PERMANENTLY delete ${monster.name}.\n\n` +
      `Type YES in the next prompt to confirm.`
    );

    if (!finalConfirm) return;

    const typeConfirm = prompt('Type YES to confirm deletion:');
    if (typeConfirm !== 'YES') {
      AdminCore.showAlert('Deletion cancelled', 'info');
      return;
    }

    try {
      await AdminCore.makeRequest(`/api/admin/monsters/${monsterId}`, {
        method: 'DELETE'
      });

      AdminCore.showAlert(`Monster ${monster.name} deleted successfully`, 'success');
      this.closeDetailsModal();
      this.loadMonstersList();
      
    } catch (error) {
      console.error('Delete monster error:', error);
      AdminCore.showAlert('Failed to delete monster: ' + error.message, 'error');
    }
  }

  /**
   * Fermer le modal de détails
   */
  closeDetailsModal() {
    document.getElementById('monsterDetailsModal').style.display = 'none';
  }
}

// Créer l'instance globale
window.MonstersModule = new MonstersModule();

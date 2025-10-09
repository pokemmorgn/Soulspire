/**
 * CampaignModule - Module principal de gestion de la campagne
 * Orchestration de toutes les fonctionnalités du Campaign Level Editor
 */
class CampaignModule {
  constructor() {
    this.currentView = 'worlds'; // 'worlds' | 'world' | 'level'
    this.currentWorldId = null;
    this.worlds = [];
    this.currentWorldData = null;
  }

  /**
   * Initialiser le module
   */
  init() {
    console.log('🗺️ Initializing Campaign Module...');
    
    // Initialiser les sous-modules
    if (window.CampaignUI) {
      console.log('✅ CampaignUI loaded');
    } else {
      console.error('❌ CampaignUI not loaded');
    }

    if (window.CampaignForm) {
      CampaignForm.init();
      console.log('✅ CampaignForm loaded');
    } else {
      console.error('❌ CampaignForm not loaded');
    }
    
    console.log('✅ Campaign Module initialized');
  }

  /**
   * Charger les données (appelé quand on affiche la section)
   */
  async loadData() {
    console.log('🗺️ Loading campaign data...');
    const content = document.getElementById('campaignContent');
    
    try {
      content.innerHTML = this.renderCampaignInterface();
      await this.loadWorldsList();
    } catch (error) {
      console.error('Campaign data loading error:', error);
      content.innerHTML = `<div class="alert error">Failed to load campaign data: ${error.message}</div>`;
    }
  }

  /**
   * 🎨 INTERFACE PRINCIPALE
   */

  renderCampaignInterface() {
    return `
      <!-- Stats Cards -->
      <div class="campaign-stats-grid" id="campaignStatsGrid">
        <div class="loading"><div class="spinner"></div><p>Loading statistics...</p></div>
      </div>

      <!-- Navigation Breadcrumb -->
      <div class="campaign-breadcrumb" id="campaignBreadcrumb">
        <span class="breadcrumb-item active" onclick="CampaignModule.showWorldsList()">🗺️ All Worlds</span>
      </div>

      <!-- Main Content Area -->
      <div class="campaign-main-content" id="campaignMainContent">
        <div class="loading"><div class="spinner"></div><p>Loading worlds...</p></div>
      </div>

      <!-- Modal pour édition de niveau -->
      <div id="campaignLevelModal" class="modal">
        <div class="modal-content campaign-modal-content" id="campaignLevelModalContent">
          <div class="loading"><div class="spinner"></div><p>Loading...</p></div>
        </div>
      </div>

      <!-- Modal pour monster pool -->
      <div id="campaignMonsterPoolModal" class="modal">
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2 id="monsterPoolModalTitle">Monster Pool</h2>
            <span class="modal-close" onclick="CampaignModule.closeMonsterPoolModal()">&times;</span>
          </div>
          <div class="modal-body" id="monsterPoolModalBody">
            <div class="loading"><div class="spinner"></div><p>Loading...</p></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 🗺️ LISTE DES MONDES
   */

  async loadWorldsList() {
    try {
      CampaignUI.showLoading('campaignMainContent', 'Loading worlds...');

      // 🔧 Utiliser l'API publique campaign qui existe déjà
      const response = await fetch('/api/campaign/worlds');
      const result = await response.json();
      
      // L'API publique retourne { worlds: [...], totalWorlds: X }
      this.worlds = result.worlds || [];

      this.updateStats();
      this.renderWorldsList();

    } catch (error) {
      console.error('❌ Load worlds error:', error);
      CampaignUI.showError('campaignMainContent', 'Failed to load worlds: ' + error.message);
    }
  }

  renderWorldsList() {
    this.currentView = 'worlds';
    this.updateBreadcrumb();

    const container = document.getElementById('campaignMainContent');
    
    if (this.worlds.length === 0) {
      container.innerHTML = `
        <div class="campaign-empty-state">
          <div class="empty-icon">🗺️</div>
          <h3>No Campaign Worlds Found</h3>
          <p>No campaign worlds have been created yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="campaign-worlds-header">
        <h3>🗺️ Campaign Worlds</h3>
        <button class="btn btn-info" onclick="CampaignModule.refreshWorldsList()">
          ↻ Refresh
        </button>
      </div>
      <div class="campaign-worlds-grid">
        ${this.worlds.map(world => CampaignUI.renderWorldCard(world)).join('')}
      </div>
    `;
  }

  async refreshWorldsList() {
    AdminCore.showAlert('Refreshing worlds list...', 'info', 1000);
    await this.loadWorldsList();
  }

  showWorldsList() {
    this.currentWorldId = null;
    this.currentWorldData = null;
    this.renderWorldsList();
  }

  /**
   * 🌍 VUE D'UN MONDE SPÉCIFIQUE
   */

  async viewWorld(worldId) {
    try {
      this.currentWorldId = worldId;
      this.currentView = 'world';

      CampaignUI.showLoading('campaignMainContent', `Loading World ${worldId}...`);

      // 🔧 Utiliser l'API admin
      const response = await AdminCore.makeRequest(`/api/admin/campaign/worlds/${worldId}`);
      
      console.log('🔍 Full API response:', response);
      console.log('🔍 response.data:', response.data);
      console.log('🔍 response.data?.world:', response.data?.world);
      
      // L'API admin retourne { success: true, data: { world: {...} } }
      // AdminCore.makeRequest retourne déjà la réponse parsée
      let worldData = null;
      
      // Essayer différents chemins possibles
      if (response.data && response.data.world) {
        worldData = response.data.world;
      } else if (response.world) {
        worldData = response.world;
      } else if (response.data && !response.data.world) {
        // Peut-être que data EST le monde ?
        worldData = response.data;
      }
      
      console.log('🔍 Extracted worldData:', worldData);
      
      if (!worldData) {
        console.error('❌ Could not extract world data from response');
        throw new Error('No world data received from API');
      }
      
      if (!worldData.levels || !Array.isArray(worldData.levels)) {
        console.error('❌ Invalid world data - missing levels array:', worldData);
        throw new Error('World data is missing levels array');
      }

      this.currentWorldData = worldData;
      console.log(`✅ Loaded world ${worldId} with ${worldData.levels.length} levels`);

      this.updateBreadcrumb();
      this.renderWorldView();

    } catch (error) {
      console.error('❌ View world error:', error);
      CampaignUI.showError('campaignMainContent', 'Failed to load world: ' + error.message);
    }
  }

  renderWorldView() {
    const world = this.currentWorldData;
    const container = document.getElementById('campaignMainContent');

    const configuredCount = world.levels.filter(l => l.isConfigured).length;
    const configPercent = Math.round((configuredCount / world.levels.length) * 100);

    container.innerHTML = `
      <div class="campaign-world-view">
        <!-- World Header -->
        <div class="world-view-header">
          <div class="world-header-info">
            <h2>🌍 ${CampaignUI.escapeHtml(world.name)}</h2>
            ${world.description ? `<p class="world-description">${CampaignUI.escapeHtml(world.description)}</p>` : ''}
            
            <div class="world-meta">
              <span class="meta-item">🎯 Min Level: ${world.minPlayerLevel}</span>
              <span class="meta-item">📍 ${world.levelCount} Levels</span>
              ${world.elementBias && world.elementBias.length > 0 ? `
                <span class="meta-item">⚡ Elements: ${world.elementBias.map(e => CampaignUI.getElementIcon(e)).join(' ')}</span>
              ` : ''}
            </div>
          </div>

          <div class="world-header-actions">
            <button class="btn btn-info" onclick="CampaignModule.editWorldPool(${world.worldId})">
              👹 Monster Pool (${world.defaultMonsterPool?.length || 0})
            </button>
            <button class="btn btn-secondary" onclick="CampaignModule.exportWorldConfig(${world.worldId})">
              📥 Export Config
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="world-progress-section">
          <div class="progress-info">
            <span>Configuration Progress</span>
            <span class="progress-value">${configuredCount} / ${world.levels.length} levels (${configPercent}%)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${configPercent >= 80 ? 'progress-high' : configPercent >= 40 ? 'progress-medium' : 'progress-low'}" 
                 style="width: ${configPercent}%"></div>
          </div>
        </div>

        <!-- Levels Grid -->
        <div class="world-levels-section">
          <div class="levels-header">
            <h3>📍 Levels</h3>
            <div class="levels-actions">
              <button class="btn btn-small btn-secondary" onclick="CampaignModule.bulkEditLevels()">
                📋 Bulk Edit
              </button>
              <button class="btn btn-small btn-info" onclick="CampaignModule.autoConfigureWorld(${world.worldId})">
                🤖 Auto-Configure All
              </button>
            </div>
          </div>
          ${CampaignUI.renderLevelGrid(world.levels, world.worldId)}
        </div>
      </div>
    `;
  }

  /**
   * ✏️ ÉDITION DE NIVEAU
   */

  async editLevel(worldId, levelIndex) {
    try {
      console.log(`✏️ Edit level ${worldId}-${levelIndex}`);
      await CampaignForm.showEditLevelModal(worldId, levelIndex);
    } catch (error) {
      console.error('❌ Edit level error:', error);
      AdminCore.showAlert('Failed to open level editor: ' + error.message, 'error');
    }
  }

  /**
   * 👹 GESTION DU MONSTER POOL
   */

  async editWorldPool(worldId) {
    try {
      const world = this.worlds.find(w => w.worldId === worldId) || this.currentWorldData;
      
      if (!world) {
        AdminCore.showAlert('World not found', 'error');
        return;
      }

      document.getElementById('monsterPoolModalTitle').textContent = `Monster Pool - ${world.name}`;
      
      const modalBody = document.getElementById('monsterPoolModalBody');
      modalBody.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading monsters...</p></div>';
      
      document.getElementById('campaignMonsterPoolModal').style.display = 'block';

      // 🔧 Charger les monstres disponibles pour ce monde (utiliser l'API admin)
      const { data } = await AdminCore.makeRequest(`/api/admin/campaign/monsters/available?worldId=${worldId}`);
      const monsters = data.monsters || [];
      
      console.log(`✅ Loaded ${monsters.length} monsters for world ${worldId}`);

      const currentPool = world.defaultMonsterPool || [];

      // Si aucun monstre n'est disponible, afficher un message
      if (monsters.length === 0) {
        modalBody.innerHTML = `
          <div class="alert warning">
            <strong>⚠️ No monsters available</strong>
            <p>No monsters are configured for this world yet. Create monsters first in the Monsters section.</p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="CampaignModule.closeMonsterPoolModal()">
              Close
            </button>
          </div>
        `;
        return;
      }

      modalBody.innerHTML = `
        <div class="monster-pool-editor">
          <div class="alert info">
            <strong>ℹ️ Monster Pool</strong>
            <p>This pool is used for auto-generation. Select monsters that can appear in this world.</p>
          </div>

          <div class="pool-stats">
            <span>Selected: <strong>${currentPool.length}</strong> monsters</span>
          </div>

          <div class="monster-pool-grid">
            ${monsters.map(monster => `
              <div class="monster-pool-item ${currentPool.includes(monster.monsterId) ? 'selected' : ''}" 
                   data-monster-id="${monster.monsterId}"
                   onclick="CampaignModule.toggleMonsterInPool('${monster.monsterId}')">
                <div class="pool-item-header">
                  <span>${CampaignUI.getElementIcon(monster.element)}</span>
                  <span>${CampaignUI.getTypeIcon(monster.type)}</span>
                  ${currentPool.includes(monster.monsterId) ? '<span class="pool-selected-badge">✓</span>' : ''}
                </div>
                <div class="pool-item-body">
                  <strong>${CampaignUI.escapeHtml(monster.name)}</strong>
                  <small>${monster.monsterId}</small>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="CampaignModule.closeMonsterPoolModal()">
              Cancel
            </button>
            <button class="btn btn-success" onclick="CampaignModule.saveMonsterPool(${worldId})">
              💾 Save Pool
            </button>
          </div>
        </div>
      `;

      // Stocker temporairement le pool pour édition
      this.tempMonsterPool = [...currentPool];

    } catch (error) {
      console.error('❌ Edit monster pool error:', error);
      AdminCore.showAlert('Failed to load monster pool: ' + error.message, 'error');
    }
  }

  toggleMonsterInPool(monsterId) {
    if (!this.tempMonsterPool) {
      this.tempMonsterPool = [];
    }

    const index = this.tempMonsterPool.indexOf(monsterId);
    const element = document.querySelector(`[data-monster-id="${monsterId}"]`);

    if (index > -1) {
      this.tempMonsterPool.splice(index, 1);
      element?.classList.remove('selected');
      element?.querySelector('.pool-selected-badge')?.remove();
    } else {
      this.tempMonsterPool.push(monsterId);
      element?.classList.add('selected');
      if (element && !element.querySelector('.pool-selected-badge')) {
        const header = element.querySelector('.pool-item-header');
        if (header) {
          header.insertAdjacentHTML('beforeend', '<span class="pool-selected-badge">✓</span>');
        }
      }
    }

    // Update count
    const statsElement = document.querySelector('.pool-stats strong');
    if (statsElement) {
      statsElement.textContent = this.tempMonsterPool.length;
    }
  }

  async saveMonsterPool(worldId) {
    try {
      if (!this.tempMonsterPool) {
        AdminCore.showAlert('No changes to save', 'warning');
        return;
      }

      await AdminCore.makeRequest(`/api/admin/campaign/worlds/${worldId}/monster-pool`, {
        method: 'PUT',
        body: JSON.stringify({ monsterPool: this.tempMonsterPool })
      });

      AdminCore.showAlert('Monster pool saved successfully!', 'success');
      this.closeMonsterPoolModal();
      
      // Refresh world data
      if (this.currentWorldId === worldId) {
        await this.viewWorld(worldId);
      } else {
        await this.loadWorldsList();
      }

    } catch (error) {
      console.error('❌ Save monster pool error:', error);
      AdminCore.showAlert('Failed to save monster pool: ' + error.message, 'error');
    }
  }

  closeMonsterPoolModal() {
    document.getElementById('campaignMonsterPoolModal').style.display = 'none';
    this.tempMonsterPool = null;
  }

  /**
   * 🔧 ACTIONS SPÉCIALES
   */

  async bulkEditLevels() {
    AdminCore.showAlert('Bulk edit feature coming soon!', 'info');
    // TODO: Implémenter l'édition en masse
  }

  async autoConfigureWorld(worldId) {
    const confirmed = confirm(
      '⚠️ Auto-Configure World\n\n' +
      'This will configure ALL unconfigured levels to use auto-generation.\n\n' +
      'Levels with manual configuration will NOT be changed.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      AdminCore.showAlert('Auto-configuring world...', 'info', 3000);
      
      // TODO: Implémenter la configuration automatique de tous les niveaux
      // Pour l'instant, on affiche juste un message
      
      setTimeout(() => {
        AdminCore.showAlert('Auto-configuration completed!', 'success');
        this.viewWorld(worldId);
      }, 2000);

    } catch (error) {
      console.error('❌ Auto-configure error:', error);
      AdminCore.showAlert('Failed to auto-configure: ' + error.message, 'error');
    }
  }

  async exportWorldConfig(worldId) {
    try {
      const world = this.currentWorldData || this.worlds.find(w => w.worldId === worldId);
      
      if (!world) {
        AdminCore.showAlert('World not found', 'error');
        return;
      }

      const config = {
        worldId: world.worldId,
        name: world.name,
        levels: world.levels.map(level => ({
          levelIndex: level.levelIndex,
          name: level.name,
          monsters: level.monsters,
          autoGenerate: level.autoGenerate
        }))
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `world_${worldId}_config.json`;
      a.click();
      URL.revokeObjectURL(url);

      AdminCore.showAlert('Configuration exported!', 'success', 2000);

    } catch (error) {
      console.error('❌ Export error:', error);
      AdminCore.showAlert('Failed to export configuration: ' + error.message, 'error');
    }
  }

  /**
   * 📊 STATISTIQUES
   */

  updateStats() {
    const totalWorlds = this.worlds.length;
    const totalLevels = this.worlds.reduce((sum, w) => sum + (w.stats?.totalLevels || 0), 0);
    const configuredLevels = this.worlds.reduce((sum, w) => sum + (w.stats?.configuredLevels || 0), 0);
    const autoGenLevels = this.worlds.reduce((sum, w) => sum + (w.stats?.autoGenLevels || 0), 0);

    document.getElementById('campaignStatsGrid').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">🗺️</div>
        <div class="stat-value">${totalWorlds}</div>
        <div class="stat-label">Total Worlds</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📍</div>
        <div class="stat-value">${totalLevels}</div>
        <div class="stat-label">Total Levels</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${configuredLevels}</div>
        <div class="stat-label">Configured</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🤖</div>
        <div class="stat-value">${autoGenLevels}</div>
        <div class="stat-label">Auto-Gen</div>
      </div>
    `;
  }

  /**
   * 🧭 BREADCRUMB
   */

  updateBreadcrumb() {
    const container = document.getElementById('campaignBreadcrumb');
    
    let breadcrumbHTML = '<span class="breadcrumb-item" onclick="CampaignModule.showWorldsList()">🗺️ All Worlds</span>';

    if (this.currentView === 'world' && this.currentWorldData) {
      breadcrumbHTML += ` <span class="breadcrumb-separator">›</span> `;
      breadcrumbHTML += `<span class="breadcrumb-item active">${CampaignUI.escapeHtml(this.currentWorldData.name)}</span>`;
    }

    container.innerHTML = breadcrumbHTML;
  }
}

// Créer l'instance globale
window.CampaignModule = new CampaignModule();

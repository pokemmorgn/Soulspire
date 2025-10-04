/**
 * AchievementsModule - Module principal de gestion des achievements
 */
class AchievementsModule {
  constructor() {
    this.currentAchievements = [];
    this.filters = {
      page: 1,
      limit: 20,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
      category: '',
      rarity: '',
      isActive: '',
      search: ''
    };
    this.stats = null;
  }

  /**
   * Initialiser le module
   */
  init() {
    console.log('🏆 Initializing Achievements Module...');
    
    if (window.AchievementsForm) {
      window.AchievementsForm.init();
    }
    
    console.log('✅ Achievements Module initialized');
  }

  /**
   * Charger les données
   */
  async loadData() {
    console.log('🏆 Loading achievements data...');
    const content = document.getElementById('achievementsContent');
    
    try {
      content.innerHTML = this.renderAchievementsInterface();
      await this.loadAchievementsList();
      await this.loadAchievementsStats();
    } catch (error) {
      console.error('Achievements data loading error:', error);
      content.innerHTML = `<div class="alert error">Failed to load achievements data: ${error.message}</div>`;
    }
  }

  /**
   * Rendre l'interface principale
   */
  renderAchievementsInterface() {
    return `
      <!-- Stats Cards -->
      <div class="achievements-stats-grid" id="achievementsStatsGrid">
        <div class="loading"><div class="spinner"></div><p>Loading statistics...</p></div>
      </div>

      <!-- Controls -->
      <div class="achievements-controls">
        <div class="search-section">
          <h3>🔍 Search & Filter Achievements</h3>
          
          <div class="search-grid">
            <div class="search-group">
              <label for="searchAchievement">Search:</label>
              <input type="text" id="searchAchievement" placeholder="Name or ID...">
            </div>
            
            <div class="search-group">
              <label for="filterCategory">Category:</label>
              <select id="filterCategory">
                <option value="">All Categories</option>
                <option value="combat">⚔️ Combat</option>
                <option value="progression">📈 Progression</option>
                <option value="collection">📦 Collection</option>
                <option value="social">👥 Social</option>
                <option value="exploration">🗺️ Exploration</option>
                <option value="economy">💰 Economy</option>
                <option value="special">⭐ Special</option>
                <option value="event">🎉 Event</option>
                <option value="daily">📅 Daily</option>
                <option value="challenge">🏆 Challenge</option>
              </select>
            </div>
            
            <div class="search-group">
              <label for="filterRarity">Rarity:</label>
              <select id="filterRarity">
                <option value="">All Rarities</option>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
                <option value="mythic">Mythic</option>
              </select>
            </div>
            
            <div class="search-group">
              <label for="filterActive">Status:</label>
              <select id="filterActive">
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          
          <div class="search-actions">
            <button class="btn btn-primary" onclick="AchievementsModule.search()">🔍 Search</button>
            <button class="btn btn-secondary" onclick="AchievementsModule.clearFilters()">Clear</button>
            <button class="btn btn-success" onclick="AchievementsModule.showCreateModal()">➕ Create Achievement</button>
            <button class="btn btn-info" onclick="AchievementsModule.loadAchievementsList()">↻ Refresh</button>
          </div>
        </div>
      </div>

      <!-- Achievements List -->
      <div class="achievements-list-section">
        <div class="achievements-header">
          <h3>📋 Achievements List</h3>
          <div class="achievements-pagination" id="achievementsPagination"></div>
        </div>
        <div class="achievements-table-container">
          <div id="achievementsTableContent">
            <div class="loading"><div class="spinner"></div><p>Loading achievements...</p></div>
          </div>
        </div>
      </div>

      <!-- Modal de détails -->
      <div id="achievementDetailsModal" class="modal">
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2 id="achievementModalTitle">Achievement Details</h2>
            <span class="modal-close" onclick="AchievementsModule.closeDetailsModal()">&times;</span>
          </div>
          <div class="modal-body" id="achievementModalBody"></div>
        </div>
      </div>

      <!-- Modal de formulaire -->
      ${window.AchievementsForm ? window.AchievementsForm.renderModal() : ''}
    `;
  }

  /**
   * Charger les statistiques
   */
  async loadAchievementsStats() {
    try {
      const { data } = await AdminCore.makeRequest('/api/admin/achievements/stats');
      this.stats = data;
      
      const totalAchievements = data.stats?.reduce((sum, cat) => sum + cat.count, 0) || 0;
      const avgPoints = data.stats?.reduce((sum, cat) => sum + (cat.avgPoints * cat.count), 0) / totalAchievements || 0;
      
      document.getElementById('achievementsStatsGrid').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon">🏆</div>
          <div class="stat-value">${AdminCore.formatNumber(totalAchievements)}</div>
          <div class="stat-label">Total Achievements</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${data.stats?.length || 0}</div>
          <div class="stat-label">Categories</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${avgPoints.toFixed(0)}</div>
          <div class="stat-label">Avg Points</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${AdminCore.formatNumber(data.totalPlayers || 0)}</div>
          <div class="stat-label">Players with Achievements</div>
        </div>
      `;
    } catch (error) {
      console.error('Load achievements stats error:', error);
      document.getElementById('achievementsStatsGrid').innerHTML = 
        '<div class="alert error">Failed to load statistics</div>';
    }
  }

  /**
   * Charger la liste des achievements
   */
  async loadAchievementsList() {
    const container = document.getElementById('achievementsTableContent');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading achievements...</p></div>';

    try {
      const params = new URLSearchParams({
        page: this.filters.page.toString(),
        limit: this.filters.limit.toString(),
        sortBy: this.filters.sortBy,
        sortOrder: this.filters.sortOrder
      });

      if (this.filters.category) params.append('category', this.filters.category);
      if (this.filters.rarity) params.append('rarity', this.filters.rarity);
      if (this.filters.isActive !== '') params.append('isActive', this.filters.isActive);
      if (this.filters.search) params.append('search', this.filters.search);

      const { data } = await AdminCore.makeRequest('/api/admin/achievements?' + params.toString());
      
      this.currentAchievements = data.achievements || [];
      
      container.innerHTML = this.renderAchievementsTable();
      this.updatePagination();
      
    } catch (error) {
      console.error('Load achievements list error:', error);
      container.innerHTML = `<div class="alert error">Failed to load achievements: ${error.message}</div>`;
    }
  }

  /**
   * Rendre le tableau des achievements
   */
  renderAchievementsTable() {
    if (!this.currentAchievements || this.currentAchievements.length === 0) {
      return '<div class="no-data">No achievements found matching your criteria.</div>';
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Rarity</th>
            <th>Points</th>
            <th>Condition</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.currentAchievements.map(ach => this.renderAchievementRow(ach)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Rendre une ligne d'achievement
   */
  renderAchievementRow(achievement) {
    const categoryBadge = AchievementsUI.getCategoryBadge(achievement.category);
    
    return `
      <tr>
        <td>
          <div class="achievement-name">
            <strong>${AchievementsUI.escapeHtml(achievement.name)}</strong>
            <small class="achievement-id">${achievement.achievementId}</small>
            ${achievement.isHidden ? '<span class="badge badge-secondary" style="font-size: 10px;">HIDDEN</span>' : ''}
          </div>
        </td>
        <td>
          <span style="font-size: 18px;" title="${categoryBadge.name}">${categoryBadge.icon}</span>
        </td>
        <td>
          <span class="badge ${AchievementsUI.getRarityClass(achievement.rarity)}">${AchievementsUI.capitalizeFirst(achievement.rarity)}</span>
        </td>
        <td>
          <strong>${AchievementsUI.formatPoints(achievement.pointsValue)}</strong>
        </td>
        <td>
          <small>${AchievementsUI.capitalizeFirst(achievement.conditions?.type || 'N/A')}: ${achievement.conditions?.target || 0}</small>
        </td>
        <td>
          <span class="badge ${achievement.isActive ? 'badge-success' : 'badge-secondary'}">
            ${achievement.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-small btn-info" onclick="AchievementsModule.viewAchievement('${achievement.achievementId}')">
              👁️ View
            </button>
            <button class="btn btn-small btn-warning" onclick="AchievementsModule.editAchievement('${achievement.achievementId}')">
              ✏️ Edit
            </button>
            <button class="btn btn-small btn-danger" onclick="AchievementsModule.deleteAchievement('${achievement.achievementId}')">
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
  updatePagination() {
    const totalPages = Math.ceil(this.currentAchievements.length / this.filters.limit);
    const currentPage = this.filters.page;
    
    let paginationHTML = `
      <div class="pagination-info">
        Showing achievements
      </div>
      <div class="pagination-controls">
    `;

    if (currentPage > 1) {
      paginationHTML += `<button class="btn btn-small" onclick="AchievementsModule.goToPage(${currentPage - 1})">« Prev</button>`;
    }

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? 'btn-primary' : 'btn-secondary';
      paginationHTML += `<button class="btn btn-small ${activeClass}" onclick="AchievementsModule.goToPage(${i})">${i}</button>`;
    }

    if (currentPage < totalPages) {
      paginationHTML += `<button class="btn btn-small" onclick="AchievementsModule.goToPage(${currentPage + 1})">Next »</button>`;
    }

    paginationHTML += '</div>';
    document.getElementById('achievementsPagination').innerHTML = paginationHTML;
  }

  /**
   * Aller à une page
   */
  goToPage(page) {
    this.filters.page = page;
    this.loadAchievementsList();
  }

  /**
   * Rechercher avec filtres
   */
  search() {
    this.filters = {
      page: 1,
      limit: 20,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
      category: document.getElementById('filterCategory').value,
      rarity: document.getElementById('filterRarity').value,
      isActive: document.getElementById('filterActive').value,
      search: document.getElementById('searchAchievement').value.trim()
    };

    this.loadAchievementsList();
  }

  /**
   * Effacer les filtres
   */
  clearFilters() {
    document.getElementById('searchAchievement').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterRarity').value = '';
    document.getElementById('filterActive').value = '';

    this.filters = {
      page: 1,
      limit: 20,
      sortBy: 'displayOrder',
      sortOrder: 'asc',
      category: '',
      rarity: '',
      isActive: '',
      search: ''
    };

    this.loadAchievementsList();
  }

  /**
   * Voir les détails d'un achievement
   */
  async viewAchievement(achievementId) {
    try {
      AdminCore.showAlert('Loading achievement details...', 'info', 1000);
      
      const achievement = this.currentAchievements.find(a => a.achievementId === achievementId);
      if (!achievement) {
        throw new Error('Achievement not found');
      }
      
      document.getElementById('achievementModalTitle').textContent = `🏆 ${achievement.name}`;
      document.getElementById('achievementModalBody').innerHTML = this.renderAchievementDetails(achievement);
      document.getElementById('achievementDetailsModal').style.display = 'block';
      
    } catch (error) {
      console.error('View achievement error:', error);
      AdminCore.showAlert('Failed to load achievement details: ' + error.message, 'error');
    }
  }

  /**
   * Rendre les détails d'un achievement
   */
  renderAchievementDetails(achievement) {
    const categoryBadge = AchievementsUI.getCategoryBadge(achievement.category);
    
    return `
      <div class="achievement-details">
        <!-- Basic Info -->
        <div class="detail-section">
          <h3>📋 Basic Information</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Achievement ID:</span>
              <span class="detail-value"><code>${achievement.achievementId}</code></span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${AchievementsUI.escapeHtml(achievement.name)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Category:</span>
              <span style="font-size: 20px;">${categoryBadge.icon} ${categoryBadge.name}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Rarity:</span>
              <span class="badge ${AchievementsUI.getRarityClass(achievement.rarity)}">${AchievementsUI.capitalizeFirst(achievement.rarity)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Points:</span>
              <span class="detail-value"><strong>${achievement.pointsValue}</strong></span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span class="badge ${achievement.isActive ? 'badge-success' : 'badge-secondary'}">
                ${achievement.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          <div style="margin-top: 15px;">
            <strong>Description:</strong>
            <p style="margin-top: 5px; color: #666;">${AchievementsUI.escapeHtml(achievement.description)}</p>
          </div>
        </div>

        <!-- Conditions -->
        <div class="detail-section">
          <h3>🎯 Conditions</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Type:</span>
              <span class="detail-value">${AchievementsUI.capitalizeFirst(achievement.conditions?.type || 'N/A')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Target:</span>
              <span class="detail-value"><strong>${achievement.conditions?.target || 0}</strong></span>
            </div>
          </div>
          ${achievement.conditions?.details ? `
            <div style="margin-top: 10px;">
              <strong>Details:</strong>
              <pre style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 5px; font-size: 12px;">${JSON.stringify(achievement.conditions.details, null, 2)}</pre>
            </div>
          ` : ''}
        </div>

        <!-- Rewards -->
        <div class="detail-section">
          <h3>🎁 Rewards</h3>
          <div class="detail-grid">
            ${achievement.rewards?.gold ? `
              <div class="detail-item">
                <span class="detail-label">🪙 Gold:</span>
                <span class="detail-value">${AchievementsUI.formatNumber(achievement.rewards.gold)}</span>
              </div>
            ` : ''}
            ${achievement.rewards?.gems ? `
              <div class="detail-item">
                <span class="detail-label">💎 Gems:</span>
                <span class="detail-value">${AchievementsUI.formatNumber(achievement.rewards.gems)}</span>
              </div>
            ` : ''}
            ${achievement.rewards?.title ? `
              <div class="detail-item">
                <span class="detail-label">🏅 Title:</span>
                <span class="detail-value">${AchievementsUI.escapeHtml(achievement.rewards.title)}</span>
              </div>
            ` : ''}
          </div>
          ${achievement.rewards?.items ? `
            <div style="margin-top: 10px;">
              <strong>Items:</strong>
              <pre style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 5px; font-size: 12px;">${JSON.stringify(achievement.rewards.items, null, 2)}</pre>
            </div>
          ` : ''}
        </div>

        <!-- Settings -->
        <div class="detail-section">
          <h3>⚙️ Settings</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Hidden:</span>
              <span class="detail-value">${achievement.isHidden ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Repeatable:</span>
              <span class="detail-value">${achievement.isRepeatable ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Display Order:</span>
              <span class="detail-value">${achievement.displayOrder}</span>
            </div>
            ${achievement.iconId ? `
              <div class="detail-item">
                <span class="detail-label">Icon ID:</span>
                <span class="detail-value"><code>${achievement.iconId}</code></span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Actions -->
        <div class="detail-section">
          <h3>⚙️ Actions</h3>
          <div class="modal-actions">
            <button class="btn btn-warning" onclick="AchievementsModule.editAchievement('${achievement.achievementId}')">
              ✏️ Edit Achievement
            </button>
            <button class="btn btn-danger" onclick="AchievementsModule.deleteAchievement('${achievement.achievementId}')">
              🗑️ Delete Achievement
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Éditer un achievement
   */
  editAchievement(achievementId) {
    const achievement = this.currentAchievements.find(a => a.achievementId === achievementId);
    if (!achievement) {
      AdminCore.showAlert('Achievement not found', 'error');
      return;
    }
    
    this.closeDetailsModal();
    
    if (window.AchievementsForm) {
      window.AchievementsForm.showEditModal(achievement);
    }
  }

  /**
   * Créer un nouveau achievement
   */
  showCreateModal() {
    if (window.AchievementsForm) {
      window.AchievementsForm.showCreateModal();
    }
  }

  /**
   * Supprimer un achievement
   */
  async deleteAchievement(achievementId) {
    const achievement = this.currentAchievements.find(a => a.achievementId === achievementId);
    if (!achievement) {
      AdminCore.showAlert('Achievement not found', 'error');
      return;
    }

    const confirmed = confirm(
      `⚠️ DELETE ACHIEVEMENT\n\n` +
      `Are you sure you want to delete "${achievement.name}" (${achievementId})?\n\n` +
      `This action CANNOT be undone!`
    );

    if (!confirmed) return;

    try {
      await AdminCore.makeRequest(`/api/admin/achievements/${achievementId}`, {
        method: 'DELETE'
      });

      AdminCore.showAlert(`Achievement ${achievement.name} deleted successfully`, 'success');
      this.closeDetailsModal();
      this.loadAchievementsList();
      
    } catch (error) {
      console.error('Delete achievement error:', error);
      AdminCore.showAlert('Failed to delete achievement: ' + error.message, 'error');
    }
  }

  /**
   * Fermer le modal de détails
   */
  closeDetailsModal() {
    document.getElementById('achievementDetailsModal').style.display = 'none';
  }
}

// Créer l'instance globale
window.AchievementsModule = new AchievementsModule();

/**
 * AchievementsForm - Gestion du formulaire de création/édition d'achievements
 */
class AchievementsForm {
  constructor() {
    this.currentMode = null; // 'create' ou 'edit'
    this.currentAchievement = null;
  }

  /**
   * Rendre le modal HTML
   */
  renderModal() {
    return `
      <div id="achievementFormModal" class="modal">
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2 id="achievementFormTitle">Create Achievement</h2>
            <span class="modal-close" onclick="AchievementsForm.closeModal()">&times;</span>
          </div>
          <div class="modal-body" id="achievementFormBody"></div>
        </div>
      </div>
    `;
  }

  /**
   * Afficher le modal en mode création
   */
  showCreateModal() {
    this.currentMode = 'create';
    this.currentAchievement = null;
    
    document.getElementById('achievementFormTitle').textContent = '🆕 Create New Achievement';
    document.getElementById('achievementFormBody').innerHTML = this.renderForm();
    document.getElementById('achievementFormModal').style.display = 'block';
  }

  /**
   * Afficher le modal en mode édition
   */
  showEditModal(achievement) {
    this.currentMode = 'edit';
    this.currentAchievement = achievement;
    
    document.getElementById('achievementFormTitle').textContent = `✏️ Edit Achievement: ${achievement.name}`;
    document.getElementById('achievementFormBody').innerHTML = this.renderForm(achievement);
    document.getElementById('achievementFormModal').style.display = 'block';
  }

  /**
   * Rendre le formulaire
   */
  renderForm(achievement = null) {
    const isEdit = !!achievement;
    
    return `
      <form id="achievementForm" class="achievement-form">
        <!-- Basic Info -->
        <div class="form-section">
          <h3>📋 Basic Information</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label for="achievementId">Achievement ID *</label>
              <input type="text" id="achievementId" class="form-control" 
                     placeholder="ACH_first_hero" 
                     value="${achievement?.achievementId || ''}" 
                     ${isEdit ? 'readonly' : ''} required>
              <small>Format: ACH_[category]_[name] (lowercase, no spaces)</small>
            </div>

            <div class="form-group">
              <label for="achievementName">Name *</label>
              <input type="text" id="achievementName" class="form-control" 
                     placeholder="First Hero Summoned" 
                     value="${AchievementsUI.escapeHtml(achievement?.name || '')}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="achievementDescription">Description *</label>
            <textarea id="achievementDescription" class="form-control" rows="3" 
                      placeholder="Summon your first hero..." required>${AchievementsUI.escapeHtml(achievement?.description || '')}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="achievementCategory">Category *</label>
              <select id="achievementCategory" class="form-control" required>
                <option value="combat" ${achievement?.category === 'combat' ? 'selected' : ''}>⚔️ Combat</option>
                <option value="progression" ${achievement?.category === 'progression' ? 'selected' : ''}>📈 Progression</option>
                <option value="collection" ${achievement?.category === 'collection' ? 'selected' : ''}>📦 Collection</option>
                <option value="social" ${achievement?.category === 'social' ? 'selected' : ''}>👥 Social</option>
                <option value="exploration" ${achievement?.category === 'exploration' ? 'selected' : ''}>🗺️ Exploration</option>
                <option value="economy" ${achievement?.category === 'economy' ? 'selected' : ''}>💰 Economy</option>
                <option value="special" ${achievement?.category === 'special' ? 'selected' : ''}>⭐ Special</option>
                <option value="event" ${achievement?.category === 'event' ? 'selected' : ''}>🎉 Event</option>
                <option value="daily" ${achievement?.category === 'daily' ? 'selected' : ''}>📅 Daily</option>
                <option value="challenge" ${achievement?.category === 'challenge' ? 'selected' : ''}>🏆 Challenge</option>
              </select>
            </div>

            <div class="form-group">
              <label for="achievementRarity">Rarity *</label>
              <select id="achievementRarity" class="form-control" required>
                <option value="common" ${achievement?.rarity === 'common' ? 'selected' : ''}>Common</option>
                <option value="rare" ${achievement?.rarity === 'rare' ? 'selected' : ''}>Rare</option>
                <option value="epic" ${achievement?.rarity === 'epic' ? 'selected' : ''}>Epic</option>
                <option value="legendary" ${achievement?.rarity === 'legendary' ? 'selected' : ''}>Legendary</option>
                <option value="mythic" ${achievement?.rarity === 'mythic' ? 'selected' : ''}>Mythic</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Conditions -->
        <div class="form-section">
          <h3>🎯 Conditions</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label for="conditionType">Condition Type *</label>
              <select id="conditionType" class="form-control" onchange="AchievementsForm.updateConditionFields()" required>
                <option value="count" ${achievement?.conditions?.type === 'count' ? 'selected' : ''}>Count (reach X value)</option>
                <option value="level" ${achievement?.conditions?.type === 'level' ? 'selected' : ''}>Level (reach level X)</option>
                <option value="collection" ${achievement?.conditions?.type === 'collection' ? 'selected' : ''}>Collection (collect X items)</option>
                <option value="battle" ${achievement?.conditions?.type === 'battle' ? 'selected' : ''}>Battle (win X battles)</option>
                <option value="custom" ${achievement?.conditions?.type === 'custom' ? 'selected' : ''}>Custom</option>
              </select>
            </div>

            <div class="form-group">
              <label for="conditionTarget">Target Value *</label>
              <input type="number" id="conditionTarget" class="form-control" 
                     min="1" value="${achievement?.conditions?.target || 1}" required>
            </div>
          </div>

          <div class="form-group">
            <label for="conditionDetails">Condition Details (JSON)</label>
            <textarea id="conditionDetails" class="form-control" rows="4" 
                      placeholder='{"itemType": "hero", "minRarity": "epic"}'>${achievement?.conditions?.details ? JSON.stringify(achievement.conditions.details, null, 2) : ''}</textarea>
            <small>Optional: Additional conditions in JSON format</small>
          </div>
        </div>

        <!-- Rewards -->
        <div class="form-section">
          <h3>🎁 Rewards</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label for="rewardPoints">Points *</label>
              <input type="number" id="rewardPoints" class="form-control" 
                     min="0" value="${achievement?.pointsValue || 10}" required>
              <small>Achievement points awarded</small>
            </div>

            <div class="form-group">
              <label for="rewardGold">Gold</label>
              <input type="number" id="rewardGold" class="form-control" 
                     min="0" value="${achievement?.rewards?.gold || 0}">
            </div>

            <div class="form-group">
              <label for="rewardGems">Gems</label>
              <input type="number" id="rewardGems" class="form-control" 
                     min="0" value="${achievement?.rewards?.gems || 0}">
            </div>
          </div>

          <div class="form-group">
            <label for="rewardTitle">Title Reward</label>
            <input type="text" id="rewardTitle" class="form-control" 
                   placeholder="Hero Collector" 
                   value="${AchievementsUI.escapeHtml(achievement?.rewards?.title || '')}">
            <small>Optional: Title unlocked upon completion</small>
          </div>

          <div class="form-group">
            <label for="rewardItems">Item Rewards (JSON)</label>
            <textarea id="rewardItems" class="form-control" rows="3" 
                      placeholder='[{"itemId": "ITEM_001", "quantity": 1}]'>${achievement?.rewards?.items ? JSON.stringify(achievement.rewards.items, null, 2) : ''}</textarea>
            <small>Optional: Array of items to reward</small>
          </div>
        </div>

        <!-- Settings -->
        <div class="form-section">
          <h3>⚙️ Settings</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>
                <input type="checkbox" id="isHidden" ${achievement?.isHidden ? 'checked' : ''}>
                Hidden Achievement (not shown until unlocked)
              </label>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" id="isRepeatable" ${achievement?.isRepeatable ? 'checked' : ''}>
                Repeatable Achievement
              </label>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" id="isActive" ${achievement?.isActive !== false ? 'checked' : ''}>
                Active (can be earned)
              </label>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="displayOrder">Display Order</label>
              <input type="number" id="displayOrder" class="form-control" 
                     min="0" value="${achievement?.displayOrder || 0}">
              <small>Lower numbers appear first</small>
            </div>

            <div class="form-group">
              <label for="iconId">Icon ID</label>
              <input type="text" id="iconId" class="form-control" 
                     placeholder="achievement_icon_01" 
                     value="${achievement?.iconId || ''}">
              <small>Unity sprite asset ID</small>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="AchievementsForm.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            ${isEdit ? '💾 Update Achievement' : '✨ Create Achievement'}
          </button>
        </div>
      </form>
    `;
  }

  /**
   * Mettre à jour les champs selon le type de condition
   */
  updateConditionFields() {
    // Placeholder pour logique future
    console.log('Condition type changed');
  }

  /**
   * Collecter les données du formulaire
   */
  collectFormData() {
    const data = {
      achievementId: document.getElementById('achievementId').value.trim(),
      name: document.getElementById('achievementName').value.trim(),
      description: document.getElementById('achievementDescription').value.trim(),
      category: document.getElementById('achievementCategory').value,
      rarity: document.getElementById('achievementRarity').value,
      
      conditions: {
        type: document.getElementById('conditionType').value,
        target: parseInt(document.getElementById('conditionTarget').value),
        details: this.parseJSON(document.getElementById('conditionDetails').value)
      },
      
      pointsValue: parseInt(document.getElementById('rewardPoints').value),
      
      rewards: {
        gold: parseInt(document.getElementById('rewardGold').value) || 0,
        gems: parseInt(document.getElementById('rewardGems').value) || 0,
        title: document.getElementById('rewardTitle').value.trim() || undefined,
        items: this.parseJSON(document.getElementById('rewardItems').value)
      },
      
      isHidden: document.getElementById('isHidden').checked,
      isRepeatable: document.getElementById('isRepeatable').checked,
      isActive: document.getElementById('isActive').checked,
      displayOrder: parseInt(document.getElementById('displayOrder').value) || 0,
      iconId: document.getElementById('iconId').value.trim() || undefined
    };

    return data;
  }

  /**
   * Parser JSON de manière sécurisée
   */
  parseJSON(str) {
    if (!str || !str.trim()) return undefined;
    try {
      return JSON.parse(str);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Soumettre le formulaire
   */
  async submitForm(event) {
    event.preventDefault();
    
    try {
      const data = this.collectFormData();
      
      // Validation basique
      if (!data.achievementId || !data.name || !data.description) {
        AdminCore.showAlert('❌ Please fill all required fields', 'error');
        return;
      }

      // Validation Achievement ID format
      if (!/^ACH_[a-z_]+$/.test(data.achievementId)) {
        AdminCore.showAlert('❌ Achievement ID must follow format: ACH_[category]_[name] (lowercase, underscores only)', 'error');
        return;
      }

      let response;
      
      if (this.currentMode === 'create') {
        response = await AdminCore.makeRequest('/api/admin/achievements', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } else {
        response = await AdminCore.makeRequest(`/api/admin/achievements/${this.currentAchievement.achievementId}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }

      if (response.data.success) {
        AdminCore.showAlert(
          this.currentMode === 'create' 
            ? `✅ Achievement "${data.name}" created successfully!` 
            : `✅ Achievement "${data.name}" updated successfully!`,
          'success'
        );
        
        this.closeModal();
        
        // Recharger la liste
        if (window.AchievementsModule) {
          window.AchievementsModule.loadAchievementsList();
        }
      } else {
        throw new Error(response.data.message || 'Operation failed');
      }

    } catch (error) {
      console.error('Submit form error:', error);
      AdminCore.showAlert('❌ Failed to save achievement: ' + error.message, 'error');
    }
  }

  /**
   * Fermer le modal
   */
  closeModal() {
    document.getElementById('achievementFormModal').style.display = 'none';
    this.currentMode = null;
    this.currentAchievement = null;
  }

  /**
   * Initialiser le formulaire
   */
  init() {
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'achievementForm') {
        this.submitForm(e);
      }
    });
  }
}

// Créer l'instance globale
window.AchievementsForm = new AchievementsForm();

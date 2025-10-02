/**
 * PlayersHeroes - Sous-module de gestion des héros
 * Gère l'édition du niveau, stars, équipement et suppression de héros
 */
class PlayersHeroes {
    constructor() {
        this.selectedHero = null;
        this.herosList = [];
    }

    /**
     * Rendre le modal HTML principal
     */
    renderModal() {
        return `
            <!-- Modal d'édition de héros -->
            <div id="editHeroModal" class="modal">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>⚔️ Edit Hero</h2>
                        <span class="modal-close" onclick="PlayersHeroes.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="editHeroBody"></div>
                </div>
            </div>

            <!-- Modal d'équipement de héros -->
            <div id="heroEquipmentModal" class="modal">
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2>🛡️ Manage Hero Equipment</h2>
                        <span class="modal-close" onclick="PlayersHeroes.closeEquipmentModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="heroEquipmentBody"></div>
                </div>
            </div>

            <!-- Modal de suppression de héros -->
            <div id="deleteHeroModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>🗑️ Delete Hero</h2>
                        <span class="modal-close" onclick="PlayersHeroes.closeDeleteModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="deleteHeroBody"></div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher le modal d'édition de héros
     */
    showModal(playerHeroId, serverId, heroData, playerData) {
        this.selectedHero = { 
            playerHeroId, 
            serverId, 
            heroData, 
            playerData,
            accountId: playerData.accountId
        };
        
        const modalBody = document.getElementById('editHeroBody');
        
        modalBody.innerHTML = `
            <div class="edit-hero-form">
                <!-- Info du héros -->
                <div class="hero-header-info">
                    <div class="hero-avatar-large">
                        <div class="hero-element-badge ${heroData.element.toLowerCase()}">${this.getElementIcon(heroData.element)}</div>
                        <div class="hero-rarity-badge ${heroData.rarity.toLowerCase()}">${heroData.rarity}</div>
                    </div>
                    <div class="hero-details">
                        <h3>${heroData.name}</h3>
                        <p class="hero-role">${this.getRoleIcon(heroData.role)} ${heroData.role}</p>
                        <p class="hero-element">${this.getElementIcon(heroData.element)} ${heroData.element}</p>
                        <div class="hero-current-stats">
                            <span><strong>Level:</strong> ${heroData.level}</span>
                            <span><strong>Stars:</strong> ${heroData.stars} ⭐</span>
                            <span><strong>Power:</strong> ${AdminCore.formatNumber(heroData.powerLevel || 0)}</span>
                        </div>
                    </div>
                </div>

                <!-- Tabs de navigation -->
                <div class="hero-edit-tabs">
                    <button class="hero-tab active" onclick="PlayersHeroes.switchTab('stats')">📊 Stats</button>
                    <button class="hero-tab" onclick="PlayersHeroes.switchTab('equipment')">⚔️ Equipment</button>
                    <button class="hero-tab" onclick="PlayersHeroes.switchTab('spells')">✨ Spells</button>
                    <button class="hero-tab" onclick="PlayersHeroes.switchTab('danger')">⚠️ Danger Zone</button>
                </div>

                <!-- Tab Stats -->
                <div id="heroTabStats" class="hero-tab-content active">
                    ${this.renderStatsTab(heroData)}
                </div>

                <!-- Tab Equipment -->
                <div id="heroTabEquipment" class="hero-tab-content">
                    ${this.renderEquipmentTab(heroData)}
                </div>

                <!-- Tab Spells -->
                <div id="heroTabSpells" class="hero-tab-content">
                    ${this.renderSpellsTab(heroData)}
                </div>

                <!-- Tab Danger Zone -->
                <div id="heroTabDanger" class="hero-tab-content">
                    ${this.renderDangerTab(heroData)}
                </div>
            </div>
        `;
        
        document.getElementById('editHeroModal').style.display = 'block';
    }

    /**
     * Changer d'onglet
     */
    switchTab(tabName) {
        // Désactiver tous les tabs
        document.querySelectorAll('.hero-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.hero-tab-content').forEach(content => content.classList.remove('active'));
        
        // Activer le tab sélectionné
        document.querySelector(`.hero-tab[onclick*="${tabName}"]`)?.classList.add('active');
        document.getElementById(`heroTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');
    }

    /**
     * Rendre l'onglet Stats
     */
    renderStatsTab(heroData) {
        return `
            <div class="stats-edit-section">
                <h4>📊 Hero Stats</h4>
                
                <!-- Niveau -->
                <div class="form-group">
                    <label for="heroLevel">Level (1-100):</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="range" id="heroLevelSlider" min="1" max="100" value="${heroData.level}" 
                               style="flex: 1;" oninput="PlayersHeroes.updateLevelPreview()">
                        <input type="number" id="heroLevel" class="form-control" 
                               style="width: 100px;" min="1" max="100" value="${heroData.level}"
                               oninput="PlayersHeroes.syncLevelSlider()">
                    </div>
                    <div class="quick-amounts" style="margin-top: 10px;">
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersHeroes.setLevel(1)">Lvl 1</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersHeroes.setLevel(25)">Lvl 25</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersHeroes.setLevel(50)">Lvl 50</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersHeroes.setLevel(75)">Lvl 75</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersHeroes.setLevel(100)">Lvl 100</button>
                    </div>
                </div>

                <!-- Stars -->
                <div class="form-group">
                    <label for="heroStars">Stars (1-6):</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="range" id="heroStarsSlider" min="1" max="6" value="${heroData.stars}" 
                               style="flex: 1;" oninput="PlayersHeroes.updateStarsPreview()">
                        <input type="number" id="heroStars" class="form-control" 
                               style="width: 100px;" min="1" max="6" value="${heroData.stars}"
                               oninput="PlayersHeroes.syncStarsSlider()">
                    </div>
                    <div class="stars-visual" id="starsVisual">
                        ${this.renderStarsVisual(heroData.stars)}
                    </div>
                </div>

                <!-- Preview des stats -->
                <div class="stats-preview" id="statsPreview">
                    <h4>Preview Stats at Level <span id="previewLevel">${heroData.level}</span> - <span id="previewStars">${heroData.stars}</span>⭐</h4>
                    <div class="stats-grid">
                        ${this.renderStatsGrid(heroData.currentStats)}
                    </div>
                    <p style="margin-top: 10px; color: #666; font-size: 12px;">
                        ⚠️ Stats will be recalculated server-side based on base stats, level, stars, and equipment
                    </p>
                </div>

                <!-- Raison -->
                <div class="form-group">
                    <label for="heroStatsReason">Reason (required):</label>
                    <textarea id="heroStatsReason" class="form-control" rows="3" 
                              placeholder="Enter reason for modifying hero stats..." required></textarea>
                    <small style="color: #666; margin-top: 5px; display: block;">
                        This will be recorded in audit logs.
                    </small>
                </div>

                <!-- Actions -->
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="PlayersHeroes.closeModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="PlayersHeroes.submitStatsEdit()">💾 Update Stats</button>
                </div>
            </div>
        `;
    }

    /**
     * Rendre l'onglet Equipment
     */
    renderEquipmentTab(heroData) {
        const equipment = heroData.equipment || {};
        const slots = [
            { key: 'weapon', name: 'Weapon', icon: '⚔️' },
            { key: 'helmet', name: 'Helmet', icon: '🪖' },
            { key: 'armor', name: 'Armor', icon: '🛡️' },
            { key: 'boots', name: 'Boots', icon: '👢' },
            { key: 'gloves', name: 'Gloves', icon: '🧤' },
            { key: 'accessory', name: 'Accessory', icon: '💍' }
        ];

        return `
            <div class="equipment-edit-section">
                <h4>⚔️ Hero Equipment</h4>
                <p style="color: #666; margin-bottom: 20px;">
                    Manage equipment slots for this hero. You can view, equip, or unequip items.
                </p>

                <div class="equipment-slots-grid">
                    ${slots.map(slot => {
                        const instanceId = equipment[slot.key];
                        const isEquipped = !!instanceId;
                        
                        return `
                            <div class="equipment-slot ${isEquipped ? 'equipped' : 'empty'}">
                                <div class="slot-header">
                                    <span class="slot-icon">${slot.icon}</span>
                                    <span class="slot-name">${slot.name}</span>
                                </div>
                                <div class="slot-content">
                                    ${isEquipped ? `
                                        <div class="equipped-item">
                                            <p><strong>Instance ID:</strong> ${instanceId}</p>
                                            <button class="btn btn-small btn-warning" 
                                                    onclick="PlayersHeroes.unequipSlot('${slot.key}')">
                                                Unequip
                                            </button>
                                        </div>
                                    ` : `
                                        <p class="empty-slot-text">No item equipped</p>
                                        <button class="btn btn-small btn-info" 
                                                onclick="PlayersHeroes.showEquipMenu('${slot.key}')">
                                            Equip Item
                                        </button>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="form-group" style="margin-top: 20px;">
                    <button class="btn btn-info" onclick="PlayersHeroes.viewFullEquipment()">
                        📋 View Full Equipment Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Rendre l'onglet Spells
     */
    renderSpellsTab(heroData) {
        const spells = heroData.spells || {};
        
        return `
            <div class="spells-edit-section">
                <h4>✨ Hero Spells</h4>
                <p style="color: #666; margin-bottom: 20px;">
                    View and manage hero's spells. Note: Spell editing is limited to prevent game balance issues.
                </p>

                <div class="spells-list">
                    ${Object.entries(spells).map(([slot, spell]) => {
                        if (!spell || !spell.id) return '';
                        
                        return `
                            <div class="spell-item">
                                <div class="spell-header">
                                    <span class="spell-slot">${slot}</span>
                                    <span class="spell-id">${spell.id}</span>
                                </div>
                                <div class="spell-details">
                                    <span class="spell-level">Level ${spell.level}</span>
                                    ${slot === 'ultimate' || slot === 'passive' ? 
                                        `<span class="spell-max-level">Max: 5</span>` : 
                                        `<span class="spell-max-level">Max: 10</span>`
                                    }
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="alert info" style="margin-top: 20px;">
                    <strong>ℹ️ Information:</strong>
                    <p>Spell modification is not available in this version to maintain game balance. 
                    Spells are managed through the hero database and upgrade systems.</p>
                </div>
            </div>
        `;
    }

    /**
     * Rendre l'onglet Danger Zone
     */
    renderDangerTab(heroData) {
        return `
            <div class="danger-zone-section">
                <h4>⚠️ Danger Zone</h4>
                <p style="color: #dc3545; margin-bottom: 20px;">
                    <strong>Warning:</strong> Actions in this section are irreversible and can significantly impact the player's account.
                </p>

                <div class="danger-actions">
                    <!-- Reset Hero -->
                    <div class="danger-action-card">
                        <h5>🔄 Reset Hero to Level 1</h5>
                        <p>Reset this hero to level 1, 1 star. Equipment will be unequipped but not deleted.</p>
                        <button class="btn btn-warning" onclick="PlayersHeroes.showResetConfirm()">
                            Reset Hero
                        </button>
                    </div>

                    <!-- Delete Hero -->
                    <div class="danger-action-card critical">
                        <h5>🗑️ Delete Hero from Player</h5>
                        <p><strong>This action is PERMANENT!</strong> The hero will be removed from the player's roster. Equipment will be unequipped.</p>
                        <button class="btn btn-critical" onclick="PlayersHeroes.showDeleteModal()">
                            Delete Hero
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Synchroniser le slider de niveau
     */
    syncLevelSlider() {
        const input = document.getElementById('heroLevel');
        const slider = document.getElementById('heroLevelSlider');
        
        let value = parseInt(input.value);
        if (value < 1) value = 1;
        if (value > 100) value = 100;
        
        input.value = value;
        slider.value = value;
        this.updateLevelPreview();
    }

    /**
     * Définir un niveau spécifique
     */
    setLevel(level) {
        document.getElementById('heroLevel').value = level;
        document.getElementById('heroLevelSlider').value = level;
        this.updateLevelPreview();
    }

    /**
     * Mettre à jour la preview du niveau
     */
    updateLevelPreview() {
        const slider = document.getElementById('heroLevelSlider');
        const input = document.getElementById('heroLevel');
        const previewLevel = document.getElementById('previewLevel');
        
        const newLevel = parseInt(slider.value);
        input.value = newLevel;
        if (previewLevel) previewLevel.textContent = newLevel;
    }

    /**
     * Synchroniser le slider de stars
     */
    syncStarsSlider() {
        const input = document.getElementById('heroStars');
        const slider = document.getElementById('heroStarsSlider');
        
        let value = parseInt(input.value);
        if (value < 1) value = 1;
        if (value > 6) value = 6;
        
        input.value = value;
        slider.value = value;
        this.updateStarsPreview();
    }

    /**
     * Mettre à jour la preview des stars
     */
    updateStarsPreview() {
        const slider = document.getElementById('heroStarsSlider');
        const input = document.getElementById('heroStars');
        const previewStars = document.getElementById('previewStars');
        const starsVisual = document.getElementById('starsVisual');
        
        const newStars = parseInt(slider.value);
        input.value = newStars;
        if (previewStars) previewStars.textContent = newStars;
        if (starsVisual) starsVisual.innerHTML = this.renderStarsVisual(newStars);
    }

    /**
     * Rendre les étoiles visuelles
     */
    renderStarsVisual(stars) {
        return `<div class="stars-display">${'⭐'.repeat(stars)}${'☆'.repeat(6 - stars)}</div>`;
    }

    /**
     * Rendre la grille de stats
     */
    renderStatsGrid(stats) {
        if (!stats) return '<p>No stats available</p>';
        
        const statsList = [
            { key: 'hp', name: 'HP', icon: '❤️' },
            { key: 'atk', name: 'ATK', icon: '⚔️' },
            { key: 'def', name: 'DEF', icon: '🛡️' },
            { key: 'crit', name: 'Crit', icon: '💥', suffix: '%' },
            { key: 'critDamage', name: 'Crit Dmg', icon: '💢', suffix: '%' },
            { key: 'vitesse', name: 'Speed', icon: '⚡' },
            { key: 'dodge', name: 'Dodge', icon: '💨', suffix: '%' },
            { key: 'accuracy', name: 'Accuracy', icon: '🎯', suffix: '%' }
        ];

        return statsList.map(stat => `
            <div class="stat-item">
                <span class="stat-icon">${stat.icon}</span>
                <span class="stat-name">${stat.name}</span>
                <span class="stat-value">${stats[stat.key] || 0}${stat.suffix || ''}</span>
            </div>
        `).join('');
    }

    /**
     * Soumettre la modification des stats
     */
    async submitStatsEdit() {
        const newLevel = parseInt(document.getElementById('heroLevel').value);
        const newStars = parseInt(document.getElementById('heroStars').value);
        const reason = document.getElementById('heroStatsReason').value.trim();

        // Validation
        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        if (isNaN(newLevel) || newLevel < 1 || newLevel > 100) {
            AdminCore.showAlert('Level must be between 1 and 100', 'error');
            return;
        }

        if (isNaN(newStars) || newStars < 1 || newStars > 6) {
            AdminCore.showAlert('Stars must be between 1 and 6', 'error');
            return;
        }

        const currentLevel = this.selectedHero.heroData.level;
        const currentStars = this.selectedHero.heroData.stars;

        if (newLevel === currentLevel && newStars === currentStars) {
            AdminCore.showAlert('No changes detected', 'warning');
            return;
        }

        try {
            await AdminCore.makeRequest(`/api/admin/players/${this.selectedHero.accountId}/hero`, {
                method: 'POST',
                body: JSON.stringify({
                    serverId: this.selectedHero.serverId,
                    playerHeroId: this.selectedHero.playerHeroId,
                    operation: 'update_stats',
                    newLevel,
                    newStars,
                    reason
                })
            });

            AdminCore.showAlert(`Hero stats updated successfully!`, 'success');
            this.closeModal();
            
            // Recharger les détails du joueur
            window.PlayersModule.closePlayerModal();
            window.PlayersModule.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Hero modification failed: ' + error.message, 'error');
        }
    }

    /**
     * Afficher le modal de suppression
     */
    showDeleteModal() {
        const deleteBody = document.getElementById('deleteHeroBody');
        
        deleteBody.innerHTML = `
            <div class="delete-hero-form">
                <div class="alert danger">
                    <strong>⚠️ WARNING: PERMANENT ACTION</strong>
                    <p>You are about to delete <strong>${this.selectedHero.heroData.name}</strong> from this player's roster.</p>
                    <p>This action is <strong>IRREVERSIBLE</strong>!</p>
                </div>

                <div class="hero-delete-preview">
                    <h4>Hero to be deleted:</h4>
                    <div class="hero-info-compact">
                        <p><strong>Name:</strong> ${this.selectedHero.heroData.name}</p>
                        <p><strong>Level:</strong> ${this.selectedHero.heroData.level}</p>
                        <p><strong>Stars:</strong> ${this.selectedHero.heroData.stars}⭐</p>
                        <p><strong>Rarity:</strong> ${this.selectedHero.heroData.rarity}</p>
                        <p><strong>Power:</strong> ${AdminCore.formatNumber(this.selectedHero.heroData.powerLevel || 0)}</p>
                    </div>
                </div>

                <div class="form-group">
                    <label for="deleteHeroReason">Reason (required):</label>
                    <textarea id="deleteHeroReason" class="form-control" rows="4" 
                              placeholder="Enter detailed reason for deleting this hero..." required></textarea>
                    <small style="color: #666; margin-top: 5px; display: block;">
                        This will be permanently recorded in audit logs.
                    </small>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="deleteHeroConfirm">
                        I understand this action is permanent and cannot be undone
                    </label>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="PlayersHeroes.closeDeleteModal()">Cancel</button>
                    <button type="button" class="btn btn-critical" onclick="PlayersHeroes.confirmDeleteHero()">
                        🗑️ Delete Hero Permanently
                    </button>
                </div>
            </div>
        `;
        
        this.closeModal();
        document.getElementById('deleteHeroModal').style.display = 'block';
    }

    /**
     * Confirmer la suppression du héros
     */
    async confirmDeleteHero() {
        const reason = document.getElementById('deleteHeroReason').value.trim();
        const confirmed = document.getElementById('deleteHeroConfirm').checked;

        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        if (!confirmed) {
            AdminCore.showAlert('Please confirm that you understand this action is permanent', 'error');
            return;
        }

        const finalConfirm = confirm(
            `⚠️ FINAL CONFIRMATION\n\n` +
            `You are about to PERMANENTLY DELETE ${this.selectedHero.heroData.name}.\n\n` +
            `This action CANNOT be undone!\n\n` +
            `Are you absolutely sure?`
        );

        if (!finalConfirm) return;

        try {
            await AdminCore.makeRequest(`/api/admin/players/${this.selectedHero.accountId}/hero`, {
                method: 'DELETE',
                body: JSON.stringify({
                    serverId: this.selectedHero.serverId,
                    playerHeroId: this.selectedHero.playerHeroId,
                    reason
                })
            });

            AdminCore.showAlert(`Hero deleted successfully`, 'success');
            this.closeDeleteModal();
            
            // Recharger la liste des joueurs
            window.PlayersModule.closePlayerModal();
            window.PlayersModule.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Hero deletion failed: ' + error.message, 'error');
        }
    }

    /**
     * Déséquiper un slot
     */
    async unequipSlot(slot) {
        if (!confirm(`Unequip ${slot}?`)) return;

        try {
            await AdminCore.makeRequest(`/api/admin/players/${this.selectedHero.accountId}/hero/equipment`, {
                method: 'POST',
                body: JSON.stringify({
                    serverId: this.selectedHero.serverId,
                    playerHeroId: this.selectedHero.playerHeroId,
                    operation: 'unequip',
                    slot,
                    reason: `Admin unequipped ${slot}`
                })
            });

            AdminCore.showAlert(`${slot} unequipped successfully`, 'success');
            
            // Recharger le modal
            await window.PlayersModule.viewPlayer(this.selectedHero.accountId);

        } catch (error) {
            AdminCore.showAlert('Unequip failed: ' + error.message, 'error');
        }
    }

    /**
     * Afficher le menu d'équipement (placeholder)
     */
    showEquipMenu(slot) {
        AdminCore.showAlert(`Equipment management for ${slot} coming soon...`, 'info');
    }

    /**
     * Voir l'équipement complet (placeholder)
     */
    viewFullEquipment() {
        AdminCore.showAlert('Full equipment details view coming soon...', 'info');
    }

    /**
     * Afficher la confirmation de reset
     */
    showResetConfirm() {
        const confirmed = confirm(
            `⚠️ Reset ${this.selectedHero.heroData.name} to Level 1, 1 Star?\n\n` +
            `Equipment will be unequipped but not deleted.\n\n` +
            `Are you sure?`
        );

        if (confirmed) {
            this.submitReset();
        }
    }

    /**
     * Soumettre le reset du héros
     */
    async submitReset() {
        const reason = prompt('Enter reason for reset:');
        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        try {
            await AdminCore.makeRequest(`/api/admin/players/${this.selectedHero.accountId}/hero`, {
                method: 'POST',
                body: JSON.stringify({
                    serverId: this.selectedHero.serverId,
                    playerHeroId: this.selectedHero.playerHeroId,
                    operation: 'reset',
                    reason
                })
            });

            AdminCore.showAlert(`Hero reset successfully`, 'success');
            this.closeModal();
            
            // Recharger
            window.PlayersModule.closePlayerModal();
            window.PlayersModule.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Hero reset failed: ' + error.message, 'error');
        }
    }

    /**
     * Fermer les modals
     */
    closeModal() {
        document.getElementById('editHeroModal').style.display = 'none';
        this.selectedHero = null;
    }

    closeEquipmentModal() {
        document.getElementById('heroEquipmentModal').style.display = 'none';
    }

    closeDeleteModal() {
        document.getElementById('deleteHeroModal').style.display = 'none';
    }

    /**
     * Utilitaires
     */
    getRoleIcon(role) {
        const icons = {
            'Tank': '🛡️',
            'DPS Melee': '⚔️',
            'DPS Ranged': '🏹',
            'Support': '💚'
        };
        return icons[role] || '❓';
    }

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
}

// Créer l'instance globale
window.PlayersHeroes = new PlayersHeroes();

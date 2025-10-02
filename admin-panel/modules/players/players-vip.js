/**
 * PlayersVIP - Sous-module de gestion du niveau VIP
 * Gère l'édition du niveau VIP avec preview et avantages
 */
class PlayersVIP {
    constructor() {
        this.selectedCharacter = null;
        this.vipBenefits = {
            0: 'No VIP benefits',
            1: '+10% Gold, +5% EXP',
            2: '+15% Gold, +10% EXP, Auto-Battle x2',
            3: '+20% Gold, +15% EXP, Auto-Battle x4',
            5: '+30% Gold, +25% EXP, Auto-Battle x8, Daily Summon',
            7: '+40% Gold, +35% EXP, Auto-Battle x12, 2x Daily Summon',
            10: '+50% Gold, +50% EXP, Auto-Battle x16, 3x Daily Summon',
            12: '+60% Gold, +60% EXP, Auto-Battle x20, Exclusive Heroes',
            15: '+100% Gold, +100% EXP, Auto-Battle x30, All Features'
        };
    }

    /**
     * Rendre le modal HTML
     */
    renderModal() {
        return `
            <div id="editVIPModal" class="modal">
                <div class="modal-content" style="max-width: 650px;">
                    <div class="modal-header">
                        <h2>⭐ Edit VIP Level</h2>
                        <span class="modal-close" onclick="PlayersVIP.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="editVIPBody"></div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher le modal d'édition VIP
     */
    showModal(playerId, serverId, currentVipLevel) {
        this.selectedCharacter = { 
            playerId, 
            serverId, 
            vipLevel: currentVipLevel 
        };
        
        const modalBody = document.getElementById('editVIPBody');
        
        modalBody.innerHTML = `
            <div class="edit-vip-form">
                <!-- VIP actuel -->
                <div class="current-vip">
                    <h4>Current VIP Level:</h4>
                    <div class="vip-display">
                        <div class="vip-level-badge">
                            <span class="vip-icon">⭐</span>
                            <span class="vip-number">VIP ${currentVipLevel}</span>
                        </div>
                        <p class="vip-benefits">${this.vipBenefits[currentVipLevel] || 'Custom VIP level'}</p>
                    </div>
                </div>

                <!-- Nouveau niveau VIP -->
                <div class="form-group">
                    <label for="vipNewLevel">New VIP Level (0-15):</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="range" id="vipSlider" min="0" max="15" value="${currentVipLevel}" 
                               style="flex: 1;" oninput="PlayersVIP.updatePreview()">
                        <input type="number" id="vipNewLevel" class="form-control" 
                               style="width: 100px;" min="0" max="15" value="${currentVipLevel}"
                               oninput="PlayersVIP.syncSlider()">
                    </div>
                </div>

                <!-- Boutons rapides -->
                <div class="vip-quick-levels">
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(0)">VIP 0</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(1)">VIP 1</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(3)">VIP 3</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(5)">VIP 5</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(7)">VIP 7</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(10)">VIP 10</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(12)">VIP 12</button>
                    <button type="button" class="btn btn-small btn-secondary" onclick="PlayersVIP.setLevel(15)">VIP 15</button>
                </div>

                <!-- Preview -->
                <div class="vip-preview" id="vipPreview">
                    <h4>Preview New Level:</h4>
                    <div class="vip-display">
                        <div class="vip-level-badge">
                            <span class="vip-icon">⭐</span>
                            <span class="vip-number">VIP <span id="previewVipNumber">${currentVipLevel}</span></span>
                        </div>
                        <p class="vip-benefits" id="previewVipBenefits">${this.vipBenefits[currentVipLevel] || 'Custom VIP level'}</p>
                    </div>
                    <div class="vip-comparison" id="vipComparison"></div>
                </div>

                <!-- Raison -->
                <div class="form-group">
                    <label for="vipReason">Reason (required):</label>
                    <textarea id="vipReason" class="form-control" rows="3" 
                              placeholder="Enter reason for VIP level modification..." required></textarea>
                    <small style="color: #666; margin-top: 5px; display: block;">
                        This will be recorded in audit logs.
                    </small>
                </div>

                <!-- Actions -->
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="PlayersVIP.closeModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="PlayersVIP.submitEdit()">⭐ Update VIP Level</button>
                </div>
            </div>
        `;
        
        document.getElementById('editVIPModal').style.display = 'block';
        this.updatePreview();
    }

    /**
     * Définir un niveau VIP spécifique
     */
    setLevel(level) {
        document.getElementById('vipNewLevel').value = level;
        document.getElementById('vipSlider').value = level;
        this.updatePreview();
    }

    /**
     * Synchroniser le slider avec l'input
     */
    syncSlider() {
        const input = document.getElementById('vipNewLevel');
        let value = parseInt(input.value);
        
        if (value < 0) value = 0;
        if (value > 15) value = 15;
        
        input.value = value;
        document.getElementById('vipSlider').value = value;
        this.updatePreview();
    }

    /**
     * Mettre à jour la preview en temps réel
     */
    updatePreview() {
        const slider = document.getElementById('vipSlider');
        const input = document.getElementById('vipNewLevel');
        const previewNumber = document.getElementById('previewVipNumber');
        const previewBenefits = document.getElementById('previewVipBenefits');
        const comparison = document.getElementById('vipComparison');
        
        const newLevel = parseInt(slider.value);
        const currentLevel = this.selectedCharacter.vipLevel;
        
        // Sync input
        input.value = newLevel;
        
        // Update preview
        previewNumber.textContent = newLevel;
        previewBenefits.textContent = this.vipBenefits[newLevel] || 'Custom VIP level';
        
        // Show comparison
        if (newLevel !== currentLevel) {
            const difference = newLevel - currentLevel;
            const arrow = difference > 0 ? '⬆️' : '⬇️';
            const color = difference > 0 ? '#28a745' : '#dc3545';
            const text = difference > 0 ? 'Upgrade' : 'Downgrade';
            
            comparison.innerHTML = `
                <div class="vip-change" style="color: ${color}; margin-top: 10px; font-weight: 600;">
                    ${arrow} ${text} from VIP ${currentLevel} to VIP ${newLevel} (${difference > 0 ? '+' : ''}${difference} levels)
                </div>
            `;
            
            // Change preview badge color
            const previewBadge = document.querySelector('#vipPreview .vip-level-badge');
            if (difference > 0) {
                previewBadge.style.background = 'linear-gradient(135deg, #28a745, #5fd97a)';
            } else {
                previewBadge.style.background = 'linear-gradient(135deg, #dc3545, #ff6b7a)';
            }
        } else {
            comparison.innerHTML = '';
            const previewBadge = document.querySelector('#vipPreview .vip-level-badge');
            previewBadge.style.background = 'linear-gradient(135deg, #ffd700, #ffed4e)';
        }
    }

    /**
     * Soumettre la modification VIP
     */
    async submitEdit() {
        const newLevel = parseInt(document.getElementById('vipNewLevel').value);
        const reason = document.getElementById('vipReason').value.trim();
        const currentLevel = this.selectedCharacter.vipLevel;

        // Validation
        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        if (isNaN(newLevel) || newLevel < 0 || newLevel > 15) {
            AdminCore.showAlert('VIP level must be between 0 and 15', 'error');
            return;
        }

        if (newLevel === currentLevel) {
            AdminCore.showAlert('VIP level is already ' + newLevel, 'warning');
            return;
        }

        // Confirmation pour downgrade
        if (newLevel < currentLevel) {
            if (!confirm(`⚠️ You are about to DOWNGRADE VIP from ${currentLevel} to ${newLevel}. Are you sure?`)) {
                return;
            }
        }

        try {
            const accountId = window.PlayersModule.selectedPlayer.account.accountId;
            
            await AdminCore.makeRequest(`/api/admin/players/${accountId}/vip`, {
                method: 'POST',
                body: JSON.stringify({
                    serverId: this.selectedCharacter.serverId,
                    playerId: this.selectedCharacter.playerId,
                    newVipLevel: newLevel,
                    reason
                })
            });

            AdminCore.showAlert(`VIP level updated to ${newLevel} successfully!`, 'success');
            this.closeModal();
            
            // Recharger les détails du joueur
            await window.PlayersModule.viewPlayer(accountId);

        } catch (error) {
            AdminCore.showAlert('VIP modification failed: ' + error.message, 'error');
        }
    }

    /**
     * Fermer le modal
     */
    closeModal() {
        document.getElementById('editVIPModal').style.display = 'none';
        this.selectedCharacter = null;
    }
}

// Créer l'instance globale
window.PlayersVIP = new PlayersVIP();

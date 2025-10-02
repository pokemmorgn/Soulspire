/**
 * PlayersModeration - Sous-module de modération
 * Gère les actions : Warn, Suspend, Ban, Unban
 */
class PlayersModeration {
    constructor() {
        this.currentAction = null;
        this.currentAccountId = null;
    }

    /**
     * Rendre le modal HTML
     */
    renderModal() {
        return `
            <div id="moderationModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 id="moderationTitle">⚖️ Moderation Action</h2>
                        <span class="modal-close" onclick="PlayersModeration.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="moderationBody"></div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher le modal de modération
     */
    showModal(accountId, action) {
        this.currentAccountId = accountId;
        this.currentAction = action;
        
        const modalTitle = document.getElementById('moderationTitle');
        const modalBody = document.getElementById('moderationBody');
        
        let actionConfig = this.getActionConfig(action);
        
        modalTitle.textContent = actionConfig.title;
        
        modalBody.innerHTML = `
            <div class="moderation-form">
                <!-- Alerte -->
                <div class="alert ${actionConfig.alertType}" style="margin-bottom: 20px;">
                    <strong>${actionConfig.title}</strong>
                    <p>${actionConfig.description}</p>
                    ${actionConfig.warning ? `<p style="margin-top: 10px; font-weight: 600;">⚠️ ${actionConfig.warning}</p>` : ''}
                </div>

                <!-- Durée (pour suspension uniquement) -->
                ${action === 'suspend' ? `
                    <div class="form-group">
                        <label for="moderationDuration">Suspension Duration:</label>
                        <select id="moderationDuration" class="form-control">
                            <option value="1">1 hour</option>
                            <option value="3">3 hours</option>
                            <option value="6">6 hours</option>
                            <option value="12">12 hours</option>
                            <option value="24" selected>24 hours (1 day)</option>
                            <option value="48">48 hours (2 days)</option>
                            <option value="72">72 hours (3 days)</option>
                            <option value="168">168 hours (7 days)</option>
                            <option value="336">336 hours (14 days)</option>
                            <option value="720">720 hours (30 days)</option>
                        </select>
                        <small style="color: #666; margin-top: 5px; display: block;">
                            The player will be automatically unbanned after this duration.
                        </small>
                    </div>
                ` : ''}

                <!-- Raison -->
                ${action !== 'unban' ? `
                    <div class="form-group">
                        <label for="moderationReason">Reason (required):</label>
                        <textarea id="moderationReason" class="form-control" rows="4" 
                                  placeholder="Enter detailed reason for this moderation action..." required></textarea>
                        <small style="color: #666; margin-top: 5px; display: block;">
                            This reason will be visible to the player and recorded in audit logs.
                        </small>
                    </div>
                ` : `
                    <div class="form-group">
                        <label for="moderationReason">Reason (optional):</label>
                        <textarea id="moderationReason" class="form-control" rows="3" 
                                  placeholder="Enter reason for account restoration..."></textarea>
                    </div>
                `}

                <!-- Templates de raisons communes -->
                ${action !== 'unban' ? `
                    <div class="form-group">
                        <label>Quick Reasons:</label>
                        <div class="reason-templates">
                            ${this.getReasonTemplates(action).map(template => `
                                <button type="button" class="btn btn-small btn-secondary" 
                                        onclick="PlayersModeration.setReason('${template}')">
                                    ${template}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Preview de l'action -->
                ${action !== 'unban' ? `
                    <div class="moderation-preview">
                        <h4>Action Preview:</h4>
                        <ul>
                            ${actionConfig.consequences.map(c => `<li>${c}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Actions -->
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="PlayersModeration.closeModal()">
                        Cancel
                    </button>
                    <button type="button" class="btn ${actionConfig.buttonClass}" 
                            onclick="PlayersModeration.submitAction()">
                        ${actionConfig.buttonText}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('moderationModal').style.display = 'block';
    }

    /**
     * Configuration des actions
     */
    getActionConfig(action) {
        const configs = {
            warn: {
                title: '⚠️ Issue Warning',
                description: 'Send a formal warning to the player. The account will remain active.',
                alertType: 'warning',
                buttonClass: 'btn-warning',
                buttonText: '⚠️ Issue Warning',
                consequences: [
                    'Player will receive a warning notification',
                    'Account remains fully functional',
                    'Warning is logged for future reference',
                    'Multiple warnings may lead to suspension'
                ]
            },
            suspend: {
                title: '🚫 Suspend Account',
                description: 'Temporarily suspend the account. The player will not be able to login.',
                warning: 'The player will be unable to access their account for the selected duration.',
                alertType: 'warning',
                buttonClass: 'btn-danger',
                buttonText: '🚫 Suspend Account',
                consequences: [
                    'Account access will be immediately blocked',
                    'Player cannot login during suspension period',
                    'Account will be automatically restored after duration',
                    'All progress and items are preserved'
                ]
            },
            ban: {
                title: '🔒 Permanent Ban',
                description: 'Permanently ban this account. This is a severe action.',
                warning: 'This action is PERMANENT and cannot be easily reversed!',
                alertType: 'danger',
                buttonClass: 'btn-critical',
                buttonText: '🔒 Ban Account Permanently',
                consequences: [
                    'Account will be permanently banned',
                    'Player cannot login anymore',
                    'All account data is preserved but inaccessible',
                    'Can only be reversed manually by super admin'
                ]
            },
            unban: {
                title: '✅ Restore Account',
                description: 'Restore a banned or suspended account. The player will be able to login again.',
                alertType: 'info',
                buttonClass: 'btn-success',
                buttonText: '✅ Restore Account',
                consequences: [
                    'Account will be restored to active status',
                    'Player can login immediately',
                    'All progress and items remain intact',
                    'Previous bans are logged in history'
                ]
            }
        };
        
        return configs[action] || configs.warn;
    }

    /**
     * Templates de raisons communes
     */
    getReasonTemplates(action) {
        const templates = {
            warn: [
                'Inappropriate behavior',
                'Spam in chat',
                'Minor rule violation',
                'First offense warning'
            ],
            suspend: [
                'Repeated violations',
                'Harassment of other players',
                'Exploiting game bugs',
                'Account sharing',
                'Suspicious activity'
            ],
            ban: [
                'Severe ToS violation',
                'Hacking/Cheating',
                'Real money trading',
                'Multiple severe offenses',
                'Fraudulent transactions'
            ]
        };
        
        return templates[action] || [];
    }

    /**
     * Définir une raison prédéfinie
     */
    setReason(reason) {
        const textarea = document.getElementById('moderationReason');
        if (textarea.value.trim()) {
            textarea.value += '\n' + reason;
        } else {
            textarea.value = reason;
        }
        textarea.focus();
    }

    /**
     * Soumettre l'action de modération
     */
    async submitAction() {
        const reason = document.getElementById('moderationReason')?.value.trim();
        
        // Validation de la raison (sauf pour unban)
        if (this.currentAction !== 'unban' && !reason) {
            AdminCore.showAlert('Reason is required for this action', 'error');
            return;
        }

        // Récupérer la durée pour suspension
        let duration = 0;
        if (this.currentAction === 'suspend') {
            duration = parseInt(document.getElementById('moderationDuration')?.value || '24');
        }

        // Confirmation supplémentaire pour ban permanent
        if (this.currentAction === 'ban') {
            const confirmed = confirm(
                '⚠️ FINAL CONFIRMATION\n\n' +
                'You are about to PERMANENTLY BAN this account.\n\n' +
                'This action is severe and should only be used for serious violations.\n\n' +
                'Are you absolutely sure?'
            );
            
            if (!confirmed) {
                return;
            }
        }

        try {
            const body = { 
                action: this.currentAction, 
                reason: reason || 'Account restored by admin'
            };
            
            if (duration > 0) {
                body.duration = duration;
            }

            await AdminCore.makeRequest(`/api/admin/players/${this.currentAccountId}/moderate`, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            const actionText = this.getActionConfig(this.currentAction).title;
            AdminCore.showAlert(`${actionText} applied successfully!`, 'success');
            
            this.closeModal();
            
            // Recharger la liste des joueurs et fermer le modal de détails
            window.PlayersModule.closePlayerModal();
            window.PlayersModule.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Moderation action failed: ' + error.message, 'error');
        }
    }

    /**
     * Fermer le modal
     */
    closeModal() {
        document.getElementById('moderationModal').style.display = 'none';
        this.currentAction = null;
        this.currentAccountId = null;
    }
}

// Créer l'instance globale
window.PlayersModeration = new PlayersModeration();

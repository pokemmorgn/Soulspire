/**
 * PlayersCurrency - Sous-module de gestion des monnaies
 * Gère l'édition de Gold, Gems et Paid Gems
 */
class PlayersCurrency {
    constructor() {
        this.selectedCharacter = null;
    }

    /**
     * Rendre le modal HTML
     */
    renderModal() {
        return `
            <div id="editCurrencyModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>💰 Edit Currency</h2>
                        <span class="modal-close" onclick="PlayersCurrency.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="editCurrencyBody"></div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher le modal d'édition de currency
     */
    showModal(playerId, serverId, currentCurrencies) {
        this.selectedCharacter = { 
            playerId, 
            serverId, 
            currencies: currentCurrencies 
        };
        
        const modalBody = document.getElementById('editCurrencyBody');
        modalBody.innerHTML = `
            <div class="edit-currency-form">
                <!-- Soldes actuels -->
                <div class="current-balances">
                    <h4>Current Balances:</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                        <div class="balance-item">
                            <span class="currency-icon">🪙</span>
                            <strong>${AdminCore.formatNumber(currentCurrencies.gold || 0)}</strong>
                            <small>Gold</small>
                        </div>
                        <div class="balance-item">
                            <span class="currency-icon">💎</span>
                            <strong>${AdminCore.formatNumber(currentCurrencies.gems || 0)}</strong>
                            <small>Gems</small>
                        </div>
                        <div class="balance-item">
                            <span class="currency-icon">💰</span>
                            <strong>${AdminCore.formatNumber(currentCurrencies.paidGems || 0)}</strong>
                            <small>Paid Gems</small>
                        </div>
                    </div>
                </div>

                <!-- Type de monnaie -->
                <div class="form-group">
                    <label for="currencyType">Currency Type:</label>
                    <select id="currencyType" class="form-control" onchange="PlayersCurrency.updateCurrencyPreview()">
                        <option value="gold">🪙 Gold</option>
                        <option value="gems">💎 Gems</option>
                        <option value="paidGems">💰 Paid Gems (Super Admin Only)</option>
                    </select>
                </div>

                <!-- Opération -->
                <div class="form-group">
                    <label for="currencyOperation">Operation:</label>
                    <select id="currencyOperation" class="form-control" onchange="PlayersCurrency.updateCurrencyPreview()">
                        <option value="add">➕ Add to current</option>
                        <option value="subtract">➖ Subtract from current</option>
                        <option value="set">🔢 Set to exact value</option>
                    </select>
                </div>

                <!-- Montant -->
                <div class="form-group">
                    <label for="currencyAmount">Amount:</label>
                    <input type="number" id="currencyAmount" class="form-control" min="0" value="100" 
                           oninput="PlayersCurrency.updateCurrencyPreview()" required>
                    <div class="quick-amounts">
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(100)">100</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(500)">500</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(1000)">1K</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(5000)">5K</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(10000)">10K</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(50000)">50K</button>
                        <button type="button" class="btn btn-small btn-secondary" onclick="PlayersCurrency.setAmount(100000)">100K</button>
                    </div>
                </div>

                <!-- Preview -->
                <div class="currency-preview" id="currencyPreview">
                    <h4>Preview:</h4>
                    <div class="preview-calculation">
                        <div class="preview-item">
                            <span class="preview-label">Current:</span>
                            <span class="preview-value" id="previewCurrent">${AdminCore.formatNumber(currentCurrencies.gold || 0)}</span>
                        </div>
                        <div class="preview-operator" id="previewOperator">+</div>
                        <div class="preview-item">
                            <span class="preview-label">Amount:</span>
                            <span class="preview-value" id="previewAmount">100</span>
                        </div>
                        <div class="preview-equals">=</div>
                        <div class="preview-item preview-result">
                            <span class="preview-label">New Balance:</span>
                            <span class="preview-value" id="previewResult">${AdminCore.formatNumber((currentCurrencies.gold || 0) + 100)}</span>
                        </div>
                    </div>
                </div>

                <!-- Raison -->
                <div class="form-group">
                    <label for="currencyReason">Reason (required):</label>
                    <textarea id="currencyReason" class="form-control" rows="3" 
                              placeholder="Enter reason for this modification..." required></textarea>
                    <small style="color: #666; margin-top: 5px; display: block;">
                        This will be recorded in audit logs.
                    </small>
                </div>

                <!-- Actions -->
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="PlayersCurrency.closeModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="PlayersCurrency.submitEdit()">💾 Apply Changes</button>
                </div>
            </div>
        `;
        
        document.getElementById('editCurrencyModal').style.display = 'block';
    }

    /**
     * Définir un montant rapide
     */
    setAmount(amount) {
        document.getElementById('currencyAmount').value = amount;
        this.updateCurrencyPreview();
    }

    /**
     * Mettre à jour la preview en temps réel
     */
    updateCurrencyPreview() {
        const currencyType = document.getElementById('currencyType').value;
        const operation = document.getElementById('currencyOperation').value;
        const amount = parseInt(document.getElementById('currencyAmount').value) || 0;
        
        const currencies = this.selectedCharacter.currencies;
        const currentValue = currencies[currencyType] || 0;
        
        // Calculer le nouveau montant
        let newValue = currentValue;
        let operatorSymbol = '+';
        
        switch(operation) {
            case 'add':
                newValue = currentValue + amount;
                operatorSymbol = '+';
                break;
            case 'subtract':
                newValue = Math.max(0, currentValue - amount);
                operatorSymbol = '-';
                break;
            case 'set':
                newValue = amount;
                operatorSymbol = '=';
                break;
        }
        
        // Mettre à jour l'affichage
        document.getElementById('previewCurrent').textContent = AdminCore.formatNumber(currentValue);
        document.getElementById('previewOperator').textContent = operatorSymbol;
        document.getElementById('previewAmount').textContent = AdminCore.formatNumber(amount);
        document.getElementById('previewResult').textContent = AdminCore.formatNumber(newValue);
        
        // Changer la couleur selon le résultat
        const resultElement = document.getElementById('previewResult');
        if (newValue > currentValue) {
            resultElement.style.color = '#28a745'; // Vert
        } else if (newValue < currentValue) {
            resultElement.style.color = '#dc3545'; // Rouge
        } else {
            resultElement.style.color = '#333'; // Neutre
        }
    }

    /**
     * Soumettre l'édition
     */
    async submitEdit() {
        const currency = document.getElementById('currencyType').value;
        const operation = document.getElementById('currencyOperation').value;
        const amount = parseInt(document.getElementById('currencyAmount').value);
        const reason = document.getElementById('currencyReason').value.trim();

        // Validation
        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        if (isNaN(amount) || amount < 0) {
            AdminCore.showAlert('Invalid amount', 'error');
            return;
        }

        // Confirmation pour Paid Gems
        if (currency === 'paidGems') {
            if (!confirm('⚠️ You are about to modify PAID GEMS. This is a sensitive operation. Are you sure?')) {
                return;
            }
        }

        try {
            const accountId = window.PlayersModule.selectedPlayer.account.accountId;
            
            await AdminCore.makeRequest(`/api/admin/players/${accountId}/currency`, {
                method: 'POST',
                body: JSON.stringify({
                    serverId: this.selectedCharacter.serverId,
                    playerId: this.selectedCharacter.playerId,
                    currency,
                    amount,
                    operation,
                    reason
                })
            });

            AdminCore.showAlert(`Currency ${operation} successful!`, 'success');
            this.closeModal();
            
            // Recharger les détails du joueur
            window.PlayersModule.closePlayerModal();
            window.PlayersModule.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Currency modification failed: ' + error.message, 'error');
        }
    }

    /**
     * Fermer le modal
     */
    closeModal() {
        document.getElementById('editCurrencyModal').style.display = 'none';
        this.selectedCharacter = null;
    }
}

// Créer l'instance globale
window.PlayersCurrency = new PlayersCurrency();

/**
 * PlayersModule - Gestion complète des joueurs
 * Version améliorée avec interface d'édition professionnelle
 */
class PlayersModule {
    constructor() {
        this.currentPlayers = [];
        this.searchFilters = {
            page: 1,
            limit: 20,
            sortBy: 'lastLogin',
            sortOrder: 'desc'
        };
        this.selectedPlayer = null;
        this.selectedCharacter = null;
    }

    async loadData() {
        console.log('👥 Loading players data...');
        const content = document.getElementById('playersContent');
        
        try {
            content.innerHTML = this.renderPlayersInterface();
            await this.loadPlayersList();
            await this.loadPlayersStats();
        } catch (error) {
            console.error('Players data loading error:', error);
            content.innerHTML = `<div class="alert error">Failed to load players data: ${error.message}</div>`;
        }
    }

    renderPlayersInterface() {
        return `
            <div class="players-stats-grid" id="playersStatsGrid">
                <div class="loading"><div class="spinner"></div><p>Loading player statistics...</p></div>
            </div>

            <div class="players-controls">
                <div class="search-section">
                    <h3>🔍 Search Players</h3>
                    <div class="search-grid">
                        <div class="search-group">
                            <label for="searchUsername">Username:</label>
                            <input type="text" id="searchUsername" placeholder="Enter username...">
                        </div>
                        <div class="search-group">
                            <label for="searchEmail">Email:</label>
                            <input type="email" id="searchEmail" placeholder="Enter email...">
                        </div>
                        <div class="search-group">
                            <label for="searchServerId">Server:</label>
                            <select id="searchServerId">
                                <option value="">All Servers</option>
                                <option value="S1">Server 1</option>
                                <option value="S2">Server 2</option>
                                <option value="S3">Server 3</option>
                            </select>
                        </div>
                        <div class="search-group">
                            <label for="searchStatus">Status:</label>
                            <select id="searchStatus">
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="banned">Banned</option>
                            </select>
                        </div>
                    </div>
                    <div class="search-actions">
                        <button class="btn btn-primary" onclick="PlayersModule.search()">🔍 Search</button>
                        <button class="btn btn-secondary" onclick="PlayersModule.clearSearch()">Clear</button>
                        <button class="btn btn-info" onclick="PlayersModule.loadPlayersList()">↻ Refresh</button>
                    </div>
                </div>
            </div>

            <div class="players-list-section">
                <div class="players-header">
                    <h3>📋 Players List</h3>
                    <div class="players-pagination" id="playersPagination"></div>
                </div>
                <div class="players-table-container">
                    <div id="playersTableContent">
                        <div class="loading"><div class="spinner"></div><p>Loading players...</p></div>
                    </div>
                </div>
            </div>

            <!-- Modal de détails joueur -->
            <div id="playerDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="playerModalTitle">Player Details</h2>
                        <span class="modal-close" onclick="PlayersModule.closePlayerModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="playerModalBody"></div>
                </div>
            </div>

            <!-- Modal d'édition de currency -->
            <div id="editCurrencyModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>💰 Edit Currency</h2>
                        <span class="modal-close" onclick="PlayersModule.closeEditModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="editCurrencyBody"></div>
                </div>
            </div>

            <!-- Modal de modération -->
            <div id="moderationModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>⚖️ Moderation Action</h2>
                        <span class="modal-close" onclick="PlayersModule.closeModerationModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="moderationBody"></div>
                </div>
            </div>
        `;
    }

    async loadPlayersStats() {
        try {
            const { data } = await AdminCore.makeRequest('/api/admin/players/stats');
            const stats = data.data || data;
            
            document.getElementById('playersStatsGrid').innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${AdminCore.formatNumber(stats.totalPlayers || 0)}</div>
                    <div class="stat-label">Total Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${AdminCore.formatNumber(stats.activePlayers || 0)}</div>
                    <div class="stat-label">Active Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">${AdminCore.formatNumber(stats.spendingPlayers || 0)}</div>
                    <div class="stat-label">Spending Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${stats.averageLevel || 0}</div>
                    <div class="stat-label">Average Level</div>
                </div>
            `;
        } catch (error) {
            document.getElementById('playersStatsGrid').innerHTML = 
                '<div class="alert error">Failed to load player statistics</div>';
        }
    }

    async loadPlayersList() {
        const container = document.getElementById('playersTableContent');
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading players...</p></div>';

        try {
            const { data } = await AdminCore.makeRequest('/api/admin/players/search?' + new URLSearchParams(this.searchFilters));
            
            const result = data.data || data;
            this.currentPlayers = result.players || [];
            
            container.innerHTML = this.renderPlayersTable(result);
            this.updatePagination(result);
            
        } catch (error) {
            container.innerHTML = `<div class="alert error">Failed to load players: ${error.message}</div>`;
        }
    }

    renderPlayersTable(data) {
        if (!data.players || data.players.length === 0) {
            return '<div class="no-data">No players found matching your criteria.</div>';
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Characters</th>
                        <th>Status</th>
                        <th>Total Spent</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.players.map(player => this.renderPlayerRow(player)).join('')}
                </tbody>
            </table>
        `;
    }

    renderPlayerRow(player) {
        const statusClass = this.getStatusClass(player.accountStatus);
        const lastLogin = player.lastLogin ? new Date(player.lastLogin).toLocaleDateString() : 'Never';
        
        return `
            <tr>
                <td>
                    <div class="player-username">
                        <strong>${this.escapeHtml(player.username)}</strong>
                        <small class="player-id">ID: ${player.accountId}</small>
                    </div>
                </td>
                <td>${this.escapeHtml(player.email || 'N/A')}</td>
                <td>
                    <div class="character-summary">
                        <span class="char-count">${player.charactersCount || 0} chars</span>
                        ${player.summary && player.summary.highestLevel > 0 ? `<small>Max Lvl: ${player.summary.highestLevel}</small>` : ''}
                    </div>
                </td>
                <td><span class="badge ${statusClass}">${this.capitalizeFirst(player.accountStatus)}</span></td>
                <td>
                    <span class="money ${player.totalSpentUSD > 0 ? 'positive' : ''}">
                        $${(player.totalSpentUSD || 0).toFixed(2)}
                    </span>
                </td>
                <td>
                    <span class="date ${this.getActivityClass(player.lastLogin)}">${lastLogin}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-small btn-info" onclick="PlayersModule.viewPlayer('${player.accountId}')">
                            👁️ View
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    updatePagination(data) {
        const totalPages = Math.ceil(data.total / this.searchFilters.limit);
        const currentPage = this.searchFilters.page;
        
        let paginationHTML = `
            <div class="pagination-info">
                Showing ${((currentPage - 1) * this.searchFilters.limit) + 1}-${Math.min(currentPage * this.searchFilters.limit, data.total)} 
                of ${data.total} players
            </div>
            <div class="pagination-controls">
        `;

        if (currentPage > 1) {
            paginationHTML += `<button class="btn btn-small" onclick="PlayersModule.goToPage(${currentPage - 1})">« Prev</button>`;
        }

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'btn-primary' : 'btn-secondary';
            paginationHTML += `<button class="btn btn-small ${activeClass}" onclick="PlayersModule.goToPage(${i})">${i}</button>`;
        }

        if (currentPage < totalPages) {
            paginationHTML += `<button class="btn btn-small" onclick="PlayersModule.goToPage(${currentPage + 1})">Next »</button>`;
        }

        paginationHTML += '</div>';
        document.getElementById('playersPagination').innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.searchFilters.page = page;
        this.loadPlayersList();
    }

    search() {
        const filters = {
            page: 1,
            limit: 20,
            sortBy: this.searchFilters.sortBy,
            sortOrder: this.searchFilters.sortOrder
        };

        const username = document.getElementById('searchUsername')?.value.trim();
        const email = document.getElementById('searchEmail')?.value.trim();
        const serverId = document.getElementById('searchServerId')?.value;
        const status = document.getElementById('searchStatus')?.value;

        if (username) filters.username = username;
        if (email) filters.email = email;
        if (serverId) filters.serverId = serverId;
        if (status) filters.accountStatus = status;

        this.searchFilters = filters;
        this.loadPlayersList();
    }

    clearSearch() {
        document.getElementById('searchUsername').value = '';
        document.getElementById('searchEmail').value = '';
        document.getElementById('searchServerId').value = '';
        document.getElementById('searchStatus').value = '';

        this.searchFilters = {
            page: 1,
            limit: 20,
            sortBy: 'lastLogin',
            sortOrder: 'desc'
        };

        this.loadPlayersList();
    }

    async viewPlayer(accountId) {
        try {
            AdminCore.showAlert('Loading player details...', 'info', 1000);
            
            const { data } = await AdminCore.makeRequest(`/api/admin/players/${accountId}`);
            
            this.selectedPlayer = data.data || data;
            document.getElementById('playerModalTitle').textContent = `Player: ${this.selectedPlayer.account.username}`;
            document.getElementById('playerModalBody').innerHTML = this.renderPlayerDetails(this.selectedPlayer);
            document.getElementById('playerDetailsModal').style.display = 'block';
            
        } catch (error) {
            AdminCore.showAlert('Failed to load player details: ' + error.message, 'error');
        }
    }

    renderPlayerDetails(playerData) {
        const account = playerData.account;
        const characters = playerData.characters || [];

        return `
            <div class="player-details">
                <div class="detail-section">
                    <h3>👤 Account Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Account ID:</span>
                            <span class="detail-value">${account.accountId}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Username:</span>
                            <span class="detail-value">${this.escapeHtml(account.username)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${this.escapeHtml(account.email || 'N/A')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status:</span>
                            <span class="badge ${this.getStatusClass(account.accountStatus)}">${this.capitalizeFirst(account.accountStatus)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Account Age:</span>
                            <span class="detail-value">${account.accountAge} days</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Spent:</span>
                            <span class="detail-value money positive">$${(account.totalSpentUSD || 0).toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Last Login:</span>
                            <span class="detail-value">${account.lastLogin ? new Date(account.lastLogin).toLocaleString() : 'Never'}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>🎮 Characters (${characters.length})</h3>
                    ${characters.length === 0 ? 
                        '<p>No characters found.</p>' : 
                        characters.map(char => this.renderCharacterCard(char)).join('')}
                </div>

                <div class="detail-section">
                    <h3>⚖️ Moderation & Edit Actions</h3>
                    <div class="moderation-actions">
                        ${account.accountStatus === 'active' ? `
                            <button class="btn btn-warning" onclick="PlayersModule.showModerationModal('${account.accountId}', 'warn')">
                                ⚠️ Issue Warning
                            </button>
                            <button class="btn btn-danger" onclick="PlayersModule.showModerationModal('${account.accountId}', 'suspend')">
                                🚫 Suspend Account
                            </button>
                            <button class="btn btn-critical" onclick="PlayersModule.showModerationModal('${account.accountId}', 'ban')">
                                🔒 Ban Account
                            </button>
                        ` : `
                            <button class="btn btn-success" onclick="PlayersModule.showModerationModal('${account.accountId}', 'unban')">
                                ✅ Restore Account
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    renderCharacterCard(character) {
        return `
            <div class="character-card">
                <div class="char-header">
                    <h4>${this.escapeHtml(character.displayName)}</h4>
                    <span class="server-badge">Server ${character.serverId}</span>
                </div>
                <div class="char-stats">
                    <div class="char-stat">
                        <span class="stat-label">Level:</span>
                        <span class="stat-value">${character.level}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">World:</span>
                        <span class="stat-value">${character.world}-${character.stage}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">VIP:</span>
                        <span class="stat-value">${character.vipLevel}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">Power:</span>
                        <span class="stat-value">${AdminCore.formatNumber(character.heroes?.powerScore || 0)}</span>
                    </div>
                </div>
                <div class="char-currency">
                    <div class="currency-item">
                        <span class="currency-icon">🪙</span>
                        <span>${AdminCore.formatNumber(character.currencies?.gold || 0)}</span>
                    </div>
                    <div class="currency-item">
                        <span class="currency-icon">💎</span>
                        <span>${AdminCore.formatNumber(character.currencies?.gems || 0)}</span>
                    </div>
                    <div class="currency-item">
                        <span class="currency-icon">💰</span>
                        <span>${AdminCore.formatNumber(character.currencies?.paidGems || 0)}</span>
                    </div>
                </div>
                <div class="char-actions">
                    <button class="btn btn-small btn-warning" onclick="PlayersModule.showEditCurrencyModal('${character.playerId}', '${character.serverId}', ${JSON.stringify(character.currencies).replace(/"/g, '&quot;')})">
                        💰 Edit Currency
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 🆕 Afficher le modal d'édition de currency avec interface complète
     */
    showEditCurrencyModal(playerId, serverId, currentCurrencies) {
        this.selectedCharacter = { playerId, serverId, currencies: currentCurrencies };
        
        const modalBody = document.getElementById('editCurrencyBody');
        modalBody.innerHTML = `
            <div class="edit-currency-form">
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

                <div class="form-group">
                    <label for="currencyType">Currency Type:</label>
                    <select id="currencyType" class="form-control">
                        <option value="gold">🪙 Gold</option>
                        <option value="gems">💎 Gems</option>
                        <option value="paidGems">💰 Paid Gems (Super Admin Only)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="currencyOperation">Operation:</label>
                    <select id="currencyOperation" class="form-control">
                        <option value="add">➕ Add</option>
                        <option value="subtract">➖ Subtract</option>
                        <option value="set">🔢 Set to exact value</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="currencyAmount">Amount:</label>
                    <input type="number" id="currencyAmount" class="form-control" min="0" value="100" required>
                    <div class="quick-amounts">
                        <button class="btn btn-small btn-secondary" onclick="document.getElementById('currencyAmount').value=100">100</button>
                        <button class="btn btn-small btn-secondary" onclick="document.getElementById('currencyAmount').value=500">500</button>
                        <button class="btn btn-small btn-secondary" onclick="document.getElementById('currencyAmount').value=1000">1K</button>
                        <button class="btn btn-small btn-secondary" onclick="document.getElementById('currencyAmount').value=5000">5K</button>
                        <button class="btn btn-small btn-secondary" onclick="document.getElementById('currencyAmount').value=10000">10K</button>
                        <button class="btn btn-small btn-secondary" onclick="document.getElementById('currencyAmount').value=50000">50K</button>
                    </div>
                </div>

                <div class="form-group">
                    <label for="currencyReason">Reason (required):</label>
                    <textarea id="currencyReason" class="form-control" rows="3" placeholder="Enter reason for this modification..." required></textarea>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="PlayersModule.closeEditModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="PlayersModule.submitCurrencyEdit()">💾 Apply Changes</button>
                </div>
            </div>
        `;
        
        document.getElementById('editCurrencyModal').style.display = 'block';
    }

    /**
     * 🆕 Soumettre l'édition de currency
     */
    async submitCurrencyEdit() {
        const currency = document.getElementById('currencyType').value;
        const operation = document.getElementById('currencyOperation').value;
        const amount = parseInt(document.getElementById('currencyAmount').value);
        const reason = document.getElementById('currencyReason').value.trim();

        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        if (isNaN(amount) || amount < 0) {
            AdminCore.showAlert('Invalid amount', 'error');
            return;
        }

        try {
            await AdminCore.makeRequest(`/api/admin/players/${this.selectedPlayer.account.accountId}/currency`, {
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
            this.closeEditModal();
            this.closePlayerModal();
            this.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Currency modification failed: ' + error.message, 'error');
        }
    }

    /**
     * 🆕 Afficher le modal de modération
     */
    showModerationModal(accountId, action) {
        const modalBody = document.getElementById('moderationBody');
        
        let actionTitle = '';
        let actionDescription = '';
        let showDuration = false;
        
        switch(action) {
            case 'warn':
                actionTitle = '⚠️ Issue Warning';
                actionDescription = 'This will send a warning to the player. The account will remain active.';
                break;
            case 'suspend':
                actionTitle = '🚫 Suspend Account';
                actionDescription = 'This will temporarily suspend the account. The player will not be able to login.';
                showDuration = true;
                break;
            case 'ban':
                actionTitle = '🔒 Ban Account';
                actionDescription = 'This will permanently ban the account. This action is severe.';
                break;
            case 'unban':
                actionTitle = '✅ Restore Account';
                actionDescription = 'This will restore the account and allow the player to login again.';
                break;
        }
        
        modalBody.innerHTML = `
            <div class="moderation-form">
                <div class="alert ${action === 'ban' ? 'danger' : 'warning'}" style="margin-bottom: 20px;">
                    <strong>${actionTitle}</strong>
                    <p>${actionDescription}</p>
                </div>

                ${showDuration ? `
                    <div class="form-group">
                        <label for="moderationDuration">Suspension Duration (hours):</label>
                        <select id="moderationDuration" class="form-control">
                            <option value="1">1 hour</option>
                            <option value="6">6 hours</option>
                            <option value="12">12 hours</option>
                            <option value="24" selected>24 hours (1 day)</option>
                            <option value="72">72 hours (3 days)</option>
                            <option value="168">168 hours (7 days)</option>
                            <option value="720">720 hours (30 days)</option>
                        </select>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label for="moderationReason">Reason (required):</label>
                    <textarea id="moderationReason" class="form-control" rows="4" placeholder="Enter detailed reason for this moderation action..." required></textarea>
                    ${action !== 'unban' ? `
                        <small style="color: #666; margin-top: 5px; display: block;">
                            This reason will be visible to the player and recorded in audit logs.
                        </small>
                    ` : ''}
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="PlayersModule.closeModerationModal()">Cancel</button>
                    <button class="btn ${action === 'ban' ? 'btn-critical' : action === 'unban' ? 'btn-success' : 'btn-warning'}" 
                            onclick="PlayersModule.submitModeration('${accountId}', '${action}')">
                        ${actionTitle}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('moderationModal').style.display = 'block';
    }

    /**
     * 🆕 Soumettre l'action de modération
     */
    async submitModeration(accountId, action) {
        const reason = document.getElementById('moderationReason').value.trim();
        
        if (!reason && action !== 'unban') {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        let duration = 0;
        if (action === 'suspend') {
            duration = parseInt(document.getElementById('moderationDuration').value);
        }

        try {
            const body = { 
                action, 
                reason: reason || 'Account restored by admin' 
            };
            if (duration > 0) body.duration = duration;

            await AdminCore.makeRequest(`/api/admin/players/${accountId}/moderate`, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            AdminCore.showAlert(`${this.capitalizeFirst(action)} applied successfully`, 'success');
            this.closeModerationModal();
            this.closePlayerModal();
            this.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Moderation failed: ' + error.message, 'error');
        }
    }

    closePlayerModal() {
        document.getElementById('playerDetailsModal').style.display = 'none';
        this.selectedPlayer = null;
    }

    closeEditModal() {
        document.getElementById('editCurrencyModal').style.display = 'none';
        this.selectedCharacter = null;
    }

    closeModerationModal() {
        document.getElementById('moderationModal').style.display = 'none';
    }

    // === UTILITAIRES ===

    getStatusClass(status) {
        const classes = {
            'active': 'success',
            'suspended': 'warning',
            'banned': 'danger',
            'inactive': 'secondary'
        };
        return classes[status] || 'secondary';
    }

    getActivityClass(lastLogin) {
        if (!lastLogin) return 'inactive';
        
        const daysSince = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 1) return 'active';
        if (daysSince <= 7) return 'recent';
        return 'inactive';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Créer l'instance globale
window.PlayersModule = new PlayersModule();

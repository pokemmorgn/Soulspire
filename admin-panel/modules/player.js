/**
 * PlayersModule - Gestion complète des joueurs
 * Recherche, détails, modération, modifications
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
    }

    /**
     * Charger les données des joueurs
     */
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

    /**
     * Rendre l'interface des joueurs
     */
    renderPlayersInterface() {
        return `
            <!-- Stats des joueurs -->
            <div class="players-stats-grid" id="playersStatsGrid">
                <div class="loading"><div class="spinner"></div><p>Loading player statistics...</p></div>
            </div>

            <!-- Contrôles de recherche -->
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

            <!-- Liste des joueurs -->
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
        `;
    }

    /**
     * Charger les statistiques des joueurs
     */
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

    /**
     * Charger la liste des joueurs
     */
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

    /**
     * Rendre le tableau des joueurs
     */
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

    /**
     * Rendre une ligne de joueur
     */
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

    /**
     * Mettre à jour la pagination
     */
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

    /**
     * Aller à une page spécifique
     */
    goToPage(page) {
        this.searchFilters.page = page;
        this.loadPlayersList();
    }

    /**
     * Rechercher des joueurs
     */
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

    /**
     * Effacer la recherche
     */
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

    /**
     * Voir les détails d'un joueur
     */
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

    /**
     * Rendre les détails du joueur avec options d'édition
     */
    renderPlayerDetails(playerData) {
        const account = playerData.account;
        const characters = playerData.characters || [];

        return `
            <div class="player-details">
                <!-- Account Info -->
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

                <!-- Characters -->
                <div class="detail-section">
                    <h3>🎮 Characters (${characters.length})</h3>
                    ${characters.length === 0 ? 
                        '<p>No characters found.</p>' : 
                        characters.map(char => this.renderCharacterCard(char)).join('')}
                </div>

                <!-- Moderation Actions -->
                <div class="detail-section">
                    <h3>⚖️ Moderation & Edit Actions</h3>
                    <div class="moderation-actions">
                        ${account.accountStatus === 'active' ? `
                            <button class="btn btn-warning" onclick="PlayersModule.moderateAction('${account.accountId}', 'warn')">
                                ⚠️ Issue Warning
                            </button>
                            <button class="btn btn-danger" onclick="PlayersModule.moderateAction('${account.accountId}', 'suspend')">
                                🚫 Suspend Account
                            </button>
                            <button class="btn btn-critical" onclick="PlayersModule.moderateAction('${account.accountId}', 'ban')">
                                🔒 Ban Account
                            </button>
                        ` : `
                            <button class="btn btn-success" onclick="PlayersModule.moderateAction('${account.accountId}', 'unban')">
                                ✅ Restore Account
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rendre une carte de personnage avec édition
     */
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
                    <button class="btn btn-small btn-warning" onclick="PlayersModule.editCurrency('${this.selectedPlayer.account.accountId}', '${character.playerId}', '${character.serverId}')">
                        💰 Edit Currency
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Éditer les monnaies d'un personnage
     */
    async editCurrency(accountId, playerId, serverId) {
        const currency = prompt('Which currency to edit? (gold, gems, paidGems)');
        if (!currency || !['gold', 'gems', 'paidGems'].includes(currency)) {
            AdminCore.showAlert('Invalid currency selected', 'error');
            return;
        }

        const operation = prompt('Operation? (add, subtract, set)');
        if (!operation || !['add', 'subtract', 'set'].includes(operation)) {
            AdminCore.showAlert('Invalid operation', 'error');
            return;
        }

        const amount = parseInt(prompt('Amount:'));
        if (isNaN(amount) || amount < 0) {
            AdminCore.showAlert('Invalid amount', 'error');
            return;
        }

        const reason = prompt('Reason for this modification:');
        if (!reason) {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        try {
            await AdminCore.makeRequest(`/api/admin/players/${accountId}/currency`, {
                method: 'POST',
                body: JSON.stringify({
                    serverId,
                    playerId,
                    currency,
                    amount,
                    operation,
                    reason
                })
            });

            AdminCore.showAlert(`Currency ${operation} successful!`, 'success');
            this.closePlayerModal();
            this.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Currency modification failed: ' + error.message, 'error');
        }
    }

    /**
     * Action de modération
     */
    async moderateAction(accountId, action) {
        let reason = '';
        let duration = 0;

        if (action === 'warn') {
            reason = prompt('Enter warning reason:');
        } else if (action === 'suspend') {
            reason = prompt('Enter suspension reason:');
            const durationStr = prompt('Enter suspension duration in hours:');
            duration = parseInt(durationStr) || 24;
        } else if (action === 'ban') {
            reason = prompt('Enter ban reason:');
        } else if (action === 'unban') {
            reason = 'Account restored by admin';
        }

        if (!reason && action !== 'unban') {
            AdminCore.showAlert('Reason is required', 'error');
            return;
        }

        try {
            const body = { action, reason };
            if (duration > 0) body.duration = duration;

            await AdminCore.makeRequest(`/api/admin/players/${accountId}/moderate`, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            AdminCore.showAlert(`${this.capitalizeFirst(action)} applied successfully`, 'success');
            this.closePlayerModal();
            this.loadPlayersList();

        } catch (error) {
            AdminCore.showAlert('Moderation failed: ' + error.message, 'error');
        }
    }

    /**
     * Fermer le modal
     */
    closePlayerModal() {
        document.getElementById('playerDetailsModal').style.display = 'none';
        this.selectedPlayer = null;
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

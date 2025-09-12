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
     * Initialiser le module joueurs
     */
    init() {
        console.log('👥 Initializing Players Module...');
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
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading player statistics...</p>
                </div>
            </div>

            <!-- Contrôles de recherche -->
            <div class="players-controls">
                <div class="search-section">
                    <h3>🔍 Search Players</h3>
                    <div class="search-grid">
                        <div class="search-group">
                            <label for="searchUsername">Username:</label>
                            <input type="text" id="searchUsername" placeholder="Enter username..." onkeypress="if(event.key==='Enter') PlayersModule.search()">
                        </div>
                        <div class="search-group">
                            <label for="searchEmail">Email:</label>
                            <input type="email" id="searchEmail" placeholder="Enter email..." onkeypress="if(event.key==='Enter') PlayersModule.search()">
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
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="search-group">
                            <label for="searchMinLevel">Min Level:</label>
                            <input type="number" id="searchMinLevel" placeholder="1" min="1">
                        </div>
                        <div class="search-group">
                            <label for="searchMaxLevel">Max Level:</label>
                            <input type="number" id="searchMaxLevel" placeholder="100" min="1">
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
                        <div class="loading">
                            <div class="spinner"></div>
                            <p>Loading players...</p>
                        </div>
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
                    <div class="modal-body" id="playerModalBody">
                        <!-- Content loaded dynamically -->
                    </div>
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
            
            document.getElementById('playersStatsGrid').innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${AdminCore.formatNumber(data.totalPlayers)}</div>
                    <div class="stat-label">Total Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${AdminCore.formatNumber(data.activePlayers)}</div>
                    <div class="stat-label">Active Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">${AdminCore.formatNumber(data.spendingPlayers)}</div>
                    <div class="stat-label">Spending Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${data.averageLevel}</div>
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
            
            this.currentPlayers = data.players;
            container.innerHTML = this.renderPlayersTable(data);
            this.updatePagination(data);
            
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
                        <th onclick="PlayersModule.sortBy('username')">Username</th>
                        <th onclick="PlayersModule.sortBy('email')">Email</th>
                        <th>Characters</th>
                        <th>Status</th>
                        <th onclick="PlayersModule.sortBy('totalSpentUSD')">Total Spent</th>
                        <th onclick="PlayersModule.sortBy('lastLogin')">Last Login</th>
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
                        <span class="char-count">${player.charactersCount} chars</span>
                        ${player.summary.highestLevel > 0 ? `<small>Max Lvl: ${player.summary.highestLevel}</small>` : ''}
                    </div>
                </td>
                <td><span class="badge ${statusClass}">${this.capitalizeFirst(player.accountStatus)}</span></td>
                <td>
                    <span class="money ${player.totalSpentUSD > 0 ? 'positive' : ''}">
                        ${player.totalSpentUSD.toFixed(2)}
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
                        <button class="btn btn-small btn-warning" onclick="PlayersModule.showModerationModal('${player.accountId}')">
                            ⚖️ Moderate
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

        // Bouton précédent
        if (currentPage > 1) {
            paginationHTML += `<button class="btn btn-small" onclick="PlayersModule.goToPage(${currentPage - 1})">« Prev</button>`;
        }

        // Pages
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'btn-primary' : 'btn-secondary';
            paginationHTML += `<button class="btn btn-small ${activeClass}" onclick="PlayersModule.goToPage(${i})">${i}</button>`;
        }

        // Bouton suivant
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
     * Trier par colonne
     */
    sortBy(field) {
        if (this.searchFilters.sortBy === field) {
            this.searchFilters.sortOrder = this.searchFilters.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.searchFilters.sortBy = field;
            this.searchFilters.sortOrder = 'desc';
        }
        this.searchFilters.page = 1;
        this.loadPlayersList();
    }

    /**
     * Rechercher des joueurs
     */
    search() {
        // Collecter les filtres de recherche
        const filters = {
            page: 1,
            limit: 20,
            sortBy: this.searchFilters.sortBy,
            sortOrder: this.searchFilters.sortOrder
        };

        const username = document.getElementById('searchUsername').value.trim();
        const email = document.getElementById('searchEmail').value.trim();
        const serverId = document.getElementById('searchServerId').value;
        const status = document.getElementById('searchStatus').value;
        const minLevel = document.getElementById('searchMinLevel').value;
        const maxLevel = document.getElementById('searchMaxLevel').value;

        if (username) filters.username = username;
        if (email) filters.email = email;
        if (serverId) filters.serverId = serverId;
        if (status) filters.accountStatus = status;
        if (minLevel) {
            filters['level.min'] = parseInt(minLevel);
        }
        if (maxLevel) {
            filters['level.max'] = parseInt(maxLevel);
        }

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
        document.getElementById('searchMinLevel').value = '';
        document.getElementById('searchMaxLevel').value = '';

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
            
            this.selectedPlayer = data;
            document.getElementById('playerModalTitle').textContent = `Player: ${data.account.username}`;
            document.getElementById('playerModalBody').innerHTML = this.renderPlayerDetails(data);
            document.getElementById('playerDetailsModal').style.display = 'block';
            
        } catch (error) {
            AdminCore.showAlert('Failed to load player details: ' + error.message, 'error');
        }
    }

    /**
     * Rendre les détails du joueur
     */
    renderPlayerDetails(playerData) {
        const account = playerData.account;
        const characters = playerData.characters;

        return `
            <div class="player-details">
                <!-- Informations du compte -->
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
                            <span class="detail-value money positive">${account.totalSpentUSD.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Playtime:</span>
                            <span class="detail-value">${Math.floor(account.totalPlaytime / 60)}h ${account.totalPlaytime % 60}m</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Last Login:</span>
                            <span class="detail-value">${account.lastLogin ? new Date(account.lastLogin).toLocaleString() : 'Never'}</span>
                        </div>
                    </div>
                </div>

                <!-- Personnages -->
                <div class="detail-section">
                    <h3>🎮 Characters (${characters.length})</h3>
                    ${characters.length === 0 ? 
                        '<p>No characters found.</p>' : 
                        characters.map(char => this.renderCharacterCard(char)).join('')}
                </div>

                <!-- Actions de modération -->
                <div class="detail-section">
                    <h3>⚖️ Moderation Actions</h3>
                    <div class="moderation-actions">
                        <button class="btn btn-warning" onclick="PlayersModule.moderateAction('${account.accountId}', 'warn')">
                            ⚠️ Issue Warning
                        </button>
                        <button class="btn btn-danger" onclick="PlayersModule.moderateAction('${account.accountId}', 'suspend')">
                            🚫 Suspend Account
                        </button>
                        <button class="btn btn-critical" onclick="PlayersModule.moderateAction('${account.accountId}', 'ban')">
                            🔒 Ban Account
                        </button>
                        ${account.accountStatus !== 'active' ? 
                            `<button class="btn btn-success" onclick="PlayersModule.moderateAction('${account.accountId}', 'unban')">
                                ✅ Restore Account
                            </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rendre une carte de personnage
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
                        <span class="stat-value">${AdminCore.formatNumber(character.heroes.powerScore)}</span>
                    </div>
                </div>
                <div class="char-currency">
                    <div class="currency-item">
                        <span class="currency-icon">🪙</span>
                        <span>${AdminCore.formatNumber(character.currencies.gold)}</span>
                    </div>
                    <div class="currency-item">
                        <span class="currency-icon">💎</span>
                        <span>${AdminCore.formatNumber(character.currencies.gems)}</span>
                    </div>
                    <div class="currency-item">
                        <span class="currency-icon">💰</span>
                        <span>${AdminCore.formatNumber(character.currencies.paidGems)}</span>
                    </div>
                </div>
                <div class="char-actions">
                    <button class="btn btn-small btn-info" onclick="PlayersModule.viewCharacterDetails('${character.playerId}', '${character.serverId}')">
                        📊 Details
                    </button>
                    <button class="btn btn-small btn-warning" onclick="PlayersModule.editCurrency('${character.playerId}', '${character.serverId}')">
                        💰 Edit Currency
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Fermer le modal des détails
     */
    closePlayerModal() {
        document.getElementById('playerDetailsModal').style.display = 'none';
        this.selectedPlayer = null;
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
            AdminCore.showAlert('Reason is required for moderation actions', 'error');
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
            AdminCore.showAlert('Moderation action failed: ' + error.message, 'error');
        }
    }

    // === MÉTHODES UTILITAIRES ===

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

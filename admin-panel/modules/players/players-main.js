/**
 * PlayersModule - Module principal de gestion des joueurs
 * Coordonne les sous-modules : Currency, VIP, Heroes, Moderation
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
        
        // Références aux sous-modules (seront initialisés après chargement)
        this.currency = null;
        this.vip = null;
        this.heroes = null;
        this.moderation = null;
        this.ui = null;
    }

    /**
     * Initialiser le module et ses sous-modules
     */
    init() {
        console.log('👥 Initializing Players Module...');
        
        // Les sous-modules seront disponibles via window.PlayersCurrency, etc.
        this.currency = window.PlayersCurrency;
        this.vip = window.PlayersVIP;
        this.heroes = window.PlayersHeroes;
        this.moderation = window.PlayersModeration;
        this.ui = window.PlayersUI;
        
        console.log('✅ Players Module initialized with sub-modules');
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

            <!-- Modals des sous-modules -->
            ${this.currency ? this.currency.renderModal() : ''}
            ${this.vip ? this.vip.renderModal() : ''}
            ${this.heroes ? this.heroes.renderModal() : ''}
            ${this.moderation ? this.moderation.renderModal() : ''}
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
        const statusClass = this.ui.getStatusClass(player.accountStatus);
        const lastLogin = player.lastLogin ? new Date(player.lastLogin).toLocaleDateString() : 'Never';
        
        return `
            <tr>
                <td>
                    <div class="player-username">
                        <strong>${this.ui.escapeHtml(player.username)}</strong>
                        <small class="player-id">ID: ${player.accountId}</small>
                    </div>
                </td>
                <td>${this.ui.escapeHtml(player.email || 'N/A')}</td>
                <td>
                    <div class="character-summary">
                        <span class="char-count">${player.charactersCount || 0} chars</span>
                        ${player.summary && player.summary.highestLevel > 0 ? `<small>Max Lvl: ${player.summary.highestLevel}</small>` : ''}
                    </div>
                </td>
                <td><span class="badge ${statusClass}">${this.ui.capitalizeFirst(player.accountStatus)}</span></td>
                <td>
                    <span class="money ${player.totalSpentUSD > 0 ? 'positive' : ''}">
                        $${(player.totalSpentUSD || 0).toFixed(2)}
                    </span>
                </td>
                <td>
                    <span class="date ${this.ui.getActivityClass(player.lastLogin)}">${lastLogin}</span>
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
                            <span class="detail-value">${this.ui.escapeHtml(account.username)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${this.ui.escapeHtml(account.email || 'N/A')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status:</span>
                            <span class="badge ${this.ui.getStatusClass(account.accountStatus)}">${this.ui.capitalizeFirst(account.accountStatus)}</span>
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
                            <button class="btn btn-warning" onclick="PlayersModeration.showModal('${account.accountId}', 'warn')">
                                ⚠️ Issue Warning
                            </button>
                            <button class="btn btn-danger" onclick="PlayersModeration.showModal('${account.accountId}', 'suspend')">
                                🚫 Suspend Account
                            </button>
                            <button class="btn btn-critical" onclick="PlayersModeration.showModal('${account.accountId}', 'ban')">
                                🔒 Ban Account
                            </button>
                        ` : `
                            <button class="btn btn-success" onclick="PlayersModeration.showModal('${account.accountId}', 'unban')">
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
                    <h4>${this.ui.escapeHtml(character.displayName)}</h4>
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
                    <button class="btn btn-small btn-warning" onclick="PlayersCurrency.showModal('${character.playerId}', '${character.serverId}', ${JSON.stringify(character.currencies).replace(/"/g, '&quot;')})">
                        💰 Edit Currency
                    </button>
                    <button class="btn btn-small btn-info" onclick="PlayersVIP.showModal('${character.playerId}', '${character.serverId}', ${character.vipLevel})">
                        ⭐ Edit VIP
                    </button>
                    <button class="btn btn-small btn-success" onclick="PlayersModule.viewCharacterHeroes('${character.playerId}', '${character.serverId}')">
                        ⚔️ Manage Heroes
                    </button>
                </div>
            </div>
        `;
    }

closePlayerModal() {
        document.getElementById('playerDetailsModal').style.display = 'none';
        this.selectedPlayer = null;
    }

/**
 * Voir les héros d'un personnage
 */
// 🔧 CORRECTION dans la méthode viewCharacterHeroes

async viewCharacterHeroes(playerId, serverId) {
    try {
        AdminCore.showAlert('Loading heroes...', 'info', 1000);
        
        if (!this.selectedPlayer || !this.selectedPlayer.account) {
            AdminCore.showAlert('Please select a player first', 'error');
            return;
        }

        const character = this.selectedPlayer.characters?.find(c => 
            c.playerId === playerId && c.serverId === serverId
        );

        if (!character) {
            AdminCore.showAlert('Character not found', 'error');
            return;
        }

        // 🆕 Faire un appel API pour récupérer les héros complets
        const { data } = await AdminCore.makeRequest(
            `/api/admin/players/${this.selectedPlayer.account.accountId}/heroes?serverId=${serverId}&playerId=${playerId}`
        );

        console.log('📊 Heroes API Response:', data);

        // ✅ Utiliser directement les données de l'API
        const heroesList = data.heroes || [];

        if (heroesList.length === 0) {
            AdminCore.showAlert('This character has no heroes yet', 'warning');
            return;
        }

        // Créer un modal temporaire pour afficher les héros
        const existingSection = document.getElementById('heroesManagementSection');
        if (existingSection) {
            existingSection.remove();
        }

        const modalBody = document.getElementById('playerModalBody');
        if (!modalBody) return;

        const heroesSection = document.createElement('div');
        heroesSection.id = 'heroesManagementSection';
        heroesSection.className = 'detail-section';
        heroesSection.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>⚔️ Heroes Management - ${this.ui.escapeHtml(character.displayName)}</h3>
                <button class="btn btn-secondary btn-small" onclick="document.getElementById('heroesManagementSection').remove()">
                    ✕ Close Heroes
                </button>
            </div>
            <div class="heroes-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #667eea;">${heroesList.length}</div>
                    <div style="font-size: 12px; color: #666;">Total Heroes</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #28a745;">${heroesList.filter(h => h.equipped).length}</div>
                    <div style="font-size: 12px; color: #666;">Equipped</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${data.summary?.maxLevel || 0}</div>
                    <div style="font-size: 12px; color: #666;">Max Level</div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #17a2b8;">${AdminCore.formatNumber(data.summary?.totalPower || 0)}</div>
                    <div style="font-size: 12px; color: #666;">Total Power</div>
                </div>
            </div>
            <div class="heroes-grid" id="heroesGrid">
                ${this.renderHeroesGrid(heroesList, playerId, serverId)}
            </div>
        `;

        modalBody.appendChild(heroesSection);
        
        // Scroll vers la section des héros
        heroesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error('View character heroes error:', error);
        AdminCore.showAlert('Failed to load heroes: ' + error.message, 'error');
    }
}

/**
 * Rendre la grille de héros - VERSION CORRIGÉE
 */
renderHeroesGrid(heroesList, playerId, serverId) {
    if (!heroesList || heroesList.length === 0) {
        return '<p style="text-align: center; color: #666; padding: 40px;">No heroes found for this character.</p>';
    }

    return heroesList.map(heroData => {
        const hero = heroData.hero; // Les données du héros de base
        
        return `
            <div class="hero-card">
                <div class="hero-card-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h4 style="margin: 0;">${this.ui.escapeHtml(hero.name || 'Unknown Hero')}</h4>
                        <span class="hero-rarity ${(hero.rarity || 'common').toLowerCase()}">${hero.rarity || 'Common'}</span>
                    </div>
                    ${heroData.equipped ? '<span style="color: #28a745; font-size: 12px;">✓ Equipped</span>' : ''}
                </div>
                <div class="hero-card-body">
                    <div class="hero-info">
                        <span>${this.getHeroRoleIcon(hero.role)} ${hero.role || 'Unknown'}</span>
                        <span>${this.getHeroElementIcon(hero.element)} ${hero.element || 'Unknown'}</span>
                    </div>
                    <div class="hero-stats-mini">
                        <span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px;">Lvl ${heroData.level || 1}</span>
                        <span style="background: #fff3cd; padding: 4px 8px; border-radius: 4px;">${heroData.stars || 1}⭐</span>
                        <span style="background: #f8d7da; padding: 4px 8px; border-radius: 4px;">Power: ${AdminCore.formatNumber(heroData.powerLevel || 0)}</span>
                    </div>
                </div>
                <div class="hero-card-actions">
                    <button class="btn btn-small btn-info" 
                            onclick='PlayersModule.editHero(${JSON.stringify({
                                playerHeroId: heroData.playerHeroId,
                                serverId: serverId,
                                heroData: {
                                    name: hero.name,
                                    role: hero.role,
                                    element: hero.element,
                                    rarity: hero.rarity,
                                    level: heroData.level,
                                    stars: heroData.stars,
                                    equipped: heroData.equipped,
                                    powerLevel: heroData.powerLevel,
                                    currentStats: heroData.currentStats,
                                    equipment: hero.equipment,
                                    spells: hero.spells
                                },
                                accountId: this.selectedPlayer.account.accountId
                            }).replace(/'/g, "\\'")}'>
                        ✏️ Edit
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
/**
 * Éditer un héros (wrapper pour appeler PlayersHeroes)
 */
editHero(heroInfo) {
    if (!this.heroes) {
        AdminCore.showAlert('Heroes module not loaded', 'error');
        return;
    }
    
    this.heroes.showModal(
        heroInfo.playerHeroId,
        heroInfo.serverId,
        heroInfo.heroData,
        { accountId: heroInfo.accountId }
    );
}

/**
 * Obtenir l'icône du rôle
 */
getHeroRoleIcon(role) {
    const icons = {
        'Tank': '🛡️',
        'DPS Melee': '⚔️',
        'DPS Ranged': '🏹',
        'Support': '💚'
    };
    return icons[role] || '❓';
}

/**
 * Obtenir l'icône de l'élément
 */
getHeroElementIcon(element) {
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
window.PlayersModule = new PlayersModule();

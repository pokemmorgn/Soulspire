/**
 * PlayersAchievements - Sous-module de gestion des achievements des joueurs
 * Affiche et gère les achievements acquis par un joueur
 */
class PlayersAchievements {
    constructor() {
        this.selectedPlayer = null;
        this.selectedCharacter = null;
        this.playerAchievements = [];
    }

    /**
     * Rendre le modal HTML
     */
    renderModal() {
        return `
            <div id="playerAchievementsModal" class="modal">
                <div class="modal-content" style="max-width: 1000px; max-height: 90vh;">
                    <div class="modal-header">
                        <h2 id="playerAchievementsTitle">🏆 Player Achievements</h2>
                        <span class="modal-close" onclick="PlayersAchievements.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="playerAchievementsBody" style="max-height: calc(90vh - 100px); overflow-y: auto;"></div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher le modal des achievements d'un joueur
     */
    async showModal(accountId, playerId, serverId) {
        this.selectedPlayer = { accountId, playerId, serverId };
        
        try {
            AdminCore.showAlert('Loading player achievements...', 'info', 1000);
            
            // Charger les achievements du joueur
            const { data } = await AdminCore.makeRequest(
                `/api/admin/players/${accountId}/achievements?serverId=${serverId}&playerId=${playerId}`
            );
            
            this.playerAchievements = data.achievements || [];
            
            const modalTitle = document.getElementById('playerAchievementsTitle');
            const modalBody = document.getElementById('playerAchievementsBody');
            
            modalTitle.textContent = `🏆 Achievements - ${data.playerName || 'Player'}`;
            modalBody.innerHTML = this.renderAchievementsContent(data);
            
            document.getElementById('playerAchievementsModal').style.display = 'block';
            
        } catch (error) {
            console.error('Load player achievements error:', error);
            AdminCore.showAlert('Failed to load achievements: ' + error.message, 'error');
        }
    }

    /**
     * Rendre le contenu des achievements
     */
    renderAchievementsContent(data) {
        const achievements = data.achievements || [];
        const stats = data.stats || {};
        
        return `
            <div class="player-achievements-content">
                <!-- Stats Summary -->
                <div class="achievements-stats-summary">
                    <h3>📊 Achievement Summary</h3>
                    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="stat-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.unlockedCount || 0}</div>
                            <div style="font-size: 12px; color: #666;">Unlocked</div>
                        </div>
                        <div class="stat-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.totalPoints || 0}</div>
                            <div style="font-size: 12px; color: #666;">Total Points</div>
                        </div>
                        <div class="stat-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${stats.completionRate || 0}%</div>
                            <div style="font-size: 12px; color: #666;">Completion</div>
                        </div>
                        <div class="stat-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #17a2b8;">${stats.categoriesCompleted || 0}</div>
                            <div style="font-size: 12px; color: #666;">Categories Completed</div>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="achievements-filters" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div>
                            <label for="filterAchCategory" style="font-size: 12px; font-weight: 600; color: #666;">Category:</label>
                            <select id="filterAchCategory" class="form-control" style="padding: 8px; font-size: 14px;" onchange="PlayersAchievements.filterAchievements()">
                                <option value="">All Categories</option>
                                <option value="combat">⚔️ Combat</option>
                                <option value="progression">📈 Progression</option>
                                <option value="collection">📦 Collection</option>
                                <option value="social">👥 Social</option>
                                <option value="exploration">🗺️ Exploration</option>
                                <option value="economy">💰 Economy</option>
                                <option value="special">⭐ Special</option>
                            </select>
                        </div>
                        <div>
                            <label for="filterAchStatus" style="font-size: 12px; font-weight: 600; color: #666;">Status:</label>
                            <select id="filterAchStatus" class="form-control" style="padding: 8px; font-size: 14px;" onchange="PlayersAchievements.filterAchievements()">
                                <option value="">All</option>
                                <option value="unlocked">Unlocked</option>
                                <option value="locked">Locked</option>
                                <option value="in_progress">In Progress</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Achievements Grid -->
                <div class="achievements-grid" id="achievementsGrid">
                    ${this.renderAchievementsGrid(achievements)}
                </div>
            </div>
        `;
    }

    /**
     * Rendre la grille d'achievements
     */
    renderAchievementsGrid(achievements) {
        if (!achievements || achievements.length === 0) {
            return '<p style="text-align: center; color: #666; padding: 40px;">No achievements found for this player.</p>';
        }

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                ${achievements.map(ach => this.renderAchievementCard(ach)).join('')}
            </div>
        `;
    }

    /**
     * Rendre une carte d'achievement
     */
    renderAchievementCard(achievement) {
        const isUnlocked = achievement.isUnlocked;
        const progress = achievement.progress || { current: 0, target: achievement.conditions?.target || 0 };
        const percentage = Math.min((progress.current / progress.target) * 100, 100);
        const categoryBadge = window.AchievementsUI.getCategoryBadge(achievement.category);
        
        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}" style="
                background: ${isUnlocked ? 'linear-gradient(135deg, #d4edda, #c3e6cb)' : '#f8f9fa'};
                border: 2px solid ${isUnlocked ? '#28a745' : '#e9ecef'};
                border-radius: 10px;
                padding: 15px;
                position: relative;
            ">
                <!-- Unlock Status Badge -->
                ${isUnlocked ? `
                    <div style="position: absolute; top: 10px; right: 10px; background: #28a745; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                        ✓ UNLOCKED
                    </div>
                ` : ''}
                
                <!-- Header -->
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        <span style="font-size: 24px;">${categoryBadge.icon}</span>
                        <h4 style="margin: 0; color: #333; flex: 1;">${window.AchievementsUI.escapeHtml(achievement.name)}</h4>
                    </div>
                    <p style="margin: 5px 0; color: #666; font-size: 13px;">${window.AchievementsUI.escapeHtml(achievement.description)}</p>
                </div>

                <!-- Progress Bar (si non débloqué) -->
                ${!isUnlocked && progress.target > 0 ? `
                    <div style="margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
                            <span style="color: #666;">Progress:</span>
                            <span style="font-weight: 600;">${progress.current} / ${progress.target}</span>
                        </div>
                        <div style="height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${percentage}%; background: linear-gradient(135deg, #667eea, #764ba2); transition: width 0.3s ease;"></div>
                        </div>
                        <div style="text-align: right; margin-top: 5px; font-size: 11px; color: #666;">
                            ${percentage.toFixed(1)}% Complete
                        </div>
                    </div>
                ` : ''}

                <!-- Info Footer -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid ${isUnlocked ? '#28a745' : '#e9ecef'};">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span class="badge ${window.AchievementsUI.getRarityClass(achievement.rarity)}" style="font-size: 10px;">
                            ${window.AchievementsUI.capitalizeFirst(achievement.rarity)}
                        </span>
                        <span style="font-size: 12px; color: #666;">
                            <strong>${achievement.pointsValue}</strong> pts
                        </span>
                    </div>
                    
                    ${isUnlocked && achievement.unlockedAt ? `
                        <div style="font-size: 11px; color: #666;">
                            🕐 ${window.AchievementsUI.formatDate(achievement.unlockedAt)}
                        </div>
                    ` : ''}
                </div>

                <!-- Rewards (si débloqué) -->
                ${isUnlocked && achievement.rewards ? `
                    <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 6px;">
                        <div style="font-size: 11px; font-weight: 600; color: #666; margin-bottom: 5px;">🎁 Rewards Earned:</div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px;">
                            ${achievement.rewards.gold ? `<span>🪙 ${window.AchievementsUI.formatNumber(achievement.rewards.gold)}</span>` : ''}
                            ${achievement.rewards.gems ? `<span>💎 ${window.AchievementsUI.formatNumber(achievement.rewards.gems)}</span>` : ''}
                            ${achievement.rewards.title ? `<span>🏅 ${window.AchievementsUI.escapeHtml(achievement.rewards.title)}</span>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Filtrer les achievements
     */
    filterAchievements() {
        const category = document.getElementById('filterAchCategory')?.value || '';
        const status = document.getElementById('filterAchStatus')?.value || '';
        
        let filtered = this.playerAchievements;
        
        if (category) {
            filtered = filtered.filter(a => a.category === category);
        }
        
        if (status === 'unlocked') {
            filtered = filtered.filter(a => a.isUnlocked);
        } else if (status === 'locked') {
            filtered = filtered.filter(a => !a.isUnlocked);
        } else if (status === 'in_progress') {
            filtered = filtered.filter(a => !a.isUnlocked && a.progress?.current > 0);
        }
        
        const grid = document.getElementById('achievementsGrid');
        if (grid) {
            grid.innerHTML = this.renderAchievementsGrid(filtered);
        }
    }

    /**
     * Fermer le modal
     */
    closeModal() {
        document.getElementById('playerAchievementsModal').style.display = 'none';
        this.selectedPlayer = null;
        this.playerAchievements = [];
    }
}

// Créer l'instance globale
window.PlayersAchievements = new PlayersAchievements();

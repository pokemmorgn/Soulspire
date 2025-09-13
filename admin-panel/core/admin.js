/**
 * AdminCore - Système principal du panel admin
 * Gère l'authentification, les requêtes API et la navigation
 */
class AdminCore {
    constructor() {
        this.token = localStorage.getItem('adminToken');
        this.adminUser = null;
        this.refreshInterval = null;
        this.currentSection = 'overview';
    }

    /**
     * Initialiser le panel admin
     */
    init() {
        console.log('🔧 Initializing Admin Core...');
        
        if (this.token) {
            this.showDashboard();
            this.loadDashboardData();
        }
        
        // Écouter les erreurs d'API pour déconnecter si token invalide
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && event.reason.message.includes('TOKEN_')) {
                this.logout();
            }
        });

        console.log('✅ Admin Core initialized');
    }

    /**
     * Faire une requête API avec authentification
     */
    async makeRequest(url, options = {}) {
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                // Si token expiré, déconnecter automatiquement
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    throw new Error('Session expired. Please login again.');
                }
                throw new Error(data.error || `Request failed: ${response.status}`);
            }
            
            return { response, data };
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    /**
     * Afficher une alerte globale
     */
    showAlert(message, type = 'info', duration = 5000) {
        let alertContainer = document.getElementById('globalAlert');
        
        // Créer le container s'il n'existe pas
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'globalAlert';
            alertContainer.className = 'global-alert';
            document.body.appendChild(alertContainer);
        }
        
        const alertId = Date.now();
        const alertHTML = `
            <div class="alert ${type} slide-in" id="alert-${alertId}">
                <span class="alert-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="document.getElementById('alert-${alertId}').remove()">×</button>
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHTML);
        alertContainer.style.display = 'block';
        
        if (duration > 0) {
            setTimeout(() => {
                const alertElement = document.getElementById(`alert-${alertId}`);
                if (alertElement) {
                    alertElement.classList.add('slide-out');
                    setTimeout(() => alertElement.remove(), 300);
                }
            }, duration);
        }
    }

    /**
     * Connexion administrateur
     */
    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        if (!username || !password) {
            this.showAlert('Please enter both username and password', 'error');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const { data } = await this.makeRequest('/api/admin/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (data.success && data.data.token) {
                this.token = data.data.token;
                this.adminUser = data.data.admin;
                localStorage.setItem('adminToken', this.token);
                
                this.showAlert('Login successful! Loading dashboard...', 'success');
                
                setTimeout(() => {
                    this.showDashboard();
                    this.loadDashboardData();
                }, 1000);
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login to Admin Panel';
        }
    }

    /**
     * Déconnexion
     */
    async logout() {
        try {
            // Tenter de faire un logout propre sur le serveur
            if (this.token) {
                await this.makeRequest('/api/admin/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            console.warn('Logout request failed:', error);
        }
        
        // Nettoyer le côté client
        localStorage.removeItem('adminToken');
        this.token = null;
        this.adminUser = null;
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Réinitialiser l'interface
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';
        
        // Reset form
        document.getElementById('username').value = 'superadmin';
        document.getElementById('password').value = 'ChangeMe123!';
        
        this.showAlert('Logged out successfully', 'info');
    }

    /**
     * Afficher le dashboard
     */
    showDashboard() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';
        
        if (this.adminUser) {
            document.getElementById('userName').textContent = this.adminUser.username;
            document.getElementById('userRole').textContent = this.adminUser.role;
            document.getElementById('userAvatar').textContent = this.adminUser.username.substring(0, 2).toUpperCase();
        }
    }

    /**
     * Charger les données du dashboard
     */
    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            
            // Charger les stats rapides
            await this.loadQuickStats();
            
            // Charger les données d'aperçu
            await this.loadOverviewData();
            
            // Démarrer l'actualisation automatique
            this.startAutoRefresh();
            
            console.log('✅ Dashboard data loaded');
        } catch (error) {
            console.error('Dashboard loading error:', error);
            this.showAlert('Failed to load dashboard data: ' + error.message, 'error');
        }
    }

    /**
     * Charger les statistiques rapides
     */
    async loadQuickStats() {
        try {
            const { data } = await this.makeRequest('/api/admin/dashboard/quick-stats');
            
            document.getElementById('totalPlayers').textContent = this.formatNumber(data.activePlayers || 0);
            document.getElementById('todayRevenue').textContent = `$${(data.todayRevenue || 0).toFixed(2)}`;
            document.getElementById('onlineAdmins').textContent = data.onlineAdmins || 0;
            
            const healthElement = document.getElementById('systemHealth');
            const health = data.systemHealth;
            healthElement.textContent = this.capitalizeFirst(health || 'Unknown');
            
            // Mettre à jour la classe CSS selon la santé
            const healthCard = document.getElementById('healthCard');
            healthCard.className = `stat-card health-card health-${health || 'unknown'}`;
            
        } catch (error) {
            console.error('Quick stats error:', error);
            // Ne pas afficher d'erreur pour les stats, juste logger
        }
    }

    /**
     * Charger les données d'aperçu
     */
    async loadOverviewData() {
        try {
            const { data } = await this.makeRequest('/api/admin/dashboard/overview');
            
            const overviewContent = document.getElementById('overviewContent');
            overviewContent.innerHTML = this.renderOverviewContent(data);
            
        } catch (error) {
            console.error('Overview data error:', error);
            document.getElementById('overviewContent').innerHTML = 
                '<div class="alert error">Failed to load overview data: ' + error.message + '</div>';
        }
    }

    /**
     * Rendu du contenu d'aperçu
     */
    renderOverviewContent(data) {
        return `
            <div class="overview-grid">
                <div class="overview-card">
                    <h3>🖥️ Server Metrics</h3>
                    <div class="metrics-list">
                        <div class="metric">
                            <span class="metric-label">Uptime:</span>
                            <span class="metric-value">${this.formatUptime(data.overview.uptime)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Total Players:</span>
                            <span class="metric-value">${this.formatNumber(data.overview.totalPlayers)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Active (24h):</span>
                            <span class="metric-value">${this.formatNumber(data.overview.activePlayers24h)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">New Players (24h):</span>
                            <span class="metric-value">${this.formatNumber(data.overview.newPlayers24h)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Error Rate:</span>
                            <span class="metric-value ${data.overview.errorRate > 5 ? 'error' : 'success'}">${data.overview.errorRate.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                <div class="overview-card">
                    <h3>💰 Economy</h3>
                    <div class="metrics-list">
                        <div class="metric">
                            <span class="metric-label">Total Revenue:</span>
                            <span class="metric-value">$${this.formatMoney(data.economy.revenue.total)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Daily Revenue:</span>
                            <span class="metric-value">$${this.formatMoney(data.economy.revenue.daily)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Paying Users:</span>
                            <span class="metric-value">${this.formatNumber(data.economy.conversion.payingUsers)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Conversion Rate:</span>
                            <span class="metric-value">${data.economy.conversion.conversionRate.toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">ARPU:</span>
                            <span class="metric-value">$${data.economy.conversion.averageRevenuePerUser.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div class="overview-card">
                    <h3>📊 Player Retention</h3>
                    <div class="metrics-list">
                        <div class="metric">
                            <span class="metric-label">Day 1:</span>
                            <span class="metric-value retention-${this.getRetentionClass(data.players.retention.day1)}">${data.players.retention.day1.toFixed(1)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Day 7:</span>
                            <span class="metric-value retention-${this.getRetentionClass(data.players.retention.day7)}">${data.players.retention.day7.toFixed(1)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Day 30:</span>
                            <span class="metric-value retention-${this.getRetentionClass(data.players.retention.day30)}">${data.players.retention.day30.toFixed(1)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg Level:</span>
                            <span class="metric-value">${data.players.progression.averageLevel.toFixed(1)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg Playtime:</span>
                            <span class="metric-value">${this.formatNumber(data.players.engagement.averagePlaytime)} min</span>
                        </div>
                    </div>
                </div>

                <div class="overview-card">
                    <h3>🚨 System Alerts</h3>
                    <div class="alerts-list">
                        ${data.alerts.length === 0 
                            ? '<div class="no-alerts">✅ No active alerts</div>' 
                            : data.alerts.slice(0, 5).map(alert => `
                                <div class="alert-item alert-${alert.severity}">
                                    <span class="alert-type">${alert.type}</span>
                                    <span class="alert-message">${alert.message}</span>
                                    <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher une section spécifique
     */
    showSection(sectionName) {
        // Sauvegarder la section actuelle
        this.currentSection = sectionName;
        
        // Masquer toutes les sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Retirer active de tous les onglets
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Afficher la section sélectionnée et activer l'onglet
        const sectionElement = document.getElementById(sectionName + 'Section');
        const tabElement = document.querySelector(`.nav-tab[onclick*="${sectionName}"]`);
        
        if (sectionElement) sectionElement.classList.add('active');
        if (tabElement) tabElement.classList.add('active');
        
        // Charger les données spécifiques à la section
        this.loadSectionData(sectionName);
    }

    /**
     * Charger les données d'une section
     */
    loadSectionData(sectionName) {
        switch(sectionName) {
            case 'players':
                // Utiliser le module PlayersModule si disponible
                if (window.PlayersModule && typeof PlayersModule.loadData === 'function') {
                    console.log('📋 Loading players data via PlayersModule...');
                    PlayersModule.loadData();
                } else {
                    console.warn('PlayersModule not available, showing placeholder');
                    this.showPlaceholder('playersContent', 'Players', '👥');
                }
                break;
            case 'economy':
                this.showPlaceholder('economyContent', 'Economy', '💰');
                break;
            case 'logs':
                this.showPlaceholder('logsContent', 'Audit Logs', '📜');
                break;
            case 'system':
                this.loadSystemInfo();
                break;
            case 'overview':
                // Recharger les données d'aperçu si nécessaire
                this.loadOverviewData();
                break;
        }
    }

    /**
     * Charger les informations système
     */
    async loadSystemInfo() {
        const content = document.getElementById('systemContent');
        content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading system information...</p></div>';
        
        try {
            const { data } = await this.makeRequest('/api/admin/dashboard/server-metrics');
            content.innerHTML = `
                <div class="system-info-grid">
                    <div class="info-card">
                        <h3>🖥️ Server Status</h3>
                        <table class="info-table">
                            <tr><td>Uptime</td><td>${this.formatUptime(data.uptime)}</td></tr>
                            <tr><td>Memory Usage</td><td>${(data.system.memory.heapUsed / 1024 / 1024).toFixed(2)} MB</td></tr>
                            <tr><td>Memory Total</td><td>${(data.system.memory.heapTotal / 1024 / 1024).toFixed(2)} MB</td></tr>
                            <tr><td>Node.js Version</td><td>${data.system.nodeVersion}</td></tr>
                            <tr><td>Platform</td><td>${this.capitalizeFirst(data.system.platform)}</td></tr>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = `<div class="alert error">Failed to load system information: ${error.message}</div>`;
        }
    }

    /**
     * Afficher un placeholder pour les modules non implémentés
     */
    showPlaceholder(contentId, moduleName, icon) {
        const content = document.getElementById(contentId);
        if (content) {
            content.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">${icon}</div>
                    <h3>🚧 ${moduleName} Module</h3>
                    <p>This module is coming soon...</p>
                    <p class="placeholder-hint">This will include comprehensive ${moduleName.toLowerCase()} management tools.</p>
                </div>
            `;
        }
    }

    /**
     * Démarrer l'actualisation automatique
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.loadQuickStats();
            
            // Actualiser aussi les données de la section active
            if (this.currentSection === 'overview') {
                this.loadOverviewData();
            }
        }, 30000); // 30 secondes
    }

    // === UTILITAIRES DE FORMATAGE ===

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatMoney(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getRetentionClass(rate) {
        if (rate >= 70) return 'excellent';
        if (rate >= 50) return 'good';
        if (rate >= 30) return 'average';
        return 'poor';
    }
}

// Créer l'instance globale
window.AdminCore = new AdminCore();

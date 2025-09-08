// server/src/services/arena/ArenaCache.ts

/**
 * CACHE EN MÉMOIRE POUR L'ARÈNE
 * Optimise les performances sans dépendance externe
 * Données perdues au restart (acceptable pour un cache)
 */
export class ArenaCache {
  
  // Cache en mémoire avec Map native
  private static cache = new Map<string, { data: any; expires: number; hits: number }>();
  
  // Configuration TTL (Time To Live)
  private static readonly TTL = {
    leaderboard: 5 * 60 * 1000,      // 5 minutes - Classements
    opponents: 1 * 60 * 1000,        // 1 minute - Adversaires
    playerStats: 3 * 60 * 1000,      // 3 minutes - Stats joueur
    seasonData: 30 * 60 * 1000,      // 30 minutes - Données saison
    serverStats: 10 * 60 * 1000,     // 10 minutes - Stats serveur
    matchHistory: 5 * 60 * 1000,     // 5 minutes - Historique matchs
    overview: 2 * 60 * 1000          // 2 minutes - Vue d'ensemble
  };

  // Statistiques du cache
  private static stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    startTime: Date.now()
  };

  // ===== MÉTHODES PRINCIPALES =====

  /**
   * Récupérer une valeur du cache
   */
  private static get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // Vérifier expiration
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Incrémenter compteur de hits
    item.hits++;
    this.stats.hits++;
    
    return item.data;
  }

  /**
   * Stocker une valeur dans le cache
   */
  private static set(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      hits: 0
    });
    this.stats.sets++;
  }

  /**
   * Invalider une clé ou un pattern
   */
  private static invalidate(pattern: string): number {
    let deleted = 0;
    
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    this.stats.invalidations += deleted;
    return deleted;
  }

  // ===== CACHE CLASSEMENTS =====

  /**
   * Obtenir le classement avec cache
   */
  public static async getLeaderboard(
    serverId: string, 
    league?: string, 
    limit: number = 50
  ): Promise<any> {
    const key = `leaderboard:${serverId}:${league || 'all'}:${limit}`;
    const cached = this.get(key);
    
    if (cached) {
      console.log(`🎯 Cache HIT: Leaderboard ${serverId}/${league}`);
      return cached;
    }

    // Cache MISS - calculer
    console.log(`🔄 Cache MISS: Calcul leaderboard ${serverId}/${league}`);
    try {
      const { ArenaSeasons } = await import('./ArenaSeasons');
      const leaderboard = await ArenaSeasons.getCurrentSeasonLeaderboard(serverId, league as any, limit);
      
      // Mettre en cache seulement si succès
      if (leaderboard.success) {
        this.set(key, leaderboard, this.TTL.leaderboard);
        console.log(`💾 Leaderboard mis en cache pour ${this.TTL.leaderboard / 1000}s`);
      }
      
      return leaderboard;
      
    } catch (error) {
      console.error('❌ Erreur getLeaderboard cache:', error);
      // Fallback direct sans cache
      const { ArenaSeasons } = await import('./ArenaSeasons');
      return await ArenaSeasons.getCurrentSeasonLeaderboard(serverId, league as any, limit);
    }
  }

  /**
   * Invalider les classements d'un serveur
   */
  public static invalidateLeaderboard(serverId: string): number {
    const deleted = this.invalidate(`leaderboard:${serverId}`);
    console.log(`🗑️ ${deleted} classements invalidés pour ${serverId}`);
    return deleted;
  }

  // ===== CACHE ADVERSAIRES =====

  /**
   * Obtenir des adversaires avec cache
   */
  public static async getOpponents(
    playerId: string,
    serverId: string,
    searchParams: any
  ): Promise<any> {
    // Créer une clé basée sur les paramètres de recherche
    const paramKey = JSON.stringify(searchParams).substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
    const key = `opponents:${playerId}:${paramKey}`;
    const cached = this.get(key);
    
    if (cached) {
      console.log(`🎯 Cache HIT: Adversaires ${playerId}`);
      return cached;
    }

    // Cache MISS - calculer
    console.log(`🔄 Cache MISS: Recherche adversaires ${playerId}`);
    try {
      const { ArenaMatchmaking } = await import('./ArenaMatchmaking');
      const opponents = await ArenaMatchmaking.findAdvancedOpponents(playerId, serverId, searchParams);
      
      // Mettre en cache seulement si succès
      if (opponents.success) {
        this.set(key, opponents, this.TTL.opponents);
        console.log(`💾 Adversaires mis en cache pour ${this.TTL.opponents / 1000}s`);
      }
      
      return opponents;
      
    } catch (error) {
      console.error('❌ Erreur getOpponents cache:', error);
      // Fallback direct
      const { ArenaMatchmaking } = await import('./ArenaMatchmaking');
      return await ArenaMatchmaking.findAdvancedOpponents(playerId, serverId, searchParams);
    }
  }

  /**
   * Invalider le cache des adversaires d'un joueur
   */
  public static invalidatePlayerOpponents(playerId: string): number {
    const deleted = this.invalidate(`opponents:${playerId}`);
    console.log(`🗑️ Cache adversaires invalidé pour ${playerId} (${deleted} entrées)`);
    return deleted;
  }

  // ===== CACHE STATS JOUEUR =====

  /**
   * Obtenir les stats d'un joueur avec cache
   */
  public static async getPlayerStats(playerId: string, serverId: string): Promise<any> {
    const key = `stats:${playerId}:${serverId}`;
    const cached = this.get(key);
    
    if (cached) {
      console.log(`🎯 Cache HIT: Stats ${playerId}`);
      return cached;
    }

    // Cache MISS - calculer
    console.log(`🔄 Cache MISS: Calcul stats ${playerId}`);
    try {
      const { ArenaCore } = await import('./ArenaCore');
      const stats = await ArenaCore.getPlayerStats(playerId, serverId);
      
      if (stats.success) {
        this.set(key, stats, this.TTL.playerStats);
        console.log(`💾 Stats joueur mis en cache pour ${this.TTL.playerStats / 1000}s`);
      }
      
      return stats;
      
    } catch (error) {
      console.error('❌ Erreur getPlayerStats cache:', error);
      const { ArenaCore } = await import('./ArenaCore');
      return await ArenaCore.getPlayerStats(playerId, serverId);
    }
  }

  /**
   * Invalider les stats d'un joueur
   */
  public static invalidatePlayerStats(playerId: string, serverId: string): boolean {
    const key = `stats:${playerId}:${serverId}`;
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Stats invalidées pour ${playerId}`);
      this.stats.invalidations++;
    }
    return deleted;
  }

  // ===== CACHE OVERVIEW =====

  /**
   * Obtenir l'aperçu d'arène avec cache
   */
  public static async getPlayerOverview(playerId: string, serverId: string): Promise<any> {
    const key = `overview:${playerId}:${serverId}`;
    const cached = this.get(key);
    
    if (cached) {
      console.log(`🎯 Cache HIT: Overview ${playerId}`);
      return cached;
    }

    console.log(`🔄 Cache MISS: Calcul overview ${playerId}`);
    try {
      const { ArenaService } = await import('./index');
      const overview = await ArenaService.getPlayerArenaOverview(playerId, serverId);
      
      if (overview.success) {
        this.set(key, overview, this.TTL.overview);
        console.log(`💾 Overview mis en cache pour ${this.TTL.overview / 1000}s`);
      }
      
      return overview;
      
    } catch (error) {
      console.error('❌ Erreur getPlayerOverview cache:', error);
      const { ArenaService } = await import('./index');
      return await ArenaService.getPlayerArenaOverview(playerId, serverId);
    }
  }

  // ===== CACHE SAISON =====

  /**
   * Obtenir les données de saison avec cache
   */
  public static async getSeasonData(serverId: string): Promise<any> {
    const key = `season:${serverId}`;
    const cached = this.get(key);
    
    if (cached) {
      console.log(`🎯 Cache HIT: Saison ${serverId}`);
      return cached;
    }

    console.log(`🔄 Cache MISS: Données saison ${serverId}`);
    try {
      const { ArenaSeasons } = await import('./ArenaSeasons');
      const season = await ArenaSeasons.getCurrentSeason(serverId);
      
      if (season) {
        this.set(key, season, this.TTL.seasonData);
        console.log(`💾 Saison mise en cache pour ${this.TTL.seasonData / 1000}s`);
      }
      
      return season;
      
    } catch (error) {
      console.error('❌ Erreur getSeasonData cache:', error);
      const { ArenaSeasons } = await import('./ArenaSeasons');
      return await ArenaSeasons.getCurrentSeason(serverId);
    }
  }

  // ===== INVALIDATION INTELLIGENTE =====

  /**
   * Invalider tous les caches après un combat
   */
  public static invalidateAfterMatch(attackerId: string, defenderId: string, serverId: string): void {
    console.log(`🔄 Invalidation post-combat: ${attackerId} vs ${defenderId}`);

    let totalDeleted = 0;
    
    // Invalider classements du serveur
    totalDeleted += this.invalidateLeaderboard(serverId);
    
    // Invalider stats des 2 joueurs
    this.invalidatePlayerStats(attackerId, serverId);
    this.invalidatePlayerStats(defenderId, serverId);
    totalDeleted += 2;
    
    // Invalider adversaires des 2 joueurs
    totalDeleted += this.invalidatePlayerOpponents(attackerId);
    totalDeleted += this.invalidatePlayerOpponents(defenderId);
    
    // Invalider overview des 2 joueurs
    totalDeleted += this.invalidate(`overview:${attackerId}`);
    totalDeleted += this.invalidate(`overview:${defenderId}`);

    console.log(`✅ Cache invalidé après combat: ${totalDeleted} entrées supprimées`);
  }

  /**
   * Invalider le cache après changement de saison
   */
  public static invalidateAfterSeasonChange(serverId: string): void {
    console.log(`🔄 Invalidation changement de saison: ${serverId}`);

    let totalDeleted = 0;
    totalDeleted += this.invalidate(`leaderboard:${serverId}`);
    totalDeleted += this.invalidate(`season:${serverId}`);
    totalDeleted += this.invalidate(`stats:`);
    totalDeleted += this.invalidate(`overview:`);

    console.log(`✅ Cache invalidé après changement saison: ${totalDeleted} entrées`);
  }

  // ===== MAINTENANCE ET STATS =====

  /**
   * Nettoyage automatique des entrées expirées
   */
  public static performMaintenance(): number {
    console.log(`🧹 Maintenance cache ArenaCache...`);
    
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, item] of this.cache) {
      if (now > item.expires) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    console.log(`✅ Maintenance terminée: ${deletedCount} entrées expirées supprimées`);
    return deletedCount;
  }

  /**
   * Obtenir les statistiques du cache
   */
  public static getCacheStats(): any {
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.stats.startTime) / 1000);
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100) : 0;
    
    // Calculer la taille mémoire approximative
    let totalMemoryKB = 0;
    for (const [key, item] of this.cache) {
      totalMemoryKB += (key.length + JSON.stringify(item.data).length) / 1024;
    }

    return {
      available: true,
      uptime: uptimeSeconds,
      entries: this.cache.size,
      memoryUsageKB: Math.round(totalMemoryKB),
      stats: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        sets: this.stats.sets,
        invalidations: this.stats.invalidations,
        hitRate: Math.round(hitRate * 100) / 100
      },
      topEntries: this.getTopEntries()
    };
  }

  /**
   * Obtenir les entrées les plus utilisées
   */
  private static getTopEntries(): Array<{ key: string; hits: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, hits: item.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);
    
    return entries;
  }

  /**
   * Vider tout le cache (admin)
   */
  public static clearAllCache(): number {
    const size = this.cache.size;
    this.cache.clear();
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: size,
      startTime: Date.now()
    };
    
    console.log(`🗑️ Cache Arena vidé: ${size} entrées supprimées`);
    return size;
  }

  /**
   * Obtenir toutes les clés du cache (debug)
   */
  public static getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Forcer l'expiration d'une clé
   */
  public static expireKey(key: string): boolean {
    return this.cache.delete(key);
  }
}

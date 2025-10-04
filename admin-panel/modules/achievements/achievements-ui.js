/**
 * AchievementsUI - Helpers et utilitaires UI pour le module Achievements
 */
class AchievementsUI {
  
  /**
   * Obtenir l'icône d'une catégorie
   */
  getCategoryIcon(category) {
    const icons = {
      'combat': '⚔️',
      'progression': '📈',
      'collection': '📦',
      'social': '👥',
      'exploration': '🗺️',
      'economy': '💰',
      'special': '⭐',
      'event': '🎉',
      'daily': '📅',
      'challenge': '🏆'
    };
    return icons[category] || '🎯';
  }

  /**
   * Obtenir la couleur d'une catégorie
   */
  getCategoryColor(category) {
    const colors = {
      'combat': '#dc3545',
      'progression': '#28a745',
      'collection': '#17a2b8',
      'social': '#ffc107',
      'exploration': '#6c757d',
      'economy': '#fd7e14',
      'special': '#e83e8c',
      'event': '#6f42c1',
      'daily': '#20c997',
      'challenge': '#007bff'
    };
    return colors[category] || '#6c757d';
  }

  /**
   * Obtenir le badge d'une catégorie
   */
  getCategoryBadge(category) {
    return {
      icon: this.getCategoryIcon(category),
      color: this.getCategoryColor(category),
      name: this.capitalizeFirst(category)
    };
  }

  /**
   * Obtenir la classe CSS d'une rareté
   */
  getRarityClass(rarity) {
    const classes = {
      'common': 'badge-secondary',
      'rare': 'badge-info',
      'epic': 'badge-primary',
      'legendary': 'badge-warning',
      'mythic': 'badge-danger'
    };
    return classes[rarity] || 'badge-secondary';
  }

  /**
   * Formater les points
   */
  formatPoints(points) {
    if (points >= 1000) {
      return (points / 1000).toFixed(1) + 'K';
    }
    return points.toString();
  }

  /**
   * Formater un nombre avec séparateurs
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Échapper HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Capitaliser la première lettre
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Rendre une barre de progression
   */
  renderProgressBar(current, target, color = '#667eea') {
    const percentage = Math.min((current / target) * 100, 100);
    
    return `
      <div class="achievement-progress-bar">
        <div class="progress-info">
          <span>${current} / ${target}</span>
          <span>${percentage.toFixed(1)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${percentage}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }

  /**
   * Afficher un indicateur de chargement
   */
  showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Afficher un message "pas de données"
   */
  showNoData(containerId, message = 'No achievements found') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="no-data">
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Afficher un message d'erreur
   */
  showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="alert error">
          <strong>Error:</strong> ${this.escapeHtml(message)}
        </div>
      `;
    }
  }

  /**
   * Rendre un badge de difficulté
   */
  renderDifficultyBadge(difficulty) {
    const badges = {
      'easy': { text: 'Easy', class: 'badge-success' },
      'medium': { text: 'Medium', class: 'badge-warning' },
      'hard': { text: 'Hard', class: 'badge-danger' },
      'extreme': { text: 'Extreme', class: 'badge-critical' }
    };
    
    const badge = badges[difficulty] || badges.easy;
    return `<span class="badge ${badge.class}">${badge.text}</span>`;
  }

  /**
   * Formater une date
   */
  formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Formater une date et heure
   */
  formatDateTime(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }
}

// Créer l'instance globale
window.AchievementsUI = new AchievementsUI();

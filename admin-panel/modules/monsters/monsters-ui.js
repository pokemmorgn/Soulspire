/**
 * MonstersUI - Helpers et utilitaires UI pour le module Monsters
 */
class MonstersUI {
  
  /**
   * Obtenir l'icône d'un élément
   */
  getElementIcon(element) {
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

  /**
   * Obtenir la couleur d'un élément
   */
  getElementColor(element) {
    const colors = {
      'Fire': '#ff6b6b',
      'Water': '#4dabf7',
      'Wind': '#51cf66',
      'Electric': '#ffd43b',
      'Light': '#ffe066',
      'Dark': '#9775fa'
    };
    return colors[element] || '#adb5bd';
  }

  /**
   * Obtenir l'icône d'un rôle
   */
  getRoleIcon(role) {
    const icons = {
      'Tank': '🛡️',
      'DPS Melee': '⚔️',
      'DPS Ranged': '🏹',
      'Support': '💚'
    };
    return icons[role] || '❓';
  }

  /**
   * Obtenir la classe CSS d'un type de monstre
   */
  getTypeClass(type) {
    const classes = {
      'normal': 'monster-normal',
      'elite': 'monster-elite',
      'boss': 'monster-boss'
    };
    return classes[type] || 'monster-normal';
  }

  /**
   * Obtenir le badge d'un type de monstre
   */
  getTypeBadge(type) {
    const badges = {
      'normal': { text: 'Normal', class: 'badge-secondary' },
      'elite': { text: 'Elite', class: 'badge-warning' },
      'boss': { text: 'Boss', class: 'badge-danger' }
    };
    return badges[type] || badges.normal;
  }

  /**
   * Obtenir la classe CSS d'une rareté
   */
  getRarityClass(rarity) {
    const classes = {
      'Common': 'rarity-common',
      'Rare': 'rarity-rare',
      'Epic': 'rarity-epic',
      'Legendary': 'rarity-legendary',
      'Mythic': 'rarity-mythic'
    };
    return classes[rarity] || 'rarity-common';
  }

  /**
   * Obtenir la couleur d'une rareté
   */
  getRarityColor(rarity) {
    const colors = {
      'Common': '#adb5bd',
      'Rare': '#339af0',
      'Epic': '#9775fa',
      'Legendary': '#ffd43b',
      'Mythic': '#ff6b6b'
    };
    return colors[rarity] || '#adb5bd';
  }

  /**
   * Formater les world tags
   */
  formatWorldTags(worldTags) {
    if (!worldTags || worldTags.length === 0) {
      return '<span class="badge badge-secondary">All Worlds</span>';
    }

    if (worldTags.length <= 3) {
      return worldTags.map(w => `<span class="badge badge-info">World ${w}</span>`).join(' ');
    }

    const first3 = worldTags.slice(0, 3);
    const remaining = worldTags.length - 3;
    return first3.map(w => `<span class="badge badge-info">World ${w}</span>`).join(' ') + 
           ` <span class="badge badge-secondary">+${remaining} more</span>`;
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Capitaliser la première lettre
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Obtenir l'émoji du thème visuel
   */
  getThemeIcon(theme) {
    const icons = {
      'forest': '🌲',
      'beast': '🐺',
      'undead': '💀',
      'demon': '👿',
      'elemental': '🌟',
      'construct': '🗿',
      'celestial': '👼',
      'shadow': '🌑',
      'dragon': '🐉',
      'giant': '🏔️',
      'insect': '🐛',
      'aquatic': '🐟',
      'corrupted': '🧟'
    };
    return icons[theme] || '❓';
  }

  /**
   * Rendre une barre de progression pour les stats
   */
  renderStatBar(label, value, maxValue, color = '#667eea') {
    const percentage = Math.min((value / maxValue) * 100, 100);
    
    return `
      <div class="stat-bar-container">
        <div class="stat-bar-label">
          <span>${label}</span>
          <span class="stat-bar-value">${this.formatNumber(value)}</span>
        </div>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" style="width: ${percentage}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }

  /**
   * Créer un élément de filtre
   */
  createFilterSelect(id, label, options, currentValue = '') {
    let html = `
      <div class="filter-group">
        <label for="${id}">${label}:</label>
        <select id="${id}" class="form-control">
          <option value="">All</option>
    `;

    options.forEach(opt => {
      const selected = opt.value === currentValue ? 'selected' : '';
      html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    });

    html += `
        </select>
      </div>
    `;

    return html;
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
  showNoData(containerId, message = 'No data available') {
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
}

// Créer l'instance globale
window.MonstersUI = new MonstersUI();

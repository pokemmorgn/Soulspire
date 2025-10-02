/**
 * PlayersUI - Helpers et utilitaires UI pour le module Players
 */
class PlayersUI {
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

window.PlayersUI = new PlayersUI();

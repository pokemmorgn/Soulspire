// server/src/config/DailyRewardsConfig.ts

/**
 * CONFIGURATION DES RÉCOMPENSES QUOTIDIENNES
 * 
 * Modifier ce fichier pour ajuster les récompenses sans toucher au code
 * Les valeurs sont des BASE VALUES - les bonus VIP/Streak sont appliqués automatiquement
 */

export interface DailyRewardItemConfig {
  type: "gold" | "gems" | "tickets" | "hero_fragment" | "material" | "item";
  itemId?: string; // ID de l'objet dans la base de données
  quantity: number;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  description?: string; // Description pour les admins
}

export interface DailyRewardDayConfig {
  day: number;
  title: string; // Ex: "Jour 1 - Bienvenue"
  description?: string;
  rewards: DailyRewardItemConfig[];
  isSpecial?: boolean; // Jour spécial avec animation particulière
  iconUrl?: string; // Icône custom pour ce jour
}

// ===== CONFIGURATION PRINCIPALE =====

export const DAILY_REWARDS_CONFIG = {
  // Paramètres généraux
  cycleDays: 30, // Nombre de jours dans le cycle complet
  maxHistorySize: 90, // Nombre de claims gardés dans l'historique
  
  // Reset du streak
  streakResetAfterMissedDays: 2, // Combien de jours ratés avant reset
  allowStreakRecovery: false, // Permettre de rattraper 1 jour raté (future feature)
  
  // Bonus de streak
  streakBonuses: {
    tier1: { days: 7, multiplier: 1.25, name: "Bronze Streak" },
    tier2: { days: 14, multiplier: 1.5, name: "Silver Streak" },
    tier3: { days: 30, multiplier: 2.0, name: "Gold Streak" }
  },
  
  // Bonus VIP
  vipBonusPerLevel: 0.1, // +10% par niveau VIP (calculé automatiquement)
  
  // Notifications
  sendNotificationOnAvailable: true,
  sendMailOnMissed: true,
  reminderHoursBefore: 6 // Rappel X heures avant minuit
};

// ===== RÉCOMPENSES PAR JOUR =====

export const DAILY_REWARDS_BY_DAY: DailyRewardDayConfig[] = [
  // === SEMAINE 1 (Jours 1-7) - RÉCOMPENSES DE BASE ===
  {
    day: 1,
    title: "Jour 1 - Bienvenue !",
    description: "Première connexion quotidienne",
    rewards: [
      { type: "gold", quantity: 500, description: "Or de bienvenue" },
      { type: "gems", quantity: 10, description: "Gemmes de départ" }
    ]
  },
  {
    day: 2,
    title: "Jour 2 - Continue !",
    rewards: [
      { type: "gold", quantity: 600 },
      { type: "gems", quantity: 15 },
      { type: "tickets", quantity: 1, description: "Premier ticket d'invocation" }
    ]
  },
  {
    day: 3,
    title: "Jour 3 - Progression",
    rewards: [
      { type: "gold", quantity: 700 },
      { type: "gems", quantity: 20 },
      { type: "material", itemId: "common_essence", quantity: 5, rarity: "Common" }
    ]
  },
  {
    day: 4,
    title: "Jour 4 - Matériaux",
    rewards: [
      { type: "gold", quantity: 800 },
      { type: "gems", quantity: 25 },
      { type: "material", itemId: "enhancement_stone", quantity: 3, rarity: "Common" }
    ]
  },
  {
    day: 5,
    title: "Jour 5 - Bonus Invocation",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 1000 },
      { type: "gems", quantity: 30 },
      { type: "tickets", quantity: 2, description: "Tickets bonus" },
      { type: "material", itemId: "rare_essence", quantity: 3, rarity: "Rare" }
    ]
  },
  {
    day: 6,
    title: "Jour 6 - Fragments",
    rewards: [
      { type: "gold", quantity: 1200 },
      { type: "gems", quantity: 35 },
      { type: "hero_fragment", itemId: "random_common_hero", quantity: 5, rarity: "Common" }
    ]
  },
  {
    day: 7,
    title: "Jour 7 - Première Semaine ! 🎉",
    description: "Félicitations pour votre première semaine !",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 2000 },
      { type: "gems", quantity: 50 },
      { type: "tickets", quantity: 3 },
      { type: "hero_fragment", itemId: "random_rare_hero", quantity: 10, rarity: "Rare" },
      { type: "material", itemId: "epic_essence", quantity: 2, rarity: "Epic" }
    ]
  },

  // === SEMAINE 2 (Jours 8-14) - RÉCOMPENSES AMÉLIORÉES ===
  {
    day: 8,
    title: "Jour 8 - Nouvelle Semaine",
    rewards: [
      { type: "gold", quantity: 1500 },
      { type: "gems", quantity: 40 },
      { type: "material", itemId: "rare_essence", quantity: 5, rarity: "Rare" }
    ]
  },
  {
    day: 9,
    title: "Jour 9 - Montée en Puissance",
    rewards: [
      { type: "gold", quantity: 1600 },
      { type: "gems", quantity: 45 },
      { type: "material", itemId: "enhancement_stone", quantity: 10, rarity: "Rare" }
    ]
  },
  {
    day: 10,
    title: "Jour 10 - Jalon Spécial",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 2500 },
      { type: "gems", quantity: 60 },
      { type: "tickets", quantity: 4 },
      { type: "material", itemId: "legendary_shard", quantity: 1, rarity: "Legendary" }
    ]
  },
  {
    day: 11,
    title: "Jour 11 - Fragments Épiques",
    rewards: [
      { type: "gold", quantity: 1800 },
      { type: "gems", quantity: 50 },
      { type: "hero_fragment", itemId: "random_epic_hero", quantity: 5, rarity: "Epic" }
    ]
  },
  {
    day: 12,
    title: "Jour 12 - Boost Matériaux",
    rewards: [
      { type: "gold", quantity: 2000 },
      { type: "gems", quantity: 55 },
      { type: "material", itemId: "ascension_stone", quantity: 3, rarity: "Epic" }
    ]
  },
  {
    day: 13,
    title: "Jour 13 - Presque 2 Semaines",
    rewards: [
      { type: "gold", quantity: 2200 },
      { type: "gems", quantity: 60 },
      { type: "tickets", quantity: 3 },
      { type: "material", itemId: "divine_crystal", quantity: 2, rarity: "Epic" }
    ]
  },
  {
    day: 14,
    title: "Jour 14 - Deux Semaines ! 🏆",
    description: "Fidélité impressionnante !",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 3000 },
      { type: "gems", quantity: 100 },
      { type: "tickets", quantity: 5 },
      { type: "hero_fragment", itemId: "random_epic_hero", quantity: 15, rarity: "Epic" },
      { type: "material", itemId: "legendary_essence", quantity: 3, rarity: "Legendary" },
      { type: "item", itemId: "rare_chest", quantity: 1, rarity: "Rare" }
    ]
  },

  // === SEMAINE 3 (Jours 15-21) - RÉCOMPENSES PREMIUM ===
  {
    day: 15,
    title: "Jour 15 - Demi-Mois",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 2500 },
      { type: "gems", quantity: 75 },
      { type: "tickets", quantity: 4 },
      { type: "material", itemId: "stellar_essence", quantity: 2, rarity: "Legendary" }
    ]
  },
  {
    day: 16,
    title: "Jour 16 - Élite",
    rewards: [
      { type: "gold", quantity: 2600 },
      { type: "gems", quantity: 80 },
      { type: "hero_fragment", itemId: "random_epic_hero", quantity: 8, rarity: "Epic" }
    ]
  },
  {
    day: 17,
    title: "Jour 17 - Ascension",
    rewards: [
      { type: "gold", quantity: 2700 },
      { type: "gems", quantity: 85 },
      { type: "material", itemId: "ascension_stone", quantity: 5, rarity: "Epic" }
    ]
  },
  {
    day: 18,
    title: "Jour 18 - Forge Divine",
    rewards: [
      { type: "gold", quantity: 2800 },
      { type: "gems", quantity: 90 },
      { type: "material", itemId: "divine_crystal", quantity: 4, rarity: "Epic" }
    ]
  },
  {
    day: 19,
    title: "Jour 19 - Héros Légendaire",
    rewards: [
      { type: "gold", quantity: 2900 },
      { type: "gems", quantity: 95 },
      { type: "hero_fragment", itemId: "random_legendary_hero", quantity: 5, rarity: "Legendary" }
    ]
  },
  {
    day: 20,
    title: "Jour 20 - Jalon Majeur",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 4000 },
      { type: "gems", quantity: 120 },
      { type: "tickets", quantity: 6 },
      { type: "material", itemId: "cosmic_shard", quantity: 2, rarity: "Legendary" },
      { type: "item", itemId: "epic_chest", quantity: 1, rarity: "Epic" }
    ]
  },
  {
    day: 21,
    title: "Jour 21 - Trois Semaines ! 🌟",
    description: "Joueur dévoué !",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 5000 },
      { type: "gems", quantity: 150 },
      { type: "tickets", quantity: 7 },
      { type: "hero_fragment", itemId: "random_legendary_hero", quantity: 20, rarity: "Legendary" },
      { type: "material", itemId: "mythic_essence", quantity: 3, rarity: "Legendary" },
      { type: "item", itemId: "legendary_chest", quantity: 1, rarity: "Legendary" }
    ]
  },

  // === SEMAINE 4 (Jours 22-28) - RÉCOMPENSES MAXIMUM ===
  {
    day: 22,
    title: "Jour 22 - Élite Suprême",
    rewards: [
      { type: "gold", quantity: 3500 },
      { type: "gems", quantity: 100 },
      { type: "material", itemId: "stellar_essence", quantity: 4, rarity: "Legendary" }
    ]
  },
  {
    day: 23,
    title: "Jour 23 - Puissance Maximum",
    rewards: [
      { type: "gold", quantity: 3600 },
      { type: "gems", quantity: 105 },
      { type: "hero_fragment", itemId: "random_legendary_hero", quantity: 10, rarity: "Legendary" }
    ]
  },
  {
    day: 24,
    title: "Jour 24 - Forge Mythique",
    rewards: [
      { type: "gold", quantity: 3700 },
      { type: "gems", quantity: 110 },
      { type: "material", itemId: "mythic_forge_stone", quantity: 3, rarity: "Legendary" }
    ]
  },
  {
    day: 25,
    title: "Jour 25 - Champion",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 5000 },
      { type: "gems", quantity: 140 },
      { type: "tickets", quantity: 8 },
      { type: "material", itemId: "celestial_fragment", quantity: 2, rarity: "Legendary" }
    ]
  },
  {
    day: 26,
    title: "Jour 26 - Presque Là",
    rewards: [
      { type: "gold", quantity: 3900 },
      { type: "gems", quantity: 120 },
      { type: "hero_fragment", itemId: "random_legendary_hero", quantity: 12, rarity: "Legendary" }
    ]
  },
  {
    day: 27,
    title: "Jour 27 - Avant-Dernier Jour",
    rewards: [
      { type: "gold", quantity: 4000 },
      { type: "gems", quantity: 125 },
      { type: "material", itemId: "divine_awakening_stone", quantity: 4, rarity: "Legendary" }
    ]
  },
  {
    day: 28,
    title: "Jour 28 - Quatre Semaines ! 💎",
    description: "Fidélité exceptionnelle !",
    isSpecial: true,
    rewards: [
      { type: "gold", quantity: 6000 },
      { type: "gems", quantity: 200 },
      { type: "tickets", quantity: 10 },
      { type: "hero_fragment", itemId: "selector_legendary_hero", quantity: 50, rarity: "Legendary", description: "Sélecteur de héros légendaire !" },
      { type: "material", itemId: "mythic_essence", quantity: 5, rarity: "Legendary" },
      { type: "item", itemId: "mythic_chest", quantity: 1, rarity: "Legendary" }
    ]
  },

  // === JOURS FINAUX (29-30) - RÉCOMPENSES ULTIMES ===
  {
    day: 29,
    title: "Jour 29 - Avant le Grand Jour",
    rewards: [
      { type: "gold", quantity: 4500 },
      { type: "gems", quantity: 140 },
      { type: "tickets", quantity: 7 },
      { type: "material", itemId: "celestial_fragment", quantity: 3, rarity: "Legendary" }
    ]
  },
  {
    day: 30,
    title: "Jour 30 - MOIS COMPLET ! 👑",
    description: "Joueur Légendaire ! Cycle complet accompli !",
    isSpecial: true,
    iconUrl: "/assets/rewards/day30_crown.png",
    rewards: [
      { type: "gold", quantity: 10000, description: "10K Or !" },
      { type: "gems", quantity: 300, description: "300 Gemmes !" },
      { type: "tickets", quantity: 15, description: "15 Tickets d'invocation !" },
      { type: "hero_fragment", itemId: "mythic_hero_selector", quantity: 100, rarity: "Legendary", description: "Sélecteur de héros MYTHIQUE complet !" },
      { type: "material", itemId: "celestial_essence", quantity: 10, rarity: "Legendary" },
      { type: "material", itemId: "transcendence_stone", quantity: 5, rarity: "Legendary" },
      { type: "item", itemId: "celestial_chest", quantity: 1, rarity: "Legendary" },
      { type: "item", itemId: "exclusive_title", quantity: 1, description: "Titre exclusif: 'Fidèle du Premier Mois'" }
    ]
  }
];

// ===== VALIDATION DE LA CONFIGURATION =====

export function validateDailyRewardsConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Vérifier que tous les jours 1-30 sont présents
  const dayNumbers = DAILY_REWARDS_BY_DAY.map(d => d.day).sort((a, b) => a - b);
  for (let i = 1; i <= DAILY_REWARDS_CONFIG.cycleDays; i++) {
    if (!dayNumbers.includes(i)) {
      errors.push(`Missing configuration for day ${i}`);
    }
  }
  
  // Vérifier les doublons
  const duplicates = dayNumbers.filter((day, index) => dayNumbers.indexOf(day) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate day configurations: ${duplicates.join(", ")}`);
  }
  
  // Vérifier que chaque jour a au moins une récompense
  DAILY_REWARDS_BY_DAY.forEach(dayConfig => {
    if (!dayConfig.rewards || dayConfig.rewards.length === 0) {
      errors.push(`Day ${dayConfig.day} has no rewards`);
    }
    
    // Vérifier les IDs d'objets requis
    dayConfig.rewards.forEach(reward => {
      const needsItemId = ["hero_fragment", "material", "item"];
      if (needsItemId.includes(reward.type) && !reward.itemId) {
        errors.push(`Day ${dayConfig.day}: ${reward.type} reward missing itemId`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Obtenir la config d'un jour spécifique
 */
export function getDayConfig(day: number): DailyRewardDayConfig | null {
  return DAILY_REWARDS_BY_DAY.find(d => d.day === day) || null;
}

/**
 * Obtenir tous les jours spéciaux
 */
export function getSpecialDays(): DailyRewardDayConfig[] {
  return DAILY_REWARDS_BY_DAY.filter(d => d.isSpecial);
}

/**
 * Calculer la valeur totale d'une journée (estimation)
 */
export function calculateDayValue(day: number): number {
  const config = getDayConfig(day);
  if (!config) return 0;
  
  let totalValue = 0;
  config.rewards.forEach(reward => {
    switch (reward.type) {
      case "gold":
        totalValue += reward.quantity * 0.001; // 1000 gold = 1 point
        break;
      case "gems":
        totalValue += reward.quantity * 1; // 1 gem = 1 point
        break;
      case "tickets":
        totalValue += reward.quantity * 10; // 1 ticket = 10 points
        break;
      case "hero_fragment":
        const fragmentValues = { "Common": 2, "Rare": 5, "Epic": 15, "Legendary": 50 };
        totalValue += reward.quantity * (fragmentValues[reward.rarity || "Common"] || 2);
        break;
      case "material":
        const materialValues = { "Common": 1, "Rare": 3, "Epic": 10, "Legendary": 30 };
        totalValue += reward.quantity * (materialValues[reward.rarity || "Common"] || 1);
        break;
      case "item":
        totalValue += reward.quantity * 50; // Items = 50 points base
        break;
    }
  });
  
  return Math.round(totalValue);
}

/**
 * Obtenir le multiplicateur de streak pour un nombre de jours
 */
export function getStreakMultiplier(streak: number): number {
  const bonuses = DAILY_REWARDS_CONFIG.streakBonuses;
  
  if (streak >= bonuses.tier3.days) return bonuses.tier3.multiplier;
  if (streak >= bonuses.tier2.days) return bonuses.tier2.multiplier;
  if (streak >= bonuses.tier1.days) return bonuses.tier1.multiplier;
  
  return 1.0;
}

/**
 * Obtenir le nom du tier de streak
 */
export function getStreakTierName(streak: number): string {
  const bonuses = DAILY_REWARDS_CONFIG.streakBonuses;
  
  if (streak >= bonuses.tier3.days) return bonuses.tier3.name;
  if (streak >= bonuses.tier2.days) return bonuses.tier2.name;
  if (streak >= bonuses.tier1.days) return bonuses.tier1.name;
  
  return "No Streak";
}

// ===== EXPORT PAR DÉFAUT =====
export default {
  config: DAILY_REWARDS_CONFIG,
  rewards: DAILY_REWARDS_BY_DAY,
  validate: validateDailyRewardsConfig,
  getDayConfig,
  getSpecialDays,
  calculateDayValue,
  getStreakMultiplier,
  getStreakTierName
};

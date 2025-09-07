import mongoose, { Document, Schema } from "mongoose";

export interface IVipBenefit {
  type: "battle_speed" | "daily_rewards" | "shop_discount" | "max_stamina" | "stamina_regen" | 
        "afk_rewards" | "fast_rewards" | "hero_slots" | "formation_slots" | "auto_battle" |
        "skip_battle" | "vip_shop" | "exclusive_summons" | "bonus_exp" | "bonus_gold" |
        "chat_privileges" | "daily_dungeon" | "weekly_dungeon";
  value: number | boolean | string;
  description: string;
  displayOrder: number;
}

export interface IVipUnlockReward {
  type: "currency" | "hero" | "material" | "item";
  currencyType?: "gold" | "gems" | "tickets";
  heroId?: string;
  materialId?: string;
  itemId?: string;
  quantity: number;
  rarity?: string;
}

export interface IVipConfiguration extends Document {
  level: number;
  title: string;
  requiredExp: number;
  totalExpRequired: number;
  benefits: IVipBenefit[];
  unlockRewards: IVipUnlockReward[];
  iconUrl?: string;
  bannerUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes
  getBenefit(benefitType: string): IVipBenefit | null;
  hasBenefit(benefitType: string): boolean;
  getBenefitValue(benefitType: string): number | boolean | string | null;
  calculateUnlockRewards(): { totalGold: number; totalGems: number; totalItems: number };
  isValidConfiguration(): { valid: boolean; errors: string[] };
}

const vipBenefitSchema = new Schema<IVipBenefit>({
  type: {
    type: String,
    required: true,
    enum: [
      "battle_speed", "daily_rewards", "shop_discount", "max_stamina", "stamina_regen",
      "afk_rewards", "fast_rewards", "hero_slots", "formation_slots", "auto_battle",
      "skip_battle", "vip_shop", "exclusive_summons", "bonus_exp", "bonus_gold",
      "chat_privileges", "daily_dungeon", "weekly_dungeon"
    ]
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  displayOrder: {
    type: Number,
    default: 0
  }
});

const vipUnlockRewardSchema = new Schema<IVipUnlockReward>({
  type: {
    type: String,
    required: true,
    enum: ["currency", "hero", "material", "item"]
  },
  currencyType: {
    type: String,
    enum: ["gold", "gems", "tickets"],
    required: function() { return this.type === "currency"; }
  },
  heroId: {
    type: String,
    required: function() { return this.type === "hero"; }
  },
  materialId: {
    type: String,
    required: function() { return this.type === "material"; }
  },
  itemId: {
    type: String,
    required: function() { return this.type === "item"; }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  rarity: {
    type: String,
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"],
    default: null
  }
});

const vipConfigurationSchema = new Schema<IVipConfiguration>({
  level: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  requiredExp: {
    type: Number,
    required: true,
    min: 0
  },
  totalExpRequired: {
    type: Number,
    required: true,
    min: 0
  },
  benefits: [vipBenefitSchema],
  unlockRewards: [vipUnlockRewardSchema],
  iconUrl: {
    type: String,
    default: null,
    match: /^https?:\/\/.+/
  },
  bannerUrl: {
    type: String,
    default: null,
    match: /^https?:\/\/.+/
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: function() { return this.level; }
  }
}, {
  timestamps: true,
  collection: 'vip_configurations'
});

// Index pour performance
vipConfigurationSchema.index({ level: 1 }, { unique: true });
vipConfigurationSchema.index({ isActive: 1, sortOrder: 1 });
vipConfigurationSchema.index({ totalExpRequired: 1 });

// === MÉTHODES DU MODÈLE ===

// Obtenir un bénéfice spécifique
vipConfigurationSchema.methods.getBenefit = function(benefitType: string): IVipBenefit | null {
  const benefit = this.benefits.find((b: IVipBenefit) => b.type === benefitType);
  return benefit || null;
};

// Vérifier si a un bénéfice
vipConfigurationSchema.methods.hasBenefit = function(benefitType: string): boolean {
  return this.benefits.some((b: IVipBenefit) => b.type === benefitType);
};

// Obtenir la valeur d'un bénéfice
vipConfigurationSchema.methods.getBenefitValue = function(benefitType: string): number | boolean | string | null {
  const benefit = this.getBenefit(benefitType);
  return benefit ? benefit.value : null;
};

// Calculer les récompenses de déblocage
vipConfigurationSchema.methods.calculateUnlockRewards = function(): { totalGold: number; totalGems: number; totalItems: number } {
  let totalGold = 0;
  let totalGems = 0;
  let totalItems = 0;
  
  this.unlockRewards.forEach((reward: IVipUnlockReward) => {
    switch (reward.type) {
      case "currency":
        if (reward.currencyType === "gold") totalGold += reward.quantity;
        if (reward.currencyType === "gems") totalGems += reward.quantity;
        break;
      case "hero":
      case "material":
      case "item":
        totalItems += reward.quantity;
        break;
    }
  });
  
  return { totalGold, totalGems, totalItems };
};

// Valider la configuration
vipConfigurationSchema.methods.isValidConfiguration = function(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (this.level < 0) errors.push("Level cannot be negative");
  if (this.requiredExp < 0) errors.push("Required EXP cannot be negative");
  if (this.totalExpRequired < 0) errors.push("Total EXP required cannot be negative");
  if (this.level > 0 && this.totalExpRequired <= 0) errors.push("Non-zero levels must have total EXP > 0");
  
  // Vérifier que les bénéfices ont des valeurs cohérentes
  this.benefits.forEach((benefit: IVipBenefit, index: number) => {
    if (typeof benefit.value === "number" && benefit.value < 0) {
      errors.push(`Benefit ${index} (${benefit.type}) has negative value`);
    }
    if (!benefit.description || benefit.description.trim().length === 0) {
      errors.push(`Benefit ${index} (${benefit.type}) missing description`);
    }
  });
  
  // Vérifier les récompenses
  this.unlockRewards.forEach((reward: IVipUnlockReward, index: number) => {
    if (reward.quantity <= 0) {
      errors.push(`Unlock reward ${index} has invalid quantity`);
    }
    if (reward.type === "currency" && !reward.currencyType) {
      errors.push(`Unlock reward ${index} is currency but missing currencyType`);
    }
  });
  
  return { valid: errors.length === 0, errors };
};

// === MÉTHODES STATIQUES ===

// Obtenir tous les niveaux VIP actifs
vipConfigurationSchema.statics.getActiveLevels = async function() {
  return this.find({ isActive: true })
    .sort({ level: 1 })
    .lean();
};

// Obtenir un niveau VIP spécifique
vipConfigurationSchema.statics.getLevel = async function(level: number) {
  return this.findOne({ level, isActive: true });
};

// Calculer le niveau VIP basé sur l'expérience
vipConfigurationSchema.statics.calculateLevelFromExp = async function(exp: number): Promise<number> {
  const levels = await this.find({ isActive: true, totalExpRequired: { $lte: exp } })
    .sort({ level: -1 })
    .limit(1);
  
  return levels.length > 0 ? levels[0].level : 0;
};

// Obtenir les infos du prochain niveau
vipConfigurationSchema.statics.getNextLevelInfo = async function(currentLevel: number) {
  return this.findOne({ 
    level: currentLevel + 1, 
    isActive: true 
  });
};

// Obtenir une plage de niveaux
vipConfigurationSchema.statics.getLevelRange = async function(startLevel: number, endLevel: number) {
  return this.find({
    level: { $gte: startLevel, $lte: endLevel },
    isActive: true
  }).sort({ level: 1 });
};

// Initialiser les configurations VIP par défaut
vipConfigurationSchema.statics.initializeDefaultConfigs = async function() {
  const defaultConfigs = [
    {
      level: 0,
      title: "Adventurer",
      requiredExp: 0,
      totalExpRequired: 0,
      benefits: [
        { type: "battle_speed", value: 1, description: "Normal battle speed", displayOrder: 1 },
        { type: "daily_rewards", value: true, description: "Basic daily rewards", displayOrder: 2 }
      ],
      unlockRewards: []
    },
    {
      level: 1,
      title: "Supporter",
      requiredExp: 100,
      totalExpRequired: 100,
      benefits: [
        { type: "battle_speed", value: 2, description: "2x battle speed unlocked", displayOrder: 1 },
        { type: "shop_discount", value: 5, description: "5% shop discount", displayOrder: 2 }
      ],
      unlockRewards: [
        { type: "currency", currencyType: "gold", quantity: 5000 },
        { type: "currency", currencyType: "gems", quantity: 100 }
      ]
    },
    {
      level: 2,
      title: "Patron",
      requiredExp: 200,
      totalExpRequired: 300,
      benefits: [
        { type: "battle_speed", value: 2, description: "2x battle speed", displayOrder: 1 },
        { type: "max_stamina", value: 120, description: "+20 max stamina", displayOrder: 2 },
        { type: "shop_discount", value: 8, description: "8% shop discount", displayOrder: 3 },
        { type: "afk_rewards", value: 1.1, description: "10% bonus AFK rewards", displayOrder: 4 }
      ],
      unlockRewards: [
        { type: "currency", currencyType: "gold", quantity: 10000 },
        { type: "currency", currencyType: "gems", quantity: 200 }
      ]
    },
    {
      level: 5,
      title: "Guardian",
      requiredExp: 700,
      totalExpRequired: 1800,
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed unlocked", displayOrder: 1 },
        { type: "max_stamina", value: 180, description: "+80 max stamina", displayOrder: 2 },
        { type: "shop_discount", value: 15, description: "15% shop discount", displayOrder: 3 },
        { type: "afk_rewards", value: 1.25, description: "25% bonus AFK rewards", displayOrder: 4 },
        { type: "auto_battle", value: true, description: "Auto-battle in campaign", displayOrder: 5 }
      ],
      unlockRewards: [
        { type: "currency", currencyType: "gold", quantity: 50000 },
        { type: "currency", currencyType: "gems", quantity: 800 },
        { type: "hero", heroId: "epic_hero_selector", quantity: 1, rarity: "Epic" }
      ]
    }
    // On peut ajouter tous les autres niveaux...
  ];
  
  for (const config of defaultConfigs) {
    const existing = await this.findOne({ level: config.level });
    if (!existing) {
      await this.create(config);
    }
  }
  
  console.log(`✅ Configurations VIP par défaut initialisées`);
};

// Obtenir les statistiques des configurations
vipConfigurationSchema.statics.getConfigStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    { $group: {
      _id: null,
      totalLevels: { $sum: 1 },
      maxLevel: { $max: "$level" },
      totalExpRequired: { $max: "$totalExpRequired" },
      avgBenefitsPerLevel: { $avg: { $size: "$benefits" } },
      avgRewardsPerLevel: { $avg: { $size: "$unlockRewards" } }
    }}
  ]);
  
  return stats[0] || {
    totalLevels: 0,
    maxLevel: 0,
    totalExpRequired: 0,
    avgBenefitsPerLevel: 0,
    avgRewardsPerLevel: 0
  };
};

// Valider toutes les configurations
vipConfigurationSchema.statics.validateAllConfigs = async function() {
  const configs = await this.find({ isActive: true }).sort({ level: 1 });
  const errors: string[] = [];
  
  // Vérifier la progression des niveaux
  for (let i = 1; i < configs.length; i++) {
    const current = configs[i];
    const previous = configs[i - 1];
    
    if (current.totalExpRequired <= previous.totalExpRequired) {
      errors.push(`Level ${current.level} total EXP (${current.totalExpRequired}) should be > level ${previous.level} (${previous.totalExpRequired})`);
    }
  }
  
  // Vérifier chaque configuration individuellement
  for (const config of configs) {
    const validation = config.isValidConfiguration();
    if (!validation.valid) {
      errors.push(`Level ${config.level}: ${validation.errors.join(", ")}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
};

export default mongoose.model<IVipConfiguration>("VipConfiguration", vipConfigurationSchema);

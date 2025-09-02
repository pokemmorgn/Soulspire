import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES PRINCIPALES ===

// Stats avancées pour l'équipement
interface IItemStats {
  // Stats de base
  hp: number;
  atk: number;
  def: number;
  defMagique: number;
  
  // Stats avancées
  crit: number;        // Chance de critique (%)
  critDamage: number;  // Dégâts critiques (%)
  dodge: number;       // Esquive (%)
  accuracy: number;    // Précision (%)
  
  // Stats spécialisées
  vitesse: number;
  intelligence: number;
  force: number;
  moral: number;
  reductionCooldown: number;
  
  // Stats élémentaires
  fireResist: number;
  waterResist: number;
  windResist: number;
  electricResist: number;
  lightResist: number;
  darkResist: number;
  
  // Bonus spéciaux
  healingBonus: number;    // Bonus aux soins (%)
  shieldBonus: number;     // Bonus aux boucliers (%)
  energyRegen: number;     // Régénération d'énergie
}

// Effet spécial d'un objet
interface IItemEffect {
  id: string;
  name: string;
  description: string;
  type: "Passive" | "Active" | "Set";
  trigger?: string; // "onHit", "onCrit", "onDeath", etc.
  value: number;
  duration?: number; // en secondes pour les effets temporaires
}

// Set d'équipement (comme AFK Arena)
interface IEquipmentSet {
  setId: string;
  name: string;
  description: string;
  pieces: string[]; // IDs des pièces du set
  bonuses: {
    pieces2: IItemStats; // Bonus avec 2 pièces
    pieces4: IItemStats; // Bonus avec 4 pièces
    pieces6?: IItemStats; // Bonus avec 6 pièces (sets légendaires)
  };
}

  // Contenu d'un coffre
interface IChestContent {
  type: "Item" | "Currency" | "Fragment" | "Hero";
  itemId?: string;        // Pour les objets
  currencyType?: "gold" | "gems" | "paidGems" | "tickets";
  heroId?: string;        // Pour les héros complets
  fragmentHeroId?: string; // Pour les fragments
  quantity: number;
  dropRate: number;       // Probabilité (0-100)
  guaranteedAfter?: number; // Garantie après X ouvertures sans l'avoir eu
}

// Document principal pour les objets
interface IItemDocument extends Document {
  // Identification
  itemId: string;
  name: string;
  description: string;
  iconUrl: string;          // URL de l'icône pour Unity
  
  // Classification
  category: "Equipment" | "Consumable" | "Material" | "Currency" | "Fragment" | "Scroll" | "Artifact" | "Chest";
  subCategory: string; // "Weapon", "Armor", "Helmet", "Common_Chest", "Elite_Chest", etc.
  
  // Propriétés générales
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Ascended";
  tier: number; // T1, T2, T3, etc. (pour l'amélioration)
  maxLevel: number;
  
  // Valeurs économiques
  sellPrice: number;
  buyPrice?: number;
  
  // Stats et effets (pour l'équipement principalement)
  baseStats: Partial<IItemStats>;
  statsPerLevel: Partial<IItemStats>; // Stats gagnées par niveau
  
  // Effets spéciaux
  effects: IItemEffect[];
  
  // Set d'équipement
  equipmentSet?: {
    setId: string;
    setName: string;
  };
  
  // Équipement spécifique
  equipmentSlot?: "Weapon" | "Helmet" | "Armor" | "Boots" | "Gloves" | "Accessory";
  classRestriction?: string[]; // Classes qui peuvent équiper cet objet
  levelRequirement: number;
  
  // Consommables
  consumableType?: "Potion" | "Scroll" | "Enhancement" | "XP" | "Currency";
  consumableEffect?: {
    type: "heal" | "buff" | "xp" | "currency" | "enhancement";
    value: number;
    duration?: number;
  };
  
  // Matériaux
  materialType?: "Enhancement" | "Evolution" | "Crafting" | "Awakening";
  materialGrade?: "Basic" | "Advanced" | "Master" | "Legendary";
  
  // Artefacts (objets spéciaux AFK Arena)
  artifactType?: "Weapon" | "Support" | "Vitality" | "Celerity" | "Sustenance" | "Might";
  
  // Coffres et boîtes
  chestType?: "Common" | "Elite" | "Epic" | "Legendary" | "Special" | "Event";
  chestContents?: IChestContent[];
  openCost?: {
    gold?: number;
    gems?: number;
    paidGems?: number;
    keys?: number; // Clés spéciales
  };
  maxOpens?: number;        // Limite d'ouvertures (-1 = illimité)
  resetDaily?: boolean;     // Se remet à zéro chaque jour
  guaranteedRarity?: string; // Rareté minimale garantie
  
  // Méthodes
  getStatsAtLevel(level: number): IItemStats;
  canBeEquippedBy(heroClass: string, heroLevel: number): boolean;
  getSetBonuses(equippedSetPieces: number): Partial<IItemStats>;
  openChest(playerId: string): Promise<IChestContent[]>;
  getChestPreview(): IChestContent[];
}

// === SCHÉMA MONGOOSE ===

const chestContentSchema = new Schema<IChestContent>({
  type: { 
    type: String, 
    enum: ["Item", "Currency", "Fragment", "Hero"],
    required: true 
  },
  itemId: { type: String }, // Pour les objets
  currencyType: { 
    type: String,
    enum: ["gold", "gems", "paidGems", "tickets"]
  },
  heroId: { type: String }, // Pour les héros complets
  fragmentHeroId: { type: String }, // Pour les fragments
  quantity: { 
    type: Number, 
    required: true,
    min: 1
  },
  dropRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  guaranteedAfter: { 
    type: Number,
    min: 1
  }
}, { _id: false });

const itemStatsSchema = new Schema<IItemStats>({
  // Stats de base
  hp: { type: Number, default: 0, min: 0 },
  atk: { type: Number, default: 0, min: 0 },
  def: { type: Number, default: 0, min: 0 },
  defMagique: { type: Number, default: 0, min: 0 },
  
  // Stats avancées
  crit: { type: Number, default: 0, min: 0, max: 100 },
  critDamage: { type: Number, default: 0, min: 0 },
  dodge: { type: Number, default: 0, min: 0, max: 100 },
  accuracy: { type: Number, default: 0, min: 0, max: 100 },
  
  // Stats spécialisées
  vitesse: { type: Number, default: 0, min: 0 },
  intelligence: { type: Number, default: 0, min: 0 },
  force: { type: Number, default: 0, min: 0 },
  moral: { type: Number, default: 0, min: 0 },
  reductionCooldown: { type: Number, default: 0, min: 0, max: 50 },
  
  // Résistances élémentaires
  fireResist: { type: Number, default: 0, min: 0, max: 100 },
  waterResist: { type: Number, default: 0, min: 0, max: 100 },
  windResist: { type: Number, default: 0, min: 0, max: 100 },
  electricResist: { type: Number, default: 0, min: 0, max: 100 },
  lightResist: { type: Number, default: 0, min: 0, max: 100 },
  darkResist: { type: Number, default: 0, min: 0, max: 100 },
  
  // Bonus spéciaux
  healingBonus: { type: Number, default: 0, min: 0 },
  shieldBonus: { type: Number, default: 0, min: 0 },
  energyRegen: { type: Number, default: 0, min: 0 }
}, { _id: false });

const itemEffectSchema = new Schema<IItemEffect>({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["Passive", "Active", "Set"],
    required: true 
  },
  trigger: { 
    type: String,
    enum: ["onHit", "onCrit", "onDeath", "onHeal", "onUltimate", "always", "combat_start"],
    default: "always"
  },
  value: { type: Number, required: true },
  duration: { type: Number, min: 0 } // en secondes
}, { _id: false });

const itemSchema = new Schema<IItemDocument>({
  // Identification unique
  itemId: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    maxlength: 500,
    default: ""
  },
  
  // Affichage
  iconUrl: { 
    type: String, 
    required: true,
    trim: true,
    default: function(this: IItemDocument) {
      // Auto-génération d'URL d'icône basée sur l'itemId
      return `icons/items/${this.itemId}.png`;
    }
  },
  
  // Classification
  category: { 
    type: String, 
    enum: ["Equipment", "Consumable", "Material", "Currency", "Fragment", "Scroll", "Artifact", "Chest"],
    required: true
  },
  subCategory: { 
    type: String, 
    required: true,
    trim: true
  },
  
  // Propriétés générales
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"],
    required: true
  },
  tier: { 
    type: Number, 
    min: 1,
    max: 10,
    default: 1
  },
  maxLevel: { 
    type: Number, 
    min: 1,
    max: 100,
    default: 1
  },
  
  // Économie
  sellPrice: { 
    type: Number, 
    min: 0,
    required: true
  },
  buyPrice: { 
    type: Number, 
    min: 0
  },
  
  // Stats pour équipement
  baseStats: {
    type: itemStatsSchema,
    default: {}
  },
  statsPerLevel: {
    type: itemStatsSchema,
    default: {}
  },
  
  // Effets spéciaux
  effects: [itemEffectSchema],
  
  // Set d'équipement
  equipmentSet: {
    setId: { type: String },
    setName: { type: String, trim: true }
  },
  
  // Équipement spécifique
  equipmentSlot: { 
    type: String, 
    enum: ["Weapon", "Helmet", "Armor", "Boots", "Gloves", "Accessory"]
  },
  classRestriction: [{ 
    type: String,
    enum: ["Tank", "DPS Melee", "DPS Ranged", "Support", "All"]
  }],
  levelRequirement: { 
    type: Number, 
    min: 1,
    default: 1
  },
  
  // Consommables
  consumableType: { 
    type: String, 
    enum: ["Potion", "Scroll", "Enhancement", "XP", "Currency"]
  },
  consumableEffect: {
    type: { 
      type: String,
      enum: ["heal", "buff", "xp", "currency", "enhancement"]
    },
    value: { type: Number, min: 0 },
    duration: { type: Number, min: 0 } // en secondes
  },
  
  // Matériaux
  materialType: { 
    type: String, 
    enum: ["Enhancement", "Evolution", "Crafting", "Awakening"]
  },
  materialGrade: { 
    type: String, 
    enum: ["Basic", "Advanced", "Master", "Legendary"]
  },
  
  // Artefacts spéciaux
  artifactType: { 
    type: String, 
    enum: ["Weapon", "Support", "Vitality", "Celerity", "Sustenance", "Might"]
  },
  
  // Coffres et boîtes
  chestType: { 
    type: String, 
    enum: ["Common", "Elite", "Epic", "Legendary", "Special", "Event"]
  },
  chestContents: [chestContentSchema],
  openCost: {
    gold: { type: Number, min: 0, default: 0 },
    gems: { type: Number, min: 0, default: 0 },
    paidGems: { type: Number, min: 0, default: 0 },
    keys: { type: Number, min: 0, default: 0 }
  },
  maxOpens: { 
    type: Number, 
    default: -1 // -1 = illimité
  },
  resetDaily: { 
    type: Boolean, 
    default: false 
  },
  guaranteedRarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"]
  }
}, {
  timestamps: true,
  collection: 'items'
});

// === INDEX POUR OPTIMISATION ===
itemSchema.index({ itemId: 1 });
itemSchema.index({ category: 1, subCategory: 1 });
itemSchema.index({ rarity: 1 });
itemSchema.index({ equipmentSlot: 1 });
itemSchema.index({ "equipmentSet.setId": 1 });
itemSchema.index({ materialType: 1 });
itemSchema.index({ chestType: 1 });
itemSchema.index({ "chestContents.dropRate": 1 });
itemSchema.index({ guaranteedRarity: 1 });

// === MÉTHODES STATIQUES ===

// Obtenir tous les objets d'une catégorie
itemSchema.statics.getByCategory = function(category: string, subCategory?: string) {
  const filter: any = { category };
  if (subCategory) filter.subCategory = subCategory;
  return this.find(filter).sort({ rarity: 1, tier: 1, name: 1 });
};

// Obtenir les objets d'un set
itemSchema.statics.getSetItems = function(setId: string) {
  return this.find({ "equipmentSet.setId": setId });
};

// Obtenir objets par rareté
itemSchema.statics.getByRarity = function(rarity: string) {
  return this.find({ rarity }).sort({ category: 1, name: 1 });
};

// Obtenir coffres par type
itemSchema.statics.getChestsByType = function(chestType: string) {
  return this.find({ category: "Chest", chestType }).sort({ rarity: 1, name: 1 });
};

// Créer un coffre prédéfini
itemSchema.statics.createChest = function(chestData: {
  itemId: string;
  name: string;
  chestType: string;
  rarity: string;
  contents: IChestContent[];
  openCost?: any;
}) {
  return new this({
    itemId: chestData.itemId,
    name: chestData.name,
    description: `${chestData.chestType} chest containing various rewards`,
    category: "Chest",
    subCategory: `${chestData.chestType}_Chest`,
    rarity: chestData.rarity,
    chestType: chestData.chestType,
    chestContents: chestData.contents,
    openCost: chestData.openCost || { gold: 0 },
    sellPrice: (this.constructor as any).calculateSellPrice(chestData.rarity, 1)
  });
};

// Générer prix de vente basé sur la rareté et tier
itemSchema.statics.calculateSellPrice = function(rarity: string, tier: number): number {
  const basePrice: { [key: string]: number } = {
    "Common": 10,
    "Rare": 50, 
    "Epic": 200,
    "Legendary": 1000,
    "Mythic": 5000,
    "Ascended": 25000
  };
  
  const rarityPrice = basePrice[rarity] || 10;
  const tierMultiplier = 1 + (tier - 1) * 0.5;
  
  return Math.floor(rarityPrice * tierMultiplier);
};

// === MÉTHODES D'INSTANCE ===

// Calculer les stats finales à un niveau donné
itemSchema.methods.getStatsAtLevel = function(level: number): IItemStats {
  const finalStats: any = { ...this.baseStats };
  
  // Appliquer les stats par niveau
  for (const [stat, baseValue] of Object.entries(this.statsPerLevel)) {
    if (typeof baseValue === 'number' && baseValue > 0) {
      finalStats[stat] = (finalStats[stat] || 0) + (baseValue * (level - 1));
    }
  }
  
  return finalStats;
};

// Vérifier si peut être équipé par un héros
itemSchema.methods.canBeEquippedBy = function(heroClass: string, heroLevel: number): boolean {
  // Vérifier le niveau requis
  if (heroLevel < this.levelRequirement) return false;
  
  // Vérifier les restrictions de classe
  if (this.classRestriction && this.classRestriction.length > 0) {
    return this.classRestriction.includes(heroClass) || this.classRestriction.includes("All");
  }
  
  return true;
};

// Obtenir les bonus de set (nécessite une requête externe pour les autres pièces)
itemSchema.methods.getSetBonuses = function(equippedSetPieces: number): Partial<IItemStats> {
  // Cette méthode devrait être appelée avec les données du set complet
  // Pour l'instant, retourne un objet vide - sera implémenté avec le système de sets
  return {};
};

// Ouvrir un coffre et obtenir les récompenses
itemSchema.methods.openChest = async function(playerId: string): Promise<IChestContent[]> {
  if (this.category !== "Chest" || !this.chestContents?.length) {
    throw new Error("This item is not a chest or has no contents");
  }
  
  const rewards: IChestContent[] = [];
  
  // Système de drop avec garanties
  for (const content of this.chestContents) {
    const random = Math.random() * 100;
    
    if (random <= content.dropRate) {
      rewards.push({
        ...content,
        // Possibilité de varier la quantité selon la rareté
        quantity: this.calculateDropQuantity(content.quantity, this.rarity)
      });
    }
  }
  
  // Garantie minimale : au moins un objet de la rareté garantie
  if (this.guaranteedRarity && rewards.length === 0) {
    const guaranteedItems = this.chestContents.filter((c: IChestContent) => 
      c.type === "Item" // On pourrait vérifier la rareté de l'item ici
    );
    if (guaranteedItems.length > 0) {
      const randomGuaranteed = guaranteedItems[Math.floor(Math.random() * guaranteedItems.length)];
      rewards.push(randomGuaranteed);
    }
  }
  
  return rewards;
};

// Aperçu du contenu du coffre (pour l'UI)
itemSchema.methods.getChestPreview = function(): IChestContent[] {
  if (this.category !== "Chest") return [];
  return this.chestContents || [];
};

// Calculer la quantité selon la rareté du coffre
itemSchema.methods.calculateDropQuantity = function(baseQuantity: number, chestRarity: string): number {
  const multipliers: { [key: string]: number } = {
    "Common": 1,
    "Rare": 1.2,
    "Epic": 1.5,
    "Legendary": 2,
    "Mythic": 3,
    "Ascended": 5
  };
  
  const multiplier = multipliers[chestRarity] || 1;
  return Math.floor(baseQuantity * multiplier);
};

// Validation avant sauvegarde
itemSchema.pre('save', function(next) {
  // Validation des stats selon la catégorie
  if (this.category === "Equipment" && !this.equipmentSlot) {
    return next(new Error("Equipment items must have an equipmentSlot"));
  }
  
  if (this.category === "Consumable" && !this.consumableType) {
    return next(new Error("Consumable items must have a consumableType"));
  }
  
  if (this.category === "Material" && !this.materialType) {
    return next(new Error("Material items must have a materialType"));
  }
  
  if (this.category === "Chest" && !this.chestType) {
    return next(new Error("Chest items must have a chestType"));
  }
  
  if (this.category === "Chest" && (!this.chestContents || this.chestContents.length === 0)) {
    return next(new Error("Chest items must have chestContents"));
  }
  
  // Auto-génération du prix de vente si non défini
  if (!this.sellPrice) {
    this.sellPrice = (this.constructor as any).calculateSellPrice(this.rarity, this.tier);
  }
  
  // Validation des restrictions de classe pour équipement
  if (this.category === "Equipment" && this.classRestriction) {
    const validClasses = ["Tank", "DPS Melee", "DPS Ranged", "Support", "All"];
    const invalidClasses = this.classRestriction.filter(c => !validClasses.includes(c));
    if (invalidClasses.length > 0) {
      return next(new Error(`Invalid class restrictions: ${invalidClasses.join(", ")}`));
    }
  }
  
  next();
});

export default mongoose.model<IItemDocument>("Item", itemSchema);

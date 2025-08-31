import mongoose, { Document, Schema } from "mongoose";
import { IInventory, IEquipment } from "../types/index";

interface IInventoryDocument extends IInventory, Document {}

const equipmentSchema = new Schema<IEquipment>({
  itemId: { 
    type: String, 
    required: true,
    unique: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  type: { 
    type: String, 
    enum: ["Weapon", "Armor", "Accessory"],
    required: true
  },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary"],
    required: true
  },
  level: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 100
  },
  stats: {
    atk: { type: Number, default: 0, min: 0 },
    def: { type: Number, default: 0, min: 0 },
    hp: { type: Number, default: 0, min: 0 }
  },
  equippedTo: { 
    type: Schema.Types.ObjectId, 
    ref: "Player.heroes",
    default: null
  }
});

const inventorySchema = new Schema<IInventoryDocument>({
  playerId: { 
    type: Schema.Types.ObjectId, 
    ref: "Player",
    required: true,
    unique: true
  },

  // Monnaies et ressources
  gold: { 
    type: Number, 
    default: 0,
    min: 0
  },
  gems: { 
    type: Number, 
    default: 0,
    min: 0
  },
  paidGems: { 
    type: Number, 
    default: 0,
    min: 0
  },
  tickets: { 
    type: Number, 
    default: 0,
    min: 0
  },

  // Fragments et matériaux
  fragments: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  materials: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },

  // Équipement possédé
  equipment: [equipmentSchema]
}, {
  timestamps: true,
  collection: 'inventories'
});

// Index pour optimiser les requêtes
inventorySchema.index({ playerId: 1 });
inventorySchema.index({ "equipment.type": 1 });
inventorySchema.index({ "equipment.rarity": 1 });

// Méthodes d'instance
inventorySchema.methods.addEquipment = function(equipment: Partial<IEquipment>) {
  const newEquipment = {
    itemId: equipment.itemId || new mongoose.Types.ObjectId().toString(),
    name: equipment.name || "Unknown Item",
    type: equipment.type || "Weapon",
    rarity: equipment.rarity || "Common",
    level: equipment.level || 1,
    stats: equipment.stats || { atk: 0, def: 0, hp: 0 }
  };
  
  this.equipment.push(newEquipment);
  return this.save();
};

inventorySchema.methods.removeEquipment = function(itemId: string) {
  this.equipment = this.equipment.filter((item: IEquipment) => item.itemId !== itemId);
  return this.save();
};

inventorySchema.methods.getEquipmentByType = function(type: string) {
  return this.equipment.filter((item: IEquipment) => item.type === type);
};

inventorySchema.methods.getEquippedItems = function() {
  return this.equipment.filter((item: IEquipment) => item.equippedTo);
};

inventorySchema.methods.addMaterial = function(materialId: string, quantity: number) {
  const currentQuantity = this.materials.get(materialId) || 0;
  this.materials.set(materialId, currentQuantity + quantity);
  return this.save();
};

inventorySchema.methods.removeMaterial = function(materialId: string, quantity: number): boolean {
  const currentQuantity = this.materials.get(materialId) || 0;
  if (currentQuantity < quantity) return false;
  
  this.materials.set(materialId, currentQuantity - quantity);
  return true;
};

inventorySchema.methods.addFragment = function(heroId: string, quantity: number) {
  const currentQuantity = this.fragments.get(heroId) || 0;
  this.fragments.set(heroId, currentQuantity + quantity);
  return this.save();
};

inventorySchema.methods.canSummonHero = function(heroId: string, requiredFragments: number = 50): boolean {
  const fragments = this.fragments.get(heroId) || 0;
  return fragments >= requiredFragments;
};

export default mongoose.model<IInventoryDocument>("Inventory", inventorySchema);

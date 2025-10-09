// server/src/data/heroSpellDefinitions.ts

/**
 * Définitions des sorts par héros
 * Chaque héros a ses sorts fixes selon sa rareté
 */

export interface HeroSpellDefinition {
  heroId: string;           // ID unique du héros (slugified name)
  name: string;             // Nom affiché
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  
  // Sorts par slot
  spell1: string;           // Débloqué: Common+
  spell2?: string;          // Débloqué: Rare+
  ultimate: string;         // Débloqué: Epic+ (vide pour Common/Rare)
  passive1?: string;        // Débloqué: Rare+
  passive2?: string;        // Débloqué: Legendary+
  passive3?: string;        // Débloqué: Mythic+ (avec condition)
}

/**
 * Base de données des sorts par héros
 * Format: heroId → définition des sorts
 */
export const HERO_SPELL_DEFINITIONS: Record<string, HeroSpellDefinition> = {
  
  // ============================================
  // WATER HEROES (7 total)
  // ============================================
  
  // Common Tank
  "nerya": {
    heroId: "nerya",
    name: "Nerya",
    element: "Water",
    role: "Tank",
    rarity: "Common",
    spell1: "water_barrier",
    ultimate: "" // Pas d'ultimate pour Common
  },
  
  // Common Support
  "thalwen": {
    heroId: "thalwen",
    name: "Thalwen",
    element: "Water",
    role: "Support",
    rarity: "Common",
    spell1: "curse_of_the_deep",
    ultimate: "" // Pas d'ultimate pour Common
  },
  
  // Common DPS Ranged
  "nora": {
    heroId: "nora",
    name: "Nora",
    element: "Water",
    role: "DPS Ranged",
    rarity: "Common",
    spell1: "water_bolt",
    ultimate: "" // Pas d'ultimate pour Common
  },
  
  // Common DPS Melee
  "narud": {
    heroId: "narud",
    name: "Narud",
    element: "Water",
    role: "DPS Melee",
    rarity: "Common",
    spell1: "tidal_slash",
    ultimate: "" // Pas d'ultimate pour Common
  },
  
  // Rare Support
  "nereida": {
    heroId: "nereida",
    name: "Nereida",
    element: "Water",
    role: "Support",
    rarity: "Rare",
    spell1: "healing_tide",
    spell2: "water_shield",
    ultimate: "", // Pas d'ultimate pour Rare
    passive1: "flowing_mana"
  },
  
  // Epic DPS Melee
  "vayna": {
    heroId: "vayna",
    name: "Vayna",
    element: "Water",
    role: "DPS Melee",
    rarity: "Epic",
    spell1: "abyssal_strike",
    spell2: "pirate_dance",
    ultimate: "whirlpool_execution",
    passive1: "tidal_lifesteal"
  },
  
  // Legendary DPS Melee
  "kaelis": {
    heroId: "kaelis",
    name: "Kaelis",
    element: "Water",
    role: "DPS Melee",
    rarity: "Legendary",
    spell1: "feline_slash",
    spell2: "hydro_dash",
    ultimate: "tsunami_fury",
    passive1: "fluid_movement",
    passive2: "ocean_rage"
  },
  
  // ============================================
  // FIRE HEROES (7 total)
  // ============================================
  
  // Common Tank
  "brakka": {
    heroId: "brakka",
    name: "Brakka",
    element: "Fire",
    role: "Tank",
    rarity: "Common",
    spell1: "furnace_strike",
    ultimate: ""
  },
  
  // Rare Tank
  "korran": {
    heroId: "korran",
    name: "Korran",
    element: "Fire",
    role: "Tank",
    rarity: "Rare",
    spell1: "ember_bash",
    spell2: "scorched_defense",
    ultimate: "",
    passive1: "heated_armor"
  },
  
  // Rare DPS Ranged
  "ignara": {
    heroId: "ignara",
    name: "Ignara",
    element: "Fire",
    role: "DPS Ranged",
    rarity: "Rare",
    spell1: "fireball",
    spell2: "flame_orb",
    ultimate: "",
    passive1: "burning_grimoire"
  },
  
  // Rare Support
  "albert": {
    heroId: "albert",
    name: "Albert",
    element: "Fire",
    role: "Support",
    rarity: "Rare",
    spell1: "flame_turret",
    spell2: "repair_kit",
    ultimate: "",
    passive1: "engineer_mind"
  },
  
  // Epic Tank
  "grathul": {
    heroId: "grathul",
    name: "Grathul",
    element: "Fire",
    role: "Tank",
    rarity: "Epic",
    spell1: "chain_slam",
    spell2: "molten_bind",
    ultimate: "volcanic_chains",
    passive1: "burning_aura"
  },
  
  // Legendary Support
  "pyra": {
    heroId: "pyra",
    name: "Pyra",
    element: "Fire",
    role: "Support",
    rarity: "Legendary",
    spell1: "ember_heal",
    spell2: "flame_shield",
    ultimate: "phoenix_blessing",
    passive1: "fire_attunement",
    passive2: "eternal_warmth"
  },
  
  // Legendary DPS Melee
  "saryel": {
    heroId: "saryel",
    name: "Saryel",
    element: "Fire",
    role: "DPS Melee",
    rarity: "Legendary",
    spell1: "blazing_slash",
    spell2: "fire_dance",
    ultimate: "infernal_storm",
    passive1: "flame_mastery",
    passive2: "burn_amplification"
  },
  
  // ============================================
  // WIND HEROES (7 total)
  // ============================================
  
  // Common DPS Ranged
  "braknor": {
    heroId: "braknor",
    name: "Braknor",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Common",
    spell1: "wind_arrow",
    ultimate: ""
  },
  
  // Common Tank
  "halvar": {
    heroId: "halvar",
    name: "Halvar",
    element: "Wind",
    role: "Tank",
    rarity: "Common",
    spell1: "wind_guard",
    ultimate: ""
  },
  
  // Rare DPS Ranged
  "sylvara": {
    heroId: "sylvara",
    name: "Sylvara",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Rare",
    spell1: "javelin_throw",
    spell2: "wind_dive",
    ultimate: "",
    passive1: "harpy_grace"
  },
  
  // Rare Support
  "elyndra": {
    heroId: "elyndra",
    name: "Elyndra",
    element: "Wind",
    role: "Support",
    rarity: "Rare",
    spell1: "wind_song",
    spell2: "gust_shield",
    ultimate: "",
    passive1: "bard_inspiration"
  },
  
  // Rare DPS Melee
  "kaelen": {
    heroId: "kaelen",
    name: "Kaelen",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Rare",
    spell1: "dual_slash",
    spell2: "wind_step",
    ultimate: "",
    passive1: "swift_strikes"
  },
  
  // Epic DPS Ranged
  "zephyra": {
    heroId: "zephyra",
    name: "Zephyra",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Epic",
    spell1: "wind_arrow",
    spell2: "cyclone_shot",
    ultimate: "hurricane_pierce",
    passive1: "wind_mastery"
  },
  
  // Legendary DPS Melee
  "veyron": {
    heroId: "veyron",
    name: "Veyron",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Legendary",
    spell1: "wind_slash",
    spell2: "gale_dash",
    ultimate: "storm_fury",
    passive1: "wind_walker",
    passive2: "tempest_edge"
  },
  
  // ============================================
  // ELECTRIC HEROES (7 total)
  // ============================================
  
  // Common Support
  "tynira": {
    heroId: "tynira",
    name: "Tynira",
    element: "Electric",
    role: "Support",
    rarity: "Common",
    spell1: "spark_buff",
    ultimate: ""
  },
  
  // Common DPS Melee
  "zeyra": {
    heroId: "zeyra",
    name: "Zeyra",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Common",
    spell1: "lightning_strike",
    ultimate: ""
  },
  
  // Epic DPS Melee
  "raiken": {
    heroId: "raiken",
    name: "Raiken",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Epic",
    spell1: "volt_punch",
    spell2: "thunder_combo",
    ultimate: "lightning_storm",
    passive1: "static_charge"
  },
  
  // Epic Support
  "milia": {
    heroId: "milia",
    name: "Milia",
    element: "Electric",
    role: "Support",
    rarity: "Epic",
    spell1: "thunder_hammer",
    spell2: "volt_shield",
    ultimate: "lightning_bastion",
    passive1: "armored_conductor"
  },
  
  // Epic Tank
  "thalrik": {
    heroId: "thalrik",
    name: "Thalrik",
    element: "Electric",
    role: "Tank",
    rarity: "Epic",
    spell1: "thunder_slam",
    spell2: "shock_wave",
    ultimate: "storm_colossus",
    passive1: "conductive_armor"
  },
  
  // Legendary DPS Ranged
  "voltrion": {
    heroId: "voltrion",
    name: "Voltrion",
    element: "Electric",
    role: "DPS Ranged",
    rarity: "Legendary",
    spell1: "lightning_bolt",
    spell2: "chain_lightning",
    ultimate: "thunderstorm",
    passive1: "electric_mastery",
    passive2: "overcharge"
  },
  
  // Legendary Tank
  "voltragar": {
    heroId: "voltragar",
    name: "Voltragar",
    element: "Electric",
    role: "Tank",
    rarity: "Legendary",
    spell1: "volt_shield",
    spell2: "electric_taunt",
    ultimate: "tesla_fortress",
    passive1: "steel_conductor",
    passive2: "energy_absorption"
  },
  
  // ============================================
  // LIGHT HEROES (6 total)
  // ============================================
  
  // Common DPS Melee
  "goahn": {
    heroId: "goahn",
    name: "Goahn",
    element: "Light",
    role: "DPS Melee",
    rarity: "Common",
    spell1: "holy_strike",
    ultimate: ""
  },
  
  // Rare Tank
  "elyos": {
    heroId: "elyos",
    name: "Elyos",
    element: "Light",
    role: "Tank",
    rarity: "Rare",
    spell1: "light_shield",
    spell2: "holy_guard",
    ultimate: "",
    passive1: "divine_protection"
  },
  
  // Rare DPS Ranged
  "liora": {
    heroId: "liora",
    name: "Liora",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Rare",
    spell1: "light_arrow",
    spell2: "piercing_ray",
    ultimate: "",
    passive1: "precision_aim"
  },
  
  // Rare Support
  "lyaria": {
    heroId: "lyaria",
    name: "Lyaria",
    element: "Light",
    role: "Support",
    rarity: "Rare",
    spell1: "heal",
    spell2: "holy_shield",
    ultimate: "",
    passive1: "light_aura"
  },
  
  // Legendary Tank
  "aureon": {
    heroId: "aureon",
    name: "Aureon",
    element: "Light",
    role: "Tank",
    rarity: "Legendary",
    spell1: "solar_slam",
    spell2: "radiant_taunt",
    ultimate: "sun_fortress",
    passive1: "solar_armor",
    passive2: "divine_aura"
  },
  
  // Legendary DPS Ranged
  "solayne": {
    heroId: "solayne",
    name: "Solayne",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Legendary",
    spell1: "solar_beam",
    spell2: "radiant_orb",
    ultimate: "supernova",
    passive1: "desert_wisdom",
    passive2: "solar_mastery"
  },
  
  // ============================================
  // DARK/SHADOW HEROES (6 total)
  // ============================================
  
  // Epic DPS Melee
  "abomys": {
    heroId: "abomys",
    name: "Abomys",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Epic",
    spell1: "shadow_strike",
    spell2: "void_dash",
    ultimate: "darkness_burst",
    passive1: "assassin_fury"
  },
  
  // Epic Support
  "chorath": {
    heroId: "chorath",
    name: "Chorath",
    element: "Dark",
    role: "Support",
    rarity: "Epic",
    spell1: "toll_bell",
    spell2: "shadow_aura",
    ultimate: "nightmare_hymn",
    passive1: "fear_aura"
  },
  
  // Epic DPS Ranged
  "seliora": {
    heroId: "seliora",
    name: "Seliora",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Epic",
    spell1: "shadow_dagger",
    spell2: "dark_curse",
    ultimate: "void_storm",
    passive1: "shadow_weaver"
  },
  
  // Epic Tank
  "drogath": {
    heroId: "drogath",
    name: "Drogath",
    element: "Dark",
    role: "Tank",
    rarity: "Epic",
    spell1: "bone_slam",
    spell2: "life_drain",
    ultimate: "death_fortress",
    passive1: "undead_resilience"
  },
  
  // Legendary Support
  "nyxara": {
    heroId: "nyxara",
    name: "Nyxara",
    element: "Dark",
    role: "Support",
    rarity: "Legendary",
    spell1: "summon_shade",
    spell2: "dark_blessing",
    ultimate: "shadow_legion",
    passive1: "summoner_mastery",
    passive2: "void_bond"
  },
  
  // Legendary DPS Ranged
  "aleyra": {
    heroId: "aleyra",
    name: "Aleyra",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Legendary",
    spell1: "void_bolt",
    spell2: "shadow_pierce",
    ultimate: "eclipse",
    passive1: "dark_mastery",
    passive2: "void_amplification"
  },
  
  // ============================================
  // MYTHIC HEROES (2 total)
  // ============================================
  
  // Mythic DPS Melee (Shadow Form)
  "kaorim_lunar": {
    heroId: "kaorim_lunar",
    name: "Kaorim (Lunar Form)",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Mythic",
    spell1: "lunar_strike",
    spell2: "shadow_dance",
    ultimate: "eclipse_fury",
    passive1: "lunar_blessing",
    passive2: "night_warrior",
    passive3: "celestial_duality"
  },
  
  // Mythic Support (Light Form)
  "kaorim_solar": {
    heroId: "kaorim_solar",
    name: "Kaorim (Solar Form)",
    element: "Light",
    role: "Support",
    rarity: "Mythic",
    spell1: "solar_heal",
    spell2: "radiant_blessing",
    ultimate: "dawn_resurrection",
    passive1: "solar_grace",
    passive2: "day_protector",
    passive3: "celestial_duality"
  }
};

/**
 * Récupérer la définition des sorts d'un héros
 */
export function getHeroSpellDefinition(heroId: string): HeroSpellDefinition | null {
  return HERO_SPELL_DEFINITIONS[heroId] || null;
}

/**
 * Vérifier quels slots de sorts doivent être débloqués selon la rareté
 */
export function getSlotsForRarity(rarity: string): {
  spell1: boolean;
  spell2: boolean;
  ultimate: boolean;
  passive1: boolean;
  passive2: boolean;
  passive3: boolean;
} {
  const slots = {
    spell1: true,     // Toujours débloqué (Common+)
    spell2: false,
    ultimate: false,  // Seulement Epic+
    passive1: false,
    passive2: false,
    passive3: false
  };
  
  // Rare+
  if (["Rare", "Epic", "Legendary", "Mythic"].includes(rarity)) {
    slots.spell2 = true;
    slots.passive1 = true;
  }
  
  // Epic+
  if (["Epic", "Legendary", "Mythic"].includes(rarity)) {
    slots.ultimate = true;
  }
  
  // Legendary+
  if (["Legendary", "Mythic"].includes(rarity)) {
    slots.passive2 = true;
  }
  
  // Mythic only
  if (rarity === "Mythic") {
    slots.passive3 = true;
  }
  
  return slots;
}

/**
 * Obtenir les sorts initiaux d'un héros selon sa rareté
 */
export function getInitialSpells(heroId: string, rarity: string): {
  spell1?: { id: string; level: number };
  spell2?: { id: string; level: number };
  ultimate?: { id: string; level: number };
  passive1?: { id: string; level: number };
  passive2?: { id: string; level: number };
  passive3?: { id: string; level: number };
} {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    throw new Error(`No spell definition found for hero: ${heroId}`);
  }
  
  const slots = getSlotsForRarity(rarity);
  const spells: any = {};
  
  if (slots.spell1 && definition.spell1) {
    spells.spell1 = { id: definition.spell1, level: 1 };
  }
  
  if (slots.spell2 && definition.spell2) {
    spells.spell2 = { id: definition.spell2, level: 1 };
  }
  
  if (slots.ultimate && definition.ultimate) {
    spells.ultimate = { id: definition.ultimate, level: 1 };
  }
  
  if (slots.passive1 && definition.passive1) {
    spells.passive1 = { id: definition.passive1, level: 1 };
  }
  
  if (slots.passive2 && definition.passive2) {
    spells.passive2 = { id: definition.passive2, level: 1 };
  }
  
  if (slots.passive3 && definition.passive3) {
    spells.passive3 = { id: definition.passive3, level: 1 };
  }
  
  return spells;
}

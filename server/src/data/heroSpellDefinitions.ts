// server/src/data/heroSpellDefinitions.ts

/**
 * NOUVEAU SYSTÈME SIMPLIFIÉ
 * 
 * Chaque héros définit ses sorts par niveau de déblocage :
 * - level1 : Sort débloqué au niveau 1 (tous les héros)
 * - level11 : Sort débloqué au niveau 11 (Rare+)
 * - level41 : Sort débloqué au niveau 41 (Epic+)
 * - level81 : Sort débloqué au niveau 81 (Epic+ qui peuvent l'atteindre)
 * - level121 : Structure vide pour l'instant (Legendary+)
 * - level151 : Structure vide pour l'instant (Mythic only)
 */

export interface HeroSpellDefinition {
  heroId: string;
  name: string;
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  
  spells: {
    level1?: string;
    level11?: string;
    level41?: string;
    level81?: string;
    level121?: string | null;
    level151?: string | null;
  };
}

/**
 * Niveaux de déblocage des sorts
 */
export const SPELL_UNLOCK_LEVELS: Record<string, number> = {
  level1: 1,
  level11: 11,
  level41: 41,
  level81: 81,
  level121: 121,
  level151: 151
};

/**
 * Base de données des sorts par héros
 */
export const HERO_SPELL_DEFINITIONS: Record<string, HeroSpellDefinition> = {
  
  // ============================================
  // WATER HEROES (7 total)
  // ============================================
  
  "nerya": {
    heroId: "nerya",
    name: "Nerya",
    element: "Water",
    role: "Tank",
    rarity: "Common",
    spells: {
      level1: "water_barrier"
    }
  },
  
  "thalwen": {
    heroId: "thalwen",
    name: "Thalwen",
    element: "Water",
    role: "Support",
    rarity: "Common",
    spells: {
      level1: "curse_of_the_deep"
    }
  },
  
  "nora": {
    heroId: "nora",
    name: "Nora",
    element: "Water",
    role: "DPS Ranged",
    rarity: "Common",
    spells: {
      level1: "water_bolt"
    }
  },
  
  "narud": {
    heroId: "narud",
    name: "Narud",
    element: "Water",
    role: "DPS Melee",
    rarity: "Common",
    spells: {
      level1: "tidal_slash"
    }
  },
  
  "nereida": {
    heroId: "nereida",
    name: "Nereida",
    element: "Water",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "healing_tide",
      level11: "flowing_mana"
    }
  },
  
  "vayna": {
    heroId: "vayna",
    name: "Vayna",
    element: "Water",
    role: "DPS Melee",
    rarity: "Epic",
    spells: {
      level1: "abyssal_strike",
      level11: "pirate_dance",
      level41: "tidal_lifesteal",
      level81: "maelstrom_fury"
    }
  },
  
  "kaelis": {
    heroId: "kaelis",
    name: "Kaelis",
    element: "Water",
    role: "DPS Melee",
    rarity: "Legendary",
    spells: {
      level1: "feline_slash",
      level11: "hydro_dash",
      level41: "fluid_movement",
      level81: "tsunami_fury",
      level121: null
    }
  },
  
  // ============================================
  // FIRE HEROES (7 total)
  // ============================================
  
  "brakka": {
    heroId: "brakka",
    name: "Brakka",
    element: "Fire",
    role: "Tank",
    rarity: "Common",
    spells: {
      level1: "furnace_strike"
    }
  },
  
  "korran": {
    heroId: "korran",
    name: "Korran",
    element: "Fire",
    role: "Tank",
    rarity: "Rare",
    spells: {
      level1: "ember_bash",
      level11: "flame_shield"
    }
  },
  
  "ignara": {
    heroId: "ignara",
    name: "Ignara",
    element: "Fire",
    role: "DPS Ranged",
    rarity: "Rare",
    spells: {
      level1: "blazing_surge",
      level11: "fire_blast"
    }
  },
  
  "albert": {
    heroId: "albert",
    name: "Albert",
    element: "Fire",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "flame_turret",
      level11: "engineer_mind"
    }
  },
  
  "grathul": {
    heroId: "grathul",
    name: "Grathul",
    element: "Fire",
    role: "Tank",
    rarity: "Epic",
    spells: {
      level1: "chain_slam",
      level11: "molten_bind",
      level41: "burning_aura",
      level81: "infernal_chains"
    }
  },
  
  "pyra": {
    heroId: "pyra",
    name: "Pyra",
    element: "Fire",
    role: "Support",
    rarity: "Legendary",
    spells: {
      level1: "ember_heal",
      level11: "flame_shield",
      level41: "fire_attunement",
      level81: "phoenix_blessing",
      level121: null
    }
  },
  
  "saryel": {
    heroId: "saryel",
    name: "Saryel",
    element: "Fire",
    role: "DPS Melee",
    rarity: "Legendary",
    spells: {
      level1: "blazing_slash",
      level11: "fire_dance",
      level41: "crimson_strike",
      level81: "infernal_storm",
      level121: null
    }
  },
  
  // ============================================
  // WIND HEROES (7 total)
  // ============================================
  
  "braknor": {
    heroId: "braknor",
    name: "Braknor",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Common",
    spells: {
      level1: "wind_arrow"
    }
  },
  
  "halvar": {
    heroId: "halvar",
    name: "Halvar",
    element: "Wind",
    role: "Tank",
    rarity: "Common",
    spells: {
      level1: "wind_guard"
    }
  },
  
  "sylvara": {
    heroId: "sylvara",
    name: "Sylvara",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Rare",
    spells: {
      level1: "javelin_throw",
      level11: "wind_gust"
    }
  },
  
  "elyndra": {
    heroId: "elyndra",
    name: "Elyndra",
    element: "Wind",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "wind_song",
      level11: "bard_inspiration"
    }
  },
  
  "kaelen": {
    heroId: "kaelen",
    name: "Kaelen",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Rare",
    spells: {
      level1: "dual_slash",
      level11: "swift_cut"
    }
  },
  
  "zephyra": {
    heroId: "zephyra",
    name: "Zephyra",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Epic",
    spells: {
      level1: "wind_arrow",
      level11: "cyclone_shot",
      level41: "piercing_gale",
      level81: "tempest_volley"
    }
  },
  
  "veyron": {
    heroId: "veyron",
    name: "Veyron",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Legendary",
    spells: {
      level1: "wind_slash",
      level11: "gale_dash",
      level41: "wind_walker",
      level81: "storm_fury",
      level121: null
    }
  },
  
  // ============================================
  // ELECTRIC HEROES (7 total)
  // ============================================
  
  "tynira": {
    heroId: "tynira",
    name: "Tynira",
    element: "Electric",
    role: "Support",
    rarity: "Common",
    spells: {
      level1: "spark_buff"
    }
  },
  
  "zeyra": {
    heroId: "zeyra",
    name: "Zeyra",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Common",
    spells: {
      level1: "lightning_strike"
    }
  },
  
  "raiken": {
    heroId: "raiken",
    name: "Raiken",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Epic",
    spells: {
      level1: "volt_punch",
      level11: "thunder_combo",
      level41: "static_charge",
      level81: "lightning_burst"
    }
  },
  
  "milia": {
    heroId: "milia",
    name: "Milia",
    element: "Electric",
    role: "Support",
    rarity: "Epic",
    spells: {
      level1: "thunder_hammer",
      level11: "volt_shield",
      level41: "armored_conductor",
      level81: "electromagnetic_pulse"
    }
  },
  
  "thalrik": {
    heroId: "thalrik",
    name: "Thalrik",
    element: "Electric",
    role: "Tank",
    rarity: "Epic",
    spells: {
      level1: "thunder_slam",
      level11: "shock_wave",
      level41: "volt_barrier",
      level81: "storm_bastion"
    }
  },
  
  "voltrion": {
    heroId: "voltrion",
    name: "Voltrion",
    element: "Electric",
    role: "DPS Ranged",
    rarity: "Legendary",
    spells: {
      level1: "lightning_bolt",
      level11: "chain_lightning",
      level41: "arc_discharge",
      level81: "thunderstorm",
      level121: null
    }
  },
  
  "voltragar": {
    heroId: "voltragar",
    name: "Voltragar",
    element: "Electric",
    role: "Tank",
    rarity: "Legendary",
    spells: {
      level1: "volt_shield",
      level11: "electric_taunt",
      level41: "steel_conductor",
      level81: "tesla_fortress",
      level121: null
    }
  },
  
  // ============================================
  // LIGHT HEROES (6 total)
  // ============================================
  
  "goahn": {
    heroId: "goahn",
    name: "Goahn",
    element: "Light",
    role: "DPS Melee",
    rarity: "Common",
    spells: {
      level1: "holy_strike"
    }
  },
  
  "elyos": {
    heroId: "elyos",
    name: "Elyos",
    element: "Light",
    role: "Tank",
    rarity: "Rare",
    spells: {
      level1: "light_shield",
      level11: "radiant_taunt"
    }
  },
  
  "liora": {
    heroId: "liora",
    name: "Liora",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Rare",
    spells: {
      level1: "light_arrow",
      level11: "radiant_shot"
    }
  },
  
  "lyaria": {
    heroId: "lyaria",
    name: "Lyaria",
    element: "Light",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "heal",
      level11: "light_aura"
    }
  },
  
  "aureon": {
    heroId: "aureon",
    name: "Aureon",
    element: "Light",
    role: "Tank",
    rarity: "Legendary",
    spells: {
      level1: "solar_slam",
      level11: "radiant_taunt",
      level41: "solar_armor",
      level81: "sun_fortress",
      level121: null
    }
  },
  
  "solayne": {
    heroId: "solayne",
    name: "Solayne",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Legendary",
    spells: {
      level1: "solar_beam",
      level11: "radiant_orb",
      level41: "dawn_strike",
      level81: "supernova",
      level121: null
    }
  },
  
  // ============================================
  // DARK/SHADOW HEROES (6 total)
  // ============================================
  
  "abomys": {
    heroId: "abomys",
    name: "Abomys",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Epic",
    spells: {
      level1: "shadow_strike",
      level11: "void_dash",
      level41: "dark_blade",
      level81: "shadow_rampage"
    }
  },
  
  "chorath": {
    heroId: "chorath",
    name: "Chorath",
    element: "Dark",
    role: "Support",
    rarity: "Epic",
    spells: {
      level1: "toll_bell",
      level11: "shadow_aura",
      level41: "fear_aura",
      level81: "death_knell"
    }
  },
  
  "seliora": {
    heroId: "seliora",
    name: "Seliora",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Epic",
    spells: {
      level1: "shadow_dagger",
      level11: "dark_curse",
      level41: "shadow_weaver",
      level81: "void_cascade"
    }
  },
  
  "drogath": {
    heroId: "drogath",
    name: "Drogath",
    element: "Dark",
    role: "Tank",
    rarity: "Epic",
    spells: {
      level1: "bone_slam",
      level11: "life_drain",
      level41: "undead_resilience",
      level81: "unholy_resurrection"
    }
  },
  
  "nyxara": {
    heroId: "nyxara",
    name: "Nyxara",
    element: "Dark",
    role: "Support",
    rarity: "Legendary",
    spells: {
      level1: "summon_shade",
      level11: "dark_blessing",
      level41: "summoner_mastery",
      level81: "shadow_legion",
      level121: null
    }
  },
  
  "aleyra": {
    heroId: "aleyra",
    name: "Aleyra",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Legendary",
    spells: {
      level1: "void_bolt",
      level11: "shadow_pierce",
      level41: "dark_nova",
      level81: "eclipse",
      level121: null
    }
  },
  
  // ============================================
  // MYTHIC HEROES (2 total)
  // ============================================
  
  "kaorim_lunar": {
    heroId: "kaorim_lunar",
    name: "Kaorim (Lunar Form)",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Mythic",
    spells: {
      level1: "lunar_strike",
      level11: "shadow_dance",
      level41: "celestial_duality",
      level81: "eclipse_fury",
      level121: null,
      level151: null
    }
  },
  
  "kaorim_solar": {
    heroId: "kaorim_solar",
    name: "Kaorim (Solar Form)",
    element: "Light",
    role: "Support",
    rarity: "Mythic",
    spells: {
      level1: "solar_heal",
      level11: "radiant_blessing",
      level41: "celestial_duality",
      level81: "dawn_resurrection",
      level121: null,
      level151: null
    }
  }
};

/**
 * Récupérer la définition des sorts d'un héros
 */
export function getHeroSpellDefinition(heroId: string): HeroSpellDefinition | null {
  return HERO_SPELL_DEFINITIONS[heroId] || null;
}

/**
 * Obtenir le niveau de déblocage d'un slot de sort
 */
export function getSpellUnlockLevel(spellSlot: string): number {
  return SPELL_UNLOCK_LEVELS[spellSlot] || 1;
}

/**
 * Obtenir tous les sorts débloqués à un niveau donné pour un héros
 */
export function getSpellsUnlockedAtLevel(heroId: string, level: number): string[] {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) return [];
  
  const unlockedSlots: string[] = [];
  
  if (level >= 1 && definition.spells.level1) unlockedSlots.push("level1");
  if (level >= 11 && definition.spells.level11) unlockedSlots.push("level11");
  if (level >= 41 && definition.spells.level41) unlockedSlots.push("level41");
  if (level >= 81 && definition.spells.level81) unlockedSlots.push("level81");
  if (level >= 121 && definition.spells.level121) unlockedSlots.push("level121");
  if (level >= 151 && definition.spells.level151) unlockedSlots.push("level151");
  
  return unlockedSlots;
}

/**
 * Obtenir les sorts initiaux d'un héros (niveau 1)
 */
export function getInitialSpells(heroId: string): {
  level1?: { id: string; level: number };
  level11?: { id: string; level: number };
  level41?: { id: string; level: number };
  level81?: { id: string; level: number };
  level121?: { id: string; level: number };
  level151?: { id: string; level: number };
} {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    throw new Error(`No spell definition found for hero: ${heroId}`);
  }
  
  const spells: any = {};
  
  if (definition.spells.level1) {
    spells.level1 = { id: definition.spells.level1, level: 1 };
  }
  
  if (definition.spells.level11) {
    spells.level11 = { id: definition.spells.level11, level: 1 };
  }
  
  if (definition.spells.level41) {
    spells.level41 = { id: definition.spells.level41, level: 1 };
  }
  
  if (definition.spells.level81) {
    spells.level81 = { id: definition.spells.level81, level: 1 };
  }
  
  if (definition.spells.level121) {
    spells.level121 = { id: definition.spells.level121, level: 1 };
  }
  
  if (definition.spells.level151) {
    spells.level151 = { id: definition.spells.level151, level: 1 };
  }
  
  return spells;
}

/**
 * Obtenir les stats d'un sort à un niveau donné
 */
export function getSpellStats(spellId: string, level: number, rarity: string): {
  damage: number;
  healing: number;
  cooldown: number;
  duration: number;
  energyCost: number;
  effect: string;
  additionalEffects: Record<string, any>;
} {
  const heroWithSpell = Object.values(HERO_SPELL_DEFINITIONS).find(hero => 
    Object.values(hero.spells).includes(spellId)
  );

  if (!heroWithSpell) {
    console.warn(`⚠️ Sort ${spellId} non trouvé dans les définitions`);
    return {
      damage: 0,
      healing: 0,
      cooldown: 3,
      duration: 0,
      energyCost: 20,
      effect: spellId,
      additionalEffects: {}
    };
  }

  const rarityMultipliers: Record<string, number> = {
    Common: 1.0,
    Rare: 1.25,
    Epic: 1.5,
    Legendary: 2.0,
    Mythic: 2.5
  };

  const rarityMult = rarityMultipliers[rarity] || 1.0;
  const element = heroWithSpell.element;
  const role = heroWithSpell.role;

  let baseDamage = 0;
  let baseHealing = 0;
  let baseCooldown = 3;
  let baseEnergyCost = 20;
  let duration = 2;

  baseDamage = role === "DPS Melee" ? 100 : 
               role === "DPS Ranged" ? 80 : 
               role === "Tank" ? 50 : 30;
  baseHealing = role === "Support" ? 60 : 0;

  const levelScaling = 1 + (level - 1) * 0.15;

  return {
    damage: Math.floor(baseDamage * rarityMult * levelScaling),
    healing: Math.floor(baseHealing * rarityMult * levelScaling),
    cooldown: Math.max(1, baseCooldown - Math.floor(level / 3)),
    duration: duration,
    energyCost: Math.max(10, baseEnergyCost - Math.floor(level / 2)),
    effect: spellId,
    additionalEffects: {
      element: element,
      role: role,
      type: "active"
    }
  };
}

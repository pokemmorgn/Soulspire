// server/src/data/heroSpellDefinitions.ts

/**
 * Définitions des sorts par héros - NOUVEAU FORMAT SIMPLIFIÉ
 * Chaque héros a des sorts définis par niveau de déblocage
 */

export interface HeroSpellDefinition {
  heroId: string;
  name: string;
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  
  // ✅ Sorts par niveau de déblocage (simplifié)
  spells: {
    level1?: string;          // Sort débloqué au niveau 1 (obligatoire)
    level11?: string;         // Sort débloqué au niveau 11 (Rare+)
    level41?: string;         // Sort débloqué au niveau 41 (Epic+)
    level81?: string;         // Sort débloqué au niveau 81 (Epic+ capable d'atteindre 81)
    level121?: string | null; // Structure vide pour l'instant (Legendary+)
    level151?: string | null; // Structure vide pour l'instant (Mythic only)
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
  
  // Common Tank - 1 sort (max niveau 40)
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
  
  // Common Support - 1 sort (max niveau 40)
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
  
  // Common DPS Ranged - 1 sort (max niveau 40)
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
  
  // Common DPS Melee - 1 sort (max niveau 40)
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
  
  // Rare Support - 2 sorts (max niveau 80)
  "nereida": {
    heroId: "nereida",
    name: "Nereida",
    element: "Water",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "healing_tide",
      level11: "flowing_mana"  // Passif au lieu d'active2
    }
  },
  
  // Epic DPS Melee - 4 sorts (max niveau 120)
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
  
  // Legendary DPS Melee - 4 sorts + structure 121 (max niveau 150)
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
  
  // Common Tank - 1 sort (max niveau 40)
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
  
  // Rare Tank - 2 sorts + ultime impossible (max niveau 80)
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
  
  // Rare DPS Ranged - 2 sorts (max niveau 80)
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
  
  // Rare Support - 1 actif + 1 passif (max niveau 80)
  "albert": {
    heroId: "albert",
    name: "Albert",
    element: "Fire",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "flame_turret",
      level11: "engineer_mind"  // Passif
    }
  },
  
  // Epic Tank - 4 sorts (max niveau 120)
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
  
  // Legendary Support - 4 sorts + structure 121 (max niveau 150)
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
  
  // Legendary DPS Melee - 4 sorts (max niveau 150)
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
  
  // Common DPS Ranged - 1 sort (max niveau 40)
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
  
  // Common Tank - 1 sort (max niveau 40)
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
  
  // Rare DPS Ranged - 2 sorts (max niveau 80)
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
  
  // Rare Support - 1 actif + 1 passif (max niveau 80)
  "elyndra": {
    heroId: "elyndra",
    name: "Elyndra",
    element: "Wind",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "wind_song",
      level11: "bard_inspiration"  // Passif
    }
  },
  
  // Rare DPS Melee - 2 sorts (max niveau 80)
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
  
  // Epic DPS Ranged - 4 sorts (max niveau 120)
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
  
  // Legendary DPS Melee - 4 sorts + structure 121 (max niveau 150)
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
  
  // Common Support - 1 sort (max niveau 40)
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
  
  // Common DPS Melee - 1 sort (max niveau 40)
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
  
  // Epic DPS Melee - 4 sorts (max niveau 120)
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
  
  // Epic Support - 4 sorts (max niveau 120)
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
  
  // Epic Tank - 4 sorts (max niveau 120)
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
  
  // Legendary DPS Ranged - 4 sorts + structure 121 (max niveau 150)
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
  
  // Legendary Tank - 4 sorts + structure 121 (max niveau 150)
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
  
  // Common DPS Melee - 1 sort (max niveau 40)
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
  
  // Rare Tank - 2 sorts (max niveau 80)
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
  
  // Rare DPS Ranged - 2 sorts (max niveau 80)
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
  
  // Rare Support - 1 actif + 1 passif (max niveau 80)
  "lyaria": {
    heroId: "lyaria",
    name: "Lyaria",
    element: "Light",
    role: "Support",
    rarity: "Rare",
    spells: {
      level1: "heal",
      level11: "light_aura"  // Passif
    }
  },
  
  // Legendary Tank - 4 sorts + structure 121 (max niveau 150)
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
  
  // Legendary DPS Ranged - 4 sorts + structure 121 (max niveau 150)
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
  
  // Epic DPS Melee - 4 sorts (max niveau 120)
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
  
  // Epic Support - 4 sorts (max niveau 120)
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
  
  // Epic DPS Ranged - 4 sorts (max niveau 120)
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
  
  // Epic Tank - 4 sorts (max niveau 120)
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
  
  // Legendary Support - 4 sorts + structure 121 (max niveau 150)
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
  
  // Legendary DPS Ranged - 4 sorts + structure 121 (max niveau 150)
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
  
  // Mythic DPS Melee - 4 sorts + structures 121 et 151 (max niveau 170)
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
  
  // Mythic Support - 4 sorts + structures 121 et 151 (max niveau 170)
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
  return SPELL_UNLOCK_LEVELS[spellSlot] || 999;
}

/**
 * Obtenir tous les sorts débloqués à un niveau donné pour un héros
 */
export function getSpellsUnlockedAtLevel(heroId: string, level: number): string[] {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) return [];
  
  const unlockedSlots: string[] = [];
  
  // Vérifier chaque slot de sort
  for (const [slotName, unlockLevel] of Object.entries(SPELL_UNLOCK_LEVELS)) {
    if (level >= unlockLevel) {
      const spellId = definition.spells[slotName as keyof typeof definition.spells];
      if (spellId && spellId !== null) {
        unlockedSlots.push(slotName);
      }
    }
  }
  
  return unlockedSlots;
}

/**
 * Vérifier si un héros peut débloquer un sort à un niveau donné
 */
export function canUnlockSpellAtLevel(heroId: string, spellSlot: string, heroLevel: number): boolean {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) return false;
  
  const unlockLevel = SPELL_UNLOCK_LEVELS[spellSlot];
  if (!unlockLevel) return false;
  
  const spellId = definition.spells[spellSlot as keyof typeof definition.spells];
  if (!spellId || spellId === null) return false;
  
  return heroLevel >= unlockLevel;
}

/**
 * Obtenir le prochain sort à débloquer pour un héros
 */
export function getNextSpellUnlock(heroId: string, currentLevel: number): { level: number; spellSlot: string; spellId: string } | null {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) return null;
  
  // Chercher le prochain slot de sort non débloqué
  const sortedSlots = Object.entries(SPELL_UNLOCK_LEVELS)
    .sort((a, b) => a[1] - b[1]); // Trier par niveau croissant
  
  for (const [slotName, unlockLevel] of sortedSlots) {
    if (unlockLevel > currentLevel) {
      const spellId = definition.spells[slotName as keyof typeof definition.spells];
      if (spellId && spellId !== null) {
        return {
          level: unlockLevel,
          spellSlot: slotName,
          spellId: spellId as string
        };
      }
    }
  }
  
  return null;
}

/**
 * Obtenir les sorts initiaux d'un héros (uniquement level1)
 */
export function getInitialSpells(heroId: string): { [key: string]: { id: string; level: number } } {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition || !definition.spells.level1) {
    throw new Error(`No spell definition found for hero: ${heroId}`);
  }
  
  return {
    level1: { id: definition.spells.level1, level: 1 }
  };
}

// server/src/data/heroSpellDefinitions.ts

/**
 * NOUVEAU SYSTÈME DE PROGRESSION DES SORTS - VERSION SIMPLIFIÉE
 * 
 * Déblocage progressif par niveau :
 * - Niveau 1: Premier sort (tous les héros)
 * - Niveau 11: Deuxième sort (si défini)
 * - Niveau 41: Troisième sort ou passif (si défini) 
 * - Niveau 81: Sort ultime (si défini)
 * - Niveau 121: Structure vide pour Legendary+
 * - Niveau 151: Structure vide pour Mythic only
 */

// ===============================================
// CONSTANTES DE DÉBLOCAGE DES SORTS
// ===============================================

export const SPELL_UNLOCK_LEVELS = {
  LEVEL_1: 1,    // Premier sort (tous les héros)
  LEVEL_11: 11,  // Deuxième sort (si défini)
  LEVEL_41: 41,  // Troisième sort ou passif (si défini)
  LEVEL_81: 81,  // Sort ultime (si défini)
  LEVEL_121: 121, // Structure vide pour Legendary+
  LEVEL_151: 151  // Structure vide pour Mythic only
} as const;

export type SpellUnlockLevel = keyof typeof SPELL_UNLOCK_LEVELS;

// ===============================================
// INTERFACE DE DÉFINITION DES SORTS
// ===============================================

export interface HeroSpellDefinition {
  heroId: string;
  name: string;
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  
  // Sorts par niveau de déblocage (nouveau système simplifié)
  level1: string;        // Niveau 1 - Obligatoire pour tous
  level11?: string;      // Niveau 11 - Optionnel selon rareté
  level41?: string;      // Niveau 41 - Optionnel selon rareté  
  level81?: string;      // Niveau 81 - Optionnel selon rareté
  level121?: string;     // Niveau 121 - Futur (Legendary+)
  level151?: string;     // Niveau 151 - Futur (Mythic only)
}

// ===============================================
// BASE DE DONNÉES DES SORTS PAR HÉROS
// ===============================================

export const HERO_SPELL_DEFINITIONS: Record<string, HeroSpellDefinition> = {
  
  // ============================================
  // WATER HEROES (7 total)
  // ============================================
  
  // Common Tank - 1 Sort
  "nerya": {
    heroId: "nerya",
    name: "Nerya",
    element: "Water",
    role: "Tank",
    rarity: "Common",
    level1: "water_barrier"
  },
  
  // Common Support - 1 Sort
  "thalwen": {
    heroId: "thalwen",
    name: "Thalwen",
    element: "Water",
    role: "Support", 
    rarity: "Common",
    level1: "curse_of_the_deep"
  },
  
  // Common DPS Ranged - 1 Sort
  "nora": {
    heroId: "nora",
    name: "Nora",
    element: "Water",
    role: "DPS Ranged",
    rarity: "Common",
    level1: "water_bolt"
  },
  
  // Common DPS Melee - 1 Sort
  "narud": {
    heroId: "narud",
    name: "Narud",
    element: "Water",
    role: "DPS Melee",
    rarity: "Common",
    level1: "tidal_slash"
  },
  
  // Rare Support - 3 Sorts (niveau 1, 11, 81)
  "nereida": {
    heroId: "nereida",
    name: "Nereida",
    element: "Water",
    role: "Support",
    rarity: "Rare",
    level1: "healing_tide",
    level11: "flowing_mana",      // Passif converti en sort niveau 11
    level81: "tidal_blessing"
  },
  
  // Epic DPS Melee - 4 Sorts (niveau 1, 11, 41, 81)
  "vayna": {
    heroId: "vayna", 
    name: "Vayna",
    element: "Water",
    role: "DPS Melee",
    rarity: "Epic",
    level1: "abyssal_strike",
    level11: "pirate_dance",
    level41: "tidal_lifesteal",   // Passif converti en sort niveau 41
    level81: "maelstrom_fury"
  },
  
  // Legendary DPS Melee - 4 Sorts (niveau 1, 11, 41, 81)
  "kaelis": {
    heroId: "kaelis",
    name: "Kaelis", 
    element: "Water",
    role: "DPS Melee",
    rarity: "Legendary",
    level1: "feline_slash",
    level11: "hydro_dash",
    level41: "fluid_movement",    // Passif converti en sort niveau 41
    level81: "tsunami_fury"
  },
  
  // ============================================
  // FIRE HEROES (7 total)
  // ============================================
  
  // Common Tank - 1 Sort
  "brakka": {
    heroId: "brakka",
    name: "Brakka",
    element: "Fire", 
    role: "Tank",
    rarity: "Common",
    level1: "furnace_strike"
  },
  
  // Rare Tank - 3 Sorts (niveau 1, 11, 81)
  "korran": {
    heroId: "korran",
    name: "Korran",
    element: "Fire",
    role: "Tank", 
    rarity: "Rare",
    level1: "ember_bash",
    level11: "flame_shield", 
    level81: "molten_fortress"
  },
  
  // Rare DPS Ranged - 3 Sorts (niveau 1, 11, 81)
  "ignara": {
    heroId: "ignara",
    name: "Ignara",
    element: "Fire",
    role: "DPS Ranged",
    rarity: "Rare", 
    level1: "blazing_surge",
    level11: "fire_blast",
    level81: "inferno_rain"
  },
  
  // Rare Support - 3 Sorts (niveau 1, 41, 81) - Passif au niveau 41
  "albert": {
    heroId: "albert",
    name: "Albert",
    element: "Fire",
    role: "Support",
    rarity: "Rare",
    level1: "flame_turret",
    level41: "engineer_mind",     // Passif converti en sort niveau 41
    level81: "overclock_turret"
  },
  
  // Epic Tank - 4 Sorts (niveau 1, 11, 41, 81)
  "grathul": {
    heroId: "grathul",
    name: "Grathul",
    element: "Fire",
    role: "Tank",
    rarity: "Epic",
    level1: "chain_slam",
    level11: "molten_bind",
    level41: "burning_aura",      // Passif converti en sort niveau 41
    level81: "infernal_chains"
  },
  
  // Legendary Support - 4 Sorts (niveau 1, 11, 41, 81)
  "pyra": {
    heroId: "pyra",
    name: "Pyra", 
    element: "Fire",
    role: "Support",
    rarity: "Legendary",
    level1: "ember_heal",
    level11: "flame_shield",
    level41: "fire_attunement",   // Passif converti en sort niveau 41
    level81: "phoenix_blessing"
  },
  
  // Legendary DPS Melee - 4 Sorts (niveau 1, 11, 41, 81)
  "saryel": {
    heroId: "saryel",
    name: "Saryel",
    element: "Fire",
    role: "DPS Melee", 
    rarity: "Legendary",
    level1: "blazing_slash",
    level11: "fire_dance",
    level41: "crimson_strike",
    level81: "infernal_storm"
  },
  
  // ============================================
  // WIND HEROES (7 total)
  // ============================================
  
  // Common DPS Ranged - 1 Sort
  "braknor": {
    heroId: "braknor",
    name: "Braknor",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Common", 
    level1: "wind_arrow"
  },
  
  // Common Tank - 1 Sort
  "halvar": {
    heroId: "halvar",
    name: "Halvar", 
    element: "Wind",
    role: "Tank",
    rarity: "Common",
    level1: "wind_guard"
  },
  
  // Rare DPS Ranged - 3 Sorts (niveau 1, 11, 81)
  "sylvara": {
    heroId: "sylvara",
    name: "Sylvara",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Rare",
    level1: "javelin_throw",
    level11: "wind_gust", 
    level81: "storm_javelin"
  },
  
  // Rare Support - 3 Sorts (niveau 1, 41, 81) - Passif au niveau 41
  "elyndra": {
    heroId: "elyndra",
    name: "Elyndra",
    element: "Wind",
    role: "Support",
    rarity: "Rare",
    level1: "wind_song",
    level41: "bard_inspiration",  // Passif converti en sort niveau 41
    level81: "symphony_of_storms"
  },
  
  // Rare DPS Melee - 3 Sorts (niveau 1, 11, 81)
  "kaelen": {
    heroId: "kaelen",
    name: "Kaelen",
    element: "Wind", 
    role: "DPS Melee",
    rarity: "Rare",
    level1: "dual_slash",
    level11: "swift_cut",
    level81: "blade_storm"
  },
  
  // Epic DPS Ranged - 4 Sorts (niveau 1, 11, 41, 81)
  "zephyra": {
    heroId: "zephyra", 
    name: "Zephyra",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Epic",
    level1: "wind_arrow",
    level11: "cyclone_shot",
    level41: "piercing_gale",
    level81: "tempest_volley"
  },
  
  // Legendary DPS Melee - 4 Sorts (niveau 1, 11, 41, 81)
  "veyron": {
    heroId: "veyron",
    name: "Veyron",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Legendary", 
    level1: "wind_slash",
    level11: "gale_dash",
    level41: "wind_walker",       // Passif converti en sort niveau 41
    level81: "storm_fury"
  },
  
  // ============================================
  // ELECTRIC HEROES (7 total)
  // ============================================
  
  // Common Support - 1 Sort
  "tynira": {
    heroId: "tynira",
    name: "Tynira", 
    element: "Electric",
    role: "Support",
    rarity: "Common",
    level1: "spark_buff"
  },
  
  // Common DPS Melee - 1 Sort
  "zeyra": {
    heroId: "zeyra",
    name: "Zeyra",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Common",
    level1: "lightning_strike"
  },
  
  // Epic DPS Melee - 4 Sorts (niveau 1, 11, 41, 81)
  "raiken": {
    heroId: "raiken",
    name: "Raiken",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Epic",
    level1: "volt_punch",
    level11: "thunder_combo", 
    level41: "static_charge",     // Passif converti en sort niveau 41
    level81: "lightning_burst"
  },
  
  // Epic Support - 4 Sorts (niveau 1, 11, 41, 81)
  "milia": {
    heroId: "milia",
    name: "Milia",
    element: "Electric",
    role: "Support",
    rarity: "Epic",
    level1: "thunder_hammer",
    level11: "volt_shield",
    level41: "armored_conductor", // Passif converti en sort niveau 41
    level81: "electromagnetic_pulse"
  },
  
  // Epic Tank - 4 Sorts (niveau 1, 11, 41, 81)
  "thalrik": {
    heroId: "thalrik",
    name: "Thalrik", 
    element: "Electric",
    role: "Tank",
    rarity: "Epic",
    level1: "thunder_slam",
    level11: "shock_wave",
    level41: "volt_barrier",
    level81: "storm_bastion"
  },
  
  // Legendary DPS Ranged - 4 Sorts (niveau 1, 11, 41, 81)
  "voltrion": {
    heroId: "voltrion",
    name: "Voltrion",
    element: "Electric",
    role: "DPS Ranged",
    rarity: "Legendary",
    level1: "lightning_bolt",
    level11: "chain_lightning",
    level41: "arc_discharge", 
    level81: "thunderstorm"
  },
  
  // Legendary Tank - 4 Sorts (niveau 1, 11, 41, 81)
  "voltragar": {
    heroId: "voltragar",
    name: "Voltragar",
    element: "Electric",
    role: "Tank",
    rarity: "Legendary",
    level1: "volt_shield",
    level11: "electric_taunt",
    level41: "steel_conductor",   // Passif converti en sort niveau 41
    level81: "tesla_fortress"
  },
  
  // ============================================
  // LIGHT HEROES (6 total)
  // ============================================
  
  // Common DPS Melee - 1 Sort
  "goahn": {
    heroId: "goahn",
    name: "Goahn",
    element: "Light",
    role: "DPS Melee",
    rarity: "Common",
    level1: "holy_strike"
  },
  
  // Rare Tank - 3 Sorts (niveau 1, 11, 81)
  "elyos": {
    heroId: "elyos",
    name: "Elyos",
    element: "Light",
    role: "Tank",
    rarity: "Rare",
    level1: "light_shield",
    level11: "radiant_taunt",
    level81: "divine_fortress"
  },
  
  // Rare DPS Ranged - 3 Sorts (niveau 1, 11, 81)
  "liora": {
    heroId: "liora",
    name: "Liora",
    element: "Light",
    role: "DPS Ranged", 
    rarity: "Rare",
    level1: "light_arrow",
    level11: "radiant_shot",
    level81: "holy_barrage"
  },
  
  // Rare Support - 3 Sorts (niveau 1, 41, 81) - Passif au niveau 41
  "lyaria": {
    heroId: "lyaria",
    name: "Lyaria",
    element: "Light",
    role: "Support",
    rarity: "Rare",
    level1: "heal",
    level41: "light_aura",        // Passif converti en sort niveau 41
    level81: "mass_resurrection"
  },
  
  // Legendary Tank - 4 Sorts (niveau 1, 11, 41, 81)
  "aureon": {
    heroId: "aureon",
    name: "Aureon",
    element: "Light",
    role: "Tank",
    rarity: "Legendary",
    level1: "solar_slam", 
    level11: "radiant_taunt",
    level41: "solar_armor",       // Passif converti en sort niveau 41
    level81: "sun_fortress"
  },
  
  // Legendary DPS Ranged - 4 Sorts (niveau 1, 11, 41, 81)
  "solayne": {
    heroId: "solayne",
    name: "Solayne",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Legendary",
    level1: "solar_beam",
    level11: "radiant_orb",
    level41: "dawn_strike",
    level81: "supernova"
  },
  
  // ============================================
  // DARK/SHADOW HEROES (6 total)  
  // ============================================
  
  // Epic DPS Melee - 4 Sorts (niveau 1, 11, 41, 81)
  "abomys": {
    heroId: "abomys",
    name: "Abomys",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Epic",
    level1: "shadow_strike",
    level11: "void_dash",
    level41: "dark_blade",
    level81: "shadow_rampage"
  },
  
  // Epic Support - 4 Sorts (niveau 1, 11, 41, 81)
  "chorath": {
    heroId: "chorath",
    name: "Chorath",
    element: "Dark",
    role: "Support",
    rarity: "Epic",
    level1: "toll_bell",
    level11: "shadow_aura",
    level41: "fear_aura",         // Passif converti en sort niveau 41
    level81: "death_knell"
  },
  
  // Epic DPS Ranged - 4 Sorts (niveau 1, 11, 41, 81)
  "seliora": {
    heroId: "seliora",
    name: "Seliora", 
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Epic",
    level1: "shadow_dagger",
    level11: "dark_curse",
    level41: "shadow_weaver",     // Passif converti en sort niveau 41
    level81: "void_cascade"
  },
  
  // Epic Tank - 4 Sorts (niveau 1, 11, 41, 81)
  "drogath": {
    heroId: "drogath",
    name: "Drogath",
    element: "Dark",
    role: "Tank",
    rarity: "Epic",
    level1: "bone_slam",
    level11: "life_drain",
    level41: "undead_resilience", // Passif converti en sort niveau 41
    level81: "unholy_resurrection"
  },
  
  // Legendary Support - 4 Sorts (niveau 1, 11, 41, 81)
  "nyxara": {
    heroId: "nyxara",
    name: "Nyxara",
    element: "Dark", 
    role: "Support",
    rarity: "Legendary",
    level1: "summon_shade",
    level11: "dark_blessing",
    level41: "summoner_mastery",  // Passif converti en sort niveau 41
    level81: "shadow_legion"
  },
  
  // Legendary DPS Ranged - 4 Sorts (niveau 1, 11, 41, 81)
  "aleyra": {
    heroId: "aleyra",
    name: "Aleyra",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Legendary",
    level1: "void_bolt",
    level11: "shadow_pierce",
    level41: "dark_nova",
    level81: "eclipse"
  },
  
  // ============================================
  // MYTHIC HEROES (2 total)
  // ============================================
  
  // Mythic DPS Melee (Lunar Form) - 4 Sorts + futurs
  "kaorim_lunar": {
    heroId: "kaorim_lunar",
    name: "Kaorim (Lunar Form)",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Mythic",
    level1: "lunar_strike",
    level11: "shadow_dance",
    level41: "celestial_duality", // Passif converti en sort niveau 41
    level81: "eclipse_fury",
    level151: "void_dominion"     // Sort exclusif Mythic
  },
  
  // Mythic Support (Solar Form) - 4 Sorts + futurs
  "kaorim_solar": {
    heroId: "kaorim_solar",
    name: "Kaorim (Solar Form)",
    element: "Light",
    role: "Support", 
    rarity: "Mythic",
    level1: "solar_heal",
    level11: "radiant_blessing",
    level41: "celestial_duality", // Passif converti en sort niveau 41
    level81: "dawn_resurrection",
    level151: "solar_dominion"    // Sort exclusif Mythic
  }
};

// ===============================================
// FONCTIONS UTILITAIRES DE BASE
// ===============================================

/**
 * Récupérer la définition des sorts d'un héros
 */
export function getHeroSpellDefinition(heroId: string): HeroSpellDefinition | null {
  return HERO_SPELL_DEFINITIONS[heroId] || null;
}

// ===============================================
// FONCTIONS HELPER POUR LA GESTION DES SORTS
// ===============================================

/**
 * Récupère tous les sorts débloqués selon le niveau du héros
 * @param heroId - ID du héros
 * @param heroLevel - Niveau actuel du héros
 * @returns Array des sorts débloqués avec leur niveau de déblocage
 */
export function getUnlockedSpells(heroId: string, heroLevel: number): Array<{
  level: number;
  spellId: string;
  slot: string;
}> {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    console.warn(`⚠️ Aucune définition trouvée pour le héros: ${heroId}`);
    return [];
  }

  const unlockedSpells: Array<{ level: number; spellId: string; slot: string }> = [];

  // Niveau 1 - Premier sort (toujours présent)
  if (heroLevel >= SPELL_UNLOCK_LEVELS.LEVEL_1 && definition.level1) {
    unlockedSpells.push({
      level: SPELL_UNLOCK_LEVELS.LEVEL_1,
      spellId: definition.level1,
      slot: "level1"
    });
  }

  // Niveau 11 - Deuxième sort (si défini)
  if (heroLevel >= SPELL_UNLOCK_LEVELS.LEVEL_11 && definition.level11) {
    unlockedSpells.push({
      level: SPELL_UNLOCK_LEVELS.LEVEL_11,
      spellId: definition.level11,
      slot: "level11"
    });
  }

  // Niveau 41 - Troisième sort ou passif (si défini)
  if (heroLevel >= SPELL_UNLOCK_LEVELS.LEVEL_41 && definition.level41) {
    unlockedSpells.push({
      level: SPELL_UNLOCK_LEVELS.LEVEL_41,
      spellId: definition.level41,
      slot: "level41"
    });
  }

  // Niveau 81 - Sort ultime (si défini)
  if (heroLevel >= SPELL_UNLOCK_LEVELS.LEVEL_81 && definition.level81) {
    unlockedSpells.push({
      level: SPELL_UNLOCK_LEVELS.LEVEL_81,
      spellId: definition.level81,
      slot: "level81"
    });
  }

  // Niveau 121 - Futur (Legendary+)
  if (heroLevel >= SPELL_UNLOCK_LEVELS.LEVEL_121 && definition.level121) {
    unlockedSpells.push({
      level: SPELL_UNLOCK_LEVELS.LEVEL_121,
      spellId: definition.level121,
      slot: "level121"
    });
  }

  // Niveau 151 - Futur (Mythic only)
  if (heroLevel >= SPELL_UNLOCK_LEVELS.LEVEL_151 && definition.level151) {
    unlockedSpells.push({
      level: SPELL_UNLOCK_LEVELS.LEVEL_151,
      spellId: definition.level151,
      slot: "level151"
    });
  }

  return unlockedSpells;
}

/**
 * Obtient le prochain niveau de déblocage de sort pour un héros
 * @param heroId - ID du héros
 * @param currentLevel - Niveau actuel du héros
 * @returns Informations sur le prochain déblocage ou null si aucun
 */
export function getNextSpellUnlock(heroId: string, currentLevel: number): {
  nextLevel: number;
  spellId: string;
  slot: string;
  levelsRemaining: number;
} | null {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    return null;
  }

  // Vérifier chaque niveau de déblocage dans l'ordre
  const unlockLevels = [
    { level: SPELL_UNLOCK_LEVELS.LEVEL_1, spellId: definition.level1, slot: "level1" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_11, spellId: definition.level11, slot: "level11" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_41, spellId: definition.level41, slot: "level41" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_81, spellId: definition.level81, slot: "level81" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_121, spellId: definition.level121, slot: "level121" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_151, spellId: definition.level151, slot: "level151" }
  ];

  for (const unlock of unlockLevels) {
    // Si le sort existe et que le héros n'a pas encore atteint ce niveau
    if (unlock.spellId && currentLevel < unlock.level) {
      return {
        nextLevel: unlock.level,
        spellId: unlock.spellId,
        slot: unlock.slot,
        levelsRemaining: unlock.level - currentLevel
      };
    }
  }

  return null; // Aucun sort à débloquer
}

/**
 * Vérifie si un sort spécifique est débloqué à un niveau donné
 * @param heroId - ID du héros
 * @param heroLevel - Niveau du héros
 * @param spellSlot - Slot du sort à vérifier ("level1", "level11", etc.)
 * @returns true si le sort est débloqué, false sinon
 */
export function isSpellUnlocked(heroId: string, heroLevel: number, spellSlot: string): boolean {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    return false;
  }

  // Mapping des slots aux niveaux requis
  const slotToLevel: Record<string, number> = {
    "level1": SPELL_UNLOCK_LEVELS.LEVEL_1,
    "level11": SPELL_UNLOCK_LEVELS.LEVEL_11,
    "level41": SPELL_UNLOCK_LEVELS.LEVEL_41,
    "level81": SPELL_UNLOCK_LEVELS.LEVEL_81,
    "level121": SPELL_UNLOCK_LEVELS.LEVEL_121,
    "level151": SPELL_UNLOCK_LEVELS.LEVEL_151
  };

  const requiredLevel = slotToLevel[spellSlot];
  if (requiredLevel === undefined) {
    console.warn(`⚠️ Slot de sort invalide: ${spellSlot}`);
    return false;
  }

  // Vérifier si le héros a le niveau requis ET si le sort existe dans la définition
  const spellId = (definition as any)[spellSlot];
  return heroLevel >= requiredLevel && !!spellId;
}

/**
 * Obtient tous les niveaux de déblocage disponibles pour un héros
 * @param heroId - ID du héros
 * @returns Array des niveaux où des sorts sont définis
 */
export function getAvailableSpellLevels(heroId: string): Array<{
  level: number;
  slot: string;
  spellId: string;
}> {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    return [];
  }

  const availableLevels: Array<{ level: number; slot: string; spellId: string }> = [];

  // Vérifier chaque niveau possible
  const levelMappings = [
    { level: SPELL_UNLOCK_LEVELS.LEVEL_1, slot: "level1", spellId: definition.level1 },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_11, slot: "level11", spellId: definition.level11 },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_41, slot: "level41", spellId: definition.level41 },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_81, slot: "level81", spellId: definition.level81 },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_121, slot: "level121", spellId: definition.level121 },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_151, slot: "level151", spellId: definition.level151 }
  ];

  for (const mapping of levelMappings) {
    if (mapping.spellId) {
      availableLevels.push({
        level: mapping.level,
        slot: mapping.slot,
        spellId: mapping.spellId
      });
    }
  }

  return availableLevels;
}

/**
 * Calcule le nombre total de sorts qu'un héros peut débloquer
 * @param heroId - ID du héros
 * @returns Nombre total de sorts disponibles
 */
export function getTotalSpellsCount(heroId: string): number {
  const availableLevels = getAvailableSpellLevels(heroId);
  return availableLevels.length;
}

/**
 * Obtient le pourcentage de sorts débloqués pour un héros
 * @param heroId - ID du héros
 * @param heroLevel - Niveau actuel du héros
 * @returns Pourcentage de sorts débloqués (0-100)
 */
export function getSpellUnlockProgress(heroId: string, heroLevel: number): number {
  const totalSpells = getTotalSpellsCount(heroId);
  const unlockedSpells = getUnlockedSpells(heroId, heroLevel);
  
  if (totalSpells === 0) return 0;
  
  return Math.round((unlockedSpells.length / totalSpells) * 100);
}

/**
 * Obtient la liste de tous les sorts manquants pour un héros
 * @param heroId - ID du héros
 * @param heroLevel - Niveau actuel du héros
 * @returns Array des sorts non encore débloqués
 */
export function getMissingSpells(heroId: string, heroLevel: number): Array<{
  level: number;
  spellId: string;
  slot: string;
  levelsRemaining: number;
}> {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    return [];
  }

  const missingSpells: Array<{ level: number; spellId: string; slot: string; levelsRemaining: number }> = [];

  const unlockLevels = [
    { level: SPELL_UNLOCK_LEVELS.LEVEL_1, spellId: definition.level1, slot: "level1" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_11, spellId: definition.level11, slot: "level11" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_41, spellId: definition.level41, slot: "level41" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_81, spellId: definition.level81, slot: "level81" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_121, spellId: definition.level121, slot: "level121" },
    { level: SPELL_UNLOCK_LEVELS.LEVEL_151, spellId: definition.level151, slot: "level151" }
  ];

  for (const unlock of unlockLevels) {
    // Si le sort existe et que le héros n'a pas encore atteint ce niveau
    if (unlock.spellId && heroLevel < unlock.level) {
      missingSpells.push({
        level: unlock.level,
        spellId: unlock.spellId,
        slot: unlock.slot,
        levelsRemaining: unlock.level - heroLevel
      });
    }
  }

  return missingSpells;
}

/**
 * Vérifie si un héros peut apprendre de nouveaux sorts
 * @param heroId - ID du héros
 * @param heroLevel - Niveau actuel du héros
 * @returns true si des sorts restent à débloquer
 */
export function canLearnMoreSpells(heroId: string, heroLevel: number): boolean {
  const nextUnlock = getNextSpellUnlock(heroId, heroLevel);
  return nextUnlock !== null;
}

/**
 * Obtient un résumé complet des sorts pour un héros
 * @param heroId - ID du héros
 * @param heroLevel - Niveau actuel du héros
 * @returns Résumé complet avec sorts débloqués, manquants, etc.
 */
export function getHeroSpellSummary(heroId: string, heroLevel: number): {
  heroInfo: {
    heroId: string;
    name: string;
    element: string;
    role: string;
    rarity: string;
  };
  spellProgress: {
    currentLevel: number;
    unlockedSpells: Array<{ level: number; spellId: string; slot: string }>;
    nextUnlock: { nextLevel: number; spellId: string; slot: string; levelsRemaining: number } | null;
    missingSpells: Array<{ level: number; spellId: string; slot: string; levelsRemaining: number }>;
    progressPercentage: number;
    totalSpells: number;
    unlockedCount: number;
  };
} | null {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    return null;
  }

  const unlockedSpells = getUnlockedSpells(heroId, heroLevel);
  const nextUnlock = getNextSpellUnlock(heroId, heroLevel);
  const missingSpells = getMissingSpells(heroId, heroLevel);
  const progressPercentage = getSpellUnlockProgress(heroId, heroLevel);
  const totalSpells = getTotalSpellsCount(heroId);

  return {
    heroInfo: {
      heroId: definition.heroId,
      name: definition.name,
      element: definition.element,
      role: definition.role,
      rarity: definition.rarity
    },
    spellProgress: {
      currentLevel: heroLevel,
      unlockedSpells,
      nextUnlock,
      missingSpells,
      progressPercentage,
      totalSpells,
      unlockedCount: unlockedSpells.length
    }
  };
}

// ===============================================
// FONCTIONS DE VALIDATION ET UTILITAIRES
// ===============================================

/**
 * Valide si un héros existe dans les définitions
 * @param heroId - ID du héros à valider
 * @returns true si le héros existe
 */
export function heroExists(heroId: string): boolean {
  return HERO_SPELL_DEFINITIONS.hasOwnProperty(heroId);
}

/**
 * Obtient la liste de tous les héros par élément
 * @param element - Élément à filtrer
 * @returns Array des héros de cet élément
 */
export function getHeroesByElement(element: string): HeroSpellDefinition[] {
  return Object.values(HERO_SPELL_DEFINITIONS).filter(
    hero => hero.element.toLowerCase() === element.toLowerCase()
  );
}

/**
 * Obtient la liste de tous les héros par rareté
 * @param rarity - Rareté à filtrer
 * @returns Array des héros de cette rareté
 */
export function getHeroesByRarity(rarity: string): HeroSpellDefinition[] {
  return Object.values(HERO_SPELL_DEFINITIONS).filter(
    hero => hero.rarity.toLowerCase() === rarity.toLowerCase()
  );
}

/**
 * Obtient la liste de tous les héros par rôle
 * @param role - Rôle à filtrer
 * @returns Array des héros de ce rôle
 */
export function getHeroesByRole(role: string): HeroSpellDefinition[] {
  return Object.values(HERO_SPELL_DEFINITIONS).filter(
    hero => hero.role.toLowerCase() === role.toLowerCase()
  );
}

/**
 * Obtient les statistiques globales des héros
 * @returns Statistiques de répartition
 */
export function getHeroStats(): {
  totalHeroes: number;
  byElement: Record<string, number>;
  byRarity: Record<string, number>;
  byRole: Record<string, number>;
  averageSpellsPerHero: number;
} {
  const heroes = Object.values(HERO_SPELL_DEFINITIONS);
  
  const byElement: Record<string, number> = {};
  const byRarity: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  let totalSpells = 0;

  heroes.forEach(hero => {
    // Compter par élément
    byElement[hero.element] = (byElement[hero.element] || 0) + 1;
    
    // Compter par rareté
    byRarity[hero.rarity] = (byRarity[hero.rarity] || 0) + 1;
    
    // Compter par rôle
    byRole[hero.role] = (byRole[hero.role] || 0) + 1;
    
    // Compter les sorts
    totalSpells += getTotalSpellsCount(hero.heroId);
  });

  return {
    totalHeroes: heroes.length,
    byElement,
    byRarity,
    byRole,
    averageSpellsPerHero: Math.round((totalSpells / heroes.length) * 100) / 100
  };
}

// ===============================================
// FONCTION POUR INITIALISATION DES SORTS
// ===============================================

/**
 * Obtient les sorts initiaux d'un héros selon le nouveau système
 * @param heroId - ID du héros
 * @param rarity - Rareté du héros (non utilisée dans le nouveau système)
 * @returns Sorts initiaux avec leur niveau de déblocage
 */
export function getInitialSpells(heroId: string, rarity: string): {
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
  
  // Niveau 1 - toujours présent
  if (definition.level1) {
    spells.level1 = { id: definition.level1, level: 1 };
  }
  
  // Niveau 11 - si défini
  if (definition.level11) {
    spells.level11 = { id: definition.level11, level: 1 };
  }
  
  // Niveau 41 - si défini
  if (definition.level41) {
    spells.level41 = { id: definition.level41, level: 1 };
  }
  
  // Niveau 81 - si défini
  if (definition.level81) {
    spells.level81 = { id: definition.level81, level: 1 };
  }
  
  // Niveau 121 - si défini
  if (definition.level121) {
    spells.level121 = { id: definition.level121, level: 1 };
  }
  
  // Niveau 151 - si défini
  if (definition.level151) {
    spells.level151 = { id: definition.level151, level: 1 };
  }
  
  return spells;
}

// ===============================================
// FONCTIONS POUR COMPATIBILITY ANCIEN SYSTÈME
// ===============================================

/**
 * Convertit un slot de l'ancien système vers le nouveau
 * @deprecated - Pour compatibilité avec l'ancien système
 */
export function convertOldSlotToNew(oldSlot: string): string | null {
  const mapping: Record<string, string> = {
    "active1": "level1",
    "active2": "level11", 
    "active3": "level41",
    "ultimate": "level81",
    "passive": "level41" // Les passifs sont maintenant au niveau 41
  };
  
  return mapping[oldSlot] || null;
}

/**
 * Obtient les sorts selon l'ancien système pour compatibilité
 * @deprecated - Utilisez getUnlockedSpells() à la place
 */
export function getLegacySpellSlots(heroId: string, rarity: string): {
  active1: boolean;
  active2: boolean;
  active3: boolean;
  ultimate: boolean;
  passive: boolean;
} {
  const definition = getHeroSpellDefinition(heroId);
  
  if (!definition) {
    console.warn(`⚠️ Pas de définition trouvée pour ${heroId}, utilisation des slots par défaut`);
    // Fallback selon rareté
    if (rarity === "Common") {
      return { active1: true, active2: false, active3: false, ultimate: false, passive: false };
    } else if (rarity === "Rare") {
      return { active1: true, active2: true, active3: false, ultimate: true, passive: false };
    } else {
      return { active1: true, active2: true, active3: true, ultimate: true, passive: true };
    }
  }
  
  return {
    active1: !!definition.level1,
    active2: !!definition.level11,
    active3: !!definition.level41,
    ultimate: !!definition.level81,
    passive: !!definition.level41 // Les passifs sont au niveau 41
  };
}

/**
 * Obtient les sorts initiaux selon l'ancien système pour compatibilité
 * @deprecated - Le nouveau système n'utilise plus cette approche
 */
export function getLegacyInitialSpells(heroId: string, rarity: string): {
  active1?: { id: string; level: number };
  active2?: { id: string; level: number };
  active3?: { id: string; level: number };
  ultimate?: { id: string; level: number };
  passive?: { id: string; level: number };
} {
  const definition = getHeroSpellDefinition(heroId);
  if (!definition) {
    throw new Error(`No spell definition found for hero: ${heroId}`);
  }
  
  const spells: any = {};
  
  // Active 1 -> level1
  if (definition.level1) {
    spells.active1 = { id: definition.level1, level: 1 };
  }
  
  // Active 2 -> level11
  if (definition.level11) {
    spells.active2 = { id: definition.level11, level: 1 };
  }
  
  // Active 3 -> level41
  if (definition.level41) {
    spells.active3 = { id: definition.level41, level: 1 };
  }
  
  // Ultimate -> level81
  if (definition.level81) {
    spells.ultimate = { id: definition.level81, level: 1 };
  }
  
  // Passive -> level41 (même que active3)
  if (definition.level41) {
    spells.passive = { id: definition.level41, level: 1 };
  }
  
  return spells;
}

// ===============================================
// FONCTIONS POUR STATS DES SORTS
// ===============================================

/**
 * Obtient les stats d'un sort à un niveau donné
 * @param spellId - ID du sort
 * @param level - Niveau du sort
 * @param rarity - Rareté du héros
 * @returns Stats calculées du sort
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
  // Trouver le héros qui possède ce sort
  const heroWithSpell = Object.values(HERO_SPELL_DEFINITIONS).find(hero => 
    hero.level1 === spellId || 
    hero.level11 === spellId || 
    hero.level41 === spellId || 
    hero.level81 === spellId || 
    hero.level121 === spellId || 
    hero.level151 === spellId
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

  // Déterminer le type de sort selon le niveau de déblocage
  let isUltimate = false;
  let isPassive = false;
  let spellTier = 1; // 1=basic, 2=advanced, 3=expert, 4=ultimate

  if (heroWithSpell.level81 === spellId || heroWithSpell.level121 === spellId || heroWithSpell.level151 === spellId) {
    isUltimate = true;
    spellTier = 4;
  } else if (heroWithSpell.level41 === spellId) {
    spellTier = 3;
    // Les sorts niveau 41 peuvent être des passifs selon leur nom
    if (spellId.includes('aura') || spellId.includes('mastery') || spellId.includes('duality') || 
        spellId.includes('armor') || spellId.includes('conductor') || spellId.includes('resilience') ||
        spellId.includes('weaver') || spellId.includes('lifesteal') || spellId.includes('movement') ||
        spellId.includes('attunement') || spellId.includes('walker') || spellId.includes('charge') ||
        spellId.includes('inspiration') || spellId.includes('mind')) {
      isPassive = true;
    }
  } else if (heroWithSpell.level11 === spellId) {
    spellTier = 2;
  } else {
    spellTier = 1;
  }

  // Multiplicateurs de base selon la rareté
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

  // Les passifs n'ont pas de stats de combat directs
  if (isPassive) {
    return {
      damage: 0,
      healing: 0,
      cooldown: 0,
      duration: 0,
      energyCost: 0,
      effect: spellId,
      additionalEffects: {
        type: "passive",
        description: `Passive effect: ${spellId}`,
        tier: spellTier
      }
    };
  }

  // Base stats selon le rôle et le tier
  let baseDamage = 0;
  let baseHealing = 0;
  let baseCooldown = 3;
  let baseEnergyCost = 20;
  let duration = 0;

  // Ajustement selon le tier du sort
  const tierMultiplier = [1.0, 1.0, 1.5, 2.0, 3.0][spellTier] || 1.0;

  if (isUltimate) {
    baseDamage = role === "DPS Melee" ? 300 : 
                 role === "DPS Ranged" ? 250 : 
                 role === "Tank" ? 150 : 100;
    baseHealing = role === "Support" ? 200 : 0;
    baseCooldown = 8;
    baseEnergyCost = 100;
    duration = 3;
  } else {
    baseDamage = role === "DPS Melee" ? 100 : 
                 role === "DPS Ranged" ? 80 : 
                 role === "Tank" ? 50 : 30;
    baseHealing = role === "Support" ? 60 : 0;
    baseCooldown = Math.max(2, 4 - spellTier);
    baseEnergyCost = 15 + (spellTier * 5);
    duration = spellTier;
  }

  // Application des multiplicateurs
  baseDamage *= tierMultiplier;
  baseHealing *= tierMultiplier;

  // Scaling par niveau
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
      type: isUltimate ? "ultimate" : "active",
      tier: spellTier,
      unlockLevel: heroWithSpell.level1 === spellId ? 1 :
                   heroWithSpell.level11 === spellId ? 11 :
                   heroWithSpell.level41 === spellId ? 41 :
                   heroWithSpell.level81 === spellId ? 81 :
                   heroWithSpell.level121 === spellId ? 121 :
                   heroWithSpell.level151 === spellId ? 151 : 1
    }
  };
}

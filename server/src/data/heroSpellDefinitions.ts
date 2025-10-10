// server/src/data/heroSpellDefinitions.ts

/**
 * Définitions des sorts par héros
 * Structure selon la rareté:
 * - Common: 1 Actif
 * - Rare: 2 Actifs + 1 Ultime OU 1 Actif + 1 Passif + 1 Ultime
 * - Epic: 2 Actifs + 1 Passif + 1 Ultime OU 3 Actifs + 1 Ultime
 * - Legendary: 2 Actifs + 1 Passif + 1 Ultime OU 3 Actifs + 1 Ultime
 * - Mythic: 2 Actifs + 1 Passif + 1 Ultime OU 3 Actifs + 1 Ultime (avec sorts combinés)
 */

export interface HeroSpellDefinition {
  heroId: string;
  name: string;
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  
  // Sorts actifs (1-3 selon rareté)
  active1: string;           // Toutes raretés
  active2?: string;          // Rare+
  active3?: string;          // Epic+ (variante 3 actifs)
  
  // Sort ultime (Rare+)
  ultimate?: string;
  
  // Sort passif (Rare+ selon variante, Epic+ toujours pour variante 2 actifs)
  passive?: string;
}

/**
 * Base de données des sorts par héros
 */
export const HERO_SPELL_DEFINITIONS: Record<string, HeroSpellDefinition> = {
  
  // ============================================
  // WATER HEROES (7 total)
  // ============================================
  
  // Common Tank - 1 Actif
  "nerya": {
    heroId: "nerya",
    name: "Nerya",
    element: "Water",
    role: "Tank",
    rarity: "Common",
    active1: "water_barrier"
  },
  
  // Common Support - 1 Actif
  "thalwen": {
    heroId: "thalwen",
    name: "Thalwen",
    element: "Water",
    role: "Support",
    rarity: "Common",
    active1: "curse_of_the_deep"
  },
  
  // Common DPS Ranged - 1 Actif
  "nora": {
    heroId: "nora",
    name: "Nora",
    element: "Water",
    role: "DPS Ranged",
    rarity: "Common",
    active1: "water_bolt"
  },
  
  // Common DPS Melee - 1 Actif
  "narud": {
    heroId: "narud",
    name: "Narud",
    element: "Water",
    role: "DPS Melee",
    rarity: "Common",
    active1: "tidal_slash"
  },
  
  // Rare Support - Variante: 1 Actif + 1 Passif + 1 Ultime
  "nereida": {
    heroId: "nereida",
    name: "Nereida",
    element: "Water",
    role: "Support",
    rarity: "Rare",
    active1: "healing_tide",
    passive: "flowing_mana",
    ultimate: "tidal_blessing"
  },
  
  // Epic DPS Melee - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "vayna": {
    heroId: "vayna",
    name: "Vayna",
    element: "Water",
    role: "DPS Melee",
    rarity: "Epic",
    active1: "abyssal_strike",
    active2: "pirate_dance",
    passive: "tidal_lifesteal",
    ultimate: "maelstrom_fury"
  },
  
  // Legendary DPS Melee - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "kaelis": {
    heroId: "kaelis",
    name: "Kaelis",
    element: "Water",
    role: "DPS Melee",
    rarity: "Legendary",
    active1: "feline_slash",
    active2: "hydro_dash",
    passive: "fluid_movement",
    ultimate: "tsunami_fury"
  },
  
  // ============================================
  // FIRE HEROES (7 total)
  // ============================================
  
  // Common Tank - 1 Actif
  "brakka": {
    heroId: "brakka",
    name: "Brakka",
    element: "Fire",
    role: "Tank",
    rarity: "Common",
    active1: "furnace_strike"
  },
  
  // Rare Tank - Variante: 2 Actifs + 1 Ultime
  "korran": {
    heroId: "korran",
    name: "Korran",
    element: "Fire",
    role: "Tank",
    rarity: "Rare",
    active1: "ember_bash",
    active2: "flame_shield",
    ultimate: "molten_fortress"
  },
  
  // Rare DPS Ranged - Variante: 2 Actifs + 1 Ultime
  "ignara": {
    heroId: "ignara",
    name: "Ignara",
    element: "Fire",
    role: "DPS Ranged",
    rarity: "Rare",
    active1: "blazing_surge",
    active2: "fire_blast",
    ultimate: "inferno_rain"
  },
  
  // Rare Support - Variante: 1 Actif + 1 Passif + 1 Ultime
  "albert": {
    heroId: "albert",
    name: "Albert",
    element: "Fire",
    role: "Support",
    rarity: "Rare",
    active1: "flame_turret",
    passive: "engineer_mind",
    ultimate: "overclock_turret"
  },
  
  // Epic Tank - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "grathul": {
    heroId: "grathul",
    name: "Grathul",
    element: "Fire",
    role: "Tank",
    rarity: "Epic",
    active1: "chain_slam",
    active2: "molten_bind",
    passive: "burning_aura",
    ultimate: "infernal_chains"
  },
  
  // Legendary Support - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "pyra": {
    heroId: "pyra",
    name: "Pyra",
    element: "Fire",
    role: "Support",
    rarity: "Legendary",
    active1: "ember_heal",
    active2: "flame_shield",
    passive: "fire_attunement",
    ultimate: "phoenix_blessing"
  },
  
  // Legendary DPS Melee - Variante: 3 Actifs + 1 Ultime
  "saryel": {
    heroId: "saryel",
    name: "Saryel",
    element: "Fire",
    role: "DPS Melee",
    rarity: "Legendary",
    active1: "blazing_slash",
    active2: "fire_dance",
    active3: "crimson_strike",
    ultimate: "infernal_storm"
  },
  
  // ============================================
  // WIND HEROES (7 total)
  // ============================================
  
  // Common DPS Ranged - 1 Actif
  "braknor": {
    heroId: "braknor",
    name: "Braknor",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Common",
    active1: "wind_arrow"
  },
  
  // Common Tank - 1 Actif
  "halvar": {
    heroId: "halvar",
    name: "Halvar",
    element: "Wind",
    role: "Tank",
    rarity: "Common",
    active1: "wind_guard"
  },
  
  // Rare DPS Ranged - Variante: 2 Actifs + 1 Ultime
  "sylvara": {
    heroId: "sylvara",
    name: "Sylvara",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Rare",
    active1: "javelin_throw",
    active2: "wind_gust",
    ultimate: "storm_javelin"
  },
  
  // Rare Support - Variante: 1 Actif + 1 Passif + 1 Ultime
  "elyndra": {
    heroId: "elyndra",
    name: "Elyndra",
    element: "Wind",
    role: "Support",
    rarity: "Rare",
    active1: "wind_song",
    passive: "bard_inspiration",
    ultimate: "symphony_of_storms"
  },
  
  // Rare DPS Melee - Variante: 2 Actifs + 1 Ultime
  "kaelen": {
    heroId: "kaelen",
    name: "Kaelen",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Rare",
    active1: "dual_slash",
    active2: "swift_cut",
    ultimate: "blade_storm"
  },
  
  // Epic DPS Ranged - Variante: 3 Actifs + 1 Ultime
  "zephyra": {
    heroId: "zephyra",
    name: "Zephyra",
    element: "Wind",
    role: "DPS Ranged",
    rarity: "Epic",
    active1: "wind_arrow",
    active2: "cyclone_shot",
    active3: "piercing_gale",
    ultimate: "tempest_volley"
  },
  
  // Legendary DPS Melee - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "veyron": {
    heroId: "veyron",
    name: "Veyron",
    element: "Wind",
    role: "DPS Melee",
    rarity: "Legendary",
    active1: "wind_slash",
    active2: "gale_dash",
    passive: "wind_walker",
    ultimate: "storm_fury"
  },
  
  // ============================================
  // ELECTRIC HEROES (7 total)
  // ============================================
  
  // Common Support - 1 Actif
  "tynira": {
    heroId: "tynira",
    name: "Tynira",
    element: "Electric",
    role: "Support",
    rarity: "Common",
    active1: "spark_buff"
  },
  
  // Common DPS Melee - 1 Actif
  "zeyra": {
    heroId: "zeyra",
    name: "Zeyra",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Common",
    active1: "lightning_strike"
  },
  
  // Epic DPS Melee - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "raiken": {
    heroId: "raiken",
    name: "Raiken",
    element: "Electric",
    role: "DPS Melee",
    rarity: "Epic",
    active1: "volt_punch",
    active2: "thunder_combo",
    passive: "static_charge",
    ultimate: "lightning_burst"
  },
  
  // Epic Support - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "milia": {
    heroId: "milia",
    name: "Milia",
    element: "Electric",
    role: "Support",
    rarity: "Epic",
    active1: "thunder_hammer",
    active2: "volt_shield",
    passive: "armored_conductor",
    ultimate: "electromagnetic_pulse"
  },
  
  // Epic Tank - Variante: 3 Actifs + 1 Ultime
  "thalrik": {
    heroId: "thalrik",
    name: "Thalrik",
    element: "Electric",
    role: "Tank",
    rarity: "Epic",
    active1: "thunder_slam",
    active2: "shock_wave",
    active3: "volt_barrier",
    ultimate: "storm_bastion"
  },
  
  // Legendary DPS Ranged - Variante: 3 Actifs + 1 Ultime
  "voltrion": {
    heroId: "voltrion",
    name: "Voltrion",
    element: "Electric",
    role: "DPS Ranged",
    rarity: "Legendary",
    active1: "lightning_bolt",
    active2: "chain_lightning",
    active3: "arc_discharge",
    ultimate: "thunderstorm"
  },
  
  // Legendary Tank - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "voltragar": {
    heroId: "voltragar",
    name: "Voltragar",
    element: "Electric",
    role: "Tank",
    rarity: "Legendary",
    active1: "volt_shield",
    active2: "electric_taunt",
    passive: "steel_conductor",
    ultimate: "tesla_fortress"
  },
  
  // ============================================
  // LIGHT HEROES (6 total)
  // ============================================
  
  // Common DPS Melee - 1 Actif
  "goahn": {
    heroId: "goahn",
    name: "Goahn",
    element: "Light",
    role: "DPS Melee",
    rarity: "Common",
    active1: "holy_strike"
  },
  
  // Rare Tank - Variante: 2 Actifs + 1 Ultime
  "elyos": {
    heroId: "elyos",
    name: "Elyos",
    element: "Light",
    role: "Tank",
    rarity: "Rare",
    active1: "light_shield",
    active2: "radiant_taunt",
    ultimate: "divine_fortress"
  },
  
  // Rare DPS Ranged - Variante: 2 Actifs + 1 Ultime
  "liora": {
    heroId: "liora",
    name: "Liora",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Rare",
    active1: "light_arrow",
    active2: "radiant_shot",
    ultimate: "holy_barrage"
  },
  
  // Rare Support - Variante: 1 Actif + 1 Passif + 1 Ultime
  "lyaria": {
    heroId: "lyaria",
    name: "Lyaria",
    element: "Light",
    role: "Support",
    rarity: "Rare",
    active1: "heal",
    passive: "light_aura",
    ultimate: "mass_resurrection"
  },
  
  // Legendary Tank - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "aureon": {
    heroId: "aureon",
    name: "Aureon",
    element: "Light",
    role: "Tank",
    rarity: "Legendary",
    active1: "solar_slam",
    active2: "radiant_taunt",
    passive: "solar_armor",
    ultimate: "sun_fortress"
  },
  
  // Legendary DPS Ranged - Variante: 3 Actifs + 1 Ultime
  "solayne": {
    heroId: "solayne",
    name: "Solayne",
    element: "Light",
    role: "DPS Ranged",
    rarity: "Legendary",
    active1: "solar_beam",
    active2: "radiant_orb",
    active3: "dawn_strike",
    ultimate: "supernova"
  },
  
  // ============================================
  // DARK/SHADOW HEROES (6 total)
  // ============================================
  
  // Epic DPS Melee - Variante: 3 Actifs + 1 Ultime
  "abomys": {
    heroId: "abomys",
    name: "Abomys",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Epic",
    active1: "shadow_strike",
    active2: "void_dash",
    active3: "dark_blade",
    ultimate: "shadow_rampage"
  },
  
  // Epic Support - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "chorath": {
    heroId: "chorath",
    name: "Chorath",
    element: "Dark",
    role: "Support",
    rarity: "Epic",
    active1: "toll_bell",
    active2: "shadow_aura",
    passive: "fear_aura",
    ultimate: "death_knell"
  },
  
  // Epic DPS Ranged - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "seliora": {
    heroId: "seliora",
    name: "Seliora",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Epic",
    active1: "shadow_dagger",
    active2: "dark_curse",
    passive: "shadow_weaver",
    ultimate: "void_cascade"
  },
  
  // Epic Tank - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "drogath": {
    heroId: "drogath",
    name: "Drogath",
    element: "Dark",
    role: "Tank",
    rarity: "Epic",
    active1: "bone_slam",
    active2: "life_drain",
    passive: "undead_resilience",
    ultimate: "unholy_resurrection"
  },
  
  // Legendary Support - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "nyxara": {
    heroId: "nyxara",
    name: "Nyxara",
    element: "Dark",
    role: "Support",
    rarity: "Legendary",
    active1: "summon_shade",
    active2: "dark_blessing",
    passive: "summoner_mastery",
    ultimate: "shadow_legion"
  },
  
  // Legendary DPS Ranged - Variante: 3 Actifs + 1 Ultime
  "aleyra": {
    heroId: "aleyra",
    name: "Aleyra",
    element: "Dark",
    role: "DPS Ranged",
    rarity: "Legendary",
    active1: "void_bolt",
    active2: "shadow_pierce",
    active3: "dark_nova",
    ultimate: "eclipse"
  },
  
  // ============================================
  // MYTHIC HEROES (2 total)
  // ============================================
  
  // Mythic DPS Melee (Shadow Form) - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "kaorim_lunar": {
    heroId: "kaorim_lunar",
    name: "Kaorim (Lunar Form)",
    element: "Dark",
    role: "DPS Melee",
    rarity: "Mythic",
    active1: "lunar_strike",
    active2: "shadow_dance",
    passive: "celestial_duality",
    ultimate: "eclipse_fury"
  },
  
  // Mythic Support (Light Form) - Variante: 2 Actifs + 1 Passif + 1 Ultime
  "kaorim_solar": {
    heroId: "kaorim_solar",
    name: "Kaorim (Solar Form)",
    element: "Light",
    role: "Support",
    rarity: "Mythic",
    active1: "solar_heal",
    active2: "radiant_blessing",
    passive: "celestial_duality",
    ultimate: "dawn_resurrection"
  }
};

/**
 * Récupérer la définition des sorts d'un héros
 */
export function getHeroSpellDefinition(heroId: string): HeroSpellDefinition | null {
  return HERO_SPELL_DEFINITIONS[heroId] || null;
}

/**
 * Vérifier quels slots de sorts doivent être débloqués selon la rareté et la définition du héros
 */
export function getSlotsForRarity(heroId: string, rarity: string): {
  active1: boolean;
  active2: boolean;
  active3: boolean;
  ultimate: boolean;
  passive: boolean;
} {
  const definition = getHeroSpellDefinition(heroId);
  
  const slots = {
    active1: false,
    active2: false,
    active3: false,
    ultimate: false,
    passive: false
  };
  
  if (!definition) {
    console.warn(`⚠️ Pas de définition trouvée pour ${heroId}, utilisation des slots par défaut`);
    // Fallback selon rareté
    if (rarity === "Common") {
      slots.active1 = true;
    } else if (rarity === "Rare") {
      slots.active1 = true;
      slots.active2 = true;
      slots.ultimate = true;
    } else {
      slots.active1 = true;
      slots.active2 = true;
      slots.ultimate = true;
      slots.passive = true;
    }
    return slots;
  }
  
  // Utiliser la définition du héros pour déterminer les slots
  if (definition.active1) slots.active1 = true;
  if (definition.active2) slots.active2 = true;
  if (definition.active3) slots.active3 = true;
  if (definition.ultimate) slots.ultimate = true;
  if (definition.passive) slots.passive = true;
  
  return slots;
}

/**
 * Obtenir les sorts initiaux d'un héros selon sa rareté et sa définition
 */
export function getInitialSpells(heroId: string, rarity: string): {
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
  
  // Active 1 - toujours présent
  if (definition.active1) {
    spells.active1 = { id: definition.active1, level: 1 };
  }
  
  // Active 2 - si défini dans la définition
  if (definition.active2) {
    spells.active2 = { id: definition.active2, level: 1 };
  }
  
  // Active 3 - si défini dans la définition
  if (definition.active3) {
    spells.active3 = { id: definition.active3, level: 1 };
  }
  
  // Ultimate - si défini dans la définition
  if (definition.ultimate) {
    spells.ultimate = { id: definition.ultimate, level: 1 };
  }
  
  // Passive - si défini dans la définition
  if (definition.passive) {
    spells.passive = { id: definition.passive, level: 1 };
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
  // Trouver le héros qui possède ce sort
  const heroWithSpell = Object.values(HERO_SPELL_DEFINITIONS).find(hero => 
    hero.active1 === spellId || 
    hero.active2 === spellId || 
    hero.active3 === spellId || 
    hero.ultimate === spellId || 
    hero.passive === spellId
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

  // Déterminer le type de sort
  const isUltimate = heroWithSpell.ultimate === spellId;
  const isPassive = heroWithSpell.passive === spellId;

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

  // Les passifs n'ont pas de stats de combat
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
        description: `Passive effect: ${spellId}`
      }
    };
  }

  // Base stats selon le rôle
  let baseDamage = 0;
  let baseHealing = 0;
  let baseCooldown = 3;
  let baseEnergyCost = 20;
  let duration = 0;

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
    baseCooldown = 3;
    baseEnergyCost = 20;
    duration = 2;
  }

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
      type: isUltimate ? "ultimate" : "active"
    }
  };
}

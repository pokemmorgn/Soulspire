# 🚀 Hero Upgrade & Spells System API - Documentation Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du système](#architecture-du-système)
3. [Système d'ascension](#système-dascension)
4. [Nouveau système de sorts](#nouveau-système-de-sorts)
5. [Modèles de données C#](#modèles-de-données-c)
6. [Routes API](#routes-api)
7. [Configuration des coûts](#configuration-des-coûts)
8. [Exemples d'implémentation Unity](#exemples-dimplémentation-unity)
9. [Best Practices](#best-practices)

---

## Vue d'ensemble

Le système **Hero Upgrade & Spells** gère toute la progression des héros avec un système d'ascension par paliers et un nouveau système de sorts par niveau.

### 🎯 Fonctionnalités principales

- ✅ **Level Up normal** : 1 → 40, 42 → 80, 82 → 120, etc.
- ✅ **Ascension par paliers** : 40→41, 80→81, 120→121, 150→151
- ✅ **Upgrade d'étoiles** : Avec fragments de héros
- ✅ **Nouveau système de sorts** : Par niveau de déblocage (1, 11, 41, 81, 121, 151)
- ✅ **Auto-upgrade intelligent** : Level up + ascensions automatiques
- ✅ **Upgrade de sorts avancée** : Avec essences élémentaires
- ✅ **Coûts configurables** : Modifiables via fichiers de config

### 🏆 Paliers d'ascension

| Palier | Niveau | Rareté Requise | Nouveau Cap | Multiplicateur Stats |
|--------|--------|----------------|-------------|---------------------|
| **Tier 1** | 40→41 | Rare+ | 80 | x1.15 |
| **Tier 2** | 80→81 | Epic+ | 120 | x1.35 |
| **Tier 3** | 120→121 | Legendary+ | 150 | x1.60 |
| **Tier 4** | 150→151 | Mythic | 170 | x1.90 |

### 🔮 Sorts par niveau

| Niveau | Nom | Description | Disponibilité |
|--------|-----|-------------|---------------|
| **1** | Premier sort | Toujours disponible | Tous les héros |
| **11** | Deuxième sort | Selon rareté | Rare+ |
| **41** | Troisième sort/Passif | Premier palier d'ascension | Epic+ |
| **81** | Sort ultime | Deuxième palier d'ascension | Epic+ |
| **121** | Sort légendaire | Troisième palier d'ascension | Legendary+ |
| **151** | Sort mythique | Quatrième palier d'ascension | Mythic only |

---

## Architecture du système

### Structure des fichiers

```
server/src/
├── config/
│   └── ascensionCosts.ts           # ⚙️ Configuration des coûts
├── data/
│   └── heroSpellDefinitions.ts     # 🔮 Définitions des sorts
├── models/
│   ├── Hero.ts                     # 🦸 Modèle héros refactorisé
│   └── Player.ts                   # 👤 Modèle joueur avec essences
├── services/
│   ├── HeroUpgradeService.ts       # 🔧 Service principal
│   └── HeroSpellUpgradeService.ts  # 🔮 Service sorts spécialisé
└── routes/
    └── heroes.ts                   # 🌐 Routes API
```

### Types de ressources

```typescript
interface PlayerResources {
  gold: number;                     // 💰 Monnaie principale
  heroXP: number;                   // 📈 XP pour level up
  ascensionEssences: number;        // ✨ Essences pour ascension
  fragments: Record<string, number>; // 🧩 Fragments par héros (étoiles)
  materials: Record<string, number>; // 🔮 Essences élémentaires (sorts)
}
```

---

## Système d'ascension

### 🎯 Concept

L'ascension permet de débloquer des caps de niveau supérieurs en échange de ressources rares.

```
Common héros:    1 ────→ 40 (MAX)
Rare héros:      1 ────→ 40 ──[ASCENSION]──→ 41 ────→ 80 (MAX)
Epic héros:      1 ────→ 40 ──[ASC]──→ 41 ────→ 80 ──[ASC]──→ 81 ────→ 120 (MAX)
Legendary:       1 ────→ 40 ──[ASC]──→ 41 ────→ 80 ──[ASC]──→ 81 ────→ 120 ──[ASC]──→ 121 ────→ 150 (MAX)
Mythic:          1 ────→ 40 ──[ASC]──→ 41 ────→ 80 ──[ASC]──→ 81 ────→ 120 ──[ASC]──→ 121 ────→ 150 ──[ASC]──→ 151 ────→ 170
```

### 💎 Coûts d'ascension (par défaut)

```typescript
// Palier 1 : 40→41 (débloquer pour Rare+)
tier1: {
  gold: 5000,
  heroXP: 2000,
  ascensionEssence: 5
}

// Palier 2 : 80→81 (débloquer pour Epic+)
tier2: {
  gold: 15000,
  heroXP: 8000,
  ascensionEssence: 15
}

// Palier 3 : 120→121 (débloquer pour Legendary+)
tier3: {
  gold: 40000,
  heroXP: 20000,
  ascensionEssence: 35
}

// Palier 4 : 150→151 (débloquer pour Mythic)
tier4: {
  gold: 80000,
  heroXP: 50000,
  ascensionEssence: 75
}
```

### 🎁 Récompenses d'ascension

```typescript
// Chaque ascension donne :
- Multiplicateur de stats (x1.15, x1.35, x1.60, x1.90)
- Déblocage de nouveaux sorts
- Bonus d'or et de gemmes
- Augmentation du cap de niveau
```

---

## Nouveau système de sorts

### 🔮 Déblocage par niveau

**Ancien système** (deprecated) :
```typescript
{ active1, active2, active3, ultimate, passive }
```

**Nouveau système** :
```typescript
{
  level1: { id: "water_bolt", level: 1 },      // Niveau 1
  level11: { id: "tidal_wave", level: 1 },     // Niveau 11  
  level41: { id: "fluid_form", level: 1 },     // Niveau 41 (passif)
  level81: { id: "tsunami", level: 1 },        // Niveau 81 (ultime)
  level121: { id: "ocean_lord", level: 1 },    // Niveau 121 (futur)
  level151: { id: "void_sea", level: 1 }       // Niveau 151 (mythic)
}
```

### 📊 Progression des sorts

Chaque sort peut être upgradé :
- **Sorts normaux** : Niveau 1 → 12
- **Sorts ultimes** (81+) : Niveau 1 → 10

### 💰 Coûts d'upgrade de sorts

```typescript
// Coût = baseGold * nextLevel * rarityMultiplier * spellMultiplier
baseGold: 500
rarityMultipliers: {
  Common: 1.0,
  Rare: 1.5, 
  Epic: 2.0,
  Legendary: 3.0,
  Mythic: 4.0
}
spellMultiplier: {
  normaux: 1.0,
  ultimes: 1.5
}
```

### 🧪 Essences élémentaires

```typescript
// Chaque sort requiert des essences selon l'élément du héros
fire_essence     // Pour héros Fire
water_essence    // Pour héros Water  
wind_essence     // Pour héros Wind
electric_essence // Pour héros Electric
light_essence    // Pour héros Light
dark_essence     // Pour héros Dark
```

---

## Modèles de données C#

### Hero State Model

```csharp
[System.Serializable]
public class PlayerHero
{
    public string instanceId;           // ID unique de l'instance
    public string heroId;               // ID du héros dans le catalogue
    public string name;                 // Nom du héros
    public string rarity;               // Common, Rare, Epic, Legendary, Mythic
    public string element;              // Fire, Water, Wind, Electric, Light, Dark
    public string role;                 // Tank, DPS Melee, DPS Ranged, Support
    
    public int level;                   // Niveau actuel (1-170)
    public int stars;                   // Étoiles (1-6)
    public int ascensionTier;           // Tier d'ascension (0-4)
    public bool equipped;               // Équipé en formation
    
    public HeroStats currentStats;      // Stats actuelles calculées
    public int powerLevel;              // Score de puissance
    
    public string[] unlockedSpells;     // ["level1", "level11", "level41", ...]
    public HeroSpell[] spells;          // Sorts avec leurs niveaux
    
    public EquipmentInfo equipment;     // Équipement équipé
}

[System.Serializable]
public class HeroSpell
{
    public string slot;                 // "level1", "level11", etc.
    public string spellId;              // ID du sort
    public int level;                   // Niveau du sort (1-12)
    public int maxLevel;                // Niveau max possible
    public SpellStats currentStats;     // Stats actuelles
    public bool canUpgrade;             // Peut être upgradé
    public UpgradeCost upgradeCost;     // Coût du prochain niveau
}

[System.Serializable]
public class SpellStats
{
    public int damage;
    public int healing;
    public int cooldown;
    public int duration;
    public int energyCost;
    public string effect;
    public Dictionary<string, object> additionalEffects;
}
```

### Upgrade Models

```csharp
[System.Serializable]
public class HeroUpgradeInfo
{
    public PlayerHero hero;
    public UpgradeOptions upgrades;
    public AscensionUIInfo ascensionUI;
    public PlayerResources playerResources;
}

[System.Serializable]
public class UpgradeOptions
{
    public LevelUpInfo levelUp;
    public AscensionInfo ascension;
    public StarUpgradeInfo starUpgrade;
    public SpellsUpgradeInfo spells;
}

[System.Serializable]
public class AscensionInfo
{
    public bool available;
    public int currentLevel;
    public int nextLevel;
    public int currentTier;
    public int nextTier;
    public UpgradeCost cost;
    public AscensionReward rewards;
    public string reason;               // Si non disponible
}

[System.Serializable]
public class AscensionUIInfo
{
    public int currentTier;
    public int nextAscensionLevel;      // null si max atteint
    public UpgradeCost nextAscensionCost;
    public int maxLevelForRarity;
    public bool canAscendFurther;
    public ProgressInfo progressToNextAscension;
}

[System.Serializable]
public class ProgressInfo
{
    public int levelsNeeded;
    public int percentage;              // 0-100
}
```

### Resource Models

```csharp
[System.Serializable]
public class PlayerResources
{
    public int gold;
    public int heroXP;
    public int ascensionEssences;
    public Dictionary<string, int> fragments;   // Par héros
    public Dictionary<string, int> materials;   // Essences élémentaires
}

[System.Serializable]
public class UpgradeCost
{
    public int gold;
    public int heroXP;
    public int ascensionEssence;
    public int fragments;
    public Dictionary<string, int> materials;
}
```

---

## Routes API

### 🔍 Information et Overview

#### GET `/api/heroes/my`
Obtenir tous les héros du joueur avec infos d'upgrade

#### GET `/api/heroes/my/{heroInstanceId}/details`
Détails complets d'un héros spécifique

#### GET `/api/heroes/upgrade/{heroInstanceId}`
Informations d'upgrade complètes pour un héros

```json
{
  "hero": {
    "instanceId": "64f7...",
    "name": "Kaelis",
    "level": 40,
    "ascensionTier": 0,
    "currentStats": { "hp": 2500, "atk": 450 }
  },
  "upgrades": {
    "levelUp": { "available": false, "blockedByAscension": true },
    "ascension": {
      "available": true,
      "currentLevel": 40,
      "nextLevel": 41,
      "cost": { "gold": 5000, "heroXP": 2000, "ascensionEssence": 5 }
    },
    "starUpgrade": {
      "available": true,
      "currentStars": 3,
      "nextStarCost": 80,
      "currentFragments": 120
    }
  },
  "playerResources": {
    "gold": 15000,
    "heroXP": 5000,
    "ascensionEssences": 10
  }
}
```

#### GET `/api/heroes/my/overview`
Vue d'ensemble de tous les héros avec possibilités d'upgrade

#### GET `/api/heroes/player-resources`
Ressources du joueur pour les upgrades

---

### ⬆️ Upgrades de Héros

#### POST `/api/heroes/upgrade/level`
Level up normal (sans ascension)

```json
{
  "heroInstanceId": "64f7...",
  "targetLevel": 35
}
```

**Réponse :**
```json
{
  "success": true,
  "hero": {
    "level": 35,
    "statsGained": { "hp": 200, "atk": 50 }
  },
  "cost": { "gold": 2500, "heroXP": 1200 },
  "spellsUnlocked": [
    { "level": 11, "spellId": "hydro_dash", "slot": "level11" }
  ]
}
```

#### POST `/api/heroes/upgrade/ascend`
Ascension aux paliers 41, 81, 121, 151

```json
{
  "heroInstanceId": "64f7..."
}
```

**Réponse :**
```json
{
  "success": true,
  "newLevel": 41,
  "newAscensionTier": 1,
  "statsBonus": { "hp": 400, "atk": 80 },
  "spellsUnlocked": [
    { "level": 41, "spellId": "fluid_movement", "slot": "level41" }
  ],
  "rewards": { "gold": 1000, "gems": 50 },
  "cost": { "gold": 5000, "heroXP": 2000, "ascensionEssence": 5 }
}
```

#### POST `/api/heroes/upgrade/stars`
Upgrade d'étoiles avec fragments

```json
{
  "heroInstanceId": "64f7..."
}
```

#### POST `/api/heroes/upgrade/auto`
Auto-level up intelligent avec ascensions optionnelles

```json
{
  "heroInstanceId": "64f7...",
  "maxGoldToSpend": 50000,
  "maxHeroXPToSpend": 25000,
  "includeAscensions": true
}
```

**Réponse :**
```json
{
  "success": true,
  "hero": {
    "finalLevel": 85,
    "finalAscensionTier": 2,
    "levelsGained": 45,
    "ascensionsPerformed": 2
  },
  "upgrades": [
    { "type": "level_up", "fromLevel": 40, "toLevel": 40 },
    { "type": "ascension", "fromLevel": 40, "toLevel": 41, "newTier": 1 },
    { "type": "level_up", "fromLevel": 41, "toLevel": 80 },
    { "type": "ascension", "fromLevel": 80, "toLevel": 81, "newTier": 2 },
    { "type": "level_up", "fromLevel": 81, "toLevel": 85 }
  ],
  "totalCost": {
    "gold": 45000,
    "heroXP": 23000,
    "ascensionEssence": 20
  }
}
```

---

### 🔮 Upgrades de Sorts

#### GET `/api/heroes/spells/{heroInstanceId}`
Informations complètes des sorts d'un héros

```json
{
  "heroName": "Kaelis",
  "element": "Water",
  "rarity": "Legendary",
  "spells": {
    "level1": {
      "spellId": "feline_slash",
      "currentLevel": 3,
      "maxLevel": 12,
      "canUpgrade": true,
      "upgradeCost": { "gold": 1500, "essence": 6 }
    },
    "level41": {
      "spellId": "fluid_movement",
      "currentLevel": 1,
      "maxLevel": 12,
      "canUpgrade": true,
      "upgradeCost": { "gold": 3000, "essence": 12 }
    }
  },
  "playerResources": {
    "gold": 25000,
    "essences": { "water_essence": 50 }
  }
}
```

#### POST `/api/heroes/spells/upgrade`
Upgrader un sort spécifique

```json
{
  "heroInstanceId": "64f7...",
  "spellSlot": "active1"
}
```

#### POST `/api/heroes/spells/auto-upgrade`
Auto-upgrade tous les sorts avec budget

```json
{
  "heroInstanceId": "64f7...",
  "maxGoldToSpend": 20000
}
```

**Réponse :**
```json
{
  "success": true,
  "heroName": "Kaelis",
  "upgrades": [
    {
      "slot": "active1",
      "spellId": "feline_slash",
      "from": 3,
      "to": 8,
      "cost": { "gold": 1500, "essence": 6 }
    },
    {
      "slot": "ultimate",
      "spellId": "tsunami_fury",
      "from": 1,
      "to": 4,
      "cost": { "gold": 4500, "essence": 18 }
    }
  ],
  "totalCost": {
    "gold": 18500,
    "essence": 95
  }
}
```

#### GET `/api/heroes/spells/summary`
Résumé des upgrades possibles pour tous les héros

#### GET `/api/heroes/spells/{heroInstanceId}/{spellSlot}`
Détails avancés d'un sort spécifique

```json
{
  "hero": {
    "name": "Kaelis",
    "element": "Water"
  },
  "spell": {
    "spellId": "feline_slash",
    "currentLevel": 3,
    "maxLevel": 12,
    "upgradePath": [
      {
        "level": 4,
        "cost": { "gold": 1500, "essence": 6 },
        "canAfford": true
      },
      {
        "level": 5,
        "cost": { "gold": 1875, "essence": 8 },
        "canAfford": true
      }
    ],
    "progress": {
      "percentComplete": 25,
      "levelsRemaining": 9
    }
  },
  "recommendations": {
    "priority": "medium",
    "affordableLevels": 6,
    "recommendedTargetLevel": 9,
    "estimatedPowerGain": "Élevé (+50-100%)"
  }
}
```

---

## Configuration des coûts

### 📁 Fichier : `server/src/config/ascensionCosts.ts`

Le dev backend peut modifier les coûts ici :

```typescript
export const ASCENSION_COSTS: Record<string, AscensionCost> = {
  tier1: {
    gold: 5000,        // 💰 Modifiable
    heroXP: 2000,      // 📈 Modifiable  
    ascensionEssence: 5 // ✨ Modifiable
  },
  tier2: {
    gold: 15000,       // 💰 Augmentez pour plus difficile
    heroXP: 8000,
    ascensionEssence: 15
  },
  // etc.
};

// Modificateur de stats par palier
export const ASCENSION_STAT_MULTIPLIERS = {
  tier0: 1.0,    // Base
  tier1: 1.15,   // +15% après 1ère ascension (MODIFIABLE)
  tier2: 1.35,   // +35% après 2ème ascension (MODIFIABLE)
  tier3: 1.60,   // +60% après 3ème ascension (MODIFIABLE)
  tier4: 1.90    // +90% après 4ème ascension (MODIFIABLE)
};

// Niveaux max par rareté
export const LEVEL_CAPS_BY_RARITY = {
  Common: 40,      // MODIFIABLE
  Rare: 80,        // MODIFIABLE
  Epic: 120,       // MODIFIABLE
  Legendary: 150,  // MODIFIABLE
  Mythic: 170      // MODIFIABLE
};
```

### 📁 Fichier : `server/src/data/heroSpellDefinitions.ts`

Configuration des sorts par héros :

```typescript
export const SPELL_UNLOCK_LEVELS = {
  LEVEL_1: 1,       // MODIFIABLE - Premier sort
  LEVEL_11: 11,     // MODIFIABLE - Deuxième sort
  LEVEL_41: 41,     // MODIFIABLE - Passif/3ème sort
  LEVEL_81: 81,     // MODIFIABLE - Sort ultime
  LEVEL_121: 121,   // MODIFIABLE - Sort légendaire
  LEVEL_151: 151    // MODIFIABLE - Sort mythique
} as const;

// Exemple de héros (modifiable)
"kaelis": {
  heroId: "kaelis",
  name: "Kaelis", 
  element: "Water",
  role: "DPS Melee",
  rarity: "Legendary",
  level1: "feline_slash",      // Sort niveau 1
  level11: "hydro_dash",       // Sort niveau 11
  level41: "fluid_movement",   // Passif niveau 41
  level81: "tsunami_fury",     // Ultime niveau 81
  // level121 et level151 vides = pas de sorts futurs
}
```

### 🎯 Pour modifier les coûts de sorts

Dans `HeroSpellUpgradeService.ts` :

```typescript
private static calculateUpgradeCost(currentLevel: number, rarity: string, element: string) {
  const baseGoldCost = 500;        // 💰 MODIFIABLE
  const baseEssenceCost = 5;       // 🧪 MODIFIABLE
  
  const rarityMultipliers = {
    "Common": 1.0,                 // MODIFIABLE
    "Rare": 1.5,                  // MODIFIABLE
    "Epic": 2.0,                  // MODIFIABLE
    "Legendary": 3.0,             // MODIFIABLE
    "Mythic": 4.0                 // MODIFIABLE
  };
}
```

---

## Exemples d'implémentation Unity

### 1. Manager d'upgrade de héros

```csharp
using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class HeroUpgradeManager : MonoBehaviour
{
    [Header("API Configuration")]
    public string apiBaseUrl = "https://api.yourgame.com/api/heroes";
    
    [Header("UI References")]
    public HeroUpgradeUI upgradeUI;
    public ResourceDisplayUI resourceDisplay;
    public ConfirmationDialog confirmDialog;

    private string authToken;
    
    public void Initialize(string token)
    {
        authToken = token;
    }

    public void LoadHeroUpgradeInfo(string heroInstanceId)
    {
        StartCoroutine(GetHeroUpgradeInfo(heroInstanceId));
    }

    private IEnumerator GetHeroUpgradeInfo(string heroInstanceId)
    {
        string url = $"{apiBaseUrl}/upgrade/{heroInstanceId}";
        
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                string json = request.downloadHandler.text;
                HeroUpgradeInfo upgradeInfo = JsonUtility.FromJson<HeroUpgradeInfo>(json);
                
                upgradeUI.DisplayUpgradeInfo(upgradeInfo);
                resourceDisplay.UpdateResources(upgradeInfo.playerResources);
            }
            else
            {
                Debug.LogError($"Failed to load hero upgrade info: {request.error}");
                ShowErrorMessage("Erreur de chargement des informations d'upgrade");
            }
        }
    }

    public void RequestLevelUp(string heroInstanceId, int targetLevel = -1)
    {
        LevelUpRequest request = new LevelUpRequest
        {
            heroInstanceId = heroInstanceId
        };
        
        if (targetLevel > 0)
        {
            request.targetLevel = targetLevel;
        }

        StartCoroutine(PerformLevelUp(request));
    }

    public void RequestAscension(string heroInstanceId)
    {
        // Afficher dialogue de confirmation
        confirmDialog.Show(
            "Ascension",
            "Voulez-vous vraiment faire ascensionner ce héros ?",
            () => StartCoroutine(PerformAscension(heroInstanceId)),
            () => { /* Cancel */ }
        );
    }

    private IEnumerator PerformAscension(string heroInstanceId)
    {
        string url = $"{apiBaseUrl}/upgrade/ascend";
        
        AscensionRequest requestData = new AscensionRequest 
        { 
            heroInstanceId = heroInstanceId 
        };
        
        string json = JsonUtility.ToJson(requestData);
        
        using (UnityWebRequest request = UnityWebRequest.Post(url, json, "application/json"))
        {
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                AscensionResult result = JsonUtility.FromJson<AscensionResult>(json);
                
                if (result.success)
                {
                    // Animation d'ascension
                    PlayAscensionAnimation(result);
                    
                    // Mettre à jour les ressources
                    resourceDisplay.UpdateResources(result.playerResources);
                    
                    // Recharger les infos
                    LoadHeroUpgradeInfo(heroInstanceId);
                    
                    ShowSuccessMessage($"Ascension réussie ! Niveau {result.newLevel}");
                }
                else
                {
                    ShowErrorMessage(result.error);
                }
            }
            else
            {
                ShowErrorMessage("Erreur lors de l'ascension");
            }
        }
    }

    public void RequestAutoUpgrade(string heroInstanceId, int maxGold, bool includeAscensions)
    {
        AutoUpgradeRequest request = new AutoUpgradeRequest
        {
            heroInstanceId = heroInstanceId,
            maxGoldToSpend = maxGold,
            includeAscensions = includeAscensions
        };

        StartCoroutine(PerformAutoUpgrade(request));
    }

    private void PlayAscensionAnimation(AscensionResult result)
    {
        // Animation spéciale pour l'ascension
        StartCoroutine(AscensionAnimationSequence(result));
    }

    private IEnumerator AscensionAnimationSequence(AscensionResult result)
    {
        // 1. Flash de lumière
        yield return new WaitForSeconds(0.5f);
        
        // 2. Particules d'ascension
        yield return new WaitForSeconds(1.0f);
        
        // 3. Affichage des nouveaux sorts débloqués
        if (result.spellsUnlocked != null && result.spellsUnlocked.Length > 0)
        {
            foreach (var spell in result.spellsUnlocked)
            {
                ShowNewSpellUnlocked(spell);
                yield return new WaitForSeconds(0.8f);
            }
        }
        
        // 4. Affichage des stats bonus
        ShowStatsBonus(result.statsBonus);
    }
}

[System.Serializable]
public class LevelUpRequest
{
    public string heroInstanceId;
    public int targetLevel;
}

[System.Serializable]
public class AscensionRequest
{
    public string heroInstanceId;
}

[System.Serializable]
public class AutoUpgradeRequest
{
    public string heroInstanceId;
    public int maxGoldToSpend;
    public int maxHeroXPToSpend;
    public bool includeAscensions;
}
```

### 2. Manager de sorts

```csharp
using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class SpellUpgradeManager : MonoBehaviour
{
    [Header("API Configuration")]
    public string apiBaseUrl = "https://api.yourgame.com/api/heroes/spells";
    
    [Header("UI References")]
    public SpellUpgradeUI spellUI;
    public ResourceDisplayUI resourceDisplay;
    
    private string authToken;

    public void LoadHeroSpells(string heroInstanceId)
    {
        StartCoroutine(GetHeroSpells(heroInstanceId));
    }

    private IEnumerator GetHeroSpells(string heroInstanceId)
    {
        string url = $"{apiBaseUrl}/{heroInstanceId}";
        
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                string json = request.downloadHandler.text;
                HeroSpellInfo spellInfo = JsonUtility.FromJson<HeroSpellInfo>(json);
                
                spellUI.DisplaySpells(spellInfo);
                resourceDisplay.UpdateEssences(spellInfo.playerResources.materials);
            }
            else
            {
                Debug.LogError($"Failed to load spells: {request.error}");
            }
        }
    }

    public void UpgradeSpell(string heroInstanceId, string spellSlot)
    {
        SpellUpgradeRequest request = new SpellUpgradeRequest
        {
            heroInstanceId = heroInstanceId,
            spellSlot = spellSlot
        };

        StartCoroutine(PerformSpellUpgrade(request));
    }

    private IEnumerator PerformSpellUpgrade(SpellUpgradeRequest upgradeRequest)
    {
        string url = $"{apiBaseUrl}/upgrade";
        string json = JsonUtility.ToJson(upgradeRequest);
        
        using (UnityWebRequest request = UnityWebRequest.Post(url, json, "application/json"))
        {
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                SpellUpgradeResult result = JsonUtility.FromJson<SpellUpgradeResult>(json);
                
                if (result.success)
                {
                    // Animation d'upgrade de sort
                    PlaySpellUpgradeAnimation(result.spell);
                    
                    // Mettre à jour l'affichage
                    spellUI.UpdateSpellLevel(result.spell);
                    resourceDisplay.UpdateResources(result.playerResources);
                    
                    ShowSuccessMessage($"Sort {result.spell.spellId} upgradé au niveau {result.spell.newLevel}!");
                }
                else
                {
                    ShowErrorMessage(result.error);
                }
            }
        }
    }

    public void AutoUpgradeAllSpells(string heroInstanceId, int maxGoldBudget)
    {
        AutoSpellUpgradeRequest request = new AutoSpellUpgradeRequest
        {
            heroInstanceId = heroInstanceId,
            maxGoldToSpend = maxGoldBudget
        };

        StartCoroutine(PerformAutoSpellUpgrade(request));
    }
}

[System.Serializable]
public class HeroSpellInfo
{
    public string heroName;
    public string element;
    public string rarity;
    public Dictionary<string, SpellSlotInfo> spells;
    public PlayerResources playerResources;
}

[System.Serializable]
public class SpellSlotInfo
{
    public string spellId;
    public int currentLevel;
    public int maxLevel;
    public bool canUpgrade;
    public UpgradeCost upgradeCost;
    public string reason;
}

[System.Serializable]
public class SpellUpgradeRequest
{
    public string heroInstanceId;
    public string spellSlot;
}

[System.Serializable]
public class AutoSpellUpgradeRequest
{
    public string heroInstanceId;
    public int maxGoldToSpend;
}
```

### 3. UI Components

```csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class HeroUpgradeUI : MonoBehaviour
{
    [Header("Level Up Section")]
    public TextMeshProUGUI currentLevelText;
    public TextMeshProUGUI maxLevelText;
    public Button levelUpButton;
    public TextMeshProUGUI levelUpCostText;
    public Slider levelProgressSlider;

    [Header("Ascension Section")]
    public GameObject ascensionPanel;
    public TextMeshProUGUI ascensionTierText;
    public Button ascensionButton;
    public TextMeshProUGUI ascensionCostText;
    public Image ascensionProgressFill;
    public TextMeshProUGUI ascensionProgressText;

    [Header("Star Upgrade Section")]
    public Image[] starImages;
    public Button starUpgradeButton;
    public TextMeshProUGUI fragmentCostText;
    public TextMeshProUGUI fragmentCountText;

    [Header("Stats Display")]
    public TextMeshProUGUI hpText;
    public TextMeshProUGUI atkText;
    public TextMeshProUGUI defText;
    public TextMeshProUGUI powerText;

    public void DisplayUpgradeInfo(HeroUpgradeInfo info)
    {
        var hero = info.hero;
        var upgrades = info.upgrades;
        var resources = info.playerResources;

        // Affichage du niveau
        currentLevelText.text = hero.level.ToString();
        maxLevelText.text = upgrades.levelUp.maxLevel.ToString();
        
        // Barre de progression du niveau
        float levelProgress = (float)hero.level / upgrades.levelUp.maxLevel;
        levelProgressSlider.value = levelProgress;

        // Bouton de level up
        levelUpButton.interactable = upgrades.levelUp.available && !upgrades.levelUp.blockedByAscension;
        
        if (upgrades.levelUp.available && !upgrades.levelUp.blockedByAscension)
        {
            var cost = upgrades.levelUp.nextLevelCost;
            levelUpCostText.text = $"{cost.gold} Gold, {cost.heroXP} XP";
            levelUpCostText.color = CanAffordCost(cost, resources) ? Color.white : Color.red;
        }
        else if (upgrades.levelUp.blockedByAscension)
        {
            levelUpCostText.text = "Ascension requise";
            levelUpCostText.color = Color.yellow;
        }
        else
        {
            levelUpCostText.text = "Niveau max";
            levelUpCostText.color = Color.gray;
        }

        // Section ascension
        DisplayAscensionInfo(upgrades.ascension, info.ascensionUI, resources);

        // Section étoiles
        DisplayStarInfo(upgrades.starUpgrade, resources);

        // Stats
        DisplayStats(hero.currentStats, hero.powerLevel);
    }

    private void DisplayAscensionInfo(AscensionInfo ascension, AscensionUIInfo uiInfo, PlayerResources resources)
    {
        ascensionPanel.SetActive(ascension.available);
        
        if (!ascension.available)
        {
            return;
        }

        ascensionTierText.text = $"Tier {ascension.currentTier} → {ascension.nextTier}";
        
        var cost = ascension.cost;
        ascensionCostText.text = $"{cost.gold} Gold\n{cost.heroXP} XP\n{cost.ascensionEssence} Essences";
        ascensionCostText.color = CanAffordAscensionCost(cost, resources) ? Color.white : Color.red;
        
        ascensionButton.interactable = CanAffordAscensionCost(cost, resources);

        // Progression vers l'ascension
        if (uiInfo.progressToNextAscension != null)
        {
            float progress = uiInfo.progressToNextAscension.percentage / 100f;
            ascensionProgressFill.fillAmount = progress;
            ascensionProgressText.text = $"{uiInfo.progressToNextAscension.levelsNeeded} niveaux restants";
        }
    }

    private void DisplayStarInfo(StarUpgradeInfo starInfo, PlayerResources resources)
    {
        // Afficher les étoiles actuelles
        for (int i = 0; i < starImages.Length; i++)
        {
            starImages[i].color = i < starInfo.currentStars ? Color.yellow : Color.gray;
        }

        starUpgradeButton.interactable = starInfo.available && 
            starInfo.currentFragments >= starInfo.nextStarCost;

        if (starInfo.available)
        {
            fragmentCostText.text = starInfo.nextStarCost.ToString();
            fragmentCountText.text = starInfo.currentFragments.ToString();
            fragmentCountText.color = starInfo.currentFragments >= starInfo.nextStarCost ? 
                Color.white : Color.red;
        }
        else
        {
            fragmentCostText.text = "MAX";
            fragmentCountText.text = "MAX";
            fragmentCountText.color = Color.gray;
        }
    }

    private void DisplayStats(HeroStats stats, int power)
    {
        hpText.text = $"HP: {stats.hp:N0}";
        atkText.text = $"ATK: {stats.atk:N0}";
        defText.text = $"DEF: {stats.def:N0}";
        powerText.text = $"Power: {power:N0}";
    }

    private bool CanAffordCost(UpgradeCost cost, PlayerResources resources)
    {
        return resources.gold >= cost.gold && 
               resources.heroXP >= cost.heroXP;
    }

    private bool CanAffordAscensionCost(UpgradeCost cost, PlayerResources resources)
    {
        return resources.gold >= cost.gold && 
               resources.heroXP >= cost.heroXP && 
               resources.ascensionEssences >= cost.ascensionEssence;
    }
}
```

### 4. Affichage des sorts

```csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

public class SpellUpgradeUI : MonoBehaviour
{
    [Header("Spell Slots")]
    public SpellSlotUI[] spellSlots;
    
    [Header("Hero Info")]
    public TextMeshProUGUI heroNameText;
    public TextMeshProUGUI heroElementText;
    public Image heroElementIcon;
    
    [Header("Resources")]
    public TextMeshProUGUI goldText;
    public TextMeshProUGUI essenceText;

    private Dictionary<string, SpellSlotUI> slotMap;
    private HeroSpellInfo currentSpellInfo;

    void Start()
    {
        // Créer le mapping des slots
        slotMap = new Dictionary<string, SpellSlotUI>();
        foreach (var slot in spellSlots)
        {
            slotMap[slot.slotId] = slot;
        }
    }

    public void DisplaySpells(HeroSpellInfo spellInfo)
    {
        currentSpellInfo = spellInfo;
        
        // Info du héros
        heroNameText.text = spellInfo.heroName;
        heroElementText.text = spellInfo.element;
        heroElementIcon.sprite = GetElementIcon(spellInfo.element);

        // Afficher chaque sort
        foreach (var kvp in spellInfo.spells)
        {
            string slotId = kvp.Key;
            SpellSlotInfo spellData = kvp.Value;
            
            if (slotMap.ContainsKey(slotId))
            {
                slotMap[slotId].DisplaySpell(spellData, spellInfo.playerResources);
            }
        }

        // Ressources
        UpdateResourceDisplay(spellInfo.playerResources);
    }

    public void UpdateSpellLevel(SpellUpgradeResult.SpellInfo spell)
    {
        if (slotMap.ContainsKey(spell.slot))
        {
            slotMap[spell.slot].UpdateLevel(spell.newLevel);
        }
    }

    public void OnAutoUpgradeClicked()
    {
        // Afficher dialogue de budget
        ShowBudgetDialog((budget) => {
            var manager = FindObjectOfType<SpellUpgradeManager>();
            manager.AutoUpgradeAllSpells(currentSpellInfo.heroInstanceId, budget);
        });
    }

    private void UpdateResourceDisplay(PlayerResources resources)
    {
        goldText.text = $"Gold: {resources.gold:N0}";
        
        // Afficher l'essence correspondante à l'élément du héros
        string essenceKey = $"{currentSpellInfo.element.ToLower()}_essence";
        int essenceAmount = resources.materials.ContainsKey(essenceKey) ? 
            resources.materials[essenceKey] : 0;
        essenceText.text = $"{currentSpellInfo.element} Essence: {essenceAmount}";
    }

    private Sprite GetElementIcon(string element)
    {
        return Resources.Load<Sprite>($"Elements/{element}_icon");
    }
}

[System.Serializable]
public class SpellSlotUI : MonoBehaviour
{
    public string slotId;                   // "level1", "level11", etc.
    public Image spellIcon;
    public TextMeshProUGUI spellNameText;
    public TextMeshProUGUI levelText;
    public Button upgradeButton;
    public TextMeshProUGUI costText;
    public Slider levelProgressSlider;
    public GameObject lockedPanel;

    public void DisplaySpell(SpellSlotInfo spellData, PlayerResources resources)
    {
        if (spellData == null || string.IsNullOrEmpty(spellData.spellId))
        {
            // Sort non débloqué
            lockedPanel.SetActive(true);
            upgradeButton.interactable = false;
            return;
        }

        lockedPanel.SetActive(false);
        
        // Affichage du sort
        spellIcon.sprite = GetSpellIcon(spellData.spellId);
        spellNameText.text = GetSpellName(spellData.spellId);
        levelText.text = $"Lv.{spellData.currentLevel}/{spellData.maxLevel}";
        
        // Barre de progression
        float progress = (float)spellData.currentLevel / spellData.maxLevel;
        levelProgressSlider.value = progress;
        
        // Bouton d'upgrade
        upgradeButton.interactable = spellData.canUpgrade && 
            CanAffordUpgrade(spellData.upgradeCost, resources);
            
        if (spellData.canUpgrade)
        {
            var cost = spellData.upgradeCost;
            costText.text = $"{cost.gold}G";
            costText.color = CanAffordUpgrade(cost, resources) ? Color.white : Color.red;
        }
        else
        {
            costText.text = spellData.reason ?? "MAX";
            costText.color = Color.gray;
        }
    }

    public void UpdateLevel(int newLevel)
    {
        levelText.text = $"Lv.{newLevel}";
        // Jouer animation d'upgrade
        StartCoroutine(PlayLevelUpAnimation());
    }

    private bool CanAffordUpgrade(UpgradeCost cost, PlayerResources resources)
    {
        if (cost == null) return false;
        
        // Vérifier l'or
        if (resources.gold < cost.gold) return false;
        
        // Vérifier les essences (selon l'élément)
        foreach (var materialCost in cost.materials)
        {
            if (!resources.materials.ContainsKey(materialCost.Key) ||
                resources.materials[materialCost.Key] < materialCost.Value)
            {
                return false;
            }
        }
        
        return true;
    }

    private IEnumerator PlayLevelUpAnimation()
    {
        // Animation de flash
        Color originalColor = spellIcon.color;
        
        for (int i = 0; i < 3; i++)
        {
            spellIcon.color = Color.yellow;
            yield return new WaitForSeconds(0.1f);
            spellIcon.color = originalColor;
            yield return new WaitForSeconds(0.1f);
        }
    }

    private Sprite GetSpellIcon(string spellId)
    {
        return Resources.Load<Sprite>($"Spells/Icons/{spellId}");
    }

    private string GetSpellName(string spellId)
    {
        // Récupérer depuis localization ou dictionnaire
        return spellId.Replace("_", " ").ToTitleCase();
    }
}
```

---

## Best Practices

### ✅ À FAIRE

1. **Feedback visuel clair**
   - Montrer les coûts en rouge si insuffisants
   - Animer les changements de stats
   - Particules d'ascension distinctives

2. **Confirmations importantes**
   - Dialogue pour les ascensions (coûteuses)
   - Preview des stats après upgrade
   - Bouton "Annuler" pendant les animations

3. **Gestion d'erreurs**
   - Messages d'erreur explicites
   - Retry automatique pour erreurs réseau
   - États de loading pendant les requêtes

4. **Performance UI**
   - Pool des éléments de liste
   - Lazy loading des icônes
   - Cache des sprites

5. **Accessibilité**
   - Tooltips détaillés
   - Support clavier/manette
   - Textes lisibles

### ❌ À ÉVITER

1. **Ne pas** permettre le spam de boutons
2. **Ne pas** oublier de mettre à jour les ressources
3. **Ne pas** cacher les coûts au joueur
4. **Ne pas** faire d'animations trop longues
5. **Ne pas** permettre les upgrades sans confirmation

---

## Configuration avancée

### Personnalisation des coûts par serveur

```typescript
// Dans ascensionCosts.ts - Configuration par environnement
const ENVIRONMENT = process.env.NODE_ENV || 'development';

const COST_MULTIPLIERS: Record<string, number> = {
  'development': 0.1,    // Coûts réduits pour tests
  'staging': 0.5,        // Coûts moyens
  'production': 1.0      // Coûts normaux
};

const multiplier = COST_MULTIPLIERS[ENVIRONMENT] || 1.0;

export const ASCENSION_COSTS = {
  tier1: {
    gold: Math.floor(5000 * multiplier),
    heroXP: Math.floor(2000 * multiplier),
    ascensionEssence: Math.floor(5 * multiplier)
  }
  // etc.
};
```

### A/B Testing des coûts

```typescript
// Dans Player.ts - Variante de coût selon le joueur
export function getAscensionCostForPlayer(playerId: string, tier: number): AscensionCost {
  const hash = simpleHash(playerId);
  const variant = hash % 100;
  
  // 50% des joueurs ont des coûts normaux, 50% ont des coûts réduits
  const multiplier = variant < 50 ? 1.0 : 0.8;
  
  const baseCost = ASCENSION_COSTS[`tier${tier}`];
  return {
    gold: Math.floor(baseCost.gold * multiplier),
    heroXP: Math.floor(baseCost.heroXP * multiplier),
    ascensionEssence: Math.floor(baseCost.ascensionEssence * multiplier)
  };
}
```

---

## Checklist d'intégration

### Phase 1 - Basique
- [ ] Afficher les infos d'upgrade (niveau, étoiles, ascension)
- [ ] Boutons de level up et ascension fonctionnels
- [ ] Affichage des coûts et ressources
- [ ] Messages d'erreur basiques

### Phase 2 - Sorts
- [ ] Interface de sorts avec niveaux
- [ ] Upgrade individuel des sorts
- [ ] Auto-upgrade des sorts
- [ ] Gestion des essences élémentaires

### Phase 3 - UX Avancée
- [ ] Animations d'ascension
- [ ] Preview des stats après upgrade
- [ ] Tooltips détaillés
- [ ] Auto-upgrade intelligent avec budget

### Phase 4 - Optimisations
- [ ] Cache des requêtes
- [ ] Pool des éléments UI
- [ ] Loading states
- [ ] Analytics d'usage

---

## Support et Debug

### Logs serveur utiles

```
✨ Kaelis level 40 → 41 (ascension tier 0 → 1)
💰 Coût: 5000 gold, 2000 XP, 5 essences
🔮 Sort débloqué: fluid_movement (level41)
📊 Stats bonus: +400 HP, +80 ATK
```

### Debug Unity

```csharp
public class HeroUpgradeDebugger : MonoBehaviour
{
    [Header("Debug")]
    public bool enableDebugLogs = true;
    
    public void LogUpgradeInfo(HeroUpgradeInfo info)
    {
        if (!enableDebugLogs) return;
        
        Debug.Log($"=== {info.hero.name} Upgrade Info ===");
        Debug.Log($"Level: {info.hero.level}/{info.upgrades.levelUp.maxLevel}");
        Debug.Log($"Ascension Tier: {info.hero.ascensionTier}");
        Debug.Log($"Can Level Up: {info.upgrades.levelUp.available}");
        Debug.Log($"Can Ascend: {info.upgrades.ascension.available}");
        Debug.Log($"Player Gold: {info.playerResources.gold}");
    }
}
```

---

**Version:** 1.0.0  
**Dernière mise à jour:** 16 octobre 2025  
**Système:** Hero Upgrade avec Ascension & Sorts par Niveau

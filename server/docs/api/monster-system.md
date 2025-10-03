# 👹 Monster System API - Documentation Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Endpoints API](#endpoints-api)
3. [Modèles de données C#](#modèles-de-données-c)
4. [Événements WebSocket](#événements-websocket)
5. [Exemples d'intégration Unity](#exemples-dintégration-unity)
6. [Gestion des erreurs](#gestion-des-erreurs)
7. [Best Practices](#best-practices)

---

## Vue d'ensemble

Le système **Monster** gère tous les ennemis du jeu avec génération dynamique selon le monde, niveau et difficulté. Inspiré d'AFK Arena, les monstres ont des thèmes visuels, éléments, et rôles diversifiés.

### Fonctionnalités principales

- ✅ **40+ monstres uniques** : Normal, Elite, Boss
- ✅ **Génération intelligente** : 3 modes (spécifique, auto, legacy)
- ✅ **13 thèmes visuels** : forest, beast, undead, demon, dragon, etc.
- ✅ **6 éléments** : Fire, Water, Wind, Electric, Light, Dark
- ✅ **4 rôles** : Tank, DPS Melee, DPS Ranged, Support
- ✅ **Boss mechanics** : Enrage, phases, immunités
- ✅ **Scaling dynamique** : Stats selon monde/difficulté
- ✅ **Loot tables** : Récompenses par type

### Base URL

```
https://your-api-domain.com/api/monsters
```

---

## Endpoints API

### 1. Récupérer les monstres d'un monde

**GET** `/api/monsters/world/:worldId`

Récupère tous les monstres qui peuvent apparaître dans un monde spécifique.

#### Auth requise
❌ **Non** (Public) - Pour affichage du bestiaire

#### Query Parameters
- `type` (optionnel) : `normal` | `elite` | `boss`
- `element` (optionnel) : `Fire` | `Water` | `Wind` | `Electric` | `Light` | `Dark`

#### Réponse succès (200)

```json
{
  "success": true,
  "worldId": 1,
  "monsters": [
    {
      "monsterId": "MON_green_salamender",
      "name": "Green Salamender",
      "displayName": "Green Salamender",
      "type": "normal",
      "element": "Wind",
      "role": "DPS Melee",
      "rarity": "Rare",
      "visualTheme": "beast",
      "description": "Agile, leaf-colored creature with sharp reflexes.",
      "baseStats": {
        "hp": 500,
        "atk": 60,
        "def": 40,
        "vitesse": 85,
        "crit": 5,
        "critDamage": 50
      },
      "spriteId": "salamender_green_01",
      "worldTags": [1, 2, 3]
    }
  ],
  "total": 15
}
```

### 2. Obtenir un monstre spécifique

**GET** `/api/monsters/:monsterId`

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "monster": {
    "monsterId": "BOSS_inferno_dragon",
    "name": "Boss Red Salamender",
    "displayName": "Red Salamender Lord",
    "type": "boss",
    "element": "Fire",
    "role": "Tank",
    "rarity": "Legendary",
    "visualTheme": "dragon",
    "description": "Legendary fire beast commanding the volcanic regions.",
    "baseStats": {
      "hp": 5000,
      "atk": 300,
      "def": 200,
      "vitesse": 70,
      "crit": 15,
      "critDamage": 75,
      "moral": 100,
      "reductionCooldown": 15
    },
    "spells": {
      "spell1": { "id": "claw_strike", "level": 3 },
      "spell2": { "id": "bite", "level": 2 },
      "spell3": { "id": "charge", "level": 2 },
      "ultimate": { "id": "fire_storm", "level": 3 },
      "passive": { "id": "boss_aura", "level": 3 }
    },
    "bossMechanics": {
      "enrageAtHpPercent": 30,
      "phaseTransitions": [66, 33],
      "specialAbilities": ["fire_breath", "meteor_rain", "inferno_zone"],
      "immunities": ["burn"],
      "weaknesses": ["water_damage"]
    },
    "loot": {
      "guaranteed": {
        "gold": { "min": 100, "max": 300 },
        "experience": 150
      }
    },
    "worldTags": [5],
    "isUnique": true
  }
}
```

### 3. Prévisualiser les stats d'un monstre

**GET** `/api/monsters/:monsterId/preview?level=25&stars=5&difficulty=Hard`

Calcule les stats finales d'un monstre à un niveau donné.

#### Auth requise
❌ **Non** (Public)

#### Query Parameters
- `level` : 1-100 (défaut: 20)
- `stars` : 1-6 (défaut: 3)
- `difficulty` : `Normal` | `Hard` | `Nightmare` (défaut: Normal)

#### Réponse succès (200)

```json
{
  "success": true,
  "monsterId": "MON_green_salamender",
  "level": 25,
  "stars": 5,
  "difficulty": "Hard",
  "finalStats": {
    "hp": 2850,
    "maxHp": 2850,
    "atk": 342,
    "def": 228,
    "vitesse": 153,
    "speed": 153,
    "crit": 11,
    "critDamage": 90,
    "dodge": 17,
    "accuracy": 75,
    "moral": 114,
    "energyGeneration": 24
  },
  "powerScore": 8456
}
```

### 4. Obtenir les ennemis d'un level

**GET** `/api/campaign/worlds/:worldId/levels/:levelId/enemies?difficulty=Normal`

Récupère les ennemis configurés ou générés pour un level spécifique.

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "worldId": 1,
  "levelId": 5,
  "difficulty": "Normal",
  "enemies": [
    {
      "monsterId": "MON_green_salamender",
      "name": "Green Salamender",
      "position": 1,
      "level": 22,
      "stars": 3,
      "finalStats": {
        "hp": 1200,
        "atk": 144,
        "def": 96
      }
    },
    {
      "monsterId": "MON_fire_salamender_elite",
      "name": "Elite Red Salamender",
      "position": 2,
      "level": 23,
      "stars": 4,
      "finalStats": {
        "hp": 2400,
        "atk": 285,
        "def": 180
      }
    }
  ],
  "totalEnemies": 2,
  "totalPower": 15840,
  "generationMode": "specific"
}
```

### 5. Liste tous les monstres (avec filtres)

**GET** `/api/monsters?type=boss&element=Fire&theme=dragon&page=1&limit=20`

#### Auth requise
❌ **Non** (Public)

#### Query Parameters
- `type` : `normal` | `elite` | `boss`
- `element` : `Fire` | `Water` | `Wind` | `Electric` | `Light` | `Dark`
- `role` : `Tank` | `DPS Melee` | `DPS Ranged` | `Support`
- `theme` : `forest` | `beast` | `undead` | `demon` | etc.
- `worldId` : 1-20
- `page` : numéro de page (défaut: 1)
- `limit` : résultats par page (défaut: 20, max: 100)

#### Réponse succès (200)

```json
{
  "success": true,
  "monsters": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "type": "boss",
    "element": "Fire",
    "theme": "dragon"
  }
}
```

### 6. Statistiques globales des monstres

**GET** `/api/monsters/stats`

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "total": 42,
  "byType": {
    "normal": 18,
    "elite": 18,
    "boss": 6
  },
  "byElement": {
    "Fire": 7,
    "Water": 7,
    "Wind": 7,
    "Electric": 7,
    "Light": 7,
    "Dark": 7
  },
  "byRole": {
    "Tank": 10,
    "DPS Melee": 12,
    "DPS Ranged": 12,
    "Support": 8
  },
  "byTheme": {
    "beast": 12,
    "giant": 6,
    "dragon": 4,
    "undead": 5,
    "demon": 3,
    "elemental": 4,
    "shadow": 4,
    "construct": 2,
    "celestial": 2
  }
}
```

---

## Modèles de données C#

### Monster Model

```csharp
[System.Serializable]
public class MonstersResponse
{
    public bool success;
    public Monster[] monsters;
    public int total;
    public int worldId;
}

[System.Serializable]
public class Monster
{
    public string monsterId;
    public string name;
    public string displayName;
    public string type; // "normal", "elite", "boss"
    public string element;
    public string role;
    public string rarity;
    public string visualTheme;
    public string description;
    public MonsterStats baseStats;
    public MonsterSpells spells;
    public BossMechanics bossMechanics;
    public MonsterLoot loot;
    public int[] worldTags;
    public string spriteId;
    public string animationSet;
    public bool isUnique;
}

[System.Serializable]
public class MonsterStats
{
    public int hp;
    public int atk;
    public int def;
    public int crit;
    public int critDamage;
    public int critResist;
    public int dodge;
    public int accuracy;
    public int vitesse;
    public int speed;
    public int moral;
    public int reductionCooldown;
    public int healthleech;
    public int healingBonus;
    public int shieldBonus;
    public int energyRegen;
}

[System.Serializable]
public class MonsterSpells
{
    public Spell spell1;
    public Spell spell2;
    public Spell spell3;
    public Spell ultimate;
    public Spell passive;
}

[System.Serializable]
public class Spell
{
    public string id;
    public int level;
}

[System.Serializable]
public class BossMechanics
{
    public int enrageAtHpPercent;
    public int[] phaseTransitions;
    public string[] specialAbilities;
    public string[] immunities;
    public string[] weaknesses;
}

[System.Serializable]
public class MonsterLoot
{
    public GuaranteedLoot guaranteed;
}

[System.Serializable]
public class GuaranteedLoot
{
    public GoldRange gold;
    public int experience;
}

[System.Serializable]
public class GoldRange
{
    public int min;
    public int max;
}
```

### Level Enemies Response

```csharp
[System.Serializable]
public class LevelEnemiesResponse
{
    public bool success;
    public int worldId;
    public int levelId;
    public string difficulty;
    public LevelEnemy[] enemies;
    public int totalEnemies;
    public int totalPower;
    public string generationMode;
}

[System.Serializable]
public class LevelEnemy
{
    public string monsterId;
    public string name;
    public int position;
    public int level;
    public int stars;
    public MonsterStats finalStats;
    public string element;
    public string role;
    public string type;
}
```

### Monster Preview Response

```csharp
[System.Serializable]
public class MonsterPreviewResponse
{
    public bool success;
    public string monsterId;
    public int level;
    public int stars;
    public string difficulty;
    public MonsterStats finalStats;
    public int powerScore;
}
```

---

## Événements WebSocket

### Connection

```csharp
using SocketIOClient;

SocketIO socket = new SocketIO("https://your-api.com");

socket.On("connect", response =>
{
    socket.Emit("battle:join_room");
});

socket.ConnectAsync();
```

### Événements principaux

#### Monster spawned
**Event:** `battle:monster_spawned`

```json
{
  "monsterId": "BOSS_inferno_dragon",
  "name": "Inferno Dragon Lord",
  "position": 1,
  "hp": 5000,
  "isBoss": true
}
```

#### Boss phase transition
**Event:** `battle:boss_phase_change`

```json
{
  "monsterId": "BOSS_inferno_dragon",
  "phase": 2,
  "hpPercent": 33,
  "newAbilities": ["meteor_rain"],
  "message": "The dragon enters a fury state!"
}
```

#### Boss enrage
**Event:** `battle:boss_enrage`

```json
{
  "monsterId": "BOSS_inferno_dragon",
  "hpPercent": 30,
  "atkBonus": 50,
  "message": "The dragon is enraged!"
}
```

---

## Exemples d'intégration Unity

### 1. Charger les monstres d'un monde

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class MonsterManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/monsters";

    IEnumerator LoadWorldMonsters(int worldId)
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/world/" + worldId);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            MonstersResponse response = JsonUtility.FromJson<MonstersResponse>(request.downloadHandler.text);
            
            Debug.Log("Loaded " + response.total + " monsters for world " + worldId);
            
            foreach (Monster monster in response.monsters)
            {
                DisplayMonster(monster);
            }
        }
    }

    void DisplayMonster(Monster monster)
    {
        Debug.Log($"Monster: {monster.name} ({monster.type}) - {monster.element}");
    }
}
```

### 2. Prévisualiser les stats d'un monstre

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class MonsterPreview : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/monsters";

    IEnumerator PreviewMonsterStats(string monsterId, int level, int stars, string difficulty)
    {
        string url = $"{baseURL}/{monsterId}/preview?level={level}&stars={stars}&difficulty={difficulty}";
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            MonsterPreviewResponse response = JsonUtility.FromJson<MonsterPreviewResponse>(request.downloadHandler.text);
            
            Debug.Log($"Monster at level {level}:");
            Debug.Log($"HP: {response.finalStats.hp}");
            Debug.Log($"ATK: {response.finalStats.atk}");
            Debug.Log($"DEF: {response.finalStats.def}");
            Debug.Log($"Power Score: {response.powerScore}");
        }
    }
}
```

### 3. Charger les ennemis d'un level

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class LevelEnemyLoader : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/campaign";

    IEnumerator LoadLevelEnemies(int worldId, int levelId, string difficulty)
    {
        string url = $"{baseURL}/worlds/{worldId}/levels/{levelId}/enemies?difficulty={difficulty}";
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            LevelEnemiesResponse response = JsonUtility.FromJson<LevelEnemiesResponse>(request.downloadHandler.text);
            
            Debug.Log($"Level {worldId}-{levelId} ({difficulty}): {response.totalEnemies} enemies");
            Debug.Log($"Total Power: {response.totalPower}");
            
            foreach (LevelEnemy enemy in response.enemies)
            {
                SpawnEnemy(enemy);
            }
        }
    }

    void SpawnEnemy(LevelEnemy enemy)
    {
        Debug.Log($"Spawn: {enemy.name} at position {enemy.position}");
        Debug.Log($"Stats: HP={enemy.finalStats.hp} ATK={enemy.finalStats.atk}");
    }
}
```

### 4. Filtrer les monstres

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class MonsterFilter : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/monsters";

    IEnumerator GetBosses()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "?type=boss");
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            MonstersResponse response = JsonUtility.FromJson<MonstersResponse>(request.downloadHandler.text);
            
            foreach (Monster boss in response.monsters)
            {
                Debug.Log($"Boss: {boss.name} ({boss.element})");
                
                if (boss.bossMechanics != null)
                {
                    Debug.Log($"  Enrage at: {boss.bossMechanics.enrageAtHpPercent}%");
                    Debug.Log($"  Phases: {boss.bossMechanics.phaseTransitions.Length}");
                }
            }
        }
    }

    IEnumerator GetFireDragons()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "?element=Fire&theme=dragon");
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            MonstersResponse response = JsonUtility.FromJson<MonstersResponse>(request.downloadHandler.text);
            Debug.Log($"Found {response.total} Fire Dragons");
        }
    }
}
```

### 5. Boss Mechanics Handler

```csharp
using UnityEngine;

public class BossMechanicsHandler : MonoBehaviour
{
    private Monster currentBoss;
    private int currentPhase = 1;
    private bool isEnraged = false;

    public void SetBoss(Monster boss)
    {
        currentBoss = boss;
        currentPhase = 1;
        isEnraged = false;
        
        if (boss.bossMechanics != null)
        {
            Debug.Log($"Boss loaded: {boss.name}");
            Debug.Log($"Phases: {boss.bossMechanics.phaseTransitions.Length}");
            Debug.Log($"Special Abilities: {string.Join(", ", boss.bossMechanics.specialAbilities)}");
        }
    }

    public void CheckPhaseTransition(float currentHpPercent)
    {
        if (currentBoss.bossMechanics == null) return;

        // Vérifier les transitions de phase
        foreach (int threshold in currentBoss.bossMechanics.phaseTransitions)
        {
            if (currentHpPercent <= threshold && currentPhase == 1)
            {
                TriggerPhaseTransition(threshold);
                currentPhase = 2;
                break;
            }
        }

        // Vérifier l'enrage
        if (currentHpPercent <= currentBoss.bossMechanics.enrageAtHpPercent && !isEnraged)
        {
            TriggerEnrage();
            isEnraged = true;
        }
    }

    void TriggerPhaseTransition(int hpThreshold)
    {
        Debug.Log($"Boss phase transition at {hpThreshold}% HP!");
        PlayPhaseAnimation();
        ActivateNewAbilities();
    }

    void TriggerEnrage()
    {
        Debug.Log("Boss is ENRAGED!");
        PlayEnrageAnimation();
        IncreaseAttackSpeed();
    }

    void PlayPhaseAnimation()
    {
        // Animation de transition
    }

    void ActivateNewAbilities()
    {
        // Activer nouvelles capacités
    }

    void PlayEnrageAnimation()
    {
        // Animation d'enrage
    }

    void IncreaseAttackSpeed()
    {
        // Augmenter vitesse d'attaque
    }
}
```

### 6. Système d'immunités et faiblesses

```csharp
using UnityEngine;
using System.Linq;

public class ElementalDamageCalculator : MonoBehaviour
{
    public float CalculateDamage(Monster monster, string damageType, float baseDamage)
    {
        float finalDamage = baseDamage;

        // Vérifier immunités (dégâts annulés)
        if (monster.bossMechanics != null && monster.bossMechanics.immunities != null)
        {
            if (monster.bossMechanics.immunities.Contains(damageType))
            {
                Debug.Log($"{monster.name} is IMMUNE to {damageType}!");
                ShowImmunityEffect();
                return 0f;
            }
        }

        // Vérifier faiblesses (dégâts doublés)
        if (monster.bossMechanics != null && monster.bossMechanics.weaknesses != null)
        {
            if (monster.bossMechanics.weaknesses.Contains(damageType))
            {
                Debug.Log($"{monster.name} is WEAK to {damageType}!");
                finalDamage *= 2.0f;
                ShowWeaknessEffect();
            }
        }

        return finalDamage;
    }

    void ShowImmunityEffect()
    {
        // Afficher effet visuel "IMMUNE"
    }

    void ShowWeaknessEffect()
    {
        // Afficher effet visuel de faiblesse (cracks, etc.)
    }
}
```

### 7. Sprite Loader pour monstres

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class MonsterSpriteLoader : MonoBehaviour
{
    private string cdnURL = "https://cdn.your-game.com/monsters/sprites/";

    public IEnumerator LoadMonsterSprite(Monster monster, SpriteRenderer renderer)
    {
        string spriteUrl = cdnURL + monster.spriteId + ".png";
        
        UnityWebRequest request = UnityWebRequestTexture.GetTexture(spriteUrl);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            Texture2D texture = ((DownloadHandlerTexture)request.downloadHandler).texture;
            Sprite sprite = Sprite.Create(
                texture,
                new Rect(0, 0, texture.width, texture.height),
                new Vector2(0.5f, 0.5f)
            );
            
            renderer.sprite = sprite;
            
            // Appliquer des effets selon le type
            ApplyMonsterEffects(monster, renderer);
        }
        else
        {
            Debug.LogError($"Failed to load sprite: {monster.spriteId}");
            LoadPlaceholderSprite(renderer, monster.type);
        }
    }

    void ApplyMonsterEffects(Monster monster, SpriteRenderer renderer)
    {
        switch (monster.type)
        {
            case "boss":
                renderer.color = new Color(1f, 0.9f, 0.9f); // Teinte rougeâtre
                renderer.transform.localScale *= 1.3f; // Plus grand
                break;
            case "elite":
                renderer.color = new Color(0.9f, 0.9f, 1f); // Teinte bleutée
                renderer.transform.localScale *= 1.15f;
                break;
        }
    }

    void LoadPlaceholderSprite(SpriteRenderer renderer, string type)
    {
        // Charger sprite placeholder selon le type
    }
}
```

---

## Gestion des erreurs

### Codes d'erreur HTTP

| Code | Description | Action |
|------|-------------|--------|
| 200 | Succès | OK |
| 400 | Requête invalide | Vérifier paramètres |
| 404 | Monstre introuvable | Vérifier monsterId |
| 500 | Erreur serveur | Réessayer |

### Codes d'erreur métier

- `MONSTER_NOT_FOUND` : Monstre introuvable
- `WORLD_NOT_FOUND` : Monde introuvable
- `LEVEL_NOT_FOUND` : Niveau introuvable
- `INVALID_DIFFICULTY` : Difficulté invalide
- `NO_MONSTERS_AVAILABLE` : Aucun monstre disponible pour ce monde

---

## Best Practices

### À FAIRE

1. ✅ Précharger les sprites des monstres du monde actuel
2. ✅ Cacher les stats ennemies avant combat
3. ✅ Afficher les immunités/faiblesses des boss
4. ✅ Animations distinctes par type (normal/elite/boss)
5. ✅ Effets visuels pour phases de boss
6. ✅ Son unique pour enrage
7. ✅ Bestiaire avec progression
8. ✅ Indicateurs visuels de puissance
9. ✅ Preview des ennemis avant combat
10. ✅ Cache local des monstres rencontrés

### À ÉVITER

1. ❌ Ne pas hardcoder les stats
2. ❌ Ne pas ignorer les boss mechanics
3. ❌ Ne pas utiliser le même sprite pour variantes
4. ❌ Ne pas oublier les animations de phase
5. ❌ Ne pas négliger les effets d'immunité
6. ❌ Ne pas cacher les infos importantes au joueur
7. ❌ Ne pas faire spawner tous les monstres simultanément
8. ❌ Ne pas ignorer les worldTags

---

## Checklist d'intégration

### Phase 1 - Basique
- [ ] Charger les monstres d'un monde
- [ ] Afficher un monstre avec sprite
- [ ] Calculer les stats finales
- [ ] Spawner les ennemis d'un level
- [ ] Appliquer les multiplicateurs de difficulté

### Phase 2 - Intermédiaire
- [ ] Boss mechanics (phases, enrage)
- [ ] Immunités et faiblesses
- [ ] Animations par type
- [ ] Effets visuels spéciaux
- [ ] Sons distincts par type

### Phase 3 - Avancé
- [ ] Bestiaire complet
- [ ] Filtres et recherche
- [ ] Statistiques de rencontres
- [ ] Preview de puissance avant combat
- [ ] Récompenses de découverte

---

## Informations techniques

### Types de monstres

#### Normal
- **Multiplicateur stats** : ×1.0
- **Niveau** : base + (worldId × 2)
- **Étoiles** : 3
- **Loot** : 10-30 gold, 20 XP

#### Elite
- **Multiplicateur stats** : ×1.5
- **Niveau** : base + (worldId × 3)
- **Étoiles** : 4
- **Loot** : 30-80 gold, 50 XP
- **Apparence** : Teinte bleutée, +15% taille

#### Boss
- **Multiplicateur stats** : ×2.5
- **Niveau** : base + (worldId × 5)
- **Étoiles** : 5
- **Loot** : 100-300 gold, 150 XP
- **Apparence** : Teinte rouge, +30% taille
- **Mechanics** : Enrage, phases, capacités spéciales

### Thèmes visuels

- **forest** : Créatures forestières (gobelins, loups)
- **beast** : Bêtes sauvages (salamanders, ours)
- **giant** : Géants, trolls (yetis, ogres)
- **dragon** : Dragons et drakes
- **undead** : Morts-vivants (squelettes, liches)
- **demon** : Démons (imps, archdemons)
- **elemental** : Élémentaires purs
- **shadow** : Créatures d'ombre
- **celestial** : Êtres lumineux
- **construct** : Golems, automates
- **insect** : Créatures insectoïdes
- **aquatic** : Créatures marines
- **corrupted** : Versions corrompues

### Scaling par difficulté

- **Normal** : ×1.0
- **Hard** : ×2.0
- **Nightmare** : ×4.0

### Formule de Power Score

```
Power = (ATK × 1.0) + (DEF × 2.0) + (HP ÷ 10) + (Speed × 0.5) + (Crit × 2.0)
```

### Distribution élémentaire

Chaque élément a ~7 monstres répartis entre:
- 3-4 Normal
- 2-3 Elite  
- 1-2 Boss

### World Tags

Les monstres apparaissent dans des mondes spécifiques:
- **Salamanders** : Mondes 1-5 (début du jeu)
- **Yetis** : Mondes 6-12 (mid-game)
- **Dragons** : Mondes 10, 15, 20 (boss de fin)
- **Undead** : Mondes 7-14
- **Demons** : Mondes 15-20 (endgame)

---

## Modes de génération

### Mode 1 : Monstres spécifiques (Manual Assignment)

Les monstres sont assignés manuellement dans la configuration du level.

```json
{
  "levelIndex": 10,
  "name": "Dragon's Lair",
  "monsters": [
    {
      "monsterId": "BOSS_inferno_dragon",
      "count": 1,
      "position": 1,
      "levelOverride": 30,
      "starsOverride": 5
    }
  ]
}
```

**Utilisation Unity :**
```csharp
// Les monstres sont retournés exactement comme configurés
// Idéal pour les boss uniques et levels scriptés
```

### Mode 2 : Auto-génération (World Pool)

Les monstres sont générés automatiquement depuis le pool du monde.

```json
{
  "levelIndex": 5,
  "name": "Forest Path",
  "autoGenerate": {
    "useWorldPool": true,
    "count": 3,
    "enemyType": "normal"
  }
}
```

**Utilisation Unity :**
```csharp
// Les monstres changent à chaque génération
// Bon pour la rejouabilité
```

### Mode 3 : Legacy (Compatibilité)

Ancien système basé sur enemyType/enemyCount.

```json
{
  "levelIndex": 8,
  "name": "Mountain Pass",
  "enemyType": "elite",
  "enemyCount": 2
}
```

---

## Bestiaire (Monster Encyclopedia)

### Concept

Système de collection type Pokédex où les joueurs débloquent des informations sur les monstres rencontrés.

### Endpoints Bestiaire

#### Obtenir le bestiaire du joueur

**GET** `/api/player/bestiary`

#### Auth requise
✅ **Oui** (JWT Token)

#### Réponse succès (200)

```json
{
  "success": true,
  "totalDiscovered": 28,
  "totalMonsters": 42,
  "completionPercent": 66.67,
  "entries": [
    {
      "monsterId": "MON_green_salamander",
      "discovered": true,
      "firstEncounter": "2025-10-01T10:30:00Z",
      "timesDefeated": 15,
      "fastestDefeat": 28500,
      "unlocked": {
        "basicInfo": true,
        "stats": true,
        "weaknesses": true,
        "lore": false
      }
    },
    {
      "monsterId": "BOSS_inferno_dragon",
      "discovered": false,
      "unlocked": {
        "basicInfo": false,
        "stats": false,
        "weaknesses": false,
        "lore": false
      }
    }
  ],
  "rewards": {
    "milestones": [
      {
        "monstersRequired": 10,
        "claimed": true,
        "reward": { "gems": 100 }
      },
      {
        "monstersRequired": 25,
        "claimed": false,
        "reward": { "gems": 250, "tickets": 5 }
      }
    ]
  }
}
```

### Modèle C# pour Bestiaire

```csharp
[System.Serializable]
public class BestiaryResponse
{
    public bool success;
    public int totalDiscovered;
    public int totalMonsters;
    public float completionPercent;
    public BestiaryEntry[] entries;
    public BestiaryRewards rewards;
}

[System.Serializable]
public class BestiaryEntry
{
    public string monsterId;
    public bool discovered;
    public string firstEncounter;
    public int timesDefeated;
    public int fastestDefeat;
    public UnlockedInfo unlocked;
}

[System.Serializable]
public class UnlockedInfo
{
    public bool basicInfo;
    public bool stats;
    public bool weaknesses;
    public bool lore;
}

[System.Serializable]
public class BestiaryRewards
{
    public Milestone[] milestones;
}

[System.Serializable]
public class Milestone
{
    public int monstersRequired;
    public bool claimed;
    public MilestoneReward reward;
}

[System.Serializable]
public class MilestoneReward
{
    public int gems;
    public int tickets;
}
```

### Exemple Unity - Bestiaire UI

```csharp
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using System.Collections;

public class BestiaryUI : MonoBehaviour
{
    public Text completionText;
    public GameObject entryPrefab;
    public Transform entryContainer;
    
    private string baseURL = "https://your-api.com/api/player";
    private string jwtToken;

    IEnumerator LoadBestiary()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/bestiary");
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            BestiaryResponse response = JsonUtility.FromJson<BestiaryResponse>(request.downloadHandler.text);
            
            completionText.text = $"Discovered: {response.totalDiscovered}/{response.totalMonsters} ({response.completionPercent:F1}%)";
            
            foreach (BestiaryEntry entry in response.entries)
            {
                CreateEntryUI(entry);
            }
        }
    }

    void CreateEntryUI(BestiaryEntry entry)
    {
        GameObject entryObj = Instantiate(entryPrefab, entryContainer);
        BestiaryEntryUI entryUI = entryObj.GetComponent<BestiaryEntryUI>();
        
        if (entry.discovered)
        {
            entryUI.SetDiscovered(entry);
        }
        else
        {
            entryUI.SetUndiscovered();
        }
    }
}

public class BestiaryEntryUI : MonoBehaviour
{
    public Image monsterIcon;
    public Text monsterName;
    public Text defeatedCount;
    public GameObject lockedOverlay;

    public void SetDiscovered(BestiaryEntry entry)
    {
        lockedOverlay.SetActive(false);
        
        // Charger les données du monstre
        StartCoroutine(LoadMonsterData(entry.monsterId));
        
        defeatedCount.text = $"Defeated: {entry.timesDefeated}x";
        
        if (entry.fastestDefeat > 0)
        {
            float seconds = entry.fastestDefeat / 1000f;
            defeatedCount.text += $"\nFastest: {seconds:F1}s";
        }
    }

    public void SetUndiscovered()
    {
        lockedOverlay.SetActive(true);
        monsterName.text = "???";
        monsterIcon.color = Color.black;
    }

    IEnumerator LoadMonsterData(string monsterId)
    {
        // Charger les détails du monstre depuis l'API
        yield return null;
    }
}
```

---

## WebSocket Events - Battle en temps réel

### Monster Events

```csharp
socket.On("battle:monster_action", response =>
{
    var data = JsonUtility.FromJson<MonsterActionData>(response.GetValue<string>());
    
    Debug.Log($"{data.monsterName} uses {data.actionType}!");
    
    if (data.actionType == "ultimate")
    {
        PlayUltimateAnimation(data.monsterId);
    }
});

socket.On("battle:monster_defeated", response =>
{
    var data = JsonUtility.FromJson<MonsterDefeatedData>(response.GetValue<string>());
    
    Debug.Log($"{data.monsterName} defeated!");
    PlayDeathAnimation(data.monsterId);
    ShowLootDrop(data.loot);
    
    // Unlock dans le bestiaire
    UnlockBestiaryEntry(data.monsterId);
});

socket.On("battle:boss_phase_change", response =>
{
    var data = JsonUtility.FromJson<BossPhaseData>(response.GetValue<string>());
    
    Debug.Log($"Boss phase {data.phase}!");
    PlayPhaseTransition(data.phase);
    ShowWarning(data.message);
});
```

### Event Models

```csharp
[System.Serializable]
public class MonsterActionData
{
    public string monsterId;
    public string monsterName;
    public string actionType;
    public int damage;
    public string[] targetIds;
}

[System.Serializable]
public class MonsterDefeatedData
{
    public string monsterId;
    public string monsterName;
    public MonsterLoot loot;
    public int experience;
}

[System.Serializable]
public class BossPhaseData
{
    public string monsterId;
    public int phase;
    public int hpPercent;
    public string message;
    public string[] newAbilities;
}
```

---

## Advanced Features

### 1. Monster Variants (Shiny/Rare)

Certains monstres peuvent apparaître en version "shiny" avec stats boostées.

```csharp
public class MonsterVariantChecker : MonoBehaviour
{
    public bool IsShinyVariant(Monster monster)
    {
        // 1% chance d'être shiny
        return monster.monsterId.EndsWith("_shiny");
    }

    public void ApplyShinyEffects(GameObject monsterObj, Monster monster)
    {
        if (IsShinyVariant(monster))
        {
            // Effet visuel doré
            ParticleSystem particles = monsterObj.AddComponent<ParticleSystem>();
            var main = particles.main;
            main.startColor = Color.yellow;
            
            // Stats boostées
            Debug.Log("Shiny monster! +50% stats and +100% loot!");
        }
    }
}
```

### 2. Monster Formations

Les monstres peuvent avoir des formations tactiques.

```csharp
public class MonsterFormation : MonoBehaviour
{
    public void SetupFormation(LevelEnemy[] enemies)
    {
        // Position 1-2 : Tanks à l'avant
        var tanks = enemies.Where(e => e.role == "Tank").ToArray();
        for (int i = 0; i < tanks.Length; i++)
        {
            PositionMonster(tanks[i], i + 1);
        }

        // Position 3-5 : DPS et Support à l'arrière
        var backline = enemies.Where(e => e.role != "Tank").ToArray();
        for (int i = 0; i < backline.Length; i++)
        {
            PositionMonster(backline[i], i + 3);
        }
    }

    void PositionMonster(LevelEnemy enemy, int position)
    {
        // Placer le monstre selon sa position
        Vector3 pos = GetFormationPosition(position);
        // Spawn at pos
    }

    Vector3 GetFormationPosition(int slot)
    {
        // Positions du battlefield
        switch (slot)
        {
            case 1: return new Vector3(-2, 0, 2);
            case 2: return new Vector3(-2, 0, -2);
            case 3: return new Vector3(2, 0, 0);
            case 4: return new Vector3(2, 0, 2);
            case 5: return new Vector3(2, 0, -2);
            default: return Vector3.zero;
        }
    }
}
```

### 3. Dynamic Difficulty Adjustment

Ajuster la difficulté selon la performance du joueur.

```csharp
public class DynamicDifficulty : MonoBehaviour
{
    private int consecutiveWins = 0;
    private int consecutiveLosses = 0;

    public string GetAdjustedDifficulty()
    {
        if (consecutiveWins >= 5)
        {
            return "Hard"; // Augmenter difficulté
        }
        else if (consecutiveLosses >= 3)
        {
            return "Normal"; // Réduire difficulté
        }
        
        return "Normal";
    }

    public void RecordBattleResult(bool victory)
    {
        if (victory)
        {
            consecutiveWins++;
            consecutiveLosses = 0;
        }
        else
        {
            consecutiveLosses++;
            consecutiveWins = 0;
        }
    }
}
```

---

## Performance Tips

### 1. Object Pooling pour monstres

```csharp
using UnityEngine;
using System.Collections.Generic;

public class MonsterPool : MonoBehaviour
{
    public GameObject monsterPrefab;
    private Queue<GameObject> pool = new Queue<GameObject>();
    private int poolSize = 20;

    void Start()
    {
        for (int i = 0; i < poolSize; i++)
        {
            GameObject obj = Instantiate(monsterPrefab);
            obj.SetActive(false);
            pool.Enqueue(obj);
        }
    }

    public GameObject GetMonster()
    {
        if (pool.Count > 0)
        {
            GameObject obj = pool.Dequeue();
            obj.SetActive(true);
            return obj;
        }
        
        return Instantiate(monsterPrefab);
    }

    public void ReturnMonster(GameObject monster)
    {
        monster.SetActive(false);
        pool.Enqueue(monster);
    }
}
```

### 2. Sprite Atlas pour optimisation

Regrouper tous les sprites de monstres dans un atlas pour réduire les draw calls.

### 3. LOD (Level of Detail)

Réduire la qualité des monstres éloignés de la caméra.

```csharp
public class MonsterLOD : MonoBehaviour
{
    public GameObject highDetailModel;
    public GameObject lowDetailModel;
    private Camera mainCamera;

    void Update()
    {
        float distance = Vector3.Distance(transform.position, mainCamera.transform.position);
        
        if (distance > 20f)
        {
            highDetailModel.SetActive(false);
            lowDetailModel.SetActive(true);
        }
        else
        {
            highDetailModel.SetActive(true);
            lowDetailModel.SetActive(false);
        }
    }
}
```

---

## Troubleshooting

### Problème : Monstres ne s'affichent pas

**Solution :**
1. Vérifier que le monsterId existe
2. Vérifier les worldTags du monstre
3. Vérifier la connexion API
4. Vérifier les logs serveur

### Problème : Stats incorrectes

**Solution :**
1. Vérifier le level/stars/difficulty
2. Utiliser l'endpoint `/preview` pour débugger
3. Comparer avec gameBalance.ts

### Problème : Boss mechanics ne fonctionnent pas

**Solution :**
1. Vérifier que `bossMechanics` n'est pas null
2. Écouter les events WebSocket
3. Logger les transitions de phase
4. Vérifier le calcul HP percent

---

## Support et ressources

### Documentation complémentaire
- [Battle System API](./battle.md)
- [Campaign API](./campaign.md)
- [Game Balance Config](../config/gameBalance.md)

### Endpoints de test
```
GET /api/monsters/test/generate?worldId=1&levelId=5
POST /api/monsters/test/battle
```

### Debug mode
Ajouter `?debug=true` à n'importe quel endpoint pour avoir des logs détaillés.

---

**Version:** 1.0.0  
**Dernière mise à jour:** 3 octobre 2025  
**Système:** Monster Generation & Management

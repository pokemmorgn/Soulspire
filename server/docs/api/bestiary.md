# 📖 Bestiary System API - Documentation Unity

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

Le système **Bestiary** (Monster Encyclopedia) permet aux joueurs de collectionner des informations sur les monstres rencontrés durant leur aventure. Le système s'inspire d'AFK Arena et du Pokédex.

### Fonctionnalités principales

- ✅ **Auto-découverte** : Les monstres sont automatiquement ajoutés après chaque combat
- ✅ **5 niveaux de progression** : Undiscovered → Discovered → Novice (10 kills) → Veteran (50 kills) → Master (100 kills)
- ✅ **Récompenses progressives** : Gems, gold, lore, bonus permanents, titres
- ✅ **Statistiques détaillées** : Temps de kill, dégâts infligés/reçus, taux de victoire
- ✅ **Récompenses de complétion** : Par type (normal/elite/boss), par élément, complétion 100%
- ✅ **Leaderboard** : Classement des meilleurs collectionneurs par serveur
- ✅ **Notifications temps réel** : WebSocket pour découvertes et level-ups
- ✅ **Filtres avancés** : Par élément, type, niveau de progression

### Base URL

```
https://your-api-domain.com/api/bestiary
```

---

## Endpoints API

### 1. Récupérer le bestiaire complet

**GET** `/api/bestiary`

Récupère toutes les entrées du bestiaire avec filtres optionnels.

#### Auth requise
✅ **Oui** (JWT Token obligatoire)

#### Query Parameters

| Paramètre | Type | Valeurs possibles | Description |
|-----------|------|-------------------|-------------|
| `element` | string | Fire, Water, Wind, Electric, Light, Dark | Filtrer par élément |
| `type` | string | normal, elite, boss | Filtrer par type |
| `progressionLevel` | string | Undiscovered, Discovered, Novice, Veteran, Master | Filtrer par niveau |
| `isDiscovered` | boolean | true, false | Seulement découverts ou non |

#### Réponse succès (200)

```json
{
  "success": true,
  "entries": [
    {
      "monsterId": "MON_fire_goblin",
      "progressionLevel": "Novice",
      "progressPercentage": 30,
      "isDiscovered": true,
      "monster": {
        "name": "Fire Goblin",
        "element": "Fire",
        "type": "normal",
        "visualTheme": "forest"
      },
      "basicStats": {
        "timesEncountered": 15,
        "timesDefeated": 12,
        "firstEncounteredAt": "2025-01-15T10:30:00Z"
      },
      "fullStats": {
        "timesKilledBy": 3,
        "totalDamageDealt": 15420,
        "totalDamageTaken": 8930,
        "averageKillTime": 28500,
        "fastestKillTime": 21000
      },
      "pendingRewards": {
        "discovery": false,
        "novice": true,
        "veteran": false,
        "master": false
      }
    }
  ],
  "stats": {
    "total": 28,
    "discovered": 12,
    "undiscovered": 16,
    "completionPercentage": 42
  },
  "totalMonsters": 28
}
```

---

### 2. Obtenir les statistiques globales

**GET** `/api/bestiary/stats`

Récupère les statistiques globales du bestiaire du joueur.

#### Auth requise
✅ **Oui**

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)

```json
{
  "success": true,
  "stats": {
    "total": 28,
    "discovered": 12,
    "undiscovered": 16,
    "byProgressionLevel": {
      "Undiscovered": 16,
      "Discovered": 5,
      "Novice": 4,
      "Veteran": 2,
      "Master": 1
    },
    "byType": {
      "normal": 18,
      "elite": 7,
      "boss": 3
    },
    "byElement": {
      "Fire": 5,
      "Water": 4,
      "Wind": 4,
      "Electric": 3,
      "Light": 3,
      "Dark": 3
    },
    "combatTotals": {
      "totalEncounters": 247,
      "totalDefeats": 198,
      "totalDeaths": 49,
      "totalDamageDealt": 1847293,
      "totalDamageTaken": 847291
    },
    "completionPercentage": 42,
    "masterCompletionPercentage": 3,
    "totalMonstersInGame": 28
  }
}
```

---

### 3. Détails d'un monstre spécifique

**GET** `/api/bestiary/:monsterId`

Récupère les informations détaillées d'un monstre dans le bestiaire.

#### Auth requise
✅ **Oui**

#### URL Parameters

| Paramètre | Type | Description |
|-----------|------|-------------|
| `monsterId` | string | ID du monstre (ex: `MON_fire_goblin`) |

#### Réponse succès (200)

```json
{
  "success": true,
  "entry": {
    "monsterId": "MON_fire_goblin",
    "progressionLevel": "Veteran",
    "progressPercentage": 80,
    "isDiscovered": true,
    "monster": {
      "name": "Fire Goblin",
      "element": "Fire",
      "type": "normal",
      "visualTheme": "forest"
    },
    "basicStats": {
      "timesEncountered": 87,
      "timesDefeated": 80,
      "firstEncounteredAt": "2025-01-10T08:00:00Z"
    },
    "fullStats": {
      "timesKilledBy": 7,
      "totalDamageDealt": 124750,
      "totalDamageTaken": 67320,
      "averageKillTime": 31200,
      "fastestKillTime": 18500
    },
    "lore": {
      "unlocked": true,
      "description": "Fire Goblins are small but fierce creatures..."
    },
    "drops": {
      "unlocked": true
    },
    "pendingRewards": {
      "discovery": false,
      "novice": false,
      "veteran": false,
      "master": false
    }
  }
}
```

#### Réponse monstre non découvert (200)

```json
{
  "success": true,
  "entry": {
    "monsterId": "MON_shadow_dragon",
    "progressionLevel": "Undiscovered",
    "isDiscovered": false,
    "monster": {
      "name": "???",
      "element": "Unknown",
      "type": "Unknown",
      "visualTheme": "Unknown"
    },
    "message": "Ce monstre n'a pas encore été rencontré"
  }
}
```

---

### 4. Récompenses de complétion disponibles

**GET** `/api/bestiary/rewards`

Récupère les récompenses de complétion disponibles (par type, élément, etc.).

#### Auth requise
✅ **Oui**

#### Réponse succès (200)

```json
{
  "success": true,
  "rewards": {
    "available": [
      {
        "id": "fire_element_complete",
        "name": "Fire Element Mastery",
        "gems": 500,
        "bonus": "+5% damage vs Fire monsters",
        "avatar": "fire_master_avatar"
      }
    ],
    "claimed": [
      {
        "id": "normal_type_complete",
        "claimedAt": "2025-01-20T14:30:00Z"
      }
    ],
    "progress": {
      "Fire_discovery": {
        "current": 5,
        "required": 7,
        "percentage": 71,
        "reward": {
          "gems": 500,
          "bonus": "+5% damage vs Fire monsters"
        }
      },
      "Water_discovery": {
        "current": 4,
        "required": 7,
        "percentage": 57,
        "reward": {
          "gems": 500,
          "bonus": "+5% damage vs Water monsters"
        }
      }
    }
  }
}
```

---

### 5. Réclamer une récompense

**POST** `/api/bestiary/rewards/claim`

Réclame une récompense de complétion.

#### Auth requise
✅ **Oui**

#### Request Body

```json
{
  "rewardId": "fire_element_complete"
}
```

#### Réponse succès (200)

```json
{
  "success": true,
  "message": "Récompense réclamée avec succès !",
  "reward": {
    "id": "fire_element_complete",
    "name": "Fire Element Mastery",
    "gems": 500,
    "bonus": "+5% damage vs Fire monsters"
  }
}
```

#### Réponse échec (400)

```json
{
  "success": false,
  "error": "Récompense non disponible ou déjà réclamée",
  "code": "REWARD_NOT_AVAILABLE"
}
```

---

### 6. Classement des collectionneurs

**GET** `/api/bestiary/leaderboard`

Récupère le classement des meilleurs collectionneurs du serveur.

#### Auth requise
✅ **Oui**

#### Query Parameters

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `limit` | number | 50 | Nombre de résultats (1-100) |

#### Réponse succès (200)

```json
{
  "success": true,
  "leaderboard": [
    {
      "playerId": "PLAYER_abc123",
      "playerName": "DragonSlayer",
      "playerLevel": 47,
      "totalDiscovered": 28,
      "totalMastered": 12,
      "totalDefeats": 847,
      "totalDamage": 5847293
    },
    {
      "playerId": "PLAYER_def456",
      "playerName": "MonsterHunter",
      "playerLevel": 42,
      "totalDiscovered": 27,
      "totalMastered": 8,
      "totalDefeats": 723,
      "totalDamage": 4293847
    }
  ],
  "total": 50
}
```

---

### 7. Monstres les plus combattus

**GET** `/api/bestiary/most-fought`

Récupère les monstres les plus combattus (global ou personnel).

#### Auth requise
✅ **Oui**

#### Query Parameters

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `limit` | number | 10 | Nombre de résultats (1-50) |
| `personal` | boolean | false | Stats personnelles (true) ou serveur (false) |

#### Réponse succès (200)

```json
{
  "success": true,
  "monsters": [
    {
      "monsterId": "MON_fire_goblin",
      "name": "Fire Goblin",
      "element": "Fire",
      "type": "normal",
      "totalEncounters": 1847,
      "totalDefeats": 1523,
      "totalDeaths": 324,
      "winRate": 82
    }
  ],
  "scope": "server",
  "total": 10
}
```

---

### 8. Informations système (Public)

**GET** `/api/bestiary/info`

Récupère les informations sur le système de bestiaire.

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "info": {
    "system": {
      "name": "Monster Encyclopedia (Bestiary)",
      "version": "1.0.0",
      "description": "Collection system inspired by AFK Arena and Pokédex"
    },
    "features": {
      "autoDiscovery": "Monsters are automatically added after battles",
      "progressionLevels": [
        "Undiscovered",
        "Discovered",
        "Novice (10 kills)",
        "Veteran (50 kills)",
        "Master (100 kills)"
      ],
      "rewards": "Gems, gold, lore, bonus stats, titles",
      "tracking": "Combat stats, kill times, damage dealt/taken",
      "completionRewards": "Type, element, and full completion bonuses",
      "leaderboard": "Server-wide collector rankings"
    }
  }
}
```

---

## Modèles de données C#

### BestiaryResponse Model

```csharp
[System.Serializable]
public class BestiaryResponse
{
    public bool success;
    public BestiaryEntry[] entries;
    public BestiaryStats stats;
    public int totalMonsters;
}

[System.Serializable]
public class BestiaryEntry
{
    public string monsterId;
    public string progressionLevel; // Undiscovered, Discovered, Novice, Veteran, Master
    public int progressPercentage; // 0-100
    public bool isDiscovered;
    public MonsterInfo monster;
    public BasicStats basicStats;
    public FullStats fullStats; // Null si pas Novice+
    public LoreInfo lore; // Null si pas Veteran+
    public DropsInfo drops; // Null si pas Veteran+
    public PendingRewards pendingRewards;
    public MasterBonus masterBonus; // Null si pas Master
}

[System.Serializable]
public class MonsterInfo
{
    public string name;
    public string element;
    public string type; // normal, elite, boss
    public string visualTheme;
}

[System.Serializable]
public class BasicStats
{
    public int timesEncountered;
    public int timesDefeated;
    public string firstEncounteredAt; // ISO date
}

[System.Serializable]
public class FullStats
{
    public int timesKilledBy;
    public long totalDamageDealt;
    public long totalDamageTaken;
    public int averageKillTime; // milliseconds
    public int fastestKillTime; // milliseconds
}

[System.Serializable]
public class LoreInfo
{
    public bool unlocked;
    public string description;
}

[System.Serializable]
public class DropsInfo
{
    public bool unlocked;
}

[System.Serializable]
public class PendingRewards
{
    public bool discovery;
    public bool novice;
    public bool veteran;
    public bool master;
}

[System.Serializable]
public class MasterBonus
{
    public int damageBonus; // +5% damage
    public int defenseBonus; // +5% defense
}

[System.Serializable]
public class BestiaryStats
{
    public int total;
    public int discovered;
    public int undiscovered;
    public ProgressionLevelStats byProgressionLevel;
    public TypeStats byType;
    public ElementStats byElement;
    public CombatTotals combatTotals;
    public int completionPercentage;
    public int masterCompletionPercentage;
    public int totalMonstersInGame;
}

[System.Serializable]
public class ProgressionLevelStats
{
    public int Undiscovered;
    public int Discovered;
    public int Novice;
    public int Veteran;
    public int Master;
}

[System.Serializable]
public class TypeStats
{
    public int normal;
    public int elite;
    public int boss;
}

[System.Serializable]
public class ElementStats
{
    public int Fire;
    public int Water;
    public int Wind;
    public int Electric;
    public int Light;
    public int Dark;
}

[System.Serializable]
public class CombatTotals
{
    public int totalEncounters;
    public int totalDefeats;
    public int totalDeaths;
    public long totalDamageDealt;
    public long totalDamageTaken;
}
```

### Leaderboard Model

```csharp
[System.Serializable]
public class LeaderboardResponse
{
    public bool success;
    public LeaderboardEntry[] leaderboard;
    public int total;
}

[System.Serializable]
public class LeaderboardEntry
{
    public string playerId;
    public string playerName;
    public int playerLevel;
    public int totalDiscovered;
    public int totalMastered;
    public int totalDefeats;
    public long totalDamage;
}
```

### Rewards Model

```csharp
[System.Serializable]
public class RewardsResponse
{
    public bool success;
    public RewardsData rewards;
}

[System.Serializable]
public class RewardsData
{
    public CompletionReward[] available;
    public ClaimedReward[] claimed;
    public RewardProgress progress;
}

[System.Serializable]
public class CompletionReward
{
    public string id;
    public string name;
    public int gems;
    public string bonus;
    public string title;
    public string avatar;
}

[System.Serializable]
public class ClaimedReward
{
    public string id;
    public string claimedAt; // ISO date
}

[System.Serializable]
public class RewardProgress
{
    // Dictionary of progress entries
    // Key: element or type name (e.g., "Fire_discovery")
    // Value: ProgressEntry
}

[System.Serializable]
public class ProgressEntry
{
    public int current;
    public int required;
    public int percentage;
    public RewardInfo reward;
}

[System.Serializable]
public class RewardInfo
{
    public int gems;
    public string bonus;
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
    socket.Emit("bestiary:join_room");
});

socket.ConnectAsync();
```

### Événements principaux

#### Monster discovered
**Event:** `bestiary:discovery`

```csharp
socket.On("bestiary:discovery", response =>
{
    var data = JsonUtility.FromJson<BestiaryDiscoveryEvent>(response.GetValue<string>());
    
    ShowDiscoveryAnimation(data);
    PlaySound("monster_discovered");
    
    Debug.Log($"New monster discovered: {data.data.monsterName}");
});
```

**Payload:**
```json
{
  "type": "monster_discovered",
  "data": {
    "monsterId": "MON_fire_goblin",
    "monsterName": "Fire Goblin",
    "monsterType": "normal",
    "element": "Fire",
    "rewards": [
      { "type": "gems", "amount": 15 },
      { "type": "gold", "amount": 30 }
    ]
  },
  "timestamp": "2025-01-20T15:30:00Z",
  "animation": "monster_discovery"
}
```

#### Level up
**Event:** `bestiary:level_up`

```csharp
socket.On("bestiary:level_up", response =>
{
    var data = JsonUtility.FromJson<BestiaryLevelUpEvent>(response.GetValue<string>());
    
    ShowLevelUpAnimation(data);
    
    if (data.data.newLevel == "Master")
    {
        PlaySound("master_achievement");
        ShowCelebration();
    }
    
    Debug.Log($"{data.data.monsterName} reached {data.data.newLevel}!");
});
```

**Payload:**
```json
{
  "type": "bestiary_level_up",
  "data": {
    "monsterId": "MON_fire_goblin",
    "monsterName": "Fire Goblin",
    "previousLevel": "Novice",
    "newLevel": "Veteran",
    "rewards": [
      { "type": "gems", "amount": 100 },
      { "type": "bonus", "identifier": "lore_unlocked", "description": "Lore du monstre débloqué" }
    ],
    "unlockedFeatures": ["lore", "drop_list", "advanced_stats"]
  },
  "timestamp": "2025-01-20T16:00:00Z",
  "animation": "level_up"
}
```

#### Reward claimed
**Event:** `bestiary:reward_claimed`

#### Group completion
**Event:** `bestiary:group_completion`

#### Full completion
**Event:** `bestiary:full_completion`

#### Personal record
**Event:** `bestiary:personal_record`

#### Stats update (silent)
**Event:** `bestiary:stats_update`

---

## Exemples d'intégration Unity

### 1. Manager principal du Bestiaire

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;

public class BestiaryManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/bestiary";
    private string jwtToken;
    
    // Cache
    private BestiaryResponse cachedBestiary;
    private BestiaryStats cachedStats;
    
    void Start()
    {
        jwtToken = PlayerPrefs.GetString("jwt_token");
        LoadBestiary();
        LoadStats();
    }
    
    // Charger tout le bestiaire
    public IEnumerator LoadBestiary(string filter = "")
    {
        string url = baseURL;
        if (!string.IsNullOrEmpty(filter))
        {
            url += "?" + filter; // e.g., "element=Fire" or "type=boss"
        }
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            cachedBestiary = JsonUtility.FromJson<BestiaryResponse>(request.downloadHandler.text);
            
            Debug.Log($"Loaded {cachedBestiary.entries.Length} bestiary entries");
            
            // Rafraîchir l'UI
            RefreshBestiaryUI();
        }
        else
        {
            Debug.LogError("Failed to load bestiary: " + request.error);
        }
    }
    
    // Charger les statistiques
    public IEnumerator LoadStats()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/stats");
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            var response = JsonUtility.FromJson<StatsResponse>(request.downloadHandler.text);
            cachedStats = response.stats;
            
            Debug.Log($"Completion: {cachedStats.completionPercentage}%");
            UpdateStatsUI();
        }
    }
    
    // Obtenir détails d'un monstre
    public IEnumerator GetMonsterDetails(string monsterId)
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/" + monsterId);
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            var response = JsonUtility.FromJson<MonsterDetailResponse>(request.downloadHandler.text);
            DisplayMonsterDetails(response.entry);
        }
    }
    
    // Réclamer une récompense
    public IEnumerator ClaimReward(string rewardId)
    {
        string jsonBody = "{\"rewardId\":\"" + rewardId + "\"}";
        
        UnityWebRequest request = new UnityWebRequest(baseURL + "/rewards/claim", "POST");
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        request.SetRequestHeader("Content-Type", "application/json");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            var response = JsonUtility.FromJson<ClaimRewardResponse>(request.downloadHandler.text);
            
            Debug.Log($"Reward claimed: {response.reward.gems} gems!");
            
            ShowRewardPopup(response.reward);
            LoadStats(); // Refresh stats
        }
        else
        {
            Debug.LogError("Failed to claim reward: " + request.error);
        }
    }
    
    // Helpers UI
    private void RefreshBestiaryUI()
    {
        // Mettre à jour la grille de monstres
    }
    
    private void UpdateStatsUI()
    {
        // Mettre à jour les stats globales
    }
    
    private void DisplayMonsterDetails(BestiaryEntry entry)
    {
        // Afficher les détails d'un monstre
    }
    
    private void ShowRewardPopup(CompletionReward reward)
    {
        // Popup de récompense
    }
}

[System.Serializable]
public class StatsResponse
{
    public bool success;
    public BestiaryStats stats;
}

[System.Serializable]
public class MonsterDetailResponse
{
    public bool success;
    public BestiaryEntry entry;
}

[System.Serializable]
public class ClaimRewardResponse
{
    public bool success;
    public string message;
    public CompletionReward reward;
}
```

---

### 2. UI Controller pour la grille de monstres

```csharp
using UnityEngine;
using UnityEngine.UI;

public class BestiaryGridController : MonoBehaviour
{
    public GameObject monsterCardPrefab;
    public Transform gridContainer;
    public Dropdown filterDropdown;
    
    private BestiaryManager bestiaryManager;
    
    void Start()
    {
        bestiaryManager = FindObjectOfType<BestiaryManager>();
        
        // Setup filters
        filterDropdown.onValueChanged.AddListener(OnFilterChanged);
        
        LoadGrid();
    }
    
    void LoadGrid(string filter = "")
    {
        // Clear existing cards
        foreach (Transform child in gridContainer)
        {
            Destroy(child.gameObject);
        }
        
        StartCoroutine(bestiaryManager.LoadBestiary(filter));
    }
    
    void OnFilterChanged(int index)
    {
        string filter = "";
        
        switch (index)
        {
            case 0: filter = ""; break; // All
            case 1: filter = "type=normal"; break;
            case 2: filter = "type=elite"; break;
            case 3: filter = "type=boss"; break;
            case 4: filter = "isDiscovered=true"; break;
            case 5: filter = "isDiscovered=false"; break;
        }
        
        LoadGrid(filter);
    }
    
    public void CreateMonsterCard(BestiaryEntry entry)
    {
        GameObject card = Instantiate(monsterCardPrefab, gridContainer);
        MonsterCard cardScript = card.GetComponent<MonsterCard>();
        
        cardScript.Setup(entry);
    }
}
```

---

### 3. Carte de monstre individuelle

```csharp
using UnityEngine;
using UnityEngine.UI;

public class MonsterCard : MonoBehaviour
{
    public Image monsterImage;
    public Text monsterName;
    public Text progressText;
    public Image progressBar;
    public GameObject lockIcon;
    public GameObject newBadge;
    
    private BestiaryEntry entry;
    
    public void Setup(BestiaryEntry entry)
    {
        this.entry = entry;
        
        if (entry.isDiscovered)
        {
            // Monstre découvert
            monsterName.text = entry.monster.name;
            lockIcon.SetActive(false);
            
            // Charger le sprite du monstre
            LoadMonsterSprite(entry.monsterId);
            
            // Progress bar
            progressBar.fillAmount = entry.progressPercentage / 100f;
            progressText.text = $"{entry.progressionLevel} ({entry.progressPercentage}%)";
            
            // Badge si récompense en attente
            bool hasReward = entry.pendingRewards.discovery || 
                           entry.pendingRewards.novice || 
                           entry.pendingRewards.veteran || 
                           entry.pendingRewards.master;
            newBadge.SetActive(hasReward);
        }
        else
        {
            // Monstre non découvert - silhouette
            monsterName.text = "???";
            lockIcon.SetActive(true);
            monsterImage.color = Color.black;
            progressBar.fillAmount = 0;
            progressText.text = "Undiscovered";
            newBadge.SetActive(false);
        }
    }
    
    public void OnClick()
    {
        if (entry.isDiscovered)
        {
            // Ouvrir le panneau de détails
            BestiaryDetailPanel.instance.Show(entry.monsterId);
        }
        else
        {
            // Afficher message "Pas encore découvert"
            ShowTooltip("Ce monstre n'a pas encore été rencontré");
        }
    }
    
    private void LoadMonsterSprite(string monsterId)
    {
        // Charger depuis Resources ou AssetBundle
        Sprite sprite = Resources.Load<Sprite>($"Monsters/{monsterId}");
        if (sprite != null)
        {
            monsterImage.sprite = sprite;
            monsterImage.color = Color.white;
        }
    }
    
    private void ShowTooltip(string message)
    {
        // Afficher tooltip
        Debug.Log(message);
    }
}
```

---

### 4. Panneau de détails d'un monstre

```csharp
using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class BestiaryDetailPanel : MonoBehaviour
{
    public static BestiaryDetailPanel instance;
    
    public GameObject panel;
    public Image monsterImage;
    public Text monsterName;
    public Text monsterElement;
    public Text monsterType;
    
    // Stats
    public Text encountersText;
    public Text defeatsText;
    public Text winsText;
    public Text damageDealtText;
    public Text damageTakenText;
    public Text fastestKillText;
    public Text averageKillText;
    
    // Lore
    public GameObject loreSection;
    public Text loreText;
    
    // Rewards
    public GameObject rewardButtons;
    public Button claimDiscoveryBtn;
    public Button claimNoviceBtn;
    public Button claimVeteranBtn;
    public Button claimMasterBtn;
    
    private BestiaryManager bestiaryManager;
    private BestiaryEntry currentEntry;
    
    void Awake()
    {
        instance = this;
        bestiaryManager = FindObjectOfType<BestiaryManager>();
        panel.SetActive(false);
    }
    
    public void Show(string monsterId)
    {
        panel.SetActive(true);
        StartCoroutine(LoadMonsterDetails(monsterId));
    }
    
    IEnumerator LoadMonsterDetails(string monsterId)
    {
        yield return StartCoroutine(bestiaryManager.GetMonsterDetails(monsterId));
        
        // currentEntry est maintenant rempli
        DisplayDetails();
    }
    
    public void SetEntry(BestiaryEntry entry)
    {
        currentEntry = entry;
        DisplayDetails();
    }
    
    void DisplayDetails()
    {
        if (currentEntry == null) return;
        
        // Infos de base
        monsterName.text = currentEntry.monster.name;
        monsterElement.text = currentEntry.monster.element;
        monsterType.text = currentEntry.monster.type.ToUpper();
        
        // Charger image
        LoadMonsterSprite(currentEntry.monsterId);
        
        // Stats basiques (toujours visibles si découvert)
        if (currentEntry.basicStats != null)
        {
            encountersText.text = $"Rencontré: {currentEntry.basicStats.timesEncountered} fois";
            defeatsText.text = $"Vaincu: {currentEntry.basicStats.timesDefeated} fois";
            
            int winRate = currentEntry.basicStats.timesEncountered > 0 
                ? (int)((float)currentEntry.basicStats.timesDefeated / currentEntry.basicStats.timesEncountered * 100)
                : 0;
            winsText.text = $"Taux de victoire: {winRate}%";
        }
        
        // Stats complètes (Novice+)
        if (currentEntry.fullStats != null)
        {
            damageDealtText.text = $"Dégâts infligés: {FormatNumber(currentEntry.fullStats.totalDamageDealt)}";
            damageTakenText.text = $"Dégâts reçus: {FormatNumber(currentEntry.fullStats.totalDamageTaken)}";
            fastestKillText.text = $"Meilleur temps: {FormatTime(currentEntry.fullStats.fastestKillTime)}";
            averageKillText.text = $"Temps moyen: {FormatTime(currentEntry.fullStats.averageKillTime)}";
        }
        else
        {
            damageDealtText.text = "???";
            damageTakenText.text = "???";
            fastestKillText.text = "Débloquer au niveau Novice";
            averageKillText.text = "";
        }
        
        // Lore (Veteran+)
        if (currentEntry.lore != null && currentEntry.lore.unlocked)
        {
            loreSection.SetActive(true);
            loreText.text = currentEntry.lore.description;
        }
        else
        {
            loreSection.SetActive(false);
        }
        
        // Boutons de récompenses
        UpdateRewardButtons();
    }
    
    void UpdateRewardButtons()
    {
        claimDiscoveryBtn.gameObject.SetActive(currentEntry.pendingRewards.discovery);
        claimNoviceBtn.gameObject.SetActive(currentEntry.pendingRewards.novice);
        claimVeteranBtn.gameObject.SetActive(currentEntry.pendingRewards.veteran);
        claimMasterBtn.gameObject.SetActive(currentEntry.pendingRewards.master);
        
        rewardButtons.SetActive(
            currentEntry.pendingRewards.discovery ||
            currentEntry.pendingRewards.novice ||
            currentEntry.pendingRewards.veteran ||
            currentEntry.pendingRewards.master
        );
    }
    
    public void OnClaimDiscoveryReward()
    {
        StartCoroutine(bestiaryManager.ClaimReward($"{currentEntry.monsterId}_discovery"));
    }
    
    public void OnClaimNoviceReward()
    {
        StartCoroutine(bestiaryManager.ClaimReward($"{currentEntry.monsterId}_novice"));
    }
    
    public void OnClaimVeteranReward()
    {
        StartCoroutine(bestiaryManager.ClaimReward($"{currentEntry.monsterId}_veteran"));
    }
    
    public void OnClaimMasterReward()
    {
        StartCoroutine(bestiaryManager.ClaimReward($"{currentEntry.monsterId}_master"));
    }
    
    public void Close()
    {
        panel.SetActive(false);
    }
    
    // Helpers
    private string FormatNumber(long number)
    {
        if (number >= 1000000)
            return $"{number / 1000000f:F1}M";
        if (number >= 1000)
            return $"{number / 1000f:F1}K";
        return number.ToString();
    }
    
    private string FormatTime(int milliseconds)
    {
        float seconds = milliseconds / 1000f;
        return $"{seconds:F1}s";
    }
    
    private void LoadMonsterSprite(string monsterId)
    {
        Sprite sprite = Resources.Load<Sprite>($"Monsters/{monsterId}");
        if (sprite != null)
        {
            monsterImage.sprite = sprite;
        }
    }
}
```

---

### 5. WebSocket Listener pour les événements

```csharp
using UnityEngine;
using SocketIOClient;
using System;

public class BestiaryWebSocketListener : MonoBehaviour
{
    private SocketIO socket;
    private BestiaryManager bestiaryManager;
    
    void Start()
    {
        bestiaryManager = FindObjectOfType<BestiaryManager>();
        
        // Initialiser Socket.IO
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            Debug.Log("Connected to bestiary WebSocket");
            socket.Emit("bestiary:join_room");
        });
        
        // Écouter les événements
        SetupListeners();
        
        socket.ConnectAsync();
    }
    
    void SetupListeners()
    {
        // Découverte d'un nouveau monstre
        socket.On("bestiary:discovery", response =>
        {
            string json = response.GetValue<string>();
            var data = JsonUtility.FromJson<BestiaryDiscoveryEvent>(json);
            
            OnMonsterDiscovered(data.data);
        });
        
        // Level up
        socket.On("bestiary:level_up", response =>
        {
            string json = response.GetValue<string>();
            var data = JsonUtility.FromJson<BestiaryLevelUpEvent>(json);
            
            OnBestiaryLevelUp(data.data);
        });
        
        // Récompense réclamée
        socket.On("bestiary:reward_claimed", response =>
        {
            string json = response.GetValue<string>();
            var data = JsonUtility.FromJson<BestiaryRewardEvent>(json);
            
            OnRewardClaimed(data.data);
        });
        
        // Complétion d'un groupe
        socket.On("bestiary:group_completion", response =>
        {
            string json = response.GetValue<string>();
            var data = JsonUtility.FromJson<BestiaryGroupEvent>(json);
            
            OnGroupCompletion(data.data);
        });
        
        // Complétion totale (100%)
        socket.On("bestiary:full_completion", response =>
        {
            string json = response.GetValue<string>();
            var data = JsonUtility.FromJson<BestiaryFullCompletionEvent>(json);
            
            OnFullCompletion(data.data);
        });
    }
    
    void OnMonsterDiscovered(DiscoveryData data)
    {
        Debug.Log($"🎉 Nouveau monstre découvert: {data.monsterName}!");
        
        // Animation de découverte
        ShowDiscoveryPopup(data);
        
        // Son
        PlaySound("monster_discovered");
        
        // Refresh bestiary
        StartCoroutine(bestiaryManager.LoadBestiary());
    }
    
    void OnBestiaryLevelUp(LevelUpData data)
    {
        Debug.Log($"📈 {data.monsterName} est maintenant {data.newLevel}!");
        
        // Animation selon le niveau
        if (data.newLevel == "Master")
        {
            ShowMasterAnimation(data);
            PlaySound("master_achievement");
        }
        else
        {
            ShowLevelUpPopup(data);
            PlaySound("level_up");
        }
        
        // Refresh bestiary
        StartCoroutine(bestiaryManager.LoadBestiary());
    }
    
    void OnRewardClaimed(RewardData data)
    {
        Debug.Log($"💎 Récompense réclamée: {data.rewards.gems} gems!");
        
        ShowRewardClaimedPopup(data);
    }
    
    void OnGroupCompletion(GroupCompletionData data)
    {
        Debug.Log($"🏆 Groupe complété: {data.groupName}!");
        
        ShowGroupCompletionCelebration(data);
        PlaySound("achievement_unlocked");
    }
    
    void OnFullCompletion(FullCompletionData data)
    {
        Debug.Log($"🎊 BESTIAIRE COMPLETÉ À 100% !");
        
        ShowFullCompletionCelebration(data);
        PlaySound("legendary_achievement");
    }
    
    // Helpers UI
    void ShowDiscoveryPopup(DiscoveryData data)
    {
        // Créer popup de découverte
        GameObject popup = Instantiate(Resources.Load<GameObject>("UI/DiscoveryPopup"));
        popup.GetComponent<DiscoveryPopup>().Setup(data);
    }
    
    void ShowLevelUpPopup(LevelUpData data)
    {
        // Popup de level up
    }
    
    void ShowMasterAnimation(LevelUpData data)
    {
        // Animation spéciale Master
    }
    
    void ShowRewardClaimedPopup(RewardData data)
    {
        // Popup de récompense
    }
    
    void ShowGroupCompletionCelebration(GroupCompletionData data)
    {
        // Célébration de groupe
    }
    
    void ShowFullCompletionCelebration(FullCompletionData data)
    {
        // Célébration ultime
    }
    
    void PlaySound(string soundName)
    {
        AudioManager.instance?.PlaySound(soundName);
    }
    
    void OnDestroy()
    {
        socket?.DisconnectAsync();
    }
}

// Event Data Classes
[System.Serializable]
public class BestiaryDiscoveryEvent
{
    public string type;
    public DiscoveryData data;
    public string timestamp;
    public string animation;
}

[System.Serializable]
public class DiscoveryData
{
    public string monsterId;
    public string monsterName;
    public string monsterType;
    public string element;
    public Reward[] rewards;
}

[System.Serializable]
public class Reward
{
    public string type;
    public int amount;
}

[System.Serializable]
public class BestiaryLevelUpEvent
{
    public string type;
    public LevelUpData data;
    public string timestamp;
    public string animation;
}

[System.Serializable]
public class LevelUpData
{
    public string monsterId;
    public string monsterName;
    public string previousLevel;
    public string newLevel;
    public RewardDetail[] rewards;
    public string[] unlockedFeatures;
}

[System.Serializable]
public class RewardDetail
{
    public string type;
    public int amount;
    public string identifier;
    public string description;
}

[System.Serializable]
public class BestiaryRewardEvent
{
    public string type;
    public RewardData data;
}

[System.Serializable]
public class RewardData
{
    public string rewardId;
    public string rewardType;
    public RewardInfo rewards;
    public int completionPercentage;
}

[System.Serializable]
public class BestiaryGroupEvent
{
    public string type;
    public GroupCompletionData data;
}

[System.Serializable]
public class GroupCompletionData
{
    public string groupType;
    public string groupName;
    public int totalMonsters;
    public int completionPercentage;
    public string bonusUnlocked;
}

[System.Serializable]
public class BestiaryFullCompletionEvent
{
    public string type;
    public FullCompletionData data;
}

[System.Serializable]
public class FullCompletionData
{
    public string playerId;
    public string playerName;
    public string completionTime;
    public int totalMonsters;
    public FullCompletionReward rewards;
}

[System.Serializable]
public class FullCompletionReward
{
    public int gems;
    public string title;
    public string avatar;
}
```

---

### 6. Animations de découverte

```csharp
using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class DiscoveryPopup : MonoBehaviour
{
    public Image monsterImage;
    public Text monsterName;
    public Text monsterType;
    public GameObject rewardsList;
    public GameObject rewardItemPrefab;
    
    public Animation popupAnimation;
    public ParticleSystem particles;
    
    private DiscoveryData data;
    
    public void Setup(DiscoveryData data)
    {
        this.data = data;
        
        // Afficher infos
        monsterName.text = data.monsterName;
        monsterType.text = data.monsterType.ToUpper();
        
        // Charger sprite
        Sprite sprite = Resources.Load<Sprite>($"Monsters/{data.monsterId}");
        if (sprite != null)
        {
            monsterImage.sprite = sprite;
        }
        
        // Afficher récompenses
        foreach (var reward in data.rewards)
        {
            GameObject item = Instantiate(rewardItemPrefab, rewardsList.transform);
            item.GetComponent<RewardItem>().Setup(reward);
        }
        
        // Jouer animation
        StartCoroutine(PlayDiscoveryAnimation());
    }
    
    IEnumerator PlayDiscoveryAnimation()
    {
        // Fade in
        CanvasGroup canvasGroup = GetComponent<CanvasGroup>();
        canvasGroup.alpha = 0;
        
        float duration = 0.5f;
        float elapsed = 0;
        
        while (elapsed < duration)
        {
            canvasGroup.alpha = Mathf.Lerp(0, 1, elapsed / duration);
            elapsed += Time.deltaTime;
            yield return null;
        }
        
        canvasGroup.alpha = 1;
        
        // Particules
        if (particles != null)
        {
            particles.Play();
        }
        
        // Animation bounce
        popupAnimation?.Play();
        
        // Auto-close après 3 secondes
        yield return new WaitForSeconds(3f);
        Close();
    }
    
    public void Close()
    {
        StartCoroutine(FadeOutAndDestroy());
    }
    
    IEnumerator FadeOutAndDestroy()
    {
        CanvasGroup canvasGroup = GetComponent<CanvasGroup>();
        
        float duration = 0.3f;
        float elapsed = 0;
        
        while (elapsed < duration)
        {
            canvasGroup.alpha = Mathf.Lerp(1, 0, elapsed / duration);
            elapsed += Time.deltaTime;
            yield return null;
        }
        
        Destroy(gameObject);
    }
}
```

---

### 7. Panneau de statistiques globales

```csharp
using UnityEngine;
using UnityEngine.UI;

public class BestiaryStatsPanel : MonoBehaviour
{
    public Text totalDiscoveredText;
    public Text completionPercentageText;
    public Image completionProgressBar;
    
    public Text normalCountText;
    public Text eliteCountText;
    public Text bossCountText;
    
    public Text fireCountText;
    public Text waterCountText;
    public Text windCountText;
    public Text electricCountText;
    public Text lightCountText;
    public Text darkCountText;
    
    public Text totalEncountersText;
    public Text totalDefeatsText;
    public Text winRateText;
    
    private BestiaryManager bestiaryManager;
    
    void Start()
    {
        bestiaryManager = FindObjectOfType<BestiaryManager>();
        RefreshStats();
    }
    
    public void RefreshStats()
    {
        StartCoroutine(bestiaryManager.LoadStats());
    }
    
    public void UpdateUI(BestiaryStats stats)
    {
        // Complétion globale
        totalDiscoveredText.text = $"{stats.discovered} / {stats.totalMonstersInGame}";
        completionPercentageText.text = $"{stats.completionPercentage}%";
        completionProgressBar.fillAmount = stats.completionPercentage / 100f;
        
        // Par type
        normalCountText.text = $"Normal: {stats.byType.normal}";
        eliteCountText.text = $"Elite: {stats.byType.elite}";
        bossCountText.text = $"Boss: {stats.byType.boss}";
        
        // Par élément
        fireCountText.text = $"🔥 {stats.byElement.Fire}";
        waterCountText.text = $"💧 {stats.byElement.Water}";
        windCountText.text = $"💨 {stats.byElement.Wind}";
        electricCountText.text = $"⚡ {stats.byElement.Electric}";
        lightCountText.text = $"✨ {stats.byElement.Light}";
        darkCountText.text = $"🌑 {stats.byElement.Dark}";
        
        // Combat
        totalEncountersText.text = $"Rencontres: {stats.combatTotals.totalEncounters}";
        totalDefeatsText.text = $"Victoires: {stats.combatTotals.totalDefeats}";
        
        int winRate = stats.combatTotals.totalEncounters > 0
            ? (int)((float)stats.combatTotals.totalDefeats / stats.combatTotals.totalEncounters * 100)
            : 0;
        winRateText.text = $"Taux: {winRate}%";
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
| 401 | Non authentifié | Login requis |
| 404 | Monstre introuvable | Recharger bestiaire |
| 500 | Erreur serveur | Réessayer |

### Codes d'erreur métier

- `VALIDATION_ERROR` : Paramètres invalides
- `MONSTER_NOT_FOUND` : Monstre inexistant
- `REWARD_NOT_AVAILABLE` : Récompense déjà réclamée ou non débloquée
- `GET_BESTIARY_FAILED` : Erreur chargement bestiaire
- `CLAIM_REWARD_FAILED` : Erreur réclamation récompense

### Exemple de gestion

```csharp
void HandleError(string errorCode, string errorMessage)
{
    switch (errorCode)
    {
        case "MONSTER_NOT_FOUND":
            ShowPopup("Ce monstre n'existe pas");
            ReloadBestiary();
            break;
            
        case "REWARD_NOT_AVAILABLE":
            ShowPopup("Récompense déjà réclamée");
            RefreshEntry();
            break;
            
        case "AUTH_REQUIRED":
            ShowPopup("Veuillez vous reconnecter");
            RedirectToLogin();
            break;
            
        default:
            ShowPopup($"Erreur: {errorMessage}");
            break;
    }
}
```

---

## Best Practices

### À FAIRE

1. ✅ Toujours cacher les ressources avant d'afficher les popups
2. ✅ Afficher des silhouettes pour les monstres non découverts
3. ✅ Utiliser des animations fluides pour les découvertes
4. ✅ Mettre en cache le bestiaire localement
5. ✅ Gérer la déconnexion WebSocket gracieusement
6. ✅ Afficher la progression clairement (barre de progression)
7. ✅ Sons différents par niveau (Discovery, Novice, Veteran, Master)
8. ✅ Particules pour les achievements Master
9. ✅ Badge "NEW" sur les récompenses non réclamées
10. ✅ Filtres intuitifs (par élément, type, progression)

### À ÉVITER

1. ❌ Ne pas spammer les requêtes API
2. ❌ Ne pas ignorer les erreurs réseau
3. ❌ Ne pas révéler les monstres non découverts
4. ❌ Ne pas oublier de rafraîchir après une récompense
5. ❌ Ne pas faire confiance au client pour le tracking
6. ❌ Ne pas oublier les animations de célébration
7. ❌ Ne pas cacher les informations importantes
8. ❌ Ne pas négliger les feedbacks visuels

---

## Checklist d'intégration

### Phase 1 - Basique
- [ ] Afficher la grille de monstres
- [ ] Afficher silhouettes pour non-découverts
- [ ] Afficher détails d'un monstre découvert
- [ ] Afficher les statistiques globales
- [ ] Gérer les erreurs réseau

### Phase 2 - Intermédiaire
- [ ] Filtres par élément/type/progression
- [ ] Réclamer les récompenses
- [ ] Animations de découverte
- [ ] WebSocket pour notifications temps réel
- [ ] Leaderboard serveur

### Phase 3 - Avancé
- [ ] Animations par niveau (Novice/Veteran/Master)
- [ ] Particules et célébrations
- [ ] Système de cache local
- [ ] Panneau de récompenses de complétion
- [ ] Sons et musiques contextuels

---

## Progression Levels - Détails

### Undiscovered (🔒)
- **Visibilité** : Silhouette noire uniquement
- **Informations** : Aucune
- **Récompenses** : Aucune
- **Comment débloquer** : Rencontrer le monstre au combat

### Discovered (👁️)
- **Visibilité** : Nom, élément, type, apparence
- **Informations** : Times encountered, times defeated
- **Récompenses** : 10-50 gems selon type/rareté
- **Comment progresser** : Vaincre 10 fois

### Novice (🥉)
- **Visibilité** : Stats complètes de combat
- **Informations** : Dégâts, kill times, taux de victoire
- **Récompenses** : 25-100 gems
- **Comment progresser** : Vaincre 50 fois

### Veteran (🥈)
- **Visibilité** : Lore + Liste des drops
- **Informations** : Histoire du monstre, drops possibles
- **Récompenses** : 75-250 gems + Lore
- **Comment progresser** : Vaincre 100 fois

### Master (🥇)
- **Visibilité** : Tout débloqué + Titre
- **Informations** : Toutes les infos disponibles
- **Récompenses** : 150-500 gems + Bonus permanent
- **Bonus** : +5% dégâts et défense contre ce type de monstre
- **Titre** : "Slayer of [Monster Name]"

---

## Récompenses de Complétion

### Par Type
- **Tous les monstres normaux** : 1000 gems + "Normal Slayer" title
- **Tous les élites** : 2000 gems + "Elite Hunter" title
- **Tous les boss** : 3000 gems + "Boss Slayer" title + Avatar

### Par Élément
Découvrir tous les monstres d'un élément :
- **Fire** : 500 gems + +5% damage vs Fire
- **Water** : 500 gems + +5% damage vs Water
- **Wind** : 500 gems + +5% damage vs Wind
- **Electric** : 500 gems + +5% damage vs Electric
- **Light** : 500 gems + +5% damage vs Light
- **Dark** : 500 gems + +5% damage vs Dark

### Complétion 100%
- **Récompense** : 5000 gems + "Monster Hunter" title + Avatar exclusif
- **Broadcast** : Annonce serveur-wide
- **Leaderboard** : Classement permanent des premiers

---

## Support

### Documentation API complète
```
GET /api/bestiary/info
```

### Test en développement
- Utilisez la route `/api/bestiary/unlock/:monsterId` pour débloquer manuellement (admin)

**Version:** 1.0.0  
**Dernière mise à jour:** 3 octobre 2025  
**Système:** Monster Encyclopedia (Bestiary)

# 🎰 Gacha System API - Documentation Unity

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

Le système **Gacha** permet aux joueurs d'invoquer des héros en utilisant des gems ou des tickets. Le système inclut 3 types de bannières avec des taux et mécaniques différents.

### Fonctionnalités principales

- ✅ **3 bannières simultanées** : Beginner, Standard, Limited
- ✅ **Système de pity** : Légendaire garanti après X pulls
- ✅ **Rate-up heroes** : Héros focus avec taux augmentés
- ✅ **Multi-pull discount** : 10 pulls = 10% de réduction
- ✅ **Premier pull réduit** : 50-200 gems selon la bannière
- ✅ **Notifications temps réel** : WebSocket pour animations
- ✅ **Historique complet** : Tracking de tous les pulls
- ✅ **Statistiques** : Pity counter, taux de drop personnels

### Base URL

```
https://your-api-domain.com/api/gacha
```

---

## Endpoints API

### 1. 🎰 Récupérer les bannières actives

**GET** `/api/gacha/banners`

Récupère toutes les bannières actives du serveur.

#### ⚠️ Auth requise
❌ **Non** (Public) - Permet d'afficher les bannières sur l'écran de login

#### Query Parameters
Aucun

#### Réponse succès (200)

```json
{
  "message": "Active banners retrieved successfully",
  "banners": [
    {
      "bannerId": "divine_guardian_rateup_001",
      "name": "Divine Guardian Rate-Up",
      "type": "Limited",
      "description": "Limited-time banner featuring AUREON...",
      "endTime": "2025-10-14T05:46:38.098Z",
      "costs": {
        "singlePull": {
          "gems": 300,
          "tickets": 1
        },
        "multiPull": {
          "gems": 2700
        },
        "firstPullDiscount": {
          "gems": 200
        }
      },
      "rates": {
        "Common": 40,
        "Rare": 35,
        "Epic": 20,
        "Legendary": 5,
        "focusRateUp": 50
      },
      "focusHeroes": [
        {
          "heroId": "Aureon",
          "rateUpMultiplier": 2.5,
          "guaranteed": true
        }
      ],
      "bannerImage": "https://cdn.placeholder.com/banners/divine_guardian_aureon.png",
      "iconImage": "https://cdn.placeholder.com/icons/divine_guardian_icon.png",
      "tags": ["limited", "rate-up", "aureon", "light-element", "tank", "event"],
      "category": "Character",
      "timeRemaining": 1209301113,
      "pityConfig": {
        "legendaryPity": 90,
        "epicPity": 10,
        "sharedPity": false,
        "resetOnBannerEnd": true
      },
      "specialMechanics": [
        "Rate-up Heroes",
        "Milestone Rewards",
        "Limited Time"
      ],
      "recommendedFor": [
        "Featured heroes available",
        "First pull discount available"
      ]
    },
    {
      "bannerId": "beginner_blessing_001",
      "name": "Starter's Blessing",
      "type": "Beginner",
      "description": "Perfect for new adventurers!...",
      "costs": {
        "singlePull": { "gems": 150, "tickets": 1 },
        "multiPull": { "gems": 1350 },
        "firstPullDiscount": { "gems": 50 }
      },
      "rates": {
        "Common": 45,
        "Rare": 35,
        "Epic": 17,
        "Legendary": 3
      },
      "pityConfig": {
        "legendaryPity": 60,
        "epicPity": 10
      },
      "timeRemaining": 315359701079
    },
    {
      "bannerId": "standard_summon_001",
      "name": "Hero Summoning - Standard",
      "type": "Standard",
      "description": "The standard summoning pool...",
      "costs": {
        "singlePull": { "gems": 300, "tickets": 1 },
        "multiPull": { "gems": 2700 },
        "firstPullDiscount": { "gems": 150 }
      },
      "rates": {
        "Common": 50,
        "Rare": 30,
        "Epic": 15,
        "Legendary": 5
      },
      "pityConfig": {
        "legendaryPity": 90,
        "epicPity": 10
      }
    }
  ],
  "totalBanners": 3,
  "serverId": "S1",
  "authenticated": false
}
```

#### 📊 Informations importantes

**Types de bannières** :
- `"Beginner"` : Pour nouveaux joueurs, limité à 60 pulls
- `"Standard"` : Pool complet permanent
- `"Limited"` : Temporaire avec héros focus

**timeRemaining** : Millisecondes avant expiration (convertir en jours/heures)

**focusHeroes** : Héros avec taux augmentés (uniquement Limited)

---

### 2. 📊 Obtenir les taux d'une bannière

**GET** `/api/gacha/banner/rates?bannerId=beginner_blessing_001`

Obtient les détails des taux et du pity system d'une bannière.

#### ⚠️ Auth requise
❌ **Non** (Public) - Affichage transparent des taux (requis légalement)

#### Query Parameters
- `bannerId` (required) : ID de la bannière

#### Réponse succès (200)

```json
{
  "success": true,
  "bannerId": "beginner_blessing_001",
  "name": "Starter's Blessing",
  "rates": {
    "Common": 45,
    "Rare": 35,
    "Epic": 17,
    "Legendary": 3
  },
  "costs": {
    "singlePull": { "gems": 150, "tickets": 1 },
    "multiPull": { "gems": 1350 },
    "firstPullDiscount": { "gems": 50 }
  },
  "pity": {
    "legendaryPity": 60,
    "epicPity": 10
  },
  "info": {
    "guarantees": {
      "epic": "1 Epic minimum every 10 pulls",
      "legendary": "1 Legendary guaranteed after 60 pulls without one"
    },
    "multiPullBonus": "10x pull discount available",
    "focusRateUp": null,
    "specialMechanics": [
      "Reduced Pity",
      "Milestone Rewards"
    ]
  }
}
```

#### Erreurs possibles

```json
{
  "error": "Banner not found or not available on this server",
  "code": "BANNER_NOT_FOUND"
}
```

---

### 3. 🎲 Effectuer un pull

**POST** `/api/gacha/pull`

Effectue une invocation (1 ou 10 pulls).

#### ⚠️ Auth requise
✅ **Oui** (JWT Token obligatoire)

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body

```json
{
  "bannerId": "beginner_blessing_001",
  "count": 1
}
```

**Paramètres** :
- `bannerId` (string, required) : ID de la bannière
- `count` (number, required) : 1 ou 10 uniquement

#### Réponse succès (200)

```json
{
  "message": "Banner gacha pull successful",
  "results": [
    {
      "hero": {
        "id": "670a1b2c3d4e5f6a7b8c9d0e",
        "name": "Tynira",
        "role": "Support",
        "element": "Electric",
        "rarity": "Common",
        "baseStats": {
          "hp": 1200,
          "atk": 80,
          "def": 150,
          "crit": 5,
          "critDamage": 50,
          "vitesse": 80,
          "moral": 50
        },
        "spells": {
          "spell1": { "id": "heal", "level": 1 },
          "spell2": { "id": "group_heal", "level": 1 },
          "spell3": { "id": "divine_blessing", "level": 1 },
          "ultimate": { "id": "lightning_strike", "level": 1 },
          "passive": { "id": "basic_passive", "level": 1 }
        }
      },
      "rarity": "Common",
      "isNew": true,
      "fragmentsGained": 0,
      "isFocus": false
    }
  ],
  "stats": {
    "legendary": 0,
    "epic": 0,
    "rare": 0,
    "common": 1,
    "newHeroes": 1,
    "totalFragments": 0,
    "focusHeroes": 0
  },
  "cost": {
    "gems": 50
  },
  "remaining": {
    "gems": 2950,
    "tickets": 5
  },
  "pityStatus": {
    "pullsSinceLegendary": 1,
    "pullsSinceEpic": 1,
    "legendaryPityIn": 59,
    "epicPityIn": 9
  },
  "bannerInfo": {
    "bannerId": "beginner_blessing_001",
    "name": "Starter's Blessing",
    "focusHeroes": []
  },
  "specialEffects": {
    "hasPityBreak": false,
    "hasMultipleLegendary": false,
    "perfectPull": false,
    "luckyStreakCount": 0
  },
  "animations": {
    "pullType": "single",
    "hasLegendary": false,
    "hasMultipleLegendary": false,
    "perfectPull": false,
    "luckyStreak": 0,
    "pityTriggered": false
  }
}
```

#### 📊 Informations importantes

**isNew** : `true` = nouveau héros ajouté au roster, `false` = dupliqué (fragments)

**fragmentsGained** : Nombre de fragments obtenus si héros dupliqué
- Common : 5 fragments
- Rare : 10 fragments
- Epic : 15 fragments
- Legendary : 25 fragments

**pityStatus** : Compteur de pity personnalisé par bannière

**animations** : Métadonnées pour déclencher les animations Unity

#### Erreurs possibles

```json
// Gems insuffisantes
{
  "error": "Insufficient gems. Required: 300, Available: 150",
  "code": "INSUFFICIENT_RESOURCES"
}

// Bannière invalide
{
  "error": "Banner not found or not active",
  "code": "BANNER_NOT_FOUND"
}

// Joueur non trouvé
{
  "error": "Player not found on this server",
  "code": "PLAYER_NOT_FOUND"
}

// Limite atteinte (Beginner)
{
  "error": "Cannot pull on this banner",
  "code": "PULL_NOT_ALLOWED"
}
```

---

### 4. 📜 Historique des invocations

**GET** `/api/gacha/history?page=1&limit=20`

Récupère l'historique des invocations du joueur.

#### ⚠️ Auth requise
✅ **Oui**

#### Query Parameters
- `page` (number, optional) : Page (défaut: 1)
- `limit` (number, optional) : Résultats par page (1-50, défaut: 20)

#### Réponse succès (200)

```json
{
  "message": "Summon history retrieved successfully",
  "summons": [
    {
      "_id": "670a1b2c3d4e5f6a7b8c9d0e",
      "playerId": "PLAYER_abc123",
      "heroesObtained": [
        {
          "heroId": {
            "_id": "670a1b2c3d4e5f6a7b8c9d0f",
            "name": "Aureon",
            "rarity": "Legendary",
            "role": "Tank",
            "element": "Light"
          },
          "rarity": "Legendary"
        }
      ],
      "type": "Limited",
      "createdAt": "2025-09-30T10:30:00.000Z",
      "luckScore": 95,
      "summary": {
        "legendary": 1,
        "epic": 0,
        "newHeroes": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### 5. 📊 Statistiques personnelles

**GET** `/api/gacha/stats`

Récupère les statistiques gacha du joueur.

#### ⚠️ Auth requise
✅ **Oui**

#### Réponse succès (200)

```json
{
  "message": "Summon statistics retrieved successfully",
  "stats": {
    "totalSummons": 150,
    "totalSessions": 35,
    "rarityDistribution": {
      "Common": 75,
      "Rare": 45,
      "Epic": 23,
      "Legendary": 7
    },
    "commonRate": "50.00%",
    "rareRate": "30.00%",
    "epicRate": "15.33%",
    "legendaryRate": "4.67%",
    "averageLuckScore": 52,
    "bestLuckScore": 98,
    "recentActivity": {
      "lastPull": "2025-09-30T10:30:00.000Z",
      "pullsLast7Days": 25,
      "favoriteRarity": "Common"
    },
    "pityStatus": {
      "pullsSinceLegendary": 45,
      "pullsSinceEpic": 3,
      "efficiency": 87
    }
  }
}
```

---

## Modèles de données C#

### Banner Model

```csharp
[System.Serializable]
public class BannersResponse
{
    public string message;
    public Banner[] banners;
    public int totalBanners;
    public string serverId;
    public bool authenticated;
}

[System.Serializable]
public class Banner
{
    public string bannerId;
    public string name;
    public string type;              // "Beginner", "Standard", "Limited"
    public string description;
    public string endTime;            // ISO 8601 format
    public BannerCosts costs;
    public BannerRates rates;
    public FocusHero[] focusHeroes;
    public string bannerImage;
    public string iconImage;
    public string[] tags;
    public string category;
    public long timeRemaining;        // Millisecondes
    public PityConfig pityConfig;
    public string[] specialMechanics;
    public string[] recommendedFor;
}

[System.Serializable]
public class BannerCosts
{
    public PullCost singlePull;
    public PullCost multiPull;
    public PullCost firstPullDiscount;
}

[System.Serializable]
public class PullCost
{
    public int gems;
    public int tickets;
}

[System.Serializable]
public class BannerRates
{
    public float Common;
    public float Rare;
    public float Epic;
    public float Legendary;
    public float focusRateUp;         // Uniquement pour Limited
}

[System.Serializable]
public class FocusHero
{
    public string heroId;
    public float rateUpMultiplier;    // 2.5 = taux x2.5
    public bool guaranteed;
}

[System.Serializable]
public class PityConfig
{
    public int legendaryPity;         // Ex: 90 pulls
    public int epicPity;              // Ex: 10 pulls
    public bool sharedPity;
    public bool resetOnBannerEnd;
}
```

### Pull Response Model

```csharp
[System.Serializable]
public class PullResponse
{
    public string message;
    public PullResult[] results;
    public PullStats stats;
    public PullCost cost;
    public PlayerResources remaining;
    public PityStatus pityStatus;
    public BannerInfo bannerInfo;
    public SpecialEffects specialEffects;
    public AnimationData animations;
}

[System.Serializable]
public class PullResult
{
    public Hero hero;
    public string rarity;
    public bool isNew;
    public int fragmentsGained;
    public bool isFocus;
}

[System.Serializable]
public class Hero
{
    public string id;
    public string name;
    public string role;              // "Tank", "DPS Melee", "DPS Ranged", "Support"
    public string element;           // "Fire", "Water", "Wind", "Electric", "Light", "Dark"
    public string rarity;
    public HeroStats baseStats;
    public HeroSpells spells;
}

[System.Serializable]
public class HeroStats
{
    public int hp;
    public int atk;
    public int def;
    public float crit;
    public float critDamage;
    public int vitesse;
    public int moral;
    public float reductionCooldown;
    public float healthleech;
    public int healingBonus;
    public int shieldBonus;
    public int energyRegen;
}

[System.Serializable]
public class HeroSpells
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
public class PullStats
{
    public int legendary;
    public int epic;
    public int rare;
    public int common;
    public int newHeroes;
    public int totalFragments;
    public int focusHeroes;
}

[System.Serializable]
public class PlayerResources
{
    public int gems;
    public int tickets;
}

[System.Serializable]
public class PityStatus
{
    public int pullsSinceLegendary;
    public int pullsSinceEpic;
    public int legendaryPityIn;
    public int epicPityIn;
}

[System.Serializable]
public class BannerInfo
{
    public string bannerId;
    public string name;
    public string[] focusHeroes;
}

[System.Serializable]
public class SpecialEffects
{
    public bool hasPityBreak;
    public bool hasMultipleLegendary;
    public bool perfectPull;
    public int luckyStreakCount;
}

[System.Serializable]
public class AnimationData
{
    public string pullType;          // "single" ou "multi"
    public bool hasLegendary;
    public bool hasMultipleLegendary;
    public bool perfectPull;
    public int luckyStreak;
    public bool pityTriggered;
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
    Debug.Log("Connected to server");
    // S'abonner aux notifications gacha
    socket.Emit("gacha:join_room");
});

socket.ConnectAsync();
```

### Événements disponibles

#### 1. Pull result (Single)

**Event:** `gacha:pull_result`

```json
{
  "hero": {
    "id": "670a1b2c3d4e5f6a7b8c9d0e",
    "name": "Aureon",
    "rarity": "Legendary",
    "element": "Light",
    "role": "Tank"
  },
  "isNew": true,
  "fragmentsGained": 0,
  "isFocus": true,
  "bannerId": "divine_guardian_rateup_001",
  "bannerName": "Divine Guardian Rate-Up",
  "cost": { "gems": 300 },
  "pullNumber": 45
}
```

#### 2. Multi-pull result

**Event:** `gacha:multi_pull_result`

```json
{
  "bannerId": "beginner_blessing_001",
  "bannerName": "Starter's Blessing",
  "heroes": [
    {
      "hero": { ... },
      "rarity": "Epic",
      "isNew": true,
      "fragmentsGained": 0,
      "isFocus": false
    }
  ],
  "summary": {
    "legendary": 1,
    "epic": 2,
    "rare": 3,
    "common": 4
  },
  "cost": { "gems": 1350 },
  "specialEffects": {
    "hasPityBreak": false,
    "hasMultipleLegendary": false,
    "perfectPull": false
  }
}
```

#### 3. Legendary drop

**Event:** `gacha:legendary_drop`

```json
{
  "hero": {
    "id": "670a1b2c3d4e5f6a7b8c9d0e",
    "name": "Aureon",
    "rarity": "Legendary",
    "element": "Light",
    "role": "Tank"
  },
  "bannerId": "divine_guardian_rateup_001",
  "bannerName": "Divine Guardian Rate-Up",
  "isFirstTime": true,
  "isFocus": true,
  "pullsSinceLast": 45,
  "totalLegendaryCount": 7,
  "dropRate": 5
}
```

#### 4. Pity progress

**Event:** `gacha:pity_progress`

```json
{
  "bannerId": "beginner_blessing_001",
  "bannerName": "Starter's Blessing",
  "currentPulls": 55,
  "pityThreshold": 60,
  "pullsRemaining": 5,
  "pityType": "legendary",
  "progressPercentage": 91.67,
  "isSharedPity": false
}
```

#### 5. Lucky streak

**Event:** `gacha:lucky_streak`

```json
{
  "consecutiveRareDrops": 3,
  "streakType": "epic_streak",
  "recentHeroes": ["Zephyra", "Thalrik", "Glacius"],
  "probability": 0.008,
  "bonusReward": { "gems": 30 }
}
```

---

## Exemples d'intégration Unity

### 1. Afficher les bannières

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class GachaManager : MonoBehaviour
{
    [SerializeField] private string baseURL = "https://your-api.com/api/gacha";
    [SerializeField] private GameObject bannerPrefab;
    [SerializeField] private Transform bannersContainer;

    void Start()
    {
        StartCoroutine(LoadBanners());
    }

    IEnumerator LoadBanners()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/banners");
        
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            BannersResponse response = JsonUtility.FromJson<BannersResponse>(request.downloadHandler.text);
            
            foreach (Banner banner in response.banners)
            {
                DisplayBanner(banner);
            }
        }
        else
        {
            Debug.LogError($"Failed to load banners: {request.error}");
        }
    }

    void DisplayBanner(Banner banner)
    {
        GameObject bannerObj = Instantiate(bannerPrefab, bannersContainer);
        BannerUI bannerUI = bannerObj.GetComponent<BannerUI>();
        
        bannerUI.SetBanner(banner);
        bannerUI.SetTimeRemaining(banner.timeRemaining);
        bannerUI.SetCosts(banner.costs);
        bannerUI.SetRates(banner.rates);
        
        // Marquer les bannières spéciales
        if (banner.type == "Limited")
        {
            bannerUI.ShowLimitedBadge();
        }
        else if (banner.type == "Beginner")
        {
            bannerUI.ShowBeginnerBadge();
        }
    }
}
```

### 2. Timer countdown

```csharp
using UnityEngine;
using UnityEngine.UI;
using System;

public class BannerTimer : MonoBehaviour
{
    [SerializeField] private Text timerText;
    private long timeRemainingMs;
    private bool isExpired = false;

    public void SetTimeRemaining(long milliseconds)
    {
        timeRemainingMs = milliseconds;
    }

    void Update()
    {
        if (isExpired) return;

        timeRemainingMs -= (long)(Time.deltaTime * 1000);

        if (timeRemainingMs <= 0)
        {
            isExpired = true;
            timerText.text = "EXPIRED";
            OnBannerExpired();
            return;
        }

        TimeSpan timeSpan = TimeSpan.FromMilliseconds(timeRemainingMs);
        
        if (timeSpan.TotalDays >= 1)
        {
            timerText.text = $"{timeSpan.Days}d {timeSpan.Hours}h {timeSpan.Minutes}m";
        }
        else if (timeSpan.TotalHours >= 1)
        {
            timerText.text = $"{timeSpan.Hours}h {timeSpan.Minutes}m {timeSpan.Seconds}s";
        }
        else
        {
            timerText.text = $"{timeSpan.Minutes}m {timeSpan.Seconds}s";
        }
    }

    void OnBannerExpired()
    {
        // Reload banners
        FindObjectOfType<GachaManager>().StartCoroutine(FindObjectOfType<GachaManager>().LoadBanners());
    }
}
```

### 3. Effectuer un pull

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class GachaPuller : MonoBehaviour
{
    [SerializeField] private string baseURL = "https://your-api.com/api/gacha";
    private string jwtToken;

    public IEnumerator PerformPull(string bannerId, int count)
    {
        // Créer le body JSON
        string jsonBody = JsonUtility.ToJson(new PullRequest 
        { 
            bannerId = bannerId, 
            count = count 
        });

        UnityWebRequest request = new UnityWebRequest($"{baseURL}/pull", "POST");
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            PullResponse response = JsonUtility.FromJson<PullResponse>(request.downloadHandler.text);
            
            // Mettre à jour les ressources du joueur
            UpdatePlayerResources(response.remaining);
            
            // Lancer les animations
            if (count == 1)
            {
                PlaySinglePullAnimation(response);
            }
            else
            {
                PlayMultiPullAnimation(response);
            }
            
            // Afficher les résultats
            ShowPullResults(response.results);
            
            // Mettre à jour le pity counter
            UpdatePityDisplay(response.pityStatus);
        }
        else
        {
            HandlePullError(request);
        }
    }

    void PlaySinglePullAnimation(PullResponse response)
    {
        PullResult result = response.results[0];
        
        // Déterminer le type d'animation selon la rareté
        switch (result.rarity)
        {
            case "Legendary":
                AnimationManager.Instance.PlayAnimation("LegendaryPull");
                AudioManager.Instance.PlaySound("LegendarySound");
                ParticleManager.Instance.PlayParticles("GoldenLight");
                break;
            case "Epic":
                AnimationManager.Instance.PlayAnimation("EpicPull");
                AudioManager.Instance.PlaySound("EpicSound");
                ParticleManager.Instance.PlayParticles("PurpleLight");
                break;
            default:
                AnimationManager.Instance.PlayAnimation("StandardPull");
                AudioManager.Instance.PlaySound("StandardSound");
                break;
        }

        // Effets spéciaux
        if (response.animations.pityTriggered)
        {
            ShowPityBreakEffect();
        }

        if (result.isNew)
        {
            ShowNewHeroBadge();
        }
    }

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

### 1. Récupérer les bannières actives

**GET** `/api/gacha/banners`

Récupère toutes les bannières actives du serveur.

#### Auth requise
❌ **Non** (Public) - Permet d'afficher les bannières sur l'écran de login

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
        "singlePull": { "gems": 300, "tickets": 1 },
        "multiPull": { "gems": 2700 },
        "firstPullDiscount": { "gems": 200 }
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
      "timeRemaining": 1209301113,
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

### 2. Obtenir les taux d'une bannière

**GET** `/api/gacha/banner/rates?bannerId=beginner_blessing_001`

#### Auth requise
❌ **Non** (Public)

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
    "multiPull": { "gems": 1350 }
  },
  "pity": {
    "legendaryPity": 60,
    "epicPity": 10
  }
}
```

### 3. Effectuer un pull

**POST** `/api/gacha/pull`

#### Auth requise
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
          "def": 150
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
    "common": 1
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
  }
}
```

### 4. Historique des invocations

**GET** `/api/gacha/history?page=1&limit=20`

#### Auth requise
✅ **Oui**

### 5. Statistiques personnelles

**GET** `/api/gacha/stats`

#### Auth requise
✅ **Oui**

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
    public string type;
    public string description;
    public string endTime;
    public BannerCosts costs;
    public BannerRates rates;
    public FocusHero[] focusHeroes;
    public string bannerImage;
    public string iconImage;
    public long timeRemaining;
    public PityConfig pityConfig;
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
}

[System.Serializable]
public class PityConfig
{
    public int legendaryPity;
    public int epicPity;
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
    public string role;
    public string element;
    public string rarity;
    public HeroStats baseStats;
}

[System.Serializable]
public class HeroStats
{
    public int hp;
    public int atk;
    public int def;
}

[System.Serializable]
public class PullStats
{
    public int legendary;
    public int epic;
    public int rare;
    public int common;
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
```

---

## Événements WebSocket

### Connection

```csharp
using SocketIOClient;

SocketIO socket = new SocketIO("https://your-api.com");

socket.On("connect", response =>
{
    socket.Emit("gacha:join_room");
});

socket.ConnectAsync();
```

### Événements principaux

#### Pull result
**Event:** `gacha:pull_result`

#### Multi-pull result
**Event:** `gacha:multi_pull_result`

#### Legendary drop
**Event:** `gacha:legendary_drop`

#### Pity progress
**Event:** `gacha:pity_progress`

---

## Exemples d'intégration Unity

### 1. Charger les bannières

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class GachaManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/gacha";

    IEnumerator LoadBanners()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/banners");
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            BannersResponse response = JsonUtility.FromJson<BannersResponse>(request.downloadHandler.text);
            
            foreach (Banner banner in response.banners)
            {
                DisplayBanner(banner);
            }
        }
    }

    void DisplayBanner(Banner banner)
    {
        Debug.Log("Banner: " + banner.name);
    }
}
```

### 2. Timer countdown

```csharp
using UnityEngine;
using System;

public class BannerTimer : MonoBehaviour
{
    private long timeRemainingMs;

    public void SetTimeRemaining(long milliseconds)
    {
        timeRemainingMs = milliseconds;
    }

    void Update()
    {
        if (timeRemainingMs <= 0) return;

        timeRemainingMs -= (long)(Time.deltaTime * 1000);
        TimeSpan timeSpan = TimeSpan.FromMilliseconds(timeRemainingMs);
        
        string display = string.Format("{0}d {1}h {2}m", 
            timeSpan.Days, 
            timeSpan.Hours, 
            timeSpan.Minutes
        );
        
        Debug.Log(display);
    }
}
```

### 3. Effectuer un pull

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Text;

public class GachaPuller : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/gacha";
    private string jwtToken = "YOUR_JWT_TOKEN";

    IEnumerator PerformPull(string bannerId, int count)
    {
        string jsonBody = "{\"bannerId\":\"" + bannerId + "\",\"count\":" + count + "}";
        
        UnityWebRequest request = new UnityWebRequest(baseURL + "/pull", "POST");
        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            PullResponse response = JsonUtility.FromJson<PullResponse>(request.downloadHandler.text);
            
            foreach (PullResult result in response.results)
            {
                Debug.Log("Obtained: " + result.hero.name + " (" + result.rarity + ")");
                
                if (result.isNew)
                {
                    Debug.Log("NEW HERO!");
                }
            }
            
            Debug.Log("Gems remaining: " + response.remaining.gems);
            Debug.Log("Pity counter: " + response.pityStatus.pullsSinceLegendary);
        }
        else
        {
            Debug.LogError("Pull failed: " + request.error);
        }
    }
}
```

### 4. Animations par rareté

```csharp
using UnityEngine;

public class PullAnimator : MonoBehaviour
{
    public void PlayPullAnimation(PullResult result)
    {
        switch (result.rarity)
        {
            case "Legendary":
                PlayLegendaryAnimation();
                PlaySound("legendary_sound");
                PlayParticles("golden_light");
                break;
                
            case "Epic":
                PlayEpicAnimation();
                PlaySound("epic_sound");
                PlayParticles("purple_light");
                break;
                
            case "Rare":
                PlayRareAnimation();
                PlaySound("rare_sound");
                break;
                
            default:
                PlayCommonAnimation();
                PlaySound("common_sound");
                break;
        }
    }

    void PlayLegendaryAnimation()
    {
        // Votre animation légendaire
    }

    void PlaySound(string soundName)
    {
        // Jouer le son
    }

    void PlayParticles(string particleName)
    {
        // Jouer les particules
    }
}
```

### 5. Gestion des erreurs

```csharp
using UnityEngine;

public class GachaErrorHandler : MonoBehaviour
{
    public void HandleError(string errorCode)
    {
        switch (errorCode)
        {
            case "INSUFFICIENT_RESOURCES":
                ShowPopup("Gems insuffisantes!");
                break;
                
            case "BANNER_NOT_FOUND":
                ShowPopup("Bannière expirée");
                ReloadBanners();
                break;
                
            case "PULL_NOT_ALLOWED":
                ShowPopup("Limite atteinte");
                break;
                
            default:
                ShowPopup("Une erreur est survenue");
                break;
        }
    }

    void ShowPopup(string message)
    {
        Debug.LogWarning(message);
    }

    void ReloadBanners()
    {
        // Recharger les bannières
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
| 404 | Bannière introuvable | Recharger |
| 500 | Erreur serveur | Réessayer |

### Codes d'erreur métier

- `INSUFFICIENT_RESOURCES` : Gems insuffisantes
- `BANNER_NOT_FOUND` : Bannière expirée
- `PULL_NOT_ALLOWED` : Limite atteinte
- `PLAYER_NOT_FOUND` : Joueur introuvable

---

## Best Practices

### À FAIRE

1. ✅ Toujours vérifier le statut avant pull
2. ✅ Désactiver les boutons pendant loading
3. ✅ Afficher le compteur de pity
4. ✅ Animations fluides par rareté
5. ✅ Gérer toutes les erreurs
6. ✅ Afficher timer countdown
7. ✅ Son différent par rareté
8. ✅ Particules pour Legendary
9. ✅ Cache local des bannières
10. ✅ WebSocket pour notifications

### À ÉVITER

1. ❌ Ne pas spammer les requêtes
2. ❌ Ne pas ignorer les erreurs
3. ❌ Ne pas faire confiance au client
4. ❌ Ne pas hardcoder les coûts
5. ❌ Ne pas oublier le pity display
6. ❌ Ne pas faire d'animations trop longues
7. ❌ Ne pas cacher les informations
8. ❌ Ne pas ignorer les WebSocket

---

## Checklist d'intégration

### Phase 1 - Basique
- [ ] Afficher les bannières
- [ ] Afficher les taux
- [ ] Effectuer un pull simple
- [ ] Afficher les résultats
- [ ] Mettre à jour les ressources

### Phase 2 - Intermédiaire
- [ ] Multi-pull (x10)
- [ ] Animations par rareté
- [ ] Gestion des erreurs
- [ ] Compteur de pity
- [ ] Timer countdown

### Phase 3 - Avancé
- [ ] WebSocket integration
- [ ] Animations complexes
- [ ] Collection progress
- [ ] Historique des pulls
- [ ] Statistiques

---

## Types de bannières

### Beginner Banner
- **Coût réduit** : 150 gems (vs 300)
- **Premier pull** : 50 gems seulement
- **Pity réduit** : 60 pulls (vs 90)
- **Limite** : 60 pulls maximum par joueur
- **Pool** : 15 héros équilibrés

### Standard Banner
- **Coût** : 300 gems
- **Premier pull** : 150 gems
- **Pity** : 90 pulls
- **Limite** : Aucune
- **Pool** : Tous les héros (32)

### Limited Banner
- **Coût** : 300 gems
- **Focus hero** : Aureon (x2.5 rate-up)
- **Pity** : 90 pulls
- **Durée** : 14 jours
- **Garanti** : Focus hero au premier Legendary

---

## Informations techniques

### Fragments

Quand un héros est dupliqué :
- **Common** : 5 fragments
- **Rare** : 10 fragments
- **Epic** : 15 fragments
- **Legendary** : 25 fragments

### Système de pity

- **Epic garanti** : Tous les 10 pulls
- **Legendary garanti** : Après 60-90 pulls (selon bannière)
- **Compteur indépendant** : Par bannière
- **Reset** : Après obtention du héros garanti

### Taux de drop

**Standard Banner** :
- Common : 50%
- Rare : 30%
- Epic : 15%
- Legendary : 5%

**Beginner Banner** :
- Common : 45%
- Rare : 35%
- Epic : 17%
- Legendary : 3%

**Limited Banner** :
- Common : 40%
- Rare : 35%
- Epic : 20%
- Legendary : 5%
  - Focus hero : 50% des Legendary (2.5% effectif)

---

## Support

### Documentation API complète
```
GET /api/gacha/info
```

### Test en développement
```
POST /api/gacha/test
```

**Version:** 1.0.0  
**Dernière mise à jour:** 30 septembre 2025  
**Système:** Gacha Multi-Bannières avec Pity

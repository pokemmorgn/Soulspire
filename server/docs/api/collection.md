# 📚 Collection API - Documentation pour Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Endpoints API](#endpoints-api)
3. [Modèles de données](#modèles-de-données)
4. [Événements WebSocket](#événements-websocket)
5. [Labels i18n](#labels-i18n)
6. [Exemples d'intégration Unity](#exemples-dintégration-unity)
7. [Gestion des erreurs](#gestion-des-erreurs)

---

## Vue d'ensemble

Le système **Collection** permet aux joueurs de suivre leur progression dans la collection de héros et d'obtenir des statistiques détaillées.

### Fonctionnalités principales

- ✅ **Progression globale** : Nombre de héros possédés / Total
- ✅ **Analyse par rareté** : Suivi Common/Rare/Epic/Legendary
- ✅ **Analyse par élément** : Fire/Water/Wind/Electric/Light/Dark
- ✅ **Analyse par rôle** : Tank/DPS Melee/DPS Ranged/Support
- ✅ **Héros manquants** : Liste des héros non obtenus
- ✅ **Stats d'acquisition** : Taux de doublons, pulls totaux
- ✅ **Cache intelligent** : Performances optimisées (TTL 5 min)
- ✅ **Notifications temps réel** : Progression via WebSocket

### Base URL

```
https://your-api-domain.com/api/collection
```

---

## Endpoints API

### 1. Progression de collection basique

**GET** `/api/collection`

Récupère la progression globale de collection du joueur.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Collection progress retrieved successfully",
  "collection": {
    "totalHeroes": 32,
    "ownedHeroes": 15,
    "completionPercentage": 47
  }
}
```

#### Erreurs possibles
```json
{
  "error": "Internal server error"
}
```

**Codes d'erreur :**
- `PLAYER_NOT_FOUND` : Joueur introuvable
- `UNAUTHORIZED` : Token invalide ou expiré

---

### 2. Progression détaillée par rareté

**GET** `/api/collection/detailed`

Récupère la progression détaillée avec répartition par rareté.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Detailed collection progress retrieved successfully",
  "collection": {
    "totalHeroes": 32,
    "ownedHeroes": 15,
    "completionPercentage": 47,
    "byRarity": {
      "Common": {
        "owned": 5,
        "total": 6,
        "percentage": 83
      },
      "Rare": {
        "owned": 6,
        "total": 8,
        "percentage": 75
      },
      "Epic": {
        "owned": 3,
        "total": 8,
        "percentage": 38
      },
      "Legendary": {
        "owned": 1,
        "total": 10,
        "percentage": 10
      }
    }
  }
}
```

---

### 3. Progression par élément

**GET** `/api/collection/by-element`

Récupère la progression par type d'élément.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Collection by element retrieved successfully",
  "collection": {
    "Fire": {
      "owned": 3,
      "total": 6,
      "percentage": 50
    },
    "Water": {
      "owned": 2,
      "total": 5,
      "percentage": 40
    },
    "Wind": {
      "owned": 4,
      "total": 6,
      "percentage": 67
    },
    "Electric": {
      "owned": 2,
      "total": 6,
      "percentage": 33
    },
    "Light": {
      "owned": 2,
      "total": 4,
      "percentage": 50
    },
    "Dark": {
      "owned": 2,
      "total": 5,
      "percentage": 40
    }
  }
}
```

---

### 4. Progression par rôle

**GET** `/api/collection/by-role`

Récupère la progression par rôle de combat.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Collection by role retrieved successfully",
  "collection": {
    "Tank": {
      "owned": 3,
      "total": 8,
      "percentage": 38
    },
    "DPS Melee": {
      "owned": 4,
      "total": 7,
      "percentage": 57
    },
    "DPS Ranged": {
      "owned": 4,
      "total": 9,
      "percentage": 44
    },
    "Support": {
      "owned": 4,
      "total": 8,
      "percentage": 50
    }
  }
}
```

---

### 5. Héros manquants

**GET** `/api/collection/missing?limit=20`

Obtient la liste des héros non possédés par le joueur.

#### Query Parameters
- `limit` (optionnel) : Nombre de héros à retourner (1-50), défaut = 20

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Missing heroes retrieved successfully",
  "heroes": [
    {
      "_id": "68b7466af7a2674e37894e9c",
      "name": "Ignara",
      "rarity": "Legendary",
      "element": "Fire",
      "role": "DPS Ranged"
    },
    {
      "_id": "68b7466af7a2674e37894e9d",
      "name": "Mistral",
      "rarity": "Epic",
      "element": "Wind",
      "role": "Support"
    }
  ],
  "count": 17
}
```

---

### 6. Statistiques d'acquisition

**GET** `/api/collection/stats`

Récupère les statistiques d'acquisition de héros.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Acquisition stats retrieved successfully",
  "stats": {
    "totalPulls": 45,
    "uniqueHeroesObtained": 18,
    "duplicateRate": 60,
    "currentCollectionSize": 15
  }
}
```

**Explications :**
- `totalPulls` : Nombre total d'invocations effectuées
- `uniqueHeroesObtained` : Nombre de héros uniques obtenus (incluant doublons)
- `duplicateRate` : Pourcentage de doublons (0-100%)
- `currentCollectionSize` : Nombre de héros uniques actuellement possédés

---

## Modèles de données

### Collection Progress

```csharp
[System.Serializable]
public class CollectionProgress
{
    public int totalHeroes;              // Total de héros dans le jeu
    public int ownedHeroes;              // Héros possédés par le joueur
    public int completionPercentage;     // Pourcentage de complétion (0-100)
}
```

### Rarity Progress

```csharp
[System.Serializable]
public class RarityProgress
{
    public int owned;         // Nombre possédé
    public int total;         // Total disponible
    public int percentage;    // Pourcentage (0-100)
}

[System.Serializable]
public class RarityBreakdown
{
    public RarityProgress Common;
    public RarityProgress Rare;
    public RarityProgress Epic;
    public RarityProgress Legendary;
}
```

### Element/Role Progress

```csharp
[System.Serializable]
public class ElementProgress
{
    public int owned;
    public int total;
    public int percentage;
}

// Peut être utilisé pour les éléments ou les rôles
public Dictionary<string, ElementProgress> progressByCategory;
```

### Missing Hero

```csharp
[System.Serializable]
public class MissingHero
{
    public string _id;           // ID MongoDB du héros
    public string name;          // Nom du héros
    public string rarity;        // "Common", "Rare", "Epic", "Legendary"
    public string element;       // "Fire", "Water", "Wind", "Electric", "Light", "Dark"
    public string role;          // "Tank", "DPS Melee", "DPS Ranged", "Support"
}
```

### Acquisition Stats

```csharp
[System.Serializable]
public class AcquisitionStats
{
    public int totalPulls;              // Total d'invocations
    public int uniqueHeroesObtained;    // Héros uniques obtenus
    public int duplicateRate;           // Taux de doublons (%)
    public int currentCollectionSize;   // Taille actuelle collection
}
```

### API Response Wrappers

```csharp
[System.Serializable]
public class CollectionResponse
{
    public string message;
    public CollectionProgress collection;
}

[System.Serializable]
public class DetailedCollectionResponse
{
    public string message;
    public DetailedCollection collection;
}

[System.Serializable]
public class DetailedCollection
{
    public int totalHeroes;
    public int ownedHeroes;
    public int completionPercentage;
    public RarityBreakdown byRarity;
}
```

---

## Événements WebSocket

### Connection

Se connecter aux notifications de collection :

```csharp
socket.Emit("collection:subscribe");
```

Se déconnecter :

```csharp
socket.Emit("collection:unsubscribe");
```

---

### Événements reçus (Serveur → Client)

#### 1. Nouveau héros obtenu

**Event:** `collection:new_hero`

```json
{
  "label": "COLLECTION_NEW_HERO_OBTAINED",
  "data": {
    "hero": {
      "id": "68b7466af7a2674e37894e9c",
      "name": "Ignara",
      "rarity": "Legendary",
      "element": "Fire",
      "role": "DPS Ranged"
    },
    "isFirstTime": true,
    "collectionProgress": {
      "totalHeroes": 32,
      "ownedHeroes": 16,
      "completionPercentage": 50
    }
  },
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

#### 2. Milestone de collection atteint

**Event:** `collection:milestone`

```json
{
  "label": "COLLECTION_MILESTONE_ACHIEVED",
  "data": {
    "milestone": 25,
    "milestoneType": "percentage",
    "title": "25% de la collection complétée !",
    "rewards": {
      "gems": 100,
      "gold": 10000
    },
    "nextMilestone": 50
  },
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

#### 3. Collection complète par rareté

**Event:** `collection:rarity_complete`

```json
{
  "label": "COLLECTION_RARITY_COMPLETE",
  "data": {
    "rarity": "Common",
    "completedCount": 6,
    "totalCount": 6,
    "bonusRewards": {
      "gems": 50,
      "tickets": 5
    }
  },
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

#### 4. Collection complète par élément

**Event:** `collection:element_complete`

```json
{
  "label": "COLLECTION_ELEMENT_COMPLETE",
  "data": {
    "element": "Fire",
    "completedCount": 6,
    "totalCount": 6,
    "bonusRewards": {
      "gems": 100,
      "gold": 50000
    }
  },
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

#### 5. Collection complète 100%

**Event:** `collection:complete`

```json
{
  "label": "COLLECTION_COMPLETE",
  "data": {
    "totalHeroes": 32,
    "completionDate": "2025-09-30T10:30:00.000Z",
    "specialRewards": {
      "gems": 1000,
      "gold": 100000,
      "tickets": 50,
      "specialTitle": "Master Collector"
    },
    "statistics": {
      "timeToComplete": 2592000000,
      "totalPulls": 450,
      "duplicateRate": 85
    }
  },
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

#### 6. Progression mise à jour

**Event:** `collection:progress_updated`

```json
{
  "label": "COLLECTION_PROGRESS_UPDATED",
  "data": {
    "totalHeroes": 32,
    "ownedHeroes": 15,
    "completionPercentage": 47,
    "changeType": "hero_added",
    "changedHero": {
      "name": "Zeyra",
      "rarity": "Common"
    }
  },
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

---

## Labels i18n

Tous les textes sont envoyés sous forme de **labels i18n**. Le client Unity doit les traduire localement.

### Labels principaux

```csharp
// Succès
"COLLECTION_NEW_HERO_OBTAINED" = "Nouveau héros ajouté à votre collection !"
"COLLECTION_MILESTONE_ACHIEVED" = "Palier de collection atteint : {milestone}%"
"COLLECTION_RARITY_COMPLETE" = "Collection {rarity} complète !"
"COLLECTION_ELEMENT_COMPLETE" = "Collection {element} complète !"
"COLLECTION_COMPLETE" = "Collection complète ! Félicitations !"

// Progression
"COLLECTION_PROGRESS_UPDATED" = "Collection mise à jour"
"COLLECTION_PROGRESS" = "{owned}/{total} héros ({percentage}%)"

// Erreurs
"PLAYER_NOT_FOUND" = "Joueur introuvable"
"COLLECTION_ERROR" = "Erreur lors de la récupération de la collection"

// Statut
"COLLECTION_STATUS" = "Statut de la collection"
"COLLECTION_MISSING_HEROES" = "Héros manquants"
"COLLECTION_ACQUISITION_STATS" = "Statistiques d'acquisition"

// Raretés
"RARITY_COMMON" = "Commun"
"RARITY_RARE" = "Rare"
"RARITY_EPIC" = "Épique"
"RARITY_LEGENDARY" = "Légendaire"

// Éléments
"ELEMENT_FIRE" = "Feu"
"ELEMENT_WATER" = "Eau"
"ELEMENT_WIND" = "Vent"
"ELEMENT_ELECTRIC" = "Électrique"
"ELEMENT_LIGHT" = "Lumière"
"ELEMENT_DARK" = "Ténèbres"

// Rôles
"ROLE_TANK" = "Tank"
"ROLE_DPS_MELEE" = "DPS Corps à corps"
"ROLE_DPS_RANGED" = "DPS Distance"
"ROLE_SUPPORT" = "Soutien"
```

---

## Exemples d'intégration Unity

### 1. Manager de collection

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;

public class CollectionManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/collection";
    private string jwtToken;

    // Cache local
    private CollectionProgress cachedProgress;
    private float cacheTime;
    private const float CACHE_DURATION = 300f; // 5 minutes

    public IEnumerator GetCollectionProgress(bool forceRefresh = false)
    {
        // Vérifier le cache
        if (!forceRefresh && cachedProgress != null && Time.time - cacheTime < CACHE_DURATION)
        {
            UpdateUI(cachedProgress);
            yield break;
        }

        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            CollectionResponse response = 
                JsonUtility.FromJson<CollectionResponse>(request.downloadHandler.text);
            
            cachedProgress = response.collection;
            cacheTime = Time.time;
            
            UpdateUI(cachedProgress);
        }
        else
        {
            Debug.LogError($"Failed to get collection: {request.error}");
        }
    }

    private void UpdateUI(CollectionProgress progress)
    {
        // Mettre à jour l'UI avec les données
        Debug.Log($"Collection: {progress.ownedHeroes}/{progress.totalHeroes} ({progress.completionPercentage}%)");
    }
}
```

### 2. Afficher la progression détaillée

```csharp
public class CollectionDetailedView : MonoBehaviour
{
    [System.Serializable]
    public class RarityUI
    {
        public string rarityName;
        public TMPro.TextMeshProUGUI progressText;
        public UnityEngine.UI.Slider progressBar;
    }

    public List<RarityUI> rarityUIElements;

    public IEnumerator LoadDetailedCollection()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/detailed");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            DetailedCollectionResponse response = 
                JsonUtility.FromJson<DetailedCollectionResponse>(request.downloadHandler.text);
            
            DisplayRarityBreakdown(response.collection.byRarity);
        }
    }

    private void DisplayRarityBreakdown(RarityBreakdown breakdown)
    {
        UpdateRarityUI("Common", breakdown.Common);
        UpdateRarityUI("Rare", breakdown.Rare);
        UpdateRarityUI("Epic", breakdown.Epic);
        UpdateRarityUI("Legendary", breakdown.Legendary);
    }

    private void UpdateRarityUI(string rarity, RarityProgress progress)
    {
        var ui = rarityUIElements.Find(r => r.rarityName == rarity);
        if (ui != null)
        {
            ui.progressText.text = $"{progress.owned}/{progress.total}";
            ui.progressBar.value = progress.percentage / 100f;
        }
    }
}
```

### 3. Afficher les héros manquants

```csharp
public class MissingHeroesView : MonoBehaviour
{
    public GameObject heroCardPrefab;
    public Transform contentParent;

    public IEnumerator LoadMissingHeroes(int limit = 20)
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/missing?limit={limit}");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            MissingHeroesResponse response = 
                JsonUtility.FromJson<MissingHeroesResponse>(request.downloadHandler.text);
            
            DisplayMissingHeroes(response.heroes);
        }
    }

    private void DisplayMissingHeroes(List<MissingHero> heroes)
    {
        // Nettoyer l'ancien contenu
        foreach (Transform child in contentParent)
        {
            Destroy(child.gameObject);
        }

        // Créer les cartes de héros
        foreach (var hero in heroes)
        {
            GameObject card = Instantiate(heroCardPrefab, contentParent);
            var cardComponent = card.GetComponent<HeroCard>();
            cardComponent.SetData(hero.name, hero.rarity, hero.element, hero.role);
            cardComponent.SetLocked(true); // Afficher comme non obtenu
        }
    }
}
```

### 4. Gérer les WebSocket

```csharp
using SocketIOClient;

public class CollectionWebSocket : MonoBehaviour
{
    private SocketIO socket;
    public CollectionManager collectionManager;

    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            socket.Emit("collection:subscribe");
        });

        socket.On("collection:new_hero", response =>
        {
            var data = response.GetValue<NewHeroData>();
            ShowNewHeroPopup(data);
            
            // Rafraîchir la collection
            StartCoroutine(collectionManager.GetCollectionProgress(true));
        });

        socket.On("collection:milestone", response =>
        {
            var data = response.GetValue<MilestoneData>();
            ShowMilestonePopup(data);
        });

        socket.On("collection:rarity_complete", response =>
        {
            var data = response.GetValue<RarityCompleteData>();
            ShowRarityCompletePopup(data);
        });

        socket.On("collection:complete", response =>
        {
            var data = response.GetValue<CollectionCompleteData>();
            ShowCollectionCompletePopup(data);
        });

        socket.ConnectAsync();
    }

    private void ShowNewHeroPopup(NewHeroData data)
    {
        Debug.Log($"Nouveau héros obtenu : {data.hero.name}");
        // Afficher popup animée
    }
}
```

### 5. Afficher les statistiques d'acquisition

```csharp
public class CollectionStatsView : MonoBehaviour
{
    public TMPro.TextMeshProUGUI totalPullsText;
    public TMPro.TextMeshProUGUI uniqueHeroesText;
    public TMPro.TextMeshProUGUI duplicateRateText;
    public UnityEngine.UI.Slider duplicateBar;

    public IEnumerator LoadAcquisitionStats()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/stats");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            AcquisitionStatsResponse response = 
                JsonUtility.FromJson<AcquisitionStatsResponse>(request.downloadHandler.text);
            
            DisplayStats(response.stats);
        }
    }

    private void DisplayStats(AcquisitionStats stats)
    {
        totalPullsText.text = $"Total de pulls : {stats.totalPulls}";
        uniqueHeroesText.text = $"Héros uniques : {stats.uniqueHeroesObtained}";
        duplicateRateText.text = $"Taux de doublons : {stats.duplicateRate}%";
        duplicateBar.value = stats.duplicateRate / 100f;
        
        // Changer la couleur selon le taux
        Color barColor = stats.duplicateRate < 30 ? Color.green :
                        stats.duplicateRate < 60 ? Color.yellow : Color.red;
        duplicateBar.fillRect.GetComponent<UnityEngine.UI.Image>().color = barColor;
    }
}
```

### 6. Visualisation circulaire de progression

```csharp
public class CollectionCircleView : MonoBehaviour
{
    public UnityEngine.UI.Image progressCircle;
    public TMPro.TextMeshProUGUI percentageText;
    
    public void UpdateProgress(CollectionProgress progress)
    {
        float fillAmount = progress.completionPercentage / 100f;
        progressCircle.fillAmount = fillAmount;
        percentageText.text = $"{progress.completionPercentage}%";
        
        // Animer le remplissage
        StartCoroutine(AnimateProgress(fillAmount));
    }

    private IEnumerator AnimateProgress(float targetFill)
    {
        float currentFill = progressCircle.fillAmount;
        float duration = 1f;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            progressCircle.fillAmount = Mathf.Lerp(currentFill, targetFill, elapsed / duration);
            yield return null;
        }

        progressCircle.fillAmount = targetFill;
    }
}
```

---

## Gestion des erreurs

### Codes d'erreur HTTP

| Code | Signification | Action recommandée |
|------|--------------|-------------------|
| 200 | Succès | Traiter la réponse normalement |
| 400 | Requête invalide | Vérifier les paramètres |
| 401 | Non authentifié | Redemander le login |
| 404 | Route introuvable | Vérifier l'URL |
| 500 | Erreur serveur | Afficher message d'erreur générique |

### Gestion des erreurs métier

```csharp
public void HandleCollectionError(string errorMessage)
{
    if (errorMessage.Contains("PLAYER_NOT_FOUND"))
    {
        // Redemander le login
        AuthManager.Instance.Logout();
    }
    else if (errorMessage.Contains("UNAUTHORIZED"))
    {
        // Token expiré, rafraîchir
        StartCoroutine(AuthManager.Instance.RefreshToken());
    }
    else
    {
        // Erreur générique
        ShowError("Impossible de charger la collection");
    }
}
```

### Retry Logic avec cache

```csharp
public IEnumerator LoadCollectionWithRetry(int maxRetries = 3)
{
    int attempts = 0;
    
    while (attempts < maxRetries)
    {
        yield return GetCollectionProgress();
        
        if (cachedProgress != null)
        {
            yield break; // Succès
        }
        
        attempts++;
        yield return new WaitForSeconds(Mathf.Pow(2, attempts)); // Backoff
    }
    
    // Utiliser les données en cache si disponibles
    if (cachedProgress != null)
    {
        UpdateUI(cachedProgress);
        ShowWarning("Affichage des données en cache");
    }
    else
    {
        ShowError("Impossible de charger la collection");
    }
}
```

---

## Best Practices

### ✅ À faire

1. **Utiliser le cache local** pour éviter les requêtes répétées
2. **Rafraîchir après gacha** : Toujours update après un pull réussi
3. **Afficher visuellement** la progression (barres, cercles, grilles)
4. **Célébrer les milestones** avec des animations
5. **WebSocket pour temps réel** : Notifications instantanées
6. **Précharger les données** au lancement de l'écran collection
7. **Pagination intelligente** pour les héros manquants (50 max)

### ❌ À éviter

1. Ne **jamais modifier** les données de collection côté client
2. Ne **jamais spammer** l'API (respecter le cache)
3. Ne pas charger **tous** les héros manquants d'un coup (limiter à 20-50)
4. Ne pas bloquer l'UI pendant le chargement (async + loading)
5. Ne pas oublier de **se désabonner** des WebSocket en OnDestroy

---

## Intégration avec le système Gacha

### Mise à jour après un pull

```csharp
public class GachaManager : MonoBehaviour
{
    public CollectionManager collectionManager;

    public IEnumerator PerformPull()
    {
        // Effectuer le pull gacha
        yield return GachaService.Pull();
        
        // ✅ Rafraîchir la collection (invalider le cache)
        yield return collectionManager.GetCollectionProgress(forceRefresh: true);
    }
}
```

### Afficher la progression dans l'écran gacha

```csharp
public class GachaScreen : MonoBehaviour
{
    public TMPro.TextMeshProUGUI collectionText;

    void OnEnable()
    {
        StartCoroutine(UpdateCollectionDisplay());
    }

    private IEnumerator UpdateCollectionDisplay()
    {
        yield return collectionManager.GetCollectionProgress();
        
        if (cachedProgress != null)
        {
            collectionText.text = $"Collection: {cachedProgress.ownedHeroes}/{cachedProgress.totalHeroes}";
        }
    }
}
```

---

## Performances et Optimisation

### Cache côté client

```csharp
// Garder le cache pendant 5 minutes
private const float CACHE_DURATION = 300f;
private CollectionProgress cachedData;
private float lastCacheTime;

public bool IsCacheValid()
{
    return cachedData != null && (Time.time - lastCacheTime) < CACHE_DURATION;
}
```

### Préchargement asynchrone

```csharp
void Awake()
{
    // Précharger en arrière-plan
    StartCoroutine(PreloadCollectionData());
}

private IEnumerator PreloadCollectionData()
{
    yield return new WaitForSeconds(2f); // Attendre le chargement initial
    yield return GetCollectionProgress();
}
```

---

**Version:** 1.0.0  
**Dernière mise à jour:** 30 septembre 2025  
**Auteur:** Soulspire Development Team

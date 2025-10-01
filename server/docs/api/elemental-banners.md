# 🔮 Elemental Banners API - Documentation pour Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Endpoints API](#endpoints-api)
3. [Modèles de données](#modèles-de-données)
4. [Événements WebSocket](#événements-websocket)
5. [Labels i18n](#labels-i18n)
6. [Exemples d'intégration Unity](#exemples-dintégration-unity)
7. [Gestion des erreurs](#gestion-des-erreurs)
8. [Best Practices](#best-practices)

---

## Vue d'ensemble

Le système **Elemental Banners** permet aux joueurs d'invoquer des héros spécifiques à un élément en utilisant des tickets élémentaires obtenus via les pulls normaux. Le système inclut une rotation hebdomadaire, un pity réduit, et des wishlists élémentaires.

### Fonctionnalités principales

- ✅ **6 bannières élémentaires** : Fire, Water, Wind, Electric, Light, Shadow
- ✅ **Rotation quotidienne** : Un élément différent chaque jour
- ✅ **Tickets élémentaires** : Drop automatique (5% → 15% le vendredi)
- ✅ **Pity réduit** : 50 pulls pour Legendary (vs 90 normal)
- ✅ **Wishlist élémentaire** : 4 héros max, pity garanti à 100 pulls
- ✅ **Boutique vendredi** : Packs de tickets au lieu de pulls
- ✅ **Dimanche spécial** : Tous les éléments disponibles
- ✅ **Notifications temps réel** : WebSocket pour rotation et drops

### Planning hebdomadaire

| Jour | Élément(s) actif(s) | Spécial |
|------|---------------------|---------|
| **Lundi** | 🔥 Fire | - |
| **Mardi** | ⚡ Electric | - |
| **Mercredi** | 💨 Wind | - |
| **Jeudi** | 💧 Water | - |
| **Vendredi** | 🛒 Boutique | Drop boost 15% |
| **Samedi** | ✨ Light + 🌑 Shadow | Double bannière |
| **Dimanche** | 🌈 TOUS | Accès complet |

### Base URL

```
https://your-api-domain.com/api/gacha/elemental
```

---

## Endpoints API

### 1. Obtenir la rotation actuelle

**GET** `/api/gacha/elemental/rotation`

Récupère la rotation hebdomadaire en cours.

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "rotation": {
    "day": "monday",
    "dayNumber": 1,
    "activeElements": ["Fire"],
    "activeBanners": ["elemental_fire"],
    "shopOpen": false,
    "nextRotation": "2025-10-02T00:00:00.000Z",
    "weekNumber": 40
  },
  "schedule": [
    {
      "day": "Monday",
      "elements": ["Fire"],
      "shopOpen": false
    },
    {
      "day": "Tuesday",
      "elements": ["Electric"],
      "shopOpen": false
    }
  ]
}
```

---

### 2. Obtenir les bannières actives aujourd'hui

**GET** `/api/gacha/elemental/banners`

Récupère les bannières élémentaires disponibles aujourd'hui selon la rotation.

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "banners": [
    {
      "bannerId": "elemental_fire",
      "name": "Fire Elemental Summon",
      "element": "Fire",
      "description": "Summon Fire element heroes using Fire tickets!",
      "ticketCost": 1,
      "rates": {
        "Common": 35.5,
        "Rare": 36,
        "Epic": 24,
        "Legendary": 4.5
      },
      "pityConfig": {
        "legendaryPity": 50,
        "epicPity": 0
      },
      "heroPool": {
        "includeAll": false,
        "specificHeroes": ["hero_id_1", "hero_id_2"],
        "rarityFilters": []
      },
      "bannerImage": "https://cdn.placeholder.com/banners/elemental_fire.png",
      "iconImage": "https://cdn.placeholder.com/icons/elemental_fire_icon.png"
    }
  ],
  "rotation": {
    "day": "monday",
    "activeElements": ["Fire"],
    "shopOpen": false,
    "nextRotation": "2025-10-02T00:00:00.000Z"
  },
  "message": "1 elemental banner(s) active today"
}
```

#### Vendredi (Boutique ouverte)

```json
{
  "success": true,
  "banners": [],
  "rotation": {
    "day": "friday",
    "activeElements": [],
    "shopOpen": true,
    "nextRotation": "2025-10-06T00:00:00.000Z"
  },
  "message": "Elemental shop is open today (Friday)"
}
```

---

### 3. Obtenir toutes les bannières élémentaires

**GET** `/api/gacha/elemental/banners/all`

Récupère TOUTES les bannières élémentaires, peu importe la rotation.

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "banners": [
    {
      "bannerId": "elemental_fire",
      "name": "Fire Elemental Summon",
      "element": "Fire",
      "ticketCost": 1,
      "rates": { "Common": 35.5, "Rare": 36, "Epic": 24, "Legendary": 4.5 },
      "pityConfig": { "legendaryPity": 50, "epicPity": 0 }
    },
    {
      "bannerId": "elemental_water",
      "name": "Water Elemental Summon",
      "element": "Water",
      "ticketCost": 1,
      "rates": { "Common": 35.5, "Rare": 36, "Epic": 24, "Legendary": 4.5 },
      "pityConfig": { "legendaryPity": 50, "epicPity": 0 }
    }
  ],
  "totalBanners": 6,
  "currentRotation": {
    "day": "monday",
    "activeElements": ["Fire"],
    "shopOpen": false
  }
}
```

---

### 4. Obtenir une bannière élémentaire spécifique

**GET** `/api/gacha/elemental/banner/:element`

Récupère les détails d'une bannière élémentaire par son élément.

#### Paramètres URL
- `element` : Fire, Water, Wind, Electric, Light, Shadow

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "banner": {
    "bannerId": "elemental_fire",
    "name": "Fire Elemental Summon",
    "element": "Fire",
    "description": "Summon Fire heroes with guaranteed element!",
    "ticketCost": 1,
    "rates": {
      "Common": 35.5,
      "Rare": 36,
      "Epic": 24,
      "Legendary": 4.5
    },
    "pityConfig": {
      "legendaryPity": 50,
      "epicPity": 0
    },
    "heroPool": {
      "specificHeroes": ["hero_id_1", "hero_id_2"]
    }
  },
  "isActiveToday": true,
  "message": "Fire banner is active today"
}
```

#### Erreurs possibles

```json
{
  "success": false,
  "error": "Invalid element: Earth. Valid: Fire, Water, Wind, Electric, Light, Shadow",
  "code": "INVALID_ELEMENT"
}
```

---

### 5. Obtenir les tickets élémentaires du joueur

**GET** `/api/gacha/elemental/tickets`

Récupère les tickets élémentaires disponibles pour le joueur.

#### Auth requise
✅ **Oui** (JWT Token obligatoire)

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)

```json
{
  "success": true,
  "tickets": {
    "fire": 5,
    "water": 3,
    "wind": 0,
    "electric": 2,
    "light": 1,
    "shadow": 0
  },
  "total": 11
}
```

---

### 6. Effectuer un pull élémentaire

**POST** `/api/gacha/elemental/pull`

Effectue un pull sur une bannière élémentaire avec des tickets.

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
  "element": "Fire",
  "count": 1
}
```

- `element` : Fire, Water, Wind, Electric, Light, Shadow
- `count` : 1 ou 10 (single/multi pull)

#### Réponse succès (200)

```json
{
  "success": true,
  "results": [
    {
      "hero": {
        "id": "670a1b2c3d4e5f6a7b8c9d0e",
        "name": "Ignis",
        "role": "DPS",
        "element": "Fire",
        "rarity": "Legendary",
        "baseStats": {
          "hp": 2500,
          "atk": 350,
          "def": 180
        }
      },
      "rarity": "Legendary",
      "isNew": true,
      "isDuplicate": false,
      "isPityTriggered": false,
      "isWishlistPity": false,
      "pullNumber": 1
    }
  ],
  "stats": {
    "legendary": 1,
    "epic": 0,
    "rare": 0,
    "common": 0,
    "newHeroes": 1,
    "totalFragments": 0,
    "focusHeroes": 0
  },
  "cost": {},
  "remaining": {
    "gems": 50000,
    "tickets": 100
  },
  "pityStatus": {
    "pullsSinceLegendary": 0,
    "pullsSinceEpic": 0,
    "legendaryPityIn": 50,
    "epicPityIn": 0
  },
  "bannerInfo": {
    "bannerId": "elemental_fire",
    "name": "Fire Elemental Summon",
    "focusHeroes": []
  },
  "specialEffects": {
    "hasPityBreak": false,
    "hasMultipleLegendary": false,
    "perfectPull": false,
    "luckyStreakCount": 0
  },
  "notifications": {
    "hasLegendary": true,
    "hasUltraRare": false,
    "hasLuckyStreak": false,
    "hasPityTrigger": false,
    "hasNewHero": true,
    "hasCollectionProgress": true
  }
}
```

#### Erreurs possibles

```json
{
  "success": false,
  "error": "Fire elemental banner is not active today",
  "code": "BANNER_NOT_ACTIVE_TODAY"
}
```

```json
{
  "success": false,
  "error": "Insufficient Fire tickets. Required: 10, Available: 3",
  "code": "INSUFFICIENT_TICKETS"
}
```

**Codes d'erreur :**
- `INVALID_ELEMENT` : Élément invalide
- `INVALID_COUNT` : Count doit être 1 ou 10
- `BANNER_NOT_ACTIVE_TODAY` : Bannière pas disponible aujourd'hui
- `INSUFFICIENT_TICKETS` : Pas assez de tickets
- `PLAYER_NOT_FOUND` : Joueur introuvable
- `BANNER_NOT_FOUND` : Bannière introuvable

---

### 7. Obtenir le planning de rotation

**GET** `/api/gacha/elemental/schedule?days=7`

Obtient le planning des rotations pour les X prochains jours.

#### Query Parameters
- `days` (optionnel) : Nombre de jours (1-30), défaut = 7

#### Auth requise
❌ **Non** (Public)

#### Réponse succès (200)

```json
{
  "success": true,
  "schedule": [
    {
      "date": "2025-10-01T00:00:00.000Z",
      "day": "monday",
      "elements": ["Fire"],
      "shopOpen": false
    },
    {
      "date": "2025-10-02T00:00:00.000Z",
      "day": "tuesday",
      "elements": ["Electric"],
      "shopOpen": false
    },
    {
      "date": "2025-10-04T00:00:00.000Z",
      "day": "friday",
      "elements": [],
      "shopOpen": true
    },
    {
      "date": "2025-10-06T00:00:00.000Z",
      "day": "sunday",
      "elements": ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"],
      "shopOpen": false
    }
  ],
  "totalDays": 7
}
```

---

## Modèles de données

### Elemental Rotation

```csharp
[System.Serializable]
public class ElementalRotation
{
    public string day;                  // "monday", "tuesday", etc.
    public int dayNumber;               // 0-6 (0 = dimanche)
    public string[] activeElements;     // ["Fire"], ["Light", "Shadow"], etc.
    public string[] activeBanners;      // ["elemental_fire"], etc.
    public bool shopOpen;               // true le vendredi
    public string nextRotation;         // ISO timestamp
    public int weekNumber;              // Numéro de semaine
}

[System.Serializable]
public class RotationResponse
{
    public bool success;
    public ElementalRotation rotation;
    public WeeklySchedule[] schedule;
}

[System.Serializable]
public class WeeklySchedule
{
    public string day;                  // "Monday", "Tuesday", etc.
    public string[] elements;
    public bool shopOpen;
}
```

### Elemental Banner

```csharp
[System.Serializable]
public class ElementalBanner
{
    public string bannerId;             // "elemental_fire"
    public string name;                 // "Fire Elemental Summon"
    public string element;              // "Fire"
    public string description;
    public int ticketCost;              // Toujours 1
    public BannerRates rates;
    public PityConfig pityConfig;
    public HeroPool heroPool;
    public string bannerImage;
    public string iconImage;
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
    public int legendaryPity;           // 50 pour bannières élémentaires
    public int epicPity;                // 0 (non utilisé)
}

[System.Serializable]
public class HeroPool
{
    public bool includeAll;
    public string[] specificHeroes;
    public string[] rarityFilters;
}
```

### Elemental Tickets

```csharp
[System.Serializable]
public class ElementalTickets
{
    public int fire;
    public int water;
    public int wind;
    public int electric;
    public int light;
    public int shadow;
    
    public int GetTotal()
    {
        return fire + water + wind + electric + light + shadow;
    }
    
    public int GetTickets(string element)
    {
        switch (element.ToLower())
        {
            case "fire": return fire;
            case "water": return water;
            case "wind": return wind;
            case "electric": return electric;
            case "light": return light;
            case "shadow": return shadow;
            default: return 0;
        }
    }
}

[System.Serializable]
public class ElementalTicketsResponse
{
    public bool success;
    public ElementalTickets tickets;
    public int total;
}
```

### Elemental Pull Result

```csharp
[System.Serializable]
public class ElementalPullResponse
{
    public bool success;
    public ElementalPullResult[] results;
    public PullStats stats;
    public object cost;                 // Vide (pas de gems/tickets normaux)
    public PlayerResources remaining;
    public PityStatus pityStatus;
    public BannerInfo bannerInfo;
    public SpecialEffects specialEffects;
    public PullNotifications notifications;
}

[System.Serializable]
public class ElementalPullResult
{
    public Hero hero;
    public string rarity;
    public bool isNew;
    public bool isDuplicate;
    public bool isPityTriggered;
    public bool isWishlistPity;         // ✨ Nouveau : wishlist élémentaire
    public int pullNumber;
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
public class PityStatus
{
    public int pullsSinceLegendary;
    public int pullsSinceEpic;
    public int legendaryPityIn;
    public int epicPityIn;
}

[System.Serializable]
public class SpecialEffects
{
    public bool hasPityBreak;
    public bool hasMultipleLegendary;
    public bool perfectPull;
    public int luckyStreakCount;
}
```

### Elemental Wishlist

```csharp
[System.Serializable]
public class ElementalWishlist
{
    public string element;              // "Fire", "Water", etc.
    public int heroCount;
    public int maxHeroes;               // Toujours 4
    public int pityCounter;
    public int pityThreshold;           // Toujours 100
    public WishlistHero[] heroes;
}

[System.Serializable]
public class WishlistHero
{
    public string heroId;
    public HeroData heroData;
    public string addedAt;              // ISO timestamp
}

[System.Serializable]
public class HeroData
{
    public string name;
    public string rarity;
    public string element;
    public string role;
}

[System.Serializable]
public class ElementalWishlistsResponse
{
    public bool success;
    public ElementalWishlist[] wishlists;
}
```

---

## Événements WebSocket

### Connection

Se connecter aux notifications élémentaires :

```csharp
socket.Emit("gacha:join_room");
```

### Événements reçus (Serveur → Client)

#### 1. Rotation changée

**Event:** `elemental:rotation_changed`

```json
{
  "day": "tuesday",
  "activeElements": ["Electric"],
  "shopOpen": false,
  "nextRotation": "2025-10-03T00:00:00.000Z"
}
```

#### 2. Boutique ouverte (Vendredi)

**Event:** `elemental:shop_opened`

```json
{
  "duration": 24,
  "specialOffers": true,
  "nextRotation": "2025-10-06T00:00:00.000Z"
}
```

#### 3. Drop boost actif (Vendredi)

**Event:** `elemental:drop_boost_active`

```json
{
  "dropRate": 0.15,
  "normalRate": 0.05,
  "multiplier": 3,
  "expiresAt": "2025-10-05T23:59:59.000Z"
}
```

#### 4. Rappel dimanche

**Event:** `elemental:sunday_reminder`

```json
{
  "hoursUntil": 18,
  "message": "All elemental banners available tomorrow!",
  "availableElements": ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"]
}
```

#### 5. Ticket élémentaire obtenu

**Event:** `elemental:ticket_dropped`

```json
{
  "element": "Fire",
  "quantity": 1,
  "newTotal": 6,
  "dropRate": 0.05,
  "fromBanner": "standard_summon_001"
}
```

#### 6. Wishlist élémentaire mise à jour

**Event:** `elemental:wishlist_updated`

```json
{
  "element": "Fire",
  "heroes": ["hero_id_1", "hero_id_2", "hero_id_3"],
  "heroCount": 3,
  "maxHeroes": 4
}
```

#### 7. Pity proche du seuil

**Event:** `elemental:pity_milestone`

```json
{
  "element": "Fire",
  "pityType": "legendary",
  "currentPulls": 45,
  "threshold": 50,
  "pullsRemaining": 5
}
```

---

## Labels i18n

Tous les textes sont envoyés sous forme de **labels i18n**. Le client Unity doit les traduire localement.

### Labels rotation

```csharp
// Jours de la semaine
"ELEMENTAL_DAY_MONDAY" = "Lundi - Fire"
"ELEMENTAL_DAY_TUESDAY" = "Mardi - Electric"
"ELEMENTAL_DAY_WEDNESDAY" = "Mercredi - Wind"
"ELEMENTAL_DAY_THURSDAY" = "Jeudi - Water"
"ELEMENTAL_DAY_FRIDAY" = "Vendredi - Boutique"
"ELEMENTAL_DAY_SATURDAY" = "Samedi - Light & Shadow"
"ELEMENTAL_DAY_SUNDAY" = "Dimanche - Tous les éléments"

// Messages rotation
"ELEMENTAL_ROTATION_CHANGED" = "Nouvelle rotation : {element}"
"ELEMENTAL_SHOP_OPENED" = "Boutique élémentaire ouverte !"
"ELEMENTAL_ALL_AVAILABLE" = "Tous les éléments disponibles aujourd'hui !"
```

### Labels tickets

```csharp
// Tickets obtenus
"ELEMENTAL_TICKET_DROPPED" = "Ticket {element} obtenu !"
"ELEMENTAL_TICKET_MULTI_DROPPED" = "{count} tickets {element} obtenus !"
"ELEMENTAL_DROP_BOOST_ACTIVE" = "Boost de drop actif (15%) !"

// Statut tickets
"ELEMENTAL_TICKETS_INSUFFICIENT" = "Tickets {element} insuffisants"
"ELEMENTAL_TICKETS_REQUIRED" = "{count} ticket(s) {element} requis"
"ELEMENTAL_TICKETS_AVAILABLE" = "{count} ticket(s) disponible(s)"
```

### Labels bannières

```csharp
// Bannières actives
"ELEMENTAL_BANNER_ACTIVE" = "Bannière {element} active"
"ELEMENTAL_BANNER_INACTIVE" = "Bannière {element} inactive aujourd'hui"
"ELEMENTAL_BANNER_AVAILABLE_IN" = "Disponible dans {hours}h"

// Pulls
"ELEMENTAL_PULL_SUCCESS" = "Pull élémentaire réussi !"
"ELEMENTAL_PULL_LEGENDARY" = "Legendary {element} obtenu !"
"ELEMENTAL_PITY_TRIGGERED" = "Pity élémentaire déclenché !"
```

### Labels wishlist

```csharp
// Wishlist élémentaire
"ELEMENTAL_WISHLIST_CREATED" = "Wishlist {element} créée"
"ELEMENTAL_WISHLIST_UPDATED" = "Wishlist {element} mise à jour"
"ELEMENTAL_WISHLIST_FULL" = "Wishlist {element} complète (4/4)"
"ELEMENTAL_WISHLIST_PITY_CLOSE" = "Pity wishlist proche : {remaining} pulls"
"ELEMENTAL_WISHLIST_PITY_TRIGGERED" = "Pity wishlist déclenché ! Héros garanti"
```

### Éléments

```csharp
"ELEMENT_FIRE" = "Feu"
"ELEMENT_WATER" = "Eau"
"ELEMENT_WIND" = "Vent"
"ELEMENT_ELECTRIC" = "Électricité"
"ELEMENT_LIGHT" = "Lumière"
"ELEMENT_SHADOW" = "Ombre"
```

---

## Exemples d'intégration Unity

### 1. Afficher la rotation du jour

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class ElementalRotationUI : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/gacha/elemental";
    
    public IEnumerator LoadCurrentRotation()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/rotation");
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            RotationResponse response = 
                JsonUtility.FromJson<RotationResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                DisplayRotation(response.rotation);
                DisplayWeeklySchedule(response.schedule);
            }
        }
    }
    
    void DisplayRotation(ElementalRotation rotation)
    {
        string dayName = I18n.Get($"ELEMENTAL_DAY_{rotation.day.ToUpper()}");
        Debug.Log($"Today: {dayName}");
        
        if (rotation.shopOpen)
        {
            Debug.Log("🛒 Elemental Shop is open!");
            ShowShopUI();
        }
        else if (rotation.activeElements.Length > 0)
        {
            foreach (string element in rotation.activeElements)
            {
                Debug.Log($"🔮 {element} banner active");
            }
            ShowBannersUI(rotation.activeElements);
        }
    }
    
    void DisplayWeeklySchedule(WeeklySchedule[] schedule)
    {
        foreach (WeeklySchedule day in schedule)
        {
            string elementsText = day.shopOpen 
                ? "Shop Day" 
                : string.Join(", ", day.elements);
            
            Debug.Log($"{day.day}: {elementsText}");
        }
    }
}
```

### 2. Afficher les tickets élémentaires

```csharp
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using System.Collections;

public class ElementalTicketsUI : MonoBehaviour
{
    public Text fireTicketsText;
    public Text waterTicketsText;
    public Text windTicketsText;
    public Text electricTicketsText;
    public Text lightTicketsText;
    public Text shadowTicketsText;
    public Text totalTicketsText;
    
    private string baseURL = "https://your-api.com/api/gacha/elemental";
    private string jwtToken;
    
    public IEnumerator LoadPlayerTickets()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/tickets");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            ElementalTicketsResponse response = 
                JsonUtility.FromJson<ElementalTicketsResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                UpdateTicketsDisplay(response.tickets);
                totalTicketsText.text = $"Total: {response.total}";
            }
        }
    }
    
    void UpdateTicketsDisplay(ElementalTickets tickets)
    {
        fireTicketsText.text = $"🔥 {tickets.fire}";
        waterTicketsText.text = $"💧 {tickets.water}";
        windTicketsText.text = $"💨 {tickets.wind}";
        electricTicketsText.text = $"⚡ {tickets.electric}";
        lightTicketsText.text = $"✨ {tickets.light}";
        shadowTicketsText.text = $"🌑 {tickets.shadow}";
    }
}
```

### 3. Effectuer un pull élémentaire

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Text;

public class ElementalPullManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/gacha/elemental";
    private string jwtToken;
    
    public IEnumerator PerformElementalPull(string element, int count = 1)
    {
        // Vérifier que la bannière est active
        bool isActive = yield return CheckBannerActive(element);
        
        if (!isActive)
        {
            ShowError($"{element} banner not active today");
            yield break;
        }
        
        // Vérifier les tickets
        int ticketsAvailable = yield return GetTicketCount(element);
        
        if (ticketsAvailable < count)
        {
            ShowError($"Insufficient {element} tickets. Need: {count}, Have: {ticketsAvailable}");
            yield break;
        }
        
        // Effectuer le pull
        string jsonBody = $"{{\"element\":\"{element}\",\"count\":{count}}}";
        
        UnityWebRequest request = new UnityWebRequest($"{baseURL}/pull", "POST");
        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        request.SetRequestHeader("Content-Type", "application/json");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            ElementalPullResponse response = 
                JsonUtility.FromJson<ElementalPullResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                // Afficher les résultats avec animations
                foreach (ElementalPullResult result in response.results)
                {
                    PlayPullAnimation(result, element);
                    yield return new WaitForSeconds(1.5f);
                    
                    if (result.isWishlistPity)
                    {
                        ShowWishlistPityPopup(result.hero);
                    }
                    else if (result.isPityTriggered)
                    {
                        ShowPityPopup(result.hero);
                    }
                    else if (result.rarity == "Legendary")
                    {
                        ShowLegendaryPopup(result.hero);
                    }
                }
                
                // Afficher les stats
                ShowPullSummary(response.stats, response.pityStatus);
                
                // Mettre à jour l'UI des tickets
                UpdateTicketsUI(element, response.remaining);
            }
        }
        else
        {
            HandlePullError(request.error);
        }
    }
    
    IEnumerator CheckBannerActive(string element)
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/banner/{element}");
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            // Parser la réponse pour vérifier isActiveToday
            return true; // Simplification
        }
        
        return false;
    }
    
    IEnumerator GetTicketCount(string element)
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/tickets");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            ElementalTicketsResponse response = 
                JsonUtility.FromJson<ElementalTicketsResponse>(request.downloadHandler.text);
            
            return response.tickets.GetTickets(element);
        }
        
        return 0;
    }
    
    void PlayPullAnimation(ElementalPullResult result, string element)
    {
        // Animation spécifique selon la rareté et l'élément
        string animationName = GetAnimationName(result.rarity, element);
        
        if (result.isWishlistPity)
        {
            PlayWishlistAnimation();
        }
        else if (result.rarity == "Legendary")
        {
            PlayLegendaryAnimation(element);
            PlayLegendarySound();
        }
        else if (result.rarity == "Epic")
        {
            PlayEpicAnimation(element);
        }
        
        // Afficher la carte du héros
        DisplayHeroCard(result.hero, result.isNew);
    }
    
    string GetAnimationName(string rarity, string element)
    {
        return $"{element}_{rarity}_Pull";
    }
}
```

### 4. Gérer les wishlists élémentaires

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;
using System.Text;

public class ElementalWishlistManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/wishlist/elemental";
    private string jwtToken;
    
    // Récupérer toutes les wishlists élémentaires
    public IEnumerator LoadAllElementalWishlists()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL);
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            ElementalWishlistsResponse response = 
                JsonUtility.FromJson<ElementalWishlistsResponse>(request.downloadHandler.text);
            
            if (response.success && response.wishlists != null)
            {
                foreach (ElementalWishlist wishlist in response.wishlists)
                {
                    DisplayWishlist(wishlist);
                }
            }
        }
    }
    
    // Récupérer une wishlist élémentaire spécifique
    public IEnumerator LoadElementalWishlist(string element)
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/{element}");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            // Parser et afficher la wishlist
            Debug.Log($"Wishlist {element} loaded");
        }
    }
    
    // Mettre à jour une wishlist élémentaire
    public IEnumerator UpdateElementalWishlist(string element, string[] heroIds)
    {
        // Validation
        if (heroIds.Length > 4)
        {
            ShowError("Maximum 4 heroes per wishlist");
            yield break;
        }
        
        // Créer le JSON
        string heroIdsJson = "[" + string.Join(",", 
            System.Array.ConvertAll(heroIds, id => $"\"{id}\"")) + "]";
        
        string jsonBody = $"{{\"element\":\"{element}\",\"heroIds\":{heroIdsJson}}}";
        
        UnityWebRequest request = new UnityWebRequest(baseURL, "POST");
        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
        request.SetRequestHeader("Content-Type", "application/json");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            Debug.Log($"Wishlist {element} updated successfully");
            ShowSuccess($"Wishlist {element} mise à jour !");
            
            // Recharger la wishlist
            yield return LoadElementalWishlist(element);
        }
        else
        {
            ShowError($"Failed to update wishlist: {request.error}");
        }
    }
    
    // Obtenir les héros Legendary disponibles pour un élément
    public IEnumerator GetAvailableHeroes(string element)
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/available/{element}");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            AvailableHeroesResponse response = 
                JsonUtility.FromJson<AvailableHeroesResponse>(request.downloadHandler.text);
            
            if (response.success && response.heroes != null)
            {
                DisplayAvailableHeroes(response.heroes, element);
            }
        }
    }
    
    void DisplayWishlist(ElementalWishlist wishlist)
    {
        Debug.Log($"Wishlist {wishlist.element}:");
        Debug.Log($"  Heroes: {wishlist.heroCount}/{wishlist.maxHeroes}");
        Debug.Log($"  Pity: {wishlist.pityCounter}/{wishlist.pityThreshold}");
        
        // Afficher l'UI de la wishlist avec les héros
        foreach (WishlistHero hero in wishlist.heroes)
        {
            if (hero.heroData != null)
            {
                Debug.Log($"    - {hero.heroData.name} ({hero.heroData.rarity})");
            }
        }
    }
}
```

### 5. WebSocket pour notifications en temps réel

```csharp
using SocketIOClient;
using UnityEngine;
using System;

public class ElementalWebSocketManager : MonoBehaviour
{
    private SocketIO socket;
    
    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            Debug.Log("Connected to server");
            socket.Emit("gacha:join_room");
        });
        
        // Rotation changée
        socket.On("elemental:rotation_changed", response =>
        {
            var data = response.GetValue<RotationChangedData>();
            HandleRotationChanged(data);
        });
        
        // Boutique ouverte (vendredi)
        socket.On("elemental:shop_opened", response =>
        {
            var data = response.GetValue<ShopOpenedData>();
            ShowShopNotification(data);
        });
        
        // Boost de drop actif (vendredi)
        socket.On("elemental:drop_boost_active", response =>
        {
            var data = response.GetValue<DropBoostData>();
            ShowDropBoostIndicator(data);
        });
        
        // Ticket élémentaire obtenu
        socket.On("elemental:ticket_dropped", response =>
        {
            var data = response.GetValue<TicketDroppedData>();
            ShowTicketDropAnimation(data);
        });
        
        // Wishlist mise à jour
        socket.On("elemental:wishlist_updated", response =>
        {
            var data = response.GetValue<WishlistUpdatedData>();
            RefreshWishlistUI(data);
        });
        
        // Pity proche du seuil
        socket.On("elemental:pity_milestone", response =>
        {
            var data = response.GetValue<PityMilestoneData>();
            ShowPityWarning(data);
        });
        
        // Rappel dimanche
        socket.On("elemental:sunday_reminder", response =>
        {
            var data = response.GetValue<SundayReminderData>();
            ShowSundayReminder(data);
        });
        
        socket.ConnectAsync();
    }
    
    void HandleRotationChanged(RotationChangedData data)
    {
        Debug.Log($"Rotation changed to: {data.day}");
        Debug.Log($"Active elements: {string.Join(", ", data.activeElements)}");
        
        // Mettre à jour l'UI
        UpdateRotationUI(data);
        
        // Afficher une notification
        string message = data.shopOpen 
            ? "Boutique élémentaire ouverte !" 
            : $"Nouvelle rotation : {string.Join(" & ", data.activeElements)}";
        
        ShowNotification(message);
    }
    
    void ShowTicketDropAnimation(TicketDroppedData data)
    {
        Debug.Log($"Ticket {data.element} obtenu ! Total: {data.newTotal}");
        
        // Animation de ticket qui tombe
        PlayTicketDropAnimation(data.element);
        
        // Son
        PlayTicketSound();
        
        // Popup
        ShowTicketPopup(data.element, data.quantity, data.newTotal);
        
        // Mettre à jour le compteur
        UpdateTicketCounter(data.element, data.newTotal);
    }
    
    void ShowPityWarning(PityMilestoneData data)
    {
        if (data.pullsRemaining <= 5)
        {
            string message = $"{data.element} {data.pityType} pity dans {data.pullsRemaining} pulls !";
            ShowPriorityNotification(message);
        }
    }
    
    void ShowSundayReminder(SundayReminderData data)
    {
        string message = $"Dans {data.hoursUntil}h : Tous les éléments disponibles !";
        ShowTimedNotification(message, data.hoursUntil * 3600);
    }
    
    void OnDestroy()
    {
        if (socket != null)
        {
            socket.DisconnectAsync();
        }
    }
}

// Classes de données pour WebSocket
[System.Serializable]
public class RotationChangedData
{
    public string day;
    public string[] activeElements;
    public bool shopOpen;
    public string nextRotation;
}

[System.Serializable]
public class TicketDroppedData
{
    public string element;
    public int quantity;
    public int newTotal;
    public float dropRate;
    public string fromBanner;
}

[System.Serializable]
public class PityMilestoneData
{
    public string element;
    public string pityType;
    public int currentPulls;
    public int threshold;
    public int pullsRemaining;
}

[System.Serializable]
public class SundayReminderData
{
    public int hoursUntil;
    public string message;
    public string[] availableElements;
}
```

### 6. Calendrier visuel de rotation

```csharp
using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class ElementalCalendarUI : MonoBehaviour
{
    public GameObject dayPrefab;
    public Transform calendarContainer;
    
    private string baseURL = "https://your-api.com/api/gacha/elemental";
    
    public IEnumerator LoadAndDisplayCalendar(int days = 7)
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/schedule?days={days}");
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            ScheduleResponse response = 
                JsonUtility.FromJson<ScheduleResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                DisplayCalendar(response.schedule);
            }
        }
    }
    
    void DisplayCalendar(ScheduleDay[] schedule)
    {
        // Nettoyer le calendrier existant
        foreach (Transform child in calendarContainer)
        {
            Destroy(child.gameObject);
        }
        
        // Créer les jours
        foreach (ScheduleDay day in schedule)
        {
            GameObject dayObj = Instantiate(dayPrefab, calendarContainer);
            CalendarDayUI dayUI = dayObj.GetComponent<CalendarDayUI>();
            
            if (dayUI != null)
            {
                dayUI.SetupDay(day);
            }
        }
    }
}

public class CalendarDayUI : MonoBehaviour
{
    public Text dayNameText;
    public Text elementsText;
    public Image backgroundImage;
    public GameObject shopIndicator;
    
    public void SetupDay(ScheduleDay day)
    {
        // Nom du jour
        dayNameText.text = GetLocalizedDayName(day.day);
        
        // Éléments ou boutique
        if (day.shopOpen)
        {
            elementsText.text = "🛒 Shop";
            shopIndicator.SetActive(true);
            backgroundImage.color = new Color(1f, 0.8f, 0.2f); // Jaune
        }
        else if (day.elements.Length == 6)
        {
            elementsText.text = "🌈 ALL";
            backgroundImage.color = new Color(0.5f, 1f, 0.5f); // Vert
        }
        else
        {
            elementsText.text = string.Join("\n", GetElementIcons(day.elements));
            backgroundImage.color = GetElementColor(day.elements[0]);
        }
    }
    
    string GetLocalizedDayName(string day)
    {
        return I18n.Get($"ELEMENTAL_DAY_{day.ToUpper()}");
    }
    
    string[] GetElementIcons(string[] elements)
    {
        string[] icons = new string[elements.Length];
        
        for (int i = 0; i < elements.Length; i++)
        {
            icons[i] = GetElementIcon(elements[i]);
        }
        
        return icons;
    }
    
    string GetElementIcon(string element)
    {
        switch (element)
        {
            case "Fire": return "🔥";
            case "Water": return "💧";
            case "Wind": return "💨";
            case "Electric": return "⚡";
            case "Light": return "✨";
            case "Shadow": return "🌑";
            default: return "❓";
        }
    }
    
    Color GetElementColor(string element)
    {
        switch (element)
        {
            case "Fire": return new Color(1f, 0.3f, 0.2f);
            case "Water": return new Color(0.2f, 0.6f, 1f);
            case "Wind": return new Color(0.5f, 1f, 0.7f);
            case "Electric": return new Color(1f, 1f, 0.3f);
            case "Light": return new Color(1f, 1f, 1f);
            case "Shadow": return new Color(0.3f, 0.2f, 0.4f);
            default: return Color.gray;
        }
    }
}

[System.Serializable]
public class ScheduleResponse
{
    public bool success;
    public ScheduleDay[] schedule;
    public int totalDays;
}

[System.Serializable]
public class ScheduleDay
{
    public string date;
    public string day;
    public string[] elements;
    public bool shopOpen;
}
```

---

## Gestion des erreurs

### Codes d'erreur HTTP

| Code | Description | Action recommandée |
|------|-------------|-------------------|
| 200 | Succès | Traiter la réponse normalement |
| 400 | Requête invalide | Vérifier élément/paramètres |
| 401 | Non authentifié | Redemander le login |
| 404 | Bannière/ressource introuvable | Vérifier l'élément |
| 500 | Erreur serveur | Réessayer après délai |

### Codes d'erreur métier

```csharp
public class ElementalErrorHandler : MonoBehaviour
{
    public void HandleElementalError(string errorCode, string errorMessage)
    {
        switch (errorCode)
        {
            case "INVALID_ELEMENT":
                ShowError("Élément invalide. Valides : Fire, Water, Wind, Electric, Light, Shadow");
                break;
                
            case "BANNER_NOT_ACTIVE_TODAY":
                ShowError("Cette bannière n'est pas active aujourd'hui");
                ShowRotationCalendar();
                break;
                
            case "INSUFFICIENT_TICKETS":
                ShowError(errorMessage);
                ShowTicketShop();
                break;
                
            case "PLAYER_NOT_FOUND":
                // Redemander le login
                AuthManager.Instance.Logout();
                break;
                
            case "INVALID_COUNT":
                ShowError("Count doit être 1 ou 10");
                break;
                
            case "ELEMENTAL_BANNER_NOT_FOUND":
                ShowError("Bannière élémentaire introuvable");
                break;
                
            default:
                ShowError("Une erreur est survenue");
                break;
        }
    }
}
```

### Retry Logic pour pulls

```csharp
public IEnumerator PullWithRetry(string element, int count, int maxRetries = 3)
{
    int attempts = 0;
    
    while (attempts < maxRetries)
    {
        yield return PerformElementalPull(element, count);
        
        if (lastPullSuccess)
        {
            yield break; // Succès
        }
        
        attempts++;
        
        // Backoff exponentiel
        yield return new WaitForSeconds(Mathf.Pow(2, attempts));
    }
    
    ShowError("Impossible d'effectuer le pull après plusieurs tentatives");
}
```

---

## Best Practices

### ✅ À faire

1. **Vérifier la rotation** avant d'afficher les bannières
2. **Afficher le calendrier** pour aider les joueurs à planifier
3. **Notifier les drops** de tickets avec animations
4. **Utiliser WebSocket** pour la rotation en temps réel
5. **Afficher le pity** élémentaire et wishlist séparément
6. **Indicateur visuel** pour le boost vendredi (15%)
7. **Cache local** du calendrier pour réduire les requêtes
8. **Timer countdown** jusqu'à la prochaine rotation
9. **Wishlist UI** intuitive avec drag & drop
10. **Animations différentes** par élément (couleurs, effets)

### ❌ À éviter

1. Ne **jamais permettre** de pull si bannière inactive
2. Ne **jamais confondre** tickets normaux et élémentaires
3. Ne **pas cacher** le système de rotation aux joueurs
4. Ne **pas oublier** d'afficher le boost vendredi
5. Ne **pas ignorer** les wishlists élémentaires
6. Ne **pas spammer** l'API rotation (cache local)
7. Ne **pas mélanger** les pity (normal vs élémentaire)
8. Ne **pas négliger** les notifications dimanche

### 🎯 UX Recommandations

#### Indicateurs visuels

```csharp
public class ElementalUIHelper : MonoBehaviour
{
    // Couleurs par élément
    public static Color GetElementColor(string element)
    {
        switch (element)
        {
            case "Fire": return new Color(1f, 0.3f, 0.2f);      // Rouge
            case "Water": return new Color(0.2f, 0.6f, 1f);     // Bleu
            case "Wind": return new Color(0.5f, 1f, 0.7f);      // Vert clair
            case "Electric": return new Color(1f, 1f, 0.3f);    // Jaune
            case "Light": return new Color(1f, 1f, 1f);         // Blanc
            case "Shadow": return new Color(0.3f, 0.2f, 0.4f);  // Violet foncé
            default: return Color.gray;
        }
    }
    
    // Icônes par élément
    public static string GetElementIcon(string element)
    {
        Dictionary<string, string> icons = new Dictionary<string, string>
        {
            { "Fire", "🔥" },
            { "Water", "💧" },
            { "Wind", "💨" },
            { "Electric", "⚡" },
            { "Light", "✨" },
            { "Shadow", "🌑" }
        };
        
        return icons.ContainsKey(element) ? icons[element] : "❓";
    }
    
    // Badge "Active" sur les bannières
    public static void ShowActiveBadge(GameObject banner, bool isActive)
    {
        Transform badge = banner.transform.Find("ActiveBadge");
        if (badge != null)
        {
            badge.gameObject.SetActive(isActive);
        }
    }
    
    // Glow effect pour bannières actives
    public static void SetBannerGlow(Image bannerImage, bool isActive)
    {
        if (isActive)
        {
            bannerImage.material.SetFloat("_GlowIntensity", 1.5f);
        }
        else
        {
            bannerImage.material.SetFloat("_GlowIntensity", 0f);
            bannerImage.color = new Color(0.5f, 0.5f, 0.5f); // Grisé
        }
    }
}
```

#### Notifications push-like

```csharp
public class ElementalNotificationManager : MonoBehaviour
{
    public GameObject notificationPrefab;
    public Transform notificationContainer;
    
    public void ShowRotationNotification(string day, string[] elements)
    {
        string message = elements.Length == 0 
            ? "🛒 Boutique élémentaire ouverte !" 
            : $"🔮 {string.Join(" & ", elements)} disponible(s) !";
        
        ShowNotification(message, 5f);
    }
    
    public void ShowTicketDropNotification(string element, int quantity)
    {
        string icon = ElementalUIHelper.GetElementIcon(element);
        string message = $"{icon} +{quantity} ticket {element}";
        
        ShowNotification(message, 3f);
    }
    
    public void ShowPityWarningNotification(string element, int pullsRemaining)
    {
        if (pullsRemaining <= 5)
        {
            string message = $"⚠️ Pity {element} dans {pullsRemaining} pulls !";
            ShowNotification(message, 10f, Color.yellow);
        }
    }
    
    void ShowNotification(string message, float duration, Color? color = null)
    {
        GameObject notif = Instantiate(notificationPrefab, notificationContainer);
        Text notifText = notif.GetComponentInChildren<Text>();
        
        if (notifText != null)
        {
            notifText.text = message;
            
            if (color.HasValue)
            {
                notifText.color = color.Value;
            }
        }
        
        Destroy(notif, duration);
    }
}
```

---

## Checklist d'intégration

### Phase 1 - Basique (Jour 1-2)
- [ ] Afficher la rotation actuelle
- [ ] Afficher les bannières actives
- [ ] Récupérer les tickets du joueur
- [ ] Effectuer un pull simple (1x)
- [ ] Afficher les résultats

### Phase 2 - Intermédiaire (Jour 3-5)
- [ ] Multi-pull (10x)
- [ ] Calendrier de rotation (7 jours)
- [ ] WebSocket pour rotation
- [ ] Animations par élément
- [ ] Gestion des erreurs complète

### Phase 3 - Avancé (Jour 6-10)
- [ ] Wishlists élémentaires
- [ ] Notification drops de tickets
- [ ] Indicateur boost vendredi
- [ ] Pity display (normal + wishlist)
- [ ] Timer jusqu'à prochaine rotation

### Phase 4 - Polish (Jour 11-14)
- [ ] Animations complexes
- [ ] Sons par élément
- [ ] Particules élémentaires
- [ ] Stats et historique
- [ ] Optimisation performance

---

## Diagrammes de flux

### Flux d'un pull élémentaire

```
┌─────────────────────┐
│ Joueur clique Pull  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│ Vérifier rotation       │
│ Bannière active ?       │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     │  OUI      │  NON
     ▼           ▼
┌─────────┐  ┌──────────────────┐
│ Tickets │  │ Afficher erreur  │
│ OK ?    │  │ + Calendrier     │
└────┬────┘  └──────────────────┘
     │
   ┌─┴──┐
   │OUI │ NON
   ▼    ▼
┌────┐ ┌─────────────┐
│Pull│ │Afficher shop│
└─┬──┘ └─────────────┘
  │
  ▼
┌──────────────────────────┐
│ Effectuer pull serveur   │
│ - Vérifier pity élémen.  │
│ - Vérifier pity wishlist │
│ - Sélectionner héros     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Afficher résultats       │
│ - Animation élément      │
│ - Son spécifique         │
│ - Popup si Legendary     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Mettre à jour UI         │
│ - Tickets restants       │
│ - Pity counter           │
│ - Collection             │
└──────────────────────────┘
```

### Flux de rotation quotidienne

```
┌───────────────────┐
│ Minuit (00h00)    │
└─────────┬─────────┘
          │
          ▼
┌─────────────────────────────┐
│ Cron job serveur            │
│ ElementalBannerService      │
│ .performDailyRotation()     │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ Calculer nouveau jour       │
│ - Jour de la semaine        │
│ - Éléments actifs           │
│ - Shop ouvert ?             │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ Broadcast WebSocket         │
│ elemental:rotation_changed  │
└─────────┬───────────────────┘
          │
          ▼
    ┌─────┴─────┐
    │ Vendredi? │
    └─────┬─────┘
          │
      ┌───┴───┐
      │ OUI   │ NON
      ▼       ▼
┌──────────┐ ┌──────────────┐
│Shop event│ │Bannières maj │
│broadcast │ │actives       │
└──────────┘ └──────────────┘
```

---

## Support et documentation

### Liens utiles

- **Documentation API complète** : `/api/gacha/info`
- **Test endpoint** : `/api/gacha/test` (dev uniquement)
- **Health check** : `/api/daily-rewards/health`

### Webhooks de test

En développement, vous pouvez forcer une rotation :

```bash
# Forcer la rotation (admin uniquement)
curl -X POST https://your-api.com/api/admin/elemental/force-rotation \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serverId": "S1", "day": "sunday"}'
```

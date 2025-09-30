# 🎁 Daily Rewards API - Documentation pour Unity

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

Le système **Daily Rewards** permet aux joueurs de réclamer des récompenses quotidiennes pour encourager les connexions régulières.

### Fonctionnalités principales

- ✅ **Cycle de 30 jours** avec récompenses croissantes
- ✅ **Système de streak** : bonus progressifs (7j/14j/30j)
- ✅ **Bonus VIP** : +10% par niveau VIP
- ✅ **Jours spéciaux** : récompenses bonus (jours 7, 14, 21, 28, 30)
- ✅ **Reset automatique** : si 2 jours consécutifs ratés
- ✅ **Notifications temps réel** : via WebSocket
- ✅ **Preview** : aperçu des 7 prochains jours
- ✅ **Leaderboard** : classement des meilleurs streaks

### Base URL

```
https://your-api-domain.com/api/daily-rewards
```

---

## Endpoints API

### 1. Réclamer la récompense quotidienne

**POST** `/api/daily-rewards/claim`

Réclame la récompense du jour actuel.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Réponse succès (200)
```json
{
  "success": true,
  "claim": {
    "day": 1,
    "claimDate": "2025-01-15T10:30:00.000Z",
    "rewards": [
      {
        "type": "gold",
        "quantity": 500
      },
      {
        "type": "gems",
        "quantity": 10
      }
    ],
    "vipBonus": 1.0,
    "streakBonus": 1.0,
    "totalValue": 11
  },
  "appliedRewards": {
    "gold": 500,
    "gems": 10,
    "tickets": 0,
    "items": []
  },
  "streakInfo": {
    "currentStreak": 1,
    "streakBonus": 1.0,
    "streakTier": "No Streak",
    "nextMilestone": 7
  }
}
```

#### Erreurs possibles
```json
{
  "success": false,
  "error": "DAILY_REWARD_ALREADY_CLAIMED",
  "code": "ALREADY_CLAIMED_TODAY"
}
```

**Codes d'erreur :**
- `PLAYER_NOT_FOUND` : Joueur introuvable
- `ALREADY_CLAIMED_TODAY` : Déjà réclamé aujourd'hui
- `CLAIM_FAILED` : Erreur lors du claim

---

### 2. Obtenir le statut actuel

**GET** `/api/daily-rewards/status`

Récupère le statut actuel des daily rewards du joueur.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "status": {
    "canClaim": true,
    "timeUntilNext": 0,
    "currentDay": 1,
    "nextDay": 1,
    "currentStreak": 0,
    "longestStreak": 0,
    "streakTier": "No Streak",
    "streakMultiplier": 1.0,
    "missedToday": false,
    "totalClaims": 0
  },
  "nextReward": {
    "day": 1,
    "title": "Jour 1 - Bienvenue !",
    "isSpecial": false,
    "rewards": [
      {
        "type": "gold",
        "quantity": 500
      },
      {
        "type": "gems",
        "quantity": 10
      }
    ],
    "estimatedValue": 11
  },
  "playerInfo": {
    "vipLevel": 0,
    "vipBonus": 1.0
  }
}
```

---

### 3. Preview des prochains jours

**GET** `/api/daily-rewards/preview?days=7`

Obtient un aperçu des X prochains jours de récompenses.

#### Query Parameters
- `days` (optionnel) : Nombre de jours (1-30), défaut = 7

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "preview": [
    {
      "day": 1,
      "title": "Jour 1 - Bienvenue !",
      "isSpecial": false,
      "rewards": [
        {
          "type": "gold",
          "quantity": 500
        }
      ],
      "baseValue": 11,
      "vipBonusValue": 11
    },
    {
      "day": 2,
      "title": "Jour 2 - Continue !",
      "isSpecial": false,
      "rewards": [...],
      "baseValue": 16,
      "vipBonusValue": 16
    }
  ]
}
```

---

### 4. Leaderboard des streaks

**GET** `/api/daily-rewards/leaderboard?limit=50`

Obtient le classement des meilleurs streaks du serveur.

#### Query Parameters
- `limit` (optionnel) : Nombre de résultats (1-100), défaut = 50

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "leaderboard": [
    {
      "playerId": "PLAYER_abc123",
      "playerName": "JohnDoe",
      "playerLevel": 45,
      "currentStreak": 30,
      "longestStreak": 60,
      "totalClaims": 150,
      "lastClaimDate": "2025-01-15T00:00:00.000Z"
    }
  ]
}
```

---

### 5. Health Check

**GET** `/api/daily-rewards/health`

Vérifie la santé du système (pas d'authentification requise).

#### Réponse succès (200)
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "DailyRewards"
}
```

---

## Modèles de données

### Reward Item

```csharp
public class RewardItem
{
    public string type;        // "gold", "gems", "tickets", "hero_fragment", "material", "item"
    public string itemId;      // ID de l'objet (si applicable)
    public int quantity;       // Quantité
    public string rarity;      // "Common", "Rare", "Epic", "Legendary"
}
```

### Daily Reward Status

```csharp
public class DailyRewardStatus
{
    public bool canClaim;
    public long timeUntilNext;      // Millisecondes
    public int currentDay;          // 1-30
    public int nextDay;             // 1-30
    public int currentStreak;       // Jours consécutifs
    public int longestStreak;       // Record du joueur
    public string streakTier;       // "No Streak", "Bronze Streak", etc.
    public float streakMultiplier;  // 1.0, 1.25, 1.5, 2.0
    public bool missedToday;
    public int totalClaims;
}
```

### Streak Tiers

| Streak | Tier | Multiplicateur | Nom |
|--------|------|----------------|-----|
| 0-6 jours | None | ×1.0 | No Streak |
| 7-13 jours | Bronze | ×1.25 | Bronze Streak |
| 14-29 jours | Silver | ×1.5 | Silver Streak |
| 30+ jours | Gold | ×2.0 | Gold Streak |

---

## Événements WebSocket

### Connection

Se connecter à la room Daily Rewards :

```csharp
socket.Emit("daily_rewards:subscribe");
```

Se déconnecter :

```csharp
socket.Emit("daily_rewards:unsubscribe");
```

---

### Événements reçus (Serveur → Client)

#### 1. Récompense réclamée

**Event:** `daily_rewards:claimed`

```json
{
  "success": true,
  "label": "DAILY_REWARD_CLAIMED",
  "data": {
    "day": 1,
    "rewards": [...],
    "streakBonus": 1.0,
    "currentStreak": 1,
    "totalValue": 11,
    "dayTitle": "Jour 1 - Bienvenue !",
    "isSpecial": false
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 2. Nouvelle récompense disponible

**Event:** `daily_rewards:available`

```json
{
  "label": "DAILY_REWARD_AVAILABLE",
  "data": {
    "canClaim": true,
    "nextDay": 2,
    "currentStreak": 1,
    "estimatedValue": 16,
    "dayTitle": "Jour 2 - Continue !",
    "isSpecial": false
  },
  "timestamp": "2025-01-15T00:00:00.000Z"
}
```

#### 3. Milestone atteint

**Event:** `daily_rewards:milestone`

```json
{
  "label": "DAILY_REWARD_MILESTONE_ACHIEVED",
  "data": {
    "streak": 7,
    "milestoneLabel": "7 jours de connexion consécutive !",
    "bonusRewards": {
      "gold": 7000,
      "gems": 70
    },
    "nextMilestone": 14
  },
  "timestamp": "2025-01-22T10:30:00.000Z"
}
```

#### 4. Streak reset

**Event:** `daily_rewards:streak_reset`

```json
{
  "label": "DAILY_REWARD_STREAK_RESET",
  "data": {
    "previousStreak": 5,
    "reason": "missed_days",
    "missedDays": 2,
    "canRecover": false
  },
  "timestamp": "2025-01-17T00:00:00.000Z"
}
```

#### 5. Rappel avant expiration

**Event:** `daily_rewards:reminder`

```json
{
  "label": "DAILY_REWARD_REMINDER",
  "data": {
    "hoursLeft": 6,
    "nextDay": 5,
    "currentStreak": 4,
    "willLoseStreak": true,
    "estimatedValue": 66
  },
  "timestamp": "2025-01-15T18:00:00.000Z"
}
```

#### 6. Événement spécial

**Event:** `daily_rewards:special_event`

```json
{
  "label": "DAILY_REWARD_SPECIAL_EVENT",
  "data": {
    "eventType": "double_rewards",
    "eventName": "Weekend Bonus",
    "description": "Double rewards during weekend!",
    "durationHours": 48,
    "bonusMultiplier": 2
  },
  "timestamp": "2025-01-18T00:00:00.000Z"
}
```

---

## Labels i18n

Tous les textes sont envoyés sous forme de **labels i18n**. Le client Unity doit les traduire localement.

### Labels principaux

```csharp
// Succès
"DAILY_REWARD_CLAIMED" = "Récompense quotidienne réclamée !"
"DAILY_REWARD_AVAILABLE" = "Nouvelle récompense disponible !"
"DAILY_REWARD_MILESTONE_ACHIEVED" = "Palier de {streak} jours atteint !"

// Erreurs
"DAILY_REWARD_ALREADY_CLAIMED" = "Déjà réclamé aujourd'hui"
"DAILY_REWARD_STREAK_RESET" = "Votre série a été réinitialisée"
"PLAYER_NOT_FOUND" = "Joueur introuvable"

// Rappels
"DAILY_REWARD_REMINDER" = "N'oubliez pas votre récompense quotidienne !"
"DAILY_REWARD_SPECIAL_DAY_TITLE" = "🎉 {dayTitle}"

// Événements
"DAILY_REWARD_SPECIAL_EVENT" = "Événement spécial actif !"
"DAILY_REWARD_CONFIG_UPDATED" = "Récompenses mises à jour !"

// Statut
"DAILY_REWARD_STATUS" = "Statut des récompenses quotidiennes"
"DAILY_REWARD_LEADERBOARD_UPDATED" = "Classement mis à jour"
```

### Tiers de streak

```csharp
"No Streak" = "Aucune série"
"Bronze Streak" = "Série Bronze"
"Silver Streak" = "Série Argent"
"Gold Streak" = "Série Or"
```

---

## Exemples d'intégration Unity

### 1. Récupérer le statut au lancement

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class DailyRewardsManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/daily-rewards";
    private string jwtToken;

    public IEnumerator GetDailyRewardStatus()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/status");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            DailyRewardStatusResponse response = 
                JsonUtility.FromJson<DailyRewardStatusResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                UpdateUI(response.status, response.nextReward);
            }
        }
    }
}
```

### 2. Réclamer la récompense

```csharp
public IEnumerator ClaimDailyReward()
{
    UnityWebRequest request = UnityWebRequest.Post($"{baseURL}/claim", "");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
    request.SetRequestHeader("Content-Type", "application/json");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        ClaimResponse response = 
            JsonUtility.FromJson<ClaimResponse>(request.downloadHandler.text);
        
        if (response.success)
        {
            ShowRewardPopup(response.claim.rewards);
            UpdatePlayerResources(response.appliedRewards);
            ShowStreakInfo(response.streakInfo);
        }
        else
        {
            // Afficher l'erreur localisée
            string localizedError = I18n.Get(response.error);
            ShowErrorPopup(localizedError);
        }
    }
}
```

### 3. Gérer les WebSocket

```csharp
using SocketIOClient;

public class DailyRewardsWebSocket : MonoBehaviour
{
    private SocketIO socket;

    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            socket.Emit("daily_rewards:subscribe");
        });

        socket.On("daily_rewards:claimed", response =>
        {
            var data = response.GetValue<DailyRewardClaimedData>();
            ShowRewardNotification(data);
        });

        socket.On("daily_rewards:available", response =>
        {
            var data = response.GetValue<DailyRewardAvailableData>();
            ShowAvailableNotification(data);
        });

        socket.On("daily_rewards:milestone", response =>
        {
            var data = response.GetValue<MilestoneData>();
            ShowMilestonePopup(data);
        });

        socket.ConnectAsync();
    }
}
```

### 4. Afficher le preview

```csharp
public IEnumerator GetRewardPreview(int days = 7)
{
    UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/preview?days={days}");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        PreviewResponse response = 
            JsonUtility.FromJson<PreviewResponse>(request.downloadHandler.text);
        
        if (response.success)
        {
            DisplayCalendarPreview(response.preview);
        }
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
| 429 | Rate limit | Attendre avant de réessayer |
| 500 | Erreur serveur | Afficher message d'erreur générique |

### Gestion des erreurs métier

```csharp
public void HandleDailyRewardError(string errorCode)
{
    switch (errorCode)
    {
        case "ALREADY_CLAIMED_TODAY":
            // Désactiver le bouton claim
            // Afficher "Déjà réclamé aujourd'hui"
            claimButton.interactable = false;
            break;

        case "PLAYER_NOT_FOUND":
            // Redemander le login
            AuthManager.Instance.Logout();
            break;

        case "RATE_LIMIT_EXCEEDED":
            // Attendre avant de réessayer
            StartCoroutine(WaitAndRetry(60));
            break;

        default:
            // Erreur générique
            ShowError("Une erreur est survenue");
            break;
    }
}
```

### Retry Logic

```csharp
public IEnumerator ClaimWithRetry(int maxRetries = 3)
{
    int attempts = 0;
    
    while (attempts < maxRetries)
    {
        yield return ClaimDailyReward();
        
        if (lastClaimSuccess)
        {
            yield break; // Succès, sortir
        }
        
        attempts++;
        yield return new WaitForSeconds(Mathf.Pow(2, attempts)); // Backoff exponentiel
    }
    
    ShowError("Impossible de réclamer la récompense après plusieurs tentatives");
}
```

---

## Best Practices

### ✅ À faire

1. **Toujours vérifier le statut** avant d'afficher l'UI
2. **Utiliser les WebSocket** pour les notifications temps réel
3. **Gérer les erreurs proprement** avec des messages localisés
4. **Afficher un timer** jusqu'à la prochaine récompense
5. **Sauvegarder le dernier claim** en local pour éviter les requêtes inutiles
6. **Afficher visuellement** les jours spéciaux (⭐)
7. **Célébrer les milestones** avec des animations/effets

### ❌ À éviter

1. Ne **jamais stocker** les récompenses côté client
2. Ne **jamais faire confiance** aux timestamps locaux
3. Ne **jamais spammer** l'API (respecter le rate limiting)
4. Ne pas claim automatiquement sans interaction utilisateur
5. Ne pas afficher les récompenses futures avec certitude (peuvent changer)

---

**Version:** 1.0.0  
**Dernière mise à jour:** 15 janvier 2025

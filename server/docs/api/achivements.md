# 🏆 Achievements API - Documentation pour Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Endpoints API](#endpoints-api)
3. [Modèles de données](#modèles-de-données)
4. [Événements WebSocket](#événements-websocket)
5. [Système de progression](#système-de-progression)
6. [Labels i18n](#labels-i18n)
7. [Exemples d'intégration Unity](#exemples-dintégration-unity)
8. [Gestion des erreurs](#gestion-des-erreurs)

---

## Vue d'ensemble

Le système **Achievements** permet de récompenser les joueurs pour leurs accomplissements dans le jeu, encourageant la progression et l'exploration de toutes les fonctionnalités.

### Fonctionnalités principales

- ✅ **Catégories variées** : Progression, Collection, Combat, Social, Économie, Ranking, Special
- ✅ **Types d'achievements** : Milestone, First, Leaderboard, Cumulative, Speed, Challenge
- ✅ **Système de rareté** : Common, Rare, Epic, Legendary, Mythic
- ✅ **Critères multiples** : AND logic entre plusieurs conditions
- ✅ **Récompenses riches** : Gold, Gems, Items, Fragments, Titres cosmétiques
- ✅ **Achievements uniques** : "First to complete" avec classement
- ✅ **Leaderboards dynamiques** : Top 100 avec refresh automatique
- ✅ **Achievements secrets** : Cachés jusqu'au déblocage
- ✅ **Scopes serveur/global** : Achievements par serveur ou cross-server
- ✅ **Événements limités** : Achievements temporaires avec dates début/fin
- ✅ **Tracking temps réel** : Progression automatique via événements
- ✅ **Notifications** : WebSocket pour déblocages instantanés

### Base URL

```
https://your-api-domain.com/api/achievements
```

---

## Endpoints API

### 1. Obtenir tous les achievements du joueur

**GET** `/api/achievements`

Récupère tous les achievements du joueur avec leur progression.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Query Parameters
- `completed` (optionnel) : `true` | `false` - Filtrer par statut de complétion
- `claimed` (optionnel) : `true` | `false` - Filtrer par statut de réclamation
- `category` (optionnel) : `progression` | `collection` | `combat` | `social` | `economy` | `ranking` | `special`
- `includeHidden` (optionnel) : `true` | `false` - Inclure les achievements secrets non débloqués

#### Réponse succès (200)
```json
{
  "success": true,
  "achievements": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "playerId": "PLAYER_abc123",
      "serverId": "S1",
      "achievementId": "ACH_WORLD_3",
      "progress": [
        {
          "criteriaIndex": 0,
          "currentValue": 3,
          "targetValue": 3,
          "completed": true
        }
      ],
      "isCompleted": true,
      "completedAt": "2025-01-15T10:30:00.000Z",
      "rewardsClaimed": false,
      "progressPercentage": 100,
      "achievementData": {
        "achievementId": "ACH_WORLD_3",
        "name": "World Explorer",
        "description": "Reach World 3",
        "category": "progression",
        "type": "milestone",
        "rarity": "rare",
        "rewards": {
          "gold": 1000,
          "gems": 100
        },
        "pointsValue": 50,
        "iconId": "achievement_world_3"
      }
    }
  ],
  "total": 1
}
```

---

### 2. Obtenir les achievements non réclamés

**GET** `/api/achievements/unclaimed`

Récupère uniquement les achievements complétés mais dont les récompenses n'ont pas été réclamées.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "unclaimed": [
    {
      "achievementId": "ACH_WORLD_3",
      "name": "World Explorer",
      "rewards": {
        "gold": 1000,
        "gems": 100
      },
      "completedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 3. Réclamer les récompenses

**POST** `/api/achievements/:achievementId/claim`

Réclame les récompenses d'un achievement complété.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### URL Parameters
- `achievementId` : ID de l'achievement (ex: `ACH_WORLD_3`)

#### Réponse succès (200)
```json
{
  "success": true,
  "rewards": {
    "gold": 1000,
    "gems": 100,
    "tickets": 0,
    "items": [],
    "fragments": [],
    "title": "World Explorer"
  },
  "playerAchievement": {
    "achievementId": "ACH_WORLD_3",
    "isCompleted": true,
    "rewardsClaimed": true,
    "claimedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

#### Erreurs possibles
```json
{
  "success": false,
  "error": "Achievement not found or already claimed"
}
```

**Codes d'erreur :**
- `Achievement not found or already claimed` : Achievement introuvable ou déjà réclamé
- `Achievement definition not found` : Définition d'achievement manquante
- `Player not found` : Joueur introuvable

---

### 4. Obtenir le leaderboard d'un achievement

**GET** `/api/achievements/leaderboard/:achievementId`

Récupère le classement des joueurs pour un achievement de type leaderboard.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### URL Parameters
- `achievementId` : ID de l'achievement leaderboard

#### Query Parameters
- `limit` (optionnel) : Nombre de résultats (1-1000), défaut = 100

#### Réponse succès (200)
```json
{
  "success": true,
  "achievement": {
    "achievementId": "ACH_TOWER_MASTER",
    "name": "Tower Master",
    "description": "Reach the highest floor in the Tower",
    "type": "leaderboard",
    "leaderboardLimit": 100
  },
  "leaderboard": [
    {
      "rank": 1,
      "playerId": "PLAYER_abc123",
      "playerName": "ProGamer",
      "score": 150,
      "completedAt": "2025-01-14T18:00:00.000Z"
    },
    {
      "rank": 2,
      "playerId": "PLAYER_def456",
      "playerName": "CasualPlayer",
      "score": 145,
      "completedAt": "2025-01-15T09:00:00.000Z"
    }
  ]
}
```

---

## Modèles de données

### Achievement Categories

```csharp
public enum AchievementCategory
{
    Progression,    // Avancement dans le jeu (mondes, tour, etc.)
    Collection,     // Collection de héros
    Combat,         // Performances en combat
    Social,         // Interactions sociales
    Economy,        // Gestion de ressources
    Ranking,        // Classements et compétition
    Special         // Événements spéciaux
}
```

### Achievement Types

```csharp
public enum AchievementType
{
    Milestone,      // Atteindre un objectif précis (ex: Monde 3)
    First,          // Premier joueur à faire X (unique)
    Leaderboard,    // Classement continu (Top 100)
    Cumulative,     // Accumuler X au total (ex: 1000 combats)
    Speed,          // Faire X en moins de Y temps
    Challenge       // Défis spéciaux avec conditions
}
```

### Achievement Rarity

```csharp
public enum AchievementRarity
{
    Common,
    Rare,
    Epic,
    Legendary,
    Mythic
}
```

### Achievement Criteria

```csharp
[Serializable]
public class AchievementCriteria
{
    public string type;                    // Type d'événement (world_reached, hero_collected, etc.)
    public int target;                     // Valeur cible à atteindre
    public string comparison;              // "=", ">=", "<=", ">", "<"
    public Dictionary<string, object> metadata;  // Filtres additionnels
}
```

**Types de critères courants :**
- `world_reached` : Atteindre un monde
- `stage_cleared` : Terminer un niveau
- `tower_floor` : Atteindre un étage de la tour
- `battle_won` : Gagner des combats (cumulatif)
- `boss_defeated` : Vaincre des boss (cumulatif)
- `hero_collected` : Collecter des héros (cumulatif)
- `hero_level_reached` : Atteindre un niveau avec un héros
- `gold_spent` : Dépenser de l'or (cumulatif)
- `gacha_pull` : Invoquer des héros (cumulatif)
- `arena_victory` : Victoires en arène (cumulatif)
- `player_level_reached` : Atteindre un niveau de joueur

### Achievement Rewards

```csharp
[Serializable]
public class AchievementRewards
{
    public int gold;
    public int gems;
    public int tickets;
    public List<string> items;
    public List<HeroFragment> fragments;
    
    // Récompenses cosmétiques
    public string title;          // Titre déblocable
    public string avatar;         // Avatar frame
    public string background;     // Background de profil
    public string badge;          // Badge à afficher
}

[Serializable]
public class HeroFragment
{
    public string heroId;
    public int quantity;
}
```

### Player Achievement Progress

```csharp
[Serializable]
public class PlayerAchievementProgress
{
    public int criteriaIndex;
    public int currentValue;
    public int targetValue;
    public bool completed;
}

[Serializable]
public class PlayerAchievement
{
    public string playerId;
    public string serverId;
    public string achievementId;
    
    public List<PlayerAchievementProgress> progress;
    
    public bool isCompleted;
    public DateTime completedAt;
    
    public int currentRank;        // Pour les leaderboards
    public int currentScore;       // Pour les leaderboards
    
    public bool rewardsClaimed;
    public DateTime claimedAt;
    
    public bool notified;
    public DateTime notifiedAt;
    
    public float progressPercentage;
}
```

---

## Événements WebSocket

### Connection

Se connecter à la room Achievements :

```csharp
socket.Emit("achievements:subscribe");
```

Se déconnecter :

```csharp
socket.Emit("achievements:unsubscribe");
```

---

### Événements reçus (Serveur → Client)

#### 1. Achievement débloqué

**Event:** `achievement:unlocked`

```json
{
  "success": true,
  "label": "ACHIEVEMENT_UNLOCKED",
  "data": {
    "achievementId": "ACH_WORLD_3",
    "name": "World Explorer",
    "description": "Reach World 3",
    "category": "progression",
    "rarity": "rare",
    "rewards": {
      "gold": 1000,
      "gems": 100
    },
    "pointsValue": 50,
    "completedAt": "2025-01-15T10:30:00.000Z",
    "isFirst": false
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 2. Premier à compléter (Achievement unique)

**Event:** `achievement:first_complete`

```json
{
  "label": "ACHIEVEMENT_FIRST_COMPLETE",
  "data": {
    "achievementId": "ACH_SPEED_RUN",
    "name": "Speed Runner",
    "playerName": "ProGamer",
    "completedAt": "2025-01-15T10:30:00.000Z",
    "specialRewards": {
      "gold": 5000,
      "gems": 500,
      "title": "First Speed Runner"
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 3. Progression mise à jour

**Event:** `achievement:progress_updated`

```json
{
  "label": "ACHIEVEMENT_PROGRESS_UPDATED",
  "data": {
    "achievementId": "ACH_BATTLE_VETERAN",
    "currentProgress": 450,
    "targetProgress": 1000,
    "progressPercentage": 45,
    "criteriaIndex": 0
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 4. Rank leaderboard mis à jour

**Event:** `achievement:rank_updated`

```json
{
  "label": "ACHIEVEMENT_RANK_UPDATED",
  "data": {
    "achievementId": "ACH_TOWER_MASTER",
    "oldRank": 15,
    "newRank": 12,
    "currentScore": 150,
    "leaderboardLimit": 100
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 5. Nouveau achievement disponible

**Event:** `achievement:new_available`

```json
{
  "label": "ACHIEVEMENT_NEW_AVAILABLE",
  "data": {
    "achievementId": "ACH_EVENT_SPECIAL",
    "name": "Special Event Champion",
    "category": "special",
    "startDate": "2025-01-15T00:00:00.000Z",
    "endDate": "2025-01-22T23:59:59.000Z",
    "isLimited": true
  },
  "timestamp": "2025-01-15T00:00:00.000Z"
}
```

#### 6. Rappel achievements non réclamés

**Event:** `achievement:unclaimed_reminder`

```json
{
  "label": "ACHIEVEMENT_UNCLAIMED_REMINDER",
  "data": {
    "count": 3,
    "totalRewards": {
      "gold": 5000,
      "gems": 300
    },
    "achievements": [
      {
        "achievementId": "ACH_WORLD_3",
        "name": "World Explorer"
      }
    ]
  },
  "timestamp": "2025-01-15T18:00:00.000Z"
}
```

---

## Système de progression

### Tracking automatique des événements

Le serveur track automatiquement la progression via des événements. Le client Unity doit **déclencher ces événements** lors des actions du joueur.

#### Événements de progression disponibles

```csharp
public enum AchievementEvent
{
    // === PROGRESSION ===
    WORLD_REACHED,
    STAGE_CLEARED,
    TOWER_FLOOR,
    DIFFICULTY_UNLOCKED,
    CAMPAIGN_COMPLETED,
    
    // === COMBAT ===
    BATTLE_WON,
    BATTLE_LOST,
    PERFECT_VICTORY,        // Victoire sans perte de HP
    BOSS_DEFEATED,
    ELITE_DEFEATED,
    WAVE_COMPLETED,
    CONSECUTIVE_WINS,
    
    // === COLLECTION ===
    HERO_COLLECTED,
    HERO_LEVEL_REACHED,
    HERO_ASCENDED,
    HERO_AWAKENED,
    HERO_STARS_REACHED,
    FULL_TEAM_ELEMENT,      // Équipe mono-élément
    COLLECTION_MILESTONE,
    
    // === ÉCONOMIE ===
    GOLD_EARNED,
    GOLD_SPENT,
    GEMS_EARNED,
    GEMS_SPENT,
    GACHA_PULL,
    SHOP_PURCHASE,
    
    // === SOCIAL ===
    GUILD_JOINED,
    GUILD_CONTRIBUTION,
    FRIEND_ADDED,
    MESSAGE_SENT,
    
    // === PVP / ARÈNE ===
    ARENA_VICTORY,
    ARENA_DEFEAT,
    ARENA_RANK_REACHED,
    ARENA_STREAK,
    
    // === VIP / PROGRESSION COMPTE ===
    PLAYER_LEVEL_REACHED,
    VIP_LEVEL_REACHED,
    LOGIN_STREAK,
    DAILY_QUEST_COMPLETED,
    WEEKLY_QUEST_COMPLETED,
    
    // === SPÉCIAL / ÉVÉNEMENTS ===
    EVENT_COMPLETED,
    LIMITED_ACHIEVEMENT,
    SEASONAL_MILESTONE,
    
    // === STATISTIQUES ===
    TOTAL_DAMAGE_DEALT,
    TOTAL_HEALING_DONE,
    CRITICAL_HITS,
    ULTIMATES_USED
}
```

### Logic de progression

#### Événements cumulatifs vs Milestones

**Événements cumulatifs** (s'additionnent) :
- `battle_won`, `battle_lost`
- `boss_defeated`
- `gold_spent`, `gold_earned`
- `gacha_pull`
- `hero_collected`
- `critical_hits`, `ultimates_used`

**Événements de milestone** (valeur maximale) :
- `world_reached`
- `tower_floor`
- `player_level_reached`
- `hero_level_reached`

#### Critères multiples (AND logic)

Un achievement peut avoir plusieurs critères qui doivent **TOUS** être complétés :

```json
{
  "achievementId": "ACH_ELITE_COLLECTOR",
  "name": "Elite Collector",
  "criteria": [
    {
      "type": "hero_collected",
      "target": 50,
      "comparison": ">="
    },
    {
      "type": "hero_collected",
      "target": 5,
      "comparison": ">=",
      "metadata": {
        "rarity": "legendary"
      }
    }
  ]
}
```

Ce achievement nécessite :
1. Collecter 50 héros au total **ET**
2. Collecter 5 héros légendaires

---

## Labels i18n

Tous les textes sont envoyés sous forme de **labels i18n**. Le client Unity doit les traduire localement.

### Labels principaux

```csharp
// Succès
"ACHIEVEMENT_UNLOCKED" = "Achievement débloqué !"
"ACHIEVEMENT_FIRST_COMPLETE" = "{playerName} est le premier à compléter : {achievementName} !"
"ACHIEVEMENT_PROGRESS_UPDATED" = "Progression : {current}/{target}"
"ACHIEVEMENT_RANK_UPDATED" = "Nouveau classement : #{rank}"

// Récompenses
"ACHIEVEMENT_REWARDS_CLAIMED" = "Récompenses réclamées !"
"ACHIEVEMENT_UNCLAIMED_REMINDER" = "Vous avez {count} achievements à réclamer !"

// Catégories
"ACHIEVEMENT_CATEGORY_PROGRESSION" = "Progression"
"ACHIEVEMENT_CATEGORY_COLLECTION" = "Collection"
"ACHIEVEMENT_CATEGORY_COMBAT" = "Combat"
"ACHIEVEMENT_CATEGORY_SOCIAL" = "Social"
"ACHIEVEMENT_CATEGORY_ECONOMY" = "Économie"
"ACHIEVEMENT_CATEGORY_RANKING" = "Classement"
"ACHIEVEMENT_CATEGORY_SPECIAL" = "Spécial"

// Raretés
"ACHIEVEMENT_RARITY_COMMON" = "Commun"
"ACHIEVEMENT_RARITY_RARE" = "Rare"
"ACHIEVEMENT_RARITY_EPIC" = "Épique"
"ACHIEVEMENT_RARITY_LEGENDARY" = "Légendaire"
"ACHIEVEMENT_RARITY_MYTHIC" = "Mythique"

// Notifications
"ACHIEVEMENT_NEW_AVAILABLE" = "Nouvel achievement disponible !"
"ACHIEVEMENT_ENDING_SOON" = "Achievement limité : expire dans {hours}h"

// Erreurs
"ACHIEVEMENT_NOT_FOUND" = "Achievement introuvable"
"ACHIEVEMENT_ALREADY_CLAIMED" = "Récompenses déjà réclamées"
"ACHIEVEMENT_NOT_COMPLETED" = "Achievement non complété"
```

---

## Exemples d'intégration Unity

### 1. Charger les achievements au lancement

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;

public class AchievementsManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/achievements";
    private string jwtToken;
    
    public List<PlayerAchievement> playerAchievements = new List<PlayerAchievement>();

    public IEnumerator LoadPlayerAchievements(bool completedOnly = false)
    {
        string url = $"{baseURL}?completed={completedOnly}";
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            AchievementsResponse response = 
                JsonUtility.FromJson<AchievementsResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                playerAchievements = response.achievements;
                UpdateAchievementsUI();
            }
        }
    }
}
```

### 2. Afficher les achievements non réclamés

```csharp
public IEnumerator GetUnclaimedAchievements()
{
    UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/unclaimed");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        UnclaimedResponse response = 
            JsonUtility.FromJson<UnclaimedResponse>(request.downloadHandler.text);
        
        if (response.success && response.count > 0)
        {
            ShowUnclaimedBadge(response.count);
            
            // Afficher une notification
            NotificationManager.Show(
                I18n.Get("ACHIEVEMENT_UNCLAIMED_REMINDER", response.count)
            );
        }
    }
}
```

### 3. Réclamer une récompense

```csharp
public IEnumerator ClaimAchievement(string achievementId)
{
    UnityWebRequest request = UnityWebRequest.Post($"{baseURL}/{achievementId}/claim", "");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
    request.SetRequestHeader("Content-Type", "application/json");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        ClaimResponse response = 
            JsonUtility.FromJson<ClaimResponse>(request.downloadHandler.text);
        
        if (response.success)
        {
            // Afficher les récompenses
            ShowRewardsPopup(response.rewards);
            
            // Mettre à jour les ressources du joueur
            PlayerManager.Instance.AddGold(response.rewards.gold);
            PlayerManager.Instance.AddGems(response.rewards.gems);
            
            // Mettre à jour la liste
            yield return LoadPlayerAchievements();
        }
        else
        {
            ShowErrorPopup(I18n.Get(response.error));
        }
    }
}
```

### 4. Afficher un leaderboard

```csharp
public IEnumerator ShowLeaderboard(string achievementId)
{
    UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/leaderboard/{achievementId}?limit=100");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        LeaderboardResponse response = 
            JsonUtility.FromJson<LeaderboardResponse>(request.downloadHandler.text);
        
        if (response.success)
        {
            DisplayLeaderboardUI(response.achievement, response.leaderboard);
        }
    }
}
```

### 5. Gérer les WebSocket pour notifications temps réel

```csharp
using SocketIOClient;

public class AchievementWebSocket : MonoBehaviour
{
    private SocketIO socket;

    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            socket.Emit("achievements:subscribe");
        });

        socket.On("achievement:unlocked", response =>
        {
            var data = response.GetValue<AchievementUnlockedData>();
            ShowAchievementUnlockedPopup(data);
            PlayUnlockAnimation(data.rarity);
            PlayUnlockSound(data.rarity);
        });

        socket.On("achievement:progress_updated", response =>
        {
            var data = response.GetValue<ProgressUpdatedData>();
            UpdateProgressBar(data.achievementId, data.progressPercentage);
        });

        socket.On("achievement:first_complete", response =>
        {
            var data = response.GetValue<FirstCompleteData>();
            ShowGlobalAnnouncement(
                I18n.Get("ACHIEVEMENT_FIRST_COMPLETE", 
                    data.playerName, 
                    data.name)
            );
        });

        socket.On("achievement:unclaimed_reminder", response =>
        {
            var data = response.GetValue<UnclaimedReminderData>();
            ShowUnclaimedNotification(data.count);
        });

        socket.ConnectAsync();
    }

    void OnDestroy()
    {
        socket?.Emit("achievements:unsubscribe");
        socket?.DisconnectAsync();
    }
}
```

### 6. Système de tracking des événements

```csharp
public class AchievementTracker : MonoBehaviour
{
    // Le serveur gère automatiquement le tracking via les événements
    // Le client n'a qu'à effectuer les actions normalement
    
    public void OnWorldReached(int worldId)
    {
        // Le serveur détecte automatiquement via l'update du player progress
        // Pas besoin d'appel API spécifique
    }
    
    public void OnBattleWon(BattleResult result)
    {
        // Le serveur track automatiquement
        // Les achievements se débloquent en temps réel
    }
    
    public void OnHeroCollected(string heroId, string rarity)
    {
        // Le serveur met à jour la progression automatiquement
    }
    
    // Les WebSocket notifient le client des déblocages en temps réel
}
```

### 7. UI de progression d'achievement

```csharp
public class AchievementCard : MonoBehaviour
{
    public Text achievementName;
    public Text achievementDescription;
    public Image progressBar;
    public Text progressText;
    public Image rarityBorder;
    public GameObject lockedOverlay;
    public Button claimButton;
    
    public void Setup(PlayerAchievement achievement)
    {
        var achievementData = achievement.achievementData;
        
        achievementName.text = achievementData.name;
        achievementDescription.text = achievementData.description;
        
        // Progress bar
        float progress = achievement.progressPercentage / 100f;
        progressBar.fillAmount = progress;
        progressText.text = $"{achievement.progressPercentage}%";
        
        // Rarity color
        rarityBorder.color = GetRarityColor(achievementData.rarity);
        
        // Locked/Unlocked state
        if (achievement.isCompleted)
        {
            lockedOverlay.SetActive(false);
            claimButton.gameObject.SetActive(!achievement.rewardsClaimed);
        }
        else
        {
            lockedOverlay.SetActive(true);
            claimButton.gameObject.SetActive(false);
        }
        
        // Claim button
        claimButton.onClick.AddListener(() => 
        {
            StartCoroutine(AchievementsManager.Instance.ClaimAchievement(
                achievement.achievementId
            ));
        });
    }
    
    private Color GetRarityColor(string rarity)
    {
        switch (rarity.ToLower())
        {
            case "common": return new Color(0.7f, 0.7f, 0.7f);
            case "rare": return new Color(0.3f, 0.6f, 1f);
            case "epic": return new Color(0.6f, 0.3f, 1f);
            case "legendary": return new Color(1f, 0.8f, 0.2f);
            case "mythic": return new Color(1f, 0.3f, 0.3f);
            default: return Color.white;
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
| 404 | Achievement introuvable | Vérifier l'achievementId |
| 500 | Erreur serveur | Afficher message d'erreur générique |

### Gestion des erreurs métier

```csharp
public void HandleAchievementError(string error)
{
    switch (error)
    {
        case "Achievement not found or already claimed":
            ShowError(I18n.Get("ACHIEVEMENT_ALREADY_CLAIMED"));
            RefreshAchievementsList();
            break;

        case "Achievement definition not found":
            ShowError(I18n.Get("ACHIEVEMENT_NOT_FOUND"));
            break;

        case "Player not found":
            AuthManager.Instance.Logout();
            break;

        default:
            ShowError("Une erreur est survenue");
            break;
    }
}
```

### Retry Logic

```csharp
public IEnumerator ClaimWithRetry(string achievementId, int maxRetries = 3)
{
    int attempts = 0;
    
    while (attempts < maxRetries)
    {
        yield return ClaimAchievement(achievementId);
        
        if (lastClaimSuccess)
        {
            yield break;
        }
        
        attempts++;
        yield return new WaitForSeconds(Mathf.Pow(2, attempts));
    }
    
    ShowError("Impossible de réclamer après plusieurs tentatives");
}
```

---

## Best Practices

### ✅ À faire

1. **Charger les achievements au login** pour afficher les notifications de déblocage
2. **Utiliser les WebSocket** pour les notifications temps réel
3. **Afficher un badge** pour les achievements non réclamés
4. **Célébrer les déblocages** avec animations et effets visuels selon la rareté
5. **Afficher la progression** en temps réel avec des barres de progression
6. **Cacher les achievements secrets** (isHidden) jusqu'au déblocage
7. **Grouper par catégorie** pour une meilleure navigation
8. **Trier par rareté et progression** pour mettre en avant les objectifs importants
9. **Afficher les récompenses clairement** avant de claim
10. **Utiliser les couleurs de rareté** pour la hiérarchie visuelle
11. **Afficher les "First to complete"** en highlight spécial
12. **Montrer les leaderboards** pour les achievements compétitifs
13. **Notifier les achievements limités** qui vont expirer

### ❌ À éviter

1. Ne **jamais stocker** les récompenses côté client
2. Ne **jamais faire confiance** aux données locales pour la progression
3. Ne **jamais spammer** l'API (utiliser WebSocket pour le temps réel)
4. Ne pas claim automatiquement - demander confirmation au joueur
5. Ne pas afficher tous les détails des achievements cachés
6. Ne pas oublier de rafraîchir la liste après un claim
7. Ne pas négliger les animations de déblocage (impact psychologique fort)

---

## Structures de données pour Unity

```csharp
[Serializable]
public class AchievementsResponse
{
    public bool success;
    public List<PlayerAchievement> achievements;
    public int total;
}

[Serializable]
public class UnclaimedResponse
{
    public bool success;
    public List<PlayerAchievement> unclaimed;
    public int count;
}

[Serializable]
public class ClaimResponse
{
    public bool success;
    public AchievementRewards rewards;
    public PlayerAchievement playerAchievement;
    public string error;
}

[Serializable]
public class LeaderboardResponse
{
    public bool success;
    public Achievement achievement;
    public List<LeaderboardEntry> leaderboard;
}

[Serializable]
public class LeaderboardEntry
{
    public int rank;
    public string playerId;
    public string playerName;
    public int score;
    public string completedAt;
}

[Serializable]
public class AchievementUnlockedData
{
    public string achievementId;
    public string name;
    public string description;
    public string category;
    public string rarity;
    public AchievementRewards rewards;
    public int pointsValue;
    public string completedAt;
    public bool isFirst;
}

[Serializable]
public class ProgressUpdatedData
{
    public string achievementId;
    public int currentProgress;
    public int targetProgress;
    public float progressPercentage;
    public int criteriaIndex;
}

[Serializable]
public class FirstCompleteData
{
    public string achievementId;
    public string name;
    public string playerName;
    public string completedAt;
    public AchievementRewards specialRewards;
}

[Serializable]
public class UnclaimedReminderData
{
    public int count;
    public TotalRewards totalRewards;
    public List<AchievementSummary> achievements;
}

[Serializable]
public class TotalRewards
{
    public int gold;
    public int gems;
}

[Serializable]
public class AchievementSummary
{
    public string achievementId;
    public string name;
}
```

---

**Version:** 1.0.0  
**Dernière mise à jour:** 4 octobre 2025  
**Système:** Server Authority (100% côté serveur)

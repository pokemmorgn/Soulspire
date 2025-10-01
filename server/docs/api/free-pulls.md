# 🎁 Free Pulls API - Documentation pour Unity

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

Le système **Free Pulls** permet aux joueurs de bénéficier de pulls gratuits sur certaines bannières avec des resets automatiques (daily, weekly, monthly).

### Fonctionnalités principales

- ✅ **Pulls gratuits configurables** par bannière
- ✅ **Reset automatique** : daily (minuit), weekly (lundi), monthly (1er du mois)
- ✅ **Tracker par bannière** : chaque bannière a son propre compteur
- ✅ **Système de drops** : les pulls gratuits peuvent drop des tickets élémentaires (configurable)
- ✅ **Notifications temps réel** : via WebSocket
- ✅ **Gestion automatique** : cron job toutes les heures
- ✅ **Scalable** : supporte 50+ serveurs, des milliers de joueurs
- ✅ **Rappels automatiques** : notification 4h avant expiration

### Base URL

```
https://your-api-domain.com/api/gacha
```

---

## Endpoints API

### 1. Obtenir le statut des pulls gratuits

**GET** `/api/gacha/free-pulls/status`

Récupère le statut de tous les pulls gratuits disponibles pour le joueur.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "freePulls": [
    {
      "bannerId": "standard_banner",
      "bannerName": "Standard Banner",
      "isEnabled": true,
      "pullsAvailable": 1,
      "pullsUsed": 0,
      "resetType": "daily",
      "nextResetAt": "2025-01-16T00:00:00.000Z",
      "timeUntilReset": 43200,
      "labelKey": "FREE_PULL_RESET_DAILY"
    },
    {
      "bannerId": "beginner_banner",
      "bannerName": "Beginner Banner",
      "isEnabled": true,
      "pullsAvailable": 2,
      "pullsUsed": 1,
      "resetType": "daily",
      "nextResetAt": "2025-01-16T00:00:00.000Z",
      "timeUntilReset": 43200,
      "labelKey": "FREE_PULL_RESET_DAILY"
    },
    {
      "bannerId": "elemental_fire",
      "bannerName": "Fire Elemental Banner",
      "isEnabled": true,
      "pullsAvailable": 1,
      "pullsUsed": 0,
      "resetType": "daily",
      "nextResetAt": "2025-01-16T00:00:00.000Z",
      "timeUntilReset": 43200,
      "labelKey": "FREE_PULL_RESET_DAILY"
    }
  ]
}
```

**Paramètres de réponse :**
- `bannerId` : Identifiant unique de la bannière
- `bannerName` : Nom de la bannière (à afficher)
- `isEnabled` : Si les pulls gratuits sont actifs sur cette bannière
- `pullsAvailable` : Nombre de pulls gratuits disponibles
- `pullsUsed` : Nombre de pulls gratuits utilisés depuis le dernier reset
- `resetType` : Type de reset ("daily", "weekly", "monthly", "never")
- `nextResetAt` : Date ISO du prochain reset
- `timeUntilReset` : Temps en secondes jusqu'au prochain reset
- `labelKey` : Clé i18n pour afficher le type de reset

---

### 2. Utiliser un pull gratuit

**POST** `/api/gacha/free-pull`

Effectue un pull gratuit sur une bannière spécifique.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body
```json
{
  "bannerId": "standard_banner",
  "count": 1
}
```

**Paramètres :**
- `bannerId` (requis) : ID de la bannière
- `count` (optionnel) : Nombre de pulls (défaut: 1, max: pulls disponibles)

#### Réponse succès (200)
```json
{
  "success": true,
  "results": [
    {
      "heroId": "hero_123",
      "heroName": "Aria",
      "rarity": "Epic",
      "element": "Fire",
      "role": "Mage",
      "isNew": true,
      "fragmentsGained": 0,
      "isFocus": false
    }
  ],
  "summary": {
    "legendary": 0,
    "epic": 1,
    "rare": 0,
    "common": 0,
    "newHeroes": 1,
    "totalFragments": 0
  },
  "freePullsRemaining": 0,
  "elementalTicketsDropped": {
    "fire": 1,
    "water": 0,
    "wind": 0,
    "electric": 0,
    "light": 0,
    "shadow": 0
  },
  "pityInfo": {
    "currentPulls": 15,
    "pityThreshold": 90,
    "pullsUntilPity": 75
  }
}
```

#### Erreurs possibles
```json
{
  "success": false,
  "error": "FREE_PULL_NOT_AVAILABLE",
  "message": "No free pulls available for this banner"
}
```

**Codes d'erreur :**
- `BANNER_NOT_FOUND` : Bannière introuvable
- `FREE_PULL_NOT_AVAILABLE` : Aucun pull gratuit disponible
- `FREE_PULL_INSUFFICIENT` : Pas assez de pulls gratuits
- `PLAYER_NOT_FOUND` : Joueur introuvable
- `FREE_PULL_ERROR` : Erreur lors de l'utilisation

---

### 3. Obtenir le statut d'une bannière spécifique

**GET** `/api/gacha/free-pulls/status/:bannerId`

Récupère le statut des pulls gratuits pour une bannière spécifique.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Paramètres URL
- `bannerId` : Identifiant de la bannière

#### Réponse succès (200)
```json
{
  "success": true,
  "freePull": {
    "bannerId": "standard_banner",
    "bannerName": "Standard Banner",
    "isEnabled": true,
    "pullsAvailable": 1,
    "pullsUsed": 0,
    "resetType": "daily",
    "nextResetAt": "2025-01-16T00:00:00.000Z",
    "timeUntilReset": 43200,
    "labelKey": "FREE_PULL_RESET_DAILY"
  }
}
```

#### Erreur si non disponible
```json
{
  "success": true,
  "freePull": null,
  "message": "No free pulls available for this banner"
}
```

---

### 4. Health Check (Admin uniquement)

**GET** `/api/gacha/free-pulls/health`

Vérifie la santé du système de pulls gratuits.

#### Headers
```http
Authorization: Bearer <ADMIN_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "FreePulls",
  "stats": {
    "activeBanners": 8,
    "playersWithFreePulls": 1523,
    "totalPullsAvailable": 2456
  }
}
```

---

## Modèles de données

### FreePullStatus

```csharp
public class FreePullStatus
{
    public string bannerId;
    public string bannerName;
    public bool isEnabled;
    public int pullsAvailable;
    public int pullsUsed;
    public string resetType;        // "daily", "weekly", "monthly", "never"
    public string nextResetAt;      // ISO date string
    public long timeUntilReset;     // Secondes
    public string labelKey;         // Clé i18n
}
```

### FreePullResult

```csharp
public class FreePullResult
{
    public bool success;
    public List<HeroResult> results;
    public PullSummary summary;
    public int freePullsRemaining;
    public Dictionary<string, int> elementalTicketsDropped;
    public PityInfo pityInfo;
}
```

### HeroResult

```csharp
public class HeroResult
{
    public string heroId;
    public string heroName;
    public string rarity;           // "Common", "Rare", "Epic", "Legendary", "Mythic"
    public string element;
    public string role;
    public bool isNew;              // Premier héros obtenu
    public int fragmentsGained;     // Si duplicata
    public bool isFocus;            // Si héros focus de la bannière
}
```

### Reset Types

| Type | Description | Fréquence | Exemple |
|------|-------------|-----------|---------|
| `daily` | Reset tous les jours | Minuit UTC | Standard Banner |
| `weekly` | Reset tous les lundis | Lundi minuit UTC | Event Banner |
| `monthly` | Reset le 1er du mois | 1er à minuit UTC | Premium Banner |
| `never` | Jamais reset | - | One-time Banner |

---

## Événements WebSocket

### Connection

Se connecter à la room Gacha :

```csharp
socket.Emit("gacha:join_room");
```

S'abonner aux notifications de bannière spécifique :

```csharp
socket.Emit("gacha:subscribe_banner", new { bannerId = "standard_banner" });
```

Se déconnecter :

```csharp
socket.Emit("gacha:leave_room");
socket.Emit("gacha:unsubscribe_banner", new { bannerId = "standard_banner" });
```

---

### Événements reçus (Serveur → Client)

#### 1. Pull gratuit utilisé avec succès

**Event:** `gacha:free_pull_result`

```json
{
  "type": "free_pull_result",
  "data": {
    "bannerId": "standard_banner",
    "bannerName": "Standard Banner",
    "results": [...],
    "freePullsRemaining": 0,
    "elementalTicketsDropped": {
      "fire": 1
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### 2. Reset automatique des pulls gratuits

**Event:** `gacha:free_pulls_reset`

```json
{
  "data": {
    "bannerId": "standard_banner",
    "bannerName": "Standard Banner",
    "pullsAvailable": 1,
    "resetType": "daily",
    "nextResetAt": "2025-01-16T00:00:00.000Z"
  },
  "timestamp": "2025-01-16T00:00:00.000Z"
}
```

#### 3. Rappel pulls gratuits non utilisés

**Event:** `gacha:free_pulls_reminder`

```json
{
  "message": "You have 2 free pull(s) available!",
  "banners": [
    {
      "bannerId": "standard_banner",
      "bannerName": "Standard Banner",
      "pullsAvailable": 1,
      "expiresIn": 4
    },
    {
      "bannerId": "beginner_banner",
      "bannerName": "Beginner Banner",
      "pullsAvailable": 1,
      "expiresIn": 4
    }
  ],
  "priority": "medium",
  "timestamp": "2025-01-15T20:00:00.000Z"
}
```

#### 4. Événement pulls gratuits (nouveauté)

**Event:** `gacha:free_pulls_event`

```json
{
  "type": "free_pulls_event",
  "data": {
    "eventName": "Weekend Free Pulls!",
    "bannerId": "limited_banner",
    "bannerName": "Limited Banner",
    "freePullsCount": 5,
    "duration": 48,
    "specialRewards": {
      "guaranteedEpic": true
    }
  },
  "timestamp": "2025-01-18T00:00:00.000Z"
}
```

---

## Labels i18n

Tous les textes sont envoyés sous forme de **labels i18n**. Le client Unity doit les traduire localement.

### Labels principaux

```csharp
// Reset types
"FREE_PULL_RESET_DAILY" = "Reset quotidien"
"FREE_PULL_RESET_WEEKLY" = "Reset hebdomadaire"
"FREE_PULL_RESET_MONTHLY" = "Reset mensuel"
"FREE_PULL_RESET_NEVER" = "Unique"
"FREE_PULL_RESET_UNKNOWN" = "Inconnu"

// Succès
"FREE_PULL_SUCCESS" = "Pull gratuit utilisé avec succès !"
"FREE_PULL_RESULT_LEGENDARY" = "🌟 Légendaire obtenu avec un pull gratuit !"
"FREE_PULL_RESULT_EPIC" = "⭐ Épique obtenu avec un pull gratuit !"

// Erreurs
"FREE_PULL_NOT_AVAILABLE" = "Aucun pull gratuit disponible"
"FREE_PULL_INSUFFICIENT" = "Pas assez de pulls gratuits ({available}/{required})"
"FREE_PULL_ERROR" = "Erreur lors de l'utilisation du pull gratuit"
"FREE_PULL_BANNER_NOT_FOUND" = "Bannière introuvable"

// Notifications
"FREE_PULL_RESET_NOTIFICATION" = "Vos pulls gratuits ont été réinitialisés !"
"FREE_PULL_REMINDER_TITLE" = "Pulls gratuits disponibles !"
"FREE_PULL_REMINDER_MESSAGE" = "Vous avez {count} pull(s) gratuit(s) disponible(s)"
"FREE_PULL_EXPIRES_SOON" = "Expire dans {hours}h"

// Statut
"FREE_PULL_AVAILABLE_COUNT" = "{count} pull(s) gratuit(s)"
"FREE_PULL_NEXT_RESET" = "Prochain reset : {time}"
"FREE_PULL_USED_TODAY" = "Utilisé aujourd'hui"
```

### Exemples de traductions

```json
{
  "en": {
    "FREE_PULL_RESET_DAILY": "Daily Reset",
    "FREE_PULL_REMINDER_MESSAGE": "You have {count} free pull(s) available",
    "FREE_PULL_EXPIRES_SOON": "Expires in {hours}h"
  },
  "fr": {
    "FREE_PULL_RESET_DAILY": "Reset quotidien",
    "FREE_PULL_REMINDER_MESSAGE": "Vous avez {count} pull(s) gratuit(s) disponible(s)",
    "FREE_PULL_EXPIRES_SOON": "Expire dans {hours}h"
  },
  "es": {
    "FREE_PULL_RESET_DAILY": "Reinicio diario",
    "FREE_PULL_REMINDER_MESSAGE": "Tienes {count} invocación(es) gratis disponible(s)",
    "FREE_PULL_EXPIRES_SOON": "Expira en {hours}h"
  }
}
```

---

## Exemples d'intégration Unity

### 1. Récupérer le statut au lancement

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class FreePullsManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/gacha";
    private string jwtToken;

    public IEnumerator GetFreePullsStatus()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/free-pulls/status");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            FreePullsStatusResponse response = 
                JsonUtility.FromJson<FreePullsStatusResponse>(request.downloadHandler.text);
            
            if (response.success)
            {
                UpdateBannerUI(response.freePulls);
            }
        }
    }

    private void UpdateBannerUI(List<FreePullStatus> freePulls)
    {
        foreach (var freePull in freePulls)
        {
            if (freePull.isEnabled && freePull.pullsAvailable > 0)
            {
                // Afficher badge "FREE" sur la bannière
                ShowFreePullBadge(freePull.bannerId, freePull.pullsAvailable);
                
                // Afficher le timer
                StartCoroutine(UpdateResetTimer(freePull.bannerId, freePull.timeUntilReset));
            }
        }
    }
}
```

### 2. Utiliser un pull gratuit

```csharp
public IEnumerator UseFreePull(string bannerId)
{
    // Créer le body JSON
    string json = JsonUtility.ToJson(new { bannerId = bannerId, count = 1 });
    byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);

    UnityWebRequest request = new UnityWebRequest($"{baseURL}/free-pull", "POST");
    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");
    request.SetRequestHeader("Content-Type", "application/json");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        FreePullResponse response = 
            JsonUtility.FromJson<FreePullResponse>(request.downloadHandler.text);
        
        if (response.success)
        {
            // Jouer l'animation de pull
            PlayPullAnimation(response.results);
            
            // Mettre à jour les ressources
            UpdatePlayerResources(response.elementalTicketsDropped);
            
            // Mettre à jour le compteur
            UpdateFreePullCounter(bannerId, response.freePullsRemaining);
            
            // Afficher les héros obtenus
            ShowPullResults(response.results, true); // true = free pull
        }
        else
        {
            // Gérer l'erreur
            string localizedError = I18n.Get(response.error);
            ShowErrorPopup(localizedError);
        }
    }
}
```

### 3. Gérer les WebSocket

```csharp
using SocketIOClient;

public class FreePullsWebSocket : MonoBehaviour
{
    private SocketIO socket;

    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            socket.Emit("gacha:join_room");
        });

        // Reset automatique
        socket.On("gacha:free_pulls_reset", response =>
        {
            var data = response.GetValue<FreePullResetData>();
            OnFreePullsReset(data);
        });

        // Rappel avant expiration
        socket.On("gacha:free_pulls_reminder", response =>
        {
            var data = response.GetValue<FreePullReminderData>();
            ShowReminderNotification(data);
        });

        socket.ConnectAsync();
    }

    private void OnFreePullsReset(FreePullResetData data)
    {
        // Afficher notification
        string message = I18n.Get("FREE_PULL_RESET_NOTIFICATION");
        ShowNotification(message, NotificationType.Info);
        
        // Mettre à jour le badge de la bannière
        ShowFreePullBadge(data.bannerId, data.pullsAvailable);
        
        // Jouer un effet sonore
        AudioManager.Instance.PlaySFX("free_pull_available");
    }

    private void ShowReminderNotification(FreePullReminderData data)
    {
        // Afficher popup de rappel
        string title = I18n.Get("FREE_PULL_REMINDER_TITLE");
        string message = I18n.Get("FREE_PULL_REMINDER_MESSAGE", 
            new { count = data.banners.Count });
        
        ShowReminderPopup(title, message, data.banners);
    }
}
```

### 4. Afficher le timer de reset

```csharp
public class FreePullTimer : MonoBehaviour
{
    public Text timerText;
    private long secondsRemaining;

    public void StartTimer(long seconds)
    {
        secondsRemaining = seconds;
        InvokeRepeating(nameof(UpdateTimer), 0f, 1f);
    }

    private void UpdateTimer()
    {
        if (secondsRemaining <= 0)
        {
            CancelInvoke(nameof(UpdateTimer));
            timerText.text = "Available!";
            OnTimerExpired();
            return;
        }

        // Formater le temps
        System.TimeSpan time = System.TimeSpan.FromSeconds(secondsRemaining);
        
        if (time.TotalHours >= 1)
        {
            timerText.text = $"{(int)time.TotalHours}h {time.Minutes}m";
        }
        else
        {
            timerText.text = $"{time.Minutes}m {time.Seconds}s";
        }

        secondsRemaining--;
    }

    private void OnTimerExpired()
    {
        // Rafraîchir le statut
        FreePullsManager.Instance.GetFreePullsStatus();
        
        // Afficher notification
        ShowNotification(I18n.Get("FREE_PULL_RESET_NOTIFICATION"));
    }
}
```

### 5. UI avec badge "FREE"

```csharp
public class BannerCard : MonoBehaviour
{
    public GameObject freePullBadge;
    public Text freePullCountText;
    public Button pullButton;
    public Text pullButtonText;

    private FreePullStatus freePullStatus;

    public void SetupBanner(BannerData banner, FreePullStatus freePull)
    {
        freePullStatus = freePull;

        if (freePull != null && freePull.isEnabled && freePull.pullsAvailable > 0)
        {
            // Afficher le badge FREE
            freePullBadge.SetActive(true);
            freePullCountText.text = $"{freePull.pullsAvailable}";
            
            // Changer le texte du bouton
            pullButtonText.text = I18n.Get("PULL_FREE");
            pullButtonText.color = Color.green;
            
            // Activer le bouton
            pullButton.interactable = true;
        }
        else
        {
            // Masquer le badge
            freePullBadge.SetActive(false);
            
            // Texte normal
            pullButtonText.text = I18n.Get("PULL_X1");
            pullButtonText.color = Color.white;
        }
    }

    public void OnPullButtonClicked()
    {
        if (freePullStatus != null && freePullStatus.pullsAvailable > 0)
        {
            // Utiliser pull gratuit
            StartCoroutine(FreePullsManager.Instance.UseFreePull(freePullStatus.bannerId));
        }
        else
        {
            // Pull normal (avec gems/tickets)
            StartCoroutine(GachaManager.Instance.NormalPull(bannerData.bannerId));
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
| 400 | Requête invalide | Vérifier les paramètres (bannerId, count) |
| 401 | Non authentifié | Redemander le login |
| 404 | Bannière introuvable | Masquer l'option de pull gratuit |
| 429 | Rate limit | Attendre avant de réessayer |
| 500 | Erreur serveur | Afficher message d'erreur générique |

### Gestion des erreurs métier

```csharp
public void HandleFreePullError(string errorCode)
{
    switch (errorCode)
    {
        case "FREE_PULL_NOT_AVAILABLE":
            // Masquer le badge FREE
            freePullBadge.SetActive(false);
            ShowToast(I18n.Get("FREE_PULL_NOT_AVAILABLE"));
            break;

        case "FREE_PULL_INSUFFICIENT":
            // Afficher message avec détails
            ShowError(I18n.Get("FREE_PULL_INSUFFICIENT"));
            RefreshFreePullStatus();
            break;

        case "BANNER_NOT_FOUND":
            // Rafraîchir la liste des bannières
            GachaManager.Instance.RefreshBannerList();
            break;

        case "PLAYER_NOT_FOUND":
            // Redemander le login
            AuthManager.Instance.Logout();
            break;

        default:
            // Erreur générique
            ShowError(I18n.Get("FREE_PULL_ERROR"));
            break;
    }
}
```

### Retry Logic

```csharp
public IEnumerator UseFreePullWithRetry(string bannerId, int maxRetries = 3)
{
    int attempts = 0;
    
    while (attempts < maxRetries)
    {
        yield return UseFreePull(bannerId);
        
        if (lastPullSuccess)
        {
            yield break; // Succès, sortir
        }
        
        attempts++;
        
        // Backoff exponentiel : 2s, 4s, 8s
        yield return new WaitForSeconds(Mathf.Pow(2, attempts));
    }
    
    ShowError(I18n.Get("FREE_PULL_ERROR_RETRY_FAILED"));
}
```

---

## Best Practices

### ✅ À faire

1. **Toujours vérifier le statut** avant d'afficher le badge "FREE"
2. **Utiliser les WebSocket** pour les notifications de reset automatique
3. **Afficher un timer visuel** jusqu'au prochain reset
4. **Gérer les erreurs proprement** avec des messages localisés
5. **Sauvegarder le dernier statut** en local pour éviter requêtes inutiles
6. **Afficher visuellement** les pulls gratuits (badge, couleur, animation)
7. **Célébrer les pulls gratuits** avec des animations/effets spéciaux
8. **Rappeler au joueur** quand des pulls gratuits sont disponibles (notif push)
9. **Rafraîchir le statut** après chaque pull (gratuit ou normal)
10. **Prioritiser les pulls gratuits** dans l'UI (bouton vert, badge visible)

### ❌ À éviter

1. Ne **jamais stocker** les pulls gratuits côté client
2. Ne **jamais faire confiance** aux timestamps locaux pour le reset
3. Ne **jamais spammer** l'API (respecter le rate limiting)
4. Ne pas utiliser automatiquement les pulls gratuits (interaction requise)
5. Ne pas masquer les pulls gratuits dans l'UI (bien visible)
6. Ne pas confondre pulls gratuits avec tickets élémentaires (système différent)
7. Ne pas afficher le nombre futur de pulls gratuits (peut changer)

---

## Configuration serveur (Info pour les devs backend)

Les pulls gratuits sont configurés par bannière dans `Banner.freePullConfig` :

```typescript
{
  enabled: true,              // Activer/désactiver
  resetType: "daily",         // Type de reset
  pullsPerReset: 1,           // Nombre de pulls par reset
  requiresAuth: true,         // Nécessite d'être connecté
  applyTicketDrops: true,     // Peut drop des tickets élémentaires
  startsAt?: Date,            // Date de début (optionnel)
  endsAt?: Date               // Date de fin (optionnel)
}
```

**Reset automatique :**
- Cron job toutes les heures vérifie tous les joueurs
- Reset automatique à minuit UTC (daily), lundi (weekly), 1er du mois (monthly)
- Rappels envoyés 4h avant expiration (20h UTC)

---

## FAQ

**Q: Les pulls gratuits consomment-ils le pity counter ?**  
R: Oui, les pulls gratuits comptent pour le pity exactement comme les pulls normaux.

**Q: Les pulls gratuits peuvent-ils drop des tickets élémentaires ?**  
R: Oui, si `applyTicketDrops: true` dans la config de la bannière (défaut: true sauf bannières élémentaires).

**Q: Que se passe-t-il si je ne réclame pas mes pulls gratuits ?**  
R: Ils sont perdus lors du prochain reset. Un rappel est envoyé 4h avant.

**Q: Puis-je accumuler les pulls gratuits ?**  
R: Non, le nombre maximum est défini par `pullsPerReset`. Après le reset, le compteur repart de zéro.

**Q: Les pulls gratuits sont-ils partagés entre bannières ?**  
R: Non, chaque bannière a son propre compteur indépendant.

**Q: Comment savoir quand aura lieu le prochain reset ?**  
R: Utilisez `nextResetAt` et `timeUntilReset` dans le statut, ou afficher un timer dans l'UI.

---

**Version:** 1.0.0  
**Dernière mise à jour:** 15 janvier 2025

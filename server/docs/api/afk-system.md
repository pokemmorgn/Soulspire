# ⏰ AFK System API - Documentation Unity

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

Le système **AFK** permet aux joueurs de générer des récompenses automatiquement en étant inactifs, inspiré d'AFK Arena. Le système inclut des déblocages progressifs et un mode enhanced avec multi-récompenses.

### Fonctionnalités principales

- ✅ **Génération automatique** : Gold, Hero XP, Ascension Essences
- ✅ **Déblocages progressifs** : Nouveaux types de récompenses selon la progression
- ✅ **Mode Enhanced** : Système avancé avec multiplicateurs
- ✅ **Multiplicateurs VIP** : Bonus selon le niveau VIP
- ✅ **Cap temporel** : Maximum 12-24h d'accumulation
- ✅ **Simulation** : Prévisualisation des gains futurs
- ✅ **Notifications temps réel** : WebSocket pour progression
- ✅ **Compatibilité** : Ancien et nouveau système supportés

### Base URL

```
https://your-api-domain.com/api/afk
```

---

## Endpoints API

### 1. Obtenir le statut AFK

**GET** `/api/afk/summary`

Récupère l'état actuel des récompenses AFK du joueur.

#### Auth requise
✅ **Oui** (JWT Token obligatoire)

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)

```json
{
  "ok": true,
  "data": {
    "pendingGold": 1254,
    "baseGoldPerMinute": 55,
    "accumulatedSinceClaimSec": 1369,
    "maxAccrualSeconds": 43200,
    "lastTickAt": "2025-10-17T10:05:30.933Z",
    "lastClaimAt": null,
    "goldPerSecond": 0.92,
    "timeUntilCap": 41831,
    "pendingRewards": [
      {
        "type": "currency",
        "currencyType": "heroXP",
        "quantity": 81
      },
      {
        "type": "currency",
        "currencyType": "ascensionEssences",
        "quantity": 4
      }
    ],
    "totalValue": 48,
    "enhancedRatesPerMinute": {
      "gems": 27.5,
      "tickets": 0.5,
      "materials": 5.5,
      "heroXP": 20,
      "ascensionEssences": 1
    },
    "activeMultipliers": {
      "vip": 1.0,
      "stage": 1.2,
      "heroes": 0.8,
      "total": 0.96
    },
    "unlockInfo": {
      "unlockedRewards": ["heroXP", "ascensionEssences"],
      "nextUnlocks": [],
      "progressPercentage": 100
    },
    "useEnhancedRewards": true,
    "canUpgrade": false
  }
}
```

### 2. Réclamer les récompenses

**POST** `/api/afk/claim`

Récupère toutes les récompenses AFK accumulées.

#### Auth requise
✅ **Oui**

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Réponse succès (200)

```json
{
  "ok": true,
  "claimed": 370,
  "totalGold": 2937,
  "pendingGold": 0,
  "claimedRewards": [
    {
      "type": "currency",
      "currencyType": "heroXP",
      "quantity": 81
    },
    {
      "type": "currency",
      "currencyType": "ascensionEssences",
      "quantity": 4
    }
  ],
  "totalValue": 48,
  "playerUpdates": {
    "gold": 370,
    "gems": 0,
    "tickets": 0,
    "heroXP": 81,
    "ascensionEssences": 4,
    "materialsAdded": {},
    "fragmentsAdded": {}
  }
}
```

### 3. Activer le mode Enhanced

**POST** `/api/afk/upgrade`

Active le système AFK amélioré avec multi-récompenses.

#### Auth requise
✅ **Oui**

#### Réponse succès (200)

```json
{
  "ok": true,
  "message": "Successfully upgraded to enhanced AFK system",
  "newRates": {
    "gems": 27.5,
    "tickets": 0.5,
    "materials": 5.5,
    "heroXP": 20,
    "ascensionEssences": 1
  },
  "multipliers": {
    "vip": 1.0,
    "stage": 1.0,
    "heroes": 0.5,
    "total": 0.5
  }
}
```

### 4. Démarrer une session AFK

**POST** `/api/afk/start`

Démarre le tracking AFK pour le joueur.

#### Request Body

```json
{
  "deviceId": "unity_device_123",
  "source": "idle"
}
```

### 5. Heartbeat (maintenir la session)

**POST** `/api/afk/heartbeat`

Maintient la session AFK active (à appeler toutes les 30-60 secondes).

### 6. Arrêter la session AFK

**POST** `/api/afk/stop`

Termine la session AFK du joueur.

### 7. Simuler les gains futurs

**GET** `/api/afk/simulate/{hours}`

Simule les récompenses pour X heures.

#### Exemple
```
GET /api/afk/simulate/8
```

#### Réponse

```json
{
  "ok": true,
  "data": {
    "rewards": [
      {
        "type": "currency",
        "currencyType": "gold",
        "quantity": 24000
      },
      {
        "type": "currency",
        "currencyType": "heroXP",
        "quantity": 9600
      },
      {
        "type": "currency",
        "currencyType": "ascensionEssences",
        "quantity": 480
      }
    ],
    "totalValue": 5783,
    "cappedAt": 8
  }
}
```

### 8. Obtenir les taux détaillés

**GET** `/api/afk/rates`

Récupère les taux de génération détaillés du joueur.

#### Réponse

```json
{
  "ok": true,
  "data": {
    "ratesPerMinute": {
      "gold": 55,
      "gems": 27.5,
      "tickets": 0,
      "materials": 5.5,
      "heroXP": 10,
      "ascensionEssences": 0.5
    },
    "multipliers": {
      "vip": 1.0,
      "stage": 1.0,
      "heroes": 0.5,
      "total": 0.5
    },
    "maxAccrualHours": 12,
    "progression": {
      "world": 1,
      "level": 3,
      "difficulty": "Normal"
    }
  }
}
```

---

## Modèles de données C#

### AFK Summary Model

```csharp
[System.Serializable]
public class AfkSummaryResponse
{
    public bool ok;
    public AfkSummaryData data;
}

[System.Serializable]
public class AfkSummaryData
{
    public int pendingGold;
    public float baseGoldPerMinute;
    public int accumulatedSinceClaimSec;
    public int maxAccrualSeconds;
    public string lastTickAt;
    public string lastClaimAt;
    public float goldPerSecond;
    public int timeUntilCap;
    public AfkReward[] pendingRewards;
    public float totalValue;
    public AfkRatesPerMinute enhancedRatesPerMinute;
    public AfkMultipliers activeMultipliers;
    public AfkUnlockInfo unlockInfo;
    public bool useEnhancedRewards;
    public bool canUpgrade;
}

[System.Serializable]
public class AfkReward
{
    public string type;
    public string currencyType;
    public string materialId;
    public string fragmentId;
    public int quantity;
}

[System.Serializable]
public class AfkRatesPerMinute
{
    public float gems;
    public float tickets;
    public float materials;
    public float heroXP;
    public float ascensionEssences;
}

[System.Serializable]
public class AfkMultipliers
{
    public float vip;
    public float stage;
    public float heroes;
    public float total;
}

[System.Serializable]
public class AfkUnlockInfo
{
    public string[] unlockedRewards;
    public AfkNextUnlock[] nextUnlocks;
    public float progressPercentage;
}

[System.Serializable]
public class AfkNextUnlock
{
    public string type;
    public string requirement;
    public int worldsToGo;
    public int levelsToGo;
}
```

### Claim Response Model

```csharp
[System.Serializable]
public class AfkClaimResponse
{
    public bool ok;
    public int claimed;
    public int totalGold;
    public int pendingGold;
    public AfkReward[] claimedRewards;
    public float totalValue;
    public AfkPlayerUpdates playerUpdates;
}

[System.Serializable]
public class AfkPlayerUpdates
{
    public int gold;
    public int gems;
    public int tickets;
    public int heroXP;
    public int ascensionEssences;
    public System.Collections.Generic.Dictionary<string, int> materialsAdded;
    public System.Collections.Generic.Dictionary<string, int> fragmentsAdded;
}
```

### Simulation Response Model

```csharp
[System.Serializable]
public class AfkSimulationResponse
{
    public bool ok;
    public AfkSimulationData data;
}

[System.Serializable]
public class AfkSimulationData
{
    public AfkReward[] rewards;
    public float totalValue;
    public float cappedAt;
    public AfkFarmingMeta farmingMeta;
}

[System.Serializable]
public class AfkFarmingMeta
{
    public bool isCustomFarming;
    public string farmingStage;
    public int effectiveWorld;
    public int effectiveLevel;
    public string effectiveDifficulty;
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
    socket.Emit("afk:join_room");
});

socket.ConnectAsync();
```

### Événements AFK

#### Farming démarré
**Event:** `afk:farming_started`

```json
{
  "location": "World 5-3 (Hard)",
  "expectedDuration": 3600000,
  "estimatedRewards": {
    "gold": 1500,
    "exp": 750,
    "materials": 25
  },
  "farmingType": "progression"
}
```

#### Progression farming
**Event:** `afk:farming_progress`

```json
{
  "elapsed": 1800000,
  "totalDuration": 3600000,
  "currentRewards": {
    "gold": 750,
    "exp": 375
  },
  "progressPercentage": 50,
  "location": "World 5-3 (Hard)"
}
```

#### Drop rare
**Event:** `afk:rare_drop`

```json
{
  "itemName": "Epic Fusion Crystal",
  "itemRarity": "epic",
  "location": "World 5-3 (Hard)",
  "dropChance": 0.05,
  "itemValue": 500
}
```

#### Récompenses disponibles
**Event:** `afk:idle_rewards_available`

```json
{
  "pendingRewards": [
    {
      "type": "currency",
      "currencyType": "heroXP",
      "quantity": 120
    }
  ],
  "timeAccumulated": 7200,
  "canClaim": true,
  "timeUntilCap": 35800
}
```

#### Progression bloquée
**Event:** `afk:progress_stuck`

```json
{
  "currentStage": "5-12",
  "timeStuck": 86400000,
  "recommendations": [
    {
      "type": "upgrade",
      "description": "Upgrade heroes to increase power",
      "priority": "high",
      "cost": 5000
    }
  ],
  "canAutoFix": true
}
```

---

## Exemples d'intégration Unity

### 1. Charger le statut AFK

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class AfkManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/afk";
    private string jwtToken = "YOUR_JWT_TOKEN";

    IEnumerator LoadAfkStatus()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/summary");
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            AfkSummaryResponse response = JsonUtility.FromJson<AfkSummaryResponse>(request.downloadHandler.text);
            
            UpdateUI(response.data);
        }
    }

    void UpdateUI(AfkSummaryData data)
    {
        Debug.Log("Pending Gold: " + data.pendingGold);
        Debug.Log("Hero XP Rate: " + data.enhancedRatesPerMinute.heroXP + "/min");
        
        foreach (AfkReward reward in data.pendingRewards)
        {
            Debug.Log("Pending: " + reward.quantity + " " + reward.currencyType);
        }
    }
}
```

### 2. Timer de progression temps réel

```csharp
using UnityEngine;
using UnityEngine.UI;
using System;

public class AfkProgressTimer : MonoBehaviour
{
    [Header("UI References")]
    public Text goldAmountText;
    public Text heroXPAmountText;
    public Text timeElapsedText;
    public Text timeUntilCapText;
    public Slider progressSlider;
    
    private AfkSummaryData currentData;
    private DateTime lastUpdateTime;

    public void UpdateAfkData(AfkSummaryData data)
    {
        currentData = data;
        lastUpdateTime = DateTime.Now;
        UpdateUI();
    }

    void Update()
    {
        if (currentData == null) return;

        // Calculer le temps écoulé depuis la dernière mise à jour
        float deltaSeconds = (float)(DateTime.Now - lastUpdateTime).TotalSeconds;
        
        // Calculer les nouvelles valeurs
        int newGold = currentData.pendingGold + Mathf.FloorToInt(deltaSeconds * currentData.goldPerSecond);
        float newHeroXP = GetPendingRewardAmount("heroXP") + (deltaSeconds / 60f * currentData.enhancedRatesPerMinute.heroXP);
        
        // Mettre à jour l'UI
        goldAmountText.text = newGold.ToString("N0");
        heroXPAmountText.text = Mathf.FloorToInt(newHeroXP).ToString("N0");
        
        // Timer
        int totalElapsed = currentData.accumulatedSinceClaimSec + Mathf.FloorToInt(deltaSeconds);
        timeElapsedText.text = FormatTime(totalElapsed);
        
        int timeUntilCap = currentData.maxAccrualSeconds - totalElapsed;
        timeUntilCapText.text = FormatTime(Mathf.Max(0, timeUntilCap));
        
        // Progress bar
        float progress = (float)totalElapsed / currentData.maxAccrualSeconds;
        progressSlider.value = Mathf.Clamp01(progress);
    }

    float GetPendingRewardAmount(string currencyType)
    {
        foreach (AfkReward reward in currentData.pendingRewards)
        {
            if (reward.currencyType == currencyType)
                return reward.quantity;
        }
        return 0f;
    }

    string FormatTime(int seconds)
    {
        TimeSpan timeSpan = TimeSpan.FromSeconds(seconds);
        return string.Format("{0:D2}h {1:D2}m {2:D2}s", 
            timeSpan.Hours, timeSpan.Minutes, timeSpan.Seconds);
    }
}
```

### 3. Effectuer un claim avec animations

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Text;

public class AfkClaimer : MonoBehaviour
{
    [Header("Animation Settings")]
    public ParticleSystem goldParticles;
    public ParticleSystem heroXPParticles;
    public ParticleSystem ascensionEssencesParticles;
    public AudioSource claimSound;
    
    [Header("UI References")]
    public Text claimButtonText;
    public Button claimButton;

    private string baseURL = "https://your-api.com/api/afk";
    private string jwtToken = "YOUR_JWT_TOKEN";

    public void OnClaimButtonPressed()
    {
        StartCoroutine(PerformClaim());
    }

    IEnumerator PerformClaim()
    {
        // Désactiver le bouton pendant le claim
        claimButton.interactable = false;
        claimButtonText.text = "Claiming...";

        UnityWebRequest request = new UnityWebRequest(baseURL + "/claim", "POST");
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            AfkClaimResponse response = JsonUtility.FromJson<AfkClaimResponse>(request.downloadHandler.text);
            
            // Jouer les animations selon les récompenses
            yield return StartCoroutine(PlayClaimAnimations(response));
            
            // Mettre à jour l'UI
            UpdatePlayerResources(response.playerUpdates);
        }
        else
        {
            Debug.LogError("Claim failed: " + request.error);
        }

        // Réactiver le bouton
        claimButton.interactable = true;
        claimButtonText.text = "Claim";
    }

    IEnumerator PlayClaimAnimations(AfkClaimResponse response)
    {
        // Jouer le son
        if (claimSound != null)
            claimSound.Play();

        // Jouer les particules selon les récompenses
        foreach (AfkReward reward in response.claimedRewards)
        {
            switch (reward.currencyType)
            {
                case "heroXP":
                    if (heroXPParticles != null)
                        heroXPParticles.Play();
                    break;
                    
                case "ascensionEssences":
                    if (ascensionEssencesParticles != null)
                        ascensionEssencesParticles.Play();
                    break;
            }
        }

        // Gold toujours présent
        if (goldParticles != null && response.claimed > 0)
            goldParticles.Play();

        // Attendre la fin des animations
        yield return new WaitForSeconds(2f);
    }

    void UpdatePlayerResources(AfkPlayerUpdates updates)
    {
        // Mettre à jour l'UI des ressources du joueur
        Debug.Log("Gold gained: " + updates.gold);
        Debug.Log("Hero XP gained: " + updates.heroXP);
        Debug.Log("Ascension Essences gained: " + updates.ascensionEssences);
    }
}
```

### 4. Système de notifications push

```csharp
using UnityEngine;
using System;

public class AfkNotificationManager : MonoBehaviour
{
    [Header("Notification Settings")]
    public float checkInterval = 60f; // Vérifier toutes les minutes
    public int rewardsThreshold = 1000; // Notifier si rewards > seuil

    private float lastCheckTime;

    void Update()
    {
        if (Time.time - lastCheckTime >= checkInterval)
        {
            StartCoroutine(CheckAfkRewards());
            lastCheckTime = Time.time;
        }
    }

    System.Collections.IEnumerator CheckAfkRewards()
    {
        UnityWebRequest request = UnityWebRequest.Get("https://your-api.com/api/afk/summary");
        request.SetRequestHeader("Authorization", "Bearer " + PlayerPrefs.GetString("jwt_token"));
        
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            AfkSummaryResponse response = JsonUtility.FromJson<AfkSummaryResponse>(request.downloadHandler.text);
            
            if (response.data.totalValue >= rewardsThreshold)
            {
                ShowNotification("AFK Rewards Ready!", 
                    "You have " + response.data.totalValue + " value in rewards to claim!");
            }
        }
    }

    void ShowNotification(string title, string message)
    {
        // Votre système de notification UI
        Debug.Log("NOTIFICATION: " + title + " - " + message);
    }
}
```

### 5. Simulator de gains

```csharp
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using System.Collections;

public class AfkSimulator : MonoBehaviour
{
    [Header("UI References")]
    public Slider hoursSlider;
    public Text hoursLabel;
    public Text simulatedGoldText;
    public Text simulatedHeroXPText;
    public Text simulatedAscensionText;
    public Text totalValueText;

    private string baseURL = "https://your-api.com/api/afk";
    private string jwtToken = "YOUR_JWT_TOKEN";

    void Start()
    {
        hoursSlider.onValueChanged.AddListener(OnHoursChanged);
        OnHoursChanged(hoursSlider.value);
    }

    public void OnHoursChanged(float hours)
    {
        hoursLabel.text = hours.ToString("F1") + "h";
        StartCoroutine(SimulateRewards(Mathf.RoundToInt(hours)));
    }

    IEnumerator SimulateRewards(int hours)
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/simulate/" + hours);
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            AfkSimulationResponse response = JsonUtility.FromJson<AfkSimulationResponse>(request.downloadHandler.text);
            
            UpdateSimulationUI(response.data);
        }
    }

    void UpdateSimulationUI(AfkSimulationData data)
    {
        int gold = 0;
        int heroXP = 0;
        int ascensionEssences = 0;

        foreach (AfkReward reward in data.rewards)
        {
            switch (reward.currencyType)
            {
                case "gold":
                    gold = reward.quantity;
                    break;
                case "heroXP":
                    heroXP = reward.quantity;
                    break;
                case "ascensionEssences":
                    ascensionEssences = reward.quantity;
                    break;
            }
        }

        simulatedGoldText.text = gold.ToString("N0");
        simulatedHeroXPText.text = heroXP.ToString("N0");
        simulatedAscensionText.text = ascensionEssences.ToString("N0");
        totalValueText.text = data.totalValue.ToString("N0");
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
| 403 | Accès refusé | Permissions insuffisantes |
| 429 | Trop de requêtes | Attendre et réessayer |
| 500 | Erreur serveur | Réessayer plus tard |

### Codes d'erreur métier

- `TOKEN_EXPIRED` : JWT expiré, relogin requis
- `PLAYER_NOT_FOUND` : Joueur introuvable
- `ENHANCED_NOT_UNLOCKED` : Mode enhanced pas encore disponible
- `TOO_MANY_HEARTBEATS` : Heartbeat trop fréquent
- `AFK_STATE_NOT_FOUND` : État AFK non initialisé

### Gestion d'erreurs Unity

```csharp
public class AfkErrorHandler : MonoBehaviour
{
    public void HandleAfkError(string errorMessage, int httpCode)
    {
        switch (httpCode)
        {
            case 401:
                // Token expiré
                ShowLoginScreen();
                break;
                
            case 429:
                // Trop de requêtes
                ShowMessage("Please wait before making another request");
                break;
                
            case 500:
                // Erreur serveur
                ShowMessage("Server error, please try again later");
                break;
                
            default:
                ShowMessage("An error occurred: " + errorMessage);
                break;
        }
    }

    void ShowLoginScreen()
    {
        // Rediriger vers login
    }

    void ShowMessage(string message)
    {
        Debug.LogWarning(message);
    }
}
```

---

## Best Practices

### À FAIRE

1. ✅ Utiliser des heartbeats réguliers (30-60s)
2. ✅ Afficher progression temps réel
3. ✅ Gérer les reconnexions automatiques
4. ✅ Animations fluides pour les claims
5. ✅ Notifications pour récompenses importantes
6. ✅ Cache local du statut AFK
7. ✅ Gestion offline/online
8. ✅ Feedback visuel pour déblocages
9. ✅ Timer countdown précis
10. ✅ WebSocket pour notifications

### À ÉVITER

1. ❌ Ne pas spammer les heartbeats (<30s)
2. ❌ Ne pas ignorer les caps de temps
3. ❌ Ne pas faire de requêtes en background continu
4. ❌ Ne pas cacher les multiplicateurs au joueur
5. ❌ Ne pas oublier la gestion d'erreurs
6. ❌ Ne pas faire confiance uniquement au client
7. ❌ Ne pas ignorer les déblocages progressifs
8. ❌ Ne pas bloquer l'UI pendant les requêtes

---

## Déblocages progressifs

### Configuration par défaut

**Mode DEBUG** (DEBUG_UNLOCK_ALL_AT_WORLD_1 = true) :
- Tout débloqué dès le monde 1, niveau 1

**Mode PRODUCTION** (DEBUG_UNLOCK_ALL_AT_WORLD_1 = false) :
- **Hero XP** : Déblocage Monde 2, Niveau 15
- **Ascension Essences** : Déblocage Monde 5, Niveau 35

### Vérification des déblocages

```csharp
public bool IsRewardUnlocked(string rewardType, int playerWorld, int playerLevel)
{
    switch (rewardType)
    {
        case "heroXP":
            return playerWorld >= 2 && playerLevel >= 15;
        case "ascensionEssences":
            return playerWorld >= 5 && playerLevel >= 35;
        default:
            return true; // Gold toujours débloqué
    }
}
```

---

## Multiplicateurs et calculs

### Multiplicateurs VIP

- **VIP 0** : x1.0
- **VIP 1** : x1.08 (+8%)
- **VIP 2** : x1.16 (+16%)
- **VIP 3** : x1.24 (+24%) + Tickets unlock
- **VIP 5+** : Multiplicateurs progressifs

### Multiplicateurs de difficulté

- **Normal** : x1.0
- **Hard** : x1.3 (Hero XP) / x1.5 (Ascension Essences)
- **Nightmare** : x1.6 (Hero XP) / x2.2 (Ascension Essences)

### Taux de base

**Hero XP** :
- Base : 20/minute (Monde 1)
- Scaling : +12% par monde
- Stage bonus : +1.5% par niveau au-delà du minimum

**Ascension Essences** :
- Base : 1/minute (Monde 1)
- Scaling : +18% par monde
- Stage bonus : +2.5% par niveau au-delà du minimum
- Cap journalier : 200 essences/jour

---

## Checklist d'intégration

### Phase 1 - Basique
- [ ] Afficher statut AFK
- [ ] Claim simple
- [ ] Timer en temps réel
- [ ] Gestion d'erreurs basique
- [ ] Heartbeat système

### Phase 2 - Intermédiaire
- [ ] Mode Enhanced upgrade
- [ ] Multi-récompenses display
- [ ] Simulation de gains
- [ ] Animations de claim
- [ ] Déblocages progressifs

### Phase 3 - Avancé
- [ ] WebSocket integration
- [ ] Notifications push
- [ ] Farming progress
- [ ] Offline synchronization
- [ ] Analytics tracking

---

## Types de récompenses AFK

### Récompenses de base

**Gold** :
- Toujours disponible
- Base : 100/minute
- Multiplicateur monde : +15% par monde
- Aucun cap

**Hero XP** :
- Déblocage : Monde 2, Niveau 15
- Base : 20/minute
- Multiplicateur monde : +12% par monde
- Multiplicateur difficulté : Normal x1.0, Hard x1.3, Nightmare x1.6

**Ascension Essences** :
- Déblocage : Monde 5, Niveau 35
- Base : 1/minute
- Multiplicateur monde : +18% par monde
- Multiplicateur difficulté : Normal x1.0, Hard x1.5, Nightmare x2.2
- **Cap journalier** : 200 essences/jour (reset 4h UTC)

### Récompenses avancées (Legacy System)

**Gems** :
- Déblocage : Monde 8
- Taux variable selon progression

**Tickets** :
- Déblocage : Monde 12 + VIP 2+
- Taux basé sur niveau VIP

**Matériaux** :
- Fusion Crystals : Monde 2
- Elemental Essence : Monde 4
- Ascension Stones : Monde 6
- Divine Crystals : Monde 15

---

## Informations système

### Caps temporels

- **Base** : 12 heures d'accumulation
- **VIP 3+** : +2 heures (14h total)
- **VIP 6+** : +2 heures (16h total)
- **VIP 9+** : +4 heures (20h total)
- **VIP 12+** : +4 heures (24h total maximum)

### Sessions AFK

**Types de source** :
- `idle` : Application ouverte mais inactive
- `offline` : Application fermée

**Heartbeat** :
- Fréquence recommandée : 30-60 secondes
- Grace period : 120 secondes
- Auto-disconnect : après 300 secondes sans heartbeat

### Valeur des récompenses

**Calcul de totalValue** :
- Gold : x0.001
- Gems : x1.0
- Tickets : x5.0
- Hero XP : x0.1
- Ascension Essences : x10.0
- Matériaux : x2.0
- Fragments : x10.0
- Items : x25.0

---

## Événements spéciaux

### Milestone Rewards

Déclenchés automatiquement lors de claims importants :

```json
{
  "milestoneType": "time_played",
  "value": 8,
  "description": "8 hours of AFK rewards claimed!",
  "rewards": {
    "gold": 5000,
    "gems": 100
  },
  "isSpecial": true
}
```

### Bonus Rewards

Activés lors d'événements spéciaux :

```json
{
  "bonusType": "vip",
  "multiplier": 2.0,
  "duration": -1,
  "source": "Enhanced AFK System Upgrade"
}
```

---

## Exemples avancés Unity

### 1. Manager AFK complet

```csharp
using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class AdvancedAfkManager : MonoBehaviour
{
    [Header("Network Settings")]
    public string apiBaseUrl = "https://your-api.com/api/afk";
    public float heartbeatInterval = 45f;
    public float statusUpdateInterval = 10f;

    [Header("UI References")]
    public AfkProgressTimer progressTimer;
    public AfkRewardsDisplay rewardsDisplay;
    public AfkClaimButton claimButton;
    public AfkUpgradePanel upgradePanel;

    private string jwtToken;
    private bool isAfkActive = false;
    private Coroutine heartbeatCoroutine;
    private Coroutine statusUpdateCoroutine;

    void Start()
    {
        jwtToken = PlayerPrefs.GetString("jwt_token");
        InitializeAfkSystem();
    }

    public void InitializeAfkSystem()
    {
        StartCoroutine(LoadInitialStatus());
    }

    IEnumerator LoadInitialStatus()
    {
        yield return StartCoroutine(GetAfkSummary());
        yield return StartCoroutine(StartAfkSession());
        
        StartHeartbeat();
        StartStatusUpdates();
    }

    void StartHeartbeat()
    {
        if (heartbeatCoroutine != null)
            StopCoroutine(heartbeatCoroutine);
            
        heartbeatCoroutine = StartCoroutine(HeartbeatLoop());
    }

    void StartStatusUpdates()
    {
        if (statusUpdateCoroutine != null)
            StopCoroutine(statusUpdateCoroutine);
            
        statusUpdateCoroutine = StartCoroutine(StatusUpdateLoop());
    }

    IEnumerator HeartbeatLoop()
    {
        while (isAfkActive)
        {
            yield return new WaitForSeconds(heartbeatInterval);
            yield return StartCoroutine(SendHeartbeat());
        }
    }

    IEnumerator StatusUpdateLoop()
    {
        while (isAfkActive)
        {
            yield return new WaitForSeconds(statusUpdateInterval);
            yield return StartCoroutine(GetAfkSummary());
        }
    }

    IEnumerator StartAfkSession()
    {
        string jsonBody = "{\"deviceId\":\"" + SystemInfo.deviceUniqueIdentifier + "\",\"source\":\"idle\"}";
        
        yield return StartCoroutine(PostRequest("/start", jsonBody, (response) =>
        {
            Debug.Log("AFK Session started");
            isAfkActive = true;
        }));
    }

    IEnumerator SendHeartbeat()
    {
        yield return StartCoroutine(PostRequest("/heartbeat", "{}", (response) =>
        {
            // Heartbeat successful
        }));
    }

    IEnumerator GetAfkSummary()
    {
        yield return StartCoroutine(GetRequest("/summary", (response) =>
        {
            AfkSummaryResponse summary = JsonUtility.FromJson<AfkSummaryResponse>(response);
            
            // Mettre à jour l'UI
            if (progressTimer != null)
                progressTimer.UpdateAfkData(summary.data);
                
            if (rewardsDisplay != null)
                rewardsDisplay.UpdateRewards(summary.data.pendingRewards);
                
            if (claimButton != null)
                claimButton.UpdateClaimButton(summary.data.totalValue > 0);
                
            if (upgradePanel != null && summary.data.canUpgrade)
                upgradePanel.ShowUpgradeOption();
        }));
    }

    public void ClaimRewards()
    {
        StartCoroutine(ClaimAfkRewards());
    }

    IEnumerator ClaimAfkRewards()
    {
        yield return StartCoroutine(PostRequest("/claim", "{}", (response) =>
        {
            AfkClaimResponse claimResponse = JsonUtility.FromJson<AfkClaimResponse>(response);
            
            // Déclencher animations
            if (rewardsDisplay != null)
                rewardsDisplay.PlayClaimAnimation(claimResponse.claimedRewards);
                
            // Mettre à jour ressources joueur
            GameManager.Instance.UpdatePlayerResources(claimResponse.playerUpdates);
            
            // Refresh status
            StartCoroutine(GetAfkSummary());
        }));
    }

    void OnApplicationPause(bool pauseStatus)
    {
        if (pauseStatus)
        {
            // App mise en pause
            StartCoroutine(StopAfkSession());
        }
        else
        {
            // App reprise
            StartCoroutine(StartAfkSession());
        }
    }

    void OnApplicationFocus(bool hasFocus)
    {
        if (!hasFocus)
        {
            StartCoroutine(ChangeAfkSource("offline"));
        }
        else
        {
            StartCoroutine(ChangeAfkSource("idle"));
        }
    }

    IEnumerator ChangeAfkSource(string newSource)
    {
        string jsonBody = "{\"source\":\"" + newSource + "\"}";
        yield return StartCoroutine(PostRequest("/heartbeat", jsonBody, null));
    }

    // Méthodes utilitaires pour requêtes HTTP
    IEnumerator GetRequest(string endpoint, System.Action<string> callback)
    {
        UnityWebRequest request = UnityWebRequest.Get(apiBaseUrl + endpoint);
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            callback?.Invoke(request.downloadHandler.text);
        }
        else
        {
            HandleError(request.error, (int)request.responseCode);
        }
    }

    IEnumerator PostRequest(string endpoint, string jsonBody, System.Action<string> callback)
    {
        UnityWebRequest request = new UnityWebRequest(apiBaseUrl + endpoint, "POST");
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        request.SetRequestHeader("Content-Type", "application/json");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success)
        {
            callback?.Invoke(request.downloadHandler.text);
        }
        else
        {
            HandleError(request.error, (int)request.responseCode);
        }
    }

    void HandleError(string error, int statusCode)
    {
        Debug.LogError("AFK Error: " + error + " (Status: " + statusCode + ")");
        
        switch (statusCode)
        {
            case 401:
                // Token expiré - rediriger vers login
                GameManager.Instance.ShowLoginScreen();
                break;
                
            case 429:
                // Trop de requêtes - réduire la fréquence
                heartbeatInterval = Mathf.Min(heartbeatInterval * 1.5f, 120f);
                break;
        }
    }

    void OnDestroy()
    {
        if (isAfkActive)
        {
            StartCoroutine(StopAfkSession());
        }
    }

    IEnumerator StopAfkSession()
    {
        isAfkActive = false;
        
        if (heartbeatCoroutine != null)
            StopCoroutine(heartbeatCoroutine);
            
        if (statusUpdateCoroutine != null)
            StopCoroutine(statusUpdateCoroutine);
        
        yield return StartCoroutine(PostRequest("/stop", "{}", (response) =>
        {
            Debug.Log("AFK Session stopped");
        }));
    }
}
```

### 2. Système de déblocages visuels

```csharp
using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class AfkUnlocksDisplay : MonoBehaviour
{
    [Header("Unlock UI")]
    public Transform unlocksContainer;
    public GameObject unlockItemPrefab;
    public Text progressText;
    public Slider progressSlider;
    
    [Header("Animation")]
    public ParticleSystem unlockParticles;
    public AudioSource unlockSound;

    private List<AfkUnlockItem> unlockItems = new List<AfkUnlockItem>();

    public void UpdateUnlocks(AfkUnlockInfo unlockInfo)
    {
        // Mettre à jour la progression globale
        progressText.text = unlockInfo.unlockedRewards.Length + "/" + 
                           (unlockInfo.unlockedRewards.Length + unlockInfo.nextUnlocks.Length);
        progressSlider.value = unlockInfo.progressPercentage / 100f;

        // Nettoyer l'affichage précédent
        foreach (AfkUnlockItem item in unlockItems)
        {
            if (item != null)
                Destroy(item.gameObject);
        }
        unlockItems.Clear();

        // Afficher les récompenses débloquées
        foreach (string unlockedReward in unlockInfo.unlockedRewards)
        {
            CreateUnlockItem(unlockedReward, true, "");
        }

        // Afficher les prochains déblocages
        foreach (AfkNextUnlock nextUnlock in unlockInfo.nextUnlocks)
        {
            CreateUnlockItem(nextUnlock.type, false, nextUnlock.requirement);
        }
    }

    void CreateUnlockItem(string rewardType, bool isUnlocked, string requirement)
    {
        GameObject itemObj = Instantiate(unlockItemPrefab, unlocksContainer);
        AfkUnlockItem item = itemObj.GetComponent<AfkUnlockItem>();
        
        if (item != null)
        {
            item.Setup(rewardType, isUnlocked, requirement);
            unlockItems.Add(item);
        }
    }

    public void PlayUnlockAnimation(string rewardType)
    {
        // Trouver l'item correspondant
        AfkUnlockItem item = unlockItems.Find(x => x.rewardType == rewardType);
        if (item != null)
        {
            item.PlayUnlockAnimation();
        }

        // Effets globaux
        if (unlockParticles != null)
            unlockParticles.Play();
            
        if (unlockSound != null)
            unlockSound.Play();
    }
}

public class AfkUnlockItem : MonoBehaviour
{
    [Header("UI References")]
    public Image iconImage;
    public Text nameText;
    public Text requirementText;
    public GameObject lockedOverlay;
    public Animator itemAnimator;

    [HideInInspector]
    public string rewardType;

    public void Setup(string type, bool isUnlocked, string requirement)
    {
        rewardType = type;
        
        // Configurer l'icône
        iconImage.sprite = GetRewardIcon(type);
        
        // Configurer le texte
        nameText.text = GetRewardDisplayName(type);
        requirementText.text = requirement;
        
        // État de déverouillage
        lockedOverlay.SetActive(!isUnlocked);
        iconImage.color = isUnlocked ? Color.white : Color.gray;
    }

    Sprite GetRewardIcon(string rewardType)
    {
        // Retourner l'icône appropriée
        return Resources.Load<Sprite>("Icons/Rewards/" + rewardType);
    }

    string GetRewardDisplayName(string rewardType)
    {
        switch (rewardType)
        {
            case "heroXP": return "Hero XP";
            case "ascensionEssences": return "Ascension Essences";
            case "gems": return "Gems";
            case "tickets": return "Summon Tickets";
            default: return rewardType;
        }
    }

    public void PlayUnlockAnimation()
    {
        if (itemAnimator != null)
            itemAnimator.SetTrigger("Unlock");
    }
}
```

---

## Support et maintenance

### Logs de debug

Pour activer les logs détaillés côté serveur :
```
DEBUG_AFK_VERBOSE=true
```

### Endpoints de test

**GET** `/api/afk/debug/validate-config`
Valide la configuration afkRewardsConfig.ts

**GET** `/api/afk/debug/player-status/{playerId}`
État détaillé d'un joueur spécifique

### Monitoring

**Métriques importantes à surveiller** :
- Temps moyen entre claims
- Taux d'adoption du mode Enhanced
- Distribution des déblocages par niveau
- Fréquence des heartbeats
- Erreurs de session AFK

---

**Version:** 1.0.0  
**Dernière mise à jour:** 17 octobre 2025  
**Système:** AFK Rewards avec déblocages progressifs

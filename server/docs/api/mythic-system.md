# 🔮 Mythic System API - Documentation pour Unity

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

Le système **Mythic Summon** est le système gacha ultime réservé aux joueurs endgame. Il permet d'invoquer des héros mythiques ultra-rares en utilisant des Parchemins Mythiques.

### Fonctionnalités principales

- ✅ **Compteur fusionné** : 80 pulls Standard/Limited → 1 Parchemin Mythique
- ✅ **Bannière dédiée** : Accès exclusif avec parchemins uniquement
- ✅ **Taux premium** : 5% Mythic / 95% Legendary (pas de Common/Rare/Epic)
- ✅ **Pity garanti** : Mythic assuré tous les 35 pulls
- ✅ **Héros exclusifs** : 2 héros Mythiques avec passifs uniques
- ✅ **Accumulation permanente** : Les parchemins ne périment jamais
- ✅ **Notifications temps réel** : Gain de parchemins et pulls mythiques

### Base URL

```
https://your-api-domain.com/api/mythic
```

---

## Endpoints API

### 1. Obtenir le statut mythique

**GET** `/api/mythic/status`

Récupère l'état complet du système mythique pour un joueur.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "data": {
    "hasData": true,
    "fusedCounter": 45,
    "scrollsAvailable": 0,
    "scrollsEarned": 0,
    "scrollsUsed": 0,
    "pullsUntilNextScroll": 35,
    "mythicPityCounter": 0,
    "pullsUntilMythicPity": 35,
    "mythicHeroesOwned": 0,
    "totalMythicPulls": 0,
    "lastScrollEarnedAt": null,
    "lastMythicPulledAt": null
  }
}
```

#### Réponse sans données (200)
```json
{
  "success": true,
  "data": {
    "hasData": false,
    "message": "No mythic data found. Perform Normal/Limited pulls to earn mythic scrolls."
  }
}
```

---

### 2. Effectuer un pull mythique

**POST** `/api/mythic/pull`

Effectue un ou plusieurs pulls sur la bannière mythique.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body
```json
{
  "bannerId": "mythic_eternal_001",
  "count": 1
}
```

**Paramètres :**
- `bannerId` (string, requis) : ID de la bannière mythique
- `count` (number, requis) : Nombre de pulls (1 ou 10)

#### Réponse succès (200)
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "hero": {
          "_id": "abc123",
          "name": "Kaorim (Lunar Form)",
          "rarity": "Mythic",
          "element": "Dark",
          "role": "DPS Melee"
        },
        "rarity": "Mythic",
        "isNew": true,
        "fragmentsGained": 0,
        "isMythic": true,
        "isPityTriggered": false
      }
    ],
    "stats": {
      "mythic": 1,
      "legendary": 0,
      "newHeroes": 1,
      "totalFragments": 0
    },
    "scrollsUsed": 1,
    "scrollsRemaining": 0,
    "pityStatus": {
      "mythicPullsSinceLast": 0,
      "pullsUntilMythicPity": 35
    },
    "bannerInfo": {
      "bannerId": "mythic_eternal_001",
      "name": "Eternal Mythic Summon"
    }
  }
}
```

#### Erreurs possibles
```json
{
  "success": false,
  "error": "Insufficient mythic scrolls. Required: 1, Available: 0",
  "code": "INSUFFICIENT_SCROLLS"
}
```

**Codes d'erreur :**
- `INSUFFICIENT_SCROLLS` : Pas assez de parchemins
- `BANNER_NOT_FOUND` : Bannière mythique introuvable ou inactive
- `AUTH_REQUIRED` : Token manquant ou invalide
- `INVALID_COUNT` : Count doit être 1 ou 10

---

### 3. Obtenir l'historique mythique

**GET** `/api/mythic/history`

Récupère l'historique des héros mythiques obtenus.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "heroId": "abc123",
        "obtainedAt": "2025-01-15T10:30:00.000Z",
        "bannerId": "mythic_eternal_001",
        "heroName": "Kaorim (Lunar Form)",
        "heroElement": "Dark"
      },
      {
        "heroId": "def456",
        "obtainedAt": "2025-01-20T14:45:00.000Z",
        "bannerId": "mythic_eternal_001",
        "heroName": "Kaorim (Solar Form)",
        "heroElement": "Light"
      }
    ],
    "totalMythicsObtained": 2
  }
}
```

---

### 4. Obtenir la bannière mythique

**GET** `/api/mythic/banner`

Récupère les informations de la bannière mythique active.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "success": true,
  "data": {
    "bannerId": "mythic_eternal_001",
    "name": "Eternal Mythic Summon",
    "type": "Mythic",
    "description": "The ultimate summoning ritual...",
    "rates": {
      "Common": 0,
      "Rare": 0,
      "Epic": 0,
      "Legendary": 95,
      "Mythic": 5
    },
    "costs": {
      "singlePull": {
        "mythicScrolls": 1
      },
      "multiPull": {
        "mythicScrolls": 10
      }
    },
    "pityConfig": {
      "legendaryPity": 35,
      "epicPity": 0,
      "sharedPity": false,
      "resetOnBannerEnd": false
    },
    "bannerImage": "https://cdn.placeholder.com/banners/mythic_eternal.png",
    "iconImage": "https://cdn.placeholder.com/icons/mythic_eternal_icon.png",
    "tags": ["mythic", "endgame", "premium", "permanent", "god-tier"],
    "endTime": "2035-01-01T00:00:00.000Z",
    "timeRemaining": 315360000000,
    "specialInfo": {
      "scrollCost": {
        "single": 1,
        "multi": 10
      },
      "pityThreshold": 35,
      "scrollEarnRate": "1 scroll per 80 Normal/Limited pulls"
    }
  }
}
```

#### Erreur bannière inactive (404)
```json
{
  "success": false,
  "error": "No active mythic banner found",
  "code": "BANNER_NOT_FOUND"
}
```

---

### 5. Informations système

**GET** `/api/mythic/info`

Obtient les informations générales sur le système mythique (pas d'authentification requise).

#### Réponse succès (200)
```json
{
  "success": true,
  "data": {
    "systemName": "Mythic Summoning System",
    "description": "The ultimate gacha system for endgame players",
    "requirements": {
      "scrollEarning": "Perform 80 pulls on Standard or Limited banners to earn 1 Mythic Scroll",
      "scrollUse": "Use Mythic Scrolls to pull on the Eternal Mythic Summon banner"
    },
    "rates": {
      "mythic": "5%",
      "legendary": "95%"
    },
    "pity": {
      "threshold": 35,
      "description": "Guaranteed Mythic hero after 35 pulls without one"
    },
    "features": [
      "Fused pull counter (Standard + Limited)",
      "Permanent scroll accumulation",
      "Exclusive Mythic heroes with unique passives",
      "Separate pity system from other banners"
    ]
  }
}
```

---

## Modèles de données

### Mythic Pull Result

```csharp
[System.Serializable]
public class MythicPullResult
{
    public HeroData hero;
    public string rarity;        // "Mythic" ou "Legendary"
    public bool isNew;           // Nouveau héros ?
    public int fragmentsGained;  // Fragments si dupliqué
    public bool isMythic;        // true si Mythic
    public bool isPityTriggered; // Pity déclenché ?
}

[System.Serializable]
public class HeroData
{
    public string _id;
    public string name;
    public string rarity;
    public string element;
    public string role;
}
```

### Mythic Status

```csharp
[System.Serializable]
public class MythicStatus
{
    public bool hasData;
    public int fusedCounter;           // Compteur Normal + Limited (0-79)
    public int scrollsAvailable;       // Parchemins disponibles
    public int scrollsEarned;          // Total parchemins gagnés (lifetime)
    public int scrollsUsed;            // Total parchemins utilisés (lifetime)
    public int pullsUntilNextScroll;   // Pulls restants avant prochain parchemin
    public int mythicPityCounter;      // Pulls mythiques depuis dernier Mythic
    public int pullsUntilMythicPity;   // Pulls restants avant pity Mythic
    public int mythicHeroesOwned;      // Nombre de Mythics possédés
    public int totalMythicPulls;       // Total pulls mythiques (lifetime)
    public string lastScrollEarnedAt;  // ISO timestamp
    public string lastMythicPulledAt;  // ISO timestamp
}
```

### Mythic Pull Stats

```csharp
[System.Serializable]
public class MythicPullStats
{
    public int mythic;         // Nombre de Mythics obtenus
    public int legendary;      // Nombre de Legendary obtenus
    public int newHeroes;      // Nouveaux héros
    public int totalFragments; // Fragments totaux
}
```

### Mythic Pity Status

```csharp
[System.Serializable]
public class MythicPityStatus
{
    public int mythicPullsSinceLast;  // Pulls depuis dernier Mythic
    public int pullsUntilMythicPity;  // Pulls restants avant garanti
}
```

---

## Événements WebSocket

### Connection

**Note :** Les événements mythiques sont automatiquement envoyés lors des pulls Standard/Limited (gain de parchemins) et des pulls Mythiques.

---

### Événements reçus (Serveur → Client)

#### 1. Parchemin mythique gagné

**Event:** `gacha:pity_progress`

Déclenché automatiquement quand un joueur atteint 80 pulls fusionnés.

```json
{
  "bannerId": "mythic_system",
  "bannerName": "Mythic Scroll System",
  "currentPulls": 80,
  "pityThreshold": 80,
  "pullsRemaining": 0,
  "pityType": "mythic",
  "progressPercentage": 100,
  "isSharedPity": true
}
```

**Gestion Unity :**
```csharp
socket.On("gacha:pity_progress", response => 
{
    var data = response.GetValue<PityProgressData>();
    
    if (data.pityType == "mythic" && data.pullsRemaining == 0)
    {
        ShowMythicScrollEarnedPopup();
        PlayMythicScrollAnimation();
        UpdateScrollCount();
    }
});
```

---

#### 2. Pull mythique effectué

**Event:** `gacha:legendary_drop`

Réutilise l'événement legendary pour les Mythics (même logique).

```json
{
  "hero": {
    "id": "abc123",
    "name": "Kaorim (Lunar Form)",
    "rarity": "Mythic",
    "element": "Dark",
    "role": "DPS Melee"
  },
  "bannerId": "mythic_eternal_001",
  "bannerName": "Eternal Mythic Summon",
  "isFirstTime": true,
  "isFocus": false,
  "pullsSinceLast": 0,
  "totalLegendaryCount": 1,
  "dropRate": 5
}
```

**Gestion Unity :**
```csharp
socket.On("gacha:legendary_drop", response => 
{
    var data = response.GetValue<LegendaryDropData>();
    
    if (data.hero.rarity == "Mythic")
    {
        ShowMythicHeroAnimation(data.hero);
        PlayCelebrationEffects();
        UpdateMythicCollection();
    }
});
```

---

#### 3. Pity mythique proche

**Event:** `gacha:pity_progress`

Envoyé tous les pulls mythiques pour suivre la progression.

```json
{
  "bannerId": "mythic_eternal_001",
  "bannerName": "Eternal Mythic Summon",
  "currentPulls": 30,
  "pityThreshold": 35,
  "pullsRemaining": 5,
  "pityType": "legendary",
  "progressPercentage": 85.7,
  "isSharedPity": false
}
```

**Gestion Unity :**
```csharp
socket.On("gacha:pity_progress", response => 
{
    var data = response.GetValue<PityProgressData>();
    
    if (data.bannerId == "mythic_eternal_001" && data.pullsRemaining <= 5)
    {
        ShowPityWarning($"Mythic garanti dans {data.pullsRemaining} pulls !");
        EnablePityIndicator();
    }
});
```

---

## Labels i18n

Tous les textes sont envoyés sous forme de **labels i18n**. Le client Unity doit les traduire localement.

### Labels principaux

```csharp
// Système
"MYTHIC_SYSTEM_INFO" = "Système d'Invocation Mythique"
"MYTHIC_SCROLL_EARNED" = "Parchemin Mythique obtenu !"
"MYTHIC_SCROLL_AVAILABLE" = "{count} Parchemin(s) Mythique(s) disponible(s)"
"MYTHIC_PULL_SUCCESS" = "Pull Mythique réussi !"

// Héros
"MYTHIC_HERO_OBTAINED" = "Héros Mythique obtenu : {heroName} !"
"MYTHIC_HERO_DUPLICATE" = "Héros Mythique dupliqué : +{fragments} fragments"
"MYTHIC_HERO_NEW" = "Nouveau Héros Mythique !"

// Pity
"MYTHIC_PITY_PROGRESS" = "Pity Mythique : {current}/{max}"
"MYTHIC_PITY_TRIGGERED" = "Pity Mythique déclenché ! Héros garanti !"
"MYTHIC_PITY_RESET" = "Pity Mythique réinitialisé"

// Compteur fusionné
"FUSED_COUNTER_PROGRESS" = "Compteur fusionné : {current}/80"
"FUSED_COUNTER_COMPLETE" = "80 pulls atteints ! Parchemin Mythique gagné !"
"NEXT_SCROLL_IN" = "Prochain parchemin dans {pulls} pulls"

// Bannière
"MYTHIC_BANNER_TITLE" = "Invocation Éternelle Mythique"
"MYTHIC_BANNER_DESCRIPTION" = "La bannière ultime pour les joueurs endgame"
"MYTHIC_BANNER_RATES" = "5% Mythic / 95% Legendary"
"MYTHIC_BANNER_COST" = "Coût : {count} Parchemin(s) Mythique(s)"

// Erreurs
"INSUFFICIENT_SCROLLS" = "Parchemins Mythiques insuffisants"
"MYTHIC_BANNER_NOT_FOUND" = "Bannière Mythique introuvable"
"MYTHIC_PULL_FAILED" = "Échec du pull Mythique"

// Info
"MYTHIC_EARN_RATE" = "Gagnez 1 parchemin tous les 80 pulls Standard/Limited"
"MYTHIC_PITY_INFO" = "Mythique garanti tous les 35 pulls"
"MYTHIC_PERMANENT_SCROLLS" = "Les parchemins n'expirent jamais"
```

### Tiers de rareté

```csharp
"MYTHIC" = "Mythique"
"LEGENDARY" = "Légendaire"
```

---

## Exemples d'intégration Unity

### 1. Récupérer le statut au lancement

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class MythicSystemManager : MonoBehaviour
{
    private string baseURL = "https://your-api.com/api/mythic";
    private string jwtToken;

    public IEnumerator GetMythicStatus()
    {
        UnityWebRequest request = UnityWebRequest.Get($"{baseURL}/status");
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            MythicStatusResponse response = 
                JsonUtility.FromJson<MythicStatusResponse>(request.downloadHandler.text);
            
            if (response.success && response.data.hasData)
            {
                UpdateMythicUI(response.data);
                ShowScrollCount(response.data.scrollsAvailable);
                ShowPityProgress(response.data.mythicPityCounter, 35);
                ShowFusedCounter(response.data.fusedCounter, 80);
            }
            else
            {
                ShowInfoPanel("Effectuez 80 pulls pour gagner votre premier parchemin !");
            }
        }
    }
}
```

---

### 2. Effectuer un pull mythique

```csharp
public IEnumerator PerformMythicPull(int count = 1)
{
    // Vérifier les parchemins disponibles
    if (currentScrolls < count)
    {
        ShowError(I18n.Get("INSUFFICIENT_SCROLLS"));
        yield break;
    }

    string jsonBody = JsonUtility.ToJson(new MythicPullRequest
    {
        bannerId = "mythic_eternal_001",
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
        MythicPullResponse response = 
            JsonUtility.FromJson<MythicPullResponse>(request.downloadHandler.text);
        
        if (response.success)
        {
            // Afficher les résultats
            foreach (var result in response.data.results)
            {
                if (result.isMythic)
                {
                    PlayMythicSummonAnimation(result.hero);
                }
                else
                {
                    PlayLegendarySummonAnimation(result.hero);
                }
            }

            // Mettre à jour l'UI
            UpdateScrollCount(response.data.scrollsRemaining);
            UpdatePityProgress(response.data.pityStatus);
            ShowPullStats(response.data.stats);
        }
        else
        {
            ShowError(I18n.Get(response.error));
        }
    }
}

[System.Serializable]
public class MythicPullRequest
{
    public string bannerId;
    public int count;
}
```

---

### 3. Afficher le compteur fusionné

```csharp
public class FusedCounterUI : MonoBehaviour
{
    public Text counterText;
    public Slider progressBar;
    public ParticleSystem scrollEarnedFX;

    private int currentCounter = 0;
    private int maxCounter = 80;

    public void UpdateCounter(int newValue)
    {
        int oldValue = currentCounter;
        currentCounter = newValue;

        // Animer le compteur
        StartCoroutine(AnimateCounter(oldValue, newValue));

        // Mettre à jour la barre de progression
        progressBar.value = (float)newValue / maxCounter;

        // Si parchemin gagné
        if (newValue == 0 && oldValue > 70)
        {
            PlayScrollEarnedAnimation();
        }
    }

    private IEnumerator AnimateCounter(int from, int to)
    {
        float duration = 0.5f;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            int current = Mathf.RoundToInt(Mathf.Lerp(from, to, elapsed / duration));
            counterText.text = $"{current} / {maxCounter}";
            yield return null;
        }

        counterText.text = $"{to} / {maxCounter}";
    }

    private void PlayScrollEarnedAnimation()
    {
        scrollEarnedFX.Play();
        // Afficher popup de félicitations
        PopupManager.Show("MYTHIC_SCROLL_EARNED");
    }
}
```

---

### 4. Gérer les WebSocket pour les parchemins

```csharp
using SocketIOClient;

public class MythicWebSocketHandler : MonoBehaviour
{
    private SocketIO socket;
    private MythicSystemManager mythicManager;

    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        mythicManager = GetComponent<MythicSystemManager>();
        
        // Événement progression compteur fusionné
        socket.On("gacha:pity_progress", response =>
        {
            var data = response.GetValue<PityProgressData>();
            
            // Si c'est le système mythique
            if (data.pityType == "mythic" && data.isSharedPity)
            {
                // Mettre à jour le compteur fusionné
                int counter = data.currentPulls % 80;
                mythicManager.UpdateFusedCounter(counter);

                // Si parchemin gagné
                if (counter == 0 && data.currentPulls > 0)
                {
                    ShowMythicScrollEarnedPopup();
                    mythicManager.RefreshScrollCount();
                }
            }
        });

        // Événement pull Mythique
        socket.On("gacha:legendary_drop", response =>
        {
            var data = response.GetValue<LegendaryDropData>();
            
            if (data.hero.rarity == "Mythic")
            {
                PlayMythicCelebration(data);
                NotificationManager.ShowGlobal($"🔮 {data.hero.name} obtenu !");
            }
        });

        socket.ConnectAsync();
    }

    private void ShowMythicScrollEarnedPopup()
    {
        PopupManager.Show(
            title: I18n.Get("MYTHIC_SCROLL_EARNED"),
            message: I18n.Get("FUSED_COUNTER_COMPLETE"),
            icon: "scroll_mythic",
            animation: "celebrate"
        );
    }

    private void PlayMythicCelebration(LegendaryDropData data)
    {
        // Animation spéciale pour Mythique
        CelebrationManager.PlayMythicAnimation();
        ScreenEffects.FlashGolden();
        AudioManager.PlaySound("mythic_summon");
        
        // Afficher le héros
        HeroRevealPopup.Show(data.hero);
    }
}
```

---

### 5. UI Bannière Mythique

```csharp
public class MythicBannerUI : MonoBehaviour
{
    public Text bannerName;
    public Text bannerDescription;
    public Text mythicRate;
    public Text pityInfo;
    public Text scrollCost;
    public Button pullButton;
    public Text scrollsAvailableText;

    private MythicBannerData currentBanner;
    private int availableScrolls = 0;

    public IEnumerator LoadBanner()
    {
        yield return StartCoroutine(GetBannerInfo());
        yield return StartCoroutine(GetPlayerStatus());
        
        UpdateUI();
    }

    private void UpdateUI()
    {
        if (currentBanner == null) return;

        bannerName.text = currentBanner.name;
        bannerDescription.text = currentBanner.description;
        mythicRate.text = $"🔮 {currentBanner.rates.Mythic}% Mythic";
        pityInfo.text = $"Garanti tous les {currentBanner.pityConfig.legendaryPity} pulls";
        scrollCost.text = $"Coût : {currentBanner.costs.singlePull.mythicScrolls} Parchemin";
        scrollsAvailableText.text = $"Disponibles : {availableScrolls}";

        // Activer/désactiver le bouton
        pullButton.interactable = availableScrolls > 0;
    }

    public void OnPullButtonClick()
    {
        if (availableScrolls >= 1)
        {
            StartCoroutine(PerformPull(1));
        }
        else
        {
            ShowInsufficientScrollsPopup();
        }
    }

    public void OnMultiPullButtonClick()
    {
        if (availableScrolls >= 10)
        {
            StartCoroutine(PerformPull(10));
        }
        else
        {
            ShowInsufficientScrollsPopup();
        }
    }

    private void ShowInsufficientScrollsPopup()
    {
        PopupManager.Show(
            title: I18n.Get("INSUFFICIENT_SCROLLS"),
            message: I18n.Get("MYTHIC_EARN_RATE"),
            buttons: new[] { "OK" }
        );
    }
}
```

---

## Gestion des erreurs

### Codes d'erreur HTTP

| Code | Signification | Action recommandée |
|------|--------------|-------------------|
| 200 | Succès | Traiter la réponse normalement |
| 400 | Requête invalide | Vérifier count (1 ou 10) |
| 401 | Non authentifié | Redemander le login |
| 404 | Bannière introuvable | Vérifier que la bannière mythique est active |
| 500 | Erreur serveur | Afficher message d'erreur générique |

### Gestion des erreurs métier

```csharp
public void HandleMythicError(string errorCode)
{
    switch (errorCode)
    {
        case "INSUFFICIENT_SCROLLS":
            // Afficher combien de pulls restants
            int remaining = 80 - fusedCounter;
            ShowError($"Il vous faut encore {remaining} pulls Standard/Limited");
            break;

        case "BANNER_NOT_FOUND":
            // Bannière désactivée temporairement
            ShowError("La bannière mythique est temporairement indisponible");
            DisableMythicTab();
            break;

        case "INVALID_COUNT":
            // Erreur de validation
            ShowError("Nombre de pulls invalide (1 ou 10 seulement)");
            break;

        case "AUTH_REQUIRED":
            // Token expiré
            AuthManager.Instance.RefreshToken();
            break;

        default:
            ShowError("Une erreur est survenue");
            break;
    }
}
```

### Retry Logic

```csharp
public IEnumerator PullWithRetry(int count, int maxRetries = 3)
{
    int attempts = 0;
    
    while (attempts < maxRetries)
    {
        yield return PerformMythicPull(count);
        
        if (lastPullSuccess)
        {
            yield break; // Succès
        }
        
        attempts++;
        
        // Backoff exponentiel
        yield return new WaitForSeconds(Mathf.Pow(2, attempts));
    }
    
    ShowError("Impossible de réaliser le pull après plusieurs tentatives");
}
```

---

## Best Practices

### ✅ À faire

1. **Toujours afficher le compteur fusionné** de manière visible
2. **Célébrer visuellement** les gains de parchemins mythiques
3. **Utiliser des animations spéciales** pour les pulls Mythiques
4. **Afficher clairement le pity** (XX/35 pulls)
5. **Montrer la rareté** avec des effets visuels premium
6. **Sauvegarder le statut** localement pour éviter requêtes inutiles
7. **Utiliser WebSocket** pour notifications temps réel
8. **Avertir le joueur** quand le pity approche (< 5 pulls)
9. **Afficher l'historique** des Mythics obtenus
10. **Donner un contexte** sur comment gagner des parchemins

### ❌ À éviter

1. Ne **jamais stocker** les parchemins côté client
2. Ne **jamais simuler** les pulls côté client
3. Ne pas spammer l'API (respecter le rate limiting)
4. Ne pas pull automatiquement sans confirmation utilisateur
5. Ne pas masquer le coût réel des parchemins (80 pulls = 1 parchemin)
6. Ne pas promettre de taux qui ne correspondent pas à l'API
7. Ne pas oublier d'afficher les stats de pity

---

## Flow complet d'utilisation

### Scénario 1 : Premier joueur

```
1. Joueur lance le jeu
   ├─ GET /api/mythic/status
   └─ Réponse : hasData = false

2. Afficher panneau info
   ├─ "Effectuez 80 pulls Standard/Limited pour gagner votre premier parchemin"
   └─ Bouton "Aller à la Taverne"

3. Joueur fait 10 pulls Standard
   ├─ POST /api/gacha/pull (Standard)
   ├─ Système incrémente fusedCounter : 10/80
   └─ WebSocket : gacha:pity_progress (mythic, 10/80)

4. Afficher compteur fusionné
   └─ "Compteur Mythique : 10/80"

5. Joueur continue... 70 pulls plus tard
   ├─ fusedCounter = 80/80
   ├─ WebSocket : gacha:pity_progress (100%)
   └─ 🎉 Popup "Parchemin Mythique gagné !"

6. Joueur va sur bannière mythique
   ├─ GET /api/mythic/banner
   ├─ GET /api/mythic/status
   └─ Affichage : 1 parchemin disponible

7. Joueur effectue 1 pull mythique
   ├─ POST /api/mythic/pull (count: 1)
   ├─ Résultat : Legendary (malchance)
   └─ Pity : 1/35

8. Joueur continue... 34 pulls plus tard
   ├─ Pity : 35/35
   ├─ Pull mythique déclenche pity
   └─ 🔮 Mythic garanti obtenu !
```

---

### Scénario 2 : Joueur vétéran

```
1. Joueur se connecte
   ├─ GET /api/mythic/status
   └─ Réponse : 
       - scrollsAvailable: 5
       - mythicPityCounter: 20
       - mythicHeroesOwned: 1

2. Afficher l'UI enrichie
   ├─ "5 Parchemins disponibles"
   ├─ "Pity : 20/35 pulls"
   └─ "1/2 Héros Mythiques obtenus"

3. Joueur fait 10 pulls mythiques
   ├─ POST /api/mythic/pull (count: 10)
   ├─ Résultats : 
   │   - 9 Legendary
   │   - 1 Mythic (pull #5, pas de pity)
   └─ Pity reset : 5/35

4. Afficher les résultats
   ├─ Animation 10-pull avec révélation progressive
   ├─ Célébration spéciale pour le Mythic
   └─ Mise à jour collection : 2/2 Mythics

5. Joueur consulte son historique
   ├─ GET /api/mythic/history
   └─ Affichage des 2 Mythics avec dates
```

---

## Diagrammes de flux

### Flux d'obtention d'un parchemin

```
┌─────────────────────────────────────────┐
│   Joueur fait un pull Standard/Limited  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  GachaService.performPullOnBanner()     │
│  ├─ Traite le pull normalement          │
│  └─ Appelle MythicService.increment()   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  MythicService.incrementFusedCounter()  │
│  ├─ fusedPullCounter += count           │
│  └─ Vérifie si ≥ 80                     │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
    < 80 │           │ ≥ 80
         │           │
         ▼           ▼
    ┌────────┐  ┌──────────────────┐
    │  Rien  │  │ Octroie 1 scroll │
    └────────┘  │ Reset compteur   │
                │ WebSocket notif  │
                └─────┬────────────┘
                      │
                      ▼
                ┌──────────────────┐
                │  Joueur notifié  │
                │  🎁 Parchemin !  │
                └──────────────────┘
```

---

### Flux d'un pull mythique

```
┌─────────────────────────────────────────┐
│  Joueur clique "Pull Mythique"          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Vérification parchemins disponibles    │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
    Oui  │           │ Non
         │           │
         ▼           ▼
    ┌────────┐  ┌──────────────┐
    │ Suite  │  │ Erreur popup │
    └───┬────┘  └──────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  POST /api/mythic/pull                  │
│  ├─ Vérifie pity (35 pulls ?)           │
│  ├─ Force Mythic si pity                │
│  └─ Sinon roll 5% Mythic / 95% Legendary│
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
    Mythic│           │ Legendary
         │           │
         ▼           ▼
    ┌──────────┐  ┌─────────────┐
    │ Reset    │  │ Pity +1     │
    │ pity = 0 │  │ Continue    │
    └────┬─────┘  └──────┬──────┘
         │                │
         └────────┬───────┘
                  │
                  ▼
         ┌────────────────┐
         │ Déduire scroll │
         │ Retour résultat│
         └────────┬───────┘
                  │
                  ▼
         ┌────────────────┐
         │ Animation pull │
         │ Révélation hero│
         └────────────────┘
```

---

## Calculs et formules

### Progression du compteur fusionné

```
Formule : fusedCounter = (totalPulls % 80)
Parchemins gagnés = Math.floor(totalPulls / 80)

Exemple :
- 0 pulls   → 0 parchemins, counter = 0/80
- 40 pulls  → 0 parchemins, counter = 40/80
- 80 pulls  → 1 parchemin,  counter = 0/80
- 160 pulls → 2 parchemins, counter = 0/80
- 170 pulls → 2 parchemins, counter = 10/80
```

### Probabilités de pull mythique

```csharp
// Sans pity (pull 1-34)
float mythicChance = 5f;  // 5%
float legendaryChance = 95f;  // 95%

// Avec pity (pull 35)
float mythicChance = 100f;  // 100% garanti

// Probabilité d'obtenir au moins 1 Mythic en X pulls
float probability = 1 - Mathf.Pow(0.95f, pulls);

Exemples :
- 10 pulls  : 40.1%
- 20 pulls  : 64.2%
- 35 pulls  : 100% (pity)
- 50 pulls  : 100% (pity atteint avant)
```

### Valeur des parchemins

```
1 parchemin = 80 pulls Standard/Limited
1 pull Standard = 300 gems
1 parchemin = 24 000 gems équivalent

Multi-pull mythique (10x) = 10 parchemins
= 800 pulls Standard = 240 000 gems équivalent
```

---

## Paramètres de configuration

### Valeurs par défaut

```json
{
  "fusedPullsPerScroll": 80,
  "mythicPityThreshold": 35,
  "scrollCostSingle": 1,
  "scrollCostMulti": 10,
  "mythicRate": 5.0,
  "legendaryRate": 95.0,
  "scrollsNeverExpire": true
}
```

---

## Statistiques et Analytics

### Événements à tracker

```csharp
// Événements recommandés pour analytics
Analytics.LogEvent("mythic_scroll_earned", new Dictionary<string, object>
{
    { "total_scrolls_earned", totalScrolls },
    { "player_level", playerLevel },
    { "days_since_install", daysSinceInstall }
});

Analytics.LogEvent("mythic_pull_performed", new Dictionary<string, object>
{
    { "pull_count", count },
    { "result_rarity", rarity },
    { "pity_counter", pityCounter },
    { "is_new_hero", isNew }
});

Analytics.LogEvent("mythic_hero_obtained", new Dictionary<string, object>
{
    { "hero_name", heroName },
    { "hero_element", element },
    { "total_mythics_owned", totalOwned },
    { "pull_number", pullNumber }
});

Analytics.LogEvent("mythic_pity_triggered", new Dictionary<string, object>
{
    { "pulls_to_pity", 35 },
    { "total_scrolls_used", totalScrollsUsed }
});
```

---

## Testing

### Checklist de tests

```
✅ Fonctionnel
  ├─ [  ] Compteur fusionné s'incrémente correctement
  ├─ [  ] Parchemin octroyé à 80 pulls
  ├─ [  ] Compteur reset après 80 pulls
  ├─ [  ] Pull mythique déduit 1 parchemin
  ├─ [  ] Multi-pull déduit 10 parchemins
  ├─ [  ] Pity déclenché à 35 pulls
  ├─ [  ] Pity reset après Mythic
  ├─ [  ] Taux 5% Mythic / 95% Legendary respectés
  ├─ [  ] Nouveau héros ajouté au roster
  ├─ [  ] Héros dupliqué → fragments
  └─ [  ] Historique enregistre les Mythics

✅ UI/UX
  ├─ [  ] Compteur fusionné visible et clair
  ├─ [  ] Animation gain de parchemin
  ├─ [  ] Animation pull mythique (spéciale)
  ├─ [  ] Pity clairement affiché
  ├─ [  ] Coût en parchemins visible
  ├─ [  ] Boutons désactivés si pas assez
  ├─ [  ] Popup confirmation avant pull
  └─ [  ] Historique accessible

✅ WebSocket
  ├─ [  ] Notification gain parchemin temps réel
  ├─ [  ] Notification pull mythique
  └─ [  ] Notification pity approche

✅ Erreurs
  ├─ [  ] Parchemins insuffisants → erreur claire
  ├─ [  ] Bannière inactive → message adapté
  ├─ [  ] Token invalide → redirect login
  └─ [  ] Erreur serveur → retry automatique
```

### Cas de test Edge Cases

```csharp
// Test 1 : Exactement 80 pulls
// Expected : 1 parchemin gagné, counter = 0

// Test 2 : 79 puis 1 pull
// Expected : Premier = 79/80, Second = 0/80 + 1 parchemin

// Test 3 : Pull mythique sans parchemin
// Expected : Erreur INSUFFICIENT_SCROLLS

// Test 4 : Multi-pull avec 5 parchemins
// Expected : Erreur (besoin 10)

// Test 5 : Pity à 34, puis 10-pull
// Expected : Premier pull du 10-pull = Mythic garanti

// Test 6 : Token expiré pendant pull
// Expected : Erreur 401, redirect login
```

---

## Troubleshooting

### Problème : Compteur fusionné ne s'incrémente pas

**Causes possibles :**
1. Pulls effectués sur bannière Mythique (pas comptés)
2. Pulls effectués sur bannière Élémentaire (pas comptés)
3. WebSocket déconnecté

**Solution :**
```csharp
// Forcer refresh du statut
StartCoroutine(mythicManager.GetMythicStatus());

// Vérifier que les pulls sont Standard/Limited
Debug.Log($"Banner type: {currentBanner.type}");
// Expected: "Standard" ou "Limited"
```

---

### Problème : Parchemin non reçu après 80 pulls

**Causes possibles :**
1. Compteur pas à jour côté client
2. Erreur serveur lors de l'octroi
3. Pulls répartis sur plusieurs sessions

**Solution :**
```csharp
// 1. Vérifier le statut serveur
yield return GetMythicStatus();

// 2. Vérifier les logs serveur
// Chercher : "🎁 X mythic scroll(s) earned!"

// 3. Si discordance, contacter support avec :
// - PlayerId
// - Timestamp du 80ème pull
// - Screenshot du compteur
```

---

### Problème : Pull mythique échoue avec INSUFFICIENT_SCROLLS

**Causes possibles :**
1. État client désynchronisé
2. Autre appareil a utilisé les parchemins
3. Bug d'affichage

**Solution :**
```csharp
// Forcer refresh avant tout pull
public IEnumerator SafeMythicPull(int count)
{
    // 1. Refresh statut
    yield return GetMythicStatus();
    
    // 2. Vérifier à nouveau
    if (currentStatus.scrollsAvailable >= count)
    {
        yield return PerformMythicPull(count);
    }
    else
    {
        ShowError($"Parchemins insuffisants : {currentStatus.scrollsAvailable}/{count}");
    }
}
```

---

### Problème : Pity ne se déclenche pas à 35 pulls

**Causes possibles :**
1. Compteur pity réinitialisé par erreur
2. Mythic obtenu avant le 35ème pull
3. État client désynchronisé

**Solution :**
```csharp
// Vérifier l'historique
yield return GetMythicHistory();

// Compter les pulls depuis le dernier Mythic
int pullsSinceLastMythic = CalculatePullsSinceLastMythic(history);

// Si ≥ 35, le prochain pull DOIT être Mythic
if (pullsSinceLastMythic >= 35)
{
    Debug.LogWarning("Pity should trigger on next pull!");
}
```

---

## Changelog

### Version 1.0.0 (Janvier 2025)
- 🎉 Release initiale du système mythique
- ✅ Compteur fusionné Standard + Limited
- ✅ 2 héros mythiques : Kaorim (Lunar/Solar Form)
- ✅ Pity garanti à 35 pulls
- ✅ Taux 5% Mythic / 95% Legendary
- ✅ Parchemins permanents (n'expirent jamais)
- ✅ Notifications WebSocket temps réel
- ✅ API complète (5 endpoints)

### Version 1.1.0 (À venir)
- 🔜 4 héros mythiques supplémentaires (1 par élément restant)
- 🔜 Événements temporaires avec bonus parchemins
- 🔜 Leaderboard des premiers obtenteurs
- 🔜 Système de pity partagé entre bannières mythiques
- 🔜 Achievements pour collections mythiques

---

## Support et Contact

### En cas de problème

1. **Vérifier cette documentation** en premier
2. **Consulter les logs serveur** pour erreurs détaillées
3. **Tester avec Postman** pour isoler le problème
4. **Vérifier la console Unity** pour erreurs client

### Informations à fournir

```
Lors d'un rapport de bug, inclure :
- PlayerId
- ServerId
- Endpoint concerné
- Request body (si POST)
- Response complète
- Logs Unity (20 dernières lignes)
- Screenshot de l'UI
- Étapes pour reproduire
```

---

**Version:** 1.0.0  
**Dernière mise à jour:** 1 Octobre 2025  
**Auteur:** Soulspire Backend Team  
**Status:** Production Ready ✅

# ⚔️ Battle Setup API - Documentation pour Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Endpoints API](#endpoints-api)
3. [Modèles de données](#modèles-de-données)
4. [Workflow complet](#workflow-complet)
5. [Exemples d'intégration Unity](#exemples-dintégration-unity)
6. [Gestion des erreurs](#gestion-des-erreurs)
7. [Best Practices](#best-practices)

---

## Vue d'ensemble

Le système **Battle Setup** permet aux joueurs de prévisualiser, valider et configurer leurs formations avant de lancer un combat.

### Fonctionnalités principales

- ✅ **Preview de niveau** : Voir ennemis, formation actuelle, estimation victoire
- ✅ **Validation temporaire** : Tester une formation sans la sauvegarder
- ✅ **Estimation de victoire** : Pourcentage de chance basé sur la puissance
- ✅ **Bonus de synergie** : Affichage des bonus élémentaires (Fire, Water, etc.)
- ✅ **Recommandations** : Suggestions d'amélioration de formation
- ✅ **Sauvegarde optionnelle** : Sauvegarder la formation après validation
- ✅ **Arène preview** : Comparer sa puissance vs adversaire

### Workflow type (AFK Arena style)

```
1. GET /preview → Voir le niveau + formation actuelle
2. POST /validate → Tester une nouvelle formation (optionnel)
3. POST /confirm → Lancer le combat avec la formation finale
```

### Base URL

```
https://your-api-domain.com/api/battle-setup
```

---

## Endpoints API

### 1. Preview d'un niveau de campagne

**GET** `/api/battle-setup/campaign/preview`

Prévisualise un niveau avant placement des héros.

#### Query Parameters
- `worldId` (requis) : ID du monde (1-100)
- `levelId` (requis) : ID du niveau (1-50)
- `difficulty` (optionnel) : "Normal", "Hard", "Nightmare" (défaut: "Normal")

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Battle preview retrieved successfully",
  "preview": {
    "level": {
      "worldId": 1,
      "levelId": 5,
      "difficulty": "Normal",
      "enemyType": "elite",
      "recommended": true
    },
    "playerFormation": {
      "formationId": "FORM_abc123",
      "name": "Formation 1",
      "slots": [
        {
          "slot": 1,
          "heroId": "HERO_xyz789"
        }
      ],
      "heroes": [
        {
          "heroId": "HERO_xyz789",
          "position": 1,
          "name": "Ignara",
          "role": "Tank",
          "element": "Fire",
          "rarity": "Epic",
          "level": 20,
          "stars": 3
        }
      ],
      "totalPower": 3500,
      "stats": {
        "totalPower": 3500,
        "heroCount": 5,
        "roleDistribution": {
          "Tank": 2,
          "DPS Melee": 2,
          "Support": 1
        },
        "elementDistribution": {
          "Fire": 2,
          "Water": 2,
          "Wind": 1
        },
        "synergyBonuses": {
          "hp": 5,
          "atk": 5,
          "def": 5
        },
        "synergyDetails": [
          {
            "element": "Fire",
            "count": 2,
            "bonus": { "hp": 5, "atk": 5, "def": 5 },
            "isRare": false
          }
        ]
      }
    },
    "enemies": {
      "count": 4,
      "averageLevel": 22,
      "totalPower": 3200,
      "composition": [
        {
          "name": "Elite Guardian",
          "role": "Tank",
          "element": "Water",
          "rarity": "Epic",
          "level": 22,
          "position": 1
        }
      ]
    },
    "estimation": {
      "victoryChance": 75,
      "difficulty": "easy",
      "powerDifference": 9,
      "recommendations": []
    },
    "progress": {
      "attempts": 2,
      "victories": 1,
      "bestTime": 45000,
      "canSkip": false
    },
    "canStart": true,
    "warnings": []
  }
}
```

#### Erreurs possibles
```json
{
  "error": "Player not found",
  "code": "PLAYER_NOT_FOUND"
}
```

**Codes d'erreur :**
- `PLAYER_NOT_FOUND` : Joueur introuvable
- `VALIDATION_ERROR` : Paramètres invalides
- `PREVIEW_FAILED` : Erreur serveur

---

### 2. Valider une formation temporaire

**POST** `/api/battle-setup/validate`

Valide une formation sans la sauvegarder (preview).

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body
```json
{
  "slots": [
    {
      "slot": 1,
      "heroId": "HERO_abc123"
    },
    {
      "slot": 2,
      "heroId": "HERO_def456"
    }
  ],
  "worldId": 1,
  "levelId": 5,
  "difficulty": "Normal"
}
```

#### Réponse succès (200)
```json
{
  "message": "Formation validation completed",
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [
      "No heroes in back line (positions 3-5)"
    ],
    "stats": {
      "totalPower": 2800,
      "heroCount": 2,
      "roleDistribution": {
        "Tank": 1,
        "DPS Melee": 1
      },
      "elementDistribution": {
        "Fire": 1,
        "Water": 1
      },
      "synergies": {
        "bonuses": { "hp": 0, "atk": 0, "def": 0 },
        "details": []
      }
    },
    "heroes": [
      {
        "heroId": "HERO_abc123",
        "position": 1,
        "name": "Ignara",
        "role": "Tank",
        "element": "Fire",
        "rarity": "Epic",
        "level": 20,
        "stars": 3
      }
    ],
    "estimation": {
      "victoryChance": 65,
      "powerDifference": -12
    }
  }
}
```

#### Erreurs possibles
```json
{
  "error": "Invalid formation slots configuration",
  "code": "INVALID_FORMATION"
}
```

**Codes d'erreur :**
- `INVALID_FORMATION` : Formation invalide
- `HERO_NOT_OWNED` : Héros non possédé
- `DUPLICATE_HERO` : Héros utilisé plusieurs fois

---

### 3. Confirmer et lancer le combat

**POST** `/api/battle-setup/confirm`

Valide la formation et lance le combat.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body
```json
{
  "worldId": 1,
  "levelId": 5,
  "difficulty": "Normal",
  "slots": [
    {
      "slot": 1,
      "heroId": "HERO_abc123"
    }
  ],
  "saveFormation": true,
  "formationName": "Formation Elite",
  "battleOptions": {
    "mode": "auto",
    "speed": 1
  }
}
```

#### Réponse succès (200)
```json
{
  "message": "Battle started successfully",
  "battleId": "BATTLE_xyz789",
  "victory": true,
  "result": {
    "victory": true,
    "totalTurns": 15,
    "battleDuration": 45000,
    "rewards": {
      "gold": 500,
      "experience": 120,
      "items": []
    },
    "stats": {
      "totalDamageDealt": 15000,
      "totalHealingDone": 2000,
      "criticalHits": 8,
      "ultimatesUsed": 3
    }
  },
  "replay": {
    "battleId": "BATTLE_xyz789",
    "playerTeam": [...],
    "enemyTeam": [...],
    "actions": [...]
  },
  "formationSaved": true
}
```

#### Erreurs possibles
```json
{
  "error": "Formation must have at least one hero",
  "code": "NO_HEROES"
}
```

**Codes d'erreur :**
- `NO_HEROES` : Aucun héros dans la formation
- `SPEED_NOT_ALLOWED` : Vitesse non autorisée pour le VIP
- `CONFIRM_FAILED` : Erreur serveur

---

### 4. Preview combat d'arène

**GET** `/api/battle-setup/arena/preview`

Prévisualise un combat d'arène contre un adversaire.

#### Query Parameters
- `opponentId` (requis) : ID de l'adversaire

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Arena preview retrieved successfully",
  "preview": {
    "player": {
      "displayName": "JohnDoe",
      "level": 25,
      "power": 3500,
      "formation": {
        "formationId": "FORM_abc123",
        "slots": [...],
        "totalPower": 3500
      }
    },
    "opponent": {
      "displayName": "JaneDoe",
      "level": 27,
      "power": 3800,
      "formation": {
        "formationId": "FORM_def456",
        "slots": [...],
        "totalPower": 3800
      }
    },
    "estimation": {
      "victoryChance": 45,
      "difficulty": "hard",
      "powerDifference": -8,
      "recommendations": [
        "Opponent has higher power - consider upgrading heroes"
      ]
    },
    "canStart": true
  }
}
```

---

### 5. Quick Setup (niveau actuel)

**GET** `/api/battle-setup/quick`

Récupère un setup rapide pour le niveau actuel du joueur.

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200)
```json
{
  "message": "Quick setup retrieved successfully",
  "preview": {
    "level": {
      "worldId": 3,
      "levelId": 12,
      "difficulty": "Normal",
      "enemyType": "normal",
      "recommended": true
    },
    "playerFormation": {...},
    "enemies": {...},
    "estimation": {...},
    "progress": {...},
    "canStart": true,
    "warnings": []
  }
}
```

---

### 6. Info système

**GET** `/api/battle-setup/info`

Retourne la documentation des endpoints (pas d'auth requise).

#### Réponse succès (200)
```json
{
  "message": "Battle setup system information",
  "endpoints": {
    "preview": "GET /api/battle-setup/campaign/preview?worldId=1&levelId=1&difficulty=Normal",
    "validate": "POST /api/battle-setup/validate",
    "confirm": "POST /api/battle-setup/confirm",
    "arenaPreview": "GET /api/battle-setup/arena/preview?opponentId=PLAYER_123",
    "quick": "GET /api/battle-setup/quick"
  },
  "workflow": {
    "step1": "Preview: Get level info and current formation",
    "step2": "Validate: Test a temporary formation (optional)",
    "step3": "Confirm: Start the battle with final formation"
  },
  "features": {
    "formations": "Temporary formations for testing without saving",
    "estimation": "Victory chance estimation based on power",
    "validation": "Real-time formation validation",
    "recommendations": "Strategic recommendations for battle",
    "saveOption": "Option to save formation for future use"
  }
}
```

---

## Modèles de données

### Formation Slot

```csharp
[System.Serializable]
public class FormationSlot
{
    public int slot;        // Position 1-5 (1-2 = front, 3-5 = back)
    public string heroId;   // ID du héros (format: HERO_xxxxxx)
}
```

### Hero Info

```csharp
[System.Serializable]
public class HeroInfo
{
    public string heroId;
    public int position;    // 1-5
    public string name;
    public string role;     // "Tank", "DPS Melee", "DPS Ranged", "Support"
    public string element;  // "Fire", "Water", "Wind", "Electric", "Light", "Dark"
    public string rarity;   // "Common", "Rare", "Epic", "Legendary"
    public int level;       // 1-100
    public int stars;       // 1-6
}
```

### Estimation

```csharp
[System.Serializable]
public class VictoryEstimation
{
    public int victoryChance;          // 0-100%
    public string difficulty;          // "very_easy", "easy", "medium", "hard", "very_hard"
    public int powerDifference;        // % différence (-100 à +100)
    public string[] recommendations;   // Conseils stratégiques
}
```

### Synergie Élémentaire

```csharp
[System.Serializable]
public class ElementSynergy
{
    public string element;      // "Fire", "Water", etc.
    public int count;           // Nombre de héros de cet élément
    public ElementBonus bonus;  // Bonus appliqués
    public bool isRare;         // true si Light/Dark
}

[System.Serializable]
public class ElementBonus
{
    public int hp;   // Bonus % HP
    public int atk;  // Bonus % ATK
    public int def;  // Bonus % DEF
}
```

**Bonus de synergie :**
- 2 héros même élément : +5% toutes stats (+8% si Light/Dark)
- 3 héros : +10% (+15% Light/Dark)
- 4 héros : +15% (+22% Light/Dark)
- 5 héros (pure) : +25% (+35% Light/Dark)

---

## Workflow complet

### Scénario 1 : Preview puis combat direct

```csharp
// 1. Charger le preview du niveau
yield return GetCampaignPreview(worldId: 1, levelId: 5);

// 2. Afficher l'UI avec formation actuelle
DisplayFormationUI(preview.playerFormation);
DisplayEnemiesUI(preview.enemies);
DisplayEstimation(preview.estimation);

// 3. Si joueur valide sans changer
if (playerClicksStart)
{
    yield return ConfirmBattle(
        worldId: 1,
        levelId: 5,
        slots: preview.playerFormation.slots,
        saveFormation: false
    );
}
```

### Scénario 2 : Tester une nouvelle formation

```csharp
// 1. Preview initial
yield return GetCampaignPreview(worldId: 1, levelId: 5);

// 2. Joueur modifie la formation dans l'UI
FormationSlot[] newSlots = BuildNewFormation();

// 3. Valider la formation temporaire
yield return ValidateFormation(
    slots: newSlots,
    worldId: 1,
    levelId: 5
);

// 4. Afficher les nouvelles stats
DisplayValidationResults(validation);

// 5. Si joueur confirme
if (playerClicksConfirm)
{
    yield return ConfirmBattle(
        worldId: 1,
        levelId: 5,
        slots: newSlots,
        saveFormation: true,
        formationName: "My Best Formation"
    );
}
```

### Scénario 3 : Arène preview

```csharp
// 1. Liste des adversaires
yield return GetOpponentsList();

// 2. Joueur sélectionne un adversaire
string selectedOpponentId = opponents[0].playerId;

// 3. Preview du combat
yield return GetArenaPreview(selectedOpponentId);

// 4. Afficher comparaison
DisplayPowerComparison(preview.player, preview.opponent);
DisplayEstimation(preview.estimation);

// 5. Si joueur accepte
if (playerClicksFight)
{
    yield return StartArenaBattle(selectedOpponentId);
}
```

---

## Exemples d'intégration Unity

### 1. Manager principal

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;

public class BattleSetupManager : MonoBehaviour
{
    private const string BASE_URL = "https://your-api.com/api/battle-setup";
    private string jwtToken;

    [System.Serializable]
    public class PreviewResponse
    {
        public string message;
        public BattlePreview preview;
    }

    [System.Serializable]
    public class BattlePreview
    {
        public LevelInfo level;
        public PlayerFormation playerFormation;
        public EnemyInfo enemies;
        public VictoryEstimation estimation;
        public ProgressInfo progress;
        public bool canStart;
        public string[] warnings;
    }

    // Autres classes...

    public IEnumerator GetCampaignPreview(int worldId, int levelId, string difficulty = "Normal")
    {
        string url = $"{BASE_URL}/campaign/preview?worldId={worldId}&levelId={levelId}&difficulty={difficulty}";
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            PreviewResponse response = JsonUtility.FromJson<PreviewResponse>(request.downloadHandler.text);
            
            if (response.preview != null)
            {
                OnPreviewReceived(response.preview);
            }
        }
        else
        {
            Debug.LogError($"Preview failed: {request.error}");
        }
    }

    private void OnPreviewReceived(BattlePreview preview)
    {
        // Mettre à jour l'UI
        UpdateFormationUI(preview.playerFormation);
        UpdateEnemiesUI(preview.enemies);
        UpdateEstimationUI(preview.estimation);
        UpdateProgressUI(preview.progress);
        
        // Afficher warnings
        if (preview.warnings.Length > 0)
        {
            ShowWarnings(preview.warnings);
        }
    }
}
```

### 2. Validation de formation

```csharp
public IEnumerator ValidateFormation(FormationSlot[] slots, int worldId, int levelId, string difficulty = "Normal")
{
    // Créer le body JSON
    ValidateRequest requestBody = new ValidateRequest
    {
        slots = slots,
        worldId = worldId,
        levelId = levelId,
        difficulty = difficulty
    };

    string jsonBody = JsonUtility.ToJson(requestBody);

    UnityWebRequest request = UnityWebRequest.Post($"{BASE_URL}/validate", jsonBody, "application/json");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        ValidationResponse response = JsonUtility.FromJson<ValidationResponse>(request.downloadHandler.text);
        
        if (response.validation.valid)
        {
            UpdateFormationStats(response.validation.stats);
            UpdateEstimation(response.validation.estimation);
            
            // Montrer warnings s'il y en a
            if (response.validation.warnings.Length > 0)
            {
                ShowValidationWarnings(response.validation.warnings);
            }
        }
        else
        {
            // Afficher les erreurs
            ShowValidationErrors(response.validation.errors);
        }
    }
}
```

### 3. Confirmer et lancer le combat

```csharp
public IEnumerator ConfirmBattle(
    int worldId, 
    int levelId, 
    FormationSlot[] slots, 
    bool saveFormation = false,
    string formationName = null,
    string mode = "auto",
    int speed = 1
)
{
    ConfirmRequest requestBody = new ConfirmRequest
    {
        worldId = worldId,
        levelId = levelId,
        difficulty = "Normal",
        slots = slots,
        saveFormation = saveFormation,
        formationName = formationName,
        battleOptions = new BattleOptions
        {
            mode = mode,
            speed = speed
        }
    };

    string jsonBody = JsonUtility.ToJson(requestBody);

    UnityWebRequest request = UnityWebRequest.Post($"{BASE_URL}/confirm", jsonBody, "application/json");
    request.SetRequestHeader("Authorization", $"Bearer {jwtToken}");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        ConfirmResponse response = JsonUtility.FromJson<ConfirmResponse>(request.downloadHandler.text);
        
        if (response.victory)
        {
            ShowVictoryScreen(response.result);
        }
        else
        {
            ShowDefeatScreen(response.result);
        }

        // Appliquer les récompenses
        ApplyRewards(response.result.rewards);

        // Optionnel : Afficher le replay
        if (showReplay)
        {
            PlayBattleReplay(response.replay);
        }
    }
}
```

### 4. UI de formation avec drag & drop

```csharp
public class FormationSlotUI : MonoBehaviour, IDropHandler
{
    public int slotPosition; // 1-5
    private HeroInfo currentHero;

    public void OnDrop(PointerEventData eventData)
    {
        HeroDragHandler droppedHero = eventData.pointerDrag.GetComponent<HeroDragHandler>();
        
        if (droppedHero != null)
        {
            // Placer le héros dans ce slot
            PlaceHero(droppedHero.heroInfo, slotPosition);
            
            // Mettre à jour la formation
            FormationManager.Instance.UpdateSlot(slotPosition, droppedHero.heroInfo.heroId);
            
            // Revalider la formation en temps réel
            StartCoroutine(BattleSetupManager.Instance.ValidateFormation(
                FormationManager.Instance.GetCurrentSlots(),
                currentWorldId,
                currentLevelId
            ));
        }
    }

    private void PlaceHero(HeroInfo hero, int position)
    {
        currentHero = hero;
        
        // Mettre à jour l'affichage du slot
        heroIcon.sprite = GetHeroSprite(hero.heroId);
        heroNameText.text = hero.name;
        heroLevelText.text = $"Lv.{hero.level}";
        
        // Afficher l'élément avec couleur
        elementIcon.sprite = GetElementSprite(hero.element);
        elementIcon.color = GetElementColor(hero.element);
    }
}
```

### 5. Afficher l'estimation de victoire

```csharp
public class VictoryEstimationUI : MonoBehaviour
{
    public Slider victoryChanceSlider;
    public Text victoryChanceText;
    public Text difficultyText;
    public Text powerDifferenceText;
    public Transform recommendationsContainer;
    public GameObject recommendationPrefab;

    public void UpdateEstimation(VictoryEstimation estimation)
    {
        // Barre de victoire (0-100%)
        victoryChanceSlider.value = estimation.victoryChance / 100f;
        victoryChanceText.text = $"{estimation.victoryChance}%";
        
        // Couleur selon le pourcentage
        Color sliderColor = GetColorForChance(estimation.victoryChance);
        victoryChanceSlider.fillRect.GetComponent<Image>().color = sliderColor;

        // Difficulté
        difficultyText.text = GetLocalizedDifficulty(estimation.difficulty);
        difficultyText.color = GetColorForDifficulty(estimation.difficulty);

        // Différence de puissance
        string powerText = estimation.powerDifference > 0 
            ? $"+{estimation.powerDifference}% ✓" 
            : $"{estimation.powerDifference}% ✗";
        powerDifferenceText.text = powerText;

        // Recommandations
        ClearRecommendations();
        foreach (string recommendation in estimation.recommendations)
        {
            AddRecommendation(recommendation);
        }
    }

    private Color GetColorForChance(int chance)
    {
        if (chance >= 80) return Color.green;
        if (chance >= 60) return Color.yellow;
        if (chance >= 40) return new Color(1f, 0.5f, 0f); // Orange
        return Color.red;
    }

    private Color GetColorForDifficulty(string difficulty)
    {
        switch (difficulty)
        {
            case "very_easy": return Color.green;
            case "easy": return Color.cyan;
            case "medium": return Color.yellow;
            case "hard": return new Color(1f, 0.5f, 0f);
            case "very_hard": return Color.red;
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
| 200 | Succès | Traiter la réponse |
| 400 | Paramètres invalides | Vérifier le body/query |
| 401 | Non authentifié | Redemander login |
| 403 | Vitesse VIP non autorisée | Désactiver option vitesse |
| 404 | Joueur/Formation introuvable | Vérifier l'ID |
| 500 | Erreur serveur | Afficher erreur générique |

### Codes d'erreur métier

```csharp
public void HandleBattleSetupError(string errorCode)
{
    switch (errorCode)
    {
        case "PLAYER_NOT_FOUND":
            AuthManager.Instance.Logout();
            break;

        case "NO_EQUIPPED_HEROES":
            ShowError("Vous devez équiper au moins un héros");
            OpenHeroesScreen();
            break;

        case "INVALID_FORMATION":
            ShowError("Formation invalide");
            ResetFormation();
            break;

        case "SPEED_NOT_ALLOWED":
            ShowError($"Vitesse x3 nécessite VIP 5 (vous êtes VIP {playerVipLevel})");
            battleSpeedSlider.value = 1;
            break;

        case "HERO_NOT_OWNED":
            ShowError("Ce héros ne vous appartient pas");
            RefreshHeroList();
            break;

        default:
            ShowError("Une erreur est survenue");
            break;
    }
}
```

---

## Best Practices

### ✅ À faire

1. **Toujours appeler `/preview`** avant d'afficher l'écran de setup
2. **Valider en temps réel** quand le joueur modifie la formation
3. **Afficher visuellement** les bonus de synergie (2+ même élément)
4. **Cacher les vitesses** x2/x3 si VIP insuffisant
5. **Montrer les warnings** (ex: pas de back-line) sans bloquer
6. **Sauvegarder optionnellement** la formation après validation
7. **Afficher l'estimation** avec couleurs (vert = facile, rouge = dur)
8. **Indiquer les positions** front (1-2) et back (3-5) visuellement

### ❌ À éviter

1. Ne **jamais** laisser lancer un combat sans héros
2. Ne **pas** faire confiance aux calculs côté client (utiliser le serveur)
3. Ne **pas** permettre de placer 2 fois le même héros
4. Ne **pas** ignorer les warnings (informer le joueur)
5. Ne **pas** autoriser vitesse x2/x3 sans vérifier le VIP
6. Ne **pas** bloquer sur warnings (laisser jouer si valid = true)

---

**Version:** 1.0.0  
**Dernière mise à jour:** 30 septembre 2025  
**Auteur:** BattleSetupService v1

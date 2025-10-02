# 🔥 Friday Elemental Shop API - Documentation Unity

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

La **Boutique Élémentaire du Vendredi** est une boutique événementielle hebdomadaire proposant 5 packs de tickets élémentaires avec des réductions progressives. Elle est **uniquement accessible le vendredi** et se réinitialise automatiquement chaque semaine.

### Fonctionnalités principales

- ✅ **5 packs progressifs** : De 5 à 100 tickets élémentaires
- ✅ **Réductions croissantes** : 10% à 30% de réduction
- ✅ **Disponible uniquement vendredi** : Vérification serveur stricte
- ✅ **Stock illimité** : Pas de limite globale
- ✅ **Limite par pack** : 3 achats maximum par joueur par pack
- ✅ **Reset hebdomadaire** : Tous les vendredis à minuit
- ✅ **Protection niveau** : Débloqué au niveau 3
- ✅ **Notifications temps réel** : WebSocket pour ouverture/fermeture

### Base URL

```
https://your-api-domain.com/api/shops
```

---

## Endpoints API

### 1. Vérifier la disponibilité de la boutique

**GET** `/api/shops/ElementalFriday`

Récupère les détails de la boutique si elle est disponible aujourd'hui.

#### Auth requise
✅ **Oui** (JWT Token obligatoire)

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
```

#### Réponse succès (200) - Vendredi

```json
{
  "message": "Shop details retrieved successfully",
  "success": true,
  "shop": {
    "shopType": "ElementalFriday",
    "name": "ELEMENTAL_FRIDAY_SHOP_NAME",
    "description": "ELEMENTAL_FRIDAY_SHOP_DESCRIPTION",
    "resetFrequency": "weekly",
    "maxItemsShown": 5,
    "items": [
      {
        "instanceId": "68de15645b41b119b36368a9",
        "itemId": "elemental_ticket_pack_5",
        "type": "ElementalTicket",
        "name": "ELEMENTAL_FRIDAY_OFFER_1_NAME",
        "description": "ELEMENTAL_FRIDAY_OFFER_1_DESC",
        "content": {
          "elementalTicketType": "fire",
          "quantity": 5
        },
        "cost": {
          "gems": 675,
          "gold": 0,
          "paidGems": 0,
          "tickets": 0
        },
        "finalPrice": {
          "gems": 607
        },
        "rarity": "Common",
        "discountPercent": 10,
        "maxStock": -1,
        "currentStock": 999999,
        "maxPurchasePerPlayer": 3,
        "levelRequirement": 1,
        "isPromotional": false,
        "isFeatured": false,
        "tags": ["starter", "value"],
        "canPurchase": true
      }
    ],
    "timeUntilReset": 56439176,
    "canRefresh": false
  }
}
```

#### Réponse erreur (403) - Pas vendredi

```json
{
  "error": "This shop is not available today",
  "code": "SHOP_NOT_AVAILABLE_TODAY"
}
```

#### Réponse erreur (403) - Niveau insuffisant

```json
{
  "error": "Feature 'Boutique' non débloquée. Débloqué au niveau 3",
  "code": "FEATURE_LOCKED",
  "featureId": "shop_basic"
}
```

### 2. Acheter un pack de tickets

**POST** `/api/shops/ElementalFriday/purchase`

Effectue l'achat d'un pack de tickets élémentaires.

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
  "instanceId": "68de15645b41b119b36368a9",
  "quantity": 1
}
```

#### Réponse succès (200)

```json
{
  "message": "Purchase completed successfully",
  "success": true,
  "purchase": {
    "itemName": "ELEMENTAL_FRIDAY_OFFER_1_NAME",
    "quantity": 1,
    "cost": {
      "gems": 607
    },
    "rewards": [
      {
        "type": "ElementalTicket",
        "elementalTicketType": "fire",
        "quantity": 5
      }
    ]
  },
  "playerResources": {
    "gold": 1000,
    "gems": 9393,
    "paidGems": 0,
    "tickets": 5
  }
}
```

#### Réponse erreur (403) - Pas vendredi

```json
{
  "success": false,
  "error": "ELEMENTAL_FRIDAY_SHOP_NAME is only available on Fridays. Next opening: 10/10/2025",
  "code": "SHOP_NOT_AVAILABLE_TODAY"
}
```

#### Réponse erreur (400) - Ressources insuffisantes

```json
{
  "success": false,
  "error": "Insufficient resources: gems",
  "code": "INSUFFICIENT_RESOURCES"
}
```

#### Réponse erreur (403) - Limite atteinte

```json
{
  "success": false,
  "error": "Cannot purchase item: PURCHASE_LIMIT_REACHED",
  "code": "PURCHASE_NOT_ALLOWED"
}
```

### 3. Récupérer l'historique d'achat

**GET** `/api/shops/ElementalFriday/history?page=1&limit=20`

Récupère l'historique des achats du joueur dans la boutique Friday.

#### Auth requise
✅ **Oui**

#### Réponse succès (200)

```json
{
  "message": "Purchase history retrieved successfully",
  "success": true,
  "shopType": "ElementalFriday",
  "history": [
    {
      "itemName": "ELEMENTAL_FRIDAY_OFFER_1_NAME",
      "itemId": "elemental_ticket_pack_5",
      "quantity": 1,
      "purchaseDate": "2025-10-03T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

---

## Modèles de données C#

### Shop Response Model

```csharp
[System.Serializable]
public class FridayShopResponse
{
    public string message;
    public bool success;
    public FridayShop shop;
}

[System.Serializable]
public class FridayShop
{
    public string shopType;
    public string name;
    public string description;
    public string resetFrequency;
    public int maxItemsShown;
    public FridayShopItem[] items;
    public long timeUntilReset;
    public bool canRefresh;
}

[System.Serializable]
public class FridayShopItem
{
    public string instanceId;
    public string itemId;
    public string type; // "ElementalTicket"
    public string name;
    public string description;
    public ItemContent content;
    public ItemCost cost;
    public ItemCost finalPrice;
    public string rarity;
    public int discountPercent;
    public int maxStock;
    public int currentStock;
    public int maxPurchasePerPlayer;
    public int levelRequirement;
    public bool isPromotional;
    public bool isFeatured;
    public string[] tags;
    public bool canPurchase;
}

[System.Serializable]
public class ItemContent
{
    public string elementalTicketType; // "fire", "water", "wind", "electric", "light", "shadow"
    public int quantity;
}

[System.Serializable]
public class ItemCost
{
    public int gems;
    public int gold;
    public int paidGems;
    public int tickets;
}
```

### Purchase Response Model

```csharp
[System.Serializable]
public class PurchaseResponse
{
    public string message;
    public bool success;
    public Purchase purchase;
    public PlayerResources playerResources;
}

[System.Serializable]
public class Purchase
{
    public string itemName;
    public int quantity;
    public ItemCost cost;
    public Reward[] rewards;
}

[System.Serializable]
public class Reward
{
    public string type; // "ElementalTicket"
    public string elementalTicketType; // "fire", "water", etc.
    public int quantity;
}

[System.Serializable]
public class PlayerResources
{
    public int gold;
    public int gems;
    public int paidGems;
    public int tickets;
}
```

### Error Response Model

```csharp
[System.Serializable]
public class ErrorResponse
{
    public bool success;
    public string error;
    public string code;
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
    socket.Emit("shop:join_room", new { serverId = "S1" });
});

socket.ConnectAsync();
```

### Événements principaux

#### Boutique ouverte (broadcast global)
**Event:** `shop:friday_opened`

```csharp
socket.On("shop:friday_opened", response =>
{
    var data = JsonUtility.FromJson<FridayOpenedEvent>(response.ToString());
    
    Debug.Log("Friday shop is now open!");
    ShowFridayShopNotification(data);
});
```

**Payload:**
```json
{
  "message": "ELEMENTAL_FRIDAY_SHOP_OPENED",
  "shopType": "ElementalFriday",
  "offers": [
    {
      "name": "ELEMENTAL_FRIDAY_OFFER_1_NAME",
      "tickets": 5,
      "gems": 607,
      "originalPrice": 675,
      "discount": 10,
      "rarity": "Common",
      "isFeatured": false
    }
  ],
  "expiresIn": 86400000,
  "nextReset": "2025-10-10T00:00:00.000Z",
  "priority": "high"
}
```

#### Achat réussi
**Event:** `shop:purchase_success`

```csharp
socket.On("shop:purchase_success", response =>
{
    var data = JsonUtility.FromJson<PurchaseSuccessEvent>(response.ToString());
    
    PlayPurchaseAnimation(data);
    UpdateUI(data.playerResources);
});
```

#### Achat échoué
**Event:** `shop:purchase_failure`

```csharp
socket.On("shop:purchase_failure", response =>
{
    var data = JsonUtility.FromJson<PurchaseFailureEvent>(response.ToString());
    
    ShowError(data.reason);
});
```

#### Boutique refresh/reset
**Event:** `shop:global_reset`

```csharp
socket.On("shop:global_reset", response =>
{
    var data = JsonUtility.FromJson<ShopResetEvent>(response.ToString());
    
    if (data.shopType == "ElementalFriday")
    {
        ReloadFridayShop();
    }
});
```

---

## Exemples d'intégration Unity

### 1. Manager complet de la boutique Friday

```csharp
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;
using System.Collections;
using System.Text;
using System;

public class FridayShopManager : MonoBehaviour
{
    [Header("Configuration")]
    private string baseURL = "https://your-api.com/api/shops";
    private string jwtToken;

    [Header("UI References")]
    public GameObject shopPanel;
    public GameObject lockedPanel;
    public Text countdownText;
    public Text errorText;
    public Transform itemsContainer;
    public GameObject itemPrefab;

    private FridayShop currentShop;
    private bool isShopOpen = false;

    void Start()
    {
        jwtToken = PlayerPrefs.GetString("JWT_TOKEN", "");
        CheckShopAvailability();
    }

    // ✅ SÉCURISÉ : Toujours vérifier côté serveur
    public void CheckShopAvailability()
    {
        StartCoroutine(CheckShopAvailabilityCoroutine());
    }

    IEnumerator CheckShopAvailabilityCoroutine()
    {
        UnityWebRequest request = UnityWebRequest.Get(baseURL + "/ElementalFriday");
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            // ✅ La boutique est disponible (c'est vendredi)
            FridayShopResponse response = JsonUtility.FromJson<FridayShopResponse>(request.downloadHandler.text);
            currentShop = response.shop;
            isShopOpen = true;
            
            DisplayShop();
        }
        else if (request.responseCode == 403)
        {
            // ❌ Pas vendredi ou feature locked
            ErrorResponse error = JsonUtility.FromJson<ErrorResponse>(request.downloadHandler.text);
            
            if (error.code == "SHOP_NOT_AVAILABLE_TODAY")
            {
                ShowLockedShop("Reviens vendredi !");
            }
            else if (error.code == "FEATURE_LOCKED")
            {
                ShowLockedShop("Débloqué au niveau 3");
            }
        }
        else
        {
            ShowError("Impossible de charger la boutique");
        }
    }

    void DisplayShop()
    {
        shopPanel.SetActive(true);
        lockedPanel.SetActive(false);

        // Nettoyer les items existants
        foreach (Transform child in itemsContainer)
        {
            Destroy(child.gameObject);
        }

        // Créer les UI pour chaque pack
        foreach (FridayShopItem item in currentShop.items)
        {
            GameObject itemUI = Instantiate(itemPrefab, itemsContainer);
            SetupItemUI(itemUI, item);
        }

        // Démarrer le countdown
        StartCoroutine(UpdateCountdown());
    }

    void SetupItemUI(GameObject itemUI, FridayShopItem item)
    {
        // Setup du prefab
        itemUI.transform.Find("Name").GetComponent<Text>().text = item.name;
        itemUI.transform.Find("Description").GetComponent<Text>().text = item.description;
        itemUI.transform.Find("Price").GetComponent<Text>().text = item.finalPrice.gems + " 💎";
        
        if (item.discountPercent > 0)
        {
            itemUI.transform.Find("OriginalPrice").GetComponent<Text>().text = 
                "<s>" + item.cost.gems + " 💎</s>";
            itemUI.transform.Find("Discount").GetComponent<Text>().text = 
                "-" + item.discountPercent + "%";
        }

        if (item.isFeatured)
        {
            itemUI.transform.Find("FeaturedBadge").gameObject.SetActive(true);
        }

        // Bouton d'achat
        Button buyButton = itemUI.transform.Find("BuyButton").GetComponent<Button>();
        buyButton.onClick.AddListener(() => PurchaseItem(item));
        buyButton.interactable = item.canPurchase;

        // Afficher tickets
        itemUI.transform.Find("Tickets").GetComponent<Text>().text = 
            item.content.quantity + " 🎟️";
    }

    void ShowLockedShop(string reason)
    {
        shopPanel.SetActive(false);
        lockedPanel.SetActive(true);
        lockedPanel.transform.Find("Reason").GetComponent<Text>().text = reason;
    }

    IEnumerator UpdateCountdown()
    {
        while (isShopOpen)
        {
            if (currentShop.timeUntilReset > 0)
            {
                TimeSpan timeSpan = TimeSpan.FromMilliseconds(currentShop.timeUntilReset);
                countdownText.text = string.Format("Se termine dans : {0}h {1}m {2}s",
                    timeSpan.Hours,
                    timeSpan.Minutes,
                    timeSpan.Seconds);

                currentShop.timeUntilReset -= (long)(Time.deltaTime * 1000);
            }
            else
            {
                countdownText.text = "Boutique fermée";
                isShopOpen = false;
            }

            yield return null;
        }
    }

    public void PurchaseItem(FridayShopItem item)
    {
        StartCoroutine(PurchaseItemCoroutine(item));
    }

    IEnumerator PurchaseItemCoroutine(FridayShopItem item)
    {
        string jsonBody = JsonUtility.ToJson(new PurchaseRequest
        {
            instanceId = item.instanceId,
            quantity = 1
        });

        UnityWebRequest request = new UnityWebRequest(
            baseURL + "/ElementalFriday/purchase", 
            "POST"
        );
        
        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        
        request.SetRequestHeader("Authorization", "Bearer " + jwtToken);
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            PurchaseResponse response = JsonUtility.FromJson<PurchaseResponse>(
                request.downloadHandler.text
            );
            
            OnPurchaseSuccess(response);
        }
        else
        {
            ErrorResponse error = JsonUtility.FromJson<ErrorResponse>(
                request.downloadHandler.text
            );
            
            OnPurchaseFailure(error);
        }
    }

    void OnPurchaseSuccess(PurchaseResponse response)
    {
        Debug.Log("Achat réussi: " + response.purchase.itemName);
        
        // Afficher animation
        PlayPurchaseAnimation(response.purchase.rewards[0]);
        
        // Mettre à jour UI
        UpdatePlayerResources(response.playerResources);
        
        // Recharger la boutique pour mettre à jour les limites
        CheckShopAvailability();
    }

    void OnPurchaseFailure(ErrorResponse error)
    {
        switch (error.code)
        {
            case "INSUFFICIENT_RESOURCES":
                ShowError("Gems insuffisantes !");
                break;
                
            case "PURCHASE_NOT_ALLOWED":
                ShowError("Limite d'achat atteinte (3/pack)");
                break;
                
            case "SHOP_NOT_AVAILABLE_TODAY":
                ShowError("La boutique n'est disponible que le vendredi");
                CheckShopAvailability(); // Refresh UI
                break;
                
            default:
                ShowError("Erreur: " + error.error);
                break;
        }
    }

    void PlayPurchaseAnimation(Reward reward)
    {
        // Animation d'obtention de tickets
        Debug.Log("Obtenu: " + reward.quantity + "x " + reward.elementalTicketType + " tickets");
        
        // TODO: Implémenter animation
    }

    void UpdatePlayerResources(PlayerResources resources)
    {
        // Mettre à jour l'UI des ressources du joueur
        Debug.Log("Gems restantes: " + resources.gems);
        
        // TODO: Mettre à jour UI
    }

    void ShowError(string message)
    {
        errorText.text = message;
        errorText.gameObject.SetActive(true);
        
        StartCoroutine(HideErrorAfterDelay(3f));
    }

    IEnumerator HideErrorAfterDelay(float delay)
    {
        yield return new WaitForSeconds(delay);
        errorText.gameObject.SetActive(false);
    }
}

[System.Serializable]
public class PurchaseRequest
{
    public string instanceId;
    public int quantity;
}
```

### 2. Notification d'ouverture de la boutique

```csharp
using UnityEngine;
using SocketIOClient;

public class FridayShopNotifier : MonoBehaviour
{
    private SocketIO socket;

    void Start()
    {
        socket = new SocketIO("https://your-api.com");
        
        socket.On("connect", response =>
        {
            socket.Emit("shop:join_room", new { serverId = "S1" });
        });

        socket.On("shop:friday_opened", OnFridayShopOpened);
        
        socket.ConnectAsync();
    }

    void OnFridayShopOpened(SocketIOResponse response)
    {
        Debug.Log("🔥 Friday shop is now open!");
        
        // Afficher notification push
        ShowPushNotification(
            "Boutique Élémentaire du Vendredi",
            "Les tickets élémentaires sont en promotion !"
        );
        
        // Badge sur l'icône de la boutique
        ShowNewBadge();
        
        // Son de notification
        PlayNotificationSound();
    }

    void ShowPushNotification(string title, string message)
    {
        // Implémenter notification système
    }

    void ShowNewBadge()
    {
        // Afficher badge "NEW" sur l'icône shop
    }

    void PlayNotificationSound()
    {
        // Jouer son
    }

    void OnDestroy()
    {
        socket?.DisconnectAsync();
    }
}
```

### 3. UI Item du pack Friday

```csharp
using UnityEngine;
using UnityEngine.UI;

public class FridayShopItemUI : MonoBehaviour
{
    [Header("UI Elements")]
    public Text nameText;
    public Text descriptionText;
    public Text ticketsText;
    public Text priceText;
    public Text originalPriceText;
    public Text discountText;
    public GameObject featuredBadge;
    public GameObject bestValueBadge;
    public Button buyButton;
    public Image rarityGlow;

    [Header("Rarity Colors")]
    public Color commonColor = Color.white;
    public Color rareColor = Color.blue;
    public Color epicColor = Color.magenta;
    public Color legendaryColor = new Color(1f, 0.84f, 0f);
    public Color mythicColor = new Color(1f, 0.27f, 0f);

    private FridayShopItem itemData;

    public void Setup(FridayShopItem item)
    {
        itemData = item;

        // Textes de base
        nameText.text = LocalizationManager.Get(item.name);
        descriptionText.text = LocalizationManager.Get(item.description);
        ticketsText.text = item.content.quantity + " 🎟️";
        priceText.text = item.finalPrice.gems + " 💎";

        // Prix barré si réduction
        if (item.discountPercent > 0)
        {
            originalPriceText.gameObject.SetActive(true);
            originalPriceText.text = "<s>" + item.cost.gems + " 💎</s>";
            
            discountText.gameObject.SetActive(true);
            discountText.text = "-" + item.discountPercent + "%";
        }
        else
        {
            originalPriceText.gameObject.SetActive(false);
            discountText.gameObject.SetActive(false);
        }

        // Badges
        featuredBadge.SetActive(item.isFeatured);
        bestValueBadge.SetActive(item.isPromotional);

        // Couleur selon rareté
        SetRarityGlow(item.rarity);

        // Bouton d'achat
        buyButton.interactable = item.canPurchase;
        buyButton.onClick.RemoveAllListeners();
        buyButton.onClick.AddListener(OnBuyClick);
    }

    void SetRarityGlow(string rarity)
    {
        Color glowColor = rarity switch
        {
            "Common" => commonColor,
            "Rare" => rareColor,
            "Epic" => epicColor,
            "Legendary" => legendaryColor,
            "Mythic" => mythicColor,
            _ => Color.white
        };

        rarityGlow.color = glowColor;
    }

    void OnBuyClick()
    {
        FindObjectOfType<FridayShopManager>().PurchaseItem(itemData);
    }
}
```

### 4. Manager de localisation

```csharp
using UnityEngine;
using System.Collections.Generic;

public class LocalizationManager : MonoBehaviour
{
    private static Dictionary<string, string> translations = new Dictionary<string, string>
    {
        // Boutique
        { "ELEMENTAL_FRIDAY_SHOP_NAME", "Boutique Élémentaire du Vendredi" },
        { "ELEMENTAL_FRIDAY_SHOP_DESCRIPTION", "Offres exclusives de tickets élémentaires - Chaque vendredi !" },
        
        // Packs
        { "ELEMENTAL_FRIDAY_OFFER_1_NAME", "Pack Découverte" },
        { "ELEMENTAL_FRIDAY_OFFER_1_DESC", "5 tickets élémentaires pour commencer" },
        
        { "ELEMENTAL_FRIDAY_OFFER_2_NAME", "Pack Explorateur" },
        { "ELEMENTAL_FRIDAY_OFFER_2_DESC", "12 tickets élémentaires - Populaire !" },
        
        { "ELEMENTAL_FRIDAY_OFFER_3_NAME", "Pack Aventurier" },
        { "ELEMENTAL_FRIDAY_OFFER_3_DESC", "25 tickets élémentaires - Meilleure valeur !" },
        
        { "ELEMENTAL_FRIDAY_OFFER_4_NAME", "Pack Héros" },
        { "ELEMENTAL_FRIDAY_OFFER_4_DESC", "50 tickets élémentaires - Premium" },
        
        { "ELEMENTAL_FRIDAY_OFFER_5_NAME", "Pack Légende" },
        { "ELEMENTAL_FRIDAY_OFFER_5_DESC", "100 tickets élémentaires - Offre ultime !" },
        
        { "ELEMENTAL_FRIDAY_BEST_VALUE", "MEILLEURE VALEUR !" }
    };

    public static string Get(string key)
    {
        if (translations.ContainsKey(key))
        {
            return translations[key];
        }
        
        return key; // Fallback
    }
}
```

---

## Gestion des erreurs

### Codes d'erreur HTTP

| Code | Description | Action recommandée |
|------|-------------|-------------------|
| 200 | Succès | Traiter la réponse |
| 400 | Requête invalide | Vérifier les paramètres |
| 401 | Non authentifié | Redemander login |
| 403 | Accès refusé | Vérifier niveau/jour |
| 404 | Boutique introuvable | Recharger |
| 500 | Erreur serveur | Réessayer plus tard |

### Codes d'erreur métier

| Code | Description | UI à afficher |
|------|-------------|--------------|
| `SHOP_NOT_AVAILABLE_TODAY` | Pas vendredi | "Reviens vendredi !" |
| `FEATURE_LOCKED` | Niveau < 3 | "Débloqué au niveau 3" |
| `INSUFFICIENT_RESOURCES` | Pas assez de gems | "Gems insuffisantes" |
| `PURCHASE_NOT_ALLOWED` | Limite atteinte | "Limite: 3 achats/pack" |
| `SHOP_NOT_FOUND` | Erreur serveur | "Erreur, réessayez" |

---

## Best Practices

### À FAIRE ✅

1. **Toujours vérifier côté serveur** : Ne jamais se fier à la date locale du client
2. **Désactiver les boutons pendant loading** : Éviter les double-clics
3. **Afficher le countdown** : Temps restant avant fermeture
4. **Mettre à jour après achat** : Recharger pour afficher nouvelles limites
5. **Gérer toutes les erreurs** : Prévoir tous les cas d'erreur
6. **Afficher les réductions clairement** : Prix barré + pourcentage
7. **Badges visuels** : "Featured", "Best Value" pour guider
8. **Animation d'obtention** : Célébrer l'achat
9. **WebSocket pour notifications** : Notifier l'ouverture
10. **Cache intelligent** : Ne pas spammer le serveur

### À ÉVITER ❌

1. **Vérifier le jour côté client** : Facilement contournable
2. **Hardcoder les prix** : Toujours utiliser les données serveur
3. **Ignorer les erreurs** : Toujours gérer les cas d'erreur
4. **Spammer les requêtes** : Limiter les appels API
5. **Afficher sans vérifier** : Toujours vérifier `canPurchase`
6. **Oublier le countdown** : Important pour l'urgence
7. **Cacher les limitations** : Transparence sur les 3 achats max
8. **Animations trop longues** : Rester fluide

---

## Packs disponibles

| Pack | Tickets | Prix Original | Prix Final | Réduction | Rareté | Featured |
|------|---------|---------------|------------|-----------|--------|----------|
| Pack 1 | 5 🎟️ | 675 💎 | 607 💎 | -10% | Common | Non |
| Pack 2 | 12 🎟️ | 1530 💎 | 1300 💎 | -15% | Rare | Non |
| Pack 3 | 25 🎟️ | 3000 💎 | 2400 💎 | -20% | Epic | ⭐ Oui |
| Pack 4 | 50 🎟️ | 5625 💎 | 4218 💎 | -25% | Legendary | Non |
| Pack 5 | 100 🎟️ | 10500 💎 | 7350 💎 | -30% | Mythic | ⭐ Best Value |

**Limite d'achat :** 3 fois par pack maximum par joueur par semaine

---

## Informations techniques

### Système de reset automatique

- **Fréquence** : Hebdomadaire (tous les vendredis)
- **Heure** : Minuit (00:00:00 UTC)
- **Calcul** : Le serveur calcule automatiquement le prochain vendredi
- **Notification** : WebSocket broadcast à tous les serveurs actifs

### Types de tickets élémentaires

Les tickets peuvent être pour n'importe quel élément :
- 🔥 **Fire** (Feu)
- 💧 **Water** (Eau)
- 🌪️ **Wind** (Vent)
- ⚡ **Electric** (Électrique)
- ✨ **Light** (Lumière)
- 🌑 **Shadow** (Ténèbres)

**Note :** L'élément est défini par le serveur et peut varier chaque semaine.

### Validation serveur

Toutes les vérifications sont effectuées côté serveur :

1. **Authentification** : JWT Token valide
2. **Jour de la semaine** : Vendredi uniquement (vérification serveur)
3. **Niveau du joueur** : Niveau 3 minimum (Feature Unlock)
4. **Ressources** : Gems suffisantes
5. **Limite d'achat** : Maximum 3 par pack
6. **Stock** : Illimité (pas de vérification)

### Architecture de sécurité

```
┌─────────────────────────────────────────┐
│         CLIENT UNITY (NON TRUSTED)      │
├─────────────────────────────────────────┤
│  • Affiche UI selon réponse serveur    │
│  • NE vérifie PAS le jour localement   │
│  • Envoie requête d'achat              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       SERVEUR NODE.JS (TRUSTED)         │
├─────────────────────────────────────────┤
│  ✅ Vérifie JWT (authentification)      │
│  ✅ Vérifie si vendredi (date serveur) │
│  ✅ Vérifie Feature Unlock (niveau 3)  │
│  ✅ Vérifie ressources joueur           │
│  ✅ Vérifie limite d'achat (3/pack)     │
│  ✅ Transaction atomique MongoDB        │
└─────────────────────────────────────────┘
```

---

## Checklist d'intégration

### Phase 1 - Basique ✅
- [ ] Vérifier disponibilité de la boutique
- [ ] Afficher les 5 packs
- [ ] Afficher prix et réductions
- [ ] Gérer l'erreur "pas vendredi"
- [ ] Gérer l'erreur "niveau insuffisant"

### Phase 2 - Achat 💰
- [ ] Effectuer un achat
- [ ] Afficher confirmation
- [ ] Mettre à jour ressources joueur
- [ ] Gérer erreurs d'achat
- [ ] Désactiver bouton si limite atteinte
- [ ] Animation d'obtention des tickets

### Phase 3 - UI/UX 🎨
- [ ] Countdown timer
- [ ] Badges "Featured" et "Best Value"
- [ ] Prix barrés pour réductions
- [ ] Couleurs par rareté
- [ ] Animation d'ouverture de la boutique
- [ ] Son de confirmation d'achat
- [ ] Particules pour packs Epic+

### Phase 4 - Avancé 🚀
- [ ] WebSocket pour notifications
- [ ] Notification push le vendredi
- [ ] Badge "NEW" sur icône shop
- [ ] Historique des achats
- [ ] Localisation multilingue
- [ ] Analytics tracking

---

## Exemples d'animations

### Animation d'achat réussi

```csharp
using UnityEngine;
using DG.Tweening;

public class PurchaseAnimator : MonoBehaviour
{
    public GameObject ticketIcon;
    public Transform endPosition;
    public ParticleSystem purchaseParticles;
    public AudioSource purchaseSound;

    public void PlayPurchaseAnimation(Reward reward)
    {
        // Son
        purchaseSound.Play();

        // Particules selon rareté
        PlayParticlesByRarity(reward.quantity >= 50 ? "Legendary" : "Common");

        // Animation des tickets
        for (int i = 0; i < Mathf.Min(reward.quantity, 10); i++)
        {
            GameObject ticket = Instantiate(ticketIcon, transform.position, Quaternion.identity);
            
            ticket.transform.DOMove(endPosition.position, 1f)
                .SetDelay(i * 0.1f)
                .SetEase(Ease.OutQuad)
                .OnComplete(() => {
                    Destroy(ticket);
                    UpdateTicketCount();
                });
        }

        // Texte "+X tickets"
        ShowFloatingText($"+{reward.quantity} 🎟️");
    }

    void PlayParticlesByRarity(string rarity)
    {
        if (rarity == "Legendary" || rarity == "Mythic")
        {
            // Particules dorées
            purchaseParticles.startColor = new Color(1f, 0.84f, 0f);
        }
        else
        {
            // Particules standard
            purchaseParticles.startColor = Color.white;
        }

        purchaseParticles.Play();
    }

    void ShowFloatingText(string text)
    {
        // Implémenter texte flottant
    }

    void UpdateTicketCount()
    {
        // Mettre à jour compteur UI
    }
}
```

### Animation de countdown

```csharp
using UnityEngine;
using UnityEngine.UI;
using System;

public class FridayCountdown : MonoBehaviour
{
    public Text countdownText;
    public Image timerFill;
    public Color normalColor = Color.white;
    public Color urgentColor = Color.red;

    private long timeRemainingMs;
    private const long ONE_HOUR_MS = 3600000;

    public void SetTimeRemaining(long milliseconds)
    {
        timeRemainingMs = milliseconds;
    }

    void Update()
    {
        if (timeRemainingMs <= 0)
        {
            countdownText.text = "Boutique fermée";
            return;
        }

        timeRemainingMs -= (long)(Time.deltaTime * 1000);
        
        TimeSpan timeSpan = TimeSpan.FromMilliseconds(timeRemainingMs);
        
        // Format d'affichage
        if (timeSpan.TotalHours >= 1)
        {
            countdownText.text = $"Se termine dans : {timeSpan.Hours}h {timeSpan.Minutes}m";
        }
        else
        {
            countdownText.text = $"Se termine dans : {timeSpan.Minutes}m {timeSpan.Seconds}s";
        }

        // Barre de progression
        float totalDayMs = 86400000; // 24h en ms
        timerFill.fillAmount = (float)timeRemainingMs / totalDayMs;

        // Couleur urgente si < 1h
        if (timeRemainingMs < ONE_HOUR_MS)
        {
            countdownText.color = Color.Lerp(normalColor, urgentColor, 
                Mathf.PingPong(Time.time, 1f));
        }
        else
        {
            countdownText.color = normalColor;
        }
    }
}
```

---

## Tests et Debug

### Mode Debug (Développement uniquement)

Pour tester la boutique en dehors du vendredi, ajoutez cette variable d'environnement côté serveur :

```bash
SHOP_DEBUG_MODE=true
```

**⚠️ ATTENTION :** Ne jamais activer en production !

### Commandes de test cURL

```bash
# Vérifier la disponibilité
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.com/api/shops/ElementalFriday

# Acheter Pack 1 (5 tickets)
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instanceId":"INSTANCE_ID","quantity":1}' \
  https://your-api.com/api/shops/ElementalFriday/purchase

# Historique
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.com/api/shops/ElementalFriday/history?page=1&limit=10
```

### Logs serveur

Surveillez ces messages dans les logs :

```
✅ Shop ElementalFriday créé avec 5 objets
🔄 Boutique ElementalFriday renouvelée: 5 nouveaux objets
🌍 Envoi notification ElementalFriday à 3 serveur(s): S1, S2, S3
✅ Notification boutique ElementalFriday envoyée à tous les serveurs actifs
💰 Achat 1x elemental_ticket_pack_5 dans ElementalFriday par PLAYER_xxx
🎟️ Added 5x fire tickets to player PLAYER_xxx
```

---

## FAQ

### Q: Que se passe-t-il si je commence un achat à 23h59 vendredi ?
**R:** L'achat sera traité si la requête arrive au serveur avant minuit. Sinon, elle sera refusée avec `SHOP_NOT_AVAILABLE_TODAY`.

### Q: Les limites d'achat se réinitialisent-elles chaque semaine ?
**R:** Oui, chaque vendredi à minuit, tous les compteurs d'achats sont remis à 0.

### Q: Puis-je acheter plusieurs packs différents ?
**R:** Oui, vous pouvez acheter jusqu'à 3 fois CHAQUE pack. Exemple : 3x Pack 1 + 3x Pack 2 = 6 achats au total.

### Q: L'élément des tickets change-t-il chaque semaine ?
**R:** C'est configurable côté serveur. Actuellement fixé à "fire", mais peut être randomisé.

### Q: Que se passe-t-il si le serveur crash pendant la fenêtre vendredi ?
**R:** À la reconnexion, le serveur recalcule si on est toujours vendredi. Si oui, la boutique reste accessible.

### Q: Les gems dépensées sont-elles trackées ?
**R:** Oui, toutes les transactions sont enregistrées dans l'historique d'achat et les analytics serveur.

---

## Performance et optimisation

### Côté Client

1. **Cache des données** : Mettre en cache la réponse GET pendant 5 minutes
2. **Préchargement** : Charger les assets avant d'ouvrir la boutique
3. **Pooling** : Réutiliser les GameObjects des items
4. **Lazy loading** : Charger les images de façon asynchrone

### Côté Serveur

1. **Index MongoDB** : Optimisé pour `shopType` et `isActive`
2. **Cache Redis** (optionnel) : Mettre en cache les détails de la boutique
3. **Rate limiting** : Limiter les requêtes par joueur
4. **Batch updates** : Regrouper les mises à jour

---

## Support et ressources

### Documentation complémentaire

- **API générale des shops** : `/docs/api/shops.md`
- **Système de Feature Unlock** : `/docs/api/features.md`
- **WebSocket Events** : `/docs/api/websocket.md`
- **Économie du jeu** : `/docs/game-design/economy.md`

### Endpoints de test

```
GET  /api/shops/health          # Health check
POST /api/shops/ElementalFriday/refresh  # Force refresh (admin)
```

### Contact

- **Documentation API** : https://docs.your-api.com
- **Support technique** : support@your-game.com
- **Discord** : https://discord.gg/your-game

---

**Version:** 1.0.0  
**Dernière mise à jour:** 2 octobre 2025  
**Système:** Boutique Événementielle Hebdomadaire  
**Auteur:** Équipe Backend SoulSpire

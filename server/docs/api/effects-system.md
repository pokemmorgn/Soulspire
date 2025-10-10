# ⚡ Battle Effects System API - Documentation Unity

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du système](#architecture-du-système)
3. [Types d'effets](#types-deffets)
4. [Modèles de données C#](#modèles-de-données-c)
5. [Intégration dans les combats](#intégration-dans-les-combats)
6. [Animations et visuels](#animations-et-visuels)
7. [Exemples d'implémentation Unity](#exemples-dimplémentation-unity)
8. [Best Practices](#best-practices)

---

## Vue d'ensemble

Le système **Battle Effects** gère tous les effets de statut appliqués aux héros pendant les combats (DoT, buffs, debuffs, contrôle).

### Fonctionnalités principales

- ✅ **Auto-découverte** : Chargement automatique de tous les effets
- ✅ **Système de stacks** : Cumul des effets (ex: Burn x5)
- ✅ **Durée dynamique** : Effets temporaires avec countdown
- ✅ **Résistances** : Éléments et immunités
- ✅ **Métadonnées** : Stockage de données additionnelles (ex: Shield HP)
- ✅ **onApply/onTick/onRemove** : Hooks pour animations
- ✅ **Catégorisation** : DoT, Control, Debuff, Buff, Special

### Catégories d'effets

| Catégorie | Type | Exemples |
|-----------|------|----------|
| **DoT** | `dot` | Burn, Poison, Bleed |
| **Control** | `control` | Stun, Freeze, Silence |
| **Debuff** | `debuff` | Weakness, Vulnerability, Slow |
| **Buff** | `buff` | Strength, Shield, Regeneration |
| **Special** | `special` | Reflect, Thorns, Lifesteal |

---

## Architecture du système

### Structure serveur

```
server/src/gameplay/effects/
├── base/
│   └── BaseEffect.ts          # Classe abstraite
├── dot/                        # Damage Over Time
│   ├── burn.ts                # ✅ Implémenté
│   ├── poison.ts              # 🔜 À venir
│   └── bleed.ts               # 🔜 À venir
├── control/                    # Contrôle
│   ├── stun.ts                # 🔜 À venir
│   ├── freeze.ts              # 🔜 À venir
│   └── silence.ts             # 🔜 À venir
├── debuffs/                    # Affaiblissement
│   ├── weakness.ts            # 🔜 À venir
│   └── vulnerability.ts       # 🔜 À venir
├── buffs/                      # Renforcement
│   ├── shield.ts              # 🔜 À venir
│   └── regeneration.ts        # 🔜 À venir
└── special/                    # Effets spéciaux
    ├── reflect.ts             # 🔜 À venir
    └── thorns.ts              # 🔜 À venir
```

### Flux de traitement

```
1. Sort lancé → EffectManager.applyEffect()
2. Vérification résistance/immunité
3. Application ou stack de l'effet
4. Chaque tour → EffectManager.processEffects()
5. onTick() → Dégâts/soins/modifications
6. Durée -1
7. Si durée = 0 → onRemove()
```

---

## Types d'effets

### 🔥 DoT (Damage Over Time)

#### Burn (Brûlure)
- **ID**: `burn`
- **Élément**: Fire
- **Stackable**: Oui (max 5)
- **Durée**: 3 tours
- **Effet**: 4% HP max + INT caster par tour
- **Résistance**: Fire -50%, Water +30%
- **Visuel**: Particules de feu, aura orange

```json
{
  "effectId": "burn",
  "stacks": 2,
  "duration": 3,
  "metadata": {}
}
```

#### Poison (À venir)
- **ID**: `poison`
- **Élément**: Nature
- **Stackable**: Oui (max 5)
- **Durée**: 4 tours
- **Effet**: Dégâts + réduit soins reçus de 10% par stack
- **Visuel**: Bulles vertes, effet de nausée

#### Bleed (À venir)
- **ID**: `bleed`
- **Élément**: Physical
- **Stackable**: Oui (max 3)
- **Durée**: 3 tours
- **Effet**: Dégâts physiques, doublés si la cible attaque
- **Visuel**: Gouttes de sang

---

### 🥶 Control (Contrôle)

#### Stun (À venir)
- **ID**: `stun`
- **Stackable**: Non
- **Durée**: 1-2 tours
- **Effet**: Impossible d'agir (skip turn complet)
- **Résistance**: 20% base pour les Tanks
- **Visuel**: Étoiles tournantes, immobilité

#### Freeze (À venir)
- **ID**: `freeze`
- **Stackable**: Non
- **Durée**: 2 tours
- **Effet**: Impossible d'agir + slow après dégel
- **Résistance**: Water 50%
- **Visuel**: Bloc de glace, effet givré

#### Silence (À venir)
- **ID**: `silence`
- **Stackable**: Non
- **Durée**: 2-3 tours
- **Effet**: Impossible de lancer des sorts (attaque basique uniquement)
- **Visuel**: Symbole interdit sur la bouche

---

### ⬇️ Debuffs (Affaiblissement)

#### Weakness (À venir)
- **ID**: `weakness`
- **Stackable**: Oui (max 3)
- **Durée**: 3 tours
- **Effet**: -15% ATK par stack
- **Visuel**: Aura grise, posture affaiblie

#### Vulnerability (À venir)
- **ID**: `vulnerability`
- **Stackable**: Non
- **Durée**: 2 tours
- **Effet**: +25% dégâts reçus
- **Visuel**: Fissures sur le corps

#### Armor Break (À venir)
- **ID**: `armor_break`
- **Stackable**: Non
- **Durée**: 3 tours
- **Effet**: -30% DEF
- **Visuel**: Armure brisée

---

### ⬆️ Buffs (Renforcement)

#### Shield (À venir)
- **ID**: `shield`
- **Stackable**: Non
- **Durée**: Jusqu'à destruction
- **Effet**: Absorbe X HP de dégâts
- **Metadata**: `{ hp: 500 }` (HP restants)
- **Visuel**: Bulle protectrice bleue

#### Regeneration (À venir)
- **ID**: `regeneration`
- **Stackable**: Oui (max 3)
- **Durée**: 5 tours
- **Effet**: Soigne 3% HP max par tour par stack
- **Visuel**: Aura verte, particules de soin

#### Strength (À venir)
- **ID**: `strength`
- **Stackable**: Oui (max 3)
- **Durée**: 3 tours
- **Effet**: +20% ATK par stack
- **Visuel**: Aura rouge, muscles gonflés

---

### ✨ Special (Effets spéciaux)

#### Reflect (À venir)
- **ID**: `reflect`
- **Stackable**: Non
- **Durée**: 2 tours
- **Effet**: Renvoie 30% des dégâts subis
- **Visuel**: Miroir magique

#### Thorns (À venir)
- **ID**: `thorns`
- **Stackable**: Oui (max 5)
- **Durée**: 3 tours
- **Effet**: Inflige 50 dégâts aux attaquants par stack
- **Visuel**: Épines sur le corps

---

## Modèles de données C#

### Effect Model

```csharp
[System.Serializable]
public class ActiveEffect
{
    public string effectId;         // "burn", "stun", etc.
    public int stacks;              // Nombre de stacks
    public int duration;            // Tours restants
    public string appliedBy;        // ID du héros qui a appliqué
    public EffectMetadata metadata; // Données additionnelles
}

[System.Serializable]
public class EffectMetadata
{
    public int shieldHp;           // Pour Shield
    public float damageMultiplier; // Pour certains effets
    // Extensible selon les besoins
}
```

### Effect Info (pour affichage)

```csharp
[System.Serializable]
public class EffectInfo
{
    public string id;
    public string name;
    public string description;
    public string type;            // "dot", "control", "debuff", "buff", "special"
    public string category;        // "damage_over_time", "crowd_control", etc.
    public bool stackable;
    public int maxStacks;
    public int baseDuration;
    public string iconPath;        // Chemin vers l'icône
    public Color effectColor;      // Couleur de l'effet
}
```

### Battle Action avec effets

```csharp
[System.Serializable]
public class BattleAction
{
    public int turn;
    public string actionType;
    public string actorId;
    public string actorName;
    public string[] targetIds;
    
    public int damage;
    public int healing;
    
    public string[] buffsApplied;   // ✅ Effets positifs appliqués
    public string[] debuffsApplied; // ✅ Effets négatifs appliqués
    
    public bool critical;
    public float elementalAdvantage;
    
    public Dictionary<string, ParticipantState> participantsAfter;
}

[System.Serializable]
public class ParticipantState
{
    public int currentHp;
    public int energy;
    public string[] buffs;          // IDs des buffs actifs
    public string[] debuffs;        // IDs des debuffs actifs
    public bool alive;
}
```

---

## Intégration dans les combats

### Flow d'un tour de combat

```
DÉBUT DU TOUR
├─ 1. Génération d'énergie
├─ 2. Traitement des effets (processEffects)
│   ├─ DoT → Dégâts
│   ├─ HoT → Soins
│   ├─ Buffs → Modifications stats
│   └─ Durée -1
├─ 3. Vérification Control
│   └─ Si stunned/frozen → Skip action
├─ 4. Détermination de l'action
├─ 5. Exécution de l'action
│   └─ Application nouveaux effets
└─ FIN DU TOUR
```

### Exemple de réponse API

```json
{
  "turn": 5,
  "actionType": "skill",
  "actorName": "Ignis",
  "targetIds": ["HERO_123"],
  "damage": 450,
  "debuffsApplied": ["burn"],
  "participantsAfter": {
    "HERO_123": {
      "currentHp": 1200,
      "energy": 45,
      "buffs": [],
      "debuffs": ["burn"],
      "alive": true
    }
  }
}
```

---

## Animations et visuels

### Couleurs par catégorie

```csharp
public static class EffectColors
{
    public static Color DoT = new Color(1.0f, 0.3f, 0.0f);      // Orange
    public static Color Control = new Color(0.5f, 0.5f, 1.0f);  // Bleu clair
    public static Color Debuff = new Color(0.6f, 0.0f, 0.6f);   // Violet
    public static Color Buff = new Color(0.0f, 1.0f, 0.4f);     // Vert
    public static Color Special = new Color(1.0f, 0.8f, 0.0f);  // Doré
}
```

### Icônes recommandées

| Effet | Icône | Couleur |
|-------|-------|---------|
| Burn | 🔥 | Orange |
| Poison | ☠️ | Vert |
| Stun | 💫 | Jaune |
| Freeze | ❄️ | Cyan |
| Weakness | 💔 | Gris |
| Shield | 🛡️ | Bleu |
| Regeneration | 💚 | Vert clair |
| Reflect | 🪞 | Argenté |

### Animation timing

```csharp
public class EffectAnimationConfig
{
    public float onApplyDuration = 0.5f;    // Animation d'application
    public float onTickDuration = 0.3f;     // Animation par tour
    public float onRemoveDuration = 0.4f;   // Animation de retrait
    
    public AnimationCurve fadeInCurve;
    public AnimationCurve fadeOutCurve;
}
```

---

## Exemples d'implémentation Unity

### 1. Manager d'effets UI

```csharp
using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class EffectUIManager : MonoBehaviour
{
    [System.Serializable]
    public class EffectIconConfig
    {
        public string effectId;
        public Sprite icon;
        public Color color;
    }

    public List<EffectIconConfig> effectIcons;
    public GameObject effectIconPrefab;
    public Transform effectContainer;

    private Dictionary<string, EffectIconConfig> effectIconMap;
    private List<GameObject> activeEffectIcons = new List<GameObject>();

    void Start()
    {
        // Créer le dictionnaire de lookup
        effectIconMap = new Dictionary<string, EffectIconConfig>();
        foreach (var config in effectIcons)
        {
            effectIconMap[config.effectId] = config;
        }
    }

    public void UpdateEffects(string[] buffs, string[] debuffs)
    {
        // Nettoyer les icônes existantes
        foreach (var icon in activeEffectIcons)
        {
            Destroy(icon);
        }
        activeEffectIcons.Clear();

        // Afficher les buffs
        foreach (var buffId in buffs)
        {
            CreateEffectIcon(buffId, true);
        }

        // Afficher les debuffs
        foreach (var debuffId in debuffs)
        {
            CreateEffectIcon(debuffId, false);
        }
    }

    private void CreateEffectIcon(string effectId, bool isBuff)
    {
        if (!effectIconMap.ContainsKey(effectId))
        {
            Debug.LogWarning($"No icon config for effect: {effectId}");
            return;
        }

        var config = effectIconMap[effectId];
        
        GameObject iconObj = Instantiate(effectIconPrefab, effectContainer);
        Image iconImage = iconObj.GetComponent<Image>();
        
        if (iconImage != null)
        {
            iconImage.sprite = config.icon;
            iconImage.color = config.color;
        }

        // Ajouter une bordure selon le type
        Outline outline = iconObj.GetComponent<Outline>();
        if (outline != null)
        {
            outline.effectColor = isBuff ? Color.green : Color.red;
        }

        activeEffectIcons.Add(iconObj);
    }
}
```

### 2. Affichage de stacks

```csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class EffectStackDisplay : MonoBehaviour
{
    public Image effectIcon;
    public TextMeshProUGUI stackText;
    public TextMeshProUGUI durationText;
    
    private int currentStacks;
    private int currentDuration;

    public void Initialize(ActiveEffect effect, EffectIconConfig config)
    {
        effectIcon.sprite = config.icon;
        effectIcon.color = config.color;
        
        UpdateStacks(effect.stacks);
        UpdateDuration(effect.duration);
    }

    public void UpdateStacks(int stacks)
    {
        currentStacks = stacks;
        stackText.text = stacks > 1 ? $"x{stacks}" : "";
        stackText.gameObject.SetActive(stacks > 1);
    }

    public void UpdateDuration(int duration)
    {
        currentDuration = duration;
        durationText.text = duration.ToString();
        
        // Changer la couleur selon la durée restante
        if (duration <= 1)
        {
            durationText.color = Color.red;
        }
        else if (duration <= 2)
        {
            durationText.color = Color.yellow;
        }
        else
        {
            durationText.color = Color.white;
        }
    }
}
```

### 3. Animations de particules

```csharp
using UnityEngine;

public class EffectParticleManager : MonoBehaviour
{
    [System.Serializable]
    public class EffectParticle
    {
        public string effectId;
        public ParticleSystem particlePrefab;
        public AudioClip soundEffect;
    }

    public EffectParticle[] effectParticles;
    private Dictionary<string, EffectParticle> particleMap;

    void Start()
    {
        particleMap = new Dictionary<string, EffectParticle>();
        foreach (var particle in effectParticles)
        {
            particleMap[particle.effectId] = particle;
        }
    }

    public void PlayEffectApplication(string effectId, Transform target)
    {
        if (!particleMap.ContainsKey(effectId)) return;

        var config = particleMap[effectId];
        
        // Spawn particules
        if (config.particlePrefab != null)
        {
            ParticleSystem ps = Instantiate(config.particlePrefab, target.position, Quaternion.identity);
            ps.Play();
            Destroy(ps.gameObject, 3f);
        }

        // Jouer son
        if (config.soundEffect != null)
        {
            AudioSource.PlayClipAtPoint(config.soundEffect, target.position);
        }
    }

    public void PlayEffectTick(string effectId, Transform target, int damage)
    {
        // Animation plus subtile pour les ticks
        if (!particleMap.ContainsKey(effectId)) return;

        var config = particleMap[effectId];
        
        if (config.particlePrefab != null)
        {
            ParticleSystem ps = Instantiate(config.particlePrefab, target.position, Quaternion.identity);
            var main = ps.main;
            main.startLifetime = 0.5f; // Plus court que l'application
            ps.Play();
            Destroy(ps.gameObject, 1f);
        }

        // Afficher les dégâts
        ShowFloatingDamage(damage, target.position, config.effectId);
    }

    private void ShowFloatingDamage(int damage, Vector3 position, string effectType)
    {
        // Créer un texte flottant avec la bonne couleur
        // Implémentation selon votre système de floating text
    }
}
```

### 4. Gestion des résistances (client-side preview)

```csharp
using UnityEngine;

public class EffectResistanceCalculator : MonoBehaviour
{
    public float CalculateResistanceChance(string effectElement, string targetElement)
    {
        // Résistance élémentaire basique
        if (targetElement == effectElement)
        {
            return 0.5f; // 50% de résistance
        }

        // Avantages/désavantages élémentaires
        if (IsWeakTo(targetElement, effectElement))
        {
            return -0.3f; // 30% plus vulnérable
        }

        return 0f; // Neutre
    }

    private bool IsWeakTo(string targetElement, string effectElement)
    {
        var weaknesses = new Dictionary<string, string[]>
        {
            { "Fire", new[] { "Water" } },
            { "Water", new[] { "Electric" } },
            { "Electric", new[] { "Wind" } },
            { "Wind", new[] { "Fire" } },
            { "Light", new[] { "Dark" } },
            { "Dark", new[] { "Light" } }
        };

        if (weaknesses.ContainsKey(targetElement))
        {
            return System.Array.Exists(weaknesses[targetElement], e => e == effectElement);
        }

        return false;
    }

    public bool WillResist(string effectId, string targetElement)
    {
        // Récupérer l'élément de l'effet (depuis config)
        string effectElement = GetEffectElement(effectId);
        
        float resistanceChance = CalculateResistanceChance(effectElement, targetElement);
        
        if (resistanceChance > 0)
        {
            return Random.value < resistanceChance;
        }

        return false;
    }

    private string GetEffectElement(string effectId)
    {
        // Mapping des effets vers leurs éléments
        switch (effectId)
        {
            case "burn": return "Fire";
            case "freeze": return "Water";
            case "poison": return "Nature";
            // etc.
            default: return "None";
        }
    }
}
```

### 5. Tooltip des effets

```csharp
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using TMPro;

public class EffectTooltip : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
    public GameObject tooltipPanel;
    public TextMeshProUGUI tooltipTitle;
    public TextMeshProUGUI tooltipDescription;
    public Image tooltipIcon;

    private ActiveEffect effect;
    private EffectInfo effectInfo;

    public void Initialize(ActiveEffect effect, EffectInfo info)
    {
        this.effect = effect;
        this.effectInfo = info;
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        ShowTooltip();
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        HideTooltip();
    }

    private void ShowTooltip()
    {
        tooltipPanel.SetActive(true);
        
        tooltipTitle.text = $"{effectInfo.name}";
        
        if (effect.stacks > 1)
        {
            tooltipTitle.text += $" x{effect.stacks}";
        }

        string description = effectInfo.description;
        description += $"\n\n<color=yellow>Durée: {effect.duration} tours</color>";

        if (effectInfo.stackable && effect.stacks > 1)
        {
            description += $"\n<color=cyan>Stacks: {effect.stacks}/{effectInfo.maxStacks}</color>";
        }

        tooltipDescription.text = description;
        tooltipIcon.sprite = GetEffectSprite(effectInfo.id);
        tooltipIcon.color = effectInfo.effectColor;
    }

    private void HideTooltip()
    {
        tooltipPanel.SetActive(false);
    }

    private Sprite GetEffectSprite(string effectId)
    {
        // Charger le sprite depuis Resources ou un ScriptableObject
        return Resources.Load<Sprite>($"Effects/Icons/{effectId}");
    }
}
```

---

## Best Practices

### ✅ À FAIRE

1. **Animations claires**
   - Couleur distincte par catégorie
   - Particules différentes par effet
   - Son unique par application

2. **UI informative**
   - Afficher les stacks
   - Montrer la durée restante
   - Tooltip détaillé au survol

3. **Feedback visuel**
   - Icône de résistance si effet bloqué
   - Animation spéciale pour les effets critiques
   - Particules persistantes pour les DoT

4. **Performance**
   - Pool de particules
   - Limiter les effets visuels simultanés
   - Utiliser des sprites atlas

5. **Accessibilité**
   - Mode daltonien (pas que des couleurs)
   - Formes distinctes par effet
   - Texte lisible

### ❌ À ÉVITER

1. **Ne pas** cacher les effets actifs
2. **Ne pas** oublier le feedback de résistance
3. **Ne pas** surcharger l'écran d'effets
4. **Ne pas** ignorer les stacks
5. **Ne pas** utiliser des animations trop longues

---

## Checklist d'intégration

### Phase 1 - Basique
- [ ] Afficher les effets actifs (icônes)
- [ ] Système de couleurs par catégorie
- [ ] Tooltip basique
- [ ] Stacks display

### Phase 2 - Animations
- [ ] Particules d'application
- [ ] Animation de tick
- [ ] Sons par effet
- [ ] Floating damage pour DoT

### Phase 3 - Avancé
- [ ] Animations complexes par effet
- [ ] Système de résistance visuel
- [ ] Pool de particules
- [ ] Effets de post-processing

---

## Configuration recommandée

### ScriptableObject pour les effets

```csharp
[CreateAssetMenu(fileName = "EffectConfig", menuName = "Game/Effect Config")]
public class EffectConfig : ScriptableObject
{
    public string effectId;
    public string displayName;
    [TextArea(3, 5)]
    public string description;
    
    public EffectType type;
    public Sprite icon;
    public Color color;
    
    public ParticleSystem applyParticles;
    public ParticleSystem tickParticles;
    public ParticleSystem removeParticles;
    
    public AudioClip applySound;
    public AudioClip tickSound;
    public AudioClip removeSound;
    
    public bool isStackable;
    public int maxStacks;
}

public enum EffectType
{
    DoT,
    Control,
    Debuff,
    Buff,
    Special
}
```

---

## Support et Debug

### Logs serveur

Le serveur log tous les effets appliqués :

```
🔥 Ignis applique Burn à Enemy_123
🔥 Enemy_123 subit 45 dégâts de brûlure (2 stacks)
💨 La brûlure de Enemy_123 s'éteint
```

### Debug client-side

```csharp
public class EffectDebugger : MonoBehaviour
{
    public void LogActiveEffects(ParticipantState state)
    {
        Debug.Log($"=== Effets actifs ===");
        Debug.Log($"Buffs: {string.Join(", ", state.buffs)}");
        Debug.Log($"Debuffs: {string.Join(", ", state.debuffs)}");
    }
}
```

---

## Roadmap

### Version 1.0 (Actuelle)
- ✅ Système de base
- ✅ Burn implémenté
- ✅ Auto-discovery

### Version 1.1 (Prochaine)
- 🔜 Stun, Freeze, Silence
- 🔜 Poison, Bleed
- 🔜 Weakness, Vulnerability

### Version 1.2
- 🔜 Shield, Regeneration
- 🔜 Reflect, Thorns

### Version 2.0
- 🔜 Effets combinés
- 🔜 Résistances avancées
- 🔜 Effets d'équipement

---

**Version:** 1.0.0  
**Dernière mise à jour:** 10 octobre 2025  
**Système:** Battle Effects avec Auto-Discovery

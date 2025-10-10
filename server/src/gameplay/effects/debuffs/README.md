# 💔 Debuff Effects (Affaiblissement)

Ce répertoire contient tous les effets d'affaiblissement qui réduisent les capacités des participants sans infliger de dégâts directs.

---

## 📋 Effets disponibles

### ✅ Weakness (Faiblesse)

**Fichier**: `weakness.ts`  
**ID**: `weakness`  
**Type**: Debuff  
**Catégorie**: Stat Modifier

#### Caractéristiques
- **Stackable**: Oui (max 3)
- **Durée**: 3 tours (base)
- **Effet**: Réduit ATK

#### Effet
Réduit l'attaque de la cible :
- **Réduction**: -15% ATK par stack
- **Max réduction**: -45% ATK (3 stacks)
- **Affecte**: Toutes les sources de dégâts (attaque, sorts, ultimate)

#### Résistances
- **Immunity**: Bloque l'application
- **Rage / Berserk**: Immunité spécifique (trop enragé)

#### Formule de réduction
```
Réduction = stacks × 15%
Dégâts finaux = Dégâts base × (1 - Réduction / 100)

Exemples:
1 stack: 100 dégâts → 85 dégâts (-15%)
2 stacks: 100 dégâts → 70 dégâts (-30%)
3 stacks: 100 dégâts → 55 dégâts (-45%)
```

#### Messages
```
Application: 💔 [Cible] est affaibli !
Tick: 💔 [Cible] est affaibli (-X% ATK)
Retrait: 💪 [Cible] retrouve sa force
```

#### Visuel recommandé Unity
- Icône: 💔 Cœur brisé
- Couleur: Gris (#808080)
- Animation: Posture affaissée, aura grise
- Particules: Énergie qui s'échappe
- Son: Soupir de faiblesse

#### Cas d'usage
- Counter les DPS agressifs
- Réduire les burst damage ennemis
- Protection de l'équipe
- Synergie avec Tanks (survivre plus longtemps)

#### Stratégie
- **Optimal**: Appliquer sur DPS ennemi principal
- **Combo**: Weakness + Focus fire = Survie améliorée
- **Timing**: Avant un ultimate ennemi prévu
- **Stack**: 2-3 stacks pour neutraliser un DPS

---

### ✅ Vulnerability (Vulnérabilité)

**Fichier**: `vulnerability.ts`  
**ID**: `vulnerability`  
**Type**: Debuff  
**Catégorie**: Stat Modifier

#### Caractéristiques
- **Stackable**: Non (trop puissant)
- **Durée**: 2 tours (base)
- **Effet**: Augmente dégâts reçus

#### Effet
Augmente tous les dégâts reçus :
- **Amplification**: +25% dégâts reçus
- **Affecte**: TOUS les types de dégâts (physique, magique, DoT, etc.)
- **Non stackable**: Effet unique mais très puissant

#### Résistances
- **Immunity**: Bloque l'application
- **Fortify / Protection**: Immunité spécifique
- **Tanks**: 20% de résistance naturelle

#### Formule d'amplification
```
Dégâts finaux = Dégâts base × 1.25

Exemple:
Sans Vulnerability: 100 dégâts reçus
Avec Vulnerability: 125 dégâts reçus (+25%)
```

#### Messages
```
Application: 🎯 [Cible] devient vulnérable !
Tick: 🎯 [Cible] est vulnérable (+25% dégâts reçus)
Retrait: 🛡️ [Cible] n'est plus vulnérable
```

#### Visuel recommandé Unity
- Icône: 🎯 Cible / Bullseye
- Couleur: Rouge (#FF0000)
- Animation: Marque lumineuse sur le corps
- Particules: Aura clignotante rouge
- Son: Cible verrouillée

#### Cas d'usage
- Setup pour burst damage coordonné
- Focus fire sur une cible prioritaire
- Exécution rapide de boss/élite
- Combo ultime d'équipe

#### Stratégie
- **Optimal**: Appliquer avant burst damage coordonné
- **Combo**: Vulnerability → 3 DPS ultimate = Élimination garantie
- **Timing**: CRITIQUE - synchroniser avec cooldowns équipe
- **Cible**: Boss, Tank ennemi, ou cible prioritaire

#### Synergies puissantes
```
Vulnerability + Corrosion + Armor Break = -55% DEF + +25% dégâts
Vulnerability + Weakness sur équipe ennemie = Swing massif
Vulnerability + DoT stacks = Dégâts constants amplifiés
```

---

### ✅ Armor Break (Brisure d'armure)

**Fichier**: `armor_break.ts`  
**ID**: `armor_break`  
**Type**: Debuff  
**Catégorie**: Stat Modifier

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 3 tours (base)
- **Effet**: Réduit DEF fortement

#### Effet
Réduit la défense de la cible :
- **Réduction**: -30% DEF (non stackable)
- **Différence avec Corrosion**: Burst immédiat vs accumulation progressive
- **Affecte**: Défense physique ET magique

#### Résistances
- **Immunity**: Bloque l'application
- **Unbreakable / Adamantine**: Immunité spécifique (armure incassable)
- **Tanks**: 15% de résistance naturelle

#### Formule de réduction
```
DEF finale = DEF base × 0.7

Exemple:
100 DEF → 70 DEF (-30%)
```

#### Comparaison : Armor Break vs Corrosion

| Aspect | Armor Break | Corrosion |
|--------|-------------|-----------|
| **Type** | Debuff | DoT |
| **Stackable** | Non | Oui (5 stacks) |
| **Réduction max** | -30% | -25% (5 stacks) |
| **Durée** | 3 tours | 4 tours |
| **Dégâts DoT** | Non | Oui (~3.5% HP/tour) |
| **Application** | Burst immédiat | Accumulation progressive |
| **Usage** | Briser tanks rapidement | Éroder défenses + dégâts |

#### Messages
```
Application: 🔨 L'armure de [Cible] se brise !
Tick: 🔨 L'armure de [Cible] est brisée (-30% DEF)
Retrait: 🛡️ L'armure de [Cible] se répare
```

#### Visuel recommandé Unity
- Icône: 🔨 Marteau / Armure fissurée
- Couleur: Orange foncé (#FF8C00)
- Animation: Fissures apparaissant sur l'armure
- Particules: Éclats d'armure tombants
- Son: Métal qui se brise / Craquement

#### Cas d'usage
- Burst damage immédiat sur Tank
- Alternative rapide à Corrosion
- Pas de temps pour stack = Armor Break
- Focus fire coordonné

#### Stratégie
- **Optimal**: Tank ennemi ou boss avec haute DEF
- **Combo**: Armor Break → Focus fire immédiat
- **Timing**: Quand il faut briser un tank MAINTENANT
- **Vs Corrosion**: Choix selon durée du combat

---

### ✅ Slow (Ralentissement)

**Fichier**: `slow.ts`  
**ID**: `slow`  
**Type**: Debuff  
**Catégorie**: Stat Modifier

#### Caractéristiques
- **Stackable**: Oui (max 2)
- **Durée**: 3 tours (base)
- **Effet**: Réduit vitesse

#### Effet
Réduit la vitesse de la cible :
- **Réduction**: -30% vitesse par stack
- **Max réduction**: -60% vitesse (2 stacks)
- **Impact**: Agit plus tard dans l'ordre des tours
- **Note**: Après-effet de Freeze (Chilled)

#### Résistances
- **Immunity**: Bloque l'application
- **Haste / Swift**: Immunité spécifique (trop rapide)
- **Wind**: 25% de résistance naturelle (agilité)

#### Formule de réduction
```
Réduction = stacks × 30%
Vitesse finale = Vitesse base × (1 - Réduction / 100)

Exemples:
Base: 100 vitesse, ordre = 3ème
1 stack: 70 vitesse, ordre = 5ème (-30%)
2 stacks: 40 vitesse, ordre = 8ème (-60%)
```

#### Messages
```
Application: 🐌 [Cible] est ralenti !
Tick: 🐌 [Cible] est ralenti (-X% vitesse)
Retrait: ⚡ [Cible] retrouve sa vitesse normale
```

#### Visuel recommandé Unity
- Icône: 🐌 Escargot / Horloge ralentie
- Couleur: Bleu foncé (#4169E1)
- Animation: Mouvements au ralenti, traînées bleues
- Particules: Aura bleue pesante
- Son: Effet de ralentissement temporel

#### Cas d'usage
- Counter les héros rapides
- Contrôler l'ordre des tours
- Empêcher les interruptions
- Protéger les alliés lents

#### Stratégie
- **Optimal**: DPS rapides, Assassins
- **Combo**: Slow → Alliés agissent en premier
- **Timing**: Avant les tours critiques
- **Stack**: 2 stacks pour quasi-immobiliser

#### Impact tactique
```
Équipe rapide (80-100 vitesse):
Sans Slow: Agit en premier
Avec Slow 2 stacks: Agit en dernier

Équipe lente (40-60 vitesse):
Slow adversaires = Égalise le terrain
Slow + Haste allié = Contrôle total
```

---

## 🔄 Comparaison des Debuffs

### Tableau récapitulatif

| Debuff | Stackable | Max stacks | Durée | Effet | Résistances spéciales |
|--------|-----------|------------|-------|-------|----------------------|
| **Weakness** | Oui | 3 | 3 tours | -15% ATK/stack | Rage, Berserk |
| **Vulnerability** | Non | 1 | 2 tours | +25% dégâts reçus | Fortify, Protection |
| **Armor Break** | Non | 1 | 3 tours | -30% DEF | Unbreakable, Adamantine |
| **Slow** | Oui | 2 | 3 tours | -30% vitesse/stack | Haste, Swift, Wind 25% |

### Impact par stack

**Weakness** (Réduction ATK):
```
1 stack: -15% ATK
2 stacks: -30% ATK
3 stacks: -45% ATK (max)
```

**Vulnerability** (Amplification dégâts):
```
Active: +25% dégâts reçus (non stackable)
```

**Armor Break** (Réduction DEF):
```
Active: -30% DEF (non stackable)
```

**Slow** (Réduction vitesse):
```
1 stack: -30% vitesse
2 stacks: -60% vitesse (max)
```

---

## 🎮 Intégration BattleEngine

### Via DebuffManager

Tous les debuffs sont appliqués proprement via le `DebuffManager` :

```typescript
import { DebuffManager } from "../gameplay/DebuffManager";

// Dans calculateDamage()
defense = DebuffManager.applyArmorBreak(defender, defense);
damage = DebuffManager.applyWeakness(attacker, damage);
damage = DebuffManager.applyVulnerability(defender, damage);

// Dans processTurn()
const effectiveSpeed = DebuffManager.getEffectiveSpeed(participant, baseSpeed);
```

### Ordre d'application

**Calcul des dégâts** (ordre important) :
```
1. Calcul ATK de base
2. Calcul DEF de base
3. Appliquer Corrosion (DoT) sur DEF
4. Appliquer Armor Break (Debuff) sur DEF
5. Calcul dégâts bruts (ATK - DEF/2)
6. Appliquer Weakness sur dégâts
7. Multiplicateurs élémentaires
8. Multiplicateurs de rareté
9. Variation aléatoire
10. Appliquer Vulnerability (DERNIER)
```

**Pourquoi cet ordre ?**
- **Armor Break après Corrosion** : Les deux réductions s'appliquent séquentiellement
- **Weakness avant Vulnerability** : Réduit d'abord l'attaque, puis amplifie le résultat
- **Vulnerability en dernier** : Amplifie TOUT (inclut les autres debuffs)

### Exemple de calcul complet

```
Attaquant: 100 ATK, Weakness 2 stacks (-30%)
Défenseur: 100 DEF, Armor Break (-30%), Vulnerability (+25%)

1. ATK base = 100
2. DEF base = 100
3. Armor Break: 100 × 0.7 = 70 DEF
4. Dégâts bruts: 100 - 70/2 = 65
5. Weakness: 65 × 0.7 = 45.5
6. Vulnerability: 45.5 × 1.25 = 56.875

Dégâts finaux: 57 (arrondi)

Sans debuffs: 100 - 100/2 = 50
Avec debuffs: 57
Impact: +14% dégâts malgré Weakness !
```

---

## 💡 Stratégies et Combos

### Combos offensifs

**Combo "Exécution"** (Burst damage maximal):
```
1. Armor Break (-30% DEF)
2. Vulnerability (+25% dégâts)
3. Focus fire toute l'équipe
= Élimination quasi-garantie
```

**Combo "Neutralisation"** (Counter DPS):
```
1. Weakness 3 stacks (-45% ATK)
2. Slow 2 stacks (-60% vitesse)
= DPS complètement neutralisé
```

**Combo "Tank Breaker"**:
```
1. Armor Break (-30% DEF)
2. Corrosion 5 stacks (-25% DEF)
= -55% DEF + DoT constants
```

### Combos défensifs

**Combo "Survie"** (Réduire dégâts entrants):
```
1. Weakness sur tous les DPS ennemis
2. Slow sur les plus rapides
= -45% dégâts + contrôle des tours
```

**Combo "Contrôle"** (Maîtriser le tempo):
```
1. Slow 2 stacks sur équipe ennemie
2. Haste (buff) sur équipe alliée
= Contrôle total de l'ordre des tours
```

### Synergie Debuffs + DoT

**Combo "Poison lent"**:
```
1. Poison 5 stacks (-50% soins + DoT)
2. Weakness 3 stacks (-45% ATK)
= Cible ne peut ni attaquer ni se soigner
```

**Combo "Corrosion focus"**:
```
1. Corrosion 5 stacks (-25% DEF + DoT)
2. Armor Break (-30% DEF)
3. Vulnerability (+25% dégâts)
= -55% DEF + +25% dégâts + DoT constants
```

---

## 📊 Balance et Design

### Philosophie de design

Chaque debuff a un **rôle tactique distinct** :

1. **Weakness** : Réduction offensive progressive (stack)
2. **Vulnerability** : Amplification burst (non stack mais puissant)
3. **Armor Break** : Réduction défensive immédiate (burst)
4. **Slow** : Contrôle du tempo (stack)

### Durées et stacking

```
Stack rapide (3 stacks max):
- Weakness: 3 tours pour full stack
- Courte durée = besoin de réapplication

Burst immédiat (non stackable):
- Vulnerability: 2 tours, impact fort
- Armor Break: 3 tours, setup rapide

Contrôle progressif (2 stacks):
- Slow: Build up lent mais impactant
```

### Quand utiliser chaque debuff ?

#### Weakness 💔
- **Quand** : DPS ennemi fait trop de dégâts
- **Cible** : DPS principaux, Assassins
- **Timing** : Début/milieu de combat
- **Stack** : 2-3 stacks recommandés

#### Vulnerability 🎯
- **Quand** : Setup burst damage coordonné
- **Cible** : Boss, élite, cible prioritaire
- **Timing** : Juste avant ultimates équipe
- **Stack** : Non stackable, synchroniser cooldowns

#### Armor Break 🔨
- **Quand** : Tank ennemi bloque progression
- **Cible** : Tanks, high DEF enemies
- **Timing** : Quand rush nécessaire
- **Stack** : Non stackable, alternative à Corrosion

#### Slow 🐌
- **Quand** : Héros ennemis trop rapides
- **Cible** : DPS rapides, interrupteurs
- **Timing** : Début de combat pour contrôle
- **Stack** : 2 stacks pour lock complet

---

## 🧪 Tests recommandés

### Test 1 : Application et stacking

**Weakness**:
```
1. Appliquer Weakness (1 stack)
2. Attaque → Vérifier réduction -15%
3. Appliquer 2 stacks supplémentaires
4. Attaque → Vérifier réduction -45%
```

**Slow**:
```
1. Appliquer Slow (1 stack)
2. Tour suivant → Vérifier ordre retardé
3. Appliquer 2ème stack
4. Vérifier vitesse réduite de 60%
```

### Test 2 : Non-stackable

**Vulnerability**:
```
1. Appliquer Vulnerability
2. Tenter de réappliquer
3. Vérifier que durée se rafraîchit (pas de stack)
4. Vérifier dégâts +25% (pas +50%)
```

**Armor Break**:
```
1. Appliquer Armor Break
2. Tenter de réappliquer
3. Vérifier durée rafraîchie
4. Vérifier DEF -30% (pas cumulatif)
```

### Test 3 : Ordre d'application

```
1. Appliquer Armor Break + Vulnerability sur cible
2. Attaquer avec Weakness sur attaquant
3. Vérifier ordre : DEF réduite → ATK réduite → Dégâts amplifiés
4. Calculer manuellement et comparer
```

### Test 4 : Résistances

**Weakness vs Rage**:
```
1. Cible a buff "rage"
2. Tenter Weakness
3. Vérifier canApplyTo() retourne false
```

**Slow vs Wind**:
```
1. Appliquer Slow sur héros Wind (20+ fois)
2. Calculer taux de résistance
3. Vérifier ~25% de résistance
```

### Test 5 : Durée et expiration

```
1. Appliquer tous les debuffs
2. Compter les tours jusqu'à expiration
3. Vérifier messages de retrait
4. Vérifier stats reviennent à la normale
```

### Test 6 : Combo complexe

```
1. Appliquer Corrosion (5 stacks) sur Tank
2. Appliquer Armor Break sur même Tank
3. Appliquer Vulnerability
4. Toute l'équipe attaque
5. Vérifier cumul des réductions/amplifications
6. Tank devrait mourir très vite
```

---

## 📚 Références

### Fichiers liés
- `server/src/gameplay/effects/base/BaseEffect.ts` - Classe de base
- `server/src/gameplay/EffectManager.ts` - Gestionnaire central
- `server/src/gameplay/DebuffManager.ts` - Gestionnaire debuffs
- `server/src/services/BattleEngine.ts` - Intégration combat

### Méthodes utilitaires du DebuffManager

```typescript
// Vérifier présence
DebuffManager.hasDebuff(target, "weakness"): boolean

// Obtenir liste active
DebuffManager.getActiveDebuffs(target): string[]

// Calculer impact total
DebuffManager.calculateDebuffImpact(target): {
  atkReduction: number,
  defReduction: number,
  speedReduction: number,
  damageAmplification: number
}

// Résumé pour UI
DebuffManager.getDebuffSummary(target): string

// Vérifier si fortement debuffé
DebuffManager.isHeavilyDebuffed(target): boolean

// Appliquer effets individuels
DebuffManager.applyWeakness(attacker, baseDamage): number
DebuffManager.applyVulnerability(target, baseDamage): number
DebuffManager.applyArmorBreak(target, baseDefense): number
DebuffManager.applySlowEffect(target, baseSpeed): number

// Stats effectives
DebuffManager.getEffectiveAttack(attacker, baseAtk): number
DebuffManager.getEffectiveDefense(defender, baseDef): number
DebuffManager.getEffectiveSpeed(participant, baseSpeed): number
```

---

## 🔜 Debuffs à venir (idées)

### Blind (Aveuglement)
- Réduit précision/chance de critique
- Peut manquer des attaques
- Counter vs critiques

### Curse (Malédiction)
- Réduit TOUTES les stats
- Peut se transmettre aux alliés
- Puissant mais rare

### Silence Break (Bris de concentration)
- Augmente coût énergie des sorts
- Réduit régénération d'énergie
- Anti-caster avancé

### Exhaust (Épuisement)
- Réduit régénération HP/énergie
- Cumule avec Poison
- DoT passif + debuff

---

**Version**: 1.0.0  
**Dernière mise à jour**: 10 octobre 2025  
**Effets implémentés**: Weakness, Vulnerability, Armor Break, Slow (4/4 Debuffs Phase 4)  
**Prochaine phase**: Buffs essentiels OU Effets de positionnement

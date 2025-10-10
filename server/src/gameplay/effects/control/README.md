# 🥶 Control Effects (Effets de Contrôle)

Ce répertoire contient tous les effets de contrôle (crowd control) qui empêchent ou limitent les actions des participants.

---

## 📋 Effets disponibles

### ✅ Stun (Étourdissement)

**Fichier**: `stun.ts`  
**ID**: `stun`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 1 tour (base)
- **Max Stacks**: 1

#### Effet
Empêche toute action du participant touché :
- ❌ Pas d'attaque
- ❌ Pas de sorts actifs
- ❌ Pas d'ultimate
- ❌ Pas de mouvement

Le participant **skip complètement son tour**.

#### Résistances
- **Tanks**: 20% de résistance naturelle
- **Boss**: 50% de résistance
- **Immunity/CC Immunity**: Bloque l'application

#### Messages
```
Application: 💫 [Cible] est étourdi et ne peut pas agir !
Tick: 💫 [Cible] est toujours étourdi...
Retrait: ✨ [Cible] reprend ses esprits
```

#### Visuel recommandé Unity
- Icône: ⭐ Étoiles tournantes
- Couleur: Jaune (#FFD700)
- Animation: Étoiles au-dessus de la tête
- Son: Clochette / Ding

---

### ✅ Silence

**Fichier**: `silence.ts`  
**ID**: `silence`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 2 tours (base)
- **Max Stacks**: 1

#### Effet
Empêche le lancement de sorts :
- ✅ Peut faire des attaques basiques
- ❌ Pas de sorts actifs
- ❌ Pas d'ultimate
- ❌ Pas de passifs déclenchés

Le participant est **forcé à l'attaque basique uniquement**.

#### Résistances
- **Supports**: 30% de résistance naturelle (dépendent des sorts)
- **DPS Ranged**: 20% de résistance (utilisent beaucoup de sorts)
- **Boss**: 40% de résistance
- **Immunity/CC Immunity**: Bloque l'application

#### Messages
```
Application: 🤐 [Cible] est réduit au silence et ne peut plus lancer de sorts !
Tick: 🤐 [Cible] est toujours silencé...
Retrait: 🗣️ [Cible] peut à nouveau lancer des sorts
```

#### Visuel recommandé Unity
- Icône: 🤐 Symbole interdit sur bouche
- Couleur: Violet (#8B00FF)
- Animation: Symbole interdit clignotant
- Son: "Shh" étouffé

#### Cas d'usage
- Counter les héros mages/supports
- Empêcher les ultimates critiques
- Forcer l'engagement en mêlée

---

### ✅ Freeze (Gel)

**Fichier**: `freeze.ts`  
**ID**: `freeze`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 2 tours (base)
- **Max Stacks**: 1
- **After-effect**: Applique "Chilled" au retrait

#### Effet principal
Empêche toute action (identique à Stun) :
- ❌ Pas d'attaque
- ❌ Pas de sorts
- ❌ Pas d'ultimate
- ❌ Pas de mouvement

Le participant **skip complètement son tour**.

#### After-effect : Chilled
Après le dégel, applique un effet "Chilled" (Refroidi) :
- Durée: 2 tours
- Effet: -50% vitesse
- Le participant agit plus tard dans l'ordre des tours

#### Résistances
- **Water**: 50% de résistance naturelle (résistant au froid)
- **Fire**: 0% résistance (vulnérable, +30% chance effective d'application)
- **Boss**: 40% de résistance
- **Immunity/CC Immunity**: Bloque l'application

#### Avantage élémentaire
Les sorts/héros Water qui appliquent Freeze ont :
- **+50% chance vs Fire**
- **-50% chance vs Water**

#### Messages
```
Application: ❄️ [Cible] est gelé et ne peut plus bouger !
Tick: ❄️ [Cible] est pris dans la glace...
Retrait: 🌨️ [Cible] dégèle mais reste ralenti par le froid
```

#### Visuel recommandé Unity
- Icône: ❄️ Flocon de neige
- Couleur: Cyan (#00FFFF)
- Animation: Bloc de glace enveloppant le corps
- Particules: Cristaux de glace, brume froide
- Son: Craquement de glace

#### Cas d'usage
- Counter les héros Fire (double efficace)
- Contrôle prolongé (CC + Slow après)
- Ralentir les DPS rapides

---

## 🔄 Interactions entre effets

### Priorité d'application
Si plusieurs CC tentent de s'appliquer simultanément :
1. **Stun** (le plus restrictif)
2. **Freeze** (restrictif + after-effect)
3. **Silence** (le moins restrictif)

### Immunités
Les effets suivants bloquent les CC :
- `immunity` (Immunité totale)
- `cc_immunity` (Immunité CC spécifique)
- `unstoppable` (Si implémenté)

### Non-stackable
Aucun effet de contrôle n'est stackable. Si un CC est déjà actif :
- Nouvelle application → Rafraîchit la durée
- Pas d'augmentation d'intensité

---

## 🎮 Intégration BattleEngine

### Vérification avant action

```typescript
// Dans BattleEngine.processTurn()
if (this.isControlled(participant)) {
  console.log(`⛔ ${participant.name} est contrôlé, skip son tour`);
  continue; // Skip ce participant
}
```

### Méthode isControlled()

```typescript
private isControlled(participant: IBattleParticipant): boolean {
  // Vérifier Stun
  if (participant.status.debuffs.includes("stunned")) return true;
  
  // Vérifier Freeze
  if (participant.status.debuffs.includes("frozen")) return true;
  
  // Vérifier Sleep (futur)
  if (participant.status.debuffs.includes("sleeping")) return true;
  
  return false;
}
```

### Méthode canCastSpells()

```typescript
private canCastSpells(participant: IBattleParticipant): boolean {
  if (participant.status.debuffs.includes("silenced")) {
    console.log(`🤐 ${participant.name} est silencé - pas de sorts possibles`);
    return false;
  }
  
  return true;
}
```

---

## 📊 Statistiques et balance

### Durée moyenne
- **Stun**: 1 tour (très court, très puissant)
- **Silence**: 2 tours (moyen)
- **Freeze**: 2 tours + 2 tours de Slow (long au total)

### Résistances moyennes
| Rôle | Stun | Silence | Freeze |
|------|------|---------|--------|
| Tank | 20% | 0% | 0% |
| DPS Melee | 0% | 0% | 0% |
| DPS Ranged | 0% | 20% | 0% |
| Support | 0% | 30% | 0% |

### Résistances élémentaires
| Élément | Stun | Silence | Freeze |
|---------|------|---------|--------|
| Fire | 0% | 0% | -30% (vulnérable) |
| Water | 0% | 0% | 50% (résistant) |
| Wind | 0% | 0% | 0% |
| Electric | 0% | 0% | 0% |
| Light | 0% | 0% | 0% |
| Dark | 0% | 0% | 0% |

### Résistances boss
Tous les boss ont des résistances accrues :
- **Stun**: 50%
- **Silence**: 40%
- **Freeze**: 40%

---

## 🔜 Effets à venir

### Sleep (Sommeil)
- **Durée**: 2-3 tours
- **Effet**: Comme Stun mais se réveille si frappé
- **Résistance**: 0% base
- **Interaction**: Prendre des dégâts retire Sleep immédiatement

### Root (Racines)
- **Durée**: 2 tours
- **Effet**: Peut attaquer mais pas se déplacer (mêlée uniquement)
- **Résistance**: Wind 30%

### Disarm (Désarmement)
- **Durée**: 2 tours
- **Effet**: Impossible d'attaquer (sorts uniquement)
- **Résistance**: DPS Melee 30%

### Fear (Peur)
- **Durée**: 1-2 tours
- **Effet**: Fuit pendant 1 tour, skip action
- **Résistance**: Tank 40%

---

## 💡 Best Practices

### Lors de l'implémentation d'un nouveau CC

1. ✅ Hériter de `BaseEffect`
2. ✅ Type = `"control"`
3. ✅ Catégorie = `"crowd_control"`
4. ✅ Non-stackable (sauf cas spécial)
5. ✅ Durée courte (1-3 tours max)
6. ✅ Ajouter aux `status.debuffs` dans `onApply()`
7. ✅ Retirer de `status.debuffs` dans `onRemove()`
8. ✅ Implémenter `canApplyTo()` avec résistances
9. ✅ Messages clairs et émojis distinctifs
10. ✅ Tester contre tous les rôles

### Balance design

- **Stun** = Court mais puissant (1 tour)
- **Silence** = Moyen, situationnel (2 tours)
- **Freeze** = Long total avec after-effect (4 tours effectifs)

### Contre-play

Chaque CC doit avoir un contre :
- **Résistances naturelles** (rôles/éléments)
- **Immunité temporaire** (buffs)
- **Durée limitée** (pas de CC permanent)
- **Cleanse** (sorts qui retirent les CC)

---

## 🧪 Tests recommandés

### Test 1 : Application basique
```
1. Héros A lance Stun sur Héros B
2. Vérifier : B.status.debuffs contient "stunned"
3. Tour suivant : B skip son action
4. Durée expire : "stunned" retiré
```

### Test 2 : Résistances
```
1. Héros A lance Stun sur Tank B
2. Vérifier : 20% de chance que B résiste
3. Si résisté : Pas de "stunned" appliqué
```

### Test 3 : Silence ne bloque pas attaque
```
1. Héros A lance Silence sur Héros B
2. Tour de B : Peut faire attaque basique
3. Tour de B : Ne peut PAS lancer de sort
4. Vérifier : createAttackAction() appelé
```

### Test 4 : Freeze + After-effect
```
1. Héros A lance Freeze sur Héros B
2. Vérifier : B.status.debuffs contient "frozen"
3. 2 tours passent
4. Freeze expire
5. Vérifier : "chilled" ajouté automatiquement
6. Vérifier : B agit plus tard (vitesse réduite)
```

### Test 5 : Immunité
```
1. Héros B a buff "immunity"
2. Héros A tente Stun sur B
3. Vérifier : canApplyTo() retourne false
4. Vérifier : Pas de "stunned" appliqué
```

---

## 📚 Références

### Fichiers liés
- `server/src/gameplay/effects/base/BaseEffect.ts` - Classe de base
- `server/src/gameplay/EffectManager.ts` - Gestionnaire central
- `server/src/services/BattleEngine.ts` - Intégration combat
- `server/src/gameplay/SpellManager.ts` - Vérification Silence

### Documentation externe
- [Battle Effects Unity Doc](../../../docs/api/battle-effects.md)
- [BattleEngine Architecture](../../../docs/architecture/battle-system.md)

---

**Version**: 1.0.0  
**Dernière mise à jour**: 10 octobre 2025  
**Effets implémentés**: Stun, Silence, Freeze  
**Prochaine version**: Sleep, Root, Disarm

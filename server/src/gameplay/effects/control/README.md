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

### ✅ Sleep (Sommeil)

**Fichier**: `sleep.ts`  
**ID**: `sleep`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 3 tours (base, si non interrompu)
- **Max Stacks**: 1
- **Spécial**: Se réveille en prenant des dégâts

#### Effet
Empêche toute action (identique à Stun) :
- ❌ Pas d'attaque
- ❌ Pas de sorts
- ❌ Pas d'ultimate
- ❌ Pas de mouvement

Le participant **skip complètement son tour**.

#### Mécanisme de réveil
- **Prend des dégâts** → Se réveille immédiatement
- **Durée expire** → Se réveille normalement
- **AoE dégâts** → Réveille tous les endormis touchés

#### Résistances
- **Boss**: 40% de résistance
- **Immunity/CC Immunity**: Bloque l'application
- Pas de résistance de rôle/élément

#### Messages
```
Application: 😴 [Cible] s'endort profondément...
Tick: 😴 [Cible] dort paisiblement...
Retrait: 👁️ [Cible] se réveille
Réveil forcé: 👁️ [Cible] se réveille en prenant X dégâts !
```

#### Visuel recommandé Unity
- Icône: 😴 Zzz
- Couleur: Bleu pastel (#B0C4DE)
- Animation: Bulles de sommeil (Zzz)
- Son: Ronflement léger

#### Cas d'usage
- Contrôle longue durée (3 tours max)
- Counter par AoE (réveille tout le monde)
- Setup pour burst damage (réveiller + finisher)

#### Stratégie
- **Bon** : Sleep un support/DPS, focus le reste
- **Mauvais** : Sleep puis AoE (réveille tout)
- **Optimal** : Sleep 2-3 cibles, single-target les autres

---

### ✅ Root (Enracinement)

**Fichier**: `root.ts`  
**ID**: `root`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 2 tours (base)
- **Max Stacks**: 1

#### Effet
Immobilise sans bloquer les actions :
- ✅ Peut attaquer normalement
- ✅ Peut lancer des sorts
- ✅ Peut utiliser ultimate
- ❌ Ne peut pas se déplacer

**Note**: Dans un système turn-based, l'impact est limité mais peut affecter le ciblage en mêlée.

#### Résistances
- **Wind**: 30% de résistance naturelle (libres comme le vent)
- **Flying units**: 100% immunité (ne touchent pas le sol)
- **Boss**: 30% de résistance
- **Immunity/CC Immunity**: Bloque l'application

#### Messages
```
Application: 🌿 [Cible] est enraciné et ne peut plus se déplacer !
Tick: 🌿 [Cible] est toujours enraciné...
Retrait: 🍃 [Cible] se libère des racines
```

#### Visuel recommandé Unity
- Icône: 🌿 Racines/Vines
- Couleur: Vert nature (#228B22)
- Animation: Racines grimpant sur les jambes
- Son: Craquement de branches

#### Cas d'usage
- Empêcher repositionnement (si système de mouvement)
- Limiter portée d'attaque mêlée
- Thème Nature/Druide

---

### ✅ Disarm (Désarmement)

**Fichier**: `disarm.ts`  
**ID**: `disarm`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 2 tours (base)
- **Max Stacks**: 1

#### Effet
Empêche les attaques basiques :
- ❌ Pas d'attaque basique
- ✅ Peut lancer des sorts actifs
- ✅ Peut utiliser ultimate
- ✅ Peut utiliser passifs

**Inverse de Silence** : Bloque attaques, permet sorts.

#### Résistances
- **DPS Melee**: 30% de résistance naturelle (leur arme est leur vie)
- **Tanks**: 20% de résistance (maîtrisent leur arme)
- **Boss**: 35% de résistance
- **Immunity/CC Immunity**: Bloque l'application

#### Messages
```
Application: ⚔️ [Cible] est désarmé et ne peut plus attaquer !
Tick: ⚔️ [Cible] est toujours désarmé...
Retrait: ⚔️ [Cible] récupère son arme
```

#### Visuel recommandé Unity
- Icône: ⚔️ Arme brisée/tombée
- Couleur: Gris métallique (#C0C0C0)
- Animation: Arme qui tombe, mains vides
- Son: Chute métallique

#### Cas d'usage
- Counter les héros auto-attaquants
- Forcer utilisation des sorts (épuiser mana/énergie)
- Complémentaire à Silence (blocage total si combiné)

#### Stratégie
- **Vs DPS Melee**: Très efficace (bloque leur source principale de dégâts)
- **Vs Mages**: Peu efficace (ils utilisent déjà les sorts)
- **Combo Disarm + Silence**: Blocage quasi-total (garde ultimate)

---

### ✅ Fear (Peur/Terreur)

**Fichier**: `fear.ts`  
**ID**: `fear`  
**Type**: Control  
**Catégorie**: Crowd Control

#### Caractéristiques
- **Stackable**: Non
- **Durée**: 1 tour (base)
- **Max Stacks**: 1

#### Effet
Empêche toute action par la terreur :
- ❌ Pas d'attaque
- ❌ Pas de sorts
- ❌ Pas d'ultimate
- ❌ "Fuit" mentalement

Le participant **skip complètement son tour**.

#### Résistances
- **Tanks**: 40% de résistance naturelle (courageux)
- **Light**: 25% de résistance (lumière vs ténèbres)
- **Dark**: Plus vulnérable (+20% chance d'application)
- **Boss**: 60% de résistance (intimidants)
- **Immunity/CC Immunity**: Bloque l'application
- **Fearless/Bravery**: Immunité spécifique

#### Messages
```
Application: 😱 [Cible] est terrifié et tente de fuir !
Tick: 😱 [Cible] est toujours pris de panique...
Retrait: 💪 [Cible] surmonte sa peur
```

#### Visuel recommandé Unity
- Icône: 😱 Visage terrifié
- Couleur: Violet sombre (#4B0082)
- Animation: Tremblements, aura de terreur
- Son: Cri de peur, musique inquiétante

#### Cas d'usage
- Contrôle court mais puissant (1 tour)
- Thème Dark/Shadow
- Boss résistent fortement (60%)

#### Avantage élémentaire
- **Dark vs Light**: +20% efficacité
- **Light résiste**: 25% chance de bloquer

---

## 🔄 Interactions entre effets

### Priorité d'application
Si plusieurs CC tentent de s'appliquer simultanément :
1. **Stun** (le plus restrictif)
2. **Freeze** (restrictif + after-effect)
3. **Fear** (restrictif, court)
4. **Sleep** (restrictif, réveil possible)
5. **Silence** (bloque sorts)
6. **Disarm** (bloque attaques)
7. **Root** (le moins restrictif)

### Immunités
Les effets suivants bloquent les CC :
- `immunity` (Immunité totale)
- `cc_immunity` (Immunité CC spécifique)
- `fearless` / `bravery` (Immunité Fear uniquement)
- `unstoppable` (Si implémenté)

### Non-stackable
Aucun effet de contrôle n'est stackable. Si un CC est déjà actif :
- Nouvelle application → Rafraîchit la durée
- Pas d'augmentation d'intensité

### Mécanismes spéciaux

#### Sleep Wake-Up
```typescript
// Dans BattleEngine.executeAction()
private checkSleepWakeUp(target: IBattleParticipant, damageTaken: number): void {
  if (damageTaken > 0 && target.status.debuffs.includes("sleeping")) {
    EffectManager.removeEffect(target, "sleep");
    console.log(`👁️ ${target.name} se réveille en prenant ${damageTaken} dégâts !`);
  }
}
```

#### Freeze After-Effect
```typescript
// Dans freeze.ts onRemove()
onRemove(target: IBattleParticipant): EffectResult {
  // Applique automatiquement "chilled" (slow)
  return {
    message: `🌨️ ${target.name} dégèle mais reste ralenti par le froid`,
    additionalEffects: ["chilled"]
  };
}
```

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
  // Stun
  if (participant.status.debuffs.includes("stunned")) return true;
  
  // Freeze
  if (participant.status.debuffs.includes("frozen")) return true;
  
  // Sleep
  if (participant.status.debuffs.includes("sleeping")) return true;
  
  // Fear
  if (participant.status.debuffs.includes("feared")) return true;
  
  return false;
}
```

### Méthode canCastSpells()

```typescript
private canCastSpells(participant: IBattleParticipant): boolean {
  // Silence bloque les sorts
  if (participant.status.debuffs.includes("silenced")) {
    console.log(`🤐 ${participant.name} est silencé - pas de sorts possibles`);
    return false;
  }
  
  return true;
}
```

### Méthode canAttack() (à implémenter si Disarm utilisé)

```typescript
private canAttack(participant: IBattleParticipant): boolean {
  // Disarm bloque les attaques
  if (participant.status.debuffs.includes("disarmed")) {
    console.log(`⚔️ ${participant.name} est désarmé - pas d'attaque possible`);
    return false;
  }
  
  return true;
}
```

---

## 📊 Statistiques et balance

### Durée moyenne
- **Stun**: 1 tour (très court, très puissant)
- **Fear**: 1 tour (très court, très puissant)
- **Silence**: 2 tours (moyen)
- **Freeze**: 2 tours + 2 tours de Slow (long au total)
- **Disarm**: 2 tours (moyen)
- **Root**: 2 tours (moyen, peu d'impact turn-based)
- **Sleep**: 3 tours max (long, interruptible)

### Résistances moyennes par rôle
| Rôle | Stun | Silence | Freeze | Sleep | Root | Disarm | Fear |
|------|------|---------|--------|-------|------|--------|------|
| Tank | 20% | 0% | 0% | 0% | 0% | 20% | 40% |
| DPS Melee | 0% | 0% | 0% | 0% | 0% | 30% | 0% |
| DPS Ranged | 0% | 20% | 0% | 0% | 0% | 0% | 0% |
| Support | 0% | 30% | 0% | 0% | 0% | 0% | 0% |

### Résistances élémentaires
| Élément | Stun | Silence | Freeze | Sleep | Root | Disarm | Fear |
|---------|------|---------|--------|-------|------|--------|------|
| Fire | 0% | 0% | -30% | 0% | 0% | 0% | 0% |
| Water | 0% | 0% | 50% | 0% | 0% | 0% | 0% |
| Wind | 0% | 0% | 0% | 0% | 30% | 0% | 0% |
| Light | 0% | 0% | 0% | 0% | 0% | 0% | 25% |
| Dark | 0% | 0% | 0% | 0% | 0% | 0% | -20% |

### Résistances boss
| Effet | Résistance Boss |
|-------|----------------|
| Stun | 50% |
| Silence | 40% |
| Freeze | 40% |
| Sleep | 40% |
| Root | 30% |
| Disarm | 35% |
| Fear | 60% |

---

## 💡 Best Practices

### Lors de l'implémentation d'un nouveau CC

1. ✅ Hériter de `BaseEffect`
2. ✅ Type = `"control"`
3. ✅ Catégorie = `"crowd_control"`
4. ✅ Non-stackable (règle générale)
5. ✅ Durée courte (1-3 tours max)
6. ✅ Ajouter aux `status.debuffs` dans `onApply()`
7. ✅ Retirer de `status.debuffs` dans `onRemove()`
8. ✅ Implémenter `canApplyTo()` avec résistances
9. ✅ Messages clairs et émojis distinctifs
10. ✅ Tester contre tous les rôles et éléments

### Balance design

- **Hard CC** (Stun, Freeze, Fear, Sleep) = 1-2 tours max
- **Soft CC** (Silence, Disarm) = 2 tours acceptable
- **Minimal CC** (Root) = 2-3 tours (peu d'impact)

### Contre-play

Chaque CC doit avoir un contre :
- **Résistances naturelles** (rôles/éléments)
- **Immunité temporaire** (buffs)
- **Durée limitée** (pas de CC permanent)
- **Cleanse** (sorts qui retirent les CC)
- **Mécanisme de break** (Sleep wake-up)

### Combos recommandés

- **Sleep + Single-target burst** : Max DPS sur 1 cible
- **Silence + Disarm** : Blocage quasi-total
- **Freeze → Chilled** : Contrôle prolongé
- **Fear + AoE** : Panic team-wide

### Combos déconseillés

- **Sleep + AoE** : Réveille tout le monde ❌
- **Stun + Sleep** : Redondant ❌
- **Root sur héros ranged** : Peu d'impact ❌

---

## 🧪 Tests recommandés

### Test 1 : Application basique
```
1. Héros A lance CC sur Héros B
2. Vérifier : B.status.debuffs contient le debuff
3. Tour suivant : Vérifier comportement attendu
4. Durée expire : Debuff retiré
```

### Test 2 : Résistances
```
1. Lancer CC sur cible avec résistance
2. Vérifier taux de résistance (20+ essais)
3. Si résisté : Pas de debuff appliqué
```

### Test 3 : Sleep wake-up
```
1. Appliquer Sleep sur cible
2. Infliger dégâts à la cible
3. Vérifier : Sleep retiré immédiatement
4. Vérifier message de réveil
```

### Test 4 : Silence vs sorts
```
1. Appliquer Silence
2. Tour de la cible : Tenter sort actif
3. Vérifier : Sort bloqué, attaque basique forcée
4. Vérifier : Attaque basique fonctionne
```

### Test 5 : Disarm vs attaques
```
1. Appliquer Disarm
2. Tour de la cible : Tenter attaque
3. Vérifier : Attaque bloquée
4. Vérifier : Sorts fonctionnent normalement
```

### Test 6 : Freeze after-effect
```
1. Appliquer Freeze (2 tours)
2. Attendre expiration
3. Vérifier : "chilled" ajouté automatiquement
4. Vérifier : Vitesse réduite pendant 2 tours
```

### Test 7 : Immunité
```
1. Cible a buff "immunity" ou "cc_immunity"
2. Tenter tous les CC
3. Vérifier : canApplyTo() retourne false
4. Vérifier : Aucun debuff appliqué
```

---

## 📚 Références

### Fichiers liés
- `server/src/gameplay/effects/base/BaseEffect.ts` - Classe de base
- `server/src/gameplay/EffectManager.ts` - Gestionnaire central
- `server/src/services/BattleEngine.ts` - Intégration combat
- `server/src/gameplay/SpellManager.ts` - Vérification Silence/Disarm

### Documentation externe
- [Battle Effects Unity Doc](../../../docs/api/battle-effects.md)
- [BattleEngine Architecture](../../../docs/architecture/battle-system.md)

---

**Version**: 1.1.0  
**Dernière mise à jour**: 10 octobre 2025  
**Effets implémentés**: Stun, Silence, Freeze, Sleep, Root, Disarm, Fear (7/7 Control Effects)  
**Prochaine phase**: DoT additionnels (Poison, Bleed, Corrosion)

# 🔥 DoT Effects (Damage Over Time)

Ce répertoire contient tous les effets de dégâts sur la durée qui infligent des dégâts chaque tour.

---

## 📋 Effets disponibles

### ✅ Burn (Brûlure)

**Fichier**: `burn.ts`  
**ID**: `burn`  
**Type**: DoT  
**Catégorie**: Damage Over Time

#### Caractéristiques
- **Stackable**: Oui (max 5)
- **Durée**: 3 tours (base)
- **Élément**: Fire

#### Effet
Inflige des dégâts de feu chaque tour :
- **Dégâts base**: 4% HP max + INT caster
- **Multiplicateur stacks**: 1x, 1.5x, 2x, 2.5x, 3x
- **Résistance Fire**: -50% dégâts
- **Vulnérabilité Water**: +30% dégâts

#### Résistances
- **Fire**: 50% réduction + 30% chance de résister complètement
- **Water**: Prend 30% de dégâts en plus
- **Immunity**: Bloque l'application

#### Formule de dégâts
```
Base = MaxHP × 0.04 + INT × 0.1
Multiplicateur = 1 + (stacks - 1) × 0.5
Dégâts = Base × Multiplicateur × Résistance
```

#### Messages
```
Application: 🔥 [Cible] prend feu !
Tick: 🔥 [Cible] subit X dégâts de brûlure (N stacks)
Retrait: 💨 La brûlure de [Cible] s'éteint
```

#### Visuel recommandé Unity
- Icône: 🔥 Flammes
- Couleur: Orange (#FF4500)
- Animation: Flammes sur le corps
- Particules: Feu persistant
- Son: Crépitement de feu

#### Cas d'usage
- Dégâts constants sur plusieurs tours
- Synergie avec autres sorts Fire
- Contre les héros Water (vulnérables)
- Stack pour maximiser les dégâts

---

### ✅ Poison (Empoisonnement)

**Fichier**: `poison.ts`  
**ID**: `poison`  
**Type**: DoT  
**Catégorie**: Damage Over Time

#### Caractéristiques
- **Stackable**: Oui (max 5)
- **Durée**: 4 tours (base)
- **Élément**: Nature (Wind)
- **Effet secondaire**: Réduit soins reçus

#### Effet principal
Inflige des dégâts chaque tour :
- **Dégâts base**: 3% HP max + INT caster
- **Multiplicateur stacks**: 1x, 1.4x, 1.8x, 2.2x, 2.6x
- **Résistance Wind**: -40% dégâts

#### Effet secondaire : Réduction de soins
- **-10% soins reçus par stack**
- **Max -50% à 5 stacks**
- Affecte tous les soins (sorts, potions, régénération)

#### Résistances
- **Wind**: 40% réduction + 25% chance de résister complètement
- **Immunity**: Bloque l'application
- **Poison Immunity / Antidote**: Immunité spécifique

#### Formule de dégâts
```
Base = MaxHP × 0.03 + INT × 0.1
Multiplicateur = 1 + (stacks - 1) × 0.4
Dégâts = Base × Multiplicateur × Résistance
Healing Reduction = stacks × 10%
```

#### Messages
```
Application: ☠️ [Cible] est empoisonné !
Tick: ☠️ [Cible] subit X dégâts de poison (N stacks, -Y% soins)
Retrait: 💚 [Cible] n'est plus empoisonné
```

#### Visuel recommandé Unity
- Icône: ☠️ Crâne avec vapeur verte
- Couleur: Vert poison (#00FF00)
- Animation: Bulles vertes montantes
- Particules: Vapeur toxique
- Son: Glouglou / Sifflement toxique

#### Cas d'usage
- Anti-heal (contre héros Support/Tank)
- DoT de longue durée (4 tours)
- Stack pour bloquer complètement les soins
- Synergie avec burst damage

#### Stratégie
- **Optimal**: Appliquer max stacks sur Tank ennemi
- **Combo**: Poison + Burst = Empêche la récupération
- **Counter**: Cleanse / Antidote / Immunity

---

### ✅ Bleed (Saignement)

**Fichier**: `bleed.ts`  
**ID**: `bleed`  
**Type**: DoT  
**Catégorie**: Damage Over Time

#### Caractéristiques
- **Stackable**: Oui (max 3)
- **Durée**: 3 tours (base)
- **Élément**: Physical (aucun)
- **Effet spécial**: Dégâts bonus si la cible attaque

#### Effet principal
Inflige des dégâts physiques chaque tour :
- **Dégâts base**: 5% HP max + 30% ATK caster
- **Multiplicateur stacks**: 1x, 1.5x, 2x
- **Pas de résistance élémentaire**

#### Effet spécial : Aggravation par mouvement
- **Si la cible attaque** → +2% HP max par stack en dégâts bonus
- **Dégâts immédiats** (appliqués après l'attaque)
- **Exemple**: 3 stacks = +6% HP max si attaque

#### Résistances
- **Immunity**: Bloque l'application
- **Bleed Immunity / Blood Seal**: Immunité spécifique
- **Bloodless**: Créatures sans sang (élémentaires, golems) immunisées

#### Formule de dégâts
```
Base HP = MaxHP × 0.05
Base ATK = ATK_caster × 0.3
Base Total = Base HP + Base ATK
Multiplicateur = 1 + (stacks - 1) × 0.5
Dégâts Tick = Base Total × Multiplicateur

Movement Damage = MaxHP × 0.02 × stacks (si attaque)
```

#### Messages
```
Application: 🩸 [Cible] saigne !
Tick: 🩸 [Cible] subit X dégâts de saignement (N stacks)
Movement: 🩸 [Cible] aggrave son saignement en attaquant ! (+X dégâts)
Retrait: 🩹 Le saignement de [Cible] s'arrête
```

#### Visuel recommandé Unity
- Icône: 🩸 Goutte de sang
- Couleur: Rouge sang (#8B0000)
- Animation: Gouttes de sang tombantes
- Particules: Éclaboussures de sang
- Son: Gouttes qui tombent

#### Cas d'usage
- Punir les attaquants agressifs
- Dégâts physiques purs (ignore résistance élémentaire)
- Forcer un choix : Attaquer ou attendre
- Synergie avec Taunt (force à attaquer)

#### Stratégie
- **Optimal**: Appliquer sur DPS Melee agressif
- **Combo**: Bleed + Taunt = Force l'aggravation
- **Counter**: Ne pas attaquer ou Cleanse rapide
- **Timing**: Excellent en début de combat (longue durée)

---

### ✅ Corrosion (Corrosion/Acide)

**Fichier**: `corrosion.ts`  
**ID**: `corrosion`  
**Type**: DoT  
**Catégorie**: Damage Over Time

#### Caractéristiques
- **Stackable**: Oui (max 5)
- **Durée**: 4 tours (base)
- **Élément**: Acid (aucun élément officiel)
- **Effet secondaire**: Réduit défense

#### Effet principal
Inflige des dégâts chaque tour :
- **Dégâts base**: 3.5% HP max + INT caster
- **Multiplicateur stacks**: 1x, 1.3x, 1.6x, 1.9x, 2.2x
- **Bonus vs Tank**: +20% dégâts

#### Effet secondaire : Réduction de défense
- **-5% DEF par stack**
- **Max -25% à 5 stacks**
- Affecte la défense physique et magique
- Rend la cible plus vulnérable à TOUS les dégâts

#### Résistances
- **Immunity**: Bloque l'application
- **Acid Immunity / Corrosion Proof**: Immunité spécifique
- **Ethereal**: Créatures éthérées immunisées (pas de corps physique)

#### Formule de dégâts
```
Base = MaxHP × 0.035 + INT × 0.1
Multiplicateur = 1 + (stacks - 1) × 0.3
Tank Bonus = 1.2 (si Tank)
Dégâts = Base × Multiplicateur × Tank Bonus
Defense Reduction = stacks × 5%
```

#### Messages
```
Application: 🧪 [Cible] est rongé par la corrosion !
Tick: 🧪 [Cible] subit X dégâts de corrosion (N stacks, -Y% DEF)
Retrait: ✨ La corrosion de [Cible] disparaît
```

#### Visuel recommandé Unity
- Icône: 🧪 Fiole d'acide
- Couleur: Vert acide (#ADFF2F)
- Animation: Liquide corrosif coulant
- Particules: Vapeur acide, bulles
- Son: Sifflement / Dissolution

#### Cas d'usage
- Briser les défenses des Tanks
- Setup pour burst damage d'équipe
- Dégâts constants moyens
- Synergie avec attaques physiques

#### Stratégie
- **Optimal**: Appliquer max stacks sur Tank ennemi
- **Combo**: Corrosion → Focus fire = Mort rapide
- **Team synergy**: Toute l'équipe profite de la réduction DEF
- **Timing**: Appliquer avant les gros cooldowns d'équipe

---

## 🔄 Comparaison des DoT

### Tableau récapitulatif

| Effet | Dégâts base | Max stacks | Durée | Effet secondaire | Résistance |
|-------|-------------|------------|-------|------------------|-----------|
| **Burn** | 4% HP | 5 | 3 tours | Aucun | Fire 50%, Water -30% |
| **Poison** | 3% HP | 5 | 4 tours | -10% soins/stack | Wind 40% |
| **Bleed** | 5% HP + ATK | 3 | 3 tours | +2% HP si attaque | Bloodless immune |
| **Corrosion** | 3.5% HP | 5 | 4 tours | -5% DEF/stack | Ethereal immune |

### Dégâts totaux (sans résistance, 5 stacks max)

```
Burn (5 stacks, 3 tours):
- Par tour: 12% HP
- Total: 36% HP

Poison (5 stacks, 4 tours):
- Par tour: 7.8% HP
- Total: 31.2% HP
- Bonus: -50% soins

Bleed (3 stacks, 3 tours):
- Par tour: 10% HP + ATK
- Total: 30% HP + ATK
- Bonus: +6% HP si attaque × 3 = +18% HP

Corrosion (5 stacks, 4 tours):
- Par tour: 7.7% HP
- Total: 30.8% HP
- Bonus: -25% DEF
```

### Quand utiliser chaque DoT ?

#### Burn 🔥
- **Pour**: Burst damage rapide (3 tours)
- **Contre**: Fire heroes
- **Best vs**: Water heroes
- **Synergie**: Autres sorts Fire

#### Poison ☠️
- **Pour**: Anti-heal + DoT longue durée
- **Contre**: Wind heroes, Supports qui heal
- **Best vs**: Tanks, Regen teams
- **Synergie**: Burst damage coordonné

#### Bleed 🩸
- **Pour**: Punir les attaquants
- **Contre**: DPS agressifs
- **Best vs**: DPS Melee, Berserkers
- **Synergie**: Taunt, Provocation

#### Corrosion 🧪
- **Pour**: Setup pour focus fire
- **Contre**: Tanks armurés
- **Best vs**: Tanks, High DEF heroes
- **Synergie**: Toute l'équipe (réduction DEF)

---

## 🎮 Intégration BattleEngine

### Traitement des DoT

Les DoT sont automatiquement traités chaque tour via `EffectManager.processEffects()` :

```typescript
// Dans BattleEngine.processTurn()
for (const participant of aliveParticipants) {
  this.generateEnergy(participant);
  
  // ✅ Traiter tous les effets (DoT inclus)
  this.processParticipantEffects(participant);
  
  if (!participant.status.alive) continue; // Peut mourir du DoT
  
  // Suite du tour...
}
```

### Effets secondaires à implémenter

#### 1. Poison : Réduction de soins

```typescript
// Dans BattleEngine.executeAction() - Section healing
if (action.healing && action.healing > 0) {
  for (const targetId of action.targetIds) {
    const target = this.findParticipant(targetId);
    if (target && target.status.alive) {
      let finalHealing = action.healing;
      
      // ✅ NOUVEAU : Appliquer réduction Poison
      const poisonReduction = PoisonEffect.getHealingReduction(target);
      if (poisonReduction > 0) {
        finalHealing = Math.floor(finalHealing * (1 - poisonReduction / 100));
        console.log(`☠️ Poison réduit les soins de ${poisonReduction}%`);
      }
      
      target.currentHp = Math.min(target.stats.maxHp, target.currentHp + finalHealing);
    }
  }
}
```

#### 2. Bleed : Dégâts si attaque

```typescript
// Dans BattleEngine.executeAction() - Après qu'un participant attaque
private executeAction(action: IBattleAction): void {
  const actor = this.findParticipant(action.actorId);
  
  // Après l'exécution de l'action
  if (action.actionType === "attack" && actor) {
    // ✅ NOUVEAU : Vérifier Bleed
    if (BleedEffect.isBleeding(actor)) {
      const bleedDamage = BleedEffect.applyBleedMovementDamage(actor);
      if (bleedDamage > 0) {
        actor.currentHp = Math.max(0, actor.currentHp - bleedDamage);
        
        if (actor.currentHp === 0) {
          actor.status.alive = false;
          console.log(`💀 ${actor.name} meurt de son saignement !`);
        }
      }
    }
  }
  
  // ... reste du code
}
```

#### 3. Corrosion : Réduction de défense

```typescript
// Dans BattleEngine.calculateDamage()
private calculateDamage(
  attacker: IBattleParticipant,
  defender: IBattleParticipant,
  attackType: "attack" | "skill" | "ultimate"
): number {
  // ... calcul de base ...
  
  let defense = defenderStats.def;
  
  // ✅ NOUVEAU : Appliquer réduction Corrosion
  defense = CorrosionEffect.applyDefenseReduction(defender, defense);
  
  if (attackType === "skill" || attackType === "ultimate") {
    defense = Math.floor((defenderStats.defMagique || defense) * 0.7 + defense * 0.3);
  }
  
  let damage = Math.max(1, baseAttack - Math.floor(defense / 2));
  
  // ... reste du calcul
}
```

---

## 📊 Balance et Design

### Philosophie de design

Chaque DoT a un **rôle distinct** :

1. **Burn** : Dégâts purs élevés sur courte durée
2. **Poison** : Anti-heal + dégâts modérés longue durée
3. **Bleed** : Punition conditionnelle (si attaque)
4. **Corrosion** : Setup pour toute l'équipe (réduction DEF)

### Stacking strategy

```
Optimal stacking:
- Burn: 3-4 stacks (au-delà, trop cher)
- Poison: 5 stacks (maximiser anti-heal)
- Bleed: 2-3 stacks (maximum disponible)
- Corrosion: 4-5 stacks (maximiser réduction DEF)
```

### Synergie entre DoT

#### Combos recommandés

**Anti-Tank Combo**:
```
Corrosion (5 stacks) → Poison (5 stacks) → Focus fire
= -25% DEF + -50% soins + dégâts constants
```

**Anti-Heal Combo**:
```
Poison (5 stacks) + Burn (4 stacks) = DoT massifs + pas de récupération
```

**Punisher Combo**:
```
Bleed (3 stacks) + Taunt = Force à attaquer + aggrave saignement
```

**Full DoT Stack**:
```
Burn + Poison + Bleed + Corrosion = ~20% HP par tour
```

---

## 💡 Best Practices

### Design d'un nouveau DoT

1. ✅ Hériter de `BaseEffect`
2. ✅ Type = `"dot"`
3. ✅ Catégorie = `"damage_over_time"`
4. ✅ Stackable (en général)
5. ✅ Durée 3-4 tours
6. ✅ Dégâts base = 3-5% HP max
7. ✅ Multiplicateur stacks progressif
8. ✅ Effet secondaire unique
9. ✅ Résistances thématiques
10. ✅ Messages et visuels distincts

### Calcul des dégâts

**Formule générale** :
```typescript
onTick(target, stacks, appliedBy): EffectResult {
  // 1. Dégâts de base
  const baseDamage = this.getBaseDamageFromStats(target, appliedBy, 0.03);
  
  // 2. Multiplicateur stacks
  const stackMultiplier = 1 + (stacks - 1) × 0.X;
  
  // 3. Calcul total
  let totalDamage = Math.floor(baseDamage × stackMultiplier);
  
  // 4. Résistances élémentaires
  totalDamage = this.applyResistances(totalDamage, target);
  
  // 5. Minimum
  return { damage: Math.max(1, totalDamage) };
}
```

### Balance guidelines

- **Dégâts par tour** : 3-5% HP max
- **Durée max** : 3-5 tours
- **Max stacks** : 3-5 selon puissance
- **Effet secondaire** : Pas > 50% d'impact
- **Résistances** : 25-50% selon thème

---

## 🧪 Tests recommandés

### Test 1 : Application et stacking
```
1. Appliquer DoT (1 stack)
2. Vérifier dégâts initiaux
3. Appliquer DoT (2 stacks)
4. Vérifier dégâts augmentent correctement
5. Répéter jusqu'à max stacks
```

### Test 2 : Durée et expiration
```
1. Appliquer DoT (durée 3)
2. Vérifier dégâts tour 1
3. Vérifier dégâts tour 2
4. Vérifier dégâts tour 3
5. Vérifier DoT expire tour 4
```

### Test 3 : Résistances élémentaires
```
1. Appliquer Burn sur Fire hero
2. Vérifier dégâts réduits de 50%
3. Appliquer Burn sur Water hero
4. Vérifier dégâts augmentés de 30%
```

### Test 4 : Effets secondaires

**Poison healing reduction**:
```
1. Appliquer Poison (3 stacks) = -30% soins
2. Appliquer heal de 100 HP
3. Vérifier cible reçoit seulement 70 HP
```

**Bleed movement damage**:
```
1. Appliquer Bleed (2 stacks)
2. Cible attaque
3. Vérifier dégâts bonus appliqués (+4% HP)
```

**Corrosion defense reduction**:
```
1. Appliquer Corrosion (4 stacks) = -20% DEF
2. Infliger dégâts à la cible
3. Vérifier dégâts augmentés (DEF réduite)
```

### Test 5 : Immunités
```
1. Cible a buff "immunity"
2. Tenter d'appliquer tous les DoT
3. Vérifier canApplyTo() retourne false
4. Vérifier aucun DoT appliqué
```

---

## 📚 Références

### Fichiers liés
- `server/src/gameplay/effects/base/BaseEffect.ts` - Classe de base
- `server/src/gameplay/EffectManager.ts` - Gestionnaire central
- `server/src/services/BattleEngine.ts` - Intégration combat

### Méthodes utilitaires

#### Poison
```typescript
PoisonEffect.getHealingReduction(target: IBattleParticipant): number
```

#### Bleed
```typescript
BleedEffect.isBleeding(target: IBattleParticipant): boolean
BleedEffect.getBleedStacks(target: IBattleParticipant): number
BleedEffect.applyBleedMovementDamage(target: IBattleParticipant): number
```

#### Corrosion
```typescript
CorrosionEffect.getDefenseReduction(target: IBattleParticipant): number
CorrosionEffect.applyDefenseReduction(target: IBattleParticipant, baseDef: number): number
```

---

## 🔜 DoT à venir (idées)

### Frostbite (Gelure)
- DoT Water/Ice
- Réduit vitesse progressivement
- Peut geler à max stacks

### Curse (Malédiction)
- DoT Dark
- Réduit toutes les stats
- Peut se transmettre

### Radiation (Radiation)
- DoT "tech"
- Réduit régénération d'énergie
- Affecte les alliés proches

---

**Version**: 1.0.0  
**Dernière mise à jour**: 10 octobre 2025  
**Effets implémentés**: Burn, Poison, Bleed, Corrosion (4/4 DoT Phase 3)  
**Prochaine phase**: Debuffs de combat (Weakness, Vulnerability, Armor Break, Slow)

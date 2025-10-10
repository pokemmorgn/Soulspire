# ✨ Buff Effects (Améliorations)

Ce répertoire contient tous les effets d'amélioration (buffs) qui renforcent les capacités des participants.

---

## 📋 Effets disponibles

### ✅ Shield (Bouclier)

**Fichier**: `shield.ts`  
**ID**: `shield`  
**Type**: Buff  
**Catégorie**: Special Mechanic

#### Caractéristiques
- **Stackable**: Non (le plus grand remplace)
- **Durée**: 3 tours (base, configurable)
- **Mécanique**: Absorbe dégâts avant HP

#### Effet
Crée une barrière protectrice qui absorbe les dégâts :
- **HP du bouclier** : Stocké dans `metadata.shieldHp`
- **Absorption** : Dégâts réduits des HP du bouclier d'abord
- **Brisure** : Si dégâts > bouclier HP, le reste passe aux HP
- **Auto-destruction** : Se retire automatiquement si HP = 0

#### Application
```typescript
// Via un sort
const shieldHp = Math.floor(target.stats.maxHp * 0.15);
const result = EffectManager.applyEffect("shield", target, caster, duration);

// Définir les HP du bouclier après application
const activeEffect = target.activeEffects.find(e => e.id === "shield");
if (activeEffect) {
  activeEffect.metadata = { shieldHp };
}
```

#### Comparaison avec boucliers existants
Si un bouclier existe déjà :
- **Nouveau > Ancien** → Remplace
- **Nouveau < Ancien** → Conserve l'ancien
- **Messages de log** pour debugging

#### Intégration BattleEngine
```typescript
// Dans calculateDamage() - AVANT d'appliquer aux HP
if (ShieldEffect.hasShield(defender)) {
  const result = ShieldEffect.absorbDamage(defender, damage);
  damage = result.damageTaken;
  
  // Log pour UI
  if (result.damageBlocked > 0) {
    console.log(`🛡️ Bouclier absorbe ${result.damageBlocked} dégâts`);
  }
}

// Ensuite appliquer damage aux HP
defender.currentHp -= damage;
```

#### Messages
```
Application: 🛡️ [Cible] reçoit un bouclier protecteur !
Tick: 🛡️ [Cible] est protégé par un bouclier (X HP restants)
Absorption partielle: 🛡️ Le bouclier absorbe X dégâts (Y HP restants)
Brisure: 🛡️💔 Le bouclier absorbe X dégâts puis se brise ! Y dégâts passent.
Retrait: 💔 Le bouclier de [Cible] se brise
```

#### Visuel recommandé Unity
- Icône: 🛡️ Bouclier
- Couleur: Bleu clair (#87CEEB)
- Animation: Barrière scintillante autour du corps
- Particules: Éclat lors de l'absorption de dégâts
- Son: "Ding" métallique lors de l'absorption

#### Héros utilisant Shield
- **Brakka** (Common Tank) - Garde Incandescente
- **Korran** (Rare Tank) - Rempart de Cendres
- **Albert** (Rare Support) - Tourelle de Protection
- **Grathul** (Epic Tank) - Jugement des Flammes
- **Pyra** (Legendary Support) - Renaissance de la Flamme

#### Cas d'usage
- Protection temporaire avant burst damage
- Survival tool pour tanks
- Support défensif pour alliés fragiles
- Mitigation de dégâts spike

#### Stratégie
- **Optimal** : Appliquer avant dégâts prévisibles (ultimate ennemi)
- **Timing** : Proactif > Réactif (anticiper les dégâts)
- **Cible** : Alliés fragiles ou tanks en danger
- **Stack** : Non stackable, attendre expiration avant réappliquer

---

## 🔄 Méthodes Utilitaires

### ShieldEffect (classe statique)

```typescript
// Vérifier présence
ShieldEffect.hasShield(target: IBattleParticipant): boolean

// Obtenir HP restants
ShieldEffect.getShieldHp(target: IBattleParticipant): number

// Modifier HP
ShieldEffect.setShieldHp(target: IBattleParticipant, newHp: number): void

// Absorber dégâts (à utiliser dans BattleEngine)
ShieldEffect.absorbDamage(target: IBattleParticipant, damage: number): {
  damageTaken: number;
  damageBlocked: number;
}

// Logique de remplacement
ShieldEffect.applyOrReplaceShield(
  target: IBattleParticipant,
  newShieldHp: number,
  duration: number,
  appliedBy: IBattleParticipant
): boolean

// Pourcentage restant (pour UI)
ShieldEffect.getShieldPercentage(
  target: IBattleParticipant, 
  maxShieldHp: number
): number
```

---

## 🎮 Intégration Complète

### 1. Dans un Sort (Application)

```typescript
// Exemple : Sort qui donne un bouclier
execute(caster, targets, spellLevel): IBattleAction {
  const target = targets[0];
  
  // Calculer HP du bouclier
  const shieldHp = Math.floor(target.stats.maxHp * 0.15);
  
  // Vérifier si doit remplacer
  const shouldApply = ShieldEffect.applyOrReplaceShield(
    target, 
    shieldHp, 
    duration, 
    caster
  );
  
  if (shouldApply) {
    // Appliquer l'effet
    const result = EffectManager.applyEffect("shield", target, caster, duration);
    
    // Définir les HP du bouclier
    const activeEffect = (target as any).activeEffects?.find(
      (e: any) => e.id === "shield"
    );
    if (activeEffect) {
      activeEffect.metadata = { shieldHp };
    }
    
    action.buffsApplied = ["shield"];
  }
  
  return action;
}
```

### 2. Dans BattleEngine (Calcul Dégâts)

```typescript
// Dans BattleEngine.calculateDamage()
private calculateDamage(
  attacker: IBattleParticipant,
  defender: IBattleParticipant,
  attackType: string
): number {
  // ... calcul des dégâts de base ...
  
  let finalDamage = baseDamage;
  
  // ✅ NOUVEAU : Vérifier bouclier AVANT d'appliquer aux HP
  if (ShieldEffect.hasShield(defender)) {
    const result = ShieldEffect.absorbDamage(defender, finalDamage);
    
    finalDamage = result.damageTaken;
    
    // Stocker pour UI/logs
    if (result.damageBlocked > 0) {
      // Ajouter info à l'action
      (this.currentAction as any).shieldBlocked = result.damageBlocked;
    }
  }
  
  return finalDamage;
}
```

### 3. Dans executeAction (Application des dégâts)

```typescript
// Dans BattleEngine.executeAction()
private executeAction(action: IBattleAction): void {
  // ... après calcul des dégâts ...
  
  if (action.damage && action.damage > 0) {
    for (const targetId of action.targetIds) {
      const target = this.findParticipant(targetId);
      if (!target || !target.status.alive) continue;
      
      let finalDamage = action.damage;
      
      // ✅ Vérifier bouclier
      if (ShieldEffect.hasShield(target)) {
        const result = ShieldEffect.absorbDamage(target, finalDamage);
        finalDamage = result.damageTaken;
        
        // Log pour UI
        if (result.damageBlocked > 0) {
          console.log(`🛡️ Bouclier de ${target.name} absorbe ${result.damageBlocked} dégâts`);
        }
      }
      
      // Appliquer dégâts aux HP
      target.currentHp = Math.max(0, target.currentHp - finalDamage);
      
      // Vérifier mort
      if (target.currentHp === 0) {
        target.status.alive = false;
        console.log(`💀 ${target.name} est vaincu !`);
      }
    }
  }
}
```

---

## 📊 Balance et Design

### Valeurs recommandées de bouclier

| Rareté | % HP Max | Exemple (1000 HP) | Durée |
|--------|----------|-------------------|-------|
| Common | 10-15% | 100-150 HP | 3 tours |
| Rare | 15-20% | 150-200 HP | 3-4 tours |
| Epic | 20-25% | 200-250 HP | 4-5 tours |
| Legendary | 25-30% | 250-300 HP | 5-6 tours |

### Formules par type de sort

**Bouclier self (Tank)** :
```typescript
shieldHp = caster.stats.maxHp * 0.20
```

**Bouclier allié (Support)** :
```typescript
shieldHp = target.stats.maxHp * 0.15
```

**Bouclier AoE (Team buff)** :
```typescript
shieldHp = target.stats.maxHp * 0.08
```

**Bouclier ultimate** :
```typescript
shieldHp = target.stats.maxHp * 0.25
```

### Balance guidelines

- **Single target** : 15-25% HP max
- **AoE** : 8-15% HP max
- **Ultimate** : 20-30% HP max
- **Durée** : 3-6 tours (plus court si plus fort)

---

## 🧪 Tests Recommandés

### Test 1 : Application basique
```
1. Appliquer Shield (100 HP) sur cible
2. Infliger 50 dégâts
3. Vérifier : Bouclier à 50 HP, cible HP inchangé
4. Vérifier message : "Bouclier absorbe 50 dégâts"
```

### Test 2 : Brisure de bouclier
```
1. Appliquer Shield (100 HP)
2. Infliger 150 dégâts
3. Vérifier : Bouclier brisé (0 HP), cible perd 50 HP
4. Vérifier message : "Bouclier absorbe 100 puis se brise"
```

### Test 3 : Remplacement
```
1. Appliquer Shield A (100 HP)
2. Appliquer Shield B (150 HP)
3. Vérifier : Shield B remplace A
4. Appliquer Shield C (80 HP)
5. Vérifier : Shield B conservé (plus grand)
```

### Test 4 : Expiration naturelle
```
1. Appliquer Shield (100 HP, 2 tours)
2. Tour 1 : Vérifier présent
3. Tour 2 : Vérifier présent
4. Tour 3 : Vérifier retiré automatiquement
```

### Test 5 : Multiples cibles
```
1. Sort AoE applique Shield sur 4 alliés
2. Chaque cible reçoit son propre bouclier
3. Vérifier indépendance (briser 1 n'affecte pas les autres)
```

---

## 🔜 Buffs à venir (idées)

### Haste (Célérité)
- Augmente vitesse d'action
- Réduit cooldowns
- Contre : Slow

### Fortify (Fortification)
- Augmente défense temporairement
- Immunité à certains debuffs
- Contre : Armor Break

### Rage (Rage)
- Augmente attaque
- Réduit défense (trade-off)
- Immunité à Weakness

### Regeneration (Régénération)
- Soigne chaque tour
- Peut être réduit par Poison
- HoT (Heal over Time)

---

## 📚 Références

### Fichiers liés
- `server/src/gameplay/effects/base/BaseEffect.ts` - Classe de base
- `server/src/gameplay/EffectManager.ts` - Gestionnaire central
- `server/src/services/BattleEngine.ts` - Intégration combat

### Documentation externe
- [Battle Effects Unity Doc](../../../docs/api/battle-effects.md)
- [BattleEngine Architecture](../../../docs/architecture/battle-system.md)

---

**Version**: 1.0.0  
**Dernière mise à jour**: 10 octobre 2025  
**Effets implémentés**: Shield (1/1 Buff Phase 1)  
**Prochaine phase**: Reflect Damage Syste

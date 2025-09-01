import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * AfkState = état persistant unique par joueur.
 * Version proto: or fixe/minute, cap de durée façon AFK Arena.
 * - Accumule de l'or tant que le joueur est "AFK" (hors combat/activité) et entre deux "claim".
 * - Cap d'accumulation depuis le dernier claim (ex: 12h).
 * - Compteur journalier simple pour un futur cap/jour (optionnel).
 */

export interface IAfkState extends Document {
  playerId: Types.ObjectId;
  pendingGold: number;                 // Or en attente (non réclamé)
  lastTickAt: Date | null;             // Dernière fois où on a "tick"
  lastClaimAt: Date | null;            // Dernier claim
  accumulatedSinceClaimSec: number;    // Temps accumulé depuis le dernier claim (pour cap 12h)

  // Paramètres de balance (proto — pourront venir d’un fichier config plus tard)
  baseGoldPerMinute: number;           // OR/min fixe (ex: 5)
  maxAccrualSeconds: number;           // Cap de durée depuis le dernier claim (ex: 12h)

  // Suivi quotidien (optionnel pour futur cap journalier)
  todayAccruedGold: number;
  todayKey: string;                    // AAAA-MM-JJ pour reset quotidien

  tick(now?: Date): number;            // retourne le gold ajouté à pendingGold
  claim(): number;                     // retourne le gold réclamé (et remet à zéro)
  _resetTodayIfNeeded(now: Date): void;
}

const AfkStateSchema = new Schema<IAfkState>({
  playerId: {
    type: Schema.Types.ObjectId,
    ref: "Player",
    required: true,
    index: true,
    unique: true, // 1 état AFK par joueur
  },

  pendingGold: { type: Number, default: 0, min: 0 },
  lastTickAt: { type: Date, default: null },
  lastClaimAt: { type: Date, default: null },
  accumulatedSinceClaimSec: { type: Number, default: 0, min: 0 },

  // Balance (proto)
  baseGoldPerMinute: { type: Number, default: 5, min: 0 },            // ← OR/min fixe
  maxAccrualSeconds: { type: Number, default: 12 * 3600, min: 0 },    // ← cap 12h façon AFK Arena

  // Suivi quotidien simple
  todayAccruedGold: { type: Number, default: 0, min: 0 },
  todayKey: { type: String, default: () => new Date().toISOString().slice(0, 10) }, // "YYYY-MM-DD"
}, {
  timestamps: true,
  collection: "afk_states",
});

// Index utiles
AfkStateSchema.index({ todayKey: 1 });
AfkStateSchema.index({ updatedAt: -1 });

// Méthodes
AfkStateSchema.methods._resetTodayIfNeeded = function(now: Date) {
  const key = now.toISOString().slice(0, 10);
  if (this.todayKey !== key) {
    this.todayKey = key;
    this.todayAccruedGold = 0;
  }
};

/**
 * tick(now): calcule le delta depuis lastTickAt et ajoute de l'or à pendingGold
 * en respectant le cap maxAccrualSeconds depuis le dernier claim.
 * Retourne le gold ajouté lors de ce tick.
 */
AfkStateSchema.methods.tick = function(now?: Date): number {
  const current = now ?? new Date();

  // Reset quotidien si jour changé
  this._resetTodayIfNeeded(current);

  // Si premier tick : initialise simplement lastTickAt
  if (!this.lastTickAt) {
    this.lastTickAt = current;
    return 0;
  }

  // Calcul du delta (en secondes)
  const deltaSec = Math.max(0, Math.floor((current.getTime() - this.lastTickAt.getTime()) / 1000));

  if (deltaSec === 0) {
    return 0;
  }

  // Respect du cap d'accumulation depuis le dernier claim
  const remainingSecBeforeCap = Math.max(0, this.maxAccrualSeconds - this.accumulatedSinceClaimSec);
  if (remainingSecBeforeCap <= 0) {
    // Déjà au cap → pas de nouveau gain, on avance l'horloge pour éviter l'explosion de delta
    this.lastTickAt = current;
    return 0;
  }

  const effectiveSec = Math.min(deltaSec, remainingSecBeforeCap);

  // OR/min → OR/secondes, arrondi à l'entier inférieur (classique idle)
  const goldPerSec = this.baseGoldPerMinute / 60;
  const gained = Math.floor(effectiveSec * goldPerSec);

  if (gained > 0) {
    this.pendingGold += gained;
    this.todayAccruedGold += gained;
  }

  this.accumulatedSinceClaimSec += effectiveSec;
  this.lastTickAt = current;

  return gained;
};

/**
 * claim(): renvoie le montant en attente et remet à zéro
 * (ne crédite PAS le Player ici pour éviter la dépendance circulaire ;
 * le service/contrôleur fera: player.gold += claimed; await player.save(); )
 */
AfkStateSchema.methods.claim = function(): number {
  const claimed = this.pendingGold;
  this.pendingGold = 0;
  this.accumulatedSinceClaimSec = 0;
  this.lastClaimAt = new Date();
  // lastTickAt est conservé (on continue à mesurer le temps après le claim)
  return claimed;
};

export default mongoose.model<IAfkState>("AfkState", AfkStateSchema);

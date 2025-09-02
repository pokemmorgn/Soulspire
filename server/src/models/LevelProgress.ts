import mongoose, { Document, Schema } from "mongoose";

interface ILevelProgressDocument extends Document {
  serverId: string;
  playerId: string;
  worldId: number;
  levelId: number;
  difficulty: "Normal" | "Hard" | "Nightmare";
  
  victories: number;
  attempts: number;
  bestTime: number;
  firstClearDate: Date;
  lastAttemptDate: Date;
  
  canSkip(): boolean;
  canRetry(): boolean;
}

const levelProgressSchema = new Schema<ILevelProgressDocument>({
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/
  },
  playerId: { type: String, required: true },
  worldId: { type: Number, required: true, min: 1 },
  levelId: { type: Number, required: true, min: 1 },
  difficulty: { 
    type: String, 
    enum: ["Normal", "Hard", "Nightmare"],
    required: true 
  },
  
  victories: { type: Number, default: 0, min: 0 },
  attempts: { type: Number, default: 0, min: 0 },
  bestTime: { type: Number, default: 0, min: 0 },
  firstClearDate: { type: Date },
  lastAttemptDate: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'levelProgress'
});

levelProgressSchema.index({ playerId: 1, serverId: 1 });
levelProgressSchema.index({ worldId: 1, levelId: 1, difficulty: 1 });
levelProgressSchema.index({ playerId: 1, worldId: 1, levelId: 1, difficulty: 1 }, { unique: true });

levelProgressSchema.methods.canSkip = function(): boolean {
  return this.victories >= 3;
};

levelProgressSchema.methods.canRetry = function(): boolean {
  return this.attempts > 0;
};

levelProgressSchema.statics.getOrCreate = async function(
  playerId: string, 
  serverId: string, 
  worldId: number, 
  levelId: number, 
  difficulty: string
) {
  let progress = await this.findOne({
    playerId, serverId, worldId, levelId, difficulty
  });
  
  if (!progress) {
    progress = new this({
      playerId, serverId, worldId, levelId, difficulty,
      victories: 0, attempts: 0, bestTime: 0
    });
    await progress.save();
  }
  
  return progress;
};

levelProgressSchema.statics.recordAttempt = async function(
  playerId: string,
  serverId: string,
  worldId: number,
  levelId: number,
  difficulty: string,
  victory: boolean,
  battleTime: number
) {
  const progress = await this.getOrCreate(playerId, serverId, worldId, levelId, difficulty);
  
  progress.attempts++;
  progress.lastAttemptDate = new Date();
  
  if (victory) {
    progress.victories++;
    if (!progress.firstClearDate) {
      progress.firstClearDate = new Date();
    }
    if (battleTime > 0 && (progress.bestTime === 0 || battleTime < progress.bestTime)) {
      progress.bestTime = battleTime;
    }
  }
  
  await progress.save();
  return progress;
};

export default mongoose.model<ILevelProgressDocument>("LevelProgress", levelProgressSchema);

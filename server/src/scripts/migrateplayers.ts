const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect('mongodb://localhost:27017/unity-gacha-game');
  const db = mongoose.connection;

  const cursor = db.collection('players').find({ playerId: { $exists: false } });
  while (await cursor.hasNext()) {
    const player = await cursor.next();

    // Génère un nouvel ID string
    const newId = `PLAYER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prépare le nouveau document
    const migrated = {
      ...player,
      _id: newId,
      playerId: newId
    };
    delete migrated.__v; // Optionnel : évite les conflits de version

    // Insère le nouveau doc, supprime l'ancien
    await db.collection('players').insertOne(migrated);
    await db.collection('players').deleteOne({ _id: player._id });

    console.log(`Migrated player ${player.username} (${player._id} -> ${newId})`);
  }

  await mongoose.disconnect();
}

migrate();

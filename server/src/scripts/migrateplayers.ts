const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Générateur d'IDs UUID v4 (version simplifiée pour le script)
function generatePlayerId() {
  return `PLAYER_${uuidv4().replace(/-/g, '')}`;
}

function generateAccountId() {
  return `ACC_${uuidv4().replace(/-/g, '')}`;
}

function generateTransactionId() {
  return `TXN_${uuidv4().replace(/-/g, '')}`;
}

// Validation UUID format
function isOldFormat(id) {
  // Détecte l'ancien format: PLAYER_timestamp_random ou pas de préfixe
  return !id || id.match(/^PLAYER_\d+_[a-z0-9]+$/) || !id.startsWith('PLAYER_');
}

async function migrateAccounts() {
  console.log('🔍 Migration des comptes...');
  const db = mongoose.connection;
  let migratedCount = 0;

  const cursor = db.collection('accounts').find({
    $or: [
      { accountId: { $exists: false } },
      { accountId: { $regex: /^ACC_\d+_[a-z0-9]+$/ } } // Ancien format
    ]
  });

  while (await cursor.hasNext()) {
    const account = await cursor.next();
    const oldAccountId = account.accountId || account._id;
    const newAccountId = generateAccountId();

    try {
      // Prépare le nouveau document
      const migrated = {
        ...account,
        _id: newAccountId,
        accountId: newAccountId,
        oldAccountId: oldAccountId // Backup pour rollback
      };
      delete migrated.__v;

      // Insère le nouveau, supprime l'ancien
      await db.collection('accounts').insertOne(migrated);
      await db.collection('accounts').deleteOne({ _id: account._id });

      // Met à jour les références dans les joueurs
      await db.collection('players').updateMany(
        { accountId: oldAccountId },
        { 
          $set: { 
            accountId: newAccountId,
            oldAccountId: oldAccountId 
          }
        }
      );

      console.log(`✅ Compte migré: ${account.username || 'Unknown'} (${oldAccountId} -> ${newAccountId})`);
      migratedCount++;

    } catch (error) {
      console.error(`❌ Erreur migration compte ${oldAccountId}:`, error.message);
    }
  }

  console.log(`📊 Total comptes migrés: ${migratedCount}\n`);
  return migratedCount;
}

async function migratePlayers() {
  console.log('🔍 Migration des joueurs...');
  const db = mongoose.connection;
  let migratedCount = 0;

  const cursor = db.collection('players').find({
    $or: [
      { playerId: { $exists: false } },
      { playerId: { $regex: /^PLAYER_\d+_[a-z0-9]+$/ } } // Ancien format
    ]
  });

  while (await cursor.hasNext()) {
    const player = await cursor.next();
    const oldPlayerId = player.playerId || player._id;
    const newPlayerId = generatePlayerId();

    try {
      // Prépare le nouveau document
      const migrated = {
        ...player,
        _id: newPlayerId,
        playerId: newPlayerId,
        oldPlayerId: oldPlayerId // Backup pour rollback
      };
      delete migrated.__v;

      // Migre les transactions VIP avec UUID si nécessaire
      if (migrated.vipTransactions && Array.isArray(migrated.vipTransactions)) {
        migrated.vipTransactions = migrated.vipTransactions.map(transaction => ({
          ...transaction,
          transactionId: transaction.transactionId && transaction.transactionId.startsWith('TXN_') 
            ? transaction.transactionId 
            : generateTransactionId()
        }));
      }

      // Migre les achats serveur avec UUID si nécessaire
      if (migrated.serverPurchases && Array.isArray(migrated.serverPurchases)) {
        migrated.serverPurchases = migrated.serverPurchases.map(purchase => ({
          ...purchase,
          transactionId: purchase.transactionId && purchase.transactionId.startsWith('TXN_')
            ? purchase.transactionId
            : generateTransactionId()
        }));
      }

      // Insère le nouveau doc, supprime l'ancien
      await db.collection('players').insertOne(migrated);
      await db.collection('players').deleteOne({ _id: player._id });

      console.log(`✅ Joueur migré: ${player.displayName || player.username || 'Unknown'} (${oldPlayerId} -> ${newPlayerId})`);
      migratedCount++;

    } catch (error) {
      console.error(`❌ Erreur migration joueur ${oldPlayerId}:`, error.message);
    }
  }

  console.log(`📊 Total joueurs migrés: ${migratedCount}\n`);
  return migratedCount;
}

async function checkMigrationStatus() {
  console.log('📊 Vérification du statut de migration...');
  const db = mongoose.connection;

  try {
    // Comptes
    const totalAccounts = await db.collection('accounts').countDocuments();
    const migratedAccounts = await db.collection('accounts').countDocuments({
      accountId: { $regex: /^ACC_[a-f0-9]{32}$/ }
    });

    // Joueurs  
    const totalPlayers = await db.collection('players').countDocuments();
    const migratedPlayers = await db.collection('players').countDocuments({
      playerId: { $regex: /^PLAYER_[a-f0-9]{32}$/ }
    });

    console.log('📈 STATUT DE MIGRATION:');
    console.log(`   Comptes: ${migratedAccounts}/${totalAccounts} (${Math.round(migratedAccounts/totalAccounts*100)}%)`);
    console.log(`   Joueurs: ${migratedPlayers}/${totalPlayers} (${Math.round(migratedPlayers/totalPlayers*100)}%)`);
    
    const needsMigration = (migratedAccounts < totalAccounts) || (migratedPlayers < totalPlayers);
    console.log(`   Migration nécessaire: ${needsMigration ? '❌ OUI' : '✅ NON'}\n`);

    return { totalAccounts, migratedAccounts, totalPlayers, migratedPlayers, needsMigration };

  } catch (error) {
    console.error('❌ Erreur vérification statut:', error.message);
    return null;
  }
}

async function cleanupOldFields() {
  console.log('🧹 Nettoyage des champs temporaires...');
  const db = mongoose.connection;

  try {
    // Supprimer les champs de backup après migration réussie
    const accountsUpdated = await db.collection('accounts').updateMany(
      { oldAccountId: { $exists: true } },
      { $unset: { oldAccountId: 1 } }
    );

    const playersUpdated = await db.collection('players').updateMany(
      { $or: [{ oldPlayerId: { $exists: true } }, { oldAccountId: { $exists: true } }] },
      { $unset: { oldPlayerId: 1, oldAccountId: 1 } }
    );

    console.log(`✅ Nettoyage terminé:`);
    console.log(`   Comptes: ${accountsUpdated.modifiedCount} documents`);
    console.log(`   Joueurs: ${playersUpdated.modifiedCount} documents\n`);

  } catch (error) {
    console.error('❌ Erreur nettoyage:', error.message);
  }
}

async function migrate() {
  console.log('🚀 Démarrage de la migration UUID v4...\n');
  
  try {
    await mongoose.connect('mongodb://localhost:27017/unity-gacha-game');
    console.log('✅ Connexion MongoDB établie\n');

    // Vérifier le statut avant migration
    const statusBefore = await checkMigrationStatus();
    if (!statusBefore) return;

    if (!statusBefore.needsMigration) {
      console.log('🎉 Aucune migration nécessaire - Tous les IDs sont déjà en UUID !');
      await mongoose.disconnect();
      return;
    }

    // Étape 1: Migrer les comptes
    const accountsMigrated = await migrateAccounts();

    // Étape 2: Migrer les joueurs  
    const playersMigrated = await migratePlayers();

    // Vérification finale
    console.log('🔍 Vérification post-migration...');
    const statusAfter = await checkMigrationStatus();

    // Résumé final
    console.log('🎯 RÉSUMÉ FINAL:');
    console.log(`   ✅ ${accountsMigrated} comptes migrés vers UUID`);
    console.log(`   ✅ ${playersMigrated} joueurs migrés vers UUID`);
    
    if (statusAfter && !statusAfter.needsMigration) {
      console.log('   🎉 Migration 100% réussie !');
      console.log('\n💡 Conseil: Lancez avec --cleanup dans quelques jours pour nettoyer les champs temporaires');
    } else {
      console.log('   ⚠️ Migration incomplète - Relancez le script');
    }

  } catch (error) {
    console.error('💥 Erreur fatale:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
  }
}

// Point d'entrée avec arguments
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
🔧 MIGRATION UUID v4 - Utilisation:

  npx ts-node migrate-player-uuid.ts           # Migration complète
  npx ts-node migrate-player-uuid.ts --check   # Vérifier le statut seulement  
  npx ts-node migrate-player-uuid.ts --cleanup # Nettoyer les champs temporaires
  npx ts-node migrate-player-uuid.ts --help    # Afficher cette aide

📋 Prérequis:
  npm install uuid @types/uuid

🚨 IMPORTANT: 
  - Faire un backup avant migration !
  - Tester d'abord sur une copie de la DB
    `);
    return;
  }

  await mongoose.connect('mongodb://localhost:27017/unity-gacha-game');

  if (args.includes('--check')) {
    await checkMigrationStatus();
  } else if (args.includes('--cleanup')) {
    await cleanupOldFields();
  } else {
    await migrate();
    return; // migrate() gère déjà la déconnexion
  }

  await mongoose.disconnect();
}

main().catch(console.error);

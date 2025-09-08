import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Générateur d'IDs UUID v4
function generatePlayerId(): string {
  return `PLAYER_${uuidv4().replace(/-/g, '')}`;
}

function generateAccountId(): string {
  return `ACC_${uuidv4().replace(/-/g, '')}`;
}

function generateTransactionId(): string {
  return `TXN_${uuidv4().replace(/-/g, '')}`;
}

interface MigrationStatus {
  totalAccounts: number;
  migratedAccounts: number;
  totalPlayers: number;
  migratedPlayers: number;
  needsMigration: boolean;
}

async function migrateAccounts(): Promise<number> {
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
    if (!account) continue;

    const oldAccountId = account.accountId || account._id;
    const newAccountId = generateAccountId();

    try {
      // Copie complète avec spread operator
      const migrated = { ...account };
      
      // Modification des champs nécessaires
      migrated._id = newAccountId;
      migrated.accountId = newAccountId;
      migrated.oldAccountId = oldAccountId;
      
      // Suppression du champ de versioning Mongoose
      if ('__v' in migrated) {
        delete (migrated as any).__v;
      }

      // Insertion et suppression
      await db.collection('accounts').insertOne(migrated as any);
      await db.collection('accounts').deleteOne({ _id: account._id });

      // Mise à jour des références dans les joueurs
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
      const err = error as Error;
      console.error(`❌ Erreur migration compte ${oldAccountId}:`, err.message);
    }
  }

  console.log(`📊 Total comptes migrés: ${migratedCount}\n`);
  return migratedCount;
}

async function migratePlayers(): Promise<number> {
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
    if (!player) continue;

    const oldPlayerId = player.playerId || player._id;
    const newPlayerId = generatePlayerId();

    try {
      // Copie complète avec spread operator
      const migrated = { ...player };
      
      // Modification des champs nécessaires
      migrated._id = newPlayerId;
      migrated.playerId = newPlayerId;
      migrated.oldPlayerId = oldPlayerId;
      
      // Suppression du champ de versioning Mongoose
      if ('__v' in migrated) {
        delete (migrated as any).__v;
      }

      // Migration des transactions VIP avec UUID si nécessaire
      if (migrated.vipTransactions && Array.isArray(migrated.vipTransactions)) {
        migrated.vipTransactions = migrated.vipTransactions.map((transaction: any) => ({
          ...transaction,
          transactionId: transaction.transactionId && transaction.transactionId.startsWith('TXN_') 
            ? transaction.transactionId 
            : generateTransactionId()
        }));
      }

      // Migration des achats serveur avec UUID si nécessaire
      if (migrated.serverPurchases && Array.isArray(migrated.serverPurchases)) {
        migrated.serverPurchases = migrated.serverPurchases.map((purchase: any) => ({
          ...purchase,
          transactionId: purchase.transactionId && purchase.transactionId.startsWith('TXN_')
            ? purchase.transactionId
            : generateTransactionId()
        }));
      }

      // Insertion et suppression
      await db.collection('players').insertOne(migrated as any);
      await db.collection('players').deleteOne({ _id: player._id });

      console.log(`✅ Joueur migré: ${player.displayName || player.username || 'Unknown'} (${oldPlayerId} -> ${newPlayerId})`);
      migratedCount++;

    } catch (error) {
      const err = error as Error;
      console.error(`❌ Erreur migration joueur ${oldPlayerId}:`, err.message);
    }
  }

  console.log(`📊 Total joueurs migrés: ${migratedCount}\n`);
  return migratedCount;
}

async function checkMigrationStatus(): Promise<MigrationStatus | null> {
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
    const err = error as Error;
    console.error('❌ Erreur vérification statut:', err.message);
    return null;
  }
}

async function cleanupOldFields(): Promise<void> {
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
    const err = error as Error;
    console.error('❌ Erreur nettoyage:', err.message);
  }
}

async function migrate(): Promise<void> {
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
    const err = error as Error;
    console.error('💥 Erreur fatale:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
🔧 MIGRATION UUID v4 - Utilisation:

  npx ts-node src/scripts/migrateplayers.ts           # Migration complète
  npx ts-node src/scripts/migrateplayers.ts --check   # Vérifier le statut seulement  
  npx ts-node src/scripts/migrateplayers.ts --cleanup # Nettoyer les champs temporaires
  npx ts-node src/scripts/migrateplayers.ts --help    # Afficher cette aide

📋 Prérequis:
  npm install uuid @types/uuid

🚨 IMPORTANT: 
  - Faire un backup avant migration !
  - Tester d'abord sur une copie de la DB
    `);
    return;
  }

  await mongoose.connect('mongodb://localhost:27017/unity-gacha-game');

  try {
    if (args.includes('--check')) {
      await checkMigrationStatus();
    } else if (args.includes('--cleanup')) {
      await cleanupOldFields();
    } else {
      await migrate();
      return; // migrate() gère déjà la déconnexion
    }
  } finally {
    await mongoose.disconnect();
  }
}

// Exécution du script
if (require.main === module) {
  main().catch((error) => {
    const err = error as Error;
    console.error('💥 Erreur fatale:', err.message);
    process.exit(1);
  });
}

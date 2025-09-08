import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Générateurs UUID v4
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

  // Trouve les comptes avec ancien format d'ID
  const cursor = db.collection('accounts').find({
    $or: [
      { accountId: { $exists: false } },
      { accountId: { $regex: /^ACC_\d+_[a-z0-9]+$/ } }, // Ancien format timestamp
      { _id: { $type: "objectId" } } // ObjectId existants
    ]
  });

  while (await cursor.hasNext()) {
    const account = await cursor.next();
    if (!account) continue;

    const oldAccountId = account.accountId || account._id.toString();
    const oldId = account._id;
    const newAccountId = generateAccountId();

    try {
      // ✅ Utilisation d'any pour éviter tous les conflits TypeScript
      const migratedAccount: any = {
        ...account,
        _id: newAccountId,              
        accountId: newAccountId,        
        oldAccountId: oldAccountId      
      };
      
      // Nettoyage - maintenant possible avec any
      if (migratedAccount.__v !== undefined) {
        delete migratedAccount.__v;
      }

      // ✅ Insertion avec any - Plus de conflit !
      await db.collection('accounts').insertOne(migratedAccount);
      await db.collection('accounts').deleteOne({ _id: oldId });

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

  // Trouve les joueurs avec ancien format d'ID
  const cursor = db.collection('players').find({
    $or: [
      { playerId: { $exists: false } },
      { playerId: { $regex: /^PLAYER_\d+_[a-z0-9]+$/ } }, // Ancien format timestamp
      { _id: { $type: "objectId" } } // ObjectId existants
    ]
  });

  while (await cursor.hasNext()) {
    const player = await cursor.next();
    if (!player) continue;

    const oldPlayerId = player.playerId || player._id.toString();
    const oldId = player._id;
    const newPlayerId = generatePlayerId();

    try {
      // ✅ Utilisation d'any pour éviter tous les conflits TypeScript
      const migratedPlayer: any = {
        ...player,
        _id: newPlayerId,               
        playerId: newPlayerId,          
        oldPlayerId: oldPlayerId        
      };
      
      // Nettoyage - maintenant possible avec any
      if (migratedPlayer.__v !== undefined) {
        delete migratedPlayer.__v;
      }

      // Migration des transactions VIP avec UUID
      if (migratedPlayer.vipTransactions && Array.isArray(migratedPlayer.vipTransactions)) {
        migratedPlayer.vipTransactions = migratedPlayer.vipTransactions.map((transaction: any) => ({
          ...transaction,
          transactionId: transaction.transactionId && transaction.transactionId.startsWith('TXN_') 
            ? transaction.transactionId 
            : generateTransactionId()
        }));
      }

      // Migration des achats serveur avec UUID
      if (migratedPlayer.serverPurchases && Array.isArray(migratedPlayer.serverPurchases)) {
        migratedPlayer.serverPurchases = migratedPlayer.serverPurchases.map((purchase: any) => ({
          ...purchase,
          transactionId: purchase.transactionId && purchase.transactionId.startsWith('TXN_')
            ? purchase.transactionId
            : generateTransactionId()
        }));
      }

      // ✅ Insertion avec any - Plus de conflit !
      await db.collection('players').insertOne(migratedPlayer);
      await db.collection('players').deleteOne({ _id: oldId });

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
      $and: [
        { accountId: { $regex: /^ACC_[a-f0-9]{32}$/ } }, // Format UUID
        { _id: { $type: "string" } } // _id est String
      ]
    });

    // Joueurs  
    const totalPlayers = await db.collection('players').countDocuments();
    const migratedPlayers = await db.collection('players').countDocuments({
      $and: [
        { playerId: { $regex: /^PLAYER_[a-f0-9]{32}$/ } }, // Format UUID
        { _id: { $type: "string" } } // _id est String
      ]
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

async function validateMigration(): Promise<boolean> {
  console.log('🔍 Validation post-migration...');
  const db = mongoose.connection;

  try {
    // Vérifier qu'il n'y a plus d'ObjectId en _id
    const accountsWithObjectId = await db.collection('accounts').countDocuments({
      _id: { $type: "objectId" }
    });

    const playersWithObjectId = await db.collection('players').countDocuments({
      _id: { $type: "objectId" }
    });

    // Vérifier que tous les IDs sont au bon format
    const invalidAccountIds = await db.collection('accounts').countDocuments({
      $or: [
        { accountId: { $not: /^ACC_[a-f0-9]{32}$/ } },
        { _id: { $not: /^ACC_[a-f0-9]{32}$/ } }
      ]
    });

    const invalidPlayerIds = await db.collection('players').countDocuments({
      $or: [
        { playerId: { $not: /^PLAYER_[a-f0-9]{32}$/ } },
        { _id: { $not: /^PLAYER_[a-f0-9]{32}$/ } }
      ]
    });

    console.log('🔎 VALIDATION:');
    console.log(`   Comptes avec ObjectId: ${accountsWithObjectId}`);
    console.log(`   Joueurs avec ObjectId: ${playersWithObjectId}`);
    console.log(`   Comptes avec IDs invalides: ${invalidAccountIds}`);
    console.log(`   Joueurs avec IDs invalides: ${invalidPlayerIds}\n`);

    const isValid = accountsWithObjectId === 0 && playersWithObjectId === 0 && 
                   invalidAccountIds === 0 && invalidPlayerIds === 0;

    if (isValid) {
      console.log('✅ Validation réussie - Tous les IDs sont au format UUID String !');
    } else {
      console.log('❌ Validation échouée - Des IDs non conformes détectés');
    }

    return isValid;

  } catch (error) {
    const err = error as Error;
    console.error('❌ Erreur validation:', err.message);
    return false;
  }
}

async function migrate(): Promise<void> {
  console.log('🚀 Démarrage de la migration vers String UUID...\n');
  
  try {
    await mongoose.connect('mongodb://localhost:27017/unity-gacha-game');
    console.log('✅ Connexion MongoDB établie\n');

    // Vérifier le statut avant migration
    const statusBefore = await checkMigrationStatus();
    if (!statusBefore) return;

    if (!statusBefore.needsMigration) {
      console.log('🎉 Aucune migration nécessaire - Tous les IDs sont déjà en UUID String !');
      await mongoose.disconnect();
      return;
    }

    // Étape 1: Migrer les comptes
    const accountsMigrated = await migrateAccounts();

    // Étape 2: Migrer les joueurs  
    const playersMigrated = await migratePlayers();

    // Étape 3: Validation
    console.log('🔍 Validation post-migration...');
    const isValid = await validateMigration();

    // Vérification finale du statut
    const statusAfter = await checkMigrationStatus();

    // Résumé final
    console.log('🎯 RÉSUMÉ FINAL:');
    console.log(`   ✅ ${accountsMigrated} comptes migrés vers UUID String`);
    console.log(`   ✅ ${playersMigrated} joueurs migrés vers UUID String`);
    console.log(`   ${isValid ? '✅' : '❌'} Validation: ${isValid ? 'RÉUSSIE' : 'ÉCHOUÉE'}`);
    
    if (statusAfter && !statusAfter.needsMigration && isValid) {
      console.log('   🎉 Migration 100% réussie et validée !');
      console.log('\n💡 Conseil: Lancez avec --cleanup dans quelques jours pour nettoyer les champs temporaires');
    } else {
      console.log('   ⚠️ Migration incomplète ou validation échouée - Vérifiez les erreurs');
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
🔧 MIGRATION UUID STRING - Utilisation:

  npx ts-node src/scripts/migrateplayers.ts           # Migration complète
  npx ts-node src/scripts/migrateplayers.ts --check   # Vérifier le statut seulement  
  npx ts-node src/scripts/migrateplayers.ts --validate # Valider la migration
  npx ts-node src/scripts/migrateplayers.ts --cleanup # Nettoyer les champs temporaires
  npx ts-node src/scripts/migrateplayers.ts --help    # Afficher cette aide

📋 Prérequis:
  npm install uuid @types/uuid
  
🚨 IMPORTANT: 
  - Mettre à jour les schemas Account.ts et Player.ts AVANT migration !
  - Faire un backup avant migration !
  - Tester d'abord sur une copie de la DB

🎯 Cette migration convertit:
  - ObjectId _id → String UUID _id  
  - Ancien format timestamp → UUID v4
  - Synchronise _id et accountId/playerId
    `);
    return;
  }

  await mongoose.connect('mongodb://localhost:27017/unity-gacha-game');

  try {
    if (args.includes('--check')) {
      await checkMigrationStatus();
    } else if (args.includes('--validate')) {
      await validateMigration();
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

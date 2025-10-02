import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import des modèles
import Account from '../models/Account';
import Player from '../models/Player';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unity-gacha-game';

async function resetTestAccount() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    const username = 'greg';
    const password = 'gregreg';
    const email = 'greg@test.com';

    // 1. Supprimer l'ancien compte et ses joueurs
    console.log('🗑️  Suppression de l\'ancien compte...');
    const deletedAccount = await Account.deleteOne({ username });
    const deletedPlayers = await Player.deleteMany({ username });
    
    console.log(`   - Comptes supprimés: ${deletedAccount.deletedCount}`);
    console.log(`   - Joueurs supprimés: ${deletedPlayers.deletedCount}\n`);

    // 2. Créer le nouveau compte
    console.log('👤 Création du nouveau compte...');
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const newAccount = new Account({
      username,
      email,
      password: hashedPassword,
      accountStatus: 'active',
      preferences: {
        language: 'en',
        notifications: {
          email: true,
          push: true,
          marketing: false
        },
        privacy: {
          showOnlineStatus: true,
          allowFriendRequests: true
        }
      },
      serverList: ['S1']
    });

    await newAccount.save();
    console.log(`✅ Compte créé: ${newAccount.accountId}`);
    console.log(`   - Username: ${username}`);
    console.log(`   - Email: ${email}`);
    console.log(`   - Password: ${password}`);
    console.log(`   - AccountID: ${newAccount.accountId}\n`);

    // 3. Créer un joueur par défaut sur S1
    console.log('🎮 Création du joueur sur S1...');
    const newPlayer = new Player({
      accountId: newAccount.accountId,
      username: username,
      displayName: username, // ✅ AJOUTÉ : displayName obligatoire
      serverId: 'S1',
      level: 1,
      experience: 0,
      resources: {
        gold: 10000,
        gems: 500,
        premiumGems: 0
      },
      heroes: [],
      formations: []
    });

    await newPlayer.save();
    console.log(`✅ Joueur créé: ${newPlayer.playerId}`);
    console.log(`   - PlayerID: ${newPlayer.playerId}`);
    console.log(`   - ServerId: ${newPlayer.serverId}`);
    console.log(`   - DisplayName: ${newPlayer.displayName}\n`);

    // 4. Afficher les commandes cURL de test
    console.log('📋 Commandes de test:\n');
    
    console.log('--- LOGIN ---');
    console.log(`curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"${username}","password":"${password}"}'`);
    
    console.log('\n--- APRÈS LOGIN, TESTEZ LES SHOPS ---');
    console.log(`curl http://localhost:3000/api/shops/ElementalFriday \\
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"`);

    console.log('\n✨ Script terminé avec succès!\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

// Exécuter le script
resetTestAccount();

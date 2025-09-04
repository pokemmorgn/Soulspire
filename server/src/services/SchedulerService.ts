// src/services/SchedulerService.ts
import cron from 'node-cron';
import { ShopService } from './ShopService';

export class SchedulerService {
  private static scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  // Démarrer tous les schedulers
  public static startAllSchedulers() {
    console.log("🕐 Démarrage des tâches programmées...");

    // Reset des boutiques quotidiennes - tous les jours à minuit
    this.scheduleTask('daily-shop-reset', '0 0 * * *', async () => {
      console.log("🌅 Reset quotidien des boutiques...");
      await ShopService.processShopResets();
    });

    // Reset des boutiques hebdomadaires - tous les lundis à minuit
    this.scheduleTask('weekly-shop-reset', '0 0 * * 1', async () => {
      console.log("📅 Reset hebdomadaire des boutiques...");
      await ShopService.processShopResets();
    });

    // Reset des boutiques mensuelles - le 1er de chaque mois à minuit
    this.scheduleTask('monthly-shop-reset', '0 0 1 * *', async () => {
      console.log("📆 Reset mensuel des boutiques...");
      await ShopService.processShopResets();
    });

    // Vérification générale - toutes les heures
    this.scheduleTask('shop-health-check', '0 * * * *', async () => {
      console.log("🔍 Vérification santé des boutiques...");
      try {
        const result = await ShopService.processShopResets();
        if (result.totalReset > 0) {
          console.log(`✅ ${result.totalReset} boutiques mises à jour automatiquement`);
        }
      } catch (error) {
        console.error("❌ Erreur vérification boutiques:", error);
      }
    });

    console.log(`✅ ${this.scheduledTasks.size} tâches programmées démarrées`);
  }

  // Programmer une tâche spécifique
  private static scheduleTask(name: string, cronExpression: string, task: () => Promise<void>) {
    try {
      const scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`⚡ Exécution tâche: ${name}`);
        try {
          await task();
        } catch (error) {
          console.error(`❌ Erreur tâche ${name}:`, error);
        }
      }, {
        scheduled: true,
        timezone: "UTC" // Ajustez selon votre timezone
      });

      this.scheduledTasks.set(name, scheduledTask);
      console.log(`📋 Tâche "${name}" programmée: ${cronExpression}`);
      
    } catch (error) {
      console.error(`❌ Impossible de programmer la tâche ${name}:`, error);
    }
  }

  // Arrêter toutes les tâches
  public static stopAllSchedulers() {
    console.log("⏹️ Arrêt des tâches programmées...");
    
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      console.log(`🛑 Tâche "${name}" arrêtée`);
    });
    
    this.scheduledTasks.clear();
    console.log("✅ Toutes les tâches programmées arrêtées");
  }

  // Obtenir le statut des tâches
  public static getSchedulerStatus() {
    const tasks = Array.from(this.scheduledTasks.entries()).map(([name, task]) => ({
      name,
      running: task.getStatus() === 'scheduled'
    }));

    return {
      totalTasks: this.scheduledTasks.size,
      tasks
    };
  }

  // Exécuter manuellement une tâche (pour debug)
  public static async runTaskManually(taskName: string) {
    console.log(`🔧 Exécution manuelle: ${taskName}`);
    
    switch (taskName) {
      case 'shop-reset':
        await ShopService.processShopResets();
        break;
      default:
        throw new Error(`Tâche inconnue: ${taskName}`);
    }
    
    console.log(`✅ Tâche ${taskName} exécutée manuellement`);
  }
}

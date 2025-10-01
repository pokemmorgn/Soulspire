// server/src/services/ElementalBannerService.ts

import Banner from "../models/Banner";
import ElementalBannerRotation from "../models/ElementalBannerRotation";
import { WebSocketService } from "./WebSocketService";

export interface ElementalRotationInfo {
  day: string;
  dayNumber: number;
  activeElements: string[];
  activeBanners: string[];
  shopOpen: boolean;
  nextRotation: Date;
  weekNumber: number;
}

export interface ElementalBannerInfo {
  bannerId: string;
  name: string;
  element: string;
  description: string;
  ticketCost: number;
  rates: any;
  pityConfig: any;
  heroPool: any;
  bannerImage: string;
  iconImage: string;
}

export class ElementalBannerService {
  
  /**
   * Obtenir la rotation actuelle pour un serveur
   */
  public static async getCurrentRotation(serverId: string): Promise<ElementalRotationInfo> {
    try {
      const rotation = await ElementalBannerRotation.getCurrentRotation(serverId);
      
      return {
        day: rotation.currentDay,
        dayNumber: this.getDayNumber(rotation.currentDay),
        activeElements: rotation.activeElements,
        activeBanners: rotation.activeBanners,
        shopOpen: rotation.shopOpen,
        nextRotation: rotation.nextRotationAt,
        weekNumber: rotation.currentWeek
      };
    } catch (error: any) {
      console.error("❌ Error getCurrentRotation:", error);
      throw error;
    }
  }

  /**
   * Obtenir les bannières élémentaires actives aujourd'hui
   */
  public static async getActiveBannersToday(serverId: string): Promise<ElementalBannerInfo[]> {
    try {
      const rotation = await ElementalBannerRotation.getCurrentRotation(serverId);
      
      // Si c'est vendredi (boutique), pas de bannières actives
      if (rotation.shopOpen) {
        console.log(`🛒 Friday: Elemental shop open, no banners active`);
        return [];
      }
      
      // Si aucun élément actif (ne devrait pas arriver sauf erreur)
      if (rotation.activeElements.length === 0) {
        console.log(`⚠️ No active elements today`);
        return [];
      }
      
      // Récupérer les bannières pour les éléments actifs
      const banners = await Banner.find({
        isActive: true,
        isVisible: true,
        "elementalConfig.element": { $in: rotation.activeElements },
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });
      
      console.log(`📋 Found ${banners.length} active elemental banners for ${rotation.activeElements.join(", ")}`);
      
      return banners.map(banner => this.formatBannerInfo(banner));
    } catch (error: any) {
      console.error("❌ Error getActiveBannersToday:", error);
      throw error;
    }
  }

  /**
   * Obtenir une bannière élémentaire spécifique par élément
   */
  public static async getBannerByElement(serverId: string, element: string): Promise<ElementalBannerInfo | null> {
    try {
      const banner = await Banner.findOne({
        isActive: true,
        isVisible: true,
        "elementalConfig.element": element,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });
      
      if (!banner) {
        console.log(`⚠️ No elemental banner found for element: ${element}`);
        return null;
      }
      
      return this.formatBannerInfo(banner);
    } catch (error: any) {
      console.error("❌ Error getBannerByElement:", error);
      throw error;
    }
  }

  /**
   * Vérifier si un élément est disponible aujourd'hui
   */
  public static async isElementActive(serverId: string, element: string): Promise<boolean> {
    try {
      return await ElementalBannerRotation.isElementActiveToday(serverId, element);
    } catch (error: any) {
      console.error("❌ Error isElementActive:", error);
      return false;
    }
  }

  /**
   * Vérifier si c'est le jour boutique (vendredi)
   */
  public static async isShopDay(serverId: string): Promise<boolean> {
    try {
      return await ElementalBannerRotation.isShopDay(serverId);
    } catch (error: any) {
      console.error("❌ Error isShopDay:", error);
      return false;
    }
  }

  /**
   * Effectuer la rotation quotidienne (appelé par le cron job)
   */
  public static async performDailyRotation(serverId: string): Promise<void> {
    try {
      console.log(`🔄 Performing daily elemental rotation for ${serverId}...`);
      
      const oldRotation = await ElementalBannerRotation.findOne({ serverId });
      const newRotation = await ElementalBannerRotation.updateRotation(serverId);
      
      console.log(`✅ Rotation updated for ${serverId}:`);
      console.log(`   Day: ${oldRotation?.currentDay || 'N/A'} → ${newRotation.currentDay}`);
      console.log(`   Elements: [${oldRotation?.activeElements.join(", ") || 'N/A'}] → [${newRotation.activeElements.join(", ")}]`);
      console.log(`   Shop: ${oldRotation?.shopOpen || false} → ${newRotation.shopOpen}`);
      
      // Notifier via WebSocket
      try {
        WebSocketService.broadcastToServer(serverId, 'elemental:rotation_changed', {
          day: newRotation.currentDay,
          activeElements: newRotation.activeElements,
          shopOpen: newRotation.shopOpen,
          nextRotation: newRotation.nextRotationAt
        });
        
        console.log(`📢 WebSocket notification sent for rotation change`);
      } catch (wsError) {
        console.warn("⚠️ WebSocket notification failed:", wsError);
      }
      
      // Si c'est vendredi, notifier l'ouverture de la boutique
      if (newRotation.shopOpen) {
        try {
          WebSocketService.broadcastToServer(serverId, 'elemental:shop_opened', {
            duration: 24,
            specialOffers: true,
            nextRotation: newRotation.nextRotationAt
          });
          
          console.log(`🛒 Elemental shop opened notification sent`);
        } catch (wsError) {
          console.warn("⚠️ Shop notification failed:", wsError);
        }
      }
      
    } catch (error: any) {
      console.error("❌ Error performDailyRotation:", error);
      throw error;
    }
  }

  /**
   * Obtenir le planning de rotation pour la semaine
   */
  public static getWeeklySchedule(): { day: string; elements: string[]; shopOpen: boolean }[] {
    return [
      { day: "Monday", elements: ["Fire"], shopOpen: false },
      { day: "Tuesday", elements: ["Electric"], shopOpen: false },
      { day: "Wednesday", elements: ["Wind"], shopOpen: false },
      { day: "Thursday", elements: ["Water"], shopOpen: false },
      { day: "Friday", elements: [], shopOpen: true },
      { day: "Saturday", elements: ["Light", "Shadow"], shopOpen: false },
      { day: "Sunday", elements: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"], shopOpen: false }
    ];
  }

  /**
   * Obtenir les informations de rotation pour les prochains jours
   */
  public static getUpcomingRotations(days: number = 7): { date: Date; day: string; elements: string[]; shopOpen: boolean }[] {
    const rotations = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const dayName = ElementalBannerRotation.getDayNameFromNumber(dayOfWeek);
      const activeElements = ElementalBannerRotation.getActiveElementsForDay(dayOfWeek);
      
      rotations.push({
        date,
        day: dayName,
        elements: activeElements,
        shopOpen: dayOfWeek === 5
      });
    }
    
    return rotations;
  }

  /**
   * Obtenir toutes les bannières élémentaires (peu importe la rotation)
   */
  public static async getAllElementalBanners(serverId: string): Promise<ElementalBannerInfo[]> {
    try {
      const banners = await Banner.find({
        isActive: true,
        isVisible: true,
        "elementalConfig.element": { $exists: true },
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      }).sort({ "elementalConfig.element": 1 });
      
      return banners.map(banner => this.formatBannerInfo(banner));
    } catch (error: any) {
      console.error("❌ Error getAllElementalBanners:", error);
      throw error;
    }
  }

  /**
   * Vérifier si une bannière élémentaire est active aujourd'hui
   */
  public static async isBannerActiveToday(serverId: string, bannerId: string): Promise<boolean> {
    try {
      const banner = await Banner.findOne({ bannerId });
      
      if (!banner || !banner.elementalConfig || !banner.elementalConfig.element) {
        return false;
      }
      
      return await this.isElementActive(serverId, banner.elementalConfig.element);
    } catch (error: any) {
      console.error("❌ Error isBannerActiveToday:", error);
      return false;
    }
  }

  // === MÉTHODES UTILITAIRES PRIVÉES ===

  /**
   * Formater les informations d'une bannière pour l'API
   */
  private static formatBannerInfo(banner: any): ElementalBannerInfo {
    return {
      bannerId: banner.bannerId,
      name: banner.name,
      element: banner.elementalConfig?.element || "Unknown",
      description: banner.description,
      ticketCost: banner.elementalConfig?.ticketCost || 1,
      rates: banner.rates,
      pityConfig: banner.pityConfig || {
        legendaryPity: 50,
        epicPity: 0
      },
      heroPool: {
        includeAll: banner.heroPool.includeAll,
        specificHeroes: banner.heroPool.specificHeroes,
        rarityFilters: banner.heroPool.rarityFilters
      },
      bannerImage: banner.bannerImage,
      iconImage: banner.iconImage
    };
  }

  /**
   * Convertir nom du jour en numéro
   */
  private static getDayNumber(dayName: string): number {
    const days: { [key: string]: number } = {
      "sunday": 0,
      "monday": 1,
      "tuesday": 2,
      "wednesday": 3,
      "thursday": 4,
      "friday": 5,
      "saturday": 6
    };
    
    return days[dayName.toLowerCase()] || 0;
  }

  /**
   * Obtenir l'icône d'élément (pour UI)
   */
  public static getElementIcon(element: string): string {
    const icons: { [key: string]: string } = {
      "Fire": "🔥",
      "Water": "💧",
      "Wind": "💨",
      "Electric": "⚡",
      "Light": "✨",
      "Shadow": "🌑"
    };
    
    return icons[element] || "❓";
  }

  /**
   * Obtenir la couleur d'élément (pour UI)
   */
  public static getElementColor(element: string): string {
    const colors: { [key: string]: string } = {
      "Fire": "#FF4500",
      "Water": "#1E90FF",
      "Wind": "#32CD32",
      "Electric": "#FFD700",
      "Light": "#FFFFFF",
      "Shadow": "#8B008B"
    };
    
    return colors[element] || "#CCCCCC";
  }
}

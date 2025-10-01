// server/src/services/WishlistService.ts

import Wishlist, { IWishlistDocument } from "../models/Wishlist";
import Hero from "../models/Hero";
import Player from "../models/Player";

export interface WishlistResponse {
  success: boolean;
  wishlist?: IWishlistDocument;
  message?: string;
  error?: string;
}

export interface AvailableHeroesResponse {
  success: boolean;
  heroes?: any[];
  error?: string;
}

export class WishlistService {
  
  /**
   * Récupérer ou créer la wishlist d'un joueur
   */
  static async getOrCreateWishlist(
    playerId: string, 
    serverId: string,
    type: "normal" | "elemental" = "normal",
    element?: string
  ): Promise<IWishlistDocument> {
    try {
      let wishlist = await Wishlist.findOne({ 
        playerId, 
        serverId,
        type,
        ...(element && { element })
      });

      if (!wishlist) {
        console.log(`📋 Creating new ${type} wishlist for player ${playerId}`);
        
        wishlist = new Wishlist({
          playerId,
          serverId,
          type,
          element: element || undefined,
          heroes: [],
          maxHeroes: 4,
          pityCounter: 0,
          pityThreshold: 100,
          lastPityReset: new Date()
        });
        
        await wishlist.save();
      }

      return wishlist;
    } catch (error: any) {
      console.error("❌ Error getOrCreateWishlist:", error);
      throw error;
    }
  }

  /**
   * Récupérer la wishlist d'un joueur (sans créer si n'existe pas)
   */
  static async getWishlist(
    playerId: string, 
    serverId: string,
    type: "normal" | "elemental" = "normal",
    element?: string
  ): Promise<WishlistResponse> {
    try {
      const wishlist = await Wishlist.findOne({ 
        playerId, 
        serverId,
        type,
        ...(element && { element })
      });

      if (!wishlist) {
        return {
          success: true,
          wishlist: undefined,
          message: "No wishlist found. Create one by adding heroes."
        };
      }

      // Populer les infos des héros
      const heroIds = wishlist.heroes.map(h => h.heroId);
      const heroes = await Hero.find({ _id: { $in: heroIds } }).select('name rarity element role');

      // Enrichir les données
      const enrichedWishlist = {
        ...wishlist.toObject(),
        heroes: wishlist.heroes.map(wh => {
          const heroData = heroes.find((h: any) => h._id.toString() === wh.heroId);
          return {
            ...wh,
            heroData: heroData || null
          };
        })
      };

      return {
        success: true,
        wishlist: enrichedWishlist as any
      };
    } catch (error: any) {
      console.error("❌ Error getWishlist:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ajouter un héros à la wishlist
   */
  static async addHeroToWishlist(
    playerId: string, 
    serverId: string, 
    heroId: string,
    itemCost?: { itemId: string; quantity: number }
  ): Promise<WishlistResponse> {
    try {
      // Récupérer ou créer la wishlist
      const wishlist = await this.getOrCreateWishlist(playerId, serverId);

      // Vérifier si la wishlist est pleine
      if (!wishlist.canAddHero()) {
        return {
          success: false,
          error: `Wishlist is full (maximum ${wishlist.maxHeroes} heroes)`
        };
      }

      // Vérifier si le héros existe déjà dans la wishlist
      if (wishlist.heroes.some((h: any) => h.heroId === heroId)) {
        return {
          success: false,
          error: "Hero already in wishlist"
        };
      }

      // Vérifier que le héros existe et est Legendary
      const hero = await Hero.findById(heroId);
      if (!hero) {
        return {
          success: false,
          error: "Hero not found"
        };
      }

      if (hero.rarity !== "Legendary") {
        return {
          success: false,
          error: "Only Legendary heroes can be added to wishlist"
        };
      }

      // ✅ Futur : Vérifier et déduire le coût en items
      if (itemCost) {
        const player = await Player.findOne({ _id: playerId, serverId });
        if (!player) {
          return {
            success: false,
            error: "Player not found"
          };
        }

        // TODO : Implémenter la vérification et déduction d'items
        // const hasItem = player.items.get(itemCost.itemId) >= itemCost.quantity;
        // if (!hasItem) {
        //   return {
        //     success: false,
        //     error: `Insufficient ${itemCost.itemId}. Required: ${itemCost.quantity}`
        //   };
        // }
        
        // Déduire l'item
        // const currentAmount = player.items.get(itemCost.itemId) || 0;
        // player.items.set(itemCost.itemId, currentAmount - itemCost.quantity);
        // await player.save();
        
        console.log(`💰 Item cost for wishlist: ${itemCost.itemId} x${itemCost.quantity} (NOT IMPLEMENTED YET)`);
      }

      // Ajouter le héros
      await wishlist.addHero(heroId, itemCost);

      console.log(`✅ Hero ${hero.name} added to wishlist for player ${playerId}`);

      return {
        success: true,
        wishlist,
        message: `${hero.name} added to wishlist successfully`
      };
    } catch (error: any) {
      console.error("❌ Error addHeroToWishlist:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retirer un héros de la wishlist
   */
  static async removeHeroFromWishlist(
    playerId: string, 
    serverId: string, 
    heroId: string
  ): Promise<WishlistResponse> {
    try {
      const wishlist = await Wishlist.findOne({ 
        playerId, 
        serverId,
        type: "normal"
      });

      if (!wishlist) {
        return {
          success: false,
          error: "Wishlist not found"
        };
      }

      // Vérifier que le héros est dans la wishlist
      const heroExists = wishlist.heroes.some(h => h.heroId === heroId);
      if (!heroExists) {
        return {
          success: false,
          error: "Hero not in wishlist"
        };
      }

      await wishlist.removeHero(heroId);

      const hero = await Hero.findById(heroId);
      console.log(`🗑️ Hero ${hero?.name || heroId} removed from wishlist for player ${playerId}`);

      return {
        success: true,
        wishlist,
        message: `Hero removed from wishlist successfully`
      };
    } catch (error: any) {
      console.error("❌ Error removeHeroFromWishlist:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mettre à jour la wishlist complète (remplacer tous les héros)
   */
  static async updateWishlist(
    playerId: string, 
    serverId: string, 
    heroIds: string[]
  ): Promise<WishlistResponse> {
    try {
      // Validation : max 4 héros
      if (heroIds.length > 4) {
        return {
          success: false,
          error: "Maximum 4 heroes allowed in wishlist"
        };
      }

      // Validation : tous Legendary
      const heroes = await Hero.find({ _id: { $in: heroIds } });
      
      if (heroes.length !== heroIds.length) {
        return {
          success: false,
          error: "One or more heroes not found"
        };
      }

      const allLegendary = heroes.every(h => h.rarity === "Legendary");
      if (!allLegendary) {
        return {
          success: false,
          error: "Only Legendary heroes can be added to wishlist"
        };
      }

      // Récupérer ou créer la wishlist
      const wishlist = await this.getOrCreateWishlist(playerId, serverId);

      // Remplacer complètement la liste des héros
      wishlist.heroes = heroIds.map(heroId => ({
        heroId,
        addedAt: new Date(),
        itemCost: undefined
      }));

      await wishlist.save();

      console.log(`✅ Wishlist updated for player ${playerId}: ${heroIds.length} heroes`);

      return {
        success: true,
        wishlist,
        message: "Wishlist updated successfully"
      };
    } catch (error: any) {
      console.error("❌ Error updateWishlist:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir la liste des héros éligibles pour la wishlist
   */
  static async getAvailableHeroes(
    element?: string
  ): Promise<AvailableHeroesResponse> {
    try {
      const filter: any = { rarity: "Legendary" };
      
      // Si élément spécifié, filtrer par élément
      if (element) {
        filter.element = element;
      }

      const heroes = await Hero.find(filter)
        .select('name rarity element role baseStats')
        .sort({ name: 1 });

      return {
        success: true,
        heroes
      };
    } catch (error: any) {
      console.error("❌ Error getAvailableHeroes:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Incrémenter le compteur pity de la wishlist
   */
  static async incrementWishlistPity(
    playerId: string, 
    serverId: string
  ): Promise<void> {
    try {
      const wishlist = await this.getOrCreateWishlist(playerId, serverId);
      wishlist.incrementPity();
      await wishlist.save();
    } catch (error: any) {
      console.error("❌ Error incrementWishlistPity:", error);
    }
  }

  /**
   * Reset le compteur pity de la wishlist
   */
  static async resetWishlistPity(
    playerId: string, 
    serverId: string
  ): Promise<void> {
    try {
      const wishlist = await Wishlist.findOne({ 
        playerId, 
        serverId,
        type: "normal"
      });

      if (wishlist) {
        wishlist.resetPity();
        await wishlist.save();
      }
    } catch (error: any) {
      console.error("❌ Error resetWishlistPity:", error);
    }
  }

  /**
   * Vérifier si le pity wishlist est déclenché
   */
static async isWishlistPityTriggered(
  playerId: string, 
  serverId: string
): Promise<boolean> {
  try {
    const wishlist = await Wishlist.findOne({ 
      playerId, 
      serverId,
      type: "normal"
    });

    if (!wishlist) {
      return false;
    }

    const triggered = wishlist.isPityTriggered();
    
    // ✅ AJOUTER CE LOG
    console.log(`🔍 Wishlist pity check: counter=${wishlist.pityCounter}, threshold=${wishlist.pityThreshold}, triggered=${triggered}`);
    
    return triggered;
  } catch (error: any) {
    console.error("❌ Error isWishlistPityTriggered:", error);
    return false;
  }
}

  /**
   * Obtenir un héros aléatoire de la wishlist
   */
  static async getRandomWishlistHero(
    playerId: string, 
    serverId: string
  ): Promise<any | null> {
    try {
      const wishlist = await Wishlist.findOne({ 
        playerId, 
        serverId,
        type: "normal"
      });

      if (!wishlist || wishlist.heroes.length === 0) {
        return null;
      }

      // Sélectionner un héros aléatoire
      const randomIndex = Math.floor(Math.random() * wishlist.heroes.length);
      const wishlistHero = wishlist.heroes[randomIndex];

      // Récupérer les données complètes du héros
      const hero = await Hero.findById(wishlistHero.heroId);
      
      return hero;
    } catch (error: any) {
      console.error("❌ Error getRandomWishlistHero:", error);
      return null;
    }
  }

/**
   * Obtenir les statistiques de la wishlist
   */
  static async getWishlistStats(
    playerId: string, 
    serverId: string
  ): Promise<any> {
    try {
      const wishlist = await this.getOrCreateWishlist(playerId, serverId);

      return {
        heroCount: wishlist.heroes.length,
        maxHeroes: wishlist.maxHeroes,
        slotsAvailable: wishlist.maxHeroes - wishlist.heroes.length,
        pityCounter: wishlist.pityCounter,
        pityThreshold: wishlist.pityThreshold,
        pullsUntilPity: Math.max(0, wishlist.pityThreshold - wishlist.pityCounter),
        isPityTriggered: wishlist.isPityTriggered(),
        lastPityReset: wishlist.lastPityReset
      };
    } catch (error: any) {
      console.error("❌ Error getWishlistStats:", error);
      return null;
    }
  }

  // ===== NOUVELLES MÉTHODES POUR WISHLISTS ÉLÉMENTAIRES =====

  /**
   * Obtenir ou créer une wishlist élémentaire pour un élément spécifique
   */
  static async getOrCreateElementalWishlist(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<IWishlistDocument> {
    try {
      // Valider l'élément
      const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
      if (!validElements.includes(element)) {
        throw new Error(`Invalid element: ${element}. Valid: ${validElements.join(", ")}`);
      }

      let wishlist = await Wishlist.findOne({
        playerId,
        serverId,
        type: "elemental",
        element
      });

      if (!wishlist) {
        console.log(`📋 Creating elemental wishlist (${element}) for player ${playerId}`);

        wishlist = new Wishlist({
          playerId,
          serverId,
          type: "elemental",
          element,
          heroes: [],
          maxHeroes: 4,
          pityCounter: 0,
          pityThreshold: 100,
          lastPityReset: new Date()
        });

        await wishlist.save();
      }

      return wishlist;
    } catch (error: any) {
      console.error("❌ Error getOrCreateElementalWishlist:", error);
      throw error;
    }
  }

  /**
   * Obtenir une wishlist élémentaire (sans créer)
   */
  static async getElementalWishlist(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<WishlistResponse> {
    try {
      const wishlist = await Wishlist.findOne({
        playerId,
        serverId,
        type: "elemental",
        element
      });

      if (!wishlist) {
        return {
          success: true,
          wishlist: undefined,
          message: `No ${element} elemental wishlist found. Create one by adding heroes.`
        };
      }

      // Populer les infos des héros
      const heroIds = wishlist.heroes.map(h => h.heroId);
      const heroes = await Hero.find({ _id: { $in: heroIds } }).select('name rarity element role');

      // Enrichir les données
      const enrichedWishlist = {
        ...wishlist.toObject(),
        heroes: wishlist.heroes.map(wh => {
          const heroData = heroes.find((h: any) => h._id.toString() === wh.heroId);
          return {
            ...wh,
            heroData: heroData || null
          };
        })
      };

      return {
        success: true,
        wishlist: enrichedWishlist as any
      };
    } catch (error: any) {
      console.error("❌ Error getElementalWishlist:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mettre à jour une wishlist élémentaire complète
   */
  static async updateElementalWishlist(
    playerId: string,
    serverId: string,
    element: string,
    heroIds: string[]
  ): Promise<WishlistResponse> {
    try {
      // Validation : max 4 héros
      if (heroIds.length > 4) {
        return {
          success: false,
          error: "Maximum 4 heroes allowed in elemental wishlist"
        };
      }

      // Validation : tous les héros doivent être Legendary ET du bon élément
      const heroes = await Hero.find({ _id: { $in: heroIds } });

      if (heroes.length !== heroIds.length) {
        return {
          success: false,
          error: "One or more heroes not found"
        };
      }

      // Vérifier que tous sont Legendary
      const allLegendary = heroes.every(h => h.rarity === "Legendary");
      if (!allLegendary) {
        return {
          success: false,
          error: "Only Legendary heroes can be added to elemental wishlist"
        };
      }

      // Vérifier que tous sont du bon élément
      const allCorrectElement = heroes.every((h: any) => h.element === element);
      if (!allCorrectElement) {
        return {
          success: false,
          error: `All heroes must be ${element} element`
        };
      }

      // Récupérer ou créer la wishlist élémentaire
      const wishlist = await this.getOrCreateElementalWishlist(playerId, serverId, element);

      // Remplacer complètement la liste des héros
      wishlist.heroes = heroIds.map(heroId => ({
        heroId,
        addedAt: new Date(),
        itemCost: undefined
      }));

      await wishlist.save();

      console.log(`✅ Elemental wishlist (${element}) updated for player ${playerId}: ${heroIds.length} heroes`);

      return {
        success: true,
        wishlist,
        message: `${element} elemental wishlist updated successfully`
      };
    } catch (error: any) {
      console.error("❌ Error updateElementalWishlist:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir toutes les wishlists élémentaires d'un joueur
   */
  static async getAllElementalWishlists(
    playerId: string,
    serverId: string
  ): Promise<{ success: boolean; wishlists?: any[]; error?: string }> {
    try {
      const wishlists = await Wishlist.find({
        playerId,
        serverId,
        type: "elemental"
      });

      // Populer les héros pour chaque wishlist
      const enrichedWishlists = await Promise.all(
        wishlists.map(async (wishlist) => {
          const heroIds = wishlist.heroes.map(h => h.heroId);
          const heroes = await Hero.find({ _id: { $in: heroIds } }).select('name rarity element role');

          return {
            element: wishlist.element,
            heroCount: wishlist.heroes.length,
            maxHeroes: wishlist.maxHeroes,
            pityCounter: wishlist.pityCounter,
            pityThreshold: wishlist.pityThreshold,
            heroes: wishlist.heroes.map(wh => {
              const heroData = heroes.find((h: any) => h._id.toString() === wh.heroId);
              return {
                heroId: wh.heroId,
                heroData: heroData || null,
                addedAt: wh.addedAt
              };
            })
          };
        })
      );

      return {
        success: true,
        wishlists: enrichedWishlists
      };
    } catch (error: any) {
      console.error("❌ Error getAllElementalWishlists:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir un héros aléatoire d'une wishlist élémentaire
   */
  static async getRandomElementalWishlistHero(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<any | null> {
    try {
      const wishlist = await Wishlist.findOne({
        playerId,
        serverId,
        type: "elemental",
        element
      });

      if (!wishlist || wishlist.heroes.length === 0) {
        return null;
      }

      // Sélectionner un héros aléatoire
      const randomIndex = Math.floor(Math.random() * wishlist.heroes.length);
      const wishlistHero = wishlist.heroes[randomIndex];

      // Récupérer les données complètes du héros
      const hero = await Hero.findById(wishlistHero.heroId);

      return hero;
    } catch (error: any) {
      console.error("❌ Error getRandomElementalWishlistHero:", error);
      return null;
    }
  }

  /**
   * Incrémenter le pity d'une wishlist élémentaire
   */
  static async incrementElementalWishlistPity(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<void> {
    try {
      const wishlist = await this.getOrCreateElementalWishlist(playerId, serverId, element);
      wishlist.incrementPity();
      await wishlist.save();
    } catch (error: any) {
      console.error("❌ Error incrementElementalWishlistPity:", error);
    }
  }

  /**
   * Reset le pity d'une wishlist élémentaire
   */
  static async resetElementalWishlistPity(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<void> {
    try {
      const wishlist = await Wishlist.findOne({
        playerId,
        serverId,
        type: "elemental",
        element
      });

      if (wishlist) {
        wishlist.resetPity();
        await wishlist.save();
      }
    } catch (error: any) {
      console.error("❌ Error resetElementalWishlistPity:", error);
    }
  }

  /**
   * Vérifier si le pity d'une wishlist élémentaire est déclenché
   */
  static async isElementalWishlistPityTriggered(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<boolean> {
    try {
      const wishlist = await Wishlist.findOne({
        playerId,
        serverId,
        type: "elemental",
        element
      });

      if (!wishlist) {
        return false;
      }

      const triggered = wishlist.isPityTriggered();

      console.log(`🔍 Elemental wishlist (${element}) pity check: counter=${wishlist.pityCounter}, threshold=${wishlist.pityThreshold}, triggered=${triggered}`);

      return triggered;
    } catch (error: any) {
      console.error("❌ Error isElementalWishlistPityTriggered:", error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques d'une wishlist élémentaire
   */
  static async getElementalWishlistStats(
    playerId: string,
    serverId: string,
    element: string
  ): Promise<any> {
    try {
      const wishlist = await this.getOrCreateElementalWishlist(playerId, serverId, element);

      return {
        element,
        heroCount: wishlist.heroes.length,
        maxHeroes: wishlist.maxHeroes,
        slotsAvailable: wishlist.maxHeroes - wishlist.heroes.length,
        pityCounter: wishlist.pityCounter,
        pityThreshold: wishlist.pityThreshold,
        pullsUntilPity: Math.max(0, wishlist.pityThreshold - wishlist.pityCounter),
        isPityTriggered: wishlist.isPityTriggered(),
        lastPityReset: wishlist.lastPityReset
      };
    } catch (error: any) {
      console.error("❌ Error getElementalWishlistStats:", error);
      return null;
    }
  }
}

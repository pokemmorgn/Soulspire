// server/src/config/FormationBonusConfig.ts

export interface ElementBonuses {
  hp: number;    // Bonus % HP
  atk: number;   // Bonus % ATK
  def: number;   // Bonus % DEF
}

export interface FormationBonusConfig {
  standard: {
    [count: number]: ElementBonuses;
  };
  rare: {
    [count: number]: ElementBonuses;
  };
}

/**
 * Configuration des bonus de synergie élémentaire
 * Les valeurs sont en POURCENTAGE (5 = +5% de la stat)
 */
export const FORMATION_BONUSES: FormationBonusConfig = {
  // Éléments standards : Fire, Water, Wind, Electric
  standard: {
    2: { hp: 5, atk: 5, def: 5 },      // 2 même élément : +5% toutes stats
    3: { hp: 10, atk: 10, def: 10 },   // 3 même élément : +10% toutes stats
    4: { hp: 15, atk: 15, def: 15 },   // 4 même élément : +15% toutes stats
    5: { hp: 25, atk: 25, def: 25 }    // 5 même élément (pure) : +25% toutes stats
  },
  
  // Éléments rares : Light, Dark
  rare: {
    2: { hp: 8, atk: 8, def: 8 },      // 2 Light/Dark : +8% (+60% vs standard)
    3: { hp: 15, atk: 15, def: 15 },   // 3 Light/Dark : +15% (+50% vs standard)
    4: { hp: 22, atk: 22, def: 22 },   // 4 Light/Dark : +22% (+47% vs standard)
    5: { hp: 35, atk: 35, def: 35 }    // 5 Light/Dark : +35% (+40% vs standard)
  }
};

/**
 * Éléments considérés comme "rares" (bonus supérieurs)
 */
export const RARE_ELEMENTS = ["Light", "Dark"];

/**
 * Éléments standards
 */
export const STANDARD_ELEMENTS = ["Fire", "Water", "Wind", "Electric"];

/**
 * Obtenir le bonus pour un nombre de héros du même élément
 */
export function getElementBonus(element: string, count: number): ElementBonuses {
  const isRare = RARE_ELEMENTS.includes(element);
  const bonusTable = isRare ? FORMATION_BONUSES.rare : FORMATION_BONUSES.standard;
  
  // Si le count exact n'existe pas, prendre le bonus inférieur le plus proche
  const availableCounts = Object.keys(bonusTable).map(Number).sort((a, b) => b - a);
  const applicableCount = availableCounts.find(c => c <= count);
  
  if (!applicableCount) {
    return { hp: 0, atk: 0, def: 0 };
  }
  
  return bonusTable[applicableCount];
}

/**
 * Calculer tous les bonus de synergie pour une formation
 */
export function calculateFormationSynergies(elementDistribution: Record<string, number>): {
  bonuses: ElementBonuses;
  details: Array<{
    element: string;
    count: number;
    bonus: ElementBonuses;
    isRare: boolean;
  }>;
} {
  const totalBonuses: ElementBonuses = { hp: 0, atk: 0, def: 0 };
  const details: Array<{
    element: string;
    count: number;
    bonus: ElementBonuses;
    isRare: boolean;
  }> = [];
  
  for (const [element, count] of Object.entries(elementDistribution)) {
    if (count < 2) continue; // Pas de bonus pour 1 seul héros
    
    const bonus = getElementBonus(element, count);
    const isRare = RARE_ELEMENTS.includes(element);
    
    // Additionner les bonus (on prend le meilleur élément)
    // Note: Dans une vraie implémentation, on pourrait avoir des règles plus complexes
    if (bonus.hp > totalBonuses.hp) {
      totalBonuses.hp = bonus.hp;
      totalBonuses.atk = bonus.atk;
      totalBonuses.def = bonus.def;
    }
    
    details.push({
      element,
      count,
      bonus,
      isRare
    });
  }
  
  return { bonuses: totalBonuses, details };
}

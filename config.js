/* =========================================================================
   BioDota: Конфигурация, баланс штаммов и геометрия карты (1920x1080)
   ========================================================================= */

const VIRTUAL_WIDTH = 1920;
const VIRTUAL_HEIGHT = 1080;

const CONFIG = {
  lifespanSeconds: 130,
  reproductionEnergyThreshold: 0.75,
  feederInterval: 4.0,
  feederBatchSize: 8,
  autoFeedRate: 3,
  combatDamageMultiplier: 1.8,
  mobility: 1.1,
  mutationRate: 0.12,
  maxBacteria: 850,
  baseEnergyCostPerSecond: 0.032,
  divisionEnergyLoss: 0.45,
  foodNutritionalValue: 0.45,
  initialStrainCount: 16
};

// Сбалансированные характеристики штаммов (боевой индекс k = damageMult / defenseMult = 2.20)
const SPECIES_CONFIG = {
  warrior: {
    id: 'warrior',
    name: 'Бацилла-Воин',
    badge: '⚔️ Бацилла-Воин',
    damageMult: 2.20,
    defenseMult: 1.00,
    speedBonus: 1.15,
    reproThresholdBonus: 0.0,
    lifespanMult: 1.00,
    energyBurnMult: 1.10,
    shape: 'rod'
  },
  forager: {
    id: 'forager',
    name: 'Фуражир-Спирохета',
    badge: '🌾 Фуражир',
    damageMult: 1.87,
    defenseMult: 0.85,
    speedBonus: 1.35,
    reproThresholdBonus: -0.15,
    lifespanMult: 1.15,
    energyBurnMult: 0.85,
    shape: 'slender'
  },
  tank: {
    id: 'tank',
    name: 'Броне-Кокк',
    badge: '🛡️ Броне-Кокк',
    damageMult: 1.21,
    defenseMult: 0.55,
    speedBonus: 0.75,
    reproThresholdBonus: 0.08,
    lifespanMult: 1.35,
    energyBurnMult: 0.90,
    shape: 'sphere'
  },
  toxic: {
    id: 'toxic',
    name: 'Токсичная Псевдомонада',
    badge: '☣️ Токсик',
    damageMult: 1.70,
    defenseMult: 0.85,
    deathBurstDamage: 0.22,
    speedBonus: 0.95,
    reproThresholdBonus: -0.05,
    lifespanMult: 0.95,
    energyBurnMult: 1.00,
    shape: 'spiky'
  }
};

const DEFAULT_SPECIES_STATS = JSON.parse(JSON.stringify(SPECIES_CONFIG));

// Линии карты (Top, Mid, Bot)
const lanes = [
  { id: 'top', points: [{ x: 190, y: 190 }, { x: 190, y: 110 }, { x: 960, y: 110 }, { x: 1730, y: 110 }, { x: 1730, y: 890 }], width: 65 },
  { id: 'mid', points: [{ x: 190, y: 190 }, { x: 960, y: 540 }, { x: 1730, y: 890 }], width: 70 },
  { id: 'bot', points: [{ x: 190, y: 190 }, { x: 190, y: 970 }, { x: 960, y: 970 }, { x: 1730, y: 970 }, { x: 1730, y: 890 }], width: 65 }
];

// Точки генерации биомассы
const fixedFoodSpawners = [
  { x: 740, y: 390, timer: 0, interval: 4.0, count: 6 },
  { x: 1180, y: 690, timer: 2.0, interval: 4.0, count: 6 },
  { x: 440, y: 780, timer: 1.0, interval: 4.5, count: 8 },
  { x: 1480, y: 300, timer: 2.5, interval: 4.5, count: 8 },
  { x: 1380, y: 790, timer: 1.5, interval: 4.5, count: 8 },
  { x: 960, y: 540, timer: 0.5, interval: 5.0, count: 12 }
];

// Лесные лагеря нейтралов
const neutralCamps = [
  { x: 520, y: 720, name: "Южный Лес Radiant" },
  { x: 360, y: 520, name: "Малый Лес Radiant" },
  { x: 580, y: 240, name: "Северный Лес Radiant" },
  { x: 1400, y: 440, name: "Северный Лес Dire" },
  { x: 1360, y: 830, name: "Южный Лес Dire" }
];
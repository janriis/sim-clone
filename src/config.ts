// Every tunable in one place. Balance the game here.

export const GRID_SIZE = 64;

// --- ticks & time ---
export const TICKS_PER_SECOND = [0, 2, 5, 12] as const; // by speed setting
export const DAYS_PER_MONTH = 30;
export const START_YEAR = 2000;

// --- money ---
export const STARTING_MONEY = 20_000;
export const COST = {
  road: 10,
  wire: 2,
  zone: 5, // per tile painted
  power: 3_000,
  pump: 300,
  police: 500,
  fire: 500,
  park: 150,
  school: 400,
  bulldoze: 1,
} as const;

export const MAINTENANCE = {
  roadPerTile: 1,
  wirePerTile: 0.2,
  power: 150,
  pump: 40,
  police: 60,
  fire: 60,
  park: 8,
  school: 50,
} as const;

export const TAX_DEFAULT = 9; // percent, neutral point
export const TAX_INCOME_FACTOR = 0.28; // income = occupants * rate * factor / month

// --- demand model ---
export const DEMAND = {
  bootstrapJobs: 16, // virtual jobs so an empty map wants residents
  indExportBias: 10, // external demand so industry leads early
  workforceRatio: 0.6,
  taxPenaltyPerPoint: 4,
} as const;

// --- growth ---
export const GROWTH = {
  samplesPerTick: 40,
  spawnChanceAtFullDemand: 0.35,
  spawnCondition: 55,
  levelUpChance: 0.04,
  levelUpMinCondition: 85,
  levelUpMinDemand: 20,
  levelUpLandValuePerLevel: 20, // level N -> N+1 requires landValue > 20*N
  reoccupyChance: 0.05,
  reoccupyMinDemand: 20,
  occupancyDrift: 0.1,
} as const;

// capacity per building = base * level^2
export const CAPACITY = { res: 8, com: 6, ind: 10 } as const;

// --- infrastructure ---
export const POWER_PER_PLANT = 60; // buildings powered per plant
export const ROAD_ACCESS_DIST = 3;
// water: pumps must be powered to run; pipes are implied under roads/zones/buildings
export const WATER_PER_PUMP = 30; // buildings supplied per inland pump...
export const WATER_PER_PUMP_FRESH = 70; // ...or per pump adjacent to open water
// effects of missing water: capacity halved, level-ups blocked, slow condition drain (growth.ts)

// --- fields (recomputed every FIELD_INTERVAL ticks) ---
export const FIELD_INTERVAL = 10;
export const POLLUTION = {
  indPerLevel: 12,
  indRadius: 5,
  plant: 35,
  plantRadius: 6,
  fire: 20,
  fireRadius: 3,
} as const;
export const LAND_VALUE = {
  base: 25,
  elevationBonus: 10,
  waterBonus: 12,
  waterRadius: 3,
  park: 18,
  parkRadius: 4,
  school: 10,
  schoolRadius: 6,
  police: 6,
  policeRadius: 8,
  ruinPenalty: 8,
  ruinRadius: 2,
  pollutionFactor: 0.5,
} as const;

// --- fire ---
export const FIRE = {
  burnTicks: 8,
  spreadChance: 0.22,
  stationRadius: 10,
  rubbleDays: 60,
} as const;

// --- events (rolled monthly) ---
export const EVENTS = {
  fireChance: 0.08, // ceiling for big cities
  firePerBuilding: 0.004, // effective chance = min(fireChance, buildings * this)
  fireGraceMonths: 6, // no random fires while the town is finding its feet
  serviceIgnitionWeight: 1, // zone buildings are 4x more likely to catch fire
  zoneIgnitionWeight: 4,
  boomChance: 0.04,
  recessionChance: 0.04,
  boomMult: 1.6,
  recessionMult: 0.45,
  modifierMonths: 6,
} as const;

export const MILESTONES = [100, 500, 1_000, 2_500, 5_000] as const;
export const MILESTONE_GRANT_PER_POP = 2;

// --- service footprints (w x h tiles) ---
export const SERVICE_SIZE = {
  power: 2,
  pump: 1,
  police: 1,
  fire: 1,
  park: 1,
  school: 2,
} as const;

export const SAVE_KEY = 'simclone.save';
export const AUTOSAVE = true;

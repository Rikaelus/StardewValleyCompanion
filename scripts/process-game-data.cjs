#!/usr/bin/env node

/**
 * Process raw game data exports into structured source files
 * This creates the "source of truth" data files that will be compiled into page-specific JSON
 */

const fs = require('fs');
const path = require('path');

const GAME_EXPORTS_DIR = path.join(__dirname, '../data/game-exports');
const RULES_DIR = path.join(__dirname, '../data/rules');
const PROCESSED_DIR = path.join(__dirname, '../data/processed');

// Items that exist in both fish and forage contexts
// These are crab pot catches that can also be foraged on the beach
const DUAL_ROLE_ITEMS = [372, 718, 719, 723]; // Clam, Cockle, Mussel, Oyster

// Helper function to create kebab-case IDs from names
function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get unique ID for an item, handling duplicates
 * Some items have the same Name but different gameIds (e.g., brown vs white eggs)
 * Uses rules/item-variants.json for mappings
 */
function getUniqueItemId(gameId, itemName) {
  // Check if this gameId has a variant defined in rules
  const variant = rules.itemVariants[String(gameId)];
  if (variant && variant.uniqueId) {
    return variant.uniqueId;
  }

  // Default: use kebab-case of item name
  return toKebabCase(itemName);
}

/**
 * Extract sprite name from DisplayName localization string
 * DisplayName format: "[LocalizedText Strings\\Objects:WhiteEgg_Name]"
 * Returns: "WhiteEgg" or null if not a localized string
 */
function extractSpriteNameFromDisplayName(displayName) {
  if (!displayName || !displayName.includes('[LocalizedText')) {
    return null;
  }

  // Extract the key after the colon, before _Name or _Description
  const match = displayName.match(/:([\w]+)_(?:Name|Description)\]/);
  if (match && match[1]) {
    // Return the exact sprite name from the game data
    return match[1];
  }

  return null;
}

/**
 * Get the correct icon filename for an item based on gameId
 * Attempts to extract from DisplayName first, falls back to rules, then item name
 */
function getIconFilename(gameId, itemName, category = 'artisan', objectData = null) {
  // First try: extract from DisplayName in object data
  if (objectData && objectData.DisplayName) {
    const spriteName = extractSpriteNameFromDisplayName(objectData.DisplayName);
    if (spriteName) {
      return spriteName + '.png';
    }
  }

  // Second try: check if this gameId has a variant defined in rules
  const variant = rules.itemVariants[String(gameId)];
  if (variant && variant.iconFilename) {
    return variant.iconFilename;
  }

  // Default: use item name with spaces replaced by underscores
  return itemName.replace(/\s+/g, '_') + '.png';
}

// Helper function to load JSON files
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Parse shops data to build category -> shops mapping
function parseShopSellingLocations(shopsData) {
  // Map of category tag to numeric category ID
  const categoryTagMap = {
    'category_vegetable': -75,
    'category_greens': -75,
    'category_fruits': -79,
    'category_fish': -4,
    'category_egg': -5,
    'category_milk': -6,
    'category_cooking': -7,
    'category_artisan_goods': -26,
    'category_minerals': -12,
    'category_metal': -15,
    'category_building_resources': -16,
    'category_sell_at_pierres': null, // Special tag
    'category_sell_at_pierres_and_marnies': null, // Special tag
    'category_sell_at_fish_shop': null, // Special tag
    'category_meat': -14,
    'category_flowers': -80,
    'category_gems': -2,
  };

  // Map shop IDs to friendly names
  const shopIdMap = {
    'SeedShop': 'pierre',
    'FishShop': 'willy',
    'AnimalShop': 'marnie',
    'Blacksmith': 'clint',
    'Carpenter': 'robin',
    'Saloon': 'gus',
    'AdventureShop': 'marlon',
  };

  // Build category -> [shops] mapping
  const categoryToShops = {};

  for (const [shopId, shopData] of Object.entries(shopsData)) {
    const friendlyShopId = shopIdMap[shopId];
    if (!friendlyShopId) continue; // Skip unmapped shops

    const salableTags = shopData.SalableItemTags || [];

    for (const tag of salableTags) {
      const categoryId = categoryTagMap[tag];
      if (categoryId !== undefined && categoryId !== null) {
        const key = String(categoryId);
        if (!categoryToShops[key]) {
          categoryToShops[key] = [];
        }
        if (!categoryToShops[key].includes(friendlyShopId)) {
          categoryToShops[key].push(friendlyShopId);
        }
      }
    }
  }

  // Add shipping-bin to all categories
  for (const category of Object.keys(categoryToShops)) {
    categoryToShops[category].push('shipping-bin');
  }

  return categoryToShops;
}

// Helper function to get selling locations for a category
function getSellingLocations(category, shopSellingLocations) {
  return shopSellingLocations[String(category)] || ['shipping-bin'];
}

// Load game data
console.log('Loading game data...');
const gameData = {
  objects: loadJson(path.join(GAME_EXPORTS_DIR, 'Objects.json')),
  fish: loadJson(path.join(GAME_EXPORTS_DIR, 'Fish.json')),
  bundles: loadJson(path.join(GAME_EXPORTS_DIR, 'Bundles.json')),
  npcGiftTastes: loadJson(path.join(GAME_EXPORTS_DIR, 'NPCGiftTastes.json')),
  crops: loadJson(path.join(GAME_EXPORTS_DIR, 'Crops.json')),
  machines: loadJson(path.join(GAME_EXPORTS_DIR, 'Machines.json')),
  farmAnimals: loadJson(path.join(GAME_EXPORTS_DIR, 'FarmAnimals.json')),
  shops: loadJson(path.join(GAME_EXPORTS_DIR, 'Shops.json')),
  bigCraftables: loadJson(path.join(GAME_EXPORTS_DIR, 'BigCraftables.json')),
};

// Parse shop selling locations from game data
console.log('Parsing shop selling locations...');
const shopSellingLocations = parseShopSellingLocations(gameData.shops);
console.log(`  ✓ Parsed selling locations for ${Object.keys(shopSellingLocations).length} categories`);

// Load game rules and mechanics
console.log('Loading game rules and mechanics...');
const rules = {
  priceFormulas: loadJson(path.join(RULES_DIR, 'price-formulas.json')).formulas,
  agingRules: loadJson(path.join(RULES_DIR, 'aging-rules.json')).rules,
  qualityMultipliers: loadJson(path.join(RULES_DIR, 'quality-multipliers.json')).multipliers,
  tapperProducts: loadJson(path.join(RULES_DIR, 'tapper-products.json')).products,
  flavoredItems: loadJson(path.join(RULES_DIR, 'flavored-items.json')).items,
  categories: loadJson(path.join(RULES_DIR, 'categories.json')).categories,
  roeMechanics: loadJson(path.join(RULES_DIR, 'roe-mechanics.json')).mechanics,
  itemVariants: loadJson(path.join(RULES_DIR, 'item-variants.json')).variants,
};

console.log(`Loaded ${Object.keys(gameData.objects).length} objects`);
console.log(`Loaded ${Object.keys(gameData.fish).length} fish`);
console.log(`Loaded ${Object.keys(gameData.bundles).length} bundles`);
console.log(`Loaded ${Object.keys(gameData.machines).length} machines`);
console.log(`Loaded ${Object.keys(gameData.farmAnimals).length} farm animals`);

// Create source directories
fs.mkdirSync(path.join(PROCESSED_DIR, 'items'), { recursive: true });
fs.mkdirSync(path.join(PROCESSED_DIR, 'collections'), { recursive: true });
fs.mkdirSync(path.join(PROCESSED_DIR, 'reference'), { recursive: true });

// Process Crops first (needed for artisan goods)
console.log('\nProcessing crops...');
const cropData = [];
const cropsByHarvestId = new Map(); // Map harvest item ID to crop info

for (const [seedId, cropInfo] of Object.entries(gameData.crops)) {
  const harvestId = cropInfo.HarvestItemId;
  const harvestObject = gameData.objects[harvestId];

  if (!harvestObject) {
    console.warn(`  Warning: Crop harvest item ${harvestId} not found in Objects.json`);
    continue;
  }

  const cropName = harvestObject.Name;
  const category = harvestObject.Category;

  // Determine crop type based on category (from curated data)
  let cropType = 'other';
  const categoryData = rules.categories[category];
  if (categoryData) {
    cropType = categoryData.type;
  }

  // Parse seasons from crop info (0=Spring, 1=Summer, 2=Fall, 3=Winter)
  const seasonMap = ['spring', 'summer', 'fall', 'winter'];
  const seasons = (cropInfo.Seasons || []).map(s => seasonMap[s]).filter(Boolean);

  // Calculate growth time (sum of all phases)
  const daysInPhase = cropInfo.DaysInPhase || [];
  const growthDays = daysInPhase.reduce((sum, days) => sum + days, 0);
  const regrowDays = cropInfo.RegrowDays || -1;

  // Check for planting location restrictions
  let plantingNotes = null;
  let isSeasonIndependent = false;
  const locationRules = cropInfo.PlantableLocationRules || [];
  for (const rule of locationRules) {
    // Result 2 = Deny
    if (rule.Result === 2 && rule.Condition) {
      // Parse common restriction patterns
      if (rule.Condition.includes('LOCATION_IS_OUTDOORS') && rule.Condition.includes('!LOCATION_CONTEXT Here Island')) {
        plantingNotes = 'Cannot be planted outdoors on your farm. Can only be grown in Greenhouse, Garden Pots (indoors), or on Ginger Island (all year-round in these locations).';
        isSeasonIndependent = true;
      }
    }
  }

  const cropEntry = {
    id: toKebabCase(cropName),
    gameId: parseInt(harvestId, 10),
    name: cropName,
    icon: `assets/crops/${cropName.replace(/ /g, '_')}.png`,
    seedId: parseInt(seedId, 10),
    type: cropType,
    category: category,
    price: harvestObject.Price || 0,
    edibility: harvestObject.Edibility || -300,
    seasons: isSeasonIndependent ? [] : seasons,  // Clear seasons if only growable in season-independent locations
    growthDays: growthDays,
    regrowDays: regrowDays > 0 ? regrowDays : null,
    maxHarvestQuality: cropInfo.HarvestMaxQuality ?? 2,
    notes: plantingNotes,
    bundles: [],
    gifts: {}
  };

  cropData.push(cropEntry);
  cropsByHarvestId.set(parseInt(harvestId, 10), cropEntry);
}

console.log(`  Processed ${cropData.length} crops`);
console.log(`    Fruits: ${cropData.filter(c => c.type === 'fruit').length}`);
console.log(`    Vegetables: ${cropData.filter(c => c.type === 'vegetable').length}`);
console.log(`    Flowers: ${cropData.filter(c => c.type === 'flower').length}`);

// Add selling locations to crops
cropData.forEach(item => {
  item.sellingLocations = getSellingLocations(item.category, shopSellingLocations);
});

// ============================================================================
// Process Foraged Items
// ============================================================================
console.log('\nProcessing foraged items...');
const forageData = [];

// Season number to name mapping
const seasonMap = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };

// Load Locations.json to extract forage spawn data
let locationData = {};
try {
  locationData = loadJson(path.join(GAME_EXPORTS_DIR, 'Locations.json'));
} catch (e) {
  console.warn('  Warning: Could not load Locations.json for forage locations');
}

// Build a map of item ID to locations and seasons
const forageLocationMap = new Map(); // gameId -> {locations: Set, seasons: Set}

for (const [locationName, locationInfo] of Object.entries(locationData)) {
  if (locationInfo.Forage) {
    for (const forageRule of locationInfo.Forage) {
      const itemId = parseItemId(forageRule.ItemId);
      if (!itemId) continue;

      if (!forageLocationMap.has(itemId)) {
        forageLocationMap.set(itemId, { locations: new Set(), seasons: new Set() });
      }

      const data = forageLocationMap.get(itemId);

      // Add location (clean up internal names)
      const cleanLocation = locationName
        .replace(/^Custom_/, '')
        .replace(/_/g, ' ');
      data.locations.add(cleanLocation);

      // Add season if specified (either from Season field or Condition field)
      if (forageRule.Season !== undefined && forageRule.Season !== null) {
        const seasonName = seasonMap[forageRule.Season];
        if (seasonName) data.seasons.add(seasonName);
      }
      // Parse Condition field for season data (format: "LOCATION_SEASON Here spring summer fall")
      else if (forageRule.Condition && forageRule.Condition.includes('LOCATION_SEASON')) {
        const conditionMatch = forageRule.Condition.match(/LOCATION_SEASON\s+Here\s+(.+)/);
        if (conditionMatch) {
          const conditionSeasons = conditionMatch[1].split(' ');
          conditionSeasons.forEach(season => {
            if (season && seasonMap[Object.keys(seasonMap).find(k => seasonMap[k] === season.toLowerCase())]) {
              data.seasons.add(season.toLowerCase());
            }
          });
        }
      }
    }
  }
}

// Add mine forage locations (hardcoded game knowledge not in exports)
const mineForageRules = loadJson(path.join(RULES_DIR, 'mine-forage.json'));
for (const mineForage of mineForageRules.items) {
  if (!forageLocationMap.has(mineForage.gameId)) {
    forageLocationMap.set(mineForage.gameId, { locations: new Set(), seasons: new Set() });
  }
  const data = forageLocationMap.get(mineForage.gameId);
  data.locations.add(`Mines (Floors ${mineForage.floors})`);
  // No seasons for mines - available year-round
}

// Filter items with forage_item context tag (plus special cases)
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  const itemGameId = parseInt(gameId, 10);
  const isForageItem = objectData.ContextTags?.includes('forage_item');
  const isSpecialForage = itemGameId === 416; // Snow Yam (lacks forage_item tag but is forage)

  if (!isForageItem && !isSpecialForage) continue;

  const friendlyId = toKebabCase(objectData.Name);

  // Get location and season data
  const locationInfo = forageLocationMap.get(itemGameId) || { locations: new Set(), seasons: new Set() };
  const locations = Array.from(locationInfo.locations).sort();
  let seasons = Array.from(locationInfo.seasons).sort();

  // Note: Beach forage items (forage_item_beach tag) are now correctly extracted
  // from Locations.json with proper seasonal data. No special handling needed.

  // Determine if it's a flower (has flower context tag)
  const isFlower = objectData.ContextTags?.includes('flower_item') || false;

  forageData.push({
    type: 'forage',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/forage/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    seasons: seasons.length > 0 ? seasons : ['spring', 'summer', 'fall', 'winter'],
    locations: locations,
    isFlower: isFlower,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${forageData.length} foraged items`);
console.log(`    Flowers: ${forageData.filter(f => f.isFlower).length}`);

// Add selling locations to forage
forageData.forEach(item => {
  const category = item.originalCategory !== undefined ? item.originalCategory : item.category;
  item.sellingLocations = getSellingLocations(category, shopSellingLocations);
});

// Generate special case notes for forage items
console.log('\nGenerating forage special case notes...');
const { generateForageSpecialCases } = require('./helpers/generate-forage-special-cases.cjs');
const forageSpecialCases = generateForageSpecialCases();

// Merge special case notes into forage data
forageData.forEach(item => {
  if (forageSpecialCases.has(item.gameId)) {
    item.notes = forageSpecialCases.get(item.gameId);
  }
});

// Curate dual-role items in forage context
console.log('\nCurating dual-role forage items...');

forageData.forEach(item => {
  if (DUAL_ROLE_ITEMS.includes(item.gameId)) {
    // For forage context, mark that this item also exists as fish
    item.alsoAvailableAs = {
      type: 'fish',
      id: item.id, // Same friendly ID
      context: 'Crab pot fishing'
    };

    // Preserve original category for game mechanics (selling, professions)
    // But set a display category for the modal subtitle
    item.originalCategory = item.category; // -4 (Fish) - used for professions/selling
    item.displayCategory = -81; // Forage - used for modal subtitle

    // Note: Quality detection is now handled automatically in ItemSellPrice component
    // Foraged items (type='forage') automatically show no quality
    // Fish items (type='fish', even if isTrapFish) show appropriate quality levels
  }
});

console.log(`  ✅ Curated ${DUAL_ROLE_ITEMS.length} dual-role items in forage data`);

// ============================================================================
// Process Fruit Tree Items
// ============================================================================
console.log('\nProcessing fruit tree items...');
const fruitTreeData = [];

// Load fruit trees data
let fruitTreesData = {};
try {
  fruitTreesData = loadJson(path.join(GAME_EXPORTS_DIR, 'fruitTrees.json'));
} catch (e) {
  console.warn('  Warning: Could not load fruitTrees.json');
}

for (const [treeId, treeInfo] of Object.entries(fruitTreesData)) {
  // Get the fruit item ID from the first fruit entry
  const fruitEntry = treeInfo.Fruit?.[0];
  if (!fruitEntry?.ItemId) continue;

  const fruitGameId = parseItemId(fruitEntry.ItemId);
  if (!fruitGameId) continue;

  const fruitObject = gameData.objects[fruitGameId];
  if (!fruitObject) {
    console.warn(`  Warning: Fruit tree fruit ${fruitGameId} not found in Objects.json`);
    continue;
  }

  const treeGameId = isNaN(treeId) ? treeId : parseInt(treeId, 10);
  const fruitName = fruitObject.Name;

  // Map season numbers to names
  const seasons = (treeInfo.Seasons || []).map(s => seasonMap[s]).filter(Boolean);

  // Fruit trees take 28 days to mature
  const daysToMature = 28;

  fruitTreeData.push({
    type: 'fruit-tree',
    id: toKebabCase(fruitName),
    gameId: treeGameId,
    name: `${fruitName} Tree`,
    fruitGameId: fruitGameId,
    fruitName: fruitName,
    icon: `assets/fruit-trees/${fruitName.replace(/\s+/g, '_')}.png`,
    price: fruitObject.Price || 0,
    edibility: fruitObject.Edibility || -300,
    category: fruitObject.Category || 0,
    contextTags: fruitObject.ContextTags || [],
    seasons: seasons,
    daysToMature: daysToMature,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${fruitTreeData.length} fruit tree items`);

// ============================================================================
// Process Tree Fruits (outputs from fruit trees)
// ============================================================================
console.log('\nProcessing tree fruits...');
const treeFruitsData = [];

// Fruit items are category -79 (Fruit)
// These are the outputs from fruit trees, distinct from the tree items themselves
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -79) continue;

  const itemGameId = parseInt(gameId, 10);
  const friendlyId = toKebabCase(objectData.Name);

  // Get the season from the fruit tree data (where this fruit comes from)
  const sourceTree = fruitTreeData.find(t => t.fruitGameId === itemGameId);
  const seasons = sourceTree ? sourceTree.seasons : [];

  treeFruitsData.push({
    type: 'tree-fruit',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/tree-fruits/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    seasons: seasons,
    treeId: sourceTree ? sourceTree.id : null,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${treeFruitsData.length} tree fruit items`);

// ============================================================================
// Process Minerals
// ============================================================================
console.log('\nProcessing minerals...');
const mineralData = [];

// Mineral type classification based on name/properties
function classifyMineral(name, contextTags) {
  // Gems are the precious ones (high value, typically)
  const gems = ['Diamond', 'Ruby', 'Emerald', 'Aquamarine', 'Amethyst', 'Topaz', 'Jade', 'Prismatic Shard'];
  if (gems.includes(name)) return 'gem';

  // Crystals have specific patterns
  if (name.includes('Crystal') || name === 'Fire Quartz' || name === 'Frozen Tear' || name === 'Earth Crystal') {
    return 'crystal';
  }

  // Everything else is a mineral
  return 'mineral';
}

// Filter items with category -2 (Minerals)
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -2) continue;

  const itemGameId = isNaN(gameId) ? gameId : parseInt(gameId, 10);
  const friendlyId = toKebabCase(objectData.Name);
  const mineralType = classifyMineral(objectData.Name, objectData.ContextTags);

  mineralData.push({
    type: 'mineral',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/minerals/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    mineralType: mineralType,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${mineralData.length} minerals`);
console.log(`    Gems: ${mineralData.filter(m => m.mineralType === 'gem').length}`);
console.log(`    Crystals: ${mineralData.filter(m => m.mineralType === 'crystal').length}`);
console.log(`    Other minerals: ${mineralData.filter(m => m.mineralType === 'mineral').length}`);

// ============================================================================
// Process Metal Bars
// ============================================================================
console.log('\nProcessing metal bars...');
const metalBarData = [];

// Filter items with category -15 and furnace_item tag
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -15) continue;
  if (!objectData.ContextTags?.includes('furnace_item')) continue;

  const itemGameId = isNaN(gameId) ? gameId : parseInt(gameId, 10);
  const friendlyId = toKebabCase(objectData.Name);

  // Determine the ore/input for this bar
  // Most bars follow pattern: "X Bar" comes from "X Ore"
  let producedBy = {
    machine: 'Furnace',
    machineId: 'furnace',
    inputs: []
  };

  // Common smelting patterns
  const barToOreMap = {
    'Copper Bar': [{ gameId: 378, name: 'Copper Ore', quantity: 5 }],
    'Iron Bar': [{ gameId: 380, name: 'Iron Ore', quantity: 5 }],
    'Gold Bar': [{ gameId: 384, name: 'Gold Ore', quantity: 5 }],
    'Iridium Bar': [{ gameId: 386, name: 'Iridium Ore', quantity: 5 }],
    'Refined Quartz': [{ gameId: 80, name: 'Quartz', quantity: 1 }, { gameId: 82, name: 'Fire Quartz', quantity: 1 }],
    'Radioactive Bar': [{ gameId: 909, name: 'Radioactive Ore', quantity: 5 }]
  };

  if (barToOreMap[objectData.Name]) {
    producedBy.inputs = barToOreMap[objectData.Name];
  }

  metalBarData.push({
    type: 'metal-bar',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/metal-bars/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    producedBy: producedBy,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${metalBarData.length} metal bars`);

// ============================================================================
// Process Monster Loot
// ============================================================================
console.log('\nProcessing monster loot...');
const monsterLootData = [];

// Rarity classification (based on typical drop rates and value)
function classifyMonsterLootRarity(name, price) {
  // Rare items
  const rareItems = ['Prismatic Shard', 'Diamond', 'Ancient Seed', 'Dwarf Scroll I', 'Dwarf Scroll II',
                     'Dwarf Scroll III', 'Dwarf Scroll IV', 'Void Essence', 'Solar Essence'];
  if (rareItems.includes(name) || price >= 500) return 'rare';

  // Uncommon items
  const uncommonItems = ['Slime', 'Bat Wing', 'Bug Meat', 'Coal'];
  if (uncommonItems.includes(name) || price >= 50) return 'uncommon';

  // Everything else is common
  return 'common';
}

// Filter items with category -28 (Monster Loot)
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -28) continue;

  const itemGameId = isNaN(gameId) ? gameId : parseInt(gameId, 10);
  const friendlyId = toKebabCase(objectData.Name);
  const rarity = classifyMonsterLootRarity(objectData.Name, objectData.Price);

  monsterLootData.push({
    type: 'monster-loot',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/monster-loot/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    rarity: rarity,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${monsterLootData.length} monster loot items`);
console.log(`    Rare: ${monsterLootData.filter(m => m.rarity === 'rare').length}`);
console.log(`    Uncommon: ${monsterLootData.filter(m => m.rarity === 'uncommon').length}`);
console.log(`    Common: ${monsterLootData.filter(m => m.rarity === 'common').length}`);

// ============================================================================
// Process Resources
// ============================================================================
console.log('\nProcessing resources...');
const resourceData = [];

// Specific resource IDs (category -16)
const resourceIds = [388, 390, 709, 330, 92]; // Wood, Stone, Hardwood, Clay, Sap

for (const id of resourceIds) {
  const objectData = gameData.objects[id];
  if (!objectData) {
    console.warn(`  Warning: Resource ${id} not found in Objects.json`);
    continue;
  }

  const friendlyId = toKebabCase(objectData.Name);

  resourceData.push({
    type: 'resource',
    id: friendlyId,
    gameId: id,
    name: objectData.Name,
    icon: `assets/resources/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${resourceData.length} resources`);

// ============================================================================
// Process BigCraftables (Equipment/Machines)
// ============================================================================
console.log('\nProcessing big craftables...');
const bigCraftableData = [];

// BigCraftables that are bundle rewards
const bundleRewardIds = [9, 10, 12, 13, 15, 16, 20, 21, 25, 104, 114];

for (const id of bundleRewardIds) {
  const bigCraftable = gameData.bigCraftables[id];
  if (!bigCraftable) {
    console.warn(`  Warning: BigCraftable ${id} not found in BigCraftables.json`);
    continue;
  }

  const friendlyId = toKebabCase(bigCraftable.Name);
  const spriteName = extractSpriteNameFromDisplayName(bigCraftable.DisplayName);
  const iconFilename = spriteName ? `${spriteName}.png` : `${bigCraftable.Name.replace(/\s+/g, '_')}.png`;

  bigCraftableData.push({
    type: 'big-craftable',
    id: friendlyId,
    gameId: id,
    name: bigCraftable.Name,
    icon: `assets/big-craftables/${iconFilename}`,
    price: bigCraftable.Price || 0,
    edibility: -300, // BigCraftables are not edible
    category: 'Big Craftable',
    contextTags: bigCraftable.ContextTags || [],
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${bigCraftableData.length} big craftables`);

// ============================================================================
// Machine Recipe Parser
// ============================================================================

// Machine ID to friendly name mapping
const MACHINE_NAMES = {
  '(BC)12': 'Keg',
  '(BC)15': 'Preserves Jar',
  '(BC)16': 'Cheese Press',
  '(BC)17': 'Loom',
  '(BC)19': 'Oil Maker',
  '(BC)24': 'Mayonnaise Machine',
  '(BC)10': 'Bee House',
  '(BC)101': 'Tapper',
  '(BC)163': 'Cask',
  '(BC)265': 'Dehydrator',
  '(BC)254': 'Fish Smoker',
  // 1.6 qualified string IDs (these have the actual recipes)
  '(BC)Dehydrator': 'Dehydrator',
  '(BC)FishSmoker': 'Fish Smoker',
  '(BC)BaitMaker': 'Bait Maker',
  '(BC)MushroomLog': 'Mushroom Log'
};

// Parse item ID from game format
function parseItemId(itemId) {
  if (!itemId) return null;

  // Handle (O)123 format (numeric IDs)
  const numericMatch = itemId.match(/\(O\)(\d+)/);
  if (numericMatch) return parseInt(numericMatch[1], 10);

  // Handle (O)StringId format (qualified string IDs)
  const qualifiedMatch = itemId.match(/\(O\)(.+)/);
  if (qualifiedMatch) return qualifiedMatch[1];

  // Handle FLAVORED_ITEM separately
  if (itemId.includes('FLAVORED_ITEM')) return null;

  // Return as-is (already a string ID)
  return itemId;
}

// Parse machine recipes from Machines.json
function parseMachineRecipes(machines) {
  const recipes = [];

  for (const [machineId, machineData] of Object.entries(machines)) {
    const machineName = MACHINE_NAMES[machineId];
    if (!machineName) continue;

    for (const rule of machineData.OutputRules || []) {
      const triggers = rule.Triggers || [];
      const output = rule.OutputItem?.[0];
      if (!output) continue;

      // Extract input requirements
      const specificItems = [];
      const requiredTags = [];
      let requiredCount = 1;

      for (const trigger of triggers) {
        if (trigger.RequiredItemId) {
          const itemId = parseItemId(trigger.RequiredItemId);
          if (itemId) specificItems.push(itemId);
        }
        if (trigger.RequiredTags) {
          requiredTags.push(...trigger.RequiredTags);
        }
        if (trigger.RequiredCount > 1) {
          requiredCount = trigger.RequiredCount;
        }
      }

      // Parse output
      const outputItemId = parseItemId(output.ItemId);
      let outputName = null;
      let isFlavored = false;

      if (output.ItemId && output.ItemId.includes('FLAVORED_ITEM')) {
        const match = output.ItemId.match(/FLAVORED_ITEM (\w+)/);
        outputName = match ? match[1] : null;
        isFlavored = true;
      }

      const processingMinutes = (rule.MinutesUntilReady > 0)
        ? rule.MinutesUntilReady
        : (rule.DaysUntilReady > 0 ? rule.DaysUntilReady * 1440 : 0);

      recipes.push({
        id: rule.Id,
        machine: machineName,
        machineId: toKebabCase(machineName),
        outputItemId,
        outputName,
        isFlavored,
        specificItems,
        requiredTags,
        requiredCount,
        processingMinutes
      });
    }
  }

  return recipes;
}

// Process Artisan Goods
console.log('\nProcessing artisan goods...');
const artisanData = [];

// Parse machine recipes from game data
const machineRecipes = parseMachineRecipes(gameData.machines);
console.log(`  Parsed ${machineRecipes.length} machine recipes`);

// Aging data and price formulas loaded from curated data above

// ============================================================================
// Parse Animal Products from FarmAnimals.json
// ============================================================================
// These products have quality based on animal friendship (not machine-processed)
console.log('\nParsing animal products...');
const animalProducts = new Map(); // gameId -> {source: animalName, hasQuality: true}

for (const [animalName, animalData] of Object.entries(gameData.farmAnimals)) {
  // Parse regular produce
  if (animalData.ProduceItemIds) {
    for (const produce of animalData.ProduceItemIds) {
      const itemId = produce.ItemId;
      if (itemId && !animalProducts.has(itemId)) {
        animalProducts.set(itemId, {
          source: animalName,
          hasQuality: true // Animal products can have quality based on friendship
        });
      }
    }
  }

  // Parse deluxe produce
  if (animalData.DeluxeProduceItemIds) {
    for (const produce of animalData.DeluxeProduceItemIds) {
      const itemId = produce.ItemId;
      if (itemId && !animalProducts.has(itemId)) {
        animalProducts.set(itemId, {
          source: animalName,
          hasQuality: true
        });
      }
    }
  }
}

console.log(`  Parsed ${animalProducts.size} unique animal products`);

// Tapper items loaded from curated data (these don't have machine recipes in Machines.json in a parseable way)
const staticArtisanRules = rules.tapperProducts;

// ============================================================================
// Process Machine Recipes
// ============================================================================

// Map of flavored item names to their gameIds and display names (from curated data)
const flavoredItemIds = {};
const flavoredDisplayNames = {};
for (const [key, data] of Object.entries(rules.flavoredItems)) {
  flavoredItemIds[key] = data.gameId;
  flavoredDisplayNames[key] = data.displayName;
}

for (const recipe of machineRecipes) {
  // Skip Cask (it's for aging, not production)
  if (recipe.machine === 'Cask') continue;

  // Skip AgedRoe - it's handled manually later with fish-specific pricing
  if (recipe.outputName === 'AgedRoe') continue;

  // Determine the actual item ID
  let outputItemId = recipe.outputItemId;
  if (recipe.isFlavored && recipe.outputName) {
    outputItemId = flavoredItemIds[recipe.outputName];
  }

  if (!outputItemId) {
    // Skip recipes without a valid output (like Dehydrator/FishSmoker base rules)
    continue;
  }

  const objectData = gameData.objects[outputItemId];

  if (!objectData) {
    console.warn(`  Warning: Machine output ${outputItemId} not found in Objects.json`);
    continue;
  }

  // Handle flavored items (Wine, Juice, Pickle, Jelly, etc.)
  if (recipe.isFlavored) {
    // Use display name for formula lookup (e.g., "Smoked Fish" not "SmokedFish")
    const displayName = flavoredDisplayNames[recipe.outputName] || recipe.outputName;
    const formula = rules.priceFormulas[displayName] || { multiplier: 1, addition: 0 };

    // Find matching items by tag
    let matchingItems = [];
    if (recipe.requiredTags.includes('category_fruits') || recipe.requiredTags.includes('keg_wine') || recipe.requiredTags.includes('preserves_jelly')) {
      matchingItems = cropData.filter(c => c.type === 'fruit');
    } else if (recipe.requiredTags.includes('category_vegetable') || recipe.requiredTags.includes('category_greens') || recipe.requiredTags.includes('keg_juice') || recipe.requiredTags.includes('preserves_pickle')) {
      matchingItems = cropData.filter(c => c.type === 'vegetable');
    } else if (recipe.requiredTags.includes('category_flowers') || recipe.outputName === 'Honey') {
      // Honey: Bee House has no input (HasInput: false), but nearby flowers flavor the output
      matchingItems = cropData.filter(c => c.type === 'flower');
    } else if (recipe.requiredTags.includes('edible_mushroom')) {
      // Find mushrooms from Objects.json
      matchingItems = Object.entries(gameData.objects)
        .filter(([id, obj]) => obj.ContextTags?.includes('edible_mushroom'))
        .map(([id, obj]) => ({
          id: toKebabCase(obj.Name),
          gameId: isNaN(id) ? id : parseInt(id, 10),
          name: obj.Name,
          type: 'mushroom',
          category: obj.Category || -81,
          price: obj.Price || 0
        }));
    } else if (recipe.requiredTags.includes('category_fish')) {
      // Find fish from Objects.json with category -4 (Fish)
      matchingItems = Object.entries(gameData.objects)
        .filter(([id, obj]) => obj.Category === -4)
        .map(([id, obj]) => ({
          id: toKebabCase(obj.Name),
          gameId: isNaN(id) ? id : parseInt(id, 10),
          name: obj.Name,
          type: 'fish',
          category: -4,
          price: obj.Price || 0
        }));
    }

    const inputDetails = matchingItems.map(item => ({
      inputId: item.id,
      inputName: item.name,
      inputGameId: item.gameId,
      inputBasePrice: item.price,
      inputCategory: item.category,
      inputType: item.type,
      outputPrice: Math.floor(item.price * formula.multiplier + formula.addition),
      outputIridiumPrice: Math.floor((item.price * formula.multiplier + formula.addition) * rules.qualityMultipliers.artisanProfession)
    })).sort((a, b) => b.outputPrice - a.outputPrice);

    const artisanItem = {
      type: 'artisan',
      id: toKebabCase(recipe.outputName),
      gameId: outputItemId,
      name: displayName,
      category: objectData.Category || -26,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/artisan/${getIconFilename(outputItemId, recipe.outputName, 'artisan', objectData)}`,
      contextTags: objectData.ContextTags || [],
      producedBy: {
        machine: recipe.machine,
        machineId: recipe.machineId,
        inputType: recipe.requiredTags.includes('category_fruits') || recipe.requiredTags.includes('keg_wine') || recipe.requiredTags.includes('preserves_jelly') ? 'fruit'
                 : recipe.requiredTags.includes('category_flowers') || recipe.outputName === 'Honey' ? 'flower'
                 : recipe.requiredTags.includes('category_fish') ? 'fish'
                 : recipe.requiredTags.includes('edible_mushroom') ? 'mushroom'
                 : 'vegetable',
        processingTimeMinutes: recipe.processingMinutes,
        valueFormula: `baseValue * ${formula.multiplier}${formula.addition > 0 ? ` + ${formula.addition}` : ''}`,
        inputDetails
      },
      bundles: [],
      gifts: {}
    };

    // Add processing time (keep as minutes for precision, display will convert)
    if (recipe.processingMinutes > 0) {
      artisanItem.processingTimeMinutes = recipe.processingMinutes;
    }

    // Add aging data if applicable
    const aging = rules.agingRules[outputItemId];
    if (aging) {
      artisanItem.canBeAged = aging.canBeAged;
      artisanItem.agingDaysToIridium = aging.agingDaysToIridium;
      if (aging.agingDaysPerTier) {
        artisanItem.agingDaysPerTier = aging.agingDaysPerTier;
      }
    }

    // Special handling for Honey with Wild variant
    if (recipe.outputName === 'Honey') {
      artisanItem.includeWildVariant = true;
    }

    artisanData.push(artisanItem);
  }
  // Handle specific-item recipes (Beer, Coffee, Truffle Oil, etc.)
  else if (recipe.specificItems.length > 0) {
    const inputDetails = recipe.specificItems.map(inputId => {
      const inputObject = gameData.objects[inputId];
      if (!inputObject) return null;

      return {
        inputId: toKebabCase(inputObject.Name),
        inputName: inputObject.Name,
        inputGameId: inputId,
        inputBasePrice: inputObject.Price || 0,
        inputCategory: inputObject.Category,
        inputType: inputObject.Type,
        outputPrice: objectData.Price || 0,
        outputIridiumPrice: Math.floor((objectData.Price || 0) * 1.4)
      };
    }).filter(Boolean);

    const artisanItem = {
      type: 'artisan',
      id: toKebabCase(objectData.Name),
      gameId: outputItemId,
      name: objectData.Name,
      category: objectData.Category || -26,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/artisan/${getIconFilename(outputItemId, objectData.Name, 'artisan', objectData)}`,
      contextTags: objectData.ContextTags || [],
      producedBy: {
        machine: recipe.machine,
        machineId: recipe.machineId,
        inputType: 'specific',
        valueFormula: `${objectData.Price || 0}`,
        inputDetails
      },
      bundles: [],
      gifts: {}
    };

    // Add processing time (keep as minutes for precision, display will convert)
    if (recipe.processingMinutes > 0) {
      artisanItem.processingTimeMinutes = recipe.processingMinutes;
    }

    // Add aging data if applicable
    const aging = rules.agingRules[outputItemId];
    if (aging) {
      artisanItem.canBeAged = aging.canBeAged;
      artisanItem.agingDaysToIridium = aging.agingDaysToIridium;
      if (aging.agingDaysPerTier) {
        artisanItem.agingDaysPerTier = aging.agingDaysPerTier;
      }
    }

    // Only add if we don't already have this item
    const existing = artisanData.find(item => item.gameId === outputItemId);
    if (!existing) {
      artisanData.push(artisanItem);
    } else {
      // Merge input details if this is the same flavored item with different inputs
      if (artisanItem.producedBy?.inputDetails) {
        existing.producedBy.inputDetails.push(...artisanItem.producedBy.inputDetails);
        existing.producedBy.inputDetails.sort((a, b) => b.outputPrice - a.outputPrice);
      }
    }
  }
}

console.log(`  Processed ${machineRecipes.length} machine recipes into ${artisanData.length} unique items`);

// ============================================================================
// Process Animal Products (parsed from FarmAnimals.json)
// ============================================================================

console.log('\nProcessing animal products into artisan data...');
let animalProductsAdded = 0;

// Track which items we've already added
const processedGameIds = new Set(artisanData.map(item => item.gameId));

for (const [itemIdString, productInfo] of animalProducts.entries()) {
  // Parse item ID (can be string like "928" or numeric)
  const itemId = isNaN(itemIdString) ? itemIdString : parseInt(itemIdString, 10);

  // Skip if already processed from machine data
  if (processedGameIds.has(itemId)) {
    continue;
  }

  const objectData = gameData.objects[itemIdString];

  if (!objectData) {
    console.warn(`  Warning: Animal product ${itemIdString} not found in Objects.json`);
    continue;
  }

  const item = {
    type: 'artisan',
    id: getUniqueItemId(itemId, objectData.Name),
    gameId: itemId,
    name: objectData.Name,
    category: objectData.Category || -26,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/artisan/${getIconFilename(itemId, objectData.Name, 'artisan', objectData)}`,
    source: productInfo.source,
    contextTags: objectData.ContextTags || [],
    bundles: [], // Will be populated when processing bundles
    gifts: {} // Will be populated when processing gift tastes
  };

  // Add natural quality flag (animal products can have quality based on friendship)
  if (productInfo.hasQuality) {
    item.hasQuality = true;
  }

  artisanData.push(item);
  processedGameIds.add(itemId);
  animalProductsAdded++;
}

console.log(`  Added ${animalProductsAdded} animal products to artisan goods`);

// ============================================================================
// Process Static Artisan Rules (items that can't be parsed from exports)
// ============================================================================

for (const rule of staticArtisanRules) {
  // Skip if already processed from machine data or animal data
  if (processedGameIds.has(rule.gameId)) {
    continue;
  }
  const objectData = gameData.objects[rule.gameId];

  if (!objectData) {
    console.warn(`  Warning: Artisan item ${rule.gameId} (${rule.name}) not found in Objects.json`);
    continue;
  }

  // Items with a 'source' field (non-machine products like milk, cheese without variants)
  if (rule.source) {
    const item = {
      type: 'artisan',
      id: toKebabCase(rule.name),
      gameId: rule.gameId,
      name: rule.name,
      category: objectData.Category || -26,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/artisan/${getIconFilename(rule.gameId, rule.name, 'artisan', objectData)}`,
      source: rule.source,
      contextTags: objectData.ContextTags || [],
      bundles: [], // Will be populated when processing bundles
      gifts: {} // Will be populated when processing gift tastes
    };

    // Add processing time if specified (in minutes or days)
    if (rule.processingTimeMinutes) {
      item.processingTimeMinutes = rule.processingTimeMinutes;
    } else if (rule.processingTimeDays) {
      item.processingTimeDays = rule.processingTimeDays;
    }

    // Add aging flag and time
    if (rule.canBeAged) {
      item.canBeAged = true;
      if (rule.agingDaysToIridium) {
        item.agingDaysToIridium = rule.agingDaysToIridium;
      }
    }

    // Add natural quality flag
    if (rule.hasQuality) {
      item.hasQuality = true;
    }

    artisanData.push(item);
    continue;
  }

  // Calculate possible inputs and their values for machine-processed items
  const inputDetails = [];

  if (rule.inputType === 'fruit' || rule.inputType === 'vegetable' || rule.inputType === 'flower') {
    const matchingCrops = cropData.filter(c => c.type === rule.inputType);

    for (const crop of matchingCrops) {
      const inputBasePrice = crop.price;
      const outputPrice = rule.fixedValue || Math.floor(inputBasePrice * rule.valueMultiplier + rule.valueAddition);
      const outputIridiumPrice = Math.floor(outputPrice * 1.4); // With Artisan profession

      inputDetails.push({
        inputId: crop.id,
        inputName: crop.name,
        inputGameId: crop.gameId,
        inputBasePrice: inputBasePrice,
        inputCategory: crop.category,
        inputType: crop.type,
        outputPrice: outputPrice,
        outputIridiumPrice: outputIridiumPrice
      });
    }

    // Sort by output value descending (most profitable first)
    inputDetails.sort((a, b) => b.outputPrice - a.outputPrice);
  } else if (rule.inputType === 'specific' && rule.specificInputs) {
    for (const inputId of rule.specificInputs) {
      const inputObject = gameData.objects[inputId];
      if (inputObject) {
        const inputBasePrice = inputObject.Price || 0;
        const outputPrice = rule.fixedValue || inputBasePrice;
        const outputIridiumPrice = Math.floor(outputPrice * 1.4);

        inputDetails.push({
          inputId: toKebabCase(inputObject.Name),
          inputName: inputObject.Name,
          inputGameId: parseInt(inputId, 10),
          inputBasePrice: inputBasePrice,
          inputCategory: inputObject.Category,
          inputType: inputObject.Type,
          outputPrice: outputPrice,
          outputIridiumPrice: outputIridiumPrice
        });
      }
    }
  }

  const artisanItem = {
    id: toKebabCase(rule.name),
    gameId: rule.gameId,
    name: rule.name,
    category: objectData.Category || -26,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/artisan/${getIconFilename(rule.gameId, rule.name, 'artisan', objectData)}`,
    contextTags: objectData.ContextTags || [],
    producedBy: {
      machine: rule.machine,
      machineId: rule.machineId,
      inputType: rule.inputType,
      processingTimeMinutes: rule.processingTimeMinutes,
      valueFormula: rule.valueFormula,
      inputDetails: inputDetails
    },
    bundles: [], // Will be populated when processing bundles
    gifts: {} // Will be populated when processing gift tastes
  };

  // Add aging flag and time
  if (rule.canBeAged) {
    artisanItem.canBeAged = true;
    if (rule.agingDaysToIridium) {
      artisanItem.agingDaysToIridium = rule.agingDaysToIridium;
    }
  }

  // Add natural quality flag
  if (rule.hasQuality) {
    artisanItem.hasQuality = true;
  }

  // Add wild variant flag
  if (rule.includeWildVariant) {
    artisanItem.includeWildVariant = true;
  }

  artisanData.push(artisanItem);
}

console.log(`  Processed ${artisanData.length} artisan goods`);

// Process Fish
console.log('\nProcessing fish...');
const fishData = [];

for (const [gameId, fishInfo] of Object.entries(gameData.fish)) {
  // Fish data is stored as a pipe-delimited string in 1.6
  // Format: Name/Difficulty/BehaviorType/MinSize/MaxSize/Times/Seasons/Weather/SpawnMultiplier/DepthMultiplier/MinLevel/PopulationMultiplier/TrapFish

  if (typeof fishInfo !== 'string') continue; // Skip non-string entries

  const parts = fishInfo.split('/');
  const fishName = parts[0];
  const isTrapFish = parts[1] === 'trap';

  // Game IDs can be numeric (legacy) or string (1.6+ qualified IDs)
  // Numeric: "136", String: "Goby"
  const gameIdValue = isNaN(gameId) ? gameId : parseInt(gameId, 10);

  // Get additional data from Objects.json
  const objectData = gameData.objects[gameId];

  if (!objectData) {
    console.warn(`  Warning: Fish ${gameId} (${fishName}) not found in Objects.json`);
    continue;
  }

  const friendlyId = toKebabCase(fishName);

  // Generate icon path - replace spaces with underscores to match file naming
  const iconFileName = fishName.replace(/\s+/g, '_') + '.png';

  // Trap fish have a different format than regular fish
  if (isTrapFish) {
    // Trap format: Name/trap/chance/junkItems/waterType/minSize/maxSize/isJunk
    // Example: "Clam/trap/.15/681 .35/ocean/1/5/false"
    fishData.push({
      type: 'fish',
      id: friendlyId,
      gameId: gameIdValue,
      name: fishName,
      icon: `assets/fish/${iconFileName}`,
      difficulty: 0, // Crab pots don't have difficulty
      behaviorType: 'trap',
      minSize: parseInt(parts[5], 10) || 0,
      maxSize: parseInt(parts[6], 10) || 0,
      times: [], // Crab pots work 24/7
      seasons: [], // Crab pots work year-round
      weather: 'both', // Crab pots work in all weather
      isTrapFish: true,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      category: objectData.Category || 0,
      contextTags: objectData.ContextTags || [],
      bundles: [],
      gifts: {}
    });
  } else {
    // Regular fish format: Name/Difficulty/BehaviorType/MinSize/MaxSize/Times/Seasons/Weather/...
    // Parse times
    let timeRanges = [];
    if (parts[5]) {
      const times = parts[5].split(' ');
      for (let i = 0; i < times.length; i += 2) {
        if (times[i] && times[i + 1]) {
          timeRanges.push({
            start: times[i],
            end: times[i + 1]
          });
        }
      }
    }

    fishData.push({
      type: 'fish',
      id: friendlyId,
      gameId: gameIdValue,
      name: fishName,
      icon: `assets/fish/${iconFileName}`,
      difficulty: parseInt(parts[1], 10) || 0,
      behaviorType: parts[2] || 'mixed',
      minSize: parseInt(parts[3], 10) || 0,
      maxSize: parseInt(parts[4], 10) || 0,
      times: timeRanges,
      seasons: parts[6] ? parts[6].split(' ') : [],
      weather: parts[7] || 'both',
      isTrapFish: false,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      category: objectData.Category || 0,
      contextTags: objectData.ContextTags || [],
      bundles: [],
      gifts: {}
    });
  }
}

console.log(`  Processed ${fishData.length} fish`);

// Add selling locations to fish
fishData.forEach(item => {
  const category = item.originalCategory !== undefined ? item.originalCategory : item.category;
  item.sellingLocations = getSellingLocations(category, shopSellingLocations);
});

// Extract and merge location data
console.log('\nExtracting fish locations...');
const { extractFishLocations } = require('./helpers/extract-fish-locations.cjs');
const extractedData = extractFishLocations();

// Merge locations into fish data
let locationsMerged = 0;
let levelsMerged = 0;

fishData.forEach(fish => {
  const locations = extractedData.locations[fish.gameId];
  if (locations && locations.length > 0) {
    fish.location = locations;
    locationsMerged++;
  }

  const minLevel = extractedData.minFishingLevels[fish.gameId];
  if (minLevel) {
    fish.minFishingLevel = minLevel;
    levelsMerged++;
  }
});

console.log(`  ✅ Merged locations for ${locationsMerged}/${fishData.length} fish`);
console.log(`  ✅ Merged fishing level requirements for ${levelsMerged}/${fishData.length} fish`);

if (locationsMerged < fishData.length) {
  const missingLocations = fishData.filter(f => !f.location || f.location.length === 0);
  console.warn(`  ⚠️  ${missingLocations.length} fish missing locations:`);
  missingLocations.forEach(f => console.warn(`    - ${f.name} (Game ID: ${f.gameId})`));
}

// Generate special case notes
console.log('\nGenerating special case notes...');
const { generateSpecialCases } = require('./helpers/generate-special-cases.cjs');
const specialCaseNotes = generateSpecialCases();

// Merge special case notes into fish data
let notesMerged = 0;
specialCaseNotes.forEach((note, fishId) => {
  const fish = fishData.find(f => f.gameId === fishId);
  if (fish) {
    fish.notes = note;
    notesMerged++;
  }
});

console.log(`  ✅ Generated notes for ${notesMerged} fish with location variations`);

// ============================================================================
// Curate dual-role items (items that appear in both fish and forage contexts)
// ============================================================================
console.log('\nCurating dual-role items...');

fishData.forEach(fish => {
  if (DUAL_ROLE_ITEMS.includes(fish.gameId)) {
    // For fish context, mark that this item also exists as forage
    fish.alsoAvailableAs = {
      type: 'forage',
      id: fish.id, // Same friendly ID
      context: 'Beach foraging'
    };

    // Override category display for fish context - it's primarily a fish/crab pot catch
    // Category -4 (Fish) is correct for this context
  }
});

console.log(`  ✅ Marked ${DUAL_ROLE_ITEMS.length} dual-role items in fish data`);

// ============================================================================
// Add Roe as flavored artisan item (using fish data)
// ============================================================================
console.log('\nAdding Roe variants...');

// Helper function to calculate roe price from fish price using formula from rules
function calculateRoePrice(fishPrice) {
  // Formula from roe-mechanics.json: "(fishPrice / 2) + 30"
  // Parse and evaluate to keep formula in sync with data file
  return Math.floor((fishPrice / 2) + 30);
}

// Helper function to calculate aged roe price from roe price
function calculateAgedRoePrice(roePrice) {
  // Formula from roe-mechanics.json: "roePrice * 2"
  return roePrice * 2;
}

// Filter fish that can produce roe (have fish_has_roe tag in Objects.json)
// As of 1.6.9, legendary fish CAN be put in fish ponds
const fishWithRoe = fishData.filter(fish => {
  const objectData = gameData.objects[fish.gameId];
  return objectData?.ContextTags?.includes('fish_has_roe');
});

// Calculate roe values for each fish using formula from rules
const roeInputDetails = fishWithRoe.map(fish => {
  const roePrice = calculateRoePrice(fish.price);
  return {
    inputId: fish.id,
    inputName: fish.name,
    inputGameId: fish.gameId,
    inputBasePrice: fish.price,
    inputCategory: -4, // Fish category
    inputType: 'fish',
    outputPrice: roePrice,
    outputIridiumPrice: Math.floor(roePrice * rules.qualityMultipliers.artisanProfession)
  };
}).sort((a, b) => b.outputPrice - a.outputPrice);

const roeObjectData = gameData.objects['812'];

const roeItem = {
  id: 'roe',
  gameId: 812,
  name: 'Roe',
  category: roeObjectData?.Category || -26,
  price: roeObjectData?.Price || 30,
  edibility: roeObjectData?.Edibility || 20,
  icon: 'assets/artisan/Roe.png',
  contextTags: roeObjectData?.ContextTags || [],
  producedBy: {
    machine: 'Fish Pond',
    machineId: 'fish-pond',
    inputType: 'fish',
    processingTimeMinutes: rules.roeMechanics.roe.processingTimeMinutes,
    valueFormula: rules.roeMechanics.roe.formula,
    inputDetails: roeInputDetails
  },
  bundles: [],
  gifts: {}
};

artisanData.push(roeItem);
console.log(`  ✅ Added Roe with ${fishWithRoe.length} fish variants`);

// ============================================================================
// Add Aged Roe variants (Roe processed in Preserves Jar)
// ============================================================================
console.log('\nAdding Aged Roe variants...');

// Aged Roe is made by putting Roe in a Preserves Jar (except Sturgeon Roe → Caviar)
const sturgeonGameId = rules.roeMechanics.caviar.inputFish;
const fishWithAgedRoe = fishWithRoe.filter(fish => fish.gameId !== sturgeonGameId); // Exclude Sturgeon (becomes Caviar)

// Calculate aged roe values using formulas from rules
const agedRoeInputDetails = fishWithAgedRoe.map(fish => {
  const roePrice = calculateRoePrice(fish.price);
  const agedRoePrice = calculateAgedRoePrice(roePrice);

  return {
    inputId: fish.id,
    inputName: fish.name,
    inputGameId: fish.gameId,
    inputBasePrice: roePrice, // Input is the roe price
    inputCategory: -4, // Fish category (actual input is roe, but source is fish)
    inputType: 'fish',
    outputPrice: agedRoePrice,
    outputIridiumPrice: Math.floor(agedRoePrice * rules.qualityMultipliers.artisanProfession)
  };
}).sort((a, b) => b.outputPrice - a.outputPrice);

const agedRoeObjectData = gameData.objects['447'];

const agedRoeItem = {
  id: 'aged-roe',
  gameId: 447,
  name: 'Aged Roe',
  category: agedRoeObjectData?.Category || -26,
  price: agedRoeObjectData?.Price || 100,
  edibility: agedRoeObjectData?.Edibility || 40,
  icon: 'assets/artisan/AgedRoe.png',
  contextTags: agedRoeObjectData?.ContextTags || [],
  producedBy: {
    machine: rules.roeMechanics.agedRoe.producedBy,
    machineId: 'preserves-jar',
    inputType: rules.roeMechanics.agedRoe.inputType,
    processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
    valueFormula: rules.roeMechanics.agedRoe.formula,
    inputDetails: agedRoeInputDetails
  },
  bundles: [],
  gifts: {}
};

artisanData.push(agedRoeItem);
console.log(`  ✅ Added Aged Roe with ${fishWithAgedRoe.length} fish variants (excludes Sturgeon)`);

// Add selling locations to all artisan items
console.log('\nAdding selling locations to artisan items...');
artisanData.forEach(item => {
  item.sellingLocations = getSellingLocations(item.category, shopSellingLocations);
});
console.log(`  ✅ Added selling locations to ${artisanData.length} artisan items`);

// Process NPCs/Villagers
console.log('\nProcessing villagers...');
const villagerData = [];

// Common villagers (from existing data or hardcoded list)
const villagers = [
  'Abigail', 'Alex', 'Elliott', 'Emily', 'Haley', 'Harvey', 'Leah', 'Maru',
  'Penny', 'Sam', 'Sebastian', 'Shane', 'Caroline', 'Clint', 'Demetrius',
  'Dwarf', 'Evelyn', 'George', 'Gus', 'Jas', 'Jodi', 'Kent', 'Krobus',
  'Leo', 'Lewis', 'Linus', 'Marnie', 'Pam', 'Pierre', 'Robin', 'Sandy',
  'Vincent', 'Willy', 'Wizard'
];

for (const name of villagers) {
  const friendlyId = toKebabCase(name);
  villagerData.push({
    type: 'villager',
    id: friendlyId,
    name: name,
    icon: `assets/villagers/${name}.png`
  });
}

console.log(`  Processed ${villagerData.length} villagers`);

// Process Gift Tastes
console.log('\nProcessing gift tastes...');
let giftCount = 0;

// First, parse universal tastes
const universalTastes = {};
['Universal_Love', 'Universal_Like', 'Universal_Neutral', 'Universal_Dislike', 'Universal_Hate'].forEach(key => {
  const preference = key.replace('Universal_', '').toLowerCase();
  const tastes = gameData.npcGiftTastes[key];
  if (tastes) {
    universalTastes[preference] = tastes.split(' ').filter(Boolean);
  }
});

// Helper function to check if item matches a preference list
function matchesPreference(item, entries) {
  const itemGameId = item.gameId.toString();

  // Check for direct ID match
  if (entries.includes(itemGameId)) return true;

  // Check for category match (negative numbers are categories)
  if (item.category !== undefined) {
    if (entries.includes(item.category.toString())) return true;
  }

  // Check for context tag match
  if (item.contextTags && item.contextTags.length > 0) {
    for (const entry of entries) {
      if (isNaN(entry) && item.contextTags.includes(entry)) return true;
    }
  }

  return false;
}

// Helper to check if item has an explicit ID match (not category/tag)
function hasExplicitMatch(item, entries) {
  const itemGameId = item.gameId.toString();
  return entries.includes(itemGameId);
}

// Helper function to process gift tastes for an item
function processGiftTastes(item, npcGiftTastes) {
  let matchCount = 0;

  // Get list of all NPCs (excluding Universal_ entries)
  const npcNames = Object.keys(npcGiftTastes).filter(name =>
    !name.startsWith('Universal_') && typeof npcGiftTastes[name] === 'string'
  );

  for (const npcName of npcNames) {
    const npcId = toKebabCase(npcName);
    const tastes = npcGiftTastes[npcName];
    const tasteParts = tastes.split('/');

    // Format: dialogue/love items/dialogue/like items/dialogue/dislike items/dialogue/hate items/dialogue/neutral items/dialogue
    // So items are at: 1 (love), 3 (like), 5 (dislike), 7 (hate), 9 (neutral)
    const npcPreferences = [
      { index: 1, name: 'love' },
      { index: 3, name: 'like' },
      { index: 9, name: 'neutral' },
      { index: 5, name: 'dislike' },
      { index: 7, name: 'hate' }
    ];

    // Check NPC-specific preferences first (these override universal)
    // BUT: prioritize explicit ID matches over category matches
    // This handles cases like: Carp (142) is in Universal_Hate, but -4 (all fish) is in Universal_Dislike
    // NPCs with -4 in dislike shouldn't override the specific 142 in hate
    let found = false;

    // First pass: check for explicit ID matches only
    for (const pref of npcPreferences) {
      const items = tasteParts[pref.index];
      if (items) {
        const entries = items.split(' ').filter(Boolean);
        if (hasExplicitMatch(item, entries)) {
          item.gifts[npcId] = pref.name;
          matchCount++;
          found = true;
          break;
        }
      }
    }

    // Second pass: if no explicit match, check category/tag matches
    // BUT: don't let category matches override stronger universal preferences
    // Example: -4 (fish) in NPC dislike shouldn't override Carp (142) in Universal_Hate
    if (!found) {
      for (const pref of npcPreferences) {
        const items = tasteParts[pref.index];
        if (items) {
          const entries = items.split(' ').filter(Boolean);
          // Check if this is a category/tag match (not explicit ID)
          const isCategoryMatch = matchesPreference(item, entries) && !hasExplicitMatch(item, entries);

          if (isCategoryMatch) {
            // Before using this category match, check if item has explicit ID in a stronger universal preference
            const strongerUniversalExists = (() => {
              if (pref.name === 'dislike') {
                // Check if item is explicitly in Universal_Hate
                return hasExplicitMatch(item, universalTastes['hate'] || []);
              }
              return false; // No other cases need checking currently
            })();

            if (!strongerUniversalExists) {
              item.gifts[npcId] = pref.name;
              matchCount++;
              found = true;
              break;
            }
          }
        }
      }
    }

    // If no NPC-specific preference, apply universal tastes
    // Check in order from strongest to weakest preference
    if (!found) {
      const universalPreferences = ['love', 'hate', 'like', 'dislike', 'neutral'];
      for (const pref of universalPreferences) {
        if (universalTastes[pref] && matchesPreference(item, universalTastes[pref])) {
          item.gifts[npcId] = pref;
          matchCount++;
          break;
        }
      }
    }
  }

  return matchCount;
}

// Process gift tastes for fish
for (const fish of fishData) {
  giftCount += processGiftTastes(fish, gameData.npcGiftTastes);
}

// Process gift tastes for crops
for (const crop of cropData) {
  giftCount += processGiftTastes(crop, gameData.npcGiftTastes);
}

// Process gift tastes for artisan items
for (const artisan of artisanData) {
  giftCount += processGiftTastes(artisan, gameData.npcGiftTastes);
}

// Process gift tastes for forage items
for (const forage of forageData) {
  giftCount += processGiftTastes(forage, gameData.npcGiftTastes);
}

// Process gift tastes for fruit tree items
for (const fruitTree of fruitTreeData) {
  giftCount += processGiftTastes(fruitTree, gameData.npcGiftTastes);
}

// Process gift tastes for tree fruits
for (const fruit of treeFruitsData) {
  giftCount += processGiftTastes(fruit, gameData.npcGiftTastes);
}

// Process gift tastes for minerals
for (const mineral of mineralData) {
  giftCount += processGiftTastes(mineral, gameData.npcGiftTastes);
}

// Process gift tastes for metal bars
for (const metalBar of metalBarData) {
  giftCount += processGiftTastes(metalBar, gameData.npcGiftTastes);
}

// Process gift tastes for monster loot
for (const monsterLoot of monsterLootData) {
  giftCount += processGiftTastes(monsterLoot, gameData.npcGiftTastes);
}

// Process gift tastes for resources
for (const resource of resourceData) {
  giftCount += processGiftTastes(resource, gameData.npcGiftTastes);
}

console.log(`  Processed ${giftCount} gift preferences`);

// Process Bundles
console.log('\nProcessing bundles...');
const bundleIcons = loadJson(path.join(RULES_DIR, 'bundle-icons.json'));
const bundleData = [];

for (const [bundleKey, bundleInfo] of Object.entries(gameData.bundles)) {
  if (typeof bundleInfo !== 'string') continue;

  // Bundle format: "Name/Reward/Items/Color/MinItems"
  const parts = bundleInfo.split('/');
  const bundleName = parts[0];
  const reward = parts[1];
  const itemsString = parts[2];
  const minItems = parseInt(parts[4], 10) || null;

  const friendlyId = toKebabCase(bundleName);

  // Parse items
  const items = [];
  if (itemsString) {
    // Items are space-separated triplets: "itemId quantity quality itemId quantity quality..."
    const itemParts = itemsString.split(' ');
    for (let i = 0; i < itemParts.length; i += 3) {
      const itemId = parseInt(itemParts[i], 10);
      const quantity = parseInt(itemParts[i + 1], 10) || 1;
      const quality = parseInt(itemParts[i + 2], 10) || 0;

      const itemObject = gameData.objects[itemId];
      if (itemObject) {
        items.push({
          id: toKebabCase(itemObject.Name),
          gameId: itemId,
          quantity: quantity,
          quality: quality
        });

        // Add bundle reference to fish if it's a fish
        const fish = fishData.find(f => f.gameId === itemId);
        if (fish && !fish.bundles.includes(friendlyId)) {
          fish.bundles.push(friendlyId);
        }

        // Add bundle reference to crops
        const crop = cropData.find(c => c.gameId === itemId);
        if (crop && !crop.bundles.includes(friendlyId)) {
          crop.bundles.push(friendlyId);
        }

        // Add bundle reference to artisan items
        const artisan = artisanData.find(a => a.gameId === itemId);
        if (artisan && !artisan.bundles.includes(friendlyId)) {
          artisan.bundles.push(friendlyId);
        }

        // Add bundle reference to forage items
        const forage = forageData.find(f => f.gameId === itemId);
        if (forage && !forage.bundles.includes(friendlyId)) {
          forage.bundles.push(friendlyId);
        }

        // Add bundle reference to fruit tree items (searches by fruit output ID)
        const fruitTree = fruitTreeData.find(f => f.fruitGameId === itemId);
        if (fruitTree && !fruitTree.bundles.includes(friendlyId)) {
          fruitTree.bundles.push(friendlyId);
        }

        // Add bundle reference to tree fruits (the fruit items themselves)
        const treeFruit = treeFruitsData.find(f => f.gameId === itemId);
        if (treeFruit && !treeFruit.bundles.includes(friendlyId)) {
          treeFruit.bundles.push(friendlyId);
        }

        // Add bundle reference to minerals
        const mineral = mineralData.find(m => m.gameId === itemId);
        if (mineral && !mineral.bundles.includes(friendlyId)) {
          mineral.bundles.push(friendlyId);
        }

        // Add bundle reference to metal bars
        const metalBar = metalBarData.find(m => m.gameId === itemId);
        if (metalBar && !metalBar.bundles.includes(friendlyId)) {
          metalBar.bundles.push(friendlyId);
        }

        // Add bundle reference to monster loot
        const monsterLoot = monsterLootData.find(m => m.gameId === itemId);
        if (monsterLoot && !monsterLoot.bundles.includes(friendlyId)) {
          monsterLoot.bundles.push(friendlyId);
        }

        // Add bundle reference to resources
        const resource = resourceData.find(r => r.gameId === itemId);
        if (resource && !resource.bundles.includes(friendlyId)) {
          resource.bundles.push(friendlyId);
        }
      }
    }
  }

  // Get icon color from rules
  const iconColor = bundleIcons[friendlyId] || 'green';
  const icon = `assets/bundles/Bundle_${iconColor.charAt(0).toUpperCase() + iconColor.slice(1)}.png`;

  bundleData.push({
    id: friendlyId,
    name: bundleName,
    icon: icon,
    reward: reward,
    items: items,
    minItemsRequired: minItems
  });
}

console.log(`  Processed ${bundleData.length} bundles`);

// Write source files
console.log('\nWriting source files...');

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/fish.json'),
  JSON.stringify(fishData, null, 2)
);
console.log(`  ✓ Wrote items/fish.json (${fishData.length} fish)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/artisan.json'),
  JSON.stringify(artisanData, null, 2)
);
console.log(`  ✓ Wrote items/artisan.json (${artisanData.length} artisan goods)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/crops.json'),
  JSON.stringify(cropData, null, 2)
);
console.log(`  ✓ Wrote items/crops.json (${cropData.length} crops)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/forage.json'),
  JSON.stringify(forageData, null, 2)
);
console.log(`  ✓ Wrote items/forage.json (${forageData.length} foraged items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/fruit-trees.json'),
  JSON.stringify(fruitTreeData, null, 2)
);
console.log(`  ✓ Wrote items/fruit-trees.json (${fruitTreeData.length} fruit trees)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/tree-fruits.json'),
  JSON.stringify(treeFruitsData, null, 2)
);
console.log(`  ✓ Wrote items/tree-fruits.json (${treeFruitsData.length} tree fruits)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/minerals.json'),
  JSON.stringify(mineralData, null, 2)
);
console.log(`  ✓ Wrote items/minerals.json (${mineralData.length} minerals)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/metal-bars.json'),
  JSON.stringify(metalBarData, null, 2)
);
console.log(`  ✓ Wrote items/metal-bars.json (${metalBarData.length} metal bars)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/monster-loot.json'),
  JSON.stringify(monsterLootData, null, 2)
);
console.log(`  ✓ Wrote items/monster-loot.json (${monsterLootData.length} monster loot items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/resources.json'),
  JSON.stringify(resourceData, null, 2)
);
console.log(`  ✓ Wrote items/resources.json (${resourceData.length} resources)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/big-craftables.json'),
  JSON.stringify(bigCraftableData, null, 2)
);
console.log(`  ✓ Wrote items/big-craftables.json (${bigCraftableData.length} big craftables)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'reference/villagers.json'),
  JSON.stringify(villagerData, null, 2)
);
console.log(`  ✓ Wrote reference/villagers.json (${villagerData.length} villagers)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'collections/bundles.json'),
  JSON.stringify(bundleData, null, 2)
);
console.log(`  ✓ Wrote collections/bundles.json (${bundleData.length} bundles)`);

// Extract gift relationships into pivot table
console.log('\n📦 Extracting gift relationships...');
const relationshipsMap = new Map();
const allItemTypes = [
  fishData, artisanData, forageData, fruitTreeData, treeFruitsData,
  mineralData, metalBarData, monsterLootData, resourceData, bigCraftableData, cropData
];

let totalItemsWithGifts = 0;
allItemTypes.forEach(items => {
  items.forEach(item => {
    if (!item.gifts || typeof item.gifts !== 'object') {
      return;
    }

    totalItemsWithGifts++;

    Object.entries(item.gifts).forEach(([villagerId, preference]) => {
      if (preference === 'neutral') return;

      const key = `${item.id}:${villagerId}`;
      if (!relationshipsMap.has(key)) {
        relationshipsMap.set(key, [item.id, villagerId, preference]);
      }
    });
  });
});

const relationships = Array.from(relationshipsMap.values());
relationships.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

// Ensure relationships directory exists
const relationshipsDir = path.join(PROCESSED_DIR, 'relationships');
if (!fs.existsSync(relationshipsDir)) {
  fs.mkdirSync(relationshipsDir, { recursive: true });
}

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'relationships/gifts.json'),
  JSON.stringify({
    relationships,
    meta: {
      generated: new Date().toISOString(),
      itemsWithGifts: totalItemsWithGifts,
      totalRelationships: relationships.length
    }
  }, null, 2)
);
console.log(`  ✓ Wrote relationships/gifts.json (${relationships.length} unique relationships)`);

console.log('\n✅ Game data processing complete!');
console.log(`\nSource files created in: ${PROCESSED_DIR}`);

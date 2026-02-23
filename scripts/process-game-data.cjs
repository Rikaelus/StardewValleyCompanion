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

/**
 * For any items in the array that share the same id, append -gameId to all of them.
 * Mutates the array in place. Called after a full type's items have been collected.
 */
function deduplicateIds(items) {
  const countById = new Map();
  for (const item of items) {
    countById.set(item.id, (countById.get(item.id) || 0) + 1);
  }
  for (const item of items) {
    if (countById.get(item.id) > 1) {
      item.id = `${item.id}-${item.gameId}`;
    }
  }
}

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
function getIconFilename(gameId, itemName, objectData = null) {
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

/**
 * Parse a raw game ID (object key) into an integer if numeric, or keep as string for 1.6+ items.
 * Examples: "136" → 136, "Carrot" → "Carrot", "CarrotSeeds" → "CarrotSeeds"
 */
function parseGameId(rawId) {
  const num = parseInt(rawId, 10);
  return isNaN(num) || String(num) !== String(rawId) ? rawId : num;
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
    'category_seeds': -74,
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
  locations: loadJson(path.join(GAME_EXPORTS_DIR, 'Locations.json')),
  monsters: loadJson(path.join(GAME_EXPORTS_DIR, 'Monsters.json')),
  fishPondData: loadJson(path.join(GAME_EXPORTS_DIR, 'FishPondData.json')),
  garbageCans: loadJson(path.join(GAME_EXPORTS_DIR, 'GarbageCans.json')),
  furniture: loadJson(path.join(GAME_EXPORTS_DIR, 'Furniture.json')),
  hats: loadJson(path.join(GAME_EXPORTS_DIR, 'Hats.json')),
  wildTrees: loadJson(path.join(GAME_EXPORTS_DIR, 'WildTrees.json')),
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
  shops: loadJson(path.join(RULES_DIR, 'shops.json')),
  furnitureNames: loadJson(path.join(RULES_DIR, 'furniture-names.json')).items,
  locations: loadJson(path.join(RULES_DIR, 'locations.json')).locations,
  machineNames: loadJson(path.join(RULES_DIR, 'machine-names.json')).machines,
  smeltingRecipes: loadJson(path.join(RULES_DIR, 'smelting-recipes.json')).recipes,
  bundleRewards: loadJson(path.join(RULES_DIR, 'bundle-rewards.json')).gameIds,
  itemRoles: loadJson(path.join(RULES_DIR, 'item-roles.json')),
  treeNames: loadJson(path.join(RULES_DIR, 'tree-names.json')).trees,
};

console.log(`Loaded ${Object.keys(gameData.objects).length} objects`);
console.log(`Loaded ${Object.keys(gameData.fish).length} fish`);
console.log(`Loaded ${Object.keys(gameData.bundles).length} bundles`);
console.log(`Loaded ${Object.keys(gameData.machines).length} machines`);
console.log(`Loaded ${Object.keys(gameData.farmAnimals).length} farm animals`);

// ---------------------------------------------------------------------------
// Acquisition Sources Infrastructure
// ---------------------------------------------------------------------------
// Build indexes used by buildAcquisitionSources()
console.log('Building acquisition source indexes...');

// shopMap: gameShopId -> friendly storeId
const shopMap = rules.shops.shopMap;

// shopSourcesByGameId: gameId (number|string) -> [{ type:'shop', storeId, price?, tradeItemGameId?, tradeItemAmount?, seasons? }]
const shopSourcesByGameId = new Map();

// furnitureShopSourcesByGameId: gameId (number|string) -> [shop source]
const furnitureShopSourcesByGameId = new Map();

// hatShopSourcesByGameId: gameId (number|string) -> [shop source]
const hatShopSourcesByGameId = new Map();

for (const [shopId, shopData] of Object.entries(gameData.shops)) {
  const storeId = shopMap[shopId];
  if (!storeId) continue;

  for (const item of (shopData.Items || [])) {
    const itemId = item.ItemId;
    if (!itemId) continue;

    // Determine item type prefix and which source map to use
    let rawId;
    let sourceMap = shopSourcesByGameId; // default: Objects

    const furnitureMatch = itemId.match(/^\(F\)(.+)$/);
    const hatMatch = itemId.match(/^\(H\)(.+)$/);
    const objectMatch = itemId.match(/^\(O\)(.+)$/);

    if (furnitureMatch) {
      rawId = furnitureMatch[1];
      sourceMap = furnitureShopSourcesByGameId;
    } else if (hatMatch) {
      rawId = hatMatch[1];
      sourceMap = hatShopSourcesByGameId;
    } else if (objectMatch) {
      rawId = objectMatch[1];
    } else if (gameData.objects[itemId] !== undefined) {
      // Bare string ID with no type prefix — look up directly in Objects.json
      rawId = itemId;
    } else {
      continue;
    }
    const gameId = parseGameId(rawId);

    const storeDetails = rules.shops.storeDetails?.[storeId];
    // Extract NPC vendor name from compound shop IDs like "DesertFestival_Emily"
    const vendorMatch = shopId.match(/^[A-Za-z]+Festival_([A-Z][a-z]+)$/);
    const vendorName = vendorMatch ? vendorMatch[1] : null;
    const baseName = storeDetails?.name ?? storeId;
    const fullName = vendorName ? `${baseName} (${vendorName})` : baseName;
    const source = { type: 'shop', storeId, storeName: fullName, storeBaseName: baseName };

    // Non-gold shop currency (Currency field: 1=StarTokens, 2=QiCoins, 4=QiGems)
    const SHOP_CURRENCIES = { 1: 'star-tokens', 2: 'qi-coins', 4: 'qi-gems' };
    const SHOP_CURRENCY_GAME_IDS = { 1: 'StarToken', 2: 'QiCoin', 4: 858 };
    if (shopData.Currency && SHOP_CURRENCIES[shopData.Currency]) {
      source.shopCurrency = SHOP_CURRENCIES[shopData.Currency];
      source.shopCurrencyGameId = SHOP_CURRENCY_GAME_IDS[shopData.Currency];
    }

    // Price: -1 means use item's default price × shop markup (default 2×)
    if (item.Price > 0) {
      source.price = item.Price;
    } else if (item.Price === -1) {
      let basePrice = gameData.objects[String(rawId)]?.Price ?? gameData.objects[String(gameId)]?.Price;
      // Furniture price is at position 5 in the slash-delimited string
      if (basePrice == null && sourceMap === furnitureShopSourcesByGameId) {
        const furnStr = gameData.furniture[String(rawId)];
        if (furnStr) {
          const furnParts = furnStr.split('/');
          basePrice = parseInt(furnParts[5], 10) || null;
        }
      }
      if (basePrice != null && basePrice > 0) {
        const multiplier = storeDetails?.priceMultiplier ?? 2;
        source.price = Math.floor(basePrice * multiplier);
      }
    }

    // Quantity received per purchase:
    // MinStack > 1 is an explicit per-purchase quantity override.
    // Otherwise, AvailableStock > 1 with no MinStack override means the shop
    // sells its entire stock as a single stack per transaction.
    if (item.MinStack > 1) {
      source.quantity = item.MinStack;
    } else if ((item.MinStack === -1 || item.MinStack == null) && item.AvailableStock > 1) {
      source.quantity = item.AvailableStock;
    }

    // Barter: trade item instead of gold
    if (item.TradeItemId) {
      const tm = item.TradeItemId.match(/^\(O\)(.+)$/);
      const tradeRawId = tm ? tm[1] : item.TradeItemId;
      const tradeGameId = parseGameId(tradeRawId);
      const tradeObj = gameData.objects[String(tradeRawId)] || gameData.objects[String(tradeGameId)];
      source.tradeItemId = tradeObj ? toKebabCase(tradeObj.Name) : String(tradeRawId);
      source.tradeItemGameId = tradeGameId;
      source.tradeItemName = tradeObj?.Name || String(tradeRawId);
      source.tradeItemIcon = tradeObj
        ? `assets/objects/${tradeObj.Name.replace(/\s+/g, '_')}.png`
        : null;
      source.tradeItemAmount = item.TradeItemAmount || 1;
    }

    // Parse Condition field for availability metadata
    if (item.Condition) {
      const cond = item.Condition;

      // SEASON spring summer fall winter
      const seasonMatch = cond.match(/\bSEASON\s+([\w\s]+?)(?:\s*,|$)/i);
      if (seasonMatch) {
        source.seasons = seasonMatch[1].trim().split(/\s+/).map(s => s.toLowerCase());
      }

      // DAY_OF_WEEK Monday Tuesday ...
      const dowMatch = cond.match(/\bDAY_OF_WEEK\s+([\w\s]+?)(?:\s*,|$)/i);
      if (dowMatch) {
        source.days = dowMatch[1].trim().split(/\s+/);
      }

      // YEAR 2  (or !YEAR 2 — negation means only available before that year)
      const yearMatch = cond.match(/(!?)YEAR\s+(\d+)/i);
      if (yearMatch) {
        source.yearUnlock = parseInt(yearMatch[2], 10);
        if (yearMatch[1] === '!') source.yearUnlockBefore = true;
      }

      // DAYS_PLAYED N
      const daysPlayedMatch = cond.match(/\bDAYS_PLAYED\s+(\d+)/i);
      if (daysPlayedMatch) {
        source.daysPlayed = parseInt(daysPlayedMatch[1], 10);
      }

      // PLAYER_HEARTS Current <NpcName> <count>
      const heartsMatch = cond.match(/\bPLAYER_HEARTS\s+Current\s+(\w+)\s+(\d+)/i);
      if (heartsMatch) {
        source.heartsRequired = { npc: heartsMatch[1], count: parseInt(heartsMatch[2], 10) };
      }

      // PLAYER_BASE_FISHING_LEVEL Current N
      const fishingMatch = cond.match(/\bPLAYER_BASE_FISHING_LEVEL\s+Current\s+(\d+)/i);
      if (fishingMatch) {
        source.skillRequired = { skill: 'fishing', level: parseInt(fishingMatch[1], 10) };
      }

      // MINE_LOWEST_LEVEL_REACHED N
      const mineMatch = cond.match(/\bMINE_LOWEST_LEVEL_REACHED\s+(\d+)/i);
      if (mineMatch) {
        source.mineLevel = parseInt(mineMatch[1], 10);
      }

      // SYNCED_RANDOM or SYNCED_CHOICE → rotating stock
      if (/\bSYNCED_(?:RANDOM|CHOICE)\b/i.test(cond)) {
        source.rotating = true;
      }
    }

    // Limited stock / purchase cap — omit if it's already expressed as quantity
    if (item.AvailableStock && item.AvailableStock !== -1 && item.AvailableStock !== source.quantity) {
      source.stock = item.AvailableStock;
    }
    if (item.AvailableStockLimit && item.AvailableStockLimit > 0) {
      source.stockLimit = item.AvailableStockLimit;
    }

    if (!sourceMap.has(gameId)) sourceMap.set(gameId, []);
    sourceMap.get(gameId).push(source);
  }
}

// forageSourcesByGameId: gameId -> [{ type:'forage', location, season? }]
const forageSourcesByGameId = new Map();

// Location name lookup: internal ID -> display name (from rules/locations.json)
function getLocationDisplayName(locId) {
  return rules.locations[locId]?.displayName || locId;
}

const SEASON_INTS = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };

for (const [locId, locData] of Object.entries(gameData.locations)) {
  const displayName = getLocationDisplayName(locId);

  for (const entry of (locData.Forage || [])) {
    const itemId = entry.ItemId;
    if (!itemId) continue;
    const m = itemId.match(/^\(O\)(.+)$/);
    if (!m) continue;
    const gameId = parseGameId(m[1]);

    const source = { type: 'forage', location: displayName };

    // Season from integer field
    if (entry.Season !== null && entry.Season !== undefined) {
      source.season = SEASON_INTS[entry.Season] || null;
    }
    // Season from Condition string e.g. "LOCATION_SEASON Here spring summer fall"
    if (!source.season && entry.Condition) {
      const sm = entry.Condition.match(/LOCATION_SEASON\s+\S+\s+([\w\s]+?)(?:\s*$)/i);
      if (sm) source.seasons = sm[1].trim().split(/\s+/).map(s => s.toLowerCase());
    }

    if (!forageSourcesByGameId.has(gameId)) forageSourcesByGameId.set(gameId, []);
    forageSourcesByGameId.get(gameId).push(source);
  }
}

// monsterDropsByGameId: gameId -> [{ type:'monster-drop', monster, chance }]
const monsterDropsByGameId = new Map();

for (const [monsterName, rawData] of Object.entries(gameData.monsters)) {
  const parts = rawData.split('/');
  const dropsStr = parts[6] || '';
  const dropParts = dropsStr.trim().split(/\s+/).filter(Boolean);

  for (let i = 0; i + 1 < dropParts.length; i += 2) {
    const gameId = parseGameId(dropParts[i]);
    const chance = parseFloat(dropParts[i + 1]);
    if (isNaN(chance)) continue;

    if (!monsterDropsByGameId.has(gameId)) monsterDropsByGameId.set(gameId, []);
    // Accumulate chance across multiple entries for same item+monster (game adds them)
    const existing = monsterDropsByGameId.get(gameId).find(d => d.monster === monsterName);
    if (existing) {
      existing.chance = Math.min(1, existing.chance + chance);
    } else {
      monsterDropsByGameId.get(gameId).push({ type: 'monster-drop', monster: monsterName, chance });
    }
  }
}

// fishPondSourcesByGameId: produces gameId -> [{ type:'fish-pond', fishTag, minPopulation, chance }]
const fishPondSourcesByGameId = new Map();

for (const pondEntry of gameData.fishPondData) {
  const fishTag = pondEntry.RequiredTags?.[0] || pondEntry.Id;

  for (const produced of (pondEntry.ProducedItems || [])) {
    const itemId = produced.ItemId;
    if (!itemId) continue;
    const m = itemId.match(/^\(O\)(.+)$/);
    if (!m) continue;
    const gameId = parseGameId(m[1]);

    const source = {
      type: 'fish-pond',
      fishTag,
      minPopulation: produced.RequiredPopulation || 1,
      chance: produced.Chance,
    };

    if (!fishPondSourcesByGameId.has(gameId)) fishPondSourcesByGameId.set(gameId, []);
    fishPondSourcesByGameId.get(gameId).push(source);
  }
}

// garbageCanSourcesByGameId: gameId -> [{ type:'garbage-can', location }]
const garbageCanSourcesByGameId = new Map();

for (const [canId, canData] of Object.entries(gameData.garbageCans.GarbageCans || {})) {
  for (const item of (canData.Items || [])) {
    // Items may have RandomItemId array or a single ItemId
    const ids = item.RandomItemId
      ? item.RandomItemId
      : (item.ItemId ? [item.ItemId] : []);

    for (const itemId of ids) {
      const m = itemId && itemId.match(/^\(O\)(.+)$/);
      if (!m) continue;
      const gameId = parseGameId(m[1]);

      if (!garbageCanSourcesByGameId.has(gameId)) garbageCanSourcesByGameId.set(gameId, []);
      const existing = garbageCanSourcesByGameId.get(gameId);
      if (!existing.find(s => s.location === canId)) {
        existing.push({ type: 'garbage-can', location: canId });
      }
    }
  }
}

// tillingSourcesByGameId: gameId -> [{ type:'tilling', locations: string[] }]
// Parses ArtifactSpots from Locations.json. Farm_* variants are collapsed to "Farm".
// "Default" means all outdoor areas. LOST_BOOK_OR_ITEM prefix is stripped (item still drops).
const tillingSourcesByGameId = new Map();

{
  // Locations to skip (interiors, instanced, or too generic)
  const SKIP_TILLING = new Set(['FarmHouse', 'FarmCave']);
  // Collapse all Farm_* variants to one display name
  const tillingLocName = (locId) => {
    if (locId.startsWith('Farm_')) return 'Farm';
    if (locId === 'Default') return 'All outdoor areas';
    return getLocationDisplayName(locId);
  };

  for (const [locId, locData] of Object.entries(gameData.locations)) {
    if (SKIP_TILLING.has(locId)) continue;
    const displayName = tillingLocName(locId);

    for (const entry of (locData.ArtifactSpots || [])) {
      let itemId = entry.ItemId;
      if (!itemId) continue;
      // Strip LOST_BOOK_OR_ITEM prefix — the item still drops alongside a lost book
      if (itemId.startsWith('LOST_BOOK_OR_ITEM ')) {
        itemId = itemId.slice('LOST_BOOK_OR_ITEM '.length);
      }
      // Skip non-object entries like RANDOM_ARTIFACT_FOR_DIG_SPOT
      const m = itemId.match(/^\(O\)(.+)$/);
      if (!m) continue;
      const gameId = parseGameId(m[1]);

      if (!tillingSourcesByGameId.has(gameId)) tillingSourcesByGameId.set(gameId, []);
      const existing = tillingSourcesByGameId.get(gameId);
      // Deduplicate by display name (Farm_Standard, Farm_Beach etc. all become "Farm")
      if (!existing.find(s => s.location === displayName)) {
        existing.push({ type: 'tilling', location: displayName, chance: entry.Chance });
      }
    }
  }
}

// craftingSourcesByGameId: output gameId -> [{ type:'crafting', recipeName, ingredients: [{gameId, amount}] }]
// Parses CraftingRecipes.json format: "ingredients/field/outputId count/isBigCraftable/skillReq/displayName"
const craftingSourcesByGameId = new Map();

{
  const craftingRecipes = loadJson(path.join(GAME_EXPORTS_DIR, 'CraftingRecipes.json'));
  for (const [recipeName, val] of Object.entries(craftingRecipes)) {
    const parts = val.split('/');
    if (parts.length < 3) continue;
    const outputPart = parts[2].trim();
    // outputPart is either "id" or "id count"
    const [outputIdStr, outputCountStr] = outputPart.split(' ');
    const outputGameId = parseGameId(outputIdStr);
    if (!outputGameId && outputGameId !== 0) continue;

    // Parse ingredients: "id count id count ..."
    const ingredientTokens = parts[0].trim().split(/\s+/);
    const ingredients = [];
    for (let i = 0; i < ingredientTokens.length - 1; i += 2) {
      const ingId = parseGameId(ingredientTokens[i]);
      const ingAmount = parseInt(ingredientTokens[i + 1], 10) || 1;
      if (ingId !== null && ingId !== undefined) {
        ingredients.push({ gameId: ingId, amount: ingAmount });
      }
    }

    const source = {
      type: 'crafting',
      recipeName,
      outputCount: parseInt(outputCountStr, 10) || 1,
      ingredients,
    };

    if (!craftingSourcesByGameId.has(outputGameId)) craftingSourcesByGameId.set(outputGameId, []);
    craftingSourcesByGameId.get(outputGameId).push(source);
  }
}

console.log(`  ✓ Shop sources: ${shopSourcesByGameId.size} object items`);
console.log(`  ✓ Furniture shop sources: ${furnitureShopSourcesByGameId.size} furniture items`);
console.log(`  ✓ Hat shop sources: ${hatShopSourcesByGameId.size} hat items`);
console.log(`  ✓ Forage sources: ${forageSourcesByGameId.size} items`);
console.log(`  ✓ Monster drop sources: ${monsterDropsByGameId.size} items`);
console.log(`  ✓ Fish pond sources: ${fishPondSourcesByGameId.size} items`);
console.log(`  ✓ Garbage can sources: ${garbageCanSourcesByGameId.size} items`);
console.log(`  ✓ Tilling sources: ${tillingSourcesByGameId.size} items`);
console.log(`  ✓ Crafting sources: ${craftingSourcesByGameId.size} items`);

// tapperSourcesByGameId: gameId -> [{ type:'tapper', treeName, treeId, daysToHarvest }]
// Parsed from WildTrees.json — each tree's TapItems list points to the item produced.
const tapperSourcesByGameId = new Map();

for (const [treeNumId, treeData] of Object.entries(gameData.wildTrees)) {
  const treeInfo = rules.treeNames[treeNumId];
  if (!treeInfo) continue; // unnamed/unmapped tree, skip

  for (const tapItem of (treeData.TapItems || [])) {
    if (!tapItem.ItemId || tapItem.ItemId === 'PREVIOUS_OUTPUT_ID') continue;
    const rawId = tapItem.ItemId.replace(/^\(O\)/, '');
    const gameId = parseGameId(rawId);
    const source = {
      type: 'tapper',
      treeName: treeInfo.name,
      treeId: treeInfo.id,
      daysToHarvest: tapItem.DaysUntilReady || null,
    };
    if (!tapperSourcesByGameId.has(gameId)) tapperSourcesByGameId.set(gameId, []);
    // Deduplicate: same tree can appear multiple times in TapItems with PREVIOUS_OUTPUT_ID chaining
    const existing = tapperSourcesByGameId.get(gameId);
    if (!existing.find(s => s.treeId === treeInfo.id)) {
      existing.push(source);
    }
  }
}

console.log(`  ✓ Tapper sources: ${tapperSourcesByGameId.size} items`);

/**
 * Build the unified acquisition sources array for an item.
 * @param {number|string} gameId - The item's numeric or string game ID
 * @param {object} [opts]
 * @param {boolean} [opts.includeShop=true]
 * @param {boolean} [opts.includeForage=true]
 * @param {boolean} [opts.includeMonsterDrop=true]
 * @param {boolean} [opts.includeFishPond=true]
 * @param {boolean} [opts.includeGarbageCan=false]  - off by default (noise)
 * @param {boolean} [opts.includeTilling=false]      - off by default
 * @param {boolean} [opts.includeCrafting=false]     - off by default
 * @param {boolean} [opts.includeTapper=false]       - off by default
 */
function buildAcquisitionSources(gameId, opts = {}) {
  const {
    includeShop = true,
    includeForage = true,
    includeMonsterDrop = true,
    includeFishPond = true,
    includeGarbageCan = false,
    includeTilling = false,
    includeCrafting = false,
    includeTapper = false,
  } = opts;

  const sources = [];
  if (includeShop && shopSourcesByGameId.has(gameId)) {
    sources.push(...shopSourcesByGameId.get(gameId));
  }
  if (includeForage && forageSourcesByGameId.has(gameId)) {
    sources.push(...forageSourcesByGameId.get(gameId));
  }
  if (includeMonsterDrop && monsterDropsByGameId.has(gameId)) {
    sources.push(...monsterDropsByGameId.get(gameId));
  }
  if (includeFishPond && fishPondSourcesByGameId.has(gameId)) {
    sources.push(...fishPondSourcesByGameId.get(gameId));
  }
  if (includeGarbageCan && garbageCanSourcesByGameId.has(gameId)) {
    sources.push(...garbageCanSourcesByGameId.get(gameId));
  }
  if (includeTilling && tillingSourcesByGameId.has(gameId)) {
    sources.push(...tillingSourcesByGameId.get(gameId));
  }
  if (includeCrafting && craftingSourcesByGameId.has(gameId)) {
    sources.push(...craftingSourcesByGameId.get(gameId));
  }
  if (includeTapper && tapperSourcesByGameId.has(gameId)) {
    sources.push(...tapperSourcesByGameId.get(gameId));
  }
  return sources;
}

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

  const seedGameId = parseGameId(seedId);
  const seedObject = gameData.objects[seedId];
  const seedName = seedObject?.Name || `${cropName} Seeds`;

  const cropEntry = {
    id: toKebabCase(cropName),
    gameId: parseGameId(harvestId),
    name: cropName,
    icon: `assets/objects/${cropName.replace(/ /g, '_')}.png`,
    type: cropType,
    category: category,
    price: harvestObject.Price || 0,
    edibility: harvestObject.Edibility || -300,
    seasons: isSeasonIndependent ? [] : seasons,  // Clear seasons if only growable in season-independent locations
    growthDays: growthDays,
    regrowDays: regrowDays > 0 ? regrowDays : null,
    maxQuality: cropInfo.HarvestMaxQuality ?? 2,
    notes: plantingNotes,
    seedSource: {
      type: 'seed',
      seedId: toKebabCase(seedName),
      seedGameId,
      seedName,
      growthDays,
      regrowDays: regrowDays > 0 ? regrowDays : null,
    },
    bundles: [],
    gifts: {}
  };

  cropData.push(cropEntry);
  cropsByHarvestId.set(parseGameId(harvestId), cropEntry);
}

console.log(`  Processed ${cropData.length} crops`);
console.log(`    Fruits: ${cropData.filter(c => c.type === 'fruit').length}`);
console.log(`    Vegetables: ${cropData.filter(c => c.type === 'vegetable').length}`);
console.log(`    Flowers: ${cropData.filter(c => c.type === 'flower').length}`);

// Add selling locations and acquisition sources to crops
cropData.forEach(item => {
  item.sellingLocations = getSellingLocations(item.category, shopSellingLocations);
  const seedSource = item.seedSource;
  delete item.seedSource;
  item.sources = [
    seedSource,
    ...buildAcquisitionSources(item.gameId, { includeForage: false, includeMonsterDrop: false, includeFishPond: false }),
  ];
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
  const locationName = `Mines (Floors ${mineForage.floors})`;
  data.locations.add(locationName);
  // No seasons for mines - available year-round

  // Also add to forageSourcesByGameId so it appears in structured sources
  if (!forageSourcesByGameId.has(mineForage.gameId)) forageSourcesByGameId.set(mineForage.gameId, []);
  forageSourcesByGameId.get(mineForage.gameId).push({ type: 'forage', location: locationName });
}

// Filter items with forage_item context tag (plus special cases)
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  const itemGameId = parseGameId(gameId);
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
    icon: `assets/objects/${objectData.Name.replace(/\s+/g, '_')}.png`,
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

// Add selling locations and acquisition sources to forage
forageData.forEach(item => {
  const category = item.originalCategory !== undefined ? item.originalCategory : item.category;
  item.sellingLocations = getSellingLocations(category, shopSellingLocations);
  item.sources = buildAcquisitionSources(item.gameId, { includeShop: false, includeFishPond: false });
});


// Merge forage sources into crops that also appear as forage (e.g. Grape, Wild Horseradish)
const forageItemsByGameId = new Map(forageData.map(f => [f.gameId, f]));
for (const crop of cropData) {
  const forageItem = forageItemsByGameId.get(crop.gameId);
  if (!forageItem) continue;
  const forageSources = (forageItem.sources || []).filter(s => s.type === 'forage');
  if (forageSources.length > 0) {
    crop.sources.push(...forageSources);
  }
}

// Curate dual-role items in forage context
console.log('\nCurating dual-role forage items...');

forageData.forEach(item => {
  if (rules.itemRoles.dualRoleItems.gameIds.includes(item.gameId)) {
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

console.log(`  ✅ Curated ${rules.itemRoles.dualRoleItems.gameIds.length} dual-role items in forage data`);

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

  const treeGameId = parseGameId(treeId);
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
    icon: `assets/objects/${fruitName.replace(/\s+/g, '_')}.png`,
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

  const itemGameId = parseGameId(gameId);
  const friendlyId = toKebabCase(objectData.Name);

  // Get the season from the fruit tree data (where this fruit comes from)
  const sourceTree = fruitTreeData.find(t => t.fruitGameId === itemGameId);
  const seasons = sourceTree ? sourceTree.seasons : [];

  treeFruitsData.push({
    type: 'tree-fruit',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${objectData.Name.replace(/\s+/g, '_')}.png`,
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

  const itemGameId = parseGameId(gameId);
  const friendlyId = toKebabCase(objectData.Name);
  const mineralType = classifyMineral(objectData.Name, objectData.ContextTags);

  mineralData.push({
    type: 'mineral',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${objectData.Name.replace(/\s+/g, '_')}.png`,
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

  const itemGameId = parseGameId(gameId);
  const friendlyId = toKebabCase(objectData.Name);

  // Determine the ore/input for this bar
  // Most bars follow pattern: "X Bar" comes from "X Ore"
  let producedBy = {
    machine: 'Furnace',
    machineId: 'furnace',
    inputs: []
  };

  if (rules.smeltingRecipes[objectData.Name]) {
    producedBy.inputs = rules.smeltingRecipes[objectData.Name];
  }

  metalBarData.push({
    type: 'metal-bar',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${objectData.Name.replace(/\s+/g, '_')}.png`,
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

  const itemGameId = parseGameId(gameId);
  const friendlyId = toKebabCase(objectData.Name);
  const rarity = classifyMonsterLootRarity(objectData.Name, objectData.Price);

  monsterLootData.push({
    type: 'monster-loot',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${objectData.Name.replace(/\s+/g, '_')}.png`,
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

// String-keyed items used as trade currencies (not reachable via numeric ID lookup)
const stringKeyedResourceIds = ['CalicoEgg', 'Moss'];

for (const id of [...resourceIds, ...stringKeyedResourceIds]) {
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
    icon: `assets/objects/${objectData.Name.replace(/\s+/g, '_')}.png`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    canBeGifted: objectData.CanBeGivenAsGift !== false,
    bundles: [],
    gifts: {}
  });
}

// Synthetic entries for special shop currencies with no Objects.json representation
const syntheticCurrencies = [
  {
    type: 'resource',
    id: 'star-token',
    gameId: 'StarToken',
    name: 'Star Token',
    icon: 'assets/objects/Star_Token.png',
    price: 0,
    edibility: -300,
    category: 0,
    contextTags: [],
    canBeGifted: false,
    bundles: [],
    gifts: {}
  },
  {
    type: 'resource',
    id: 'qi-coin',
    gameId: 'QiCoin',
    name: 'Qi Coin',
    icon: 'assets/objects/Qi_Coin.png',
    price: 0,
    edibility: -300,
    category: 0,
    contextTags: [],
    canBeGifted: false,
    bundles: [],
    gifts: {}
  },
];
for (const entry of syntheticCurrencies) resourceData.push(entry);

console.log(`  Processed ${resourceData.length} resources`);

// ============================================================================
// Process BigCraftables (Equipment/Machines)
// ============================================================================
console.log('\nProcessing big craftables...');
const bigCraftableData = [];

// BigCraftables that are bundle rewards (loaded from rules/bundle-rewards.json)
for (const id of rules.bundleRewards) {
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
    icon: `assets/objects/${iconFilename}`,
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

// Machine ID to friendly name mapping (loaded from rules/machine-names.json)
const MACHINE_NAMES = rules.machineNames;

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

// Tapper items are parsed from WildTrees.json via tapperSourcesByGameId (built above).

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
          gameId: parseGameId(id),
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
          gameId: parseGameId(id),
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
      icon: `assets/objects/${getIconFilename(outputItemId, recipe.outputName, objectData)}`,
      contextTags: objectData.ContextTags || [],
      sources: [{
        type: 'machine',
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
      }],
      bundles: [],
      gifts: {}
    };

    // Keep top-level processingTimeMinutes for table sorting convenience
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
      icon: `assets/objects/${getIconFilename(outputItemId, objectData.Name, objectData)}`,
      contextTags: objectData.ContextTags || [],
      sources: [{
        type: 'machine',
        machine: recipe.machine,
        machineId: recipe.machineId,
        inputType: 'specific',
        valueFormula: `${objectData.Price || 0}`,
        inputDetails
      }],
      bundles: [],
      gifts: {}
    };

    // Keep top-level processingTimeMinutes for table sorting convenience
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
      const existingSource = existing.sources[0];
      if (existingSource && artisanItem.sources[0]?.inputDetails) {
        existingSource.inputDetails.push(...artisanItem.sources[0].inputDetails);
        existingSource.inputDetails.sort((a, b) => b.outputPrice - a.outputPrice);
      }
    }
  }
}

console.log(`  Processed ${machineRecipes.length} machine recipes into ${artisanData.length} unique items`);

// ============================================================================
// Process Animal Products (parsed from FarmAnimals.json) — own item type
// ============================================================================

console.log('\nProcessing animal products...');
const animalProductData = [];

// Rebuild animalProducts as gameId -> [{ animalName, hasQuality }] to collect all source animals
const animalProductSources = new Map(); // gameId -> [{ animalName, hasQuality }]
for (const [animalName, animalData] of Object.entries(gameData.farmAnimals)) {
  const allProduce = [
    ...(animalData.ProduceItemIds || []),
    ...(animalData.DeluxeProduceItemIds || []),
  ];
  for (const produce of allProduce) {
    const rawId = produce.ItemId;
    if (!rawId) continue;
    const gameId = parseGameId(rawId);
    if (!animalProductSources.has(gameId)) animalProductSources.set(gameId, []);
    const existing = animalProductSources.get(gameId);
    if (!existing.find(e => e.animalName === animalName)) {
      existing.push({ animalName, animalId: toKebabCase(animalName), hasQuality: true });
    }
  }
}

// Track gameIds consumed by artisan machine pipeline so we don't double-emit
const processedGameIds = new Set(artisanData.map(item => item.gameId));

for (const [gameId, animalSources] of animalProductSources.entries()) {
  // Some animal products (wool, eggs) are also processed by machines — they stay in artisan
  // Only emit as animal-product if they aren't already in the machine pipeline
  if (processedGameIds.has(gameId)) continue;

  const objectData = gameData.objects[String(gameId)];
  if (!objectData) {
    console.warn(`  Warning: Animal product ${gameId} not found in Objects.json`);
    continue;
  }

  const item = {
    type: 'animal-product',
    id: getUniqueItemId(gameId, objectData.Name),
    gameId,
    name: objectData.Name,
    category: objectData.Category || 0,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    hasQuality: true,
    sources: animalSources.map(a => ({ type: 'animal', animalName: a.animalName, animalId: a.animalId })),
    contextTags: objectData.ContextTags || [],
    bundles: [],
    gifts: {},
  };

  // Also include any shop sources for this item
  const shopSrcs = buildAcquisitionSources(gameId, {
    includeForage: false, includeMonsterDrop: false, includeFishPond: false,
  });
  item.sources.push(...shopSrcs);

  animalProductData.push(item);
  processedGameIds.add(gameId);
}

console.log(`  Processed ${animalProductData.length} animal products`);

// ============================================================================
// Process Tapper Products (parsed from WildTrees.json)
// ============================================================================

let tapperItemsAdded = 0;
for (const [gameId, tapSources] of tapperSourcesByGameId.entries()) {
  if (processedGameIds.has(gameId)) continue;

  const objectData = gameData.objects[String(gameId)];
  if (!objectData) {
    console.warn(`  Warning: Tapper item ${gameId} not found in Objects.json`);
    continue;
  }

  const item = {
    type: 'artisan',
    id: toKebabCase(objectData.Name),
    gameId,
    name: objectData.Name,
    category: objectData.Category || -27,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    sources: [
      ...tapSources,
      ...buildAcquisitionSources(gameId, { includeForage: false, includeMonsterDrop: false, includeFishPond: false }),
    ],
    contextTags: objectData.ContextTags || [],
    bundles: [],
    gifts: {},
  };

  artisanData.push(item);
  processedGameIds.add(gameId);
  tapperItemsAdded++;
}

console.log(`  Added ${tapperItemsAdded} tapper products`);

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
  const gameIdValue = parseGameId(gameId);

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
      icon: `assets/objects/${iconFileName}`,
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
      icon: `assets/objects/${iconFileName}`,
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

// Add selling locations and acquisition sources to fish
fishData.forEach(item => {
  const category = item.originalCategory !== undefined ? item.originalCategory : item.category;
  item.sellingLocations = getSellingLocations(category, shopSellingLocations);
  item.sources = buildAcquisitionSources(item.gameId, { includeShop: false, includeForage: false });
});

// Extract and merge location data
console.log('\nExtracting fish locations...');
const { extractFishLocations } = require('./helpers/extract-fish-locations.cjs');
const extractedData = extractFishLocations();

// Merge locations into fish data as structured sources
let locationsMerged = 0;
let levelsMerged = 0;

fishData.forEach(fish => {
  const locationEntries = extractedData.locations[fish.gameId];
  if (locationEntries && locationEntries.length > 0) {
    const fishSources = locationEntries.map(({ location, seasons }) => ({
      type: 'fish',
      location,
      seasons: seasons  // null = all seasons, array = specific seasons
    }));
    fish.sources.push(...fishSources);
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
  const missingLocations = fishData.filter(f => !f.sources.some(s => s.type === 'fish'));
  console.warn(`  ⚠️  ${missingLocations.length} fish missing locations:`);
  missingLocations.forEach(f => console.warn(`    - ${f.name} (Game ID: ${f.gameId})`));
}


// ============================================================================
// Curate dual-role items (items that appear in both fish and forage contexts)
// ============================================================================
console.log('\nCurating dual-role items...');

fishData.forEach(fish => {
  if (rules.itemRoles.dualRoleItems.gameIds.includes(fish.gameId)) {
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

console.log(`  ✅ Marked ${rules.itemRoles.dualRoleItems.gameIds.length} dual-role items in fish data`);

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
  type: 'artisan',
  category: roeObjectData?.Category || -26,
  price: roeObjectData?.Price || 30,
  edibility: roeObjectData?.Edibility || 20,
  icon: 'assets/objects/Roe.png',
  contextTags: roeObjectData?.ContextTags || [],
  sources: [{
    type: 'machine',
    machine: 'Fish Pond',
    machineId: 'fish-pond',
    inputType: 'fish',
    processingTimeMinutes: rules.roeMechanics.roe.processingTimeMinutes,
    valueFormula: rules.roeMechanics.roe.formula,
    inputDetails: roeInputDetails
  }],
  processingTimeMinutes: rules.roeMechanics.roe.processingTimeMinutes,
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
  type: 'artisan',
  category: agedRoeObjectData?.Category || -26,
  price: agedRoeObjectData?.Price || 100,
  edibility: agedRoeObjectData?.Edibility || 40,
  icon: 'assets/objects/AgedRoe.png',
  contextTags: agedRoeObjectData?.ContextTags || [],
  sources: [{
    type: 'machine',
    machine: rules.roeMechanics.agedRoe.producedBy,
    machineId: 'preserves-jar',
    inputType: rules.roeMechanics.agedRoe.inputType,
    processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
    valueFormula: rules.roeMechanics.agedRoe.formula,
    inputDetails: agedRoeInputDetails
  }],
  processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
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

// Process gift tastes for animal products
for (const ap of animalProductData) {
  giftCount += processGiftTastes(ap, gameData.npcGiftTastes);
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
  if (resource.canBeGifted === false) continue;
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

        // Add bundle reference to animal products
        const animalProduct = animalProductData.find(a => a.gameId === itemId);
        if (animalProduct && !animalProduct.bundles.includes(friendlyId)) {
          animalProduct.bundles.push(friendlyId);
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

// ============================================================================
// Process Seeds
// ============================================================================
console.log('\nProcessing seeds...');
const seedData = [];

// Build a map: seedId -> [seller IDs] using the shared shopMap from rules
const seedSellersMap = new Map(); // gameId -> Set of seller IDs

for (const [shopId, shopData] of Object.entries(gameData.shops)) {
  const sellerName = rules.shops.shopMap[shopId];
  if (!sellerName) continue; // skip unmapped shops

  for (const item of (shopData.Items || [])) {
    const m = item.ItemId && item.ItemId.match(/\(O\)(\d+)/);
    if (!m) continue;
    const id = parseInt(m[1], 10);
    if (!seedSellersMap.has(id)) {
      seedSellersMap.set(id, new Set());
    }
    seedSellersMap.get(id).add(sellerName);
  }
}

// Non-crop seed IDs to skip (loaded from rules/item-roles.json)
const SKIP_SEED_IDS = new Set(rules.itemRoles.skipSeedIds.gameIds);

// Build crop lookup by seed gameId for easy cross-reference during seed processing
const cropBySeedGameId = new Map();
for (const crop of cropData) {
  const seedSource = crop.sources?.find(s => s.type === 'seed');
  if (seedSource?.seedGameId != null) {
    cropBySeedGameId.set(seedSource.seedGameId, crop);
  }
}

// Build forage lookup by gameId
const forageByGameId = new Map();
for (const item of forageData) {
  forageByGameId.set(item.gameId, item);
}

// Helper: build a produces entry from either a crop or forage item
const makeProducesEntry = (item) => ({
  cropId: item.id,
  cropGameId: item.gameId,
  cropName: item.name,
  cropIcon: item.icon,
  cropPrice: item.price,
  growthDays: item.growthDays || null,
  regrowDays: item.regrowDays || null,
  cropType: item.type,
});

// Seasonal wild seeds: game engine randomly picks from all season-appropriate forage items.
// Crops.json only stores one HarvestItemId (the first forage item), but the full pools
// are defined in data/rules/seasonal-seed-produce.json.
const seasonalSeedProduceRules = JSON.parse(fs.readFileSync(path.join(RULES_DIR, 'seasonal-seed-produce.json'), 'utf8'));
const SEASONAL_SEED_PRODUCE_GAME_IDS = Object.fromEntries(
  Object.entries(seasonalSeedProduceRules)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => [parseInt(k, 10), v])
);
const SEASONAL_SEED_IDS = new Set(Object.keys(SEASONAL_SEED_PRODUCE_GAME_IDS).map(Number));

// Mixed Seeds and Mixed Flower Seeds: no Crops.json entry, hardcoded produce pools
// Mixed Seeds (770): produces one random seasonal forage seed for current season
// Outputs are the same items as the four seasonal seeds
const MIXED_SEEDS_ID = 770;
const MIXED_SEEDS_PRODUCE_GAME_IDS = [16, 396, 404, 412]; // Wild Horseradish, Spice Berry, Common Mushroom, Winter Root

// Mixed Flower Seeds: produces a random flower for current season
const mfse = Object.entries(gameData.objects).find(([id, obj]) => obj.Name === 'Mixed Flower Seeds');
const MIXED_FLOWER_SEEDS_ID = mfse ? mfse[0] : null; // May be a string ID like 'MixedFlowerSeeds'
const MIXED_FLOWER_SEEDS_PRODUCE_GAME_IDS = [591, 597, 376, 593, 421, 595]; // Tulip, Blue Jazz, Poppy, Summer Spangle, Sunflower, Fairy Rose

for (const [seedGameIdStr, cropInfo] of Object.entries(gameData.crops)) {
  const seedGameId = parseGameId(seedGameIdStr);

  // Skip saplings
  if (SKIP_SEED_IDS.has(seedGameId)) continue;

  // Skip tree seeds (tree_seed_item context tag)
  const seedObjectData = gameData.objects[seedGameIdStr];
  if (!seedObjectData) {
    console.warn(`  Warning: Seed ${seedGameIdStr} not found in Objects.json`);
    continue;
  }
  if (seedObjectData.ContextTags && seedObjectData.ContextTags.includes('tree_seed_item')) continue;

  const sellers = Array.from(seedSellersMap.get(seedGameId) || []).sort();
  const sellPrice = seedObjectData.Price || 0;

  let produces;
  let seasons;

  if (SEASONAL_SEED_IDS.has(seedGameId)) {
    // Seasonal seeds: game engine randomly picks from all season forage items (not just HarvestItemId)
    const growthDays = (cropInfo.DaysInPhase || []).reduce((sum, d) => sum + d, 0);
    const produceGameIds = SEASONAL_SEED_PRODUCE_GAME_IDS[seedGameId] || [];
    produces = produceGameIds.map(gid => {
      const forageItem = forageByGameId.get(gid);
      if (!forageItem) {
        console.warn(`  Warning: Forage item ${gid} not found for seasonal seed ${seedGameId}`);
        return null;
      }
      return { ...makeProducesEntry(forageItem), growthDays };
    }).filter(Boolean);
    if (produces.length === 0) continue;
    // Use the crop's season, not the forage item's (forage may be available in more seasons)
    const seasonMap = ['spring', 'summer', 'fall', 'winter'];
    seasons = (cropInfo.Seasons || []).map(s => seasonMap[s]).filter(Boolean);
  } else {
    // Regular crop seed
    const crop = cropBySeedGameId.get(seedGameId);
    if (!crop) {
      console.warn(`  Warning: No crop found for seed ${seedGameId} (${seedObjectData.Name})`);
      continue;
    }
    produces = [makeProducesEntry(crop)];
    seasons = crop.seasons;
  }

  seedData.push({
    id: toKebabCase(seedObjectData.Name),
    gameId: seedGameId,
    name: seedObjectData.Name,
    icon: `assets/objects/${seedObjectData.Name.replace(/\s+/g, '_')}.png`,
    type: 'seed',
    category: -74,
    price: sellPrice,
    buyPrice: sellPrice * 2,
    seasons,
    produces,
    sellers,
    sources: buildAcquisitionSources(seedGameId, { includeForage: false, includeTilling: true, includeCrafting: true }),
    sellingLocations: getSellingLocations(-74, shopSellingLocations),
  });
}

// Mixed Seeds (770): no Crops.json entry, random seasonal output
if (gameData.objects[String(MIXED_SEEDS_ID)]) {
  const obj = gameData.objects[String(MIXED_SEEDS_ID)];
  const produces = MIXED_SEEDS_PRODUCE_GAME_IDS
    .map(gid => forageByGameId.get(gid))
    .filter(Boolean)
    .map(item => ({ ...makeProducesEntry(item), growthDays: 7 }));
  const sellPrice = obj.Price || 0;
  seedData.push({
    id: toKebabCase(obj.Name),
    gameId: MIXED_SEEDS_ID,
    name: obj.Name,
    icon: `assets/objects/${obj.Name.replace(/\s+/g, '_')}.png`,
    type: 'seed',
    category: -74,
    price: sellPrice,
    buyPrice: sellPrice * 2,
    seasons: ['spring', 'summer', 'fall', 'winter'],
    produces,
    sellers: Array.from(seedSellersMap.get(MIXED_SEEDS_ID) || []).sort(),
    sources: buildAcquisitionSources(MIXED_SEEDS_ID, { includeForage: false, includeTilling: true, includeCrafting: true }),
    sellingLocations: getSellingLocations(-74, shopSellingLocations),
  });
}

// Mixed Flower Seeds: no Crops.json entry, random seasonal flower output
if (MIXED_FLOWER_SEEDS_ID && gameData.objects[String(MIXED_FLOWER_SEEDS_ID)]) {
  const obj = gameData.objects[String(MIXED_FLOWER_SEEDS_ID)];
  const produces = MIXED_FLOWER_SEEDS_PRODUCE_GAME_IDS
    .map(gid => {
      const crop = cropData.find(c => c.gameId === gid);
      return crop ? makeProducesEntry(crop) : null;
    })
    .filter(Boolean);
  const sellPrice = obj.Price || 0;
  seedData.push({
    id: toKebabCase(obj.Name),
    gameId: MIXED_FLOWER_SEEDS_ID,
    name: obj.Name,
    icon: `assets/objects/${obj.Name.replace(/\s+/g, '_')}.png`,
    type: 'seed',
    category: -74,
    price: sellPrice,
    buyPrice: sellPrice * 2,
    seasons: ['spring', 'summer', 'fall'],
    produces,
    sellers: Array.from(seedSellersMap.get(MIXED_FLOWER_SEEDS_ID) || []).sort(),
    sources: buildAcquisitionSources(MIXED_FLOWER_SEEDS_ID, { includeForage: false, includeTilling: true, includeCrafting: true }),
    sellingLocations: getSellingLocations(-74, shopSellingLocations),
  });
}

// Sort seeds alphabetically by name
seedData.sort((a, b) => a.name.localeCompare(b.name));

console.log(`  Processed ${seedData.length} seeds`);

// ============================================================================
// Process Furniture
// ============================================================================
console.log('\nProcessing furniture...');
const furnitureData = [];

// Name and wiki overrides loaded from data/rules/furniture-names.json

// Furniture format: name/type/tilesheetSize/boundingBoxSize/rotations/price/placementRestriction/displayName/...
// Named string IDs (e.g. "JojaCatalogue") and numeric IDs (e.g. "0")
for (const [rawKey, furnitureStr] of Object.entries(gameData.furniture)) {
  const parts = furnitureStr.split('/');
  const rawName = parts[0];
  const furnitureType = parts[1]; // "chair", "bench", "decor", "painting", "lamp", etc.
  const price = parseInt(parts[5], 10) || 0;
  const furnitureRule = rules.furnitureNames[rawKey];

  // Use display name override if available, otherwise use the raw name from data
  const name = furnitureRule?.name || rawName;

  const gameId = parseGameId(rawKey);
  const id = toKebabCase(name) || toKebabCase(rawKey);

  // Wiki name: use override if available, else derive from display name
  const wikiName = furnitureRule?.wikiName || name.replace(/\s+/g, '_');

  // Icon: named by wiki page name (same convention as other assets)
  const icon = `assets/objects/${wikiName}.png`;

  const sources = [];
  if (furnitureShopSourcesByGameId.has(gameId)) {
    sources.push(...furnitureShopSourcesByGameId.get(gameId));
  }

  furnitureData.push({
    id,
    gameId,
    name,
    type: furnitureType,
    price,
    icon,
    wikiName,
    sources,
  });
}

// Disambiguate items that share the same generated id (color/style variants with identical names).
// Append -gameId to ALL members of each collision group so no variant keeps an ambiguous id.
deduplicateIds(furnitureData);

furnitureData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${furnitureData.length} furniture items`);

// ============================================================================
// Process Hats
// ============================================================================
console.log('\nProcessing hats...');
const hatData = [];

// Hat format: name/description/hairstyleOffset/isMask/iconIndex/displayName[/spriteIndex]
for (const [rawKey, hatStr] of Object.entries(gameData.hats)) {
  const parts = hatStr.split('/');
  const name = parts[5] || parts[0]; // displayName at [5], fallback to [0]
  const description = parts[1] || '';
  const isMask = parts[3] === 'true';

  const gameId = parseGameId(rawKey);
  const id = toKebabCase(name) || toKebabCase(rawKey);

  // Icon: wiki uses the display name
  const icon = `assets/objects/${name.replace(/\s+/g, '_')}.png`;

  const sources = [];
  if (hatShopSourcesByGameId.has(gameId)) {
    sources.push(...hatShopSourcesByGameId.get(gameId));
  }

  hatData.push({
    id,
    gameId,
    name,
    description,
    isMask,
    icon,
    sources,
  });
}

deduplicateIds(hatData);

hatData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${hatData.length} hats`);

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
  path.join(PROCESSED_DIR, 'items/animal-products.json'),
  JSON.stringify(animalProductData, null, 2)
);
console.log(`  ✓ Wrote items/animal-products.json (${animalProductData.length} animal products)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/crops.json'),
  JSON.stringify(cropData, null, 2)
);
console.log(`  ✓ Wrote items/crops.json (${cropData.length} crops)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/seeds.json'),
  JSON.stringify(seedData, null, 2)
);
console.log(`  ✓ Wrote items/seeds.json (${seedData.length} seeds)`);

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
  path.join(PROCESSED_DIR, 'items/furniture.json'),
  JSON.stringify(furnitureData, null, 2)
);
console.log(`  ✓ Wrote items/furniture.json (${furnitureData.length} furniture items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/hats.json'),
  JSON.stringify(hatData, null, 2)
);
console.log(`  ✓ Wrote items/hats.json (${hatData.length} hats)`);

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

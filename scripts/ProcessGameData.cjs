#!/usr/bin/env node

/**
 * Process raw game data exports into structured source files
 * This creates the "source of truth" data files that will be compiled into page-specific JSON
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Condition parsing: converts Stardew game condition strings to JSON Logic
// ---------------------------------------------------------------------------

// Mastery stat suffixes → skill names
const MASTERY_SKILL_MAP = {
  mastery_0: 'farming',
  mastery_1: 'fishing',
  mastery_2: 'foraging',
  mastery_3: 'mining',
  mastery_4: 'combat',
};

/**
 * Parse a single game condition token (no commas) into a JSON Logic rule.
 * Returns null for conditions we don't model (time-based, random, etc.).
 */
function parseSingleCondition(token) {
  token = token.trim();
  const negated = token.startsWith('!');
  if (negated) token = token.slice(1).trim();

  const wrap = (rule) => negated ? { '!': rule } : rule;

  // MINE_LOWEST_LEVEL_REACHED N
  let m = token.match(/^MINE_LOWEST_LEVEL_REACHED\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'player.mineDepth' }, parseInt(m[1])] });

  // PLAYER_BASE_FISHING_LEVEL Current N
  m = token.match(/^PLAYER_BASE_FISHING_LEVEL\s+\w+\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'player.skills.fishing' }, parseInt(m[1])] });

  // PLAYER_BASE_FARMING_LEVEL Current N
  m = token.match(/^PLAYER_BASE_FARMING_LEVEL\s+\w+\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'player.skills.farming' }, parseInt(m[1])] });

  // PLAYER_HEARTS Current AnyDateable N
  m = token.match(/^PLAYER_HEARTS\s+\w+\s+AnyDateable\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'player.hearts.anyDateable' }, parseInt(m[1])] });

  // PLAYER_HEARTS Current NpcName N
  m = token.match(/^PLAYER_HEARTS\s+\w+\s+(\w+)\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: `player.hearts.${m[1].toLowerCase()}` }, parseInt(m[2])] });

  // PLAYER_FARMHOUSE_UPGRADE Current N
  m = token.match(/^PLAYER_FARMHOUSE_UPGRADE\s+\w+\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'player.houseUpgrade' }, parseInt(m[1])] });

  // PLAYER_HAS_ACHIEVEMENT Current N
  m = token.match(/^PLAYER_HAS_ACHIEVEMENT\s+\w+\s+(\d+)$/i);
  if (m) return wrap({ in: [parseInt(m[1]), { var: 'player.achievements' }] });

  // PLAYER_HAS_ALL_ACHIEVEMENTS Current
  m = token.match(/^PLAYER_HAS_ALL_ACHIEVEMENTS/i);
  if (m) return wrap({ '==': [{ var: 'player.allAchievements' }, true] });

  // PLAYER_HAS_MAIL Current|Host flagName
  m = token.match(/^PLAYER_HAS_MAIL\s+\w+\s+"?([^"]+)"?$/i);
  if (m) return wrap({ in: [m[1].trim(), { var: 'player.mail' }] });

  // PLAYER_HAS_SEEN_EVENT Current|Host N
  m = token.match(/^PLAYER_HAS_SEEN_EVENT\s+\w+\s+(\d+)$/i);
  if (m) return wrap({ in: [parseInt(m[1]), { var: 'player.events' }] });

  // PLAYER_HAS_CONVERSATION_TOPIC Current topicId
  m = token.match(/^PLAYER_HAS_CONVERSATION_TOPIC\s+\w+\s+(\w+)$/i);
  if (m) return wrap({ in: [m[1], { var: 'player.conversationTopics' }] });

  // PLAYER_HAS_CRAFTING_RECIPE Current recipeName
  m = token.match(/^PLAYER_HAS_CRAFTING_RECIPE\s+\w+\s+(.+)$/i);
  if (m) return wrap({ in: [m[1].trim(), { var: 'player.craftingRecipes' }] });

  // PLAYER_HAS_ITEM Current itemId (bare number or qualified like (T)MilkPail)
  m = token.match(/^PLAYER_HAS_ITEM\s+\w+\s+(.+)$/i);
  if (m) return wrap({ in: [m[1].trim(), { var: 'player.items' }] });

  // PLAYER_NPC_RELATIONSHIP Current Any Engaged Married
  m = token.match(/^PLAYER_NPC_RELATIONSHIP\s+\w+\s+\w+\s+(Engaged|Married)/i);
  if (m) return wrap({ in: [m[1].toLowerCase(), { var: 'player.relationships' }] });

  // PLAYER_MONEY_EARNED Current N
  m = token.match(/^PLAYER_MONEY_EARNED\s+\w+\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'player.moneyEarned' }, parseInt(m[1])] });

  // PLAYER_FRIENDSHIP_POINTS Current NpcName N
  m = token.match(/^PLAYER_FRIENDSHIP_POINTS\s+\w+\s+(\w+)\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: `player.friendship.${m[1].toLowerCase()}` }, parseInt(m[2])] });

  // PLAYER_GENDER Current Male|Female
  m = token.match(/^PLAYER_GENDER\s+\w+\s+(Male|Female)$/i);
  if (m) return wrap({ '==': [{ var: 'player.gender' }, m[1].toLowerCase()] });

  // PLAYER_STAT Current mastery_N 1
  m = token.match(/^PLAYER_STAT\s+\w+\s+(mastery_\d+)\s+(\d+)$/i);
  if (m) {
    const skill = MASTERY_SKILL_MAP[m[1].toLowerCase()];
    if (skill) return wrap({ '>=': [{ var: `player.mastery.${skill}` }, parseInt(m[2])] });
  }

  // PLAYER_STAT Current Book_X 1
  m = token.match(/^PLAYER_STAT\s+\w+\s+(Book_\w+)\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: `player.stats.${m[1]}` }, parseInt(m[2])] });

  // PLAYER_STAT Current ticketPrizesClaimed N
  m = token.match(/^PLAYER_STAT\s+\w+\s+(\w+)\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: `player.stats.${m[1]}` }, parseInt(m[2])] });

  // MUSEUM_DONATIONS N Arch (artifacts)
  m = token.match(/^MUSEUM_DONATIONS\s+(\d+)\s+Arch(?:\s+Minerals)?$/i);
  if (m) return wrap({ '>=': [{ var: 'museum.artifacts' }, parseInt(m[1])] });

  // MUSEUM_DONATIONS N Minerals
  m = token.match(/^MUSEUM_DONATIONS\s+(\d+)\s+Minerals$/i);
  if (m) return wrap({ '>=': [{ var: 'museum.minerals' }, parseInt(m[1])] });

  // WORLD_STATE_FIELD GoldenWalnutsFound N
  m = token.match(/^WORLD_STATE_FIELD\s+GoldenWalnutsFound\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'world.GoldenWalnutsFound' }, parseInt(m[1])] });

  // WORLD_STATE_FIELD TimesFedRaccoons N
  m = token.match(/^WORLD_STATE_FIELD\s+TimesFedRaccoons\s+(\d+)$/i);
  if (m) return wrap({ '>=': [{ var: 'world.TimesFedRaccoons' }, parseInt(m[1])] });

  // WORLD_STATE_FIELD GoldenCoconutCracked true
  m = token.match(/^WORLD_STATE_FIELD\s+GoldenCoconutCracked\s+true$/i);
  if (m) return wrap({ '==': [{ var: 'world.GoldenCoconutCracked' }, true] });

  // IS_COMMUNITY_CENTER_COMPLETE
  m = token.match(/^IS_COMMUNITY_CENTER_COMPLETE$/i);
  if (m) return wrap({ '==': [{ var: 'world.communityCenter' }, true] });

  // ANY "COND_A" "COND_B" — OR of quoted sub-conditions
  m = token.match(/^ANY\s+(.+)$/i);
  if (m) {
    const parts = [...m[1].matchAll(/"([^"]+)"/g)].map(x => parseSingleCondition(x[1])).filter(Boolean);
    if (parts.length > 0) return wrap(parts.length === 1 ? parts[0] : { or: parts });
  }

  return null; // time/season/random/unknown — not modeled
}

/**
 * Parse a full game condition string (comma-separated AND of tokens) into JSON Logic.
 * Returns null if no progression-relevant conditions are found.
 */
function parseCondition(conditionStr) {
  if (!conditionStr) return null;

  // Split on commas, but not commas inside quoted strings
  const tokens = [];
  let current = '';
  let depth = 0;
  for (const ch of conditionStr) {
    if (ch === '"') depth = depth ? 0 : 1;
    if (ch === ',' && depth === 0) { tokens.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) tokens.push(current.trim());

  const rules = tokens.map(parseSingleCondition).filter(Boolean);
  if (rules.length === 0) return null;
  if (rules.length === 1) return rules[0];
  return { and: rules };
}

/**
 * Walk a JSON Logic condition and collect all player.items game ID references.
 * Returns an object mapping gameId string → item name, or null if none found.
 * Resolved against Objects.json at call time (gameData not yet loaded here —
 * call this after gameData is available).
 */
function collectItemConditionNames(condition, objectsData) {
  const found = {};
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.in) {
      const [value, collection] = node.in;
      if (collection?.var === 'player.items') {
        const id = String(value);
        const obj = objectsData[id];
        if (obj?.Name) found[id] = obj.Name;
      }
      return;
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  }
  walk(condition);
  return Object.keys(found).length > 0 ? found : null;
}

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
/** Convert an item name to a safe icon filename (CamelCase, letters and numbers only) */
function toIconFilename(name) {
  return name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + '.png';
}

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
  // First try: explicit iconFilename override in item-variants rules
  const variant = rules.itemVariants[String(gameId)];
  if (variant && variant.iconFilename) {
    return variant.iconFilename;
  }

  // Second try: extract from DisplayName in object data
  if (objectData && objectData.DisplayName) {
    const spriteName = extractSpriteNameFromDisplayName(objectData.DisplayName);
    if (spriteName) {
      return toIconFilename(spriteName);
    }
  }

  // Default: use item name with spaces replaced by underscores, strip apostrophes
  return toIconFilename(itemName);
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
  return (shopSellingLocations[String(category)] || ['store-shipping-bin']).map(normalizeStoreId);
}

// Normalize a store ID to always have the store- prefix
function normalizeStoreId(id) {
  if (!id || typeof id !== 'string') return id;
  return id.startsWith('store-') ? id : `store-${id}`;
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
  buffs: loadJson(path.join(GAME_EXPORTS_DIR, 'Buffs.json')),
  mail: loadJson(path.join(GAME_EXPORTS_DIR, 'mail.json')),
  specialOrders: loadJson(path.join(GAME_EXPORTS_DIR, 'SpecialOrders.json')),
  triggerActions: loadJson(path.join(GAME_EXPORTS_DIR, 'TriggerActions.json')),
  characters: loadJson(path.join(GAME_EXPORTS_DIR, 'Characters.json')),
  weapons: loadJson(path.join(GAME_EXPORTS_DIR, 'Weapons.json')),
  boots: loadJson(path.join(GAME_EXPORTS_DIR, 'Boots.json')),
  tools: loadJson(path.join(GAME_EXPORTS_DIR, 'Tools.json')),
  trinkets: loadJson(path.join(GAME_EXPORTS_DIR, 'Trinkets.json')),
  buildings: loadJson(path.join(GAME_EXPORTS_DIR, 'Buildings.json')),
};

// ---------------------------------------------------------------------------
// Raw game data lookup — accepts qualified IDs (e.g. "(O)128", "(BC)13")
// and dispatches to the correct raw collection after stripping the prefix.
// Use this when crossing from processed data (qualified IDs) back into raw
// game data (bare keys). Do not use for lookups that are already in the raw
// data parsing zone with bare IDs — those can use gameData.* directly.
// ---------------------------------------------------------------------------
const RAW_COLLECTIONS = {
  O:  () => gameData.objects,
  BC: () => gameData.bigCraftables,
  F:  () => gameData.furniture,
  H:  () => gameData.hats,
};

function lookupRawItem(qualifiedId) {
  const match = String(qualifiedId).match(/^\(([^)]+)\)(.+)$/);
  if (!match) return undefined;
  const [, prefix, rawId] = match;
  return RAW_COLLECTIONS[prefix]?.()?.[rawId];
}

// Load string tables for resolving [LocalizedText ...] references
const stringTables = {};
for (const tableName of ['Furniture', 'Objects', 'BigCraftables', 'Buildings', 'Tools', 'Weapons', '1_6_Strings', 'UI', 'Locations', 'Characters', 'NPCNames', 'FarmAnimals', 'BundleNames', 'EnchantmentNames', 'Movies', 'Quests', 'SpecialOrderStrings', 'StringsFromCSFiles', 'Notes', 'Shirts', 'Pants']) {
  const filePath = path.join(GAME_EXPORTS_DIR, `Strings_${tableName}.json`);
  try { stringTables[tableName] = loadJson(filePath); } catch { /* optional */ }
}

/**
 * Resolve a [LocalizedText Strings\TableName:Key] reference to its display string.
 * Falls back to the raw value if not a LocalizedText reference or key not found.
 */
function resolveLocalizedText(value) {
  if (!value || !value.includes('[LocalizedText')) return value;
  const match = value.match(/\[LocalizedText\s+Strings\\(\w+):([^\]]+)\]/);
  if (!match) return value;
  const [, tableName, key] = match;
  return stringTables[tableName]?.[key] ?? value;
}

/**
 * Parse the Buffs array from an Objects.json entry into our simplified format.
 * Resolves BuffId references to Buffs.json for named buffs (Tipsy, Oil of Garlic, etc.).
 * Returns null if the item has no meaningful buffs.
 */
function parseItemBuffs(objectData) {
  if (!objectData.Buffs || objectData.Buffs.length === 0) return null;

  const result = [];
  for (const buff of objectData.Buffs) {
    // Named buff: look up from Buffs.json
    if (buff.BuffId !== null && buff.BuffId !== undefined) {
      const namedBuff = gameData.buffs[String(buff.BuffId)];
      if (!namedBuff) continue;
      const name = resolveLocalizedText(namedBuff.DisplayName);
      const effects = {};
      if (namedBuff.Effects) {
        for (const [k, v] of Object.entries(namedBuff.Effects)) {
          if (v !== 0) effects[k] = v;
        }
      }
      result.push({
        buffId: `buff-${toKebabCase(name)}`,
        name,
        duration: Math.round(namedBuff.Duration / 1000), // Buffs.json Duration is in milliseconds
        isDebuff: namedBuff.IsDebuff,
        effects: Object.keys(effects).length > 0 ? effects : null,
      });
      continue;
    }

    // Inline buff: attributes from CustomAttributes
    if (!buff.CustomAttributes) continue;
    const effects = {};
    for (const [k, v] of Object.entries(buff.CustomAttributes)) {
      if (v !== 0) effects[k] = v;
    }
    if (Object.keys(effects).length === 0 && !buff.IsDebuff) continue; // skip empty non-debuff entries
    result.push({
      duration: buff.Duration, // in seconds
      isDebuff: buff.IsDebuff || false,
      effects: Object.keys(effects).length > 0 ? effects : null,
    });
  }

  return result.length > 0 ? result : null;
}

// Parse shop selling locations from game data, then merge with curated category rules
console.log('Parsing shop selling locations...');
const shopSellingLocations = parseShopSellingLocations(gameData.shops);
// selling-locations.json categorySellingLocations is the authoritative source for
// sell-to-NPC locations (e.g. Clint buys bars, Robin buys wood) — merge it in,
// letting the rules file override the shop-parsed entries per category.
const sellingLocationRules = loadJson(path.join(RULES_DIR, 'selling-locations.json'));
Object.assign(shopSellingLocations, sellingLocationRules.categorySellingLocations || {});
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
  hatOverrides: loadJson(path.join(RULES_DIR, 'hat-overrides.json')),
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

// bigCraftableShopSourcesByGameId: gameId (number) -> [shop source]
const bigCraftableShopSourcesByGameId = new Map();

for (const [shopId, shopData] of Object.entries(gameData.shops)) {
  const storeId = shopMap[shopId];
  if (!storeId) continue;

  for (const item of (shopData.Items || [])) {
    const itemId = item.ItemId;
    if (!itemId) continue;
    if (item.IsRecipe) continue;

    // Determine item type prefix and which source map to use
    let rawId;
    let prefix = '(O)';
    let sourceMap = shopSourcesByGameId; // default: Objects

    const furnitureMatch = itemId.match(/^\(F\)(.+)$/);
    const hatMatch = itemId.match(/^\(H\)(.+)$/);
    const objectMatch = itemId.match(/^\(O\)(.+)$/);
    const bigCraftableMatch = itemId.match(/^\(BC\)(.+)$/);

    if (furnitureMatch) {
      rawId = furnitureMatch[1]; prefix = '(F)';
      sourceMap = furnitureShopSourcesByGameId;
    } else if (hatMatch) {
      rawId = hatMatch[1]; prefix = '(H)';
      sourceMap = hatShopSourcesByGameId;
    } else if (bigCraftableMatch) {
      rawId = bigCraftableMatch[1]; prefix = '(BC)';
      sourceMap = bigCraftableShopSourcesByGameId;
    } else if (objectMatch) {
      rawId = objectMatch[1];
    } else if (gameData.objects[itemId] !== undefined) {
      // Bare string ID with no type prefix — Objects namespace
      rawId = itemId;
    } else {
      continue;
    }
    const gameId = `${prefix}${rawId}`;

    const normalizedStoreId = normalizeStoreId(storeId);
    const storeDetails = rules.shops.storeDetails?.[storeId];
    const storeName = storeDetails?.name ?? storeId;
    const source = { type: 'shop', storeId: normalizedStoreId, storeName };

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
        ? `assets/objects/${toIconFilename(tradeObj.Name)}`
        : null;
      source.tradeItemAmount = item.TradeItemAmount || 1;
    }

    // Parse Condition field for availability metadata
    if (item.Condition) {
      const cond = item.Condition;

      // Display-only fields: season, day-of-week, year, rotating
      const seasonMatch = cond.match(/\bSEASON\s+([\w\s]+?)(?:\s*,|$)/i);
      if (seasonMatch) {
        source.seasons = seasonMatch[1].trim().split(/\s+/).map(s => s.toLowerCase());
      }

      const dowMatch = cond.match(/\bDAY_OF_WEEK\s+([\w\s]+?)(?:\s*,|$)/i);
      if (dowMatch) {
        source.days = dowMatch[1].trim().split(/\s+/);
      }

      const yearMatch = cond.match(/(!?)YEAR\s+(\d+)/i);
      if (yearMatch) {
        source.yearUnlock = parseInt(yearMatch[2], 10);
        if (yearMatch[1] === '!') source.yearUnlockBefore = true;
      }

      if (/\bSYNCED_(?:RANDOM|CHOICE)\b/i.test(cond)) {
        source.rotating = true;
      }

      // Progression conditions → JSON Logic
      const condition = parseCondition(cond);
      if (condition) {
        source.condition = condition;
        const itemNames = collectItemConditionNames(condition, gameData.objects);
        if (itemNames) source.conditionItemNames = itemNames;
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
    if (!itemId.startsWith('(O)')) continue;
    const gameId = itemId;

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

    // Merge into existing entry for the same location (avoid duplicate rows per season)
    const existing = forageSourcesByGameId.get(gameId).find(e => e.location === source.location);
    if (existing) {
      const incoming = source.seasons || (source.season ? [source.season] : []);
      const current = existing.seasons || (existing.season ? [existing.season] : []);
      const merged = [...new Set([...current, ...incoming])];
      if (merged.length === 0) {
        // no season info — keep as-is (all seasons)
      } else if (merged.length === 1) {
        existing.season = merged[0];
        delete existing.seasons;
      } else {
        existing.seasons = merged;
        delete existing.season;
      }
    } else {
      forageSourcesByGameId.get(gameId).push(source);
    }
  }
}

// monsterDropsByGameId: gameId -> [{ type:'monster-drop', monster, chance }]
const monsterDropsByGameId = new Map();

for (const [monsterName, rawData] of Object.entries(gameData.monsters)) {
  const parts = rawData.split('/');
  const dropsStr = parts[6] || '';
  const dropParts = dropsStr.trim().split(/\s+/).filter(Boolean);

  for (let i = 0; i + 1 < dropParts.length; i += 2) {
    const gameId = `(O)${dropParts[i]}`;  // drop list uses bare numeric IDs
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
    if (!itemId.startsWith('(O)')) continue;
    const gameId = itemId;

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
      if (!itemId || !itemId.startsWith('(O)')) continue;
      const gameId = itemId;

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
      if (!itemId.startsWith('(O)')) continue;
      const gameId = itemId;

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
// Set of gameIds whose crafting recipe produces a BigCraftable (parts[3] === 'true')
const craftingBigCraftableGameIds = new Set();

{
  const craftingRecipes = loadJson(path.join(GAME_EXPORTS_DIR, 'CraftingRecipes.json'));
  for (const [recipeName, val] of Object.entries(craftingRecipes)) {
    const parts = val.split('/');
    if (parts.length < 3) continue;
    const outputPart = parts[2].trim();
    // outputPart is either "id" or "id count" (bare numeric IDs, Objects namespace)
    const [outputIdStr, outputCountStr] = outputPart.split(' ');
    if (!outputIdStr) continue;
    const isBigCraftable = parts[3]?.trim() === 'true';
    const outputGameId = isBigCraftable ? `(BC)${outputIdStr}` : `(O)${outputIdStr}`;

    // Track whether this output is a BigCraftable (parts[3] === 'true')
    if (isBigCraftable) craftingBigCraftableGameIds.add(outputGameId);

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

    // Parse unlock condition: 's Skill N' = skill level, 'l N' = player level, 'f NPC N' = friendship
    const unlockStr = parts[4]?.trim() || 'default';
    let unlockCondition = null;
    if (unlockStr.startsWith('s ')) {
      const tokens = unlockStr.split(' ');
      unlockCondition = { type: 'skill', skill: tokens[1].toLowerCase(), level: parseInt(tokens[2], 10) };
    } else if (unlockStr.startsWith('l ') && unlockStr !== 'l 0') {
      unlockCondition = { type: 'level', level: parseInt(unlockStr.slice(2), 10) };
    } else if (unlockStr.startsWith('f ')) {
      const tokens = unlockStr.split(' ');
      unlockCondition = { type: 'friendship', npc: tokens[1], hearts: parseInt(tokens[2], 10) };
    }

    const source = {
      type: 'crafting',
      recipeName,
      outputCount: parseInt(outputCountStr, 10) || 1,
      ingredients,
      ...(unlockCondition && { unlockCondition }),
    };

    if (!craftingSourcesByGameId.has(outputGameId)) craftingSourcesByGameId.set(outputGameId, []);
    craftingSourcesByGameId.get(outputGameId).push(source);
  }
}

// cookingSourcesByGameId: output gameId -> [{ type:'cooking', recipeName, ingredients: [{gameId, amount}] }]
// CookingRecipes.json format: "ingredients/unused/outputId/unlock/displayName"
const cookingSourcesByGameId = new Map();

{
  const cookingRecipes = loadJson(path.join(GAME_EXPORTS_DIR, 'CookingRecipes.json'));
  for (const [recipeName, val] of Object.entries(cookingRecipes)) {
    const parts = val.split('/');
    if (parts.length < 3) continue;
    const outputIdStr = parts[2].trim();
    if (!outputIdStr) continue;
    const outputGameId = `(O)${outputIdStr}`;  // bare numeric IDs, Objects namespace

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

    // Parse unlock: 'default'=always known, 'l N'=player level, 'f NPC N'=friendship, 's Skill N'=skill
    const unlockStr = parts[3]?.trim() || 'default';
    let unlockCondition = null;
    if (unlockStr.startsWith('s ')) {
      const tokens = unlockStr.split(' ');
      unlockCondition = { type: 'skill', skill: tokens[1].toLowerCase(), level: parseInt(tokens[2], 10) };
    } else if (unlockStr.startsWith('l ') && unlockStr !== 'l 0') {
      unlockCondition = { type: 'level', level: parseInt(unlockStr.slice(2), 10) };
    } else if (unlockStr.startsWith('f ')) {
      const tokens = unlockStr.split(' ');
      unlockCondition = { type: 'friendship', npc: tokens[1], hearts: parseInt(tokens[2], 10) };
    }

    const source = {
      type: 'cooking',
      recipeName,
      ingredients,
      ...(unlockCondition && { unlockCondition }),
    };

    if (!cookingSourcesByGameId.has(outputGameId)) cookingSourcesByGameId.set(outputGameId, []);
    cookingSourcesByGameId.get(outputGameId).push(source);
  }
}

console.log(`  ✓ Shop sources: ${shopSourcesByGameId.size} object items, ${bigCraftableShopSourcesByGameId.size} big craftable items`);
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
    if (!tapItem.ItemId.startsWith('(O)')) continue;
    const gameId = tapItem.ItemId;
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

// mailSourcesByGameId: gameId (number) -> [{ type:'mail', mailKey, sender? }]
// bigCraftableMailSourcesByGameId: gameId (number) -> [{ type:'mail', mailKey, sender? }]
// furnitureMailSourcesByGameId: gameId (number) -> [{ type:'mail', mailKey, sender? }]
const mailSourcesByGameId = new Map();
const bigCraftableMailSourcesByGameId = new Map();
const furnitureMailSourcesByGameId = new Map();

// Parse a special order's RequiredTags string into JSON Logic conditions.
// Tags are comma-separated; prefix ! = negated.
function parseSpecialOrderTags(tagsStr) {
  if (!tagsStr) return null;
  const rules = [];
  for (const rawTag of tagsStr.split(',').map(t => t.trim()).filter(Boolean)) {
    const negated = rawTag.startsWith('!');
    const tag = negated ? rawTag.slice(1) : rawTag;
    const wrap = rule => negated ? { '!': rule } : rule;

    const eventMatch = tag.match(/^event_(\d+)$/);
    if (eventMatch) { rules.push(wrap({ in: [parseInt(eventMatch[1]), { var: 'player.events' }] })); continue; }

    const mailMatch = tag.match(/^mail_(.+)$/);
    if (mailMatch) { rules.push(wrap({ in: [mailMatch[1], { var: 'player.mail' }] })); continue; }

    const seasonMatch = tag.match(/^season_(spring|summer|fall|winter)$/);
    if (seasonMatch) { rules.push(wrap({ '==': [{ var: 'world.season' }, seasonMatch[1]] })); continue; }

    if (tag === 'island') { rules.push(wrap({ '==': [{ var: 'world.islandUnlocked' }, true] })); continue; }
    // Unknown/unmodeled tags (NOT_IMPLEMENTED, rule_*, etc.) — skip
  }
  if (rules.length === 0) return null;
  if (rules.length === 1) return rules[0];
  return { and: rules };
}

// Build a map of mailKey -> { isSpecialOrder, condition } from game data
// Special Orders: mail sent as reward for completing a named order from an NPC
// TriggerActions: mail sent when a game condition is met
const mailContextByKey = new Map();

for (const [orderId, order] of Object.entries(gameData.specialOrders)) {
  for (const reward of (order.Rewards || [])) {
    if (reward.Type === 'Mail' && reward.Data?.MailReceived) {
      const tagCondition = parseSpecialOrderTags(order.RequiredTags);
      mailContextByKey.set(reward.Data.MailReceived, {
        isSpecialOrder: true,
        requester: order.Requester || null,
        ...(tagCondition && { condition: tagCondition }),
      });
    }
  }
}

for (const [, action] of Object.entries(gameData.triggerActions)) {
  const allActions = [action.Action, ...(action.Actions || [])].filter(Boolean);
  for (const a of allActions) {
    const m = a.match(/^AddMail\s+\S+\s+(\S+)/);
    if (m && action.Condition) {
      const key = m[1];
      if (!mailContextByKey.has(key)) {
        mailContextByKey.set(key, { triggerCondition: action.Condition });
      }
    }
  }
}

// Hand-curated mail overrides for mails sent by hardcoded C# game logic (not data-driven)
const mailOverrides = loadJson(path.join(RULES_DIR, 'mail-overrides.json'));
const MAIL_HARDCODED_CONDITIONS = mailOverrides.conditions;
const MAIL_SENDER_OVERRIDES = mailOverrides.senders;

for (const [mailKey, mailText] of Object.entries(gameData.mail)) {
  if (typeof mailText !== 'string') continue;

  // Extract sender from signature: `-Name` immediately before %item or a caret/line separator.
  // The name is 1-4 capitalized words; optional trailing punctuation/words are ignored.
  // We use the LAST such match to skip any hyphens in the body.
  const senderMatches = [...mailText.matchAll(/[-–]\s*([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,3})\s*(?:[^A-Za-z\s%^].*?)?(?:%item|%%|\^|$)/g)];
  const senderMatch = senderMatches.length > 0 ? senderMatches[senderMatches.length - 1] : null;
  const sender = MAIL_SENDER_OVERRIDES[mailKey] ?? (senderMatch ? senderMatch[1].trim() : null);

  // Parse all %item id ... %% blocks
  const itemBlockMatches = [...mailText.matchAll(/%item\s+id\s+((?:(?:\([A-Z]+\)\S+|\d+)(?:\s+\d+)?\s*)+)%%/g)];
  for (const blockMatch of itemBlockMatches) {
    const tokens = blockMatch[1].trim().split(/\s+/);
    let i = 0;
    while (i < tokens.length) {
      const idToken = tokens[i++];
      // Skip quantity tokens
      if (/^\d+$/.test(idToken)) continue;

      const bcMatch = idToken.match(/^\(BC\)(\S+)$/);
      const furnitureMatch = idToken.match(/^\(F\)(\S+)$/);
      const objectMatch = idToken.match(/^\(O\)(\S+)$/);

      let targetMap, gameId;
      if (bcMatch) {
        targetMap = bigCraftableMailSourcesByGameId;
        gameId = idToken;  // already "(BC)..."
      } else if (furnitureMatch) {
        targetMap = furnitureMailSourcesByGameId;
        gameId = idToken;  // already "(F)..."
      } else if (objectMatch) {
        targetMap = mailSourcesByGameId;
        gameId = idToken;  // already "(O)..."
      } else if (gameData.objects[idToken] !== undefined) {
        targetMap = mailSourcesByGameId;
        gameId = `(O)${idToken}`;  // bare numeric ID, add prefix
      } else {
        continue;
      }
      const source = { type: 'mail', mailKey };
      if (sender) source.sender = sender;
      const ctx = mailContextByKey.get(mailKey) || MAIL_HARDCODED_CONDITIONS[mailKey];
      if (ctx) {
        if (ctx.isSpecialOrder) source.isSpecialOrder = true;
        // condition: JSON Logic from special order tags or trigger actions, or plain string for hardcoded
        if (ctx.condition) {
          source.condition = ctx.condition; // already parsed (from parseSpecialOrderTags)
        } else if (ctx.triggerCondition) {
          const parsed = parseCondition(ctx.triggerCondition);
          if (parsed) source.condition = parsed;
        }
      }

      if (!targetMap.has(gameId)) targetMap.set(gameId, []);
      targetMap.get(gameId).push(source);

      // Skip quantity if present
      if (i < tokens.length && /^\d+$/.test(tokens[i])) i++;
    }
  }
}

console.log(`  ✓ Mail sources: ${mailSourcesByGameId.size} object items, ${bigCraftableMailSourcesByGameId.size} big craftable items, ${furnitureMailSourcesByGameId.size} furniture items`);

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
function buildAcquisitionSources(gameId) {
  const sources = [];
  for (const map of [
    shopSourcesByGameId, forageSourcesByGameId, monsterDropsByGameId,
    fishPondSourcesByGameId, garbageCanSourcesByGameId, tillingSourcesByGameId,
    craftingSourcesByGameId, cookingSourcesByGameId, tapperSourcesByGameId,
    mailSourcesByGameId,
  ]) {
    if (map.has(gameId)) sources.push(...map.get(gameId));
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

  const seedGameId = `(O)${seedId}`;
  const seedObject = gameData.objects[seedId];
  const seedName = seedObject?.Name || `${cropName} Seeds`;

  const cropEntry = {
    id: toKebabCase(cropName),
    gameId: `(O)${harvestId}`,
    name: cropName,
    icon: `assets/objects/${toIconFilename(cropName)}`,
    type: cropType,
    gameCategory: category,
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
  item.sellingLocations = getSellingLocations(item.gameCategory, shopSellingLocations);
  const seedSource = item.seedSource;
  delete item.seedSource;
  item.sources = [
    seedSource,
    ...buildAcquisitionSources(item.gameId),
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
  const mineForageQid = `(O)${mineForage.gameId}`;
  if (!forageSourcesByGameId.has(mineForageQid)) forageSourcesByGameId.set(mineForageQid, []);
  forageSourcesByGameId.get(mineForageQid).push({ type: 'forage', location: locationName });
}

// Filter items with forage_item context tag (plus special cases)
for (const [gameId, objectData] of Object.entries(gameData.objects)) {
  const itemGameId = `(O)${gameId}`;
  const isForageItem = objectData.ContextTags?.includes('forage_item');
  const isSpecialForage = gameId === '416'; // Snow Yam (lacks forage_item tag but is forage)

  if (!isForageItem && !isSpecialForage) continue;

  const friendlyId = toKebabCase(objectData.Name);

  // Get location and season data
  const locationInfo = forageLocationMap.get(parseGameId(gameId)) || { locations: new Set(), seasons: new Set() };
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
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
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
  const category = item.originalGameCategory !== undefined ? item.originalGameCategory : item.gameCategory;
  item.sellingLocations = getSellingLocations(category, shopSellingLocations);
  item.sources = buildAcquisitionSources(item.gameId);
});


// Merge forage sources into crops that also appear as forage (e.g. Grape, Wild Horseradish)
const forageItemsByGameId = new Map(forageData.map(f => [f.gameId, f]));
for (const crop of cropData) {
  const forageItem = forageItemsByGameId.get(crop.gameId);
  if (!forageItem) continue;
  const forageSources = (forageItem.sources || []).filter(s => s.type === 'forage');
  if (forageSources.length > 0) {
    const existingSrcJson = new Set((crop.sources || []).map(s => JSON.stringify(s)));
    for (const src of forageSources) {
      if (!existingSrcJson.has(JSON.stringify(src))) crop.sources.push(src);
    }
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
    item.originalGameCategory = item.gameCategory; // -4 (Fish) - used for professions/selling
    item.displayGameCategory = -81; // Forage - used for modal subtitle

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
    icon: `assets/objects/${toIconFilename(fruitName)}`,
    price: fruitObject.Price || 0,
    edibility: fruitObject.Edibility || -300,
    gameCategory: fruitObject.Category || 0,
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
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    seasons: seasons,
    treeId: sourceTree ? sourceTree.id : null,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations),
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
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    mineralType: mineralType,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations),
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
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    producedBy: producedBy,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations),
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
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    rarity: rarity,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations),
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
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    canBeGifted: objectData.CanBeGivenAsGift !== false,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations),
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
    icon: 'assets/objects/StarToken.png',
    price: 0,
    edibility: -300,
    gameCategory: 0,
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
    icon: 'assets/objects/QiCoin.png',
    price: 0,
    edibility: -300,
    gameCategory: 0,
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

for (const [rawId, bigCraftable] of Object.entries(gameData.bigCraftables)) {
  const id = parseGameId(rawId);
  // Skip internal placeholder entries
  if (!bigCraftable.Name || bigCraftable.Name.includes('??')) continue;

  const friendlyId = toKebabCase(bigCraftable.Name);
  const spriteName = extractSpriteNameFromDisplayName(bigCraftable.DisplayName);
  const iconFilename = spriteName ? `${spriteName}.png` : `${toIconFilename(bigCraftable.Name)}`;

  // Attach crafting sources so modal can show "How to obtain"
  const sources = craftingSourcesByGameId.has(id)
    ? craftingSourcesByGameId.get(id)
    : [];

  // Attach shop sources (some big-craftables are sold in shops, e.g. Catalogues)
  if (bigCraftableShopSourcesByGameId.has(id)) {
    sources.push(...bigCraftableShopSourcesByGameId.get(id));
  }

  // Attach mail sources (some big-craftables are received via mail, e.g. Sewing Machine)
  if (bigCraftableMailSourcesByGameId.has(id)) {
    sources.push(...bigCraftableMailSourcesByGameId.get(id));
  }

  bigCraftableData.push({
    type: 'big-craftable',
    id: friendlyId,
    gameId: id,
    name: bigCraftable.Name,
    icon: `assets/objects/${iconFilename}`,
    price: bigCraftable.Price || 0,
    edibility: -300, // BigCraftables are not edible
    gameCategory: 'Big Craftable',
    contextTags: bigCraftable.ContextTags || [],
    bundles: [],
    gifts: {},
    sources,
  });
}

deduplicateIds(bigCraftableData);
console.log(`  ✓ Processed ${bigCraftableData.length} big craftables`);

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

  // Skip AgedRoe and Caviar - both handled manually later via roe-mechanics.json rules
  if (recipe.outputName === 'AgedRoe') continue;
  if (recipe.outputItemId === rules.roeMechanics.caviar.gameId) continue;

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
          gameCategory: obj.Category || -81,
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
          gameCategory: -4,
          price: obj.Price || 0
        }));
    }

    const inputDetails = matchingItems.map(item => ({
      inputId: item.id,
      inputName: item.name,
      inputGameId: item.gameId,
      inputBasePrice: item.price,
      inputGameCategory: item.gameCategory,
      inputType: item.type,
      outputPrice: Math.floor(item.price * formula.multiplier + formula.addition),
      outputIridiumPrice: Math.floor((item.price * formula.multiplier + formula.addition) * rules.qualityMultipliers.artisanProfession)
    })).sort((a, b) => b.outputPrice - a.outputPrice);

    const machineSource = {
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
    };

    const artisanItem = {
      type: 'artisan',
      id: toKebabCase(recipe.outputName),
      gameId: `(O)${outputItemId}`,
      name: displayName,
      gameCategory: objectData.Category || -26,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/objects/${getIconFilename(outputItemId, recipe.outputName, objectData)}`,
      contextTags: objectData.ContextTags || [],
      ...(parseItemBuffs(objectData) && { buffs: parseItemBuffs(objectData) }),
      sources: [machineSource, ...buildAcquisitionSources(`(O)${outputItemId}`)],
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
        inputGameCategory: inputObject.Category,
        inputType: inputObject.Type,
        outputPrice: objectData.Price || 0,
        outputIridiumPrice: Math.floor((objectData.Price || 0) * 1.4)
      };
    }).filter(Boolean);

    const machineSource = {
      type: 'machine',
      machine: recipe.machine,
      machineId: recipe.machineId,
      inputType: 'specific',
      valueFormula: `${objectData.Price || 0}`,
      inputDetails
    };

    const artisanItem = {
      type: 'artisan',
      id: toKebabCase(objectData.Name),
      gameId: `(O)${outputItemId}`,
      name: objectData.Name,
      gameCategory: objectData.Category || -26,
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/objects/${getIconFilename(outputItemId, objectData.Name, objectData)}`,
      contextTags: objectData.ContextTags || [],
      ...(parseItemBuffs(objectData) && { buffs: parseItemBuffs(objectData) }),
      sources: [machineSource, ...buildAcquisitionSources(`(O)${outputItemId}`)],
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
    const existing = artisanData.find(item => item.gameId === `(O)${outputItemId}`);
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
    const gameId = `(O)${rawId}`;
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

  const objectData = lookupRawItem(gameId);
  if (!objectData) {
    console.warn(`  Warning: Animal product ${gameId} not found in Objects.json`);
    continue;
  }

  const item = {
    type: 'animal-product',
    id: getUniqueItemId(gameId, objectData.Name),
    gameId,
    name: objectData.Name,
    gameCategory: objectData.Category || 0,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    hasQuality: true,
    sources: animalSources.map(a => ({ type: 'animal', animalName: a.animalName, animalId: a.animalId })),
    contextTags: objectData.ContextTags || [],
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations),
    bundles: [],
    gifts: {},
  };

  item.sources.push(...buildAcquisitionSources(gameId));

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

  const objectData = lookupRawItem(gameId);
  if (!objectData) {
    console.warn(`  Warning: Tapper item ${gameId} not found in Objects.json`);
    continue;
  }

  const item = {
    type: 'artisan',
    id: toKebabCase(objectData.Name),
    gameId,
    name: objectData.Name,
    gameCategory: objectData.Category || -27,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    sources: [
      ...tapSources,
      ...buildAcquisitionSources(gameId),
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
  // Numeric: "136", String: "Goby" — fish are always in the Objects namespace
  const gameIdValue = `(O)${gameId}`;

  // Get additional data from Objects.json
  const objectData = gameData.objects[gameId];

  if (!objectData) {
    console.warn(`  Warning: Fish ${gameId} (${fishName}) not found in Objects.json`);
    continue;
  }

  const friendlyId = toKebabCase(fishName);

  // Generate icon path - replace spaces with underscores to match file naming
  const iconFileName = toIconFilename(fishName);

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
      gameCategory: objectData.Category || 0,
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
      gameCategory: objectData.Category || 0,
      contextTags: objectData.ContextTags || [],
      bundles: [],
      gifts: {}
    });
  }
}

console.log(`  Processed ${fishData.length} fish`);

// Add selling locations and acquisition sources to fish
fishData.forEach(item => {
  const category = item.originalGameCategory !== undefined ? item.originalGameCategory : item.gameCategory;
  item.sellingLocations = getSellingLocations(category, shopSellingLocations);
  item.sources = buildAcquisitionSources(item.gameId);
});

// Extract and merge location data
console.log('\nExtracting fish locations...');
const { extractFishLocations } = require('./helpers/ExtractFishLocations.cjs');
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
  return lookupRawItem(fish.gameId)?.ContextTags?.includes('fish_has_roe');
});

// Calculate roe values for each fish using formula from rules
const roeInputDetails = fishWithRoe.map(fish => {
  const roePrice = calculateRoePrice(fish.price);
  return {
    inputId: fish.id,
    inputName: fish.name,
    inputGameId: fish.gameId,
    inputBasePrice: fish.price,
    inputGameCategory: -4, // Fish category
    inputType: 'fish',
    outputPrice: roePrice,
    outputIridiumPrice: Math.floor(roePrice * rules.qualityMultipliers.artisanProfession)
  };
}).sort((a, b) => b.outputPrice - a.outputPrice);

const roeObjectData = gameData.objects['812'];

const roeItem = {
  id: 'roe',
  gameId: '(O)812',
  name: 'Roe',
  type: 'artisan',
  gameCategory: roeObjectData?.Category || -26,
  price: roeObjectData?.Price || 30,
  edibility: roeObjectData?.Edibility || 20,
  icon: 'assets/objects/Roe.png',
  contextTags: roeObjectData?.ContextTags || [],
  sources: [
    {
      type: 'machine',
      machine: 'Fish Pond',
      machineId: 'fish-pond',
      inputType: 'fish',
      processingTimeMinutes: rules.roeMechanics.roe.processingTimeMinutes,
      valueFormula: rules.roeMechanics.roe.formula,
      inputDetails: roeInputDetails
    },
    ...buildAcquisitionSources(`(O)812`),
  ],
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
const sturgeonGameId = `(O)${rules.roeMechanics.caviar.inputFish}`;
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
    inputGameCategory: -4, // Fish category (actual input is roe, but source is fish)
    inputType: 'fish',
    outputPrice: agedRoePrice,
    outputIridiumPrice: Math.floor(agedRoePrice * rules.qualityMultipliers.artisanProfession)
  };
}).sort((a, b) => b.outputPrice - a.outputPrice);

const agedRoeObjectData = gameData.objects['447'];

const agedRoeItem = {
  id: 'aged-roe',
  gameId: '(O)447',
  name: 'Aged Roe',
  type: 'artisan',
  gameCategory: agedRoeObjectData?.Category || -26,
  price: agedRoeObjectData?.Price || 100,
  edibility: agedRoeObjectData?.Edibility || 40,
  icon: 'assets/objects/AgedRoe.png',
  contextTags: agedRoeObjectData?.ContextTags || [],
  sources: [
    {
      type: 'machine',
      machine: rules.roeMechanics.agedRoe.producedBy,
      machineId: 'preserves-jar',
      inputType: rules.roeMechanics.agedRoe.inputType,
      processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
      valueFormula: rules.roeMechanics.agedRoe.formula,
      inputDetails: agedRoeInputDetails
    },
    ...buildAcquisitionSources(`(O)447`),
  ],
  processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
  bundles: [],
  gifts: {}
};

artisanData.push(agedRoeItem);
console.log(`  ✅ Added Aged Roe with ${fishWithAgedRoe.length} fish variants (excludes Sturgeon)`);

// ============================================================================
// Add Caviar (Sturgeon Roe in Preserves Jar) — driven by roe-mechanics.json
// ============================================================================
console.log('\nAdding Caviar...');

const caviarRules = rules.roeMechanics.caviar;
const caviarFishObject = gameData.objects[caviarRules.inputFish];
const caviarRoePrice = calculateRoePrice(
  gameData.objects[String(caviarRules.inputFish)]?.Price || 0
);
const caviarObjectData = gameData.objects[String(caviarRules.gameId)];

if (caviarObjectData && caviarFishObject) {
  const caviarItem = {
    id: 'caviar',
    gameId: `(O)${caviarRules.gameId}`,
    name: caviarObjectData.Name,
    type: 'artisan',
    gameCategory: caviarObjectData.Category || -26,
    price: caviarObjectData.Price || 0,
    edibility: caviarObjectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(caviarRules.gameId, caviarObjectData.Name, caviarObjectData)}`,
    contextTags: caviarObjectData.ContextTags || [],
    sources: [
      {
        type: 'machine',
        machine: rules.roeMechanics.agedRoe.producedBy, // same machine: Preserves Jar
        machineId: 'preserves-jar',
        inputType: 'specific',
        processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
        valueFormula: `${caviarObjectData.Price || 0}`,
        inputDetails: [{
          inputId: toKebabCase(caviarFishObject.Name),  // "sturgeon" — navigates to fish
          inputName: `${caviarFishObject.Name} Roe`,    // display label: "Sturgeon Roe"
          inputGameId: `(O)${rules.roeMechanics.roe.gameId}`,   // "(O)812" (Roe item)
          inputFishGameId: `(O)${caviarRules.inputFish}`,       // "(O)698" (Sturgeon fish)
          inputBasePrice: caviarRoePrice,
          inputGameCategory: -23,
          inputType: 'specific',
          outputPrice: caviarObjectData.Price || 0,
          outputIridiumPrice: Math.floor((caviarObjectData.Price || 0) * rules.qualityMultipliers.artisanProfession)
        }]
      },
      ...buildAcquisitionSources(`(O)${caviarRules.gameId}`),
    ],
    processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
    bundles: [],
    gifts: {}
  };
  artisanData.push(caviarItem);
  console.log(`  ✅ Added Caviar (from ${caviarFishObject.Name} Roe via rules)`);
} else {
  console.warn(`  Warning: Could not build Caviar — missing game data for gameId ${caviarRules.gameId} or fish ${caviarRules.inputFish}`);
}

// Add selling locations to all artisan items
console.log('\nAdding selling locations to artisan items...');
artisanData.forEach(item => {
  item.sellingLocations = getSellingLocations(item.gameCategory, shopSellingLocations);
});
console.log(`  ✅ Added selling locations to ${artisanData.length} artisan items`);

// Process NPCs/Villagers
console.log('\nProcessing villagers...');
const villagerData = [];

// Canonical list of 34 social villagers (Characters.json has 48 entries including monsters/animals)
const villagerNames = [
  'Abigail', 'Alex', 'Elliott', 'Emily', 'Haley', 'Harvey', 'Leah', 'Maru',
  'Penny', 'Sam', 'Sebastian', 'Shane', 'Caroline', 'Clint', 'Demetrius',
  'Dwarf', 'Evelyn', 'George', 'Gus', 'Jas', 'Jodi', 'Kent', 'Krobus',
  'Leo', 'Lewis', 'Linus', 'Marnie', 'Pam', 'Pierre', 'Robin', 'Sandy',
  'Vincent', 'Willy', 'Wizard'
];

// Mappings for numeric enum fields in Characters.json
const BIRTH_SEASON_MAP = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };
const GENDER_MAP = { 0: 'male', 1: 'female', 2: 'other' };
const AGE_MAP = { 0: 'adult', 1: 'teen', 2: 'child' };
const MANNER_MAP = { 0: 'neutral', 1: 'polite', 2: 'rude' };
const SOCIAL_ANXIETY_MAP = { 0: 'outgoing', 1: 'shy', 2: 'neutral' };
const OPTIMISM_MAP = { 0: 'positive', 1: 'negative', 2: 'neutral' };

for (const name of villagerNames) {
  const friendlyId = toKebabCase(name);
  const charData = gameData.characters?.[name];

  const villager = {
    type: 'villager',
    id: friendlyId,
    name: name,
    icon: `assets/villagers/${name}.png`,
  };

  if (charData) {
    if (charData.BirthSeason !== undefined && charData.BirthDay !== undefined) {
      villager.birthday = {
        season: BIRTH_SEASON_MAP[charData.BirthSeason] ?? null,
        day: charData.BirthDay,
      };
    }
    if (charData.Gender !== undefined) villager.gender = GENDER_MAP[charData.Gender] ?? null;
    if (charData.Age !== undefined) villager.age = AGE_MAP[charData.Age] ?? null;
    if (charData.Manner !== undefined) villager.manner = MANNER_MAP[charData.Manner] ?? null;
    if (charData.SocialAnxiety !== undefined) villager.socialAnxiety = SOCIAL_ANXIETY_MAP[charData.SocialAnxiety] ?? null;
    if (charData.Optimism !== undefined) villager.optimism = OPTIMISM_MAP[charData.Optimism] ?? null;
    if (charData.HomeRegion) villager.homeRegion = charData.HomeRegion;
    if (charData.CanBeRomanced) villager.canBeRomanced = true;
    if (charData.LoveInterest) villager.loveInterest = toKebabCase(charData.LoveInterest);
  }

  villagerData.push(villager);
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
  if (item.gameCategory !== undefined) {
    if (entries.includes(item.gameCategory.toString())) return true;
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
    if (item.IsRecipe) continue;
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
  const seedGameIdBare = parseGameId(seedGameIdStr);
  const seedGameId = `(O)${seedGameIdStr}`;

  // Skip saplings
  if (SKIP_SEED_IDS.has(seedGameIdBare)) continue;

  // Skip tree seeds (tree_seed_item context tag)
  const seedObjectData = gameData.objects[seedGameIdStr];
  if (!seedObjectData) {
    console.warn(`  Warning: Seed ${seedGameIdStr} not found in Objects.json`);
    continue;
  }
  if (seedObjectData.ContextTags && seedObjectData.ContextTags.includes('tree_seed_item')) continue;

  const sellers = Array.from(seedSellersMap.get(seedGameIdBare) || []).sort();
  const sellPrice = seedObjectData.Price || 0;

  let produces;
  let seasons;

  if (SEASONAL_SEED_IDS.has(seedGameIdBare)) {
    // Seasonal seeds: game engine randomly picks from all season forage items (not just HarvestItemId)
    const growthDays = (cropInfo.DaysInPhase || []).reduce((sum, d) => sum + d, 0);
    const produceGameIds = SEASONAL_SEED_PRODUCE_GAME_IDS[seedGameIdBare] || [];
    produces = produceGameIds.map(gid => {
      const forageItem = forageByGameId.get(`(O)${gid}`);
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
    icon: `assets/objects/${toIconFilename(seedObjectData.Name)}`,
    type: 'seed',
    gameCategory: -74,
    price: sellPrice,
    buyPrice: sellPrice * 2,
    seasons,
    produces,
    sellers,
    sources: buildAcquisitionSources(seedGameId),
    sellingLocations: getSellingLocations(-74, shopSellingLocations),
  });
}

// Mixed Seeds (770): no Crops.json entry, random seasonal output
if (gameData.objects[String(MIXED_SEEDS_ID)]) {
  const obj = gameData.objects[String(MIXED_SEEDS_ID)];
  const produces = MIXED_SEEDS_PRODUCE_GAME_IDS
    .map(gid => forageByGameId.get(`(O)${gid}`))
    .filter(Boolean)
    .map(item => ({ ...makeProducesEntry(item), growthDays: 7 }));
  const sellPrice = obj.Price || 0;
  seedData.push({
    id: toKebabCase(obj.Name),
    gameId: `(O)${MIXED_SEEDS_ID}`,
    name: obj.Name,
    icon: `assets/objects/${toIconFilename(obj.Name)}`,
    type: 'seed',
    gameCategory: -74,
    price: sellPrice,
    buyPrice: sellPrice * 2,
    seasons: ['spring', 'summer', 'fall', 'winter'],
    produces,
    sellers: Array.from(seedSellersMap.get(MIXED_SEEDS_ID) || []).sort(),
    sources: buildAcquisitionSources(`(O)${MIXED_SEEDS_ID}`),
    sellingLocations: getSellingLocations(-74, shopSellingLocations),
  });
}

// Mixed Flower Seeds: no Crops.json entry, random seasonal flower output
if (MIXED_FLOWER_SEEDS_ID && gameData.objects[String(MIXED_FLOWER_SEEDS_ID)]) {
  const obj = gameData.objects[String(MIXED_FLOWER_SEEDS_ID)];
  const produces = MIXED_FLOWER_SEEDS_PRODUCE_GAME_IDS
    .map(gid => {
      const crop = cropData.find(c => c.gameId === `(O)${gid}`);
      return crop ? makeProducesEntry(crop) : null;
    })
    .filter(Boolean);
  const sellPrice = obj.Price || 0;
  seedData.push({
    id: toKebabCase(obj.Name),
    gameId: `(O)${MIXED_FLOWER_SEEDS_ID}`,
    name: obj.Name,
    icon: `assets/objects/${toIconFilename(obj.Name)}`,
    type: 'seed',
    gameCategory: -74,
    price: sellPrice,
    buyPrice: sellPrice * 2,
    seasons: ['spring', 'summer', 'fall'],
    produces,
    sellers: Array.from(seedSellersMap.get(MIXED_FLOWER_SEEDS_ID) || []).sort(),
    sources: buildAcquisitionSources(`(O)${MIXED_FLOWER_SEEDS_ID}`),
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

// Map context tags to catalogue store IDs and names
const FURNITURE_CATALOGUE_MAP = {
  'collection_joja':   { storeId: 'store-joja-furniture-catalogue',   storeName: 'Joja Furniture Catalogue' },
  'collection_junimo': { storeId: 'store-junimo-furniture-catalogue',  storeName: 'Junimo Furniture Catalogue' },
  'collection_retro':  { storeId: 'store-retro-furniture-catalogue',   storeName: 'Retro Furniture Catalogue' },
  'collection_trash':  { storeId: 'store-trash-furniture-catalogue',   storeName: 'Trash Can Furniture Catalogue' },
  'collection_wizard': { storeId: 'store-wizard-furniture-catalogue',  storeName: 'Wizard Furniture Catalogue' },
};
const DEFAULT_CATALOGUE = { storeId: 'store-furniture-catalogue', storeName: 'Furniture Catalogue' };

// Furniture format: name/type/tilesheetSize/boundingBoxSize/rotations/price/placementRestriction/displayName/...
// Named string IDs (e.g. "JojaCatalogue") and numeric IDs (e.g. "0")
for (const [rawKey, furnitureStr] of Object.entries(gameData.furniture)) {
  const parts = furnitureStr.split('/');
  const rawName = parts[0];
  const furnitureType = parts[1]; // "chair", "bench", "decor", "painting", "lamp", etc.
  const price = parseInt(parts[5], 10) || 0;
  const contextTag = parts[11] || '';
  const furnitureRule = rules.furnitureNames[rawKey];

  // Use display name override if available, then string table lookup, then raw name
  const name = furnitureRule?.name || stringTables['Furniture']?.[rawName] || resolveLocalizedText(rawName);

  const gameId = parseGameId(rawKey);
  const id = toKebabCase(name) || toKebabCase(rawKey);

  // Wiki name: use override if available, else derive from display name
  const wikiName = furnitureRule?.wikiName || name.replace(/'/g, '').replace(/\s+/g, '_');

  // Icon: if wikiName override exists, derive from that (strips underscores); else from display name
  const iconBase = furnitureRule?.wikiName
    ? furnitureRule.wikiName.replace(/_/g, ' ')
    : name;
  const icon = `assets/objects/${toIconFilename(iconBase)}`;

  const sources = [];
  if (furnitureShopSourcesByGameId.has(gameId)) {
    sources.push(...furnitureShopSourcesByGameId.get(gameId));
  }
  if (furnitureMailSourcesByGameId.has(gameId)) {
    sources.push(...furnitureMailSourcesByGameId.get(gameId));
  }

  // Add catalogue source based on context tag (price 0 = freely available via catalogue)
  const catalogue = FURNITURE_CATALOGUE_MAP[contextTag] || DEFAULT_CATALOGUE;
  sources.push({ type: 'shop', storeId: catalogue.storeId, storeName: catalogue.storeName, price: 0 });

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

const hatOverrides = rules.hatOverrides.overrides || {};
const hatIconOverrides = rules.hatOverrides.iconOverrides || {};

// Hat format: name/description/hairstyleOffset/isMask/iconIndex/displayName[/spriteIndex]
for (const [rawKey, hatStr] of Object.entries(gameData.hats)) {
  const override = hatOverrides[rawKey] || {};
  const parts = hatStr.split('/');
  const name = override.name || parts[5] || parts[0]; // displayName at [5], fallback to [0]
  const description = parts[1] || '';
  const isMask = parts[3] === 'true';

  const gameId = parseGameId(rawKey);
  const id = override.id || toKebabCase(name) || toKebabCase(rawKey);

  // Icon: per-hat override → gameId icon override → derive from name
  const iconFile = override.icon || hatIconOverrides[rawKey] || toIconFilename(name);
  const icon = iconFile ? `assets/objects/${iconFile}` : null;

  const sources = override.sources
    ? override.sources.map(src => {
        if (!src.condition) return src;
        const itemNames = collectItemConditionNames(src.condition, gameData.objects);
        return itemNames ? { ...src, conditionItemNames: itemNames } : src;
      })
    : [];
  if (hatShopSourcesByGameId.has(gameId)) {
    sources.push(...hatShopSourcesByGameId.get(gameId));
  }

  hatData.push({ id, gameId, name, description, isMask, icon, sources });
}

deduplicateIds(hatData);

hatData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${hatData.length} hats`);

// ============================================================================
// Collect all already-processed Objects.json gameIds (to avoid double-processing)
// NOTE: furnitureData and hatData use a different gameId namespace (Furniture.json /
// Hats.json), so they are intentionally excluded here — their numeric IDs can
// collide with Objects.json IDs.
// ============================================================================
const alreadyProcessedGameIds = new Set();
const allExistingObjectArrays = [
  fishData, artisanData, animalProductData, cropData, seedData, forageData,
  fruitTreeData, treeFruitsData, mineralData, metalBarData, monsterLootData,
  resourceData, bigCraftableData,
  // furnitureData and hatData are explicitly excluded (different ID namespace)
];
for (const arr of allExistingObjectArrays) {
  for (const item of arr) {
    if (item.gameId !== undefined) alreadyProcessedGameIds.add(String(item.gameId));
  }
}

// Helper to make a base item object from an Objects.json entry
function makeBaseItem(gameId, objectData, type) {
  const buffs = parseItemBuffs(objectData);
  const resolvedName = resolveLocalizedText(objectData.DisplayName) || objectData.Name;
  const item = {
    type,
    id: getUniqueItemId(gameId, objectData.Name),
    gameId,
    name: resolvedName,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility ?? -300,
    gameCategory: objectData.Category ?? 0,
    contextTags: objectData.ContextTags || [],
    canBeGifted: objectData.CanBeGivenAsGift !== false,
    sellingLocations: getSellingLocations(objectData.Category ?? 0, shopSellingLocations),
    bundles: [],
    gifts: {},
  };
  if (buffs) item.buffs = buffs;
  return item;
}

// ============================================================================
// Process Food / Cooking (category -7)
// ============================================================================
console.log('\nProcessing food (cooking)...');
const foodData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -7) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'food');
  item.sources = buildAcquisitionSources(gameId);
  foodData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(foodData);
foodData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${foodData.length} food items`);

// ============================================================================
// Process Ores (category -15, excluding metal bars already processed)
// ============================================================================
console.log('\nProcessing ores...');
const oreData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -15) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'ore');
  item.sources = buildAcquisitionSources(gameId);
  oreData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(oreData);
oreData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${oreData.length} ores`);

// ============================================================================
// Process Geode Minerals (category -12, excluding gems/minerals already processed)
// ============================================================================
console.log('\nProcessing geode minerals...');
const geodeMineralData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -12) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'geode-mineral');
  item.sources = buildAcquisitionSources(gameId);
  geodeMineralData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(geodeMineralData);
geodeMineralData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${geodeMineralData.length} geode minerals`);

// ============================================================================
// Process Bombs / Crafted Explosives / Fences / Sprinklers (category -8)
// ============================================================================
console.log('\nProcessing bombs and crafted items...');
const bombData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -8) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'crafted');
  item.sources = buildAcquisitionSources(gameId);
  bombData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(bombData);
bombData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${bombData.length} crafted items (bombs/fences/sprinklers)`);

// ============================================================================
// Process Fertilizers (category -19)
// ============================================================================
console.log('\nProcessing fertilizers...');
const fertilizerData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -19) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'fertilizer');
  item.sources = buildAcquisitionSources(gameId);
  fertilizerData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(fertilizerData);
fertilizerData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${fertilizerData.length} fertilizers`);

// ============================================================================
// Process Fishing Bait (category -21)
// ============================================================================
console.log('\nProcessing fishing bait...');
const baitData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -21) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'bait');
  item.sources = buildAcquisitionSources(gameId);
  baitData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(baitData);
baitData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${baitData.length} fishing bait items`);

// ============================================================================
// Process Fishing Tackle (category -22)
// ============================================================================
console.log('\nProcessing fishing tackle...');
const tackleData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -22) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'tackle');
  item.sources = buildAcquisitionSources(gameId);
  tackleData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(tackleData);
tackleData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${tackleData.length} fishing tackle items`);

// ============================================================================
// Process Flooring / Paths (category -24)
// ============================================================================
console.log('\nProcessing flooring...');
const flooringData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -24) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'flooring');
  item.sources = buildAcquisitionSources(gameId);
  flooringData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(flooringData);
flooringData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${flooringData.length} flooring items`);

// ============================================================================
// Process Trash / Junk (category -20)
// ============================================================================
console.log('\nProcessing trash...');
const trashData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -20) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'trash');
  item.canBeGifted = false;
  item.sources = buildAcquisitionSources(gameId);
  trashData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(trashData);
trashData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${trashData.length} trash items`);

// ============================================================================
// Process Books (category -102 and -103)
// ============================================================================
console.log('\nProcessing books...');
const bookData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -102 && objectData.Category !== -103) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'book');
  item.sources = buildAcquisitionSources(gameId);
  bookData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(bookData);
bookData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${bookData.length} books (${bookData.filter(b => b.gameCategory === -103).length} skill books, ${bookData.filter(b => b.gameCategory === -102).length} power books)`);

// ============================================================================
// Process Artifacts / Archaeology (category 0, Type=Arch)
// ============================================================================
console.log('\nProcessing artifacts...');
const artifactData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== 0) continue;
  if (objectData.Type !== 'Arch') continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'artifact');
  item.sources = buildAcquisitionSources(gameId);
  artifactData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(artifactData);
artifactData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${artifactData.length} artifacts`);

// ============================================================================
// Process Rings (category 0, Type=Ring)
// ============================================================================
console.log('\nProcessing rings...');
const ringData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== 0) continue;
  if (objectData.Type !== 'Ring') continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'ring');
  item.sources = buildAcquisitionSources(gameId);
  ringData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(ringData);
ringData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${ringData.length} rings`);

// ============================================================================
// Process Tree Seeds (category -74, not yet processed as crop seeds)
// ============================================================================
console.log('\nProcessing tree seeds...');
const treeSeedData = [];

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (objectData.Category !== -74) continue;
  if (alreadyProcessedGameIds.has(rawId)) continue;

  const gameId = `(O)${rawId}`;
  const item = makeBaseItem(gameId, objectData, 'tree-seed');
  item.sources = buildAcquisitionSources(gameId);
  treeSeedData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(treeSeedData);
treeSeedData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${treeSeedData.length} tree seeds`);

// ============================================================================
// Process Remaining Misc Items (everything not yet processed)
// Includes: crafting ingredients, quest items, special items, etc.
// Excludes: category -999 (litter/stones), furniture, hats (different json)
// ============================================================================
console.log('\nProcessing misc items...');
const miscData = [];

// Categories to skip entirely (already handled or truly not useful)
const SKIP_MISC_CATEGORIES = new Set([-999]);
// Types to skip in category 0
const SKIP_CAT0_TYPES = new Set(['asdf']); // internal placeholders (Secret Note, Artifact Spot, etc.)

for (const [rawId, objectData] of Object.entries(gameData.objects)) {
  if (alreadyProcessedGameIds.has(rawId)) continue;
  if (SKIP_MISC_CATEGORIES.has(objectData.Category)) continue;
  // In cat 0, skip internal-only items
  if (objectData.Category === 0 && SKIP_CAT0_TYPES.has(objectData.Type)) continue;

  const gameId = `(O)${rawId}`;
  if (rules.itemVariants[String(gameId)]?.skip) continue;
  const item = makeBaseItem(gameId, objectData, 'misc');
  item.sources = buildAcquisitionSources(gameId);
  const miscVariant = rules.itemVariants[String(gameId)];
  if (miscVariant?.sources) item.sources.push(...miscVariant.sources);
  miscData.push(item);
  alreadyProcessedGameIds.add(rawId);
}

deduplicateIds(miscData);
miscData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${miscData.length} misc items`);

// ============================================================================
// Process Weapons (Weapons.json)
// ============================================================================
console.log('\nProcessing weapons...');
const weaponData = [];

const WEAPON_TYPE_NAMES = { 0: 'sword', 1: 'dagger', 2: 'club', 3: 'sword', 4: 'slingshot' };

for (const [rawId, weaponObj] of Object.entries(gameData.weapons)) {
  const gameId = `(W)${rawId}`;
  const name = resolveLocalizedText(weaponObj.DisplayName) || weaponObj.Name;
  const description = resolveLocalizedText(weaponObj.Description) || '';
  const iconName = name.replace(/[^a-zA-Z0-9]/g, '');

  weaponData.push({
    type: 'weapon',
    id: toKebabCase(name),
    gameId,
    name,
    description,
    icon: `assets/objects/${iconName}.png`,
    weaponType: WEAPON_TYPE_NAMES[weaponObj.Type] || 'sword',
    minDamage: weaponObj.MinDamage ?? 0,
    maxDamage: weaponObj.MaxDamage ?? 0,
    critChance: weaponObj.CritChance ?? 0.02,
    critMultiplier: weaponObj.CritMultiplier ?? 3,
    speed: weaponObj.Speed ?? 0,
    defense: weaponObj.Defense ?? 0,
    knockback: weaponObj.Knockback ?? 1,
    areaOfEffect: weaponObj.AreaOfEffect ?? 0,
    canBeLostOnDeath: weaponObj.CanBeLostOnDeath ?? false,
    sources: buildAcquisitionSources(gameId),
  });
}

deduplicateIds(weaponData);
weaponData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${weaponData.length} weapons`);

// ============================================================================
// Process Boots (Boots.json) — slash-delimited: name/desc/price/defense/immunity/colorIndex/displayName
// ============================================================================
console.log('\nProcessing boots...');
const bootsData = [];

for (const [rawId, bootsStr] of Object.entries(gameData.boots)) {
  if (typeof bootsStr !== 'string') continue;
  const parts = bootsStr.split('/');
  const name = parts[6] || parts[0] || `Boots ${rawId}`;
  const description = parts[1] || '';
  const price = parseInt(parts[2], 10) || 0;
  const defense = parseInt(parts[3], 10) || 0;
  const immunity = parseInt(parts[4], 10) || 0;
  const gameId = `(B)${rawId}`;
  const iconName = name.replace(/[^a-zA-Z0-9]/g, '');

  bootsData.push({
    type: 'boot',
    id: toKebabCase(name),
    gameId,
    name,
    description,
    price,
    defense,
    immunity,
    icon: `assets/objects/${iconName}.png`,
    sources: buildAcquisitionSources(gameId),
  });
}

deduplicateIds(bootsData);
bootsData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${bootsData.length} boots`);

// ============================================================================
// Process Tools (Tools.json)
// ============================================================================
console.log('\nProcessing tools...');
const toolData = [];

for (const [rawId, toolObj] of Object.entries(gameData.tools)) {
  const gameId = `(T)${rawId}`;
  const name = resolveLocalizedText(toolObj.DisplayName) || toolObj.Name || rawId;
  const description = resolveLocalizedText(toolObj.Description) || '';
  const iconName = name.replace(/[^a-zA-Z0-9]/g, '');

  toolData.push({
    type: 'tool',
    id: toKebabCase(name),
    gameId,
    name,
    description,
    icon: `assets/objects/${iconName}.png`,
    toolClass: toolObj.ClassName || rawId,
    upgradeLevel: toolObj.UpgradeLevel ?? 0,
    price: toolObj.SalePrice > 0 ? toolObj.SalePrice : 0,
    sources: buildAcquisitionSources(gameId),
  });
}

deduplicateIds(toolData);
toolData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${toolData.length} tools`);

// ============================================================================
// Process Trinkets (Trinkets.json)
// ============================================================================
console.log('\nProcessing trinkets...');
const trinketData = [];

for (const [rawId, trinketObj] of Object.entries(gameData.trinkets)) {
  const gameId = `(TR)${rawId}`;
  const name = resolveLocalizedText(trinketObj.DisplayName) || rawId;
  const description = resolveLocalizedText(trinketObj.Description) || '';
  const iconName = name.replace(/[^a-zA-Z0-9]/g, '');

  trinketData.push({
    type: 'trinket',
    id: toKebabCase(name),
    gameId,
    name,
    description,
    canBeReforged: trinketObj.CanBeReforged ?? false,
    dropsNaturally: trinketObj.DropsNaturally ?? false,
    icon: `assets/objects/${iconName}.png`,
    sources: buildAcquisitionSources(gameId),
  });
}

deduplicateIds(trinketData);
trinketData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${trinketData.length} trinkets`);

// ============================================================================
// Process Buildings (Buildings.json)
// ============================================================================
console.log('\nProcessing buildings...');
const buildingData = [];

for (const [rawId, buildingObj] of Object.entries(gameData.buildings)) {
  const gameId = `(BLD)${rawId}`;
  const name = resolveLocalizedText(buildingObj.Name) || rawId;
  const description = resolveLocalizedText(buildingObj.Description) || '';
  const iconName = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const buildMaterials = (buildingObj.BuildMaterials || []).map(m => ({
    gameId: m.ItemId,
    amount: m.Amount,
  }));

  // upgradesTo: find any building that lists this one as what it replaces
  const upgradesTo = Object.entries(gameData.buildings).find(
    ([, b]) => b.BuildingToUpgrade === rawId
  )?.[0];

  buildingData.push({
    type: 'building',
    id: toKebabCase(name),
    gameId,
    name,
    description,
    icon: `assets/objects/${iconName}.png`,
    builder: buildingObj.Builder || null,
    buildCost: buildingObj.BuildCost ?? 0,
    buildDays: buildingObj.BuildDays ?? 0,
    buildMaterials,
    maxOccupants: buildingObj.MaxOccupants ?? null,
    maxBuilds: buildingObj.MaxBuilds ?? null,
    magical: buildingObj.MagicalConstruction ?? false,
    sources: [],
    // BuildingToUpgrade = the building this one replaces/upgrades from
    ...(buildingObj.BuildingToUpgrade && { upgradesFrom: `(BLD)${buildingObj.BuildingToUpgrade}` }),
    // upgradesTo = a building that replaces this one
    ...(upgradesTo && { upgradesTo: `(BLD)${upgradesTo}` }),
  });
}

deduplicateIds(buildingData);
buildingData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${buildingData.length} buildings`);

// ============================================================================
// Cross-namespace ID disambiguation
// Furniture and Hats use separate gameId namespaces from Objects.json, so their
// friendly IDs can collide with Object-namespace items (e.g. furniture "'Stardrop'"
// painting → id "stardrop" collides with Object Stardrop gameId 434).
// Append -gameId to any furniture/hat whose id already exists in the Object namespace.
// ============================================================================
const objectNamespaceIds = new Set([
  fishData, artisanData, animalProductData, cropData, seedData, forageData,
  fruitTreeData, treeFruitsData, mineralData, metalBarData, monsterLootData,
  resourceData, bigCraftableData, foodData, oreData, geodeMineralData, bombData,
  fertilizerData, baitData, tackleData, flooringData, bookData, artifactData,
  ringData, treeSeedData, miscData,
].flatMap(arr => arr.map(i => i.id)));

let crossNamespaceDisambiguated = 0;
for (const item of [...furnitureData, ...hatData]) {
  if (objectNamespaceIds.has(item.id)) {
    item.id = `${item.id}-${String(item.gameId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    crossNamespaceDisambiguated++;
  }
}
if (crossNamespaceDisambiguated > 0) {
  console.log(`  ✓ Disambiguated ${crossNamespaceDisambiguated} furniture/hat ids that collided with Object-namespace ids`);
}

// ============================================================================
// Process gift tastes for new item types
// ============================================================================
console.log('\nProcessing gift tastes for new item types...');
const newItemArrays = [
  foodData, oreData, geodeMineralData, bombData, fertilizerData,
  baitData, tackleData, flooringData, bookData, artifactData,
  ringData, treeSeedData, miscData,
];
for (const arr of newItemArrays) {
  for (const item of arr) {
    if (item.canBeGifted === false) continue;
    processGiftTastes(item, gameData.npcGiftTastes);
  }
}

// ============================================================================
// Add bundle references for new item types
// ============================================================================
const newItemsByGameId = new Map();
for (const arr of newItemArrays) {
  for (const item of arr) {
    newItemsByGameId.set(item.gameId, item);
    if (typeof item.gameId === 'number') newItemsByGameId.set(String(item.gameId), item);
  }
}

// Re-scan bundles to add refs for new item types
for (const [bundleKey, bundleInfo] of Object.entries(gameData.bundles)) {
  if (typeof bundleInfo !== 'string') continue;
  const parts = bundleInfo.split('/');
  const bundleName = parts[0];
  const friendlyId = toKebabCase(bundleName);
  const itemsString = parts[2];
  if (!itemsString) continue;

  const itemParts = itemsString.split(' ');
  for (let i = 0; i < itemParts.length; i += 3) {
    const itemId = parseInt(itemParts[i], 10);
    const item = newItemsByGameId.get(itemId) || newItemsByGameId.get(String(itemId));
    if (item && !item.bundles.includes(friendlyId)) {
      item.bundles.push(friendlyId);
    }
  }
}

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
  path.join(PROCESSED_DIR, 'items/food.json'),
  JSON.stringify(foodData, null, 2)
);
console.log(`  ✓ Wrote items/food.json (${foodData.length} food items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/ores.json'),
  JSON.stringify(oreData, null, 2)
);
console.log(`  ✓ Wrote items/ores.json (${oreData.length} ores)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/geode-minerals.json'),
  JSON.stringify(geodeMineralData, null, 2)
);
console.log(`  ✓ Wrote items/geode-minerals.json (${geodeMineralData.length} geode minerals)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/crafted.json'),
  JSON.stringify(bombData, null, 2)
);
console.log(`  ✓ Wrote items/crafted.json (${bombData.length} crafted items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/fertilizers.json'),
  JSON.stringify(fertilizerData, null, 2)
);
console.log(`  ✓ Wrote items/fertilizers.json (${fertilizerData.length} fertilizers)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/bait.json'),
  JSON.stringify(baitData, null, 2)
);
console.log(`  ✓ Wrote items/bait.json (${baitData.length} bait items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/tackle.json'),
  JSON.stringify(tackleData, null, 2)
);
console.log(`  ✓ Wrote items/tackle.json (${tackleData.length} tackle items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/flooring.json'),
  JSON.stringify(flooringData, null, 2)
);
console.log(`  ✓ Wrote items/flooring.json (${flooringData.length} flooring items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/trash.json'),
  JSON.stringify(trashData, null, 2)
);
console.log(`  ✓ Wrote items/trash.json (${trashData.length} trash items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/books.json'),
  JSON.stringify(bookData, null, 2)
);
console.log(`  ✓ Wrote items/books.json (${bookData.length} books)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/artifacts.json'),
  JSON.stringify(artifactData, null, 2)
);
console.log(`  ✓ Wrote items/artifacts.json (${artifactData.length} artifacts)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/rings.json'),
  JSON.stringify(ringData, null, 2)
);
console.log(`  ✓ Wrote items/rings.json (${ringData.length} rings)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/tree-seeds.json'),
  JSON.stringify(treeSeedData, null, 2)
);
console.log(`  ✓ Wrote items/tree-seeds.json (${treeSeedData.length} tree seeds)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/misc.json'),
  JSON.stringify(miscData, null, 2)
);
console.log(`  ✓ Wrote items/misc.json (${miscData.length} misc items)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/weapons.json'),
  JSON.stringify(weaponData, null, 2)
);
console.log(`  ✓ Wrote items/weapons.json (${weaponData.length} weapons)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/boots.json'),
  JSON.stringify(bootsData, null, 2)
);
console.log(`  ✓ Wrote items/boots.json (${bootsData.length} boots)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/tools.json'),
  JSON.stringify(toolData, null, 2)
);
console.log(`  ✓ Wrote items/tools.json (${toolData.length} tools)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/trinkets.json'),
  JSON.stringify(trinketData, null, 2)
);
console.log(`  ✓ Wrote items/trinkets.json (${trinketData.length} trinkets)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'items/buildings.json'),
  JSON.stringify(buildingData, null, 2)
);
console.log(`  ✓ Wrote items/buildings.json (${buildingData.length} buildings)`);

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
  mineralData, metalBarData, monsterLootData, resourceData, bigCraftableData, cropData,
  foodData, oreData, geodeMineralData, bombData, fertilizerData,
  baitData, tackleData, flooringData, bookData, artifactData,
  ringData, treeSeedData, miscData,
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

// ---------------------------------------------------------------------------
// Process Buffs.json → reference/buffs.json
// ---------------------------------------------------------------------------
console.log('\n✨ Processing buffs...');

// Icon mapping: resolved buff name → icon filename (without extension)
const BUFF_ICON_MAP = {
  'Tipsy':             'Tipsy',
  'Burnt':             'Burnt',
  'Slimed':            'Slimed',
  'Jinxed':            'Jinxed',
  'Frozen':            'Frozen',
  'Spooked':           'Attack',
  'Warrior Energy':    'WarriorEnergy',
  "Yoba's Blessing":   'YobasBlessing',
  'Adrenaline Rush':   'AdrenalineRush',
  'Oil of Garlic':     'OilOfGarlic',
  'Monster Musk':      'MonsterMusk',
  'Squid Ink Ravioli': 'SquidInkRavioli',
  'Nauseated':         'Nauseated',
  'Darkness':          'Darkness',
  'Weakness':          'Weakness',
};

// Build grantedByMap: buffName → [itemId, ...]
// Scan all processed item arrays for items with named buffs (buff.name set)
const grantedByMap = new Map();
allItemTypes.forEach(items => {
  items.forEach(item => {
    if (!item.buffs || !Array.isArray(item.buffs)) return;
    item.buffs.forEach(buff => {
      if (!buff.name) return;
      if (!grantedByMap.has(buff.name)) grantedByMap.set(buff.name, []);
      const list = grantedByMap.get(buff.name);
      if (!list.includes(item.id)) list.push(item.id);
    });
  });
});

const buffData = [];
for (const [gameKey, b] of Object.entries(gameData.buffs)) {
  const name = resolveLocalizedText(b.DisplayName);
  if (!name) continue;

  // Slugify: prefix with "buff-" to avoid collisions with item IDs (e.g. "oil-of-garlic")
  const baseName = resolveLocalizedText(b.DisplayName);
  let id = `buff-${toKebabCase(baseName)}`;
  // If the game key contains a disambiguating suffix (dwarfStatue_0, statue_of_blessings_2, etc.),
  // all entries sharing the same resolved name get a numeric suffix from the game key.
  const keySuffix = gameKey.match(/[_-](\d+)$/);
  if (keySuffix) {
    // Check if any other entry in gameData.buffs has the same resolved name
    const sameNameKeys = Object.keys(gameData.buffs).filter(k => {
      if (k === gameKey) return false;
      return resolveLocalizedText(gameData.buffs[k].DisplayName) === baseName;
    });
    if (sameNameKeys.length > 0) {
      id = `${id}-${keySuffix[1]}`;
    }
  }

  const effects = {};
  if (b.Effects) {
    for (const [k, v] of Object.entries(b.Effects)) {
      if (v !== 0) effects[k] = v;
    }
  }

  const iconFile = BUFF_ICON_MAP[name];
  const description = resolveLocalizedText(b.Description) || null;

  buffData.push({
    id,
    gameId: gameKey,
    name,
    description,
    entityType: 'buff',
    isDebuff: b.IsDebuff || false,
    duration: Math.round(b.Duration / 1000),
    icon: iconFile ? `assets/buffs/${iconFile}.png` : null,
    effects: Object.keys(effects).length > 0 ? effects : null,
    grantedBy: grantedByMap.get(name) || [],
  });
}

// Ensure reference directory exists
const referenceDir = path.join(PROCESSED_DIR, 'reference');
if (!fs.existsSync(referenceDir)) {
  fs.mkdirSync(referenceDir, { recursive: true });
}

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'reference/buffs.json'),
  JSON.stringify(buffData, null, 2)
);
console.log(`  ✓ Wrote reference/buffs.json (${buffData.length} buffs)`);

// ---------------------------------------------------------------------------
// Process Events_*.json + rules/events.json → reference/events.json
// ---------------------------------------------------------------------------
console.log('\n📖 Processing events...');

function camelToWords(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Load curated wiki descriptions from rules
const eventRules = loadJson(path.join(RULES_DIR, 'events.json')).events || [];
const eventRulesById = new Map(eventRules.map(e => [e.id, e]));

// Known NPC names for matching against descriptions
const knownNpcNames = new Set([
  'Abigail','Alex','Caroline','Clint','Demetrius','Dwarf','Elliott','Emily',
  'Evelyn','George','Gus','Haley','Harvey','Jas','Jodi','Kent','Krobus',
  'Leah','Leo','Lewis','Linus','Marnie','Maru','Pam','Penny','Pierre',
  'Robin','Sam','Sandy','Sebastian','Shane','Vincent','Willy','Wizard',
]);

// Collect data from all Events_*.json files
const gameEventFiles = fs.readdirSync(GAME_EXPORTS_DIR)
  .filter(f => f.startsWith('Events_') && f.endsWith('.json'));

// Collect all game event data, merging across variants (same eventId can appear with multiple
// condition sets for married/unmarried or male/female player variants).
// gameEventById: { id → { location, internalName, friendship, present, owner, requiredEvents, marriageVariant } }
const gameEventById = new Map();
for (const eventFile of gameEventFiles) {
  const locationKey = eventFile.replace(/^Events_/, '').replace(/\.json$/, '');
  const events = loadJson(path.join(GAME_EXPORTS_DIR, eventFile));
  for (const [key] of Object.entries(events)) {
    const parts = key.split('/');
    const eventId = parts[0];

    if (!gameEventById.has(eventId)) {
      gameEventById.set(eventId, {
        location: locationKey,
        internalName: null,
        friendship: [],       // [{npc, points}] — deduplicated across variants
        present: new Set(),   // NPCs that must be present (p flag)
        owner: new Set(),     // marriage-candidate owner (o/O flags)
        requiredEvents: new Set(), // prerequisite event IDs (e flag)
        mutuallyExclusive: new Set(), // k flag — if these events seen, this won't fire
        marriageVariant: false,
        seasons: new Set(),   // z flag
        year: null,           // y flag
        weather: new Set(),   // w flag
        timeWindows: [],      // t flag — [{start, end}] in game minutes (e.g. 900=9am)
        daysOfWeek: new Set(), // d flag
        minMoney: null,       // m flag
        requiredItems: new Set(), // i flag — gameIds that must be in inventory
        mineLevel: null,      // j flag — mine depth reached
        requiresMail: new Set(),  // Hl flag — mail flag must be set
        blockingMail: new Set(),  // l/Hn flag — mail flag must NOT be set
      });
    }
    const ev = gameEventById.get(eventId);
    const seenFriendship = new Set(ev.friendship.map(f => f.npc));

    for (const p of parts.slice(1)) {
      if (p.startsWith('f ')) {
        const rest = p.slice(2).split(' ');
        if (rest.length >= 2 && !seenFriendship.has(rest[0])) {
          ev.friendship.push({ npc: rest[0], points: parseInt(rest[1]) });
          seenFriendship.add(rest[0]);
        }
      } else if (p.startsWith('o ') || p.startsWith('O ')) {
        ev.owner.add(p.slice(2));
      } else if (p.startsWith('p ')) {
        ev.present.add(p.slice(2));
      } else if (p.startsWith('e ')) {
        ev.requiredEvents.add(p.slice(2));
      } else if (p.startsWith('k ')) {
        ev.mutuallyExclusive.add(p.slice(2));
      } else if (p === 'H') {
        ev.marriageVariant = true;
      } else if (p.startsWith('z ')) {
        ev.seasons.add(p.slice(2));
      } else if (p.startsWith('y ')) {
        if (!ev.year) ev.year = parseInt(p.slice(2));
      } else if (p.startsWith('w ')) {
        ev.weather.add(p.slice(2));
      } else if (p.startsWith('t ')) {
        const [, start, end] = p.split(' ');
        if (start && end) {
          const tw = { start: parseInt(start), end: parseInt(end) };
          // Only add if not already present (across variants)
          if (!ev.timeWindows.some(x => x.start === tw.start && x.end === tw.end)) {
            ev.timeWindows.push(tw);
          }
        }
      } else if (p.startsWith('d ')) {
        for (const day of p.slice(2).split(' ')) ev.daysOfWeek.add(day);
      } else if (p.startsWith('m ')) {
        const amt = parseInt(p.slice(2));
        if (!isNaN(amt) && (ev.minMoney === null || amt > ev.minMoney)) ev.minMoney = amt;
      } else if (p.startsWith('i ')) {
        ev.requiredItems.add(p.slice(2));
      } else if (p.startsWith('j ')) {
        const lvl = parseInt(p.slice(2));
        if (!isNaN(lvl) && (ev.mineLevel === null || lvl > ev.mineLevel)) ev.mineLevel = lvl;
      } else if (p.startsWith('Hl ')) {
        ev.requiresMail.add(p.slice(3));
      } else if (p.startsWith('l ') || p.startsWith('Hn ')) {
        ev.blockingMail.add(p.startsWith('l ') ? p.slice(2) : p.slice(3));
      } else if (p.startsWith('n ') && !ev.internalName) {
        ev.internalName = p.slice(2);
      }
    }
  }
}

// Build reverse map: eventId → [itemIds that reference it in conditions]
// Scan all processed item arrays for player.events conditions
function collectEventRefs(obj, eventId) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj['in'] && Array.isArray(obj['in'])) {
    const [val, col] = obj['in'];
    if (col && col.var === 'player.events' && String(val) === eventId) return true;
  }
  return Object.values(obj).some(v => Array.isArray(v)
    ? v.some(item => collectEventRefs(item, eventId))
    : collectEventRefs(v, eventId));
}

const allProcessedArrays = [
  fishData, artisanData, animalProductData, cropData, seedData, forageData,
  fruitTreeData, treeFruitsData, mineralData, metalBarData, monsterLootData,
  resourceData, bigCraftableData, foodData, oreData, geodeMineralData, bombData,
  fertilizerData, baitData, tackleData, flooringData, bookData, artifactData,
  ringData, treeSeedData, miscData, furnitureData, hatData,
];

// Build eventId → itemIds map by scanning all sources
const eventGrantedBy = new Map(); // eventId → Set of item ids
for (const arr of allProcessedArrays) {
  for (const item of arr) {
    for (const src of (item.sources || [])) {
      if (!src.condition) continue;
      const condStr = JSON.stringify(src.condition);
      const matches = condStr.matchAll(/"in":\[(\d+),\{"var":"player\.events"\}\]/g);
      for (const m of matches) {
        const eid = m[1];
        if (!eventGrantedBy.has(eid)) eventGrantedBy.set(eid, new Set());
        eventGrantedBy.get(eid).add(item.id);
      }
    }
  }
}

// Parse primary NPC from wiki description (fallback when game flags are ambiguous)
function parseNpcFromDescription(description) {
  if (!description) return null;
  const apostropheMatch = description.match(/^([A-Z][a-z]+)'s /);
  if (apostropheMatch && knownNpcNames.has(apostropheMatch[1])) return apostropheMatch[1];
  const firstWordMatch = description.match(/^([A-Z][a-z]+) /);
  if (firstWordMatch && knownNpcNames.has(firstWordMatch[1])) return firstWordMatch[1];
  return null;
}

// Parse heart level from description
function parseHeartLevel(description) {
  if (!description) return null;
  const m = description.match(/(\d+) heart event/i);
  return m ? parseInt(m[1]) : null;
}

// Determine event type from description
function parseEventType(description) {
  if (!description) return 'story';
  const d = description.toLowerCase();
  if (d.includes('heart event')) return 'heart';
  if (d.includes('completion of') || (d.includes('quest') && d.includes('completion'))) return 'quest';
  if (d.includes('introduction event') || d.match(/^part of the introduction/)) return 'introduction';
  if (d.startsWith('set-up for')) return 'setup';
  return 'story';
}

// Collect all unique event IDs from game exports (only numeric + the ones wiki knows about)
// We include all wiki events plus any numeric game events not in wiki that have /n names or messages
const allEventIds = new Set([
  ...eventRulesById.keys(),
  ...[...gameEventById.keys()].filter(id => /^\d+$/.test(id) && (
    gameEventById.get(id).internalName || gameEventById.get(id).message
  )),
]);

const eventData = [];
for (const eventId of [...allEventIds].sort((a, b) => {
  const aNum = parseInt(a); const bNum = parseInt(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  if (!isNaN(aNum)) return -1;
  if (!isNaN(bNum)) return 1;
  return a.localeCompare(b);
})) {
  const wiki = eventRulesById.get(eventId);
  const game = gameEventById.get(eventId);

  // Derive name: prefer wiki description summary, fall back to internalName camelCase → words
  const TITLE_CASE_SKIP = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as','is','it']);
  function toTitleCase(str) {
    return str.split(' ').map((w, i) => {
      if (i > 0 && TITLE_CASE_SKIP.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  let name = null;
  if (wiki) {
    // Shorten description to a title: first sentence up to colon or period
    const desc = wiki.description;
    const colonIdx = desc.indexOf(':');
    const periodIdx = desc.indexOf('.');
    let raw;
    if (colonIdx > 0 && colonIdx < 80) {
      raw = desc.slice(0, colonIdx).trim();
    } else if (periodIdx > 0 && periodIdx < 80) {
      raw = desc.slice(0, periodIdx).trim();
    } else {
      raw = desc.slice(0, 80).trim();
    }
    name = toTitleCase(raw);
  } else if (game?.internalName) {
    name = camelToWords(game.internalName);
  } else {
    name = `Event ${eventId}`;
  }

  const description = wiki?.description || null;
  const heartLevel = parseHeartLevel(description);
  const eventType = parseEventType(description);
  const locations = wiki?.locations || (game ? [game.location] : []);
  const grantedBy = eventGrantedBy.has(eventId) ? [...eventGrantedBy.get(eventId)] : [];

  // Primary NPC: single friendship NPC (most authoritative) → description parsing fallback
  const friendshipNpcs = (game?.friendship || []).map(f => f.npc).filter(n => knownNpcNames.has(n));
  const uniqueFriendshipNpcs = [...new Set(friendshipNpcs)];
  const npc = uniqueFriendshipNpcs.length === 1
    ? uniqueFriendshipNpcs[0]
    : parseNpcFromDescription(description);

  // All villagers meaningfully involved: union of friendship + present + owner, filtered to known NPCs
  const villagersInvolved = [...new Set([
    ...friendshipNpcs,
    ...[...(game?.present || new Set())].filter(n => knownNpcNames.has(n)),
    ...[...(game?.owner || new Set())].filter(n => knownNpcNames.has(n)),
  ])].sort();

  // Required friendship to trigger this event (deduplicated, known NPCs only)
  const requiredFriendship = (game?.friendship || []).filter(f => knownNpcNames.has(f.npc));

  // Prerequisite event IDs (raw keys, not entity IDs)
  const requiredEvents = [...(game?.requiredEvents || new Set())].sort();
  const mutuallyExclusive = [...(game?.mutuallyExclusive || new Set())].sort();

  const marriageVariant = game?.marriageVariant || false;

  // Trigger conditions
  const year = game?.year ?? null;
  const seasons = [...(game?.seasons || new Set())].sort();
  const weather = [...(game?.weather || new Set())].sort();
  const daysOfWeek = [...(game?.daysOfWeek || new Set())];
  const timeWindows = game?.timeWindows?.length ? game.timeWindows : null;
  const minMoney = game?.minMoney ?? null;
  const requiredItems = [...(game?.requiredItems || new Set())];
  const mineLevel = game?.mineLevel ?? null;
  const requiresMail = [...(game?.requiresMail || new Set())].sort();
  const blockingMail = [...(game?.blockingMail || new Set())].sort();

  // Icon: villager portrait if primary NPC known
  const icon = npc ? `assets/villagers/${npc}.png` : null;

  eventData.push({
    id: `event-${eventId}`,
    gameId: /^\d+$/.test(eventId) ? parseInt(eventId) : null,
    eventKey: eventId,
    name,
    description,
    entityType: 'event',
    eventType,
    npc,
    heartLevel,
    villagersInvolved,
    requiredFriendship,
    requiredEvents,
    mutuallyExclusive: mutuallyExclusive.length ? mutuallyExclusive : undefined,
    marriageVariant,
    year: year !== null ? year : undefined,
    seasons: seasons.length ? seasons : undefined,
    weather: weather.length ? weather : undefined,
    daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined,
    timeWindows: timeWindows || undefined,
    minMoney: minMoney !== null ? minMoney : undefined,
    requiredItems: requiredItems.length ? requiredItems : undefined,
    mineLevel: mineLevel !== null ? mineLevel : undefined,
    requiresMail: requiresMail.length ? requiresMail : undefined,
    blockingMail: blockingMail.length ? blockingMail : undefined,
    locations,
    icon,
    grantedBy,
  });
}

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'reference/events.json'),
  JSON.stringify(eventData, null, 2)
);
console.log(`  ✓ Wrote reference/events.json (${eventData.length} events, ${[...eventGrantedBy.keys()].length} with grantedBy)`);

console.log('\n✅ Game data processing complete!');
console.log(`\nSource files created in: ${PROCESSED_DIR}`);

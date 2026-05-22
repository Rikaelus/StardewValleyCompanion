#!/usr/bin/env node

/**
 * Process raw game data exports into structured source files
 * This creates the "source of truth" data files that will be compiled into page-specific JSON
 */

const fs = require('fs');
const path = require('path');
const { calculateQualityPrices } = require('./lib/CompilationHelpers.cjs');

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
const OUTPUT_DIR = path.join(__dirname, '../public/data');

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

/** Enforce vil- prefix for villager entity IDs. */
function toVillagerEntityId(name) {
  const id = toKebabCase(name);
  return id.startsWith('vil-') ? id : `vil-${id}`;
}

/**
 * Get unique ID for an item, handling duplicates
 * Some items have the same Name but different gameIds (e.g., brown vs white eggs)
 * Uses rules/item-variants.json for mappings
 */
function getUniqueItemId(gameId, itemName) {
  const variant = rules.itemVariants[String(gameId)];
  if (variant && variant.uniqueId) {
    return variant.uniqueId;
  }

  // Default: use kebab-case of item name
  return toKebabCase(itemName);
}

function getVariantName(gameId, fallbackName) {
  const variant = rules.itemVariants[String(gameId)];
  return (variant && variant.name) ? variant.name : fallbackName;
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

// Parse shops data to build category -> shops mapping, using the tag map rules file.
// Also returns specificGameIdLocations: gameId -> [loc-...] for items like ingredients.
function parseShopSellingLocations(shopsData, tagMapRules) {
  const { tagToCategories, tagToSpecificGameIds } = tagMapRules;

  // Map game shop IDs to friendly loc- IDs
  const shopIdMap = {
    'SeedShop': 'loc-pierre',
    'FishShop': 'loc-willy',
    'AnimalShop': 'loc-marnie',
    'Blacksmith': 'loc-clint',
    'Carpenter': 'loc-robin',
    'Saloon': 'loc-gus',
    'AdventureShop': 'loc-marlon',
    'VolcanoShop': 'loc-volcano-shop',
    'Bookseller': 'loc-bookseller',
  };

  // category number (string) -> Set<loc-id>
  const categoryToShops = {};
  // gameId (string, qualified) -> Set<loc-id>
  const specificGameIdToShops = {};

  const addToCategory = (cat, locId) => {
    const key = String(cat);
    if (!categoryToShops[key]) categoryToShops[key] = new Set();
    categoryToShops[key].add(locId);
  };

  const addToSpecificId = (gameId, locId) => {
    if (!specificGameIdToShops[gameId]) specificGameIdToShops[gameId] = new Set();
    specificGameIdToShops[gameId].add(locId);
  };

  for (const [shopId, shopData] of Object.entries(shopsData)) {
    const locId = shopIdMap[shopId];
    if (!locId) continue;

    for (const tag of (shopData.SalableItemTags || [])) {
      // Standard category tags
      if (tagToCategories[tag]) {
        for (const cat of tagToCategories[tag]) {
          addToCategory(cat, locId);
        }
      }
      // Specific game ID tags (e.g. category_ingredients -> Sugar, Oil, etc.)
      if (tagToSpecificGameIds[tag]) {
        for (const gameId of tagToSpecificGameIds[tag]) {
          addToSpecificId(gameId, locId);
        }
      }
    }
  }

  // Convert Sets to sorted arrays, append shipping-bin
  const categoryResult = {};
  for (const [cat, locSet] of Object.entries(categoryToShops)) {
    categoryResult[cat] = [...locSet, 'shipping-bin'];
  }

  const specificGameIdResult = {};
  for (const [gameId, locSet] of Object.entries(specificGameIdToShops)) {
    specificGameIdResult[gameId] = [...locSet, 'shipping-bin'];
  }

  return { categoryResult, specificGameIdResult };
}

// Helper function to get selling locations for an item.
// Checks specific game ID overrides first (e.g. cooking ingredients), then falls back to category.
// gameId may be a qualified ID like "(O)245", a raw numeric string "245", or a number 245.
function getSellingLocations(category, shopSellingLocations, gameId) {
  if (gameId != null) {
    const qualifiedId = String(gameId).startsWith('(') ? String(gameId) : `(O)${gameId}`;
    if (specificGameIdLocations[qualifiedId]) {
      return specificGameIdLocations[qualifiedId];
    }
  }
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
  monsterSlayerQuests: loadJson(path.join(GAME_EXPORTS_DIR, 'MonsterSlayerQuests.json')),
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
  farmAnimals: loadJson(path.join(GAME_EXPORTS_DIR, 'FarmAnimals.json')),
  farmAnimalStrings: loadJson(path.join(GAME_EXPORTS_DIR, 'Strings_FarmAnimals.json')),
  museumRewards: loadJson(path.join(GAME_EXPORTS_DIR, 'MuseumRewards.json')),
  worldMap: loadJson(path.join(GAME_EXPORTS_DIR, 'WorldMap.json')),
  locationContexts: loadJson(path.join(GAME_EXPORTS_DIR, 'LocationContexts.json')),
  tailoringRecipes: loadJson(path.join(GAME_EXPORTS_DIR, 'TailoringRecipes.json')),
  achievements: loadJson(path.join(GAME_EXPORTS_DIR, 'Achievements.json')),
  cookingRecipes: loadJson(path.join(GAME_EXPORTS_DIR, 'CookingRecipes.json')),
  craftingRecipes: loadJson(path.join(GAME_EXPORTS_DIR, 'CraftingRecipes.json')),
  quests: loadJson(path.join(GAME_EXPORTS_DIR, 'Quests.json')),
  powers: loadJson(path.join(GAME_EXPORTS_DIR, 'Powers.json')),
  concessions: loadJson(path.join(GAME_EXPORTS_DIR, 'Concessions.json')),
  movies: loadJson(path.join(GAME_EXPORTS_DIR, 'Movies.json')),
  moviesReactions: loadJson(path.join(GAME_EXPORTS_DIR, 'MoviesReactions.json')),
  pants: loadJson(path.join(GAME_EXPORTS_DIR, 'Pants.json')),
  shirts: loadJson(path.join(GAME_EXPORTS_DIR, 'Shirts.json')),
  secretNotes: loadJson(path.join(GAME_EXPORTS_DIR, 'SecretNotes.json')),
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
for (const tableName of ['Furniture', 'Objects', 'BigCraftables', 'Buildings', 'Tools', 'Weapons', '1_6_Strings', 'UI', 'Locations', 'Characters', 'NPCNames', 'FarmAnimals', 'BundleNames', 'EnchantmentNames', 'Movies', 'MovieConcessions', 'MovieReactions', 'Quests', 'SpecialOrderStrings', 'StringsFromCSFiles', 'Notes', 'Shirts', 'Pants', 'WorldMap', 'Strings']) {
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
  const [, tableName, rawKey] = match;
  // Key may include format arguments after a space: "TrashCan_Description 30" → key="TrashCan_Description", arg="30"
  const spaceIdx = rawKey.indexOf(' ');
  const key = spaceIdx === -1 ? rawKey : rawKey.slice(0, spaceIdx);
  const arg = spaceIdx === -1 ? null : rawKey.slice(spaceIdx + 1);
  const resolved = stringTables[tableName]?.[key];
  if (!resolved) return value;
  return arg != null ? resolved.replace(/\{0\}/g, arg) : resolved;
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

// Parse shop selling locations from game data using the tag map rules file.
// locations.json categorySellingLocations provides overrides/additions (e.g. trash can, sap).
console.log('Parsing shop selling locations...');
const salableTagMapRules = loadJson(path.join(RULES_DIR, 'salable-item-tag-map.json'));
const { categoryResult: parsedCategoryLocations, specificGameIdResult: specificGameIdLocations } =
  parseShopSellingLocations(gameData.shops, salableTagMapRules);
const shopSellingLocations = parsedCategoryLocations;
// Merge in hand-curated category overrides (non-SalableItemTags shops: trash can, etc.)
const sellingLocationRules = loadJson(path.join(RULES_DIR, 'locations.json'));
for (const [cat, locs] of Object.entries(sellingLocationRules.categorySellingLocations || {})) {
  // Merge: combine parsed and rules entries, preserving order (rules first)
  const existing = new Set(shopSellingLocations[cat] || []);
  const merged = [];
  for (const loc of locs) {
    if (!existing.has(loc)) merged.push(loc);
  }
  shopSellingLocations[cat] = [...(shopSellingLocations[cat] || []), ...merged];
}
console.log(`  ✓ Parsed selling locations for ${Object.keys(shopSellingLocations).length} categories (+ ${Object.keys(specificGameIdLocations).length} specific item overrides)`);

// Load game rules and mechanics
console.log('Loading game rules and mechanics...');
const rules = {
  priceFormulas: loadJson(path.join(RULES_DIR, 'price-formulas.json')).formulas,
  agingRules: loadJson(path.join(RULES_DIR, 'aging-rules.json')).rules,
  qualityMultipliers: loadJson(path.join(RULES_DIR, 'quality-multipliers.json')).multipliers,
  tapperProducts: loadJson(path.join(RULES_DIR, 'tapper-products.json')).products,
  flavoredItems: loadJson(path.join(RULES_DIR, 'flavored-items.json')).items,
  categoriesFile: loadJson(path.join(RULES_DIR, 'categories.json')),
  categories: loadJson(path.join(RULES_DIR, 'categories.json')).categories,
  roeMechanics: loadJson(path.join(RULES_DIR, 'roe-mechanics.json')).mechanics,
  itemVariants: loadJson(path.join(RULES_DIR, 'item-variants.json')).variants,
  shops: loadJson(path.join(RULES_DIR, 'shops.json')),
  furnitureNames: loadJson(path.join(RULES_DIR, 'furniture-names.json')).items,
  locationOverrides: loadJson(path.join(RULES_DIR, 'location-overrides.json')),
  locationEntities: loadJson(path.join(RULES_DIR, 'locations.json')),
  festivals: loadJson(path.join(RULES_DIR, 'festivals.json')),
  machineNames: loadJson(path.join(RULES_DIR, 'machine-names.json')).machines,
  smeltingRecipes: loadJson(path.join(RULES_DIR, 'smelting-recipes.json')).recipes,
  bundleRewards: loadJson(path.join(RULES_DIR, 'bundle-rewards.json')).gameIds,
  itemRoles: loadJson(path.join(RULES_DIR, 'item-roles.json')),
  treeNames: loadJson(path.join(RULES_DIR, 'tree-names.json')).trees,
  hatOverrides: loadJson(path.join(RULES_DIR, 'hat-overrides.json')),
  islandFieldOfficeRewards: loadJson(path.join(RULES_DIR, 'island-field-office-rewards.json')),
  iconOverrides: loadJson(path.join(RULES_DIR, 'icon-overrides.json')).overrides,
  monsterLocations: loadJson(path.join(RULES_DIR, 'monster-locations.json')),
  extraMonsters: loadJson(path.join(RULES_DIR, 'extra-monsters.json')),
  debuffIds: loadJson(path.join(RULES_DIR, 'debuff-ids.json')),
  buffGrants: loadJson(path.join(RULES_DIR, 'buff-grants.json')),
  bundleRoomOverrides: loadJson(path.join(RULES_DIR, 'bundle-room-overrides.json')),
  locationNesting: loadJson(path.join(RULES_DIR, 'location-nesting.json')).overrides,
  typePriority: loadJson(path.join(RULES_DIR, 'type-priority.json')).priorities,
  geodeItems: loadJson(path.join(RULES_DIR, 'geode-items.json')).gameIds,
  professionRules: loadJson(path.join(RULES_DIR, 'profession-rules.json')).rules,
  categoryNames: loadJson(path.join(RULES_DIR, 'category-names.json')).categories,
  qualityTiers: loadJson(path.join(RULES_DIR, 'quality-tiers.json')),
  clothingIconOverrides: loadJson(path.join(RULES_DIR, 'icon-overrides.json')).clothingIconOverrides || {},
  weaponSources: loadJson(path.join(RULES_DIR, 'weapon-sources.json')),
  fishingChestDrops: loadJson(path.join(RULES_DIR, 'fishing-chest-drops.json')).drops,
  secretNoteRewards: loadJson(path.join(RULES_DIR, 'secret-note-rewards.json')).rewards,
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
    if (item.IsRecipe) {
      // Recipe purchases: attach as a shop source on the food/crafted entity with isRecipe:true
      const m = itemId.match(/^\(O\)(.+)$/) || (gameData.objects[itemId] !== undefined ? [null, itemId] : null);
      if (m && storeId) {
        const recipeGameId = `(O)${m[1]}`;
        const recipeSource = { type: 'shop', id: storeId, isRecipe: true };
        if (item.Price > 0) recipeSource.price = item.Price;
        if (!shopSourcesByGameId.has(recipeGameId)) shopSourcesByGameId.set(recipeGameId, []);
        shopSourcesByGameId.get(recipeGameId).push(recipeSource);
      }
      continue;
    }

    // Determine item type prefix and which source map to use
    let rawId;
    let prefix = '(O)';
    let sourceMap = shopSourcesByGameId; // default: Objects

    const furnitureMatch = itemId.match(/^\(F\)(.+)$/);
    const hatMatch = itemId.match(/^\(H\)(.+)$/);
    const objectMatch = itemId.match(/^\(O\)(.+)$/);
    const bigCraftableMatch = itemId.match(/^\(BC\)(.+)$/);
    const bootsMatch = itemId.match(/^\(B\)(.+)$/);
    const weaponMatch = itemId.match(/^\(W\)(.+)$/);
    const toolMatch = itemId.match(/^\(T\)(.+)$/);

    if (furnitureMatch) {
      rawId = furnitureMatch[1]; prefix = '(F)';
      sourceMap = furnitureShopSourcesByGameId;
    } else if (hatMatch) {
      rawId = hatMatch[1]; prefix = '(H)';
      sourceMap = hatShopSourcesByGameId;
    } else if (bigCraftableMatch) {
      rawId = bigCraftableMatch[1]; prefix = '(BC)';
      sourceMap = bigCraftableShopSourcesByGameId;
    } else if (bootsMatch) {
      rawId = bootsMatch[1]; prefix = '(B)';
    } else if (weaponMatch) {
      rawId = weaponMatch[1]; prefix = '(W)';
    } else if (toolMatch) {
      rawId = toolMatch[1]; prefix = '(T)';
    } else if (objectMatch) {
      rawId = objectMatch[1];
    } else if (gameData.objects[itemId] !== undefined) {
      // Bare string ID with no type prefix — Objects namespace
      rawId = itemId;
    } else {
      continue;
    }
    const gameId = `${prefix}${rawId}`;

    const storeDetails = rules.shops.storeDetails?.[storeId];
    const source = { type: 'shop', id: storeId };

    // Non-gold shop currency (Currency field: 1=StarTokens, 2=QiCoins, 4=QiGems)
    const currencyDef = rules.shops.currencies?.[String(shopData.Currency)];
    if (shopData.Currency && currencyDef) {
      source.shopCurrency = currencyDef.id;
      source.shopCurrencyGameId = currencyDef.gameId;
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
      // Boots price is at position 2 in the slash-delimited string
      if (basePrice == null && prefix === '(B)') {
        const bootsStr = gameData.boots?.[String(rawId)];
        if (bootsStr) {
          basePrice = parseInt(bootsStr.split('/')[2], 10) || null;
        }
      }
      // Weapon sale price
      if (basePrice == null && prefix === '(W)') {
        basePrice = gameData.weapons?.[String(rawId)]?.SalePrice ?? null;
      }
      // Tool sale price
      if (basePrice == null && prefix === '(T)') {
        basePrice = gameData.tools?.[String(rawId)]?.SalePrice ?? null;
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

      const domMatch = cond.match(/\bDAY_OF_MONTH\s+(odd|even)\b/i);
      if (domMatch) {
        source.dayParity = domMatch[1].toLowerCase();
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

// ---------------------------------------------------------------------------
// Build location lookup from parsed game data (Locations.json + WorldMap.json)
// Replaces the old hand-curated location-names.json approach.
// ---------------------------------------------------------------------------
console.log('\n🗺️  Building location lookup from game data...');

const locationLookup = {}; // gameLocId -> { displayName, entityId, mapEntityId, mapName, parentRegion, ... }
const villagerHomeLocation = {}; // villagerId -> locationEntityId (reverse of locationResidents)
{
  const locOverrides = rules.locationOverrides;
  const skipSet = new Set(locOverrides.skip);
  const allGameLocations = gameData.locations;

  // --- Step 1: Parse WorldMap.json for hierarchy ---
  // Builds: gameLocId -> { regionName, areaId, tooltipText }
  const worldMapInfo = {}; // gameLocId -> { region, areaId, areaLocations[] }
  const areaTooltips = {}; // areaKey -> [{ id, text, condition }]
  const areaGameLocations = {}; // "Region/AreaId" -> [gameLocId, ...]

  for (const [regionName, region] of Object.entries(gameData.worldMap)) {
    for (const area of region.MapAreas || []) {
      const areaKey = `${regionName}/${area.Id}`;
      areaGameLocations[areaKey] = [];

      // Collect tooltips for this area
      areaTooltips[areaKey] = (area.Tooltips || []).map(tt => ({
        id: tt.Id,
        text: resolveLocalizedTextFull(tt.Text),
        condition: tt.Condition || null,
      }));

      // Map each WorldPosition's game locations to this area
      for (const wp of area.WorldPositions || []) {
        const locs = [wp.LocationName, ...(wp.LocationNames || [])].filter(Boolean);
        for (const loc of locs) {
          worldMapInfo[loc] = { region: regionName, areaId: area.Id, areaKey };
          areaGameLocations[areaKey].push(loc);
        }
      }
    }
  }

  // --- Step 2: Build residents lookup from Characters.json ---
  const locationResidents = {};
  for (const [name, data] of Object.entries(gameData.characters)) {
    if (!data.Home || data.Home.length === 0) continue;
    const homeLoc = data.Home[0]?.Location;
    if (!homeLoc) continue;
    if (!locationResidents[homeLoc]) locationResidents[homeLoc] = [];
    locationResidents[homeLoc].push(toVillagerEntityId(name));
  }

  // --- Step 3: Resolve display names ---
  // Priority: overrides > Locations.json DisplayName > WorldMap tooltip > game loc ID
  function resolveDisplayName(gameLocId) {
    if (locOverrides.displayNameOverrides[gameLocId]) {
      return locOverrides.displayNameOverrides[gameLocId];
    }
    const locData = allGameLocations[gameLocId];
    if (locData?.DisplayName) {
      const resolved = resolveLocalizedText(locData.DisplayName);
      // Skip unresolved template strings like "{0} Farm"
      if (resolved && !resolved.includes('{0}') && !resolved.includes('[LocalizedText')) {
        return resolved;
      }
    }
    return null;
  }

  // --- Step 4: Determine entity IDs and hierarchy ---
  // Region mapping: WorldMap region name -> entity ID
  const REGION_ENTITIES = {
    'Valley': 'map-valley',
    'GingerIsland': 'map-island',
  };

  // Entity IDs: use override if present, otherwise derive from game location ID
  function toLocationEntityId(gameLocId) {
    let id;
    if (locOverrides.entityIdOverrides?.[gameLocId]) {
      id = locOverrides.entityIdOverrides[gameLocId];
    } else {
      id = toKebabCase(gameLocId.replace(/_/g, '-'));
    }
    // Enforce map- prefix for all map location entities
    return id.startsWith('map-') ? id : `map-${id}`;
  }

  // Determine which game location is the "primary" location for each area.
  // Priority: 1) "Default" position ID, 2) position whose LocationName matches
  // the area's ScrollText/main tooltip, 3) position whose ID matches the area ID
  const areaDefaultLocation = {}; // areaKey -> gameLocId
  for (const [regionName, region] of Object.entries(gameData.worldMap)) {
    for (const area of region.MapAreas || []) {
      const areaKey = `${regionName}/${area.Id}`;
      for (const wp of area.WorldPositions || []) {
        if (wp.Id === 'Default' && wp.LocationName) {
          areaDefaultLocation[areaKey] = wp.LocationName;
          break;
        }
      }
      // If no "Default" position, look for a position matching the area ID
      if (!areaDefaultLocation[areaKey]) {
        for (const wp of area.WorldPositions || []) {
          // Position ID matches area ID, or LocationName matches area ID
          if (wp.LocationName && (wp.Id === area.Id || wp.LocationName === area.Id)) {
            areaDefaultLocation[areaKey] = wp.LocationName;
            break;
          }
        }
      }
      // Last resort: single-position area — the only position is the default
      if (!areaDefaultLocation[areaKey]) {
        const positions = (area.WorldPositions || []).filter(wp => wp.LocationName);
        if (positions.length === 1) {
          areaDefaultLocation[areaKey] = positions[0].LocationName;
        }
      }
    }
  }

  // --- Step 5: Build the lookup for every game location ---
  for (const [gameLocId] of Object.entries(allGameLocations)) {
    if (skipSet.has(gameLocId)) continue;

    const wmInfo = worldMapInfo[gameLocId];
    const displayName = resolveDisplayName(gameLocId);

    // Farm variants: collapsed to parent Farm area
    if (locOverrides.farmVariants[gameLocId]) {
      const farmName = locOverrides.farmVariants[gameLocId];
      const entityId = toLocationEntityId(gameLocId);
      locationLookup[gameLocId] = {
        displayName: farmName,
        entityId,
        mapEntityId: 'map-farm',
        mapName: 'The Farm',
        parentRegion: 'map-valley',
        type: 'farm',
        residents: locationResidents[gameLocId] || [],
      };
      continue;
    }

    if (!displayName) {
      // No display name and no override — skip (utility locations)
      continue;
    }

    let parentRegion, mapEntityId, mapName, areaKey, entityId;

    if (wmInfo) {
      areaKey = wmInfo.areaKey;
      const regionEntityId = REGION_ENTITIES[wmInfo.region];
      // Desert is under Valley in WorldMap but we treat it as its own region
      if (wmInfo.areaId === 'Desert') {
        parentRegion = 'map-desert';
      } else {
        parentRegion = regionEntityId || 'map-valley';
      }

      // Determine if this location IS the area's default location
      const isAreaDefault = areaDefaultLocation[areaKey] === gameLocId;
      if (isAreaDefault) {
        // This game location IS the area — entityId is the area ID
        entityId = toLocationEntityId(gameLocId);
        mapEntityId = entityId;
        mapName = displayName;
      } else {
        // This is a sub-location within an area
        entityId = toLocationEntityId(gameLocId);
        const areaDefaultLocId = areaDefaultLocation[areaKey];
        if (areaDefaultLocId) {
          mapEntityId = toLocationEntityId(areaDefaultLocId);
          mapName = resolveDisplayName(areaDefaultLocId) || areaDefaultLocId;
        } else {
          // Area has no Default position — use area ID as entity
          mapEntityId = `map-${toKebabCase(wmInfo.areaId)}`;
          mapName = wmInfo.areaId;
        }
      }

      // Allow parentOverrides to override even WorldMap-derived parents
      const wmParentOverride = locOverrides.parentOverrides[gameLocId];
      if (wmParentOverride) {
        mapEntityId = toLocationEntityId(wmParentOverride);
        mapName = resolveDisplayName(wmParentOverride) || wmParentOverride;
      }
    } else {
      // Not in WorldMap — use parent overrides
      entityId = toLocationEntityId(gameLocId);
      const parentGameLocId = locOverrides.parentOverrides[gameLocId];
      if (parentGameLocId) {
        mapEntityId = toLocationEntityId(parentGameLocId);
        mapName = resolveDisplayName(parentGameLocId) || parentGameLocId;
        // Inherit region from parent's WorldMap info
        const parentWm = worldMapInfo[parentGameLocId];
        if (parentWm) {
          parentRegion = REGION_ENTITIES[parentWm.region] || 'map-valley';
          if (parentWm.areaId === 'Desert') parentRegion = 'map-desert';
        } else {
          parentRegion = 'map-valley';
        }
      } else {
        mapEntityId = entityId;
        mapName = displayName;
        parentRegion = 'map-valley';
      }
    }

    // Fish zone: some locations have a distinct fish zone entity
    // e.g., Mountain's fish zone is "Mountain Lake" (a separate entity under Mountains)
    const fishZone = locOverrides.fishZones?.[gameLocId];

    locationLookup[gameLocId] = {
      displayName,
      entityId,
      mapEntityId,
      mapName,
      parentRegion,
      residents: locationResidents[gameLocId] || [],
      ...(fishZone ? {
        fishZoneEntityId: fishZone.entityId,
        fishZoneName: fishZone.displayName,
      } : {}),
    };
  }

  // Also handle VolcanoDungeon which is in WorldMap but not in Locations.json
  for (const [gameLocId, wmInfo] of Object.entries(worldMapInfo)) {
    if (locationLookup[gameLocId] || allGameLocations[gameLocId] || skipSet.has(gameLocId)) continue;
    const displayName = locOverrides.displayNameOverrides[gameLocId];
    if (!displayName) continue;
    const entityId = toLocationEntityId(gameLocId);
    const regionEntityId = REGION_ENTITIES[wmInfo.region] || 'map-valley';
    const areaDefaultLocId = areaDefaultLocation[wmInfo.areaKey];
    locationLookup[gameLocId] = {
      displayName,
      entityId,
      mapEntityId: areaDefaultLocId ? toLocationEntityId(areaDefaultLocId) : entityId,
      mapName: areaDefaultLocId ? (resolveDisplayName(areaDefaultLocId) || areaDefaultLocId) : displayName,
      parentRegion: wmInfo.areaId === 'Desert' ? 'map-desert' : regionEntityId,
      residents: locationResidents[gameLocId] || [],
    };
  }

  // Handle synthetic locations (game locations not in Locations.json)
  for (const [name, synth] of Object.entries(locOverrides.syntheticLocations || {})) {
    if (name.startsWith('_')) continue;
    if (locationLookup[name]) continue;
    const parentGameLocId = synth.parent;
    const parentWm = worldMapInfo[parentGameLocId];
    // Enforce map- prefix on synthetic entity IDs
    const rawId = synth.entityId || toKebabCase(name.replace(/_/g, '-'));
    const synthEntityId = rawId.startsWith('map-') ? rawId : `map-${rawId}`;
    locationLookup[name] = {
      displayName: synth.displayName,
      entityId: synthEntityId,
      mapEntityId: toLocationEntityId(parentGameLocId),
      mapName: resolveDisplayName(parentGameLocId) || parentGameLocId,
      parentRegion: parentWm ? (REGION_ENTITIES[parentWm.region] || 'map-valley') : 'map-valley',
      residents: locationResidents[name] || [],
    };
  }

  // Build reverse map: villager entity ID -> home location entity ID
  for (const [gameLocId, villagerIds] of Object.entries(locationResidents)) {
    const locEntityId = toLocationEntityId(gameLocId);
    for (const vilId of villagerIds) {
      villagerHomeLocation[vilId] = locEntityId;
    }
  }

  console.log(`  ✓ Built location lookup for ${Object.keys(locationLookup).length} locations`);
  console.log(`  ✓ WorldMap covers ${Object.keys(worldMapInfo).length} locations`);
  console.log(`  ✓ ${Object.keys(locationResidents).length} locations have residents`);
  console.log(`  ✓ ${Object.keys(villagerHomeLocation).length} villagers have home locations`);
}

// Resolve [LocalizedText ...] references that may span multiple string tables
// (handles both Strings\StringsFromCSFiles and Strings\WorldMap references)
function resolveLocalizedTextFull(value) {
  if (!value || !value.includes('[LocalizedText')) return value;
  return value.replace(/\[LocalizedText\s+Strings\\+(\w+):([^\]\s]+)[^\]]*\]/g, (match, tableName, key) => {
    const resolved = stringTables[tableName]?.[key];
    return resolved || match;
  });
}

// Location name lookup: internal ID -> display name for fish sources
// Uses fishZoneName if available (e.g., "Mountain Lake" for Mountain)
function getLocationDisplayName(locId) {
  const data = locationLookup[locId];
  if (!data) return locId;
  return data.fishZoneName || data.displayName;
}

// Location entity ID lookup: internal ID -> zone entityId (for fish sources)
// Returns the fish zone entity ID if the location has a distinct fish zone
function getLocationEntityId(locId) {
  const data = locationLookup[locId];
  if (!data) return null;
  return data.fishZoneEntityId || data.entityId;
}

// Location map area entity ID lookup: internal ID -> mapEntityId (for forage/tilling/etc)
// Fish spawn at specific water bodies (zones), but forage/artifacts spawn across the whole area.
function getLocationMapEntityId(locId) {
  return locationLookup[locId]?.mapEntityId || locationLookup[locId]?.entityId || null;
}

// Location map area display name lookup: internal ID -> mapName (for forage/tilling/etc)
function getLocationMapDisplayName(locId) {
  return locationLookup[locId]?.mapName || locationLookup[locId]?.displayName || locId;
}

// Display name -> entityId lookup (for tilling/garbage can sources that use display names)
const displayNameToEntityId = {};
const displayNameToMapEntityId = {};
for (const [, data] of Object.entries(locationLookup)) {
  if (data.displayName && data.entityId) {
    displayNameToEntityId[data.displayName] = data.entityId;
  }
  if (data.fishZoneName && data.fishZoneEntityId) {
    displayNameToEntityId[data.fishZoneName] = data.fishZoneEntityId;
  }
  if (data.displayName && data.mapEntityId) {
    displayNameToMapEntityId[data.displayName] = data.mapEntityId;
  }
}

const SEASON_INTS = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };

for (const [locId, locData] of Object.entries(gameData.locations)) {
  // Forage spawns across the whole map area, not just a specific water body
  const displayName = getLocationMapDisplayName(locId);

  for (const entry of (locData.Forage || [])) {
    const itemId = entry.ItemId;
    if (!itemId) continue;
    if (!itemId.startsWith('(O)')) continue;
    const gameId = itemId;

    const entityId = getLocationMapEntityId(locId);
    const source = { type: 'forage', location: displayName, locationId: entityId };

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

// monsterDropsByGameId: gameId -> [{ type:'monster-drop', monster, rolls }]
// rolls is an array of independent drop probabilities for the same item.
// When rolls.length === 1 this is a simple single-chance drop.
// When rolls.length > 1 each roll is an independent Bernoulli trial — the player
// can receive 0..N of the item per kill depending on how many rolls succeed.
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
    // Append this roll to the existing entry for this item+monster, or create a new one
    const existing = monsterDropsByGameId.get(gameId).find(d => d.monster === monsterName);
    if (existing) {
      existing.rolls.push(chance);
    } else {
      monsterDropsByGameId.get(gameId).push({ type: 'monster-drop', monster: monsterName, rolls: [chance] });
    }
  }
}

// Also populate monsterDropsByGameId from extra monsters (C# hardcoded variants)
for (const [monsterName, extra] of Object.entries(rules.extraMonsters)) {
  if (monsterName.startsWith('_')) continue;
  const dropsStr = extra.drops || '';
  const dropParts = dropsStr.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i + 1 < dropParts.length; i += 2) {
    const rawId = parseInt(dropParts[i], 10);
    const chance = parseFloat(dropParts[i + 1]);
    if (isNaN(rawId) || isNaN(chance) || chance <= 0 || rawId < 0) continue;
    const gameId = `(O)${rawId}`;
    if (!monsterDropsByGameId.has(gameId)) monsterDropsByGameId.set(gameId, []);
    const existing = monsterDropsByGameId.get(gameId).find(d => d.monster === monsterName);
    if (existing) {
      existing.rolls.push(chance);
    } else {
      monsterDropsByGameId.get(gameId).push({ type: 'monster-drop', monster: monsterName, rolls: [chance] });
    }
  }
}

// fishPondSourcesByGameId: produces gameId -> [{ type:'fish-pond', fishTag, minPopulation, rolls }]
// rolls is an array of { chance, quantity } for independent drop checks from the same pond+population.
const fishPondSourcesByGameId = new Map();

for (const pondEntry of gameData.fishPondData) {
  const fishTag = pondEntry.RequiredTags?.[0] || pondEntry.Id;

  for (const produced of (pondEntry.ProducedItems || [])) {
    const itemId = produced.ItemId;
    if (!itemId) continue;
    if (!itemId.startsWith('(O)')) continue;
    const gameId = itemId;
    const minPop = produced.RequiredPopulation || 1;
    const quantity = (produced.MinStack != null && produced.MinStack > 0) ? produced.MinStack : 1;

    if (!fishPondSourcesByGameId.has(gameId)) fishPondSourcesByGameId.set(gameId, []);
    const arr = fishPondSourcesByGameId.get(gameId);
    // Merge rolls for the same fish+population
    const existing = arr.find(d => d.fishTag === fishTag && d.minPopulation === minPop);
    if (existing) {
      existing.rolls.push({ chance: produced.Chance, quantity });
    } else {
      arr.push({
        type: 'fish-pond',
        fishTag,
        minPopulation: minPop,
        rolls: [{ chance: produced.Chance, quantity }],
      });
    }
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
        existing.push({ type: 'garbage-can', location: canId, locationId: displayNameToEntityId[canId] || null });
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
  // Tilling happens across the whole area, not at specific water bodies
  const tillingLocName = (locId) => {
    if (locId.startsWith('Farm_')) return 'Farm';
    if (locId === 'Default') return 'All outdoor areas';
    return getLocationMapDisplayName(locId);
  };
  const tillingLocEntityId = (locId) => {
    if (locId.startsWith('Farm_')) return 'map-farm';
    if (locId === 'Default') return null;
    return getLocationMapEntityId(locId);
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
        existing.push({ type: 'tilling', location: displayName, locationId: tillingLocEntityId(locId), chance: entry.Chance });
      }
    }
  }

  // Second pass: items can also declare their own ArtifactSpotChances on
  // Objects.json (1.6 generic mechanism — Strange Doll, Chicken Statue, etc).
  // Map is { LocationName → chance }. Skip locations we already discovered
  // via the per-location pass to avoid double-counting.
  for (const [rawId, obj] of Object.entries(gameData.objects)) {
    const chances = obj.ArtifactSpotChances;
    if (!chances) continue;
    const gameId = `(O)${rawId}`;
    if (!tillingSourcesByGameId.has(gameId)) tillingSourcesByGameId.set(gameId, []);
    const existing = tillingSourcesByGameId.get(gameId);
    for (const [locId, chance] of Object.entries(chances)) {
      if (SKIP_TILLING.has(locId)) continue;
      const displayName = tillingLocName(locId);
      if (existing.find(s => s.location === displayName)) continue;
      existing.push({ type: 'tilling', location: displayName, locationId: tillingLocEntityId(locId), chance });
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

// Pre-load TV schedule so cooking unlock parsing can suppress vestigial l N values
const tvScheduleRecipes = new Set(
  Object.values(loadJson(path.join(GAME_EXPORTS_DIR, 'TV_CookingChannel.json'))).map(v => v.split('/')[0])
);

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

    // Parse unlock: 'default'=always known, 'l N'=tv-only (l 100) or vestigial (ignored when in TV schedule),
    // 'f NPC N'=friendship, 's Skill N'=skill level
    const unlockStr = parts[3]?.trim() || 'default';
    let unlockCondition = null;
    if (unlockStr.startsWith('s ')) {
      const tokens = unlockStr.split(' ');
      unlockCondition = { type: 'skill', skill: tokens[1].toLowerCase(), level: parseInt(tokens[2], 10) };
    } else if (unlockStr.startsWith('l ') && unlockStr !== 'l 0') {
      const lvl = parseInt(unlockStr.slice(2), 10);
      // l 100 = Queen of Sauce (TV only). l N where recipe is in TV schedule = also TV-only;
      // the l N value has no player-level meaning — it's vestigial game data.
      if (!tvScheduleRecipes.has(recipeName)) {
        unlockCondition = { type: 'level', level: lvl };
      }
      // else: TV schedule handles the unlock; no separate condition needed
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
// Inject Lupini's Night Market painting sources (hardcoded in C#, not in Shops.json)
const lupiniRules = loadJson(path.join(RULES_DIR, 'lupini-paintings.json'));
for (const painting of lupiniRules.paintings) {
  const qualifiedId = `(F)${painting.gameId}`;
  const source = {
    type: 'shop',
    id: 'loc-night-market-lupini',
    price: lupiniRules.price,
    yearCycle: painting.yearCycle,
    days: [`Winter ${painting.day}`],
  };
  if (!furnitureShopSourcesByGameId.has(qualifiedId)) furnitureShopSourcesByGameId.set(qualifiedId, []);
  furnitureShopSourcesByGameId.get(qualifiedId).push(source);
}
console.log(`  ✓ Lupini painting sources: ${lupiniRules.paintings.length} paintings`);
console.log(`  ✓ Furniture shop sources: ${furnitureShopSourcesByGameId.size} furniture items`);
console.log(`  ✓ Hat shop sources: ${hatShopSourcesByGameId.size} hat items`);
console.log(`  ✓ Forage sources: ${forageSourcesByGameId.size} items`);
console.log(`  ✓ Monster drop sources: ${monsterDropsByGameId.size} items`);
console.log(`  ✓ Fish pond sources: ${fishPondSourcesByGameId.size} items`);
console.log(`  ✓ Garbage can sources: ${garbageCanSourcesByGameId.size} items`);
console.log(`  ✓ Tilling sources: ${tillingSourcesByGameId.size} items`);
console.log(`  ✓ Crafting sources: ${craftingSourcesByGameId.size} items`);

// tailoringSourcesByGameId: qualified item ID -> [{ type:'tailoring', ingredientDetails }]
// tailoringUsedInByGameId: qualified object ID -> [{ recipeId (qualified hat/clothing ID), recipeName, type:'tailoring' }]
const tailoringSourcesByGameId = new Map();
const tailoringUsedInByGameId = new Map();
{
  // Build tag → { gameId, name } lookup (game generates item_<name> tags at runtime)
  const tagToItem = {};
  for (const [id, obj] of Object.entries(gameData.objects)) {
    const tag = 'item_' + (obj.Name || '').toLowerCase().replace(/ /g, '_');
    const name = resolveLocalizedText(obj.DisplayName) || obj.Name;
    tagToItem[tag] = { gameId: `(O)${id}`, name };
    tagToItem[`id_o_${id}`] = { gameId: `(O)${id}`, name };
  }

  // Resolve a context tag to all matching qualified gameIds
  // Handles: item_* tags (1:1), ContextTags matches, Category-based tags
  const CATEGORY_TAG_MAP = {
    'category_fish': -4,
    'category_vegetable': -75,
    'category_fruits': -79,
  };
  function resolveTagToGameIds(tag) {
    // Specific item tag
    if (tagToItem[tag]) return [tagToItem[tag].gameId];
    // Category-number tag (e.g. category_fish -> Category -4)
    if (CATEGORY_TAG_MAP[tag] != null) {
      const cat = CATEGORY_TAG_MAP[tag];
      return Object.entries(gameData.objects)
        .filter(([, obj]) => obj.Category === cat)
        .map(([id]) => `(O)${id}`);
    }
    // ContextTags match (e.g. tree_seed_item, fish_ocean, season_spring)
    const matches = Object.entries(gameData.objects)
      .filter(([, obj]) => (obj.ContextTags || []).includes(tag))
      .map(([id]) => `(O)${id}`);
    return matches;
  }

  // Cloth is always the first ingredient
  const clothItem = Object.entries(gameData.objects).find(([, o]) => o.Name === 'Cloth');
  const clothGameId = clothItem ? `(O)${clothItem[0]}` : null;
  const clothIngredient = clothItem
    ? { gameId: clothGameId, name: resolveLocalizedText(clothItem[1].DisplayName) || 'Cloth', amount: 1 }
    : { name: 'Cloth', amount: 1 };

  for (const recipe of (gameData.tailoringRecipes || [])) {
    const craftedId = recipe.CraftedItemId;
    if (!craftedId) continue;
    const spoolTags = recipe.SecondItemTags || [];

    // Resolve spool material to a structured ingredient
    let spoolIngredient;
    if (spoolTags.length === 1 && tagToItem[spoolTags[0]]) {
      // Single item tag → resolve directly to the item
      const item = tagToItem[spoolTags[0]];
      spoolIngredient = { gameId: item.gameId, name: item.name, amount: 1 };
    } else if (spoolTags.length === 1) {
      // Single group tag → link to tag entity, use raw tag as name
      const tagId = 'tag-' + spoolTags[0].replace(/_/g, '-');
      spoolIngredient = { id: tagId, name: spoolTags[0], amount: 1 };
    } else {
      // Multiple tags — AND condition
      // Link to the most specific (non-category, non-season) tag entity
      const specificTag = spoolTags.find(t => !t.startsWith('category_') && !t.startsWith('season_'))
        || spoolTags.find(t => !t.startsWith('category_'))
        || spoolTags[0];
      const tagId = 'tag-' + specificTag.replace(/_/g, '-');
      spoolIngredient = { id: tagId, name: specificTag, amount: 1 };
    }

    const source = {
      type: 'tailoring',
      ingredientDetails: [clothIngredient, spoolIngredient],
    };
    if (!tailoringSourcesByGameId.has(craftedId)) tailoringSourcesByGameId.set(craftedId, []);
    tailoringSourcesByGameId.get(craftedId).push(source);

    // Build reverse: every matching object -> used in this tailoring recipe
    // Store the full source so the reverse lookup can derive otherIngredients directly
    const reverseEntry = { craftedGameId: craftedId, source };
    // Cloth is always an ingredient; add it once per recipe
    if (clothGameId) {
      if (!tailoringUsedInByGameId.has(clothGameId)) tailoringUsedInByGameId.set(clothGameId, []);
      tailoringUsedInByGameId.get(clothGameId).push(reverseEntry);
    }
    // Spool ingredients: resolve tags to matching objects
    // Multiple tags are AND conditions — intersect the resolved sets
    let spoolMatchIds;
    if (spoolTags.length === 1) {
      spoolMatchIds = resolveTagToGameIds(spoolTags[0]);
    } else {
      const sets = spoolTags.map(tag => new Set(resolveTagToGameIds(tag)));
      const smallest = sets.reduce((a, b) => a.size <= b.size ? a : b);
      spoolMatchIds = [...smallest].filter(gid => sets.every(s => s.has(gid)));
    }
    for (const gid of spoolMatchIds) {
      if (!tailoringUsedInByGameId.has(gid)) tailoringUsedInByGameId.set(gid, []);
      tailoringUsedInByGameId.get(gid).push(reverseEntry);
    }
  }
}
console.log(`  ✓ Tailoring sources: ${tailoringSourcesByGameId.size} items`);
console.log(`  ✓ Tailoring reverse index: ${tailoringUsedInByGameId.size} ingredients`);

// geodeSourcesByGameId: qualified drop ID -> [{ type:'geode', geodeGameId, geodeName }]
// Parsed from GeodeDrops on Objects.json — geodes, troves, golden coconuts
const geodeSourcesByGameId = new Map();
{
  for (const geodeId of rules.geodeItems) {
    const obj = gameData.objects[geodeId];
    if (!obj?.GeodeDrops) continue;
    const geodeName = resolveLocalizedText(obj.DisplayName) || obj.Name;
    const qualifiedGeodeId = `(O)${geodeId}`;

    for (const drop of obj.GeodeDrops) {
      const dropIds = [];
      if (drop.ItemId) dropIds.push(drop.ItemId);
      if (drop.RandomItemId) dropIds.push(...drop.RandomItemId);

      for (const dropId of dropIds) {
        if (!geodeSourcesByGameId.has(dropId)) geodeSourcesByGameId.set(dropId, []);
        geodeSourcesByGameId.get(dropId).push({
          type: 'geode',
          geodeGameId: qualifiedGeodeId,
          geodeName,
        });
      }
    }
  }
}
// Deduplicate: same drop can appear in Omni Geode's list AND a specific geode
for (const [key, sources] of geodeSourcesByGameId) {
  const seen = new Set();
  geodeSourcesByGameId.set(key, sources.filter(s => {
    const k = s.geodeGameId;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }));
}
console.log(`  ✓ Geode/trove sources: ${geodeSourcesByGameId.size} items`);

// fishingChestSourcesByGameId: gameId -> [{ type:'fishing-chest', chance, note }]
// Hand-curated from rules/fishing-chest-drops.json since the game's fishing
// treasure logic is hardcoded in source (not data-driven).
const fishingChestSourcesByGameId = new Map();
for (const drop of rules.fishingChestDrops) {
  if (!drop.gameId) continue;
  if (!fishingChestSourcesByGameId.has(drop.gameId)) {
    fishingChestSourcesByGameId.set(drop.gameId, []);
  }
  fishingChestSourcesByGameId.get(drop.gameId).push({
    type: 'fishing-chest',
    chance: drop.chance,
    note: drop.note,
  });
}
console.log(`  ✓ Fishing chest sources: ${fishingChestSourcesByGameId.size} items`);

// secretNoteSourcesByGameId: gameId -> [{ type:'secret-note-reward', noteNumber, note }]
// Hand-curated from rules/secret-note-rewards.json. These are deterministic
// puzzle solutions (image-puzzle dig spots, mermaid show, etc.) — hardcoded
// in C# source, not data-driven.
const secretNoteSourcesByGameId = new Map();
for (const reward of rules.secretNoteRewards) {
  if (!reward.gameId) continue;
  if (!secretNoteSourcesByGameId.has(reward.gameId)) {
    secretNoteSourcesByGameId.set(reward.gameId, []);
  }
  secretNoteSourcesByGameId.get(reward.gameId).push({
    type: 'secret-note-reward',
    noteNumber: reward.noteNumber,
    note: reward.note,
  });
}
console.log(`  ✓ Secret note sources: ${secretNoteSourcesByGameId.size} items`);

// Parse tap item conditions into human-readable qualifier strings
const TAP_SEASON_NAMES = { 0: 'Spring', 1: 'Summer', 2: 'Fall', 3: 'Winter' };
const TAP_SEASON_LOOKUP = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };
function parseTapConditions(tapItem) {
  const seasons = [];
  const notes = [];

  // Season field (numeric)
  if (tapItem.Season != null) {
    seasons.push(TAP_SEASON_LOOKUP[tapItem.Season]);
  }

  // Condition string — parse known patterns
  if (tapItem.Condition) {
    const cond = tapItem.Condition;
    // DAY_OF_MONTH X Y ...
    const dayMatch = cond.match(/DAY_OF_MONTH\s+([\d\s]+)/);
    if (dayMatch) {
      const days = dayMatch[1].trim().split(/\s+/);
      const ordinals = days.map(d => {
        const n = parseInt(d);
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      });
      notes.push(`only on the ${ordinals.join(' and ')}`);
    }
    // LOCATION_SEASON exclusions (not winter = spring/summer/fall)
    if (/!LOCATION_SEASON\s+Target\s+Winter/i.test(cond) && seasons.length === 0) {
      seasons.push('spring', 'summer', 'fall');
    }
  }

  // PreviousItemId — indicates this output follows a specific prior output
  if (tapItem.PreviousItemId && tapItem.PreviousItemId.length > 0 && tapItem.PreviousItemId[0] !== '') {
    const prevIds = tapItem.PreviousItemId.map(pid => {
      const id = parseItemId(pid);
      const obj = id && typeof id === 'number' ? gameData.objects[id] : null;
      return obj ? obj.Name : pid;
    });
    notes.push(`after harvesting ${prevIds.join(' or ')}`);
  }

  if (seasons.length === 0 && notes.length === 0) return null;
  const result = {};
  if (seasons.length > 0) result.seasons = seasons;
  if (notes.length > 0) result.note = notes.join(', ');
  return result;
}

// tapperSourcesByGameId: gameId -> [{ type:'tapper', treeName, treeId, daysToHarvest, condition? }]
// Parsed from WildTrees.json — each tree's TapItems list points to the item produced.
const tapperSourcesByGameId = new Map();

for (const [treeNumId, treeData] of Object.entries(gameData.wildTrees)) {
  const treeInfo = rules.treeNames[treeNumId];
  if (!treeInfo) continue; // unnamed/unmapped tree, skip

  for (const tapItem of (treeData.TapItems || [])) {
    if (!tapItem.ItemId || tapItem.ItemId === 'PREVIOUS_OUTPUT_ID') continue;
    if (!tapItem.ItemId.startsWith('(O)')) continue;
    const gameId = tapItem.ItemId;

    // Parse season and condition into human-readable qualifiers
    const qualifiers = parseTapConditions(tapItem);

    const source = {
      type: 'tapper',
      treeName: treeInfo.name,
      treeId: treeInfo.id,
      daysToHarvest: tapItem.DaysUntilReady || null,
    };
    if (qualifiers?.seasons) source.seasons = qualifiers.seasons;
    if (qualifiers?.note) source.note = qualifiers.note;

    if (!tapperSourcesByGameId.has(gameId)) tapperSourcesByGameId.set(gameId, []);
    const existing = tapperSourcesByGameId.get(gameId);
    // Allow duplicates when conditions differ (e.g. Mushroom Tree produces Red Mushroom in different contexts)
    const sourceKey = JSON.stringify([treeInfo.id, qualifiers]);
    if (!existing.find(s => JSON.stringify([s.treeId, { seasons: s.seasons, note: s.note }]) === sourceKey)) {
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
// museumRewardSourcesByGameId: rewardItemGameId -> [{ type:'reward', rewardSource, rewardSourceName, condition }]
const museumRewardSourcesByGameId = new Map();
for (const [, val] of Object.entries(gameData.museumRewards)) {
  const rid = val.RewardItemId;
  if (!rid) continue;

  const tags = val.TargetContextTags || [];
  const parts = [];
  for (const tag of tags) {
    const t = tag.Tag, c = tag.Count;
    if (t.startsWith('id_o_')) {
      const objId = t.replace('id_o_', '');
      const name = gameData.objects[objId]?.Name || t;
      parts.push(`donate ${name}`);
    } else if (t === 'item_type_arch') {
      parts.push(`donate ${c} artifact${c !== 1 ? 's' : ''}`);
    } else if (t === 'item_type_minerals') {
      parts.push(`donate ${c} mineral${c !== 1 ? 's' : ''}`);
    } else if (t === '') {
      parts.push(c === -1 ? 'complete the museum collection' : `donate ${c} items to the museum`);
    }
  }
  const condition = parts.join(', then ');
  const source = { type: 'reward', id: 'map-archaeologyhouse', rewardSource: 'museum', rewardSourceName: "Gunther's Museum", condition };

  if (!museumRewardSourcesByGameId.has(rid)) museumRewardSourcesByGameId.set(rid, []);
  const existing = museumRewardSourcesByGameId.get(rid);
  if (!existing.some(s => s.condition === source.condition)) existing.push(source);
}

// islandFieldOfficeRewardsByGameId: rewardItemGameId -> [{ type:'reward', rewardSource, rewardSourceName, condition }]
const islandFieldOfficeRewardsByGameId = new Map();
const ifoRules = rules.islandFieldOfficeRewards;
for (const reward of (ifoRules.rewards || [])) {
  const gameId = `(O)${reward.rewardItemGameId}`;
  const source = {
    type: 'reward',
    id: 'map-islandfieldoffice',
    rewardSource: 'island-field-office',
    rewardSourceName: ifoRules.rewardSourceName,
    condition: reward.condition,
  };
  if (!islandFieldOfficeRewardsByGameId.has(gameId)) islandFieldOfficeRewardsByGameId.set(gameId, []);
  islandFieldOfficeRewardsByGameId.get(gameId).push(source);
}

// slayerRewardSourcesByGameId: rewardItemGameId -> [{ type:'reward', rewardSource, rewardSourceName, condition }]
const slayerRewardSourcesByGameId = new Map();
for (const [, quest] of Object.entries(gameData.monsterSlayerQuests)) {
  if (!quest.RewardItemId) continue;
  const gameId = quest.RewardItemId;
  const source = {
    type: 'reward',
    id: 'map-adventureguild',
    rewardSource: 'adventure-guild',
    rewardSourceName: "Adventurer's Guild",
    condition: `Kill ${quest.Count} ${quest.Targets.join(', ')}`,
  };
  if (!slayerRewardSourcesByGameId.has(gameId)) slayerRewardSourcesByGameId.set(gameId, []);
  slayerRewardSourcesByGameId.get(gameId).push(source);
}

// breakableDropsByGameId: gameId -> [{ type:'breakable-drop', breakableId, ... }]
// Populated later during breakable processing; applied as a post-processing enrichment pass.
const breakableDropsByGameId = new Map();

// mineChestSourcesByGameId: gameId -> [{ description }]
// Weapons found in mine chests, parsed from Weapons.json MineBaseLevel field.
const mineChestSourcesByGameId = new Map();
for (const [rawId, weaponObj] of Object.entries(gameData.weapons)) {
  const mineBaseLevel = weaponObj.MineBaseLevel ?? -1;
  if (mineBaseLevel < 0) continue;
  const gameId = `(W)${rawId}`;
  const description = mineBaseLevel >= 121
    ? `Mine chest (Skull Cavern, floors ${mineBaseLevel}+)`
    : `Mine chest (floors ${mineBaseLevel}+)`;
  if (!mineChestSourcesByGameId.has(gameId)) mineChestSourcesByGameId.set(gameId, []);
  mineChestSourcesByGameId.get(gameId).push({ type: 'mine-chest', description, mineFloor: mineBaseLevel });
}

function buildAcquisitionSources(gameId) {
  const sources = [];
  for (const map of [
    shopSourcesByGameId, forageSourcesByGameId, monsterDropsByGameId,
    fishPondSourcesByGameId, garbageCanSourcesByGameId, tillingSourcesByGameId,
    craftingSourcesByGameId, cookingSourcesByGameId, tapperSourcesByGameId,
    mailSourcesByGameId, museumRewardSourcesByGameId, islandFieldOfficeRewardsByGameId,
    slayerRewardSourcesByGameId, geodeSourcesByGameId, fishingChestSourcesByGameId,
    secretNoteSourcesByGameId,
  ]) {
    if (map.has(gameId)) sources.push(...map.get(gameId));
  }
  return sources;
}


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
    subtype: cropType,
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
console.log(`    Fruits: ${cropData.filter(c => c.subtype === 'fruit').length}`);
console.log(`    Vegetables: ${cropData.filter(c => c.subtype === 'vegetable').length}`);
console.log(`    Flowers: ${cropData.filter(c => c.subtype === 'flower').length}`);

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
  const isSpecialForage = gameId === '416' // Snow Yam (lacks forage_item tag but is forage)
    || gameId === '296'; // Salmonberry (bush fruit, not a plantable fruit tree)

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
    subtype: 'forage',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    seasons: seasons.length > 0 ? seasons : ['spring', 'summer', 'fall', 'winter'],
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

  const fruitName = fruitObject.Name;

  // Map season numbers to names
  const seasons = (treeInfo.Seasons || []).map(s => seasonMap[s]).filter(Boolean);

  // Find the matching sapling item in Objects.json (category -74)
  const saplingEntry = Object.entries(gameData.objects).find(([id, obj]) =>
    obj.Category === -74 && obj.Name === `${fruitName} Sapling`
  );
  const saplingGameId = saplingEntry ? parseGameId(saplingEntry[0]) : null;
  const saplingObject = saplingEntry ? saplingEntry[1] : null;

  // Fruit trees take 28 days to mature
  const daysToMature = 28;

  fruitTreeData.push({
    subtype: 'fruit-tree-sapling',
    id: `${toKebabCase(fruitName)}-sapling`,
    gameId: saplingGameId ? `(O)${saplingGameId}` : null,
    name: `${fruitName} Sapling`,
    fruitGameId: fruitGameId,
    fruitId: toKebabCase(fruitName),
    fruitName: fruitName,
    icon: `assets/objects/${toIconFilename(`${fruitName} Sapling`)}`,
    price: saplingObject?.Price || 0,
    gameCategory: -74,
    contextTags: saplingObject?.ContextTags || [],
    seasons: seasons,
    daysToMature: daysToMature,
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${fruitTreeData.length} fruit tree items`);

// Add selling locations and acquisition sources to fruit tree saplings
fruitTreeData.forEach(item => {
  item.sellingLocations = getSellingLocations(item.gameCategory, shopSellingLocations);
  item.sources = buildAcquisitionSources(item.gameId);
});

// ============================================================================
// Process Wild Trees (the trees themselves, not their seeds)
// ============================================================================
console.log('\nProcessing wild trees...');
const wildTreeData = [];

let wildTreesExport = {};
try {
  wildTreesExport = loadJson(path.join(GAME_EXPORTS_DIR, 'WildTrees.json'));
} catch (e) {
  console.warn('  Warning: Could not load WildTrees.json');
}

const wildTreeRules = loadJson(path.join(RULES_DIR, 'wild-trees.json'));
const mergedWildTrees = new Map(); // canonical ID → merged tree data

for (const [treeId, treeInfo] of Object.entries(wildTreesExport)) {
  const rule = wildTreeRules.trees[treeId];
  if (!rule) {
    console.warn(`  Warning: No name mapping for wild tree ID ${treeId}`);
    continue;
  }

  // If this is a variant, merge tap items into the canonical tree
  const canonicalId = rule.mergeInto || treeId;
  const canonicalRule = wildTreeRules.trees[canonicalId];

  if (!mergedWildTrees.has(canonicalId)) {
    const canonicalInfo = wildTreesExport[canonicalId] || treeInfo;
    const seedId = parseItemId(canonicalInfo.SeedItemId);
    const seedObj = seedId ? gameData.objects[seedId] : null;

    mergedWildTrees.set(canonicalId, {
      treeId: canonicalId,
      name: canonicalRule.name,
      seedGameId: seedId ? `(O)${seedId}` : null,
      seedId: seedObj ? toKebabCase(seedObj.Name) : null,
      seedName: seedObj?.Name || null,
      tapItems: [],
      chopDrops: [],
      dropsWood: canonicalInfo.DropWoodOnChop,
      seedOnChopChance: canonicalInfo.SeedOnChopChance || 0,
    });
  }

  const merged = mergedWildTrees.get(canonicalId);

  // Collect tap items from this variant
  for (const tapItem of (treeInfo.TapItems || [])) {
    const itemId = parseItemId(tapItem.ItemId);
    if (!itemId || tapItem.ItemId === 'PREVIOUS_OUTPUT_ID') continue;
    const itemObj = gameData.objects[itemId];
    if (!itemObj) continue;
    const qualifiers = parseTapConditions(tapItem);
    // Allow duplicates when conditions differ (e.g. Mushroom Tree seasonal variants)
    const tapKey = JSON.stringify([`(O)${itemId}`, qualifiers]);
    if (merged.tapItems.some(t => JSON.stringify([t.gameId, { seasons: t.seasons, note: t.note }]) === tapKey)) continue;
    merged.tapItems.push({
      gameId: `(O)${itemId}`,
      id: toKebabCase(itemObj.Name),
      name: itemObj.Name,
      daysUntilReady: tapItem.DaysUntilReady || null,
      seasons: qualifiers?.seasons || undefined,
      note: qualifiers?.note || undefined,
    });
  }

  // Collect chop items from this variant
  for (const chopItem of (treeInfo.ChopItems || [])) {
    const itemId = parseItemId(chopItem.ItemId);
    if (!itemId) continue;
    // Resolve item name — could be object or hat
    const isHat = chopItem.ItemId.startsWith('(H)');
    let itemName;
    let friendlyId;
    if (isHat) {
      const hatNumId = chopItem.ItemId.replace(/^\(H\)/, '');
      const hatStr = gameData.hats[hatNumId];
      const hatParts = hatStr ? hatStr.split('/') : [];
      itemName = hatParts[5] || hatParts[0] || `Hat ${hatNumId}`;
      friendlyId = toKebabCase(itemName);
    } else {
      const itemObj = gameData.objects[itemId];
      itemName = itemObj?.Name || chopItem.ObjectDisplayName || `Item ${itemId}`;
      friendlyId = toKebabCase(itemName);
    }
    const qualifiedId = chopItem.ItemId; // already qualified e.g. (O)92, (H)42
    // Avoid duplicates from merged variants
    if (merged.chopDrops.some(c => c.gameId === qualifiedId && c.forStump === (chopItem.ForStump || false))) continue;
    merged.chopDrops.push({
      gameId: qualifiedId,
      id: friendlyId,
      name: itemName,
      chance: chopItem.Chance ?? 1.0,
      minStack: chopItem.MinStack > 0 ? chopItem.MinStack : 1,
      maxStack: chopItem.MaxStack > 0 ? chopItem.MaxStack : null,
      forStump: chopItem.ForStump || false,
      minSize: chopItem.MinSize || null,
    });
  }
}

// Convert merged trees into entities
for (const [treeId, tree] of mergedWildTrees) {
  const friendlyId = `tree-${toKebabCase(tree.name)}`;

  // Consolidate trunk + stump drops for the same item into a single entry
  const consolidatedDrops = [];
  for (const drop of tree.chopDrops) {
    const existing = consolidatedDrops.find(c => c.gameId === drop.gameId);
    if (existing) {
      // Merge: add stump stack to trunk stack range
      existing.minStack = (existing.minStack || 1) + (drop.minStack || 1);
      if (existing.maxStack || drop.maxStack) {
        existing.maxStack = (existing.maxStack || existing.minStack - (drop.minStack || 1)) + (drop.maxStack || drop.minStack || 1);
      }
      // Take the higher chance (both are usually 1.0)
      existing.chance = Math.max(existing.chance, drop.chance);
    } else {
      consolidatedDrops.push({ ...drop });
    }
  }

  wildTreeData.push({
    subtype: 'wild-tree',
    id: friendlyId,
    name: tree.name,
    icon: tree.seedGameId ? `assets/objects/${toIconFilename(tree.seedName)}` : null,
    seedId: tree.seedId,
    seedGameId: tree.seedGameId,
    tapItems: tree.tapItems,
    chopDrops: consolidatedDrops.length > 0
      ? consolidatedDrops.map(({ forStump, minSize, ...rest }) => rest)
      : undefined,
    dropsWood: tree.dropsWood,
    seedOnChopChance: tree.seedOnChopChance > 0 ? tree.seedOnChopChance : undefined,
    bundles: [],
    gifts: {},
    sources: [],
  });
}

wildTreeData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${wildTreeData.length} wild trees`);

// Now build fruit tree entities (the tree itself, not the sapling)
console.log('  Processing fruit trees as tree entities...');
const fruitTreeEntityData = [];

for (const sapling of fruitTreeData) {
  const fruitObj = gameData.objects[sapling.fruitGameId];
  const friendlyId = `tree-${sapling.fruitId}`;

  fruitTreeEntityData.push({
    subtype: 'fruit-tree',
    id: friendlyId,
    name: `${sapling.fruitName} Tree`,
    icon: `assets/objects/${toIconFilename(sapling.fruitName)}`,
    saplingId: sapling.id,
    saplingGameId: sapling.gameId,
    fruitId: sapling.fruitId,
    fruitGameId: sapling.fruitGameId ? `(O)${sapling.fruitGameId}` : null,
    fruitName: sapling.fruitName,
    seasons: sapling.seasons,
    daysToMature: sapling.daysToMature,
    bundles: [],
    gifts: {},
    sources: [],
  });
}

fruitTreeEntityData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${fruitTreeEntityData.length} fruit trees`);

// Combine into one array for tagging
const treeEntityData = [...wildTreeData, ...fruitTreeEntityData];

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
  if (!sourceTree) continue; // Skip fruits not from a plantable fruit tree (e.g. Salmonberry)
  const seasons = sourceTree.seasons || [];

  treeFruitsData.push({
    subtype: 'tree-fruit',
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
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations, gameId),
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
  const gems = rules.categoriesFile.gems || [];
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
    subtype: mineralType,
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations, gameId),
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
    id: 'furnace',
    inputs: []
  };

  if (rules.smeltingRecipes[objectData.Name]) {
    producedBy.inputs = rules.smeltingRecipes[objectData.Name];
  }

  metalBarData.push({
    subtype: 'metal-bar',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    producedBy: producedBy,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations, gameId),
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
  const lootRarity = rules.categoriesFile.monsterLootRarity || {};
  const rareItems = lootRarity.rare || [];
  if (rareItems.includes(name) || price >= 500) return 'rare';

  const uncommonItems = lootRarity.uncommon || [];
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
    subtype: 'monster-loot',
    id: friendlyId,
    gameId: itemGameId,
    name: objectData.Name,
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    rarity: rarity,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations, gameId),
    sources: buildAcquisitionSources(`(O)${gameId}`),
    bundles: [],
    gifts: {}
  });
}

console.log(`  Processed ${monsterLootData.length} monster loot items`);
console.log(`    Rare: ${monsterLootData.filter(m => m.rarity === 'rare').length}`);
console.log(`    Uncommon: ${monsterLootData.filter(m => m.rarity === 'uncommon').length}`);
console.log(`    Common: ${monsterLootData.filter(m => m.rarity === 'common').length}`);

// ============================================================================
// Process Monsters
// ============================================================================
console.log('\nProcessing monsters...');
const monsterData = [];

// Load monster metadata from rules
const monsterMeta = rules.extraMonsters._meta || {};
const skipMonsters = new Set(monsterMeta.skip || []);
const MONSTER_NAME_OVERRIDES = monsterMeta.nameOverrides || {};
const MONSTER_ICON_OVERRIDES = monsterMeta.iconOverrides || {};
const DEBUFF_MAP = rules.debuffIds || {};

for (const [internalName, rawData] of Object.entries(gameData.monsters)) {
  if (skipMonsters.has(internalName)) continue;

  const parts = rawData.split('/');
  const hp = parseInt(parts[0], 10);
  const resilience = parseInt(parts[1], 10);
  const minCoins = parseInt(parts[2], 10);
  const maxCoins = parseInt(parts[3], 10);
  const isGlider = parts[4] === 'true';
  const damageToFarmer = parseInt(parts[7], 10);
  const speed = parseInt(parts[10], 10);
  const missChance = parseFloat(parts[11]);
  const rawDisplayName = parts[14] || internalName;

  const displayName = MONSTER_NAME_OVERRIDES[internalName] || rawDisplayName;

  const friendlyId = `monster-${toKebabCase(internalName)}`;
  const locations = rules.monsterLocations[internalName] || [];
  const dropsStr = parts[6] || '';
  const dropParts = dropsStr.trim().split(/\s+/).filter(Boolean);
  const debuffs = [];
  for (let i = 0; i + 1 < dropParts.length; i += 2) {
    const rawId = parseInt(dropParts[i], 10);
    const chance = parseFloat(dropParts[i + 1]);
    if (isNaN(rawId) || isNaN(chance) || chance <= 0) continue;
    if (rawId < 0) {
      const debuffName = DEBUFF_MAP[String(rawId)];
      if (debuffName && !debuffs.some(d => d.name === debuffName)) {
        debuffs.push({ name: debuffName, chance });
      }
      continue;
    }
  }

  monsterData.push({
    subtype: 'monster',
    id: friendlyId,
    name: displayName,
    internalName,
    icon: `assets/monsters/${MONSTER_ICON_OVERRIDES[internalName] || toIconFilename(rawDisplayName)}`,
    hp,
    resilience,
    damageToFarmer,
    speed,
    ...(isGlider ? { isGlider: true } : {}),
    ...(missChance > 0 ? { missChance } : {}),
    ...(minCoins > 0 || maxCoins > 0 ? { coins: { min: minCoins, max: maxCoins } } : {}),
    ...(locations.length > 0 ? { locations } : {}),
    ...(debuffs.length > 0 ? { debuffs } : {}),
    sources: locations.map(loc => ({ type: 'location', locationId: loc.locationId, ...(loc.qualifier ? { qualifier: loc.qualifier } : {}) })),
  });
}

// Add hand-curated extra monsters (C# hardcoded variants not in Monsters.json)
for (const [internalName, extra] of Object.entries(rules.extraMonsters)) {
  if (internalName.startsWith('_')) continue; // skip comments
  const friendlyId = `monster-${toKebabCase(internalName)}`;

  monsterData.push({
    subtype: 'monster',
    id: friendlyId,
    name: internalName,
    internalName,
    icon: extra.icon ? `assets/monsters/${extra.icon}` : `assets/monsters/${toIconFilename(internalName)}`,
    hp: extra.hp,
    resilience: extra.resilience,
    damageToFarmer: extra.damageToFarmer,
    speed: extra.speed,
    ...(extra.isGlider ? { isGlider: true } : {}),
    ...(extra.locations ? { locations: extra.locations } : {}),
    ...(extra.debuffs ? { debuffs: extra.debuffs } : {}),
    ...(extra.notes ? { notes: extra.notes } : {}),
    sources: (extra.locations || []).map(loc => ({ type: 'location', locationId: loc.locationId, ...(loc.qualifier ? { qualifier: loc.qualifier } : {}) })),
  });
}

// Apply debuffOverrides: C# special-attack debuffs not in the drop-list system
const debuffOverrides = monsterMeta.debuffOverrides || {};
for (const monster of monsterData) {
  const overrides = debuffOverrides[monster.internalName];
  if (!overrides) continue;
  const existing = monster.debuffs || [];
  const merged = [...existing];
  for (const d of overrides) {
    if (!merged.some(e => e.name === d.name)) merged.push(d);
  }
  monster.debuffs = merged;
}

console.log(`  Processed ${monsterData.length} monsters (including ${Object.keys(rules.extraMonsters).filter(k => !k.startsWith('_')).length} extra)`);

// Attach Monster Slayer Quest (Adventure Guild) data to monsters
const slayerQuestByMonster = new Map();
for (const [, quest] of Object.entries(gameData.monsterSlayerQuests)) {
  for (const target of quest.Targets) {
    slayerQuestByMonster.set(target, quest);
  }
}
let slayerCount = 0;
for (const monster of monsterData) {
  const quest = slayerQuestByMonster.get(monster.internalName);
  if (quest) {
    monster.slayerQuest = {
      killCount: quest.Count,
      ...(quest.RewardItemId ? { rewardItemGameId: quest.RewardItemId } : {}),
      ...(quest.RewardItemPrice > 0 ? { rewardGold: quest.RewardItemPrice } : {}),
    };
    slayerCount++;
  }
}
console.log(`  ✓ Attached slayer quest data to ${slayerCount} monsters`);

// ============================================================================
// Process Breakables (mine containers, resource clumps)
// ============================================================================
// Rules sourced from decompiled game code (hardcoded in C#, not in data assets):
//   - BreakableContainer.releaseContents() — barrel/crate loot tables
//   - ResourceClump.performToolAction() + destroy() — stump/log/boulder drops
console.log('\nProcessing breakables...');
const breakableRules = loadJson(path.join(RULES_DIR, 'breakables.json'));
const breakableData = [];

function addBreakableDrop(breakableId, gameId, chance) {
  const qid = typeof gameId === 'number' ? `(O)${gameId}` : (String(gameId).startsWith('(') ? gameId : `(O)${gameId}`);
  if (!breakableDropsByGameId.has(qid)) breakableDropsByGameId.set(qid, []);
  const existing = breakableDropsByGameId.get(qid);
  if (!existing.some(e => e.breakableId === breakableId)) {
    existing.push({ type: 'breakable-drop', breakableId, ...(chance != null ? { chance } : {}) });
  }
}

for (const rule of breakableRules.breakables) {
  // Drops are now objects: { gameId, chance, note? }
  const drops = rule.drops.map(d => typeof d === 'number' ? { gameId: d } : d);

  breakableData.push({
    id: rule.id,
    name: rule.name,
    ...(rule.icon ? { icon: `assets/breakables/${rule.icon}` } : {}),
    subtype: rule.subtype,
    tool: rule.tool,
    toolMinLevel: rule.toolMinLevel ?? null,
    ...(rule.xp != null ? { xp: rule.xp } : {}),
    ...(rule.xpMin != null ? { xpMin: rule.xpMin } : {}),
    ...(rule.xpMax != null ? { xpMax: rule.xpMax } : {}),
    ...(rule.xpSkill ? { xpSkill: rule.xpSkill } : {}),
    locations: rule.locations,
    sources: rule.locations.map(locId => ({ type: 'location', locationId: locId })),
    drops: drops.map(d => ({ gameId: d.gameId, ...(d.chance != null ? { chance: d.chance } : {}) })),
  });

  for (const d of drops) {
    addBreakableDrop(rule.id, d.gameId, d.chance);
  }
}

console.log(`  Processed ${breakableData.length} breakables`);

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
    subtype: 'resource',
    id: friendlyId,
    gameId: id,
    name: objectData.Name,
    icon: `assets/objects/${toIconFilename(objectData.Name)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    gameCategory: objectData.Category || 0,
    contextTags: objectData.ContextTags || [],
    canBeGifted: objectData.CanBeGivenAsGift !== false,
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations, id),
    bundles: [],
    gifts: {}
  });
}

// Synthetic entries for special shop currencies with no Objects.json representation
const syntheticCurrencies = [
  {
    subtype: 'resource',
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
    subtype: 'resource',
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

// World-placed / internal BC objects that players cannot obtain — no wiki images, no point showing them
const UNOBTAINABLE_BC_IDS = new Set([
  22, 23,           // Table Piece L/R (decoration placed in saloons)
  26, 27,           // Wood Chair (world-placed variant, not player-craftable)
  28,               // Skeleton Model
  29,               // Obelisk (world-placed)
  64, 65,           // Bookcase, Fancy Table
  66, 67, 68, 69,   // Ancient Table, Ancient Stool, Grandfather Clock, Teddy Timer
  70,               // Dead Tree
  72,               // Tall Torch
  73,               // Ritual Mask
  74, 75, 76,       // Bonfire, Bongo, Decorative Spears
  78,               // Boulder
  79, 80,           // Door variants
  81, 82,           // Locked Door variants
  99,               // Feed Hopper (placed in coops/barns by game, not craftable)
  106,              // Camera
  111,              // Decorative Pitcher
  118, 119, 120, 121, 122, 123, 124, 125, // Barrel/Crate variants (world-placed)
  128,              // Mushroom Box (world-placed, not the craftable one)
  174, 175,         // Barrel/Crate variants
  219,              // Cursed P.K. Arcade System
  221,              // Item Pedestal
  262, 263,         // Barrel/Crate variants
]);

for (const [rawId, bigCraftable] of Object.entries(gameData.bigCraftables)) {
  const id = parseGameId(rawId);
  // Skip internal placeholder entries
  if (!bigCraftable.Name || bigCraftable.Name.includes('??')) continue;
  // Skip legacy pre-furniture BC House Plant entries (IDs 0-7) — unobtainable, superseded by furniture
  if (typeof id === 'number' && id >= 0 && id <= 7 && bigCraftable.Name === 'House Plant') continue;
  // Skip world-placed / internal objects that players cannot obtain
  if (typeof id === 'number' && UNOBTAINABLE_BC_IDS.has(id)) continue;

  const friendlyId = toKebabCase(bigCraftable.Name);
  const spriteName = extractSpriteNameFromDisplayName(bigCraftable.DisplayName);
  const baseIconFilename = spriteName ? `${spriteName}.png` : `${toIconFilename(bigCraftable.Name)}`;
  // Apply icon-overrides keyed by qualified game ID (e.g. Seasonal Plant variants)
  const qualifiedBCId = `(BC)${rawId}`;
  const iconOverrideWikiName = rules.iconOverrides[qualifiedBCId];
  const iconFilename = iconOverrideWikiName
    ? `${iconOverrideWikiName.replace(/_/g, '')}.png`
    : baseIconFilename;

  // Attach crafting sources so modal can show "How to obtain"
  const sources = craftingSourcesByGameId.has(id)
    ? craftingSourcesByGameId.get(id)
    : [];

  // Attach shop sources (some big-craftables are sold in shops, e.g. Catalogues)
  if (bigCraftableShopSourcesByGameId.has(qualifiedBCId)) {
    sources.push(...bigCraftableShopSourcesByGameId.get(qualifiedBCId));
  }

  // Attach mail sources (some big-craftables are received via mail, e.g. Sewing Machine)
  if (bigCraftableMailSourcesByGameId.has(id)) {
    sources.push(...bigCraftableMailSourcesByGameId.get(id));
  }

  // Attach museum reward sources (e.g. Rarecrows for artifact/donation milestones)
  if (museumRewardSourcesByGameId.has(qualifiedBCId)) {
    sources.push(...museumRewardSourcesByGameId.get(qualifiedBCId));
  }

  const bcVariant = rules.itemVariants[qualifiedBCId];
  const typeOverride = bcVariant?.type;

  bigCraftableData.push({
    subtype: 'big-craftable',
    ...(typeOverride ? { type: typeOverride } : {}),
    id: friendlyId,
    gameId: qualifiedBCId,
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

      // Quality: -1 = inherit/default, 0 = regular, 1 = silver, 2 = gold, 4 = iridium
      const outputQuality = (output.Quality != null && output.Quality >= 0) ? output.Quality : null;
      // MinStack > 1 means multiple items produced (e.g. Ostrich Egg → 10 Mayonnaise)
      const outputCount = (output.MinStack != null && output.MinStack > 1) ? output.MinStack : 1;

      recipes.push({
        id: rule.Id,
        machineId: toKebabCase(machineName),
        outputItemId,
        outputName,
        isFlavored,
        specificItems,
        requiredTags,
        requiredCount,
        processingMinutes,
        outputQuality,
        outputCount
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
  const addProduct = (itemId) => {
    if (!itemId) return;
    if (!animalProducts.has(itemId)) animalProducts.set(itemId, []);
    const sources = animalProducts.get(itemId);
    if (!sources.some(s => s.source === animalName)) {
      sources.push({ source: animalName, hasQuality: true });
    }
  };
  for (const produce of (animalData.ProduceItemIds || [])) addProduct(produce.ItemId);
  for (const produce of (animalData.DeluxeProduceItemIds || [])) addProduct(produce.ItemId);
}

console.log(`  Parsed ${animalProducts.size} unique animal products`);

// Tapper items are parsed from WildTrees.json via tapperSourcesByGameId (built above).

// ============================================================================
// Process Machine Recipes
// ============================================================================

// Map of flavored item names to their gameIds and display names (from curated data)
const flavoredItemIds = {};
const flavoredDisplayNames = {};
const flavoredVariantSuffixes = {};
for (const [key, data] of Object.entries(rules.flavoredItems)) {
  flavoredItemIds[key] = data.gameId;
  flavoredDisplayNames[key] = data.displayName;
  if (data.variantSuffix) flavoredVariantSuffixes[data.displayName] = data.variantSuffix;
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
      matchingItems = cropData.filter(c => c.subtype === 'fruit');
    } else if (recipe.requiredTags.includes('category_vegetable') || recipe.requiredTags.includes('category_greens') || recipe.requiredTags.includes('keg_juice') || recipe.requiredTags.includes('preserves_pickle')) {
      matchingItems = cropData.filter(c => c.subtype === 'vegetable');
    } else if (recipe.requiredTags.includes('category_flowers') || recipe.outputName === 'Honey') {
      // Honey: Bee House has no input (HasInput: false), but nearby flowers flavor the output
      matchingItems = cropData.filter(c => c.subtype === 'flower');
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
      inputType: item.subtype || item.type,
      outputPrice: Math.floor(item.price * formula.multiplier + formula.addition),
      outputIridiumPrice: Math.floor((item.price * formula.multiplier + formula.addition) * rules.qualityMultipliers.artisanProfession)
    })).sort((a, b) => b.outputPrice - a.outputPrice);

    const machineSource = {
      type: 'machine',
      id: recipe.machineId,
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
      subtype: 'artisan',
      id: toKebabCase(displayName),
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
      gifts: {},
      preserveType: recipe.outputName,
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

      const baseOutputPrice = (objectData.Price || 0) * (recipe.outputCount || 1);
      return {
        inputId: getUniqueItemId(`(O)${inputId}`, inputObject.Name),
        inputName: getVariantName(`(O)${inputId}`, inputObject.Name),
        inputGameId: `(O)${inputId}`,
        inputBasePrice: inputObject.Price || 0,
        inputGameCategory: inputObject.Category,
        inputType: inputObject.Type,
        outputPrice: baseOutputPrice,
        outputIridiumPrice: Math.floor(baseOutputPrice * 1.4),
        ...(recipe.outputCount > 1 && { outputCount: recipe.outputCount }),
        ...(recipe.outputQuality != null && { outputQuality: recipe.outputQuality })
      };
    }).filter(Boolean);

    const machineSource = {
      type: 'machine',
      id: recipe.machineId,
      inputType: 'specific',
      valueFormula: `${objectData.Price || 0}`,
      ...(recipe.outputCount > 1 && { outputCount: recipe.outputCount }),
      inputDetails
    };

    const artisanItem = {
      subtype: 'artisan',
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
      // Merge input details if this is the same item with different inputs
      const existingSource = existing.sources[0];
      if (existingSource && artisanItem.sources[0]?.inputDetails) {
        existingSource.inputDetails.push(...artisanItem.sources[0].inputDetails);
        existingSource.inputDetails.sort((a, b) => b.outputPrice - a.outputPrice);
      }
    }
  }
  // Handle tag-based non-flavored recipes (e.g. Mayonnaise from egg_item tags)
  // These produce a fixed output item from any item matching the required context tags.
  else if (recipe.requiredTags.length > 0 && !recipe.isFlavored && outputItemId) {
    const matchingItems = Object.entries(gameData.objects)
      .filter(([, obj]) => recipe.requiredTags.every(tag => (obj.ContextTags || []).includes(tag)))
      .map(([rawId, obj]) => ({ rawId, obj }));

    if (matchingItems.length === 0) continue;

    const baseOutputPrice = (objectData.Price || 0) * (recipe.outputCount || 1);
    const newInputDetails = matchingItems.map(({ rawId, obj }) => ({
      inputId: getUniqueItemId(`(O)${rawId}`, obj.Name),
      inputName: getVariantName(`(O)${rawId}`, obj.Name),
      inputGameId: `(O)${rawId}`,
      inputBasePrice: obj.Price || 0,
      inputGameCategory: obj.Category,
      inputType: obj.Type,
      outputPrice: baseOutputPrice,
      outputIridiumPrice: Math.floor(baseOutputPrice * 1.4),
      ...(recipe.outputCount > 1 && { outputCount: recipe.outputCount }),
      ...(recipe.outputQuality != null && { outputQuality: recipe.outputQuality })
    }));

    // Merge into existing artisan item if already created (e.g. Mayonnaise from specific-item rules)
    const existing = artisanData.find(item => item.gameId === `(O)${outputItemId}`);
    if (existing) {
      const existingSource = existing.sources[0];
      if (existingSource?.inputDetails) {
        // Exclude inputs already covered by a specific-item rule for this machine
        // (specific rules take priority in the game engine, e.g. Duck Egg → Duck Mayonnaise, not Mayonnaise)
        const claimedBySpecific = new Set(
          machineRecipes
            .filter(r => r.machineId === recipe.machineId && r.specificItems.length > 0)
            .flatMap(r => r.specificItems.map(id => `(O)${id}`))
        );
        const existingGameIds = new Set(existingSource.inputDetails.map(d => d.inputGameId));
        for (const detail of newInputDetails) {
          if (!existingGameIds.has(detail.inputGameId) && !claimedBySpecific.has(detail.inputGameId)) {
            existingSource.inputDetails.push(detail);
          }
        }
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
    if (!existing.find(e => e.id === toKebabCase(animalName))) {
      existing.push({ id: toKebabCase(animalName), hasQuality: true });
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

  // Classify animal product subtype from name
  const apName = objectData.Name.toLowerCase();
  const animalProductType = apName.includes('egg') ? 'egg'
    : apName.includes('milk') ? 'milk'
    : 'other';
  const item = {
    subtype: animalProductType,
    id: getUniqueItemId(gameId, objectData.Name),
    gameId,
    name: getVariantName(gameId, objectData.Name),
    gameCategory: objectData.Category || 0,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    hasQuality: true,
    sources: animalSources.map(a => ({ type: 'animal', id: a.id })),
    contextTags: objectData.ContextTags || [],
    sellingLocations: getSellingLocations(objectData.Category || 0, shopSellingLocations, gameId),
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
    subtype: 'artisan',
    id: toKebabCase(objectData.Name),
    gameId,
    name: objectData.Name,
    gameCategory: objectData.Category || -27,
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    sources: buildAcquisitionSources(gameId), // tapper sources included via tapperSourcesByGameId
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
      subtype: 'fish',
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
      subtype: 'fish',
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
  // extractedData keys are bare numeric IDs or string IDs (e.g. "128", "Goby")
  // fish.gameId uses the "(O)" prefix (e.g. "(O)128", "(O)Goby") — strip it for lookup
  const lookupKey = fish.gameId.replace(/^\(O\)/, '');
  const locationEntries = extractedData.locations[lookupKey];
  if (locationEntries && locationEntries.length > 0) {
    const fishSources = locationEntries.map(({ location, locationId, seasons }) => ({
      type: 'fish',
      location,
      locationId: locationId || null,
      seasons: seasons  // null = all seasons, array = specific seasons
    }));
    fish.sources.push(...fishSources);
    locationsMerged++;
  }

  const minLevel = extractedData.minFishingLevels[lookupKey];
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
// Build fish pond variant entities (one per fish with a FishPondData match)
// ============================================================================
console.log('\nBuilding fish pond variant entities...');

const fishPondVariantData = [];

{
  // The game auto-generates an "item_<name_lower_underscored>" context tag for every object.
  // FishPondData entries use RequiredTags with these auto-generated tags (and generic group tags)
  // to match fish. We replicate that logic here.
  function autoItemTag(name) {
    return 'item_' + name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function matchFishPondEntry(fishContextTags, autoTag) {
    const allTags = [...fishContextTags, autoTag];
    let best = null;
    for (const entry of gameData.fishPondData) {
      const reqTags = entry.RequiredTags || [];
      if (reqTags.length === 0) continue;
      if (!reqTags.every(t => allTags.includes(t))) continue;
      if (!best) { best = entry; continue; }
      if (entry.Precedence < best.Precedence) { best = entry; continue; }
      if (entry.Precedence === best.Precedence && reqTags.length > (best.RequiredTags || []).length) {
        best = entry; continue;
      }
    }
    return best;
  }

  // Parse a gate item string like "(O)709 10" or "(O)404 2 3" into a structured object.
  // Format: "<qualifiedId> [minQty [maxQty]]"
  function parseGateItem(str) {
    const parts = str.trim().split(/\s+/);
    const gameId = parts[0];
    const rawId = gameId.replace(/^\(O\)/, '');
    const obj = gameData.objects[rawId];
    const minQty = parts[1] ? parseInt(parts[1], 10) : 1;
    const maxQty = parts[2] ? parseInt(parts[2], 10) : minQty;
    return {
      gameId,
      name: obj?.Name || rawId,
      icon: obj ? `assets/objects/${toIconFilename(obj.Name)}` : null,
      minQty,
      maxQty,
    };
  }

  let variantsBuilt = 0;
  for (const fish of fishData) {
    const rawId = fish.gameId.replace(/^\(O\)/, '');
    const rawObj = gameData.objects[rawId];
    if (!rawObj) continue;

    const fishAutoTag = autoItemTag(rawObj.Name);
    const pondEntry = matchFishPondEntry(fish.contextTags || [], fishAutoTag);
    if (!pondEntry) continue;

    // Parse produces
    const produces = [];
    for (const produced of (pondEntry.ProducedItems || [])) {
      const itemId = produced.ItemId;
      if (!itemId || !itemId.startsWith('(O)')) continue;
      const rawProdId = itemId.replace(/^\(O\)/, '');
      const prodObj = gameData.objects[rawProdId];
      if (!prodObj) continue;
      const minQty = produced.MinStack > 0 ? produced.MinStack : 1;
      const maxQty = produced.MaxStack > 0 ? produced.MaxStack : minQty;
      produces.push({
        gameId: itemId,
        name: prodObj.Name,
        icon: `assets/objects/${toIconFilename(prodObj.Name)}`,
        minPopulation: produced.RequiredPopulation || 1,
        chance: produced.Chance,
        minQty,
        maxQty,
      });
    }
    produces.sort((a, b) => a.minPopulation - b.minPopulation || b.chance - a.chance);

    // Parse population gates into structured tiers
    // PopulationGates: { "4": ["(O)709 10", ...], "6": [...] }
    // null means population can never increase (e.g. legendary fish, Tiger Trout)
    const rawGates = pondEntry.PopulationGates;
    const tiers = rawGates
      ? Object.entries(rawGates)
          .map(([popStr, optionStrs]) => ({
            population: parseInt(popStr, 10),
            options: (optionStrs || []).map(parseGateItem),
          }))
          .sort((a, b) => a.population - b.population)
      : [];

    const variantId = `${fish.id}-pond`;
    const variantEntity = {
      id: variantId,
      name: `${fish.name} Pond`,
      type: 'building',
      subtype: 'fish-pond-variant',
      gameId: `(BLD)Fish Pond:${fish.gameId}`,  // synthetic: fish pond containing this fish species
      icon: 'assets/objects/FishPond.png',
      fishId: fish.id,
      fishName: fish.name,
      parentBuildingId: 'fish-pond',
      maxPopulation: pondEntry.MaxPopulation === -1 ? null : pondEntry.MaxPopulation,
      tiers,
      produces,
      sources: [],
    };

    fishPondVariantData.push(variantEntity);

    // Set backref on the fish entity
    fish.pondEntityId = variantId;

    variantsBuilt++;
  }

  console.log(`  ✅ Built ${variantsBuilt} fish pond variant entities`);
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
  preserveType: 'Roe',
  sources: [
    {
      type: 'machine',
      id: 'fish-pond',
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
  preserveType: 'AgedRoe',
  sources: [
    {
      type: 'machine',
      id: 'preserves-jar',
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
    subtype: 'artisan',
    gameCategory: caviarObjectData.Category || -26,
    price: caviarObjectData.Price || 0,
    edibility: caviarObjectData.Edibility || -300,
    icon: `assets/objects/${getIconFilename(caviarRules.gameId, caviarObjectData.Name, caviarObjectData)}`,
    contextTags: caviarObjectData.ContextTags || [],
    sources: [
      {
        type: 'machine',
        id: 'preserves-jar',
        inputType: 'specific',
        processingTimeMinutes: rules.roeMechanics.agedRoe.processingTimeMinutes,
        valueFormula: `${caviarObjectData.Price || 0}`,
        inputDetails: [{
          inputId: `${toKebabCase(caviarFishObject.Name)}-roe`,
          inputName: `${caviarFishObject.Name} Roe`,
          inputGameId: `(O)${rules.roeMechanics.roe.gameId}`,
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

// Derive social villagers from Characters.json (CanSocialize !== 'FALSE' and valid name)
const villagerNames = Object.entries(gameData.characters)
  .filter(([name, data]) => name !== '???' && data.CanSocialize !== 'FALSE')
  .map(([name]) => name)
  .sort();

// Mappings for numeric enum fields in Characters.json
const BIRTH_SEASON_MAP = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };
const GENDER_MAP = { 0: 'male', 1: 'female', 2: 'other' };
const AGE_MAP = { 0: 'adult', 1: 'teen', 2: 'child' };
const MANNER_MAP = { 0: 'neutral', 1: 'polite', 2: 'rude' };
const SOCIAL_ANXIETY_MAP = { 0: 'outgoing', 1: 'shy', 2: 'neutral' };
const OPTIMISM_MAP = { 0: 'positive', 1: 'negative', 2: 'neutral' };

for (const name of villagerNames) {
  const charData = gameData.characters?.[name];

  const villager = {
    subtype: 'villager',
    id: toVillagerEntityId(name),
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
    if (villagerHomeLocation[villager.id]) villager.homeLocation = villagerHomeLocation[villager.id];
    if (charData.UnlockConditions) villager.unlockConditions = charData.UnlockConditions;
    if (charData.CanBeRomanced) villager.canBeRomanced = true;
    if (charData.LoveInterest) villager.loveInterest = toVillagerEntityId(charData.LoveInterest);
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
  // Gift taste lists use bare IDs (e.g. "202", "Book_PriceCatalogue"), not qualified "(O)202"
  const bareGameId = itemGameId.replace(/^\([^)]+\)/, '');

  // Check for direct ID match
  if (entries.includes(itemGameId) || entries.includes(bareGameId)) return true;

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
  const bareGameId = itemGameId.replace(/^\([^)]+\)/, '');
  return entries.includes(itemGameId) || entries.includes(bareGameId);
}

// Helper function to process gift tastes for an item
function processGiftTastes(item, npcGiftTastes) {
  let matchCount = 0;

  // Get list of all NPCs (excluding Universal_ entries)
  const npcNames = Object.keys(npcGiftTastes).filter(name =>
    !name.startsWith('Universal_') && typeof npcGiftTastes[name] === 'string'
  );

  for (const npcName of npcNames) {
    const npcId = toVillagerEntityId(npcName);
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

// Track rooms for Community Center location generation
// Some bundle "rooms" (e.g. Abandoned Joja Mart) are separate buildings, not CC rooms
const bundleRoomOverrides = rules.bundleRoomOverrides || {};
const bundleRooms = new Map(); // roomName -> [bundleId, ...]

for (const [bundleKey, bundleInfo] of Object.entries(gameData.bundles)) {
  if (typeof bundleInfo !== 'string') continue;

  // bundleKey format: "Room/BundleNumber" (e.g., "Pantry/0", "Crafts Room/13")
  const [roomName, bundleNumberStr] = bundleKey.split('/');
  const bundleNumber = parseInt(bundleNumberStr, 10);

  // Bundle format: "Name/Reward/Items/Color/MinItems"
  const parts = bundleInfo.split('/');
  const bundleName = parts[0];
  const reward = parts[1];
  const itemsString = parts[2];
  const minItems = parseInt(parts[4], 10) || null;

  const friendlyId = `bundle-${toKebabCase(bundleName)}`;
  const roomId = bundleRoomOverrides[roomName]
    || `cc-${toKebabCase(roomName)}`;

  if (!bundleRooms.has(roomName)) bundleRooms.set(roomName, []);
  bundleRooms.get(roomName).push(friendlyId);

  // Parse items
  const items = [];
  let goldCost = null;
  if (itemsString) {
    // Items are space-separated triplets: "itemId quantity quality itemId quantity quality..."
    const itemParts = itemsString.split(' ');
    for (let i = 0; i < itemParts.length; i += 3) {
      const itemId = parseInt(itemParts[i], 10);
      const quantity = parseInt(itemParts[i + 1], 10) || 1;
      const quality = parseInt(itemParts[i + 2], 10) || 0;

      // itemId -1 means gold (used by Vault bundles)
      if (itemId === -1) {
        goldCost = quantity;
        continue;
      }

      const itemObject = gameData.objects[itemId];
      if (itemObject) {
        items.push({
          id: toKebabCase(itemObject.Name),
          gameId: `(O)${itemId}`,
          quantity: quantity,
          quality: quality
        });

        // Add bundle cross-references using qualified ID
        // Some data arrays store gameId as qualified "(O)767", others as bare 767
        const qualifiedItemId = `(O)${itemId}`;
        const matchesGameId = (gid) => gid === qualifiedItemId || gid === itemId;

        const allCollections = [
          fishData, cropData, artisanData, animalProductData, forageData,
          treeFruitsData, mineralData, metalBarData, monsterLootData, resourceData,
        ];
        for (const collection of allCollections) {
          const match = collection.find(e => matchesGameId(e.gameId));
          if (match && !match.bundles.includes(friendlyId)) {
            match.bundles.push(friendlyId);
          }
        }

        // Fruit trees match by fruitGameId (bare, from parseItemId)
        const fruitTree = fruitTreeData.find(f => f.fruitGameId === itemId);
        if (fruitTree && !fruitTree.bundles.includes(friendlyId)) {
          fruitTree.bundles.push(friendlyId);
        }
      }
    }
  }

  // Get icon color from rules
  const iconColor = bundleIcons[friendlyId] || 'green';
  const icon = `assets/bundles/Bundle_${iconColor.charAt(0).toUpperCase() + iconColor.slice(1)}.png`;

  const bundleEntry = {
    id: friendlyId,
    name: bundleName,
    bundleNumber: bundleNumber,
    icon: icon,
    room: roomName,
    roomId: roomId,
    reward: reward,
    items: items,
    minItemsRequired: minItems
  };
  if (goldCost != null) {
    bundleEntry.goldCost = goldCost;
  }
  bundleData.push(bundleEntry);
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
  cropType: item.subtype,
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
    subtype: 'seed',
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
    subtype: 'seed',
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
    subtype: 'seed',
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

// Map context tags to the actual furniture catalogue item IDs
const FURNITURE_CATALOGUE_MAP = {
  'collection_joja':   { id: 'joja-catalogue' },
  'collection_junimo': { id: 'junimo-catalogue' },
  'collection_retro':  { id: 'retro-catalogue' },
  'collection_trash':  { id: 'trash-catalogue' },
  'collection_wizard': { id: 'wizard-catalogue' },
};
const DEFAULT_CATALOGUE = { id: 'furniture-catalogue' };

// Furniture format: name/type/tilesheetSize/boundingBoxSize/rotations/price/placementRestriction/displayName/...
// Named string IDs (e.g. "JojaCatalogue") and numeric IDs (e.g. "0")

// Pre-pass: group furniture entries by resolved display name to detect duplicates.
// Used to auto-assign _1, _2... suffixes to wiki names/icons for variant groups.
const furnitureNameGroups = {};
for (const [rawKey, furnitureStr] of Object.entries(gameData.furniture)) {
  const parts = furnitureStr.split('/');
  const rawName = parts[0];
  const furnitureRule = rules.furnitureNames[rawKey];
  const resolvedName = furnitureRule?.name || stringTables['Furniture']?.[rawName] || resolveLocalizedText(rawName);
  if (!resolvedName) continue;
  if (!furnitureNameGroups[resolvedName]) furnitureNameGroups[resolvedName] = [];
  furnitureNameGroups[resolvedName].push(rawKey);
}

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

  // Determine if this item is part of a duplicate-name group with no wikiName override.
  // If so, auto-append _N suffix (1-based) to distinguish variants.
  const variantGroup = furnitureNameGroups[name];
  const isVariant = !furnitureRule?.wikiName && variantGroup && variantGroup.length > 1;
  const variantSuffix = isVariant ? `_${variantGroup.indexOf(rawKey) + 1}` : '';

  // Wiki name: use override if available, else derive from display name (+ variant suffix)
  const baseWikiName = furnitureRule?.wikiName || name.replace(/'/g, '').replace(/\s+/g, '_');
  const wikiName = furnitureRule?.wikiName ? baseWikiName : baseWikiName + variantSuffix;

  // Icon: if wikiName override exists, strip underscores directly (preserves numeric suffixes like _2_1);
  // otherwise derive from display name + variant suffix.
  const icon = furnitureRule?.wikiName
    ? `assets/objects/${furnitureRule.wikiName.replace(/_/g, '')}.png`
    : `assets/objects/${toIconFilename(name + variantSuffix.replace(/_/g, ' '))}`;

  const sources = [];
  const qualifiedFId = `(F)${rawKey}`;
  if (furnitureShopSourcesByGameId.has(qualifiedFId)) {
    sources.push(...furnitureShopSourcesByGameId.get(qualifiedFId));
  }
  if (furnitureMailSourcesByGameId.has(qualifiedFId)) {
    sources.push(...furnitureMailSourcesByGameId.get(qualifiedFId));
  }

  // Add catalogue source based on context tag (price 0 = freely available via catalogue)
  const catalogue = FURNITURE_CATALOGUE_MAP[contextTag] || DEFAULT_CATALOGUE;
  sources.push({ type: 'shop', id: catalogue.id, price: 0 });

  furnitureData.push({
    id,
    gameId,
    name,
    subtype: furnitureType,
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
        // Hand-curated hat overrides in hat-overrides.json carry only
        // {description, condition?} — give them an explicit type so they
        // survive the Phase 2 normalization pass without a warning.
        const typed = src.type ? src : { type: 'other', ...src };
        if (!typed.condition) return typed;
        const itemNames = collectItemConditionNames(typed.condition, gameData.objects);
        return itemNames ? { ...typed, conditionItemNames: itemNames } : typed;
      })
    : [];
  const qualifiedHId = `(H)${rawKey}`;
  if (hatShopSourcesByGameId.has(qualifiedHId)) {
    sources.push(...hatShopSourcesByGameId.get(qualifiedHId));
  }
  if (slayerRewardSourcesByGameId.has(qualifiedHId)) {
    sources.push(...slayerRewardSourcesByGameId.get(qualifiedHId));
  }
  if (tailoringSourcesByGameId.has(qualifiedHId)) {
    sources.push(...tailoringSourcesByGameId.get(qualifiedHId));
  }
  if (geodeSourcesByGameId.has(qualifiedHId)) {
    sources.push(...geodeSourcesByGameId.get(qualifiedHId));
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
  resourceData,
  // bigCraftableData, furnitureData, and hatData excluded (different ID namespaces — BC, F, H)
];
for (const arr of allExistingObjectArrays) {
  for (const item of arr) {
    if (item.gameId !== undefined) {
      const gid = String(item.gameId);
      alreadyProcessedGameIds.add(gid);
      // Also add bare numeric ID so dedup works for both "(O)69" and "69" formats
      const bare = gid.replace(/^\([A-Z]+\)/, '');
      if (bare !== gid) alreadyProcessedGameIds.add(bare);
    }
  }
}

// Helper to make a base item object from an Objects.json entry
function makeBaseItem(gameId, objectData, subtype) {
  const buffs = parseItemBuffs(objectData);
  const resolvedName = getVariantName(gameId, resolveLocalizedText(objectData.DisplayName) || objectData.Name);
  const description = resolveLocalizedText(objectData.Description) || '';
  const item = {
    subtype,
    id: getUniqueItemId(gameId, objectData.Name),
    gameId,
    name: resolvedName,
    description: description || undefined,
    icon: `assets/objects/${getIconFilename(gameId, objectData.Name, objectData)}`,
    price: objectData.Price || 0,
    edibility: objectData.Edibility ?? -300,
    gameCategory: objectData.Category ?? 0,
    contextTags: objectData.ContextTags || [],
    canBeGifted: objectData.CanBeGivenAsGift !== false,
    sellingLocations: getSellingLocations(objectData.Category ?? 0, shopSellingLocations, gameId),
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
  if (rules.itemVariants[gameId]?.skip) continue;
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

  // Skip Specific Bait template — per-fish variants are generated as flavored artisan items
  if (rawId === 'SpecificBait') {
    alreadyProcessedGameIds.add(rawId);
    continue;
  }

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
// Process Geode Items (items with GeodeDrops — cracked open at Blacksmith or Geode Crusher)
// ============================================================================
console.log('\nProcessing geode items...');
const geodeItemData = [];

for (const geodeId of rules.geodeItems) {
  if (alreadyProcessedGameIds.has(geodeId)) continue;
  const objectData = gameData.objects[geodeId];
  if (!objectData) continue;

  const gameId = `(O)${geodeId}`;
  const item = makeBaseItem(gameId, objectData, 'geode');
  item.sources = buildAcquisitionSources(gameId);

  // Collect qualified game IDs of items that can be found inside this geode
  const contents = [];
  for (const [dropGameId, sources] of geodeSourcesByGameId) {
    if (sources.some(s => s.geodeGameId === gameId)) {
      contents.push(dropGameId);
    }
  }
  item.geodeContents = contents;

  geodeItemData.push(item);
  alreadyProcessedGameIds.add(geodeId);
}

deduplicateIds(geodeItemData);
geodeItemData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${geodeItemData.length} geode items`);

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
  // Skip unnamed placeholder items (e.g. (O)930 is a duplicate of the Concerned Ape Mask hat)
  if (objectData.Name === '???') continue;

  const gameId = `(O)${rawId}`;
  if (rules.itemVariants[gameId]?.skip) continue;
  const item = makeBaseItem(gameId, objectData, 'misc');
  item.sources = buildAcquisitionSources(gameId);
  const miscVariant = rules.itemVariants[gameId];
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
const weaponOverrides = rules.weaponSources.overrides || {};

for (const [rawId, weaponObj] of Object.entries(gameData.weapons)) {
  const gameId = `(W)${rawId}`;
  const name = resolveLocalizedText(weaponObj.DisplayName) || weaponObj.Name;
  const description = resolveLocalizedText(weaponObj.Description) || '';
  const iconName = name.replace(/[^a-zA-Z0-9]/g, '');

  const weaponType = WEAPON_TYPE_NAMES[weaponObj.Type] || 'sword';

  // Merge sources: curated overrides → mine chest drops → standard acquisition sources
  const override = weaponOverrides[rawId] || {};
  // Hand-curated weapon overrides in weapon-sources.json carry only
  // {description}. Default to type 'other' so they survive normalization.
  const sources = override.sources
    ? override.sources.map(s => s.type ? s : { type: 'other', ...s })
    : [];
  if (mineChestSourcesByGameId.has(gameId)) {
    sources.push(...mineChestSourcesByGameId.get(gameId));
  }
  sources.push(...buildAcquisitionSources(gameId));

  weaponData.push({
    subtype: weaponType,
    id: toKebabCase(name),
    gameId,
    name,
    description,
    icon: `assets/objects/${iconName}.png`,
    minDamage: weaponObj.MinDamage ?? 0,
    maxDamage: weaponObj.MaxDamage ?? 0,
    critChance: weaponObj.CritChance ?? 0.02,
    critMultiplier: weaponObj.CritMultiplier ?? 3,
    speed: weaponObj.Speed ?? 0,
    defense: weaponObj.Defense ?? 0,
    knockback: weaponObj.Knockback ?? 1,
    areaOfEffect: weaponObj.AreaOfEffect ?? 0,
    canBeLostOnDeath: weaponObj.CanBeLostOnDeath ?? false,
    sources,
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
    subtype: 'boot',
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

// Tools with no wiki image and no player-accessible acquisition
const SKIP_TOOL_IDS = new Set(['Lantern']);

for (const [rawId, toolObj] of Object.entries(gameData.tools)) {
  if (SKIP_TOOL_IDS.has(rawId)) continue;
  const gameId = `(T)${rawId}`;
  const name = resolveLocalizedText(toolObj.DisplayName) || toolObj.Name || rawId;
  const description = resolveLocalizedText(toolObj.Description) || '';
  const iconName = name.replace(/[^a-zA-Z0-9]/g, '');

  const toolClass = toolObj.ClassName || rawId;
  // Convert PascalCase to kebab-case (e.g. FishingRod → fishing-rod)
  const toolType = toolClass.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  toolData.push({
    subtype: toolType,
    id: getUniqueItemId(gameId, name),
    gameId,
    name,
    description,
    icon: `assets/objects/${iconName}.png`,
    toolClass,
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
    subtype: 'trinket',
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

// Build occupant type → building gameId array map (shared with animal processing below)
const occupantTypeToBuildings = {};
for (const [rawId, b] of Object.entries(gameData.buildings)) {
  for (const type of (b.ValidOccupantTypes || [])) {
    if (!occupantTypeToBuildings[type]) occupantTypeToBuildings[type] = [];
    occupantTypeToBuildings[type].push(`(BLD)${rawId}`);
  }
}

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

  const validOccupantTypes = buildingObj.ValidOccupantTypes || [];

  buildingData.push({
    subtype: 'building',
    id: toKebabCase(name),
    gameId,
    name,
    description,
    icon: `assets/objects/${iconName}.png`,
    builder: buildingObj.Builder ? toVillagerEntityId(buildingObj.Builder) : null,
    buildCost: buildingObj.BuildCost ?? 0,
    buildDays: buildingObj.BuildDays ?? 0,
    buildMaterials,
    maxOccupants: buildingObj.MaxOccupants ?? null,
    maxBuilds: buildingObj.MaxBuilds ?? null,
    magical: buildingObj.MagicalConstruction ?? false,
    ...(validOccupantTypes.length > 0 && { validOccupantTypes }),
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

// Process Farm Animals (FarmAnimals.json)
// ============================================================================
console.log('\nProcessing farm animals...');
const animalData = [];


for (const [rawId, animalObj] of Object.entries(gameData.farmAnimals)) {
  // Resolve display name from localization strings
  const locKey = animalObj.DisplayName?.match(/Strings\\FarmAnimals:(.+)\]$/)?.[1];
  const name = (locKey && gameData.farmAnimalStrings[locKey]) || rawId;

  // Produce IDs are bare numerics — qualify as (O)
  const produceGameIds = (animalObj.ProduceItemIds || [])
    .map(p => `(O)${p.ItemId}`);
  const deluxeProduceGameIds = (animalObj.DeluxeProduceItemIds || [])
    .map(p => `(O)${p.ItemId}`);
  // Egg IDs used for incubator hatching (also bare numerics)
  const eggGameIds = (animalObj.EggItemIds || [])
    .map(id => `(O)${id}`);

  // House type ("Barn"/"Coop") → all compatible building gameIds
  const houseType = animalObj.House || null;
  const validBuildingGameIds = houseType ? (occupantTypeToBuildings[houseType] || []) : [];

  // RequiredBuilding = the specific tier needed to purchase this animal
  const requiredBuildingGameId = animalObj.RequiredBuilding
    ? `(BLD)${animalObj.RequiredBuilding}`
    : null;

  // Sources: shop, hatch, and/or pregnancy (not mutually exclusive)
  const sources = [];
  if (animalObj.PurchasePrice > 0) {
    sources.push({ type: 'shop', id: 'loc-marnie', price: animalObj.PurchasePrice * 2 });
  }
  if (eggGameIds.length > 0) {
    // IncubationTime -1 means use the machine's default. Ostrich uses (BC)254 (15000 min);
    // all others use (BC)101 (9000 min). Dinosaur overrides to 18000 on the regular incubator.
    const isOstrich = eggGameIds.includes('(O)289')
    const incubatorId = isOstrich ? 'ostrich-incubator' : 'incubator'
    const defaultTime = isOstrich ? 15000 : 9000
    const processingTimeMinutes = animalObj.IncubationTime > 0 ? animalObj.IncubationTime : defaultTime
    const inputDetails = eggGameIds.map(gid => {
      const numericId = gid.replace('(O)', '')
      const obj = gameData.objects[numericId]
      const inputName = obj?.Name || numericId
      const inputId = obj ? getUniqueItemId(gid, obj.Name) : null
      return { inputId, inputGameId: gid, inputName, inputType: 'specific' }
    })
    sources.push({ type: 'hatch', id: incubatorId, inputDetails, processingTimeMinutes })
  }
  if (animalObj.CanGetPregnant) {
    sources.push({ type: 'pregnancy' });
  }
  // else: event-unlocked with no data-driven source (e.g. Blue Chicken via Shane heart event)

  // HarvestType: 0 = drops on ground, 1 = tool required, 2 = forage (pigs)
  const harvestType = animalObj.HarvestType ?? 0;

  // Icon: assets/animals/{Name}.png — matches wiki File:{Name}.png
  const iconFilename = rawId.replace(/[^a-zA-Z0-9]/g, '') + '.png';

  animalData.push({
    subtype: 'animal',
    id: toKebabCase(name),
    gameId: `(FA)${rawId}`,
    name,
    icon: `assets/animals/${iconFilename}`,
    houseType,
    validBuildingGameIds,
    ...(requiredBuildingGameId && { requiredBuildingGameId }),
    purchasePrice: animalObj.PurchasePrice > 0 ? animalObj.PurchasePrice * 2 : null,
    sellPrice: animalObj.SellPrice ?? null,
    daysToMature: animalObj.DaysToMature ?? 0,
    daysToProduce: animalObj.DaysToProduce ?? 1,
    harvestType,
    ...(animalObj.HarvestTool && { harvestTool: animalObj.HarvestTool }),
    produceGameIds,
    ...(deluxeProduceGameIds.length > 0 && { deluxeProduceGameIds }),
    canGetPregnant: animalObj.CanGetPregnant ?? false,
    sources,
  });
}

deduplicateIds(animalData);
animalData.sort((a, b) => a.name.localeCompare(b.name));
console.log(`  Processed ${animalData.length} animals`);

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
  ringData, treeSeedData, geodeItemData, miscData,
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
  ringData, treeSeedData, geodeItemData, miscData,
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
    if (typeof item.gameId === 'number') {
      newItemsByGameId.set(String(item.gameId), item);
    } else if (typeof item.gameId === 'string') {
      // Index both "(O)228" and bare "228" / 228 so bundle lookups work regardless of format
      const bare = item.gameId.replace(/^\([A-Z]+\)/, '');
      newItemsByGameId.set(bare, item);
      newItemsByGameId.set(parseInt(bare, 10), item);
    }
  }
}

// Re-scan bundles to add refs for new item types
for (const [bundleKey, bundleInfo] of Object.entries(gameData.bundles)) {
  if (typeof bundleInfo !== 'string') continue;
  const parts = bundleInfo.split('/');
  const bundleName = parts[0];
  const friendlyId = `bundle-${toKebabCase(bundleName)}`;
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

// No intermediary files — proceed directly to compilation

// Extract gift relationships into pivot table
console.log('\n📦 Extracting gift relationships...');
const relationshipsMap = new Map();
const allItemTypes = [
  fishData, artisanData, forageData, fruitTreeData, treeFruitsData,
  mineralData, metalBarData, monsterLootData, resourceData, bigCraftableData, cropData,
  foodData, oreData, geodeMineralData, bombData, fertilizerData,
  baitData, tackleData, flooringData, bookData, artifactData,
  ringData, treeSeedData, geodeItemData, miscData,
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

console.log(`  ✓ Extracted ${relationships.length} unique gift relationships`);

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

// Build grantedByMap: buffId → [itemId, ...]
// Pass 1: data-driven — scan all processed item arrays for items with named buffs (buff.buffId set)
const grantedByMap = new Map(); // buffId → [itemId]
allItemTypes.forEach(items => {
  items.forEach(item => {
    if (!item.buffs || !Array.isArray(item.buffs)) return;
    item.buffs.forEach(buff => {
      if (!buff.buffId) return;
      if (!grantedByMap.has(buff.buffId)) grantedByMap.set(buff.buffId, []);
      const list = grantedByMap.get(buff.buffId);
      if (!list.includes(item.id)) list.push(item.id);
    });
  });
});

// Pass 2: hardcoded item grants from buff-grants.json rules file
const buffGrantsRules = rules.buffGrants || {};
for (const [itemId, buffIds] of Object.entries(buffGrantsRules.items || {})) {
  for (const buffId of buffIds) {
    if (!grantedByMap.has(buffId)) grantedByMap.set(buffId, []);
    const list = grantedByMap.get(buffId);
    if (!list.includes(itemId)) list.push(itemId);
  }
}
for (const [itemId, buffIds] of Object.entries(buffGrantsRules.bigCraftables || {})) {
  for (const buffId of buffIds) {
    if (!grantedByMap.has(buffId)) grantedByMap.set(buffId, []);
    const list = grantedByMap.get(buffId);
    if (!list.includes(itemId)) list.push(itemId);
  }
}

// Pass 3: monster-inflicted debuffs — scan monsterData for debuffs[] entries
// Build debuffNameToMonsters: debuffName → [monsterId, ...]
const debuffNameToMonsters = new Map();
for (const monster of monsterData) {
  if (!monster.debuffs || !Array.isArray(monster.debuffs)) continue;
  for (const d of monster.debuffs) {
    if (!d.name) continue;
    if (!debuffNameToMonsters.has(d.name)) debuffNameToMonsters.set(d.name, []);
    const list = debuffNameToMonsters.get(d.name);
    if (!list.includes(monster.id)) list.push(monster.id);
  }
}

// Mechanism descriptions for buffs granted by game logic (no granting item)
const buffMechanisms = buffGrantsRules.mechanisms || {};

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

  // Build sources from grantedByMap (items that grant this buff)
  const grantingIds = grantedByMap.get(id) || [];
  const sources = grantingIds.map(itemId => ({ type: 'item', id: itemId }));

  // Monster-inflicted debuffs: add monster sources
  const inflictingMonsters = debuffNameToMonsters.get(name) || [];
  for (const monsterId of inflictingMonsters) {
    sources.push({ type: 'monster', id: monsterId });
  }

  const mechanism = buffMechanisms[id] || null;

  buffData.push({
    id,
    name,
    description,
    entityType: 'buff',
    isDebuff: b.IsDebuff || false,
    duration: Math.round(b.Duration / 1000),
    icon: iconFile ? `assets/buffs/${iconFile}.png` : null,
    effects: Object.keys(effects).length > 0 ? effects : null,
    grantedBy: grantingIds,
    ...(mechanism ? { mechanism } : {}),
    sources,
  });
}

console.log(`  ✓ Processed ${buffData.length} buffs`);

// ---------------------------------------------------------------------------
// Process Achievements.json → achievement entities
// ---------------------------------------------------------------------------
console.log('\n🏆 Processing achievements...');

const achievementData = [];
for (const [gameKey, raw] of Object.entries(gameData.achievements)) {
  // Format: "Name^Description^IsVisible^PrerequisiteId^IconIndex"
  const parts = raw.split('^');
  if (parts.length < 5) continue;

  const [rawName, description, isVisible, prerequisiteId, iconIndex] = parts;
  // Strip parenthetical earning amounts from name: "Greenhorn (15k)" → "Greenhorn"
  const name = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const id = `achievement-${toKebabCase(name)}`;

  achievementData.push({
    id,
    achievementId: parseInt(gameKey),
    name,
    description,
    entityType: 'achievement',
    icon: 'assets/objects/StarToken.png',
    isSecret: isVisible === 'false',
    prerequisite: parseInt(prerequisiteId) >= 0 ? parseInt(prerequisiteId) : null,
    iconIndex: parseInt(iconIndex),
  });
}

// Resolve prerequisite gameIds → friendly IDs
const achievementByGameId = new Map(achievementData.map(a => [a.achievementId, a]));
for (const achievement of achievementData) {
  if (achievement.prerequisite != null) {
    const prereq = achievementByGameId.get(achievement.prerequisite);
    achievement.prerequisiteId = prereq ? prereq.id : null;
  } else {
    achievement.prerequisiteId = null;
  }
  delete achievement.prerequisite;
}

console.log(`  ✓ Processed ${achievementData.length} achievements`);

// ---------------------------------------------------------------------------
// Build achievement → eligible item gameIds map
// ---------------------------------------------------------------------------
// Maps achievementId → Set<qualifiedGameId> for item-linked achievements.
// Used later to back-populate item.achievements[] and achievement.requiredItems[].
{
  const achievementById = new Map(achievementData.map(a => [a.achievementId, a]));

  // FISHING chain: Fisherman(24), Ol'Mariner(25), MasterAngler(26)
  // All fish with ExcludeFromFishingCollection=false (cat=-4)
  const fishableGameIds = new Set(
    Object.entries(gameData.objects)
      .filter(([, obj]) => obj.Category === -4 && !obj.ExcludeFromFishingCollection)
      .map(([id]) => `(O)${id}`)
  );
  for (const achId of [24, 25, 26]) {
    const a = achievementById.get(achId);
    if (a) a._eligibleGameIds = fishableGameIds;
  }

  // COOKING chain: Cook(15), SousChef(16), GourmetChef(17)
  // All output items from CookingRecipes.json
  const cookableGameIds = new Set(
    Object.values(gameData.cookingRecipes)
      .map(v => { const p = v.split('/'); return p[2] ? `(O)${p[2].split(' ')[0]}` : null; })
      .filter(Boolean)
  );
  for (const achId of [15, 16, 17]) {
    const a = achievementById.get(achId);
    if (a) a._eligibleGameIds = cookableGameIds;
  }

  // CRAFTING chain: DIY(20), Artisan(21), CraftMaster(22)
  // All output items from CraftingRecipes.json
  const craftableGameIds = new Set(
    Object.values(gameData.craftingRecipes)
      .map(v => {
        const p = v.split('/');
        if (!p[2]) return null;
        const out = p[2].split(' ');
        const isBig = p[3]?.toLowerCase() === 'true';
        return `${isBig ? '(BC)' : '(O)'}${out[0]}`;
      })
      .filter(Boolean)
  );
  for (const achId of [20, 21, 22]) {
    const a = achievementById.get(achId);
    if (a) a._eligibleGameIds = craftableGameIds;
  }

  // Name → qualified gameId lookup (used by all name-based achievement sets below)
  const nameToGameId = {};
  for (const [rawId, obj] of Object.entries(gameData.objects)) {
    if (obj.Name) nameToGameId[obj.Name] = `(O)${rawId}`;
  }

  // POLYCULTURE(31): 28 specific crops — must stay in sync with POLYCULTURE_NAMES in AchievementProgress.js
  const POLYCULTURE_NAMES = new Set([
    'Cauliflower', 'Coffee Bean', 'Garlic', 'Green Bean', 'Kale', 'Parsnip', 'Potato', 'Rhubarb', 'Strawberry',
    'Blueberry', 'Corn', 'Hops', 'Hot Pepper', 'Melon', 'Radish', 'Red Cabbage', 'Starfruit', 'Tomato', 'Wheat',
    'Amaranth', 'Artichoke', 'Beet', 'Bok Choy', 'Cranberries', 'Eggplant', 'Grape', 'Pumpkin', 'Yam',
  ]);
  // MONOCULTURE(32): Polyculture crops + 5 more — must stay in sync with MONOCULTURE_ONLY_NAMES in AchievementProgress.js
  const MONOCULTURE_ONLY_NAMES = new Set(['Ancient Fruit', 'Blue Jazz', 'Fairy Rose', 'Summer Spangle', 'Tulip']);

  // SHIPPING: FullShipment(34)
  // Curated name set — must stay in sync with FULL_SHIPMENT_NAMES in AchievementProgress.js
  const FULL_SHIPMENT_NAMES = new Set([
    'Parsnip', 'Green Bean', 'Cauliflower', 'Potato', 'Garlic', 'Kale', 'Rhubarb',
    'Melon', 'Tomato', 'Blueberry', 'Hot Pepper', 'Wheat', 'Radish', 'Red Cabbage',
    'Starfruit', 'Corn', 'Unmilled Rice', 'Eggplant', 'Artichoke', 'Pumpkin',
    'Bok Choy', 'Yam', 'Cranberries', 'Beet', 'Amaranth', 'Hops', 'Poppy',
    'Strawberry', 'Ancient Fruit', 'Tulip', 'Summer Spangle', 'Fairy Rose', 'Blue Jazz',
    'Coffee Bean', 'Sweet Gem Berry', 'Tea Leaves', 'Ginger', 'Taro Root',
    'Pineapple', 'Mango', 'Carrot', 'Summer Squash', 'Broccoli', 'Powdermelon',
    'Wild Horseradish', 'Daffodil', 'Leek', 'Dandelion', 'Cave Carrot',
    'Coconut', 'Cactus Fruit', 'Banana', 'Salmonberry', 'Morel',
    'Fiddlehead Fern', 'Chanterelle', 'Holly', 'Ostrich Egg',
    'Spring Onion', 'Sweet Pea', 'Common Mushroom', 'Wild Plum', 'Hazelnut',
    'Blackberry', 'Winter Root', 'Crystal Fruit', 'Snow Yam', 'Crocus',
    'Red Mushroom', 'Sunflower', 'Purple Mushroom', 'Grape', 'Spice Berry',
    'Magma Cap', 'Green Tea',
    "Egg (White)", 'Large Egg (White)', 'Egg (Brown)', 'Large Egg (Brown)',
    'Milk', 'Large Milk', 'Void Egg', 'Duck Egg', 'Goat Milk', 'L. Goat Milk',
    'Duck Feather', 'Wool', "Rabbit's Foot", 'Truffle',
    'Mayonnaise', 'Duck Mayonnaise', 'Void Mayonnaise', 'Dinosaur Mayonnaise',
    'Cheese', 'Goat Cheese', 'Cloth', 'Truffle Oil', 'Caviar',
    'Honey', 'Pickles', 'Jelly', 'Beer', 'Pale Ale', 'Wine', 'Juice', 'Mead',
    'Maple Syrup', 'Oak Resin', 'Pine Tar', 'Mystic Syrup',
    'Roe', 'Aged Roe', 'Smoked Fish', 'Squid Ink',
    'Raisins', 'Dried Fruit', 'Dried Mushrooms',
    'Wood', 'Stone', 'Hardwood', 'Sap', 'Fiber', 'Clay', 'Coal', 'Moss',
    'Copper Ore', 'Iron Ore', 'Gold Ore', 'Iridium Ore', 'Radioactive Ore',
    'Copper Bar', 'Iron Bar', 'Gold Bar', 'Iridium Bar', 'Radioactive Bar', 'Refined Quartz',
    'Battery Pack', 'Bone Fragment', 'Cinder Shard',
    'Nautilus Shell', 'Coral', 'Rainbow Shell', 'Sea Urchin',
    'Bug Meat', 'Slime', 'Bat Wing', 'Solar Essence', 'Void Essence',
  ]);
  const fullShipmentGameIds = new Set(
    [...FULL_SHIPMENT_NAMES].map(n => nameToGameId[n]).filter(Boolean)
  );
  const fullShipment = achievementById.get(34);
  if (fullShipment) fullShipment._eligibleGameIds = fullShipmentGameIds;

  const polycultureGameIds = new Set(
    [...POLYCULTURE_NAMES].map(n => nameToGameId[n]).filter(Boolean)
  );
  const monocultureGameIds = new Set(
    [...POLYCULTURE_NAMES, ...MONOCULTURE_ONLY_NAMES].map(n => nameToGameId[n]).filter(Boolean)
  );

  const polyAch = achievementById.get(31);
  if (polyAch) polyAch._eligibleGameIds = polycultureGameIds;
  const monoAch = achievementById.get(32);
  if (monoAch) monoAch._eligibleGameIds = monocultureGameIds;

  // MUSEUM: TreasureTrove(28), ACompleteCollection(5)
  // Handled separately via museumDonatable — skip here to avoid double work.

  // WELL-READ(35): all books (type='book' or subtype='book')
  // We'll resolve this post-merge via entity type rather than gameId set.
  const wellRead = achievementById.get(35);
  if (wellRead) wellRead._eligibleByType = new Set(['book']);
}

// ---------------------------------------------------------------------------
// Process Quests.json → quest entities
// ---------------------------------------------------------------------------
console.log('\n📜 Processing quests...');

const QUEST_TYPE_LABELS = {
  Basic: 'quest',
  Location: 'quest',
  ItemHarvest: 'quest',
  Building: 'quest',
  Crafting: 'quest',
  Social: 'quest',
  Monster: 'quest',
  LostItem: 'quest',
  ItemDelivery: 'quest',
  Fishing: 'quest',
  SecretLostItem: 'quest',
};

const questData = [];
// questRequiredItemsByGameId: itemGameId -> [{ type:'quest-requirement', questId, questName }]
// So items can show "Required by quest: X"
const questRequiredItemsByGameId = new Map();

for (const [gameKey, raw] of Object.entries(gameData.quests || {})) {
  // Format: questType/title/description/objective/target/reward1/reward2/reward3/isMoneyReward[/completionText]
  const parts = raw.split('/');
  if (parts.length < 9) continue;

  const [questType, title, description, objective, target] = parts;
  const reward1 = parts[5];
  const reward2 = parts[6];
  const isMoneyReward = parts[8] === 'true';

  // Skip secret/unnamed quests
  if (title === '...') continue;

  const name = title;
  const id = `quest-${toKebabCase(name)}`;

  // Parse money reward — could be in reward1 (if isMoney=true and numeric) or reward2
  let moneyReward = null;
  if (isMoneyReward) {
    const r2 = parseInt(reward2);
    if (r2 > 0) moneyReward = r2;
    const r1 = parseInt(reward1);
    if (!moneyReward && r1 > 0) moneyReward = r1;
  }

  // Parse next quest from reward1 (when isMoney=false, reward1 is next quest ID)
  // Also handle "hN questId" format (friendship points + next quest)
  let nextQuestGameId = null;
  let friendshipReward = null;
  if (reward1.startsWith('h')) {
    const hMatch = reward1.match(/^h(\d+)(?:\s+(\d+))?$/);
    if (hMatch) {
      friendshipReward = parseInt(hMatch[1]);
      if (hMatch[2]) nextQuestGameId = parseInt(hMatch[2]);
    }
  } else if (!isMoneyReward && reward1 !== '-1') {
    nextQuestGameId = parseInt(reward1);
  }

  // Parse target — extract required item and NPC
  let requiredItem = null;
  let requiredItemAmount = 1;
  let targetNpc = null;
  let targetLocation = null;

  if (target && target !== 'null' && target !== '-1') {
    if (questType === 'ItemDelivery' || questType === 'LostItem') {
      // Format: "NPCName (O)itemId [amount]" or "NPCName (O)itemId LocationName x y"
      const deliveryMatch = target.match(/^(\w+)\s+\(O\)(\d+)(?:\s+(\d+))?/);
      if (deliveryMatch) {
        targetNpc = deliveryMatch[1];
        requiredItem = `(O)${deliveryMatch[2]}`;
        if (deliveryMatch[3] && !target.match(/\(O\)\d+\s+\w+\s+\d+\s+\d+/)) {
          // Only treat as amount if it's NOT followed by location+coords (LostItem format)
          requiredItemAmount = parseInt(deliveryMatch[3]);
        }
      }
    } else if (questType === 'ItemHarvest') {
      // Format: "(O)itemId [amount]" or just "(O)itemId"
      const harvestMatch = target.match(/^\(O\)(\d+)(?:\s+(\d+))?/);
      if (harvestMatch) {
        requiredItem = `(O)${harvestMatch[1]}`;
        if (harvestMatch[2]) requiredItemAmount = parseInt(harvestMatch[2]);
      }
    } else if (questType === 'Crafting') {
      // Format: "(BC)itemId" or "(O)itemId"
      const craftMatch = target.match(/^\((?:BC|O)\)(\d+)/);
      if (craftMatch) {
        const prefix = target.startsWith('(BC)') ? '(BC)' : '(O)';
        requiredItem = `${prefix}${craftMatch[1]}`;
      }
    } else if (questType === 'Location') {
      targetLocation = target;
    } else if (questType === 'Monster') {
      // Format: "MonsterName count null false"
      const monsterMatch = target.match(/^(\w+)\s+(\d+)/);
      if (monsterMatch) {
        targetNpc = monsterMatch[1].replace(/_/g, ' ');
        requiredItemAmount = parseInt(monsterMatch[2]);
      }
    }
  }

  questData.push({
    id,
    questId: parseInt(gameKey),
    name,
    description,
    objective,
    entityType: 'quest',
    icon: 'assets/objects/PrizeTicket.png',
    questType,
    targetNpc: targetNpc || null,
    targetLocation: targetLocation || null,
    requiredItem: requiredItem || null,
    requiredItemAmount,
    moneyReward,
    friendshipReward,
    nextQuestGameId,
    isSecret: !isMoneyReward && questType === 'Basic' && reward1 === '-1' && parseInt(reward2) === 0,
  });
}

// Deduplicate quest IDs (e.g. "The Mysterious Qi" appears 4 times)
deduplicateIds(questData);

// Resolve next quest gameIds → friendly IDs
const questByGameId = new Map(questData.map(q => [q.questId, q]));
for (const quest of questData) {
  if (quest.nextQuestGameId != null) {
    const next = questByGameId.get(quest.nextQuestGameId);
    quest.nextQuestId = next ? next.id : null;
  } else {
    quest.nextQuestId = null;
  }
  delete quest.nextQuestGameId;
}

// Enrich quests with trigger info from mail
const questTriggersByGameId = new Map();
for (const [mailKey, content] of Object.entries(gameData.mail)) {
  if (typeof content !== 'string') continue;
  const questMatch = content.match(/%item quest (\d+)/);
  if (!questMatch) continue;
  const questGameId = parseInt(questMatch[1]);

  const seasonMatch = mailKey.match(/^(spring|summer|fall|winter)_(\d+)_(\d+)$/);
  if (seasonMatch) {
    questTriggersByGameId.set(questGameId, {
      triggerType: 'mail',
      season: seasonMatch[1],
      day: parseInt(seasonMatch[2]),
      year: parseInt(seasonMatch[3]),
    });
  } else {
    questTriggersByGameId.set(questGameId, {
      triggerType: 'mail',
      mailKey,
    });
  }
}

for (const quest of questData) {
  const trigger = questTriggersByGameId.get(quest.questId);
  if (trigger) {
    quest.trigger = trigger;
  }
}

console.log(`  ✓ Enriched ${questTriggersByGameId.size} quests with trigger info`);

// Build quest-requirement sources (after dedup so IDs are final)
for (const quest of questData) {
  if (!quest.requiredItem) continue;
  const src = { type: 'quest-requirement', questId: quest.id, questName: quest.name, amount: quest.requiredItemAmount };
  if (!questRequiredItemsByGameId.has(quest.requiredItem)) questRequiredItemsByGameId.set(quest.requiredItem, []);
  questRequiredItemsByGameId.get(quest.requiredItem).push(src);
}

console.log(`  ✓ Processed ${questData.length} quests (${questRequiredItemsByGameId.size} items referenced)`);

// ---------------------------------------------------------------------------
// Process Powers.json → power entities + book enrichment
// ---------------------------------------------------------------------------
console.log('\n⚡ Processing powers...');

const powerData = [];
// Book powers will be linked to existing book entities in a post-merge pass
const bookPowersByName = new Map();

for (const [gameKey, p] of Object.entries(gameData.powers)) {
  const name = resolveLocalizedText(p.DisplayName);
  if (!name) continue;

  const description = resolveLocalizedText(p.Description) || null;
  const unlockCondition = p.UnlockedCondition ? parseCondition(p.UnlockedCondition) : null;

  if (gameKey.startsWith('Book_')) {
    // Store for later enrichment of existing book entities
    bookPowersByName.set(name, { powerKey: gameKey, description, unlockCondition });
    continue;
  }

  // Categorize: mastery vs key/unlock
  const isMastery = gameKey.startsWith('Mastery_');
  const id = `power-${toKebabCase(name)}`;

  powerData.push({
    id,
    name,
    description,
    entityType: 'power',
    icon: 'assets/objects/Stardrop.png',
    subtype: isMastery ? 'mastery' : 'unlock',
    unlockCondition,
  });
}

console.log(`  ✓ Processed ${powerData.length} powers (${bookPowersByName.size} book powers deferred for enrichment)`);

// ---------------------------------------------------------------------------
// Process Concessions.json → concession entities
// ---------------------------------------------------------------------------
console.log('\n🍿 Processing concessions...');

const concessionData = [];
for (const c of (gameData.concessions || [])) {
  const name = resolveLocalizedText(c.DisplayName) || c.Name;
  if (!name) continue;

  const description = resolveLocalizedText(c.Description) || null;
  const id = `concession-${toKebabCase(name)}`;

  concessionData.push({
    id,
    gameId: `(CN)${c.Id}`,
    name,
    description,
    entityType: 'concession',
    icon: 'assets/objects/MovieTicket.png',
    price: c.Price,
    tags: c.ItemTags || [],
  });
}

console.log(`  ✓ Processed ${concessionData.length} concessions`);

// ---------------------------------------------------------------------------
// Process Movies.json + MoviesReactions.json → movie entities
// ---------------------------------------------------------------------------
console.log('\n🎬 Processing movies...');

const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'];
// Meta tags that don't map to movies or genres — skip these
const REACTION_META_TAGS = new Set(['*', 'love', 'like', 'dislike', 'seen_love', 'seen_like', 'seen_dislike']);

const movieData = [];
for (const m of (gameData.movies || [])) {
  const name = resolveLocalizedText(m.Title) || m.Id;
  if (!name) continue;

  const description = resolveLocalizedText(m.Description) || null;
  const id = `movie-${toKebabCase(name)}`;

  // Schedule: season + year parity
  const seasons = (m.Seasons || []).map(s => SEASON_NAMES[s]).filter(Boolean);
  const yearParity = m.YearRemainder === 0 ? 'even' : 'odd';

  // Genre tags
  const genres = m.Tags || [];

  // Crane prizes — resolve to item references
  const cranePrizes = (m.CranePrizes || []).map(prize => {
    return {
      itemId: prize.ItemId || null,
      rarity: prize.Rarity,
    };
  }).filter(p => p.itemId);

  // NPC reactions: for each NPC, find the best matching reaction for this movie.
  // Priority: movie-specific ID tag > genre tag (first match wins, same as game logic)
  const reactions = [];
  const seenNpcs = new Set();
  for (const npcReaction of (gameData.moviesReactions || [])) {
    const npcName = npcReaction.NPCName;
    if (seenNpcs.has(npcName)) continue;
    // Find best reaction: movie ID match first, then genre match, then wildcard
    let bestReaction = null;
    let wildcardReaction = null;
    for (const r of (npcReaction.Reactions || [])) {
      if (r.Tag === '*') { wildcardReaction = r.Response; continue; }
      if (REACTION_META_TAGS.has(r.Tag)) continue;
      if (r.Tag === m.Id) { bestReaction = r.Response; break; } // exact match wins
      if (!bestReaction && genres.includes(r.Tag)) bestReaction = r.Response;
    }
    if (!bestReaction) bestReaction = wildcardReaction;
    if (bestReaction) {
      reactions.push({ villager: npcName, reaction: bestReaction });
      seenNpcs.add(npcName);
    }
  }

  movieData.push({
    id,
    name,
    description,
    entityType: 'movie',
    icon: 'assets/objects/MovieTicket.png',
    seasons,
    yearParity,
    genres,
    cranePrizes,
    reactions,
  });
}

console.log(`  ✓ Processed ${movieData.length} movies`);

// ---------------------------------------------------------------------------
// Process SecretNotes.json → secret note + journal scrap entities
// ---------------------------------------------------------------------------
console.log('\n📜 Processing secret notes...');

// Build reward lookup: noteNumber → reward entry
const secretNoteRewardsByNote = new Map();
for (const reward of (rules.secretNoteRewards || [])) {
  secretNoteRewardsByNote.set(reward.noteNumber, reward);
}

// Parse %revealtaste tokens: %revealtaste:NPCName:itemId
function parseRevealTasteTokens(text) {
  const tokens = [];
  const re = /%revealtaste:([^:]+):(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ npc: m[1], itemId: `(O)${m[2]}` });
  }
  return tokens;
}

// Clean display text: strip %revealtaste tokens, replace ^^ with newlines, trim
function cleanNoteText(raw) {
  return raw
    .replace(/%revealtaste:[^%\s]+/g, '')
    .replace(/\^\^/g, '\n')
    .replace(/\^/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const secretNoteData = [];
for (const [rawKey, rawText] of Object.entries(gameData.secretNotes || {})) {
  const noteNumber = parseInt(rawKey, 10);
  if (isNaN(noteNumber)) continue;

  const isJournalScrap = noteNumber >= 1000;
  // Notes 16-21 show image-based dig-spot maps; note 11 is a photo with no actionable content
  const MAP_NOTE_NUMBERS = new Set([16, 17, 18, 19, 20, 21]);
  const isMap = MAP_NOTE_NUMBERS.has(noteNumber);
  const hasRevealTaste = rawText.includes('%revealtaste');
  const subtype = isMap ? 'map' : hasRevealTaste ? 'gift-taste' : 'text';
  const displayNumber = isJournalScrap ? noteNumber - 1000 : noteNumber;
  const prefix = isJournalScrap ? 'journal-scrap' : 'secret-note';
  const id = `${prefix}-${noteNumber}`;
  const name = isJournalScrap
    ? `Journal Scrap #${displayNumber}`
    : `Secret Note #${noteNumber}`;

  const reward = secretNoteRewardsByNote.get(noteNumber) ?? null;
  const revealTasteTokens = hasRevealTaste ? parseRevealTasteTokens(rawText) : [];
  const isImageNote = rawText.startsWith('!image');
  const imageIndex = isImageNote ? parseInt(rawText.replace('!image', '').trim(), 10) : null;
  const displayText = isImageNote ? null : cleanNoteText(rawText);

  secretNoteData.push({
    id,
    noteNumber,
    name,
    entityType: isJournalScrap ? 'journal-scrap' : 'secret-note',
    subtype,
    icon: isJournalScrap ? 'assets/objects/JournalScrap.png' : 'assets/objects/SecretNote.png',
    displayText,
    imageIndex,
    revealTasteTokens,
    reward: reward ? { mailFlag: reward.mailFlag, eventId: reward.eventId ?? null, gameId: reward.gameId ?? null, itemName: reward.itemName ?? null, note: reward.note } : null,
    sources: [],
  });
}

// Sort by noteNumber for consistent output
secretNoteData.sort((a, b) => a.noteNumber - b.noteNumber);
console.log(`  ✓ Processed ${secretNoteData.length} secret notes / journal scraps`);

// ---------------------------------------------------------------------------
// Process Pants.json + Shirts.json → clothing entities
// ---------------------------------------------------------------------------
console.log('\n👔 Processing clothing...');

const clothingData = [];
const CLOTHING_ICON_OVERRIDES = rules.clothingIconOverrides;

// Parse pants
for (const [rawId, pantsObj] of Object.entries(gameData.pants || {})) {
  const name = resolveLocalizedText(pantsObj.DisplayName) || pantsObj.Name;
  if (!name) continue;

  const qualifiedId = `(P)${rawId}`;
  const description = resolveLocalizedText(pantsObj.Description) || null;
  const id = `pants-${toKebabCase(name)}`;

  const sources = [];
  if (pantsObj.CanChooseDuringCharacterCustomization) {
    sources.push({ type: 'other', name: 'Character Customization' });
  }
  // Pick up tailoring sources
  if (tailoringSourcesByGameId.has(qualifiedId)) {
    sources.push(...tailoringSourcesByGameId.get(qualifiedId));
  }

  const pantsIconFile = CLOTHING_ICON_OVERRIDES[qualifiedId]
    || `assets/objects/${toIconFilename(name)}`;

  clothingData.push({
    id,
    gameId: qualifiedId,
    name,
    description,
    entityType: 'clothing',
    subtype: 'pants',
    icon: pantsIconFile,
    price: pantsObj.Price || 0,
    canBeDyed: pantsObj.CanBeDyed || false,
    isPrismatic: pantsObj.IsPrismatic || false,
    defaultInCustomization: pantsObj.CanChooseDuringCharacterCustomization || false,
    sources,
  });
}

// Parse shirts
for (const [rawId, shirtObj] of Object.entries(gameData.shirts || {})) {
  const name = resolveLocalizedText(shirtObj.DisplayName) || shirtObj.Name;
  if (!name) continue;

  const qualifiedId = `(S)${rawId}`;
  const description = resolveLocalizedText(shirtObj.Description) || null;
  const id = `shirt-${toKebabCase(name)}`;

  const sources = [];
  if (shirtObj.CanChooseDuringCharacterCustomization) {
    sources.push({ type: 'other', name: 'Character Customization' });
  }
  // Pick up tailoring sources
  if (tailoringSourcesByGameId.has(qualifiedId)) {
    sources.push(...tailoringSourcesByGameId.get(qualifiedId));
  }

  const spriteIndex = shirtObj.SpriteIndex;
  const shirtIconFile = CLOTHING_ICON_OVERRIDES[qualifiedId]
    || `assets/objects/Shirt${String(spriteIndex).padStart(3, '0')}.png`;
  const shirtWikiName = `Shirt${String(spriteIndex).padStart(3, '0')}`;

  clothingData.push({
    id,
    gameId: qualifiedId,
    name,
    description,
    entityType: 'clothing',
    subtype: 'shirt',
    icon: shirtIconFile,
    wikiName: shirtWikiName,
    price: shirtObj.Price || 0,
    canBeDyed: shirtObj.CanBeDyed || false,
    isPrismatic: shirtObj.IsPrismatic || false,
    hasSleeves: shirtObj.HasSleeves ?? true,
    defaultInCustomization: shirtObj.CanChooseDuringCharacterCustomization || false,
    sources,
  });
}

// Deduplicate IDs (some clothing may share names)
deduplicateIds(clothingData);

console.log(`  ✓ Processed ${clothingData.length} clothing items (${clothingData.filter(c => c.subtype === 'pants').length} pants, ${clothingData.filter(c => c.subtype === 'shirt').length} shirts)`);

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

// Reuse villager names derived from Characters.json (computed earlier in villager processing)
const knownNpcNames = new Set(villagerNames);

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
  ringData, treeSeedData, geodeItemData, miscData, furnitureData, hatData,
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
  ])].sort().map(n => toVillagerEntityId(n));

  // Required friendship to trigger this event (deduplicated, known NPCs only)
  const requiredFriendship = (game?.friendship || [])
    .filter(f => knownNpcNames.has(f.npc))
    .map(f => ({ ...f, npc: toVillagerEntityId(f.npc) }));

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
    icon,
    grantedBy,
  });
}

console.log(`  ✓ Processed ${eventData.length} events (${[...eventGrantedBy.keys()].length} with grantedBy)`);

// ============================================================================
// COMPILATION PIPELINE
// Replaces the former CompileData.cjs — operates on in-memory data arrays
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('🔨 Starting compilation pipeline...\n');

// ---------------------------------------------------------------------------
// Load rules for compilation
// ---------------------------------------------------------------------------
const qualityMultipliers = loadJson(path.join(RULES_DIR, 'quality-multipliers.json')).multipliers;
const artisanNaming = loadJson(path.join(RULES_DIR, 'artisan-naming.json')).patterns;
const locationsRules = loadJson(path.join(RULES_DIR, 'locations.json'));
const festivalsRules = loadJson(path.join(RULES_DIR, 'festivals.json'));

// ---------------------------------------------------------------------------
// Expand artisan items (Wine → Ancient Fruit Wine, Starfruit Wine, etc.)
// ---------------------------------------------------------------------------
console.log('🍷 Expanding artisan items...');

const compiledArtisan = [];

artisanData.forEach(artisan => {
  const machineSource = artisan.sources?.find(s => s.type === 'machine');
  const inputDetails = machineSource?.inputDetails || [];

  // Remove gifts (use gifts pivot table)
  const { gifts, ...artisanBase } = artisan;

  if (inputDetails.length > 0) {
    const namingRule = artisanNaming[artisan.name];
    const shouldMergeInputs = inputDetails.length > 1 && namingRule?.pattern === 'none';

    if (shouldMergeInputs) {
      const hasVaryingOutputCount = inputDetails.some(d => d.outputCount && d.outputCount > 1);
      const basePrice = hasVaryingOutputCount ? artisan.price : inputDetails[0].outputPrice;
      const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

      const compiledItem = {
        ...artisanBase,
        type: 'artisan',
        prices: qualityPrices,
        sources: artisan.sources.map(s => {
          if (s.type !== 'machine') return s;
          return { ...s };
        }),
      };
      if (artisan.canBeAged) compiledItem.canBeAged = true;
      if (artisan.agingDaysToIridium) compiledItem.agingDaysToIridium = artisan.agingDaysToIridium;

      compiledArtisan.push(compiledItem);
    } else {
      const isMulti = inputDetails.length > 1;

      if (isMulti) {
        const genericItem = {
          ...artisanBase,
          type: 'artisan',
          isGeneric: true,
          sources: artisan.sources.map(s => {
            if (s.type !== 'machine') return s;
            const { inputDetails: _ids, ...sourceWithoutDetails } = s;
            return sourceWithoutDetails;
          }),
          variations: [],
          canBeAged: artisan.canBeAged || false,
        };
        if (artisan.agingDaysToIridium) genericItem.agingDaysToIridium = artisan.agingDaysToIridium;

        // Targeted Bait: override generic type
        if (artisan.gameId === '(O)SpecificBait') {
          genericItem.type = 'bait';
          genericItem.subtype = 'targeted';
          genericItem.description = 'Increases your chance to catch a specific fish. Created by placing any fish in a Bait Maker.';
        }

        inputDetails.forEach(inputDetail => {
          let variantName;
          const suffix = flavoredVariantSuffixes[artisan.name] || artisan.name;
          if (namingRule?.pattern === 'prefix') {
            variantName = namingRule.format.replace('{input}', inputDetail.inputName);
          } else {
            variantName = `${inputDetail.inputName} ${suffix}`;
          }
          const idSuffix = flavoredVariantSuffixes[artisan.name] ? toKebabCase(flavoredVariantSuffixes[artisan.name]) : artisan.id;
          const variantId = `${inputDetail.inputId}-${idSuffix}`;
          const basePrice = inputDetail.outputPrice;
          const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

          const variant = {
            id: variantId,
            gameId: artisan.gameId,
            name: variantName,
            type: 'artisan',
            gameCategory: artisan.gameCategory,
            subtype: artisan.subtype,
            icon: artisan.icon,
            contextTags: artisan.contextTags,
            edibility: artisan.edibility,
            prices: qualityPrices,
            sellingLocations: artisan.sellingLocations,
            bundles: artisan.bundles,
            genericId: artisan.id,
            ...(artisan.preserveType && { preserveType: artisan.preserveType }),
            sources: artisan.sources.filter(s => s.type !== 'fish-pond').map(s => {
              if (s.type !== 'machine') return s;
              const isRoeInput = s.inputType === 'roe';
              // Roe is produced by the specific fish's pond variant, not the generic fish-pond building
              const machineId = s.id === 'fish-pond' && !isRoeInput
                ? `${inputDetail.inputId}-pond`
                : s.id;
              return {
                type: s.type,
                id: machineId,
                inputType: s.inputType,
                processingTimeMinutes: s.processingTimeMinutes,
                valueFormula: s.valueFormula,
                inputId: isRoeInput ? `${inputDetail.inputId}-roe` : inputDetail.inputId,
                inputName: isRoeInput ? `${inputDetail.inputName} Roe` : inputDetail.inputName,
                inputGameId: inputDetail.inputGameId,
                inputBasePrice: inputDetail.inputBasePrice,
                inputGameCategory: inputDetail.inputGameCategory,
              };
            }),
          };
          if (artisan.canBeAged) {
            variant.canBeAged = true;
            if (artisan.agingDaysToIridium) variant.agingDaysToIridium = artisan.agingDaysToIridium;
          }

          // Targeted Bait: override type to bait and set description
          if (artisan.gameId === '(O)SpecificBait') {
            variant.type = 'bait';
            variant.subtype = 'targeted';
            variant.description = `Increases your chance to catch ${inputDetail.inputName}.`;
          }

          genericItem.variations.push(variantId);
          compiledArtisan.push(variant);
        });

        // Wild variant (Honey without flowers)
        if (artisan.includeWildVariant) {
          const wildVariant = {
            id: `wild-${artisan.id}`,
            gameId: artisan.gameId,
            name: `Wild ${artisan.name}`,
            type: 'artisan',
            gameCategory: artisan.gameCategory,
            subtype: artisan.subtype,
            icon: artisan.icon,
            contextTags: artisan.contextTags,
            edibility: artisan.edibility,
            prices: calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality, qualityMultipliers),
            sellingLocations: artisan.sellingLocations,
            bundles: artisan.bundles,
            genericId: artisan.id,
            sources: artisan.sources.map(s => {
              if (s.type !== 'machine') return s;
              const { inputDetails: _ids, ...sourceWithoutDetails } = s;
              return sourceWithoutDetails;
            }),
          };
          genericItem.variations.push(wildVariant.id);
          compiledArtisan.push(wildVariant);
        }

        compiledArtisan.push(genericItem);
      } else {
        const basePrice = inputDetails[0].outputPrice;
        const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);
        const compiledItem = {
          ...artisanBase,
          type: 'artisan',
          prices: qualityPrices,
        };
        if (artisan.canBeAged) {
          compiledItem.canBeAged = true;
          if (artisan.agingDaysToIridium) compiledItem.agingDaysToIridium = artisan.agingDaysToIridium;
        }
        compiledArtisan.push(compiledItem);
      }
    }
  } else {
    const qualityPrices = calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);
    compiledArtisan.push({
      ...artisanBase,
      type: 'artisan',
      prices: qualityPrices,
    });
  }
});

console.log(`  ✓ Expanded artisan: ${artisanData.length} source → ${compiledArtisan.length} compiled`);

// ---------------------------------------------------------------------------
// Tag all entity types with category
// ---------------------------------------------------------------------------
console.log('\n🏷️  Tagging entity types...');

function tagEntities(entities, type, gameIdPrefix, extraFields = {}) {
  return entities.map(entity => {
    const { gifts, ...entityWithoutGifts } = entity;
    if (gameIdPrefix && entity.gameId != null) {
      const s = String(entity.gameId);
      if (!s.startsWith('(')) {
        entityWithoutGifts.gameId = `(${gameIdPrefix})${s}`;
      }
    }
    const effectiveType = entityWithoutGifts.type || type;
    return { ...entityWithoutGifts, ...extraFields, type: effectiveType };
  });
}

// ---------------------------------------------------------------------------
// TV Shows (Queen of Sauce cooking channel)
// ---------------------------------------------------------------------------
console.log('\nProcessing TV shows...');
const tvShowData = [];
const tvCookingByRecipeName = {};  // recipeName -> tv-show entity id
{
  const SEASONS_TV = ['spring', 'summer', 'fall', 'winter'];
  const tvCooking = loadJson(path.join(GAME_EXPORTS_DIR, 'TV_CookingChannel.json'));
  for (const [weekStr, val] of Object.entries(tvCooking)) {
    const week = parseInt(weekStr, 10);
    const recipeName = val.split('/')[0];
    const description = val.split('/')[1] || '';
    // Map week (1-32) to in-game date in the 2-year cycle
    const year = week <= 16 ? 1 : 2;
    const weekInYear = (week - 1) % 16;
    const seasonIndex = Math.floor(weekInYear / 4);
    const weekInSeason = (weekInYear % 4) + 1;
    const dayOfSeason = weekInSeason * 7; // Airs on Sunday = last day of each 7-day week
    const id = `tv-queen-of-sauce-ep-${week}`;
    const entity = {
      id,
      name: recipeName,
      type: 'tv-show',
      subtype: 'queen-of-sauce',
      episodeNumber: week,
      year,
      season: SEASONS_TV[seasonIndex],
      dayOfSeason,
      description,
      iconClass: 'fa-solid fa-tv',
      iconColor: '#7b5ea7',
      sources: [],
    };
    // Find the food gameId that this recipe produces and annotate its cooking source
    for (const [foodGameId, sources] of cookingSourcesByGameId.entries()) {
      for (const src of sources) {
        if (src.recipeName === recipeName) {
          entity.taughtFoodGameId = foodGameId;
          // Attach tvEntityId to ALL recipes in the TV schedule, not just level:100
          if (src.unlockCondition) {
            src.unlockCondition.tvEntityId = id;
          } else {
            // Default unlock (no condition) — still aired on TV
            src.tvEntityId = id;
          }
        }
      }
    }
    tvShowData.push(entity);
    tvCookingByRecipeName[recipeName] = id;
  }
  console.log(`  Processed ${tvShowData.length} Queen of Sauce episodes`);
}

const taggedFish           = tagEntities(fishData,           'fish',           'O');
const taggedCrops          = tagEntities(cropData,           'crop',           'O');
const taggedForage         = tagEntities(forageData,         'forage',         'O');
const taggedTreeFruits     = tagEntities(treeFruitsData,     'tree-fruit',     'O');
const taggedMinerals       = tagEntities(mineralData,        'mineral',        'O');
const taggedMetalBars      = tagEntities(metalBarData,       'metal-bar',      'O');
const taggedMonsterLoot    = tagEntities(monsterLootData,    'monster-loot',   'O');
const taggedResources      = tagEntities(resourceData,       'resource',       'O');
const taggedBigCraftables  = tagEntities(bigCraftableData,   'big-craftable',  'BC');
const taggedAnimalProducts = tagEntities(animalProductData,  'animal-product', 'O');
const taggedSeeds          = tagEntities(seedData,           'seed',           'O');
const taggedFurniture      = tagEntities(furnitureData,      'furniture',      'F');
const taggedHats           = tagEntities(hatData,            'clothing',       'H', { subtype: 'hat' });
const taggedFood           = tagEntities(foodData,           'food',           'O');
const taggedOres           = tagEntities(oreData,            'ore',            'O');
const taggedGeodeMinerals  = tagEntities(geodeMineralData,   'mineral',        'O');
const taggedCrafted        = tagEntities(bombData,           'crafted',        'O');
const taggedFertilizers    = tagEntities(fertilizerData,     'fertilizer',     'O');
const taggedBait           = tagEntities(baitData,           'bait',           'O');
const taggedTackle         = tagEntities(tackleData,         'tackle',         'O');
const taggedFlooring       = tagEntities(flooringData,       'flooring',       'O');
const taggedTrash          = tagEntities(trashData,          'trash',          'O');
const taggedBooks          = tagEntities(bookData,           'book',           'O');
const taggedArtifacts      = tagEntities(artifactData,       'artifact',       'O');
const taggedRings          = tagEntities(ringData,           'ring',           'O');
const taggedFruitTreeSaplings = tagEntities(fruitTreeData,   'fruit-tree-sapling', 'O');
const taggedTrees          = treeEntityData.map(t => ({ ...t, type: t.type || 'tree' }));
const taggedTreeSeeds      = tagEntities(treeSeedData,       'tree-seed',      'O');
const taggedGeodeItems     = tagEntities(geodeItemData,      'geode',          'O');
const taggedMisc           = tagEntities(miscData,           'misc',           'O');
const taggedWeapons        = tagEntities(weaponData,         'weapon',         'W');
const taggedBoots          = tagEntities(bootsData,          'boot',           'B');
const taggedTools          = tagEntities(toolData,           'tool',           'T');
const taggedTrinkets       = tagEntities(trinketData,        'trinket',        'TR');
const taggedBuildings      = tagEntities(buildingData,       'building',       'BLD');
const taggedFishPondVariants = fishPondVariantData.map(v => ({ ...v }));
const taggedAnimals        = tagEntities(animalData,         'animal',         'FA');
const taggedMonsters       = monsterData.map(m => ({ ...m, type: 'monster' }));
const taggedBreakables     = breakableData.map(b => ({ ...b, type: 'breakable' }));
const taggedBuffs          = buffData.map(b => ({ ...b, type: 'buff' }));
const taggedAchievements   = achievementData.map(a => ({ ...a, type: 'achievement' }));
const taggedQuests         = questData.map(q => ({ ...q, type: 'quest' }));
const taggedPowers         = powerData.map(p => ({ ...p, type: 'power' }));
const taggedConcessions    = concessionData.map(c => ({ ...c, type: 'concession' }));
const taggedMovies         = movieData.map(m => ({ ...m, type: 'movie' }));
const taggedClothing       = clothingData.map(c => ({ ...c, type: 'clothing' }));
const taggedEvents         = eventData.map(e => ({ ...e, type: 'event' }));
const taggedVillagers      = villagerData.map(v => ({ ...v, type: 'villager' }));
const taggedSecretNotes    = secretNoteData.map(n => ({ ...n, type: n.entityType }));

// Normalize any legacy store- prefixes in villager storeIds
for (const v of villagerData) {
  if (Array.isArray(v.storeIds)) {
    v.storeIds = v.storeIds.map(id =>
      id.startsWith('loc-') ? id :
      id.startsWith('store-') ? 'loc-' + id.slice(6) :
      'loc-' + id
    );
  }
}

// Build villager name lookup for operator → icon fallback
const villagerNameById = new Map(villagerData.map(v => [v.id, v.name]));

const taggedLocations = Object.values(locationsRules.locations || {}).map(loc => {
  const location = { ...loc, type: 'location' };
  // Convert operator (raw name) to villager entity ID
  if (location.operator) {
    const operatorName = location.operator;
    location.operator = toVillagerEntityId(operatorName);
    if (!location.icon) {
      location.icon = `assets/villagers/${operatorName}.png`;
    }
  }
  return location;
});

// ---------------------------------------------------------------------------
// Generate map location entities from parsed location data
// (Locations.json + WorldMap.json + Characters.json + location-overrides.json)
// ---------------------------------------------------------------------------
console.log('\n🗺️  Generating map location entities...');
{
  // Region root entities
  const regionEntities = [
    { id: 'map-valley', name: 'Stardew Valley', type: 'location', subtype: 'region', parentLocation: null, childLocations: [], sources: [] },
    { id: 'map-island', name: 'Ginger Island', type: 'location', subtype: 'region', parentLocation: null, childLocations: [], sources: [] },
    { id: 'map-desert', name: 'Calico Desert', type: 'location', subtype: 'region', parentLocation: null, childLocations: [], sources: [] },
  ];

  // Deduplicate map area entities by mapEntityId
  const mapAreaEntities = new Map();
  const zoneEntities = [];

  for (const [gameLocId, data] of Object.entries(locationLookup)) {
    if (!data.displayName || !data.entityId) continue;

    const { entityId, mapEntityId, parentRegion } = data;
    // Use areaDisplayName (the real area name) if we have a fish zone override
    const name = data.areaDisplayName || data.displayName;
    const mapName = data.mapName;

    // Generate map area entity (deduplicated)
    if (mapEntityId && mapName && !mapAreaEntities.has(mapEntityId)) {
      if (mapEntityId !== entityId) {
        mapAreaEntities.set(mapEntityId, {
          id: mapEntityId,
          gameId: gameLocId,
          name: mapName,
          type: 'location',
          subtype: 'map-area',
          parentLocation: parentRegion,
          childLocations: [],
          sources: [],
          ...(data.residents?.length > 0 ? { residents: data.residents } : {}),
        });
      }
    }

    // Generate zone entity (if different from area, or standalone)
    if (entityId === mapEntityId) {
      if (!mapAreaEntities.has(entityId)) {
        mapAreaEntities.set(entityId, {
          id: entityId,
          gameId: gameLocId,
          name,
          type: 'location',
          subtype: 'map-area',
          parentLocation: parentRegion,
          childLocations: [],
          sources: [],
          ...(data.residents?.length > 0 ? { residents: data.residents } : {}),
        });
      }
    } else {
      zoneEntities.push({
        id: entityId,
        gameId: gameLocId,
        name,
        type: 'location',
        subtype: 'zone',
        parentLocation: mapEntityId,
        childLocations: [],
        sources: [],
        ...(data.residents?.length > 0 ? { residents: data.residents } : {}),
      });
    }
  }

  // Generate fish zone entities (distinct water bodies within map areas)
  const fishZoneEntities = [];
  for (const [, data] of Object.entries(locationLookup)) {
    if (data.fishZoneEntityId && data.fishZoneName) {
      // Only create if not already generated as a regular entity
      if (!mapAreaEntities.has(data.fishZoneEntityId) &&
          !zoneEntities.some(z => z.id === data.fishZoneEntityId)) {
        fishZoneEntities.push({
          id: data.fishZoneEntityId,
          name: data.fishZoneName,
          type: 'location',
          subtype: 'zone',
          parentLocation: data.entityId,
          childLocations: [],
          sources: [],
        });
      }
    }
  }

  // Generate mine floor entities
  const mineFloorEntities = [
    { id: 'map-mines-f20', name: 'Mines Floor 20', type: 'location', subtype: 'zone', parentLocation: 'map-mines', childLocations: [], sources: [] },
    { id: 'map-mines-f60', name: 'Mines Floor 60', type: 'location', subtype: 'zone', parentLocation: 'map-mines', childLocations: [], sources: [] },
    { id: 'map-mines-f100', name: 'Mines Floor 100', type: 'location', subtype: 'zone', parentLocation: 'map-mines', childLocations: [], sources: [] },
  ];

  // Generate Community Center + room entities from parsed bundle data
  const nonCcBundles = new Map(); // roomName -> [bundleId, ...] for rooms that aren't in CC
  const communityCenter = { id: 'map-community-center', name: 'Community Center', type: 'location', subtype: 'area', parentLocation: 'map-town', childLocations: [], sources: [] };
  const ccRoomEntities = [];
  for (const [roomName, bundleIds] of bundleRooms) {
    if (bundleRoomOverrides[roomName]) {
      nonCcBundles.set(roomName, bundleIds);
      continue;
    }
    const roomId = `cc-${toKebabCase(roomName)}`;
    ccRoomEntities.push({
      id: roomId, name: roomName, type: 'location', subtype: 'zone',
      parentLocation: 'map-community-center', childLocations: [], sources: [],
      bundles: bundleIds,
    });
    communityCenter.childLocations.push(roomId);
  }

  const collectionLocations = [communityCenter, ...ccRoomEntities];

  const allMapLocations = [
    ...regionEntities,
    ...mapAreaEntities.values(),
    ...zoneEntities,
    ...fishZoneEntities,
    ...mineFloorEntities,
    ...collectionLocations,
  ];

  // Apply icon overrides from location-overrides.json
  const locIconOverrides = rules.locationOverrides.iconOverrides || {};
  for (const loc of allMapLocations) {
    if (locIconOverrides[loc.id]) {
      loc.icon = locIconOverrides[loc.id];
    }
  }

  // Attach bundles from non-CC rooms (e.g. Abandoned Joja Mart) to existing map entities
  for (const [roomName, bundleIds] of nonCcBundles) {
    const mapId = bundleRoomOverrides[roomName];
    const mapEntity = allMapLocations.find(l => l.id === mapId);
    if (mapEntity) {
      mapEntity.bundles = [...(mapEntity.bundles || []), ...bundleIds];
    } else {
      console.warn(`  ⚠ No map entity found for non-CC bundle room "${roomName}" (tried ${mapId})`);
    }
  }

  // Add to taggedLocations
  for (const loc of allMapLocations) {
    taggedLocations.push(loc);
  }

  console.log(`  ✓ Generated ${regionEntities.length} region entities`);
  console.log(`  ✓ Generated ${mapAreaEntities.size} map area entities`);
  console.log(`  ✓ Generated ${zoneEntities.length} zone entities`);
  console.log(`  ✓ Generated ${mineFloorEntities.length} mine floor entities`);
  console.log(`  ✓ Total map location entities: ${allMapLocations.length}`);
}

// ---------------------------------------------------------------------------
// Wire loc-* shop entities into the location hierarchy via parentLocation
// ---------------------------------------------------------------------------
console.log('🔗 Wiring shop entities into location hierarchy...');
{
  // Build address -> map entity ID lookup from locationLookup
  const addressToMapEntityId = {};
  for (const [, data] of Object.entries(locationLookup)) {
    if (data.mapName && data.mapEntityId) {
      addressToMapEntityId[data.mapName] = data.mapEntityId;
    }
    if (data.displayName && data.mapEntityId) {
      addressToMapEntityId[data.displayName] = data.entityId !== data.mapEntityId ? data.mapEntityId : data.entityId;
    }
    if (data.fishZoneName && data.mapEntityId) {
      addressToMapEntityId[data.fishZoneName] = data.mapEntityId;
    }
  }
  // Additional address mappings for shop address strings that don't match
  // any location's displayName or mapName exactly.
  // These are short-form names used in locations.json "address" fields.
  addressToMapEntityId['Beach'] = 'map-beach';
  addressToMapEntityId['Mountain'] = 'map-mountain';
  addressToMapEntityId['Pelican Town'] = 'map-town';
  addressToMapEntityId['Calico Desert'] = 'map-desert';
  addressToMapEntityId['Cindersap Forest'] = 'map-forest';
  addressToMapEntityId['South of Farm'] = 'map-forest';
  addressToMapEntityId['Sewers'] = 'map-sewers';
  addressToMapEntityId['Mines'] = 'map-mines';
  addressToMapEntityId['Ginger Island'] = 'map-island';
  addressToMapEntityId['Ginger Island Resort'] = 'map-islandwest';
  addressToMapEntityId['Volcano Dungeon'] = 'map-islandnorthcave1';

  // Build festival ID → festival data lookup for address resolution
  const festivalById = {};
  for (const [festId, fest] of Object.entries(festivalsRules.festivals || {})) {
    festivalById[festId] = fest;
  }

  let wired = 0;
  let festivalShopsWired = 0;
  for (const loc of taggedLocations) {
    if (!loc.id.startsWith('loc-') || loc.parentLocation) continue;

    if (loc.address) {
      // Regular shops: wire via address
      const parentId = addressToMapEntityId[loc.address];
      if (parentId) {
        loc.parentLocation = parentId;
        wired++;
      }
    } else if (loc.locations?.length > 0) {
      // Festival shops: resolve parent from the festival's address
      const festRef = loc.locations[0];
      const fest = festivalById[festRef.id];
      if (fest?.address) {
        const parentId = addressToMapEntityId[fest.address];
        if (parentId) {
          loc.parentLocation = parentId;
          festivalShopsWired++;
        }
      }
    }
  }
  console.log(`  ✓ Wired ${wired} shop entities into location hierarchy`);
  console.log(`  ✓ Wired ${festivalShopsWired} festival shop entities via festival address`);
}

const taggedFestivals = Object.values(festivalsRules.festivals || {}).map(fest => ({
  ...fest,
  type: 'festival',
}));

// Cross-reference festivals ↔ shops: add shops[] to festival entities
{
  // Build festival ID → list of shop loc-* IDs
  const festivalShops = {};
  for (const loc of taggedLocations) {
    if (!loc.id.startsWith('loc-') || !loc.locations) continue;
    for (const ref of loc.locations) {
      if (!festivalShops[ref.id]) festivalShops[ref.id] = [];
      festivalShops[ref.id].push(loc.id);
    }
  }
  let linked = 0;
  for (const fest of taggedFestivals) {
    if (festivalShops[fest.id]?.length > 0) {
      fest.shops = festivalShops[fest.id];
      linked++;
    }
  }
  console.log(`  ✓ Linked ${linked} festivals to their shops`);
}

// Derive buys for each location from categorySellingLocations
const buysByLocation = {};
for (const [cat, locIds] of Object.entries(locationsRules.categorySellingLocations || {})) {
  for (const locId of locIds) {
    if (!buysByLocation[locId]) buysByLocation[locId] = [];
    buysByLocation[locId].push(parseInt(cat));
  }
}
for (const loc of taggedLocations) {
  if (buysByLocation[loc.id]?.length > 0) loc.buys = buysByLocation[loc.id];
}

console.log(`  ✓ Tagged all entity types`);

// ---------------------------------------------------------------------------
// Derive fish locations and seasons (from sources array)
// ---------------------------------------------------------------------------
console.log('\n🐟 Deriving fish locations/seasons...');
const ALL_SEASONS = ['spring', 'summer', 'fall', 'winter'];

taggedFish.forEach(fish => {
  const fishSources = (fish.sources || []).filter(s => s.type === 'fish');
  if (fishSources.length === 0) return;

  const srcSeasonSets = fishSources.map(s => {
    if (s.seasons) return new Set(s.seasons);
    if (s.season) return new Set([s.season]);
    return new Set(ALL_SEASONS);
  });

  const unionSeasons = ALL_SEASONS.filter(s => srcSeasonSets.some(set => set.has(s)));
  fish.seasons = unionSeasons;

  const canonical = JSON.stringify([...srcSeasonSets[0]].sort());
  fish.hasLocationNuance = srcSeasonSets.some(set => JSON.stringify([...set].sort()) !== canonical);
});

// ---------------------------------------------------------------------------
// Derive forage locations and seasons (from sources array)
// ---------------------------------------------------------------------------
console.log('🌿 Deriving forage locations/seasons...');

function deriveForageLocationsSeasons(item) {
  const forageSources = (item.sources || []).filter(s => s.type === 'forage');
  if (forageSources.length === 0) return;

  const srcSeasonSets = forageSources.map(s => {
    if (s.seasons) return new Set(s.seasons);
    if (s.season) return new Set([s.season]);
    return new Set(ALL_SEASONS);
  });
  const unionSeasons = ALL_SEASONS.filter(s => srcSeasonSets.some(set => set.has(s)));
  item.seasons = unionSeasons;

  const canonical = JSON.stringify([...srcSeasonSets[0]].sort());
  item.hasLocationNuance = srcSeasonSets.some(set => JSON.stringify([...set].sort()) !== canonical);
}

taggedForage.forEach(item => deriveForageLocationsSeasons(item));

// ---------------------------------------------------------------------------
// Merge cross-collection items (items that appear in multiple source files)
// ---------------------------------------------------------------------------
console.log('\n🔗 Merging cross-collection items...');

const TYPE_PRIORITY = rules.typePriority;

const allTypedEntities = [
  ...taggedFish, ...compiledArtisan, ...taggedCrops, ...taggedForage,
  ...taggedTreeFruits, ...taggedFruitTreeSaplings, ...taggedTrees, ...taggedMinerals, ...taggedMetalBars, ...taggedMonsterLoot,
  ...taggedResources, ...taggedBigCraftables, ...taggedAnimalProducts, ...taggedSeeds,
  ...taggedFurniture, ...taggedHats, ...taggedFood, ...taggedOres,
  ...taggedGeodeMinerals, ...taggedCrafted, ...taggedFertilizers, ...taggedBait,
  ...taggedTackle, ...taggedFlooring, ...taggedTrash, ...taggedBooks,
  ...taggedArtifacts, ...taggedRings, ...taggedTreeSeeds, ...taggedGeodeItems, ...taggedMisc,
  ...taggedWeapons, ...taggedBoots, ...taggedTools, ...taggedTrinkets,
  ...taggedBuildings, ...taggedFishPondVariants, ...taggedAnimals, ...taggedMonsters, ...taggedBreakables,
  ...bundleData.map(b => ({ ...b, type: 'bundle', sources: [] })),
  ...taggedBuffs, ...taggedAchievements, ...taggedQuests, ...taggedPowers, ...taggedConcessions, ...taggedMovies, ...taggedClothing, ...taggedEvents, ...taggedVillagers,
  ...taggedLocations, ...taggedFestivals,
  ...taggedSecretNotes,
  ...tvShowData,
];

const mergedEntitiesById = new Map();
let mergedDuplicates = 0;

for (const entity of allTypedEntities) {
  const key = entity.id;

  if (!mergedEntitiesById.has(key)) {
    mergedEntitiesById.set(key, { ...entity, sources: [...(entity.sources || [])] });
  } else {
    const existing = mergedEntitiesById.get(key);
    mergedDuplicates++;

    const existingSrcJson = new Set((existing.sources || []).map(s => JSON.stringify(s)));
    for (const src of (entity.sources || [])) {
      const srcJson = JSON.stringify(src);
      if (!existingSrcJson.has(srcJson)) {
        existing.sources.push(src);
        existingSrcJson.add(srcJson);
      }
    }

    if (entity.bundles?.length) {
      const existingBundles = new Set(existing.bundles || []);
      for (const b of entity.bundles) existingBundles.add(b);
      existing.bundles = [...existingBundles];
    }

    const existingPriority = TYPE_PRIORITY[existing.type] ?? 999;
    const incomingPriority = TYPE_PRIORITY[entity.type] ?? 999;
    if (incomingPriority < existingPriority) {
      existing.type = entity.type;
    }

    for (const [field, val] of Object.entries(entity)) {
      if (field === 'sources' || field === 'bundles' || field === 'type') continue;
      if (!(field in existing) && val !== undefined) {
        existing[field] = val;
      }
    }
  }
}

const allCompiledEntities = [...mergedEntitiesById.values()];
console.log(`  ✓ Merged ${mergedDuplicates} duplicate ids → ${allCompiledEntities.length} unique entities`);

// ---------------------------------------------------------------------------
// Post-merge: derive subtypes for location entities
// ---------------------------------------------------------------------------
console.log('\n📍 Deriving location subtypes...');
{
  // Which location IDs have at least one item sourced from them as a shop
  const sellerIds = new Set(
    allCompiledEntities
      .flatMap(e => (e.sources || []).filter(s => s.type === 'shop').map(s => s.id))
  );

  for (const entity of allCompiledEntities) {
    if (entity.type !== 'location') continue;
    // Don't override subtypes already set on map locations (region, map-area, zone)
    if (entity.subtype) continue;
    const isSeller = sellerIds.has(entity.id) || !!entity.shop;

    if (isSeller) {
      entity.subtype = 'shop';
    }
    // No subtype for non-selling locations (e.g. Trash Can)
  }
}

// ---------------------------------------------------------------------------
// Post-merge: compute childLocations for location hierarchy
// ---------------------------------------------------------------------------
console.log('\n🌳 Computing location hierarchy (childLocations)...');
{
  // Build a map of all location entities by ID
  const locationEntitiesById = new Map();
  for (const entity of allCompiledEntities) {
    if (entity.type !== 'location') continue;
    locationEntitiesById.set(entity.id, entity);
  }

  // Apply nesting overrides (interior rooms that should be children of other locations)
  const nestingOverrides = rules.locationNesting || {};
  let nestingCount = 0;
  for (const [childId, newParentId] of Object.entries(nestingOverrides)) {
    const child = locationEntitiesById.get(childId);
    if (child && locationEntitiesById.has(newParentId)) {
      child.parentLocation = newParentId;
      nestingCount++;
    } else {
      console.warn(`  ⚠ Nesting override: ${childId} → ${newParentId} (${!child ? 'child not found' : 'parent not found'})`);
    }
  }
  if (nestingCount > 0) console.log(`  ✓ Applied ${nestingCount} location nesting overrides`);

  let wiringCount = 0;
  for (const entity of allCompiledEntities) {
    if (entity.type !== 'location') continue;
    if (!entity.parentLocation) continue;

    const parent = locationEntitiesById.get(entity.parentLocation);
    if (parent) {
      if (!parent.childLocations) parent.childLocations = [];
      if (!parent.childLocations.includes(entity.id)) {
        parent.childLocations.push(entity.id);
        wiringCount++;
      }
    }
  }
  console.log(`  ✓ Wired ${wiringCount} child→parent relationships`);

  // Log hierarchy summary
  const roots = allCompiledEntities.filter(e => e.type === 'location' && !e.parentLocation);
  for (const root of roots) {
    const childCount = root.childLocations?.length || 0;
    console.log(`  ${root.name}: ${childCount} direct children`);
  }
}

// ---------------------------------------------------------------------------
// Post-merge: generate museum reward entities
// ---------------------------------------------------------------------------
console.log('\n🏛️  Generating museum reward entities...');
{
  const museum = allCompiledEntities.find(e => e.id === 'map-archaeologyhouse');
  if (museum && gameData.museumRewards) {
    const entityByQualifiedId = new Map();
    for (const e of allCompiledEntities) {
      if (e.gameId) entityByQualifiedId.set(String(e.gameId), e);
    }

    const rewardEntities = [];
    const museumRewardIds = [];

    for (const [key, val] of Object.entries(gameData.museumRewards)) {
      const requirements = [];
      for (const tag of (val.TargetContextTags || [])) {
        const t = tag.Tag, c = tag.Count;
        if (t.startsWith('id_o_')) {
          const objId = t.replace('id_o_', '');
          const qualId = `(O)${objId}`;
          const entity = entityByQualifiedId.get(qualId);
          requirements.push({
            type: 'item',
            id: entity?.id || null,
            gameId: qualId,
            name: entity?.name || gameData.objects[objId]?.Name || `Object ${objId}`,
            count: c,
          });
        } else if (t === 'item_type_arch') {
          requirements.push({ type: 'category', category: 'artifacts', count: c });
        } else if (t === 'item_type_minerals') {
          requirements.push({ type: 'category', category: 'minerals', count: c });
        } else if (t === '') {
          requirements.push({ type: 'total', count: c }); // -1 = complete collection
        }
      }

      // Determine reward info
      let rewardItemId = null;
      let rewardItemName = null;
      let rewardItemCount = val.RewardItemCount || 1;
      const isRecipe = !!val.RewardItemIsRecipe;

      if (val.RewardItemId) {
        const rewardEntity = entityByQualifiedId.get(val.RewardItemId);
        rewardItemId = rewardEntity?.id || null;
        rewardItemName = rewardEntity?.name || val.RewardItemId;
      }

      // Derive a human-readable name
      let name;
      const reqType = requirements[0]?.type;
      if (reqType === 'total' && requirements[0].count === -1) {
        name = 'Complete Collection';
      } else if (reqType === 'total') {
        name = `${requirements[0].count} Donations`;
      } else if (reqType === 'category' && requirements.length === 1) {
        const cat = requirements[0].category === 'artifacts' ? 'Artifacts' : 'Minerals';
        name = `${requirements[0].count} ${cat}`;
      } else if (rewardItemName) {
        name = isRecipe ? `${rewardItemName} Recipe` : rewardItemName;
      } else {
        name = key;
      }

      // Determine milestone category for grouping
      let milestoneCategory;
      if (requirements.some(r => r.type === 'item')) {
        milestoneCategory = 'collection';
      } else if (requirements.some(r => r.type === 'category')) {
        milestoneCategory = 'category';
      } else {
        milestoneCategory = 'donation';
      }

      // Use reward item's icon if available
      const rewardEntity = rewardItemId ? entityByQualifiedId.get(val.RewardItemId) : null;
      const icon = rewardEntity?.icon || null;

      const entityId = `museum-reward-${key}`;
      rewardEntities.push({
        id: entityId,
        name,
        type: 'museum-reward',
        locationId: 'map-archaeologyhouse',
        milestoneCategory,
        requirements,
        reward: rewardItemId,
        rewardName: rewardItemName,
        rewardCount: rewardItemCount,
        isRecipe,
        ...(icon ? { icon } : {}),
        ...(val.RewardActions?.length ? { rewardActions: val.RewardActions } : {}),
        sources: [{ type: 'reward', id: 'map-archaeologyhouse', rewardSource: 'museum', rewardSourceName: "Gunther's Museum" }],
      });
      museumRewardIds.push(entityId);
    }

    // Sort: collection first, then category, then donation milestones
    const catOrder = { collection: 0, category: 1, donation: 2 };
    rewardEntities.sort((a, b) => {
      const aPri = catOrder[a.milestoneCategory] ?? 3;
      const bPri = catOrder[b.milestoneCategory] ?? 3;
      if (aPri !== bPri) return aPri - bPri;
      const aCount = a.requirements[0]?.count || 0;
      const bCount = b.requirements[0]?.count || 0;
      return aCount - bCount;
    });

    allCompiledEntities.push(...rewardEntities);
    museum.museumRewards = museumRewardIds;
    console.log(`  ✓ Generated ${rewardEntities.length} museum reward entities`);
  } else {
    console.log('  ⚠ Museum entity or MuseumRewards data not found');
  }
}

// ---------------------------------------------------------------------------
// Post-merge: enrich donatable items with museum donation info
// ---------------------------------------------------------------------------
console.log('\n🏛️  Enriching museum-donatable items...');
{
  // Build reverse map: item gameId → museum reward entity IDs that require it
  const itemToRewardIds = new Map();
  for (const entity of allCompiledEntities) {
    if (entity.type !== 'museum-reward') continue;
    for (const req of (entity.requirements || [])) {
      if (req.type === 'item' && req.gameId) {
        if (!itemToRewardIds.has(req.gameId)) itemToRewardIds.set(req.gameId, []);
        itemToRewardIds.get(req.gameId).push(entity.id);
      }
    }
  }

  // Build a set of museum-donatable gameIds from raw game data so we don't
  // depend on entity-type classifications (e.g. Dinosaur Egg is type=animal-product
  // but Type=Arch in Objects.json, and is donatable in-game).
  const donatableGameIds = new Set();
  for (const [rawId, obj] of Object.entries(gameData.objects)) {
    if (obj.Type === 'Arch' || obj.Type === 'Minerals') {
      donatableGameIds.add(`(O)${rawId}`);
    }
  }

  let enriched = 0;
  for (const entity of allCompiledEntities) {
    if (!entity.gameId || !donatableGameIds.has(entity.gameId)) continue;
    entity.museumDonatable = true;
    const specificRewards = itemToRewardIds.get(entity.gameId) || [];
    if (specificRewards.length > 0) {
      entity.museumRewardIds = specificRewards;
    }
    enriched++;
  }
  console.log(`  ✓ Marked ${enriched} items as museum-donatable (${itemToRewardIds.size} linked to specific rewards, ${donatableGameIds.size} in raw game data)`);
}

// ---------------------------------------------------------------------------
// Post-merge: link items to achievements they contribute to
// ---------------------------------------------------------------------------
console.log('\n🏆 Linking items to achievements...');
{
  // Build index of all compiled entities for fast lookup (all three gameId forms)
  const entityByGameId = new Map();
  for (const entity of allCompiledEntities) {
    if (!entity.gameId) continue;
    const gid = entity.gameId;
    entityByGameId.set(gid, entity);
    const bare = gid.replace(/^\([A-Z]+\)/, '');
    entityByGameId.set(bare, entity);
    const num = parseInt(bare, 10);
    if (!isNaN(num)) entityByGameId.set(num, entity);
  }

  // Build index: achievementId → achievement entity
  const achievementEntityById = new Map();
  for (const entity of allCompiledEntities) {
    if (entity.type === 'achievement' && entity.achievementId != null) {
      achievementEntityById.set(entity.achievementId, entity);
      entity.requiredItems = [];
    }
  }

  // Museum achievements: TreasureTrove(28), ACompleteCollection(5)
  // Reuse the donatableGameIds already computed above — handled via museumDonatable flag.
  // We cross-link these here using the same set rebuilt from game data.
  const museumDonatableGameIds = new Set(
    Object.entries(gameData.objects)
      .filter(([, obj]) => obj.Type === 'Arch' || obj.Type === 'Minerals')
      .map(([id]) => `(O)${id}`)
  );

  // All item-linked achievement chains: achId → { _eligibleGameIds?, _eligibleByType? }
  // (populated earlier during achievement processing)
  const allAchievements = [...achievementEntityById.values()];

  let linkedItems = 0;
  for (const entity of allCompiledEntities) {
    if (!entity.gameId && entity.type !== 'book') continue;
    const achievementIds = [];

    for (const ach of allAchievements) {
      if (!ach._eligibleGameIds && !ach._eligibleByType) continue;
      let eligible = false;
      if (ach._eligibleGameIds && entity.gameId) {
        eligible = ach._eligibleGameIds.has(entity.gameId);
      } else if (ach._eligibleByType) {
        eligible = ach._eligibleByType.has(entity.type) || ach._eligibleByType.has(entity.subtype);
      }
      if (eligible) achievementIds.push(ach.id);
    }

    // Museum donations
    if (entity.gameId && museumDonatableGameIds.has(entity.gameId)) {
      const trove = achievementEntityById.get(28);
      const collection = achievementEntityById.get(5);
      if (trove && !achievementIds.includes(trove.id)) achievementIds.push(trove.id);
      if (collection && !achievementIds.includes(collection.id)) achievementIds.push(collection.id);
    }

    if (achievementIds.length > 0) {
      entity.achievements = achievementIds;
      linkedItems++;
    }
  }

  // Clean up temp fields
  for (const ach of allAchievements) {
    delete ach._eligibleGameIds;
    delete ach._eligibleByType;
  }

  console.log(`  ✓ Linked ${linkedItems} items to achievements`);
}

// ---------------------------------------------------------------------------
// Post-merge: re-derive forage locations/seasons for cross-collection items
// ---------------------------------------------------------------------------
console.log('\n🌿 Re-deriving forage locations for merged items...');

allCompiledEntities.forEach(item => {
  const forageSources = (item.sources || []).filter(s => s.type === 'forage');
  if (forageSources.length === 0) return;

  const srcSeasonSets = forageSources.map(s => {
    if (s.seasons) return new Set(s.seasons);
    if (s.season) return new Set([s.season]);
    return new Set(ALL_SEASONS);
  });
  const unionSeasons = ALL_SEASONS.filter(s => srcSeasonSets.some(set => set.has(s)));
  item.seasons = item.seasons?.length ? item.seasons : unionSeasons;

  const canonical = JSON.stringify([...srcSeasonSets[0]].sort());
  item.hasLocationNuance = srcSeasonSets.some(set => JSON.stringify([...set].sort()) !== canonical);
});

// ---------------------------------------------------------------------------
// Post-merge: collapse shop sources that differ only in seasons
// ---------------------------------------------------------------------------
const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

for (const item of allCompiledEntities) {
  const shopSources = (item.sources || []).filter(s => s.type === 'shop');
  if (shopSources.length < 2) continue;

  const shopKey = src => [
    src.id, src.price, src.quantity,
    src.tradeItemId, src.tradeItemAmount, src.tradeItemGameId,
    src.shopCurrency, src.yearUnlock, src.yearUnlockBefore,
    src.rotating, src.stock, src.stockLimit,
    JSON.stringify(src.condition),
  ].join('\0');

  const groups = new Map();
  for (const src of shopSources) {
    const k = shopKey(src);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(src);
  }

  const merged = [];
  for (const srcs of groups.values()) {
    if (srcs.length === 1) {
      merged.push(...srcs);
    } else if (srcs.some(s => !s.seasons)) {
      merged.push(srcs[0]);
    } else {
      const allSeasons = [...new Set(srcs.flatMap(s => s.seasons))];
      const sorted = SEASON_ORDER.filter(s => allSeasons.includes(s));
      merged.push({ ...srcs[0], seasons: sorted });
    }
  }

  if (merged.length < shopSources.length) {
    item.sources = item.sources.filter(s => s.type !== 'shop').concat(merged);
  }
}

// ---------------------------------------------------------------------------
// Normalize legacy store- prefixes in sellingLocations and shop source IDs
// ---------------------------------------------------------------------------
console.log('🏪 Normalizing legacy store- prefixes to loc-...');

function normalizeLegacyId(id) {
  if (!id || typeof id !== 'string') return id;
  if (id.startsWith('loc-')) return id;
  if (id.startsWith('store-')) return 'loc-' + id.slice(6);
  return id;
}

for (const item of allCompiledEntities) {
  if (Array.isArray(item.sellingLocations)) {
    item.sellingLocations = item.sellingLocations.map(normalizeLegacyId);
  }
  if (Array.isArray(item.sources)) {
    for (const src of item.sources) {
      if (src.type === 'shop' && src.id) {
        src.id = normalizeLegacyId(src.id);
      }
    }
  }
}

console.log(`  ✓ Legacy store- prefixes normalized to loc-`);

// ---------------------------------------------------------------------------
// Resolve crafting ingredient names
// ---------------------------------------------------------------------------
console.log('\n🔨 Resolving crafting ingredient names...');

const NON_ITEM_TYPES = new Set(['quest', 'achievement', 'event', 'buff', 'villager', 'location', 'festival', 'bundle', 'movie', 'clothing', 'tag']);
const compiledItemsByGameId = new Map();
for (const item of allCompiledEntities) {
  if (item.gameId !== undefined && item.gameId !== null && !NON_ITEM_TYPES.has(item.type)) {
    compiledItemsByGameId.set(item.gameId, item);
  }
}

// Load raw Objects.json as fallback for ingredient names
let rawObjectsFallback = null;
try {
  rawObjectsFallback = loadJson(path.join(GAME_EXPORTS_DIR, 'Objects.json'));
} catch { /* optional */ }

const CATEGORY_NAMES = {
  '-2':  'Gem',
  '-4':  'Any Fish',
  '-5':  'Egg',
  '-6':  'Milk',
  '-7':  'Cooking',
  '-8':  'Crafting',
  '-12': 'Mineral',
  '-14': 'Meat',
  '-15': 'Metal Bar',
  '-16': 'Resource',
  '-17': 'Monster Loot',
  '-18': 'Animal Product',
  '-19': 'Fertilizer',
  '-20': 'Trash',
  '-21': 'Bait',
  '-22': 'Tackle',
  '-23': 'Shell',
  '-24': 'Furniture',
  '-25': 'Ingredient',
  '-26': 'Artisan Good',
  '-27': 'Syrup',
  '-28': 'Monster Drop',
  '-74': 'Seed',
  '-75': 'Vegetable',
  '-79': 'Fruit',
  '-80': 'Flower',
  '-81': 'Forage',
  '-777': 'Wild Seeds (Any)',
};

function resolveIngredientNameFallback(gameId) {
  const key = String(gameId);
  if (CATEGORY_NAMES[key]) return CATEGORY_NAMES[key];
  if (rawObjectsFallback) {
    const obj = rawObjectsFallback[key];
    if (obj?.Name) return obj.Name;
  }
  return null;
}

let resolvedIngredients = 0;
for (const item of allCompiledEntities) {
  for (const src of (item.sources || [])) {
    if ((src.type !== 'crafting' && src.type !== 'cooking') || !src.ingredients) continue;
    src.ingredientDetails = src.ingredients.map(ing => {
      const ingItem = compiledItemsByGameId.get(ing.gameId) ?? compiledItemsByGameId.get(`(O)${ing.gameId}`);
      const fallbackName = ingItem ? null : resolveIngredientNameFallback(ing.gameId);
      return {
        gameId: ing.gameId,
        amount: ing.amount,
        ...(ingItem
          ? { id: ingItem.id, name: ingItem.name, icon: ingItem.icon }
          : fallbackName ? { name: fallbackName } : {}
        ),
      };
    });
    resolvedIngredients++;
  }
}
console.log(`  ✓ Resolved ingredient details for ${resolvedIngredients} crafting/cooking sources`);

// Build reverse index: ingredientId -> [{ recipeId, recipeName, type, amount }]
const ingredientUsedIn = new Map();
for (const item of allCompiledEntities) {
  for (const src of (item.sources || [])) {
    if (src.type !== 'crafting' && src.type !== 'cooking') continue;
    for (const ing of (src.ingredientDetails || [])) {
      if (!ing.id) continue;
      if (!ingredientUsedIn.has(ing.id)) ingredientUsedIn.set(ing.id, []);
      const otherIngredients = (src.ingredientDetails || [])
        .filter(other => other.id && other.id !== ing.id)
        .map(other => ({ id: other.id, name: other.name, amount: other.amount }));
      ingredientUsedIn.get(ing.id).push({
        recipeId: item.id, recipeName: item.name, type: src.type, amount: ing.amount,
        ...(otherIngredients.length > 0 ? { otherIngredients } : {}),
      });
    }
  }
}

// Add tailoring reverse lookups: use stored source for otherIngredients
const entityByGameId = new Map(allCompiledEntities.filter(e => e.gameId).map(e => [e.gameId, e]));
let tailoringReverseCount = 0;
for (const [ingredientGameId, entries] of tailoringUsedInByGameId) {
  const ingredientEntity = entityByGameId.get(ingredientGameId);
  if (!ingredientEntity) continue;
  if (!ingredientUsedIn.has(ingredientEntity.id)) ingredientUsedIn.set(ingredientEntity.id, []);
  // Deduplicate: same ingredient can appear in multiple tag resolutions for the same recipe
  const seen = new Set();
  for (const { craftedGameId, source } of entries) {
    const dedupeKey = `${craftedGameId}:${source.ingredientDetails.map(d => d.id || d.gameId).join(',')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const craftedEntity = entityByGameId.get(craftedGameId);
    if (!craftedEntity) continue;
    // Derive otherIngredients from the stored source, excluding this ingredient
    const otherIngredients = (source.ingredientDetails || [])
      .filter(ing => ing.gameId !== ingredientGameId)
      .map(ing => {
        const ingEntity = ing.id ? null : entityByGameId.get(ing.gameId);
        return { id: ing.id || ingEntity?.id || null, name: ing.name, amount: ing.amount };
      });
    ingredientUsedIn.get(ingredientEntity.id).push({
      recipeId: craftedEntity.id, recipeName: craftedEntity.name, type: 'tailoring', amount: 1,
      ...(otherIngredients.length > 0 ? { otherIngredients } : {}),
    });
    tailoringReverseCount++;
  }
}

for (const item of allCompiledEntities) {
  const usedIn = ingredientUsedIn.get(item.id);
  if (usedIn?.length > 0) item.usedInRecipes = usedIn;
}
console.log(`  ✓ Built reverse ingredient index for ${ingredientUsedIn.size} ingredients (${tailoringReverseCount} tailoring)`);

// ---------------------------------------------------------------------------
// Enrich monster-drop sources with monsterId (friendly ID)
// ---------------------------------------------------------------------------
console.log('\n🗡️ Enriching monster-drop sources...');
const monsterByInternalName = new Map(taggedMonsters.map(m => [m.internalName, m]));
let enrichedDrops = 0;
for (const item of allCompiledEntities) {
  for (const src of (item.sources || [])) {
    if (src.type !== 'monster-drop' || !src.monster) continue;
    const monster = monsterByInternalName.get(src.monster);
    if (monster) {
      src.monsterId = monster.id;
      enrichedDrops++;
    }
  }
}
console.log(`  ✓ Enriched ${enrichedDrops} monster-drop sources with monsterId`);

// ---------------------------------------------------------------------------
// Enrich items with breakable-drop sources
// ---------------------------------------------------------------------------
console.log('\n📦 Enriching breakable-drop sources...');
let enrichedBreakableDrops = 0;
for (const item of allCompiledEntities) {
  if (item.type === 'breakable') continue;
  const gameId = item.gameId;
  if (gameId == null) continue;
  const drops = breakableDropsByGameId.get(String(gameId));
  if (!drops) continue;
  if (!item.sources) item.sources = [];
  for (const drop of drops) {
    // Avoid duplicates
    if (!item.sources.some(s => s.type === 'breakable-drop' && s.breakableId === drop.breakableId)) {
      item.sources.push({ ...drop });
      enrichedBreakableDrops++;
    }
  }
}
console.log(`  ✓ Added ${enrichedBreakableDrops} breakable-drop sources to items`);

// ---------------------------------------------------------------------------
// Enrich items with quest-requirement sources
// ---------------------------------------------------------------------------
console.log('\n📜 Enriching quest-requirement sources...');
let enrichedQuestReqs = 0;
for (const item of allCompiledEntities) {
  if (item.type === 'quest') continue;
  const gameId = item.gameId;
  if (gameId == null) continue;
  const reqs = questRequiredItemsByGameId.get(String(gameId));
  if (!reqs) continue;
  if (!item.sources) item.sources = [];
  for (const req of reqs) {
    if (!item.sources.some(s => s.type === 'quest-requirement' && s.questId === req.questId)) {
      item.sources.push({ ...req });
      enrichedQuestReqs++;
    }
  }
}
console.log(`  ✓ Added ${enrichedQuestReqs} quest-requirement sources to items`);

// ---------------------------------------------------------------------------
// Enrich book entities with power unlock conditions
// ---------------------------------------------------------------------------
console.log('\n📚 Enriching book entities with power data...');
let enrichedBooks = 0;
for (const item of allCompiledEntities) {
  if (item.type !== 'book') continue;
  const power = bookPowersByName.get(item.name);
  if (!power) continue;
  item.powerKey = power.powerKey;
  if (power.unlockCondition) item.unlockCondition = power.unlockCondition;
  enrichedBooks++;
}
console.log(`  ✓ Enriched ${enrichedBooks}/${bookPowersByName.size} books with power data`);

// ---------------------------------------------------------------------------
// Enrich movie crane prizes with resolved item names
// ---------------------------------------------------------------------------
console.log('\n🎬 Enriching movie crane prizes...');
let enrichedPrizes = 0;
const entitiesById = new Map(allCompiledEntities.map(e => [e.id, e]));
for (const item of allCompiledEntities) {
  if (item.type !== 'movie' || !item.cranePrizes) continue;
  for (const prize of item.cranePrizes) {
    if (!prize.itemId) continue;
    // Look up by gameId (qualified ID like "(F)1952")
    const resolved = allCompiledEntities.find(e => e.gameId === prize.itemId);
    if (resolved) {
      prize.resolvedId = resolved.id;
      prize.resolvedName = resolved.name;
      enrichedPrizes++;
      // Add crane-game source to the prize item
      if (!resolved.sources) resolved.sources = [];
      if (!resolved.sources.some(s => s.type === 'crane-game' && s.movieId === item.id)) {
        resolved.sources.push({
          type: 'crane-game',
          movieId: item.id,
          movieName: item.name,
          rarity: prize.rarity,
          seasons: item.seasons,
          yearParity: item.yearParity,
        });
      }
    }
  }
}
console.log(`  ✓ Enriched ${enrichedPrizes} crane prizes with item references`);

// ---------------------------------------------------------------------------
// Enrich movie entities with villager cross-references
// ---------------------------------------------------------------------------
console.log('\n🎬 Enriching villager entities with movie reactions...');
let enrichedVillagerMovies = 0;
for (const item of allCompiledEntities) {
  if (item.type !== 'movie' || !item.reactions) continue;
  for (const reaction of item.reactions) {
    // Find the villager entity by name
    const villager = allCompiledEntities.find(e => e.type === 'villager' && e.name === reaction.villager);
    if (villager) {
      reaction.villagerId = villager.id;
      if (!villager.movieReactions) villager.movieReactions = [];
      villager.movieReactions.push({ movieId: item.id, movieName: item.name, reaction: reaction.reaction });
      enrichedVillagerMovies++;
    }
  }
}
console.log(`  ✓ Added ${enrichedVillagerMovies} movie reaction cross-references`);

// ---------------------------------------------------------------------------
// Generate context tag entities
// ---------------------------------------------------------------------------
console.log('\n🏷️  Generating context tag entities...');

const tagDescriptions = loadJson(path.join(RULES_DIR, 'tag-descriptions.json'));

// Build tag → member entity IDs index from all entities with contextTags
const tagToMembers = new Map();
for (const entity of allCompiledEntities) {
  if (!entity.contextTags || entity.contextTags.length === 0) continue;
  for (const tag of entity.contextTags) {
    if (!tagToMembers.has(tag)) tagToMembers.set(tag, []);
    tagToMembers.get(tag).push(entity.id);
  }
}

// Color map for tag entity icons by prefix
const tagIconColors = {
  fish_: '#4a90d9',
  category_: '#8b6f47',
  season_: '#6b8e23',
  food_: '#c0392b',
  forage_: '#27ae60',
  bone_item: '#8e8e8e',
  book_item: '#7b5ea7',
  item_: '#d4a017',
  id_: '#999',
  quality_: '#daa520',
  light_source: '#f1c40f',
  torch_item: '#e67e22',
  not_giftable: '#c0392b',
  not_placeable: '#c0392b',
  egg_item: '#f5deb3',
  large_egg_item: '#f5deb3',
  milk_item: '#e0e0e0',
  large_milk_item: '#e0e0e0',
  mayo_item: '#f5f5dc',
  juice_item: '#e88e10',
  jelly_item: '#c678dd',
  wine_item: '#722f37',
  pickle_item: '#6b8e23',
  smoke_item: '#a0522d',
  preserve_item: '#6b8e23',
  honey_item: '#daa520',
  roe_item: '#ff6b6b',
  flower_item: '#e91e9c',
  fruit_item: '#e74c3c',
  vegetable_item: '#27ae60',
  trash_item: '#888',
  gem_item: '#9b59b6',
  mineral_item: '#5dade2',
  ring_item: '#daa520',
  marine_item: '#2980b9',
  dinosaur_item: '#8b4513',
  slime_item: '#2ecc71',
  syrup_item: '#d2691e',
  moss_item: '#6b8e23',
};

// Map color_ tags to actual CSS colors
const dyeColorMap = {
  color_red: '#e74c3c',
  color_orange: '#e67e22',
  color_yellow: '#f1c40f',
  color_green: '#27ae60',
  color_blue: '#3498db',
  color_purple: '#9b59b6',
  color_brown: '#8b6f47',
  color_dark_brown: '#5c3d1e',
  color_dark_gray: '#555',
  color_gray: '#999',
  color_light_gray: '#bbb',
  color_white: '#e0e0e0',
  color_black: '#333',
  color_pink: '#e91e63',
  color_dark_red: '#a31515',
  color_dark_yellow: '#b8860b',
  color_dark_green: '#1b5e20',
  color_dark_blue: '#1a237e',
  color_dark_purple: '#4a0072',
  color_dark_pink: '#880e4f',
  color_dark_cyan: '#00695c',
  color_aquamarine: '#7fffd4',
  color_cyan: '#00bcd4',
  color_jade: '#00a86b',
  color_sand: '#c2b280',
  color_copper: '#b87333',
  color_iron: '#a0a0a0',
  color_gold: '#ffd700',
  color_iridium: '#b19cd9',
  color_pale_violet_red: '#db7093',
  color_salmon: '#fa8072',
  color_poppyseed: '#2c2c2c',
};

function getTagIconColor(rawTag) {
  // Check color tags for actual color swatches
  if (dyeColorMap[rawTag]) return dyeColorMap[rawTag];
  // Check prefix matches
  for (const [prefix, color] of Object.entries(tagIconColors)) {
    if (rawTag.startsWith(prefix)) return color;
  }
  return '#7f8c8d'; // default gray for unmatched tags
}

// Create tag entities for every unique tag
const contextTagEntities = [];
for (const [rawTag, memberIds] of tagToMembers) {
  const id = 'tag-' + rawTag.replace(/_/g, '-');
  contextTagEntities.push({
    id,
    name: rawTag,
    type: 'tag',
    rawTag,
    iconClass: 'fa-solid fa-hashtag',
    iconColor: getTagIconColor(rawTag),
    ...(tagDescriptions[rawTag] ? { description: tagDescriptions[rawTag] } : {}),
    memberCount: memberIds.length,
    memberIds: memberIds.sort(),
  });
}

contextTagEntities.sort((a, b) => a.name.localeCompare(b.name));
allCompiledEntities.push(...contextTagEntities);
console.log(`  ✓ Generated ${contextTagEntities.length} tag entities from ${tagToMembers.size} unique context tags`);

// ---------------------------------------------------------------------------
// Generate type entities
// ---------------------------------------------------------------------------
console.log('\n📂 Generating type entities...');

// Type display names (replicating Formatters.js TYPE_LABELS)
const TYPE_DISPLAY_NAMES = {
  'fish': 'Fish',
  'crop': 'Crop',
  'artisan': 'Artisan Good',
  'animal-product': 'Animal Product',
  'food': 'Food',
  'mineral': 'Mineral',
  'artifact': 'Artifact',
  'forage': 'Forage',
  'seed': 'Seed',
  'tree-fruit': 'Tree Fruit',
  'tree-seed': 'Tree Seed',
  'fruit-tree-sapling': 'Fruit Tree Sapling',
  'tree': 'Tree',
  'crafted': 'Crafted Item',
  'big-craftable': 'Big Craftable',
  'ring': 'Ring',
  'weapon': 'Weapon',
  'boot': 'Boots',
  'tool': 'Tool',
  'trinket': 'Trinket',
  'bait': 'Bait',
  'tackle': 'Tackle',
  'fertilizer': 'Fertilizer',
  'furniture': 'Furniture',
  'clothing': 'Clothing',
  'flooring': 'Flooring',
  'metal-bar': 'Metal Bar',
  'ore': 'Ore',
  'resource': 'Resource',
  'trash': 'Trash',
  'misc': 'Miscellaneous',
  'monster': 'Monster',
  'monster-loot': 'Monster Loot',
  'animal': 'Farm Animal',
  'villager': 'Villager',
  'location': 'Location',
  'building': 'Building',
  'bundle': 'Bundle',
  'buff': 'Buff',
  'event': 'Event',
  'book': 'Book',
  'achievement': 'Achievement',
  'quest': 'Quest',
  'power': 'Power',
  'concession': 'Concession',
  'movie': 'Movie',
  'breakable': 'Breakable',
  'festival': 'Festival',
};

const SUBTYPE_DISPLAY_NAMES = {
  'fruit': 'Fruit', 'vegetable': 'Vegetable', 'flower': 'Flower',
  'gem': 'Gem', 'crystal': 'Crystal', 'geode-mineral': 'Geode',
  'sword': 'Sword', 'dagger': 'Dagger', 'club': 'Club', 'slingshot': 'Slingshot',
  'axe': 'Axe', 'pickaxe': 'Pickaxe', 'hoe': 'Hoe', 'fishing-rod': 'Fishing Rod',
  'watering-can': 'Watering Can', 'milk-pail': 'Milk Pail', 'shears': 'Shears',
  'pan': 'Pan', 'wand': 'Wand', 'generic-tool': 'Tool',
  'egg': 'Egg', 'milk': 'Milk',
  'mine-container': 'Mine Container', 'resource-clump': 'Resource Clump',
  'mastery': 'Mastery', 'unlock': 'Unlock',
  'shop': 'Shop', 'region': 'Region', 'map-area': 'Area', 'zone': 'Zone',
  'hat': 'Hat', 'pants': 'Pants', 'shirt': 'Shirt',
  'armchair': 'Armchair', 'bed': 'Bed', 'bed child': 'Child Bed',
  'bed double': 'Double Bed', 'bench': 'Bench', 'bookcase': 'Bookcase',
  'chair': 'Chair', 'couch': 'Couch', 'decor': 'Decor', 'dresser': 'Dresser',
  'fireplace': 'Fireplace', 'fishtank': 'Fish Tank', 'lamp': 'Lamp',
  'long table': 'Long Table', 'painting': 'Painting', 'rug': 'Rug',
  'sconce': 'Sconce', 'table': 'Table', 'torch': 'Torch', 'window': 'Window', 'area': 'Area',
  'randomized_plant': 'Seasonal Plant',
  // shared subtypes
  'big-craftable': 'Big Craftable', 'other': 'Other',
  'artisan': 'Artisan Good', 'misc': 'Miscellaneous',
  'animal': 'Farm Animal',
  // data subtypes matching their type (no distinct label needed but avoids raw ID)
  'fish': 'Fish', 'food': 'Food', 'forage': 'Forage', 'seed': 'Seed',
  'bait': 'Bait', 'tackle': 'Tackle', 'fertilizer': 'Fertilizer',
  'flooring': 'Flooring', 'ore': 'Ore', 'trash': 'Trash', 'resource': 'Resource',
  'metal-bar': 'Metal Bar', 'ring': 'Ring', 'boot': 'Boots', 'trinket': 'Trinket',
  'building': 'Building', 'monster': 'Monster', 'monster-loot': 'Monster Loot',
  'artifact': 'Artifact', 'book': 'Book', 'crafted': 'Crafted Item',
  'tree-fruit': 'Tree Fruit', 'tree-seed': 'Tree Seed', 'fruit-tree-sapling': 'Fruit Tree Sapling', 'tree': 'Tree', 'villager': 'Villager',
  'mineral': 'Mineral',
};

// Icon config per type: { icon: FA class, color }
const typeIconConfig = {
  'fish':           { icon: 'fa-solid fa-fish-fins',    color: '#4a90d9' },
  'crop':           { icon: 'fa-solid fa-seedling',     color: '#6b8e23' },
  'artisan':        { icon: 'fa-solid fa-jar',          color: '#d4a017' },
  'animal-product': { icon: 'fa-solid fa-egg',          color: '#f5deb3' },
  'food':           { icon: 'fa-solid fa-utensils',     color: '#c0392b' },
  'mineral':        { icon: 'fa-solid fa-gem',          color: '#5dade2' },
  'artifact':       { icon: 'fa-solid fa-bone',         color: '#cd853f' },
  'forage':         { icon: 'fa-solid fa-leaf',         color: '#27ae60' },
  'seed':           { icon: 'fa-solid fa-seedling',     color: '#6b8e23' },
  'tree-fruit':     { icon: 'fa-solid fa-apple-whole',  color: '#e74c3c' },
  'tree-seed':      { icon: 'fa-solid fa-tree',         color: '#8b6f47' },
  'fruit-tree-sapling': { icon: 'fa-solid fa-tree', color: '#e74c3c' },
  'tree':               { icon: 'fa-solid fa-tree', color: '#2d8b4e' },
  'crafted':        { icon: 'fa-solid fa-hammer',       color: '#d4a017' },
  'big-craftable':  { icon: 'fa-solid fa-cube',         color: '#b8860b' },
  'ring':           { icon: 'fa-solid fa-ring',         color: '#daa520' },
  'weapon':         { icon: 'fa-solid fa-shield-halved', color: '#e74c3c' },
  'boot':           { icon: 'fa-solid fa-shoe-prints',  color: '#8b6f47' },
  'tool':           { icon: 'fa-solid fa-wrench',       color: '#8e8e8e' },
  'trinket':        { icon: 'fa-solid fa-star',         color: '#9b59b6' },
  'bait':           { icon: 'fa-solid fa-worm',         color: '#4a90d9' },
  'tackle':         { icon: 'fa-solid fa-fish-fins',    color: '#4a90d9' },
  'fertilizer':     { icon: 'fa-solid fa-droplet',      color: '#2ecc71' },
  'furniture':      { icon: 'fa-solid fa-couch',        color: '#b8860b' },
  'clothing':       { icon: 'fa-solid fa-shirt',        color: '#e91e9c' },
  'flooring':       { icon: 'fa-solid fa-table',        color: '#8b6f47' },
  'metal-bar':      { icon: 'fa-solid fa-cube',         color: '#a0a0a0' },
  'ore':            { icon: 'fa-solid fa-mountain',     color: '#b87333' },
  'resource':       { icon: 'fa-solid fa-cubes',        color: '#8e8e8e' },
  'trash':          { icon: 'fa-solid fa-trash',        color: '#888' },
  'misc':           { icon: 'fa-solid fa-box',          color: '#7f8c8d' },
  'monster':        { icon: 'fa-solid fa-skull',        color: '#8b0000' },
  'monster-loot':   { icon: 'fa-solid fa-skull',        color: '#a0522d' },
  'animal':         { icon: 'fa-solid fa-cow',          color: '#f5deb3' },
  'villager':       { icon: 'fa-solid fa-house',        color: '#e67e22' },
  'location':       { icon: 'fa-solid fa-map',          color: '#2980b9' },
  'building':       { icon: 'fa-solid fa-building',     color: '#8b6f47' },
  'bundle':         { icon: 'fa-solid fa-cubes',        color: '#6b8e23' },
  'buff':           { icon: 'fa-solid fa-bolt',         color: '#9b59b6' },
  'event':          { icon: 'fa-solid fa-star',         color: '#e67e22' },
  'book':           { icon: 'fa-solid fa-book',         color: '#7b5ea7' },
  'achievement':    { icon: 'fa-solid fa-trophy',       color: '#ffd700' },
  'quest':          { icon: 'fa-solid fa-scroll',       color: '#f1c40f' },
  'power':          { icon: 'fa-solid fa-bolt',         color: '#e74c3c' },
  'concession':     { icon: 'fa-solid fa-cookie',       color: '#e88e10' },
  'movie':          { icon: 'fa-solid fa-film',         color: '#e91e63' },
  'breakable':      { icon: 'fa-solid fa-burst',        color: '#8e8e8e' },
  'festival':       { icon: 'fa-solid fa-flag',         color: '#e67e22' },
};

// Collect members by type, and by type+subtype
const typeMembers = new Map();    // type → [entityIds]
const subtypeMembers = new Map(); // type → Map(subtype → [entityIds])

for (const entity of allCompiledEntities) {
  if (entity.type === 'tag') continue;
  const t = entity.type;
  if (!typeMembers.has(t)) typeMembers.set(t, []);
  typeMembers.get(t).push(entity.id);

  if (entity.subtype && entity.subtype !== entity.type) {
    if (!subtypeMembers.has(t)) subtypeMembers.set(t, new Map());
    const subs = subtypeMembers.get(t);
    if (!subs.has(entity.subtype)) subs.set(entity.subtype, []);
    subs.get(entity.subtype).push(entity.id);
  }
}

const typeEntities = [];
for (const [typeName, memberIds] of typeMembers) {
  const id = 'type-' + typeName;
  const displayName = TYPE_DISPLAY_NAMES[typeName] || typeName;
  const config = typeIconConfig[typeName] || { icon: 'fa-solid fa-layer-group', color: '#7f8c8d' };
  const color = config.color;

  // Build subtypes array if this type has distinct subtypes
  const subs = subtypeMembers.get(typeName);
  let subtypes = null;
  if (subs && subs.size > 0) {
    subtypes = [];
    // Collect IDs that belong to a distinct subtype
    const categorizedIds = new Set();
    for (const [subName, subMemberIds] of subs) {
      subtypes.push({
        id: subName,
        name: SUBTYPE_DISPLAY_NAMES[subName] || subName,
        memberCount: subMemberIds.length,
        memberIds: subMemberIds.sort(),
      });
      subMemberIds.forEach(id => categorizedIds.add(id));
    }
    // Add "Other" group for members not in any distinct subtype
    const uncategorized = memberIds.filter(id => !categorizedIds.has(id));
    if (uncategorized.length > 0) {
      subtypes.push({
        id: '_other',
        name: 'Other',
        memberCount: uncategorized.length,
        memberIds: uncategorized.sort(),
      });
    }
    subtypes.sort((a, b) => a.name.localeCompare(b.name));
  }

  typeEntities.push({
    id,
    name: displayName,
    type: 'type',
    itemCategory: typeName,
    iconClass: config.icon,
    iconColor: color,
    memberCount: memberIds.length,
    memberIds: memberIds.sort(),
    ...(subtypes ? { subtypes } : {}),
  });
}

typeEntities.sort((a, b) => a.name.localeCompare(b.name));
allCompiledEntities.push(...typeEntities);
console.log(`  ✓ Generated ${typeEntities.length} type entities (${[...subtypeMembers.values()].reduce((n, m) => n + m.size, 0)} subtypes)`);

// ---------------------------------------------------------------------------
// Build unified gameIdIndex
// ---------------------------------------------------------------------------
const gameIdIndex = {};
for (const item of allCompiledEntities) {
  if (item.gameId !== undefined && item.gameId !== null) {
    gameIdIndex[item.gameId] = item.id;
  }
}

// ---------------------------------------------------------------------------
// Post-merge: compute derived fields (professionCategory, categoryName, qualityTiers)
// ---------------------------------------------------------------------------
console.log('\n🏷️  Computing derived fields...');
{
  const noQualityTypes = new Set(rules.qualityTiers.noQualityTypes);
  const noQualityCategories = new Set(rules.qualityTiers.noQualityCategories);
  let profCount = 0, catCount = 0, qualCount = 0;

  for (const entity of allCompiledEntities) {
    // --- professionCategory ---
    // Determines which sell-price profession applies to this item
    const actualCategory = entity.originalGameCategory !== undefined
      ? entity.originalGameCategory : entity.gameCategory;
    // Detect animal-sourced artisan goods by checking machine input categories (-5=Egg, -6=Milk)
    const ANIMAL_INPUT_CATEGORIES = [-5, -6];
    const hasAnimalInput = entity.sources?.some(s =>
      s.type === 'machine' && s.inputDetails?.some(d =>
        ANIMAL_INPUT_CATEGORIES.includes(d.inputGameCategory)
      )
    );

    for (const rule of rules.professionRules) {
      const m = rule.match;
      let matched = false;

      if (m.gameCategories && typeof actualCategory === 'number') {
        matched = m.gameCategories.includes(actualCategory);
      }
      if (!matched && m.types && entity.type) {
        matched = m.types.includes(entity.type);
      }
      if (!matched && m.subtypes && entity.subtype) {
        matched = m.subtypes.includes(entity.subtype);
      }

      // Exclusion filters for artisan subtypes
      if (matched && m.excludeAnimalInputCategories && hasAnimalInput) matched = false;
      if (matched && m.excludeContextTags) {
        if (m.excludeContextTags.some(tag => entity.contextTags?.includes(tag))) matched = false;
      }
      if (matched && m.requireAnimalInputCategories && !hasAnimalInput) matched = false;
      if (matched && m.requireContextTags) {
        if (!m.requireContextTags.every(tag => entity.contextTags?.includes(tag))) matched = false;
      }

      if (matched) {
        entity.professionCategory = rule.professionCategory;
        profCount++;
        break;
      }
    }

    // --- categoryName ---
    if (typeof entity.gameCategory === 'number' && entity.gameCategory !== 0) {
      const name = rules.categoryNames[String(entity.gameCategory)];
      if (name) {
        entity.categoryName = name;
        catCount++;
      }
    } else if (typeof entity.gameCategory === 'string') {
      entity.categoryName = entity.gameCategory;
      catCount++;
    }

    // --- qualityTiers ---
    if (noQualityTypes.has(entity.type) || noQualityCategories.has(entity.gameCategory)) {
      // No quality variants — omit field (default to regular-only)
    } else if (entity.isTrapFish) {
      entity.qualityTiers = rules.qualityTiers.overrides.trapFish.tiers;
      qualCount++;
    } else if (entity.type === 'food') {
      entity.qualityTiers = rules.qualityTiers.overrides.food.tiers;
      qualCount++;
    } else if (entity.price != null || entity.prices != null) {
      entity.qualityTiers = rules.qualityTiers.default;
      qualCount++;
    }
  }

  console.log(`  ✓ Assigned professionCategory to ${profCount} entities`);
  console.log(`  ✓ Assigned categoryName to ${catCount} entities`);
  console.log(`  ✓ Assigned qualityTiers to ${qualCount} entities`);
}

// ---------------------------------------------------------------------------
// Phase 2 — Source row normalization
// ---------------------------------------------------------------------------
// Every source row gets a canonical { type, entityId, entityGameId, qualifiers }
// shape, while preserving original fields under qualifiers for back-compat
// (existing consumers continue to work; new consumers can use the normalized
// fields). See docs/DATA_MODEL_REFACTOR_PLAN.md Phase 2.
console.log('\n🔗 Normalizing source rows (Phase 2)...');
{
  // Per-source-type rule: which existing field maps to entityId / entityGameId.
  // entityIdFn(s) → string|null  (returns the friendly id of the entity this
  //                               source links to, or null if no link)
  // entityGameIdFn(s) → string|null  (qualified game id when no friendly id
  //                                   is available; preferred only as a fallback)
  const RULES = {
    'monster-drop':       { entityId: s => s.monsterId ?? null },
    'breakable-drop':     { entityId: s => s.breakableId ?? null },
    'geode':              { entityId: () => null, entityGameId: s => s.geodeGameId ?? null },
    'tilling':            { entityId: s => s.locationId ?? null },
    'forage':             { entityId: s => s.locationId ?? null },
    'garbage-can':        { entityId: s => s.locationId ?? null },
    'shop':               { entityId: s => s.id ?? null },
    'fish':               { entityId: s => s.locationId ?? null },
    'fish-pond':          { entityId: s => {
      // item_<name> tags resolve to the specific fish's pond variant entity
      if (s.fishTag?.startsWith('item_')) {
        const fishId = fishPondVariantData.find(v => {
          const tag = 'item_' + v.fishName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          return tag === s.fishTag;
        })?.fishId;
        return fishId ? `${fishId}-pond` : null;
      }
      return null;  // group tags (fish_ocean, fish_river, etc.) can't resolve to a single variant
    }},
    'tapper':             { entityId: s => s.treeId ? `tree-${s.treeId}` : null },
    'animal':             { entityId: s => s.id ?? null },
    'machine':            { entityId: s => s.id ?? null },  // input is secondary, stays in qualifiers
    'hatch':              { entityId: s => s.id ?? null },
    'pregnancy':          { entityId: s => s.id ?? null },  // pregnancy may carry a parent animal id
    'seed':               { entityId: s => s.seedId ?? null, entityGameId: s => s.seedGameId ?? null },
    'reward':             { entityId: s => s.id ?? null },
    'museum-reward':      { entityId: s => s.id ?? null },
    'location':           { entityId: s => s.locationId ?? null },
    'quest-requirement':  { entityId: s => s.questId ?? null },
    'mail':               { entityId: () => null },  // mailKey is not an entity in our model
    'crafting':           { entityId: () => null },
    'cooking':            { entityId: () => null },
    'tailoring':          { entityId: () => null },
    'fishing-chest':      { entityId: () => null },
    'secret-note-reward': { entityId: () => null },
    'crane-game':         { entityId: () => null },
    'mine-chest':         { entityId: () => null },
    'other':              { entityId: () => null },
    'item':               { entityId: s => s.id ?? null },
    'monster':            { entityId: s => s.id ?? null },
  }

  let normalized = 0
  let unknownTypes = new Map()
  for (const entity of allCompiledEntities) {
    if (!entity.sources?.length) continue
    for (const s of entity.sources) {
      const rule = RULES[s.type]
      if (!rule) {
        unknownTypes.set(s.type ?? '<undefined>', (unknownTypes.get(s.type ?? '<undefined>') ?? 0) + 1)
        // Still normalize to the new shape with nulls so consumers can rely on it
        s.entityId = null
        s.entityGameId = null
        continue
      }
      s.entityId = rule.entityId(s)
      s.entityGameId = rule.entityGameId ? rule.entityGameId(s) : null
      normalized++
    }
  }
  console.log(`  ✓ Normalized ${normalized} source rows`)
  if (unknownTypes.size > 0) {
    console.log(`  ⚠ ${unknownTypes.size} unknown source types encountered:`)
    for (const [t, c] of unknownTypes) console.log(`    ${t}: ${c} rows`)
  }
}

// ---------------------------------------------------------------------------
// Phase 4 — Precomputed inverse arrays
// ---------------------------------------------------------------------------
// Render-time inverse joins like "what items does this monster drop?" used to
// filter the entire items[] array on every modal open. Precompute the inverse
// once during the build so consumers can read entity.drops directly. Same for
// breakables and geodes. Stored as arrays of { entityId, qualifiers } so the
// renderer doesn't need to repeat the source lookup either.
//
// See docs/DATA_MODEL_REFACTOR_PLAN.md Phase 4.
console.log('\n🔁 Precomputing inverse drop tables (Phase 4)...');
{
  // Build inverse maps in one pass
  const monsterDrops = new Map()    // monsterId → [{ entityId, rolls }]
  const breakableDrops = new Map()  // breakableId → [{ entityId, chance }]
  const geodeDrops = new Map()      // geodeGameId → [{ entityId }]

  for (const entity of allCompiledEntities) {
    for (const s of (entity.sources || [])) {
      if (s.type === 'monster-drop' && s.monsterId) {
        if (!monsterDrops.has(s.monsterId)) monsterDrops.set(s.monsterId, [])
        monsterDrops.get(s.monsterId).push({ entityId: entity.id, rolls: s.rolls })
      } else if (s.type === 'breakable-drop' && s.breakableId) {
        if (!breakableDrops.has(s.breakableId)) breakableDrops.set(s.breakableId, [])
        breakableDrops.get(s.breakableId).push({ entityId: entity.id, chance: s.chance })
      } else if (s.type === 'geode' && s.geodeGameId) {
        if (!geodeDrops.has(s.geodeGameId)) geodeDrops.set(s.geodeGameId, [])
        geodeDrops.get(s.geodeGameId).push({ entityId: entity.id })
      }
    }
  }

  // Attach to the corresponding source entity. Skip if the entity already
  // has a `drops` field (some, like fossil-node, define drops in rule files).
  let attached = 0
  for (const entity of allCompiledEntities) {
    if (entity.type === 'monster' && monsterDrops.has(entity.id)) {
      entity.computedDrops = monsterDrops.get(entity.id)
      attached++
    } else if (entity.type === 'breakable' && breakableDrops.has(entity.id)) {
      entity.computedDrops = breakableDrops.get(entity.id)
      attached++
    } else if (entity.type === 'geode' && geodeDrops.has(entity.gameId)) {
      entity.computedDrops = geodeDrops.get(entity.gameId)
      attached++
    }
  }
  console.log(`  ✓ Attached computedDrops to ${attached} entities (${monsterDrops.size} monsters, ${breakableDrops.size} breakables, ${geodeDrops.size} geodes)`)
}

// ---------------------------------------------------------------------------
// Phase 3 — Capabilities derivation
// ---------------------------------------------------------------------------
// Each entity gets a `capabilities` object: a flat namespace of boolean flags
// describing what the entity CAN do, derived from raw game data + presence of
// source-row types + presence of recipe references. Replaces scattered
// `entity.type === X` checks with `entity.capabilities.X` reads.
//
// See docs/CAPABILITIES.md for the vocabulary and rationale.
console.log('\n🏷️  Deriving capabilities (Phase 3)...');
{
  // Gather indexes once for efficient capability derivation
  const cookingOutputIds = new Set()        // gameIds output by a cooking recipe (= entities of type 'food')
  const craftingOutputIds = new Set()       // gameIds output by a crafting recipe
  const tailoringOutputIds = new Set()      // gameIds output by tailoring (= clothing with tailoring source)
  const usableInCooking = new Set()         // gameIds USED AS an ingredient in cooking
  const usableInCrafting = new Set()        // gameIds USED AS an ingredient in crafting
  const usableInTailoring = new Set()       // gameIds USED AS an ingredient in tailoring
  const giftedItemIds = new Set()           // itemIds appearing as a gift in relationships
  const bundleItemIds = new Set()           // gameIds required by any bundle

  // Pass 1: index direct categorical outputs
  for (const entity of allCompiledEntities) {
    if (entity.type === 'food') cookingOutputIds.add(entity.gameId)
    if (entity.type === 'crafted') craftingOutputIds.add(entity.gameId)
    for (const r of (entity.usedInRecipes || [])) {
      if (r.type === 'cooking')   usableInCooking.add(entity.gameId)
      if (r.type === 'crafting')  usableInCrafting.add(entity.gameId)
      if (r.type === 'tailoring') usableInTailoring.add(entity.gameId)
    }
    if (entity.type === 'bundle') {
      for (const it of (entity.items || [])) {
        if (it.gameId) bundleItemIds.add(it.gameId)
      }
    }
  }
  for (const [itemId] of relationships) giftedItemIds.add(itemId)

  // Pass 2: tailoring outputs. The output gameId is encoded in the recipeId
  // suffix as `...(S)1234` or `...(P)5678`. Walk every tailoring recipe ref
  // and extract the qualified id from the suffix.
  const TAILORING_OUTPUT_RE = /\((S|P|H|B)\)([A-Za-z0-9_]+)$/
  for (const entity of allCompiledEntities) {
    for (const r of (entity.usedInRecipes || [])) {
      if (r.type !== 'tailoring' || !r.recipeId) continue
      const m = r.recipeId.match(TAILORING_OUTPUT_RE)
      if (m) tailoringOutputIds.add(`(${m[1]})${m[2]}`)
    }
  }

  // Source-type presence cheats: a Set of source types per entity
  function sourceTypes(entity) {
    const set = new Set()
    for (const s of (entity.sources || [])) if (s.type) set.add(s.type)
    return set
  }

  // Equippable types — kept as a single set rather than 5 separate flags
  // since callers usually just want to know "is this an equippable thing"
  const EQUIPPABLE_TYPES = new Set(['weapon', 'boot', 'ring', 'trinket', 'tool', 'clothing', 'hat'])

  // Types that legitimately have no sell price at all (rather than just an
  // entity that happens to be missing one). Drives `hasSellingPrice`.
  const NEVER_SELLABLE = new Set(['bundle', 'location', 'machine', 'festival', 'villager',
    'event', 'achievement', 'quest', 'tag', 'type', 'building', 'movie', 'concession',
    'buff', 'power', 'museum-reward', 'reward', 'tree', 'animal', 'monster',
    'tool', 'weapon', 'boot', 'trinket', 'furniture'])

  let derived = 0
  for (const entity of allCompiledEntities) {
    const sTypes = sourceTypes(entity)
    const id = entity.id
    const gameId = entity.gameId

    const caps = {
      // Acquisition / sourcing — derived from sources[]. "obtainableFrom*"
      // means "this item can be acquired via that mechanism."
      obtainableFromGeode:        sTypes.has('geode'),
      obtainableFromMonsters:     sTypes.has('monster-drop'),
      obtainableFromBreakables:   sTypes.has('breakable-drop'),
      obtainableFromTilling:      sTypes.has('tilling'),
      obtainableFromFishing:      sTypes.has('fish'),
      obtainableFromFishingChest: sTypes.has('fishing-chest'),
      obtainableFromForage:       sTypes.has('forage'),
      obtainableFromShop:         sTypes.has('shop'),
      obtainableFromMail:         sTypes.has('mail'),
      obtainableFromGarbage:      sTypes.has('garbage-can'),
      obtainableFromAnimal:       sTypes.has('animal') || sTypes.has('hatch') || sTypes.has('pregnancy'),
      obtainableFromTapping:      sTypes.has('tapper'),
      obtainableFromQuest:        sTypes.has('quest-requirement') || sTypes.has('reward'),
      obtainableFromSecretNote:   sTypes.has('secret-note-reward'),
      obtainableFromMachine:      sTypes.has('machine'),
      // *Output by* a recipe — i.e. the player makes this item via the recipe.
      // Not "this item is an ingredient." Use usableIn* below for the inverse.
      cookable:                   sTypes.has('cooking')   || cookingOutputIds.has(gameId),
      craftable:                  sTypes.has('crafting')  || craftingOutputIds.has(gameId),
      tailorable:                 sTypes.has('tailoring') || tailoringOutputIds.has(gameId),
      obtainableFromSeed:         sTypes.has('seed'),

      // Used as an ingredient in a recipe (the inverse of cookable/craftable/tailorable)
      usableInCooking:   gameId != null && usableInCooking.has(gameId),
      usableInCrafting:  gameId != null && usableInCrafting.has(gameId),
      usableInTailoring: gameId != null && usableInTailoring.has(gameId),

      // Use capabilities — what the player can do with this item
      donatable:    !!entity.museumDonatable,
      giftable:     !!entity.canBeGifted || (id != null && giftedItemIds.has(id)),
      edible:       (entity.edibility ?? -300) > -300,
      equippable:   EQUIPPABLE_TYPES.has(entity.type),
      bundleSlot:   gameId != null && bundleItemIds.has(gameId),

      // Pricing — replaces the 10-clause negation in UniversalModal.jsx:311
      hasSellingPrice: !NEVER_SELLABLE.has(entity.type)
        && (entity.price != null && entity.price > 0
            || entity.prices != null && Object.keys(entity.prices).length > 0),

      // Quality
      hasQualityTiers: Array.isArray(entity.qualityTiers) && entity.qualityTiers.length > 1,

      // Subtype-disguised hat check (clothing+hat is a Stardew quirk)
      isHat:        entity.type === 'clothing' && entity.subtype === 'hat',
    }

    entity.capabilities = caps
    derived++
  }
  console.log(`  ✓ Derived capabilities for ${derived} entities`)
}

// ---------------------------------------------------------------------------
// Write unified public/data/entities.json
// ---------------------------------------------------------------------------
console.log('\n📄 Writing unified entities.json...');

function writeJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

const entitiesData = {
  items: allCompiledEntities,
  // villagers and buffs are first-class entities in items[] (type: 'villager'/'buff').
  // No separate top-level arrays needed — EntityContext indexes them from items[].
  relationships,
  gameIdIndex,
  meta: {
    compiled: new Date().toISOString(),
    totalItems: allCompiledEntities.length,
    totalBundles: bundleData.length,
    totalVillagers: villagerData.length,
    totalLocations: taggedLocations.length,
    totalFestivals: taggedFestivals.length,
    totalBuffs: buffData.length,
    totalAchievements: achievementData.length,
    totalQuests: questData.length,
    totalPowers: powerData.length,
    totalConcessions: concessionData.length,
    totalMovies: movieData.length,
    totalClothing: clothingData.length,
    totalEvents: eventData.length,
    totalSecretNotes: secretNoteData.filter(n => n.entityType === 'secret-note').length,
    totalJournalScraps: secretNoteData.filter(n => n.entityType === 'journal-scrap').length,
    totalRelationships: relationships.length,
    mergedDuplicates,
  }
};

writeJson(path.join(OUTPUT_DIR, 'entities.json'), entitiesData);
console.log(`  ✓ Wrote entities.json (${allCompiledEntities.length} items, ${bundleData.length} bundles, ${villagerData.length} villagers)`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n📊 Compilation Summary:');
console.log('━'.repeat(50));

const typeCounts = {};
for (const item of allCompiledEntities) {
  typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
}

for (const [type, count] of Object.entries(typeCounts).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${type.padEnd(18)} ${count}`);
}
console.log(`${'  TOTAL'.padEnd(20)} ${allCompiledEntities.length}`);
console.log(`  artisan source items: ${artisanData.length} → ${compiledArtisan.length} expanded`);

const outputSize = JSON.stringify(entitiesData).length;
console.log(`\n💾 entities.json size: ${(outputSize / 1024).toFixed(1)} KB`);

// ---------------------------------------------------------------------------
// Validation Report — per-type gap counts
// ---------------------------------------------------------------------------
console.log('\n🔍 Validation Report:');
console.log('━'.repeat(70));
console.log(`  ${'Type'.padEnd(18)} ${'Count'.padStart(5)}  ${'No Icon'.padStart(7)}  ${'No Src'.padStart(6)}  ${'No GID'.padStart(6)}  ${'No Price'.padStart(8)}`);
console.log('  ' + '─'.repeat(56));

const SKIP_ICON_TYPES = new Set(['event', 'buff', 'villager', 'bundle', 'tag']);
const SKIP_SOURCE_TYPES = new Set(['event', 'villager', 'location', 'festival', 'achievement', 'quest', 'power', 'concession', 'movie', 'clothing', 'tag']);
const SKIP_GAMEID_TYPES = new Set(['location', 'festival', 'tag']);
const SKIP_PRICE_TYPES = new Set(['event', 'buff', 'villager', 'location', 'festival', 'bundle',
  'monster', 'building', 'animal', 'breakable', 'achievement', 'quest', 'power', 'movie', 'tag']);

const validationByType = {};
for (const item of allCompiledEntities) {
  const t = item.type;
  if (!validationByType[t]) validationByType[t] = { count: 0, noIcon: 0, noSrc: 0, noGameId: 0, noPrice: 0 };
  const v = validationByType[t];
  v.count++;
  if (!SKIP_ICON_TYPES.has(t) && !item.icon) v.noIcon++;
  if (!SKIP_SOURCE_TYPES.has(t) && (!item.sources || item.sources.length === 0)) v.noSrc++;
  if (!SKIP_GAMEID_TYPES.has(t) && (item.gameId === undefined || item.gameId === null)) v.noGameId++;
  if (!SKIP_PRICE_TYPES.has(t) && (item.price === undefined || item.price === null)) v.noPrice++;
}

let totalGaps = 0;
for (const [type, v] of Object.entries(validationByType).sort((a, b) => a[0].localeCompare(b[0]))) {
  const gaps = v.noIcon + v.noSrc + v.noGameId + v.noPrice;
  totalGaps += gaps;
  const marker = gaps > 0 ? ' ⚠' : '';
  console.log(`  ${type.padEnd(18)} ${String(v.count).padStart(5)}  ${String(v.noIcon).padStart(7)}  ${String(v.noSrc).padStart(6)}  ${String(v.noGameId).padStart(6)}  ${String(v.noPrice).padStart(8)}${marker}`);
}
console.log('  ' + '─'.repeat(56));
const totals = Object.values(validationByType).reduce((a, v) => {
  a.count += v.count; a.noIcon += v.noIcon; a.noSrc += v.noSrc; a.noGameId += v.noGameId; a.noPrice += v.noPrice;
  return a;
}, { count: 0, noIcon: 0, noSrc: 0, noGameId: 0, noPrice: 0 });
console.log(`  ${'TOTAL'.padEnd(18)} ${String(totals.count).padStart(5)}  ${String(totals.noIcon).padStart(7)}  ${String(totals.noSrc).padStart(6)}  ${String(totals.noGameId).padStart(6)}  ${String(totals.noPrice).padStart(8)}`);
if (totalGaps > 0) console.log(`\n  ⚠ ${totalGaps} total gaps found (see rows marked ⚠)`);

console.log('\n✅ Processing and compilation complete!');

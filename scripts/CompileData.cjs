#!/usr/bin/env node

/**
 * Compile source data into an optimized unified items.json
 * and supporting reference/collection files.
 */

const fs = require('fs');
const path = require('path');
const {
  createGameIdIndex,
  compilePage,
  calculateQualityPrices
} = require('./lib/CompilationHelpers.cjs');

const SOURCE_DIR = path.join(__dirname, '../data/processed');
const RULES_DIR = path.join(__dirname, '../data/rules');
const GAME_EXPORTS_DIR = path.join(__dirname, '../data/game-exports');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

console.log('🔨 Starting data compilation...\n');

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------
console.log('📖 Loading source data...');
const sourceData = {
  fish:           loadJson(path.join(SOURCE_DIR, 'items/fish.json')),
  artisan:        loadJson(path.join(SOURCE_DIR, 'items/artisan.json')),
  crops:          loadJson(path.join(SOURCE_DIR, 'items/crops.json')),
  forage:         loadJson(path.join(SOURCE_DIR, 'items/forage.json')),
  treeFruits:     loadJson(path.join(SOURCE_DIR, 'items/tree-fruits.json')),
  minerals:       loadJson(path.join(SOURCE_DIR, 'items/minerals.json')),
  metalBars:      loadJson(path.join(SOURCE_DIR, 'items/metal-bars.json')),
  monsterLoot:    loadJson(path.join(SOURCE_DIR, 'items/monster-loot.json')),
  resources:      loadJson(path.join(SOURCE_DIR, 'items/resources.json')),
  bigCraftables:  loadJson(path.join(SOURCE_DIR, 'items/big-craftables.json')),
  animalProducts: loadJson(path.join(SOURCE_DIR, 'items/animal-products.json')),
  seeds:          loadJson(path.join(SOURCE_DIR, 'items/seeds.json')),
  furniture:      loadJson(path.join(SOURCE_DIR, 'items/furniture.json')),
  hats:           loadJson(path.join(SOURCE_DIR, 'items/hats.json')),
  food:           loadJson(path.join(SOURCE_DIR, 'items/food.json')),
  ores:           loadJson(path.join(SOURCE_DIR, 'items/ores.json')),
  geodeMinerals:  loadJson(path.join(SOURCE_DIR, 'items/geode-minerals.json')),  // merged into mineral category
  crafted:        loadJson(path.join(SOURCE_DIR, 'items/crafted.json')),
  fertilizers:    loadJson(path.join(SOURCE_DIR, 'items/fertilizers.json')),
  bait:           loadJson(path.join(SOURCE_DIR, 'items/bait.json')),
  tackle:         loadJson(path.join(SOURCE_DIR, 'items/tackle.json')),
  flooring:       loadJson(path.join(SOURCE_DIR, 'items/flooring.json')),
  trash:          loadJson(path.join(SOURCE_DIR, 'items/trash.json')),
  books:          loadJson(path.join(SOURCE_DIR, 'items/books.json')),
  artifacts:      loadJson(path.join(SOURCE_DIR, 'items/artifacts.json')),
  rings:          loadJson(path.join(SOURCE_DIR, 'items/rings.json')),
  treeSeeds:      loadJson(path.join(SOURCE_DIR, 'items/tree-seeds.json')),
  misc:           loadJson(path.join(SOURCE_DIR, 'items/misc.json')),
  weapons:        loadJson(path.join(SOURCE_DIR, 'items/weapons.json')),
  boots:          loadJson(path.join(SOURCE_DIR, 'items/boots.json')),
  tools:          loadJson(path.join(SOURCE_DIR, 'items/tools.json')),
  trinkets:       loadJson(path.join(SOURCE_DIR, 'items/trinkets.json')),
  buildings:      loadJson(path.join(SOURCE_DIR, 'items/buildings.json')),
  animals:        loadJson(path.join(SOURCE_DIR, 'items/animals.json')),
  monsters:       loadJson(path.join(SOURCE_DIR, 'items/monsters.json')),
  bundles:        loadJson(path.join(SOURCE_DIR, 'collections/bundles.json')),
  locations: loadJson(path.join(RULES_DIR, 'locations.json')),
  festivals: loadJson(path.join(RULES_DIR, 'festivals.json')),
  villagers:      loadJson(path.join(SOURCE_DIR, 'reference/villagers.json')),
  buffs:          loadJson(path.join(SOURCE_DIR, 'reference/buffs.json')),
  events:         loadJson(path.join(SOURCE_DIR, 'reference/events.json')),
};

for (const [key, val] of Object.entries(sourceData)) {
  if (Array.isArray(val)) {
    console.log(`  ✓ Loaded ${val.length} ${key}`);
  }
}

// ---------------------------------------------------------------------------
// Load rules
// ---------------------------------------------------------------------------
const qualityMultipliers = loadJson(path.join(RULES_DIR, 'quality-multipliers.json')).multipliers;
const artisanNaming = loadJson(path.join(RULES_DIR, 'artisan-naming.json')).patterns;

// ---------------------------------------------------------------------------
// Expand artisan items (Wine → Ancient Fruit Wine, Starfruit Wine, etc.)
// ---------------------------------------------------------------------------
console.log('\n🍷 Expanding artisan items...');

const compiledArtisan = [];

sourceData.artisan.forEach(artisan => {
  const machineSource = artisan.sources?.find(s => s.type === 'machine');
  const inputDetails = machineSource?.inputDetails || [];

  // Remove gifts (use gifts.json pivot table)
  const { gifts, ...artisanBase } = artisan;

  if (inputDetails.length > 0) {
    const namingRule = artisanNaming[artisan.name];
    const shouldMergeInputs = inputDetails.length > 1 && namingRule?.pattern === 'none';

    if (shouldMergeInputs) {
      // Multiple inputs produce same named item (Cheese, Goat Cheese, Mayonnaise)
      // Use artisan.price (item's own base price) when outputs have varying counts,
      // otherwise fall back to inputDetails[0].outputPrice (covers fixed-output items like Cheese)
      const hasVaryingOutputCount = inputDetails.some(d => d.outputCount && d.outputCount > 1);
      const basePrice = hasVaryingOutputCount ? artisan.price : inputDetails[0].outputPrice;
      const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

      const compiledItem = {
        ...artisanBase,
        category: 'artisan',
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
      // Expand into variants; also emit a generic item for multi-input types
      const isMulti = inputDetails.length > 1;

      // Generic item (e.g. "Wine" as a category, links to variants)
      if (isMulti) {
        const genericItem = {
          ...artisanBase,
          category: 'artisan',
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

        // Variants
        inputDetails.forEach(inputDetail => {
          let variantName;
          if (namingRule?.pattern === 'prefix') {
            variantName = namingRule.format.replace('{input}', inputDetail.inputName);
          } else {
            variantName = `${inputDetail.inputName} ${artisan.name}`;
          }
          const variantId = `${inputDetail.inputId}-${artisan.id}`;
          const basePrice = inputDetail.outputPrice;
          const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

          const variant = {
            id: variantId,
            gameId: artisan.gameId,
            name: variantName,
            category: 'artisan',
            gameCategory: artisan.gameCategory,
            type: artisan.type,
            icon: artisan.icon,
            contextTags: artisan.contextTags,
            edibility: artisan.edibility,
            prices: qualityPrices,
            sellingLocations: artisan.sellingLocations,
            bundles: artisan.bundles,
            genericId: artisan.id,
            sources: artisan.sources.filter(s => s.type !== 'fish-pond').map(s => {
              if (s.type !== 'machine') return s;
              // For roe-input items (Aged Roe), the actual input is a roe variant,
              // not the fish itself. Remap inputId/inputName to the roe variant.
              const isRoeInput = s.inputType === 'roe';
              return {
                type: s.type,
                id: s.id,
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

          genericItem.variations.push(variantId);
          compiledArtisan.push(variant);
        });

        // Wild variant (Honey without flowers)
        if (artisan.includeWildVariant) {
          const wildVariant = {
            id: `wild-${artisan.id}`,
            gameId: artisan.gameId,
            name: `Wild ${artisan.name}`,
            category: 'artisan',
            gameCategory: artisan.gameCategory,
            type: artisan.type,
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
        // Single-input item — keep as-is with prices
        const basePrice = inputDetails[0].outputPrice;
        const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);
        const compiledItem = {
          ...artisanBase,
          category: 'artisan',
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
    // No machine source with inputDetails — static item
    const qualityPrices = calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);
    compiledArtisan.push({
      ...artisanBase,
      category: 'artisan',
      prices: qualityPrices,
    });
  }
});

console.log(`  ✓ Expanded artisan: ${sourceData.artisan.length} source → ${compiledArtisan.length} compiled`);

// ---------------------------------------------------------------------------
// Tag all entity types with category
// ---------------------------------------------------------------------------
console.log('\n🏷️  Tagging entity categories...');

function tagEntities(entities, category, gameIdPrefix, extraFields = {}) {
  return entities.map(entity => {
    const { gifts, ...entityWithoutGifts } = entity;
    // Qualify any bare gameId that hasn't already been qualified
    if (gameIdPrefix && entity.gameId != null) {
      const s = String(entity.gameId)
      if (!s.startsWith('(')) {
        entityWithoutGifts.gameId = `(${gameIdPrefix})${s}`
      }
    }
    // Allow entity to override its own category (e.g. BC items reclassified as furniture)
    const effectiveCategory = entityWithoutGifts.category || category;
    return { ...entityWithoutGifts, ...extraFields, category: effectiveCategory };
  });
}

const taggedFish           = tagEntities(sourceData.fish,           'fish',           'O');
const taggedCrops          = tagEntities(sourceData.crops,          'crop',           'O');
const taggedForage         = tagEntities(sourceData.forage,         'forage',         'O');
const taggedTreeFruits     = tagEntities(sourceData.treeFruits,     'tree-fruit',     'O');
const taggedMinerals       = tagEntities(sourceData.minerals,       'mineral',        'O');
const taggedMetalBars      = tagEntities(sourceData.metalBars,      'metal-bar',      'O');
const taggedMonsterLoot    = tagEntities(sourceData.monsterLoot,    'monster-loot',   'O');
const taggedResources      = tagEntities(sourceData.resources,      'resource',       'O');
const taggedBigCraftables  = tagEntities(sourceData.bigCraftables,  'big-craftable',  'BC');
const taggedAnimalProducts = tagEntities(sourceData.animalProducts, 'animal-product', 'O');
const taggedSeeds          = tagEntities(sourceData.seeds,          'seed',           'O');
const taggedFurniture      = tagEntities(sourceData.furniture,      'furniture',      'F');
const taggedHats           = tagEntities(sourceData.hats,           'hat',            'H');
const taggedFood           = tagEntities(sourceData.food,           'food',           'O');
const taggedOres           = tagEntities(sourceData.ores,           'ore',            'O');
const taggedGeodeMinerals  = tagEntities(sourceData.geodeMinerals,  'mineral',        'O');
const taggedCrafted        = tagEntities(sourceData.crafted,        'crafted',        'O');
const taggedFertilizers    = tagEntities(sourceData.fertilizers,    'fertilizer',     'O');
const taggedBait           = tagEntities(sourceData.bait,           'bait',           'O');
const taggedTackle         = tagEntities(sourceData.tackle,         'tackle',         'O');
const taggedFlooring       = tagEntities(sourceData.flooring,       'flooring',       'O');
const taggedTrash          = tagEntities(sourceData.trash,          'trash',          'O');
const taggedBooks          = tagEntities(sourceData.books,          'book',           'O');
const taggedArtifacts      = tagEntities(sourceData.artifacts,      'artifact',       'O');
const taggedRings          = tagEntities(sourceData.rings,          'ring',           'O');
const taggedTreeSeeds      = tagEntities(sourceData.treeSeeds,      'tree-seed',      'O');
const taggedMisc           = tagEntities(sourceData.misc,           'misc',           'O');
const taggedWeapons        = tagEntities(sourceData.weapons,        'weapon',         'W');
const taggedBoots          = tagEntities(sourceData.boots,          'boot',           'B');
const taggedTools          = tagEntities(sourceData.tools,          'tool',           'T');
const taggedTrinkets       = tagEntities(sourceData.trinkets,       'trinket',        'TR');
const taggedBuildings      = tagEntities(sourceData.buildings,      'building',       'BLD');
const taggedAnimals        = tagEntities(sourceData.animals,        'animal',         'FA');
const taggedMonsters       = sourceData.monsters.map(m => ({ ...m, category: 'monster' }));
const taggedBuffs          = sourceData.buffs.map(b => ({ ...b, category: 'buff' }));
const taggedEvents         = sourceData.events.map(e => ({ ...e, category: 'event' }));
const taggedVillagers      = sourceData.villagers.map(v => ({ ...v, category: 'villager' }));

// Normalize any legacy store- prefixes in villager storeIds — add loc- prefix
for (const v of sourceData.villagers) {
  if (Array.isArray(v.storeIds)) {
    v.storeIds = v.storeIds.map(id =>
      id.startsWith('loc-') ? id :
      id.startsWith('store-') ? 'loc-' + id.slice(6) :
      'loc-' + id
    );
  }
}

const taggedLocations = Object.values(sourceData.locations.locations || {}).map(loc => {
  const location = { ...loc, category: 'location' };
  if (!location.icon && location.operator) {
    location.icon = `assets/villagers/${location.operator}.png`;
  }
  return location;
});

const taggedFestivals = Object.values(sourceData.festivals.festivals || {}).map(fest => ({
  ...fest,
  category: 'festival',
}));

// Derive buys for each location from categorySellingLocations
const buysByLocation = {};
for (const [cat, locIds] of Object.entries(sourceData.locations.categorySellingLocations || {})) {
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
console.log('\n🌿 Deriving forage locations/seasons...');

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
// Priority: crop > forage for category when merging
// ---------------------------------------------------------------------------
console.log('\n🔗 Merging cross-collection items...');

// CATEGORY_PRIORITY: lower number = higher priority (wins category in merge)
const CATEGORY_PRIORITY = {
  'fish': 1,
  'artisan': 2,
  'crop': 3,
  'forage': 4,
  'tree-fruit': 5,
  'mineral': 6,
  'metal-bar': 7,
  'monster-loot': 8,
  'resource': 9,
  'big-craftable': 10,
  'animal-product': 11,
  'seed': 12,
  'furniture': 13,
  'hat': 14,
  'food': 15,
  'ore': 16,
  // geode-mineral merged into mineral (type='geode-mineral' under category='mineral')
  'crafted': 18,
  'fertilizer': 19,
  'bait': 20,
  'tackle': 21,
  'flooring': 22,
  'trash': 23,
  'book': 24,
  'artifact': 25,
  'ring': 26,
  'tree-seed': 27,
  'misc': 28,
  'buff': 29,
  'event': 30,
  'villager': 31,
  'weapon': 32,
  'boot': 33,
  'tool': 34,
  'trinket': 35,
  'building': 36,
  'animal': 37,
  'monster': 38,
  'location': 39,
  'festival': 40,
};

// All entity arrays to merge
const allTypedEntities = [
  ...taggedFish,
  ...compiledArtisan,
  ...taggedCrops,
  ...taggedForage,
  ...taggedTreeFruits,
  ...taggedMinerals,
  ...taggedMetalBars,
  ...taggedMonsterLoot,
  ...taggedResources,
  ...taggedBigCraftables,
  ...taggedAnimalProducts,
  ...taggedSeeds,
  ...taggedFurniture,
  ...taggedHats,
  ...taggedFood,
  ...taggedOres,
  ...taggedGeodeMinerals,
  ...taggedCrafted,
  ...taggedFertilizers,
  ...taggedBait,
  ...taggedTackle,
  ...taggedFlooring,
  ...taggedTrash,
  ...taggedBooks,
  ...taggedArtifacts,
  ...taggedRings,
  ...taggedTreeSeeds,
  ...taggedMisc,
  ...taggedWeapons,
  ...taggedBoots,
  ...taggedTools,
  ...taggedTrinkets,
  ...taggedBuildings,
  ...taggedAnimals,
  ...taggedMonsters,
  ...taggedBuffs,
  ...taggedEvents,
  ...taggedVillagers,
  ...taggedLocations,
  ...taggedFestivals,
];

// Merge by friendly id: combine sources arrays, keep highest-priority category.
// This handles entities that appear in multiple source files (e.g. grape is both crop and forage).
// Artisan variants intentionally share a gameId but have unique friendly ids, so they are NOT merged.
const mergedEntitiesById = new Map();
let mergedDuplicates = 0;

// Categories that should never be merged with other categories even if ids collide
const NO_MERGE_CATEGORIES = new Set(['location', 'festival', 'villager']);

for (const entity of allTypedEntities) {
  // Use a compound key for location/festival/villager to prevent cross-type merging
  const key = NO_MERGE_CATEGORIES.has(entity.category) ? `${entity.category}:${entity.id}` : entity.id;

  if (!mergedEntitiesById.has(key)) {
    mergedEntitiesById.set(key, { ...entity, sources: [...(entity.sources || [])] });
  } else {
    const existing = mergedEntitiesById.get(key);
    mergedDuplicates++;

    // Merge sources (avoid exact duplicates)
    const existingSrcJson = new Set((existing.sources || []).map(s => JSON.stringify(s)));
    for (const src of (entity.sources || [])) {
      const srcJson = JSON.stringify(src);
      if (!existingSrcJson.has(srcJson)) {
        existing.sources.push(src);
        existingSrcJson.add(srcJson);
      }
    }

    // Merge bundles array
    if (entity.bundles?.length) {
      const existingBundles = new Set(existing.bundles || []);
      for (const b of entity.bundles) existingBundles.add(b);
      existing.bundles = [...existingBundles];
    }

    // Keep highest-priority category
    const existingPriority = CATEGORY_PRIORITY[existing.category] ?? 999;
    const incomingPriority = CATEGORY_PRIORITY[entity.category] ?? 999;
    if (incomingPriority < existingPriority) {
      existing.category = entity.category;
    }

    // Merge other fields from incoming entity (fill in any gaps)
    for (const [field, val] of Object.entries(entity)) {
      if (field === 'sources' || field === 'bundles' || field === 'category') continue;
      if (!(field in existing) && val !== undefined) {
        existing[field] = val;
      }
    }
  }
}

const allCompiledEntities = [...mergedEntitiesById.values()];
console.log(`  ✓ Merged ${mergedDuplicates} duplicate ids → ${allCompiledEntities.length} unique entities`);

// ---------------------------------------------------------------------------
// Post-merge: re-derive forage locations/seasons for cross-collection items
// (e.g. cactus-fruit is primarily a crop but also has forage sources)
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
// Post-merge: collapse shop sources that differ only in seasons into one
// source with a merged seasons array. E.g. Wheat Seeds at Pierre's has two
// entries (SEASON summer, SEASON fall) that should show as one row with both
// seasons active.
// ---------------------------------------------------------------------------
const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

for (const item of allCompiledEntities) {
  const shopSources = (item.sources || []).filter(s => s.type === 'shop');
  if (shopSources.length < 2) continue;

  // Key = everything except seasons
  const key = src => [
    src.id, src.price, src.quantity,
    src.tradeItemId, src.tradeItemAmount, src.tradeItemGameId,
    src.shopCurrency, src.yearUnlock, src.yearUnlockBefore,
    src.rotating, src.stock, src.stockLimit,
    JSON.stringify(src.condition),
  ].join('\0');

  const groups = new Map();
  for (const src of shopSources) {
    const k = key(src);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(src);
  }

  const merged = [];
  for (const srcs of groups.values()) {
    if (srcs.length === 1) {
      merged.push(...srcs);
    } else if (srcs.some(s => !s.seasons)) {
      // No seasons on any — just keep one (they're identical by key)
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
// Normalize legacy store- prefixes in sellingLocations and shop source IDs.
// Processed source files may still carry the old prefix; convert them to loc-
// prefix here so compiled output uses the new prefixed location IDs throughout.
// ---------------------------------------------------------------------------
console.log('\n🏪 Normalizing legacy store- prefixes to loc-...');

function normalizeLegacyId(id) {
  if (!id || typeof id !== 'string') return id;
  if (id.startsWith('loc-')) return id;
  if (id.startsWith('store-')) return 'loc-' + id.slice(6);
  return id; // non-location IDs (e.g. machine IDs) pass through unchanged
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
// Add name/icon/id to each ingredient in crafting sources so the modal can
// render them without a runtime lookup.
// ---------------------------------------------------------------------------
console.log('\n🔨 Resolving crafting ingredient names...');

// Build a gameId → item map for ingredient lookups.
// Qualified gameIds are unique across all namespaces — no collision handling needed.
const itemsByGameId = new Map();
for (const item of allCompiledEntities) {
  if (item.gameId !== undefined && item.gameId !== null) {
    itemsByGameId.set(item.gameId, item);
  }
}

// Load raw Objects.json as a fallback for ingredient names not in compiled items
// (e.g. Coal, which isn't tracked as a standalone item type yet)
let rawObjectsData = null;
try {
  rawObjectsData = loadJson(path.join(GAME_EXPORTS_DIR, 'Objects.json'));
} catch { /* optional */ }

function resolveIngredientName(gameId) {
  if (rawObjectsData) {
    const obj = rawObjectsData[String(gameId)];
    if (obj?.Name) return obj.Name;
  }
  return null;
}

let resolvedIngredients = 0;
for (const item of allCompiledEntities) {
  for (const src of (item.sources || [])) {
    if ((src.type !== 'crafting' && src.type !== 'cooking') || !src.ingredients) continue;
    src.ingredientDetails = src.ingredients.map(ing => {
      const ingItem = itemsByGameId.get(ing.gameId) ?? itemsByGameId.get(`(O)${ing.gameId}`);
      const fallbackName = ingItem ? null : resolveIngredientName(ing.gameId);
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
      ingredientUsedIn.get(ing.id).push({ recipeId: item.id, recipeName: item.name, type: src.type, amount: ing.amount });
    }
  }
}
for (const item of allCompiledEntities) {
  const usedIn = ingredientUsedIn.get(item.id);
  if (usedIn?.length > 0) item.usedInRecipes = usedIn;
}
console.log(`  ✓ Built reverse ingredient index for ${ingredientUsedIn.size} ingredients`);

// ---------------------------------------------------------------------------
// Enrich monster-drop sources with monsterId (friendly ID)
// ---------------------------------------------------------------------------
console.log('\n🗡️ Enriching monster-drop sources...');
const monsterById = new Map(taggedMonsters.map(m => [m.internalName, m]));
let enrichedDrops = 0;
for (const item of allCompiledEntities) {
  for (const src of (item.sources || [])) {
    if (src.type !== 'monster-drop' || !src.monster) continue;
    const monster = monsterById.get(src.monster);
    if (monster) {
      src.monsterId = monster.id;
      enrichedDrops++;
    }
  }
}
console.log(`  ✓ Enriched ${enrichedDrops} monster-drop sources with monsterId`);

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
// Load remaining reference data (bundles, villagers, gifts)
// ---------------------------------------------------------------------------
console.log('\n📖 Loading reference data...');

const giftsPath = path.join(SOURCE_DIR, 'relationships/gifts.json');
const giftsData = fs.existsSync(giftsPath) ? loadJson(giftsPath) : { relationships: [] };

console.log(`  ✓ Loaded gifts (${giftsData.relationships?.length ?? 0} relationships)`);

// ---------------------------------------------------------------------------
// Write unified public/data/entities.json
// ---------------------------------------------------------------------------
console.log('\n📄 Writing unified entities.json...');

const entitiesData = {
  items: allCompiledEntities,
  bundles: sourceData.bundles,
  villagers: sourceData.villagers,
  buffs: sourceData.buffs.map(b => ({ ...b, entityType: 'buff' })),
  relationships: giftsData.relationships || [],
  gameIdIndex,
  meta: {
    compiled: new Date().toISOString(),
    totalItems: allCompiledEntities.length,
    totalBundles: sourceData.bundles.length,
    totalVillagers: sourceData.villagers.length,
    totalLocations: taggedLocations.length,
    totalFestivals: taggedFestivals.length,
    totalBuffs: sourceData.buffs.length,
    totalEvents: sourceData.events.length,
    totalRelationships: giftsData.relationships?.length ?? 0,
    mergedDuplicates,
  }
};

writeJson(path.join(OUTPUT_DIR, 'entities.json'), entitiesData);
console.log(`  ✓ Wrote entities.json (${allCompiledEntities.length} items, ${sourceData.bundles.length} bundles, ${sourceData.villagers.length} villagers)`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n📊 Compilation Summary:');
console.log('━'.repeat(50));

const typeCounts = {};
for (const item of allCompiledEntities) {
  typeCounts[item.category] = (typeCounts[item.category] || 0) + 1;
}

for (const [type, count] of Object.entries(typeCounts).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${type.padEnd(18)} ${count}`);
}
console.log(`${'  TOTAL'.padEnd(20)} ${allCompiledEntities.length}`);
console.log(`  artisan source items: ${sourceData.artisan.length} → ${compiledArtisan.length} expanded`);

const outputSize = JSON.stringify(entitiesData).length;
console.log(`\n💾 entities.json size: ${(outputSize / 1024).toFixed(1)} KB`);

console.log('\n✅ Data compilation complete!');
console.log(`\nCompiled files written to: ${OUTPUT_DIR}`);

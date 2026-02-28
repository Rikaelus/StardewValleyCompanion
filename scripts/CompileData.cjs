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
  bundles:        loadJson(path.join(SOURCE_DIR, 'collections/bundles.json')),
  villagers:      loadJson(path.join(SOURCE_DIR, 'reference/villagers.json')),
  machines:       loadJson(path.join(SOURCE_DIR, 'reference/machines.json')),
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
      // Multiple inputs produce same named item (Cheese, Goat Cheese)
      const basePrice = inputDetails[0].outputPrice;
      const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

      const compiledItem = {
        ...artisanBase,
        itemCategory: 'artisan',
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
          itemCategory: 'artisan',
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
            itemCategory: 'artisan',
            type: artisan.type,
            category: artisan.category,
            icon: artisan.icon,
            contextTags: artisan.contextTags,
            edibility: artisan.edibility,
            prices: qualityPrices,
            sellingLocations: artisan.sellingLocations,
            bundles: artisan.bundles,
            genericId: artisan.id,
            sources: artisan.sources.map(s => {
              if (s.type !== 'machine') return s;
              // For roe-input items (Aged Roe), the actual input is a roe variant,
              // not the fish itself. Remap inputId/inputName to the roe variant.
              const isRoeInput = s.inputType === 'roe';
              return {
                type: s.type,
                machine: s.machine,
                machineId: s.machineId,
                inputType: s.inputType,
                processingTimeMinutes: s.processingTimeMinutes,
                valueFormula: s.valueFormula,
                inputId: isRoeInput ? `${inputDetail.inputId}-roe` : inputDetail.inputId,
                inputName: isRoeInput ? `${inputDetail.inputName} Roe` : inputDetail.inputName,
                inputGameId: inputDetail.inputGameId,
                inputBasePrice: inputDetail.inputBasePrice,
                inputCategory: inputDetail.inputCategory,
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
            itemCategory: 'artisan',
            type: artisan.type,
            category: artisan.category,
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
          itemCategory: 'artisan',
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
      itemCategory: 'artisan',
      prices: qualityPrices,
    });
  }
});

console.log(`  ✓ Expanded artisan: ${sourceData.artisan.length} source → ${compiledArtisan.length} compiled`);

// ---------------------------------------------------------------------------
// Tag all other item types with itemCategory
// ---------------------------------------------------------------------------
console.log('\n🏷️  Tagging item categories...');

function tagItems(items, itemCategory, extraFields = {}) {
  const { gifts: _g, ...rest } = {}; // unused, just to show intent
  return items.map(item => {
    const { gifts, ...itemWithoutGifts } = item;
    return { ...itemWithoutGifts, ...extraFields, itemCategory };
  });
}

const taggedFish           = tagItems(sourceData.fish, 'fish');
const taggedCrops          = tagItems(sourceData.crops, 'crop');
const taggedForage         = tagItems(sourceData.forage, 'forage');
const taggedTreeFruits     = tagItems(sourceData.treeFruits, 'tree-fruit');
const taggedMinerals       = tagItems(sourceData.minerals, 'mineral');
const taggedMetalBars      = tagItems(sourceData.metalBars, 'metal-bar');
const taggedMonsterLoot    = tagItems(sourceData.monsterLoot, 'monster-loot');
const taggedResources      = tagItems(sourceData.resources, 'resource');
const taggedBigCraftables  = tagItems(sourceData.bigCraftables, 'big-craftable');
const taggedAnimalProducts = tagItems(sourceData.animalProducts, 'animal-product');
const taggedSeeds          = tagItems(sourceData.seeds, 'seed');
const taggedFurniture      = tagItems(sourceData.furniture, 'furniture');
const taggedHats           = tagItems(sourceData.hats, 'hat');

console.log(`  ✓ Tagged all item types`);

// ---------------------------------------------------------------------------
// Derive fish locations and seasons (from sources array)
// ---------------------------------------------------------------------------
console.log('\n🐟 Deriving fish locations/seasons...');
const ALL_SEASONS = ['spring', 'summer', 'fall', 'winter'];

taggedFish.forEach(fish => {
  const fishSources = (fish.sources || []).filter(s => s.type === 'fish');
  if (fishSources.length === 0) return;

  fish.locations = [...new Set(fishSources.map(s => s.location).filter(Boolean))].sort();

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

  item.locations = [...new Set(forageSources.flatMap(s => {
    // Location names may include river suffix; strip to base area name
    const loc = s.location || '';
    if (loc.endsWith(' River')) return [loc.replace(' River', '')];
    return [loc];
  }))].filter(Boolean).sort();

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
// Priority: crop > forage for itemCategory when merging
// ---------------------------------------------------------------------------
console.log('\n🔗 Merging cross-collection items...');

// CATEGORY_PRIORITY: lower number = higher priority (wins itemCategory in merge)
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
};

// All item arrays to merge
const allTypedItems = [
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
];

// Merge by friendly id: combine sources arrays, keep highest-priority itemCategory.
// This handles items that appear in multiple source files (e.g. grape is both crop and forage).
// Artisan variants intentionally share a gameId but have unique friendly ids, so they are NOT merged.
const mergedById = new Map();
let mergedDuplicates = 0;

for (const item of allTypedItems) {
  const key = item.id;

  if (!mergedById.has(key)) {
    mergedById.set(key, { ...item, sources: [...(item.sources || [])] });
  } else {
    const existing = mergedById.get(key);
    mergedDuplicates++;

    // Merge sources (avoid exact duplicates)
    const existingSrcJson = new Set((existing.sources || []).map(s => JSON.stringify(s)));
    for (const src of (item.sources || [])) {
      const srcJson = JSON.stringify(src);
      if (!existingSrcJson.has(srcJson)) {
        existing.sources.push(src);
        existingSrcJson.add(srcJson);
      }
    }

    // Merge bundles array
    if (item.bundles?.length) {
      const existingBundles = new Set(existing.bundles || []);
      for (const b of item.bundles) existingBundles.add(b);
      existing.bundles = [...existingBundles];
    }

    // Keep highest-priority itemCategory
    const existingPriority = CATEGORY_PRIORITY[existing.itemCategory] ?? 999;
    const incomingPriority = CATEGORY_PRIORITY[item.itemCategory] ?? 999;
    if (incomingPriority < existingPriority) {
      existing.itemCategory = item.itemCategory;
    }

    // Merge other fields from incoming item (fill in any gaps)
    for (const [field, val] of Object.entries(item)) {
      if (field === 'sources' || field === 'bundles' || field === 'itemCategory') continue;
      if (!(field in existing) && val !== undefined) {
        existing[field] = val;
      }
    }
  }
}

const allCompiledItems = [...mergedById.values()];
console.log(`  ✓ Merged ${mergedDuplicates} duplicate ids → ${allCompiledItems.length} unique items`);

// ---------------------------------------------------------------------------
// Post-merge: re-derive forage locations/seasons for cross-collection items
// (e.g. cactus-fruit is primarily a crop but also has forage sources)
// ---------------------------------------------------------------------------
console.log('\n🌿 Re-deriving forage locations for merged items...');

allCompiledItems.forEach(item => {
  const forageSources = (item.sources || []).filter(s => s.type === 'forage');
  if (forageSources.length === 0) return;

  item.locations = [...new Set(forageSources.flatMap(s => {
    const loc = s.location || '';
    if (loc.endsWith(' River')) return [loc.replace(' River', '')];
    return [loc];
  }))].filter(Boolean).sort();

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
// Normalize store IDs: ensure all storeId / sellingLocations values have
// the store- prefix. Source files may have bare IDs (e.g. "pierre") —
// this is the canonical enforcement point that makes compiled output correct
// regardless of source file state.
// ---------------------------------------------------------------------------
function normalizeStoreId(id) {
  if (!id || typeof id !== 'string') return id;
  return id.startsWith('store-') ? id : `store-${id}`;
}

console.log('\n🏪 Normalizing store IDs...');

for (const item of allCompiledItems) {
  // Normalize sellingLocations array
  if (Array.isArray(item.sellingLocations)) {
    item.sellingLocations = item.sellingLocations.map(normalizeStoreId);
  }
  // Normalize storeId in each shop source
  if (Array.isArray(item.sources)) {
    for (const src of item.sources) {
      if (src.type === 'shop' && src.storeId) {
        src.storeId = normalizeStoreId(src.storeId);
      }
    }
  }
}

console.log(`  ✓ Store IDs normalized`);

// ---------------------------------------------------------------------------
// Resolve crafting ingredient names
// Add name/icon/id to each ingredient in crafting sources so the modal can
// render them without a runtime lookup.
// ---------------------------------------------------------------------------
console.log('\n🔨 Resolving crafting ingredient names...');

// Build a gameId → item map for ingredient lookups.
// Crafting recipes reference Object IDs, so prefer non-furniture items on collision
// (furniture and objects share numeric gameId spaces independently in the game).
const itemsByGameId = new Map();
for (const item of allCompiledItems) {
  if (item.gameId === undefined || item.gameId === null) continue;
  const existing = itemsByGameId.get(item.gameId);
  // Only set if slot is empty, or if current entry is furniture (lower priority)
  if (!existing || existing.itemCategory === 'furniture') {
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
for (const item of allCompiledItems) {
  for (const src of (item.sources || [])) {
    if (src.type !== 'crafting' || !src.ingredients) continue;
    src.ingredientDetails = src.ingredients.map(ing => {
      const ingItem = itemsByGameId.get(ing.gameId);
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
console.log(`  ✓ Resolved ingredient details for ${resolvedIngredients} crafting sources`);

// ---------------------------------------------------------------------------
// Build unified gameIdIndex
// ---------------------------------------------------------------------------
const gameIdIndex = {};
for (const item of allCompiledItems) {
  if (item.gameId !== undefined && item.gameId !== null) {
    gameIdIndex[item.gameId] = item.id;
  }
}

// ---------------------------------------------------------------------------
// Load remaining reference data (bundles, villagers, stores, gifts)
// ---------------------------------------------------------------------------
console.log('\n📖 Loading reference data...');

const sellingLocationsData = loadJson(path.join(RULES_DIR, 'selling-locations.json'));

const giftsPath = path.join(SOURCE_DIR, 'relationships/gifts.json');
const giftsData = fs.existsSync(giftsPath) ? loadJson(giftsPath) : { relationships: [] };

console.log(`  ✓ Loaded stores (${Object.keys(sellingLocationsData.stores || {}).length} stores)`);
console.log(`  ✓ Loaded gifts (${giftsData.relationships?.length ?? 0} relationships)`);

// ---------------------------------------------------------------------------
// Write unified public/data/entities.json
// ---------------------------------------------------------------------------
console.log('\n📄 Writing unified entities.json...');

const entitiesData = {
  items: allCompiledItems,
  bundles: sourceData.bundles,
  villagers: sourceData.villagers,
  stores: Object.fromEntries(
    Object.entries(sellingLocationsData.stores).map(([k, v]) => [k, { ...v, entityType: 'store' }])
  ),
  machines: sourceData.machines.map(m => ({ ...m, entityType: 'machine' })),
  relationships: giftsData.relationships || [],
  gameIdIndex,
  meta: {
    compiled: new Date().toISOString(),
    totalItems: allCompiledItems.length,
    totalBundles: sourceData.bundles.length,
    totalVillagers: sourceData.villagers.length,
    totalStores: Object.keys(sellingLocationsData.stores || {}).length,
    totalMachines: sourceData.machines.length,
    totalRelationships: giftsData.relationships?.length ?? 0,
    mergedDuplicates,
  }
};

writeJson(path.join(OUTPUT_DIR, 'entities.json'), entitiesData);
console.log(`  ✓ Wrote entities.json (${allCompiledItems.length} items, ${sourceData.bundles.length} bundles, ${sourceData.villagers.length} villagers, ${sourceData.machines.length} machines)`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n📊 Compilation Summary:');
console.log('━'.repeat(50));

const typeCounts = {};
for (const item of allCompiledItems) {
  typeCounts[item.itemCategory] = (typeCounts[item.itemCategory] || 0) + 1;
}

for (const [type, count] of Object.entries(typeCounts).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${type.padEnd(18)} ${count}`);
}
console.log(`${'  TOTAL'.padEnd(20)} ${allCompiledItems.length}`);
console.log(`  artisan source items: ${sourceData.artisan.length} → ${compiledArtisan.length} expanded`);

const outputSize = JSON.stringify(entitiesData).length;
console.log(`\n💾 entities.json size: ${(outputSize / 1024).toFixed(1)} KB`);

console.log('\n✅ Data compilation complete!');
console.log(`\nCompiled files written to: ${OUTPUT_DIR}`);

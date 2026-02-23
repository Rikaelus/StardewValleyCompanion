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
} = require('./lib/compilationHelpers.cjs');

const SOURCE_DIR = path.join(__dirname, '../data/processed');
const RULES_DIR = path.join(__dirname, '../data/rules');
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
              return {
                type: s.type,
                machine: s.machine,
                machineId: s.machineId,
                inputType: s.inputType,
                processingTimeMinutes: s.processingTimeMinutes,
                valueFormula: s.valueFormula,
                inputId: inputDetail.inputId,
                inputName: inputDetail.inputName,
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
// Build unified gameIdIndex
// ---------------------------------------------------------------------------
const gameIdIndex = {};
for (const item of allCompiledItems) {
  if (item.gameId !== undefined && item.gameId !== null) {
    gameIdIndex[item.gameId] = item.id;
  }
}

// ---------------------------------------------------------------------------
// Write unified pages/items.json
// ---------------------------------------------------------------------------
console.log('\n📄 Writing unified items.json...');

const itemsPageData = {
  items: allCompiledItems,
  gameIdIndex,
  meta: {
    compiled: new Date().toISOString(),
    totalItems: allCompiledItems.length,
    mergedDuplicates,
  }
};

writeJson(path.join(OUTPUT_DIR, 'pages/items.json'), itemsPageData);
console.log(`  ✓ Wrote items.json (${allCompiledItems.length} items, ${mergedDuplicates} merged)`);

// ---------------------------------------------------------------------------
// Write collections/bundles.json (lean — just item ID references)
// ---------------------------------------------------------------------------
console.log('\n📦 Writing collections/bundles.json...');

writeJson(path.join(OUTPUT_DIR, 'collections/bundles.json'), {
  bundles: sourceData.bundles,
  meta: {
    compiled: new Date().toISOString(),
    totalBundles: sourceData.bundles.length
  }
});
console.log(`  ✓ Wrote bundles.json (${sourceData.bundles.length} bundles)`);

// ---------------------------------------------------------------------------
// Write reference files
// ---------------------------------------------------------------------------
console.log('\n👥 Writing reference data...');

writeJson(path.join(OUTPUT_DIR, 'reference/villagers.json'), {
  villagers: sourceData.villagers,
  meta: {
    compiled: new Date().toISOString(),
    totalVillagers: sourceData.villagers.length
  }
});
console.log(`  ✓ Wrote villagers.json (${sourceData.villagers.length} villagers)`);

// Copy selling-locations (stores) for frontend lookups
const sellingLocations = loadJson(path.join(RULES_DIR, 'selling-locations.json'));
writeJson(path.join(OUTPUT_DIR, 'reference/stores.json'), sellingLocations);
console.log(`  ✓ Wrote stores.json`);

// Copy relationships (gifts pivot table)
const giftsPath = path.join(SOURCE_DIR, 'relationships/gifts.json');
if (fs.existsSync(giftsPath)) {
  const gifts = loadJson(giftsPath);
  writeJson(path.join(OUTPUT_DIR, 'relationships/gifts.json'), gifts);
  console.log(`  ✓ Wrote gifts.json (${gifts.relationships?.length ?? '?'} relationships)`);
}

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

const outputSize = JSON.stringify(itemsPageData).length;
console.log(`\n💾 items.json size: ${(outputSize / 1024).toFixed(1)} KB`);

console.log('\n✅ Data compilation complete!');
console.log(`\nCompiled files written to: ${OUTPUT_DIR}`);

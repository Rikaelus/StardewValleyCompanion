#!/usr/bin/env node

/**
 * Compile source data into optimized page-specific JSON files
 * This is the build-time compilation system that pre-joins related data
 */

const fs = require('fs');
const path = require('path');
const {
  resolveBundleDetails,
  resolveGiftDetails,
  createGameIdIndex,
  compilePage,
  createItemLookupMaps,
  calculateQualityPrices
} = require('./lib/compilationHelpers.cjs');

const SOURCE_DIR = path.join(__dirname, '../data/processed');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

// Helper functions
function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

console.log('🔨 Starting data compilation...\n');

// Load all source data
console.log('📖 Loading source data...');
const sourceData = {
  fish: loadJson(path.join(SOURCE_DIR, 'items/fish.json')),
  artisan: loadJson(path.join(SOURCE_DIR, 'items/artisan.json')),
  crops: loadJson(path.join(SOURCE_DIR, 'items/crops.json')),
  forage: loadJson(path.join(SOURCE_DIR, 'items/forage.json')),
  fruitTrees: loadJson(path.join(SOURCE_DIR, 'items/fruit-trees.json')),
  treeFruits: loadJson(path.join(SOURCE_DIR, 'items/tree-fruits.json')),
  minerals: loadJson(path.join(SOURCE_DIR, 'items/minerals.json')),
  metalBars: loadJson(path.join(SOURCE_DIR, 'items/metal-bars.json')),
  monsterLoot: loadJson(path.join(SOURCE_DIR, 'items/monster-loot.json')),
  resources: loadJson(path.join(SOURCE_DIR, 'items/resources.json')),
  bigCraftables: loadJson(path.join(SOURCE_DIR, 'items/big-craftables.json')),
  bundles: loadJson(path.join(SOURCE_DIR, 'collections/bundles.json')),
  villagers: loadJson(path.join(SOURCE_DIR, 'reference/villagers.json'))
};

console.log(`  ✓ Loaded ${sourceData.fish.length} fish`);
console.log(`  ✓ Loaded ${sourceData.artisan.length} artisan goods`);
console.log(`  ✓ Loaded ${sourceData.crops.length} crops`);
console.log(`  ✓ Loaded ${sourceData.forage.length} foraged items`);
console.log(`  ✓ Loaded ${sourceData.fruitTrees.length} fruit trees`);
console.log(`  ✓ Loaded ${sourceData.treeFruits.length} tree fruits`);
console.log(`  ✓ Loaded ${sourceData.minerals.length} minerals`);
console.log(`  ✓ Loaded ${sourceData.metalBars.length} metal bars`);
console.log(`  ✓ Loaded ${sourceData.monsterLoot.length} monster loot`);
console.log(`  ✓ Loaded ${sourceData.resources.length} resources`);
console.log(`  ✓ Loaded ${sourceData.bigCraftables.length} big craftables`);
console.log(`  ✓ Loaded ${sourceData.bundles.length} bundles`);
console.log(`  ✓ Loaded ${sourceData.villagers.length} villagers`);

// Create lookup maps for fast joins
console.log('\n🗂️  Creating lookup maps...');
const lookupMaps = {
  fishById: new Map(sourceData.fish.map(f => [f.id, f])),
  fishByGameId: new Map(sourceData.fish.map(f => [f.gameId, f])),
  artisanById: new Map(sourceData.artisan.map(a => [a.id, a])),
  artisanByGameId: new Map(sourceData.artisan.map(a => [a.gameId, a])),
  cropsById: new Map(sourceData.crops.map(c => [c.id, c])),
  cropsByGameId: new Map(sourceData.crops.map(c => [c.gameId, c])),
  forageById: new Map(sourceData.forage.map(f => [f.id, f])),
  forageByGameId: new Map(sourceData.forage.map(f => [f.gameId, f])),
  fruitTreesById: new Map(sourceData.fruitTrees.map(f => [f.id, f])),
  fruitTreesByGameId: new Map(sourceData.fruitTrees.map(f => [f.gameId, f])),
  treeFruitsById: new Map(sourceData.treeFruits.map(f => [f.id, f])),
  treeFruitsByGameId: new Map(sourceData.treeFruits.map(f => [f.gameId, f])),
  mineralsById: new Map(sourceData.minerals.map(m => [m.id, m])),
  mineralsByGameId: new Map(sourceData.minerals.map(m => [m.gameId, m])),
  metalBarsById: new Map(sourceData.metalBars.map(m => [m.id, m])),
  metalBarsByGameId: new Map(sourceData.metalBars.map(m => [m.gameId, m])),
  monsterLootById: new Map(sourceData.monsterLoot.map(m => [m.id, m])),
  monsterLootByGameId: new Map(sourceData.monsterLoot.map(m => [m.gameId, m])),
  resourcesById: new Map(sourceData.resources.map(r => [r.id, r])),
  resourcesByGameId: new Map(sourceData.resources.map(r => [r.gameId, r])),
  bigCraftablesById: new Map(sourceData.bigCraftables.map(b => [b.id, b])),
  bigCraftablesByGameId: new Map(sourceData.bigCraftables.map(b => [b.gameId, b])),
  bundlesById: new Map(sourceData.bundles.map(b => [b.id, b])),
  villagersById: new Map(sourceData.villagers.map(v => [v.id, v]))
};

console.log(`  ✓ Created lookup maps`);

// Compile Fish Page
console.log('\n📄 Compiling fish page data...');

const fishPageData = compilePage(sourceData.fish, lookupMaps);

writeJson(path.join(OUTPUT_DIR, 'pages/fish.json'), fishPageData);
console.log(`  ✓ Compiled fish.json (${fishPageData.items.length} items, ${Object.keys(fishPageData.gameIdIndex).length} IDs indexed)`);

// Load rules quality multipliers
const RULES_DIR = path.join(__dirname, '../data/rules');
const qualityMultipliers = loadJson(path.join(RULES_DIR, 'quality-multipliers.json')).multipliers;
const artisanNaming = loadJson(path.join(RULES_DIR, 'artisan-naming.json')).patterns;

// Compile Artisan Page
console.log('\n🍷 Compiling artisan page data...');

const compiledArtisan = [];

sourceData.artisan.forEach(artisan => {
  // RELATIONAL: Keep only bundle IDs, not embedded objects
  // Remove gifts field (use gifts.json pivot table instead)

  // Check if this item has inputDetails (variations like Wine, Juice, etc.)
  if (artisan.producedBy?.inputDetails && artisan.producedBy.inputDetails.length > 0) {
    // Check naming pattern to determine if we should create separate items or one merged item
    const namingRule = artisanNaming[artisan.name];
    const shouldMergeInputs = artisan.producedBy.inputDetails.length > 1 &&
                               namingRule &&
                               namingRule.pattern === 'none';

    if (shouldMergeInputs) {
      // Multiple inputs produce the same item (e.g., Milk & Large Milk both make Cheese)
      // Create a single item with all inputDetails
      const basePrice = artisan.producedBy.inputDetails[0].outputPrice;
      const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

      const compiledItem = {
        id: artisan.id,
        gameId: artisan.gameId,
        name: artisan.name,
        type: 'artisan',
        category: artisan.category,
        icon: artisan.icon,
        contextTags: artisan.contextTags,
        edibility: artisan.edibility,
        prices: qualityPrices,
        sellingLocations: artisan.sellingLocations,
        producedBy: {
          machine: artisan.producedBy.machine,
          machineId: artisan.producedBy.machineId,
          inputType: artisan.producedBy.inputType,
          inputDetails: artisan.producedBy.inputDetails,
          valueFormula: artisan.producedBy.valueFormula
        },
        bundles: artisan.bundles
      };

      // Copy processing time if present
      if (artisan.processingTimeMinutes) {
        compiledItem.processingTimeMinutes = artisan.processingTimeMinutes;
      } else if (artisan.producedBy.processingTimeMinutes) {
        compiledItem.processingTimeMinutes = artisan.producedBy.processingTimeMinutes;
      }

      // Copy canBeAged flag and aging time if present
      if (artisan.canBeAged) {
        compiledItem.canBeAged = true;
        if (artisan.agingDaysToIridium) {
          compiledItem.agingDaysToIridium = artisan.agingDaysToIridium;
        }
      }

      compiledArtisan.push(compiledItem);
    } else {
      // Expand into individual variations (e.g., "Ancient Fruit Wine", "Starfruit Wine")
      // Also create a generic item if there are multiple inputs with naming
      const isExpandable = artisan.producedBy.inputDetails.length > 1;
      const genericItem = isExpandable ? {
        id: artisan.id,
        gameId: artisan.gameId,
        name: artisan.name,
        type: 'artisan',
        isGeneric: true,
        category: artisan.category,
        icon: artisan.icon,
        contextTags: artisan.contextTags,
        edibility: artisan.edibility,
        sellingLocations: artisan.sellingLocations,
        producedBy: {
          machine: artisan.producedBy.machine,
          machineId: artisan.producedBy.machineId,
          inputType: artisan.producedBy.inputType,
          valueFormula: artisan.producedBy.valueFormula,
        },
        canBeAged: artisan.canBeAged || false,
        agingDaysToIridium: artisan.agingDaysToIridium,
        bundles: artisan.bundles,
        variations: []
      } : null;

      // Copy processing time to generic if present
      if (genericItem) {
        if (artisan.processingTimeMinutes) {
          genericItem.processingTimeMinutes = artisan.processingTimeMinutes;
        } else if (artisan.producedBy.processingTimeMinutes) {
          genericItem.processingTimeMinutes = artisan.producedBy.processingTimeMinutes;
        }
      }

      artisan.producedBy.inputDetails.forEach(inputDetail => {
        // For items with only one input, keep the original name
        // For items with multiple inputs, use naming rules
        let variantName;
        if (artisan.producedBy.inputDetails.length === 1) {
          variantName = artisan.name;
        } else {
          // Apply naming pattern from rules
          if (namingRule && namingRule.pattern === 'prefix') {
            // Use the format string from rules (e.g., "Dried {input}")
            variantName = namingRule.format.replace('{input}', inputDetail.inputName);
          } else {
            // Default suffix pattern: "{input} {product}"
            variantName = `${inputDetail.inputName} ${artisan.name}`;
          }
        }

        const variantId = artisan.producedBy.inputDetails.length === 1
          ? artisan.id
          : `${inputDetail.inputId}-${artisan.id}`;

        // Use the specific output price for this variation
        const basePrice = inputDetail.outputPrice;
        const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

        const compiledItem = {
          id: variantId,
          gameId: artisan.gameId, // All variations share the same gameId
          name: variantName,
          type: 'artisan',
          category: artisan.category,
          icon: artisan.icon,
          contextTags: artisan.contextTags,
          edibility: artisan.edibility,
          prices: qualityPrices,
          sellingLocations: artisan.sellingLocations,
          producedBy: {
            machine: artisan.producedBy.machine,
            machineId: artisan.producedBy.machineId,
            inputType: artisan.producedBy.inputType,
            inputId: inputDetail.inputId,
            inputName: inputDetail.inputName,
            inputGameId: inputDetail.inputGameId,
            inputBasePrice: inputDetail.inputBasePrice,
            inputCategory: inputDetail.inputCategory
          },
          bundles: artisan.bundles
        };

        // Copy processing time if present (check top level first, then producedBy)
        if (artisan.processingTimeMinutes) {
          compiledItem.processingTimeMinutes = artisan.processingTimeMinutes;
        } else if (artisan.producedBy.processingTimeMinutes) {
          compiledItem.processingTimeMinutes = artisan.producedBy.processingTimeMinutes;
        }

        // Copy canBeAged flag and aging time if present
        if (artisan.canBeAged) {
          compiledItem.canBeAged = true;
          if (artisan.agingDaysToIridium) {
            compiledItem.agingDaysToIridium = artisan.agingDaysToIridium;
          }
        }

        // Add genericId backlink and track variation in generic
        if (genericItem) {
          compiledItem.genericId = artisan.id;
          genericItem.variations.push(variantId);
        }

        compiledArtisan.push(compiledItem);
      });

      // Add Wild variant if requested (for Honey without flowers)
      if (artisan.includeWildVariant) {
        const wildVariant = {
          id: `wild-${artisan.id}`,
          gameId: artisan.gameId,
          name: `Wild ${artisan.name}`,
          type: 'artisan',
          category: artisan.category,
          icon: artisan.icon,
          contextTags: artisan.contextTags,
          edibility: artisan.edibility,
          prices: calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality, qualityMultipliers),
          sellingLocations: artisan.sellingLocations,
          producedBy: {
            machine: artisan.producedBy.machine,
            machineId: artisan.producedBy.machineId,
            processingTimeMinutes: artisan.producedBy.processingTimeMinutes
          },
          bundles: artisan.bundles
        };

        // Copy processing time minutes if present
        if (artisan.producedBy.processingTimeMinutes) {
          wildVariant.producedBy.processingTimeMinutes = artisan.producedBy.processingTimeMinutes;
        }

        // Add genericId backlink and track in generic
        if (genericItem) {
          wildVariant.genericId = artisan.id;
          genericItem.variations.push(wildVariant.id);
        }

        compiledArtisan.push(wildVariant);
      }

      // Push the generic item after all its variations
      if (genericItem) {
        compiledArtisan.push(genericItem);
      }
    }
  } else {
    const qualityPrices = calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality, qualityMultipliers);

    compiledArtisan.push({
      ...artisan,
      type: 'artisan',
      prices: qualityPrices,
      bundles: artisan.bundles
    });
  }
});

// Create gameId index for O(1) save file lookups
const artisanGameIdIndex = Object.fromEntries(
  sourceData.artisan.map(a => [a.gameId, a.id])
);

const artisanPageData = {
  items: compiledArtisan,
  gameIdIndex: artisanGameIdIndex,
  meta: {
    compiled: new Date().toISOString(),
    totalItems: compiledArtisan.length,
    sourceItems: sourceData.artisan.length,
    expandedItems: compiledArtisan.length - sourceData.artisan.length
  }
};

writeJson(path.join(OUTPUT_DIR, 'pages/artisan.json'), artisanPageData);
console.log(`  ✓ Compiled artisan.json (${compiledArtisan.length} items from ${sourceData.artisan.length} source items, ${Object.keys(artisanGameIdIndex).length} IDs indexed)`);

// Compile Crops Page
console.log('\n🌾 Compiling crops page data...');
const cropsPageData = compilePage(sourceData.crops, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/crops.json'), cropsPageData);
console.log(`  ✓ Compiled crops.json (${cropsPageData.items.length} items, ${Object.keys(cropsPageData.gameIdIndex).length} IDs indexed)`);

// Compile Forage Page
console.log('\n🌿 Compiling forage page data...');
const foragePageData = compilePage(sourceData.forage, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/forage.json'), foragePageData);
console.log(`  ✓ Compiled forage.json (${foragePageData.items.length} items, ${Object.keys(foragePageData.gameIdIndex).length} IDs indexed)`);

// Compile Tree Fruits Page
console.log('\n🍎 Compiling tree fruits page data...');
const treeFruitsPageData = compilePage(sourceData.treeFruits, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/tree-fruits.json'), treeFruitsPageData);
console.log(`  ✓ Compiled tree-fruits.json (${treeFruitsPageData.items.length} items, ${Object.keys(treeFruitsPageData.gameIdIndex).length} IDs indexed)`);

// Compile Minerals Page
console.log('\n💎 Compiling minerals page data...');
const mineralsPageData = compilePage(sourceData.minerals, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/minerals.json'), mineralsPageData);
console.log(`  ✓ Compiled minerals.json (${mineralsPageData.items.length} items, ${Object.keys(mineralsPageData.gameIdIndex).length} IDs indexed)`);

// Compile Metal Bars Page
console.log('\n⚒️  Compiling metal bars page data...');
const metalBarsPageData = compilePage(sourceData.metalBars, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/metal-bars.json'), metalBarsPageData);
console.log(`  ✓ Compiled metal-bars.json (${metalBarsPageData.items.length} items, ${Object.keys(metalBarsPageData.gameIdIndex).length} IDs indexed)`);

// Compile Monster Loot Page
console.log('\n👹 Compiling monster loot page data...');
const monsterLootPageData = compilePage(sourceData.monsterLoot, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/monster-loot.json'), monsterLootPageData);
console.log(`  ✓ Compiled monster-loot.json (${monsterLootPageData.items.length} items, ${Object.keys(monsterLootPageData.gameIdIndex).length} IDs indexed)`);

// Compile Resources Page
console.log('\n📦 Compiling resources page data...');
const resourcesPageData = compilePage(sourceData.resources, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/resources.json'), resourcesPageData);
console.log(`  ✓ Compiled resources.json (${resourcesPageData.items.length} items, ${Object.keys(resourcesPageData.gameIdIndex).length} IDs indexed)`);

// Compile Big Craftables Page
console.log('\n🔧 Compiling big craftables page data...');
const bigCraftablesPageData = compilePage(sourceData.bigCraftables, lookupMaps);
writeJson(path.join(OUTPUT_DIR, 'pages/big-craftables.json'), bigCraftablesPageData);
console.log(`  ✓ Compiled big-craftables.json (${bigCraftablesPageData.items.length} items, ${Object.keys(bigCraftablesPageData.gameIdIndex).length} IDs indexed)`);

// Compile Bundles Page
console.log('\n📦 Compiling bundles page data...');

const compiledBundles = sourceData.bundles.map(bundle => {
  // Resolve item references to full item objects
  const itemsWithDetails = bundle.items.map(item => {
    // Try to find in all item types
    const itemTypes = [
      { map: lookupMaps.fishByGameId, type: 'fish' },
      { map: lookupMaps.artisanByGameId, type: 'artisan' },
      { map: lookupMaps.cropsByGameId, type: 'crop' },
      { map: lookupMaps.forageByGameId, type: 'forage' },
      { map: lookupMaps.fruitTreesByGameId, type: 'fruit-tree' },
      { map: lookupMaps.treeFruitsByGameId, type: 'tree-fruit' },
      { map: lookupMaps.mineralsByGameId, type: 'mineral' },
      { map: lookupMaps.metalBarsByGameId, type: 'metal-bar' },
      { map: lookupMaps.monsterLootByGameId, type: 'monster-loot' },
      { map: lookupMaps.resourcesByGameId, type: 'resource' },
      { map: lookupMaps.bigCraftablesByGameId, type: 'big-craftable' }
    ];

    let sourceItem = null;
    let itemType = null;

    for (const { map, type } of itemTypes) {
      sourceItem = map.get(item.gameId);
      if (sourceItem) {
        itemType = type;
        break;
      }
    }

    // If not found in any data source
    if (!sourceItem) {
      // Skip warning for common non-tracked items (stone, weeds, etc)
      if (item.gameId !== 0 && item.gameId !== 2 && item.gameId !== 10) {
        console.warn(`  ⚠️  Warning: Item ${item.gameId} not found in any item data`);
      }
      return {
        ...item,
        name: item.id,
        icon: null,
        notFound: true
      };
    }

    // Return item with bundle-specific quantity and quality
    return {
      ...sourceItem,
      quantity: item.quantity,
      quality: item.quality
    }
  });

  return {
    ...bundle,
    items: itemsWithDetails
  };
});

const bundlesPageData = {
  bundles: compiledBundles,
  meta: {
    compiled: new Date().toISOString(),
    totalBundles: compiledBundles.length,
    totalItems: compiledBundles.reduce((sum, b) => sum + b.items.length, 0)
  }
};

writeJson(path.join(OUTPUT_DIR, 'pages/bundles.json'), bundlesPageData);
console.log(`  ✓ Compiled bundles.json (${compiledBundles.length} bundles)`);

// Copy Reference Data (villagers, stores, bundles are small and shared)
console.log('\n👥 Copying reference data...');

writeJson(path.join(OUTPUT_DIR, 'reference/villagers.json'), {
  villagers: sourceData.villagers,
  meta: {
    compiled: new Date().toISOString(),
    totalVillagers: sourceData.villagers.length
  }
});
console.log(`  ✓ Copied villagers.json (${sourceData.villagers.length} villagers)`);

// Copy selling-locations (stores) for frontend lookups
const sellingLocations = loadJson(path.join(RULES_DIR, 'selling-locations.json'));
writeJson(path.join(OUTPUT_DIR, 'reference/stores.json'), sellingLocations);
console.log(`  ✓ Copied stores.json`);

// Copy bundles for frontend lookups
writeJson(path.join(OUTPUT_DIR, 'collections/bundles.json'), {
  bundles: sourceData.bundles,
  meta: {
    compiled: new Date().toISOString(),
    totalBundles: sourceData.bundles.length
  }
});
console.log(`  ✓ Copied bundles.json (${sourceData.bundles.length} bundles)`);

// Copy relationships (gifts pivot table)
const gifts = loadJson(path.join(SOURCE_DIR, 'relationships/gifts.json'));
writeJson(path.join(OUTPUT_DIR, 'relationships/gifts.json'), gifts);
console.log(`  ✓ Copied gifts.json (${gifts.relationships.length} relationships)`);

// Generate compilation report
console.log('\n📊 Compilation Summary:');
console.log('━'.repeat(50));

const stats = {
  sourceFiles: 5,
  compiledPages: 3,
  referenceFiles: 1,
  totalFish: fishPageData.items.length,
  totalArtisan: compiledArtisan.length,
  totalCrops: sourceData.crops.length,
  totalBundles: bundlesPageData.bundles.length,
  totalVillagers: sourceData.villagers.length,
  artisanExpansion: compiledArtisan.length - sourceData.artisan.length
};

console.log(`  Source files read:     ${stats.sourceFiles}`);
console.log(`  Pages compiled:        ${stats.compiledPages}`);
console.log(`  Reference files:       ${stats.referenceFiles}`);
console.log(`  Total fish items:      ${stats.totalFish}`);
console.log(`  Total artisan items:   ${stats.totalArtisan} (${sourceData.artisan.length} source → ${stats.artisanExpansion} expanded)`);
console.log(`  Total crops:           ${stats.totalCrops}`);
console.log(`  Total bundles:         ${stats.totalBundles}`);
console.log(`  Total villagers:       ${stats.totalVillagers}`);

// Calculate file sizes
const fishPageSize = JSON.stringify(fishPageData).length;
const artisanPageSize = JSON.stringify(artisanPageData).length;
const bundlesPageSize = JSON.stringify(bundlesPageData).length;

console.log(`\n💾 Output file sizes:`);
console.log(`  fish.json:             ${(fishPageSize / 1024).toFixed(2)} KB`);
console.log(`  artisan.json:          ${(artisanPageSize / 1024).toFixed(2)} KB`);
console.log(`  bundles.json:          ${(bundlesPageSize / 1024).toFixed(2)} KB`);

console.log('\n✅ Data compilation complete!');
console.log(`\nCompiled files written to: ${OUTPUT_DIR}`);

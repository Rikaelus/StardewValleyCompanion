#!/usr/bin/env node

/**
 * Compile source data into optimized page-specific JSON files
 * This is the build-time compilation system that pre-joins related data
 */

const fs = require('fs');
const path = require('path');

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
  bundles: loadJson(path.join(SOURCE_DIR, 'collections/bundles.json')),
  villagers: loadJson(path.join(SOURCE_DIR, 'reference/villagers.json'))
};

console.log(`  ✓ Loaded ${sourceData.fish.length} fish`);
console.log(`  ✓ Loaded ${sourceData.artisan.length} artisan goods`);
console.log(`  ✓ Loaded ${sourceData.crops.length} crops`);
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
  bundlesById: new Map(sourceData.bundles.map(b => [b.id, b])),
  villagersById: new Map(sourceData.villagers.map(v => [v.id, v]))
};

console.log(`  ✓ Created lookup maps`);

// Compile Fish Page
console.log('\n📄 Compiling fish page data...');

const compiledFish = sourceData.fish.map(fish => {
  // Resolve bundle references to full bundle objects
  const bundleDetails = fish.bundles
    .map(bundleId => lookupMaps.bundlesById.get(bundleId))
    .filter(Boolean); // Remove any undefined bundles

  // Resolve gift references to full villager objects (exclude neutral - not useful for display)
  const giftDetails = Object.entries(fish.gifts || {}).map(([villagerId, preference]) => {
    if (preference === 'neutral') return null; // Don't include neutral in UI
    const villager = lookupMaps.villagersById.get(villagerId);
    return villager ? {
      villager: villager,
      preference: preference
    } : null;
  }).filter(Boolean);

  return {
    ...fish,
    bundleDetails,
    giftDetails
  };
});

// Create gameId index for O(1) save file lookups
const fishGameIdIndex = Object.fromEntries(
  sourceData.fish.map(f => [f.gameId, f.id])
);

const fishPageData = {
  items: compiledFish,
  gameIdIndex: fishGameIdIndex,
  meta: {
    compiled: new Date().toISOString(),
    totalItems: compiledFish.length
  }
};

writeJson(path.join(OUTPUT_DIR, 'pages/fish.json'), fishPageData);
console.log(`  ✓ Compiled fish.json (${compiledFish.length} items, ${Object.keys(fishGameIdIndex).length} IDs indexed)`);

// Load rules quality multipliers
const RULES_DIR = path.join(__dirname, '../data/rules');
const qualityMultipliers = loadJson(path.join(RULES_DIR, 'quality-multipliers.json')).multipliers;
const artisanNaming = loadJson(path.join(RULES_DIR, 'artisan-naming.json')).patterns;

// Compile Artisan Page
console.log('\n🍷 Compiling artisan page data...');

// Helper function to calculate quality prices
// Uses quality multipliers from rules data
// Only include quality tiers if the item can actually achieve them (via aging or natural quality)
function calculateQualityPrices(basePrice, canBeAged, hasQuality) {
  const prices = {
    regular: Math.floor(basePrice * qualityMultipliers.regular)
  };

  // Add quality tiers for items that can be aged OR have natural quality (animal products)
  if (canBeAged || hasQuality) {
    prices.silver = Math.floor(basePrice * qualityMultipliers.silver);
    prices.gold = Math.floor(basePrice * qualityMultipliers.gold);
    prices.iridium = Math.floor(basePrice * qualityMultipliers.iridium);
  }

  return prices;
}

const compiledArtisan = [];

sourceData.artisan.forEach(artisan => {
  // Resolve bundle references to full bundle objects
  const bundleDetails = artisan.bundles
    .map(bundleId => lookupMaps.bundlesById.get(bundleId))
    .filter(Boolean);

  // Resolve gift references to full villager objects (exclude neutral - not useful for display)
  const giftDetails = Object.entries(artisan.gifts || {}).map(([villagerId, preference]) => {
    if (preference === 'neutral') return null; // Don't include neutral in UI
    const villager = lookupMaps.villagersById.get(villagerId);
    return villager ? {
      villager: villager,
      preference: preference
    } : null;
  }).filter(Boolean);

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
      const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality);

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
        producedBy: {
          machine: artisan.producedBy.machine,
          machineId: artisan.producedBy.machineId,
          inputType: artisan.producedBy.inputType,
          inputDetails: artisan.producedBy.inputDetails,
          valueFormula: artisan.producedBy.valueFormula
        },
        bundleDetails,
        giftDetails
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
        const qualityPrices = calculateQualityPrices(basePrice, artisan.canBeAged, artisan.hasQuality);

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
          producedBy: {
            machine: artisan.producedBy.machine,
            machineId: artisan.producedBy.machineId,
            inputType: artisan.producedBy.inputType,
            inputId: inputDetail.inputId,
            inputName: inputDetail.inputName,
            inputGameId: inputDetail.inputGameId,
            inputBasePrice: inputDetail.inputBasePrice
          },
          bundleDetails,
          giftDetails
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

        compiledArtisan.push(compiledItem);
      });
    }

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
        prices: calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality),
        producedBy: {
          machine: artisan.producedBy.machine,
          machineId: artisan.producedBy.machineId,
          processingTimeMinutes: artisan.producedBy.processingTimeMinutes
        },
        bundleDetails,
        giftDetails
      };

      // Copy processing time minutes if present
      if (artisan.producedBy.processingTimeMinutes) {
        wildVariant.producedBy.processingTimeMinutes = artisan.producedBy.processingTimeMinutes;
      }

      compiledArtisan.push(wildVariant);
    }
  } else {
    // No variations - keep as-is (but skip templates with empty inputDetails)
    const isTemplate = artisan.producedBy?.inputDetails && artisan.producedBy.inputDetails.length === 0;

    if (!isTemplate) {
      const qualityPrices = calculateQualityPrices(artisan.price, artisan.canBeAged, artisan.hasQuality);

      compiledArtisan.push({
        ...artisan,
        type: 'artisan',
        prices: qualityPrices,
        bundleDetails,
        giftDetails
      });
    }
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

// Compile Bundles Page
console.log('\n📦 Compiling bundles page data...');

const compiledBundles = sourceData.bundles.map(bundle => {
  // Resolve item references to full item objects
  const itemsWithDetails = bundle.items.map(item => {
    // Try to find in fish first
    let sourceItem = lookupMaps.fishByGameId.get(item.gameId);
    let itemType = 'fish';

    // If not fish, try artisan
    if (!sourceItem) {
      sourceItem = lookupMaps.artisanByGameId.get(item.gameId);
      itemType = 'artisan';
    }

    // If not artisan, try crops
    if (!sourceItem) {
      sourceItem = lookupMaps.cropsByGameId.get(item.gameId);
      itemType = 'crop';
    }

    // If not found in any data source
    if (!sourceItem) {
      // Skip warning for common non-tracked items (stone, weeds, etc)
      if (item.gameId !== 0 && item.gameId !== 2 && item.gameId !== 10) {
        console.warn(`  ⚠️  Warning: Item ${item.gameId} not found in fish, artisan, or crop data`);
      }
      return {
        ...item,
        name: item.id,
        icon: null,
        notFound: true
      };
    }

    // Return different fields based on item type
    if (itemType === 'fish') {
      return {
        id: sourceItem.id,
        gameId: sourceItem.gameId,
        name: sourceItem.name,
        icon: sourceItem.icon,
        type: 'fish',
        difficulty: sourceItem.difficulty,
        seasons: sourceItem.seasons,
        times: sourceItem.times,
        location: sourceItem.location,
        weather: sourceItem.weather,
        price: sourceItem.price,
        quantity: item.quantity,
        quality: item.quality
      };
    } else if (itemType === 'artisan') {
      return {
        id: sourceItem.id,
        gameId: sourceItem.gameId,
        name: sourceItem.name,
        icon: sourceItem.icon,
        type: 'artisan',
        category: sourceItem.category,
        price: sourceItem.price,
        producedBy: sourceItem.producedBy,
        quantity: item.quantity,
        quality: item.quality
      };
    } else {
      // crop
      return {
        id: sourceItem.id,
        gameId: sourceItem.gameId,
        name: sourceItem.name,
        icon: `assets/crops/${sourceItem.name.replace(/\s+/g, '_')}.png`,
        type: 'crop',
        cropType: sourceItem.type,
        price: sourceItem.price,
        quantity: item.quantity,
        quality: item.quality
      };
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

// Copy Reference Data (villagers are small and shared)
console.log('\n👥 Copying reference data...');

writeJson(path.join(OUTPUT_DIR, 'reference/villagers.json'), {
  villagers: sourceData.villagers,
  meta: {
    compiled: new Date().toISOString(),
    totalVillagers: sourceData.villagers.length
  }
});
console.log(`  ✓ Copied villagers.json (${sourceData.villagers.length} villagers)`);

// Generate compilation report
console.log('\n📊 Compilation Summary:');
console.log('━'.repeat(50));

const stats = {
  sourceFiles: 5,
  compiledPages: 3,
  referenceFiles: 1,
  totalFish: compiledFish.length,
  totalArtisan: compiledArtisan.length,
  totalCrops: sourceData.crops.length,
  totalBundles: compiledBundles.length,
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

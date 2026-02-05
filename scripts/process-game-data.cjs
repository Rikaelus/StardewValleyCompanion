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

// Helper function to create kebab-case IDs from names
function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to load JSON files
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
};

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

  const cropEntry = {
    id: toKebabCase(cropName),
    gameId: parseInt(harvestId),
    name: cropName,
    seedId: parseInt(seedId),
    type: cropType,
    category: category,
    price: harvestObject.Price || 0,
    edibility: harvestObject.Edibility || -300
  };

  cropData.push(cropEntry);
  cropsByHarvestId.set(parseInt(harvestId), cropEntry);
}

console.log(`  Processed ${cropData.length} crops`);
console.log(`    Fruits: ${cropData.filter(c => c.type === 'fruit').length}`);
console.log(`    Vegetables: ${cropData.filter(c => c.type === 'vegetable').length}`);
console.log(`    Flowers: ${cropData.filter(c => c.type === 'flower').length}`);

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
  if (numericMatch) return parseInt(numericMatch[1]);

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
    const formula = rules.priceFormulas[recipe.outputName] || { multiplier: 1, addition: 0 };

    // Find matching items by tag
    let matchingItems = [];
    if (recipe.requiredTags.includes('category_fruits') || recipe.requiredTags.includes('keg_wine') || recipe.requiredTags.includes('preserves_jelly')) {
      matchingItems = cropData.filter(c => c.type === 'fruit');
    } else if (recipe.requiredTags.includes('category_vegetable') || recipe.requiredTags.includes('category_greens') || recipe.requiredTags.includes('keg_juice') || recipe.requiredTags.includes('preserves_pickle')) {
      matchingItems = cropData.filter(c => c.type === 'vegetable');
    } else if (recipe.requiredTags.includes('category_flowers')) {
      matchingItems = cropData.filter(c => c.type === 'flower');
    } else if (recipe.requiredTags.includes('edible_mushroom')) {
      // Find mushrooms from Objects.json
      matchingItems = Object.entries(gameData.objects)
        .filter(([id, obj]) => obj.ContextTags?.includes('edible_mushroom'))
        .map(([id, obj]) => ({
          id: toKebabCase(obj.Name),
          gameId: isNaN(id) ? id : parseInt(id),
          name: obj.Name,
          type: 'mushroom',
          price: obj.Price || 0
        }));
    } else if (recipe.requiredTags.includes('category_fish')) {
      // Note: Fish data is processed later, so we'll leave inputs empty for now
      // This could be improved by reordering processing or doing a second pass
      matchingItems = [];
    }

    const inputDetails = matchingItems.map(item => ({
      inputId: item.id,
      inputName: item.name,
      inputGameId: item.gameId,
      inputBasePrice: item.price,
      outputPrice: Math.floor(item.price * formula.multiplier + formula.addition),
      outputIridiumPrice: Math.floor((item.price * formula.multiplier + formula.addition) * 1.4)
    })).sort((a, b) => b.outputPrice - a.outputPrice);

    const displayName = flavoredDisplayNames[recipe.outputName] || recipe.outputName;

    const artisanItem = {
      type: 'artisan',
      id: toKebabCase(recipe.outputName),
      gameId: outputItemId,
      name: displayName,
      category: 'Artisan Goods',
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/artisan/${recipe.outputName.replace(/\s+/g, '_')}.png`,
      contextTags: objectData.ContextTags || [],
      producedBy: {
        machine: recipe.machine,
        machineId: recipe.machineId,
        inputType: recipe.requiredTags.includes('category_fruits') || recipe.requiredTags.includes('keg_wine') || recipe.requiredTags.includes('preserves_jelly') ? 'fruit' : 'vegetable',
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
        outputPrice: objectData.Price || 0,
        outputIridiumPrice: Math.floor((objectData.Price || 0) * 1.4)
      };
    }).filter(Boolean);

    const artisanItem = {
      type: 'artisan',
      id: toKebabCase(objectData.Name),
      gameId: outputItemId,
      name: objectData.Name,
      category: 'Artisan Goods',
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/artisan/${objectData.Name.replace(/\s+/g, '_')}.png`,
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
  const itemId = isNaN(itemIdString) ? itemIdString : parseInt(itemIdString);

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
    id: toKebabCase(objectData.Name),
    gameId: itemId,
    name: objectData.Name,
    category: 'Artisan Goods',
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/artisan/${objectData.Name.replace(/\s+/g, '_')}.png`,
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
      category: 'Artisan Goods',
      price: objectData.Price || 0,
      edibility: objectData.Edibility || -300,
      icon: `assets/artisan/${rule.name.replace(/\s+/g, '_')}.png`,
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
          inputGameId: parseInt(inputId),
          inputBasePrice: inputBasePrice,
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
    category: 'Artisan Goods',
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    icon: `assets/artisan/${rule.name.replace(/\s+/g, '_')}.png`,
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

  // Game IDs can be numeric (legacy) or string (1.6+ qualified IDs)
  // Numeric: "136", String: "Goby"
  const gameIdValue = isNaN(gameId) ? gameId : parseInt(gameId);

  // Get additional data from Objects.json
  const objectData = gameData.objects[gameId];

  if (!objectData) {
    console.warn(`  Warning: Fish ${gameId} (${fishName}) not found in Objects.json`);
    continue;
  }

  const friendlyId = toKebabCase(fishName);

  // Generate icon path - replace spaces with underscores to match file naming
  const iconFileName = fishName.replace(/\s+/g, '_') + '.png';

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
    gameId: gameIdValue, // Can be number or string
    name: fishName,
    icon: `assets/fish/${iconFileName}`,
    difficulty: parseInt(parts[1]) || 0,
    behaviorType: parts[2] || 'mixed',
    minSize: parseInt(parts[3]) || 0,
    maxSize: parseInt(parts[4]) || 0,
    times: timeRanges,
    seasons: parts[6] ? parts[6].split(' ') : [],
    weather: parts[7] || 'both',
    isTrapFish: parts[parts.length - 1] === 'false' ? false : parts[12] === 'trap',
    price: objectData.Price || 0,
    edibility: objectData.Edibility || -300,
    category: objectData.Category || 0,
    bundles: [], // Will be populated when processing bundles
    gifts: {} // Will be populated when processing gift tastes
  });
}

console.log(`  Processed ${fishData.length} fish`);

// Extract and merge location data
console.log('\nExtracting fish locations...');
const { extractFishLocations } = require('./extract-fish-locations.cjs');
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
const { generateSpecialCases } = require('./generate-special-cases.cjs');
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
// Add Roe as flavored artisan item (using fish data)
// ============================================================================
console.log('\nAdding Roe variants...');

// Filter fish that can produce roe (have fish_has_roe tag in Objects.json)
// As of 1.6.9, legendary fish CAN be put in fish ponds
const fishWithRoe = fishData.filter(fish => {
  const objectData = gameData.objects[fish.gameId];
  return objectData?.ContextTags?.includes('fish_has_roe');
});

// Calculate roe values for each fish: (fish price / 2) + 30
const roeInputDetails = fishWithRoe.map(fish => ({
  inputId: fish.id,
  inputName: fish.name,
  inputGameId: fish.gameId,
  inputBasePrice: fish.price,
  outputPrice: Math.floor((fish.price / 2) + 30),
  outputIridiumPrice: Math.floor(((fish.price / 2) + 30) * 1.4) // With Artisan profession
})).sort((a, b) => b.outputPrice - a.outputPrice);

const roeObjectData = gameData.objects['812'];

const roeItem = {
  id: 'roe',
  gameId: 812,
  name: 'Roe',
  category: 'Artisan Goods',
  price: roeObjectData?.Price || 30,
  edibility: roeObjectData?.Edibility || 20,
  icon: 'assets/artisan/Roe.png',
  contextTags: roeObjectData?.ContextTags || [],
  producedBy: {
    machine: 'Fish Pond',
    machineId: 'fish-pond',
    inputType: 'fish',
    processingTimeMinutes: 5760, // Fish ponds produce every 4 days typically
    valueFormula: '(fishPrice / 2) + 30',
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
// Aged Roe value = Roe value * 2
const fishWithAgedRoe = fishWithRoe.filter(fish => fish.gameId !== 698); // Exclude Sturgeon (becomes Caviar)

const agedRoeInputDetails = fishWithAgedRoe.map(fish => {
  const roePrice = Math.floor((fish.price / 2) + 30);
  const agedRoePrice = roePrice * 2;

  return {
    inputId: fish.id,
    inputName: fish.name,
    inputGameId: fish.gameId,
    inputBasePrice: roePrice, // Input is the roe price
    outputPrice: agedRoePrice,
    outputIridiumPrice: Math.floor(agedRoePrice * 1.4) // With Artisan profession
  };
}).sort((a, b) => b.outputPrice - a.outputPrice);

const agedRoeObjectData = gameData.objects['447'];

const agedRoeItem = {
  id: 'aged-roe',
  gameId: 447,
  name: 'Aged Roe',
  category: 'Artisan Goods',
  price: agedRoeObjectData?.Price || 100,
  edibility: agedRoeObjectData?.Edibility || 40,
  icon: 'assets/artisan/AgedRoe.png',
  contextTags: agedRoeObjectData?.ContextTags || [],
  producedBy: {
    machine: 'Preserves Jar',
    machineId: 'preserves-jar',
    inputType: 'roe',
    processingTimeMinutes: 4000, // 4000 minutes from Machines.json
    valueFormula: 'roePrice * 2',
    inputDetails: agedRoeInputDetails
  },
  bundles: [],
  gifts: {}
};

artisanData.push(agedRoeItem);
console.log(`  ✅ Added Aged Roe with ${fishWithAgedRoe.length} fish variants (excludes Sturgeon)`);

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

// Process gift tastes for artisan items
for (const artisan of artisanData) {
  giftCount += processGiftTastes(artisan, gameData.npcGiftTastes);
}

console.log(`  Processed ${giftCount} gift preferences`);

// Process Bundles
console.log('\nProcessing bundles...');
const bundleData = [];

for (const [bundleKey, bundleInfo] of Object.entries(gameData.bundles)) {
  if (typeof bundleInfo !== 'string') continue;

  // Bundle format: "Name/Reward/Items/Color/MinItems"
  const parts = bundleInfo.split('/');
  const bundleName = parts[0];
  const reward = parts[1];
  const itemsString = parts[2];
  const minItems = parseInt(parts[4]) || null;

  const friendlyId = toKebabCase(bundleName);

  // Parse items
  const items = [];
  if (itemsString) {
    const itemEntries = itemsString.split(' ');
    for (const entry of itemEntries) {
      const itemParts = entry.split(' ');
      const itemId = parseInt(itemParts[0]);
      const quantity = parseInt(itemParts[1]) || 1;
      const quality = parseInt(itemParts[2]) || 0;

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

        // Add bundle reference to artisan items
        const artisan = artisanData.find(a => a.gameId === itemId);
        if (artisan && !artisan.bundles.includes(friendlyId)) {
          artisan.bundles.push(friendlyId);
        }
      }
    }
  }

  bundleData.push({
    id: friendlyId,
    name: bundleName,
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
  path.join(PROCESSED_DIR, 'reference/villagers.json'),
  JSON.stringify(villagerData, null, 2)
);
console.log(`  ✓ Wrote reference/villagers.json (${villagerData.length} villagers)`);

fs.writeFileSync(
  path.join(PROCESSED_DIR, 'collections/bundles.json'),
  JSON.stringify(bundleData, null, 2)
);
console.log(`  ✓ Wrote collections/bundles.json (${bundleData.length} bundles)`);

console.log('\n✅ Game data processing complete!');
console.log(`\nSource files created in: ${PROCESSED_DIR}`);

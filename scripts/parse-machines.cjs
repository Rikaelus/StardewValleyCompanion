#!/usr/bin/env node

/**
 * Parse machine recipes from Data/Machines.json
 * This extracts artisan good recipes from the 1.6 data-driven machine system
 */

const fs = require('fs');
const path = require('path');

const GAME_EXPORTS_DIR = path.join(__dirname, '../data/game-exports');

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

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
  '(BC)254': 'Fish Smoker'
};

// Parse item ID from game format
function parseItemId(itemId) {
  if (!itemId) return null;
  // Format: "(O)123" or "ItemId" or "FLAVORED_ITEM Wine DROP_IN_ID"
  const match = itemId.match(/\(O\)(\d+)/);
  if (match) return parseInt(match[1]);
  if (itemId.match(/^[A-Z_\s]+$/)) return itemId; // String ID like "DriedFruit"
  return itemId;
}

// Extract input requirements from triggers
function extractInputRequirements(triggers) {
  const requirements = {
    specificItems: [],
    tags: [],
    count: 1
  };

  for (const trigger of triggers) {
    if (trigger.RequiredItemId) {
      const itemId = parseItemId(trigger.RequiredItemId);
      if (itemId) requirements.specificItems.push(itemId);
    }
    if (trigger.RequiredTags) {
      requirements.tags.push(...trigger.RequiredTags);
    }
    if (trigger.RequiredCount && trigger.RequiredCount > 1) {
      requirements.count = trigger.RequiredCount;
    }
  }

  return requirements;
}

// Parse output item information
function parseOutputItem(outputItem) {
  const itemId = parseItemId(outputItem.ItemId);

  // Check for FLAVORED_ITEM (Wine, Juice, etc.)
  if (outputItem.ItemId && outputItem.ItemId.includes('FLAVORED_ITEM')) {
    const match = outputItem.ItemId.match(/FLAVORED_ITEM (\w+)/);
    return {
      isFlavored: true,
      baseName: match ? match[1] : null,
      itemId: itemId
    };
  }

  return {
    isFlavored: false,
    itemId: itemId
  };
}

// Main parsing function
function parseMachines() {
  console.log('🔧 Parsing machine recipes from Machines.json...\n');

  const machines = loadJson(path.join(GAME_EXPORTS_DIR, 'Machines.json'));
  const recipes = [];

  for (const [machineId, machineData] of Object.entries(machines)) {
    const machineName = MACHINE_NAMES[machineId];
    if (!machineName) continue; // Skip non-artisan machines

    console.log(`Processing ${machineName} (${machineId})...`);

    for (const rule of machineData.OutputRules || []) {
      const inputs = extractInputRequirements(rule.Triggers || []);
      const output = rule.OutputItem?.[0];

      if (!output) continue;

      const outputInfo = parseOutputItem(output);
      const processingTime = rule.MinutesUntilReady || (rule.DaysUntilReady * 1440);

      const recipe = {
        id: rule.Id,
        machine: machineName,
        machineId: machineId,
        outputItemId: outputInfo.itemId,
        outputName: outputInfo.baseName,
        isFlavored: outputInfo.isFlavored,
        processingMinutes: processingTime,
        inputs: inputs
      };

      recipes.push(recipe);

      // Log recipe details
      const inputDesc = inputs.specificItems.length > 0
        ? `specific items: ${inputs.specificItems.join(', ')}`
        : `tags: ${inputs.tags.join(', ')}`;
      console.log(`  - ${rule.Id}: ${inputDesc} → ${outputInfo.baseName || outputInfo.itemId} (${processingTime}min)`);
    }

    console.log('');
  }

  console.log(`✓ Parsed ${recipes.length} recipes from ${Object.keys(machines).length} machines\n`);

  return recipes;
}

// Export the parsing function
module.exports = { parseMachines };

// Run if called directly
if (require.main === module) {
  const recipes = parseMachines();

  // Write output for inspection
  const outputPath = path.join(__dirname, '../data/parsed-machine-recipes.json');
  fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));
  console.log(`📄 Wrote parsed recipes to: ${outputPath}`);
}

#!/usr/bin/env node

/**
 * Extract fish spawn locations from Data/Locations.json
 * Maps game location IDs to user-friendly names
 */

const fs = require('fs');
const path = require('path');

// Map internal location names to user-friendly display names
// Unmapped locations will be filtered out (interior locations, temp locations, etc.)
const LOCATION_NAME_MAP = {
  // Main valley locations
  'Mountain': 'Mountain Lake',
  'Forest': 'Forest River',
  'Town': 'Town River',
  'Beach': 'Ocean',
  'UndergroundMine': 'Mines',
  'Woods': 'Secret Woods',
  'Sewer': 'Sewers',
  'Desert': 'Desert',
  'Backwoods': null, // No fishable water (placeholder data in game files)
  'Railroad': 'Railroad',

  // Farm types (ponds/rivers on farms)
  'Farm_Standard': 'Farm',
  'Farm_Beach': 'Beach Farm',
  'Farm_Forest': 'Forest Farm',
  'Farm_FourCorners': 'Four Corners Farm',
  'Farm_Hilltop': 'Hilltop Farm',
  'Farm_Riverland': 'Riverland Farm',
  'Farm_Wilderness': 'Wilderness Farm',
  'Farm_MeadowlandsFarm': 'Meadowlands Farm',

  // Special locations
  'BugLand': 'Mutant Bug Lair',
  'WitchSwamp': 'Witch\'s Swamp',
  'Submarine': 'Night Market',
  'BeachNightMarket': 'Night Market',

  // Ginger Island
  'IslandWest': 'Ginger Island West',
  'IslandSouth': 'Ginger Island South',
  'IslandNorth': 'Ginger Island North',
  'IslandSouthEast': 'Ginger Island Southeast',
  'IslandSouthEastCave': 'Ginger Island Pirate Cove',
  'IslandFishing': 'Ginger Island Ocean',
  'Caldera': 'Volcano Caldera',

  // Mines/Caves
  'Mine': 'Mines',
  'SkullCave': 'Skull Cavern',
  'Volcano': 'Volcano',
  'FarmCave': 'Farm Cave',
};

// Extract ID from game ID format "(O)136" or qualified string IDs
function extractGameId(itemId) {
  // Try numeric format first: "(O)136"
  const numericMatch = itemId.match(/\(O\)(\d+)/);
  if (numericMatch) {
    return parseInt(numericMatch[1]);
  }

  // Try qualified string format: "(O)Goby"
  const stringMatch = itemId.match(/\(O\)(\w+)/);
  if (stringMatch) {
    return stringMatch[1]; // Return string ID as-is
  }

  return null;
}

// Map internal location key to friendly name
// Returns null for locations that should be excluded (interiors, temp locations, etc.)
function mapLocationName(locationKey) {
  // Try direct mapping first
  if (LOCATION_NAME_MAP[locationKey]) {
    return LOCATION_NAME_MAP[locationKey];
  }

  // Try extracting base location name (e.g., "Mountain_StandardFish" → "Mountain")
  const baseName = locationKey.split('_')[0];
  if (LOCATION_NAME_MAP[baseName]) {
    return LOCATION_NAME_MAP[baseName];
  }

  // Unmapped locations are likely interiors/temp locations - exclude them
  return null;
}

function extractFishLocations() {
  console.log('Extracting fish locations from game data...\n');

  // Load exported location data
  const locationsPath = path.join(__dirname, '../data/game-exports/Locations.json');
  const fishPath = path.join(__dirname, '../data/game-exports/Fish.json');

  if (!fs.existsSync(locationsPath)) {
    console.error('❌ Locations.json not found. Run game data export first.');
    process.exit(1);
  }

  if (!fs.existsSync(fishPath)) {
    console.error('❌ Fish.json not found. Run game data export first.');
    process.exit(1);
  }

  const locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  const fishData = JSON.parse(fs.readFileSync(fishPath, 'utf8'));

  // Build maps for fish data
  const fishLocations = new Map();
  const fishMinLevels = new Map(); // MinFishingLevel requirements

  // First, extract locations from Locations.json (rod-caught fish)
  Object.entries(locationsData).forEach(([locationKey, locationData]) => {
    const friendlyName = mapLocationName(locationKey);

    // Skip unmapped locations (interiors, temp areas, etc.)
    if (!friendlyName) return;

    // Check if this location has fish spawns
    if (!locationData.Fish || locationData.Fish.length === 0) {
      return;
    }

    locationData.Fish.forEach(spawnRule => {
      // Skip if no ItemId (shouldn't happen, but be defensive)
      if (!spawnRule.ItemId) return;

      const fishId = extractGameId(spawnRule.ItemId);
      if (!fishId) return;

      if (!fishLocations.has(fishId)) {
        fishLocations.set(fishId, new Set());
      }

      fishLocations.get(fishId).add(friendlyName);

      // Capture MinFishingLevel if present
      if (spawnRule.MinFishingLevel && spawnRule.MinFishingLevel > 0) {
        // Store the highest level requirement seen for this fish
        const currentLevel = fishMinLevels.get(fishId) || 0;
        if (spawnRule.MinFishingLevel > currentLevel) {
          fishMinLevels.set(fishId, spawnRule.MinFishingLevel);
        }
      }
    });
  });

  // Second, parse Fish.json for crab pot fish and mines fish
  console.log('Parsing Fish.json for special cases...');

  Object.entries(fishData).forEach(([gameId, fishInfo]) => {
    if (typeof fishInfo !== 'string') return;

    const parts = fishInfo.split('/');
    const fishName = parts[0];
    const isTrapFish = parts[1] === 'trap'; // Position 1 for trap fish

    // Handle crab pot fish (trap format)
    if (isTrapFish) {
      // Crab pot fish have water type in position 4
      const waterType = parts[4]; // "ocean" or "freshwater"

      const fishId = isNaN(gameId) ? gameId : parseInt(gameId);

      if (!fishLocations.has(fishId)) {
        fishLocations.set(fishId, new Set());
      }

      if (waterType === 'ocean') {
        fishLocations.get(fishId).add('Ocean (Crab Pot)');
      } else if (waterType === 'freshwater') {
        fishLocations.get(fishId).add('Freshwater (Crab Pot)');
      }

      console.log(`  ✓ ${fishName}: ${waterType} crab pot`);
    }
    // Handle mines fish
    // For regular fish, MinLevel is at position 12
    else {
      const minLevel = parseInt(parts[12]) || 0;

      // Special cases: Fish with MinLevel 0 that spawn on specific mine floors
      // These spawn in freshwater areas (floors 20, 60) but not lava areas (floor 100+)
      const isGhostfish = fishName === 'Ghostfish';
      const isGreenAlgae = fishName === 'Green Algae';
      const isWhiteAlgae = fishName === 'White Algae';

      if (minLevel > 0 || isGhostfish || isGreenAlgae || isWhiteAlgae) {
      const fishId = isNaN(gameId) ? gameId : parseInt(gameId);

      // MinLevel can mean two things:
      // 1. For mines fish with no other locations: actual mine floor spawn requirement
      // 2. For other fish: fishing skill level requirement (not a location)
      // Only add mines location if fish has no locations OR already has a mines-related location

      const existingLocations = fishLocations.get(fishId);
      const hasNoLocation = !existingLocations || existingLocations.size === 0;
      const hasMinesLocation = existingLocations &&
        Array.from(existingLocations).some(loc =>
          loc.includes('Mines') || loc.includes('Volcano') || loc.includes('Skull Cavern')
        );

      // Only add mines floor if this is actually a mines fish
      if (hasNoLocation || hasMinesLocation) {
        if (!fishLocations.has(fishId)) {
          fishLocations.set(fishId, new Set());
        }

        // For fish with specific mine floors, remove the generic "Mines" from Locations.json
        if ((isGhostfish || isGreenAlgae || isWhiteAlgae) && fishLocations.has(fishId)) {
          const locations = fishLocations.get(fishId);
          if (locations.has('Mines')) {
            locations.delete('Mines');
          }
        }

        // Map MinLevel to floor ranges based on known spawn behavior
        // Note: This appears to be hardcoded in game logic, not a formula
        // MinLevel may represent minimum fishing level or spawn tier, not direct floor calculation

        // Hardcoded mappings based on wiki/observed behavior
        const mineLevelFloorMap = {
          3: [20],      // Stonefish
          5: [60],      // Ice Pip
          7: [100],     // Lava Eel
        };

        // Special cases: Freshwater fish/algae spawn on floors with water (20, 60)
        // Floor 100+ has lava, not freshwater
        const freshwaterFloors = [20, 60];

        let floors;
        if (isGhostfish || isGreenAlgae || isWhiteAlgae) {
          floors = freshwaterFloors;
        } else if (mineLevelFloorMap[minLevel]) {
          floors = mineLevelFloorMap[minLevel];
        } else {
          floors = null; // Generic "Mines"
        }

        if (floors) {
          floors.forEach(floor => {
            const floorDescription = `Mines (F${floor})`;
            fishLocations.get(fishId).add(floorDescription);
            console.log(`  ✓ ${fishName}: F${floor}`);
          });
        } else {
          const floorDescription = 'Mines';
          fishLocations.get(fishId).add(floorDescription);
          console.log(`  ✓ ${fishName}: MinLevel ${minLevel} → ${floorDescription}`);
        }
      }
      }
    }
  });

  console.log(`\n✅ Extracted locations for ${fishLocations.size} fish`);
  console.log(`✅ Extracted fishing level requirements for ${fishMinLevels.size} fish`);

  // Convert Sets to Arrays and sort
  const result = {
    locations: {},
    minFishingLevels: {}
  };

  fishLocations.forEach((locations, fishId) => {
    result.locations[fishId] = Array.from(locations).sort();
  });

  fishMinLevels.forEach((level, fishId) => {
    result.minFishingLevels[fishId] = level;
  });

  // Save to file
  const outputPath = path.join(__dirname, '../data/extracted-locations.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`📄 Saved to: ${outputPath}\n`);

  // Show sample output
  console.log('Sample extracted locations:');
  const samples = Array.from(fishLocations.entries()).slice(0, 5);
  samples.forEach(([fishId, locations]) => {
    console.log(`  Game ID ${fishId}: ${Array.from(locations).join(', ')}`);
  });

  return result;
}

if (require.main === module) {
  extractFishLocations();
}

module.exports = { extractFishLocations };

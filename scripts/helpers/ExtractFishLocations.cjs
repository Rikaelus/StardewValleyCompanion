#!/usr/bin/env node

/**
 * Extract fish spawn locations from Data/Locations.json
 * Maps game location IDs to user-friendly names and entity IDs
 */

const fs = require('fs');
const path = require('path');

// Helper function to load JSON files
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Load rules location mappings
const CURATED_DIR = path.join(__dirname, '../../data/rules');
const mineFloorsData = loadJson(path.join(CURATED_DIR, 'mine-floors.json'));
const locationNamesData = loadJson(path.join(CURATED_DIR, 'location-names.json')).locations;

// Build displayName lookup from location-names.json (game location ID → display name)
const LOCATION_NAME_MAP = {};
for (const [key, data] of Object.entries(locationNamesData)) {
  LOCATION_NAME_MAP[key] = data.displayName;
}

// Build displayName → entityId lookup from location-names.json
const DISPLAY_NAME_TO_ENTITY_ID = {};
for (const [, data] of Object.entries(locationNamesData)) {
  if (data.displayName && data.entityId) {
    DISPLAY_NAME_TO_ENTITY_ID[data.displayName] = data.entityId;
  }
}

// Mine floor entity IDs
const MINE_FLOOR_ENTITY_IDS = {
  20: 'map-mines-f20',
  60: 'map-mines-f60',
  100: 'map-mines-f100',
};

const SEASON_INTS = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' };

// Extract ID from game ID format "(O)136" or qualified string IDs
function extractGameId(itemId) {
  // Try numeric format first: "(O)136"
  const numericMatch = itemId.match(/\(O\)(\d+)/);
  if (numericMatch) {
    return parseInt(numericMatch[1], 10);
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

// Map a display name to its entity ID (null for pseudo-locations like crab pot)
function mapLocationEntityId(displayName) {
  return DISPLAY_NAME_TO_ENTITY_ID[displayName] || null;
}

// Parse seasons from a spawn rule's Season int and/or Condition string
// Returns an array of season strings, or null meaning all seasons
function parseSeasonsFromRule(spawnRule) {
  // Integer Season field (0=spring, 1=summer, 2=fall, 3=winter)
  if (spawnRule.Season !== null && spawnRule.Season !== undefined) {
    const s = SEASON_INTS[spawnRule.Season];
    if (s) return [s];
  }

  // Condition string: "LOCATION_SEASON Here summer winter"
  if (spawnRule.Condition) {
    const m = spawnRule.Condition.match(/LOCATION_SEASON\s+\S+\s+([\w\s]+?)(?:\s*$|,)/i);
    if (m) {
      return m[1].trim().split(/\s+/).map(s => s.toLowerCase());
    }
  }

  return null; // null = all seasons
}

function extractFishLocations() {
  console.log('Extracting fish locations from game data...\n');

  // Load exported location data
  const locationsPath = path.join(__dirname, '../../data/game-exports/Locations.json');
  const fishPath = path.join(__dirname, '../../data/game-exports/Fish.json');

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

  // fishLocations: Map<fishId, Map<locationName, { seasons: Set<season>|null, locationId: string|null }>>
  const fishLocations = new Map();
  const fishMinLevels = new Map(); // MinFishingLevel requirements

  // Helper: record a (fish, location, seasons) tuple, merging seasons across multiple spawn rules
  function addFishLocation(fishId, locationName, seasons, locationId, qualifier = null) {
    if (!fishLocations.has(fishId)) fishLocations.set(fishId, new Map());
    const locMap = fishLocations.get(fishId);

    if (!locMap.has(locationName)) {
      locMap.set(locationName, {
        seasons: seasons ? new Set(seasons) : null,
        locationId: locationId || null,
        qualifier: qualifier || null,
      });
    } else {
      const existing = locMap.get(locationName);
      if (existing.seasons === null || seasons === null) {
        existing.seasons = null;
      } else {
        for (const s of seasons) existing.seasons.add(s);
      }
      if (!existing.locationId && locationId) existing.locationId = locationId;
      // If any rule for this location is unconditional, clear the qualifier
      if (!qualifier) existing.qualifier = null;
    }
  }

  // First, extract locations from Locations.json (rod-caught fish)
  Object.entries(locationsData).forEach(([locationKey, locationData]) => {
    const friendlyName = mapLocationName(locationKey);

    // Skip unmapped locations (interiors, temp areas, etc.)
    if (!friendlyName) return;

    // BeachNightMarket delegates all fish from Beach via LOCATION_FISH; any explicit
    // entries there are duplicates of Beach sources and should not create separate entries.
    if (locationKey === 'BeachNightMarket') return;

    const entityId = mapLocationEntityId(friendlyName);

    // Check if this location has fish spawns
    if (!locationData.Fish || locationData.Fish.length === 0) {
      return;
    }

    locationData.Fish.forEach(spawnRule => {
      // Skip if no ItemId (shouldn't happen, but be defensive)
      if (!spawnRule.ItemId) return;

      // Skip spawn rules that only apply when the regular version of the fish is absent
      // (negated LEGENDARY_FAMILY condition = normal fish, not affected)
      // Skip spawn rules gated behind Qi Beans drop — not a catchable fish location
      if (spawnRule.Condition?.includes('DROP_QI_BEANS')) return;

      const fishId = extractGameId(spawnRule.ItemId);
      if (!fishId) return;

      const seasons = parseSeasonsFromRule(spawnRule);
      const isLegendaryFamily = /(?<!!)\bPLAYER_SPECIAL_ORDER_RULE_ACTIVE\s+Current\s+LEGENDARY_FAMILY/.test(spawnRule.Condition || '');
      addFishLocation(fishId, friendlyName, seasons, entityId, isLegendaryFamily ? 'Legendary Family order' : null);

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

      const fishId = isNaN(gameId) ? gameId : parseInt(gameId, 10);

      // Crab pot pseudo-locations don't get entity IDs
      if (waterType === 'ocean') {
        addFishLocation(fishId, 'Ocean (Crab Pot)', null, null);
      } else if (waterType === 'freshwater') {
        addFishLocation(fishId, 'Freshwater (Crab Pot)', null, null);
      }

      console.log(`  ✓ ${fishName}: ${waterType} crab pot`);
    }
    // Handle mines fish
    // For regular fish, MinLevel is at position 12
    else {
      const minLevel = parseInt(parts[12], 10) || 0;

      // Special cases: Fish with MinLevel 0 that spawn on specific mine floors
      // These spawn in freshwater areas (floors 20, 60) but not lava areas (floor 100+)
      const freshwaterFishIds = mineFloorsData.specialRules.freshwaterFloors.fishGameIds;
      const numericGameId = isNaN(gameId) ? gameId : parseInt(gameId, 10);
      const isFreshwaterFish = freshwaterFishIds.includes(numericGameId);

      if (minLevel > 0 || isFreshwaterFish) {
        const fishId = isNaN(gameId) ? gameId : parseInt(gameId, 10);

        const existingLocMap = fishLocations.get(fishId);
        const hasNoLocation = !existingLocMap || existingLocMap.size === 0;
        const hasMinesLocation = existingLocMap &&
          Array.from(existingLocMap.keys()).some(loc =>
            loc.includes('Mines') || loc.includes('Volcano') || loc.includes('Skull Cavern')
          );

        // Only add mines floor if this is actually a mines fish
        if (hasNoLocation || hasMinesLocation) {
          // For fish with specific mine floors, remove the generic "Mines" from Locations.json
          if (isFreshwaterFish && existingLocMap && existingLocMap.has('Mines')) {
            existingLocMap.delete('Mines');
          }

          // Load mine floor mappings from rules data
          const mineLevelFloorMap = {};
          for (const [lvl, data] of Object.entries(mineFloorsData.floorMappings)) {
            mineLevelFloorMap[lvl] = data.floors;
          }

          // Special cases: Freshwater fish/algae spawn on floors with water (20, 60)
          const freshwaterFloors = mineFloorsData.specialRules.freshwaterFloors.floors;

          let floors;
          if (isFreshwaterFish) {
            floors = freshwaterFloors;
          } else if (mineLevelFloorMap[minLevel]) {
            floors = mineLevelFloorMap[minLevel];
          } else {
            floors = null; // Generic "Mines"
          }

          if (floors) {
            floors.forEach(floor => {
              const floorDescription = `Mines (F${floor})`;
              const floorEntityId = MINE_FLOOR_ENTITY_IDS[floor] || null;
              addFishLocation(fishId, floorDescription, null, floorEntityId);
              console.log(`  ✓ ${fishName}: F${floor}`);
            });
          } else {
            addFishLocation(fishId, 'Mines', null, 'map-mines');
            console.log(`  ✓ ${fishName}: MinLevel ${minLevel} → Mines`);
          }
        }
      }
    }
  });

  console.log(`\n✅ Extracted locations for ${fishLocations.size} fish`);
  console.log(`✅ Extracted fishing level requirements for ${fishMinLevels.size} fish`);

  // Convert to serialisable structure:
  // locations: { fishId: [ { location, locationId, seasons } ] }
  // seasons: null = all seasons, array = specific seasons
  const result = {
    locations: {},
    minFishingLevels: {}
  };

  fishLocations.forEach((locMap, fishId) => {
    result.locations[fishId] = Array.from(locMap.entries())
      .map(([location, data]) => ({
        location,
        locationId: data.locationId,
        seasons: data.seasons ? Array.from(data.seasons).sort() : null,
        ...(data.qualifier && { qualifier: data.qualifier }),
      }))
      .sort((a, b) => a.location.localeCompare(b.location));
  });

  fishMinLevels.forEach((level, fishId) => {
    result.minFishingLevels[fishId] = level;
  });

  // Save to file (intermediate output for debugging/verification)
  const outputPath = path.join(__dirname, '../../data/processing/extracted-locations.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`📄 Saved to: ${outputPath}\n`);

  // Show sample output
  console.log('Sample extracted locations:');
  const samples = Array.from(fishLocations.entries()).slice(0, 5);
  samples.forEach(([fishId, locMap]) => {
    const locs = Array.from(locMap.entries()).map(([loc, data]) =>
      data.seasons ? `${loc} (${Array.from(data.seasons).join('/')})` : loc
    );
    console.log(`  Game ID ${fishId}: ${locs.join(', ')}`);
  });

  return result;
}

if (require.main === module) {
  extractFishLocations();
}

module.exports = { extractFishLocations };

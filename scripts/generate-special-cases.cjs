#!/usr/bin/env node

/**
 * Generate special case notes for fish with varying spawn conditions
 * Detects when the same fish has different seasons/times/weather by location
 */

const fs = require('fs');
const path = require('path');

const LOCATION_NAME_MAP = {
  'Mountain': 'Mountain Lake',
  'Forest': 'Forest River',
  'Town': 'Town River',
  'Beach': 'Ocean',
  'UndergroundMine': 'Mines',
  'Woods': 'Secret Woods',
  'Sewer': 'Sewers',
  'Desert': 'Desert',
  'Backwoods': null,
  'Railroad': 'Railroad',
  'Farm_Standard': 'Farm',
  'Farm_Beach': 'Beach Farm',
  'Farm_Forest': 'Forest Farm',
  'Farm_FourCorners': 'Four Corners Farm',
  'Farm_Hilltop': 'Hilltop Farm',
  'Farm_Riverland': 'Riverland Farm',
  'Farm_Wilderness': 'Wilderness Farm',
  'Farm_MeadowlandsFarm': 'Meadowlands Farm',
  'BugLand': 'Mutant Bug Lair',
  'WitchSwamp': 'Witch\'s Swamp',
  'Submarine': 'Night Market',
  'BeachNightMarket': 'Night Market',
  'IslandWest': 'Ginger Island West',
  'IslandSouth': 'Ginger Island South',
  'IslandNorth': 'Ginger Island North',
  'IslandSouthEast': 'Ginger Island Southeast',
  'IslandSouthEastCave': 'Ginger Island Pirate Cove',
  'IslandFishing': 'Ginger Island Ocean',
  'Caldera': 'Volcano Caldera',
  'Mine': 'Mines',
  'SkullCave': 'Skull Cavern',
  'Volcano': 'Volcano',
  'FarmCave': 'Farm Cave',
};

function extractGameId(itemId) {
  const numericMatch = itemId.match(/\(O\)(\d+)/);
  if (numericMatch) {
    return parseInt(numericMatch[1]);
  }
  const stringMatch = itemId.match(/\(O\)(\w+)/);
  if (stringMatch) {
    return stringMatch[1];
  }
  return null;
}

function parseCondition(condition) {
  if (!condition) return null;

  // Parse LOCATION_SEASON conditions
  const seasonMatch = condition.match(/LOCATION_SEASON Here (.+)/);
  if (seasonMatch) {
    return {
      type: 'season',
      seasons: seasonMatch[1].split(' ')
    };
  }

  // Parse TIME conditions
  const timeMatch = condition.match(/TIME (\d+) (\d+)/);
  if (timeMatch) {
    return {
      type: 'time',
      start: timeMatch[1],
      end: timeMatch[2]
    };
  }

  // Parse WEATHER conditions
  if (condition.includes('WEATHER')) {
    return {
      type: 'weather',
      weather: condition.includes('sunny') ? 'sunny' : 'rainy'
    };
  }

  return null;
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatSeasons(seasons) {
  if (!seasons || seasons.length === 0) return 'all seasons';
  return seasons.map(capitalizeFirst).join(', ');
}

function groupLocationsByConditions(locationRules) {
  // Group locations that have the same conditions
  const conditionGroups = new Map();

  locationRules.forEach((normalized, location) => {
    const key = JSON.stringify(normalized);
    if (!conditionGroups.has(key)) {
      conditionGroups.set(key, {
        locations: [],
        normalized
      });
    }
    conditionGroups.get(key).locations.push(location);
  });

  return Array.from(conditionGroups.values());
}

function generateNote(locationRules) {
  // Group locations with same conditions
  const groups = groupLocationsByConditions(locationRules);

  // Sort groups: more restrictive conditions first
  groups.sort((a, b) => {
    // Prefer groups with season restrictions
    const aHasSeasons = a.normalized.seasons.length > 0;
    const bHasSeasons = b.normalized.seasons.length > 0;
    if (aHasSeasons && !bHasSeasons) return -1;
    if (!aHasSeasons && bHasSeasons) return 1;
    return 0;
  });

  // Generate note parts
  const parts = groups.map(group => {
    const locations = group.locations.join(', ');
    const seasons = formatSeasons(group.normalized.seasons);
    return `${locations}: ${seasons}`;
  });

  return parts.join('. ') + '.';
}

function generateSpecialCases() {
  console.log('🔍 Analyzing fish spawn rules for special cases...\n');

  const locationsPath = path.join(__dirname, '../data/game-exports/Locations.json');
  const fishPath = path.join(__dirname, '../data/source/items/fish.json');

  const locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  const fishData = JSON.parse(fs.readFileSync(fishPath, 'utf8'));

  // Build detailed spawn rules: fishId -> [{ location, seasons, times, weather, condition }]
  const fishSpawnRules = new Map();

  Object.entries(locationsData).forEach(([locationKey, locationData]) => {
    const friendlyName = LOCATION_NAME_MAP[locationKey];
    if (!friendlyName) return;

    if (!locationData.Fish || locationData.Fish.length === 0) return;

    locationData.Fish.forEach(spawnRule => {
      if (!spawnRule.ItemId) return;

      const fishId = extractGameId(spawnRule.ItemId);
      if (!fishId) return;

      if (!fishSpawnRules.has(fishId)) {
        fishSpawnRules.set(fishId, []);
      }

      const parsedCondition = parseCondition(spawnRule.Condition);

      fishSpawnRules.get(fishId).push({
        location: friendlyName,
        season: spawnRule.Season,
        condition: parsedCondition,
        rawCondition: spawnRule.Condition
      });
    });
  });

  // Analyze each fish to detect special cases
  const specialCases = new Map(); // gameId -> note text

  fishSpawnRules.forEach((rules, fishId) => {
    const fish = fishData.find(f => f.gameId === fishId);
    if (!fish) return;

    // Group rules by location
    const byLocation = new Map();
    rules.forEach(rule => {
      if (!byLocation.has(rule.location)) {
        byLocation.set(rule.location, []);
      }
      byLocation.get(rule.location).push(rule);
    });

    // Check if different locations have meaningfully different conditions
    if (byLocation.size > 1) {
      // Normalize rules to detect real differences
      const normalizedByLocation = new Map();
      byLocation.forEach((rules, location) => {
        // Combine all conditions for this location
        const allSeasons = new Set();
        const allConditions = new Set();

        rules.forEach(rule => {
          if (rule.condition?.type === 'season') {
            rule.condition.seasons.forEach(s => allSeasons.add(s));
          }
          if (rule.rawCondition) {
            allConditions.add(rule.rawCondition);
          }
        });

        normalizedByLocation.set(location, {
          seasons: Array.from(allSeasons).sort(),
          conditions: Array.from(allConditions).sort()
        });
      });

      // Check if any locations have different normalized conditions
      const locations = Array.from(normalizedByLocation.keys());
      let hasRealVariation = false;

      for (let i = 0; i < locations.length; i++) {
        for (let j = i + 1; j < locations.length; j++) {
          const loc1 = normalizedByLocation.get(locations[i]);
          const loc2 = normalizedByLocation.get(locations[j]);

          if (JSON.stringify(loc1) !== JSON.stringify(loc2)) {
            hasRealVariation = true;
            break;
          }
        }
        if (hasRealVariation) break;
      }

      if (hasRealVariation) {
        const note = generateNote(normalizedByLocation);
        specialCases.set(fishId, note);
      }
    }
  });

  console.log(`📋 Generated ${specialCases.size} special case notes:\n`);

  specialCases.forEach((note, fishId) => {
    const fish = fishData.find(f => f.gameId === fishId);
    if (fish) {
      console.log(`${fish.name}: ${note}`);
    }
  });
  console.log();

  return specialCases;
}

if (require.main === module) {
  generateSpecialCases();
}

module.exports = { generateSpecialCases };

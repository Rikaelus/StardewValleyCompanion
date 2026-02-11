#!/usr/bin/env node

/**
 * Generate special case notes for forage items with varying spawn conditions
 * Detects when the same forage item has different seasons by location
 */

const fs = require('fs');
const path = require('path');

// Helper function to load JSON files
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Load rules location mappings
const CURATED_DIR = path.join(__dirname, '../data/rules');
const locationData = loadJson(path.join(CURATED_DIR, 'locations.json')).locations;

// Convert location data to simple map
const LOCATION_NAME_MAP = {};
for (const [key, data] of Object.entries(locationData)) {
  LOCATION_NAME_MAP[key] = data.displayName;
}

// Season mapping
const seasonMap = {
  0: 'spring',
  1: 'summer',
  2: 'fall',
  3: 'winter'
};

function parseItemId(itemId) {
  if (!itemId) return null;

  // Extract numeric ID from format like "(O)404"
  const numericMatch = itemId.match(/\(O\)(\d+)/);
  if (numericMatch) {
    return parseInt(numericMatch[1], 10);
  }

  // Could also handle string IDs like "(O)SomeName" if needed
  const stringMatch = itemId.match(/\(O\)(\w+)/);
  if (stringMatch) {
    return stringMatch[1];
  }

  return null;
}

function parseConditionSeasons(condition) {
  if (!condition) return [];

  // Parse LOCATION_SEASON conditions like "LOCATION_SEASON Here spring summer fall"
  const seasonMatch = condition.match(/LOCATION_SEASON Here (.+)/);
  if (seasonMatch) {
    return seasonMatch[1].split(' ');
  }

  return [];
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatSeasons(seasons) {
  if (!seasons || seasons.length === 0) return 'All Seasons';
  return seasons.map(capitalizeFirst).join(', ');
}

function groupLocationsBySeasons(locationSeasons) {
  // Group locations that have the same seasons
  const seasonGroups = new Map();

  locationSeasons.forEach((seasons, location) => {
    const key = JSON.stringify(seasons.sort());
    if (!seasonGroups.has(key)) {
      seasonGroups.set(key, {
        locations: [],
        seasons: seasons
      });
    }
    seasonGroups.get(key).locations.push(location);
  });

  return Array.from(seasonGroups.values());
}

function generateNote(locationSeasons) {
  // Group locations with same seasons
  const groups = groupLocationsBySeasons(locationSeasons);

  // Sort groups: more restrictive seasons first (fewer seasons = more restrictive)
  groups.sort((a, b) => {
    if (a.seasons.length === 0 && b.seasons.length > 0) return 1;
    if (a.seasons.length > 0 && b.seasons.length === 0) return -1;
    return a.seasons.length - b.seasons.length;
  });

  // Return array of structured notes
  return groups.map(group => ({
    locations: group.locations,
    seasons: formatSeasons(group.seasons)
  }));
}

function generateForageSpecialCases() {
  console.log('🔍 Analyzing forage spawn rules for special cases...\n');

  const locationsPath = path.join(__dirname, '../data/game-exports/Locations.json');
  const forageDataPath = path.join(__dirname, '../data/processed/items/forage.json');
  const mineForagePath = path.join(__dirname, '../data/rules/mine-forage.json');

  const locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  const forageData = JSON.parse(fs.readFileSync(forageDataPath, 'utf8'));
  const mineForageData = JSON.parse(fs.readFileSync(mineForagePath, 'utf8'));

  // Build detailed spawn rules: forageId -> Map<location, seasons[]>
  const forageSpawnRules = new Map();

  Object.entries(locationsData).forEach(([locationKey, locationInfo]) => {
    const friendlyName = LOCATION_NAME_MAP[locationKey];
    if (!friendlyName) return;

    if (!locationInfo.Forage || locationInfo.Forage.length === 0) return;

    locationInfo.Forage.forEach(forageRule => {
      if (!forageRule.ItemId) return;

      const itemId = parseItemId(forageRule.ItemId);
      if (!itemId) return;

      if (!forageSpawnRules.has(itemId)) {
        forageSpawnRules.set(itemId, new Map());
      }

      const locationSeasons = forageSpawnRules.get(itemId);

      if (!locationSeasons.has(friendlyName)) {
        locationSeasons.set(friendlyName, []);
      }

      // Add season if explicitly specified
      if (forageRule.Season !== undefined && forageRule.Season !== null) {
        const seasonName = seasonMap[forageRule.Season];
        if (seasonName && !locationSeasons.get(friendlyName).includes(seasonName)) {
          locationSeasons.get(friendlyName).push(seasonName);
        }
      }

      // Check for LOCATION_SEASON conditions (e.g., "LOCATION_SEASON Here spring summer fall")
      if (forageRule.Condition) {
        const conditionSeasons = parseConditionSeasons(forageRule.Condition);
        conditionSeasons.forEach(season => {
          if (!locationSeasons.get(friendlyName).includes(season)) {
            locationSeasons.get(friendlyName).push(season);
          }
        });
      }

      // If no season specified and no condition, it means all seasons
      if (forageRule.Season === null && !forageRule.Condition) {
        // Mark as empty array = all seasons
        if (locationSeasons.get(friendlyName).length === 0) {
          locationSeasons.set(friendlyName, []);
        }
      }
    });
  });

  // Add mine forage locations (available year-round)
  mineForageData.items.forEach(mineForage => {
    if (!forageSpawnRules.has(mineForage.gameId)) {
      forageSpawnRules.set(mineForage.gameId, new Map());
    }
    const locationSeasons = forageSpawnRules.get(mineForage.gameId);
    locationSeasons.set(`Mines (Floors ${mineForage.floors})`, []); // Empty array = all seasons
  });

  // Analyze each forage item to detect special cases
  const specialCases = new Map(); // gameId -> note text

  forageSpawnRules.forEach((locationSeasons, forageId) => {
    const forage = forageData.find(f => f.gameId === forageId);
    if (!forage) return;

    // Check if different locations have different seasons
    if (locationSeasons.size > 1) {
      // Normalize seasons for comparison
      const normalizedByLocation = new Map();
      locationSeasons.forEach((seasons, location) => {
        normalizedByLocation.set(location, seasons.sort());
      });

      // Check if any locations have different seasons
      const locations = Array.from(normalizedByLocation.keys());
      let hasRealVariation = false;

      for (let i = 0; i < locations.length; i++) {
        for (let j = i + 1; j < locations.length; j++) {
          const loc1Seasons = normalizedByLocation.get(locations[i]);
          const loc2Seasons = normalizedByLocation.get(locations[j]);

          if (JSON.stringify(loc1Seasons) !== JSON.stringify(loc2Seasons)) {
            hasRealVariation = true;
            break;
          }
        }
        if (hasRealVariation) break;
      }

      if (hasRealVariation) {
        const note = generateNote(normalizedByLocation);
        specialCases.set(forageId, note);
      }
    }
  });

  console.log(`📋 Generated ${specialCases.size} special case notes:\n`);

  specialCases.forEach((notes, forageId) => {
    const forage = forageData.find(f => f.gameId === forageId);
    if (forage) {
      console.log(`${forage.name}:`);
      notes.forEach(note => {
        console.log(`  ${note.locations.join(', ')}: ${note.seasons}`);
      });
    }
  });
  console.log();

  return specialCases;
}

if (require.main === module) {
  generateForageSpecialCases();
}

module.exports = { generateForageSpecialCases };

/**
 * Format internal location names to user-friendly display names
 * Examples:
 *   "BusStop" → "Bus Stop"
 *   "IslandNorthCave1" → "Island North Cave 1"
 *   "Forest" → "Forest"
 */
export function formatLocationName(location) {
  if (!location) return ''

  // Special cases for known locations
  const specialCases = {
    'BusStop': 'Bus Stop',
    'IslandNorthCave1': 'Volcano Dungeon',
    'Railroad': 'Railroad',
    'Backwoods': 'Backwoods',
  }

  if (specialCases[location]) {
    return specialCases[location]
  }

  // Generic formatter: add spaces before capital letters and numbers
  return location
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/([0-9]+)/g, ' $1') // Add space before numbers
    .trim()
}

/**
 * Format an array of location names
 */
export function formatLocationNames(locations) {
  if (!locations || locations.length === 0) return []
  return locations.map(formatLocationName)
}

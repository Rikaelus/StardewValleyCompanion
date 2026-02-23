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

/**
 * Format military time (e.g., 600, 2600) to 12-hour display (e.g., "6am", "2am")
 */
export function formatTime(militaryTime) {
  const time = String(militaryTime).padStart(4, '0')
  let hours = parseInt(time.slice(0, -2))

  if (hours >= 24) {
    hours -= 24
  }

  const period = hours >= 12 ? 'pm' : 'am'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

  return `${displayHours}${period}`
}

/**
 * Format an array of seasons with capitalized first letters
 */
export function formatSeasons(seasons) {
  if (!seasons || seasons.length === 0) return 'None'
  return seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
}

/**
 * Format processing time in minutes to a human-readable string
 */
export function formatProcessingTime(minutes) {
  if (!minutes) return 'Unknown'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

/**
 * Get color for fish difficulty rating
 */
export function getDifficultyColor(difficulty) {
  if (difficulty >= 80) return '#d32f2f'
  if (difficulty >= 60) return '#f57c00'
  if (difficulty >= 40) return '#fbc02d'
  return '#66bb6a'
}

/**
 * Format a price value with gold suffix
 */
export function formatPrice(price) {
  return `${price}g`
}

/**
 * Map a numeric category ID to a display name
 */
const CATEGORY_MAP = {
  '-4': 'Fish',
  '-5': 'Egg',
  '-6': 'Milk',
  '-7': 'Cooking',
  '-12': 'Minerals',
  '-15': 'Metal Resources',
  '-16': 'Building Resources',
  '-17': "Sell at Pierre's",
  '-18': "Sell at Pierre's and Marnie's",
  '-19': 'Fertilizer',
  '-20': 'Junk',
  '-21': 'Bait',
  '-22': 'Tackle',
  '-23': 'Sell at Fish Shop',
  '-24': 'Furniture',
  '-25': 'Ingredients',
  '-26': 'Artisan Goods',
  '-27': 'Syrup',
  '-28': 'Monster Loot',
  '-74': 'Seeds',
  '-75': 'Vegetables',
  '-79': 'Fruit',
  '-80': 'Flower',
  '-81': 'Forage'
}

/**
 * Get trash can refund percentage based on upgrade level
 */
export function getTrashCanRefund(trashCanUpgrade) {
  switch (trashCanUpgrade) {
    case 'normal': return 0
    case 'copper': return 0.15
    case 'steel': return 0.30
    case 'gold': return 0.45
    case 'iridium': return 0.60
    default: return 0
  }
}

/**
 * Get color for profit percentage display
 */
export function getProfitColor(profit) {
  if (profit < 0) return '#d32f2f'
  if (profit >= 100) return '#2e7d32'
  return '#5c4a32'
}

export function getCategoryName(category, type) {
  if (type === 'artisan' && typeof category === 'string') {
    return category
  }
  return CATEGORY_MAP[String(category)] || 'Item'
}

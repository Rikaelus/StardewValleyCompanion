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

// ---------------------------------------------------------------------------
// JSON Logic condition → human-readable label
// ---------------------------------------------------------------------------

const MAIL_FLAG_LABELS = {
  // Perfection
  'Farm_Eternal':          '100% Perfection Achieved',
  // Stardrop one-time purchases (these appear negated — already bought)
  'CF_Fair':               'Stardrop (Stardew Valley Fair)',
  'CF_Fish':               'Stardrop (Willy)',
  'CF_Sewer':              'Stardrop (Krobus)',
  'CF_Mines':              'Stardrop (Mines)',
  'CF_Statue':             'Stardrop (Master Cannoli)',
  // Progression unlocks
  'ccIsComplete':          'Community Center Complete',
  'JojaMember':            'Joja Membership Purchased',
  'museumComplete':        'Museum Collection Complete',
  'skullCave':             'Skull Cavern Unlocked',
  'willyBoatFixed':        'Willy\'s Boat Repaired',
  'OpenedSewer':           'Sewer Unlocked',
  'galaxySword':           'Galaxy Sword Obtained',
  'Visited_Island':        'Ginger Island Visited',
  'reachedCaldera':        'Volcano Caldera Reached',
  'gotCAMask':             '??? Hat Already Obtained',
  'beenToWoods':           'Secret Woods Visited',
  'guildMember':           'Adventure Guild Joined',
  'willyBackRoomInvitation': 'Willy\'s Boat Tunnel Unlocked',
}

function formatVarLabel(varPath) {
  if (varPath === 'player.mineDepth') return 'Mine Depth'
  if (varPath === 'player.houseUpgrade') return 'House Upgrade'
  if (varPath === 'player.allAchievements') return 'All Achievements'
  if (varPath === 'world.GoldenWalnutsFound') return 'Golden Walnuts Found'
  if (varPath === 'world.TimesFedRaccoons') return 'Raccoons Fed'
  if (varPath === 'world.GoldenCoconutCracked') return 'Golden Coconut Cracked'
  if (varPath === 'world.season') return 'Season'
  if (varPath === 'world.islandUnlocked') return 'Ginger Island Unlocked'
  if (varPath === 'world.communityCenter') return 'Community Center Complete'
  if (varPath === 'player.skills.fishing') return 'Fishing Level'
  if (varPath === 'player.skills.farming') return 'Farming Level'
  if (varPath === 'player.moneyEarned') return 'Total Earnings'
  if (varPath.startsWith('player.friendship.')) {
    const name = varPath.slice('player.friendship.'.length)
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} Friendship Points`
  }
  if (varPath === 'museum.artifacts') return 'Museum Artifacts Donated'
  if (varPath === 'museum.minerals') return 'Museum Minerals Donated'
  if (varPath === 'player.mastery.foraging') return 'Foraging Mastery'
  if (varPath === 'player.mastery.farming') return 'Farming Mastery'
  if (varPath === 'player.mastery.fishing') return 'Fishing Mastery'
  if (varPath === 'player.mastery.mining') return 'Mining Mastery'
  if (varPath === 'player.mastery.combat') return 'Combat Mastery'
  if (varPath === 'player.hearts.anyDateable') return 'Dateable NPC Hearts'
  if (varPath.startsWith('player.hearts.')) {
    const name = varPath.slice('player.hearts.'.length)
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} Hearts`
  }
  if (varPath.startsWith('player.stats.Book_')) return `Read ${varPath.slice('player.stats.Book_'.length).replace(/_/g, ' ')} Book`
  if (varPath === 'player.stats.ticketPrizesClaimed') return 'Fair Ticket Prizes Claimed'
  if (varPath === 'player.stats.hardModeMonstersKilled') return 'Monsters Killed (Hard Mode)'
  return varPath
}

// Known flag clusters that can be collapsed to a single label.
// Each entry: { label, flags: Set<string> }
// A condition AND list matches a group when its mail flags are a superset of the group's flags.
const CONDITION_GROUPS = [
  {
    label: 'All Ginger Island Upgrades Complete',
    flags: new Set([
      'Island_FirstParrot', 'Island_Turtle', 'Island_UpgradeBridge',
      'Island_UpgradeHouse', 'Island_UpgradeParrotPlatform', 'Island_Resort',
      'Island_UpgradeTrader', 'Island_W_Obelisk', 'Island_UpgradeHouse_Mailbox',
      'Island_VolcanoBridge', 'Island_VolcanoShortcutOut',
    ]),
  },
]

/**
 * Convert a single JSON Logic rule to a human-readable string.
 * itemNames: optional { [gameIdStr]: name } map from source.conditionItemNames.
 * Returns null if not formattable.
 */
function formatSingleRule(rule, itemNames, eventNames) {
  if (!rule || typeof rule !== 'object') return null

  if (rule['!']) {
    const inner = rule['!']
    // Fluent negations for known patterns
    if (inner.in) {
      const [value, collection] = inner.in
      if (collection?.var === 'player.items') {
        const name = itemNames?.[String(value)]
        return name ? `Doesn't Have ${name}` : `Doesn't Have Item: ${value}`
      }
      if (collection?.var === 'player.mail') {
        const label = MAIL_FLAG_LABELS[value]
        return label ? `Not: ${label}` : `Mail Flag Not Set: ${value}`
      }
      if (collection?.var === 'player.relationships') return `Not ${value.charAt(0).toUpperCase()}${value.slice(1)}`
    }
    const innerLabel = formatSingleRule(inner, itemNames, eventNames)
    return innerLabel ? `Not: ${innerLabel}` : null
  }

  if (rule['==']) {
    const [left, right] = rule['==']
    if (left?.var) {
      if (left.var === 'player.gender') return `Gender: ${right.charAt(0).toUpperCase()}${right.slice(1)}`
      if (right === true) return formatVarLabel(left.var)
      if (right === false) return `${formatVarLabel(left.var)} (False)`
      return `${formatVarLabel(left.var)} = ${right}`
    }
  }

  if (rule['>=']) {
    const [left, right] = rule['>=']
    if (left?.var) return `${formatVarLabel(left.var)} ≥ ${right}`
  }

  if (rule['in']) {
    const [value, collection] = rule['in']
    if (collection?.var === 'player.mail') return MAIL_FLAG_LABELS[value] ?? `Mail Flag: ${value}`
    if (collection?.var === 'player.achievements') return `Achievement #${value}`
    if (collection?.var === 'player.events') {
      const name = eventNames?.[String(value)]
      return name ? `Seen: ${name}` : `Seen Event #${value}`
    }
    if (collection?.var === 'player.relationships') return `Relationship: ${value}`
    if (collection?.var === 'player.conversationTopics') return `Conversation Topic: ${value}`
    if (collection?.var === 'player.craftingRecipes') return `Knows Recipe: ${value}`
    if (collection?.var === 'player.items') {
      const name = itemNames?.[String(value)]
      return name ? `Has ${name}` : `Has Item: ${value}`
    }
    return `${value} in ${collection?.var ?? '?'}`
  }

  if (rule['or']) {
    return rule['or'].map(r => formatSingleRule(r, itemNames, eventNames)).filter(Boolean).join(' Or ')
  }

  return null
}

/**
 * Convert a JSON Logic condition into an array of human-readable clause strings.
 * AND conditions produce multiple clauses; known clusters are collapsed to one.
 * itemNames: optional { [gameIdStr]: name } from source.conditionItemNames.
 * eventNames: optional { [eventId]: name } from entities.eventNames.
 * Returns [] if nothing is formattable.
 */
export function formatConditionClauses(rule, itemNames, eventNames) {
  if (!rule || typeof rule !== 'object') return []

  if (!rule['and']) {
    const label = formatSingleRule(rule, itemNames, eventNames)
    return label ? [label] : []
  }

  const clauses = rule['and']

  // Check if the mail flags in this AND match a known group
  const mailFlags = new Set(
    clauses.filter(c => c.in && c.in[1]?.var === 'player.mail').map(c => c.in[0])
  )
  const nonFlagClauses = clauses.filter(c => !(c.in && c.in[1]?.var === 'player.mail'))

  for (const group of CONDITION_GROUPS) {
    if ([...group.flags].every(f => mailFlags.has(f))) {
      const remaining = nonFlagClauses.map(r => formatSingleRule(r, itemNames, eventNames)).filter(Boolean)
      return [group.label, ...remaining]
    }
  }

  return clauses.map(r => formatSingleRule(r, itemNames, eventNames)).filter(Boolean)
}

/**
 * Convert a JSON Logic condition to a single human-readable string.
 * For AND conditions, joins clauses with ' + '.
 * itemNames: optional { [gameIdStr]: name } from source.conditionItemNames.
 * eventNames: optional { [eventId]: name } from entities.eventNames.
 * Returns null if not formattable.
 */
export function formatConditionRule(rule, itemNames, eventNames) {
  const clauses = formatConditionClauses(rule, itemNames, eventNames)
  return clauses.length === 0 ? null : clauses.join(' + ')
}

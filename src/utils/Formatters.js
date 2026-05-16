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
 * Derive unique, sorted location names from an entity's sources array.
 * If findById is provided, resolves names via locationId entity lookup.
 * Falls back to source.location string if no entity found.
 */
export function getLocationNames(entity, findById) {
  const sources = entity?.sources || []
  const seen = new Set()
  const names = []
  for (const s of sources) {
    const name = (s.locationId && findById ? findById(s.locationId)?.name : null) || s.location
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names.sort()
}

/**
 * Derive unique location IDs from an entity's sources array.
 * Returns only sources that have a locationId.
 */
export function getLocationIds(entity) {
  const sources = entity?.sources || []
  return [...new Set(sources.filter(s => s.locationId).map(s => s.locationId))]
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
  return `${Number(price).toLocaleString()}g`
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

// ---------------------------------------------------------------------------
// Canonical entity type label (used by GlobalSearch and UniversalModal subtitle)
// ---------------------------------------------------------------------------

// Type-level labels (top tier, formerly "category")
const TYPE_LABELS = {
  'fish': 'Fish',
  'artisan': 'Artisan Goods',
  'forage': 'Forage',
  'crop': 'Crop',
  'seed': 'Seed',
  'mineral': 'Mineral',
  'metal-bar': 'Metal Bar',
  'monster-loot': 'Monster Loot',
  'resource': 'Resource',
  'big-craftable': 'Big Craftable',
  'animal-product': 'Animal Product',
  'tree-fruit': 'Tree Fruit',
  'tree-seed': 'Tree Seed',
  'tree': 'Tree',
  'fruit-tree-sapling': 'Fruit Tree Sapling',
  'ring': 'Ring',
  'book': 'Book',
  'food': 'Food',
  'crafted': 'Crafted Item',
  'bait': 'Bait',
  'tackle': 'Tackle',
  'fertilizer': 'Fertilizer',
  'flooring': 'Flooring',
  'ore': 'Ore',
  'trash': 'Trash',
  'misc': 'Misc',
  'artifact': 'Artifact',
  'furniture': 'Furniture',
  'location': 'Location',
  'buff': 'Buff',
  'event': 'Event',
  'villager': 'Villager',
  'festival': 'Festival',
  'weapon': 'Weapon',
  'boot': 'Boots',
  'trinket': 'Trinket',
  'tool': 'Tool',
  'building': 'Building',
  'animal': 'Farm Animal',
  'monster': 'Monster',
  'breakable': 'Breakable',
  'achievement': 'Achievement',
  'quest': 'Quest',
  'power': 'Power',
  'concession': 'Concession',
  'movie': 'Movie',
  'clothing': 'Clothing',
  'tag': 'Context Tag',
  'type': 'Type',
  'bundle': 'Bundle',
  'museum-reward': 'Museum Reward',
}

// Subtype-level labels (distinct subtypes within a type)
const SUBTYPE_LABELS = {
  // crop subtypes
  'fruit': 'Fruit',
  'vegetable': 'Vegetable',
  'flower': 'Flower',
  // mineral subtypes
  'gem': 'Gem',
  'crystal': 'Crystal',
  'geode-mineral': 'Geode',
  // weapon subtypes
  'sword': 'Sword',
  'dagger': 'Dagger',
  'club': 'Club',
  'slingshot': 'Slingshot',
  // tool subtypes
  'axe': 'Axe',
  'pickaxe': 'Pickaxe',
  'hoe': 'Hoe',
  'fishing-rod': 'Fishing Rod',
  'watering-can': 'Watering Can',
  'milk-pail': 'Milk Pail',
  'shears': 'Shears',
  'pan': 'Pan',
  'wand': 'Wand',
  'generic-tool': 'Tool',
  // animal product subtypes
  'egg': 'Egg',
  'milk': 'Milk',
  // breakable subtypes
  'mine-container': 'Mine Container',
  'stone-node': 'Stone Node',
  'ore-node': 'Ore Node',
  'geode-node': 'Geode Node',
  'gem-node': 'Gem Node',
  'resource-clump': 'Resource Clump',
  // power subtypes
  'mastery': 'Mastery',
  'unlock': 'Unlock',
  // tree subtypes
  'wild-tree': 'Wild Tree',
  'fruit-tree': 'Fruit Tree',
  // location subtypes
  'shop': 'Shop',
  'region': 'Region',
  'map-area': 'Area',
  'zone': 'Zone',
  // clothing subtypes
  'hat': 'Hat',
  'pants': 'Pants',
  'shirt': 'Shirt',
}

/**
 * Returns { type, subtype } labels for an entity.
 * `subtype` is null when there's no distinct subtype.
 */
export function getEntityLabels(entity) {
  if (!entity) return { type: 'Item', subtype: null }
  const typeLabel = TYPE_LABELS[entity.type || entity.entityType] || 'Item'
  // Only show subtype when it's distinct from the type
  // Also suppress when the subtype label resolves to the same text as the type label
  const rawSubtypeLabel = (entity.subtype && entity.subtype !== entity.type)
    ? (SUBTYPE_LABELS[entity.subtype] || null)
    : null
  const subtypeLabel = (rawSubtypeLabel && rawSubtypeLabel !== typeLabel) ? rawSubtypeLabel : null
  return { type: typeLabel, subtype: subtypeLabel }
}

/**
 * Returns a single display label for an entity — prefers subtype over type.
 */
export function getEntityLabel(entity) {
  const { type, subtype } = getEntityLabels(entity)
  return subtype || type
}

/**
 * Returns the full subtitle for an entity — used in the UniversalModal header.
 * Shows "Type - Subtype" when the entity has a distinct subtype.
 */
export function getEntitySubtitle(entity) {
  if (!entity) return ''
  const type = entity.type

  if (type === 'festival') return 'Festival'
  if (type === 'bundle') return entity.room ? `${entity.room} Bundle` : 'Community Center Bundle'

  if (type === 'location' && entity.id?.startsWith('cc-')) return 'Community Center Room'

  if (type === 'buff') return entity.isDebuff ? 'Debuff' : 'Buff'

  if (type === 'event') {
    const base = entity.heartLevel ? `${entity.heartLevel} Heart Event` : 'Event'
    return entity.npc ? `${entity.npc} — ${base}` : base
  }

  if (type === 'villager') {
    return 'Villager'
  }

  if (type === 'quest') {
    return entity.isSecret ? 'Secret Quest' : 'Quest'
  }

  if (type === 'achievement') {
    return entity.isSecret ? 'Secret Achievement' : 'Achievement'
  }

  if (type === 'power') {
    return entity.subtype === 'mastery' ? 'Skill Mastery' : 'Unlock'
  }

  if (type === 'concession') {
    return 'Movie Theater Concession'
  }

  if (type === 'movie') {
    const genres = entity.genres || []
    return genres.length > 0
      ? `Movie Theater — ${genres.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}`
      : 'Movie Theater'
  }

  if (type === 'clothing') {
    if (entity.subtype === 'hat') return 'Hat'
    if (entity.subtype === 'pants') return 'Pants'
    return 'Shirt'
  }

  if (type === 'tag') {
    return 'Context Tag'
  }

  if (type === 'type') {
    return 'Item Type'
  }

  if (type === 'museum-reward') {
    return 'Museum Reward'
  }

  if (type === 'animal') {
    return entity.houseType ? `${entity.houseType} Animal` : 'Farm Animal'
  }

  if (type === 'building') {
    return entity.magical ? 'Magical Building' : 'Farm Building'
  }

  // General case: "Type - Subtype" when distinct subtype exists
  const { type: typeLabel, subtype: subtypeLabel } = getEntityLabels(entity)
  return subtypeLabel ? `${typeLabel} - ${subtypeLabel}` : typeLabel
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
function formatSingleRule(rule, itemNames, eventNames, achievementNames) {
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
    const innerLabel = formatSingleRule(inner, itemNames, eventNames, achievementNames)
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
    if (collection?.var === 'player.achievements') {
      const name = achievementNames?.[String(value)]
      return name ? `Unlocked by: ${name}` : `Achievement #${value}`
    }
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
    return rule['or'].map(r => formatSingleRule(r, itemNames, eventNames, achievementNames)).filter(Boolean).join(' Or ')
  }

  return null
}

/**
 * Convert a JSON Logic condition into an array of human-readable clause strings.
 * AND conditions produce multiple clauses; known clusters are collapsed to one.
 * itemNames: optional { [gameIdStr]: name } from source.conditionItemNames.
 * eventNames: optional { [eventId]: name } from entities.eventNames.
 * achievementNames: optional { [id]: name } from entities.achievementNames.
 * Returns [] if nothing is formattable.
 */
export function formatConditionClauses(rule, itemNames, eventNames, achievementNames) {
  if (!rule || typeof rule !== 'object') return []

  if (!rule['and']) {
    const label = formatSingleRule(rule, itemNames, eventNames, achievementNames)
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
      const remaining = nonFlagClauses.map(r => formatSingleRule(r, itemNames, eventNames, achievementNames)).filter(Boolean)
      return [group.label, ...remaining]
    }
  }

  return clauses.map(r => formatSingleRule(r, itemNames, eventNames, achievementNames)).filter(Boolean)
}

/**
 * Convert a JSON Logic condition to a single human-readable string.
 * For AND conditions, joins clauses with ' + '.
 * itemNames: optional { [gameIdStr]: name } from source.conditionItemNames.
 * eventNames: optional { [eventId]: name } from entities.eventNames.
 * achievementNames: optional { [id]: name } from entities.achievementNames.
 * Returns null if not formattable.
 */
export function formatConditionRule(rule, itemNames, eventNames, achievementNames) {
  const clauses = formatConditionClauses(rule, itemNames, eventNames, achievementNames)
  return clauses.length === 0 ? null : clauses.join(' + ')
}

/**
 * Compute the probability distribution of how many of an item drop from a monster kill,
 * given an array of independent roll probabilities.
 *
 * Each roll is an independent Bernoulli trial. Returns an array of { count, chance }
 * objects sorted by count descending, omitting entries with negligible probability.
 * For a single roll, returns [{ count: 1, chance: roll }] (no zero entry).
 */
/**
 * Format a probability (0–1) as a percentage string with enough precision
 * to avoid showing "0%" for small but nonzero values.
 * e.g. 0.9 → "90%", 0.015 → "1.5%", 0.001 → "0.1%", 0.0005 → "0.05%"
 */
export function formatChance(p) {
  const pct = p * 100
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${parseFloat(pct.toFixed(1))}%`
  if (pct >= 0.1) return `${parseFloat(pct.toFixed(2))}%`
  return `${parseFloat(pct.toFixed(3))}%`
}

/**
 * Formats a raw game unlock condition string into human-readable text.
 * e.g. "YEAR 2" → "Year 2+", "PLAYER_HAS_MAIL Host addedParrotBoy" → "Unlocked via story progression"
 */
export function formatUnlockCondition(raw) {
  if (!raw) return null
  const yearMatch = raw.match(/^YEAR\s+(\d+)$/i)
  if (yearMatch) return `Year ${yearMatch[1]}+`
  if (/PLAYER_HAS_MAIL/i.test(raw)) return 'Unlocked via story progression'
  return raw
}

export function computeDropCountDistribution(rolls) {
  if (!rolls || rolls.length === 0) return []
  if (rolls.length === 1) return [{ count: 1, chance: rolls[0] }]

  // Enumerate all 2^n outcomes
  const n = rolls.length
  const countProbs = new Array(n + 1).fill(0)
  for (let mask = 0; mask < (1 << n); mask++) {
    let p = 1
    let count = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) { p *= rolls[i]; count++ }
      else p *= (1 - rolls[i])
    }
    countProbs[count] += p
  }

  return countProbs
    .map((chance, count) => ({ count, chance }))
    .filter(({ count, chance }) => count > 0 && chance >= 0.0001)
    .sort((a, b) => b.count - a.count)
}

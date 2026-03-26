/**
 * Stardew Valley save file parser.
 * Pure utility — no React dependencies. Uses native DOMParser.
 *
 * Accepts either:
 *   - SaveGameInfo file (~170KB) — root element <Farmer>
 *   - Main save file (~3.8MB)   — root element <SaveGame>
 */

// Profession integer IDs → keys (from data/rules/profession-ids.json)
const PROFESSION_ID_MAP = {
  0: 'rancher', 1: 'tiller', 2: 'coopmaster', 3: 'shepherd', 4: 'artisan', 5: 'agriculturist',
  6: 'fisher', 7: 'trapper', 8: 'angler', 9: 'pirate', 10: 'mariner', 11: 'luremaster',
  12: 'forester', 13: 'gatherer', 14: 'lumberjack', 15: 'tapper', 16: 'botanist', 17: 'tracker',
  18: 'miner', 19: 'geologist', 20: 'blacksmith', 21: 'prospector', 22: 'excavator', 23: 'gemologist',
  24: 'fighter', 25: 'scout', 26: 'brute', 27: 'defender', 28: 'acrobat', 29: 'desperado',
}

const SEASON_MAP = { 0: 'spring', 1: 'summer', 2: 'fall', 3: 'winter' }

// ---------------------------------------------------------------------------
// Generic XML helpers
// ---------------------------------------------------------------------------

/** Get the text content of a direct child element by tag name. */
function childText(parent, tagName) {
  const el = parent.querySelector(`:scope > ${tagName}`)
  return el?.textContent?.trim() ?? null
}

/** Get an integer from a direct child element. Returns null if missing. */
function childInt(parent, tagName) {
  const text = childText(parent, tagName)
  if (text == null) return null
  const n = parseInt(text, 10)
  return isNaN(n) ? null : n
}

/** Parse all <int> children into a number array. */
function parseIntArray(parent) {
  if (!parent) return []
  return Array.from(parent.querySelectorAll(':scope > int'))
    .map(el => parseInt(el.textContent, 10))
    .filter(n => !isNaN(n))
}

/** Parse all <string> children into a string array. */
function parseStringArray(parent) {
  if (!parent) return []
  return Array.from(parent.querySelectorAll(':scope > string'))
    .map(el => el.textContent?.trim())
    .filter(Boolean)
}

/**
 * Parse a Stardew dictionary element (<item><key>...<value>...) into entries.
 * Returns array of { key, valueElement } for flexible value parsing.
 */
function parseDictionaryEntries(dictElement) {
  if (!dictElement) return []
  return Array.from(dictElement.querySelectorAll(':scope > item')).map(item => {
    const keyEl = item.querySelector(':scope > key')
    const valueEl = item.querySelector(':scope > value')
    const key = keyEl?.querySelector('string')?.textContent?.trim()
      ?? keyEl?.querySelector('int')?.textContent?.trim()
      ?? keyEl?.textContent?.trim()
    return { key, valueElement: valueEl }
  }).filter(e => e.key != null)
}

/**
 * Parse a dictionary where values are simple <int> elements.
 * Returns { key: number }.
 */
function parseDictionaryOfInts(dictElement) {
  const result = {}
  for (const { key, valueElement } of parseDictionaryEntries(dictElement)) {
    const val = valueElement?.querySelector('int')?.textContent
    if (val != null) result[key] = parseInt(val, 10)
  }
  return result
}

// ---------------------------------------------------------------------------
// Section extractors
// ---------------------------------------------------------------------------

function extractSkills(playerEl) {
  return {
    farming: childInt(playerEl, 'farmingLevel') ?? 0,
    mining: childInt(playerEl, 'miningLevel') ?? 0,
    fishing: childInt(playerEl, 'fishingLevel') ?? 0,
    foraging: childInt(playerEl, 'foragingLevel') ?? 0,
    combat: childInt(playerEl, 'combatLevel') ?? 0,
  }
}

function extractProfessions(playerEl) {
  const profEl = playerEl.querySelector(':scope > professions')
  return parseIntArray(profEl)
}

function extractFishCaught(playerEl) {
  const dictEl = playerEl.querySelector(':scope > fishCaught')
  const result = {}
  for (const { key, valueElement } of parseDictionaryEntries(dictEl)) {
    const ints = parseIntArray(valueElement?.querySelector('ArrayOfInt'))
    const qualifiedKey = key.startsWith('(') ? key : `(O)${key}`
    result[qualifiedKey] = { count: ints[0] ?? 0, maxSize: ints[1] ?? 0 }
  }
  return result
}

function extractItemsShipped(playerEl) {
  const dictEl = playerEl.querySelector(':scope > basicShipped')
  const raw = parseDictionaryOfInts(dictEl)
  const result = {}
  for (const [key, count] of Object.entries(raw)) {
    const qualifiedKey = key.startsWith('(') ? key : `(O)${key}`
    result[qualifiedKey] = count
  }
  return result
}

function extractCookingRecipes(playerEl) {
  const dictEl = playerEl.querySelector(':scope > cookingRecipes')
  return parseDictionaryOfInts(dictEl)
}

function extractCraftingRecipes(playerEl) {
  const dictEl = playerEl.querySelector(':scope > craftingRecipes')
  return parseDictionaryOfInts(dictEl)
}

function extractFriendships(playerEl) {
  const dictEl = playerEl.querySelector(':scope > friendshipData')
  const result = {}
  for (const { key, valueElement } of parseDictionaryEntries(dictEl)) {
    const friendship = valueElement?.querySelector('Friendship')
    if (!friendship) continue
    result[key] = {
      points: childInt(friendship, 'Points') ?? 0,
      status: childText(friendship, 'Status') ?? 'Friendly',
    }
  }
  return result
}

function extractAchievements(playerEl) {
  const el = playerEl.querySelector(':scope > achievements')
  return parseIntArray(el)
}

function extractMailReceived(playerEl) {
  const el = playerEl.querySelector(':scope > mailReceived')
  return parseStringArray(el)
}

function extractArchaeologyFound(playerEl) {
  const dictEl = playerEl.querySelector(':scope > archaeologyFound')
  const result = {}
  for (const { key, valueElement } of parseDictionaryEntries(dictEl)) {
    const qualifiedKey = key.startsWith('(') ? key : `(O)${key}`
    const ints = parseIntArray(valueElement?.querySelector('ArrayOfInt'))
    result[qualifiedKey] = ints[0] ?? 1
  }
  return result
}

function extractMineralsFound(playerEl) {
  const dictEl = playerEl.querySelector(':scope > mineralsFound')
  const raw = parseDictionaryOfInts(dictEl)
  const result = {}
  for (const [key, count] of Object.entries(raw)) {
    const qualifiedKey = key.startsWith('(') ? key : `(O)${key}`
    result[qualifiedKey] = count
  }
  return result
}

function extractStats(playerEl) {
  const statsEl = playerEl.querySelector(':scope > stats')
  if (!statsEl) return {}
  const valuesEl = statsEl.querySelector(':scope > Values')
  if (!valuesEl) return {}
  const result = {}
  for (const { key, valueElement } of parseDictionaryEntries(valuesEl)) {
    const val = valueElement?.querySelector('int')?.textContent
      ?? valueElement?.querySelector('unsignedInt')?.textContent
      ?? valueElement?.querySelector('string')?.textContent
    if (val != null) {
      const num = parseInt(val, 10)
      result[key] = isNaN(num) ? val : num
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Date extraction — different tag names in SaveGameInfo vs main save
// ---------------------------------------------------------------------------

function extractDateFromSaveGameInfo(playerEl) {
  const day = childInt(playerEl, 'dayOfMonthForSaveGame')
  const seasonInt = childInt(playerEl, 'seasonForSaveGame')
  const year = childInt(playerEl, 'yearForSaveGame')
  return {
    day: day ?? 1,
    season: SEASON_MAP[seasonInt] ?? 'spring',
    year: year ?? 1,
  }
}

function extractDateFromMainSave(doc) {
  // Main save stores date at the root level or under specific location data
  const day = childInt(doc.documentElement, 'dayOfMonth')
    ?? childInt(doc.documentElement, 'dayOfMonthForSaveGame')
  const seasonText = childText(doc.documentElement, 'currentSeason')
  const seasonInt = childInt(doc.documentElement, 'seasonForSaveGame')
  const year = childInt(doc.documentElement, 'year')
    ?? childInt(doc.documentElement, 'yearForSaveGame')
  return {
    day: day ?? 1,
    season: seasonText ?? SEASON_MAP[seasonInt] ?? 'spring',
    year: year ?? 1,
  }
}

// ---------------------------------------------------------------------------
// Bundle extraction (main save only)
// ---------------------------------------------------------------------------

function extractBundleProgress(doc) {
  // Bundle completion booleans live inside the CommunityCenter location:
  // <locations> > <GameLocation> > <name>CommunityCenter</name> > <bundles> > <item>...
  const locations = doc.documentElement.querySelector(':scope > locations')
  if (!locations) return null

  let bundlesEl = null
  for (const loc of locations.children) {
    const nameEl = loc.querySelector(':scope > name')
    if (nameEl?.textContent?.trim() === 'CommunityCenter') {
      bundlesEl = loc.querySelector(':scope > bundles')
      break
    }
  }
  if (!bundlesEl) return null

  const progress = {}
  for (const { key, valueElement } of parseDictionaryEntries(bundlesEl)) {
    const boolEls = valueElement?.querySelector('ArrayOfBoolean')
    if (!boolEls) continue
    const bools = Array.from(boolEls.querySelectorAll(':scope > boolean'))
      .map(el => el.textContent?.trim() === 'true')
    progress[key] = bools
  }
  return progress
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a Stardew Valley save file XML string.
 * @param {string} xmlString - Raw XML content of either SaveGameInfo or main save file
 * @returns {{ source: string, ...parsedData }} Parsed save data
 * @throws {Error} If the XML is invalid or unrecognized
 */
export function parseSaveFile(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid XML file. Please upload a Stardew Valley save file.')
  }

  const rootName = doc.documentElement.tagName

  if (rootName === 'Farmer') {
    return parseSaveGameInfo(doc)
  } else if (rootName === 'SaveGame') {
    return parseMainSave(doc)
  } else {
    throw new Error(`Unrecognized file format (root element: <${rootName}>). Expected a Stardew Valley save file.`)
  }
}

function parseSaveGameInfo(doc) {
  const player = doc.documentElement // <Farmer> is the root

  return {
    source: 'SaveGameInfo',
    name: childText(player, 'name') ?? '',
    farmName: childText(player, 'farmName') ?? '',
    skills: extractSkills(player),
    professionIds: extractProfessions(player),
    fishCaught: extractFishCaught(player),
    itemsShipped: extractItemsShipped(player),
    cookingRecipes: extractCookingRecipes(player),
    craftingRecipes: extractCraftingRecipes(player),
    friendships: extractFriendships(player),
    achievements: extractAchievements(player),
    mailReceived: extractMailReceived(player),
    archaeologyFound: extractArchaeologyFound(player),
    mineralsFound: extractMineralsFound(player),
    date: extractDateFromSaveGameInfo(player),
    stats: extractStats(player),
  }
}

function parseMainSave(doc) {
  const player = doc.documentElement.querySelector(':scope > player')
  if (!player) {
    throw new Error('Could not find <player> element in save file.')
  }

  return {
    source: 'SaveGame',
    name: childText(player, 'name') ?? '',
    farmName: childText(player, 'farmName') ?? '',
    skills: extractSkills(player),
    professionIds: extractProfessions(player),
    fishCaught: extractFishCaught(player),
    itemsShipped: extractItemsShipped(player),
    cookingRecipes: extractCookingRecipes(player),
    craftingRecipes: extractCraftingRecipes(player),
    friendships: extractFriendships(player),
    achievements: extractAchievements(player),
    mailReceived: extractMailReceived(player),
    archaeologyFound: extractArchaeologyFound(player),
    mineralsFound: extractMineralsFound(player),
    date: extractDateFromMainSave(doc),
    stats: extractStats(player),
    // Main save extras
    bundleProgress: extractBundleProgress(doc),
    grandpaScore: childInt(doc.documentElement, 'grandpaScore') ?? null,
    goldenWalnuts: childInt(doc.documentElement, 'goldenWalnutsFound') ?? null,
  }
}

/**
 * Map profession integer IDs from a save file to the profession keys used in PlayerContext.
 * Only returns keys that exist in the player's professions object (price-affecting ones).
 * @param {number[]} professionIds - Array of profession integer IDs from save
 * @returns {Object} Professions object matching PlayerContext shape
 */
export function mapProfessionIds(professionIds) {
  const priceAffectingKeys = new Set([
    'tiller', 'artisan', 'rancher', 'fisher', 'angler', 'tapper', 'blacksmith', 'gemologist',
  ])
  const result = {}
  for (const key of priceAffectingKeys) {
    result[key] = false
  }
  for (const id of professionIds) {
    const key = PROFESSION_ID_MAP[id]
    if (key && priceAffectingKeys.has(key)) {
      result[key] = true
    }
  }
  return result
}

/**
 * Get all profession labels for display (not just price-affecting ones).
 * @param {number[]} professionIds - Array of profession integer IDs from save
 * @returns {string[]} Array of profession labels
 */
export function getProfessionLabels(professionIds) {
  return professionIds
    .map(id => PROFESSION_ID_MAP[id])
    .filter(Boolean)
    .map(key => key.charAt(0).toUpperCase() + key.slice(1))
}

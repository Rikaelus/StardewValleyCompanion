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
// Museum donation extraction (main save only)
// ---------------------------------------------------------------------------

/**
 * Walk every NPC across all locations and return those matching a given
 * xsi:type. Children and pets live in the FarmHouse location's characters.
 */
function findNpcsByType(doc, xsiType) {
  const locations = doc.documentElement.querySelector(':scope > locations')
  if (!locations) return []
  const matches = []
  for (const loc of locations.children) {
    const characters = loc.querySelector(':scope > characters')
    if (!characters) continue
    for (const npc of characters.children) {
      const type = npc.getAttribute('xsi:type') || npc.getAttribute('type')
      if (type === xsiType) matches.push(npc)
    }
  }
  return matches
}

function countChildren(doc) {
  return findNpcsByType(doc, 'Child').length
}

/**
 * Return the maximum friendshipTowardFarmer across all pet NPCs (game allows
 * multiple pets in 1.6). Returns null if no pet exists.
 */
function extractPetFriendship(doc) {
  const pets = findNpcsByType(doc, 'Pet')
  if (pets.length === 0) return null
  let max = 0
  for (const pet of pets) {
    const v = childInt(pet, 'friendshipTowardFarmer') ?? 0
    if (v > max) max = v
  }
  return max
}

// xsi:type → qualified-id namespace prefix, mirroring entities.json convention.
// Clothing is handled specially below (needs <clothesType> to disambiguate
// shirt vs pants, both of which serialize as xsi:type="Clothing").
const XSI_TYPE_TO_PREFIX = {
  Object: '(O)',
  ColoredObject: '(O)',
  Ring: '(O)',
  Torch: '(O)',
  MeleeWeapon: '(W)',
  Slingshot: '(W)',
  Boots: '(B)',
  Hat: '(H)',
  Furniture: '(F)',
  BedFurniture: '(F)',
  FishTankFurniture: '(F)',
  // Tools
  Axe: '(T)',
  Hoe: '(T)',
  Pickaxe: '(T)',
  WateringCan: '(T)',
  FishingRod: '(T)',
  MilkPail: '(T)',
  Pan: '(T)',
  Shears: '(T)',
}

function clothingPrefix(itemEl) {
  // <clothesType> is "SHIRT" or "PANTS" — the only reliable way to tell the
  // two clothing variants apart, since they share xsi:type="Clothing".
  const ct = childText(itemEl, 'clothesType')
  if (ct === 'SHIRT') return '(S)'
  if (ct === 'PANTS') return '(P)'
  return null
}

/**
 * Extract a single <Item> element into a normalized record, or null if we
 * can't determine its qualified game id.
 *
 * Special cases:
 *  - Big Craftables serialize as xsi:type="Object" but with <bigCraftable>true</bigCraftable>.
 *    They live in the (BC) namespace in our entities.
 *  - Clothing serializes as xsi:type="Clothing" for both shirts and pants;
 *    disambiguated via clothingPrefix() reading <clothesType>.
 */
function extractItemRecord(itemEl) {
  const xsiType = itemEl.getAttribute('xsi:type') || itemEl.getAttribute('type')
  let prefix = XSI_TYPE_TO_PREFIX[xsiType]
  if (!prefix && xsiType === 'Clothing') prefix = clothingPrefix(itemEl)
  if (!prefix) return null  // skip unhandled types (Cask, CrabPot output, etc.)

  // Big Craftables override Object → BC
  if ((xsiType === 'Object' || xsiType === 'ColoredObject') &&
      childText(itemEl, 'bigCraftable') === 'true') {
    prefix = '(BC)'
  }

  const itemId = childText(itemEl, 'itemId')
  if (!itemId) return null

  const qualified = itemId.startsWith('(') ? itemId : `${prefix}${itemId}`
  const stack = childInt(itemEl, 'stack') ?? 1
  const quality = childInt(itemEl, 'quality') ?? 0
  return { gameId: qualified, count: stack, quality }
}

/**
 * Walk a parent element's <items> child for <Item> sub-elements and emit
 * normalized records. Used for both player inventory and chest contents.
 */
function extractItemsFromContainer(parentEl) {
  const itemsEl = parentEl.querySelector(':scope > items')
  if (!itemsEl) return []
  const records = []
  for (const itemEl of itemsEl.children) {
    if (itemEl.tagName !== 'Item') continue  // skip null-item placeholders
    const rec = extractItemRecord(itemEl)
    if (rec) records.push(rec)
  }
  return records
}

/**
 * Walk every chest-like container in every location, returning records.
 * Includes:
 *   - Standalone Chest objects in <objects> (regular chests, Mini-Fridges,
 *     Mini-Shipping Bins — distinguished by their <name> field)
 *   - Building-attached chests in <buildings>/<buildingChests> (Junimo Hut
 *     output, Mill output, Stable storage in 1.6, etc.)
 *
 * The chest's `name` field becomes the container label, so a Mini-Fridge
 * shows up as "Mini-Fridge" rather than the generic "chest".
 *
 * Cask outputs, Crab Pot held items, and similar transient containers are
 * skipped — they belong to the machine, not "storage".
 */
function extractChestContents(doc) {
  const locations = doc.documentElement.querySelector(':scope > locations')
  if (!locations) return []
  const out = []

  function emitChest(chestEl, locName, fallbackContainer = 'Chest') {
    const chestName = childText(chestEl, 'name') || fallbackContainer
    const records = extractItemsFromContainer(chestEl)
    for (const r of records) {
      out.push({ ...r, location: locName, container: chestName })
    }
  }

  for (const loc of locations.children) {
    const locName = childText(loc, 'name') || 'Unknown'

    // 1. Standalone chests in <objects>
    const objects = loc.querySelector(':scope > objects')
    if (objects) {
      for (const item of objects.querySelectorAll(':scope > item')) {
        const value = item.querySelector(':scope > value')
        const obj = value?.querySelector(':scope > Object')
        if (!obj) continue
        const xsiType = obj.getAttribute('xsi:type') || obj.getAttribute('type')
        if (xsiType !== 'Chest') continue
        emitChest(obj, locName)
      }
    }

    // 2. Building-attached chests (Junimo Hut output, Mill, Stable, etc.)
    // Each <Building> has <buildingChests><Chest>...</Chest></buildingChests>
    const buildings = loc.querySelector(':scope > buildings')
    if (buildings) {
      for (const building of buildings.children) {
        const bcEl = building.querySelector(':scope > buildingChests')
        if (!bcEl) continue
        for (const chest of bcEl.children) {
          if (chest.tagName !== 'Chest') continue
          // Building chests don't have their own meaningful name field; use
          // the building type for the container label.
          const buildingType = childText(building, 'buildingType') || 'Building'
          emitChest(chest, locName, buildingType)
        }
      }
    }
  }
  return out
}

/**
 * Extract player main inventory + equipped slots into a flat record array.
 * Each record: { gameId, count, quality, location: 'inventory' | 'equipped' }
 */
function extractPlayerInventory(playerEl) {
  const out = []
  // Main inventory
  for (const r of extractItemsFromContainer(playerEl)) {
    out.push({ ...r, location: 'inventory', container: 'player' })
  }
  // Equipped slots — each holds at most one item
  const equipSlots = ['hat', 'shirtItem', 'pantsItem', 'boots', 'leftRing', 'rightRing']
  for (const slotName of equipSlots) {
    const slot = playerEl.querySelector(`:scope > ${slotName}`)
    if (!slot) continue
    // Slot is a single <Item>-shaped element, not a wrapper around <Item>
    if (childText(slot, 'itemId') == null) continue
    // Treat the slot itself as if it were an <Item> element
    const rec = extractItemRecord(slot)
    if (rec) out.push({ ...rec, location: 'equipped', container: slotName })
  }
  return out
}

/**
 * Build the inventory aggregate exposed via parsedSave.inventory:
 *   { items: Array, byGameId: { [gameId]: { totalCount, locations: Array } } }
 */
function buildInventoryAggregate(playerInv, chestInv) {
  const all = [...playerInv, ...chestInv]
  const byGameId = {}
  for (const rec of all) {
    if (!byGameId[rec.gameId]) {
      byGameId[rec.gameId] = { totalCount: 0, locations: [] }
    }
    byGameId[rec.gameId].totalCount += rec.count
    byGameId[rec.gameId].locations.push({
      location: rec.location,
      container: rec.container,
      count: rec.count,
      quality: rec.quality,
    })
  }
  return { items: all, byGameId }
}

function extractMuseumPieces(doc) {
  // museumPieces lives inside the ArchaeologyHouse GameLocation, not at the
  // document root. Each entry: <item><key><Vector2>...</key><value><string>ID</string></value></item>
  // 1.6 changed values from <int> to <string> because item IDs can now be
  // non-numeric (e.g. "Carrot"). Numeric IDs get the (O) prefix.
  const locations = doc.documentElement.querySelector(':scope > locations')
  if (!locations) return null

  let dictEl = null
  for (const loc of locations.children) {
    const nameEl = loc.querySelector(':scope > name')
    if (nameEl?.textContent?.trim() === 'ArchaeologyHouse') {
      dictEl = loc.querySelector(':scope > museumPieces')
      break
    }
  }
  if (!dictEl) return null

  const donated = new Set()
  for (const item of dictEl.querySelectorAll(':scope > item')) {
    const val = item.querySelector('value > string')?.textContent?.trim()
      ?? item.querySelector('value > int')?.textContent?.trim()
    if (!val) continue
    const qualified = val.startsWith('(') ? val : `(O)${val}`
    donated.add(qualified)
  }
  return [...donated]
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
    totalMoneyEarned: childInt(player, 'totalMoneyEarned') ?? 0,
    houseUpgradeLevel: childInt(player, 'houseUpgradeLevel') ?? 0,
    spouse: childText(player, 'spouse'),
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
    museumPieces: extractMuseumPieces(doc),
    grandpaScore: childInt(doc.documentElement, 'grandpaScore') ?? null,
    goldenWalnuts: childInt(doc.documentElement, 'goldenWalnutsFound') ?? null,
    totalMoneyEarned: childInt(player, 'totalMoneyEarned') ?? 0,
    houseUpgradeLevel: childInt(player, 'houseUpgradeLevel') ?? 0,
    spouse: childText(player, 'spouse'),
    childCount: countChildren(doc),
    petFriendship: extractPetFriendship(doc),
    inventory: buildInventoryAggregate(
      extractPlayerInventory(player),
      extractChestContents(doc),
    ),
  }
}

/**
 * Map profession integer IDs from a save file to the profession keys used in PlayerContext.
 * Maps all 30 professions.
 * @param {number[]} professionIds - Array of profession integer IDs from save
 * @returns {Object} Professions object matching PlayerContext shape
 */
export function mapProfessionIds(professionIds) {
  const result = {}
  for (const key of Object.values(PROFESSION_ID_MAP)) {
    result[key] = false
  }
  for (const id of professionIds) {
    const key = PROFESSION_ID_MAP[id]
    if (key) {
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

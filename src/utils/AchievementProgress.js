/**
 * Centralized achievement progress computation.
 *
 * Returns a Map<achievementId, { done, total, label, linkPath }> for all
 * achievements where meaningful progress can be shown. Achievements that are
 * purely binary (Ginger Island, Perfection, etc.) are omitted — those rows
 * still get a linkPath if one exists, but no done/total counter.
 *
 * Call once per render with the full items array and the progress object from
 * useProgress(). Both callers (AchievementsPage, future dashboard) pick the
 * entries they need by achievement ID.
 */

// ---------------------------------------------------------------------------
// Shared constants — imported by ShippingPage and FullShipmentPage
// ---------------------------------------------------------------------------

export const POLYCULTURE_TARGET = 15
export const MONOCULTURE_TARGET = 300

// The 28 crops required for Polyculture (ship 15 of each)
export const POLYCULTURE_NAMES = new Set([
  'Cauliflower', 'Coffee Bean', 'Garlic', 'Green Bean', 'Kale', 'Parsnip', 'Potato', 'Rhubarb', 'Strawberry',
  'Blueberry', 'Corn', 'Hops', 'Hot Pepper', 'Melon', 'Radish', 'Red Cabbage', 'Starfruit', 'Tomato', 'Wheat',
  'Amaranth', 'Artichoke', 'Beet', 'Bok Choy', 'Cranberries', 'Eggplant', 'Grape', 'Pumpkin', 'Yam',
])

// 5 additional crops that count for Monoculture but not Polyculture
export const MONOCULTURE_ONLY_NAMES = new Set([
  'Ancient Fruit', 'Blue Jazz', 'Fairy Rose', 'Summer Spangle', 'Tulip',
])

// All item names required for the Full Shipment achievement
export const FULL_SHIPMENT_NAMES = new Set([
  // Crops & Forage
  'Parsnip', 'Green Bean', 'Cauliflower', 'Potato', 'Garlic', 'Kale', 'Rhubarb',
  'Melon', 'Tomato', 'Blueberry', 'Hot Pepper', 'Wheat', 'Radish', 'Red Cabbage',
  'Starfruit', 'Corn', 'Unmilled Rice', 'Eggplant', 'Artichoke', 'Pumpkin',
  'Bok Choy', 'Yam', 'Cranberries', 'Beet', 'Amaranth', 'Hops', 'Poppy',
  'Strawberry', 'Ancient Fruit', 'Tulip', 'Summer Spangle', 'Fairy Rose', 'Blue Jazz',
  'Coffee Bean', 'Sweet Gem Berry', 'Tea Leaves', 'Ginger', 'Taro Root',
  'Pineapple', 'Mango', 'Carrot', 'Summer Squash', 'Broccoli', 'Powdermelon',
  'Wild Horseradish', 'Daffodil', 'Leek', 'Dandelion', 'Cave Carrot',
  'Coconut', 'Cactus Fruit', 'Banana', 'Salmonberry', 'Morel',
  'Fiddlehead Fern', 'Chanterelle', 'Holly', 'Ostrich Egg',
  'Spring Onion', 'Sweet Pea', 'Common Mushroom', 'Wild Plum', 'Hazelnut',
  'Blackberry', 'Winter Root', 'Crystal Fruit', 'Snow Yam', 'Crocus',
  'Red Mushroom', 'Sunflower', 'Purple Mushroom', 'Grape', 'Spice Berry',
  'Magma Cap', 'Green Tea',
  // Animal Products
  'Egg (White)', 'Large Egg (White)', 'Egg (Brown)', 'Large Egg (Brown)',
  'Milk', 'Large Milk', 'Void Egg', 'Duck Egg', 'Goat Milk', 'L. Goat Milk',
  'Duck Feather', 'Wool', "Rabbit's Foot", 'Truffle',
  'Mayonnaise', 'Duck Mayonnaise', 'Void Mayonnaise', 'Dinosaur Mayonnaise',
  'Cheese', 'Goat Cheese', 'Cloth', 'Truffle Oil', 'Caviar',
  // Artisan & Processed
  'Honey', 'Pickles', 'Jelly', 'Beer', 'Pale Ale', 'Wine', 'Juice', 'Mead',
  'Maple Syrup', 'Oak Resin', 'Pine Tar', 'Mystic Syrup',
  'Roe', 'Aged Roe', 'Smoked Fish', 'Squid Ink',
  'Raisins', 'Dried Fruit', 'Dried Mushrooms',
  // Resources & Materials
  'Wood', 'Stone', 'Hardwood', 'Sap', 'Fiber', 'Clay', 'Coal', 'Moss',
  'Copper Ore', 'Iron Ore', 'Gold Ore', 'Iridium Ore', 'Radioactive Ore',
  'Copper Bar', 'Iron Bar', 'Gold Bar', 'Iridium Bar', 'Radioactive Bar', 'Refined Quartz',
  'Battery Pack', 'Bone Fragment', 'Cinder Shard',
  // Fish Tank & Other
  'Nautilus Shell', 'Coral', 'Rainbow Shell', 'Sea Urchin',
  'Bug Meat', 'Slime', 'Bat Wing', 'Solar Essence', 'Void Essence',
])

// ---------------------------------------------------------------------------
// Friendship thresholds (mirrored from ShrineScore — both reference same wiki rule)
// ---------------------------------------------------------------------------

const FIVE_HEART_POINTS  = 1225  // 4.9 hearts — wiki uses 1250 (5 hearts = 5×250)
const EIGHT_HEART_POINTS = 1975  // wiki note: check uses 1975, not 2000

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Compute progress for every achievement that has a meaningful counter or link.
 *
 * @param {Array} items - Full entity array from useEntities()
 * @param {Object} progress - Object from useProgress()
 * @returns {Map<number, { done?: number, total?: number, label?: string, linkPath?: string }>}
 */
export function computeAchievementProgress(items, progress) {
  const result = new Map()

  // Helpers
  function entry(id, obj) { result.set(id, obj) }

  // ----- Wealth (IDs 0–4) — cumulative threshold -----
  const money = progress.totalMoneyEarned ?? 0
  const moneyTiers = [
    { id: 0, threshold:   15000 },
    { id: 1, threshold:   50000 },
    { id: 2, threshold:  250000 },
    { id: 3, threshold: 1000000 },
    { id: 4, threshold: 10000000 },
  ]
  for (const { id, threshold } of moneyTiers) {
    entry(id, { done: money, total: threshold, label: 'g earned', format: 'gold' })
  }

  // ----- Cooking (IDs 15, 16, 17) -----
  if (progress.hasSaveData) {
    const cookable = items.filter(i => i.capabilities?.cookable && i.sources?.some(s => s.type === 'cooking'))
    const cooked = cookable.filter(i => {
      const src = i.sources.find(s => s.type === 'cooking')
      return src && progress.isRecipeCooked(i.gameId)
    }).length
    const cookTotal = cookable.length
    entry(15, { done: cooked, total: 10,        label: 'recipes cooked', linkPath: '/tracker/cooking' })
    entry(16, { done: cooked, total: 25,        label: 'recipes cooked', linkPath: '/tracker/cooking' })
    entry(17, { done: cooked, total: cookTotal, label: 'recipes cooked', linkPath: '/tracker/cooking' })
  } else {
    entry(15, { linkPath: '/tracker/cooking' })
    entry(16, { linkPath: '/tracker/cooking' })
    entry(17, { linkPath: '/tracker/cooking' })
  }

  // ----- Crafting (IDs 20, 21, 22) -----
  if (progress.hasSaveData) {
    const craftable = items.filter(i => i.capabilities?.craftable && i.sources?.some(s => s.type === 'crafting'))
    const crafted = craftable.filter(i => {
      const src = i.sources.find(s => s.type === 'crafting')
      return src && progress.isCraftingRecipeCrafted(src.recipeName)
    }).length
    const craftTotal = craftable.length
    entry(20, { done: crafted, total: 15,         label: 'items crafted', linkPath: '/tracker/crafting' })
    entry(21, { done: crafted, total: 30,         label: 'items crafted', linkPath: '/tracker/crafting' })
    entry(22, { done: crafted, total: craftTotal, label: 'items crafted', linkPath: '/tracker/crafting' })
  } else {
    entry(20, { linkPath: '/tracker/crafting' })
    entry(21, { linkPath: '/tracker/crafting' })
    entry(22, { linkPath: '/tracker/crafting' })
  }

  // ----- Fishing — unique species (IDs 24, 25, 26) -----
  const allFish = items.filter(i => i.type === 'fish')
  if (progress.hasSaveData) {
    const caughtSpecies = allFish.filter(i => progress.isFishCaught(i.gameId)).length
    const fishTotal = allFish.length
    entry(24, { done: caughtSpecies, total: 10,        label: 'fish caught', linkPath: '/tracker/fishing' })
    entry(25, { done: caughtSpecies, total: 24,        label: 'fish caught', linkPath: '/tracker/fishing' })
    entry(26, { done: caughtSpecies, total: fishTotal, label: 'fish caught', linkPath: '/tracker/fishing' })
  } else {
    entry(24, { linkPath: '/tracker/fishing' })
    entry(25, { linkPath: '/tracker/fishing' })
    entry(26, { linkPath: '/tracker/fishing' })
  }

  // ----- Mother Catch — 100 fish total (ID 27) -----
  if (progress.hasSaveData) {
    const totalCaught = progress.totalFishCaught ?? 0
    entry(27, { done: totalCaught, total: 100, label: 'fish caught total', linkPath: '/tracker/fishing' })
  } else {
    entry(27, { linkPath: '/tracker/fishing' })
  }

  // ----- Museum (IDs 28, 5) -----
  const donatable = items.filter(i => i.museumDonatable)
  if (progress.hasSaveData) {
    const donated = donatable.filter(i => progress.isMuseumDonated(i.gameId)).length
    const museumTotal = donatable.length
    entry(28, { done: donated, total: 40,          label: 'items donated', linkPath: '/tracker/museum' })
    entry(5,  { done: donated, total: museumTotal, label: 'items donated', linkPath: '/tracker/museum' })
  } else {
    entry(28, { linkPath: '/tracker/museum' })
    entry(5,  { linkPath: '/tracker/museum' })
  }

  // ----- Polyculture (ID 31) -----
  const polyCrops = items.filter(i => i.type === 'crop' && POLYCULTURE_NAMES.has(i.name))
  if (progress.hasSaveData) {
    const polyDone = polyCrops.filter(i => progress.getItemShippedCount(i.gameId) >= POLYCULTURE_TARGET).length
    entry(31, { done: polyDone, total: polyCrops.length, label: `crops shipped ×${POLYCULTURE_TARGET}`, linkPath: '/tracker/shipping' })
  } else {
    entry(31, { linkPath: '/tracker/shipping' })
  }

  // ----- Monoculture (ID 32) -----
  const monoCandidates = items.filter(i => i.type === 'crop' && (POLYCULTURE_NAMES.has(i.name) || MONOCULTURE_ONLY_NAMES.has(i.name)))
  if (progress.hasSaveData) {
    const monoMax = monoCandidates.reduce((max, i) => Math.max(max, progress.getItemShippedCount(i.gameId)), 0)
    entry(32, { done: monoMax, total: MONOCULTURE_TARGET, label: 'of one crop shipped', linkPath: '/tracker/shipping' })
  } else {
    entry(32, { linkPath: '/tracker/shipping' })
  }

  // ----- Full Shipment (ID 34) -----
  const fullShipItems = items.filter(i => FULL_SHIPMENT_NAMES.has(i.name))
  if (progress.hasSaveData) {
    const shipped = fullShipItems.filter(i => progress.getItemShippedCount(i.gameId) > 0).length
    entry(34, { done: shipped, total: fullShipItems.length, label: 'items shipped', linkPath: '/tracker/full-shipment' })
  } else {
    entry(34, { linkPath: '/tracker/full-shipment' })
  }

  // ----- Friendship — social achievements -----
  if (progress.hasSaveData) {
    const friendships = progress.allFriendships ?? {}
    const fiveHeartCount  = Object.values(friendships).filter(f => (f.points ?? 0) >= FIVE_HEART_POINTS).length
    const eightHeartCount = Object.values(friendships).filter(f => (f.points ?? 0) >= EIGHT_HEART_POINTS).length
    // IDs 6 (5-heart×1), 7 (10-heart×1), 9 (10-heart×8), 11 (5-heart×4), 12 (5-heart×10), 13 (5-heart×20)
    entry(6,  { done: fiveHeartCount,  total: 1,  label: 'villagers at 5+ hearts', linkPath: '/villagers' })
    entry(7,  { done: eightHeartCount, total: 1,  label: 'villager at 10+ hearts', linkPath: '/villagers' })
    entry(9,  { done: eightHeartCount, total: 8,  label: 'villagers at 10+ hearts', linkPath: '/villagers' })
    entry(11, { done: fiveHeartCount,  total: 4,  label: 'villagers at 5+ hearts', linkPath: '/villagers' })
    entry(12, { done: fiveHeartCount,  total: 10, label: 'villagers at 5+ hearts', linkPath: '/villagers' })
    entry(13, { done: fiveHeartCount,  total: 20, label: 'villagers at 5+ hearts', linkPath: '/villagers' })
  } else {
    for (const id of [6, 7, 9, 11, 12, 13]) entry(id, { linkPath: '/villagers' })
  }

  return result
}

/**
 * Shared helper functions for data compilation
 * Extracted from CompileData.cjs to eliminate duplication
 */

/**
 * Resolve bundle references to full bundle objects
 * Used by: fish, artisan, crops, minerals, forage, etc.
 *
 * @param {Array<string>} bundleIds - Array of bundle IDs to resolve
 * @param {Map} bundlesById - Map of bundle ID to bundle object
 * @returns {Array} Array of full bundle objects
 */
function resolveBundleDetails(bundleIds, bundlesById) {
  if (!bundleIds || bundleIds.length === 0) return []

  return bundleIds
    .map(bundleId => bundlesById.get(bundleId))
    .filter(Boolean) // Remove any undefined bundles
}

/**
 * Resolve gift references to full villager objects
 * Filters out neutral preferences as they're not useful for display
 * Used by: fish, artisan, crops, minerals, forage, etc.
 *
 * @param {Object} gifts - Object mapping villager IDs to preferences
 * @param {Map} villagersById - Map of villager ID to villager object
 * @returns {Array} Array of {villager, preference} objects
 */
function resolveGiftDetails(gifts, villagersById) {
  if (!gifts || Object.keys(gifts).length === 0) return []

  return Object.entries(gifts)
    .map(([villagerId, preference]) => {
      if (preference === 'neutral') return null // Don't include neutral in UI
      const villager = villagersById.get(villagerId)
      return villager
        ? {
            villager: villager,
            preference: preference
          }
        : null
    })
    .filter(Boolean)
}

/**
 * Create a gameId → id index for O(1) save file lookups
 * Used by: all item types
 *
 * @param {Array} items - Array of items with gameId and id fields
 * @returns {Object} Object mapping gameId to friendly id
 */
function createGameIdIndex(items) {
  return Object.fromEntries(
    items.map(item => [item.gameId, item.id])
  )
}

/**
 * Generic page compilation function
 * Applies common transformations (gameId indexing)
 * to any item type
 *
 * RELATIONAL ARCHITECTURE: Items keep only IDs, not embedded objects
 * - bundles: array of bundle IDs (already in source)
 * - gifts: removed (use gifts.json pivot table instead)
 *
 * @param {Array} items - Array of source items
 * @param {Object} lookupMaps - Object containing bundlesById and villagersById maps
 * @param {Function} customTransform - Optional custom transformation function
 * @returns {Object} Compiled page data with items, gameIdIndex, and meta
 */
function compilePage(items, lookupMaps, customTransform = null) {
  const compiledItems = items.map(item => {
    // Remove gifts field (use gifts.json pivot table instead)
    const { gifts, ...itemWithoutGifts } = item

    let compiledItem = itemWithoutGifts

    // Apply custom transformation if provided
    if (customTransform) {
      compiledItem = customTransform(compiledItem, lookupMaps)
    }

    return compiledItem
  })

  const gameIdIndex = createGameIdIndex(items)

  return {
    items: compiledItems,
    gameIdIndex: gameIdIndex,
    meta: {
      compiled: new Date().toISOString(),
      totalItems: compiledItems.length
    }
  }
}

/**
 * Create lookup maps for an item array
 * Creates both ID-based and gameId-based maps
 *
 * @param {Array} items - Array of items with id and gameId fields
 * @returns {Object} { byId: Map, byGameId: Map }
 */
function createItemLookupMaps(items) {
  return {
    byId: new Map(items.map(item => [item.id, item])),
    byGameId: new Map(items.map(item => [item.gameId, item]))
  }
}

/**
 * Calculate quality prices for items that can have quality tiers
 * Used by artisan goods and animal products
 *
 * @param {number} basePrice - Base price of the item
 * @param {boolean} canBeAged - Whether item can be aged in cask
 * @param {boolean} hasQuality - Whether item has natural quality (animal products)
 * @param {Object} qualityMultipliers - Multiplier object with regular, silver, gold, iridium
 * @returns {Object} Prices object with regular and optionally silver/gold/iridium
 */
function calculateQualityPrices(basePrice, canBeAged, hasQuality, qualityMultipliers) {
  const prices = {
    regular: Math.floor(basePrice * qualityMultipliers.regular)
  }

  // Add quality tiers for items that can be aged OR have natural quality (animal products)
  if (canBeAged || hasQuality) {
    prices.silver = Math.floor(basePrice * qualityMultipliers.silver)
    prices.gold = Math.floor(basePrice * qualityMultipliers.gold)
    prices.iridium = Math.floor(basePrice * qualityMultipliers.iridium)
  }

  return prices
}

module.exports = {
  resolveBundleDetails,
  resolveGiftDetails,
  createGameIdIndex,
  compilePage,
  createItemLookupMaps,
  calculateQualityPrices
}

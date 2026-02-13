import { useState, useEffect, useMemo, useCallback } from 'react'

/**
 * Load and index relational data for O(1) lookups
 *
 * This hook loads all reference data (bundles, villagers, stores, gifts)
 * and builds indexes for fast bidirectional lookups.
 *
 * Usage:
 *   const { bundles, villagers, stores, getGiftPreferences, loading } = useRelationalData()
 *
 *   const giftList = getGiftPreferences('cloth') // Get all villagers who like cloth
 *   const bundle = bundles.byId['artisan']
 *   const store = stores.byId['pierre']
 */
export function useRelationalData() {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load all relational data
  useEffect(() => {
    async function fetchData() {
      try {
        const [bundlesRes, villagersRes, storesRes, giftsRes] = await Promise.all([
          fetch('/data/collections/bundles.json'),
          fetch('/data/reference/villagers.json'),
          fetch('/data/reference/stores.json'),
          fetch('/data/relationships/gifts.json')
        ])

        if (!bundlesRes.ok || !villagersRes.ok || !storesRes.ok || !giftsRes.ok) {
          throw new Error('Failed to fetch relational data')
        }

        const [bundlesData, villagersData, storesData, giftsData] = await Promise.all([
          bundlesRes.json(),
          villagersRes.json(),
          storesRes.json(),
          giftsRes.json()
        ])

        setData({
          bundlesRaw: bundlesData.bundles,
          villagersRaw: villagersData.villagers,
          storesRaw: storesData.stores,
          giftsRaw: giftsData.relationships
        })
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Build indexes once data is loaded
  const indexes = useMemo(() => {
    if (loading || error || !data.bundlesRaw) {
      return null
    }

    // Bundle indexes
    const bundlesById = new Map(data.bundlesRaw.map(b => [b.id, b]))

    // Villager indexes
    const villagersById = new Map(data.villagersRaw.map(v => [v.id, v]))

    // Store indexes (handles both old object format and new array format)
    let storesById = new Map()
    let storesByKey = new Map()

    if (Array.isArray(data.storesRaw)) {
      // New array format: [{ id: 0, key: "pierre", name: "..." }, ...]
      data.storesRaw.forEach(store => {
        storesById.set(store.id, store)
        storesByKey.set(store.key, store)
      })
    } else if (data.storesRaw && typeof data.storesRaw === 'object') {
      // Object format: { pierre: {...}, willy: {...} }
      Object.entries(data.storesRaw).forEach(([key, store]) => {
        storesByKey.set(key, store)
        if (store.id !== undefined) {
          storesById.set(store.id, store)
        }
      })
    }

    // Gift indexes (pivot table)
    // relationships format: [["cloth", "robin", "like"], ["cloth", "emily", "love"], ...]
    const giftsByItem = new Map() // itemId -> [{ villagerId, preference }, ...]
    const giftsByVillager = new Map() // villagerId -> [{ itemId, preference }, ...]

    data.giftsRaw.forEach(([itemId, villagerId, preference]) => {
      // Skip neutral preferences (not useful for display)
      if (preference === 'neutral') return

      // Index by item
      if (!giftsByItem.has(itemId)) {
        giftsByItem.set(itemId, [])
      }
      giftsByItem.get(itemId).push({ villagerId, preference })

      // Index by villager
      if (!giftsByVillager.has(villagerId)) {
        giftsByVillager.set(villagerId, [])
      }
      giftsByVillager.get(villagerId).push({ itemId, preference })
    })

    return {
      bundlesById,
      villagersById,
      storesById,
      storesByKey,
      giftsByItem,
      giftsByVillager
    }
  }, [data, loading, error])

  // Helper functions for lookups - memoized to prevent recreating on every render
  const getBundle = useCallback((bundleId) => {
    return indexes?.bundlesById.get(bundleId) || null
  }, [indexes])

  const getVillager = useCallback((villagerId) => {
    return indexes?.villagersById.get(villagerId) || null
  }, [indexes])

  const getStore = useCallback((storeIdOrKey) => {
    if (!indexes) return null
    // Try numeric ID first, then string key
    return indexes.storesById.get(storeIdOrKey) || indexes.storesByKey.get(storeIdOrKey) || null
  }, [indexes])

  /**
   * Get all villagers who have a preference for this item
   * @param {string} itemId - Item ID to look up
   * @returns {Array} Array of { villager, preference } objects
   */
  const getGiftPreferences = useCallback((itemId) => {
    if (!indexes) return []

    const preferences = indexes.giftsByItem.get(itemId) || []

    // Resolve villager IDs to full villager objects
    return preferences
      .map(({ villagerId, preference }) => {
        const villager = indexes.villagersById.get(villagerId)
        return villager ? { villager, preference } : null
      })
      .filter(Boolean)
  }, [indexes])

  /**
   * Get all items this villager has a preference for
   * @param {string} villagerId - Villager ID to look up
   * @returns {Array} Array of { itemId, preference } objects
   */
  const getVillagerGifts = useCallback((villagerId) => {
    if (!indexes) return []
    return indexes.giftsByVillager.get(villagerId) || []
  }, [indexes])

  /**
   * Get the preference for a specific item-villager pair
   * @param {string} itemId - Item ID
   * @param {string} villagerId - Villager ID
   * @returns {string|null} Preference (love/like/dislike/hate) or null
   */
  const getGiftPreference = useCallback((itemId, villagerId) => {
    if (!indexes) return null

    const preferences = indexes.giftsByItem.get(itemId) || []
    const match = preferences.find(p => p.villagerId === villagerId)
    return match ? match.preference : null
  }, [indexes])

  // Memoize nested objects separately to prevent reference changes
  const bundles = useMemo(() => ({
    all: data.bundlesRaw || [],
    byId: indexes?.bundlesById || new Map()
  }), [data.bundlesRaw, indexes?.bundlesById])

  const villagers = useMemo(() => ({
    all: data.villagersRaw || [],
    byId: indexes?.villagersById || new Map()
  }), [data.villagersRaw, indexes?.villagersById])

  const stores = useMemo(() => ({
    all: Array.isArray(data.storesRaw)
      ? data.storesRaw
      : (data.storesRaw?.stores ? Object.values(data.storesRaw.stores) : []),
    byId: indexes?.storesById || new Map(),
    byKey: indexes?.storesByKey || new Map()
  }), [data.storesRaw, indexes?.storesById, indexes?.storesByKey])

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    loading,
    error,
    bundles,
    villagers,
    stores,
    getBundle,
    getVillager,
    getStore,
    getGiftPreferences,
    getVillagerGifts,
    getGiftPreference
  }), [loading, error, bundles, villagers, stores, getBundle, getVillager, getStore, getGiftPreferences, getVillagerGifts, getGiftPreference])
}

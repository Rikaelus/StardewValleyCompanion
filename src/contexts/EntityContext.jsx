import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

const EntityContext = createContext(null)

/**
 * Unified entity store. Loads entities.json once for the entire app.
 * Replaces both ItemsContext and useRelationalData.
 */
export function EntityProvider({ children }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/data/entities.json', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch entities.json: ${res.status}`)
        return res.json()
      })
      .then(data => {
        setRawData(data)
        setLoading(false)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  const value = useMemo(() => {
    if (!rawData) {
      return {
        loading, error,
        items: [], gameIdIndex: {}, byType: {},
        bundles: { all: [], byId: new Map() },
        villagers: { all: [], byId: new Map() },
        stores: {},
        machines: { all: [], byId: new Map() },
        findById: () => null,
        findByGameId: () => null,
        findEntity: () => null,
        getBundle: () => null,
        getVillager: () => null,
        getStore: () => null,
        getMachine: () => null,
        getGiftPreferences: () => [],
        getVillagerGifts: () => [],
        getGiftPreference: () => null,
      }
    }

    const allItems = rawData.items || []
    const gameIdIndex = rawData.gameIdIndex || {}
    const allBundles = rawData.bundles || []
    const allVillagers = rawData.villagers || []
    const storesMap = rawData.stores || {}
    const allMachines = rawData.machines || []
    const relationships = rawData.relationships || []

    // ── Item collections ─────────────────────────────────────────────────────
    const collectionPredicates = {
      'fish':           item => item.sources?.some(s => s.type === 'fish'),
      'artisan':        item => item.itemCategory === 'artisan',
      'crop':           item => item.sources?.some(s => s.type === 'seed'),
      'forage':         item => item.sources?.some(s => s.type === 'forage') || (item.itemCategory === 'forage' && !item.sources?.some(s => s.type === 'seed')),
      'tree-fruit':     item => item.itemCategory === 'tree-fruit',
      'mineral':        item => item.itemCategory === 'mineral',
      'metal-bar':      item => item.itemCategory === 'metal-bar',
      'monster-loot':   item => item.itemCategory === 'monster-loot',
      'resource':       item => item.itemCategory === 'resource',
      'seed':           item => item.itemCategory === 'seed' || item.id === 'coffee-bean',
      'big-craftable':  item => item.itemCategory === 'big-craftable',
      'animal-product': item => item.itemCategory === 'animal-product',
      'furniture':      item => item.itemCategory === 'furniture',
      'hat':            item => item.itemCategory === 'hat',
    }

    const byType = {}
    for (const [collection, predicate] of Object.entries(collectionPredicates)) {
      byType[collection] = allItems.filter(predicate)
    }

    // ── Relational indexes ───────────────────────────────────────────────────
    const bundlesById = new Map(allBundles.map(b => [b.id, b]))
    const villagersById = new Map(allVillagers.map(v => [v.id, v]))
    const machinesById = new Map(allMachines.map(m => [m.id, m]))

    // Gift indexes
    const giftsByItem = new Map()
    const giftsByVillager = new Map()

    for (const [itemId, villagerId, preference] of relationships) {
      if (preference === 'neutral') continue

      if (!giftsByItem.has(itemId)) giftsByItem.set(itemId, [])
      giftsByItem.get(itemId).push({ villagerId, preference })

      if (!giftsByVillager.has(villagerId)) giftsByVillager.set(villagerId, [])
      giftsByVillager.get(villagerId).push({ itemId, preference })
    }

    // ── Lookup helpers ───────────────────────────────────────────────────────
    const findById = (id) => allItems.find(item => item.id === id) ?? null
    const findByGameId = (gameId) => allItems.find(item => item.gameId === gameId) ?? null

    const findEntity = (id) => {
      const item = allItems.find(i => i.id === id)
      if (item) return item
      const bundle = bundlesById.get(id)
      if (bundle) return bundle
      const villager = villagersById.get(id)
      if (villager) return villager
      const store = storesMap[id]
      if (store) return store
      const machine = machinesById.get(id)
      if (machine) return machine
      return null
    }

    const getBundle = (bundleId) => bundlesById.get(bundleId) ?? null
    const getVillager = (villagerId) => villagersById.get(villagerId) ?? null
    const getStore = (storeId) => storesMap[storeId] ?? null
    const getMachine = (machineId) => machinesById.get(machineId) ?? null

    const getGiftPreferences = (itemId) => {
      const preferences = giftsByItem.get(itemId) || []
      return preferences
        .map(({ villagerId, preference }) => {
          const villager = villagersById.get(villagerId)
          return villager ? { villager, preference } : null
        })
        .filter(Boolean)
    }

    const getVillagerGifts = (villagerId) => giftsByVillager.get(villagerId) || []

    const getGiftPreference = (itemId, villagerId) => {
      const preferences = giftsByItem.get(itemId) || []
      const match = preferences.find(p => p.villagerId === villagerId)
      return match ? match.preference : null
    }

    return {
      loading: false,
      error: null,
      // Items
      items: allItems,
      gameIdIndex,
      byType,
      findById,
      findByGameId,
      findEntity,
      // Relational collections
      bundles: { all: allBundles, byId: bundlesById },
      villagers: { all: allVillagers, byId: villagersById },
      stores: storesMap,
      machines: { all: allMachines, byId: machinesById },
      // Relational helpers
      getBundle,
      getVillager,
      getStore,
      getMachine,
      getGiftPreferences,
      getVillagerGifts,
      getGiftPreference,
    }
  }, [rawData, loading, error])

  return (
    <EntityContext.Provider value={value}>
      {children}
    </EntityContext.Provider>
  )
}

/**
 * Returns the full unified entity context.
 */
export function useEntities() {
  const ctx = useContext(EntityContext)
  if (!ctx) throw new Error('useEntities must be used inside <EntityProvider>')
  return ctx
}

/**
 * Returns items of a specific type, plus loading/error state.
 * @param {string} type - item type: 'fish', 'artisan', 'crop', 'forage', 'seed', etc.
 */
export function useItemsByType(type) {
  const ctx = useEntities()
  const items = useMemo(() => ctx.byType[type] || [], [ctx.byType, type])
  return { items, loading: ctx.loading, error: ctx.error }
}

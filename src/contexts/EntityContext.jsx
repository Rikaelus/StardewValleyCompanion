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
        buffs: { all: [], byId: new Map() },
        events: { all: [], byId: new Map() },
        findById: () => null,
        findByGameId: () => null,
        findEntity: () => null,
        getBundle: () => null,
        getVillager: () => null,
        getStore: () => null,
        getFestival: () => null,
        getMachine: () => null,
        getBuff: () => null,
        getEvent: () => null,
        getGiftPreferences: () => [],
        getVillagerGifts: () => [],
        getGiftPreference: () => null,
        eventNames: {},
        achievementNames: {},
      }
    }

    const allEntities = rawData.items || []
    const gameIdIndex = rawData.gameIdIndex || {}
    const allBundles = rawData.bundles || []
    const allVillagers = rawData.villagers || []
    const storesMap = rawData.stores || {}
    const festivalsMap = rawData.festivals || {}
    const allMachines = rawData.machines || []
    const allBuffs = rawData.buffs || []
    const relationships = rawData.relationships || []

    // ── Entity collections ───────────────────────────────────────────────────
    const collectionPredicates = {
      'fish':           entity => entity.sources?.some(s => s.type === 'fish'),
      'artisan':        entity => entity.category === 'artisan',
      'crop':           entity => entity.sources?.some(s => s.type === 'seed'),
      'forage':         entity => entity.sources?.some(s => s.type === 'forage') || (entity.category === 'forage' && !entity.sources?.some(s => s.type === 'seed')),
      'tree-fruit':     entity => entity.category === 'tree-fruit',
      'mineral':        entity => entity.category === 'mineral',
      'metal-bar':      entity => entity.category === 'metal-bar',
      'monster-loot':   entity => entity.category === 'monster-loot',
      'resource':       entity => entity.category === 'resource',
      'seed':           entity => entity.category === 'seed' || entity.id === 'coffee-bean',
      'big-craftable':  entity => entity.category === 'big-craftable',
      'animal-product': entity => entity.category === 'animal-product',
      'furniture':      entity => entity.category === 'furniture',
      'hat':            entity => entity.category === 'hat',
      'weapon':         entity => entity.category === 'weapon',
      'boot':           entity => entity.category === 'boot',
      'trinket':        entity => entity.category === 'trinket',
      'tool':           entity => entity.category === 'tool',
      'building':       entity => entity.category === 'building',
      'animal':         entity => entity.category === 'animal',
    }

    const byType = {}
    for (const [collection, predicate] of Object.entries(collectionPredicates)) {
      byType[collection] = allEntities.filter(predicate)
    }

    // ── Relational indexes ───────────────────────────────────────────────────
    const bundlesById = new Map(allBundles.map(b => [b.id, b]))
    const villagersById = new Map(allVillagers.map(v => [v.id, v]))
    const machinesById = new Map(allMachines.map(m => [m.id, m]))
    const buffsById = new Map(allBuffs.map(b => [b.id, b]))

    // Events live in allEntities (category: 'event'); build a secondary index by eventKey
    const allEvents = allEntities.filter(i => i.category === 'event')
    const eventsByKey = new Map(allEvents.map(e => [e.eventKey, e]))
    // eventNames map for condition formatter: { eventKey → name }
    const eventNames = Object.fromEntries(allEvents.map(e => [e.eventKey, e.name]))
    const achievementNames = rawData.achievementNames || {}

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
    const findById = (id) => allEntities.find(entity => entity.id === id) ?? null
    // Build a Map for O(1) gameId lookups — qualified IDs are now unique across registries
    const entitiesByGameId = new Map(
      allEntities.filter(e => e.gameId != null).map(e => [e.gameId, e])
    )
    const findByGameId = (gameId) => entitiesByGameId.get(gameId) ?? null

    const findEntity = (id) => {
      const entity = allEntities.find(e => e.id === id)
      if (entity) return entity
      const bundle = bundlesById.get(id)
      if (bundle) return bundle
      const villager = villagersById.get(id)
      if (villager) return villager
      const store = storesMap[id]
      if (store) return store
      const machine = machinesById.get(id)
      if (machine) return machine
      const buff = buffsById.get(id)
      if (buff) return buff
      return null
    }

    const festivalsById = new Map(Object.entries(festivalsMap))

    const getBundle = (bundleId) => bundlesById.get(bundleId) ?? null
    const getVillager = (villagerId) => villagersById.get(villagerId) ?? null
    const getStore = (storeId) => storesMap[storeId] ?? null
    const getFestival = (festivalId) => festivalsById.get(festivalId) ?? null
    const getMachine = (machineId) => machinesById.get(machineId) ?? null
    const getBuff = (buffId) => buffsById.get(buffId) ?? null
    const getEvent = (eventKey) => eventsByKey.get(String(eventKey)) ?? null

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
      // Entities (public API key stays as 'items' for backwards compat with rawData.items)
      items: allEntities,
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
      buffs: { all: allBuffs, byId: buffsById },
      events: { all: allEvents, byKey: eventsByKey },
      // Relational helpers
      getBundle,
      getVillager,
      getStore,
      getFestival,
      getMachine,
      getBuff,
      getEvent,
      getGiftPreferences,
      getVillagerGifts,
      getGiftPreference,
      eventNames,
      achievementNames,
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
 * Returns entities of a specific type, plus loading/error state.
 * @param {string} type - entity type: 'fish', 'artisan', 'crop', 'forage', 'seed', etc.
 */
export function useEntitiesByType(type) {
  const ctx = useEntities()
  const items = useMemo(() => ctx.byType[type] || [], [ctx.byType, type])
  return { items, loading: ctx.loading, error: ctx.error }
}

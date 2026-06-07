import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { usePlayer } from './PlayerContext'

const EntityContext = createContext(null)

/**
 * Unified entity store. Loads entities.json once for the entire app.
 * Replaces both ItemsContext and useRelationalData.
 */
/**
 * Generate goal entities derived from save data (pets, farm animals).
 * These are first-class entities injected into the catalog so findById works.
 */
function buildSaveEntities(saveData) {
  if (!saveData) return []
  const entities = []

  // Map animal type names to sprite assets
  const ANIMAL_ICONS = {
    'Blue Chicken':   'assets/animals/BlueChicken.png',
    'Brown Chicken':  'assets/animals/BrownChicken.png',
    'White Chicken':  'assets/animals/WhiteChicken.png',
    'Golden Chicken': 'assets/animals/GoldenChicken.png',
    'Void Chicken':   'assets/animals/VoidChicken.png',
    'Brown Cow':      'assets/animals/BrownCow.png',
    'White Cow':      'assets/animals/WhiteCow.png',
    'Goat':           'assets/animals/Goat.png',
    'Sheep':          'assets/animals/Sheep.png',
    'Pig':            'assets/animals/Pig.png',
    'Duck':           'assets/animals/Duck.png',
    'Rabbit':         'assets/animals/Rabbit.png',
    'Dinosaur':       'assets/animals/Dinosaur.png',
    'Ostrich':        'assets/animals/Ostrich.png',
  }

  // Per-pet friendship goals
  for (const pet of (saveData.pets ?? [])) {
    const slug = pet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    entities.push({
      id: `goal-pet-${slug}`,
      name: `${pet.name}'s Friendship`,
      description: `Max out ${pet.name}'s friendship.`,
      type: 'goal',
      entityType: 'goal',
      subtype: 'social',
      iconClass: 'fa-solid fa-paw',
      iconColor: '#8b6914',
      capabilities: { isGoal: true },
      deadline: { type: 'none' },
      petName: pet.name,
      petType: pet.petType,
      criteria: { type: 'pet-max', petName: pet.name },
      children: [
        { kind: 'action-type', id: 'pet-care', weight: 1.0 },
      ],
    })
  }

  // Per-animal friendship goals
  for (const animal of (saveData.farmAnimals ?? [])) {
    const slug = animal.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const animalIcon = ANIMAL_ICONS[animal.type]
    entities.push({
      id: `goal-animal-${slug}`,
      name: `${animal.name}'s Friendship`,
      description: `Max out ${animal.name}'s friendship.`,
      type: 'goal',
      entityType: 'goal',
      subtype: 'social',
      ...(animalIcon ? { icon: animalIcon } : { iconClass: 'fa-solid fa-horse', iconColor: '#8b6914' }),
      capabilities: { isGoal: true },
      deadline: { type: 'none' },
      animalName: animal.name,
      animalType: animal.type,
      criteria: { type: 'animal-max', animalName: animal.name },
      children: [
        { kind: 'action-type', id: 'animal-care', weight: 1.0 },
      ],
    })
  }

  return entities
}

export function EntityProvider({ children }) {
  const { player } = usePlayer()
  const saveData = player.saveData
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

        buffs: { all: [], byId: new Map() },
        events: { all: [], byId: new Map() },
        findById: () => null,
        findByGameId: () => null,
        findEntity: () => null,
        getBundle: () => null,
        getVillager: () => null,
        getLocation: () => null,
        getStore: () => null,
        getFestival: () => null,
        getMachine: () => null, // alias for findById — machines are now items
        getBuff: () => null,
        getEvent: () => null,
        getGiftPreferences: () => [],
        getVillagerGifts: () => [],
        getGiftPreference: () => null,
        eventNames: {},
        achievementNames: {},
      }
    }

    const saveEntities = buildSaveEntities(saveData)
    const allEntities = [...(rawData.items || []), ...saveEntities]
    const gameIdIndex = rawData.gameIdIndex || {}
    const allBundles = allEntities.filter(i => i.type === 'bundle')
    const allVillagers = allEntities.filter(i => i.type === 'villager')
    const allBuffs = allEntities.filter(i => i.type === 'buff')
    const relationships = rawData.relationships || []

    // ── Entity collections ───────────────────────────────────────────────────
    const collectionPredicates = {
      'fish':           entity => entity.type === 'fish',
      'artisan':        entity => entity.type === 'artisan',
      'crop':           entity => entity.sources?.some(s => s.type === 'seed'),
      'forage':         entity => entity.type === 'forage',
      'tree-fruit':     entity => entity.type === 'tree-fruit',
      'mineral':        entity => entity.type === 'mineral',
      'metal-bar':      entity => entity.type === 'metal-bar',
      'monster-loot':   entity => entity.type === 'monster-loot',
      'resource':       entity => entity.type === 'resource',
      'seed':           entity => entity.type === 'seed' || entity.id === 'coffee-bean',
      'big-craftable':  entity => entity.type === 'big-craftable',
      'animal-product': entity => entity.type === 'animal-product',
      'furniture':      entity => entity.type === 'furniture',
      'clothing':       entity => entity.type === 'clothing',
      'hat':            entity => entity.type === 'clothing' && entity.subtype === 'hat',
      'tree':           entity => entity.type === 'tree',
      'bait':           entity => entity.type === 'bait',
      'tackle':         entity => entity.type === 'tackle',
      'weapon':         entity => entity.type === 'weapon',
      'boot':           entity => entity.type === 'boot',
      'ring':           entity => entity.type === 'ring',
      'artifact':       entity => entity.type === 'artifact',
      'breakable':      entity => entity.type === 'breakable',
      'chest':          entity => entity.type === 'chest',
      'geode':          entity => entity.type === 'geode',
      'monster':        entity => entity.type === 'monster',
      'villager':       entity => entity.type === 'villager',
      'trinket':        entity => entity.type === 'trinket',
      'tool':           entity => entity.type === 'tool',
      'building':       entity => entity.type === 'building' && entity.subtype === 'building',
      'animal':         entity => entity.type === 'animal',
      'food':           entity => entity.type === 'food',
      'crafted':        entity => entity.type === 'crafted',
      'book':           entity => entity.type === 'book',
      'power':          entity => entity.type === 'power',
      'concession':     entity => entity.type === 'concession',
      'bundle':         entity => entity.type === 'bundle',
      'tv-show':        entity => entity.type === 'tv-show',
    }

    const byType = {}
    for (const [collection, predicate] of Object.entries(collectionPredicates)) {
      byType[collection] = allEntities.filter(predicate)
    }

    // ── Relational indexes ───────────────────────────────────────────────────
    const bundlesById = new Map(allBundles.map(b => [b.id, b]))
    const villagersById = new Map(allVillagers.map(v => [v.id, v]))
    const buffsById = new Map(allBuffs.map(b => [b.id, b]))

    // Events live in allEntities (category: 'event'); build a secondary index by eventKey
    const allEvents = allEntities.filter(i => i.type === 'event')
    const eventsByKey = new Map(allEvents.map(e => [e.eventKey, e]))
    // eventNames map for condition formatter: { eventKey → name }
    const eventNames = Object.fromEntries(allEvents.map(e => [e.eventKey, e.name]))
    const allAchievements = allEntities.filter(i => i.type === 'achievement')
    const achievementNames = Object.fromEntries(allAchievements.map(a => [String(a.achievementId), a.name]))

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
      const buff = buffsById.get(id)
      if (buff) return buff
      return null
    }

    const getBundle = (bundleId) => bundlesById.get(bundleId) ?? null
    const getVillager = (villagerId) => villagersById.get(villagerId) ?? null
    const getLocation = (id) => findById(id)
    const getStore = getLocation  // backward-compat alias
    const getFestival = (id) => findById(id)
    const getMachine = (machineId) => findById(machineId) // machines are now items
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
      buffs: { all: allBuffs, byId: buffsById },
      events: { all: allEvents, byKey: eventsByKey },
      // Relational helpers
      getBundle,
      getVillager,
      getLocation,
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
  }, [rawData, loading, error, saveData])

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

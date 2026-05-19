import { useState, useEffect, useMemo } from 'react'
import { useEntities } from '../contexts/EntityContext'

export function useData(files) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const entries = await Promise.all(
          Object.entries(files).map(async ([key, path]) => {
            const response = await fetch(path)
            if (!response.ok) throw new Error(`Failed to fetch ${path}`)
            const json = await response.json()
            return [key, json]
          })
        )
        setData(Object.fromEntries(entries))
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { data, loading, error }
}

// Maps the item type names used by page components to the 'type' field in items.json
const TYPE_MAP = {
  fish: 'fish',
  artisan: 'artisan',
  crops: 'crop',
  forage: 'forage',
  minerals: 'mineral',
  'metal-bars': 'metal-bar',
  'monster-loot': 'monster-loot',
  resources: 'resource',
  seeds: 'seed',
  furniture: 'furniture',
  clothing: 'clothing',
  'animal-products': 'animal-product',
  'big-craftables': 'big-craftable',
  'tree-fruits': 'tree-fruit',
  hats: 'hat',
  trees: 'tree',
  bait: 'bait',
  tackle: 'tackle',
  monsters: 'monster',
  weapons: 'weapon',
  boots: 'boot',
  rings: 'ring',
  artifacts: 'artifact',
  breakables: 'breakable',
  geodes: 'geode',
  villagers: 'villager',
  buildings: 'building',
}

// Legacy itemsKey map (used for backward-compat data shape { [itemsKey]: items, items, gameIdIndex })
const ITEMS_KEY_MAP = {
  fish: 'fish',
  artisan: 'artisan',
  crops: 'crops',
  forage: 'forage',
  minerals: 'minerals',
  'metal-bars': 'metalBars',
  'monster-loot': 'monsterLoot',
  resources: 'resources',
  seeds: 'seeds',
  furniture: 'furniture',
  hats: 'hats',
  'animal-products': 'animalProducts',
  'big-craftables': 'bigCraftables',
  'tree-fruits': 'treeFruits',
  trees: 'trees',
  bait: 'bait',
  tackle: 'tackle',
  monsters: 'monsters',
  weapons: 'weapons',
  boots: 'boots',
  rings: 'rings',
  artifacts: 'artifacts',
  breakables: 'breakables',
  geodes: 'geodes',
  clothing: 'clothing',
  villagers: 'villagers',
}

/**
 * Generic hook for loading item data by type.
 * Now reads from the unified ItemsContext (data fetched once for the whole app).
 *
 * @param {string} itemType - The type of item (fish, artisan, crops, forage, etc.)
 * @returns {Object} { data, loading, error }
 */
export function useItemData(itemType) {
  const { byType, gameIdIndex, loading, error } = useEntities()

  const typeKey = TYPE_MAP[itemType]
  if (!typeKey && !loading) {
    throw new Error(`Unknown item type: ${itemType}. Valid types: ${Object.keys(TYPE_MAP).join(', ')}`)
  }

  const itemsKey = ITEMS_KEY_MAP[itemType] || itemType

  const transformed = useMemo(() => {
    if (loading || error) return {}
    const items = byType[typeKey] || []
    return {
      [itemsKey]: items,
      items, // Generic alias used by most page components
      gameIdIndex: gameIdIndex || {}
    }
  }, [byType, typeKey, itemsKey, gameIdIndex, loading, error])

  return { data: transformed, loading, error }
}

/**
 * Specialized hook for fish data (backward compatibility)
 */
export function useFishData() {
  return useItemData('fish')
}

/**
 * Specialized hook for artisan goods data (backward compatibility)
 */
export function useArtisanData() {
  return useItemData('artisan')
}

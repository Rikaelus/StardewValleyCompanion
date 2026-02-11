import { useState, useEffect } from 'react'

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

/**
 * Generic hook for loading item data by type
 * Maps item types to their data file paths and transforms the response
 *
 * @param {string} itemType - The type of item (fish, artisan, crops, forage, etc.)
 * @returns {Object} { data, loading, error }
 */
export function useItemData(itemType) {
  // Configuration for each item type
  const typeConfig = {
    fish: {
      pagePath: 'data/pages/fish.json',
      itemsKey: 'fish'
    },
    artisan: {
      pagePath: 'data/pages/artisan.json',
      itemsKey: 'artisan'
    },
    crops: {
      pagePath: 'data/pages/crops.json',
      itemsKey: 'crops'
    },
    forage: {
      pagePath: 'data/pages/forage.json',
      itemsKey: 'forage'
    },
    minerals: {
      pagePath: 'data/pages/minerals.json',
      itemsKey: 'minerals'
    },
    'metal-bars': {
      pagePath: 'data/pages/metal-bars.json',
      itemsKey: 'metalBars'
    },
    'monster-loot': {
      pagePath: 'data/pages/monster-loot.json',
      itemsKey: 'monsterLoot'
    },
    resources: {
      pagePath: 'data/pages/resources.json',
      itemsKey: 'resources'
    },
    cooking: {
      pagePath: 'data/pages/cooking.json',
      itemsKey: 'cooking'
    }
  }

  const config = typeConfig[itemType]

  if (!config) {
    throw new Error(`Unknown item type: ${itemType}. Valid types: ${Object.keys(typeConfig).join(', ')}`)
  }

  const { data, loading, error } = useData({
    page: config.pagePath
  })

  // Transform compiled data to match component expectations
  if (loading || error) {
    return { data: {}, loading, error }
  }

  const transformed = {
    [config.itemsKey]: data.page?.items || [],
    items: data.page?.items || [], // Generic alias
    gameIdIndex: data.page?.gameIdIndex || {}
  }

  return { data: transformed, loading, error }
}

/**
 * Specialized hook for fish data (backward compatibility)
 * Uses the generic useItemData hook internally
 */
export function useFishData() {
  return useItemData('fish')
}

/**
 * Specialized hook for artisan goods data (backward compatibility)
 * Uses the generic useItemData hook internally
 */
export function useArtisanData() {
  return useItemData('artisan')
}

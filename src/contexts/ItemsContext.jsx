import { createContext, useContext, useState, useEffect, useMemo } from 'react'

const ItemsContext = createContext(null)

/**
 * Provides a single unified items dataset loaded once for the entire app.
 * All page components and the modal read from this context instead of
 * fetching individual per-type files.
 */
export function ItemsProvider({ children }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/data/pages/items.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch items.json: ${res.status}`)
        return res.json()
      })
      .then(data => {
        setRawData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Pre-compute per-type filtered views once on load, memoized
  const value = useMemo(() => {
    if (!rawData) return { loading, error, items: [], gameIdIndex: {}, byType: {} }

    const allItems = rawData.items || []
    const gameIdIndex = rawData.gameIdIndex || {}

    // Group items into per-page collections.
    // An item can appear in multiple collections (e.g. grape is both crop and forage).
    // Each collection is defined by a predicate so merged items show up everywhere they belong.
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

    return {
      loading: false,
      error: null,
      items: allItems,
      gameIdIndex,
      byType,
      // Convenience: find any item by string id (searches all types)
      findById: (id) => allItems.find(item => item.id === id) ?? null,
      // Convenience: find any item by numeric gameId
      findByGameId: (gameId) => allItems.find(item => item.gameId === gameId) ?? null,
    }
  }, [rawData, loading, error])

  // While loading/errored, still provide consistent shape
  if (loading || error) {
    return (
      <ItemsContext.Provider value={{ loading, error, items: [], gameIdIndex: {}, byType: {}, findById: () => null, findByGameId: () => null }}>
        {children}
      </ItemsContext.Provider>
    )
  }

  return (
    <ItemsContext.Provider value={value}>
      {children}
    </ItemsContext.Provider>
  )
}

/**
 * Returns the full items context: { loading, error, items, gameIdIndex, byType, findById, findByGameId }
 */
export function useItems() {
  const ctx = useContext(ItemsContext)
  if (!ctx) throw new Error('useItems must be used inside <ItemsProvider>')
  return ctx
}

/**
 * Returns items of a specific type, plus loading/error state.
 * Replaces the per-type useItemData hook.
 *
 * @param {string} type - item type: 'fish', 'artisan', 'crop', 'forage', 'seed', etc.
 */
export function useItemsByType(type) {
  const ctx = useItems()
  const items = useMemo(() => ctx.byType[type] || [], [ctx.byType, type])
  return { items, loading: ctx.loading, error: ctx.error }
}

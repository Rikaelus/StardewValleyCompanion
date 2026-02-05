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

export function useFishData() {
  const { data, loading, error } = useData({
    fishPage: 'data/pages/fish.json',
    villagers: 'data/reference/villagers.json'
  })

  // Transform compiled data to match component expectations
  if (loading || error) {
    return { data: {}, loading, error }
  }

  const transformed = {
    fish: data.fishPage?.items || [],
    villagers: data.villagers?.villagers || [],
    bundles: [], // Bundles are now embedded in fish items as bundleDetails
    gameIdIndex: data.fishPage?.gameIdIndex || {}
  }

  return { data: transformed, loading, error }
}

export function useArtisanData() {
  const { data, loading, error } = useData({
    artisanPage: 'data/pages/artisan.json',
    villagers: 'data/reference/villagers.json'
  })

  // Transform compiled data to match component expectations
  if (loading || error) {
    return { data: {}, loading, error }
  }

  const transformed = {
    artisan: data.artisanPage?.items || [],
    villagers: data.villagers?.villagers || [],
    gameIdIndex: data.artisanPage?.gameIdIndex || {}
  }

  return { data: transformed, loading, error }
}

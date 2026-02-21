import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'stardew-tracker-player'

const DEFAULT_PLAYER = {
  name: '',
  farmName: '',
  professions: {
    // Farming Level 5 & 10
    tiller: false,     // Crops worth 10% more
    artisan: false,    // Artisan goods worth 40% more
    rancher: false,    // Animal products worth 20% more

    // Fishing Level 5 & 10
    fisher: false,     // Fish worth 25% more
    angler: false,     // Fish worth 50% more (requires Fisher)

    // Foraging Level 5
    tapper: false,     // Syrups worth 25% more

    // Mining Level 10
    blacksmith: false, // Bars worth 50% more
    gemologist: false, // Gems worth 30% more
  }
}

export function PlayerProvider({ children }) {
  const [player, setPlayerState] = useState(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new fields
        return { ...DEFAULT_PLAYER, ...parsed, professions: { ...DEFAULT_PLAYER.professions, ...parsed.professions } }
      }
    } catch (error) {
      console.error('Error loading player data:', error)
    }
    return DEFAULT_PLAYER
  })

  // Save to localStorage whenever player changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(player))
    } catch (error) {
      console.error('Error saving player data:', error)
    }
  }, [player])

  const setPlayer = useCallback((updates) => {
    setPlayerState(prev => ({
      ...prev,
      ...updates
    }))
  }, [])

  const setProfession = useCallback((profession, value) => {
    setPlayerState(prev => ({
      ...prev,
      professions: {
        ...prev.professions,
        [profession]: value
      }
    }))
  }, [])

  const resetPlayer = useCallback(() => {
    setPlayerState(DEFAULT_PLAYER)
  }, [])

  const value = useMemo(
    () => ({ player, setPlayer, setProfession, resetPlayer }),
    [player, setPlayer, setProfession, resetPlayer]
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}

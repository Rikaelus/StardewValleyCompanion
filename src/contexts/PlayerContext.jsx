import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { mapProfessionIds } from '../utils/SaveFileParser'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'stardew-tracker-player'

const DEFAULT_PLAYER = {
  name: '',
  farmName: '',
  jojaMember: false,
  recentSearches: [],
  professions: {
    // Farming
    rancher: false, tiller: false,
    coopmaster: false, shepherd: false, artisan: false, agriculturist: false,
    // Fishing
    fisher: false, trapper: false,
    angler: false, pirate: false, mariner: false, luremaster: false,
    // Foraging
    forester: false, gatherer: false,
    lumberjack: false, tapper: false, botanist: false, tracker: false,
    // Mining
    miner: false, geologist: false,
    blacksmith: false, prospector: false, excavator: false, gemologist: false,
    // Combat
    fighter: false, scout: false,
    brute: false, defender: false, acrobat: false, desperado: false,
  },
  saveData: null,
}

export function PlayerProvider({ children }) {
  const [player, setPlayerState] = useState(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new fields
        return {
          ...DEFAULT_PLAYER,
          ...parsed,
          professions: { ...DEFAULT_PLAYER.professions, ...parsed.professions },
          jojaMember: parsed.jojaMember ?? false,
          saveData: parsed.saveData ?? null,
        }
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

  const addRecentSearch = useCallback((query) => {
    const q = query.trim()
    if (!q) return
    setPlayerState(prev => {
      const filtered = (prev.recentSearches || []).filter(s => s.toLowerCase() !== q.toLowerCase())
      return { ...prev, recentSearches: [q, ...filtered].slice(0, 5) }
    })
  }, [])

  const importSaveData = useCallback((parsedData) => {
    setPlayerState(prev => {
      const professions = mapProfessionIds(parsedData.professionIds || [])
      const jojaMember = (parsedData.mailReceived || []).includes('JojaMember')

      return {
        ...prev,
        name: parsedData.name || prev.name,
        farmName: parsedData.farmName || prev.farmName,
        jojaMember,
        professions: { ...prev.professions, ...professions },
        saveData: {
          ...parsedData,
          importedAt: new Date().toISOString(),
        },
      }
    })
  }, [])

  const clearSaveData = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      name: '',
      farmName: '',
      saveData: null,
    }))
  }, [])

  const resetPlayer = useCallback(() => {
    setPlayerState(DEFAULT_PLAYER)
  }, [])

  const value = useMemo(
    () => ({ player, setPlayer, setProfession, addRecentSearch, importSaveData, clearSaveData, resetPlayer }),
    [player, setPlayer, setProfession, addRecentSearch, importSaveData, clearSaveData, resetPlayer]
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

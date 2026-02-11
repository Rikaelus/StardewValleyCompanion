import { createContext, useContext, useState, useEffect } from 'react'

const VillagersContext = createContext(null)

export function VillagersProvider({ children }) {
  const [villagers, setVillagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadVillagers() {
      try {
        const response = await fetch('data/reference/villagers.json')
        if (!response.ok) throw new Error('Failed to load villagers')
        const data = await response.json()
        setVillagers(data.villagers || [])
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    loadVillagers()
  }, [])

  return (
    <VillagersContext.Provider value={{ villagers, loading, error }}>
      {children}
    </VillagersContext.Provider>
  )
}

export function useVillagers() {
  const context = useContext(VillagersContext)
  if (!context) {
    throw new Error('useVillagers must be used within a VillagersProvider')
  }
  return context
}

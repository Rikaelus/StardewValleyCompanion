import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SectionNavContext = createContext(null)

/**
 * Provides a registry for ModalSection components to register/unregister
 * so the Modal nav can be derived from what actually rendered.
 *
 * Sections register with (id, label) via useRegisterSection.
 * The nav reads the ordered list via useSectionNav.
 */
export function SectionNavProvider({ children }) {
  const [sections, setSections] = useState([])

  const register = useCallback((id, label) => {
    setSections(prev => {
      if (prev.some(s => s.id === id)) return prev
      return [...prev, { id, label }]
    })
  }, [])

  const unregister = useCallback((id) => {
    setSections(prev => {
      const next = prev.filter(s => s.id !== id)
      return next.length === prev.length ? prev : next
    })
  }, [])

  // Stable ref for register/unregister so ModalSection effects don't re-fire
  const api = useMemo(() => ({ register, unregister }), [register, unregister])

  return (
    <SectionNavContext.Provider value={{ sections, api }}>
      {children}
    </SectionNavContext.Provider>
  )
}

/**
 * Called by ModalSection to register itself in the nav.
 * Only registers if both id and navLabel are provided.
 */
export function useRegisterSection(id, navLabel) {
  const ctx = useContext(SectionNavContext)
  const apiRef = useRef(ctx?.api)
  apiRef.current = ctx?.api

  useEffect(() => {
    const api = apiRef.current
    if (!api || !id || !navLabel) return
    api.register(id, navLabel)
    return () => api.unregister(id)
  }, [id, navLabel])
}

/**
 * Called by Modal to get the current list of registered sections.
 */
export function useSectionNav() {
  const ctx = useContext(SectionNavContext)
  return ctx?.sections ?? []
}

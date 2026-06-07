import { useState, useCallback } from 'react'

const STORAGE_KEY = 'todo-filters'

export const TODO_CATEGORIES = [
  {
    id: 'social',
    label: 'Social',
    subtypes: new Set(['social']),
    defaultOn: true,
  },
  {
    id: 'bundle',
    label: 'Bundles',
    subtypes: new Set(['bundle']),
    defaultOn: true,
  },
  {
    id: 'fishing',
    label: 'Fishing',
    subtypes: new Set(['fishing']),
    defaultOn: true,
  },
  {
    id: 'shipping',
    label: 'Shipping',
    subtypes: new Set(['shipping']),
    defaultOn: true,
  },
  {
    id: 'museum',
    label: 'Museum',
    subtypes: new Set(['museum']),
    defaultOn: false,
  },
  {
    id: 'cooking',
    label: 'Cooking',
    subtypes: new Set(['cooking']),
    defaultOn: true,
  },
  {
    id: 'crafting',
    label: 'Crafting',
    subtypes: new Set(['crafting']),
    defaultOn: true,
  },
  {
    id: 'perfection',
    label: 'Perfection',
    subtypes: new Set(['perfection']),
    defaultOn: true,
  },
  {
    id: 'achievement',
    label: 'Achievements',
    subtypes: new Set(['achievement']),
    defaultOn: true,
  },
  {
    id: 'progression',
    label: 'Progression',
    subtypes: new Set(['progression']),
    defaultOn: true,
  },
  {
    id: 'ungoverned',
    label: 'Other',
    subtypes: new Set(),  // catch-all: todos with no goal subtypes
    defaultOn: true,
  },
]

function loadEnabled() {
  const defaults = Object.fromEntries(TODO_CATEGORIES.map(c => [c.id, c.defaultOn]))
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed === 'object' && parsed !== null) {
        // Only keep keys that are valid current categories — strip stale keys
        const filtered = Object.fromEntries(
          Object.entries(parsed).filter(([k]) => k in defaults)
        )
        return { ...defaults, ...filtered }
      }
    }
  } catch {}
  return defaults
}

export function useTodoFilters() {
  const [enabled, setEnabled] = useState(loadEnabled)

  const toggle = useCallback((categoryId) => {
    setEnabled(prev => {
      const defaults = Object.fromEntries(TODO_CATEGORIES.map(c => [c.id, c.defaultOn]))
      const merged = { ...defaults, ...prev }
      const next = { ...merged, [categoryId]: !merged[categoryId] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const isVisible = useCallback((todo) => {
    const subtypes = todo.goalSubtypes ?? []

    if (subtypes.length === 0) {
      // Ungoverned todo — no goal subtypes
      return enabled['ungoverned'] ?? true
    }

    // Visible if any of the todo's goal subtypes are enabled
    return subtypes.some(subtype => {
      const category = TODO_CATEGORIES.find(c => c.subtypes.has(subtype))
      return category ? (enabled[category.id] ?? category.defaultOn) : true
    })
  }, [enabled])

  return { enabled, toggle, isVisible }
}

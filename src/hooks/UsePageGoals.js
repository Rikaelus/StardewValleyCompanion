import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useEntities } from '../contexts/EntityContext'

/**
 * Returns all static goal entities whose linkPath matches the current route,
 * sorted by name. Excludes save-derived goals (villager, pet, animal).
 */
export function usePageGoals() {
  const { pathname } = useLocation()
  const { items } = useEntities()

  return useMemo(() => {
    return items.filter(i =>
      i.type === 'goal' &&
      i.trackerPage === pathname &&
      !i.villagerId && !i.petName && !i.animalName
    )
  }, [items, pathname])
}

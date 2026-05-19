import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'
import {
  POLYCULTURE_TARGET,
  MONOCULTURE_TARGET,
  POLYCULTURE_NAMES,
  MONOCULTURE_ONLY_NAMES,
} from '../../utils/AchievementProgress'

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter', 'special']
const SEASON_LABELS = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
  special: 'Year-Round & Special',
}

function cropSeason(crop) {
  const s = crop.seasons ?? []
  if (!s.length || s.length === 4) return 'special'
  return s[0]
}

function ShippingPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')

  const { groups, totals, monocultureMax } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 }, monocultureMax: 0 }

    const polyCrops = items.filter(i => i.type === 'crop' && POLYCULTURE_NAMES.has(i.name))
    const monoCrops = items.filter(i => i.type === 'crop' && MONOCULTURE_ONLY_NAMES.has(i.name))
    const allTracked = [...polyCrops, ...monoCrops]

    const buckets = {}
    let monocultureMax = 0

    for (const item of allTracked) {
      const isPolyculture = POLYCULTURE_NAMES.has(item.name)
      const season = cropSeason(item)
      if (!buckets[season]) buckets[season] = []
      const count = progress.getItemShippedCount(item.gameId)
      if (count > monocultureMax) monocultureMax = count

      if (isPolyculture) {
        const shipped = count > 0
        const metPolyculture = count >= POLYCULTURE_TARGET
        const state = metPolyculture ? 'complete' : shipped ? 'partial' : 'missing'
        const badge = shipped && !metPolyculture ? 'check' : null
        const tileTitle = metPolyculture
          ? `${item.name} — ${count} shipped (Polyculture done)`
          : shipped
            ? `${item.name} — ${count} shipped (need ${POLYCULTURE_TARGET} for Polyculture)`
            : `${item.name} — Not shipped`
        buckets[season].push({ entity: item, state, count: count > 0 ? count : null, badge, tileTitle })
      } else {
        // Monoculture-only: complete at 300, partial if any shipped
        const shipped = count > 0
        const metMono = count >= MONOCULTURE_TARGET
        const state = metMono ? 'complete' : shipped ? 'partial' : 'missing'
        const badge = shipped && !metMono ? 'check' : null
        const tileTitle = metMono
          ? `${item.name} — ${count} shipped (Monoculture done)`
          : shipped
            ? `${item.name} — ${count} shipped (need ${MONOCULTURE_TARGET} for Monoculture)`
            : `${item.name} — Not shipped (Monoculture only)`
        buckets[season].push({ entity: item, state, count: count > 0 ? count : null, badge, tileTitle })
      }
    }

    const groups = SEASON_ORDER
      .filter(s => buckets[s])
      .map(s => ({ id: s, title: SEASON_LABELS[s], items: buckets[s] }))

    const polyItems = groups.flatMap(g => g.items).filter(i => POLYCULTURE_NAMES.has(i.entity.name))
    const done = polyItems.filter(i => i.state === 'complete').length

    return { groups, totals: { done, total: polyItems.length, label: `× ${POLYCULTURE_TARGET}` }, monocultureMax }
  }, [items, loading, progress])

  const milestones = [
    { label: `${POLYCULTURE_TARGET} of each — Polyculture`, reached: totals.done >= totals.total && totals.total > 0 },
    { label: `${MONOCULTURE_TARGET} of one — Monoculture`, reached: monocultureMax >= MONOCULTURE_TARGET },
  ]

  return (
    <CollectionPage
      title="Crops Shipped"
      groups={groups}
      totals={totals}
      milestones={milestones}
      legend={[
        { state: 'complete', label: `${POLYCULTURE_TARGET}+ shipped (Polyculture goal met)` },
        { state: 'partial', label: 'Shipped, but under goal' },
        { state: 'missing', label: 'None shipped yet' },
      ]}
      activeFilter={filter}
      onFilter={setFilter}
      hasSaveData={progress.hasSaveData}
      keepGroups
      noSaveMessage="Upload your save file to track how many of each crop you've shipped."
    />
  )
}

export default ShippingPage

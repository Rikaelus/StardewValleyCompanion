import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'

function classifyFish(fish) {
  if (fish.contextTags?.includes('fish_legendary')) return 'Legendary'
  const locs = (fish.sources ?? []).filter(s => s.type === 'fish').map(s => s.location ?? '')
  if (locs.some(l => l.includes('Crab Pot'))) return 'Crab Pot'
  if (locs.some(l => l.includes('Mine') || l.includes('Volcano') || l.includes('Lava'))) return 'Mines & Volcano'
  const isOcean = locs.some(l => l.includes('Ocean') || l.includes('Night Market') || l.includes('Beach') || l.includes('Pirate'))
  const isFresh = locs.some(l => l.includes('Lake') || l.includes('River') || l.includes('Mountain') || l.includes('Forest') || l.includes('Sewer') || l.includes('Pond') || l.includes('Ginger Island North'))
  if (isOcean && !isFresh) return 'Ocean'
  if (isFresh && !isOcean) return 'Freshwater'
  return 'Special Locations'
}

const GROUP_ORDER = ['Ocean', 'Freshwater', 'Crab Pot', 'Mines & Volcano', 'Special Locations', 'Legendary']

function FishingPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const fish = items.filter(i => i.type === 'fish')
    fish.sort((a, b) => a.name.localeCompare(b.name))

    const buckets = {}
    for (const item of fish) {
      const groupName = classifyFish(item)
      if (!buckets[groupName]) buckets[groupName] = []
      const caught = progress.isFishCaught(item.gameId)
      const count = progress.getFishCaughtCount(item.gameId)
      const state = caught ? 'complete' : 'missing'
      const tileTitle = caught
        ? `${item.name} — Caught ×${count}`
        : `${item.name} — Not caught`
      buckets[groupName].push({ entity: item, state, count: count > 0 ? count : null, tileTitle })
    }

    const groups = GROUP_ORDER
      .filter(name => buckets[name])
      .map(name => ({ id: name, title: name, items: buckets[name] }))

    const allItems = groups.flatMap(g => g.items)
    const done = allItems.filter(i => i.state === 'complete').length

    return { groups, totals: { done, total: allItems.length, label: 'caught' } }
  }, [items, loading, progress])

  const milestones = [
    { label: '10 — Fisherman', reached: totals.done >= 10 },
    { label: '24 — Ol\' Mariner', reached: totals.done >= 24 },
    { label: `${totals.total} — Master Angler`, reached: totals.done >= totals.total },
  ]

  return (
    <CollectionPage
      title="Fish Caught"
      groups={groups}
      totals={totals}
      milestones={milestones}
      activeFilter={filter}
      onFilter={setFilter}
      hasSaveData={progress.hasSaveData}
      noSaveMessage="Upload your save file to track which fish you've caught."
    />
  )
}

export default FishingPage

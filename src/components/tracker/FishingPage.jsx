import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'
import gameObjects from '../../../data/game-exports/Objects.json'

const FISHING_COLLECTION_IDS = new Set(
  Object.entries(gameObjects)
    .filter(([, item]) =>
      !item.ExcludeFromFishingCollection &&
      (item.Category === -4 || item.Type === 'Fish' || (item.ContextTags ?? []).includes('counts_as_fish_catch'))
    )
    .map(([id]) => id)
)

function classifyByLocation(fish) {
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

const LOCATION_GROUP_ORDER = ['Ocean', 'Freshwater', 'Crab Pot', 'Mines & Volcano', 'Special Locations', 'Legendary']
const SEASON_GROUP_ORDER = ['Spring', 'Summer', 'Fall', 'Winter', 'All Seasons']

function getSeasonGroups(fish) {
  const fishSources = (fish.sources ?? []).filter(s => s.type === 'fish')
  const seasons = new Set()
  for (const src of fishSources) {
    if (src.seasons) src.seasons.forEach(s => seasons.add(s))
  }
  if (seasons.size === 0) return ['All Seasons']
  return [...seasons].map(s => s.charAt(0).toUpperCase() + s.slice(1))
}

function FishingPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')
  const [groupBy, setGroupBy] = useState('season')

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const fish = items.filter(i => FISHING_COLLECTION_IDS.has(String(i.gameId).replace(/^\(O\)/, '')))
    fish.sort((a, b) => a.name.localeCompare(b.name))

    const makeTile = item => {
      const caught = progress.isFishCaught(item.gameId)
      const count = progress.getFishCaughtCount(item.gameId)
      const state = caught ? 'complete' : 'missing'
      const tileTitle = caught ? `${item.name} — Caught ×${count}` : `${item.name} — Not caught`
      return { entity: item, state, count: count > 0 ? count : null, tileTitle }
    }

    const done = fish.filter(f => progress.isFishCaught(f.gameId)).length
    const totals = { done, total: fish.length, label: 'caught' }

    let groups
    if (groupBy === 'location') {
      const buckets = {}
      for (const item of fish) {
        const groupName = classifyByLocation(item)
        if (!buckets[groupName]) buckets[groupName] = []
        buckets[groupName].push(makeTile(item))
      }
      groups = LOCATION_GROUP_ORDER
        .filter(name => buckets[name])
        .map(name => ({ id: name, title: name, items: buckets[name] }))
    } else {
      const buckets = {}
      for (const item of fish) {
        for (const groupName of getSeasonGroups(item)) {
          if (!buckets[groupName]) buckets[groupName] = []
          buckets[groupName].push(makeTile(item))
        }
      }
      groups = SEASON_GROUP_ORDER
        .filter(name => buckets[name])
        .map(name => ({ id: name, title: name, items: buckets[name] }))
    }

    return { groups, totals }
  }, [items, loading, progress, groupBy])

  const milestones = [
    { label: '10 — Fisherman', reached: totals.done >= 10 },
    { label: '24 — Ol\' Mariner', reached: totals.done >= 24 },
    { label: `${totals.total} — Master Angler`, reached: totals.done >= totals.total },
  ]

  const groupByTabs = [
    { id: 'season', label: 'By Season' },
    { id: 'location', label: 'By Location' },
  ]

  return (
    <CollectionPage
      title="Fish Caught"
      groups={groups}
      totals={totals}
      milestones={milestones}
      activeFilter={filter}
      onFilter={setFilter}
      groupByTabs={groupByTabs}
      activeGroupBy={groupBy}
      onGroupBy={setGroupBy}
      keepGroups
      quantityType="caught"
      hasSaveData={progress.hasSaveData}
      noSaveMessage="Upload your save file to track which fish you've caught."
    />
  )
}

export default FishingPage

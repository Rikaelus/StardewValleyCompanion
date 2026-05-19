import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'

// Unlock condition type → human-readable group label
const UNLOCK_GROUP = {
  friendship: 'Friendship Rewards',
  skill: 'Skill Unlocks',
  purchase: 'Purchased / Found',
  mail: 'Mail Rewards',
  queen_of_sauce: "Queen of Sauce",
}

function unlockGroup(source) {
  const cond = source?.unlockCondition
  if (!cond) return 'Other'
  return UNLOCK_GROUP[cond.type] ?? 'Other'
}

const GROUP_ORDER = [
  "Queen of Sauce",
  'Friendship Rewards',
  'Skill Unlocks',
  'Purchased / Found',
  'Mail Rewards',
  'Other',
]

function CookingPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const cookable = items.filter(i => i.capabilities?.cookable && i.sources?.some(s => s.type === 'cooking'))
    cookable.sort((a, b) => a.name.localeCompare(b.name))

    const buckets = {}
    for (const item of cookable) {
      const src = item.sources.find(s => s.type === 'cooking')
      const groupName = unlockGroup(src)
      if (!buckets[groupName]) buckets[groupName] = []
      const known = progress.isRecipeKnown(src.recipeName)
      const cooked = progress.isRecipeCooked(item.gameId)
      const state = cooked ? 'complete' : known ? 'partial' : 'missing'
      const tileTitle = cooked
        ? `${item.name} — Cooked`
        : known
          ? `${item.name} — Recipe known, not yet cooked`
          : `${item.name} — Recipe unknown`
      buckets[groupName].push({ entity: item, state, tileTitle })
    }

    const groups = GROUP_ORDER
      .filter(name => buckets[name])
      .map(name => ({ id: name, title: name, items: buckets[name] }))

    const allItems = groups.flatMap(g => g.items)
    const done = allItems.filter(i => i.state === 'complete').length

    return { groups, totals: { done, total: allItems.length, label: 'cooked' } }
  }, [items, loading, progress])

  const milestones = [
    { label: '10 — Cook', reached: totals.done >= 10 },
    { label: '25 — Sous Chef', reached: totals.done >= 25 },
    { label: `${totals.total} — Gourmet Chef`, reached: totals.done >= totals.total },
  ]

  return (
    <CollectionPage
      title="Cooking Recipes"
      groups={groups}
      totals={totals}
      milestones={milestones}
      legend={[
        { state: 'complete', label: 'Cooked at least once' },
        { state: 'partial', label: 'Recipe known, not yet cooked' },
        { state: 'missing', label: 'Recipe unknown' },
      ]}
      activeFilter={filter}
      onFilter={setFilter}
      hasSaveData={progress.hasSaveData}
      noSaveMessage="Upload your save file to track which recipes you've learned and cooked."
    />
  )
}

export default CookingPage

import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'

const SUBTYPE_GROUP = {
  crafted: 'Equipment & Structures',
  fertilizer: 'Fertilizers',
  bait: 'Bait',
  tackle: 'Tackle',
  flooring: 'Flooring & Fencing',
  ring: 'Rings',
  seed: 'Seeds',
  'tree-seed': 'Seeds',
  food: 'Food & Consumables',
  misc: 'Tools & Totems',
}

const GROUP_ORDER = [
  'Equipment & Structures',
  'Fertilizers',
  'Bait',
  'Tackle',
  'Flooring & Fencing',
  'Rings',
  'Seeds',
  'Food & Consumables',
  'Tools & Totems',
  'Other',
]

function CraftingPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const craftable = items.filter(i => i.capabilities?.craftable && i.sources?.some(s => s.type === 'crafting'))
    craftable.sort((a, b) => a.name.localeCompare(b.name))

    const buckets = {}
    for (const item of craftable) {
      const src = item.sources.find(s => s.type === 'crafting')
      const groupName = SUBTYPE_GROUP[item.subtype] ?? 'Other'
      if (!buckets[groupName]) buckets[groupName] = []
      const known = progress.isCraftingRecipeKnown(src.recipeName)
      const crafted = progress.isCraftingRecipeCrafted(src.recipeName)
      const state = crafted ? 'complete' : known ? 'partial' : 'missing'
      const tileTitle = crafted
        ? `${item.name} — Crafted`
        : known
          ? `${item.name} — Recipe known, not yet crafted`
          : `${item.name} — Recipe unknown`
      buckets[groupName].push({ entity: item, state, tileTitle })
    }

    const groups = GROUP_ORDER
      .filter(name => buckets[name])
      .map(name => ({ id: name, title: name, items: buckets[name] }))

    const allItems = groups.flatMap(g => g.items)
    const done = allItems.filter(i => i.state === 'complete').length

    return { groups, totals: { done, total: allItems.length, label: 'crafted' } }
  }, [items, loading, progress])

  const milestones = [
    { label: '15 — D.I.Y.', reached: totals.done >= 15 },
    { label: '30 — Artisan', reached: totals.done >= 30 },
    { label: `${totals.total} — Craft Master`, reached: totals.done >= totals.total },
  ]

  return (
    <CollectionPage
      title="Crafting Recipes"
      groups={groups}
      totals={totals}
      milestones={milestones}
      legend={[
        { state: 'complete', label: 'Crafted at least once' },
        { state: 'partial', label: 'Recipe known, not yet crafted' },
        { state: 'missing', label: 'Recipe unknown' },
      ]}
      activeFilter={filter}
      onFilter={setFilter}
      hasSaveData={progress.hasSaveData}
      noSaveMessage="Upload your save file to track which recipes you've learned and crafted."
    />
  )
}

export default CraftingPage

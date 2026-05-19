import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'
import { FULL_SHIPMENT_NAMES } from '../../utils/AchievementProgress'

// "any" variants (Honey, Pickles, Jelly, Wine, Juice, Roe, Aged Roe, Smoked Fish,
// Dried Fruit, Dried Mushrooms, Raisins) share a single game ID regardless of input.
const GROUPS = [
  {
    id: 'produce',
    title: 'Crops & Forage',
    names: [
      'Parsnip', 'Green Bean', 'Cauliflower', 'Potato', 'Garlic', 'Kale', 'Rhubarb',
      'Melon', 'Tomato', 'Blueberry', 'Hot Pepper', 'Wheat', 'Radish', 'Red Cabbage',
      'Starfruit', 'Corn', 'Unmilled Rice', 'Eggplant', 'Artichoke', 'Pumpkin',
      'Bok Choy', 'Yam', 'Cranberries', 'Beet', 'Amaranth', 'Hops', 'Poppy',
      'Strawberry', 'Ancient Fruit', 'Tulip', 'Summer Spangle', 'Fairy Rose', 'Blue Jazz',
      'Coffee Bean', 'Sweet Gem Berry', 'Tea Leaves', 'Ginger', 'Taro Root',
      'Pineapple', 'Mango', 'Carrot', 'Summer Squash', 'Broccoli', 'Powdermelon',
      'Wild Horseradish', 'Daffodil', 'Leek', 'Dandelion', 'Cave Carrot',
      'Coconut', 'Cactus Fruit', 'Banana', 'Salmonberry', 'Morel',
      'Fiddlehead Fern', 'Chanterelle', 'Holly', 'Ostrich Egg',
      'Spring Onion', 'Sweet Pea', 'Common Mushroom', 'Wild Plum', 'Hazelnut',
      'Blackberry', 'Winter Root', 'Crystal Fruit', 'Snow Yam', 'Crocus',
      'Red Mushroom', 'Sunflower', 'Purple Mushroom', 'Grape', 'Spice Berry',
      'Magma Cap', 'Green Tea',
    ],
  },
  {
    id: 'animal',
    title: 'Animal Products',
    names: [
      'Egg (White)', 'Large Egg (White)', 'Egg (Brown)', 'Large Egg (Brown)',
      'Milk', 'Large Milk', 'Void Egg', 'Duck Egg', 'Goat Milk', 'L. Goat Milk',
      'Duck Feather', 'Wool', "Rabbit's Foot", 'Truffle',
      'Mayonnaise', 'Duck Mayonnaise', 'Void Mayonnaise', 'Dinosaur Mayonnaise',
      'Cheese', 'Goat Cheese', 'Cloth', 'Truffle Oil', 'Caviar',
    ],
  },
  {
    id: 'artisan',
    title: 'Artisan & Processed',
    names: [
      'Honey', 'Pickles', 'Jelly', 'Beer', 'Pale Ale', 'Wine', 'Juice', 'Mead',
      'Maple Syrup', 'Oak Resin', 'Pine Tar', 'Mystic Syrup',
      'Roe', 'Aged Roe', 'Smoked Fish', 'Squid Ink',
      'Raisins', 'Dried Fruit', 'Dried Mushrooms',
    ],
  },
  {
    id: 'resources',
    title: 'Resources & Materials',
    names: [
      'Wood', 'Stone', 'Hardwood', 'Sap', 'Fiber', 'Clay', 'Coal', 'Moss',
      'Copper Ore', 'Iron Ore', 'Gold Ore', 'Iridium Ore', 'Radioactive Ore',
      'Copper Bar', 'Iron Bar', 'Gold Bar', 'Iridium Bar', 'Radioactive Bar', 'Refined Quartz',
      'Battery Pack', 'Bone Fragment', 'Cinder Shard',
    ],
  },
  {
    id: 'forageable-misc',
    title: 'Fish Tank & Other',
    names: [
      'Nautilus Shell', 'Coral', 'Rainbow Shell', 'Sea Urchin',
      'Bug Meat', 'Slime', 'Bat Wing', 'Solar Essence', 'Void Essence',
    ],
  },
]

// Verify all grouped names are present in the shared set (development guard)
if (process.env.NODE_ENV !== 'production') {
  for (const g of GROUPS) {
    for (const name of g.names) {
      if (!FULL_SHIPMENT_NAMES.has(name)) {
        console.warn(`FullShipmentPage: "${name}" is in GROUPS but not in FULL_SHIPMENT_NAMES`)
      }
    }
  }
}

function FullShipmentPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const byName = {}
    for (const item of items) byName[item.name] = item

    let done = 0
    let total = 0

    const groups = GROUPS.map(group => {
      const groupItems = []
      for (const name of group.names) {
        const entity = byName[name]
        if (!entity) continue
        const count = progress.getItemShippedCount(entity.gameId)
        const shipped = count > 0
        const state = shipped ? 'complete' : 'missing'
        const tileTitle = shipped ? `${entity.name} — ${count} shipped` : `${entity.name} — Not shipped`
        if (shipped) done++
        total++
        groupItems.push({ entity, state, count: shipped ? count : null, badge: null, tileTitle })
      }
      return { id: group.id, title: group.title, items: groupItems }
    }).filter(g => g.items.length > 0)

    return { groups, totals: { done, total } }
  }, [items, loading, progress])

  const achievement = totals.done === totals.total && totals.total > 0

  return (
    <CollectionPage
      title="Full Shipment"
      groups={groups}
      totals={totals}
      milestones={[
        { label: 'Full Shipment achievement', reached: achievement },
      ]}
      legend={[
        { state: 'complete', label: 'Shipped at least once' },
        { state: 'missing', label: 'Never shipped' },
      ]}
      activeFilter={filter}
      onFilter={setFilter}
      hasSaveData={progress.hasSaveData}
      keepGroups
      noSaveMessage="Upload your save file to track which items you've shipped."
    />
  )
}

export default FullShipmentPage

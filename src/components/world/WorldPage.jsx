import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import { collectLocationItems } from '../../utils/LocationItems'
import './WorldPage.css'

const REGION_IDS = ['map-valley', 'map-island', 'map-desert']

const CHIP_DEFS = [
  { key: 'fish',     label: 'Fish',      get: r => r.fishEntries.length },
  { key: 'forage',   label: 'Forage',    get: r => r.forageEntries.length },
  { key: 'monsters', label: 'Monsters',  get: r => r.monsterEntries.length },
  { key: 'tilling',  label: 'Artifacts', get: r => r.tillingEntries.length },
  { key: 'other',    label: 'Other',     get: r => r.otherList.length },
]

function LocationChips({ entity, allItems, findById }) {
  const chips = useMemo(() => {
    const result = collectLocationItems(entity.id, allItems, findById, { deep: false })
    const shopCount = allItems.filter(
      i => i.type === 'location' && i.subtype === 'shop' &&
        i.locations?.some(l => l.id === entity.id)
    ).length
    const bundleCount = entity.bundles?.length ?? 0
    const out = CHIP_DEFS.map(c => ({ label: c.label, count: c.get(result) })).filter(c => c.count > 0)
    if (bundleCount > 0) out.push({ label: 'Bundles', count: bundleCount })
    if (shopCount > 0) out.push({ label: 'Shops', count: shopCount })
    return out
  }, [entity.id, allItems, findById])

  if (chips.length === 0) return null
  return (
    <span className="world-node-chips">
      {chips.map(c => (
        <span key={c.label} className="world-node-chip">{c.label} {c.count}</span>
      ))}
    </span>
  )
}

function filterChildren(ids, findById, showFestivals, showShops) {
  return ids
    .map(id => findById(id))
    .filter(e => {
      if (!e) return false
      if (e.subtype === 'shop' && !showShops) return false
      if (e.subtype === 'festival' && !showFestivals) return false
      return true
    })
}

function LocationNode({ entity, depth, allItems, findById, shopsByZone, showFestivals, showShops }) {
  if (!entity) return null
  if (entity.subtype === 'festival' && !showFestivals) return null

  const locationChildren = filterChildren(entity.childLocations || [], findById, showFestivals, showShops)
  const shopChildren = showShops ? (shopsByZone.get(entity.id) || []) : []
  const children = [...locationChildren, ...shopChildren]

  return (
    <li className="world-node">
      <span className="world-node-row">
        <UniversalModalButton item={entity} variant="inline" />
        <LocationChips entity={entity} allItems={allItems} findById={findById} />
      </span>
      {children.length > 0 && (
        <ul className="world-node-children">
          {children.map(child => (
            <LocationNode key={child.id} entity={child} depth={depth + 1} allItems={allItems} findById={findById} shopsByZone={shopsByZone} showFestivals={showFestivals} showShops={showShops} />
          ))}
        </ul>
      )}
    </li>
  )
}

function AreaCard({ area, allItems, findById, shopsByZone, showFestivals, showShops }) {
  const locationChildren = filterChildren(area.childLocations || [], findById, showFestivals, showShops)
  const shopChildren = showShops ? (shopsByZone.get(area.id) || []) : []
  const children = [...locationChildren, ...shopChildren]

  return (
    <div className="world-area-card">
      <div className={`world-area-heading${children.length > 0 ? ' world-area-heading--divided' : ''}`}>
        <UniversalModalButton item={area} variant="inline" iconSize={24} />
        <LocationChips entity={area} allItems={allItems} findById={findById} />
      </div>
      {children.length > 0 && (
        <ul className="world-tree">
          {children.map(child => (
            <LocationNode key={child.id} entity={child} depth={1} allItems={allItems} findById={findById} shopsByZone={shopsByZone} showFestivals={showFestivals} showShops={showShops} />
          ))}
        </ul>
      )}
    </div>
  )
}

function WorldPage() {
  const { findById, items: allItems, loading } = useEntities()

  const regions = useMemo(() => {
    if (loading) return []
    return REGION_IDS.map(id => findById(id)).filter(Boolean)
  }, [findById, loading])

  const shopsByZone = useMemo(() => {
    const map = new Map()
    allItems.forEach(item => {
      if (item.type === 'location' && item.subtype === 'shop') {
        const zoneId = item.locations?.[0]?.id
        if (zoneId) {
          if (!map.has(zoneId)) map.set(zoneId, [])
          map.get(zoneId).push(item)
        }
      }
    })
    return map
  }, [allItems])

  const [activeTab, setActiveTab] = useState(REGION_IDS[0])
  const [showFestivals, setShowFestivals] = useState(false)
  const [showShops, setShowShops] = useState(false)

  if (loading) return <PagePanel><div className="world-loading">Loading…</div></PagePanel>

  const activeRegion = regions.find(r => r.id === activeTab)
  const areas = filterChildren(activeRegion?.childLocations || [], findById, showFestivals, showShops)

  return (
    <PagePanel>
      <div className="world-page">
        <div className="world-header">
          <h1 className="world-title">World</h1>
          <p className="world-subtitle">All locations in Stardew Valley.</p>
        </div>

        <div className="world-toolbar">
          <div className="world-tabs" role="tablist">
            {regions.map(region => (
              <button
                key={region.id}
                type="button"
                role="tab"
                aria-selected={activeTab === region.id}
                className={`world-tab${activeTab === region.id ? ' world-tab--active' : ''}`}
                onClick={() => setActiveTab(region.id)}
              >
                {region.name}
              </button>
            ))}
          </div>

          <div className="world-toggles">
            <button
              type="button"
              className={`world-toggle${showFestivals ? ' world-toggle--active' : ''}`}
              onClick={() => setShowFestivals(v => !v)}
            >
              Festivals
            </button>
            <button
              type="button"
              className={`world-toggle${showShops ? ' world-toggle--active' : ''}`}
              onClick={() => setShowShops(v => !v)}
            >
              Shops
            </button>
          </div>
        </div>

        <div className="world-areas">
          {areas.map(area => (
            <AreaCard key={area.id} area={area} allItems={allItems} findById={findById} shopsByZone={shopsByZone} showFestivals={showFestivals} showShops={showShops} />
          ))}
        </div>
      </div>
    </PagePanel>
  )
}

export default WorldPage

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useModalUrl } from '../../hooks/useModalUrl'
import { useOpenModal } from '../../contexts/ModalContext'
import Modal from './Modal'
import ModalHeader from './ModalHeader'
import ModalGiftPreferences from './ModalGiftPreferences'
import ItemSellPrice from './ItemSellPrice'
import { useEntities } from '../../contexts/EntityContext'
import { getEntitySubtitle, computeDropCountDistribution, formatChance, formatTime, getLocationNames, getLocationIds } from '../../utils/Formatters'
import SeasonBadges from './SeasonBadges'
import InfoTooltip from './InfoTooltip'
import FishingInfoSection from './FishingInfoSection'
import AgingInfoSection from './AgingInfoSection'
import ContextTagsSection from './ContextTagsSection'
import LocationAvailabilitySection from './LocationAvailabilitySection'
import BundlesSection from './BundlesSection'
import VariationsListSection from './VariationsListSection'
import SeedProducesSection from './SeedProducesSection'
import BundleRequirementsSection from './BundleRequirementsSection'
import BundleRewardSection from './BundleRewardSection'
import StoreContentsSection from './StoreContentsSection'
import MachineOutputsSection from './MachineOutputsSection'
import SellingInfoSection from './SellingInfoSection'
import FoodBuffsSection, { BuffIcon, formatDuration } from './FoodBuffsSection'
import ModalItemButton from './ModalItemButton'
import ModalSection from './ModalSection'
import './UniversalModal.css'

/** Convert game time integer (e.g. 900, 1430, 2200) to "9:00 AM" / "10:30 PM" */
function formatGameTime(t) {
  const h = Math.floor(t / 100) % 24
  const m = t % 100
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** Capitalize first letter of a string */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function collectLocationItems(locationId, allItems, findById) {
  const collectDescendants = (id, result) => {
    const entity = findById(id)
    if (!entity?.childLocations) return
    for (const childId of entity.childLocations) {
      if (!childId.startsWith('map-')) continue
      result.add(childId)
      collectDescendants(childId, result)
    }
  }
  const descendantIds = new Set()
  collectDescendants(locationId, descendantIds)
  const relevantIds = new Set([locationId, ...descendantIds])

  const fishEntries = []
  const forageEntries = []
  const tillingEntries = []
  const otherItems = new Map()

  for (const item of allItems) {
    if (item.type === 'location') continue
    for (const src of item.sources || []) {
      if (!src.locationId || !relevantIds.has(src.locationId)) continue
      const subLocName = (src.locationId !== locationId)
        ? findById(src.locationId)?.name ?? null
        : null
      if (src.type === 'fish') {
        fishEntries.push({ item, src, subLocName })
      } else if (src.type === 'forage') {
        forageEntries.push({ item, src, subLocName })
      } else if (src.type === 'tilling') {
        tillingEntries.push({ item, src, subLocName })
      } else if (!otherItems.has(item.id)) {
        otherItems.set(item.id, item)
      }
    }
  }

  const monsterEntries = allItems
    .filter(item => item.type === 'monster' && item.locations?.some(loc => relevantIds.has(loc.locationId)))
    .map(item => {
      const loc = item.locations.find(loc => relevantIds.has(loc.locationId))
      return { item, qualifier: loc?.qualifier }
    })
    .sort((a, b) => a.item.name.localeCompare(b.item.name))

  const otherList = [...otherItems.values()].sort((a, b) => a.name.localeCompare(b.name))

  return { fishEntries, forageEntries, tillingEntries, monsterEntries, otherList, relevantIds }
}

/**
 * Universal modal component for displaying any entity (item, bundle, villager, etc.)
 * Dynamically renders sections based on entity type and available data.
 * Supports breadcrumb navigation: clicking links inside the modal navigates
 * in-place with a breadcrumb trail, instead of stacking modals.
 */
function UniversalModal({ entity, isOpen, onClose }) {
  const entityRef = useRef(entity)

  // Navigation history for breadcrumb trail — initialize with entity so the
  // first render already has currentEntity set (no empty-history flash).
  const [history, setHistory] = useState(() => entity ? [entity] : [])

  // When entity prop changes to a *different* entity, reset history.
  // Skip on initial mount (entityRef already equals entity from useRef(entity)).
  // Skip if history already starts with the new entity (URL-restored deeper trail).
  useEffect(() => {
    if (entity && entity !== entityRef.current) {
      setHistory(prev => prev[0] === entity ? prev : [entity])
    }
    entityRef.current = entity
  }, [entity])

  // The currently displayed entity is the last item in history
  const currentEntity = history.length > 0 ? history[history.length - 1] : null

  // Navigate to a new entity (called by child ModalItemButtons/BundleBadges)
  const handleNavigate = useCallback((newEntity) => {
    setHistory(prev => {
      // If the new entity is the previous item in the breadcrumb, go back instead of deeper
      if (prev.length >= 2 && prev[prev.length - 2].id === newEntity.id) {
        return prev.slice(0, -1)
      }
      return [...prev, newEntity]
    })
  }, [])

  // Navigate back to a specific point in the breadcrumb
  const handleBreadcrumbClick = useCallback((index) => {
    setHistory(prev => prev.slice(0, index + 1))
  }, [])

  // Detect entity type
  const entityType = useMemo(() => {
    if (!currentEntity) return null
    if (currentEntity.type === 'festival') return 'festival'
    if (currentEntity.type === 'location') return 'location'
    if (currentEntity.entityType) return currentEntity.entityType  // machine
    if (currentEntity.items && currentEntity.reward !== undefined) return 'bundle'
    if (currentEntity.type === 'villager') return 'villager'
    if (currentEntity.type) return currentEntity.type
    return 'unknown'
  }, [currentEntity])

  // Tab state for dual-context items
  const [activeTab, setActiveTab] = useState('primary')
  const [alternateContext, setAlternateContext] = useState(null)

  // Load unified entity data (fetched once for the whole app via EntityContext)
  const entityData = useEntities()
  const { byType: itemsByType, items: allItems, findById, findByGameId, findEntity, loading: entitiesLoading, error: itemsError } = entityData

  // Derive typed views for sections that reference specific item types
  const artisanItems = useMemo(() => itemsByType['artisan'] || [], [itemsByType])
  const cropItems = useMemo(() => itemsByType['crop'] || [], [itemsByType])
  const forageItems = useMemo(() => itemsByType['forage'] || [], [itemsByType])

  // Log any errors
  useEffect(() => {
    if (itemsError) console.error('Failed to load entity data:', itemsError)
  }, [itemsError])

  // Sync modal state to URL via global openModal from context
  const openModal = useOpenModal()
  useModalUrl({
    enabled: true,
    history,
    setHistory,
    onOpen: openModal,
    findEntity,
    entitiesLoading,
    isOpen,
    onClose,
  })

  // Keep the last entity data during closing animation
  useEffect(() => {
    if (entity) {
      entityRef.current = entity
    }
  }, [entity])

  // Reset tab state when the displayed entity changes (including breadcrumb navigation)
  useEffect(() => {
    if (currentEntity) {
      setActiveTab('primary')
    }
  }, [currentEntity])

  // Look up alternate context when displayed entity changes (only for items)
  useEffect(() => {
    if (!currentEntity || entityType !== 'fish' || !currentEntity.alsoAvailableAs) {
      setAlternateContext(null)
      return
    }

    const { id } = currentEntity.alsoAvailableAs
    setAlternateContext(findById(id) || null)
  }, [currentEntity, entityType, findById])

  // Use entityRef for closing animation, currentEntity for live display
  const primaryEntity = currentEntity || entityRef.current

  // Use the appropriate entity based on active tab (only for items with dual contexts)
  const displayEntity = activeTab === 'alternate' && alternateContext ? alternateContext : primaryEntity

  const renderContextTabs = () => {
    if (!alternateContext) return null

    const getTabLabel = (item) => {
      const typeLabels = {
        'fish': 'Fish (Crab Pot)',
        'forage': 'Forage (Beach)'
      }
      return typeLabels[item.type] || item.type
    }

    const tabs = [
      { key: 'primary', label: getTabLabel(primaryEntity), item: primaryEntity },
      { key: 'alternate', label: getTabLabel(alternateContext), item: alternateContext }
    ].sort((a, b) => a.label.localeCompare(b.label))

    return (
      <div className="modal-context-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`modal-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  const renderBreadcrumbs = () => {
    if (history.length <= 1) return null

    return (
      <div className="modal-breadcrumbs">
        {history.map((item, index) => {
          const isLast = index === history.length - 1
          return (
            <span key={index} className="breadcrumb-item">
              {index > 0 && <span className="breadcrumb-separator">&gt;</span>}
              {isLast ? (
                <span className="breadcrumb-current">{item.name}</span>
              ) : (
                <button
                  className="breadcrumb-link"
                  onClick={() => handleBreadcrumbClick(index)}
                  type="button"
                >
                  {item.name}
                </button>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!displayEntity) return null

  const type = displayEntity.type || 'unknown'
  const itemHasQuality = displayEntity.hasQuality !== false &&
    ['fish', 'crop', 'forage', 'tree-fruit', 'animal-product', 'food'].includes(type)
  const subtitle = getEntitySubtitle(displayEntity)
  let modalTitle = displayEntity.name
  let headerName = displayEntity.name

  {
    const isLegendaryFish = type === 'fish' && displayEntity.contextTags?.includes('fish_legendary')
    modalTitle = isLegendaryFish ? `⭐${displayEntity.name}` : displayEntity.name
    headerName = isLegendaryFish ? `⭐${displayEntity.name}` : displayEntity.name
  }

  const iconPath = displayEntity.icon ? (displayEntity.icon.startsWith('/') ? displayEntity.icon : `/${displayEntity.icon}`) : undefined

  // Compute which sections are visible for the section nav
  const visibleSections = (() => {
    if (entityType === 'buff' || entityType === 'event' || entityType === 'festival' || entityType === 'weapon' || entityType === 'boot' || entityType === 'trinket' || entityType === 'tool') return []

    if (entityType === 'animal') {
      const sections = []
      const outputItems = allItems.filter(item => !item.isGeneric && item.sources?.some(s => s.id === displayEntity.id && s.type !== 'shop'))
      if (outputItems.length > 0) sections.push({ id: 'section-machine-outputs', label: 'Produces' })
      if (displayEntity.sellPrice) sections.push({ id: 'section-calculator', label: 'Selling Calculator' })
      return sections
    }

    if (entityType === 'villager') {
      const sections = [{ id: 'section-villager-details', label: 'Details' }]
      const runsLocations = allItems.filter(i => i.type === 'location' && i.operator?.toLowerCase() === displayEntity.name?.toLowerCase())
      if (runsLocations.length > 0) sections.push({ id: 'section-villager-runs', label: 'Runs Stores' })
      const constructs = (itemsByType['building'] || []).filter(b => b.builder?.toLowerCase() === displayEntity.name?.toLowerCase())
      if (constructs.length > 0) sections.push({ id: 'section-villager-constructs', label: 'Constructs' })
      const hasGifts = entityData.getVillagerGifts(displayEntity.id)?.some(({ preference }) => preference !== 'neutral')
      if (hasGifts) sections.push({ id: 'section-villager-gifts', label: 'Gifts' })
      return sections
    }

    if (entityType === 'location') {
      const sections = []
      if (displayEntity.villagerIds?.length > 0) sections.push({ id: 'section-location-run-by', label: 'Run By' })
      if (displayEntity.locations?.length > 0) sections.push({ id: 'section-location-part-of', label: 'Part Of' })
      if (displayEntity.childLocations?.length > 0) {
        const children = displayEntity.childLocations
          .map(id => findById(id))
          .filter(Boolean)
        const mapChildren = children.filter(c => c.id.startsWith('map-') || c.id.startsWith('cc-'))
        const shopChildren = children.filter(c => c.subtype === 'shop')
        const otherChildren = children.filter(c => !c.id.startsWith('map-') && !c.id.startsWith('cc-') && c.subtype !== 'shop')
        if (mapChildren.length > 0) sections.push({ id: 'section-location-areas', label: 'Areas' })
        if (shopChildren.length > 0) sections.push({ id: 'section-location-shops', label: 'Shops' })
        if (otherChildren.length > 0) sections.push({ id: 'section-location-other-children', label: 'Other' })
      }
      let hasItemsSection = false
      const storeItems = allItems.filter(item =>
        item.sources?.some(s => s.type === 'shop' && s.id === displayEntity.id)
      )
      const childStalls = allItems.filter(s => s.type === 'location' && s.locations?.some(l => l.id === displayEntity.id))
      const label = childStalls.length > 0 ? 'Stalls' : 'Items'
      if (storeItems.length > 0 || childStalls.length > 0) {
        sections.push({ id: 'section-location-items', label })
        hasItemsSection = true
      }
      // Bundles at this location (CC rooms)
      if (displayEntity.bundles?.length > 0) {
        sections.push({ id: 'section-location-bundles', label: 'Bundles' })
      }
      // Items at this location (map-* locations only)
      if (!hasItemsSection && displayEntity.id?.startsWith('map-')) {
        const { fishEntries, forageEntries, tillingEntries, monsterEntries, otherList } = collectLocationItems(displayEntity.id, allItems, findById)
        if (fishEntries.length > 0) sections.push({ id: 'section-location-fish', label: 'Fish' })
        if (forageEntries.length > 0) sections.push({ id: 'section-location-forage', label: 'Forage' })
        if (monsterEntries.length > 0) sections.push({ id: 'section-location-monsters', label: 'Monsters' })
        if (tillingEntries.length > 0) sections.push({ id: 'section-location-artifacts', label: 'Artifacts' })
        if (otherList.length > 0) sections.push({ id: 'section-location-other-items', label: 'Other' })
      }
      return sections
    }

    if (entityType === 'building') {
      const sections = []
      if (displayEntity.buildCost != null) sections.push({ id: 'section-building-construction', label: 'Construction' })
      if (displayEntity.buildMaterials?.length > 0) sections.push({ id: 'section-building-materials', label: 'Materials' })
      const outputItems = allItems.filter(item => !item.isGeneric && item.sources?.some(s => s.id === displayEntity.id && s.type !== 'shop'))
      if (outputItems.length > 0) sections.push({ id: 'section-machine-outputs', label: 'Produces' })
      return sections
    }

    if (entityType === 'monster') {
      const sections = [{ id: 'section-monster-info', label: 'Info' }]
      const dropItems = allItems.filter(item =>
        item.sources?.some(s => s.type === 'monster-drop' && s.monsterId === displayEntity.id)
      )
      if (dropItems.length > 0) sections.push({ id: 'section-monster-drops', label: 'Drops' })
      return sections
    }

    if (entityType === 'breakable') {
      const sections = [{ id: 'section-breakable-info', label: 'Info' }]
      const dropItems = allItems.filter(item =>
        item.sources?.some(s => s.type === 'breakable-drop' && s.breakableId === displayEntity.id)
      )
      if (dropItems.length > 0) sections.push({ id: 'section-breakable-drops', label: 'Drops' })
      return sections
    }

    if (entityType === 'bundle') {
      return [
        displayEntity.roomId && { id: 'section-bundle-location', label: 'Location' },
        { id: 'section-required', label: 'Required Items' },
        displayEntity.reward && { id: 'section-reward', label: 'Reward' },
      ].filter(Boolean)
    }

    const hasSeasons = displayEntity.seasons?.length > 0
    const hasTimes = displayEntity.times?.length > 0
    const hasWeather = !!displayEntity.weather
    const isSeed = type === 'seed'
    const hasBuyingInfo = displayEntity.sources?.some(s => s.type === 'shop')
    const hasOtherSources = displayEntity.sources?.some(s =>
      s.type === 'monster-drop' || s.type === 'fish-pond' || s.type === 'tilling' || s.type === 'crafting' ||
      s.type === 'cooking' || s.type === 'fish' || s.type === 'forage' || s.type === 'animal' ||
      s.type === 'tapper' || s.type === 'machine' || s.type === 'seed' || s.type === 'breakable-drop'
    )
    const hasLocationSection = (hasSeasons && type !== 'seed') || hasTimes || hasWeather || hasBuyingInfo || hasOtherSources

    const hasProduces = isSeed && displayEntity.produces?.length > 0
    const hasAging = !!displayEntity.canBeAged
    const hasBuffs = displayEntity.buffs?.some(b => b.effects || b.name)
    const basePrice = displayEntity.prices?.regular || displayEntity.price || 0
    const hasCalculator = !displayEntity.isGeneric && basePrice > 0 && displayEntity.type !== 'furniture'
    const hasBundles = displayEntity.bundles?.length > 0
    const hasGifts = displayEntity.canBeGifted !== false && entityData.getGiftPreferences(displayEntity.id)?.length > 0

    return [
      type === 'fish' && { id: 'section-fishing', label: 'Fishing Info' },
      type === 'artisan' && displayEntity.isGeneric && displayEntity.variations?.length > 0 && { id: 'section-variations', label: 'Variations' },
      hasLocationSection && { id: 'section-location', label: 'Location & Availability' },
      displayEntity.usedInRecipes?.length > 0 && { id: 'section-uses', label: 'Uses' },
      hasProduces && { id: 'section-produces', label: 'Produces' },
      hasBuffs && { id: 'section-buffs', label: 'Effects' },
      hasAging && { id: 'section-aging', label: 'Cask Aging' },
      hasCalculator && { id: 'section-calculator', label: 'Calculator' },
      hasBundles && { id: 'section-bundles', label: 'Bundles' },
      hasGifts && { id: 'section-gifts', label: 'Gift Preferences' },
    ].filter(Boolean)
  })()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} breadcrumb={renderBreadcrumbs()} sections={visibleSections.length > 1 ? visibleSections : null}>
      <div className="modal-item-wrapper">

        {/* Context tabs for dual-role items (items only) */}
        {entityType !== 'bundle' && entityType !== 'location' && entityType !== 'machine' && entityType !== 'festival' && renderContextTabs()}

        <div className="modal-item-content">
          <ModalHeader icon={iconPath} name={headerName} subtitle={subtitle}>
            {/* Price display for items only (not bundles, locations, machines, or furniture) */}
            {entityType !== 'bundle' && entityType !== 'location' && entityType !== 'machine' && entityType !== 'festival' && displayEntity.type !== 'furniture' && entityType !== 'weapon' && entityType !== 'boot' && entityType !== 'trinket' && entityType !== 'tool' && entityType !== 'building' && (displayEntity.price || displayEntity.prices) && (
              <div className="modal-price">
                <ItemSellPrice
                  item={displayEntity}
                  showQualities={itemHasQuality}
                  showProfession={true}
                />
              </div>
            )}
          </ModalHeader>

          {displayEntity.description && (
            <p className="entity-description">{displayEntity.description}</p>
          )}

          {/* Festival-Specific Sections */}
          {entityType === 'festival' && (
            <>
              <ModalSection title="When & Where">
                <div className="entity-detail-grid">
                  {displayEntity.season && displayEntity.dayStart != null && (
                    <>
                      <span className="label">Date</span>
                      <span>
                        {capitalize(displayEntity.season)}{' '}
                        {displayEntity.dayStart}
                        {displayEntity.dayEnd != null && displayEntity.dayEnd !== displayEntity.dayStart ? `–${displayEntity.dayEnd}` : ''}
                      </span>
                    </>
                  )}
                  {displayEntity.hours?.open != null && (
                    <>
                      <span className="label">Hours</span>
                      <span>{formatGameTime(displayEntity.hours.open)}–{formatGameTime(displayEntity.hours.close)}</span>
                    </>
                  )}
                  {displayEntity.address && (
                    <>
                      <span className="label">Location</span>
                      <span>{displayEntity.address}</span>
                    </>
                  )}
                </div>
              </ModalSection>
              {displayEntity.note && (
                <div className="modal-note">{displayEntity.note}</div>
              )}
            </>
          )}

          {/* Location-Specific Sections */}
          {entityType === 'location' && (
            <>
              {displayEntity.operator && (() => {
                const v = entityData.getVillager(displayEntity.operator?.toLowerCase())
                return v ? (
                  <ModalSection id="section-location-run-by" title="Run By">
                    <div className="source-list">
                      <span className="source-entry">
                        <ModalItemButton item={v} variant="inline" onNavigate={handleNavigate} />
                      </span>
                    </div>
                  </ModalSection>
                ) : null
              })()}
              {/* Parent location (hierarchy) */}
              {displayEntity.parentLocation && (() => {
                const parent = findById(displayEntity.parentLocation)
                return parent ? (
                  <ModalSection id="section-location-parent" title="Part Of">
                    <div className="source-list">
                      <span className="source-entry">
                        <ModalItemButton item={parent} variant="inline" onNavigate={handleNavigate} />
                      </span>
                    </div>
                  </ModalSection>
                ) : null
              })()}
              {/* Legacy locations array (for festival sub-locations etc) */}
              {!displayEntity.parentLocation && displayEntity.locations?.length > 0 && (() => {
                const parentEntities = displayEntity.locations
                  .map(loc => findById(loc.id))
                  .filter(Boolean)
                return parentEntities.length > 0 ? (
                  <ModalSection id="section-location-part-of" title="Part Of">
                    <div className="source-list">
                      {parentEntities.map(parent => (
                        <span key={parent.id} className="source-entry">
                          <ModalItemButton item={parent} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ))}
                    </div>
                  </ModalSection>
                ) : null
              })()}
              {/* Child locations (hierarchy) */}
              {displayEntity.childLocations?.length > 0 && (() => {
                const children = displayEntity.childLocations
                  .map(id => findById(id))
                  .filter(Boolean)
                  .sort((a, b) => a.name.localeCompare(b.name))
                if (children.length === 0) return null

                const mapChildren = children.filter(c => c.id.startsWith('map-'))
                const shopChildren = children.filter(c => c.subtype === 'shop')
                const otherChildren = children.filter(c => !c.id.startsWith('map-') && c.subtype !== 'shop')

                return (
                  <>
                    {mapChildren.length > 0 && (
                      <ModalSection id="section-location-areas" title="Areas">
                        <div className="source-list">
                          {mapChildren.map(child => (
                            <span key={child.id} className="source-entry">
                              <ModalItemButton item={child} variant="inline" onNavigate={handleNavigate} />
                            </span>
                          ))}
                        </div>
                      </ModalSection>
                    )}
                    {shopChildren.length > 0 && (
                      <ModalSection id="section-location-shops" title="Shops">
                        <div className="source-list">
                          {shopChildren.map(child => (
                            <span key={child.id} className="source-entry">
                              <ModalItemButton item={child} variant="inline" onNavigate={handleNavigate} />
                              <span className="source-qualifiers">
                                {child.hours && (
                                  <span className="source-qualifier">
                                    {formatGameTime(child.hours.open)}–{formatGameTime(child.hours.close)}
                                    {child.hours.closedDays?.length > 0 && ` (closed ${child.hours.closedDays.join(', ')})`}
                                  </span>
                                )}
                                {child.note && <span className="source-qualifier">{child.note}</span>}
                              </span>
                            </span>
                          ))}
                        </div>
                      </ModalSection>
                    )}
                    {otherChildren.length > 0 && (
                      <ModalSection id="section-location-other-children" title="Other">
                        <div className="source-list">
                          {otherChildren.map(child => (
                            <span key={child.id} className="source-entry">
                              <ModalItemButton item={child} variant="inline" onNavigate={handleNavigate} />
                            </span>
                          ))}
                        </div>
                      </ModalSection>
                    )}
                  </>
                )
              })()}
              {/* Bundles at this location (CC rooms) */}
              {displayEntity.bundles?.length > 0 && (
                <ModalSection id="section-location-bundles" title={`Bundles (${displayEntity.bundles.length})`}>
                  <div className="source-list">
                    {displayEntity.bundles.map(bundleId => {
                      const bundle = findById(bundleId)
                      return bundle ? (
                        <span key={bundleId} className="source-entry">
                          <span className="source-name">
                            <ModalItemButton item={bundle} variant="inline" onNavigate={handleNavigate} />
                          </span>
                        </span>
                      ) : null
                    })}
                  </div>
                </ModalSection>
              )}
              {/* Items at this location (runtime query) */}
              {displayEntity.id?.startsWith('map-') && (() => {
                const { fishEntries, forageEntries, tillingEntries, monsterEntries, otherList } = collectLocationItems(displayEntity.id, allItems, findById)

                return (
                  <>
                    {fishEntries.length > 0 && (
                      <ModalSection id="section-location-fish" title={`Fish (${fishEntries.length})`}>
                        <div className="source-list">
                          {fishEntries
                            .sort((a, b) => a.item.name.localeCompare(b.item.name))
                            .map(({ item, src, subLocName }) => {
                              const seasons = src.seasons ?? ['spring', 'summer', 'fall', 'winter']
                              const timeStr = item.times?.map(t => `${formatTime(t.start)}–${formatTime(t.end)}`).join(', ')
                              return (
                                <span key={`${item.id}-${src.locationId}`} className="source-entry">
                                  <span className="source-name">
                                    <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                                    {subLocName && <span className="source-qualifier">({subLocName})</span>}
                                  </span>
                                  <span className="source-qualifiers">
                                    {timeStr && <span className="source-qualifier">{timeStr}</span>}
                                    {item.weather && item.weather !== 'both' && (
                                      <span className="source-qualifier">{item.weather[0].toUpperCase() + item.weather.slice(1)}</span>
                                    )}
                                  </span>
                                  <span className="source-seasons">
                                    <SeasonBadges seasons={seasons} compact />
                                  </span>
                                </span>
                              )
                            })}
                        </div>
                      </ModalSection>
                    )}
                    {forageEntries.length > 0 && (
                      <ModalSection id="section-location-forage" title={`Forage (${forageEntries.length})`}>
                        <div className="source-list">
                          {forageEntries
                            .sort((a, b) => a.item.name.localeCompare(b.item.name))
                            .map(({ item, src, subLocName }) => {
                              const seasons = src.seasons ?? (src.season ? [src.season] : ['spring', 'summer', 'fall', 'winter'])
                              return (
                                <span key={`${item.id}-${src.locationId}`} className="source-entry">
                                  <span className="source-name">
                                    <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                                    {subLocName && <span className="source-qualifier">({subLocName})</span>}
                                  </span>
                                  <span />
                                  <span className="source-seasons">
                                    <SeasonBadges seasons={seasons} compact />
                                  </span>
                                </span>
                              )
                            })}
                        </div>
                      </ModalSection>
                    )}
                    {monsterEntries.length > 0 && (
                      <ModalSection id="section-location-monsters" title={`Monsters (${monsterEntries.length})`}>
                        <div className="source-list">
                          {monsterEntries.map(({ item, qualifier }) => (
                            <span key={item.id} className="source-entry">
                              <span className="source-name">
                                <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                              </span>
                              <span />
                              {qualifier && (
                                <span className="source-detail">{qualifier}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </ModalSection>
                    )}
                    {tillingEntries.length > 0 && (
                      <ModalSection id="section-location-artifacts" title={`Artifacts (${tillingEntries.length})`}>
                        <div className="source-list">
                          {tillingEntries
                            .sort((a, b) => a.item.name.localeCompare(b.item.name))
                            .map(({ item, src, subLocName }) => (
                              <span key={`${item.id}-${src.locationId}`} className="source-entry">
                                <span className="source-name">
                                  <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                                  {subLocName && <span className="source-qualifier">({subLocName})</span>}
                                </span>
                                <span />
                                {src.chance != null && (
                                  <span className="source-detail">{formatChance(src.chance)}</span>
                                )}
                              </span>
                            ))}
                        </div>
                      </ModalSection>
                    )}
                    {otherList.length > 0 && (
                      <ModalSection id="section-location-other-items" title={`Other (${otherList.length})`}>
                        <div className="source-list">
                          {otherList.map(item => (
                            <span key={item.id} className="source-entry">
                              <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                            </span>
                          ))}
                        </div>
                      </ModalSection>
                    )}
                  </>
                )
              })()}
              {displayEntity.hours && (
                <ModalSection title="Hours">
                  <div className="entity-detail-grid">
                    <span className="label">Open</span>
                    <span>{formatGameTime(displayEntity.hours.open)}–{formatGameTime(displayEntity.hours.close)}</span>
                    {displayEntity.hours.closedDays?.length > 0 && (
                      <>
                        <span className="label">Closed</span>
                        <span>{displayEntity.hours.closedDays.join(', ')}</span>
                      </>
                    )}
                  </div>
                </ModalSection>
              )}
              {displayEntity.note && (
                <div className="modal-note">{displayEntity.note}</div>
              )}
              {displayEntity.notes?.map((n, i) => (
                <div key={i} className="modal-note">{n}</div>
              ))}
            </>
          )}


          {/* Bundle-Specific Sections */}
          {entityType === 'bundle' && displayEntity.roomId && (() => {
            const room = findById(displayEntity.roomId)
            const cc = findById('map-community-center')
            return (
              <ModalSection id="section-bundle-location" title="Location">
                <div className="source-list">
                  {cc && (
                    <span className="source-entry">
                      <span className="source-name">
                        <ModalItemButton item={cc} variant="inline" onNavigate={handleNavigate} />
                      </span>
                    </span>
                  )}
                  {room && (
                    <span className="source-entry">
                      <span className="source-name source-name--indented">
                        <ModalItemButton item={room} variant="inline" onNavigate={handleNavigate} />
                      </span>
                    </span>
                  )}
                </div>
              </ModalSection>
            )
          })()}
          {entityType === 'bundle' && (
            <BundleRequirementsSection
              entity={displayEntity}
              entityType={entityType}
              findByGameId={findByGameId}
              onNavigate={handleNavigate}
            />
          )}
          {entityType === 'bundle' && (
            <BundleRewardSection
              entity={displayEntity}
              entityType={entityType}
              findByGameId={findByGameId}
              onNavigate={handleNavigate}
            />
          )}

          {/* Buff-Specific Sections */}
          {entityType === 'buff' && (
            <>
              {displayEntity.effects && Object.keys(displayEntity.effects).length > 0 && (() => {
                const ATTR_LABELS = { FarmingLevel: 'Farming', FishingLevel: 'Fishing', MiningLevel: 'Mining', ForagingLevel: 'Foraging', LuckLevel: 'Luck', CombatLevel: 'Combat', MaxStamina: 'Max Energy', Speed: 'Speed', Defense: 'Defense', Attack: 'Attack', MagneticRadius: 'Magnetism', Immunity: 'Immunity' }
                const ATTR_ICONS = { FarmingLevel: 'Farming', FishingLevel: 'Fishing', MiningLevel: 'Mining', ForagingLevel: 'Foraging', LuckLevel: 'Luck', CombatLevel: 'Combat', MaxStamina: 'MaxEnergy', Speed: 'Speed', Defense: 'Defense', Attack: 'Attack', MagneticRadius: 'Magnetism' }
                return (
                  <ModalSection id="section-buff-effects" title="Effects">
                    <div className="food-buff-effects">
                      {Object.entries(displayEntity.effects)
                        .filter(([, val]) => val !== 0)
                        .map(([attr, val]) => (
                          <span key={attr} className={`food-buff-effect${val < 0 ? ' negative' : ''}`}>
                            <BuffIcon file={ATTR_ICONS[attr]} alt={ATTR_LABELS[attr] || attr} size={14} />
                            <span className="food-buff-attr">{ATTR_LABELS[attr] || attr}</span>
                            <span className="food-buff-val">{val > 0 ? `+${val}` : val}</span>
                          </span>
                        ))}
                    </div>
                  </ModalSection>
                )
              })()}
              {displayEntity.duration !== undefined && displayEntity.duration !== -2 && (
                <ModalSection id="section-buff-duration" title="Duration">
                  <span className="food-buff-duration">
                    {displayEntity.duration === -1 ? 'Permanent' : formatDuration(displayEntity.duration)}
                  </span>
                </ModalSection>
              )}
              {displayEntity.grantedBy?.length > 0 && (
                <ModalSection id="section-buff-granted-by" title="Granted By">
                  <div className="source-list">
                    {displayEntity.grantedBy.map(itemId => {
                      const item = findById(itemId)
                      if (!item) return null
                      return (
                        <span key={itemId} className="source-entry">
                          <ModalItemButton
                            item={item}
                            variant="inline"
                            onNavigate={handleNavigate}
                          />
                        </span>
                      )
                    })}
                  </div>
                </ModalSection>
              )}
            </>
          )}

          {/* Event-Specific Sections */}
          {entityType === 'event' && (
            <>
              {getLocationNames(displayEntity, findById).length > 0 && (
                <ModalSection id="section-event-location" title="Location">
                  {(() => {
                    const locIds = getLocationIds(displayEntity)
                    if (locIds.length > 0) {
                      return (
                        <div className="source-list">
                          {locIds.map(id => {
                            const loc = findById(id)
                            return loc ? (
                              <span key={id} className="source-entry">
                                <ModalItemButton item={loc} variant="inline" onNavigate={handleNavigate} />
                              </span>
                            ) : null
                          })}
                        </div>
                      )
                    }
                    return <span className="value">{getLocationNames(displayEntity, findById).join(', ')}</span>
                  })()}
                </ModalSection>
              )}
              {displayEntity.requiredFriendship?.length > 0 && (
                <ModalSection id="section-event-friendship" title="Requires">
                  <div className="source-list">
                    {displayEntity.requiredFriendship.map(({ npc, points }) => {
                      const villager = entityData.getVillager(npc.toLowerCase())
                      const hearts = Math.floor(points / 250)
                      return (
                        <span key={npc} className="source-entry">
                          <span className="source-name">
                            {villager
                              ? <ModalItemButton item={villager} variant="inline" onNavigate={handleNavigate} />
                              : npc}
                          </span>
                          <span className="source-qualifiers">
                            <span className="source-qualifier">{hearts}♥ ({points} pts)</span>
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </ModalSection>
              )}
              {displayEntity.villagersInvolved?.length > 1 && (
                <ModalSection id="section-event-villagers" title="Villagers">
                  <div className="source-list">
                    {displayEntity.villagersInvolved.map(npcName => {
                      const villager = entityData.getVillager(npcName.toLowerCase())
                      return (
                        <span key={npcName} className="source-entry">
                          <span className="source-name">
                            {villager
                              ? <ModalItemButton item={villager} variant="inline" onNavigate={handleNavigate} />
                              : npcName}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </ModalSection>
              )}
              {displayEntity.requiredEvents?.length > 0 && (
                <ModalSection id="section-event-prereqs" title="Requires Events">
                  <div className="source-list">
                    {displayEntity.requiredEvents.map(eventKey => {
                      const prereq = entityData.getEvent(eventKey)
                      return (
                        <span key={eventKey} className="source-entry">
                          <span className="source-name">
                            {prereq
                              ? <ModalItemButton item={prereq} variant="inline" onNavigate={handleNavigate} />
                              : `Event ${eventKey}`}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </ModalSection>
              )}
              {/* Trigger Conditions */}
              {(displayEntity.year || displayEntity.seasons?.length || displayEntity.weather?.length ||
                displayEntity.timeWindows?.length || displayEntity.daysOfWeek?.length ||
                displayEntity.minMoney || displayEntity.mineLevel || displayEntity.requiredItems?.length ||
                displayEntity.mutuallyExclusive?.length) && (
                <ModalSection id="section-event-conditions" title="Trigger Conditions">
                  <div className="event-conditions">
                    {displayEntity.year && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Year</span>
                        <span className="value">Year {displayEntity.year} only</span>
                      </div>
                    )}
                    {displayEntity.seasons?.length > 0 && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Season</span>
                        <span className="value">{displayEntity.seasons.map(capitalize).join(', ')}</span>
                      </div>
                    )}
                    {displayEntity.daysOfWeek?.length > 0 && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Day of Week</span>
                        <span className="value">{displayEntity.daysOfWeek.join(', ')}</span>
                      </div>
                    )}
                    {displayEntity.timeWindows?.length > 0 && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Time</span>
                        <span className="value">
                          {displayEntity.timeWindows.map((tw, i) => (
                            <span key={i}>{i > 0 ? ' or ' : ''}{formatGameTime(tw.start)}–{formatGameTime(tw.end)}</span>
                          ))}
                        </span>
                      </div>
                    )}
                    {displayEntity.weather?.length > 0 && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Weather</span>
                        <span className="value">{displayEntity.weather.map(capitalize).join(' or ')}</span>
                      </div>
                    )}
                    {displayEntity.minMoney && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Min. Money</span>
                        <span className="value">{displayEntity.minMoney.toLocaleString()}g</span>
                      </div>
                    )}
                    {displayEntity.mineLevel && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Mine Depth</span>
                        <span className="value">Reached floor {displayEntity.mineLevel}</span>
                      </div>
                    )}
                    {displayEntity.requiredItems?.length > 0 && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Has Item</span>
                        <span className="value">{displayEntity.requiredItems.join(', ')}</span>
                      </div>
                    )}
                    {displayEntity.mutuallyExclusive?.length > 0 && (
                      <div className="event-condition-row">
                        <span className="event-condition-label">Excludes</span>
                        <div className="source-list">
                          {displayEntity.mutuallyExclusive.map(eventKey => {
                            const ev = entityData.getEvent(eventKey)
                            return ev
                              ? <span key={eventKey} className="source-entry"><ModalItemButton item={ev} variant="inline" onNavigate={handleNavigate} /></span>
                              : <span key={eventKey} className="source-entry value">Event #{eventKey}</span>
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </ModalSection>
              )}
              {displayEntity.grantedBy?.length > 0 && (
                <ModalSection id="section-event-unlocks" title="Unlocks">
                  <div className="source-list">
                    {displayEntity.grantedBy.map(itemId => {
                      const item = findById(itemId)
                      if (!item) return null
                      return (
                        <span key={itemId} className="source-entry">
                          <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      )
                    })}
                  </div>
                </ModalSection>
              )}
            </>
          )}

          {/* Villager-Specific Sections */}
          {entityType === 'villager' && (
            <>
              <ModalSection id="section-villager-details" title="Details">
                <div className="entity-detail-grid">
                  {displayEntity.birthday && <><span className="label">Birthday</span><span>{capitalize(displayEntity.birthday.season)} {displayEntity.birthday.day}</span></>}
                  {displayEntity.gender && <><span className="label">Gender</span><span>{capitalize(displayEntity.gender)}</span></>}
                  {displayEntity.homeRegion && <><span className="label">Home</span><span>{displayEntity.homeRegion}</span></>}
                  {displayEntity.age && <><span className="label">Age</span><span>{capitalize(displayEntity.age)}</span></>}
                  {displayEntity.canBeRomanced && <><span className="label">Romanceable</span><span>Yes</span></>}
                  {displayEntity.loveInterest && (() => {
                    const li = entityData.getVillager(displayEntity.loveInterest)
                    return li ? <><span className="label">Love Interest</span><ModalItemButton item={li} variant="inline" onNavigate={handleNavigate} /></> : null
                  })()}
                </div>
              </ModalSection>
              {(() => {
                const runsLocations = allItems.filter(i => i.type === 'location' && i.operator?.toLowerCase() === displayEntity.name?.toLowerCase())
                if (!runsLocations.length) return null
                return (
                  <ModalSection id="section-villager-runs" title="Runs Stores">
                    <div className="source-list">
                      {runsLocations.map(loc => (
                        <span key={loc.id} className="source-entry">
                          <ModalItemButton item={loc} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ))}
                    </div>
                  </ModalSection>
                )
              })()}
              {(() => {
                const constructs = (itemsByType['building'] || []).filter(b => b.builder?.toLowerCase() === displayEntity.name?.toLowerCase())
                if (!constructs.length) return null
                return (
                  <ModalSection id="section-villager-constructs" title="Constructs">
                    <div className="source-list">
                      {constructs.map(b => (
                        <div key={b.id} className="source-entry" onClick={() => handleNavigate(b)} style={{ cursor: 'pointer' }}>
                          <span style={{ width: 1, whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              {b.icon && <span className="item-button-icon-box"><img src={b.icon.startsWith('/') ? b.icon : `/${b.icon}`} alt="" width={24} height={24} style={{ display: 'block', imageRendering: 'pixelated' }} /></span>}
                              <span className="item-button-label">{b.name}</span>
                            </span>
                          </span>
                          <span style={{ width: 1, whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {b.buildMaterials?.map((mat, i) => {
                                const matItem = findByGameId(mat.gameId)
                                return (
                                  <span key={i}
                                    onClick={matItem ? e => { e.stopPropagation(); handleNavigate(matItem) } : undefined}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem', opacity: 0.85, cursor: matItem ? 'pointer' : 'default' }}
                                  >
                                    {matItem?.icon && <img src={`/${matItem.icon}`} alt="" width={14} height={14} style={{ imageRendering: 'pixelated' }} />}
                                    <span>{mat.amount}× {matItem?.name ?? mat.gameId}</span>
                                  </span>
                                )
                              })}
                              {b.buildCost != null && (
                                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{b.buildCost.toLocaleString()}g</span>
                              )}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </ModalSection>
                )
              })()}
              {(() => {
                const villagerGifts = entityData.getVillagerGifts(displayEntity.id)
                const giftGroups = {}
                for (const { itemId, preference } of villagerGifts) {
                  const item = findById(itemId)
                  if (!item) continue
                  if (!giftGroups[preference]) giftGroups[preference] = []
                  giftGroups[preference].push(item)
                }
                const preferenceOrder = ['love', 'like', 'dislike', 'hate']
                const hasGifts = preferenceOrder.some(p => giftGroups[p]?.length > 0)
                if (!hasGifts) return null
                return (
                  <ModalSection id="section-villager-gifts" title="Gift Preferences">
                    {preferenceOrder.map(pref => {
                      const items = giftGroups[pref]
                      if (!items?.length) return null
                      const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
                      const cols = 3
                      const rows = Math.ceil(sorted.length / cols)
                      const columns = Array.from({ length: cols }, (_, c) =>
                        sorted.slice(c * rows, c * rows + rows)
                      )
                      return (
                        <div key={pref} className="villager-gift-group">
                          <span className={`villager-gift-pref-label gift-pref-${pref}`}>{capitalize(pref)}</span>
                          <div className="villager-gift-columns">
                            {columns.map((col, ci) => (
                              <div key={ci} className="villager-gift-column">
                                {col.map(item => (
                                  <div key={item.id} className="villager-gift-entry">
                                    <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </ModalSection>
                )
              })()}
            </>
          )}

          {/* Weapon Stats */}
          {entityType === 'weapon' && (
            <ModalSection title="Stats">
              <div className="entity-detail-grid">
                <span className="label">Damage</span>
                <span>{displayEntity.minDamage}–{displayEntity.maxDamage}</span>
                {displayEntity.critChance != null && displayEntity.critChance !== 0.02 && <>
                  <span className="label">Crit Chance</span>
                  <span>{(displayEntity.critChance * 100).toFixed(0)}%</span>
                </>}
                {displayEntity.critMultiplier != null && displayEntity.critMultiplier !== 3 && <>
                  <span className="label">Crit Power</span>
                  <span>{displayEntity.critMultiplier}×</span>
                </>}
                {displayEntity.speed !== 0 && <>
                  <span className="label">Speed</span>
                  <span>{displayEntity.speed > 0 ? `+${displayEntity.speed}` : displayEntity.speed}</span>
                </>}
                {displayEntity.defense !== 0 && <>
                  <span className="label">Defense</span>
                  <span>{displayEntity.defense > 0 ? `+${displayEntity.defense}` : displayEntity.defense}</span>
                </>}
                {displayEntity.knockback !== 1 && <>
                  <span className="label">Knockback</span>
                  <span>{displayEntity.knockback}</span>
                </>}
                {displayEntity.areaOfEffect > 0 && <>
                  <span className="label">Area of Effect</span>
                  <span>{displayEntity.areaOfEffect}</span>
                </>}
                {displayEntity.mineBaseLevel != null && <>
                  <span className="label">Mine Drop</span>
                  <span>Floor {displayEntity.mineMinLevel}–{displayEntity.mineBaseLevel}</span>
                </>}
              </div>
            </ModalSection>
          )}

          {/* Boot Stats */}
          {entityType === 'boot' && (
            <ModalSection title="Stats">
              <div className="entity-detail-grid">
                <span className="label">Defense</span>
                <span>+{displayEntity.defense}</span>
                <span className="label">Immunity</span>
                <span>+{displayEntity.immunity}</span>
              </div>
            </ModalSection>
          )}

          {/* Tool Harvests */}
          {entityType === 'tool' && (() => {
            const harvestedAnimals = allItems.filter(a => a.type === 'animal' && a.harvestTool?.toLowerCase().replace(/\s+/g, '-') === displayEntity.id)
            if (harvestedAnimals.length === 0) return null
            // Build rows: one per produce item per animal
            const rows = harvestedAnimals.flatMap(animal => {
              const gameIds = [...(animal.produceGameIds || []), ...(animal.deluxeProduceGameIds || [])]
              return gameIds.map(gid => {
                const produceItem = findByGameId(gid)
                if (!produceItem) return null
                const freq = animal.daysToProduce === 1 ? 'daily' : `every ${animal.daysToProduce} days`
                return { produceItem, animal, freq, key: `${animal.id}-${gid}` }
              }).filter(Boolean)
            })
            return (
              <ModalSection title="Harvests">
                <div className="source-list">
                  {rows.map(({ produceItem, animal, freq, key }) => (
                    <span key={key} className="source-entry">
                      <ModalItemButton item={produceItem} variant="inline" onNavigate={handleNavigate} />
                      <span className="source-qualifiers">
                        <span className="source-qualifier">
                          {freq} from <ModalItemButton item={animal} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
              </ModalSection>
            )
          })()}

          {/* Tool Upgrade Chain */}
          {entityType === 'tool' && (displayEntity.upgradesFrom || displayEntity.upgradesTo) && (
            <ModalSection title="Upgrade Path">
              <div className="source-list">
                {displayEntity.upgradesFrom && (() => {
                  const prev = findByGameId(displayEntity.upgradesFrom)
                  return prev ? (
                    <span className="source-entry">
                      <span className="label" style={{ paddingRight: '0.5rem' }}>Upgrades from</span>
                      <ModalItemButton item={prev} variant="inline" onNavigate={handleNavigate} />
                    </span>
                  ) : null
                })()}
                {displayEntity.upgradesTo && (() => {
                  const next = findByGameId(displayEntity.upgradesTo)
                  return next ? (
                    <span className="source-entry">
                      <span className="label" style={{ paddingRight: '0.5rem' }}>Upgrades to</span>
                      <ModalItemButton item={next} variant="inline" onNavigate={handleNavigate} />
                    </span>
                  ) : null
                })()}
              </div>
            </ModalSection>
          )}

          {/* Building Details */}
          {entityType === 'building' && (
            <>
              <ModalSection id="section-building-construction" title="Construction">
                <div className="entity-detail-grid">
                  <span className="label">Builder</span>
                  <span>{(() => {
                    const builderVillager = entityData.getVillager(displayEntity.builder?.toLowerCase())
                    return builderVillager
                      ? <ModalItemButton item={builderVillager} variant="inline" onNavigate={handleNavigate} />
                      : displayEntity.builder
                  })()}</span>
                  <span className="label">Cost</span>
                  <span>{displayEntity.buildCost?.toLocaleString()}g</span>
                  {displayEntity.buildDays > 0 && <>
                    <span className="label">Build Time</span>
                    <span>{displayEntity.buildDays} day{displayEntity.buildDays !== 1 ? 's' : ''}</span>
                  </>}
                  {displayEntity.maxOccupants > 0 && allItems.some(a => a.type === 'animal' && a.validBuildingGameIds?.includes(displayEntity.gameId)) && <>
                    <span className="label">Capacity</span>
                    <span>{displayEntity.maxOccupants} animals</span>
                  </>}
                </div>
              </ModalSection>
              {displayEntity.buildMaterials?.length > 0 && (
                <ModalSection id="section-building-materials" title="Materials">
                  <div className="source-list">
                    {displayEntity.buildMaterials.map((mat, i) => {
                      const matItem = findByGameId(mat.gameId)
                      return (
                        <span key={i} className="source-entry">
                          {matItem
                            ? <ModalItemButton item={matItem} variant="inline" onNavigate={handleNavigate} />
                            : <span className="source-name">{mat.gameId}</span>
                          }
                          <span className="source-qualifiers">
                            <span className="source-qualifier">×{mat.amount}</span>
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </ModalSection>
              )}
              {(displayEntity.upgradesFrom || displayEntity.upgradesTo) && (
                <ModalSection title="Upgrade Path">
                  <div className="source-list">
                    {displayEntity.upgradesFrom && (() => {
                      const prev = findByGameId(displayEntity.upgradesFrom)
                      return prev ? (
                        <span className="source-entry">
                          <span className="label" style={{ paddingRight: '0.5rem' }}>Upgrades from</span>
                          <ModalItemButton item={prev} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ) : null
                    })()}
                    {displayEntity.upgradesTo && (() => {
                      const next = findByGameId(displayEntity.upgradesTo)
                      return next ? (
                        <span className="source-entry">
                          <span className="label" style={{ paddingRight: '0.5rem' }}>Upgrades to</span>
                          <ModalItemButton item={next} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ) : null
                    })()}
                  </div>
                </ModalSection>
              )}
              {displayEntity.validOccupantTypes?.length > 0 && (() => {
                // Build the set of this building + all predecessors in the upgrade chain
                const thisAndPredecessors = new Set()
                let cursor = displayEntity
                while (cursor) {
                  thisAndPredecessors.add(cursor.gameId)
                  cursor = cursor.upgradesFrom ? findByGameId(cursor.upgradesFrom) : null
                }
                const houseAnimals = (itemsByType['animal'] ?? []).filter(a =>
                  displayEntity.validOccupantTypes.includes(a.houseType)
                )
                const purchasedOrBorn = houseAnimals.filter(a =>
                  a.requiredBuildingGameId && thisAndPredecessors.has(a.requiredBuildingGameId)
                )
                const bornOnly = houseAnimals.filter(a =>
                  !a.requiredBuildingGameId && a.sources.length > 0
                )
                const eventOnly = houseAnimals.filter(a => a.sources.length === 0)
                const cols = [
                  { label: 'Purchased / Born', animals: purchasedOrBorn },
                  { label: 'Born', animals: bornOnly },
                  { label: 'Event', animals: eventOnly },
                ].filter(c => c.animals.length > 0)
                return cols.length > 0 ? (
                  <ModalSection title="Animals">
                    <div className="building-animals-grid">
                      {cols.map(col => (
                        <div key={col.label} className="building-animals-col">
                          <div className="label">{col.label}</div>
                          <div className="bundle-items-list">
                            {col.animals.map(animal => (
                              <ModalItemButton key={animal.id} item={animal} variant="bundle-item" onNavigate={handleNavigate} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ModalSection>
                ) : null
              })()}
            </>
          )}

          {/* Animal-Specific Sections */}
          {entityType === 'animal' && (
            <>
              {displayEntity.validBuildingGameIds?.length > 0 && (() => {
                // Only show buildings at or above the required upgrade level
                const requiredId = displayEntity.requiredBuildingGameId
                const validIds = displayEntity.validBuildingGameIds
                const filteredIds = requiredId
                  ? (() => {
                      const reqIndex = validIds.indexOf(requiredId)
                      return reqIndex >= 0 ? validIds.slice(reqIndex) : validIds
                    })()
                  : validIds
                return (
                  <ModalSection title="Lives In">
                    <div className="source-list">
                      {filteredIds.map(bgid => {
                        const building = findByGameId(bgid)
                        return building ? (
                          <span key={bgid} className="source-entry">
                            <ModalItemButton item={building} variant="inline" onNavigate={handleNavigate} />
                          </span>
                        ) : null
                      })}
                    </div>
                  </ModalSection>
                )
              })()}
            </>
          )}

          {entityType === 'breakable' && (() => {
            const toolLevelNames = ['Basic', 'Copper', 'Steel', 'Gold', 'Iridium']
            const dropItems = allItems.filter(item =>
              item.sources?.some(s => s.type === 'breakable-drop' && s.breakableId === displayEntity.id)
            ).map(item => {
              const src = item.sources.find(s => s.type === 'breakable-drop' && s.breakableId === displayEntity.id)
              return { item, chance: src?.chance }
            }).sort((a, b) => (b.chance ?? 0) - (a.chance ?? 0))
            return (
              <>
                <ModalSection id="section-breakable-info" title="Info">
                  <div className="entity-detail-grid">
                    {displayEntity.tool && (
                      <><span className="label">Tool</span><span>{displayEntity.tool}</span></>
                    )}
                    {displayEntity.toolMinLevel != null && (
                      <><span className="label">Min Quality</span><span>{toolLevelNames[displayEntity.toolMinLevel] || displayEntity.toolMinLevel}</span></>
                    )}
                  </div>
                  {displayEntity.locations?.length > 0 && (
                    <div className="source-group">
                      <span className="modal-label">Found At:</span>
                      <div className="source-list">
                        {displayEntity.locations.map((locId, i) => {
                          const locEntity = findById(locId)
                          return (
                            <span key={i} className="source-entry">
                              <span className="source-name">
                                {locEntity
                                  ? <ModalItemButton item={locEntity} variant="inline" onNavigate={handleNavigate} />
                                  : locId}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </ModalSection>
                {dropItems.length > 0 && (
                  <ModalSection id="section-breakable-drops" title={`Drops (${dropItems.length})`}>
                    <div className="source-list">
                      {dropItems.map(({ item, chance }) => (
                        <span key={item.id} className="source-entry">
                          <span className="source-name">
                            <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                          </span>
                          <span />
                          {chance != null && (
                            <span className="source-detail">{formatChance(chance)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </ModalSection>
                )}
              </>
            )
          })()}

          {entityType === 'monster' && (() => {
            // Sort by the probability of getting at least 1 (= 1 - P(all rolls fail))
            const dropChance = src => src?.rolls ? 1 - src.rolls.reduce((p, r) => p * (1 - r), 1) : 0
            const dropItems = allItems.filter(item =>
              item.sources?.some(s => s.type === 'monster-drop' && s.monsterId === displayEntity.id)
            ).sort((a, b) => {
              const aChance = dropChance(a.sources.find(s => s.type === 'monster-drop' && s.monsterId === displayEntity.id))
              const bChance = dropChance(b.sources.find(s => s.type === 'monster-drop' && s.monsterId === displayEntity.id))
              return bChance - aChance
            })
            return (
              <>
                <ModalSection id="section-monster-info" title="Info">
                  <div className="entity-detail-grid">
                    {displayEntity.hp > 0 && (
                      <><span className="label">HP</span><span>{displayEntity.hp}</span></>
                    )}
                    {displayEntity.damageToFarmer > 0 && (
                      <><span className="label">Damage</span><span>{displayEntity.damageToFarmer}</span></>
                    )}
                    {displayEntity.resilience > 0 && (
                      <><span className="label">Defense</span><span>{displayEntity.resilience}</span></>
                    )}
                    {displayEntity.speed > 0 && (
                      <><span className="label">Speed</span><span>{displayEntity.speed}</span></>
                    )}
                    {displayEntity.isGlider && (
                      <><span className="label">Movement</span><span>Flying</span></>
                    )}
                    {displayEntity.missChance > 0 && (
                      <><span className="label">Miss Chance</span><span>{formatChance(displayEntity.missChance)}</span></>
                    )}
                    {displayEntity.coins && (
                      <><span className="label">Gold Drop</span><span>{displayEntity.coins.min === displayEntity.coins.max ? displayEntity.coins.min : `${displayEntity.coins.min}–${displayEntity.coins.max}`}g</span></>
                    )}
                    {displayEntity.debuffs?.length > 0 && (
                      <><span className="label">Debuffs</span><span>{displayEntity.debuffs.map(d => `${d.name} (${formatChance(d.chance)})`).join(', ')}</span></>
                    )}
                  </div>
                  {displayEntity.locations?.length > 0 && (
                    <div className="source-group">
                      <span className="modal-label">Found At:</span>
                      <div className="source-list">
                        {displayEntity.locations.map((loc, i) => {
                          const locEntity = loc.locationId ? findById(loc.locationId) : null
                          return (
                            <span key={i} className="source-entry">
                              <span className="source-name">
                                {locEntity
                                  ? <ModalItemButton item={locEntity} variant="inline" onNavigate={handleNavigate} />
                                  : loc.locationId}
                              </span>
                              <span />
                              {loc.qualifier && (
                                <span className="source-detail">{loc.qualifier}</span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {displayEntity.slayerQuest && (
                    <div className="source-group">
                      <span className="modal-label">Adventure Guild Rewards:</span>
                      <div className="source-list">
                        <span className="source-entry">
                          <span className="source-name">
                            {displayEntity.slayerQuest.rewardItemGameId && (() => {
                              const reward = findByGameId(displayEntity.slayerQuest.rewardItemGameId)
                              return reward ? <ModalItemButton item={reward} variant="inline" onNavigate={handleNavigate} /> : null
                            })()}
                          </span>
                          <span />
                          <span className="source-detail">Kill {displayEntity.slayerQuest.killCount}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </ModalSection>
                {dropItems.length > 0 && (
                  <ModalSection id="section-monster-drops" title={`Drops (${dropItems.length})`}>
                    <div className="source-list">
                      {dropItems.map(item => {
                        const src = item.sources.find(s => s.type === 'monster-drop' && s.monsterId === displayEntity.id)
                        const multiRoll = src?.rolls?.length > 1
                        const dist = multiRoll ? computeDropCountDistribution(src.rolls) : null
                        return (
                          <span key={item.id} className="source-entry">
                            <span className="source-name">
                              <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                            </span>
                            <span />
                            <span className="source-detail">
                              {multiRoll ? (
                                <>
                                  {dist.map(({ count, chance }, j) => (
                                    <span key={count}>{j > 0 ? ' / ' : ''}×{count} {formatChance(chance)}</span>
                                  ))}
                                  {' '}
                                  <InfoTooltip text="Each roll is independent and fires on every kill. Percentages show the chance of receiving exactly that many." />
                                </>
                              ) : (
                                formatChance(src?.rolls?.[0] ?? 0)
                              )}
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  </ModalSection>
                )}
              </>
            )
          })()}

          {/* Produces / Crafting Sections (any entity that acts as a machine or building) */}
          <MachineOutputsSection
            entity={displayEntity}
            allItems={allItems}
            findById={findById}
            onNavigate={handleNavigate}
          />

          <StoreContentsSection
            entity={displayEntity}
            entityType={entityType}
            allItems={allItems}
            findById={findById}
            onNavigate={handleNavigate}
          />

          {/* Item-Specific Sections */}
          {(() => {
            // Non-item entity types — skip all item sections
            const NON_ITEM_TYPES = new Set(['bundle', 'location', 'machine', 'buff', 'event', 'villager', 'festival', 'building', 'monster'])
            if (NON_ITEM_TYPES.has(entityType)) return null

            // Combat/tool types — skip sell price, food buffs, aging, seed produce sections
            const isEquipment = entityType === 'weapon' || entityType === 'boot' || entityType === 'trinket' || entityType === 'tool'

            return (
              <>
                {type === 'fish' && <FishingInfoSection entity={displayEntity} />}
                {type === 'artisan' && (
                  <VariationsListSection entity={displayEntity} artisanItems={artisanItems} findById={findById} onNavigate={handleNavigate} />
                )}
                <LocationAvailabilitySection
                  entity={displayEntity}
                  findById={findById}
                  findByGameId={findByGameId}
                  onNavigate={handleNavigate}
                />
                {displayEntity.usedInRecipes?.length > 0 && (() => {
                  const cooking = displayEntity.usedInRecipes.filter(r => r.type === 'cooking')
                  const crafting = displayEntity.usedInRecipes.filter(r => r.type === 'crafting')
                  return (
                    <ModalSection id="section-uses" title="Uses">
                      {cooking.length > 0 && (
                        <div className="source-group">
                          {crafting.length > 0 && <span className="modal-label">Ingredient For:</span>}
                          <div className="source-list">
                            {cooking.map((r, i) => {
                              const recipeItem = findById(r.recipeId)
                              return (
                                <span key={i} className="source-entry">
                                  <span className="source-name">
                                    {recipeItem ? <ModalItemButton item={recipeItem} variant="inline" onNavigate={handleNavigate} /> : r.recipeName}
                                  </span>
                                  {r.amount > 1 && <span className="source-qualifiers"><span className="source-qualifier">×{r.amount}</span></span>}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {crafting.length > 0 && (
                        <div className="source-group">
                          {cooking.length > 0 && <span className="modal-label">Used to Craft:</span>}
                          <div className="source-list">
                            {crafting.map((r, i) => {
                              const recipeItem = findById(r.recipeId)
                              return (
                                <span key={i} className="source-entry">
                                  <span className="source-name">
                                    {recipeItem ? <ModalItemButton item={recipeItem} variant="inline" onNavigate={handleNavigate} /> : r.recipeName}
                                  </span>
                                  {r.amount > 1 && <span className="source-qualifiers"><span className="source-qualifier">×{r.amount}</span></span>}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </ModalSection>
                  )
                })()}
                {!isEquipment && (
                  <SeedProducesSection entity={displayEntity} cropItems={cropItems} forageItems={forageItems} onNavigate={handleNavigate} />
                )}
                {!isEquipment && <AgingInfoSection entity={displayEntity} />}
                {!isEquipment && (
                  <FoodBuffsSection entity={displayEntity} findById={entityData.findById} onNavigate={handleNavigate} />
                )}
                {!isEquipment && (
                  <SellingInfoSection
                    key={displayEntity.id}
                    entity={displayEntity}
                    artisanItems={artisanItems}
                    findById={findById}
                    onNavigate={handleNavigate}
                  />
                )}
                <BundlesSection entity={displayEntity} getBundle={entityData.getBundle} onNavigate={handleNavigate} />
                <ModalGiftPreferences
                  id="section-gifts"
                  giftDetails={entityData.getGiftPreferences(displayEntity.id)}
                  sectionClass="modal-section"
                  giftsClass="modal-gifts"
                  onNavigate={handleNavigate}
                />
                {!isEquipment && <ContextTagsSection entity={displayEntity} />}
              </>
            )
          })()}
        </div>
      </div>
    </Modal>
  )
}

export default UniversalModal

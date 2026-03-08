import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useModalUrl } from '../../hooks/useModalUrl'
import { useModal } from '../../contexts/ModalContext'
import Modal from './Modal'
import ModalHeader from './ModalHeader'
import ModalGiftPreferences from './ModalGiftPreferences'
import ItemSellPrice from './ItemSellPrice'
import { useEntities } from '../../contexts/EntityContext'
import { getCategoryName } from '../../utils/Formatters'
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
import ShopSourceList from './ShopSourceList'
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
    if (currentEntity.category === 'festival') return 'festival'
    if (currentEntity.entityType) return currentEntity.entityType  // store, machine
    if (currentEntity.items && currentEntity.reward !== undefined) return 'bundle'
    if (currentEntity.type === 'villager') return 'villager'
    if (currentEntity.category === 'villager') return 'villager'
    if (currentEntity.type) return currentEntity.type  // items have a type field
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
  const { openModal } = useModal()
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
  let subtitle = 'Item'
  let modalTitle = displayEntity.name
  let headerName = displayEntity.name

  if (entityType === 'festival') {
    subtitle = 'Festival'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'store') {
    subtitle = displayEntity.festivalId
      ? 'Festival Shop'
      : displayEntity.parentStore
        ? 'Festival Stall'
        : 'Shop'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'machine') {
    subtitle = 'Machine'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'bundle') {
    subtitle = 'Community Center Bundle'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'buff') {
    subtitle = displayEntity.isDebuff ? 'Debuff' : 'Buff'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'event') {
    subtitle = displayEntity.heartLevel ? `${displayEntity.heartLevel} Heart Event` : 'Event'
    if (displayEntity.npc) subtitle = `${displayEntity.npc} — ${subtitle}`
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'villager') {
    subtitle = displayEntity.canBeRomanced ? 'Villager (Romanceable)' : 'Villager'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'weapon') {
    subtitle = displayEntity.weaponType || 'Weapon'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'boot') {
    subtitle = 'Boots'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'trinket') {
    subtitle = 'Trinket'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'tool') {
    const levelNames = ['Basic', 'Copper', 'Steel', 'Gold', 'Iridium']
    const levelName = levelNames[displayEntity.upgradeLevel] ?? ''
    subtitle = levelName ? `${levelName} ${displayEntity.toolClass || 'Tool'}` : (displayEntity.toolClass || 'Tool')
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else if (entityType === 'animal') {
    subtitle = displayEntity.houseType ? `${displayEntity.houseType} Animal` : 'Farm Animal'
    headerName = displayEntity.name
  } else if (entityType === 'building') {
    subtitle = displayEntity.magical ? 'Magical Building' : 'Farm Building'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else {
    const subtitleCategory = displayEntity.displayGameCategory !== undefined
      ? displayEntity.displayGameCategory
      : displayEntity.gameCategory
    const categoryName = getCategoryName(subtitleCategory, type)

    const typeDisplayName = {
      'fish': 'Fish',
      'forage': 'Forage',
      'crop': 'Crop',
      'artisan': 'Artisan Goods',
      'fruit-tree': 'Fruit Tree',
      'tree-fruit': 'Tree Fruit',
      'mineral': 'Mineral',
      'metal-bar': 'Metal Bar',
      'monster-loot': 'Monster Loot',
      'resource': 'Resource',
      'seed': 'Seeds'
    }[type] || 'Item'

    subtitle = categoryName
    if (typeDisplayName !== categoryName && categoryName !== 'Item') {
      subtitle = `${typeDisplayName} (${categoryName})`
    }

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
      if (displayEntity.sources?.some(s => s.type === 'shop')) sections.push({ id: 'section-animal-purchase', label: 'Purchase' })
      const outputItems = allItems.filter(item => !item.isGeneric && item.sources?.some(s => s.id === displayEntity.id))
      if (outputItems.length > 0) sections.push({ id: 'section-machine-outputs', label: 'Produces' })
      return sections
    }

    if (entityType === 'villager') {
      const sections = [{ id: 'section-villager-details', label: 'Details' }]
      if (displayEntity.storeIds?.length > 0) sections.push({ id: 'section-villager-shops', label: 'Shops' })
      const constructs = (itemsByType['building'] || []).filter(b => b.builder?.toLowerCase() === displayEntity.name?.toLowerCase())
      if (constructs.length > 0) sections.push({ id: 'section-villager-constructs', label: 'Constructs' })
      const hasGifts = entityData.getVillagerGifts(displayEntity.id)?.some(({ preference }) => preference !== 'neutral')
      if (hasGifts) sections.push({ id: 'section-villager-gifts', label: 'Gifts' })
      return sections
    }

    if (entityType === 'store') {
      const sections = []
      if (displayEntity.villagerIds?.length > 0) sections.push({ id: 'section-store-run-by', label: 'Run By' })
      if (displayEntity.festivalId) sections.push({ id: 'section-store-part-of', label: 'Part of' })
      const storeItems = allItems.filter(item =>
        item.sources?.some(s => s.type === 'shop' && s.id === displayEntity.id)
      )
      const childStalls = allItems.filter(s => s.category === 'store' && s.parentStore === displayEntity.id)
      const label = childStalls.length > 0 ? 'Stalls' : 'Items'
      if (storeItems.length > 0 || childStalls.length > 0) sections.push({ id: 'section-store-items', label })
      return sections
    }

    if (entityType === 'building') {
      const sections = []
      if (displayEntity.buildCost != null) sections.push({ id: 'section-building-construction', label: 'Construction' })
      if (displayEntity.buildMaterials?.length > 0) sections.push({ id: 'section-building-materials', label: 'Materials' })
      const outputItems = allItems.filter(item => !item.isGeneric && item.sources?.some(s => s.id === displayEntity.id))
      if (outputItems.length > 0) sections.push({ id: 'section-machine-outputs', label: 'Produces' })
      return sections
    }

    if (entityType === 'bundle') {
      return [
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
      s.type === 'tapper' || s.type === 'machine' || s.type === 'seed'
    )
    const hasLocationSection = (hasSeasons && type !== 'seed') || hasTimes || hasWeather || hasBuyingInfo || hasOtherSources

    const hasProduces = isSeed && displayEntity.produces?.length > 0
    const hasAging = !!displayEntity.canBeAged
    const hasBuffs = displayEntity.buffs?.some(b => b.effects || b.name)
    const basePrice = displayEntity.prices?.regular || displayEntity.price || 0
    const hasCalculator = !displayEntity.isGeneric && basePrice > 0 && displayEntity.category !== 'furniture'
    const hasBundles = displayEntity.bundles?.length > 0
    const hasGifts = displayEntity.canBeGifted !== false && entityData.getGiftPreferences(displayEntity.id)?.length > 0

    return [
      type === 'fish' && { id: 'section-fishing', label: 'Fishing Info' },
      type === 'artisan' && displayEntity.isGeneric && displayEntity.variations?.length > 0 && { id: 'section-variations', label: 'Variations' },
      hasLocationSection && { id: 'section-location', label: 'Location & Availability' },
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
        {entityType !== 'bundle' && entityType !== 'store' && entityType !== 'machine' && entityType !== 'festival' && renderContextTabs()}

        <div className="modal-item-content">
          <ModalHeader icon={iconPath} name={headerName} subtitle={subtitle}>
            {/* Price display for items only (not bundles, stores, machines, or furniture) */}
            {entityType !== 'bundle' && entityType !== 'store' && entityType !== 'machine' && entityType !== 'festival' && displayEntity.category !== 'furniture' && entityType !== 'weapon' && entityType !== 'boot' && entityType !== 'trinket' && entityType !== 'tool' && entityType !== 'building' && (displayEntity.price || displayEntity.prices) && (
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
                  {displayEntity.season && displayEntity.startDay != null && (
                    <>
                      <span className="label">Date</span>
                      <span>
                        {capitalize(displayEntity.season)}{' '}
                        {displayEntity.startDay}
                        {displayEntity.endDay !== displayEntity.startDay ? `–${displayEntity.endDay}` : ''}
                      </span>
                    </>
                  )}
                  {displayEntity.startTime != null && (
                    <>
                      <span className="label">Hours</span>
                      <span>{formatGameTime(displayEntity.startTime)}–{formatGameTime(displayEntity.endTime)}</span>
                    </>
                  )}
                  {displayEntity.location && (
                    <>
                      <span className="label">Location</span>
                      <span>{displayEntity.location}</span>
                    </>
                  )}
                </div>
              </ModalSection>
              {displayEntity.note && (
                <div className="modal-note">{displayEntity.note}</div>
              )}
              {displayEntity.shopIds?.length > 0 && (
                <ModalSection title={displayEntity.shopIds.length === 1 ? 'Shop' : 'Shops'}>
                  <div className="source-list">
                    {displayEntity.shopIds.map(sid => {
                      const store = entityData.getStore(sid)
                      return store ? (
                        <span key={sid} className="source-entry">
                          <ModalItemButton item={store} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ) : null
                    })}
                  </div>
                </ModalSection>
              )}
            </>
          )}

          {/* Store-Specific Sections */}
          {entityType === 'store' && (
            <>
              {displayEntity.villagerIds?.length > 0 && (
                <ModalSection id="section-store-run-by" title="Run By">
                  <div className="source-list">
                    {displayEntity.villagerIds.map(vid => {
                      const v = entityData.getVillager(vid)
                      return v ? (
                        <span key={vid} className="source-entry">
                          <ModalItemButton item={v} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ) : null
                    })}
                  </div>
                </ModalSection>
              )}
              {displayEntity.festivalId && (() => {
                const fest = entityData.getFestival(displayEntity.festivalId)
                return fest ? (
                  <ModalSection id="section-store-part-of" title="Part of">
                    <div className="source-list">
                      <span className="source-entry">
                        <ModalItemButton item={fest} variant="inline" onNavigate={handleNavigate} />
                      </span>
                    </div>
                  </ModalSection>
                ) : null
              })()}
              {displayEntity.note && (
                <div className="modal-note">{displayEntity.note}</div>
              )}
              <StoreContentsSection
                entity={displayEntity}
                entityType={entityType}
                allItems={allItems}
                findById={findById}
                onNavigate={handleNavigate}
              />
            </>
          )}

          {/* Bundle-Specific Sections */}
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
              {displayEntity.description && (
                <p className="modal-description">{displayEntity.description}</p>
              )}
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
              {displayEntity.description && (
                <p className="modal-description">{displayEntity.description}</p>
              )}
              {displayEntity.locations?.length > 0 && (
                <ModalSection id="section-event-location" title="Location">
                  <span className="value">{displayEntity.locations.join(', ')}</span>
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
              {displayEntity.storeIds?.length > 0 && (
                <ModalSection id="section-villager-shops" title="Shops">
                  <div className="source-list">
                    {displayEntity.storeIds.map(sid => {
                      const store = entityData.getStore(sid)
                      return store ? (
                        <span key={sid} className="source-entry">
                          <ModalItemButton item={store} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      ) : null
                    })}
                  </div>
                </ModalSection>
              )}
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
                      return (
                        <div key={pref} className="villager-gift-group">
                          <span className={`villager-gift-pref-label gift-pref-${pref}`}>{capitalize(pref)}</span>
                          <div className="source-list">
                            {items.map(item => (
                              <span key={item.id} className="source-entry">
                                <ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />
                              </span>
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
            const harvestedAnimals = allItems.filter(a => a.category === 'animal' && a.harvestTool?.toLowerCase().replace(/\s+/g, '-') === displayEntity.id)
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
                  {displayEntity.maxOccupants > 0 && allItems.some(a => a.category === 'animal' && a.validBuildingGameIds?.includes(displayEntity.gameId)) && <>
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
              {displayEntity.sources?.some(s => s.type === 'shop') && (
                <ModalSection id="section-animal-purchase" title="Where to Buy">
                  <ShopSourceList
                    sources={displayEntity.sources}
                    findEntityById={findById}
                    findEntity={findByGameId}
                    onNavigate={handleNavigate}
                  />
                </ModalSection>
              )}
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

          {/* Produces / Crafting Sections (any entity that acts as a machine or building) */}
          <MachineOutputsSection
            entity={displayEntity}
            allItems={allItems}
            findById={findById}
            onNavigate={handleNavigate}
          />

          {/* Item-Specific Sections */}
          {(() => {
            // Non-item entity types — skip all item sections
            const NON_ITEM_TYPES = new Set(['bundle', 'store', 'machine', 'buff', 'event', 'villager', 'festival', 'building', 'animal'])
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

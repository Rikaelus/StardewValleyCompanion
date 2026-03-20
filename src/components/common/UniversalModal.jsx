import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useModalUrl } from '../../hooks/useModalUrl'
import { useOpenModal } from '../../contexts/ModalContext'
import Modal from './Modal'
import ModalHeader from './ModalHeader'
import ModalGiftPreferences from './ModalGiftPreferences'
import ItemSellPrice from './ItemSellPrice'
import { useEntities } from '../../contexts/EntityContext'
import { getEntitySubtitle, computeDropCountDistribution, formatChance, formatTime, getLocationNames, getLocationIds, formatUnlockCondition } from '../../utils/Formatters'
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
import RecipeEntryList from './RecipeEntryList'
import ConditionBadge from './ConditionBadge'
import ModalSection from './ModalSection'
import { SectionNavProvider } from '../../contexts/SectionNavContext'
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

  // When entity prop changes to a different entity, reset history.
  useEffect(() => {
    if (entity && entity.id !== entityRef.current?.id) {
      setHistory(prev => prev[0]?.id === entity.id ? prev : [entity])
    }
    entityRef.current = entity
  }, [entity])

  // Clear state when modal closes — no reason to keep stale breadcrumbs.
  useEffect(() => {
    if (!isOpen) {
      setHistory([])
    }
  }, [isOpen])

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

  return (
    <SectionNavProvider>
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} breadcrumb={renderBreadcrumbs()}>
      <div className="modal-item-wrapper">

        {/* Context tabs for dual-role items (items only) */}
        {entityType !== 'bundle' && entityType !== 'location' && entityType !== 'machine' && entityType !== 'festival' && renderContextTabs()}

        <div className="modal-item-content">
          <ModalHeader icon={iconPath} iconChar={displayEntity.iconChar} iconClass={displayEntity.iconClass} iconColor={displayEntity.iconColor} name={headerName} subtitle={subtitle}>
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

          {/* Type-specific summary sections (above Location & Availability) */}
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

          {/* Quest-Specific Sections */}
          {entityType === 'quest' && (
            <>
              <ModalSection title="Details">
                <div className="entity-detail-grid">
                  {displayEntity.objective && (
                    <>
                      <span className="label">Objective</span>
                      <span>{displayEntity.objective}</span>
                    </>
                  )}
                  {displayEntity.questType && (
                    <>
                      <span className="label">Type</span>
                      <span>{displayEntity.questType === 'ItemDelivery' ? 'Item Delivery'
                        : displayEntity.questType === 'ItemHarvest' ? 'Item Harvest'
                        : displayEntity.questType === 'LostItem' ? 'Lost Item'
                        : displayEntity.questType === 'SecretLostItem' ? 'Secret Lost Item'
                        : displayEntity.questType}</span>
                    </>
                  )}
                  {displayEntity.trigger && (
                    <>
                      <span className="label">Offered</span>
                      <span>{displayEntity.trigger.season
                        ? `${capitalize(displayEntity.trigger.season)} ${displayEntity.trigger.day}, Year ${displayEntity.trigger.year}`
                        : 'Event-triggered'
                      }</span>
                    </>
                  )}
                  {displayEntity.targetNpc && (
                    <>
                      <span className="label">{displayEntity.questType === 'Monster' ? 'Target' : 'Villager'}</span>
                      <span>{(() => {
                        const villagerId = `vil-${displayEntity.targetNpc.toLowerCase()}`
                        const villager = findById(villagerId)
                        return villager
                          ? <ModalItemButton item={villager} variant="inline" onNavigate={handleNavigate} />
                          : displayEntity.targetNpc
                      })()}</span>
                    </>
                  )}
                  {displayEntity.requiredItem && (
                    <>
                      <span className="label">Required Item</span>
                      <span>{(() => {
                        const item = findByGameId(displayEntity.requiredItem)
                        return item
                          ? <><ModalItemButton item={item} variant="inline" onNavigate={handleNavigate} />{displayEntity.requiredItemAmount > 1 ? ` ×${displayEntity.requiredItemAmount}` : ''}</>
                          : `Item ${displayEntity.requiredItem}`
                      })()}</span>
                    </>
                  )}
                  {(displayEntity.moneyReward > 0 || displayEntity.friendshipReward > 0) && (
                    <>
                      <span className="label">Reward</span>
                      <span>
                        {[
                          displayEntity.moneyReward > 0 && `${displayEntity.moneyReward.toLocaleString()}g`,
                          displayEntity.friendshipReward > 0 && `${displayEntity.friendshipReward} friendship`,
                        ].filter(Boolean).join(', ')}
                      </span>
                    </>
                  )}
                  {displayEntity.nextQuestId && (
                    <>
                      <span className="label">Next Quest</span>
                      <span>{(() => {
                        const next = findById(displayEntity.nextQuestId)
                        return next
                          ? <ModalItemButton item={next} variant="inline" onNavigate={handleNavigate} />
                          : displayEntity.nextQuestId
                      })()}</span>
                    </>
                  )}
                </div>
              </ModalSection>
            </>
          )}

          {/* Achievement-Specific Sections */}
          {entityType === 'achievement' && displayEntity.prerequisiteId && (
            <ModalSection title="Prerequisite">
              <div className="source-list">
                <span className="source-entry">
                  {(() => {
                    const prereq = findById(displayEntity.prerequisiteId)
                    return prereq
                      ? <ModalItemButton item={prereq} variant="inline" onNavigate={handleNavigate} />
                      : displayEntity.prerequisiteId
                  })()}
                </span>
              </div>
            </ModalSection>
          )}

          {/* Power-Specific Sections */}
          {entityType === 'power' && displayEntity.unlockCondition && (
            <ModalSection title="How to Unlock">
              <div className="source-list">
                <span className="source-entry">
                  <ConditionBadge condition={displayEntity.unlockCondition} />
                </span>
              </div>
            </ModalSection>
          )}

          {/* Location-Specific Sections */}
          {entityType === 'location' && (
            <>
              {displayEntity.operator && (() => {
                const v = entityData.getVillager(displayEntity.operator)
                return v ? (
                  <ModalSection id="section-location-run-by" title="Run By" navLabel="Run By">
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
                  <ModalSection id="section-location-part-of" title="Part Of" navLabel="Part Of">
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
              {/* Residents */}
              {displayEntity.residents?.length > 0 && (() => {
                const residentEntities = displayEntity.residents
                  .map(id => entityData.getVillager(id))
                  .filter(Boolean)
                  .sort((a, b) => a.name.localeCompare(b.name))
                return residentEntities.length > 0 ? (
                  <ModalSection id="section-location-residents" title="Residents" navLabel="Residents">
                    <div className="source-list">
                      {residentEntities.map(v => (
                        <span key={v.id} className="source-entry">
                          <ModalItemButton item={v} variant="inline" onNavigate={handleNavigate} />
                          {v.unlockConditions && <span className="source-qualifiers"><span className="source-qualifier">{formatUnlockCondition(v.unlockConditions)}</span></span>}
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
                      <ModalSection id="section-location-areas" title="Areas" navLabel="Areas">
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
                      <ModalSection id="section-location-shops" title="Shops" navLabel="Shops">
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
                      <ModalSection id="section-location-other-children" title="Other" navLabel="Other">
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
              {/* Bundles at this location (including children) */}
              {(() => {
                const collectBundles = (id, seen) => {
                  const loc = findById(id)
                  if (!loc) return []
                  const result = []
                  for (const bId of loc.bundles || []) {
                    if (!seen.has(bId)) { seen.add(bId); result.push(bId) }
                  }
                  for (const childId of loc.childLocations || []) {
                    result.push(...collectBundles(childId, seen))
                  }
                  return result
                }
                const allBundleIds = collectBundles(displayEntity.id, new Set())
                if (allBundleIds.length === 0) return null
                return (
                  <ModalSection id="section-location-bundles" title={`Bundles (${allBundleIds.length})`} navLabel="Bundles">
                    <div className="source-list">
                      {allBundleIds.map(bundleId => {
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
                )
              })()}
              {/* Museum rewards (listed like bundles) */}
              {displayEntity.museumRewards?.length > 0 && (() => {
                const rewardEntities = displayEntity.museumRewards.map(id => findById(id)).filter(Boolean)
                const collection = rewardEntities.filter(r => r.milestoneCategory === 'collection')
                const category = rewardEntities.filter(r => r.milestoneCategory === 'category')
                const donation = rewardEntities.filter(r => r.milestoneCategory === 'donation')

                const renderRewardList = (items) => (
                  <div className="source-list">
                    {items.map(r => (
                      <span key={r.id} className="source-entry">
                        <span className="source-name">
                          <ModalItemButton item={r} variant="inline" onNavigate={handleNavigate} />
                        </span>
                      </span>
                    ))}
                  </div>
                )

                return (
                  <>
                    {collection.length > 0 && (
                      <ModalSection title={`Collection Rewards (${collection.length})`} id="museum-collection-rewards" navLabel="Collection">
                        {renderRewardList(collection)}
                      </ModalSection>
                    )}
                    {category.length > 0 && (
                      <ModalSection title={`Category Milestones (${category.length})`} id="museum-category-milestones" navLabel="Category">
                        {renderRewardList(category)}
                      </ModalSection>
                    )}
                    {donation.length > 0 && (
                      <ModalSection title={`Donation Milestones (${donation.length})`} id="museum-donation-milestones" navLabel="Milestones">
                        {renderRewardList(donation)}
                      </ModalSection>
                    )}
                  </>
                )
              })()}
              {/* Items at this location (runtime query) */}
              {displayEntity.id?.startsWith('map-') && (() => {
                const { fishEntries, forageEntries, tillingEntries, monsterEntries, otherList } = collectLocationItems(displayEntity.id, allItems, findById)

                return (
                  <>
                    {fishEntries.length > 0 && (
                      <ModalSection id="section-location-fish" title={`Fish (${fishEntries.length})`} navLabel="Fish">
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
                      <ModalSection id="section-location-forage" title={`Forage (${forageEntries.length})`} navLabel="Forage">
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
                      <ModalSection id="section-location-monsters" title={`Monsters (${monsterEntries.length})`} navLabel="Monsters">
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
                      <ModalSection id="section-location-artifacts" title={`Artifacts (${tillingEntries.length})`} navLabel="Artifacts">
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
                      <ModalSection id="section-location-other-items" title={`Other (${otherList.length})`} navLabel="Other">
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
              <ModalSection id="section-bundle-location" title="Location" navLabel="Location">
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
          {entityType === 'museum-reward' && displayEntity.requirements?.length > 0 && (
            <ModalSection id="section-museum-requirements" title="Requirements" navLabel="Requirements">
              <div className="source-list">
                {displayEntity.requirements.map((req, i) => {
                  if (req.type === 'item') {
                    const reqItem = req.id ? findById(req.id) : null
                    return (
                      <span key={i} className="source-entry">
                        <span className="source-name">
                          {reqItem
                            ? <ModalItemButton item={reqItem} variant="inline" onNavigate={handleNavigate} />
                            : req.name}
                        </span>
                      </span>
                    )
                  }
                  if (req.type === 'category') {
                    return (
                      <span key={i} className="source-entry">
                        <span className="source-name source-name--indented">
                          {req.count} {req.category} donated
                        </span>
                      </span>
                    )
                  }
                  if (req.type === 'total') {
                    return (
                      <span key={i} className="source-entry">
                        <span className="source-name source-name--indented">
                          {req.count === -1 ? 'Donate every item' : `${req.count} total items donated`}
                        </span>
                      </span>
                    )
                  }
                  return null
                })}
              </div>
            </ModalSection>
          )}
          {(entityType === 'bundle' || entityType === 'museum-reward') && (
            <BundleRewardSection
              entity={displayEntity}
              entityType={entityType}
              findById={findById}
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
                      const villager = entityData.getVillager(npc)
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
                      const villager = entityData.getVillager(npcName)
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
              <ModalSection id="section-villager-details" title="Details" navLabel="Details">
                <div className="entity-detail-grid">
                  {displayEntity.birthday && <><span className="label">Birthday</span><span>{capitalize(displayEntity.birthday.season)} {displayEntity.birthday.day}</span></>}
                  {displayEntity.gender && <><span className="label">Gender</span><span>{capitalize(displayEntity.gender)}</span></>}
                  {displayEntity.homeLocation ? (() => {
                    const homeLoc = findById(displayEntity.homeLocation)
                    return homeLoc
                      ? <><span className="label">Home</span><ModalItemButton item={homeLoc} variant="inline" onNavigate={handleNavigate} /></>
                      : displayEntity.homeRegion ? <><span className="label">Home</span><span>{displayEntity.homeRegion}</span></> : null
                  })() : displayEntity.homeRegion ? <><span className="label">Home</span><span>{displayEntity.homeRegion}</span></> : null}
                  {displayEntity.age && <><span className="label">Age</span><span>{capitalize(displayEntity.age)}</span></>}
                  {displayEntity.unlockConditions && <><span className="label">Available</span><span>{formatUnlockCondition(displayEntity.unlockConditions)}</span></>}
                  {displayEntity.canBeRomanced && <><span className="label">Romanceable</span><span>Yes</span></>}
                  {displayEntity.loveInterest && (() => {
                    const li = entityData.getVillager(displayEntity.loveInterest)
                    return li ? <><span className="label">Love Interest</span><ModalItemButton item={li} variant="inline" onNavigate={handleNavigate} /></> : null
                  })()}
                </div>
              </ModalSection>
              {(() => {
                const runsLocations = allItems.filter(i => i.type === 'location' && i.operator === displayEntity.id)
                if (!runsLocations.length) return null
                return (
                  <ModalSection id="section-villager-runs" title="Runs Stores" navLabel="Runs Stores">
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
                const constructs = (itemsByType['building'] || []).filter(b => b.builder === displayEntity.id)
                if (!constructs.length) return null
                return (
                  <ModalSection id="section-villager-constructs" title="Constructs" navLabel="Constructs">
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
                const villagerQuests = allItems.filter(i =>
                  i.type === 'quest' && i.targetNpc?.toLowerCase() === displayEntity.name?.toLowerCase()
                )
                if (!villagerQuests.length) return null
                return (
                  <ModalSection id="section-villager-quests" title="Quests">
                    <div className="source-list">
                      {villagerQuests.map(q => (
                        <span key={q.id} className="source-entry">
                          <ModalItemButton item={q} variant="inline" onNavigate={handleNavigate} />
                          {q.moneyReward > 0 && <span className="source-detail">{q.moneyReward.toLocaleString()}g</span>}
                        </span>
                      ))}
                    </div>
                  </ModalSection>
                )
              })()}
              {displayEntity.movieReactions?.length > 0 && (
                <ModalSection id="section-villager-movies" title="Movie Reactions">
                  <div className="source-list">
                    {[...displayEntity.movieReactions]
                      .sort((a, b) => {
                        const order = { love: 0, like: 1, dislike: 2 }
                        const diff = (order[a.reaction] ?? 9) - (order[b.reaction] ?? 9)
                        if (diff !== 0) return diff
                        return a.movieName.localeCompare(b.movieName)
                      })
                      .map(r => {
                        const movie = findById(r.movieId)
                        return (
                          <span key={r.movieId} className="source-entry">
                            <span className="source-name">
                              {movie
                                ? <ModalItemButton item={movie} variant="inline" onNavigate={handleNavigate} />
                                : r.movieName}
                            </span>
                            <span className="source-qualifiers">
                              <span className={`source-qualifier reaction-${r.reaction}`}>{r.reaction}</span>
                            </span>
                          </span>
                        )
                      })}
                  </div>
                </ModalSection>
              )}
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
                  <ModalSection id="section-villager-gifts" title="Gift Preferences" navLabel="Gift Preferences">
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
              <ModalSection id="section-building-construction" title="Construction" navLabel="Construction">
                <div className="entity-detail-grid">
                  <span className="label">Builder</span>
                  <span>{(() => {
                    const builderVillager = entityData.getVillager(displayEntity.builder)
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
                <ModalSection id="section-building-materials" title="Materials" navLabel="Materials">
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
                <ModalSection id="section-breakable-info" title="Info" navLabel="Info">
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
                  <ModalSection id="section-breakable-drops" title={`Drops (${dropItems.length})`} navLabel="Drops">
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
                <ModalSection id="section-monster-info" title="Info" navLabel="Info">
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
                  <ModalSection id="section-monster-drops" title={`Drops (${dropItems.length})`} navLabel="Drops">
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
                {/* Movie-Specific Sections (after Location & Availability) */}
                {entityType === 'movie' && (
                  <>
                    {displayEntity.cranePrizes?.length > 0 && (
                      <ModalSection title="Crane Game Prizes">
                        <div className="source-list">
                          {displayEntity.cranePrizes.map((prize, i) => (
                            <span key={i} className="source-entry">
                              {prize.resolvedId ? (
                                <ModalItemButton item={findById(prize.resolvedId)} variant="inline" onNavigate={handleNavigate} />
                              ) : prize.itemId}
                              {prize.rarity > 1 && <span className="detail-note"> (Rare)</span>}
                            </span>
                          ))}
                        </div>
                      </ModalSection>
                    )}

                    {displayEntity.reactions?.length > 0 && (
                      <div className="modal-section">
                        <h4>Villager Reactions</h4>
                        <div className="modal-gifts">
                          {[...displayEntity.reactions]
                            .sort((a, b) => {
                              const order = { love: 0, like: 1, dislike: 2 }
                              const diff = (order[a.reaction] ?? 9) - (order[b.reaction] ?? 9)
                              if (diff !== 0) return diff
                              return a.villager.localeCompare(b.villager)
                            })
                            .map(r => {
                              const v = r.villagerId ? findById(r.villagerId) : null
                              return (
                                <div key={r.villagerId || r.villager} className={`gift-item gift-${r.reaction}`}>
                                  {v ? (
                                    <ModalItemButton item={v} iconSize={32} onNavigate={handleNavigate} />
                                  ) : null}
                                  <div className="gift-info">
                                    <div className="gift-name">{r.villager}</div>
                                    <div className="gift-preference">{r.reaction}</div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {displayEntity.usedInRecipes?.length > 0 && (() => {
                  const cooking = displayEntity.usedInRecipes.filter(r => r.type === 'cooking')
                  const crafting = displayEntity.usedInRecipes.filter(r => r.type === 'crafting')
                  const tailoring = displayEntity.usedInRecipes.filter(r => r.type === 'tailoring').sort((a, b) => a.recipeName.localeCompare(b.recipeName))
                  const groups = [
                    { items: cooking, label: 'Ingredient For' },
                    { items: crafting, label: 'Used to Craft' },
                    { items: tailoring, label: 'Used in Tailoring' },
                  ].filter(g => g.items.length > 0)
                  const sectionTitle = groups.length === 1 ? groups[0].label : 'Uses'
                  return (
                    <ModalSection id="section-uses" title={sectionTitle} navLabel={sectionTitle}>
                      {groups.map(({ items, label }, gi) => (
                        <div key={gi} className="source-group">
                          {groups.length > 1 && <span className="modal-label">{label}:</span>}
                          <div className="source-list">
                            <RecipeEntryList recipes={items} subject={displayEntity} onNavigate={handleNavigate} />
                          </div>
                        </div>
                      ))}
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
                  giftsClass="modal-gifts"
                  onNavigate={handleNavigate}
                />
                {/* Tag entity: matching items */}
                {entityType === 'tag' && displayEntity.memberIds?.length > 0 && (
                  <ModalSection title={`Matching Items (${displayEntity.memberCount})`} id="tag-members" navLabel="Items">
                    <div className="source-list">
                      {displayEntity.memberIds.map(memberId => {
                        const memberItem = findById(memberId)
                        return memberItem ? (
                          <span key={memberId} className="source-entry">
                            <span className="source-name">
                              <ModalItemButton item={memberItem} variant="inline" onNavigate={handleNavigate} />
                            </span>
                          </span>
                        ) : null
                      })}
                    </div>
                  </ModalSection>
                )}
                {/* Type entity: members grouped by subtype */}
                {entityType === 'type' && (() => {
                  const subtypes = displayEntity.subtypes
                  if (subtypes && subtypes.length > 0) {
                    return subtypes.map(sub => (
                      <ModalSection key={sub.id} title={`${sub.name} (${sub.memberCount})`} id={`type-sub-${sub.id}`} navLabel={sub.name}>
                        <div className="source-list">
                          {sub.memberIds.map(memberId => {
                            const memberItem = findById(memberId)
                            return memberItem ? (
                              <span key={memberId} className="source-entry">
                                <span className="source-name">
                                  <ModalItemButton item={memberItem} variant="inline" onNavigate={handleNavigate} />
                                </span>
                              </span>
                            ) : null
                          })}
                        </div>
                      </ModalSection>
                    ))
                  }
                  // No subtypes — flat list
                  if (displayEntity.memberIds?.length > 0) {
                    return (
                      <ModalSection title={`All ${displayEntity.name} (${displayEntity.memberCount})`} id="type-members" navLabel="Items">
                        <div className="source-list">
                          {displayEntity.memberIds.map(memberId => {
                            const memberItem = findById(memberId)
                            return memberItem ? (
                              <span key={memberId} className="source-entry">
                                <span className="source-name">
                                  <ModalItemButton item={memberItem} variant="inline" onNavigate={handleNavigate} />
                                </span>
                              </span>
                            ) : null
                          })}
                        </div>
                      </ModalSection>
                    )
                  }
                  return null
                })()}
                {!isEquipment && <ContextTagsSection entity={displayEntity} onNavigate={handleNavigate} />}
              </>
            )
          })()}
        </div>
      </div>
    </Modal>
    </SectionNavProvider>
  )
}

export default UniversalModal

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import Modal from './Modal'
import ModalHeader from './ModalHeader'
import ModalSection from './ModalSection'
import { ModalGrid, ModalGridItem } from './ModalGrid'
import TagList from './TagList'
import ModalNote from './ModalNote'
import ModalGiftPreferences from './ModalGiftPreferences'
import ItemSellPrice from './ItemSellPrice'
import SeasonBadges from './SeasonBadges'
import DataTable from './DataTable'
import QualitySelector from './QualitySelector'
import ModalItemButton from './ModalItemButton'
import ShopSourceList from './ShopSourceList'
import BundleBadge from './BundleBadge'
import InfoTooltip from './InfoTooltip'
import { useRelationalData } from '../../hooks/useRelationalData'
import { useItems } from '../../contexts/ItemsContext'
import { usePlayer } from '../../contexts/PlayerContext'
import { formatLocationNames, formatTime, formatSeasons, formatProcessingTime, getDifficultyColor, formatPrice, getCategoryName, getTrashCanRefund, getProfitColor } from '../../utils/formatters'
import { calculateProfessionMultiplier } from './ItemSellPrice'
import './UniversalModal.css'

/**
 * Universal modal component for displaying any entity (item, bundle, villager, etc.)
 * Dynamically renders sections based on entity type and available data.
 * Supports breadcrumb navigation: clicking links inside the modal navigates
 * in-place with a breadcrumb trail, instead of stacking modals.
 */
function UniversalModal({ entity, isOpen, onClose }) {
  const entityRef = useRef(entity)
  const { player } = usePlayer()

  // Navigation history for breadcrumb trail
  const [history, setHistory] = useState([])

  // When entity prop changes (modal opens with new item), reset history
  useEffect(() => {
    if (entity) {
      setHistory([entity])
    }
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
    if (currentEntity.items && currentEntity.reward !== undefined) return 'bundle'
    if (currentEntity.type) return currentEntity.type // items have a type field
    return 'unknown'
  }, [currentEntity])

  // Tab state for dual-context items
  const [activeTab, setActiveTab] = useState('primary')
  const [alternateContext, setAlternateContext] = useState(null)

  // Profession calculator state (defaults to player's actual professions)
  const [activeProfessions, setActiveProfessions] = useState({
    tiller: player.professions.tiller || false,
    fisher: player.professions.fisher || false,
    angler: player.professions.angler || false,
    artisan: player.professions.artisan || false,
    rancher: player.professions.rancher || false,
    tapper: player.professions.tapper || false,
    blacksmith: player.professions.blacksmith || false,
    gemologist: player.professions.gemologist || false
  })
  const [trashCanUpgrade, setTrashCanUpgrade] = useState(null) // null, copper, steel, gold, iridium
  const [inputQuality, setInputQuality] = useState('regular') // regular, silver, gold, iridium
  const [outputInputQuality, setOutputInputQuality] = useState('regular') // quality of THIS item when used as input

  // Load unified items data (fetched once for the whole app via ItemsContext)
  const { byType: itemsByType, findById, findByGameId, error: itemsError } = useItems()

  // Derive typed views for sections that reference specific item types
  const fishItems = useMemo(() => itemsByType['fish'] || [], [itemsByType])
  const artisanItems = useMemo(() => itemsByType['artisan'] || [], [itemsByType])
  const cropItems = useMemo(() => itemsByType['crop'] || [], [itemsByType])
  const forageItems = useMemo(() => itemsByType['forage'] || [], [itemsByType])
  const seedItems = useMemo(() => itemsByType['seed'] || [], [itemsByType])

  // Log any errors
  useEffect(() => {
    if (itemsError) console.error('Failed to load items data:', itemsError)
  }, [itemsError])

  // Load relational data for lookups
  const relationalData = useRelationalData()

  // Keep the last entity data during closing animation
  useEffect(() => {
    if (entity) {
      entityRef.current = entity
    }
  }, [entity])

  // Reset tab, professions, quality state when the displayed entity changes (including breadcrumb navigation)
  useEffect(() => {
    if (currentEntity) {
      setActiveTab('primary')
      setInputQuality('regular')
      setOutputInputQuality('regular')
      setTrashCanUpgrade(null)
    }
  }, [currentEntity])

  // Reset professions to player's actual professions when displayed entity or player changes
  useEffect(() => {
    setActiveProfessions({
      tiller: player.professions.tiller || false,
      fisher: player.professions.fisher || false,
      angler: player.professions.angler || false,
      artisan: player.professions.artisan || false,
      rancher: player.professions.rancher || false,
      tapper: player.professions.tapper || false,
      blacksmith: player.professions.blacksmith || false,
      gemologist: player.professions.gemologist || false
    })
  }, [currentEntity, player.professions])

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

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const findInputItem = (inputId) => findById(inputId)

  const findItemByGameId = (gameId) => findByGameId(gameId)

  const getSellingLocations = (item) => {
    // Use item's sellingLocations if available, otherwise fallback to shipping bin
    const locationIds = item.sellingLocations || ['shipping-bin']

    if (relationalData.loading || !relationalData.stores) {
      // Fallback if data not loaded yet
      return locationIds.map(id =>
        typeof id === 'string'
          ? id.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
          : `Store ${id}`
      )
    }

    return locationIds.map(id => {
      const store = relationalData.getStore(id)
      return store?.name || id
    })
  }

  const getProfessionInfo = (item) => {
    // Get the actual game category (not display category)
    const actualCategory = item.originalCategory !== undefined ? item.originalCategory : item.category

    // Crops (category -75 vegetables, -79 fruit)
    if (actualCategory === -75 || actualCategory === -79) {
      return {
        available: ['Tiller (+10%)'],
        description: 'Applies to crops'
      }
    }

    // Fish items (category -4) get fishing professions, regardless of type
    // This includes beach-foraged clams/oysters which are still Fish category
    if (item.type === 'fish' || actualCategory === -4) {
      return {
        available: ['Fisher (+25%)', 'Angler (+50%)'],
        description: 'Angler replaces Fisher bonus (doesn\'t stack)'
      }
    }

    // Artisan goods
    if (item.type === 'artisan') {
      const isAnimalProduct = item.sources?.some(s => s.type === 'animal')
      const isSyrup = item.contextTags && item.contextTags.includes('syrup_item')

      if (isSyrup) {
        return {
          available: ['Tapper (+25%)'],
          description: 'Applies to syrups from tapper'
        }
      } else if (isAnimalProduct) {
        return {
          available: ['Rancher (+20%)'],
          description: 'Applies to animal products'
        }
      } else {
        return {
          available: ['Artisan (+40%)'],
          description: 'Applies to processed goods'
        }
      }
    }

    // Add more profession mappings as needed
    return null
  }

  // ============================================================================
  // Universal Rendering (based on data presence)
  // ============================================================================

  const renderLocationAvailability = () => {
    if (!displayEntity) return null

    // Check if entity has location/season data
    const hasSeasons = displayEntity.seasons && displayEntity.seasons.length > 0
    const hasTimes = displayEntity.times && displayEntity.times.length > 0
    const hasWeather = displayEntity.weather


    const isSeed = displayEntity.type === 'seed'
    const allSources = displayEntity.sources || []
    const shopSources = allSources.filter(s => s.type === 'shop')
    const monsterDropSources = allSources.filter(s => s.type === 'monster-drop')
    const fishPondSources = allSources.filter(s => s.type === 'fish-pond')
    const tillingSources = allSources.filter(s => s.type === 'tilling')
    const craftingSources = allSources.filter(s => s.type === 'crafting')
    const animalSources = allSources.filter(s => s.type === 'animal')
    const tapperSources = allSources.filter(s => s.type === 'tapper')
    const machineSources = allSources.filter(s => s.type === 'machine')
    const seedSources = allSources.filter(s => s.type === 'seed')
    const fishSources = allSources.filter(s => s.type === 'fish')
    const forageSources = allSources.filter(s => s.type === 'forage')
    const hasBuyingInfo = shopSources.length > 0
    const hasOtherSources = monsterDropSources.length > 0 || fishPondSources.length > 0 ||
      tillingSources.length > 0 || craftingSources.length > 0 ||
      animalSources.length > 0 || tapperSources.length > 0 || machineSources.length > 0 ||
      seedSources.length > 0 || fishSources.length > 0 || forageSources.length > 0

    if (!(hasSeasons && !isSeed) && !hasTimes && !hasWeather && !hasBuyingInfo && !hasOtherSources) return null

    return (
      <ModalSection id="section-location" title="Location & Availability">
        {(hasSeasons && !isSeed && !fishSources.length && !forageSources.length ||
          hasTimes || hasWeather || displayEntity.isFlower) && (
          <ModalGrid>
            {hasSeasons && !isSeed && !fishSources.length && !forageSources.length && (
              <ModalGridItem label="Seasons:">
                <SeasonBadges seasons={displayEntity.seasons} />
              </ModalGridItem>
            )}

            {hasTimes && (
              <ModalGridItem
                label="Time:"
                value={displayEntity.times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')}
              />
            )}

            {hasWeather && (
              <ModalGridItem label="Weather:">
                <span className="value">
                  {displayEntity.weather === 'rainy' ? '🌧 Rainy' : displayEntity.weather === 'sunny' ? '☀️ Sunny' : 'Any'}
                </span>
              </ModalGridItem>
            )}

            {displayEntity.isFlower && (
              <ModalGridItem
                label="Type:"
                value="🌸 Flower"
              />
            )}
          </ModalGrid>
        )}

        {shopSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Where to Buy:</span>
            <ShopSourceList
              sources={displayEntity.sources}
              findEntity={findEntityByGameId}
              findEntityById={findById}
              onNavigate={handleNavigate}
            />
          </div>
        )}

        {tillingSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Tilling / Digging:</span>
            <div className="source-list">
              {tillingSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name">{src.location}</span>
                  <span />
                  <span className="source-detail">{Math.round(src.chance * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {fishPondSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Fish Pond:</span>
            <div className="source-list">
              {fishPondSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name" style={{ textTransform: 'capitalize' }}>{src.fishTag.replace(/_/g, ' ')} pond</span>
                  <span className="source-qualifiers"><span className="source-qualifier">Population: {src.minPopulation}+</span></span>
                  <span className="source-detail">{Math.round(src.chance * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {monsterDropSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Monster Drops:</span>
            <div className="source-list">
              {monsterDropSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name">{src.monster}</span>
                  <span />
                  <span className="source-detail">{Math.round(src.chance * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {craftingSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Crafting:</span>
            <div className="source-list">
              {craftingSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name">{src.recipeName}</span>
                  <span />
                  {src.outputCount > 1
                    ? <span className="source-detail">×{src.outputCount}</span>
                    : <span />
                  }
                </span>
              ))}
            </div>
          </div>
        )}

        {animalSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Produced By:</span>
            <div className="source-list">
              {animalSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name">{src.animal}</span>
                  <span />
                  <span />
                </span>
              ))}
            </div>
          </div>
        )}

        {tapperSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Produced By:</span>
            <div className="source-list">
              {tapperSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name">Tapper on {src.treeName}</span>
                  <span />
                  <span className="source-detail">{src.daysToHarvest}d</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {machineSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Produced By:</span>
            <div className="source-list">
              {machineSources.map((src, i) => {
                const inputItem = src.inputId ? findInputItem(src.inputId) : null
                const inputDisplay = inputItem
                  ? <ModalItemButton item={inputItem} variant="inline" onNavigate={handleNavigate} />
                  : src.inputName || (src.inputType && src.inputType !== 'specific'
                    ? src.inputType.charAt(0).toUpperCase() + src.inputType.slice(1)
                    : null)
                return (
                  <span key={i} className="source-entry">
                    <span className="source-name">{src.machine}</span>
                    {inputDisplay && <span className="source-qualifiers"><span className="source-qualifier">{inputDisplay}</span></span>}
                    {displayEntity.processingTimeMinutes
                      ? <span className="source-detail">{formatProcessingTime(displayEntity.processingTimeMinutes)}</span>
                      : <span />
                    }
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {seedSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Grown From:</span>
            <div className="source-list">
              {seedSources.map((src, i) => {
                const seedItem = findById(src.seedId) ?? findItemByGameId(src.seedGameId)
                return (
                  <span key={i} className="source-entry">
                    <span className="source-name">
                      {seedItem
                        ? <ModalItemButton item={seedItem} variant="inline" onNavigate={handleNavigate} />
                        : src.seedName}
                    </span>
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        {src.growthDays}d{src.regrowDays ? ` (+${src.regrowDays}d)` : ''}
                      </span>
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {fishSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Caught At:</span>
            <div className="source-list">
              {fishSources.map((src, i) => (
                <span key={i} className="source-entry">
                  <span className="source-name">{src.location}</span>
                  <span className="source-qualifiers">
                    <SeasonBadges seasons={src.seasons ?? ['spring', 'summer', 'fall', 'winter']} compact />
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {forageSources.length > 0 && (
          <div className="source-group">
            <span className="modal-label">Foraged At:</span>
            <div className="source-list">
              {forageSources.map((src, i) => {
                const seasons = src.seasons ?? (src.season ? [src.season] : ['spring', 'summer', 'fall', 'winter'])
                return (
                  <span key={i} className="source-entry">
                    <span className="source-name">{src.location}</span>
                    <span className="source-qualifiers">
                      <SeasonBadges seasons={seasons} compact />
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

      </ModalSection>
    )
  }

  // ============================================================================
  // Fish-Specific Rendering
  // ============================================================================

  const renderFishingInfo = () => {
    if (!displayEntity || displayEntity.type !== 'fish') return null

    // Crab pot fish have different info than rod-caught fish
    if (displayEntity.isTrapFish) {
      return (
        <ModalSection id="section-fishing" title="Fishing Info">
          <ModalGrid>
            <ModalGridItem
              label="Method:"
              value="Crab Pot"
            />
          </ModalGrid>
          <ModalNote>
            Crab pots must be baited and checked daily. Works 24/7 in all seasons and weather.
          </ModalNote>
        </ModalSection>
      )
    }

    // Regular rod-caught fish
    return (
      <ModalSection id="section-fishing" title="Fishing Info">
        <ModalGrid>
          <ModalGridItem label="Difficulty:">
            <span className="value difficulty" style={{ color: getDifficultyColor(displayEntity.difficulty) }}>
              {displayEntity.difficulty}
            </span>
          </ModalGridItem>

          <ModalGridItem
            label="Behavior:"
            value={displayEntity.behaviorType ? displayEntity.behaviorType.charAt(0).toUpperCase() + displayEntity.behaviorType.slice(1) : 'Unknown'}
          />

          {displayEntity.minFishingLevel && (
            <ModalGridItem label="Min Fishing Level:">
              <span className="value" style={{ color: '#1976d2', fontWeight: 'bold' }}>
                {displayEntity.minFishingLevel}
              </span>
            </ModalGridItem>
          )}

          <ModalGridItem
            label="Size Range:"
            value={`${displayEntity.minSize}-${displayEntity.maxSize} inches`}
          />
        </ModalGrid>
      </ModalSection>
    )
  }

  const renderProfitAnalysis = (inputDetails) => {
    if (!inputDetails || inputDetails.length === 0) return null

    // Get the base output price (without professions)
    const baseOutputPrice = displayEntity.prices?.regular || displayEntity.price || 0

    // Quality multipliers for input items
    const qualityMultipliers = {
      'regular': 1.0,
      'silver': 1.25,
      'gold': 1.5,
      'iridium': 2.0
    }

    const inputMultiplier = qualityMultipliers[inputQuality]


    const outputProfessionMultiplier = calculateProfessionMultiplier(displayEntity, activeProfessions)

    const trashCanRefund = getTrashCanRefund(trashCanUpgrade)
    const priceMultiplier = trashCanUpgrade === null ? 1 : trashCanRefund

    return (
      <div className="profit-section">
        <div className="profit-header">
          <div className="modal-label">Processed From:</div>
          <InfoTooltip text="Shows the cost of each source item at the selected quality vs. the profit from selling this item at each quality tier. Professions affect both source and output prices." />
        </div>

        {/* Source quality selector */}
        <div className="profit-source-selector">
          <span className="profit-source-name">Source</span>
          <QualitySelector
            value={inputQuality}
            onChange={setInputQuality}
            name="inputQuality"
          />
        </div>

        {/* Input items */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {inputDetails.map((input, idx) => {
            const baseInputPrice = input.inputBasePrice
            // Apply both quality and profession multipliers to input price
            const inputProfessionMultiplier = calculateProfessionMultiplier({ category: input.inputCategory }, activeProfessions)
            const adjustedInputPrice = Math.floor(baseInputPrice * inputMultiplier * inputProfessionMultiplier)

            // Calculate profit percentages for each output quality tier
            // Apply output profession and trash can multipliers to each quality tier
            const regularOutputPrice = Math.floor(baseOutputPrice * outputProfessionMultiplier * priceMultiplier)
            const silverOutputPrice = Math.floor(baseOutputPrice * 1.25 * outputProfessionMultiplier * priceMultiplier)
            const goldOutputPrice = Math.floor(baseOutputPrice * 1.5 * outputProfessionMultiplier * priceMultiplier)
            const iridiumOutputPrice = Math.floor(baseOutputPrice * 2.0 * outputProfessionMultiplier * priceMultiplier)

            const regularProfit = adjustedInputPrice > 0 ? Math.round(((regularOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
            const silverProfit = adjustedInputPrice > 0 ? Math.round(((silverOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
            const goldProfit = adjustedInputPrice > 0 ? Math.round(((goldOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
            const iridiumProfit = adjustedInputPrice > 0 ? Math.round(((iridiumOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0

            return (
              <div key={idx} className="processing-row processing-row--input">
                {/* Input name with magnifying glass */}
                <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                  <ModalItemButton
                    item={findInputItem(input.inputId)}
                    variant="inline"
                    onNavigate={handleNavigate}
                  />
                </div>

                {/* Adjusted input price based on selected quality */}
                <div className="price-display" style={{
                  color: inputQuality === 'regular' ? '#666' :
                         inputQuality === 'silver' ? '#9e9e9e' :
                         inputQuality === 'gold' ? '#f57c00' : '#9c27b0'
                }}>
                  {formatPrice(adjustedInputPrice)}
                </div>

                {/* Profit percentages by output quality */}
                <div className="quality-tiers">
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--regular">●</span>
                    <span style={{ color: getProfitColor(regularProfit) }}>
                      {regularProfit >= 0 ? '+' : ''}{regularProfit}%
                    </span>
                  </div>
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--silver">◆</span>
                    <span style={{ color: getProfitColor(silverProfit) }}>
                      {silverProfit >= 0 ? '+' : ''}{silverProfit}%
                    </span>
                  </div>
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--gold">★</span>
                    <span style={{ color: getProfitColor(goldProfit) }}>
                      {goldProfit >= 0 ? '+' : ''}{goldProfit}%
                    </span>
                  </div>
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--iridium">◆</span>
                    <span style={{ color: getProfitColor(iridiumProfit) }}>
                      {iridiumProfit >= 0 ? '+' : ''}{iridiumProfit}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderOutputProfitAnalysis = () => {
    if (!displayEntity) return null

    const actualCategory = displayEntity.originalCategory !== undefined
      ? displayEntity.originalCategory
      : displayEntity.category

    // Map category/type to generic artisan inputType
    const genericInputType = (() => {
      if (actualCategory === -79) return 'fruit'
      if (actualCategory === -75) return 'vegetable'
      if (actualCategory === -4 || displayEntity.type === 'fish') return 'fish'
      if (actualCategory === -80) return 'flower'
      if (displayEntity.contextTags?.includes('edible_mushroom')) return 'mushroom'
      return null
    })()

    // Search through artisan data to find what this item can be turned into
    const outputs = []
    if (artisanItems.length > 0) {
      artisanItems.forEach(artisan => {
        const artisanMachineSource = artisan.sources?.find(s => s.type === 'machine')
        if (!artisanMachineSource) return

        // Specific match via inputDetails (formula-based items like Wine have per-input prices)
        if (artisanMachineSource.inputDetails) {
          artisanMachineSource.inputDetails.forEach(inputDetail => {
            if (inputDetail.inputId === displayEntity.id) {
              outputs.push({
                outputItem: artisan,
                outputBasePrice: inputDetail.outputPrice || artisan.prices?.regular || artisan.price || 0,
                machine: artisanMachineSource.machine,
              })
            }
          })
          return
        }

        // Specific match via inputId (no inputDetails)
        if (artisanMachineSource.inputId === displayEntity.id) {
          outputs.push({
            outputItem: artisan,
            outputBasePrice: artisan.prices?.regular || artisan.price || 0,
            machine: artisanMachineSource.machine,
          })
          return
        }

        // Generic match: category-based (Wine for all fruits, Juice for all vegetables, etc.)
        // Only include if the item is generic (isGeneric) — these show what's possible but
        // have no fixed output price, so they're excluded from the profit calculator
        if (!artisanMachineSource.inputId && genericInputType && artisanMachineSource.inputType === genericInputType) {
          if (artisan.isGeneric) {
            outputs.push({
              outputItem: artisan,
              outputBasePrice: null, // no fixed price — exclude from profit math
              machine: artisanMachineSource.machine,
              isGeneric: true,
            })
          }
        }
      })
    }

    // Only show if this item can be used as an input to make something
    if (outputs.length === 0) return null

    const inputBasePrice = displayEntity.prices?.regular || displayEntity.price || 0

    const qualityMultipliers = {
      'regular': 1.0,
      'silver': 1.25,
      'gold': 1.5,
      'iridium': 2.0
    }

    const inputMultiplier = qualityMultipliers[outputInputQuality]

    const inputProfessionMultiplier = calculateProfessionMultiplier(displayEntity, activeProfessions)
    const adjustedInputPrice = Math.floor(inputBasePrice * inputMultiplier * inputProfessionMultiplier)

    const trashCanRefund = getTrashCanRefund(trashCanUpgrade)
    const outputPriceMultiplier = trashCanUpgrade === null ? 1 : trashCanRefund

    return (
      <div className="profit-section">
        <div className="profit-header">
          <div className="modal-label">Processing Into:</div>
          <InfoTooltip text="Shows the profit from processing this item into other goods. The price shown is this item's sell value at the selected quality. Percentages show profit at each output quality tier." />
        </div>

        {/* Source item with quality selector */}
        <div className="profit-source-selector">
          <span className="profit-source-name">{displayEntity.name}</span>
          <QualitySelector
            value={outputInputQuality}
            onChange={setOutputInputQuality}
            name="outputInputQuality"
          />
          <span className="price-display" style={{
            color: outputInputQuality === 'regular' ? '#666' :
                   outputInputQuality === 'silver' ? '#9e9e9e' :
                   outputInputQuality === 'gold' ? '#f57c00' : '#9c27b0'
          }}>
            {formatPrice(adjustedInputPrice)}
          </span>
        </div>

        {/* Arrow lines to each output */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {outputs.filter(o => !o.isGeneric).map((output, idx, specificOutputs) => {
            const outputProfessionMultiplier = calculateProfessionMultiplier(output.outputItem, activeProfessions)

            // Apply profession and trash can multipliers to each output quality tier
            const regularOutputPrice = Math.floor(output.outputBasePrice * outputProfessionMultiplier * outputPriceMultiplier)
            const silverOutputPrice = Math.floor(output.outputBasePrice * 1.25 * outputProfessionMultiplier * outputPriceMultiplier)
            const goldOutputPrice = Math.floor(output.outputBasePrice * 1.5 * outputProfessionMultiplier * outputPriceMultiplier)
            const iridiumOutputPrice = Math.floor(output.outputBasePrice * 2.0 * outputProfessionMultiplier * outputPriceMultiplier)

            const regularProfit = adjustedInputPrice > 0 ? Math.round(((regularOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
            const silverProfit = adjustedInputPrice > 0 ? Math.round(((silverOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
            const goldProfit = adjustedInputPrice > 0 ? Math.round(((goldOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
            const iridiumProfit = adjustedInputPrice > 0 ? Math.round(((iridiumOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0

            return (
              <div key={idx} className="processing-row processing-row--output">
                {/* Arrow connector */}
                <span className="processing-arrow">
                  {specificOutputs.length === 1 ? '└→' : idx === specificOutputs.length - 1 ? '└→' : '├→'}
                </span>

                {/* Output item with modal link */}
                <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                  <ModalItemButton
                    item={output.outputItem}
                    variant="inline"
                    onNavigate={handleNavigate}
                  />
                </div>

                {/* Profit percentages by output quality */}
                <div className="quality-tiers">
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--regular">●</span>
                    <span style={{ color: getProfitColor(regularProfit) }}>
                      {regularProfit >= 0 ? '+' : ''}{regularProfit}%
                    </span>
                  </div>
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--silver">◆</span>
                    <span style={{ color: getProfitColor(silverProfit) }}>
                      {silverProfit >= 0 ? '+' : ''}{silverProfit}%
                    </span>
                  </div>
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--gold">★</span>
                    <span style={{ color: getProfitColor(goldProfit) }}>
                      {goldProfit >= 0 ? '+' : ''}{goldProfit}%
                    </span>
                  </div>
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--iridium">◆</span>
                    <span style={{ color: getProfitColor(iridiumProfit) }}>
                      {iridiumProfit >= 0 ? '+' : ''}{iridiumProfit}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    )
  }

  const renderAgingInfo = () => {
    if (!displayEntity?.canBeAged) return null

    const { agingDaysToIridium, agingDaysPerTier } = displayEntity

    return (
      <ModalSection id="section-aging" title="Cask Aging">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#5c4a32' }}>
            This item can be aged in a cask to improve its quality and value.
          </div>

          {agingDaysPerTier && (
            <div className="aging-grid">
              <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Regular → Silver:</strong> {agingDaysPerTier} days
              </span>

              <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Silver → Gold:</strong> {agingDaysPerTier} days
              </span>

              <span className="quality-symbol quality-symbol--sell quality-symbol--gold">★</span>
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Gold → Iridium:</strong> {agingDaysPerTier} days
              </span>

              <span style={{ fontWeight: 'bold', color: '#9c27b0' }}>◆</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                <strong>Total to Iridium:</strong> {agingDaysToIridium} days
              </span>
            </div>
          )}

          {!agingDaysPerTier && (
            <div style={{ fontSize: '0.875rem' }}>
              <strong>Days to Iridium:</strong> {agingDaysToIridium} days
            </div>
          )}
        </div>
      </ModalSection>
    )
  }

  // ============================================================================
  // Universal Sections
  // ============================================================================

  const renderVariationsList = () => {
    if (!displayEntity?.isGeneric || !displayEntity.variations) return null

    // Look up full variation objects from artisan data
    const variationItems = displayEntity.variations
      .map(varId => artisanItems.find(i => i.id === varId))
      .filter(Boolean)

    if (variationItems.length === 0) return null

    return (
      <ModalSection id="section-variations" title={`Variations (${variationItems.length})`}>
        <div className="variations-list">
          {variationItems.map(variation => {
            const varMachineSource = variation.sources?.find(s => s.type === 'machine')
            const source = varMachineSource
              ? `${varMachineSource.machine}: ${varMachineSource.inputName}`
              : null

            return (
              <div key={variation.id} className="variation-row">
                <ModalItemButton
                  item={variation}
                  variant="inline"
                  onNavigate={handleNavigate}
                />
                {source && <span className="variation-source">{source}</span>}
                <span className="variation-price">
                  {variation.prices?.regular}g
                </span>
              </div>
            )
          })}
        </div>
      </ModalSection>
    )
  }

  const renderSeedProduces = () => {
    if (!displayEntity || displayEntity.type !== 'seed') return null
    const produces = displayEntity.produces
    if (!produces || produces.length === 0) return null

    return (
      <ModalSection id="section-produces" title="Produces">
        <div className="produces-table">
          {produces.map((p, idx) => {
            const crop = cropItems.find(c => c.id === p.cropId)
              ?? forageItems.find(f => f.id === p.cropId)
            const cropSeasons = crop?.seasons || []
            return (
              <div key={p.cropId} className="processing-row processing-row--output processing-row--with-price">
                <span className="processing-arrow">{idx === produces.length - 1 ? '└→' : '├→'}</span>
                <div className="processing-row__name">
                  {crop
                    ? <ModalItemButton item={crop} variant="inline" onNavigate={handleNavigate} />
                    : <strong>{p.cropName}</strong>
                  }
                </div>
                <div className="processing-row__seasons">
                  {cropSeasons.length > 0 && <SeasonBadges seasons={cropSeasons} />}
                </div>
                <div className="processing-row__growth">
                  {p.growthDays && `${p.growthDays}d${p.regrowDays ? ` (+${p.regrowDays}d)` : ''}`}
                </div>
                {crop
                  ? <ItemSellPrice item={crop} showQualities={crop.maxQuality !== 0} />
                  : <span />
                }
              </div>
            )
          })}
        </div>
      </ModalSection>
    )
  }

  const renderSellingInfo = () => {
    if (!displayEntity) return null

    // Generic artisan items have no fixed price
    if (displayEntity.isGeneric) return null

    // Skip if entity has no price (unsellable items)
    const basePrice = displayEntity.prices?.regular || displayEntity.price || 0
    if (basePrice === 0) return null

    const sellingLocations = getSellingLocations(displayEntity)
    const professionInfo = getProfessionInfo(displayEntity)

    const multiplier = calculateProfessionMultiplier(displayEntity, activeProfessions)

    const trashCanRefund = getTrashCanRefund(trashCanUpgrade)
    const calculatedPrice = Math.floor(basePrice * multiplier)

    // Determine the price multiplier: if no trash can selected, use 1 (full price), otherwise use the refund percentage
    const priceMultiplier = trashCanUpgrade === null ? 1 : trashCanRefund

    // Get available professions for this item AND its inputs
    const getAvailableProfessions = () => {
      const professions = []
      const professionKeys = new Set()

      // Get professions for the output item (the modal's item)
      const actualCategory = displayEntity.originalCategory !== undefined
        ? displayEntity.originalCategory
        : displayEntity.category

      // Crops (vegetables and fruits)
      if (actualCategory === -75 || actualCategory === -79) {
        professions.push({ key: 'tiller', label: 'Tiller', bonus: '+10%', replaces: null })
        professionKeys.add('tiller')
      }

      if (displayEntity.type === 'fish' || actualCategory === -4) {
        professions.push(
          { key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
          { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }
        )
        professionKeys.add('fisher')
        professionKeys.add('angler')
      }

      if (displayEntity.type === 'artisan') {
        const isAnimalProduct = displayEntity.sources?.some(s => s.type === 'animal')
        const isSyrup = displayEntity.contextTags && displayEntity.contextTags.includes('syrup_item')

        if (isSyrup) {
          professions.push({ key: 'tapper', label: 'Tapper', bonus: '+25%', replaces: null })
          professionKeys.add('tapper')
        } else if (isAnimalProduct) {
          professions.push({ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null })
          professionKeys.add('rancher')
        } else {
          professions.push({ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null })
          professionKeys.add('artisan')
        }
      }

      if (displayEntity.category === 'Bars') {
        professions.push({ key: 'blacksmith', label: 'Blacksmith', bonus: '+50%', replaces: null })
        professionKeys.add('blacksmith')
      }

      if (displayEntity.category === 'Gems') {
        professions.push({ key: 'gemologist', label: 'Gemologist', bonus: '+30%', replaces: null })
        professionKeys.add('gemologist')
      }

      // Get professions for input items (only add if not already present)
      // Collect input categories from either inputDetails array or flat inputCategory field
      const inputCategories = new Set()
      const displayEntityMachineSource = displayEntity.sources?.find(s => s.type === 'machine')
      if (displayEntityMachineSource?.inputDetails?.length > 0) {
        displayEntityMachineSource.inputDetails.forEach(i => { if (i.inputCategory) inputCategories.add(i.inputCategory) })
      } else if (displayEntityMachineSource?.inputCategory) {
        inputCategories.add(displayEntityMachineSource.inputCategory)
      }

      if (inputCategories.size > 0) {
        // Check for fishing professions (category -4) for inputs
        if (inputCategories.has(-4) && !professionKeys.has('fisher')) {
          professions.push(
            { key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
            { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }
          )
          professionKeys.add('fisher')
          professionKeys.add('angler')
        }

        // Check for Rancher profession (category -5 Eggs, -6 Milk) for inputs
        if ((inputCategories.has(-5) || inputCategories.has(-6)) && !professionKeys.has('rancher')) {
          professions.push(
            { key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null }
          )
          professionKeys.add('rancher')
        }

        // Check for Tiller profession (category -75 Vegetables, -79 Fruits) for inputs
        if ((inputCategories.has(-75) || inputCategories.has(-79)) && !professionKeys.has('tiller')) {
          professions.push(
            { key: 'tiller', label: 'Tiller', bonus: '+10%', replaces: null }
          )
          professionKeys.add('tiller')
        }
      }

      // Get professions for output items (what this item can be processed into)
      if (artisanItems.length > 0) {
        artisanItems.forEach(artisan => {
          const artisanSrc = artisan.sources?.find(s => s.type === 'machine')
          if (artisanSrc?.inputDetails) {
            artisanSrc.inputDetails.forEach(inputDetail => {
              if (inputDetail.inputId === displayEntity.id) {
                // This item can be turned into this artisan good - check what professions apply
                const isAnimalProduct = artisan.source &&
                  ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(artisan.source)
                const isSyrup = artisan.contextTags && artisan.contextTags.includes('syrup_item')

                if (isSyrup && !professionKeys.has('tapper')) {
                  professions.push({ key: 'tapper', label: 'Tapper', bonus: '+25%', replaces: null })
                  professionKeys.add('tapper')
                } else if (isAnimalProduct && !professionKeys.has('rancher')) {
                  professions.push({ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null })
                  professionKeys.add('rancher')
                } else if (!isAnimalProduct && !isSyrup && !professionKeys.has('artisan')) {
                  professions.push({ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null })
                  professionKeys.add('artisan')
                }
              }
            })
          }
        })
      }

      return professions
    }

    const availableProfessions = getAvailableProfessions()

    return (
      <ModalSection id="section-calculator" title="Selling Calculator">
        {/* Selling Locations */}
        <div className="sell-locations">
          <span className="modal-label">Sell At:</span>
          <div className="tag-list tag-list-location">
            {sellingLocations.map((loc, i) => (
              <span key={i} className="tag">{loc}</span>
            ))}
          </div>
        </div>

        {/* Price Calculator */}
        <div className="profit-section">
          <div className="calculator-box">
            {/* Profession Checkboxes - only show if professions available */}
            {availableProfessions.length > 0 && (
              <div className="calculator-controls">
                <span className="modal-label">Professions:</span>
                {availableProfessions.map(prof => (
                  <label key={prof.key} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={activeProfessions[prof.key]}
                      onChange={(e) => {
                        const newState = { ...activeProfessions, [prof.key]: e.target.checked }

                        // Handle replacement logic
                        if (e.target.checked) {
                          // If this profession replaces another, uncheck the replaced one
                          if (prof.replaces) {
                            const replacesKey = prof.replaces.toLowerCase()
                            newState[replacesKey] = false
                          }

                          // If another profession would replace this one, uncheck it
                          // (e.g., checking Fisher unchecks Angler)
                          availableProfessions.forEach(p => {
                            if (p.replaces === prof.label) {
                              newState[p.key] = false
                            }
                          })
                        }

                        setActiveProfessions(newState)
                      }}
                    />
                    <span className="profession-name">{prof.label}</span>
                    <span className="profession-bonus">{prof.bonus}</span>
                    {prof.replaces && (
                      <span className="profession-replaces">
                        (replaces {prof.replaces})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* Trash Can Upgrade Checkboxes - always show */}
              <div className="calculator-controls calculator-controls--trash">
                <span className="modal-label">Trash Can:</span>
                {[
                  { value: 'normal', label: 'Normal' },
                  { value: 'copper', label: 'Copper' },
                  { value: 'steel', label: 'Steel' },
                  { value: 'gold', label: 'Gold' },
                  { value: 'iridium', label: 'Iridium' }
                ].map(option => (
                  <label key={option.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={trashCanUpgrade === option.value}
                      onChange={() => setTrashCanUpgrade(trashCanUpgrade === option.value ? null : option.value)}
                    />
                    <span className="profession-name">{option.label}</span>
                  </label>
                ))}
              </div>

              {/* Calculated Price */}
              <div className="calculator-results">
                <div className="calculator-prices">
                  <span style={{ fontWeight: 600 }}>
                    {trashCanUpgrade !== null ? 'Trash Refund:' : 'Sell Price:'}
                  </span>

                  {/* Show quality tiers if applicable */}
                  {displayEntity.isTrapFish ? (
                    // Crab pot fish: only normal and silver
                    <>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                        <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : 'inherit' }}>
                          {Math.floor(basePrice * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
                        <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : '#9e9e9e' }}>
                          {Math.floor(basePrice * 1.25 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                    </>
                  ) : displayEntity.type === 'seed' || (displayEntity.type === 'forage' && displayEntity.displayCategory === -81) ? (
                    // Seeds and beach forage: no quality tiers
                    <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : '#666' }}>
                      {Math.floor(basePrice * multiplier * priceMultiplier)}g
                    </span>
                  ) : displayEntity.maxQuality === 0 ? (
                    // Normal quality only (e.g. Fiber, Qi Fruit)
                    <div>
                      <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                      <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : 'inherit' }}>
                        {Math.floor(basePrice * multiplier * priceMultiplier)}g
                      </span>
                    </div>
                  ) : (
                    // All other items: full quality range
                    <>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                        <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : 'inherit' }}>
                          {Math.floor(basePrice * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
                        <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : '#9e9e9e' }}>
                          {Math.floor(basePrice * 1.25 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--gold">★</span>
                        <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : '#f57c00' }}>
                          {Math.floor(basePrice * 1.5 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--iridium">◆</span>
                        <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : '#9c27b0' }}>
                          {Math.floor(basePrice * 2.0 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Show formula breakdown */}
                <div className="calculator-formula">
                  {multiplier > 1 || trashCanUpgrade !== null ? (
                    <>
                      Base: {basePrice}g
                      {multiplier > 1 && <> × {multiplier} (profession)</>}
                      {trashCanUpgrade !== null && <> × {trashCanRefund * 100}% (trash refund)</>}
                      {' (per quality tier)'}
                    </>
                  ) : (
                    <>Base: {basePrice}g</>
                  )}
                </div>
              </div>

            {/* Note for normal-quality-only crops */}
            {displayEntity.maxQuality === 0 && (
              <ModalNote>
                This crop always harvests at normal quality regardless of Farming level or fertilizer.
              </ModalNote>
            )}

            {/* Profit Analysis for Artisan Items (input quality) */}
            {displayEntity.type === 'artisan' && (() => {
              const src = displayEntity.sources?.find(s => s.type === 'machine')
              if (src?.inputDetails) return renderProfitAnalysis(src.inputDetails)
              if (src?.inputId) return renderProfitAnalysis([{
                inputId: src.inputId,
                inputName: src.inputName,
                inputGameId: src.inputGameId,
                inputBasePrice: src.inputBasePrice,
                inputCategory: src.inputCategory
              }])
              return null
            })()}

            {/* Output Profit Analysis (what can this item become) */}
            {renderOutputProfitAnalysis()}
          </div>
        </div>
      </ModalSection>
    )
  }

  const renderContextTabs = () => {
    if (!alternateContext) return null

    const getTabLabel = (item) => {
      const typeLabels = {
        'fish': 'Fish (Crab Pot)',
        'forage': 'Forage (Beach)'
      }
      return typeLabels[item.type] || item.type
    }

    // Create tabs array and sort alphabetically by label
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

  const renderBundles = () => {
    if (!displayEntity?.bundles || displayEntity.bundles.length === 0) return null

    // Wait for relational data to load
    if (relationalData.loading) return null

    // Resolve bundle IDs to full bundle objects
    const bundleDetails = displayEntity.bundles
      .map(bundleId => {
        const bundle = relationalData.getBundle(bundleId)
        if (!bundle) {
          console.warn(`Bundle not found: ${bundleId}`, {
            bundleId,
            loading: relationalData.loading,
            hasBundles: !!relationalData.bundles,
            bundlesCount: relationalData.bundles?.all?.length
          })
        }
        return bundle
      })
      .filter(Boolean)

    if (bundleDetails.length === 0) {
      console.warn('No bundle details found', {
        itemBundles: displayEntity.bundles,
        loading: relationalData.loading
      })
      return null
    }

    return (
      <ModalSection id="section-bundles" title="Bundles">
        <div className="bundle-badges-list">
          {bundleDetails.map(bundle => (
            <BundleBadge
              key={bundle.id}
              bundle={bundle}
              showModal={true}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </ModalSection>
    )
  }

  const renderContextTags = () => {
    if (!displayEntity?.contextTags || displayEntity.contextTags.length === 0) return null

    return (
      <ModalSection title="Context Tags">
        <TagList items={displayEntity.contextTags} variant="context" />
      </ModalSection>
    )
  }

  // ============================================================================
  // Bundle-Specific Rendering
  // ============================================================================

  // Helper to get quality name
  const getQualityName = (quality) => {
    switch (quality) {
      case 0: return ''
      case 1: return 'Silver or better'
      case 2: return 'Gold or better'
      case 4: return 'Iridium'
      default: return ''
    }
  }

  // Helper to get quality symbol
  const getQualitySymbol = (quality) => {
    switch (quality) {
      case 0: return '●'
      case 1: return '◆'
      case 2: return '★'
      case 4: return '◆'
      default: return '●'
    }
  }

  // Helper to get quality color
  const getQualityColor = (quality) => {
    switch (quality) {
      case 0: return '#666'
      case 1: return '#9e9e9e'
      case 2: return '#f57c00'
      case 4: return '#9c27b0'
      default: return '#666'
    }
  }

  // Helper to find item by gameId (searches the unified items store)
  const findEntityByGameId = (gameId) => findByGameId(gameId)

  const renderBundleRequirements = () => {
    if (entityType !== 'bundle' || !displayEntity.items) return null

    // Filter out placeholder items (weeds, stone)
    const realItems = displayEntity.items.filter(item => {
      return item.gameId !== 0 && item.gameId !== 2 && item.gameId !== 10
    })

    const requiredCount = displayEntity.minItemsRequired || realItems.length

    return (
      <ModalSection id="section-required" title="Required Items">
        <div className="bundle-items-list">
          {realItems.map((bundleItem, idx) => {
            const item = findEntityByGameId(bundleItem.gameId)

            return item ? (
              <ModalItemButton
                key={idx}
                item={item}
                variant="bundle-item"
                quality={bundleItem.quality}
                quantity={bundleItem.quantity}
                onNavigate={handleNavigate}
              />
            ) : (
              <span key={idx} className="bundle-item-name">{bundleItem.id}</span>
            )
          })}
        </div>

        {/* Bundle slots indicator */}
        <div className="bundle-slots">
          {Array.from({ length: requiredCount }).map((_, idx) => (
            <div key={idx} className="bundle-slot-container"></div>
          ))}
        </div>
      </ModalSection>
    )
  }

  const renderBundleReward = () => {
    if (entityType !== 'bundle' || !displayEntity.reward) return null

    // Parse reward string format: "O {gameId} {quantity}" or "BO {gameId} {quantity}"
    const parseReward = (rewardStr) => {
      const parts = rewardStr.trim().split(' ')
      if (parts.length < 3) return null

      const type = parts[0] // 'O' for Object, 'BO' for BigCraftable
      const gameId = parseInt(parts[1])
      const quantity = parseInt(parts[2])

      if (isNaN(gameId) || isNaN(quantity)) return null

      return { type, gameId, quantity }
    }

    const reward = parseReward(displayEntity.reward)
    if (!reward) {
      return (
        <ModalSection id="section-reward" title="Reward">
          <div className="bundle-reward">
            {displayEntity.reward}
          </div>
        </ModalSection>
      )
    }

    // Look up the item - findEntityByGameId searches all item types including BigCraftables
    const rewardItem = findEntityByGameId(reward.gameId)

    return (
      <ModalSection id="section-reward" title="Reward">
        <div className="bundle-reward">
          {rewardItem ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ModalItemButton
                item={rewardItem}
                variant="bundle-item"
                quantity={reward.quantity}
                onNavigate={handleNavigate}
              />
              <span style={{ fontSize: '1rem', fontWeight: 500 }}>
                {rewardItem.name} x{reward.quantity}
              </span>
            </div>
          ) : (
            <span>Unknown Item ({reward.type} {reward.gameId}) x{reward.quantity}</span>
          )}
        </div>
      </ModalSection>
    )
  }

  // ============================================================================
  // Breadcrumb Rendering
  // ============================================================================

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

  // Determine the type and build subtitle
  const type = displayEntity.type || 'unknown'
  let subtitle = 'Item'
  let modalTitle = displayEntity.name
  let headerName = displayEntity.name

  if (entityType === 'bundle') {
    // Bundle-specific subtitle
    subtitle = 'Community Center Bundle'
    modalTitle = displayEntity.name
    headerName = displayEntity.name
  } else {
    // Item-specific subtitle logic
    const subtitleCategory = displayEntity.displayCategory !== undefined
      ? displayEntity.displayCategory
      : displayEntity.category
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
    // If our type classification differs from game category, show both
    if (typeDisplayName !== categoryName && categoryName !== 'Item') {
      subtitle = `${typeDisplayName} (${categoryName})`
    }

    // Handle special cases for modal title and header name
    const isLegendaryFish = type === 'fish' && displayEntity.contextTags?.includes('fish_legendary')
    modalTitle = isLegendaryFish ? `⭐${displayEntity.name}` : displayEntity.name
    headerName = isLegendaryFish ? `⭐${displayEntity.name}` : displayEntity.name
  }

  // Icon path handling
  const iconPath = displayEntity.icon ? (displayEntity.icon.startsWith('/') ? displayEntity.icon : `/${displayEntity.icon}`) : undefined

  // Compute which sections are visible for the section nav
  const visibleSections = (() => {
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
      s.type === 'fish' || s.type === 'forage' || s.type === 'animal' || s.type === 'tapper' ||
      s.type === 'machine' || s.type === 'seed'
    )
    const hasLocationSection = (hasSeasons && type !== 'seed') || hasTimes || hasWeather || hasBuyingInfo || hasOtherSources

    const hasProduces = isSeed && displayEntity.produces?.length > 0
    const hasAging = !!displayEntity.canBeAged
    const basePrice = displayEntity.prices?.regular || displayEntity.price || 0
    const hasCalculator = !displayEntity.isGeneric && basePrice > 0
    const hasBundles = displayEntity.bundles?.length > 0
    const hasGifts = displayEntity.canBeGifted !== false && relationalData.getGiftPreferences(displayEntity.id)?.length > 0

    return [
      type === 'fish' && { id: 'section-fishing', label: 'Fishing Info' },
      type === 'artisan' && displayEntity.isGeneric && displayEntity.variations?.length > 0 && { id: 'section-variations', label: 'Variations' },
      hasLocationSection && { id: 'section-location', label: 'Location & Availability' },
      hasProduces && { id: 'section-produces', label: 'Produces' },
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
        {entityType !== 'bundle' && renderContextTabs()}

        <div className="modal-item-content">
          <ModalHeader icon={iconPath} name={headerName} subtitle={subtitle}>
            {/* Price display for items only */}
            {entityType !== 'bundle' && (displayEntity.price || displayEntity.prices) && (
              <div className="modal-price">
                <ItemSellPrice
                  item={displayEntity}
                  showQualities={displayEntity.type !== 'seed'}
                  showProfession={true}
                />
              </div>
            )}
          </ModalHeader>

          {/* Bundle-Specific Sections */}
          {entityType === 'bundle' && renderBundleRequirements()}
          {entityType === 'bundle' && renderBundleReward()}

          {/* Item-Specific Sections */}
          {entityType !== 'bundle' && type === 'fish' && renderFishingInfo()}
          {entityType !== 'bundle' && type === 'artisan' && renderVariationsList()}

          {/* Universal Item Sections (items only) */}
          {entityType !== 'bundle' && renderLocationAvailability()}
          {entityType !== 'bundle' && renderSeedProduces()}
          {entityType !== 'bundle' && renderAgingInfo()}
          {entityType !== 'bundle' && renderSellingInfo()}
          {entityType !== 'bundle' && renderBundles()}

          {entityType !== 'bundle' && (
            <ModalGiftPreferences
              id="section-gifts"
              giftDetails={relationalData.getGiftPreferences(displayEntity.id)}
              sectionClass="modal-section"
              giftsClass="modal-gifts"
            />
          )}

          {entityType !== 'bundle' && renderContextTags()}
        </div>
      </div>
    </Modal>
  )
}

export default UniversalModal

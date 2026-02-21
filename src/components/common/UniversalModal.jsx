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
import BundleBadge from './BundleBadge'
import InfoTooltip from './InfoTooltip'
import { useData } from '../../hooks/useData'
import { useRelationalData } from '../../hooks/useRelationalData'
import { usePlayer } from '../../contexts/PlayerContext'
import { formatLocationNames } from '../../utils/formatters'
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
    setHistory(prev => [...prev, newEntity])
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

  // Load all page data for alternate context lookup and input item lookups
  const { data: fishData, error: fishError } = useData({ fish: '/data/pages/fish.json' })
  const { data: forageData, error: forageError } = useData({ forage: '/data/pages/forage.json' })
  const { data: cropsData, error: cropsError } = useData({ crops: '/data/pages/crops.json' })
  const { data: artisanData, error: artisanError } = useData({ artisan: '/data/pages/artisan.json' })
  const { data: bigCraftablesData, error: bigCraftablesError } = useData({ bigCraftables: '/data/pages/big-craftables.json' })
  const { data: treeFruitsData, error: treeFruitsError } = useData({ treeFruits: '/data/pages/tree-fruits.json' })
  const { data: mineralsData, error: mineralsError } = useData({ minerals: '/data/pages/minerals.json' })
  const { data: metalBarsData, error: metalBarsError } = useData({ metalBars: '/data/pages/metal-bars.json' })
  const { data: monsterLootData, error: monsterLootError } = useData({ monsterLoot: '/data/pages/monster-loot.json' })
  const { data: resourcesData, error: resourcesError } = useData({ resources: '/data/pages/resources.json' })

  // Log any errors
  useEffect(() => {
    const errors = {
      fish: fishError,
      forage: forageError,
      crops: cropsError,
      artisan: artisanError,
      bigCraftables: bigCraftablesError,
      treeFruits: treeFruitsError,
      minerals: mineralsError,
      metalBars: metalBarsError,
      monsterLoot: monsterLootError,
      resources: resourcesError
    }
    const failed = Object.entries(errors).filter(([k, v]) => v)
    if (failed.length > 0) {
      console.error('Failed to load data:', failed)
    }
  }, [fishError, forageError, cropsError, artisanError, bigCraftablesError, treeFruitsError, mineralsError, metalBarsError, monsterLootError, resourcesError])

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

    const { type, id } = currentEntity.alsoAvailableAs

    // Look up the alternate context from the appropriate data file
    if (type === 'fish' && fishData?.fish?.items) {
      const fishContext = fishData.fish.items.find(f => f.id === id)
      setAlternateContext(fishContext || null)
    } else if (type === 'forage' && forageData?.forage?.items) {
      const forageContext = forageData.forage.items.find(f => f.id === id)
      setAlternateContext(forageContext || null)
    } else {
      setAlternateContext(null)
    }
  }, [currentEntity, entityType, fishData, forageData])

  // Use entityRef for closing animation, currentEntity for live display
  const primaryEntity = currentEntity || entityRef.current

  // Use the appropriate entity based on active tab (only for items with dual contexts)
  const displayEntity = activeTab === 'alternate' && alternateContext ? alternateContext : primaryEntity

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const findInputItem = (inputId) => {
    // Search across all loaded data sources for the input item
    const allItems = [
      ...(fishData?.fish?.items || []),
      ...(forageData?.forage?.items || []),
      ...(cropsData?.crops?.items || []),
      ...(artisanData?.artisan?.items || [])
    ]

    return allItems.find(item => item.id === inputId)
  }

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
      const isAnimalProduct = item.source && ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(item.source)
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

  const getCategoryName = (category, type) => {
    const categoryMap = {
      '-4': 'Fish',
      '-5': 'Egg',
      '-6': 'Milk',
      '-7': 'Cooking',
      '-12': 'Minerals',
      '-15': 'Metal Resources',
      '-16': 'Building Resources',
      '-17': "Sell at Pierre's",
      '-18': "Sell at Pierre's and Marnie's",
      '-19': 'Fertilizer',
      '-20': 'Junk',
      '-21': 'Bait',
      '-22': 'Tackle',
      '-23': 'Sell at Fish Shop',
      '-24': 'Furniture',
      '-25': 'Ingredients',
      '-26': 'Artisan Goods',
      '-27': 'Syrup',
      '-28': 'Monster Loot',
      '-74': 'Seeds',
      '-75': 'Vegetables',
      '-79': 'Fruit',
      '-80': 'Flower',
      '-81': 'Forage'
    }

    // For artisan, category is a string
    if (type === 'artisan' && typeof category === 'string') {
      return category
    }

    return categoryMap[String(category)] || 'Item'
  }

  const formatTime = (militaryTime) => {
    const time = String(militaryTime).padStart(4, '0')
    let hours = parseInt(time.slice(0, -2))

    if (hours >= 24) {
      hours -= 24
    }

    const period = hours >= 12 ? 'pm' : 'am'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

    return `${displayHours}${period}`
  }

  const formatSeasons = (seasons) => {
    if (!seasons || seasons.length === 0) return 'None'
    return seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
  }

  const formatProcessingTime = (minutes) => {
    if (!minutes) return 'Unknown'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
    }
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  const getDifficultyColor = (difficulty) => {
    if (difficulty >= 80) return '#d32f2f'
    if (difficulty >= 60) return '#f57c00'
    if (difficulty >= 40) return '#fbc02d'
    return '#66bb6a'
  }

  const formatPrice = (price) => {
    return `${price}g`
  }

  // ============================================================================
  // Universal Rendering (based on data presence)
  // ============================================================================

  const renderLocationAvailability = () => {
    if (!displayEntity) return null

    // Check if entity has location/season data
    const hasLocations = (displayEntity.location && displayEntity.location.length > 0) ||
                        (displayEntity.locations && displayEntity.locations.length > 0)
    const hasSeasons = displayEntity.seasons && displayEntity.seasons.length > 0
    const hasTimes = displayEntity.times && displayEntity.times.length > 0
    const hasWeather = displayEntity.weather
    const hasNotes = displayEntity.notes

    if (!hasLocations && !hasSeasons && !hasTimes && !hasWeather) return null

    // Get locations (fish uses 'location', forage uses 'locations')
    const locations = displayEntity.location || displayEntity.locations || []
    const formattedLocations = displayEntity.type === 'forage' ? formatLocationNames(locations) : locations

    return (
      <ModalSection title="Location & Availability">
        {hasLocations && (
          <div className="modal-label-with-tags">
            <span className="label">Locations:</span>
            <TagList items={formattedLocations} variant="location" emptyText="Unknown" />
          </div>
        )}

        <ModalGrid>
          {hasSeasons && (
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

        {hasNotes && (
          <ModalNote>
            <strong>Special Case:</strong>
            <div style={{ marginTop: '0.5rem' }}>
              {displayEntity.notes.map((note, idx) => (
                <div key={idx} style={{ marginBottom: '0.25rem' }}>
                  <strong>{note.locations.join(', ')}:</strong> {note.seasons}
                </div>
              ))}
            </div>
          </ModalNote>
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
        <ModalSection title="Fishing Info">
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
      <ModalSection title="Fishing Info">
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

  // ============================================================================
  // Artisan-Specific Rendering
  // ============================================================================

  const renderArtisanProductionInfo = () => {
    if (!displayEntity || displayEntity.type !== 'artisan' || !displayEntity.producedBy) return null

    const { machine, inputType, valueFormula, inputId, inputName } = displayEntity.producedBy

    // Try to resolve the input to a linkable item
    const resolveInputItem = () => {
      if (!artisanData?.artisan?.items) return null

      // For variations with a specific input (e.g., Legend Aged Roe → Legend Roe)
      if (inputId) {
        // Try compound ID first: e.g., "legend" + "roe" → "legend-roe"
        const compoundId = `${inputId}-${inputType}`
        const compoundMatch = artisanData.artisan.items.find(i => i.id === compoundId)
        if (compoundMatch) return compoundMatch

        // Try finding the input across all data sources
        return findInputItem(inputId)
      }

      // For generics, check if inputType matches a generic artisan item (e.g., "roe" → Roe generic)
      if (displayEntity.isGeneric && inputType) {
        const genericMatch = artisanData.artisan.items.find(i => i.id === inputType && i.isGeneric)
        if (genericMatch) return genericMatch
      }

      return null
    }

    const inputItem = resolveInputItem()

    const formatInputType = (type) => {
      if (!type) return 'Unknown'
      if (type === 'specific') return 'Specific Item'
      return type.charAt(0).toUpperCase() + type.slice(1)
    }

    // Build the display label for the input
    const renderInputDisplay = () => {
      if (inputItem) {
        return (
          <ModalItemButton item={inputItem} variant="inline" onNavigate={handleNavigate} />
        )
      }
      if (inputName && inputType) {
        // Show "InputName InputType" for variations without a linkable item (e.g., "Starfruit" when crop data not loaded)
        return formatInputType(inputType)
      }
      return formatInputType(inputType)
    }

    return (
      <ModalSection title="Production Info">
        <ModalGrid>
          <ModalGridItem
            label="Machine:"
            value={machine || 'Unknown'}
          />

          <ModalGridItem label="Input:">
            {renderInputDisplay()}
          </ModalGridItem>

          {displayEntity.processingTimeMinutes && (
            <ModalGridItem
              label="Processing Time:"
              value={formatProcessingTime(displayEntity.processingTimeMinutes)}
            />
          )}

          {valueFormula && (
            <ModalGridItem label="Value Formula:">
              <span className="formula-value">{valueFormula}</span>
            </ModalGridItem>
          )}
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

    const getProfitColor = (profit) => {
      if (profit < 0) return '#d32f2f' // Red for losses
      if (profit >= 100) return '#2e7d32' // Green for 100%+ profit
      return '#5c4a32' // Brown for under 100% profit
    }

    // Calculate input profession multiplier based on input category
    const getInputProfessionMultiplier = (inputCategory) => {
      // Fish inputs (category -4) get fishing profession bonuses
      if (inputCategory === -4) {
        if (activeProfessions.angler) return 1.5
        if (activeProfessions.fisher) return 1.25
      }

      // Animal product inputs (Milk -6, Eggs -5) get Rancher bonus
      if (inputCategory === -5 || inputCategory === -6) {
        if (activeProfessions.rancher) return 1.2
      }

      return 1.0
    }

    // Calculate output profession multiplier (same logic as main calculator)
    const getOutputProfessionMultiplier = () => {
      const actualCategory = displayEntity.originalCategory !== undefined
        ? displayEntity.originalCategory
        : displayEntity.category

      // Fishing professions (Angler replaces Fisher, doesn't stack)
      if (displayEntity.type === 'fish' || actualCategory === -4) {
        if (activeProfessions.angler) return 1.5
        if (activeProfessions.fisher) return 1.25
      }

      // Artisan goods
      if (displayEntity.type === 'artisan') {
        const isAnimalProduct = displayEntity.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayEntity.source)
        const isSyrup = displayEntity.contextTags && displayEntity.contextTags.includes('syrup_item')

        if (activeProfessions.tapper && isSyrup) return 1.25
        if (activeProfessions.artisan && !isAnimalProduct && !isSyrup) return 1.4
        if (activeProfessions.rancher && isAnimalProduct) return 1.2
      }

      // Mining professions
      if (displayEntity.category === 'Bars' && activeProfessions.blacksmith) return 1.5
      if (displayEntity.category === 'Gems' && activeProfessions.gemologist) return 1.3

      return 1.0
    }

    const outputProfessionMultiplier = getOutputProfessionMultiplier()

    // Calculate trash can refund percentage (same logic as main calculator)
    const getTrashCanRefund = () => {
      switch (trashCanUpgrade) {
        case 'normal': return 0
        case 'copper': return 0.15
        case 'steel': return 0.30
        case 'gold': return 0.45
        case 'iridium': return 0.60
        default: return 0
      }
    }

    const trashCanRefund = getTrashCanRefund()
    const priceMultiplier = trashCanUpgrade === null ? 1 : trashCanRefund

    return (
      <div className="profit-section">
        <div className="profit-header">
          <div className="modal-label">Produced From:</div>
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
            const inputProfessionMultiplier = getInputProfessionMultiplier(input.inputCategory)
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

    // Search through artisan data to find what this item can be turned into
    const outputs = []
    if (artisanData?.artisan?.items) {
      artisanData.artisan.items.forEach(artisan => {
        if (artisan.producedBy?.inputDetails) {
          artisan.producedBy.inputDetails.forEach(inputDetail => {
            if (inputDetail.inputId === displayEntity.id) {
              outputs.push({
                outputItem: artisan,
                outputName: artisan.name,
                // Use the specific output price for this input (handles formula-based items like Wine)
                outputBasePrice: inputDetail.outputPrice || artisan.prices?.regular || artisan.price || 0,
                machine: artisan.producedBy.machine,
                processingTime: artisan.processingTimeMinutes
              })
            }
          })
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

    // Calculate input profession multiplier (same logic as main sell price calculator)
    const getInputProfessionMultiplier = () => {
      const actualCategory = displayEntity.originalCategory !== undefined
        ? displayEntity.originalCategory
        : displayEntity.category

      if (displayEntity.type === 'fish' || actualCategory === -4) {
        if (activeProfessions.angler) return 1.5
        if (activeProfessions.fisher) return 1.25
      }
      if (actualCategory === -75 || actualCategory === -79) {
        if (activeProfessions.tiller) return 1.1
      }
      if (displayEntity.type === 'artisan') {
        const isAnimalProduct = displayEntity.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayEntity.source)
        const isSyrup = displayEntity.contextTags && displayEntity.contextTags.includes('syrup_item')

        if (activeProfessions.tapper && isSyrup) return 1.25
        if (activeProfessions.rancher && isAnimalProduct) return 1.2
        if (activeProfessions.artisan && !isAnimalProduct && !isSyrup) return 1.4
      }
      if (displayEntity.category === 'Bars' && activeProfessions.blacksmith) return 1.5
      if (displayEntity.category === 'Gems' && activeProfessions.gemologist) return 1.3
      return 1.0
    }

    // Calculate output profession multiplier for a given output artisan item
    const getOutputProfessionMultiplier = (outputItem) => {
      if (outputItem.type !== 'artisan') return 1.0

      const isAnimalProduct = outputItem.source &&
        ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(outputItem.source)
      const isSyrup = outputItem.contextTags && outputItem.contextTags.includes('syrup_item')

      if (activeProfessions.tapper && isSyrup) return 1.25
      if (activeProfessions.artisan && !isAnimalProduct && !isSyrup) return 1.4
      if (activeProfessions.rancher && isAnimalProduct) return 1.2
      return 1.0
    }

    const inputProfessionMultiplier = getInputProfessionMultiplier()
    const adjustedInputPrice = Math.floor(inputBasePrice * inputMultiplier * inputProfessionMultiplier)

    // Trash can affects the output prices (trashing the processed result)
    const getTrashCanRefund = () => {
      switch (trashCanUpgrade) {
        case 'normal': return 0
        case 'copper': return 0.15
        case 'steel': return 0.30
        case 'gold': return 0.45
        case 'iridium': return 0.60
        default: return 0
      }
    }
    const trashCanRefund = getTrashCanRefund()
    const outputPriceMultiplier = trashCanUpgrade === null ? 1 : trashCanRefund

    const getProfitColor = (profit) => {
      if (profit < 0) return '#d32f2f'
      if (profit >= 100) return '#2e7d32'
      return '#5c4a32'
    }

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
          {outputs.map((output, idx) => {
            const outputProfessionMultiplier = getOutputProfessionMultiplier(output.outputItem)

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
                  {outputs.length === 1 ? '└→' : idx === outputs.length - 1 ? '└→' : '├→'}
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
      <ModalSection title="Cask Aging">
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
      .map(varId => artisanData?.artisan?.items?.find(i => i.id === varId))
      .filter(Boolean)

    if (variationItems.length === 0) return null

    return (
      <ModalSection title={`Variations (${variationItems.length})`}>
        <div className="variations-list">
          {variationItems.map(variation => {
            const source = variation.producedBy
              ? `${variation.producedBy.machine}: ${variation.producedBy.inputName}`
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

  const renderSellingInfo = () => {
    if (!displayEntity) return null

    // Generic artisan items have no fixed price
    if (displayEntity.isGeneric) return null

    // Skip if entity has no price (unsellable items)
    const basePrice = displayEntity.prices?.regular || displayEntity.price || 0
    if (basePrice === 0) return null

    const sellingLocations = getSellingLocations(displayEntity)
    const professionInfo = getProfessionInfo(displayEntity)

    // Calculate multiplier based on active professions
    const calculateMultiplier = () => {
      const actualCategory = displayEntity.originalCategory !== undefined
        ? displayEntity.originalCategory
        : displayEntity.category

      // Farming professions (crops)
      if (actualCategory === -75 || actualCategory === -79) {
        if (activeProfessions.tiller) return 1.1
      }

      // Fishing professions (Angler replaces Fisher, doesn't stack)
      if (displayEntity.type === 'fish' || actualCategory === -4) {
        if (activeProfessions.angler) return 1.5
        if (activeProfessions.fisher) return 1.25
      }

      // Artisan goods
      if (displayEntity.type === 'artisan') {
        const isAnimalProduct = displayEntity.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayEntity.source)
        const isSyrup = displayEntity.contextTags && displayEntity.contextTags.includes('syrup_item')

        if (activeProfessions.tapper && isSyrup) return 1.25
        if (activeProfessions.artisan && !isAnimalProduct && !isSyrup) return 1.4
        if (activeProfessions.rancher && isAnimalProduct) return 1.2
      }

      // Mining professions
      if (displayEntity.category === 'Bars' && activeProfessions.blacksmith) return 1.5
      if (displayEntity.category === 'Gems' && activeProfessions.gemologist) return 1.3

      return 1.0
    }

    const multiplier = calculateMultiplier()

    // Calculate trash can refund percentage
    const getTrashCanRefund = () => {
      switch (trashCanUpgrade) {
        case 'normal': return 0
        case 'copper': return 0.15
        case 'steel': return 0.30
        case 'gold': return 0.45
        case 'iridium': return 0.60
        default: return 0
      }
    }

    const trashCanRefund = getTrashCanRefund()
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
        const isAnimalProduct = displayEntity.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayEntity.source)
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
      if (displayEntity.producedBy?.inputDetails && displayEntity.producedBy.inputDetails.length > 0) {
        displayEntity.producedBy.inputDetails.forEach(i => { if (i.inputCategory) inputCategories.add(i.inputCategory) })
      } else if (displayEntity.producedBy?.inputCategory) {
        inputCategories.add(displayEntity.producedBy.inputCategory)
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
      if (artisanData?.artisan?.items) {
        artisanData.artisan.items.forEach(artisan => {
          if (artisan.producedBy?.inputDetails) {
            artisan.producedBy.inputDetails.forEach(inputDetail => {
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
      <ModalSection title="Selling Calculator">
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
                  ) : displayEntity.type === 'forage' && displayEntity.displayCategory === -81 ? (
                    // Beach forage items: no quality
                    <span className={`sell-price-value${trashCanUpgrade !== null ? ' sell-price-value--trash' : ''}`} style={{ color: trashCanUpgrade !== null ? undefined : (multiplier > 1 ? '#1976d2' : '#666') }}>
                      {Math.floor(basePrice * multiplier * priceMultiplier)}g
                    </span>
                  ) : displayEntity.maxHarvestQuality === 0 ? (
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
            {displayEntity.maxHarvestQuality === 0 && (
              <ModalNote>
                This crop always harvests at normal quality regardless of Farming level or fertilizer.
              </ModalNote>
            )}

            {/* Profit Analysis for Artisan Items (input quality) */}
            {displayEntity.type === 'artisan' && displayEntity.producedBy?.inputDetails &&
              renderProfitAnalysis(displayEntity.producedBy.inputDetails)}
            {displayEntity.type === 'artisan' && !displayEntity.producedBy?.inputDetails && displayEntity.producedBy?.inputId &&
              renderProfitAnalysis([{
                inputId: displayEntity.producedBy.inputId,
                inputName: displayEntity.producedBy.inputName,
                inputGameId: displayEntity.producedBy.inputGameId,
                inputBasePrice: displayEntity.producedBy.inputBasePrice,
                inputCategory: displayEntity.producedBy.inputCategory
              }])}

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
      <ModalSection title="Bundles">
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

  // Helper to find item by gameId
  const findEntityByGameId = (gameId) => {
    // Search through all loaded item data
    const allItems = [
      ...(fishData?.fish?.items || []),
      ...(forageData?.forage?.items || []),
      ...(cropsData?.crops?.items || []),
      ...(artisanData?.artisan?.items || []),
      ...(bigCraftablesData?.bigCraftables?.items || []),
      ...(treeFruitsData?.treeFruits?.items || []),
      ...(mineralsData?.minerals?.items || []),
      ...(metalBarsData?.metalBars?.items || []),
      ...(monsterLootData?.monsterLoot?.items || []),
      ...(resourcesData?.resources?.items || [])
    ]

    const found = allItems.find(item => item.gameId === gameId)

    if (!found && gameId === 15) {
      console.log('findEntityByGameId debugging for gameId 15:', {
        gameId,
        totalItems: allItems.length,
        fishDataKeys: Object.keys(fishData || {}),
        fishCount: fishData?.fish?.items?.length,
        bigCraftablesDataKeys: Object.keys(bigCraftablesData || {}),
        bigCraftablesDirectItems: bigCraftablesData?.items,
        bigCraftablesNestedItems: bigCraftablesData?.bigCraftables?.items,
        allDataSources: {
          fish: fishData?.fish?.items?.length,
          forage: forageData?.forage?.items?.length,
          crops: cropsData?.crops?.items?.length,
          artisan: artisanData?.artisan?.items?.length,
          bigCraftables: bigCraftablesData?.bigCraftables?.items?.length,
          treeFruits: treeFruitsData?.treeFruits?.items?.length
        }
      })
    }

    return found || null
  }

  const renderBundleRequirements = () => {
    if (entityType !== 'bundle' || !displayEntity.items) return null

    // Filter out placeholder items (weeds, stone)
    const realItems = displayEntity.items.filter(item => {
      return item.gameId !== 0 && item.gameId !== 2 && item.gameId !== 10
    })

    const requiredCount = displayEntity.minItemsRequired || realItems.length

    return (
      <ModalSection title="Required Items">
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
        <ModalSection title="Reward">
          <div className="bundle-reward">
            {displayEntity.reward}
          </div>
        </ModalSection>
      )
    }

    // Look up the item - findEntityByGameId searches all item types including BigCraftables
    const rewardItem = findEntityByGameId(reward.gameId)

    return (
      <ModalSection title="Reward">
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
              {index > 0 && <span className="breadcrumb-separator">&rsaquo;</span>}
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
      'resource': 'Resource'
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="modal-item-wrapper">
        {/* Breadcrumb trail for navigation history */}
        {renderBreadcrumbs()}

        {/* Context tabs for dual-role items (items only) */}
        {entityType !== 'bundle' && renderContextTabs()}

        <div className="modal-item-content">
          <ModalHeader icon={iconPath} name={headerName} subtitle={subtitle}>
            {/* Price display for items only */}
            {entityType !== 'bundle' && (displayEntity.price || displayEntity.prices) && (
              <div className="modal-price">
                <ItemSellPrice
                  item={displayEntity}
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
          {entityType !== 'bundle' && type === 'artisan' && renderArtisanProductionInfo()}
          {entityType !== 'bundle' && type === 'artisan' && renderVariationsList()}

          {/* Universal Item Sections (items only) */}
          {entityType !== 'bundle' && renderLocationAvailability()}
          {entityType !== 'bundle' && renderAgingInfo()}
          {entityType !== 'bundle' && renderSellingInfo()}
          {entityType !== 'bundle' && renderBundles()}

          {entityType !== 'bundle' && (
            <ModalGiftPreferences
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

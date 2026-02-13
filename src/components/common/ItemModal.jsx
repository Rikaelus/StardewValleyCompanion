import { useRef, useEffect, useMemo, useState } from 'react'
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
import { useData } from '../../hooks/useData'
import { useRelationalData } from '../../hooks/useRelationalData'
import { usePlayer } from '../../contexts/PlayerContext'
import { formatLocationNames } from '../../utils/formatters'
import './ItemModal.css'

/**
 * Unified modal component for displaying item details
 * Dynamically renders sections based on item type and available data
 */
function ItemModal({ item, isOpen, onClose, modalDepth = 0 }) {
  const itemRef = useRef(item)
  const { player } = usePlayer()

  // Tab state for dual-context items
  const [activeTab, setActiveTab] = useState('primary')
  const [alternateContext, setAlternateContext] = useState(null)

  // Profession calculator state (defaults to player's actual professions)
  const [activeProfessions, setActiveProfessions] = useState({
    fisher: false,
    angler: false,
    artisan: false,
    rancher: false,
    blacksmith: false,
    gemologist: false
  })
  const [trashCanUpgrade, setTrashCanUpgrade] = useState(null) // null, copper, steel, gold, iridium
  const [inputQuality, setInputQuality] = useState('regular') // regular, silver, gold, iridium

  // Load all page data for alternate context lookup and input item lookups
  const { data: fishData } = useData({ fish: '/data/pages/fish.json' })
  const { data: forageData } = useData({ forage: '/data/pages/forage.json' })
  const { data: cropsData } = useData({ crops: '/data/pages/crops.json' })
  const { data: artisanData } = useData({ artisan: '/data/pages/artisan.json' })

  // Load relational data for lookups
  const relationalData = useRelationalData()

  // Keep the last item data during closing animation
  useEffect(() => {
    if (item) {
      itemRef.current = item
    }
  }, [item])

  // Reset to primary tab when item changes
  useEffect(() => {
    if (item) {
      setActiveTab('primary')
    }
  }, [item])

  // Reset professions to player's actual professions when item or player changes
  useEffect(() => {
    setActiveProfessions({
      fisher: player.professions.fisher || false,
      angler: player.professions.angler || false,
      artisan: player.professions.artisan || false,
      rancher: player.professions.rancher || false,
      blacksmith: player.professions.blacksmith || false,
      gemologist: player.professions.gemologist || false
    })
  }, [item, player.professions])

  // Look up alternate context when item changes
  useEffect(() => {
    if (!item || !item.alsoAvailableAs) {
      setAlternateContext(null)
      return
    }

    const { type, id } = item.alsoAvailableAs
    console.log('ItemModal: Looking up alternate context', { type, id, fishData, forageData })

    // Look up the alternate context from the appropriate data file
    if (type === 'fish' && fishData?.fish?.items) {
      const fishContext = fishData.fish.items.find(f => f.id === id)
      console.log('ItemModal: Found fish context?', !!fishContext)
      setAlternateContext(fishContext || null)
    } else if (type === 'forage' && forageData?.forage?.items) {
      const forageContext = forageData.forage.items.find(f => f.id === id)
      console.log('ItemModal: Found forage context?', !!forageContext)
      setAlternateContext(forageContext || null)
    } else {
      console.log('ItemModal: No data available yet or wrong type')
      setAlternateContext(null)
    }
  }, [item, fishData, forageData])

  const primaryItem = item || itemRef.current

  // Use the appropriate item based on active tab
  const displayItem = activeTab === 'alternate' && alternateContext ? alternateContext : primaryItem

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

      if (isAnimalProduct) {
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
    if (!displayItem) return null

    // Check if item has location/season data
    const hasLocations = (displayItem.location && displayItem.location.length > 0) ||
                        (displayItem.locations && displayItem.locations.length > 0)
    const hasSeasons = displayItem.seasons && displayItem.seasons.length > 0
    const hasTimes = displayItem.times && displayItem.times.length > 0
    const hasWeather = displayItem.weather
    const hasNotes = displayItem.notes

    if (!hasLocations && !hasSeasons && !hasTimes && !hasWeather) return null

    // Get locations (fish uses 'location', forage uses 'locations')
    const locations = displayItem.location || displayItem.locations || []
    const formattedLocations = displayItem.type === 'forage' ? formatLocationNames(locations) : locations

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
              <SeasonBadges seasons={displayItem.seasons} />
            </ModalGridItem>
          )}

          {hasTimes && (
            <ModalGridItem
              label="Time:"
              value={displayItem.times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')}
            />
          )}

          {hasWeather && (
            <ModalGridItem label="Weather:">
              <span className="value">
                {displayItem.weather === 'rainy' ? '🌧 Rainy' : displayItem.weather === 'sunny' ? '☀️ Sunny' : 'Any'}
              </span>
            </ModalGridItem>
          )}

          {displayItem.isFlower && (
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
              {displayItem.notes.map((note, idx) => (
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
    if (!displayItem || displayItem.type !== 'fish') return null

    // Crab pot fish have different info than rod-caught fish
    if (displayItem.isTrapFish) {
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
            <span className="value difficulty" style={{ color: getDifficultyColor(displayItem.difficulty) }}>
              {displayItem.difficulty}
            </span>
          </ModalGridItem>

          <ModalGridItem
            label="Behavior:"
            value={displayItem.behaviorType ? displayItem.behaviorType.charAt(0).toUpperCase() + displayItem.behaviorType.slice(1) : 'Unknown'}
          />

          {displayItem.minFishingLevel && (
            <ModalGridItem label="Min Fishing Level:">
              <span className="value" style={{ color: '#1976d2', fontWeight: 'bold' }}>
                {displayItem.minFishingLevel}
              </span>
            </ModalGridItem>
          )}

          <ModalGridItem
            label="Size Range:"
            value={`${displayItem.minSize}-${displayItem.maxSize} inches`}
          />
        </ModalGrid>
      </ModalSection>
    )
  }

  // ============================================================================
  // Artisan-Specific Rendering
  // ============================================================================

  const renderArtisanProductionInfo = () => {
    if (!displayItem || displayItem.type !== 'artisan' || !displayItem.producedBy) return null

    const { machine, inputType, valueFormula } = displayItem.producedBy

    const formatInputType = (type) => {
      if (!type) return 'Unknown'
      if (type === 'specific') return 'Specific Item'
      return type.charAt(0).toUpperCase() + type.slice(1)
    }

    return (
      <ModalSection title="Production Info">
        <ModalGrid>
          <ModalGridItem
            label="Machine:"
            value={machine || 'Unknown'}
          />

          <ModalGridItem
            label="Input Type:"
            value={formatInputType(inputType)}
          />

          {displayItem.processingTimeMinutes && (
            <ModalGridItem
              label="Processing Time:"
              value={formatProcessingTime(displayItem.processingTimeMinutes)}
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
    const baseOutputPrice = displayItem.prices?.regular || displayItem.price || 0

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
      const actualCategory = displayItem.originalCategory !== undefined
        ? displayItem.originalCategory
        : displayItem.category

      // Fishing professions (Angler replaces Fisher, doesn't stack)
      if (displayItem.type === 'fish' || actualCategory === -4) {
        if (activeProfessions.angler) return 1.5
        if (activeProfessions.fisher) return 1.25
      }

      // Artisan goods
      if (displayItem.type === 'artisan') {
        const isAnimalProduct = displayItem.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayItem.source)

        if (activeProfessions.artisan && !isAnimalProduct) return 1.4
        if (activeProfessions.rancher && isAnimalProduct) return 1.2
      }

      // Mining professions
      if (displayItem.category === 'Bars' && activeProfessions.blacksmith) return 1.5
      if (displayItem.category === 'Gems' && activeProfessions.gemologist) return 1.3

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
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
          <div className="modal-label">Profit by Input Quality:</div>
          <QualitySelector
            value={inputQuality}
            onChange={setInputQuality}
            name="inputQuality"
          />
        </div>

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
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 60px auto',
                  gap: '0.75rem',
                  padding: '0 0.75rem',
                  backgroundColor: idx % 2 === 0 ? '#fdfbf7' : '#f9f6f0',
                  borderRadius: '4px',
                  alignItems: 'center'
                }}
              >
                {/* Input name with magnifying glass */}
                <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                  <ModalItemButton
                    item={findInputItem(input.inputId)}
                    variant="inline"
                    modalDepth={modalDepth}
                  />
                </div>

                {/* Adjusted input price based on selected quality */}
                <div style={{
                  fontFamily: 'monospace',
                  color: inputQuality === 'regular' ? '#666' :
                         inputQuality === 'silver' ? '#9e9e9e' :
                         inputQuality === 'gold' ? '#f57c00' : '#9c27b0',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}>
                  {formatPrice(adjustedInputPrice)}
                </div>

                {/* Profit percentages by output quality */}
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>●</span>
                    <span style={{ color: getProfitColor(regularProfit) }}>
                      {regularProfit >= 0 ? '+' : ''}{regularProfit}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#9e9e9e' }}>◆</span>
                    <span style={{ color: getProfitColor(silverProfit) }}>
                      {silverProfit >= 0 ? '+' : ''}{silverProfit}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#f57c00' }}>★</span>
                    <span style={{ color: getProfitColor(goldProfit) }}>
                      {goldProfit >= 0 ? '+' : ''}{goldProfit}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#9c27b0' }}>◆</span>
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
    if (!displayItem?.canBeAged) return null

    const { agingDaysToIridium, agingDaysPerTier } = displayItem

    return (
      <ModalSection title="Cask Aging">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#5c4a32' }}>
              This item can be aged in a cask to improve its quality and value.
            </span>
          </div>

          {agingDaysPerTier && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '0.5rem 1rem',
              backgroundColor: '#f9f6f0',
              padding: '0.75rem',
              borderRadius: '4px',
              border: '1px solid #e0d5c0'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#666' }}>●</span>
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Regular → Silver:</strong> {agingDaysPerTier} days
              </span>

              <span style={{ fontSize: '0.75rem', color: '#9e9e9e' }}>◆</span>
              <span style={{ fontSize: '0.875rem' }}>
                <strong>Silver → Gold:</strong> {agingDaysPerTier} days
              </span>

              <span style={{ fontSize: '0.75rem', color: '#f57c00' }}>★</span>
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

  const renderSellingInfo = () => {
    if (!displayItem) return null

    // Skip if item has no price (unsellable items)
    const basePrice = displayItem.prices?.regular || displayItem.price || 0
    if (basePrice === 0) return null

    const sellingLocations = getSellingLocations(displayItem)
    const professionInfo = getProfessionInfo(displayItem)

    // Calculate multiplier based on active professions
    const calculateMultiplier = () => {
      const actualCategory = displayItem.originalCategory !== undefined
        ? displayItem.originalCategory
        : displayItem.category

      // Fishing professions (Angler replaces Fisher, doesn't stack)
      if (displayItem.type === 'fish' || actualCategory === -4) {
        if (activeProfessions.angler) return 1.5
        if (activeProfessions.fisher) return 1.25
      }

      // Artisan goods
      if (displayItem.type === 'artisan') {
        const isAnimalProduct = displayItem.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayItem.source)

        if (activeProfessions.artisan && !isAnimalProduct) return 1.4
        if (activeProfessions.rancher && isAnimalProduct) return 1.2
      }

      // Mining professions
      if (displayItem.category === 'Bars' && activeProfessions.blacksmith) return 1.5
      if (displayItem.category === 'Gems' && activeProfessions.gemologist) return 1.3

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
      const actualCategory = displayItem.originalCategory !== undefined
        ? displayItem.originalCategory
        : displayItem.category

      if (displayItem.type === 'fish' || actualCategory === -4) {
        professions.push(
          { key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
          { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }
        )
        professionKeys.add('fisher')
        professionKeys.add('angler')
      }

      if (displayItem.type === 'artisan') {
        const isAnimalProduct = displayItem.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayItem.source)

        if (isAnimalProduct) {
          professions.push({ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null })
          professionKeys.add('rancher')
        } else {
          professions.push({ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null })
          professionKeys.add('artisan')
        }
      }

      if (displayItem.category === 'Bars') {
        professions.push({ key: 'blacksmith', label: 'Blacksmith', bonus: '+50%', replaces: null })
        professionKeys.add('blacksmith')
      }

      if (displayItem.category === 'Gems') {
        professions.push({ key: 'gemologist', label: 'Gemologist', bonus: '+30%', replaces: null })
        professionKeys.add('gemologist')
      }

      // Get professions for input items (only add if not already present)
      if (displayItem.producedBy?.inputDetails && displayItem.producedBy.inputDetails.length > 0) {
        const inputCategories = new Set(displayItem.producedBy.inputDetails.map(i => i.inputCategory).filter(Boolean))

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
      }

      return professions
    }

    const availableProfessions = getAvailableProfessions()

    return (
      <ModalSection title="Selling Calculator">
        {/* Selling Locations */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span className="modal-label">Sell At:</span>
          <div className="tag-list tag-list-location">
            {sellingLocations.map((loc, i) => (
              <span key={i} className="tag">{loc}</span>
            ))}
          </div>
        </div>

        {/* Price Calculator */}
        {availableProfessions.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f9f6f0',
              border: '2px solid #c4b49a',
              borderRadius: '6px'
            }}>
              {/* Profession Checkboxes */}
              <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                    <span style={{ fontWeight: 500 }}>{prof.label}</span>
                    <span style={{ color: '#1976d2', fontSize: '0.8rem' }}>{prof.bonus}</span>
                    {prof.replaces && (
                      <span style={{ color: '#999', fontSize: '0.75rem', fontStyle: 'italic' }}>
                        (replaces {prof.replaces})
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Trash Can Upgrade Checkboxes */}
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                    <span style={{ fontWeight: 500 }}>{option.label}</span>
                  </label>
                ))}
              </div>

              {/* Calculated Price */}
              <div style={{
                borderTop: '2px solid #c4b49a',
                paddingTop: '0.75rem'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>
                    {trashCanUpgrade !== null ? 'Trash Refund:' : 'Sell Price:'}
                  </span>

                  {/* Show quality tiers if applicable */}
                  {displayItem.isTrapFish ? (
                    // Crab pot fish: only normal and silver
                    <>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#666', marginRight: '0.25rem' }}>●</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem', color: trashCanUpgrade !== null ? '#2e7d32' : 'inherit' }}>
                          {Math.floor(basePrice * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#9e9e9e', marginRight: '0.25rem' }}>◆</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: trashCanUpgrade !== null ? '#2e7d32' : '#9e9e9e', fontSize: '1.1rem' }}>
                          {Math.floor(basePrice * 1.25 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                    </>
                  ) : displayItem.type === 'forage' && displayItem.displayCategory === -81 ? (
                    // Beach forage items: no quality
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem', color: trashCanUpgrade !== null ? '#2e7d32' : (multiplier > 1 ? '#1976d2' : '#666') }}>
                      {Math.floor(basePrice * multiplier * priceMultiplier)}g
                    </span>
                  ) : (
                    // All other items: full quality range
                    <>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#666', marginRight: '0.25rem' }}>●</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem', color: trashCanUpgrade !== null ? '#2e7d32' : 'inherit' }}>
                          {Math.floor(basePrice * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#9e9e9e', marginRight: '0.25rem' }}>◆</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: trashCanUpgrade !== null ? '#2e7d32' : '#9e9e9e', fontSize: '1.1rem' }}>
                          {Math.floor(basePrice * 1.25 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#f57c00', marginRight: '0.25rem' }}>★</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: trashCanUpgrade !== null ? '#2e7d32' : '#f57c00', fontSize: '1.1rem' }}>
                          {Math.floor(basePrice * 1.5 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#9c27b0', marginRight: '0.25rem' }}>◆</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: trashCanUpgrade !== null ? '#2e7d32' : '#9c27b0', fontSize: '1.1rem' }}>
                          {Math.floor(basePrice * 2.0 * multiplier * priceMultiplier)}g
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Show formula breakdown */}
                <div style={{ fontSize: '0.75rem', color: '#999' }}>
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

              {/* Profit Analysis for Artisan Items */}
              {displayItem.type === 'artisan' && displayItem.producedBy?.inputDetails &&
                renderProfitAnalysis(displayItem.producedBy.inputDetails)}
            </div>
          </div>
        )}

        {/* No professions available - just show base price */}
        {availableProfessions.length === 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f9f6f0',
              border: '2px solid #c4b49a',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 600 }}>Sell Price:</span>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#666',
                fontFamily: 'monospace'
              }}>
                {basePrice}g
              </span>
            </div>
          </div>
        )}
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
      { key: 'primary', label: getTabLabel(primaryItem), item: primaryItem },
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
    if (!displayItem?.bundles || displayItem.bundles.length === 0) return null

    // Resolve bundle IDs to full bundle objects
    const bundleDetails = displayItem.bundles
      .map(bundleId => relationalData.getBundle(bundleId))
      .filter(Boolean)

    if (bundleDetails.length === 0) return null

    return (
      <ModalSection title="Bundles">
        <TagList items={bundleDetails} variant="bundle" nameKey="name" />
      </ModalSection>
    )
  }

  const renderContextTags = () => {
    if (!displayItem?.contextTags || displayItem.contextTags.length === 0) return null

    return (
      <ModalSection title="Context Tags">
        <TagList items={displayItem.contextTags} variant="context" />
      </ModalSection>
    )
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!displayItem) return null

  const type = displayItem.type || 'unknown'

  // Use displayCategory for subtitle if available, otherwise use category
  const subtitleCategory = displayItem.displayCategory !== undefined
    ? displayItem.displayCategory
    : displayItem.category
  const categoryName = getCategoryName(subtitleCategory, type)

  // Use originalCategory for game mechanics (selling, professions) if available
  const gameCategory = displayItem.originalCategory !== undefined
    ? displayItem.originalCategory
    : displayItem.category

  // Build subtitle: show type + category if they differ meaningfully
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

  let subtitle = categoryName
  // If our type classification differs from game category, show both
  if (typeDisplayName !== categoryName && categoryName !== 'Item') {
    subtitle = `${typeDisplayName} (${categoryName})`
  }

  // Handle special cases for modal title and header name
  const isLegendaryFish = type === 'fish' && displayItem.contextTags?.includes('fish_legendary')
  const modalTitle = isLegendaryFish ? `⭐${displayItem.name}` : displayItem.name
  const headerName = isLegendaryFish ? `⭐${displayItem.name}` : displayItem.name

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="modal-item-wrapper">
        {/* Context tabs for dual-role items */}
        {renderContextTabs()}

        <div className="modal-item-content">
          <ModalHeader icon={displayItem.icon} name={headerName} subtitle={subtitle}>
        {(displayItem.price || displayItem.prices) && (
          <div className="modal-price">
            <ItemSellPrice
              item={displayItem}
              showProfession={true}
            />
          </div>
        )}
      </ModalHeader>

      {/* Type-Specific Sections */}
      {type === 'fish' && renderFishingInfo()}
      {type === 'artisan' && renderArtisanProductionInfo()}

      {/* Universal Sections (rendered based on data presence) */}
      {renderLocationAvailability()}
      {renderAgingInfo()}
      {renderSellingInfo()}
      {renderBundles()}

      <ModalGiftPreferences
        giftDetails={relationalData.getGiftPreferences(displayItem.id)}
        sectionClass="modal-section"
        giftsClass="modal-gifts"
      />

      {renderContextTags()}
        </div>
      </div>
    </Modal>
  )
}

export default ItemModal

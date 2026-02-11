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
import { useData } from '../../hooks/useData'
import { usePlayer } from '../../contexts/PlayerContext'
import { formatLocationNames } from '../../utils/formatters'
import './ItemModal.css'

/**
 * Unified modal component for displaying item details
 * Dynamically renders sections based on item type and available data
 */
function ItemModal({ item, isOpen, onClose }) {
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

  // Load all page data for alternate context lookup
  const { data: fishData } = useData({ fish: 'data/pages/fish.json' })
  const { data: forageData } = useData({ forage: 'data/pages/forage.json' })

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

  const getSellingLocations = (category) => {
    const categoryToLocation = {
      '-4': ['Willy\'s Fish Shop', 'Shipping Bin'], // Fish
      '-5': ['Shipping Bin'], // Egg
      '-6': ['Shipping Bin'], // Milk
      '-7': ['Saloon (Gus)', 'Shipping Bin'], // Cooking
      '-12': ['Blacksmith (Clint)', 'Shipping Bin'], // Minerals
      '-15': ['Blacksmith (Clint)', 'Shipping Bin'], // Metal Resources
      '-16': ['Carpenter\'s Shop (Robin)', 'Shipping Bin'], // Building Resources
      '-17': ['Pierre\'s General Store', 'Shipping Bin'], // Sell at Pierre's
      '-18': ['Pierre\'s General Store', 'Marnie\'s Ranch', 'Shipping Bin'], // Sell at Pierre's and Marnie's
      '-19': ['Pierre\'s General Store', 'Shipping Bin'], // Fertilizer
      '-20': ['Trash Can', 'Shipping Bin'], // Junk
      '-21': ['Willy\'s Fish Shop', 'Shipping Bin'], // Bait
      '-22': ['Willy\'s Fish Shop', 'Shipping Bin'], // Tackle
      '-23': ['Willy\'s Fish Shop', 'Shipping Bin'], // Sell at Fish Shop
      '-26': ['Shipping Bin'], // Artisan Goods
      '-27': ['Shipping Bin'], // Syrup
      '-28': ['Adventurer\'s Guild (Marlon)', 'Shipping Bin'], // Monster Loot
      '-74': ['Pierre\'s General Store', 'Shipping Bin'], // Seeds
      '-75': ['Shipping Bin'], // Vegetables
      '-79': ['Shipping Bin'], // Fruit
      '-80': ['Shipping Bin'], // Flowers
      '-81': ['Shipping Bin'], // Forage
    }

    return categoryToLocation[String(category)] || ['Shipping Bin']
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

  // Define columns for the input value table
  const inputTableColumns = useMemo(() => [
    {
      accessorKey: 'inputName',
      header: 'Item',
      cell: ({ getValue }) => (
        <span style={{ fontWeight: 600, color: '#2d1b00' }}>{getValue()}</span>
      ),
    },
    {
      accessorKey: 'inputBasePrice',
      header: 'Input G',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', color: '#5c4a32' }}>{formatPrice(getValue())}</span>
      ),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'outputPrice',
      header: 'Output G',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', color: '#f57c00', fontWeight: 600 }}>
          {formatPrice(getValue())}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'outputIridiumPrice',
      header: 'Iridium + Artisan',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', color: '#9c27b0', fontWeight: 600 }}>
          {formatPrice(getValue())}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'profitMargin',
      header: 'Profit',
      accessorFn: (row) => {
        return row.outputPrice > 0
          ? Math.round((row.outputPrice - row.inputBasePrice) / row.inputBasePrice * 100)
          : 0
      },
      cell: ({ getValue }) => {
        const margin = getValue()
        const color = margin >= 200 ? '#388e3c' : margin >= 100 ? '#f57c00' : '#616161'
        return (
          <span style={{ color, fontWeight: 600 }}>+{margin}%</span>
        )
      },
      meta: { align: 'center' },
    },
  ], [])

  const renderArtisanInputValueTable = () => {
    if (!displayItem || displayItem.type !== 'artisan') return null
    if (!displayItem.producedBy?.inputDetails || displayItem.producedBy.inputDetails.length === 0) return null

    return (
      <ModalSection title="Input Value Table">
        <DataTable
          data={displayItem.producedBy.inputDetails}
          columns={inputTableColumns}
          initialSortBy={[{ id: 'profitMargin', desc: true }]}
          itemsPerPage={10}
        />
        <ModalNote>
          <strong>Note:</strong> Iridium + Artisan column shows maximum value with iridium-quality input and the Artisan profession (+40%).
        </ModalNote>
      </ModalSection>
    )
  }

  // ============================================================================
  // Universal Sections
  // ============================================================================

  const renderSellingInfo = () => {
    if (!displayItem || !displayItem.price) return null

    // Use game category for selling mechanics, not display category
    const categoryForSelling = displayItem.originalCategory !== undefined
      ? displayItem.originalCategory
      : displayItem.category

    const sellingLocations = getSellingLocations(categoryForSelling)
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
    const basePrice = displayItem.prices?.regular || displayItem.price || 0
    const calculatedPrice = Math.floor(basePrice * multiplier)

    // Get available professions for this item
    const getAvailableProfessions = () => {
      const actualCategory = displayItem.originalCategory !== undefined
        ? displayItem.originalCategory
        : displayItem.category

      if (displayItem.type === 'fish' || actualCategory === -4) {
        return [
          { key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
          { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }
        ]
      }

      if (displayItem.type === 'artisan') {
        const isAnimalProduct = displayItem.source &&
          ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(displayItem.source)

        if (isAnimalProduct) {
          return [{ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null }]
        } else {
          return [{ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null }]
        }
      }

      if (displayItem.category === 'Bars') {
        return [{ key: 'blacksmith', label: 'Blacksmith', bonus: '+50%', replaces: null }]
      }

      if (displayItem.category === 'Gems') {
        return [{ key: 'gemologist', label: 'Gemologist', bonus: '+30%', replaces: null }]
      }

      return []
    }

    const availableProfessions = getAvailableProfessions()

    return (
      <ModalSection title="Selling Calculator">
        {/* Selling Locations */}
        <div className="modal-label-with-tags">
          <span className="label">Sell at:</span>
          <TagList items={sellingLocations} variant="location" />
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
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Professions:
                </div>
                {availableProfessions.map(prof => (
                  <label
                    key={prof.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
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
                      style={{ cursor: 'pointer' }}
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

              {/* Calculated Price */}
              <div style={{
                borderTop: '2px solid #c4b49a',
                paddingTop: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 600 }}>Sell Price:</span>
                <span style={{
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: multiplier > 1 ? '#1976d2' : '#666',
                  fontFamily: 'monospace'
                }}>
                  {calculatedPrice}g
                  {multiplier > 1 && (
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#999' }}>
                      ({basePrice}g × {multiplier})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {professionInfo?.description && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                💡 {professionInfo.description}
              </div>
            )}
          </div>
        )}

        {/* No professions available - just show base price */}
        {availableProfessions.length === 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div className="modal-label-with-tags">
              <span className="label">Base Price:</span>
              <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{basePrice}g</span>
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
    if (!displayItem?.bundleDetails || displayItem.bundleDetails.length === 0) return null

    return (
      <ModalSection title="Bundles">
        <TagList items={displayItem.bundleDetails} variant="bundle" nameKey="name" />
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
      {type === 'artisan' && renderArtisanInputValueTable()}
      {renderSellingInfo()}
      {renderBundles()}

      <ModalGiftPreferences
        giftDetails={displayItem.giftDetails}
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

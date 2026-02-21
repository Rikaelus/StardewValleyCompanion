import { useState } from 'react'
import { Tooltip } from 'react-tooltip'
import ItemButton from './ItemButton'
import UniversalModal from './UniversalModal'
import VillagerModal from '../villagers/VillagerModal'
import 'react-tooltip/dist/react-tooltip.css'

/**
 * Item button that automatically opens the appropriate modal based on item type
 * Wraps ItemButton with modal-opening logic
 *
 * Variants:
 * - default: Standard item button with icon
 * - inline: Compact text link with magnifying glass icon for use in tight spaces
 * - bundle-item: Large icon with quality star and quantity overlays (like in-game)
 */
function ModalItemButton({
  item,
  showIcon = true,
  showLabel = false,
  iconSize = 32,
  className = '',
  stopPropagation = false,
  variant = 'default', // 'default' | 'inline' | 'bundle-item'
  onNavigate = null, // Navigation callback from parent modal (breadcrumb navigation)
  quality = 0, // Quality level: 0=normal, 1=silver, 2=gold, 4=iridium (bundle-item variant only)
  quantity = 1, // Stack quantity (bundle-item variant only)
  showSlotBackground = false // Show bundle slot background (bundle-item variant only)
}) {
  const [selectedItem, setSelectedItem] = useState(null)
  const [imageError, setImageError] = useState(false)

  if (!item) return null

  // Use the type field from the item (set during data processing)
  const type = item.type || 'unknown'

  const handleItemClick = (clickedItem) => {
    setSelectedItem(clickedItem)
  }

  const handleClose = () => {
    setSelectedItem(null)
  }

  const handleClick = (e) => {
    if (stopPropagation) {
      e.stopPropagation()
    }

    // If parent provides navigation callback, use it instead of opening a new modal
    if (onNavigate) {
      onNavigate(item)
      return
    }

    handleItemClick(item)
  }

  // Helper to get quality star color
  const getQualityStarColor = (quality) => {
    switch (quality) {
      case 1: return '#c0c0c0' // Silver
      case 2: return '#ffd700' // Gold
      case 4: return '#b19cd9' // Iridium (purple)
      default: return null
    }
  }

  // Whether to render own modal (only when not using parent navigation)
  const shouldRenderModal = !onNavigate

  // Render bundle-item variant (icon with quality/quantity overlays)
  if (variant === 'bundle-item') {
    const starColor = getQualityStarColor(quality)
    const tooltipId = `bundle-item-${item.id}`

    // Build tooltip content with quality and quantity info
    const qualityLabel = quality === 1 ? ' (Silver)' : quality === 2 ? ' (Gold)' : quality === 4 ? ' (Iridium)' : ''
    const quantityLabel = quantity > 1 ? ` x${quantity}` : ''
    const tooltipContent = `${item.name}${qualityLabel}${quantityLabel}`

    return (
      <>
        <button
          onClick={handleClick}
          className={`bundle-item-button ${showSlotBackground ? 'bundle-item-with-slot' : ''} ${item.type === 'big-craftable' ? 'big-craftable' : ''}`}
          aria-label={`View ${item.name} details`}
          type="button"
          data-tooltip-id={tooltipId}
          data-tooltip-content={tooltipContent}
        >
          {/* Item icon */}
          {imageError || !item.icon ? (
            <span className="bundle-item-icon-fallback">
              {item.name?.slice(0, 2).toUpperCase() || '??'}
            </span>
          ) : (
            <img
              src={item.icon}
              alt={item.name || 'Item'}
              className="bundle-item-icon"
              onError={() => setImageError(true)}
            />
          )}

          {/* Quality star overlay (bottom-left) */}
          {starColor && (
            <span
              className="bundle-item-quality-star"
              style={{ color: starColor }}
            >
              ★
            </span>
          )}

          {/* Quantity overlay (bottom-right) */}
          {quantity > 1 && (
            <span className="bundle-item-quantity">
              {quantity}
            </span>
          )}
        </button>

        {/* Floating tooltip */}
        <Tooltip id={tooltipId} float={true} style={{ zIndex: 9999 }} />

        {/* Render appropriate modal (only when not using parent navigation) */}
        {shouldRenderModal && (
          type === 'villager' ? (
            <VillagerModal
              villager={selectedItem}
              isOpen={selectedItem !== null}
              onClose={handleClose}
            />
          ) : (
            <UniversalModal
              entity={selectedItem}
              isOpen={selectedItem !== null}
              onClose={handleClose}
            />
          )
        )}
      </>
    )
  }

  // Render inline variant (text link with magnifying glass)
  if (variant === 'inline') {
    return (
      <>
        <button
          onClick={handleClick}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontWeight: 600,
            color: '#2d1b00',
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#8b7355'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#2d1b00'}
          aria-label={`View ${item.name} details`}
          type="button"
        >
          <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>🔍</span>
          {item.name}
        </button>

        {/* Render appropriate modal (only when not using parent navigation) */}
        {shouldRenderModal && (
          type === 'villager' ? (
            <VillagerModal
              villager={selectedItem}
              isOpen={selectedItem !== null}
              onClose={handleClose}
            />
          ) : (
            <UniversalModal
              entity={selectedItem}
              isOpen={selectedItem !== null}
              onClose={handleClose}
            />
          )
        )}
      </>
    )
  }

  // Render default variant (standard item button)
  return (
    <>
      <ItemButton
        item={item}
        onItemClick={handleItemClick}
        showIcon={showIcon}
        showLabel={showLabel}
        iconSize={iconSize}
        className={className}
        stopPropagation={stopPropagation}
      />

      {/* Render appropriate modal (only when not using parent navigation) */}
      {shouldRenderModal && (
        type === 'villager' ? (
          <VillagerModal
            villager={selectedItem}
            isOpen={selectedItem !== null}
            onClose={handleClose}
          />
        ) : (
          <UniversalModal
            entity={selectedItem}
            isOpen={selectedItem !== null}
            onClose={handleClose}
          />
        )
      )}
    </>
  )
}

export default ModalItemButton

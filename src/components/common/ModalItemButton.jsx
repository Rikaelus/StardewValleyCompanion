import { useState } from 'react'
import { Tooltip } from 'react-tooltip'
import ItemButton from './ItemButton'
import { useOpenModal } from '../../contexts/ModalContext'
import { pluralize } from '../../utils/Pluralize'
import 'react-tooltip/dist/react-tooltip.css'
// TODO: rename ModalItemButton → ModalEntityButton and item prop → entity (high churn, cosmetic)

/**
 * Item button that opens the global UniversalModal when clicked.
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
  onNavigate = null, // Optional override (e.g. for breadcrumb navigation within modal)
  plural = false, // Display the item name in plural form (inline variant only)
  label = null, // Override the displayed name (inline variant only)
  quality = 0, // Quality level: 0=normal, 1=silver, 2=gold, 4=iridium (bundle-item variant only)
  quantity = 1, // Stack quantity (bundle-item variant only)
  showSlotBackground = false // Show bundle slot background (bundle-item variant only)
}) {
  const openModal = useOpenModal()
  const [imageError, setImageError] = useState(false)

  if (!item) return null

  const handleClick = (e) => {
    if (stopPropagation) e.stopPropagation()
    if (onNavigate) {
      onNavigate(item)
    } else {
      openModal(item)
    }
  }

  // Helper to get quality star color
  const getQualityStarColor = (q) => {
    switch (q) {
      case 1: return '#c0c0c0'
      case 2: return '#ffd700'
      case 4: return '#b19cd9'
      default: return null
    }
  }

  // Render bundle-item variant (icon with quality/quantity overlays)
  if (variant === 'bundle-item') {
    const starColor = getQualityStarColor(quality)
    const tooltipId = `bundle-item-${item.id}`
    return (
      <>
        <button
          className={`bundle-item-button ${showSlotBackground ? 'bundle-item-slot' : ''}`}
          onClick={handleClick}
          data-tooltip-id={tooltipId}
          data-tooltip-content={item.name}
          type="button"
        >
          {item.icon && !imageError ? (
            <img
              src={item.icon.startsWith('/') ? item.icon : `/${item.icon}`}
              alt={item.name}
              className="bundle-item-icon"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="bundle-item-fallback">{item.name?.slice(0, 2).toUpperCase() || '??'}</span>
          )}

          {/* Quality star overlay (top-right) */}
          {quality > 0 && starColor && (
            <span className="bundle-item-quality" style={{ color: starColor }}>★</span>
          )}

          {/* Quantity overlay (bottom-right) */}
          {quantity > 1 && (
            <span className="bundle-item-quantity">{quantity}</span>
          )}
        </button>

        <Tooltip id={tooltipId} float={true} style={{ zIndex: 9999 }} />
      </>
    )
  }

  // Render inline variant (small icon + text link)
  if (variant === 'inline' || variant === 'icon-inline') {
    const iconSrc = item.icon ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`) : null
    return (
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
        {iconSrc && !imageError
          ? <img src={iconSrc} alt="" width={16} height={16} onError={() => setImageError(true)} style={{ imageRendering: 'pixelated', flexShrink: 0 }} />
          : <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>🔍</span>
        }
        <span style={{ position: 'relative', top: '2px' }}>
          {label ?? (plural ? pluralize(item.name) : item.name)}
          {item.contextTags?.includes('fish_legendary') && <span title="Legendary Fish"> ⭐</span>}
        </span>
      </button>
    )
  }

  // Render default variant (standard item button)
  // ItemButton handles stopPropagation itself; pass a clean handler here
  const handleItemClick = () => {
    if (onNavigate) {
      onNavigate(item)
    } else {
      openModal(item)
    }
  }

  return (
    <ItemButton
      item={item}
      onItemClick={handleItemClick}
      showIcon={showIcon}
      showLabel={showLabel}
      iconSize={iconSize}
      className={className}
      stopPropagation={stopPropagation}
    />
  )
}

export default ModalItemButton

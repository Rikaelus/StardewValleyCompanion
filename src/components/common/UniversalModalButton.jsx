import { useState } from 'react'
import { Tooltip } from 'react-tooltip'
import ItemButton from './ItemButton'
import { useOpenModal } from '../../contexts/ModalContext'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { pluralize } from '../../utils/Pluralize'
import 'react-tooltip/dist/react-tooltip.css'
// TODO: rename UniversalModalButton → UniversalModalButton and item prop → entity (high churn, cosmetic)

/**
 * Item button that opens the global UniversalModal when clicked.
 *
 * Variants:
 * - default: Standard item button with icon
 * - inline: Compact text link with magnifying glass icon for use in tight spaces
 * - bundle-item: Large icon with quality star and quantity overlays (like in-game)
 */
function UniversalModalButton({
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
  const entities = useEntities()
  const { getEntityCompletion, getBundleProgress, hasSaveData, isOwned, isMuseumDonated, isJojaRoute, isMissingBundleAvailable } = useProgress()
  const completion = getEntityCompletion(item)
  const owned = hasSaveData && !!item?.gameId && isOwned(item.gameId)

  const needed = hasSaveData && !!item?.gameId && (() => {
    if (item?.capabilities?.donatable && !isMuseumDonated(item.gameId)) return true
    if (item?.capabilities?.bundleSlot && item?.bundles?.length && !isJojaRoute) {
      return item.bundles.some(bundleId => {
        const bundle = entities.findById(bundleId)
        if (!bundle) return false
        if (bundleId === 'bundle-the-missing' && !isMissingBundleAvailable) return false
        const itemCount = bundle.goldCost ? 1 : (bundle.items?.length ?? 0)
        const progress = getBundleProgress(bundle.bundleNumber, itemCount)
        return !progress?.complete
      })
    }
    return false
  })()
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
          className={`bundle-item-button ${showSlotBackground ? 'bundle-item-with-slot' : ''}`}
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
            <span className="bundle-item-icon-fallback">{item.name?.slice(0, 2).toUpperCase() || '??'}</span>
          )}

          {/* Quality star overlay (top-right) */}
          {quality > 0 && starColor && (
            <span className="bundle-item-quality-star" style={{ color: starColor }}>★</span>
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

  // Render inline variants
  if (variant === 'inline' || variant === 'icon-inline' || variant === 'table-inline') {
    const isTableInline = variant === 'table-inline'
    const inlineIconSize = isTableInline ? 16 : (iconSize !== 32 ? iconSize : 16)
    const iconSrc = item.icon ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`) : null
    const isComplete = completion?.completed
    const inlineLabelClass = owned && needed ? 'inline-owned-needed'
      : owned ? 'inline-owned'
      : needed ? 'inline-needed'
      : ''
    return (
      <button
        onClick={handleClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontWeight: isTableInline ? 'normal' : 600,
          color: '#2d1b00',
          fontSize: isTableInline ? 'inherit' : '0.875rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          textAlign: 'left',
          transition: 'color 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#8b7355'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#2d1b00'}
        aria-label={`View ${item.name} details`}
        type="button"
      >
        {showIcon && (
          iconSrc && !imageError
            ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: inlineIconSize, height: inlineIconSize, flexShrink: 0 }}>
                <img src={iconSrc} alt="" onError={() => setImageError(true)} style={{ maxWidth: inlineIconSize, maxHeight: inlineIconSize, width: 'auto', height: 'auto', imageRendering: 'pixelated' }} />
              </span>
            : (item.iconChar || item.iconClass)
              ? <span className="inline-icon-badge" style={{ backgroundColor: item.iconColor || '#7f8c8d' }}>
                  {item.iconClass ? <i className={item.iconClass} /> : item.iconChar}
                </span>
              : isTableInline ? null : <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>🔍</span>
        )}
        <span style={{ position: 'relative' }} className={inlineLabelClass}>
          {label ?? (plural ? pluralize(item.name) : item.name)}
          {isComplete && <span title={completion.label}> ✓</span>}
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
      owned={owned}
      needed={needed}
    />
  )
}

export default UniversalModalButton

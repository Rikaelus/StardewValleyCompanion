import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Tooltip } from 'react-tooltip'
import ItemButton from './ItemButton'
import { useOpenModal } from '../../contexts/ModalContext'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { computeCollectionProgress } from '../../utils/GoalEngine'
import { pluralize } from '../../utils/Pluralize'
import { getEntityLabels } from '../../utils/Formatters'
import 'react-tooltip/dist/react-tooltip.css'
import './UniversalModalButton.css'
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
  variant = 'default', // 'default' | 'inline' | 'bundle-item' | 'row' | 'collection-tile'
  onNavigate = null, // Optional override (e.g. for breadcrumb navigation within modal)
  plural = false, // Display the item name in plural form (inline variant only)
  label = null, // Override the displayed name (inline variant only)
  quality = 0, // Quality level: 0=normal, 1=silver, 2=gold, 4=iridium (bundle-item variant only)
  quantity = 1, // Stack quantity (bundle-item and inline variants)
  hearts = 0, // Friendship hearts to display after the label (inline variants)
  showSlotBackground = false, // Show bundle slot background (bundle-item variant only)
  noDoubleFrame = false, // Opt out of inner state-color frame (bundle-item variant only)
  highlighted = false, // row variant: highlight state (mirrors :hover)
  onMouseEnter = null, // row variant: hover callback
  donated = null, // collection-tile variant: true | false | null (no save data)
  frameColor = 'tan', // collection-tile variant: 'tan' | 'gold' | 'teal' | 'green'
  tileSize = 'sm', // collection-tile variant: 'sm' (48px) | 'lg' (72px)
  cardState = null, // card variant: 'earned' | 'needed' | null (neutral)
  cardDesc = null, // card variant: second-row description text
  cardMeta = null, // card variant: third-row contextual text (counts, progress, etc.)
  quantityType = null, // card variant: label appended to owned count — e.g. 'needed', 'shipped', 'caught'
  gutter = false, // card variant: true = reserve gutter space; string = link path shown as →
  goalEarned = null, // goal inline coloring: true | false | null (no save data / not a goal)
}) {
  const openModal = useOpenModal()
  const entities = useEntities()
  const progress = useProgress()
  const { hasSaveData, isOwned, getOwnedCount, isNeeded, getBundleProgress, hasAchievement } = progress
  const ownedCount = hasSaveData && !!item?.gameId ? getOwnedCount(item.gameId, item) : 0
  const owned = ownedCount > 0
  const partiallyOwned = owned && quantity > 1 && ownedCount < quantity
  const needed = isNeeded(item, entities.findById)
  const [imageError, setImageError] = useState(false)

  // For bundle/achievement entities used as inline links, override label coloring
  // to reflect the collection's own completion state rather than inventory ownership.
  function getCollectionLabelClass() {
    if (!hasSaveData) return ''
    if (item?.type === 'bundle') {
      const itemCount = item.goldCost ? 1 : (item.items?.length ?? 0)
      const progress = getBundleProgress(item.bundleNumber, itemCount)
      return progress?.complete ? 'inline-owned' : 'inline-needed'
    }
    if (item?.type === 'achievement') {
      return hasAchievement(item.achievementId) ? 'inline-owned' : 'inline-needed'
    }
    if (item?.type === 'goal' && goalEarned !== null) {
      return goalEarned ? 'inline-owned' : 'inline-needed'
    }
    if (item?.type === 'collection') {
      const colProgress = computeCollectionProgress(item, entities.items, progress)
      if (colProgress) return colProgress.percent >= 100 ? 'inline-owned' : 'inline-needed'
    }
    return ''
  }

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

  // Render collection-tile variant (Museum, Field Office)
  if (variant === 'collection-tile') {
    const iconSrc = item.icon ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`) : null
    const stateClass = donated === null ? 'ctile--neutral' : donated ? 'ctile--donated' : 'ctile--missing'
    const tooltipId = `ctile-${item.id}`
    const tooltipContent = donated === null ? item.name : `${item.name} — ${donated ? 'Donated' : 'Not donated'}`
    return (
      <>
        <button
          type="button"
          className={`ctile ctile--${tileSize} ctile--${frameColor} ${stateClass}`}
          onClick={handleClick}
          data-tooltip-id={tooltipId}
          data-tooltip-content={tooltipContent}
        >
          {iconSrc && !imageError ? (
            <img
              src={iconSrc}
              alt=""
              className={`ctile-icon${(!donated && donated !== null) ? ' ctile-icon--missing' : ''}`}
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="ctile-fallback">{item.name?.slice(0, 2).toUpperCase()}</span>
          )}
        </button>
        <Tooltip id={tooltipId} float style={{ zIndex: 9999 }} />
      </>
    )
  }

  // Render card variant (icon left, text column right: name / desc / meta)
  if (variant === 'card') {
    const iconSrc = item.icon ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`) : null
    const stateClass = cardState ? `item-card-wrap--${cardState}` : ''
    const hasGutter = gutter === true || typeof gutter === 'string'
    const resolvedMeta = cardMeta
      ?? (quantityType && hasSaveData && ownedCount > 0 ? `×${ownedCount} ${quantityType}` : null)
      ?? ' '
    return (
      <div className={`item-card-wrap ${stateClass} ${hasGutter ? 'item-card-wrap--gutter' : ''} ${className}`.trim()}>
        <button
          type="button"
          className="item-card"
          onClick={handleClick}
        >
          <span className="item-card-icon">
            {iconSrc && !imageError
              ? <img src={iconSrc} alt="" onError={() => setImageError(true)} />
              : (item.iconChar || item.iconClass)
                ? <span className="item-card-fallback">
                    {item.iconClass ? <i className={item.iconClass} /> : item.iconChar}
                  </span>
                : <span className="item-card-fallback">{item.name?.slice(0, 2).toUpperCase() || '??'}</span>
            }
          </span>
          <span className="item-card-body">
            <span className="item-card-label">{label ?? item.name}</span>
            {cardDesc && <span className="item-card-desc">{cardDesc}</span>}
            <span className="item-card-meta">{resolvedMeta}</span>
          </span>
        </button>
        {hasGutter && (
          typeof gutter === 'string'
            ? <Link to={gutter} className="item-card-gutter item-card-gutter--link" onClick={e => e.stopPropagation()}>→</Link>
            : <span className="item-card-gutter" />
        )}
      </div>
    )
  }

  // Render bundle-item variant (icon with quality/quantity overlays)
  if (variant === 'bundle-item') {
    const starColor = getQualityStarColor(quality)
    const tooltipId = `bundle-item-${item.id}`
    const stateClass = !noDoubleFrame
      ? (owned && needed ? 'bundle-item--owned bundle-item--needed'
        : partiallyOwned ? 'bundle-item--partial'
        : owned ? 'bundle-item--owned'
        : needed ? 'bundle-item--needed'
        : '')
      : ''
    return (
      <>
        <button
          className={`bundle-item-button ${showSlotBackground ? 'bundle-item-with-slot' : ''} ${stateClass}`}
          onClick={handleClick}
          data-tooltip-id={tooltipId}
          data-tooltip-content={item.name}
          type="button"
        >
          <span className={`bundle-item-icon-frame ${stateClass}`}>
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
          </span>

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

  // Render row variant (search result row: icon + name + category badges, full-width clickable)
  if (variant === 'row') {
    const iconSrc = item.icon ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`) : null
    const { type: typeLabel, subtype: subtypeLabel } = getEntityLabels(item)
    const nameLabelClass = getCollectionLabelClass()
      || (owned && needed ? 'inline-owned-needed'
      : partiallyOwned ? 'inline-partial'
      : owned ? 'inline-owned'
      : needed ? 'inline-needed'
      : '')
    return (
      <li
        className={`search-result-row${highlighted ? ' highlighted' : ''}`}
        role="option"
        aria-selected={highlighted}
        onMouseEnter={onMouseEnter}
        onClick={() => handleClick({})}
      >
        <div className="search-result-icon">
          {iconSrc
            ? <img src={iconSrc} alt="" width={24} height={24} style={{ objectFit: 'contain', imageRendering: 'pixelated', display: 'block' }} onError={() => setImageError(true)} />
            : (item.iconChar || item.iconClass)
              ? <span className="search-result-icon-char" style={{ backgroundColor: item.iconColor || '#7f8c8d' }}>
                  {item.iconClass ? <i className={item.iconClass} /> : item.iconChar}
                </span>
              : <span className="search-result-icon-placeholder" />
          }
        </div>
        <span className={`search-result-name ${nameLabelClass}`}>{item.name}</span>
        <span className="search-result-badges">
          {typeLabel && <span className="search-result-category">{typeLabel}</span>}
          {subtypeLabel && <span className="search-result-type">{subtypeLabel}</span>}
        </span>
      </li>
    )
  }

  // Render inline variants
  if (variant === 'inline' || variant === 'icon-inline' || variant === 'table-inline') {
    const isTableInline = variant === 'table-inline'
    const inlineIconSize = isTableInline ? 16 : (iconSize !== 32 ? iconSize : 16)
    const iconSrc = item.icon ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`) : null
    const inlineLabelClass = getCollectionLabelClass()
      || (owned && needed ? 'inline-owned-needed'
      : partiallyOwned ? 'inline-partial'
      : owned ? 'inline-owned'
      : needed ? 'inline-needed'
      : '')
    return (
      <button
        onClick={handleClick}
        className={`inline-button${isTableInline ? ' inline-button--table' : ''}`}
        aria-label={`View ${item.name} details`}
        type="button"
      >
        {showIcon && (
          iconSrc && !imageError
            ? <span className="inline-button-icon-wrap" style={{ width: inlineIconSize, height: inlineIconSize }}>
                <img src={iconSrc} alt="" onError={() => setImageError(true)} />
              </span>
            : (item.iconChar || item.iconClass)
              ? <span className="inline-icon-badge" style={{ backgroundColor: item.iconColor || '#7f8c8d' }}>
                  {item.iconClass ? <i className={item.iconClass} /> : item.iconChar}
                </span>
              : isTableInline ? null : <span className="inline-button-fallback-icon">🔍</span>
        )}
        <span className={`inline-button-label${inlineLabelClass ? ` ${inlineLabelClass}` : ''}`}>
          {label ?? (plural ? pluralize(item.name) : item.name)}
          {quantity != null && quantity !== 1 && <span className="inline-quantity"> ×{quantity}</span>}
          {hearts > 0 && <span className="inline-hearts"> ♥×{hearts}</span>}
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
      partiallyOwned={partiallyOwned}
      needed={needed}
    />
  )
}

export default UniversalModalButton

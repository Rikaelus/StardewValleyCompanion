import { useState } from 'react'
import './ItemButton.css'

/**
 * Generic button component for displaying items (fish, crops, villagers, etc.)
 * Can show icon, text label, or both depending on display settings
 * Handles click events and can open modals or trigger other actions
 */
function ItemButton({
  item,
  onItemClick,
  showIcon = true,
  showLabel = false,
  iconSize = 32,
  className = '',
  stopPropagation = false,
  owned = false,
  needed = false
}) {
  const [imageError, setImageError] = useState(false)

  if (!item) return null

  const handleClick = (e) => {
    if (stopPropagation) {
      e.stopPropagation()
    }
    if (onItemClick) {
      onItemClick(item)
    }
  }

  const renderIcon = () => {
    if (!showIcon) return null

    const fallbackText = item.name?.slice(0, 2).toUpperCase() || '??'

    if (imageError || !item.icon) {
      if (item.iconChar || item.iconClass) {
        return (
          <span
            className="item-button-icon-char"
            style={{ width: iconSize, height: iconSize, backgroundColor: item.iconColor || '#7f8c8d' }}
          >
            {item.iconClass ? <i className={item.iconClass} /> : item.iconChar}
          </span>
        )
      }
      return (
        <span
          className="item-button-icon-fallback"
          style={{ width: iconSize, height: iconSize }}
        >
          {fallbackText}
        </span>
      )
    }

    return (
      <img
        src={item.icon.startsWith('/') ? item.icon : `/${item.icon}`}
        alt={item.name || 'Item'}
        className="item-button-icon"
        style={{ maxWidth: iconSize, maxHeight: iconSize, width: 'auto', height: 'auto' }}
        onError={() => setImageError(true)}
      />
    )
  }

  const renderLabel = () => {
    if (!showLabel) return null
    return <span className="item-button-label">{item.name}</span>
  }

  const ownedClass = owned ? 'item-button--owned' : ''
  const neededClass = needed ? 'item-button--needed' : ''

  // If showing both icon and label, render as a single unified button
  // The border box wraps only the icon; the label sits outside it.
  if (showIcon && showLabel) {
    return (
      <button
        className={`item-button item-button--with-label ${ownedClass} ${neededClass} ${className}`}
        onClick={handleClick}
        title={item.name}
        type="button"
      >
        <span className={`item-button-icon-box ${ownedClass} ${neededClass}`} style={{ minWidth: iconSize, minHeight: iconSize }}>{renderIcon()}</span>
        {renderLabel()}
      </button>
    )
  }

  return (
    <button
      className={`item-button ${className}`}
      onClick={handleClick}
      title={item.name}
      type="button"
    >
      <span className={`item-button-icon-box item-button-icon-box--state ${ownedClass} ${neededClass}`}>{renderIcon()}</span>
      {renderLabel()}
    </button>
  )
}

export default ItemButton

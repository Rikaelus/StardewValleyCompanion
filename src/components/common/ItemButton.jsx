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
  stopPropagation = false
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
        width={iconSize}
        height={iconSize}
        className="item-button-icon"
        onError={() => setImageError(true)}
      />
    )
  }

  const renderLabel = () => {
    if (!showLabel) return null
    return <span className="item-button-label">{item.name}</span>
  }

  // If showing both icon and label, render as a single unified button
  // The border box wraps only the icon; the label sits outside it.
  if (showIcon && showLabel) {
    return (
      <button
        className={`item-button item-button--with-label ${className}`}
        onClick={handleClick}
        title={item.name}
        type="button"
      >
        <span className="item-button-icon-box">{renderIcon()}</span>
        {renderLabel()}
      </button>
    )
  }

  // Otherwise, render button as before (icon or label only)
  return (
    <button
      className={`item-button ${className}`}
      onClick={handleClick}
      title={item.name}
      type="button"
    >
      {renderIcon()}
      {renderLabel()}
    </button>
  )
}

export default ItemButton

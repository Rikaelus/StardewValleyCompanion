import { useState } from 'react'
import './CollectionTile.css'

/**
 * Reusable tile for collection tracker pages.
 *
 * States:
 *   'complete'  — full color, green border
 *   'partial'   — full color, no special border (known but not cooked/crafted/etc.)
 *   'missing'   — greyed out
 *
 * Overlays:
 *   count       — number shown bottom-right (e.g. times caught, shipped)
 *   badge       — small icon bottom-left for secondary state ('check' | 'star' | null)
 */
function CollectionTile({ item, state = 'missing', count = null, badge = null, onClick, title }) {
  const [imageError, setImageError] = useState(false)
  const iconSrc = item?.icon
    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
    : null

  return (
    <button
      type="button"
      className={`collection-tile collection-tile--${state}`}
      onClick={() => onClick?.(item)}
      title={title ?? item?.name}
    >
      {iconSrc && !imageError ? (
        <img
          src={iconSrc}
          alt=""
          className="collection-tile-icon"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="collection-tile-fallback">
          {item?.name?.slice(0, 2).toUpperCase() ?? '??'}
        </span>
      )}

      {badge && (
        <span className={`collection-tile-badge collection-tile-badge--${badge}`}>
          {badge === 'check' ? '✓' : '★'}
        </span>
      )}

      {count != null && (
        <span className="collection-tile-count">{count}</span>
      )}
    </button>
  )
}

export default CollectionTile

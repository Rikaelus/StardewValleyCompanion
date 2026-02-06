import './TagList.css'

/**
 * Reusable tag list component for displaying items, locations, bundles, etc.
 *
 * Usage:
 *   <TagList items={fish.location} variant="location" />
 *   <TagList items={fish.bundleDetails} variant="bundle" nameKey="name" />
 *   <TagList items={fish.contextTags} variant="context" />
 *
 * Variants:
 *   - location: For location tags (green)
 *   - bundle: For bundle tags (orange)
 *   - context: For context tags (gray)
 *   - season: For season tags (colorful)
 *   - default: Generic tags
 */
function TagList({
  items,
  variant = 'default',
  nameKey = null,
  className = '',
  emptyText = 'None'
}) {
  if (!items || items.length === 0) {
    return <span className="tag-list-empty">{emptyText}</span>
  }

  return (
    <div className={`tag-list tag-list-${variant} ${className}`}>
      {items.map((item, i) => {
        // If item is an object and nameKey is provided, use that property
        const displayText = nameKey && typeof item === 'object' ? item[nameKey] : item
        const key = typeof item === 'object' ? (item.id || i) : i

        return (
          <span key={key} className="tag">
            {displayText}
          </span>
        )
      })}
    </div>
  )
}

export default TagList

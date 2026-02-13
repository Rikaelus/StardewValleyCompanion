import { useState } from 'react'
import ItemButton from './ItemButton'
import ItemModal from './ItemModal'
import VillagerModal from '../villagers/VillagerModal'

/**
 * Item button that automatically opens the appropriate modal based on item type
 * Wraps ItemButton with modal-opening logic
 *
 * Variants:
 * - default: Standard item button with icon
 * - inline: Compact text link with magnifying glass icon for use in tight spaces
 */
function ModalItemButton({
  item,
  showIcon = true,
  showLabel = false,
  iconSize = 32,
  className = '',
  stopPropagation = false,
  variant = 'default', // 'default' | 'inline'
  modalDepth = 0 // Track how many modals deep we are
}) {
  const [selectedItem, setSelectedItem] = useState(null)

  // Maximum modal depth to prevent browser crashes
  const MAX_MODAL_DEPTH = 3

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

    // Prevent opening more modals if we've hit the depth limit
    if (modalDepth >= MAX_MODAL_DEPTH) {
      console.warn(`Maximum modal depth (${MAX_MODAL_DEPTH}) reached. Cannot open more nested modals.`)
      return
    }

    handleItemClick(item)
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

        {/* Render appropriate modal based on type */}
        {type === 'villager' ? (
          <VillagerModal
            villager={selectedItem}
            isOpen={selectedItem !== null}
            onClose={handleClose}
            modalDepth={modalDepth + 1}
          />
        ) : (
          <ItemModal
            item={selectedItem}
            isOpen={selectedItem !== null}
            onClose={handleClose}
            modalDepth={modalDepth + 1}
          />
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

      {/* Render appropriate modal based on type */}
      {type === 'villager' ? (
        <VillagerModal
          villager={selectedItem}
          isOpen={selectedItem !== null}
          onClose={handleClose}
          modalDepth={modalDepth + 1}
        />
      ) : (
        <ItemModal
          item={selectedItem}
          isOpen={selectedItem !== null}
          onClose={handleClose}
          modalDepth={modalDepth + 1}
        />
      )}
    </>
  )
}

export default ModalItemButton

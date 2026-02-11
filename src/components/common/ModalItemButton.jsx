import { useState } from 'react'
import ItemButton from './ItemButton'
import ItemModal from './ItemModal'
import VillagerModal from '../villagers/VillagerModal'

/**
 * Item button that automatically opens the appropriate modal based on item type
 * Wraps ItemButton with modal-opening logic
 */
function ModalItemButton({
  item,
  showIcon = true,
  showLabel = false,
  iconSize = 32,
  className = '',
  stopPropagation = false
}) {
  const [selectedItem, setSelectedItem] = useState(null)

  if (!item) return null

  // Use the type field from the item (set during data processing)
  const type = item.type || 'unknown'

  const handleItemClick = (clickedItem) => {
    setSelectedItem(clickedItem)
  }

  const handleClose = () => {
    setSelectedItem(null)
  }

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
        />
      ) : (
        <ItemModal
          item={selectedItem}
          isOpen={selectedItem !== null}
          onClose={handleClose}
        />
      )}
    </>
  )
}

export default ModalItemButton

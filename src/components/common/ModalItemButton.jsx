import { useState } from 'react'
import ItemButton from './ItemButton'
import FishModal from '../fish/FishModal'
import ArtisanModal from '../artisan/ArtisanModal'
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
      {type === 'fish' && (
        <FishModal
          fish={selectedItem}
          isOpen={selectedItem !== null}
          onClose={handleClose}
        />
      )}

      {type === 'artisan' && (
        <ArtisanModal
          item={selectedItem}
          isOpen={selectedItem !== null}
          onClose={handleClose}
        />
      )}

      {type === 'villager' && (
        <VillagerModal
          villager={selectedItem}
          isOpen={selectedItem !== null}
          onClose={handleClose}
        />
      )}

      {/* Add more modal types as needed:
      {type === 'crop' && <CropModal ... />}
      {type === 'bundle' && <BundleModal ... />}
      */}
    </>
  )
}

export default ModalItemButton

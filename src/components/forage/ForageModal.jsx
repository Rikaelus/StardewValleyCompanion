import { useRef, useEffect } from 'react'
import Modal from '../common/Modal'
import ModalHeader from '../common/ModalHeader'
import ModalSection from '../common/ModalSection'
import { ModalGrid, ModalGridItem } from '../common/ModalGrid'
import TagList from '../common/TagList'
import ModalGiftPreferences from '../common/ModalGiftPreferences'
import ItemSellPrice from '../common/ItemSellPrice'
import SeasonBadges from '../common/SeasonBadges'
import { formatLocationNames } from '../../utils/formatters'

function ForageModal({ forage, isOpen, onClose }) {
  const forageRef = useRef(forage)

  // Keep the last forage data during closing animation
  useEffect(() => {
    if (forage) {
      forageRef.current = forage
    }
  }, [forage])

  const displayForage = forage || forageRef.current

  const getCategoryName = (category) => {
    const categoryMap = {
      '-81': 'Forage',
      '-79': 'Fruit',
      '-80': 'Flower',
    }
    return categoryMap[String(category)] || 'Item'
  }

  const modalTitle = displayForage ? displayForage.name : 'Foraged Item'
  const categoryName = displayForage ? getCategoryName(displayForage.category) : ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      {displayForage && <>
        <ModalHeader icon={displayForage.icon} name={displayForage.name} subtitle={categoryName}>
          <div className="modal-price">
            <ItemSellPrice item={displayForage} showQualities={true} />
          </div>
        </ModalHeader>

        <ModalSection title="Location & Availability">
          <div className="modal-label-with-tags">
            <span className="label">Locations:</span>
            <TagList
              items={formatLocationNames(displayForage.locations || [])}
              variant="location"
              emptyText="Unknown"
            />
          </div>

          <ModalGrid>
            <ModalGridItem label="Seasons:">
              <SeasonBadges seasons={displayForage.seasons || []} />
            </ModalGridItem>
            {displayForage.isFlower && (
              <ModalGridItem
                label="Type:"
                value="🌸 Flower"
              />
            )}
          </ModalGrid>
        </ModalSection>

        {displayForage.bundleDetails && displayForage.bundleDetails.length > 0 && (
          <ModalSection title="Bundles">
            <TagList items={displayForage.bundleDetails} variant="bundle" nameKey="name" />
          </ModalSection>
        )}

        <ModalGiftPreferences
          giftDetails={displayForage.giftDetails}
          sectionClass="modal-section"
          giftsClass="modal-gifts"
        />

        {displayForage.contextTags && displayForage.contextTags.length > 0 && (
          <ModalSection title="Context Tags">
            <TagList items={displayForage.contextTags} variant="context" />
          </ModalSection>
        )}
      </>}
    </Modal>
  )
}

export default ForageModal

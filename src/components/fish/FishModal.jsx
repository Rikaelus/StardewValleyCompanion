import { useRef, useEffect } from 'react'
import Modal from '../common/Modal'
import ModalHeader from '../common/ModalHeader'
import ModalSection from '../common/ModalSection'
import { ModalGrid, ModalGridItem } from '../common/ModalGrid'
import TagList from '../common/TagList'
import ModalNote from '../common/ModalNote'
import ModalGiftPreferences from '../common/ModalGiftPreferences'
import ItemSellPrice from '../common/ItemSellPrice'

function FishModal({ fish, isOpen, onClose }) {
  const fishRef = useRef(fish)

  // Keep the last fish data during closing animation
  useEffect(() => {
    if (fish) {
      fishRef.current = fish
    }
  }, [fish])

  const displayFish = fish || fishRef.current

  const formatTime = (militaryTime) => {
    const time = String(militaryTime).padStart(4, '0')
    let hours = parseInt(time.slice(0, -2))

    if (hours >= 24) {
      hours -= 24
    }

    const period = hours >= 12 ? 'pm' : 'am'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

    return `${displayHours}${period}`
  }

  const formatSeasons = (seasons) => {
    if (!seasons || seasons.length === 0) return 'None'
    return seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
  }

  const getCategoryName = (category) => {
    // Map Stardew Valley category codes to friendly names
    const categoryMap = {
      '-4': 'Fish',
      '-5': 'Egg',
      '-6': 'Milk',
      '-7': 'Cooking',
      '-12': 'Minerals',
      '-15': 'Metal Resources',
      '-16': 'Building Resources',
      '-17': 'Sell at Pierre\'s',
      '-18': 'Sell at Pierre\'s and Marnie\'s',
      '-19': 'Fertilizer',
      '-20': 'Junk',
      '-21': 'Bait',
      '-22': 'Tackle',
      '-23': 'Sell at Fish Shop',
      '-24': 'Furniture',
      '-25': 'Ingredients',
      '-26': 'Artisan Goods',
      '-27': 'Syrup',
      '-28': 'Monster Loot',
      '-74': 'Seeds',
      '-75': 'Vegetables',
      '-79': 'Fruit',
      '-80': 'Flowers',
      '-81': 'Forage'
    }
    return categoryMap[String(category)] || 'Item'
  }

  const modalTitle = displayFish
    ? `${displayFish.contextTags?.includes('fish_legendary') ? '⭐' : ''}${displayFish.name}`
    : 'Fish'

  const fishName = displayFish
    ? `${displayFish.contextTags?.includes('fish_legendary') ? '⭐' : ''}${displayFish.name}`
    : ''

  const categoryName = displayFish ? getCategoryName(displayFish.category) : ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      {displayFish && <>
        <ModalHeader icon={displayFish.icon} name={fishName} subtitle={categoryName}>
          <div className="modal-price">
            <ItemSellPrice item={displayFish} showQualities={true} showProfession={true} />
          </div>
        </ModalHeader>

        <ModalSection title="Fishing Info">
          <ModalGrid>
            <ModalGridItem label="Difficulty:">
              <span className="value difficulty" style={{
                color: displayFish.difficulty >= 80 ? '#d32f2f' :
                       displayFish.difficulty >= 60 ? '#f57c00' :
                       displayFish.difficulty >= 40 ? '#fbc02d' :
                       '#66bb6a'
              }}>
                {displayFish.difficulty}
              </span>
            </ModalGridItem>

            <ModalGridItem
              label="Behavior:"
              value={displayFish.behaviorType.charAt(0).toUpperCase() + displayFish.behaviorType.slice(1)}
            />

            {displayFish.minFishingLevel && (
              <ModalGridItem label="Min Fishing Level:">
                <span className="value" style={{ color: '#1976d2', fontWeight: 'bold' }}>
                  {displayFish.minFishingLevel}
                </span>
              </ModalGridItem>
            )}

            <ModalGridItem
              label="Size Range:"
              value={`${displayFish.minSize}-${displayFish.maxSize} inches`}
            />
          </ModalGrid>
        </ModalSection>

        <ModalSection title="Location & Time">
          <div className="modal-label-with-tags">
            <span className="label">Locations:</span>
            <TagList items={displayFish.location} variant="location" emptyText="Unknown" />
          </div>

          <ModalGrid>
            <ModalGridItem
              label="Seasons:"
              value={formatSeasons(displayFish.seasons)}
            />

            <ModalGridItem
              label="Time:"
              value={
                displayFish.times && displayFish.times.length > 0
                  ? displayFish.times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')
                  : 'Any time'
              }
            />

            <ModalGridItem label="Weather:">
              <span className="value">
                {displayFish.weather === 'rainy' ? '🌧 Rainy' : displayFish.weather === 'sunny' ? '☀️ Sunny' : 'Any'}
              </span>
            </ModalGridItem>
          </ModalGrid>

          {displayFish.notes && (
            <ModalNote>
              <strong>Special Case:</strong> {displayFish.notes}
            </ModalNote>
          )}
        </ModalSection>

        {displayFish.bundleDetails && displayFish.bundleDetails.length > 0 && (
          <ModalSection title="Bundles">
            <TagList items={displayFish.bundleDetails} variant="bundle" nameKey="name" />
          </ModalSection>
        )}

        <ModalGiftPreferences
          giftDetails={displayFish.giftDetails}
          sectionClass="modal-section"
          giftsClass="modal-gifts"
        />

        {displayFish.contextTags && displayFish.contextTags.length > 0 && (
          <ModalSection title="Context Tags">
            <TagList items={displayFish.contextTags} variant="context" />
          </ModalSection>
        )}
      </>}
    </Modal>
  )
}

export default FishModal

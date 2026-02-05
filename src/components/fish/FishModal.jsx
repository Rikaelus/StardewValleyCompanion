import { useRef, useEffect } from 'react'
import Modal from '../common/Modal'
import ModalGiftPreferences from '../common/ModalGiftPreferences'
import ItemSellPrice from '../common/ItemSellPrice'
import './FishModal.css'

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayFish?.name || 'Fish'}>
      {displayFish && <div className="fish-modal">
        <div className="fish-modal-header">
          <img
            src={displayFish.icon}
            alt={displayFish.name}
            className="fish-modal-icon"
            onError={(e) => {
              // Prevent duplicate fallbacks
              if (e.target.dataset.errorHandled) return
              e.target.dataset.errorHandled = 'true'

              // Fallback to text if image fails to load
              e.target.style.display = 'none'
              const fallback = document.createElement('div')
              fallback.className = 'fish-modal-icon-fallback'
              fallback.textContent = displayFish.name.slice(0, 2).toUpperCase()
              fallback.title = `${displayFish.name} (icon not found)`
              e.target.parentNode.insertBefore(fallback, e.target)
            }}
          />
          <div className="fish-modal-title-section">
            <h3>{displayFish.name}</h3>
            <div className="fish-modal-price">
              <ItemSellPrice item={displayFish} showQualities={true} showProfession={true} />
            </div>
          </div>
        </div>

        <div className="fish-modal-section">
          <h4>Fishing Info</h4>
          <div className="fish-modal-grid">
            <div className="fish-modal-item">
              <span className="label">Difficulty:</span>
              <span className="value difficulty" style={{
                color: displayFish.difficulty >= 80 ? '#d32f2f' :
                       displayFish.difficulty >= 60 ? '#f57c00' :
                       displayFish.difficulty >= 40 ? '#fbc02d' :
                       '#66bb6a'
              }}>
                {displayFish.difficulty}
              </span>
            </div>

            <div className="fish-modal-item">
              <span className="label">Behavior:</span>
              <span className="value">{displayFish.behaviorType.charAt(0).toUpperCase() + displayFish.behaviorType.slice(1)}</span>
            </div>

            {displayFish.minFishingLevel && (
              <div className="fish-modal-item">
                <span className="label">Min Level:</span>
                <span className="value" style={{ color: '#1976d2', fontWeight: 'bold' }}>{displayFish.minFishingLevel}</span>
              </div>
            )}

            <div className="fish-modal-item">
              <span className="label">Size Range:</span>
              <span className="value">{displayFish.minSize}-{displayFish.maxSize} inches</span>
            </div>
          </div>
        </div>

        <div className="fish-modal-section">
          <h4>Location & Time</h4>

          <div className="fish-modal-item">
            <span className="label">Locations:</span>
            <div className="fish-modal-locations">
              {displayFish.location && displayFish.location.length > 0 ? (
                displayFish.location.map((loc, i) => (
                  <span key={i} className="location-tag">{loc}</span>
                ))
              ) : (
                <span className="value">Unknown</span>
              )}
            </div>
          </div>

          <div className="fish-modal-grid">
            <div className="fish-modal-item">
              <span className="label">Seasons:</span>
              <span className="value">{formatSeasons(displayFish.seasons)}</span>
            </div>

            <div className="fish-modal-item">
              <span className="label">Time:</span>
              <span className="value">
                {displayFish.times && displayFish.times.length > 0
                  ? displayFish.times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')
                  : 'Any time'
                }
              </span>
            </div>

            <div className="fish-modal-item">
              <span className="label">Weather:</span>
              <span className="value">
                {displayFish.weather === 'rainy' ? '🌧 Rainy' : displayFish.weather === 'sunny' ? '☀️ Sunny' : 'Any'}
              </span>
            </div>
          </div>

          {displayFish.notes && (
            <div className="fish-modal-special-note">
              <strong>Special Case:</strong> {displayFish.notes}
            </div>
          )}
        </div>

        {displayFish.bundleDetails && displayFish.bundleDetails.length > 0 && (
          <div className="fish-modal-section">
            <h4>Bundles</h4>
            <div className="fish-modal-bundles">
              {displayFish.bundleDetails.map(bundle => (
                <div key={bundle.id} className="bundle-tag">
                  {bundle.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <ModalGiftPreferences
          giftDetails={displayFish.giftDetails}
          sectionClass="fish-modal-section"
          giftsClass="fish-modal-gifts"
        />
      </div>}
    </Modal>
  )
}

export default FishModal

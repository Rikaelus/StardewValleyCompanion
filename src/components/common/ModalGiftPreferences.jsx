import ModalItemButton from './ModalItemButton'

function ModalGiftPreferences({ giftDetails, sectionClass, giftsClass, id, onNavigate }) {
  if (!giftDetails || giftDetails.length === 0) {
    return null
  }

  const sortedGifts = [...giftDetails].sort((a, b) => {
    // Sort by preference first (love > like > dislike > hate)
    const preferenceOrder = { love: 0, like: 1, dislike: 2, hate: 3 }
    const prefDiff = preferenceOrder[a.preference] - preferenceOrder[b.preference]
    if (prefDiff !== 0) return prefDiff
    // Then alphabetically by villager name
    return a.villager.name.localeCompare(b.villager.name)
  })

  return (
    <div id={id} className={sectionClass}>
      <h4>Gift Preferences</h4>
      <div className={giftsClass}>
        {sortedGifts.map(gift => (
          <div
            key={gift.villager.id}
            className={`gift-item gift-${gift.preference}`}
          >
            <ModalItemButton
              item={gift.villager}
              iconSize={32}
              onNavigate={onNavigate}
            />
            <div className="gift-info">
              <div className="gift-name">{gift.villager.name}</div>
              <div className="gift-preference">{gift.preference}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ModalGiftPreferences

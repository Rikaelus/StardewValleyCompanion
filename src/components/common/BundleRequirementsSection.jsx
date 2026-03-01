import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'

function BundleRequirementsSection({ entity, entityType, findByGameId, onNavigate }) {
  if (entityType !== 'bundle' || !entity.items) return null

  // Filter out placeholder items (weeds, stone)
  const realItems = entity.items.filter(item => {
    return item.gameId !== 0 && item.gameId !== 2 && item.gameId !== 10
  })

  const requiredCount = entity.minItemsRequired || realItems.length

  return (
    <ModalSection id="section-required" title="Required Items">
      <div className="bundle-items-list">
        {realItems.map((bundleItem, idx) => {
          const item = findByGameId(bundleItem.gameId)

          return item ? (
            <ModalItemButton
              key={idx}
              item={item}
              variant="bundle-item"
              quality={bundleItem.quality}
              quantity={bundleItem.quantity}
              onNavigate={onNavigate}
            />
          ) : (
            <span key={idx} className="bundle-item-name">{bundleItem.id}</span>
          )
        })}
      </div>

      {/* Bundle slots indicator */}
      <div className="bundle-slots">
        {Array.from({ length: requiredCount }).map((_, idx) => (
          <div key={idx} className="bundle-slot-container"></div>
        ))}
      </div>
    </ModalSection>
  )
}

export default BundleRequirementsSection

import ModalSection from './ModalSection'
import UniversalModalButton from './UniversalModalButton'
import { useProgress } from '../../hooks/UseProgress'

function BundleRequirementsSection({ entity, entityType, findByGameId, onNavigate }) {
  const { hasSaveData, getBundleProgress } = useProgress()

  if (entityType !== 'bundle') return null

  // Gold-only bundles (Vault)
  if (entity.goldCost) {
    const progress = hasSaveData ? getBundleProgress(entity.bundleNumber, 1) : null
    const paid = progress?.complete ?? false
    return (
      <ModalSection id="section-required" title="Required" navLabel="Required">
        <div className="bundle-gold-cost">
          <span className={`bundle-gold-amount ${paid ? 'bundle-gold-paid' : ''}`}>
            {entity.goldCost.toLocaleString()}g
          </span>
          {paid && <span className="bundle-complete-badge">Paid</span>}
        </div>
      </ModalSection>
    )
  }

  if (!entity.items) return null

  // Filter out placeholder items (weeds, stone) — gameIds are qualified strings like "(O)0"
  const PLACEHOLDER_GAME_IDS = new Set(['(O)0', '(O)2', '(O)10'])
  const realItems = entity.items.filter(item => !PLACEHOLDER_GAME_IDS.has(item.gameId))

  const progress = hasSaveData ? getBundleProgress(entity.bundleNumber, realItems.length) : null
  const requiredCount = entity.minItemsRequired || realItems.length

  // Build a list of turned-in items (in order) to fill into slots
  const filledItems = []
  if (progress) {
    for (let i = 0; i < realItems.length; i++) {
      if (progress.items[i]) {
        const item = findByGameId(realItems[i].gameId)
        filledItems.push(item)
      }
    }
  }

  return (
    <ModalSection id="section-required" title="Required Items" navLabel="Required Items">
      <div className="bundle-items-list">
        {realItems.map((bundleItem, idx) => {
          const item = findByGameId(bundleItem.gameId)

          return item ? (
            <UniversalModalButton
              key={idx}
              item={item}
              variant="bundle-item"
              quality={bundleItem.quality}
              quantity={bundleItem.quantity}
              onNavigate={onNavigate}
              noDoubleFrame
            />
          ) : (
            <span key={idx} className="bundle-item-name">{bundleItem.id}</span>
          )
        })}
      </div>

      {/* Bundle slots — filled slots show the turned-in item's icon */}
      <div className="bundle-slots">
        {Array.from({ length: requiredCount }).map((_, idx) => {
          const filledItem = filledItems[idx]
          return (
            <div key={idx} className={`bundle-slot-container ${filledItem ? 'filled' : ''}`}>
              {filledItem && (
                <img
                  className="bundle-slot-icon"
                  src={filledItem.icon}
                  alt={filledItem.name}
                  title={filledItem.name}
                />
              )}
            </div>
          )
        })}
      </div>

      {progress?.complete && (
        <div className="bundle-complete-stamp">Complete!</div>
      )}
    </ModalSection>
  )
}

export default BundleRequirementsSection

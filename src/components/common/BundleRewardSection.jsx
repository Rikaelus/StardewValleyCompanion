import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'

function BundleRewardSection({ entity, entityType, findByGameId, onNavigate }) {
  if (entityType !== 'bundle' || !entity.reward) return null

  // Parse reward string format: "O {gameId} {quantity}" or "BO {gameId} {quantity}"
  const parseReward = (rewardStr) => {
    const parts = rewardStr.trim().split(' ')
    if (parts.length < 3) return null

    const type = parts[0] // 'O' for Object, 'BO' for BigCraftable
    const rawId = parts[1]
    const quantity = parseInt(parts[2])

    if (!rawId || isNaN(quantity)) return null

    // Build the qualified gameId matching how items are stored in entities.json
    const prefix = type === 'BO' ? '(BC)' : '(O)'
    const qualifiedGameId = `${prefix}${rawId}`

    return { type, rawId, qualifiedGameId, quantity }
  }

  const reward = parseReward(entity.reward)
  if (!reward) {
    return (
      <ModalSection id="section-reward" title="Reward">
        <div className="bundle-reward">
          {entity.reward}
        </div>
      </ModalSection>
    )
  }

  const rewardItem = findByGameId(reward.qualifiedGameId)

  return (
    <ModalSection id="section-reward" title="Reward">
      <div className="bundle-reward">
        {rewardItem ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ModalItemButton
              item={rewardItem}
              variant="bundle-item"
              quantity={reward.quantity}
              onNavigate={onNavigate}
            />
            <span style={{ fontSize: '1rem', fontWeight: 500 }}>
              {rewardItem.name} x{reward.quantity}
            </span>
          </div>
        ) : (
          <span>Unknown Item ({reward.qualifiedGameId}) x{reward.quantity}</span>
        )}
      </div>
    </ModalSection>
  )
}

export default BundleRewardSection

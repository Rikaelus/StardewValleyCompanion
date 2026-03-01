import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'

function BundleRewardSection({ entity, entityType, findByGameId, onNavigate }) {
  if (entityType !== 'bundle' || !entity.reward) return null

  // Parse reward string format: "O {gameId} {quantity}" or "BO {gameId} {quantity}"
  const parseReward = (rewardStr) => {
    const parts = rewardStr.trim().split(' ')
    if (parts.length < 3) return null

    const type = parts[0] // 'O' for Object, 'BO' for BigCraftable
    const gameId = parseInt(parts[1])
    const quantity = parseInt(parts[2])

    if (isNaN(gameId) || isNaN(quantity)) return null

    return { type, gameId, quantity }
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

  const rewardItem = findByGameId(reward.gameId)

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
          <span>Unknown Item ({reward.type} {reward.gameId}) x{reward.quantity}</span>
        )}
      </div>
    </ModalSection>
  )
}

export default BundleRewardSection

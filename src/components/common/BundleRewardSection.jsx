import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'

function BundleRewardSection({ entity, entityType, findById, findByGameId, onNavigate }) {
  if (entityType !== 'bundle' && entityType !== 'museum-reward') return null
  if (!entity.reward) return null

  let rewardItem = null
  let quantity = 1
  let fallbackLabel = null
  let isRecipe = false

  if (entityType === 'bundle') {
    // Parse reward string format: "O {gameId} {quantity}" or "BO {gameId} {quantity}"
    const parts = entity.reward.trim().split(' ')
    if (parts.length >= 3) {
      const type = parts[0] // 'O' for Object, 'BO' for BigCraftable
      const rawId = parts[1]
      quantity = parseInt(parts[2]) || 1
      const prefix = type === 'BO' ? '(BC)' : '(O)'
      const qualifiedGameId = `${prefix}${rawId}`
      rewardItem = findByGameId(qualifiedGameId)
      if (!rewardItem) fallbackLabel = `Unknown Item (${qualifiedGameId}) x${quantity}`
    } else {
      fallbackLabel = entity.reward
    }
  } else {
    // museum-reward: reward is a friendly ID
    rewardItem = findById(entity.reward)
    quantity = entity.rewardCount || 1
    isRecipe = entity.isRecipe || false
    if (!rewardItem) fallbackLabel = entity.rewardName || entity.reward
  }

  return (
    <ModalSection id="section-reward" title="Reward" navLabel="Reward">
      <div className="bundle-reward">
        {rewardItem ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ModalItemButton
              item={rewardItem}
              variant="bundle-item"
              quantity={quantity}
              onNavigate={onNavigate}
            />
            <span style={{ fontSize: '1rem', fontWeight: 500 }}>
              {rewardItem.name}{quantity > 1 ? ` x${quantity}` : ''}
              {isRecipe ? ' (recipe)' : ''}
            </span>
          </div>
        ) : (
          <span>{fallbackLabel}</span>
        )}
      </div>
    </ModalSection>
  )
}

export default BundleRewardSection

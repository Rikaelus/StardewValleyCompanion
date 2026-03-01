import ModalItemButton from './ModalItemButton'
import TagList from './TagList'
import { usePlayer } from '../../contexts/PlayerContext'
import ConditionBadge from './ConditionBadge'
import SeasonBadges from './SeasonBadges'

/**
 * Renders shop sources in two modes:
 *
 * compact — deduplicated by storeId, renders as TagList chips (for table cells)
 * full    — one row per source with qualifiers and price detail (for modals)
 *
 * Props:
 *   sources        {Array}    All item sources (filtered to type==='shop' internally)
 *   compact        {boolean}  Use compact tag list mode (default false)
 *   findEntity     {Function} (full mode) gameId → item object for currency lookups
 *   onNavigate     {Function} (full mode) modal navigation callback
 */
function ShopSourceList({ sources, compact = false, findEntity, findEntityById, getStore, onNavigate }) {
  const { player } = usePlayer()
  const shopSources = (sources || []).filter(s => s.type === 'shop')
  if (shopSources.length === 0) return <span style={{ color: '#999' }}>—</span>

  // ── Compact mode ────────────────────────────────────────────────────────────
  if (compact) {
    // Deduplicate by storeName — each storeId now maps to a unique name
    const seen = new Map()
    for (const src of shopSources) {
      const key = src.storeName ?? src.storeId
      if (!seen.has(key)) seen.set(key, src)
    }
    const tags = [...seen.values()].map(src => {
      const key = src.storeName ?? src.storeId
      return src.seasons?.length
        ? `${key} (${src.seasons.map(s => s[0].toUpperCase() + s.slice(1)).join('/')})`
        : key
    })
    return <TagList items={tags} variant="location" />
  }

  // ── Full mode ────────────────────────────────────────────────────────────────
  return (
    <div className="source-list">
      {shopSources.map((src, i) => {
        const storeName = src.storeName ?? src.storeId
        const isBarter = src.tradeItemId !== undefined || src.tradeItemGameId !== undefined
        // Joja members pay base × 2 instead of base × 2.5, so member price = non-member × 0.8
        const price = src.price != null && src.storeId === 'store-joja' && player.jojaMember
          ? Math.floor(src.price * 0.8)
          : src.price
        const currencyItem = isBarter && findEntity
          ? (src.tradeItemId && findEntityById ? findEntityById(src.tradeItemId) : null) ?? findEntity(src.tradeItemGameId)
          : null
        const shopCurrencyItem = src.shopCurrencyGameId && findEntity ? findEntity(src.shopCurrencyGameId) : null

        // Condition qualifier chips
        const qualifiers = []
        if (src.days?.length > 0)
          qualifiers.push(src.days.join('/'))
        if (src.yearUnlock)
          qualifiers.push(src.yearUnlockBefore ? `Before Year ${src.yearUnlock}` : `Year ${src.yearUnlock}+`)
        if (src.rotating)
          qualifiers.push('Rotating')
        if (src.stock && src.stock !== -1)
          qualifiers.push(`Stock: ${src.stock}`)
        // condition rendered separately via ConditionBadge below

        const storeEntity = getStore ? getStore(src.storeId) : null

        const priceDetail = isBarter ? (
          <>
            {(src.quantity > 1 || src.tradeItemAmount > 1) && (
              <span className="source-qualifier">
                {src.quantity > 1 ? `${src.quantity} for ` : ''}{src.tradeItemAmount > 1 ? src.tradeItemAmount : ''}
              </span>
            )}
            {currencyItem ? (
              <ModalItemButton item={currencyItem} variant="inline" onNavigate={onNavigate} plural={src.tradeItemAmount > 1} />
            ) : (
              <>
                {src.tradeItemIcon && (
                  <img src={`/${src.tradeItemIcon}`} alt={src.tradeItemName} className="source-trade-icon" />
                )}
                {src.tradeItemName}
              </>
            )}
          </>
        ) : shopCurrencyItem ? (
          <>
            <span className="source-qualifier">
              {src.quantity > 1 ? `${src.quantity} for ` : ''}{price > 1 ? price : ''}
            </span>
            <ModalItemButton item={shopCurrencyItem} variant="inline" onNavigate={onNavigate} plural={price > 1} />
          </>
        ) : (
          price != null ? `${price}g` : '—'
        )

        return (
          <ConditionBadge key={i} condition={src.condition} conditionItemNames={src.conditionItemNames}>
            {(badge, clauseElements, open) => (
              <>
                <span className="source-entry">
                  <span className="source-name">
                    {storeEntity && onNavigate ? (
                      <ModalItemButton item={storeEntity} variant="inline" onNavigate={onNavigate} />
                    ) : (
                      storeName
                    )}
                  </span>
                  <span className="source-qualifiers">
                    {qualifiers.map((q, qi) => <span key={qi} className="source-qualifier">{q}</span>)}
                    {badge}
                  </span>
                  <span className="source-seasons">
                    {src.seasons?.length > 0 && <SeasonBadges seasons={src.seasons} compact />}
                  </span>
                  <span className="source-detail">{priceDetail}</span>
                </span>
                {open && (
                  <span className="source-entry source-entry--expanded">
                    <span className="source-expanded-cell">{clauseElements}</span>
                  </span>
                )}
              </>
            )}
          </ConditionBadge>
        )
      })}
    </div>
  )
}

export default ShopSourceList

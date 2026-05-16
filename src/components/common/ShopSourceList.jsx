import UniversalModalButton from './UniversalModalButton'
import { usePlayer } from '../../contexts/PlayerContext'
import ConditionBadge from './ConditionBadge'
import SeasonBadges from './SeasonBadges'

/**
 * Renders shop sources in two modes:
 *
 * compact — deduplicated by storeId, renders as clickable buttons (for table cells)
 * full    — one row per source with qualifiers and price detail (for modals)
 *
 * Props:
 *   sources        {Array}    All item sources (filtered to type==='shop' internally)
 *   compact        {boolean}  Use compact tag list mode (default false)
 *   findEntity     {Function} (full mode) gameId → item object for currency lookups
 *   onNavigate     {Function} (full mode) modal navigation callback
 */
function ShopSourceList({ sources, compact = false, findEntity, findEntityById, onNavigate }) {
  const { player } = usePlayer()
  const shopSources = (sources || []).filter(s => s.type === 'shop')
  if (shopSources.length === 0) return <span style={{ color: '#999' }}>—</span>

  // ── Compact mode ────────────────────────────────────────────────────────────
  if (compact) {
    // Deduplicate by store id
    const seen = new Map()
    for (const src of shopSources) {
      if (!seen.has(src.id)) seen.set(src.id, src)
    }
    const unique = [...seen.values()]
    return (
      <span className="cell-location-list">
        {unique.map((src, i) => {
          const storeEntity = findEntityById ? findEntityById(src.id) : null
          return (
            <span key={src.id} className="cell-location-item">
              {storeEntity
                ? <UniversalModalButton item={storeEntity} variant="table-inline" stopPropagation />
                : (storeEntity?.name ?? src.id)}
            </span>
          )
        })}
      </span>
    )
  }

  // ── Full mode ────────────────────────────────────────────────────────────────
  return (
    <div className="source-list">
      {shopSources.map((src, i) => {
        const storeEntity = findEntityById ? findEntityById(src.id) : null
        const storeName = storeEntity?.name ?? src.id
        const isBarter = src.tradeItemId !== undefined || src.tradeItemGameId !== undefined
        // Joja members pay base × 2 instead of base × 2.5, so member price = non-member × 0.8
        const price = src.price != null && src.id === 'loc-joja' && player.jojaMember
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
        if (src.dayParity)
          qualifiers.push(src.dayParity === 'odd' ? 'Odd days' : 'Even days')
        if (src.yearCycle)
          qualifiers.push(`Year ${src.yearCycle} cycle`)
        if (src.yearUnlock)
          qualifiers.push(src.yearUnlockBefore ? `Before Year ${src.yearUnlock}` : `Year ${src.yearUnlock}+`)
        if (src.rotating)
          qualifiers.push('Rotating')
        if (src.stock && src.stock !== -1)
          qualifiers.push(`Stock: ${src.stock}`)
        // condition rendered separately via ConditionBadge below

        const priceDetail = isBarter ? (
          <span className="source-detail-inner">
            {(src.quantity > 1 || src.tradeItemAmount > 1) && (
              <span className="source-qualifier">
                {src.quantity > 1 ? `${src.quantity} for ` : ''}{src.tradeItemAmount > 1 ? `×${src.tradeItemAmount}` : ''}
              </span>
            )}
            {currencyItem ? (
              <UniversalModalButton item={currencyItem} variant="inline" onNavigate={onNavigate} plural={src.tradeItemAmount > 1} />
            ) : (
              <>
                {src.tradeItemIcon && (
                  <img src={`/${src.tradeItemIcon}`} alt={src.tradeItemName} className="source-trade-icon" />
                )}
                {src.tradeItemName}
              </>
            )}
          </span>
        ) : shopCurrencyItem ? (
          <span className="source-detail-inner">
            <span className="source-qualifier">
              {src.quantity > 1 ? `${src.quantity} for ` : ''}{price > 1 ? `×${price}` : ''}
            </span>
            <UniversalModalButton item={shopCurrencyItem} variant="inline" onNavigate={onNavigate} plural={price > 1} />
          </span>
        ) : (
          price != null
            ? (src.quantity > 1 ? `${src.quantity} for ${price.toLocaleString()}g` : `${price.toLocaleString()}g`)
            : '—'
        )

        return (
          <ConditionBadge key={i} condition={src.condition} conditionItemNames={src.conditionItemNames}>
            {(badge, clauseElements, open) => (
              <>
                <span className="source-entry">
                  <span className="source-name">
                    {storeEntity && onNavigate ? (
                      <UniversalModalButton item={storeEntity} variant="inline" onNavigate={onNavigate} />
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

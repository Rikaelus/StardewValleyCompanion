import { useMemo } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { usePlayer } from '../../contexts/PlayerContext'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import './RaccoonPage.css'

// Feeding milestones that unlock shop items or rewards
const FEED_MILESTONES = [
  { feeds: 1, label: 'First feeding',  description: 'The raccoon family warms up to you.' },
  { feeds: 2, label: '2 feedings',     description: 'Unlocks: Ways Of The Wild book' },
  { feeds: 3, label: '3 feedings',     description: 'Unlocks: Raccoon Hat' },
  { feeds: 4, label: '4 feedings',     description: 'Unlocks: Mahogany Seed, Mixed Seeds' },
  { feeds: 5, label: '5 feedings',     description: 'Unlocks: Jungle Tank furniture, Mrs. Raccoon moves in' },
  { feeds: 6, label: '6 feedings',     description: 'Unlocks: Fairy Dust, and (with Foraging Mastery) Golden Mystery Box and Magic Rock Candy' },
]

// Extract feed threshold from a JSON-Logic condition object
function extractFeedThreshold(condition) {
  if (!condition) return 0
  if (condition['>=']) {
    const [varObj, val] = condition['>=']
    if (varObj?.var === 'world.TimesFedRaccoons') return val
  }
  if (condition['and']) {
    for (const clause of condition['and']) {
      const t = extractFeedThreshold(clause)
      if (t > 0) return t
    }
  }
  return 0
}

// Whether a condition also requires foraging mastery
function requiresForagingMastery(condition) {
  if (!condition?.['and']) return false
  return condition['and'].some(
    c => c['>=']?.[0]?.var === 'player.mastery.foraging'
  )
}

function MilestoneCard({ milestone, feedCount, shopItems, hasSaveData, foragingMastery }) {
  const reached = hasSaveData && feedCount >= milestone.feeds
  const isCurrent = hasSaveData && feedCount === milestone.feeds - 1
  const cardClass = [
    'raccoon-card',
    reached ? 'raccoon-card--reached' : isCurrent ? 'raccoon-card--next' : '',
  ].join(' ').trim()

  return (
    <div className={cardClass}>
      <div className="raccoon-card-header">
        <span className="raccoon-milestone-label">{milestone.label}</span>
        {hasSaveData && (
          <span className={`raccoon-badge ${reached ? 'raccoon-badge--reached' : 'raccoon-badge--locked'}`}>
            {reached ? 'Reached' : 'Locked'}
          </span>
        )}
      </div>
      <p className="raccoon-card-desc">{milestone.description}</p>
      {shopItems.length > 0 && (
        <div className="raccoon-card-items">
          {shopItems.map(({ item, tradeItemAmount, tradeItemName, needsMastery }) => (
            <div key={item.id} className="raccoon-shop-row">
              <UniversalModalButton item={item} variant="table-inline" showIcon />
              <span className="raccoon-shop-cost">
                {tradeItemAmount > 1 ? `${tradeItemAmount}× ` : ''}{tradeItemName}
                {needsMastery && <span className="raccoon-mastery-note" title="Also requires Foraging Mastery"> ✦ Mastery</span>}
              </span>
              {hasSaveData && (
                <span className={`raccoon-item-badge ${
                  needsMastery && !foragingMastery ? 'raccoon-item-badge--mastery-locked'
                  : reached ? 'raccoon-item-badge--available'
                  : 'raccoon-item-badge--locked'
                }`}>
                  {needsMastery && !foragingMastery ? 'Mastery Req.'
                  : reached ? 'Available'
                  : 'Locked'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RaccoonPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const { player } = usePlayer()
  const { hasSaveData, timesFedRaccoons } = progress

  const foragingMastery = hasSaveData
    ? (player.saveData?.stats?.['mastery_2'] ?? 0) >= 1
    : false

  const feedCount = hasSaveData ? (timesFedRaccoons ?? 0) : null

  const milestoneItems = useMemo(() => {
    if (loading) return {}
    const byThreshold = {}

    for (const item of items) {
      const raccoonSrc = item.sources?.find(s => s.entityId === 'loc-raccoon')
      if (!raccoonSrc) continue
      const threshold = extractFeedThreshold(raccoonSrc.condition)
      const needsMastery = requiresForagingMastery(raccoonSrc.condition)

      if (!byThreshold[threshold]) byThreshold[threshold] = []
      byThreshold[threshold].push({
        item,
        tradeItemAmount: raccoonSrc.tradeItemAmount ?? 1,
        tradeItemName: raccoonSrc.tradeItemName ?? '?',
        needsMastery,
      })
    }
    return byThreshold
  }, [items, loading])

  const alwaysAvailable = milestoneItems[0] ?? []

  return (
    <PagePanel>
      <div className="raccoon-page">
        <header className="raccoon-header">
          <h1 className="raccoon-title">Giant Stump Shop</h1>
          {hasSaveData && (
            <div className="raccoon-achievement-progress">
              <div className="raccoon-achievement-label">
                <span className="raccoon-achievement-name">Good Neighbors</span>
                <span className="raccoon-achievement-count">
                  {feedCount} / 9 feedings
                  {feedCount >= 9 && <span className="raccoon-achievement-done"> ✓</span>}
                </span>
              </div>
              <div className="raccoon-progress-bar">
                <div
                  className={`raccoon-progress-bar-fill ${feedCount >= 9 ? 'raccoon-progress-bar-fill--done' : ''}`}
                  style={{ width: `${Math.min(1, feedCount / 9) * 100}%` }}
                />
                {[2, 3, 4, 5, 6, 9].map(n => (
                  <div
                    key={n}
                    className={`raccoon-progress-pip ${feedCount >= n ? 'raccoon-progress-pip--reached' : ''}`}
                    style={{ left: `${(n / 9) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </header>

        <p className="raccoon-intro">
          Feed the raccoon family in Cindersap Forest each week to unlock new items at their Giant Stump shop.
          Four items are always available; additional unlocks open with each feeding milestone.
        </p>

        {!hasSaveData && (
          <button
            type="button"
            className="raccoon-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track your feeding progress.
          </button>
        )}

        {alwaysAvailable.length > 0 && (
          <section className="raccoon-section">
            <h2 className="raccoon-section-title">Always Available</h2>
            <div className="raccoon-always-items">
              {alwaysAvailable.map(({ item, tradeItemAmount, tradeItemName }) => (
                <div key={item.id} className="raccoon-shop-row raccoon-shop-row--flat">
                  <UniversalModalButton item={item} variant="table-inline" showIcon />
                  <span className="raccoon-shop-cost">
                    {tradeItemAmount > 1 ? `${tradeItemAmount}× ` : ''}{tradeItemName}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="raccoon-section">
          <h2 className="raccoon-section-title">Feeding Milestones</h2>
          <div className="raccoon-cards">
            {FEED_MILESTONES.map(milestone => (
              <MilestoneCard
                key={milestone.feeds}
                milestone={milestone}
                feedCount={feedCount}
                shopItems={milestoneItems[milestone.feeds] ?? []}
                hasSaveData={hasSaveData}
                foragingMastery={foragingMastery}
              />
            ))}
          </div>
        </section>
      </div>
    </PagePanel>
  )
}

export default RaccoonPage

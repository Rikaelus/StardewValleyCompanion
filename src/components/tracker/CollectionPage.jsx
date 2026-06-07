import PagePanel from '../common/PagePanel'
import { useOpenModal } from '../../contexts/ModalContext'
import UniversalModalButton from '../common/UniversalModalButton'
import { usePageGoals } from '../../hooks/UsePageGoals'
import './CollectionPage.css'

/**
 * Shared shell for tracker collection pages.
 *
 * Props:
 *   title        — page heading
 *   groups       — [{ id, title, items: [{ entity, state, count, badge, tileTitle }] }]
 *   totals       — { done, total }
 *   milestones   — [{ label, reached }]  optional
 *   legend       — [{ state: 'complete'|'partial'|'missing', label }]  optional
 *   filterTabs   — [{ id, label, count }]  optional (defaults to All / Still Needed)
 *   activeFilter — current filter id
 *   onFilter     — (id) => void
 *   groupByTabs  — [{ id, label }]  optional pivot tabs (e.g. By Season / By Location)
 *   activeGroupBy — current groupBy id
 *   onGroupBy    — (id) => void
 *   noSaveMessage — string shown when no save loaded
 */
function tileCardState(state) {
  if (state === 'complete') return 'earned'
  if (state === 'partial') return 'partial'
  if (state === 'missing') return 'needed'
  return null // neutral
}

function tileCardMeta(state, count, quantityType) {
  if (quantityType) return count > 0 ? `×${count} ${quantityType}` : null
  if (state === 'partial') return 'Known'
  if (state === 'complete' && count > 1) return `×${count}`
  return null
}

function CollectionPage({
  title,
  groups,
  totals,
  milestones = [],
  legend = [],
  filterTabs,
  activeFilter,
  onFilter,
  groupByTabs,
  activeGroupBy,
  onGroupBy,
  noSaveMessage,
  hasSaveData,
  keepGroups = false,
  quantityType = null, // when set, shows '×N <quantityType>' in card meta row
}) {
  const openModal = useOpenModal()
  const pageGoals = usePageGoals()

  const tabs = filterTabs ?? [
    { id: 'all', label: 'All Items', count: totals.total },
    ...(hasSaveData ? [{ id: 'needed', label: 'Still Needed', count: totals.total - totals.done }] : []),
  ]

  const isNeededView = hasSaveData && activeFilter === 'needed'

  // keepGroups: preserve seasonal/category grouping in "Still Needed" view,
  // filtering out complete items but keeping the group structure.
  const filteredGroups = isNeededView && keepGroups
    ? groups.map(g => ({ ...g, items: g.items.filter(i => i.state !== 'complete') })).filter(g => g.items.length > 0)
    : null

  // Default "Still Needed": flatten and sort alphabetically.
  const neededItems = isNeededView && !keepGroups
    ? groups.flatMap(g => g.items).filter(i => i.state !== 'complete').sort((a, b) => a.entity.name.localeCompare(b.entity.name))
    : null

  return (
    <PagePanel>
      <div className="collection-page">
        <header className="collection-header">
          <div className="collection-title-row">
            <h1 className="collection-title">{title}</h1>
            {pageGoals.length > 0 && (
              <div className="collection-page-goals">
                {pageGoals.map(g => (
                  <UniversalModalButton key={g.id} item={g} variant="inline" />
                ))}
              </div>
            )}
          </div>
          {hasSaveData && (
            <div className="collection-score-block">
              <div className="collection-score-numbers">
                <span className="collection-score-done">{totals.done}</span>
                <span className="collection-score-divider">/</span>
                <span className="collection-score-max">{totals.total}</span>
                {totals.label && <span className="collection-score-label">{totals.label}</span>}
              </div>
              {milestones.length > 0 && (
                <div className="collection-milestones">
                  {milestones.map((m, i) => (
                    <span key={i} className={`collection-milestone ${m.reached ? 'collection-milestone--reached' : ''}`}>
                      {m.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {!hasSaveData && noSaveMessage && (
          <button
            type="button"
            className="collection-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            {noSaveMessage}
          </button>
        )}

        {groupByTabs && (
          <div className="collection-filter-toggle collection-groupby-toggle" role="tablist" aria-label="Group by">
            {groupByTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeGroupBy === tab.id}
                className={`collection-filter-btn ${activeGroupBy === tab.id ? 'collection-filter-btn--active' : ''}`}
                onClick={() => onGroupBy(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="collection-filter-toggle" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === tab.id}
              className={`collection-filter-btn ${activeFilter === tab.id ? 'collection-filter-btn--active' : ''}`}
              onClick={() => onFilter(tab.id)}
            >
              {tab.label}
              <span className="collection-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {hasSaveData && legend.length > 0 && (
          <div className="collection-legend">
            {legend.map(entry => (
              <span key={entry.state} className="collection-legend-item">
                <span className={`collection-legend-swatch collection-legend-swatch--${entry.state}`} />
                {entry.label}
              </span>
            ))}
          </div>
        )}

        {neededItems ? (
          <section className="collection-group">
            <div className="collection-grid">
              {neededItems.map(({ entity, state, count }) => (
                <UniversalModalButton
                  key={entity.id}
                  item={entity}
                  variant="card"
                  cardState={tileCardState(state)}
                  cardMeta={tileCardMeta(state, count, quantityType)}
                  onNavigate={openModal}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="collection-groups">
            {(filteredGroups ?? groups).map(group => (
              <section key={group.id} className="collection-group">
                <header className="collection-group-header">
                  <h2 className="collection-group-name">{group.title}</h2>
                  {hasSaveData && (
                    <span className="collection-group-score">
                      {group.items.filter(i => i.state !== 'missing').length} / {group.items.length}
                    </span>
                  )}
                </header>
                <div className="collection-grid">
                  {group.items.map(({ entity, state, count }) => {
                    const effectiveState = hasSaveData ? state : 'neutral'
                    const effectiveCount = hasSaveData ? count : null
                    return (
                      <UniversalModalButton
                        key={entity.id}
                        item={entity}
                        variant="card"
                        cardState={tileCardState(effectiveState)}
                        cardMeta={tileCardMeta(effectiveState, effectiveCount, quantityType)}
                        onNavigate={openModal}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PagePanel>
  )
}

export default CollectionPage

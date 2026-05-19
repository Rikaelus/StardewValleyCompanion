import { useMemo, useState } from 'react'
import PagePanel from '../common/PagePanel'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import UniversalModalButton from '../common/UniversalModalButton'
import './RarecrowPage.css'

function ItemTile({ item, owned, onClick }) {
  const iconSrc = item.icon
    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
    : null
  const tileClass = owned == null ? 'rarecrow-tile--neutral' : owned ? 'rarecrow-tile--owned' : 'rarecrow-tile--missing'
  const tileTitle = owned == null ? item.name : `${item.name} — ${owned ? 'Obtained' : 'Not obtained'}`
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`rarecrow-tile ${tileClass}`}
      title={tileTitle}
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className="rarecrow-tile-icon" />
      ) : (
        <span className="rarecrow-tile-fallback">{item.name?.slice(0, 2).toUpperCase()}</span>
      )}
    </button>
  )
}

function sourceEntity(s, findById, findByGameId) {
  if (s.entityId) return findById(s.entityId)
  if (s.entityGameId) return findByGameId(s.entityGameId)
  return null
}

function ListRow({ item, onClick, findById, findByGameId }) {
  const iconSrc = item.icon
    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
    : null

  const renderItems = []
  const seenEntityIds = new Set()
  const seenLabels = new Set()
  for (const s of (item.sources ?? [])) {
    const ent = sourceEntity(s, findById, findByGameId)
    if (!ent || seenEntityIds.has(ent.id)) continue
    seenEntityIds.add(ent.id)
    renderItems.push({ kind: 'entity', key: ent.id, entity: ent })
  }

  return (
    <li className="rarecrow-list-row">
      <button type="button" className="rarecrow-list-button" onClick={() => onClick(item)}>
        {iconSrc && <img src={iconSrc} alt="" className="rarecrow-list-icon" />}
        <span className="rarecrow-list-name">{item.name}</span>
      </button>
      {renderItems.length > 0 ? (
        <span className="rarecrow-source-buttons" onClick={(e) => e.stopPropagation()}>
          {renderItems.map(r => (
            <UniversalModalButton
              key={r.key}
              item={r.entity}
              variant="inline"
              showIcon
              stopPropagation
            />
          ))}
        </span>
      ) : null}
    </li>
  )
}

function RarecrowPage() {
  const { items: allItems, findById, findByGameId, loading } = useEntities()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [showOnlyNeeded, setShowOnlyNeeded] = useState(false)

  const { rarecrows, ownedCount } = useMemo(() => {
    if (loading) return { rarecrows: [], ownedCount: 0 }
    const rarecrows = allItems
      .filter(i => i.name === 'Rarecrow')
      .sort((a, b) => a.gameId.localeCompare(b.gameId, undefined, { numeric: true }))
    const ownedCount = rarecrows.filter(r => progress.isOwned(r.gameId)).length
    return { rarecrows, ownedCount }
  }, [allItems, loading, progress])

  const hasSaveData = progress.hasSaveData
  const total = rarecrows.length
  const missing = total - ownedCount
  const complete = ownedCount === total

  const displayed = hasSaveData && showOnlyNeeded
    ? rarecrows.filter(r => !progress.isOwned(r.gameId))
    : rarecrows

  if (loading) {
    return <PagePanel><div className="rarecrow-empty">Loading…</div></PagePanel>
  }

  return (
    <PagePanel>
      <div className="rarecrow-page">
        <header className="rarecrow-header">
          <h1 className="rarecrow-title">Rarecrow Collection</h1>
          {hasSaveData && (
            <div className="rarecrow-score-block">
              <div className="rarecrow-score-numbers">
                <span className="rarecrow-score-total">{ownedCount}</span>
                <span className="rarecrow-score-divider">/</span>
                <span className="rarecrow-score-max">{total}</span>
                <span className="rarecrow-score-label">obtained</span>
              </div>
              <div className="rarecrow-milestone-row">
                <span className={complete ? 'rarecrow-milestone rarecrow-milestone--reached' : 'rarecrow-milestone'}>
                  8/8 — Deluxe Scarecrow recipe (mail from Rarecrow Society)
                </span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="rarecrow-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track which Rarecrows you've obtained.
          </button>
        )}

        <div className="rarecrow-mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!showOnlyNeeded}
            className={`rarecrow-mode-btn ${!showOnlyNeeded ? 'rarecrow-mode-btn--active' : ''}`}
            onClick={() => setShowOnlyNeeded(false)}
          >
            All
            <span className="rarecrow-mode-count">{total}</span>
          </button>
          {hasSaveData && (
            <button
              type="button"
              role="tab"
              aria-selected={showOnlyNeeded}
              className={`rarecrow-mode-btn ${showOnlyNeeded ? 'rarecrow-mode-btn--active' : ''}`}
              onClick={() => setShowOnlyNeeded(true)}
            >
              Still Needed
              <span className="rarecrow-mode-count">{missing}</span>
            </button>
          )}
        </div>

        {hasSaveData && showOnlyNeeded ? (
          <ul className="rarecrow-list">
            {displayed.map(r => (
              <ListRow key={r.id} item={r} onClick={openModal} findById={findById} findByGameId={findByGameId} />
            ))}
          </ul>
        ) : (
          <div className="rarecrow-group">
            <div className="rarecrow-grid">
              {displayed.map(r => (
                <ItemTile
                  key={r.id}
                  item={r}
                  owned={hasSaveData ? progress.isOwned(r.gameId) : null}
                  onClick={openModal}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </PagePanel>
  )
}

export default RarecrowPage

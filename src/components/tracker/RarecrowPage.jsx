import { useMemo, useState } from 'react'
import PagePanel from '../common/PagePanel'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import UniversalModalButton from '../common/UniversalModalButton'
import './RarecrowPage.css'

function sourceLabel(item, findById, findByGameId) {
  const sources = item.sources ?? []
  const names = []
  const seen = new Set()
  for (const s of sources) {
    const ent = s.entityId ? findById(s.entityId) : s.entityGameId ? findByGameId(s.entityGameId) : null
    if (!ent || seen.has(ent.id)) continue
    seen.add(ent.id)
    names.push(ent.name)
  }
  return names.join(', ') || null
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

        <ul className="rarecrow-card-grid">
          {displayed.map(r => {
            const owned = hasSaveData ? progress.isOwned(r.gameId) : null
            const cardState = owned === null ? null : owned ? 'earned' : 'needed'
            const desc = sourceLabel(r, findById, findByGameId)
            return (
              <li key={r.id}>
                <UniversalModalButton
                  item={r}
                  variant="card"
                  cardState={cardState}
                  cardDesc={desc}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </PagePanel>
  )
}

export default RarecrowPage

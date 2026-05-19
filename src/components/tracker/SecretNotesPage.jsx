import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import PagePanel from '../common/PagePanel'
import './SecretNotesPage.css'

const SUBTYPE_LABELS = {
  'gift-taste': 'Gift Hints',
  'map': 'Treasure Map',
  'text': 'Lore / Hint',
}

function NoteTile({ note, seen, completed, onClick }) {
  const iconSrc = note.icon ? `/${note.icon}` : null
  const displayNum = note.noteNumber <= 999 ? note.noteNumber : note.noteNumber - 1000
  const hasTrackableReward = note.reward != null
  const tileClass = seen == null ? 'snote-tile--neutral' : seen ? 'snote-tile--seen' : 'snote-tile--missing'

  return (
    <button
      type="button"
      className={`snote-tile ${tileClass}`}
      onClick={() => onClick(note)}
      title={note.name}
    >
      {iconSrc
        ? <img src={iconSrc} alt="" className="snote-tile-icon" />
        : <span className="snote-tile-fallback">{String(displayNum)}</span>
      }
      <span className="snote-tile-num">{displayNum}</span>
      {hasTrackableReward && seen != null && (
        <span className={`snote-tile-check ${completed ? 'snote-tile-check--completed' : ''}`}>
          {completed ? '☑' : '☐'}
        </span>
      )}
    </button>
  )
}

function NoteRow({ note, seen, completed, onClick }) {
  const subtypeLabel = SUBTYPE_LABELS[note.subtype] ?? note.subtype
  const hasTrackableReward = note.reward != null
  return (
    <li className={`snote-row ${seen ? 'snote-row--seen' : ''}`}>
      <button type="button" className="snote-row-btn" onClick={() => onClick(note)}>
        <span className="snote-number">#{note.noteNumber <= 999 ? note.noteNumber : note.noteNumber - 1000}</span>
        <span className="snote-name">{note.name}</span>
        <span className="snote-badges">
          {note.subtype && (
            <span className={`snote-badge snote-badge--${note.subtype}`}>{subtypeLabel}</span>
          )}
          {hasTrackableReward && (
            <span className={`snote-badge snote-badge--reward ${completed ? 'snote-badge--reward-completed' : ''}`}>
              {completed ? 'Completed' : 'Reward'}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

function NoteSection({ title, notes, filter, openModal, hasSaveData }) {
  const displayed = filter === 'needed'
    ? notes.filter(n => !n.seen)
    : filter === 'incomplete'
      ? notes.filter(n => n.seen && n.completed === false)
      : notes
  if (displayed.length === 0) return null
  const seenCount = notes.filter(n => n.seen).length

  return (
    <section className="snote-section">
      <header className="snote-section-header">
        <h2 className="snote-section-title">{title}</h2>
        {hasSaveData && <span className="snote-section-score">{seenCount} / {notes.length}</span>}
      </header>

      {filter === 'all' ? (
        <div className="snote-grid">
          {displayed.map(({ note, seen, completed }) => (
            <NoteTile
              key={note.id}
              note={note}
              seen={hasSaveData ? seen : null}
              completed={hasSaveData ? completed : null}
              onClick={openModal}
            />
          ))}
        </div>
      ) : (
        <ul className="snote-list">
          {displayed.map(({ note, seen, completed }) => (
            <NoteRow key={note.id} note={note} seen={seen} completed={completed} onClick={openModal} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SecretNotesPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [filter, setFilter] = useState('all')

  const { secretNotes, journalScraps, totals } = useMemo(() => {
    if (loading) return { secretNotes: [], journalScraps: [], totals: { done: 0, total: 0 } }

    const notes = items.filter(i => i.type === 'secret-note' || i.type === 'journal-scrap')
    const annotated = notes.map(note => ({
      note,
      seen: progress.hasSecretNote(note.noteNumber),
      completed: note.reward ? progress.hasSecretNoteReward(note.reward) : null,
    }))

    const secretNotes = annotated.filter(n => n.note.type === 'secret-note')
    const journalScraps = annotated.filter(n => n.note.type === 'journal-scrap')
    const done = annotated.filter(n => n.seen).length

    return { secretNotes, journalScraps, totals: { done, total: annotated.length } }
  }, [items, loading, progress])

  const hasSaveData = progress.hasSaveData

  const incompleteCount = hasSaveData
    ? [...secretNotes, ...journalScraps].filter(n => n.seen && n.completed === false).length
    : 0

  const tabs = [
    { id: 'all', label: 'All', count: totals.total },
    ...(hasSaveData ? [{ id: 'needed', label: 'Still Needed', count: totals.total - totals.done }] : []),
    ...(hasSaveData && incompleteCount > 0 ? [{ id: 'incomplete', label: 'Not Completed', count: incompleteCount }] : []),
  ]

  return (
    <PagePanel>
      <div className="snote-page">
        <header className="snote-header">
          <h1 className="snote-title">Secret Notes</h1>
          {hasSaveData && (
            <div className="snote-score-block">
              <div className="snote-score-numbers">
                <span className="snote-score-done">{totals.done}</span>
                <span className="snote-score-divider">/</span>
                <span className="snote-score-max">{totals.total}</span>
                <span className="snote-score-label">found</span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="snote-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track which notes and journal scraps you've found.
          </button>
        )}

        <div className="snote-filter-toggle" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`snote-filter-btn ${filter === tab.id ? 'snote-filter-btn--active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="snote-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="snote-sections">
          <NoteSection title="Secret Notes"   notes={secretNotes}   filter={hasSaveData ? filter : 'all'} openModal={openModal} hasSaveData={hasSaveData} />
          <NoteSection title="Journal Scraps" notes={journalScraps} filter={hasSaveData ? filter : 'all'} openModal={openModal} hasSaveData={hasSaveData} />
        </div>
      </div>
    </PagePanel>
  )
}

export default SecretNotesPage

import { useMemo, useState } from 'react'
import PagePanel from '../common/PagePanel'
import { usePlayer } from '../../contexts/PlayerContext'
import { useEntities } from '../../contexts/EntityContext'
import UniversalModalButton from '../common/UniversalModalButton'
import './IslandShrinePage.css'

const POSITION_LABELS = {
  top:    'North',
  left:   'West',
  right:  'East',
  bottom: 'South',
}

const POSITIONS = ['top', 'left', 'right', 'bottom']

function PedestalTile({ position, gemEntity, placed, revealed, hasSaveData }) {
  const showGem = !hasSaveData || placed || revealed

  return (
    <div className={`shrine-pedestal shrine-pedestal--${position}`}>
      <div className="shrine-pedestal-label">{POSITION_LABELS[position]}</div>
      {showGem && gemEntity ? (
        <UniversalModalButton
          item={gemEntity}
          variant="collection-tile"
          donated={hasSaveData ? placed : null}
          frameColor="tan"
          tileSize="sm"
        />
      ) : (
        <div className={`shrine-pedestal-unknown ${hasSaveData && placed ? 'shrine-pedestal-unknown--placed' : ''}`}>
          <span className="shrine-pedestal-qmark">?</span>
        </div>
      )}
    </div>
  )
}

function IslandShrinePage() {
  const { player } = usePlayer()
  const { items: allItems, loading } = useEntities()
  const saveData = player.saveData
  const hasSaveData = saveData != null
  const [revealed, setRevealed] = useState(false)

  const { gemEntities, pedestalStates, placedCount, complete } = useMemo(() => {
    const byGameId = {}
    for (const item of (allItems ?? [])) {
      if (item.gameId) byGameId[item.gameId] = item
    }

    if (!hasSaveData || !saveData.islandShrine) {
      return { gemEntities: {}, pedestalStates: {}, placedCount: 0, complete: false }
    }

    const { puzzleFinished, pedestals } = saveData.islandShrine
    const gems = {}
    const states = {}
    let placed = 0

    for (const pos of POSITIONS) {
      const p = pedestals[pos]
      if (p) {
        const gameId = p.requiredItemId ? `(O)${p.requiredItemId}` : null
        gems[pos] = gameId ? (byGameId[gameId] ?? null) : null
        states[pos] = p.match === true
        if (p.match) placed++
      } else {
        gems[pos] = null
        states[pos] = false
      }
    }

    return { gemEntities: gems, pedestalStates: states, placedCount: placed, complete: puzzleFinished }
  }, [allItems, hasSaveData, saveData])

  if (loading) {
    return <PagePanel><div className="island-shrine-loading">Loading…</div></PagePanel>
  }

  return (
    <PagePanel>
      <div className="island-shrine-page">
        <header className="island-shrine-header">
          <h1 className="island-shrine-title">Island Shrine</h1>
          {hasSaveData && (
            <div className={`shrine-status ${complete ? 'shrine-status--complete' : ''}`}>
              {complete ? 'Puzzle complete ✓' : `${placedCount} / 4 gems placed`}
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="island-shrine-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track your Island Shrine progress.
          </button>
        )}

        <div className="shrine-diamond-wrap">
          <div className="shrine-diamond">
            {POSITIONS.map(pos => (
              <PedestalTile
                key={pos}
                position={pos}
                gemEntity={gemEntities[pos]}
                placed={pedestalStates[pos]}
                revealed={revealed}
                hasSaveData={hasSaveData}
              />
            ))}
          </div>
        </div>

        {hasSaveData && !complete && (
          <div className="shrine-reveal-wrap">
            <button
              type="button"
              className={`shrine-reveal-btn ${revealed ? 'shrine-reveal-btn--active' : ''}`}
              onClick={() => setRevealed(r => !r)}
            >
              {revealed ? 'Hide Required Gems' : 'Reveal Required Gems'}
            </button>
          </div>
        )}

        <p className="shrine-note">
          Place the correct gem on each pedestal to complete the shrine puzzle.
        </p>
      </div>
    </PagePanel>
  )
}

export default IslandShrinePage

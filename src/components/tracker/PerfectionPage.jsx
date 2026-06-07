import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import PagePanel from '../common/PagePanel'
import { useEntities } from '../../contexts/EntityContext'
import { usePlayer } from '../../contexts/PlayerContext'
import { computePerfectionScore } from '../../utils/PerfectionScore'
import { usePageGoals } from '../../hooks/UsePageGoals'
import UniversalModalButton from '../common/UniversalModalButton'
import './PerfectionPage.css'
import './CollectionPage.css'

const EMPTY_SCORE = computePerfectionScore([], null)

function PercentBar({ pct }) {
  return (
    <div className="perf-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="perf-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CategoryRow({ cat, hasSaveData }) {
  const scoreText = hasSaveData
    ? cat.binary && cat.total <= 1
      ? (cat.done >= cat.total ? 'Yes' : 'No')
      : `${cat.done} / ${cat.total}`
    : `— / ${cat.total}`

  const pct = hasSaveData
    ? cat.binary && cat.total <= 1
      ? (cat.done >= cat.total ? 100 : 0)
      : cat.pct
    : 0

  const complete = hasSaveData && (cat.binary ? cat.done >= cat.total : cat.pct >= 100)

  return (
    <div className={`perf-category ${complete ? 'perf-category--complete' : ''}`}>
      <div className="perf-category-body">
        <div className="perf-category-header">
          <div className="perf-category-info">
            <span className="perf-category-check" aria-hidden="true">{complete ? '✓' : '○'}</span>
            <div className="perf-category-labels">
              <span className="perf-category-name">{cat.label}</span>
              <span className="perf-category-detail">{cat.detail}</span>
            </div>
          </div>
          <div className="perf-category-meta">
            <span className="perf-category-score">{scoreText}</span>
            <span className="perf-category-weight">{cat.weight}%</span>
          </div>
        </div>
        {hasSaveData && (cat.total > 1 || !cat.binary) && (
          <>
            <PercentBar pct={pct} />
            {cat.binary && !complete && (
              <span className="perf-category-binary-note">Points only count once all are collected.</span>
            )}
          </>
        )}
      </div>
      {cat.linkPath
        ? <Link to={cat.linkPath} className="perf-category-gutter perf-category-gutter--link" title="Open tracker">→</Link>
        : <span className="perf-category-gutter" />
      }
    </div>
  )
}

function PerfectionPage() {
  const { items, loading } = useEntities()
  const { player } = usePlayer()
  const saveData = player.saveData
  const hasSaveData = saveData != null

  const pageGoals = usePageGoals()
  const score = useMemo(() => {
    if (loading) return EMPTY_SCORE
    return computePerfectionScore(items, saveData)
  }, [items, loading, saveData])

  return (
    <PagePanel>
      <div className="perf-page">
        <header className="perf-header">
          <div className="collection-title-row">
            <h1 className="perf-title">Perfection</h1>
            {pageGoals.length > 0 && (
              <div className="collection-page-goals">
                {pageGoals.map(g => <UniversalModalButton key={g.id} item={g} variant="inline" />)}
              </div>
            )}
          </div>
          <p className="perf-subtitle">
            Measured by the tracker statue in Qi's Walnut Room. Each category contributes a weighted percentage toward 100%.
          </p>

          {hasSaveData && (
            <div className="perf-score-block">
              <div className="perf-score-numbers">
                <span className="perf-score-value">{score.overallPct}</span>
                <span className="perf-score-max">/ 100%</span>
              </div>
              <PercentBar pct={score.overallPct} />
              {score.overallPct >= 100 && (
                <div className="perf-complete-badge">The Summit awaits!</div>
              )}
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="perf-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to see your Perfection score.
          </button>
        )}

        <div className="perf-categories">
          {score.categories.map(cat => (
            <CategoryRow key={cat.id} cat={cat} hasSaveData={hasSaveData} />
          ))}
        </div>

        <p className="perf-waiver-note">
          Fizz (Joja Special Services) sells Perfection Waivers for 500,000g each — each adds 1% to your score.
        </p>
      </div>
    </PagePanel>
  )
}

export default PerfectionPage

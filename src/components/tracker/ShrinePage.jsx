import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import PagePanel from '../common/PagePanel'
import { usePlayer } from '../../contexts/PlayerContext'
import { computeShrineScore } from '../../utils/ShrineScore'
import './ShrinePage.css'

function CandleRow({ count }) {
  return (
    <div className="shrine-candles" aria-label={`${count} of 4 candles lit`}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} className={`shrine-candle ${i < count ? 'shrine-candle--lit' : ''}`}>
          🕯
        </span>
      ))}
    </div>
  )
}

function ScoreRule({ rule }) {
  return (
    <li className={`shrine-rule ${rule.earned ? 'shrine-rule--earned' : ''}`}>
      <span className="shrine-rule-icon" aria-hidden="true">
        {rule.earned ? '✓' : '○'}
      </span>
      <div className="shrine-rule-body">
        <div className="shrine-rule-label">{rule.label}</div>
        {rule.detail && <div className="shrine-rule-detail">{rule.detail}</div>}
      </div>
      <span className="shrine-rule-points">
        {rule.earned ? `+${rule.maxPoints}` : `${rule.maxPoints}pt`}
      </span>
    </li>
  )
}

function RuleList({ rules }) {
  return (
    <ul className="shrine-rule-list">
      {rules.map(r => <ScoreRule key={r.id} rule={r} />)}
    </ul>
  )
}

function Category({ category }) {
  return (
    <section className="shrine-category">
      <header className="shrine-category-header">
        <h2 className="shrine-category-name">{category.name}</h2>
        <span className="shrine-category-score">
          {category.earned} / {category.max}
        </span>
      </header>
      {category.summary && <div className="shrine-category-summary">{category.summary}</div>}
      {category.groups && (
        <div className="shrine-group-stack">
          {category.groups.map((g, i) => (
            <div key={g.id}>
              {i > 0 && <div className="shrine-group-divider"><span>OR</span></div>}
              <div className={`shrine-group ${g.active ? 'shrine-group--active' : 'shrine-group--inactive'}`}>
                <div className="shrine-group-header">
                  <span className="shrine-group-name">{g.name}</span>
                  {g.active && <span className="shrine-group-badge">Your path</span>}
                </div>
                {g.note && <div className="shrine-group-note">{g.note}</div>}
                {g.rules.length > 0 && <RuleList rules={g.rules} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {category.rules && category.rules.length > 0 && (
        <RuleList rules={category.rules} />
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <div className="shrine-empty">
      <h1 className="shrine-empty-title">Grandpa's Shrine</h1>
      <p className="shrine-empty-text">
        Upload your save file to see how you measure up to Grandpa's expectations.
        We'll show your current score, what you've already earned, and what's left
        to do for each of the four candles.
      </p>
      <Link to="/" className="shrine-empty-link">Go to home →</Link>
    </div>
  )
}

function ShrinePage() {
  const { player } = usePlayer()
  const score = useMemo(() => computeShrineScore(player.saveData), [player.saveData])

  if (!score) {
    return (
      <PagePanel>
        <EmptyState />
      </PagePanel>
    )
  }

  const candleLabel = score.candles === 1 ? 'candle' : 'candles'
  const gameScoreNote = score.gameScore != null
    ? (score.gameScore === score.computedTotal
        ? "Matches the game's evaluation."
        : `Game reports ${score.gameScore} — discrepancies usually mean we're missing a rule or a mail flag.`)
    : "Game evaluation runs at the start of year 3; once it does, we'll show the official total here too."

  return (
    <PagePanel>
      <div className="shrine-page">
        <header className="shrine-header">
          <h1 className="shrine-title">Grandpa's Shrine</h1>
          <p className="shrine-subtitle">
            At the start of Year 3, Grandpa returns to judge your accomplishments.
            Each candle requires more dedication — 4 candles is the gold standard.
          </p>
          <div className="shrine-score-block">
            <div className="shrine-score-numbers">
              <span className="shrine-score-total">{score.computedTotal}</span>
              <span className="shrine-score-divider">/</span>
              <span className="shrine-score-max">{score.maxTotal}</span>
              <span className="shrine-score-label">points</span>
            </div>
            <CandleRow count={score.candles} />
            <div className="shrine-candle-count">
              {score.candles} {candleLabel} lit
            </div>
          </div>
          <div className="shrine-game-score-note">{gameScoreNote}</div>
        </header>

        <div className="shrine-categories">
          {score.categories.map(c => <Category key={c.id} category={c} />)}
        </div>
      </div>
    </PagePanel>
  )
}

export default ShrinePage

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { usePlayer } from '../../contexts/PlayerContext'
import { computeTodos } from '../../utils/TodoEngine'
import { toTitleCase } from '../../utils/Formatters'
import { computeNotifications, computeDailyConditions } from '../../utils/NotificationEngine'
import { useTodoFilters, TODO_CATEGORIES } from '../../hooks/UseTodoFilters'
import './TodoPage.css'

const URGENCY_ICON = {
  Critical: '🔴',
  High:     '🟠',
  Medium:   '🟡',
  Low:      '🟢',
  Lore:     '⬜',
}

const TIMING_LABEL = {
  now:      'Today',
  tomorrow: 'Tomorrow',
  soon:     null,   // daysUntil shown inline
  upcoming: null,
}

function NotificationStrip({ notifications, findById }) {
  if (!notifications.length) return null

  return (
    <div className="notif-strip">
      <h2 className="notif-heading">Notifications</h2>
      <ul className="notif-list">
        {notifications.map(n => {
          const entity = n.entityId ? findById(n.entityId) : null
          return (
            <li key={n.id} className={`notif-item notif-item--${n.timing}`}>
              <div className="notif-icon-wrap">
                {entity ? (
                  <UniversalModalButton item={entity} variant="default" iconSize={28} />
                ) : (
                  <div className="notif-icon-placeholder" />
                )}
              </div>
              <div className="notif-body">
                <span className="notif-title">{n.title}</span>
                {n.detail && <span className="notif-detail">{n.detail}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DailyConditionsPanel({ conditions }) {
  if (!conditions) return null
  const { luck, valleyToday, valleyTomorrow, islandToday, islandTomorrow } = conditions

  return (
    <div className="daily-panel">
      <div className="daily-col-headers">
        <span />
        <span className="daily-col-header">Today</span>
        <span className="daily-col-header">Tomorrow</span>
      </div>
      <div className="daily-table">
        {luck !== null && (
          <div className={`daily-row ${luck.today?.className ?? ''}`}>
            <span className="daily-label">Luck</span>
            <span className="daily-value">{luck.today ? `${luck.today.icon} ${luck.today.label}` : '—'}</span>
            <span className={`daily-value ${luck.tomorrow?.className ?? ''}`}>{luck.tomorrow ? `${luck.tomorrow.icon} ${luck.tomorrow.label}` : '—'}</span>
          </div>
        )}
        {(valleyToday || valleyTomorrow) && (
          <div className="daily-row">
            <span className="daily-label">Valley</span>
            <span className="daily-value">{valleyToday ? `${valleyToday.icon} ${valleyToday.label}` : '—'}</span>
            <span className="daily-value daily-value--muted">{valleyTomorrow ? `${valleyTomorrow.icon} ${valleyTomorrow.label}` : '—'}</span>
          </div>
        )}
        {(islandToday || islandTomorrow) && (
          <div className="daily-row">
            <span className="daily-label">Island</span>
            <span className="daily-value">{islandToday ? `${islandToday.icon} ${islandToday.label}` : '—'}</span>
            <span className="daily-value daily-value--muted">{islandTomorrow ? `${islandTomorrow.icon} ${islandTomorrow.label}` : '—'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TodoItem({ todo, findById }) {
  const entity = todo.entityId ? findById(todo.entityId) : null

  return (
    <li className={`todo-item todo-item--${todo.urgencyLabel.toLowerCase()}`}>
      <div className="todo-urgency-dot" title={todo.urgencyLabel}>
        {URGENCY_ICON[todo.urgencyLabel]}
      </div>

      <div className="todo-icon-wrap">
        {entity ? (
          <UniversalModalButton item={entity} variant="default" iconSize={32} />
        ) : (
          <div className="todo-icon-placeholder" />
        )}
      </div>

      <div className="todo-body">
        <span className="todo-title">{toTitleCase(todo.title)}</span>
        {todo.detail && <span className="todo-detail">{todo.detail}</span>}
        {todo.goals?.length > 0 && (
          <span className="todo-goals">
            {todo.goals.map(g => {
              const goalEntity = findById(g.id)
              return (
                <span key={g.id} className="todo-goal-tag" data-earned={g.earned ? 'true' : 'false'}>
                  {goalEntity ? (
                    <UniversalModalButton
                      item={goalEntity}
                      variant="inline"
                      label={g.label}
                      stopPropagation
                      goalEarned={g.earned ?? false}
                    />
                  ) : g.label}
                </span>
              )
            })}
          </span>
        )}
      </div>

      <div className="todo-meta">
        {todo.deadline && (
          <span className="todo-deadline">{todo.deadline}</span>
        )}
        {todo.link && (
          <Link to={todo.link} className="todo-link">
            View →
          </Link>
        )}
      </div>
    </li>
  )
}

function TodoPage() {
  const { items, findById, getVillagerGifts, loading } = useEntities()
  const progress = useProgress()
  const { player } = usePlayer()
  const { enabled, toggle, isVisible } = useTodoFilters()

  const currentDate = progress.saveDate

  const todos = useMemo(
    () => computeTodos(items, progress, player.saveData, getVillagerGifts),
    [items, progress, player.saveData, getVillagerGifts],
  )

  const notifications = useMemo(
    () => currentDate ? computeNotifications(items, currentDate) : [],
    [items, currentDate],
  )

  const dailyConditions = useMemo(
    () => computeDailyConditions(player.saveData),
    [player.saveData],
  )

  const visibleTodos = useMemo(
    () => todos.filter(t => isVisible(t)),
    [todos, isVisible],
  )

  const dateLabel = currentDate
    ? `${currentDate.season.charAt(0).toUpperCase() + currentDate.season.slice(1)} ${currentDate.day}, Year ${currentDate.year}`
    : null

  if (loading) {
    return <PagePanel><div className="todo-loading">Loading…</div></PagePanel>
  }

  if (!progress.hasSaveData) {
    return (
      <PagePanel>
        <div className="todo-page">
          <header className="todo-header">
            <h1 className="todo-title-heading">To-Do</h1>
          </header>
          <div className="todo-no-save">
            <div className="todo-no-save-icon">📋</div>
            <p className="todo-no-save-text">
              Upload your save file to see a personalized, priority-ranked to-do list based on your
              current progress, season, and upcoming deadlines.
            </p>
            <button
              type="button"
              className="todo-upload-btn"
              onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
            >
              Upload Save File
            </button>
          </div>
        </div>
      </PagePanel>
    )
  }

  const criticalCount = visibleTodos.filter(t => t.urgencyLabel === 'Critical').length
  const highCount = visibleTodos.filter(t => t.urgencyLabel === 'High').length

  return (
    <PagePanel>
      <div className="todo-page">
        <header className="todo-header">
          <div className="todo-header-top">
            <h1 className="todo-title-heading">To-Do</h1>
            {dateLabel && <span className="todo-save-date">{dateLabel}</span>}
          </div>
          {visibleTodos.length > 0 && (criticalCount > 0 || highCount > 0) && (
            <p className="todo-summary">
              {criticalCount > 0 && (
                <span className="todo-summary-critical">{criticalCount} critical</span>
              )}
              {criticalCount > 0 && highCount > 0 && ' · '}
              {highCount > 0 && (
                <span className="todo-summary-high">{highCount} high priority</span>
              )}
              {' '}{criticalCount + highCount === 1 ? 'item needs' : 'items need'} attention
            </p>
          )}
        </header>

        {(notifications.length > 0 || dailyConditions) && (
          <div className="notif-grid">
            <NotificationStrip notifications={notifications} findById={findById} />
            <DailyConditionsPanel conditions={dailyConditions} />
          </div>
        )}

        <div className="todo-filters" role="group" aria-label="Filter categories">
          {TODO_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`todo-filter-btn ${enabled[cat.id] ?? cat.defaultOn ? 'todo-filter-btn--on' : 'todo-filter-btn--off'}`}
              onClick={() => toggle(cat.id)}
              aria-pressed={enabled[cat.id] ?? cat.defaultOn}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {visibleTodos.length === 0 ? (
          <div className="todo-empty">
            <div className="todo-empty-icon">✅</div>
            <p>
              {todos.length > 0
                ? 'Nothing to show — try enabling more categories above.'
                : 'Nothing urgent right now — you\'re in great shape!'}
            </p>
          </div>
        ) : (
          <>
            <div className="todo-legend">
              {Object.entries(URGENCY_ICON).map(([label, icon]) => (
                <span key={label} className="todo-legend-item">
                  {icon} {label}
                </span>
              ))}
            </div>
            <ul className="todo-list">
              {visibleTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  findById={findById}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </PagePanel>
  )
}

export default TodoPage

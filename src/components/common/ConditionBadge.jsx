import { useState } from 'react'
import { formatConditionClauses } from '../../utils/Formatters'
import { evaluateCondition } from '../../utils/ConditionEvaluator'
import { usePlayer } from '../../contexts/PlayerContext'
import { useEntities } from '../../contexts/EntityContext'

/**
 * Renders a JSON Logic condition as qualifier badge(s).
 *
 * Single clause: renders one badge inline, no interaction.
 * Multiple clauses: renders a "▸ N Requirements" toggle button.
 *   The expanded clause list is rendered via the `expanded` render prop,
 *   allowing the caller to place it as a sibling row in a table layout:
 *
 *   <ConditionBadge condition={src.condition}>
 *     {(clauses, open) => open && <span className="source-entry ..."><td>{clauses}</td></span>}
 *   </ConditionBadge>
 */
function ConditionBadge({ condition, conditionItemNames, children }) {
  const [open, setOpen] = useState(false)
  const { player } = usePlayer()
  const { eventNames, achievementNames } = useEntities()
  const isMet = player?.saveLoaded ? evaluateCondition(condition, player) : null
  const clauses = formatConditionClauses(condition, conditionItemNames, eventNames, achievementNames)

  const metClass = isMet === true ? ' source-condition--met'
    : isMet === false ? ' source-condition--unmet'
    : ''

  if (clauses.length === 0) {
    if (!children) return null
    return children(null, null, false)
  }

  const badge = clauses.length === 1
    ? <span className={`source-qualifier source-condition${metClass}`}>{clauses[0]}</span>
    : (
      <button
        className={`source-qualifier source-condition source-condition--expandable${metClass}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {open ? `▾ ${clauses.length} Requirements` : `▸ ${clauses.length} Requirements`}
      </button>
    )

  const clauseElements = clauses.length > 1 ? (
    <div className="condition-expanded">
      {clauses.map((c, i) => (
        <span key={i} className="source-qualifier source-condition">{c}</span>
      ))}
    </div>
  ) : null

  if (!children) return badge

  return children(badge, clauseElements, open)
}

export default ConditionBadge

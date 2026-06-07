/**
 * Goal graph engine.
 *
 * Goals form a DAG:
 *   composite goals (Grandpa, Perfection)
 *     → leaf goals (Complete Fishing Collection, etc.)  [kind:'goal']
 *       → collections (Fishing Collection, etc.)         [kind:'collection']
 *         → todo action-types (fish-collection, etc.)   via collection.todoTypes
 *       → achievements                                   [kind:'achievement']
 *
 * Todos are tagged with every goal in the ancestry chain above the matching
 * collection/action-type. Deadline pressure propagates top-down.
 */

import { candlesForScore, computeShrineScore } from './ShrineScore'
import { computeAchievementProgress } from './AchievementProgress'
import { maxHeartsFor } from './FriendshipUtils'
import { computePerfectionScore } from './PerfectionScore'

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter']
const DAYS_PER_SEASON = 28

function toAbsoluteDay({ day, season, year }) {
  const seasonIdx = SEASON_ORDER.indexOf(season.toLowerCase())
  return (year - 1) * 4 * DAYS_PER_SEASON + seasonIdx * DAYS_PER_SEASON + day
}

function deadlinePressure(deadline, currentAbsDay) {
  if (!deadline || deadline.type === 'none') return 0

  if (deadline.type === 'year-end') {
    const evalYear = deadline.year ?? 2
    const deadlineAbs = toAbsoluteDay({ day: DAYS_PER_SEASON, season: 'winter', year: evalYear })

    if (currentAbsDay > deadlineAbs) {
      return deadline.recurring ? 0.25 : 0
    }

    const windowOpenAbs = toAbsoluteDay({ day: 1, season: 'spring', year: Math.max(1, evalYear - 1) })
    if (currentAbsDay < windowOpenAbs) return 0.05

    const windowSize = deadlineAbs - windowOpenAbs
    const elapsed = currentAbsDay - windowOpenAbs
    return Math.min(1, elapsed / windowSize)
  }

  if (deadline.type === 'season-end') {
    return 0.2
  }

  return 0
}

/**
 * Check if a single goal is earned based on its explicit criteria or ID-based rules.
 * Does NOT aggregate children — composite earned state is derived bottom-up separately.
 */
function isLeafGoalEarned(goal, saveData, allItems = [], progress = null) {
  if (!saveData) return false

  // Criteria-based — generic dispatch
  if (goal.criteria) {
    const { type, villager, canBeRomanced, petName, animalName, bundleNumber, itemCount, minItemsRequired } = goal.criteria
    if (type === 'bundle-complete') {
      if (!progress?.getBundleProgress) return false
      const prog = progress.getBundleProgress(bundleNumber, itemCount)
      if (!prog) return false
      const required = minItemsRequired ?? itemCount
      return prog.items.filter(Boolean).length >= required
    }
    if (type === 'friendship-max') {
      if (!saveData.friendships) return false
      const f = saveData.friendships[villager]
      if (!f) return false
      const status = f.status ?? 'Friendly'
      const max = maxHeartsFor(canBeRomanced, status)
      return Math.floor(f.points / 250) >= max
    }
    if (type === 'walnuts-threshold') {
      const threshold = goal.criteria.threshold ?? 100
      const found = saveData.goldenWalnuts ?? 0
      return found >= threshold
    }
    if (type === 'lore-complete') {
      const { eventKeys } = goal.criteria
      if (!eventKeys?.length) return false
      const seen = new Set((saveData.eventsSeen ?? []).map(String))
      return eventKeys.every(k => seen.has(String(k)))
    }
    if (type === 'pet-max') {
      const pet = (saveData.pets ?? []).find(p => p.name === petName)
      return pet ? pet.friendship >= 1000 : false
    }
    if (type === 'animal-max') {
      const animal = (saveData.farmAnimals ?? []).find(a => a.name === animalName)
      return animal ? animal.friendship >= 1000 : false
    }
  }

  // Achievement-backed goals: authoritative completion signal
  if (goal.completionAchievementId != null) {
    return (saveData.achievements ?? []).includes(goal.completionAchievementId)
  }

  // Perfection-category goals without a direct achievement: use computePerfectionScore
  if (goal.perfectionCategory) {
    const cat = perfectionCategoryFor(goal, saveData, allItems)
    return cat ? cat.done >= cat.total : false
  }

  // ID-based rules for goals with no other completion signal
  if (goal.id === 'goal-grandpa-4-candle') {
    const result = computeShrineScore(saveData)
    return result ? candlesForScore(result.computedTotal) >= 4 : false
  }

  return false
}

/**
 * Look up a perfection category result for a goal that has perfectionCategory set.
 * Returns the category object { done, total, pct, binary } or null.
 */
function perfectionCategoryFor(goal, saveData, allItems) {
  if (!goal.perfectionCategory || !saveData) return null
  const { categories } = computePerfectionScore(allItems, saveData)
  return categories.find(c => c.id === goal.perfectionCategory) ?? null
}

/**
 * Return { done, total } fraction for criteria-based goals that have a measurable range.
 * Returns null for binary goals (friendship-max villager) or when not computable.
 */
function leafGoalFraction(goal, saveData, allItems = [], progress = null) {
  if (!saveData) return null

  // Bundle goals: items filled vs required
  if (goal.criteria?.type === 'bundle-complete') {
    const { bundleNumber, itemCount, minItemsRequired } = goal.criteria
    if (!progress?.getBundleProgress) return null
    const prog = progress.getBundleProgress(bundleNumber, itemCount)
    if (!prog) return null
    const done = prog.items.filter(Boolean).length
    const total = minItemsRequired ?? itemCount
    return { done, total }
  }

  // Perfection-category goals: use computePerfectionScore for done/total
  if (goal.perfectionCategory) {
    const cat = perfectionCategoryFor(goal, saveData, allItems)
    if (!cat) return null
    return { done: cat.done, total: cat.total }
  }

  if (!goal.criteria) return null
  const { type, petName, animalName, eventKeys } = goal.criteria
  if (type === 'walnuts-threshold') {
    const threshold = goal.criteria.threshold ?? 100
    const found = saveData.goldenWalnuts ?? 0
    return { done: Math.min(found, threshold), total: threshold }
  }
  if (type === 'lore-complete') {
    if (!eventKeys?.length) return null
    const seen = new Set((saveData.eventsSeen ?? []).map(String))
    const done = eventKeys.filter(k => seen.has(String(k))).length
    return { done, total: eventKeys.length }
  }
  if (type === 'pet-max') {
    const pet = (saveData.pets ?? []).find(p => p.name === petName)
    if (!pet) return null
    return { done: Math.min(pet.friendship, 1000), total: 1000 }
  }
  if (type === 'animal-max') {
    const animal = (saveData.farmAnimals ?? []).find(a => a.name === animalName)
    if (!animal) return null
    return { done: Math.min(animal.friendship, 1000), total: 1000 }
  }
  return null
}

/**
 * Build a map of goalId → runtime goal state with inherited deadline pressure.
 * allItems must include both goal and collection entities.
 *
 * Each state includes:
 *   earned      — boolean, true when the goal is definitively complete
 *   percent     — 0–100 completion estimate (null when not computable)
 *   done/total  — raw counts when available
 */
export function computeGoalStates(goalEntities, saveData, progress, currentDate, allItems = []) {
  const currentAbsDay = toAbsoluteDay(currentDate)
  const states = new Map()

  // Pre-build indices for fast lookup during leaf evaluation
  const collectionById = new Map(allItems.filter(i => i.type === 'collection').map(c => [c.id, c]))
  const achProgressMap = (progress?.hasSaveData && allItems.length)
    ? computeAchievementProgress(allItems, progress)
    : new Map()

  // First pass: leaf earned state + progress fraction
  for (const goal of goalEntities) {
    const goalChildren = (goal.children ?? []).filter(c => c.kind === 'goal')
    const hasGoalChildren = goalChildren.length > 0

    // Always try isLeafGoalEarned first — it's authoritative for goals with a
    // direct check (criteria-based or ID-based). For goals that have goal-children
    // AND no direct check, derived aggregation runs in the second pass.
    const directEarned = isLeafGoalEarned(goal, saveData, allItems, progress)

    // Compute collection-based progress for goals whose completion maps to a collection
    let earned = directEarned
    let percent = null
    let done = null
    let total = null

    if (!earned) {
      // Criteria-based fraction (pet-max, animal-max, perfection-category)
      const fraction = leafGoalFraction(goal, saveData, allItems, progress)
      if (fraction) {
        done = fraction.done
        total = fraction.total
        percent = Math.round((done / total) * 100)
        if (done >= total) earned = true
      }
    }

    if (!earned) {
      // Collection-backed leaf: derive completion from the child collection
      const collectionChild = (goal.children ?? []).find(c => c.kind === 'collection')
      if (collectionChild) {
        const col = collectionById.get(collectionChild.id)
        if (col) {
          // Delegate to computeCollectionProgress for all cases (handles both
          // achievement-backed and bundle-based collections like Community Center)
          const colProg = progress?.hasSaveData
            ? computeCollectionProgress(col, allItems, progress)
            : null
          if (colProg) {
            done = colProg.done
            total = colProg.total
            percent = colProg.percent
            if (done >= total) earned = true
          }
        }
      }
    }

    const deadline = goal.deadline ?? { type: 'none' }
    const pressure = earned ? 0 : deadlinePressure(deadline, currentAbsDay)

    states.set(goal.id, {
      id: goal.id,
      name: goal.name,
      linkPath: goal.linkPath ?? null,
      deadline: goal.deadline,
      deadlinePressure: pressure,
      inheritedPressure: pressure,
      earned,
      percent,
      done,
      total,
      isLore: goal.isLore ?? false,
      subtype: goal.subtype ?? null,
      children: goal.children ?? [],
      villagerId: goal.villagerId ?? null,
      _hasGoalChildren: hasGoalChildren,
      _directEarned: directEarned,
    })
  }

  // Second pass: bottom-up composite earned aggregation + composite percent.
  // A composite is earned iff ALL its goal children are earned, OR its own
  // completionAchievementId is earned — whichever is more authoritative.
  // The achievement check is a permanent override: once the game awards it,
  // the goal stays earned regardless of any subsequent condition changes.
  const earnedAchievements = new Set(saveData?.achievements ?? [])
  const goalById = new Map(goalEntities.map(g => [g.id, g]))
  let changed = true
  while (changed) {
    changed = false
    for (const [goalId, state] of states) {
      if (state.earned) continue
      const goal = goalById.get(goalId)

      // Achievement override — permanent, takes priority over child evaluation
      if (goal?.completionAchievementId != null && earnedAchievements.has(goal.completionAchievementId)) {
        state.earned = true
        state.percent = 100
        state.inheritedPressure = 0
        changed = true
        continue
      }

      const goalChildren = state.children.filter(c => c.kind === 'goal')
      if (goalChildren.length === 0) continue

      const childStates = goalChildren.map(c => states.get(c.id)).filter(Boolean)
      const allChildrenEarned = childStates.every(cs => cs.earned)

      if (allChildrenEarned) {
        state.earned = true
        state.percent = 100
        state.done = childStates.length
        state.total = childStates.length
        state.inheritedPressure = 0
        changed = true
      } else if (state.percent === null) {
        // Derive percent from fraction of earned children
        const earnedCount = childStates.filter(cs => cs.earned).length
        state.done = earnedCount
        state.total = childStates.length
        state.percent = Math.round((earnedCount / childStates.length) * 100)
      }
    }
  }

  // Third pass: propagate pressure top-down through kind:'goal' edges (skip earned)
  const visited = new Set()
  const queue = [...states.values()].filter(s => !s.earned && s.deadlinePressure > 0)
  while (queue.length) {
    const parent = queue.shift()
    if (visited.has(parent.id)) continue
    visited.add(parent.id)

    for (const child of parent.children) {
      if (child.kind !== 'goal') continue
      const childState = states.get(child.id)
      if (!childState || childState.earned) continue

      const contributed = parent.inheritedPressure * (child.weight ?? 1)
      if (contributed > childState.inheritedPressure) {
        childState.inheritedPressure = contributed
        queue.push(childState)
      }
    }
  }

  return states
}

/**
 * Build a reverse index: todoType → Set<goalId> for all goals that reach
 * this todoType through kind:'collection' → collection.todoTypes, or
 * directly via kind:'action-type'.
 *
 * collectionEntities: items[] filtered to type:'collection'
 */
function buildTodoTypeIndex(goalStates, collectionEntities) {
  const collectionById = new Map(collectionEntities.map(c => [c.id, c]))
  // goalId → Set<todoType> it covers
  const goalTodoTypes = new Map()

  for (const [goalId, state] of goalStates) {
    const types = new Set()
    for (const child of state.children) {
      if (child.kind === 'action-type') {
        types.add(child.id)
      } else if (child.kind === 'collection') {
        const col = collectionById.get(child.id)
        if (col?.todoTypes) col.todoTypes.forEach(t => types.add(t))
      }
    }
    goalTodoTypes.set(goalId, types)
  }

  return goalTodoTypes
}

/**
 * For a given todo, find all goals in the ancestry chain —
 * leaf goals that cover this todo type (scoped to villager when applicable),
 * plus their composite ancestors.
 */
function findContributingGoals(todo, goalStates, goalTodoTypes) {
  const todoType = todo.type
  const villagerEntityId = todo.villagerEntityId ?? null

  // Find leaves: goals whose todoType set includes this type.
  // Villager-scoped goals (villagerId set) only match if the todo's villager matches.
  // Earned goals are excluded — if the friendship goal is complete, only the lore
  // goal (also scoped to this villager) should match, making it a pure Lore todo.
  const leafIds = new Set()
  for (const [goalId, types] of goalTodoTypes) {
    const state = goalStates.get(goalId)
    if (state?.earned) continue
    if (state.villagerId && state.villagerId !== villagerEntityId) continue
    if (types.has(todoType)) leafIds.add(goalId)
  }
  if (leafIds.size === 0) return []

  // Build parent index: goalId → [parentState]
  const parentIndex = new Map()
  for (const [, state] of goalStates) {
    for (const child of state.children) {
      if (child.kind !== 'goal') continue
      if (!parentIndex.has(child.id)) parentIndex.set(child.id, [])
      parentIndex.get(child.id).push(state)
    }
  }

  // BFS upward — only traverse ancestors of unearthed leaves, skip lore goals
  // (lore goals are leaves only; their ancestors aren't meaningful goal parents)
  const seen = new Set(leafIds)
  const queue = [...leafIds].filter(id => !goalStates.get(id)?.isLore)
  while (queue.length) {
    const id = queue.shift()
    for (const parentState of (parentIndex.get(id) ?? [])) {
      if (!seen.has(parentState.id) && !parentState.earned) {
        seen.add(parentState.id)
        queue.push(parentState.id)
      }
    }
  }

  // Build contributions
  const contributions = []
  for (const goalId of seen) {
    const state = goalStates.get(goalId)
    if (!state) continue
    // Skip earned non-leaf goals (composites like Great Friends, Perfection)
    if (state.earned && !leafIds.has(goalId)) continue

    contributions.push({
      id: goalId,
      label: state.name,
      linkPath: state.linkPath,
      urgencyContribution: Math.round(state.inheritedPressure * 100),
      earned: state.earned,
      isLore: state.isLore ?? false,
    })
  }

  return contributions.sort((a, b) => {
    const aLeaf = leafIds.has(a.id) ? 0 : 1
    const bLeaf = leafIds.has(b.id) ? 0 : 1
    if (aLeaf !== bLeaf) return aLeaf - bLeaf
    return b.urgencyContribution - a.urgencyContribution
  })
}

/**
 * Annotate todos with goals[] and boost urgencyScore.
 * collectionEntities: items[] filtered to type:'collection'
 */
export function annotateWithGoals(todos, goalStates, collectionEntities = []) {
  if (!goalStates || goalStates.size === 0) return todos

  const goalTodoTypes = buildTodoTypeIndex(goalStates, collectionEntities)

  return todos.map(todo => {
    const goalContributions = findContributingGoals(todo, goalStates, goalTodoTypes)
    if (goalContributions.length === 0) return todo

    // Collect unique goal subtypes for filter visibility
    const goalSubtypes = [...new Set(
      goalContributions
        .map(g => goalStates.get(g.id)?.subtype)
        .filter(Boolean)
    )]

    // If every contributing goal is lore, this is a lore todo — no score inflation
    const nonLoreGoals = goalContributions.filter(g => !g.isLore)
    const isLoreTodo = nonLoreGoals.length === 0

    if (isLoreTodo) {
      return {
        ...todo,
        urgencyScore: 5,
        urgencyLabel: 'Lore',
        goals: goalContributions,
        goalSubtypes,
      }
    }

    const maxContribution = Math.max(...nonLoreGoals.map(g => g.urgencyContribution))

    const boostedScore = maxContribution > 5
      ? Math.min(100, todo.urgencyScore + maxContribution)
      : todo.urgencyScore

    const boostedLabel =
      boostedScore >= 90 ? 'Critical'
      : boostedScore >= 60 ? 'High'
      : boostedScore >= 30 ? 'Medium'
      : 'Low'

    return {
      ...todo,
      urgencyScore: boostedScore,
      urgencyLabel: boostedLabel,
      goals: goalContributions,
      goalSubtypes,
    }
  })
}

/**
 * Compute completion progress for a collection entity.
 * Returns { done, total, percent } or null if no save data / not computable.
 *
 * Achievement-backed collections delegate to computeAchievementProgress.
 * Community Center (no achievement ID) is computed from bundle completion directly.
 */
export function computeCollectionProgress(collection, items, progress) {
  if (!progress.hasSaveData) return null

  // Community Center: count completed bundles, use ccIsComplete mail flag for earned state
  if (collection.id === 'collection-community-center') {
    const bundles = items.filter(i => i.type === 'bundle' && !i.goldCost)
    if (!bundles.length) return null
    let done = 0
    for (const bundle of bundles) {
      const itemCount = bundle.items?.length ?? 0
      const prog = progress.getBundleProgress(bundle.bundleNumber, itemCount)
      if (!prog) continue
      const required = bundle.minItemsRequired ?? itemCount
      const filled = prog.items.filter(Boolean).length
      if (filled >= required) done++
    }
    const total = bundles.length
    // Use authoritative mail flag for overall completion — game sets this when
    // the cutscene plays, which may lag slightly behind all bundles being filled
    const ccComplete = progress.hasMailFlag?.('ccIsComplete') ?? (done >= total)
    return {
      done: ccComplete ? total : done,
      total,
      percent: ccComplete ? 100 : Math.round((done / total) * 100),
      label: 'bundles complete',
    }
  }

  if (!collection.completionAchievementId) return null

  const achProgress = computeAchievementProgress(items, progress)
  const entry = achProgress.get(collection.completionAchievementId)
  if (!entry || entry.done == null || entry.total == null) return null

  return {
    done: entry.done,
    total: entry.total,
    percent: Math.round((entry.done / entry.total) * 100),
    label: entry.label,
  }
}

/**
 * Map an entity to the todo action-types it contributes to, plus an optional
 * villagerEntityId scope for types that are villager-specific.
 *
 * Returns { todoTypes: string[], villagerEntityId: string | null }
 */
function entityToTodoTypes(entity) {
  if (!entity) return null
  const { type, eventType, subtype } = entity

  if (type === 'event' && eventType === 'heart') {
    return { todoTypes: ['heart-event'], villagerEntityId: entity.villagersInvolved?.[0] ?? null }
  }
  if (type === 'villager') {
    return { todoTypes: ['villager-birthday', 'villager-gift', 'heart-event'], villagerEntityId: entity.id }
  }
  if (type === 'fish') {
    return { todoTypes: ['fish-collection', 'fish-bundle'], villagerEntityId: null }
  }
  if (type === 'artifact' || type === 'mineral') {
    return { todoTypes: ['museum'], villagerEntityId: null }
  }
  if (type === 'crop') {
    return { todoTypes: ['crop-bundle', 'full-shipment'], villagerEntityId: null }
  }
  if (type === 'bundle') {
    return { todoTypes: ['crop-bundle', 'fish-bundle'], villagerEntityId: null }
  }
  if (type === 'tv-show' && subtype === 'queen-of-sauce') {
    return { todoTypes: ['queen-of-sauce'], villagerEntityId: null }
  }
  if (entity.capabilities?.craftable) {
    return { todoTypes: ['crafting'], villagerEntityId: null }
  }
  return null
}

/**
 * Find all goals (and their ancestors) that an entity contributes to,
 * given the current goal states.
 *
 * Returns an array of { id, label, linkPath, earned } sorted leaves-first.
 */
export function findGoalsForEntity(entity, goalStates, collectionEntities) {
  const mapping = entityToTodoTypes(entity)
  if (!mapping) return []

  const goalTodoTypes = buildTodoTypeIndex(goalStates, collectionEntities)

  // Synthesise a minimal todo-like object so we can reuse findContributingGoals
  const pseudoTodo = {
    type: mapping.todoTypes[0],
    villagerEntityId: mapping.villagerEntityId,
  }

  // For entities that map to multiple todo types (villager, crop), union the results
  const allGoalIds = new Set()
  const allContributions = new Map()

  for (const todoType of mapping.todoTypes) {
    const contributions = findContributingGoals(
      { type: todoType, villagerEntityId: mapping.villagerEntityId },
      goalStates,
      goalTodoTypes,
    )
    for (const c of contributions) {
      if (!allGoalIds.has(c.id)) {
        allGoalIds.add(c.id)
        allContributions.set(c.id, c)
      }
    }
  }

  return [...allContributions.values()]
}

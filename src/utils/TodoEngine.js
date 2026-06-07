/**
 * To-Do priority engine.
 *
 * Generates time-sensitive action items from save data + entity catalog,
 * scores them by urgency, and returns a sorted flat list.
 *
 * Each to-do item has the shape:
 * {
 *   id:           string           — unique key for React
 *   type:         string           — 'crop-bundle' | 'fish-bundle' | 'fish-collection' | 'museum' | 'full-shipment' | 'grandpa'
 *   title:        string           — human-readable action
 *   detail:       string | null    — secondary line (bundle name, season info, etc.)
 *   link:         string | null    — tracker path to navigate to
 *   urgencyScore: number           — higher = more urgent (0–100)
 *   urgencyLabel: string           — 'Critical' | 'High' | 'Medium' | 'Low'
 *   deadline:     string | null    — e.g. "Plant by Spring 14" or "Summer only"
 *   icon:         string | null    — entity icon path
 *   entityId:     string | null    — for modal navigation
 * }
 */

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter']
const DAYS_PER_SEASON = 28

/** Convert {day, season, year} to an absolute day number (year 1, spring 1 = 1). */
function toAbsoluteDay({ day, season, year }) {
  const seasonIdx = SEASON_ORDER.indexOf(season.toLowerCase())
  return (year - 1) * 4 * DAYS_PER_SEASON + seasonIdx * DAYS_PER_SEASON + day
}

/** Absolute day of the last day of a given season/year. */
function seasonEndAbsolute(season, year) {
  return toAbsoluteDay({ day: DAYS_PER_SEASON, season, year })
}

/**
 * Score an item given its last-action date and the current absolute day.
 *
 * Returns 0–100:
 *   - Before window: 10 (low urgency — actionable but no pressure)
 *   - Inside window: linear 20→90 as currentDay approaches lastActionDay
 *   - At/past lastActionDay: 95 (expired this season) or 100 (permanently missed)
 */
function scoreUrgency(currentDay, lastActionDay, windowOpenDay) {
  if (currentDay >= lastActionDay) return 95  // missed / last possible day
  if (currentDay < windowOpenDay) return 10   // far future
  const windowSize = lastActionDay - windowOpenDay
  if (windowSize <= 0) return 80
  const elapsed = currentDay - windowOpenDay
  return Math.round(20 + (elapsed / windowSize) * 70)
}

function urgencyLabel(score) {
  if (score >= 90) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 30) return 'Medium'
  return 'Low'
}

// ---------------------------------------------------------------------------
// Season helpers
// ---------------------------------------------------------------------------

/** Normalize "season_spring" → "spring", "spring" → "spring". */
function normSeason(s) {
  if (!s) return null
  return s.replace('season_', '').toLowerCase()
}

/** Return the seasons a fish can be caught at any location. */
function fishSeasons(fish) {
  const all = new Set()
  for (const src of (fish.sources ?? [])) {
    if (src.type !== 'fish') continue
    if (!src.seasons || src.seasons.length === 0) {
      // available year-round at this location
      return new Set(['spring', 'summer', 'fall', 'winter'])
    }
    for (const s of src.seasons) all.add(normSeason(s))
  }
  // Fall back to top-level seasons field
  if (all.size === 0 && fish.seasons?.length) {
    for (const s of fish.seasons) {
      const n = normSeason(s)
      if (n === 'all') return new Set(['spring', 'summer', 'fall', 'winter'])
      if (n) all.add(n)
    }
  }
  return all
}

/** True if a fish has a weather restriction. */
function fishWeatherLabel(fish) {
  if (!fish.weather || fish.weather === 'both' || fish.weather === 'any') return null
  if (fish.weather === 'rainy') return 'Rainy days only'
  if (fish.weather === 'sunny') return 'Sunny days only'
  return null
}

// ---------------------------------------------------------------------------
// Crop bundle generator
// ---------------------------------------------------------------------------

const PLACEHOLDER_GAME_IDS = new Set(['(O)0', '(O)2', '(O)10'])

function realBundleItems(bundle) {
  return (bundle.items ?? []).filter(i => !PLACEHOLDER_GAME_IDS.has(i.gameId))
}

/**
 * Generates to-dos for crops that are needed for incomplete bundles and have
 * a seasonal plant deadline.
 */
function generateCropBundleTodos(items, progress, currentDate) {
  if (!progress.hasSaveData || progress.isJojaRoute) return []

  const todos = []
  const currentAbsDay = toAbsoluteDay(currentDate)

  const bundles = items.filter(i => i.type === 'bundle' && !i.goldCost)
  const cropById = new Map(items.filter(i => i.type === 'crop').map(i => [i.id, i]))
  const cropByGameId = new Map(items.filter(i => i.type === 'crop').map(i => [i.gameId, i]))

  for (const bundle of bundles) {
    const bundleItems = realBundleItems(bundle)
    const required = bundle.minItemsRequired ?? bundleItems.length
    const prog = progress.getBundleProgress(bundle.bundleNumber, bundleItems.length)
    if (prog?.complete) continue

    const filledCount = prog ? prog.items.filter(Boolean).length : 0
    if (filledCount >= required) continue

    // How many more slots still need filling?
    const slotsNeeded = required - filledCount

    // Find crop slots that are unfilled
    const unfilledCropSlots = []
    for (let idx = 0; idx < bundleItems.length; idx++) {
      const slot = bundleItems[idx]
      if (prog && prog.items[idx]) continue  // already filled

      const crop = cropByGameId.get(slot.gameId) ?? cropById.get(slot.gameId)
      if (!crop) continue
      if (!crop.seasons?.length || !crop.growthDays) continue

      // Check if already owned (inventory shortcut)
      const owned = progress.getOwnedCount(crop.gameId)
      if (owned >= (slot.quantity ?? 1)) continue

      unfilledCropSlots.push({ slot, crop })
    }

    if (unfilledCropSlots.length === 0) continue

    // For each unfilled crop, compute the last-plant deadline
    for (const { slot, crop } of unfilledCropSlots) {
      const cropSeasons = (crop.seasons ?? []).map(normSeason).filter(Boolean)
      if (cropSeasons.length === 0) continue

      // Find the closest upcoming season window that can still yield a harvest
      // A harvest is possible if we can plant by (season_end - growthDays + 1)
      const lastPlantDayInSeason = DAYS_PER_SEASON - crop.growthDays + 1

      // Only surface if deadline is within the next ~2 seasons (don't spam far-future items)
      let bestScore = null
      let bestDeadline = null
      let bestSeason = null

      // Check current season and next 3 (enough to cover multi-season crops)
      for (let offset = 0; offset < 4; offset++) {
        const currentSeasonIdx = SEASON_ORDER.indexOf(currentDate.season.toLowerCase())
        const targetSeasonIdx = (currentSeasonIdx + offset) % 4
        const targetSeason = SEASON_ORDER[targetSeasonIdx]
        const targetYear = currentDate.year + Math.floor((currentSeasonIdx + offset) / 4)

        if (!cropSeasons.includes(targetSeason)) continue

        // Last possible plant date in this season/year
        const lastPlantAbs = toAbsoluteDay({ day: lastPlantDayInSeason, season: targetSeason, year: targetYear })

        // Don't surface if the last plant date is already past
        if (currentAbsDay > lastPlantAbs) continue

        // Window opens at start of this season (or current day if we're in it)
        const seasonStartAbs = toAbsoluteDay({ day: 1, season: targetSeason, year: targetYear })
        const windowOpen = Math.max(seasonStartAbs, currentAbsDay)

        const score = scoreUrgency(currentAbsDay, lastPlantAbs, windowOpen)

        // Take the nearest (most urgent) window
        if (bestScore === null || lastPlantAbs < (bestDeadline?.absDay ?? Infinity)) {
          bestScore = score
          bestSeason = targetSeason
          bestDeadline = {
            absDay: lastPlantAbs,
            label: `Plant by ${bestSeason.charAt(0).toUpperCase() + bestSeason.slice(1)} ${lastPlantDayInSeason}`,
          }
        }
        break  // Take the nearest valid window
      }

      if (bestScore === null) continue

      todos.push({
        id: `crop-bundle-${crop.id}-${bundle.id}`,
        type: 'crop-bundle',
        title: `Plant ${crop.name}`,
        detail: null,
        link: '/tracker/bundles',
        urgencyScore: bestScore,
        urgencyLabel: urgencyLabel(bestScore),
        deadline: bestDeadline?.label ?? null,
        icon: crop.icon ?? null,
        entityId: crop.id,
        quantity: slot.quantity ?? 1,
      })
    }
  }

  // Deduplicate: if the same crop appears in multiple bundles, keep highest-urgency
  const deduped = new Map()
  for (const todo of todos) {
    const key = `${todo.type}:${todo.entityId}`
    if (!deduped.has(key) || todo.urgencyScore > deduped.get(key).urgencyScore) {
      deduped.set(key, todo)
    }
  }

  return Array.from(deduped.values())
}

// ---------------------------------------------------------------------------
// Fish bundle/collection generator
// ---------------------------------------------------------------------------

/**
 * Generates to-dos for fish needed in bundles and/or not yet caught.
 * Seasonal fish are scored by how close to end-of-season we are.
 * Weather-restricted fish get urgency boosts when conditions match today or tomorrow.
 */
function generateFishTodos(items, progress, currentDate, weather) {
  if (!progress.hasSaveData) return []

  const valleyWeather = weather?.valley ?? null
  const isRainingToday = valleyWeather?.isRaining ?? false
  const isRainingTomorrow = valleyWeather?.isRainingTomorrow ?? false

  const todos = []
  const currentAbsDay = toAbsoluteDay(currentDate)
  const currentSeasonIdx = SEASON_ORDER.indexOf(currentDate.season.toLowerCase())

  const allFish = items.filter(i => i.type === 'fish' && !i.isTrapFish)
  const bundles = items.filter(i => i.type === 'bundle' && !i.goldCost)

  // Map gameId → bundle(s) that need this fish
  const fishBundleMap = new Map()
  for (const bundle of bundles) {
    const bundleItems = realBundleItems(bundle)
    const required = bundle.minItemsRequired ?? bundleItems.length
    const prog = progress.getBundleProgress(bundle.bundleNumber, bundleItems.length)
    if (prog?.complete) continue
    const filledCount = prog ? prog.items.filter(Boolean).length : 0
    if (filledCount >= required) continue

    for (let idx = 0; idx < bundleItems.length; idx++) {
      const slot = bundleItems[idx]
      if (prog && prog.items[idx]) continue
      if (!fishBundleMap.has(slot.gameId)) fishBundleMap.set(slot.gameId, [])
      fishBundleMap.get(slot.gameId).push(bundle)
    }
  }

  for (const fish of allFish) {
    // Legendary family fish only appear during the Extended Family special order — skip entirely
    if ((fish.contextTags ?? []).includes('fish_legendary_family')) continue

    const caught = progress.isFishCaught(fish.gameId)
    const neededForBundle = fishBundleMap.has(fish.gameId) && !progress.isJojaRoute

    if (caught && !neededForBundle) continue  // already caught and not needed

    const seasons = fishSeasons(fish)
    const isYearRound = seasons.has('spring') && seasons.has('summer') && seasons.has('fall') && seasons.has('winter')
    const isCurrentSeason = seasons.has(currentDate.season.toLowerCase())
    const requiresRain = fish.weather === 'rainy'
    const requiresSun = fish.weather === 'sunny'

    // Weather availability: rainy-only fish are catchable today/tomorrow based on forecast
    const catchableToday = !requiresRain || isRainingToday
    const catchableTomorrow = !requiresRain || isRainingTomorrow

    let score = neededForBundle ? 25 : 15  // base — bundle bumps importance
    let deadlineLabel = null

    if (!isYearRound && seasons.size > 0) {
      if (isCurrentSeason) {
        const seasonEndAbs = seasonEndAbsolute(currentDate.season, currentDate.year)
        const seasonStartAbs = toAbsoluteDay({ day: 1, season: currentDate.season, year: currentDate.year })
        score = scoreUrgency(currentAbsDay, seasonEndAbs, seasonStartAbs)
        if (neededForBundle) score = Math.min(100, score + 15)

        const seasonLabel = currentDate.season.charAt(0).toUpperCase() + currentDate.season.slice(1)

        if (requiresRain) {
          if (isRainingToday) {
            score = Math.min(100, score + 25)  // raining now — catch it today
            deadlineLabel = `${seasonLabel} · Raining now!`
          } else if (isRainingTomorrow) {
            score = Math.min(100, score + 15)  // rain forecast tomorrow
            deadlineLabel = `${seasonLabel} · Rain forecast tomorrow`
          } else {
            deadlineLabel = `${seasonLabel} · Rainy days only`
          }
        } else {
          deadlineLabel = `${seasonLabel} only`
        }
      } else {
        if (!neededForBundle) continue
        score = 20
        const availableIn = [...seasons].map(s => s.charAt(0).toUpperCase() + s.slice(1))
        deadlineLabel = `Available: ${availableIn.join(', ')}`
      }
    } else if (!isYearRound && seasons.size === 0) {
      continue
    } else {
      // Year-round fish
      if (requiresRain) {
        if (isRainingToday) {
          score = neededForBundle ? 55 : 45  // year-round but rain-dependent — notable when it's raining
          deadlineLabel = 'Raining now!'
        } else if (isRainingTomorrow) {
          score = neededForBundle ? 40 : 30
          deadlineLabel = 'Rain forecast tomorrow'
        } else {
          deadlineLabel = 'Rainy days only'
          if (!neededForBundle) continue  // year-round rainy fish with no deadline and not raining — not actionable
        }
      } else {
        deadlineLabel = null
        if (neededForBundle) score = 30
      }
    }

    const bundleNames = neededForBundle
      ? fishBundleMap.get(fish.gameId).map(b => b.name).join(', ')
      : null

    todos.push({
      id: `fish-${caught ? 'bundle' : 'catch'}-${fish.id}`,
      type: neededForBundle ? 'fish-bundle' : 'fish-collection',
      title: caught ? `Get ${fish.name} for bundle` : `Catch ${fish.name}`,
      detail: isCurrentSeason && !neededForBundle ? 'In season now' : null,
      link: neededForBundle ? '/tracker/bundles' : '/tracker/fishing',
      urgencyScore: score,
      urgencyLabel: urgencyLabel(score),
      deadline: deadlineLabel,
      icon: fish.icon ?? null,
      entityId: fish.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Museum / Field Office generator
// ---------------------------------------------------------------------------

/**
 * Generates to-dos for undonated museum artifacts + minerals that are
 * obtainable now (no season restriction) — lower priority, just completeness.
 */
function generateMuseumTodos(items, progress) {
  if (!progress.hasSaveData) return []

  const todos = []
  const donatable = items.filter(i => i.capabilities?.donatable && !progress.isMuseumDonated(i.gameId))

  // Only surface items the player has found but not donated yet
  for (const item of donatable) {
    const found = progress.isArtifactFound(item.gameId) || progress.isMineralFound(item.gameId)
    if (!found) continue

    todos.push({
      id: `museum-donate-${item.id}`,
      type: 'museum',
      title: `Donate ${item.name} to Museum`,
      detail: item.type === 'artifact' ? 'Artifact' : 'Mineral',
      link: '/tracker/museum',
      urgencyScore: 18,
      urgencyLabel: 'Low',
      deadline: null,
      icon: item.icon ?? null,
      entityId: item.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Full Shipment generator
// ---------------------------------------------------------------------------

import { FULL_SHIPMENT_NAMES } from './AchievementProgress'
import { computeShrineScore } from './ShrineScore'
import { computeGoalStates, annotateWithGoals } from './GoalEngine'
import { maxHeartsFor } from './FriendshipUtils'

/**
 * Generates to-dos for Full Shipment items not yet shipped that have a
 * seasonal availability.  Only surfaces seasonal items during their season.
 */
function generateFullShipmentTodos(items, progress, currentDate) {
  if (!progress.hasSaveData) return []

  const todos = []
  const currentAbsDay = toAbsoluteDay(currentDate)

  const shipmentItems = items.filter(i => FULL_SHIPMENT_NAMES.has(i.name) && !progress.isItemShipped(i.gameId))

  for (const item of shipmentItems) {
    const itemSeasons = (item.seasons ?? []).map(normSeason).filter(s => s && s !== 'all')
    const isYearRound = itemSeasons.length === 0 ||
      (item.seasons?.some(s => normSeason(s) === 'all'))

    // Only surface seasonal items during their season (don't flood the list with year-round items)
    if (isYearRound) continue

    const isCurrentSeason = itemSeasons.includes(currentDate.season.toLowerCase())
    if (!isCurrentSeason) continue

    const seasonEndAbs = seasonEndAbsolute(currentDate.season, currentDate.year)
    const seasonStartAbs = toAbsoluteDay({ day: 1, season: currentDate.season, year: currentDate.year })

    // Extra lead time for crops: last-harvest window
    let lastActionAbs = seasonEndAbs
    if (item.growthDays) {
      const lastPlantDay = DAYS_PER_SEASON - item.growthDays + 1
      if (lastPlantDay > 0) {
        lastActionAbs = toAbsoluteDay({ day: lastPlantDay, season: currentDate.season, year: currentDate.year })
      }
    }

    const score = Math.max(10, scoreUrgency(currentAbsDay, lastActionAbs, seasonStartAbs) - 10)  // slightly below bundle priority

    const seasonLabel = currentDate.season.charAt(0).toUpperCase() + currentDate.season.slice(1)
    todos.push({
      id: `full-shipment-${item.id}`,
      type: 'full-shipment',
      title: `Ship ${item.name}`,
      detail: null,
      link: '/tracker/full-shipment',
      urgencyScore: score,
      urgencyLabel: urgencyLabel(score),
      deadline: `${seasonLabel} only`,
      icon: item.icon ?? null,
      entityId: item.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Villager relationship generator
// ---------------------------------------------------------------------------

// Day 1 of any season is Monday. (day - 1) % 7 → 0=Mon … 6=Sun.
const DOW_SUNDAY = 6

/** Days until the next Sunday (gift-week reset). 0 if today is Sunday. */
function daysUntilSunday(day) {
  const dow = (day - 1) % 7
  return dow === DOW_SUNDAY ? 0 : 7 - dow - 1
}

/**
 * Generates to-dos for villager relationships:
 * - Upcoming birthdays (within 7 days) → high urgency
 * - Gift windows (gifts remaining this week for relationships below max) → low urgency
 */
function generateVillagerTodos(items, progress, getVillagerGifts, currentDate) {
  if (!progress.hasSaveData) return []

  const todos = []
  const { day, season, year } = currentDate
  const currentAbsDay = toAbsoluteDay(currentDate)

  const villagers = items.filter(i => i.type === 'villager')
  const itemById = new Map(items.map(i => [i.id, i]))

  for (const villager of villagers) {
    const friendship = progress.allFriendships[villager.name]
    if (!friendship) continue  // never met

    const hearts = Math.floor(friendship.points / 250)
    const status = friendship.status ?? 'Friendly'
    const isRomanceable = !!villager.canBeRomanced
    const maxHearts = maxHeartsFor(isRomanceable, status)
    if (hearts >= maxHearts) continue  // already at max — nothing to do

    const { birthday } = villager
    if (!birthday) continue

    // ── Birthday check ──────────────────────────────────────────────────────
    const birthdaySeason = birthday.season.toLowerCase()
    const birthdayDay = birthday.day

    // Compute absolute day of the next occurrence of this birthday
    const currentSeasonIdx = SEASON_ORDER.indexOf(season.toLowerCase())
    const birthdaySeasonIdx = SEASON_ORDER.indexOf(birthdaySeason)

    let birthdayAbsDay = toAbsoluteDay({ day: birthdayDay, season: birthdaySeason, year })
    if (birthdayAbsDay < currentAbsDay) {
      // Already passed this year — find next occurrence
      birthdayAbsDay = toAbsoluteDay({ day: birthdayDay, season: birthdaySeason, year: year + 1 })
    }

    const daysUntilBirthday = birthdayAbsDay - currentAbsDay
    const isBirthdayToday = daysUntilBirthday === 0
    const isBirthdaySoon = daysUntilBirthday <= 7

    // Find a loved gift the player owns (best-case detail line)
    const villagerGifts = getVillagerGifts(villager.id)
    const lovedGifts = villagerGifts.filter(g => g.preference === 'love')
    const ownedLovedGift = lovedGifts.find(g => {
      const entity = itemById.get(g.itemId)
      return entity && progress.isOwned(entity.gameId, entity)
    })
    const ownedLovedEntity = ownedLovedGift ? itemById.get(ownedLovedGift.itemId) : null

    if (isBirthdaySoon) {
      const birthdayLabel = isBirthdayToday
        ? `Today! (${birthdaySeason.charAt(0).toUpperCase() + birthdaySeason.slice(1)} ${birthdayDay})`
        : daysUntilBirthday === 1
          ? `Tomorrow (${birthdaySeason.charAt(0).toUpperCase() + birthdaySeason.slice(1)} ${birthdayDay})`
          : `In ${daysUntilBirthday} days (${birthdaySeason.charAt(0).toUpperCase() + birthdaySeason.slice(1)} ${birthdayDay})`

      const score = isBirthdayToday ? 95
        : daysUntilBirthday <= 1 ? 85
        : daysUntilBirthday <= 3 ? 70
        : 55

      const ownedLovedCount = ownedLovedEntity ? progress.getOwnedCount(ownedLovedEntity.gameId, ownedLovedEntity) : 0
      const detail = ownedLovedEntity
        ? `${hearts}/${maxHearts} hearts · Give ${ownedLovedEntity.name} (you have ${ownedLovedCount})`
        : `${hearts}/${maxHearts} hearts · Loved gifts needed`

      todos.push({
        id: `villager-birthday-${villager.id}`,
        type: 'villager-birthday',
        title: isBirthdayToday ? `Celebrate ${villager.name}'s Birthday` : `Prepare for ${villager.name}'s Birthday`,
        detail,
        link: null,
        urgencyScore: score,
        urgencyLabel: urgencyLabel(score),
        deadline: birthdayLabel,
        icon: villager.icon ?? null,
        entityId: villager.id,
        villagerEntityId: villager.id,
      })
      continue  // birthday to-do subsumes the weekly gift nudge
    }

    // ── Weekly gift window ──────────────────────────────────────────────────
    // Only surface if relationship is below max and the player has a loved gift on hand
    if (!ownedLovedEntity) continue

    // Check how many gifts have been given this week (not directly in save —
    // use days-until-Sunday as a proxy for "week is open/closing")
    const daysLeft = daysUntilSunday(day)

    // Low-urgency nudge: only show if week is ending and player has a loved gift
    if (daysLeft > 4) continue  // plenty of time, don't spam

    const ownedLovedCount = progress.getOwnedCount(ownedLovedEntity.gameId, ownedLovedEntity)
    const detail = `${hearts}/${maxHearts} hearts · Give ${ownedLovedEntity.name} (you have ${ownedLovedCount})`
    const score = daysLeft === 0 ? 40 : daysLeft <= 2 ? 30 : 22

    todos.push({
      id: `villager-gift-${villager.id}`,
      type: 'villager-gift',
      title: `Gift ${villager.name} this week`,
      detail,
      link: null,
      urgencyScore: score,
      urgencyLabel: urgencyLabel(score),
      deadline: daysLeft === 0 ? 'Last day of week' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in week`,
      icon: villager.icon ?? null,
      entityId: villager.id,
      villagerEntityId: villager.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Progression unlock generator
// ---------------------------------------------------------------------------

/**
 * Surfaces major progression gates the player hasn't unlocked yet.
 * Each item is a "unlock X to access Y" nudge, scored by how much
 * the player has already progressed toward the gate.
 */
function generateProgressionTodos(items, progress, saveData) {
  if (!progress.hasSaveData) return []

  const todos = []
  const mail = new Set(saveData?.mailReceived ?? [])

  // ── Skull Key (mine floor 120) ────────────────────────────────────────────
  // 'skullCave' mail is sent on first Skull Cavern entry — reliable proxy for having the Skull Key
  if (!mail.has('skullCave')) {
    todos.push({
      id: 'progression-skull-key',
      type: 'progression',
      title: 'Reach the bottom of the Mines',
      detail: 'Unlocks Skull Cavern and the Skull Key',
      link: '/tracker/achievements',
      urgencyScore: 22,
      urgencyLabel: 'Low',
      deadline: null,
      icon: null,
      entityId: null,
    })
  }

  // ── Rusty Key (60 museum donations) → Sewers → Mutant Carp ───────────────
  const donated = saveData?.museumPieces?.length ?? 0
  if (donated < 60) {
    todos.push({
      id: 'progression-rusty-key',
      type: 'progression',
      title: 'Donate 60 items to the Museum',
      detail: `${donated} / 60 items donated — unlocks Sewers`,
      link: '/tracker/museum',
      urgencyScore: 22,
      urgencyLabel: 'Low',
      deadline: null,
      icon: null,
      entityId: null,
    })
  }

  // ── Willy's boat (island access) ──────────────────────────────────────────
  if (!mail.has('willyBoatFixed')) {
    todos.push({
      id: 'progression-island-boat',
      type: 'progression',
      title: "Repair Willy's boat",
      detail: 'Unlocks Ginger Island and the island farm',
      link: null,
      urgencyScore: 22,
      urgencyLabel: 'Low',
      deadline: null,
      icon: null,
      entityId: null,
    })
  }

  // Qi's Walnut Room progression covered by goal-qi-walnut-room + golden-walnut todo

  return todos
}

// ---------------------------------------------------------------------------
// Pet & farm animal generator
// ---------------------------------------------------------------------------

const PET_MAX_FRIENDSHIP = 1000
const ANIMAL_MAX_FRIENDSHIP = 1000

/**
 * Generates to-dos for:
 *   - Petting your pet when friendship isn't maxed
 *   - Petting farm animals that haven't been petted today and aren't maxed
 *
 * Both score Medium — they're daily maintenance actions, not urgent deadlines,
 * but they contribute to Grandpa's shrine (pet) and produce quality (animals).
 */
function generateAnimalCareTodos(progress, saveData) {
  if (!progress.hasSaveData) return []
  const todos = []

  // ── Pet ────────────────────────────────────────────────────────────────────
  const pets = saveData?.pets ?? []
  const unmaxedPets = pets.filter(p => p.friendship < PET_MAX_FRIENDSHIP)
  for (const pet of unmaxedPets) {
    const slug = pet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    todos.push({
      id: `pet-care-${slug}`,
      type: 'pet-care',
      title: `Pet ${pet.name} today`,
      detail: 'Builds friendship and contributes to Grandpa\'s shrine score.',
      link: null,
      urgencyScore: 20,
      urgencyLabel: 'Low',
      deadline: 'Daily',
      icon: null,
      entityId: `goal-pet-${slug}`,
    })
  }

  // ── Farm animals ───────────────────────────────────────────────────────────
  const animals = saveData?.farmAnimals ?? []
  for (const animal of animals) {
    if (animal.friendship >= ANIMAL_MAX_FRIENDSHIP) continue  // maxed — nothing to do
    if (animal.wasPet) continue  // already petted today
    const slug = animal.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    todos.push({
      id: `animal-care-${slug}`,
      type: 'animal-care',
      title: `Tend to ${animal.name}`,
      detail: 'Pet and tend to their needs!',
      link: null,
      urgencyScore: 20,
      urgencyLabel: 'Low',
      deadline: 'Daily',
      icon: null,
      entityId: `goal-animal-${slug}`,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Heart event generator
// ---------------------------------------------------------------------------

const DAY_OF_WEEK_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Abbreviated day name from absolute day number (day 1 = Monday). */
function dowAbbrev(day) {
  return DAY_OF_WEEK_NAMES[(day - 1) % 7]
}

/**
 * Generates to-dos for heart events whose trigger conditions are currently met.
 *
 * For each unseen event: check friendship, season, weather, day-of-week, year,
 * required prior events, mail flags. If all non-time conditions pass, surface it.
 * Time windows (if any) appear in the deadline field — we don't have time-of-day.
 *
 * One todo per villager — their lowest-heart unseen triggerable event only.
 * Marriage variants excluded unless the player is married to that villager.
 */
function generateHeartEventTodos(items, progress, saveData, currentDate) {
  if (!progress.hasSaveData) return []

  const todos = []
  const { day, season, year } = currentDate
  const currentAbsDay = toAbsoluteDay(currentDate)

  // Normalize eventsSeen to a Set of strings for comparison against eventKey
  const eventsSeen = new Set((saveData?.eventsSeen ?? []).map(String))

  const isRainingToday = saveData?.weather?.valley?.isRaining ?? false
  const todayDow = dowAbbrev(day)
  const seasonCap = season.charAt(0).toUpperCase() + season.slice(1)

  const heartEvents = items.filter(i => i.type === 'event' && i.eventType === 'heart')
  const villagerById = new Map(items.filter(i => i.type === 'villager').map(i => [i.id, i]))

  // Group events by primary NPC using ev.npc (authoritative friendship owner),
  // not villagersInvolved[0] which may list scene participants first.
  const toVillagerId = name => name ? `vil-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : null
  const eventsByNpc = new Map()
  for (const ev of heartEvents) {
    const npcId = ev.npc ? toVillagerId(ev.npc) : (ev.villagersInvolved?.[0] ?? null)
    if (!npcId) continue
    if (!eventsByNpc.has(npcId)) eventsByNpc.set(npcId, [])
    eventsByNpc.get(npcId).push(ev)
  }
  for (const arr of eventsByNpc.values()) {
    arr.sort((a, b) => (a.heartLevel ?? 0) - (b.heartLevel ?? 0))
  }

  for (const [npcId, events] of eventsByNpc) {
    const villager = villagerById.get(npcId)
    if (!villager) continue

    const friendship = saveData?.friendships?.[villager.name]
    const friendshipPoints = friendship?.points ?? 0
    const isSpouse = friendship?.status === 'Married'

    for (const ev of events) {
      // Already seen
      if (eventsSeen.has(ev.eventKey)) continue

      // Marriage variant — only eligible if married to this villager
      if (ev.marriageVariant && !isSpouse) continue
      // Non-marriage variant with 14-heart requirement — skip if married (game uses marriage variant instead)
      if (!ev.marriageVariant && ev.heartLevel >= 14 && !isSpouse) continue

      // Mutually exclusive with a seen event
      if (ev.mutuallyExclusive?.some(k => eventsSeen.has(k))) continue

      // Friendship points requirement
      const reqFriendship = ev.requiredFriendship ?? []
      if (reqFriendship.some(r => {
        const f = saveData?.friendships?.[villagerById.get(r.npc)?.name]
        return (f?.points ?? 0) < r.points
      })) continue

      // Required prior events
      if (ev.requiredEvents?.some(k => !eventsSeen.has(k))) continue

      // Required mail flags
      if (ev.requiresMail?.some(flag => !progress.hasMailFlag(flag))) continue

      // Blocking mail flags (must NOT be set)
      if (ev.blockingMail?.some(flag => progress.hasMailFlag(flag))) continue

      // Year gate
      if (ev.year && year > ev.year) continue
      if (ev.year && year < ev.year) continue

      // Season gate — check today
      if (ev.seasons?.length && !ev.seasons.includes(season.toLowerCase())) continue

      // Day-of-week gate
      if (ev.daysOfWeek?.length && !ev.daysOfWeek.includes(todayDow)) continue

      // Weather gate
      if (ev.weather?.length) {
        const needsRain = ev.weather.includes('rainy')
        const needsSun  = ev.weather.includes('sunny')
        if (needsRain && !isRainingToday) continue
        if (needsSun  && isRainingToday)  continue
      }

      // All conditions met — this event is triggerable today
      // Build urgency: weather-gated events on rain days are rare → high; others medium
      let score = 55  // base: triggerable today
      let deadlineHint = null

      if (ev.weather?.includes('rainy') && isRainingToday) {
        score = 80  // rainy-day event and it's raining — relatively rare, act now
        deadlineHint = 'Rainy day — trigger today'
      } else if (ev.seasons?.length) {
        // Near end of the only valid season
        const seasonEndAbs = seasonEndAbsolute(season, year)
        const seasonStartAbs = toAbsoluteDay({ day: 1, season, year })
        score = Math.min(75, scoreUrgency(currentAbsDay, seasonEndAbs, seasonStartAbs))
        deadlineHint = `${seasonCap} only`
      } else if (ev.daysOfWeek?.length) {
        score = 65  // specific-day event — it's that day right now
      }

      // Time window hint
      if (ev.timeWindows?.length) {
        const windowStr = ev.timeWindows
          .map(w => `${formatGameTime(w.start)}–${formatGameTime(w.end)}`)
          .join(', ')
        deadlineHint = deadlineHint ? `${deadlineHint} · ${windowStr}` : windowStr
      }

      const locationHint = ev.locationLabel ?? null
      let deadlineFull = locationHint ?? null
      if (deadlineHint) {
        deadlineFull = deadlineFull ? `${deadlineFull} · ${deadlineHint}` : deadlineHint
      }

      todos.push({
        id: `heart-event-${ev.id}`,
        type: 'heart-event',
        title: `Attend ${ev.name ?? `${villager.name}'s ${ev.heartLevel}-heart event`}`,
        detail: null,
        link: '/villagers',
        urgencyScore: score,
        urgencyLabel: urgencyLabel(score),
        deadline: deadlineFull,
        icon: ev.icon ?? villager.icon ?? null,
        entityId: ev.id,
        villagerEntityId: npcId,
      })

      break  // Only the next triggerable event per villager
    }
  }

  return todos
}

// ---------------------------------------------------------------------------
// Grandpa's Shrine generator
// ---------------------------------------------------------------------------

/**
 * Grandpa evaluates at the start of Year 3 (end of Year 2 is the first deadline).
 * After that, the player can bring a diamond to the shrine for a re-evaluation any year.
 */
function generateGrandpaTodos(progress, saveData, currentDate) {
  if (!progress.hasSaveData) return []

  const shrineResult = computeShrineScore(saveData)
  if (!shrineResult) return []
  const { candles, computedTotal } = shrineResult
  if (candles >= 4) return []

  const currentAbsDay = toAbsoluteDay(currentDate)
  const year2EndAbs = toAbsoluteDay({ day: DAYS_PER_SEASON, season: 'winter', year: 2 })

  if (currentAbsDay <= year2EndAbs) {
    // Pre-first-evaluation: ramp urgency through Year 2
    const windowOpenAbs = toAbsoluteDay({ day: 1, season: 'spring', year: 2 })
    const score = scoreUrgency(currentAbsDay, year2EndAbs, windowOpenAbs)
    const cappedScore = Math.min(score, 80)  // soft cap — can re-evaluate later

    return [{
      id: 'grandpa-shrine',
      type: 'grandpa',
      title: "Prepare for Grandpa's Evaluation",
      detail: `${computedTotal} / 21 shrine points (${candles}/4 candles) — evaluated end of Year 2`,
      link: '/tracker/shrine',
      urgencyScore: cappedScore,
      urgencyLabel: urgencyLabel(cappedScore),
      deadline: 'End of Year 2',
      icon: null,
      entityId: null,
    }]
  }

  // Post-Year-2: player can bring a diamond to re-evaluate any time
  return [{
    id: 'grandpa-shrine-reevaluate',
    type: 'grandpa',
    title: "Re-evaluate Grandpa's Shrine",
    detail: `${computedTotal} / 21 shrine points (${candles}/4 candles) — bring a Diamond to the shrine`,
    link: '/tracker/shrine',
    urgencyScore: 35,
    urgencyLabel: 'Medium',
    deadline: 'Any time (costs 1 Diamond)',
    icon: null,
    entityId: null,
  }]
}

// ---------------------------------------------------------------------------
// Queen of Sauce generator
// ---------------------------------------------------------------------------

const QUEEN_OF_SAUCE_TOTAL_EPS = 32  // 2-year cycle, then repeats

/**
 * Generates a todo for "Watch Queen of Sauce" when:
 *   - Today is Sunday (episodes air on Sundays only)
 *   - The airing episode teaches a recipe the player hasn't learned
 *
 * Also surfaces next-Sunday previews when the upcoming episode is unlearned,
 * so the player can plan around it (low urgency).
 *
 * After Year 2, episodes repeat on the same schedule. Any still-unlearned
 * recipe re-airs on its scheduled Sunday in subsequent 2-year cycles.
 */
function generateQueenOfSauceTodos(items, progress, currentDate) {
  if (!progress.hasSaveData) return []

  const episodes = items.filter(i => i.type === 'tv-show' && i.subtype === 'queen-of-sauce')
  if (!episodes.length) return []

  // Build a map from episode absolute day (within a 2-year cycle) → episode
  // Episode airs on its year/season/dayOfSeason, repeating every 2 years.
  const foodById = new Map(items.filter(i => i.gameId).map(i => [i.gameId, i]))

  const currentAbsDay = toAbsoluteDay(currentDate)

  // Which 2-year cycle are we in?
  const daysPerCycle = 2 * 4 * DAYS_PER_SEASON
  const cycleStart = Math.floor((currentAbsDay - 1) / daysPerCycle) * daysPerCycle + 1

  const todos = []

  for (const ep of episodes) {
    // Absolute day this episode airs within the current cycle
    const epAbsInCycle = toAbsoluteDay({ day: ep.dayOfSeason, season: ep.season, year: ep.year })
    // Adjust to the current cycle
    const epAbs = cycleStart + (epAbsInCycle - 1)

    // Also check the next cycle in case we're near the boundary
    for (const offset of [0, daysPerCycle]) {
      const airDate = epAbs + offset
      const daysUntil = airDate - currentAbsDay

      if (daysUntil !== 0) continue  // only surface on the day it airs

      // Find recipe name via the food entity's cooking source
      const food = foodById.get(ep.taughtFoodGameId)
      const recipeSource = food?.sources?.find(s => s.type === 'cooking')
      const recipeName = recipeSource?.recipeName
      if (!recipeName) continue

      // Skip if already known
      if (progress.isRecipeKnown(recipeName)) continue

      const score = 90
      const deadline = 'Today only'

      todos.push({
        id: `queen-of-sauce-ep-${ep.episodeNumber}-${airDate}`,
        type: 'queen-of-sauce',
        title: `Watch Queen of Sauce: ${ep.name}`,
        detail: food ? `Teaches ${food.name} recipe` : null,
        link: '/tracker/cooking',
        urgencyScore: score,
        urgencyLabel: urgencyLabel(score),
        deadline,
        icon: ep.icon ?? null,
        entityId: ep.id,
      })

      break  // Only surface the soonest occurrence per episode
    }
  }

  return todos
}

// ---------------------------------------------------------------------------
// Festival / events generator
// ---------------------------------------------------------------------------

/**
 * Format a 24h game time (e.g. 900, 1700, 2400) to a readable string.
 * Game uses 2400 for midnight (end of day).
 */
function formatGameTime(t) {
  const h = Math.floor(t / 100)
  const m = t % 100
  const display = h === 24 ? 12 : h > 12 ? h - 12 : h === 0 ? 12 : h
  const ampm = h < 12 || h === 24 ? 'am' : 'pm'
  return m === 0 ? `${display}${ampm}` : `${display}:${String(m).padStart(2, '0')}${ampm}`
}

/**
 * Generates to-dos for upcoming festivals and multi-day events.
 * Surfaces:
 *   - Festivals happening today (Critical) with location + hours
 *   - Festivals starting tomorrow (High)
 *   - Festivals within the next 7 days (Medium)
 *   - Festivals within the next 14 days (Low, not spam-shown unless close)
 * Multi-day events show as "happening now" for all days of the event.
 */
function generateFestivalTodos(items, currentDate) {
  const todos = []
  const { day, season, year } = currentDate
  const currentAbsDay = toAbsoluteDay(currentDate)

  const festivals = items.filter(i => i.subtype === 'festival')

  for (const festival of festivals) {
    const festSeason = festival.season?.toLowerCase()
    if (!festSeason) continue

    // Single-day vs multi-day
    const startDay = festival.day ?? festival.dayStart
    const endDay = festival.dayEnd ?? startDay
    if (!startDay) continue

    // Find the next upcoming occurrence (this year or next)
    let festStartAbs = toAbsoluteDay({ day: startDay, season: festSeason, year })
    let festEndAbs   = toAbsoluteDay({ day: endDay,   season: festSeason, year })

    // If this occurrence has already fully passed, look at next year
    if (festEndAbs < currentAbsDay) {
      festStartAbs = toAbsoluteDay({ day: startDay, season: festSeason, year: year + 1 })
      festEndAbs   = toAbsoluteDay({ day: endDay,   season: festSeason, year: year + 1 })
    }

    const daysUntilStart = festStartAbs - currentAbsDay
    const isHappeningNow = currentAbsDay >= festStartAbs && currentAbsDay <= festEndAbs

    // Don't surface events more than 14 days away — would flood the list
    if (!isHappeningNow && daysUntilStart > 14) continue

    // Build deadline label
    const seasonCap = festSeason.charAt(0).toUpperCase() + festSeason.slice(1)
    let deadlineLabel
    let score

    if (isHappeningNow) {
      const { open, close } = festival.hours ?? {}
      const timeStr = open && close ? ` · ${formatGameTime(open)}–${formatGameTime(close)}` : ''
      const locationEntity = festival.parentLocation
      // Derive a friendly location name from the parentLocation id
      const locationMap = {
        'map-town': 'Town Square',
        'map-beach': 'Beach',
        'map-forest': 'Cindersap Forest',
        'map-desert': 'Calico Desert',
      }
      const locationName = locationMap[locationEntity] ?? null
      deadlineLabel = locationName ? `Today · ${locationName}${timeStr}` : `Today${timeStr}`
      score = 95
    } else if (daysUntilStart === 1) {
      deadlineLabel = `Tomorrow · ${seasonCap} ${startDay}`
      score = 75
    } else if (daysUntilStart <= 3) {
      deadlineLabel = `In ${daysUntilStart} days · ${seasonCap} ${startDay}`
      score = 60
    } else if (daysUntilStart <= 7) {
      deadlineLabel = `In ${daysUntilStart} days · ${seasonCap} ${startDay}`
      score = 40
    } else {
      deadlineLabel = `${seasonCap} ${startDay}`
      score = 20
    }

    // Multi-day events: clarify date range
    const isMultiDay = endDay !== startDay
    const title = isHappeningNow
      ? `${festival.name} — happening now`
      : `${festival.name}`
    const detail = isMultiDay
      ? `${seasonCap} ${startDay}–${endDay}`
      : null

    todos.push({
      id: `festival-${festival.id}`,
      type: 'festival',
      title,
      detail,
      link: null,
      urgencyScore: score,
      urgencyLabel: urgencyLabel(score),
      deadline: deadlineLabel,
      icon: festival.icon ?? null,
      entityId: festival.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Crafting recipes generator
// ---------------------------------------------------------------------------

/**
 * Surfaces crafting recipes the player knows but has never crafted.
 * Only shows recipes the player already has — no point nudging about unknown ones.
 * Low urgency (no deadline), but tagged to goal-crafting-recipes for Perfection pressure.
 */
function generateCraftingTodos(items, progress) {
  if (!progress.hasSaveData) return []

  const todos = []
  const craftable = items.filter(i =>
    i.capabilities?.craftable &&
    i.sources?.some(s => s.type === 'crafting') &&
    i.name !== 'Wedding Ring'
  )

  for (const item of craftable) {
    const src = item.sources.find(s => s.type === 'crafting')
    if (!src?.recipeName) continue
    if (!progress.isCraftingRecipeKnown(src.recipeName)) continue
    if (progress.isCraftingRecipeCrafted(src.recipeName)) continue

    todos.push({
      id: `crafting-${item.id}`,
      type: 'crafting',
      title: `Craft ${item.name}`,
      detail: 'Recipe known but never crafted',
      link: '/tracker/crafting',
      urgencyScore: 15,
      urgencyLabel: 'Low',
      deadline: null,
      icon: item.icon ?? null,
      entityId: item.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Cooking generator
// ---------------------------------------------------------------------------

/**
 * Surfaces cooking recipes the player knows but has never cooked.
 */
function generateCookingTodos(items, progress) {
  if (!progress.hasSaveData) return []

  const todos = []
  const cookable = items.filter(i =>
    i.capabilities?.cookable &&
    i.sources?.some(s => s.type === 'cooking')
  )

  for (const item of cookable) {
    const src = item.sources.find(s => s.type === 'cooking')
    if (!src?.recipeName) continue
    if (!progress.isRecipeKnown(src.recipeName)) continue
    if (progress.isRecipeCooked(item.gameId)) continue

    todos.push({
      id: `cooking-${item.id}`,
      type: 'cooking-recipe',
      title: `Cook ${item.name}`,
      detail: 'Recipe known but never cooked',
      link: '/tracker/cooking',
      urgencyScore: 15,
      urgencyLabel: 'Low',
      deadline: null,
      icon: item.icon ?? null,
      entityId: item.id,
    })
  }

  return todos
}

// ---------------------------------------------------------------------------
// Golden walnuts generator
// ---------------------------------------------------------------------------

/**
 * Surfaces a single todo when the player hasn't found all 130 Golden Walnuts.
 * Shown only once Willy's boat is repaired (island is accessible).
 */
function generateGoldenWalnutTodos(progress, saveData) {
  if (!progress.hasSaveData) return []

  const WALNUT_TOTAL = 130
  const found = saveData?.goldenWalnuts ?? 0
  if (found >= WALNUT_TOTAL) return []

  // Only surface after island is accessible
  if (!progress.hasMailFlag('willyBoatFixed')) return []

  const remaining = WALNUT_TOTAL - found
  const QI_ROOM_THRESHOLD = 100
  // Below 100: higher urgency to unlock Qi's room; above 100: low end-game priority
  const score = found >= QI_ROOM_THRESHOLD ? 12 : found >= 75 ? 30 : found >= 50 ? 22 : 16

  return [{
    id: 'golden-walnuts',
    type: 'golden-walnut',
    title: 'Find Golden Walnuts',
    detail: `${found} / ${WALNUT_TOTAL} found — ${remaining} remaining`,
    link: '/tracker/golden-walnuts',
    urgencyScore: score,
    urgencyLabel: urgencyLabel(score),
    deadline: null,
    icon: null,
    entityId: null,
  }]
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute the full to-do list for a character.
 *
 * @param {Array}  items       - full entity catalog from EntityContext
 * @param {Object} progress    - from useProgress()
 * @param {Object} saveData         - raw save data from PlayerContext (player.saveData)
 * @param {Function} getVillagerGifts - from EntityContext, returns [{itemId, preference}] for a villager
 * @returns {Array} sorted to-do items, highest urgencyScore first
 */
export function computeTodos(items, progress, saveData, getVillagerGifts, weather) {
  if (!progress.hasSaveData || !items?.length) return []

  const currentDate = progress.saveDate
  if (!currentDate) return []

  const rawTodos = [
    ...generateCropBundleTodos(items, progress, currentDate),
    ...generateFishTodos(items, progress, currentDate, weather ?? saveData?.weather),
    ...generateMuseumTodos(items, progress),
    ...generateFullShipmentTodos(items, progress, currentDate),
    ...generateVillagerTodos(items, progress, getVillagerGifts ?? (() => []), currentDate),
    ...generateProgressionTodos(items, progress, saveData),
    ...generateGrandpaTodos(progress, saveData, currentDate),
    ...generateQueenOfSauceTodos(items, progress, currentDate),
    ...generateAnimalCareTodos(progress, saveData),
    ...generateHeartEventTodos(items, progress, saveData, currentDate),
    ...generateCookingTodos(items, progress),
    ...generateCraftingTodos(items, progress),
    ...generateGoldenWalnutTodos(progress, saveData),
  ]

  // Build goal state from goal entities and annotate todos with goal contributions
  const goalEntities = items.filter(i => i.type === 'goal')
  const collectionEntities = items.filter(i => i.type === 'collection')
  const goalStates = computeGoalStates(goalEntities, saveData, progress, currentDate, items)
  const todos = annotateWithGoals(rawTodos, goalStates, collectionEntities)

  // Sort descending by urgencyScore, then alphabetically for stable ties
  todos.sort((a, b) => b.urgencyScore - a.urgencyScore || a.title.localeCompare(b.title))

  return todos
}

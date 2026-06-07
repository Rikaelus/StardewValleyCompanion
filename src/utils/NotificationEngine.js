/**
 * Notification engine — calendar awareness, not goal-driven.
 *
 * Returns items the player should know about today or soon:
 * festivals, scheduled visitors (Traveling Merchant, Bookseller), etc.
 *
 * Each notification:
 * {
 *   id:       string
 *   type:     'festival' | 'visitor'
 *   title:    string
 *   detail:   string | null   — location, hours, date range
 *   icon:     string | null
 *   entityId: string | null
 *   timing:   'now' | 'tomorrow' | 'soon' | 'upcoming'
 *   daysUntil: number         — 0 = today
 * }
 */

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter']
const DAYS_PER_SEASON = 28
const DOW_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function toAbsoluteDay({ day, season, year }) {
  const seasonIdx = SEASON_ORDER.indexOf(season.toLowerCase())
  return (year - 1) * 4 * DAYS_PER_SEASON + seasonIdx * DAYS_PER_SEASON + day
}

function formatGameTime(t) {
  const h = Math.floor(t / 100)
  const m = t % 100
  const display = h === 24 ? 12 : h > 12 ? h - 12 : h === 0 ? 12 : h
  const ampm = h < 12 || h === 24 ? 'am' : 'pm'
  return m === 0 ? `${display}${ampm}` : `${display}:${String(m).padStart(2, '0')}${ampm}`
}

function timing(daysUntil, isHappeningNow) {
  if (isHappeningNow) return 'now'
  if (daysUntil === 1) return 'tomorrow'
  if (daysUntil <= 3) return 'soon'
  return 'upcoming'
}

const LOCATION_NAMES = {
  'map-town':    'Town Square',
  'map-beach':   'Beach',
  'map-forest':  'Cindersap Forest',
  'map-desert':  'Calico Desert',
}

// ---------------------------------------------------------------------------
// Festivals
// ---------------------------------------------------------------------------

function festivalNotifications(items, currentDate) {
  const { day, season, year } = currentDate
  const currentAbsDay = toAbsoluteDay(currentDate)
  const notifications = []

  const festivals = items.filter(i => i.subtype === 'festival')

  for (const festival of festivals) {
    const festSeason = festival.season?.toLowerCase()
    if (!festSeason) continue

    const startDay = festival.day ?? festival.dayStart
    const endDay = festival.dayEnd ?? startDay
    if (!startDay) continue

    let festStartAbs = toAbsoluteDay({ day: startDay, season: festSeason, year })
    let festEndAbs   = toAbsoluteDay({ day: endDay,   season: festSeason, year })

    if (festEndAbs < currentAbsDay) {
      festStartAbs = toAbsoluteDay({ day: startDay, season: festSeason, year: year + 1 })
      festEndAbs   = toAbsoluteDay({ day: endDay,   season: festSeason, year: year + 1 })
    }

    const daysUntilStart = festStartAbs - currentAbsDay
    const isHappeningNow = currentAbsDay >= festStartAbs && currentAbsDay <= festEndAbs

    if (!isHappeningNow && daysUntilStart > 14) continue

    const seasonCap = festSeason.charAt(0).toUpperCase() + festSeason.slice(1)
    const isMultiDay = endDay !== startDay

    let detail
    if (isHappeningNow) {
      const { open, close } = festival.hours ?? {}
      const timeStr = open && close ? ` · ${formatGameTime(open)}–${formatGameTime(close)}` : ''
      const locName = LOCATION_NAMES[festival.parentLocation] ?? null
      const dateStr = isMultiDay ? ` · ${seasonCap} ${startDay}–${endDay}` : ''
      detail = [locName, timeStr ? timeStr.slice(3) : null, isMultiDay ? `${seasonCap} ${startDay}–${endDay}` : null]
        .filter(Boolean).join(' · ') || null
      if (locName || timeStr) {
        detail = `${locName ?? ''}${timeStr}${isMultiDay ? ` · ${seasonCap} ${startDay}–${endDay}` : ''}`.trim().replace(/^ · /, '')
      }
    } else {
      const dateLabel = isMultiDay
        ? `${seasonCap} ${startDay}–${endDay}`
        : `${seasonCap} ${startDay}`
      detail = daysUntilStart === 1 ? `Tomorrow · ${dateLabel}` : `In ${daysUntilStart} days · ${dateLabel}`
    }

    notifications.push({
      id: `notif-festival-${festival.id}`,
      type: 'festival',
      title: isHappeningNow ? `${festival.name} — today` : festival.name,
      detail,
      icon: festival.icon ?? null,
      entityId: festival.id,
      timing: timing(daysUntilStart, isHappeningNow),
      daysUntil: isHappeningNow ? 0 : daysUntilStart,
    })
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Scheduled visitors (Traveling Merchant, Bookseller)
// ---------------------------------------------------------------------------

/**
 * Parse a day spec from entity hours.days: ["Friday", "Sunday"] or ["1st", "15th"].
 * Returns true if the visitor is present on currentDate.
 */
function isVisitorPresentToday(entity, currentDate) {
  const days = entity.hours?.days ?? entity.locations?.[0]?.hours?.days ?? []
  if (!days.length) return false
  return isDayMatch(days, currentDate)
}

function isDayMatch(days, currentDate) {
  const { day } = currentDate
  const dow = DOW_NAMES[(day - 1) % 7]  // Monday=0

  for (const spec of days) {
    if (spec === 'Friday' || spec === 'Sunday' || DOW_NAMES.includes(spec)) {
      if (spec === dow) return true
    } else if (spec === '1st' && day === 1) {
      return true
    } else if (spec === '15th' && day === 15) {
      return true
    }
  }
  return false
}

function daysUntilNextVisit(days, currentDate) {
  for (let offset = 1; offset <= 28; offset++) {
    // Advance day, wrapping season/year
    const totalDay = toAbsoluteDay(currentDate) + offset
    const yearOffset = Math.floor((totalDay - 1) / (4 * DAYS_PER_SEASON))
    const dayInYear = ((totalDay - 1) % (4 * DAYS_PER_SEASON)) + 1
    const seasonIdx = Math.floor((dayInYear - 1) / DAYS_PER_SEASON)
    const dayInSeason = ((dayInYear - 1) % DAYS_PER_SEASON) + 1
    const candidate = {
      day: dayInSeason,
      season: SEASON_ORDER[seasonIdx],
      year: yearOffset + 1,
    }
    if (isDayMatch(days, candidate)) return offset
  }
  return null
}

function visitorNotifications(items, currentDate) {
  const notifications = []

  // Only entities with scheduled days — Bookseller and Traveling Merchant
  const scheduled = items.filter(i =>
    i.subtype === 'shop' &&
    (i.hours?.days?.length || i.locations?.[0]?.hours?.days?.length)
  )

  for (const entity of scheduled) {
    const days = entity.hours?.days ?? entity.locations?.[0]?.hours?.days ?? []
    const presentToday = isVisitorPresentToday(entity, currentDate)
    const nextIn = presentToday ? 0 : daysUntilNextVisit(days, currentDate)

    // Surface today and tomorrow only; upcoming is too noisy for non-festival visitors
    if (!presentToday && nextIn > 1) continue

    const { open, close } = entity.hours ?? entity.locations?.[0]?.hours ?? {}
    const timeStr = open && close ? `${formatGameTime(open)}–${formatGameTime(close)}` : null

    const locEntity = entity.locations?.[0]
    const locName = locEntity ? (LOCATION_NAMES[locEntity.id] ?? null) : null

    let detail = [locName, timeStr].filter(Boolean).join(' · ')
    if (!detail && entity.note) detail = entity.note

    notifications.push({
      id: `notif-visitor-${entity.id}`,
      type: 'visitor',
      title: presentToday ? `${entity.name} — in town today` : `${entity.name} — tomorrow`,
      detail: detail || null,
      icon: entity.icon ?? null,
      entityId: entity.id,
      timing: presentToday ? 'now' : 'tomorrow',
      daysUntil: nextIn ?? 1,
    })
  }

  return notifications
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Daily conditions (luck + weather)
// ---------------------------------------------------------------------------

const WEATHER_LABELS = {
  sun:       { label: 'Sunny',       icon: '☀️' },
  rain:      { label: 'Rainy',       icon: '🌧️' },
  storm:     { label: 'Thunderstorm',icon: '⛈️' },
  snow:      { label: 'Snowing',     icon: '❄️' },
  debris:    { label: 'Windy',       icon: '🍂' },
  greenRain: { label: 'Green Rain',  icon: '🌿' },
  festival:  { label: 'Festival',    icon: '🎉' },
  wedding:   { label: 'Wedding',     icon: '💍' },
}

const LUCK_TIERS = [
  { min:  0.07, label: 'Very Lucky',     icon: '🍀', className: 'luck--great' },
  { min:  0.02, label: 'Feeling Lucky',  icon: '✨', className: 'luck--good'  },
  { min: -0.02, label: 'Neutral',        icon: '😐', className: 'luck--neutral' },
  { min: -0.07, label: 'Not So Lucky',   icon: '😕', className: 'luck--bad'  },
  { min: -Infinity, label: 'Unlucky',    icon: '🌑', className: 'luck--awful' },
]

function luckTier(dailyLuck) {
  return LUCK_TIERS.find(t => dailyLuck >= t.min) ?? LUCK_TIERS[4]
}

function weatherLabel(key) {
  if (!key) return null
  return WEATHER_LABELS[key] ?? { label: key, icon: '🌤️' }
}

/**
 * Returns today's and tomorrow's at-a-glance conditions.
 * luck: { today, tomorrow } each being a tier object, or null if not available.
 * Returns null if saveData is missing.
 */
export function computeDailyConditions(saveData) {
  if (!saveData) return null

  const valley = saveData.weather?.valley ?? null
  const island = saveData.weather?.island ?? null

  // Luck: we only have today's value from the save.
  // Tomorrow's luck isn't stored — omit it rather than show stale data.
  const luckToday = saveData.dailyLuck != null ? luckTier(saveData.dailyLuck) : null
  const luck = (luckToday !== null) ? { today: luckToday, tomorrow: null } : null

  const valleyToday    = weatherLabel(valley?.today)
  const valleyTomorrow = weatherLabel(valley?.tomorrow)
  const islandToday    = weatherLabel(island?.today)
  const islandTomorrow = weatherLabel(island?.tomorrow)

  return { luck, valleyToday, valleyTomorrow, islandToday, islandTomorrow }
}

export function computeNotifications(items, currentDate) {
  if (!items?.length || !currentDate) return []

  const notifications = [
    ...festivalNotifications(items, currentDate),
    ...visitorNotifications(items, currentDate),
  ]

  // Sort: now first, then by daysUntil, then alphabetically
  notifications.sort((a, b) =>
    a.daysUntil - b.daysUntil || a.title.localeCompare(b.title)
  )

  return notifications
}

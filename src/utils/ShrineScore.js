/**
 * Grandpa's Shrine scoring.
 *
 * Implements the 21-point Year 3 evaluation as documented on the wiki:
 * https://stardewvalleywiki.com/Grandpa
 *
 *   Total Earnings (7): 50k=1, 100k=1, 200k=1, 300k=1, 500k=1, 1M=2
 *   Player Level (2):   30+ total skill levels (1), 50 total (1)
 *   Achievements (3):   Complete Collection, Master Angler, Full Shipment
 *   Friendship (4):     married + house upgraded twice; 8❤️×5; 8❤️×10; pet 999
 *   Other (5):          CC complete (1); CC ceremony (2); Skull Key (1); Rusty Key (1)
 *
 * Candle thresholds: 4=1, 8=2, 11=3, 12=4. Below 4 = 0 candles.
 *
 * The Joja path forfeits the 3 Community Center points — we still surface
 * them as an inactive "alternative" group so the user can see what they
 * gave up.
 */

// Achievement IDs from Stardew's Data/Achievements.json (1.6).
const ACHIEVEMENTS = {
  COMPLETE_COLLECTION: 5,
  MASTER_ANGLER: 26,
  FULL_SHIPMENT: 34,
}

// Wiki note: the 8-heart check uses 1975 points (≈7.9 hearts), not 2000.
const EIGHT_HEART_POINTS = 1975

function rule(id, label, earned, points, detail) {
  return { id, label, earned, points: earned ? points : 0, maxPoints: points, detail }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function scoreEarnings(save) {
  const earned = save.totalMoneyEarned ?? save.stats?.totalMoneyEarned ?? 0
  const tiers = [
    { threshold:   50000, points: 1 },
    { threshold:  100000, points: 1 },
    { threshold:  200000, points: 1 },
    { threshold:  300000, points: 1 },
    { threshold:  500000, points: 1 },
    { threshold: 1000000, points: 2 },
  ]
  const rules = tiers.map((t, i) => {
    const got = earned >= t.threshold
    const label = `Earn ${t.threshold.toLocaleString()}g total${t.points > 1 ? ` (${t.points} pts)` : ''}`
    const detail = got
      ? `Earned ${earned.toLocaleString()}g`
      : `Need ${(t.threshold - earned).toLocaleString()}g more`
    return rule(`earn-${i}`, label, got, t.points, detail)
  })
  return { id: 'earnings', name: 'Total Earnings', rules }
}

function scorePlayerLevel(save) {
  const skills = save.skills ?? {}
  const values = Object.values(skills)
  const total = values.reduce((s, v) => s + v, 0)
  const at30 = total >= 30
  const at50 = total >= 50  // 50 total = all five maxed at 10
  const labels = ['Farming', 'Mining', 'Fishing', 'Foraging', 'Combat']
  const breakdown = labels.map((l, i) => `${l} ${values[i] ?? 0}`).join(', ')
  return {
    id: 'levels',
    name: 'Player Level',
    summary: `${total} / 50 total skill levels — ${breakdown}`,
    rules: [
      rule('lvl-30', 'Reach 30 total skill levels', at30, 1,
        at30 ? `${total} total levels` : `${30 - total} more levels needed`),
      rule('lvl-50', 'Reach 50 total skill levels (max all skills)', at50, 1,
        at50 ? 'All skills maxed' : `${50 - total} more levels needed`),
    ],
  }
}

function scoreAchievements(save) {
  const got = new Set(save.achievements ?? [])
  return {
    id: 'achievements',
    name: 'Achievements',
    rules: [
      rule('ach-museum',     'A Complete Collection — complete the museum',
        got.has(ACHIEVEMENTS.COMPLETE_COLLECTION), 1,
        got.has(ACHIEVEMENTS.COMPLETE_COLLECTION) ? 'Earned' : 'Donate every artifact and mineral to the museum'),
      rule('ach-fish',       'Master Angler — catch every fish',
        got.has(ACHIEVEMENTS.MASTER_ANGLER), 1,
        got.has(ACHIEVEMENTS.MASTER_ANGLER) ? 'Earned' : 'Catch every fish at least once'),
      rule('ach-shipment',   'Full Shipment — ship every item',
        got.has(ACHIEVEMENTS.FULL_SHIPMENT), 1,
        got.has(ACHIEVEMENTS.FULL_SHIPMENT) ? 'Earned' : 'Ship every shippable item at least once'),
    ],
  }
}

function scoreFriendship(save) {
  const friendships = save.friendships ?? {}
  const eightHeartCount = Object.values(friendships)
    .filter(f => (f.points ?? 0) >= EIGHT_HEART_POINTS)
    .length

  const married  = !!save.spouse
  const houseLvl = save.houseUpgradeLevel ?? 0
  const houseOK  = houseLvl >= 2   // kitchen + nursery (cellar not required)
  const marriageOK = married && houseOK

  let marriageDetail
  if (marriageOK) marriageDetail = `Married to ${save.spouse}; house upgraded ${houseLvl}×`
  else if (married && !houseOK) marriageDetail = `Married — need house upgrade ${2 - houseLvl} more time${2 - houseLvl === 1 ? '' : 's'} (currently ${houseLvl})`
  else if (!married && houseOK) marriageDetail = 'House upgraded — need to be married'
  else marriageDetail = 'Marry a villager and upgrade your house twice (kitchen + nursery)'

  const fiveAtEight = eightHeartCount >= 5
  const tenAtEight  = eightHeartCount >= 10

  const pet = save.petFriendship
  const petOK = (pet ?? 0) >= 999
  let petDetail
  if (pet == null) petDetail = 'Adopt a cat or dog (visits the farm after the first rainy day)'
  else if (petOK)  petDetail = `Pet friendship ${pet}/1000`
  else             petDetail = `Pet friendship ${pet}/999 — pet daily and keep the water bowl filled`

  return {
    id: 'friendship',
    name: 'Friendship',
    rules: [
      rule('fr-marry', 'Married + house upgraded twice (kitchen + nursery)',
        marriageOK, 1, marriageDetail),
      rule('fr-five',  '8❤️ with at least 5 villagers',
        fiveAtEight, 1, `${eightHeartCount} / 5 villagers at 8+ hearts`),
      rule('fr-ten',   '8❤️ with at least 10 villagers',
        tenAtEight, 1, `${eightHeartCount} / 10 villagers at 8+ hearts`),
      rule('fr-pet',   'Pet friendship at maximum (999+)',
        petOK, 1, petDetail),
    ],
  }
}

function scoreCommunity(save) {
  const mail = new Set(save.mailReceived ?? [])
  const isJoja = mail.has('JojaMember')

  const ccComplete = mail.has('ccIsComplete')
  const ccCeremony = mail.has('CF_Complete')

  // CC points are forfeit on the Joja path. We render the alternative as a
  // dimmed informational group so the player sees what was given up.
  const ccGroup = {
    id: 'cc',
    name: 'Community Center',
    active: !isJoja,
    rules: [
      rule('cc-complete', 'Community Center complete',
        !isJoja && ccComplete, 1,
        isJoja ? 'Forfeit — chose the Joja path' : (ccComplete ? 'Earned' : 'Complete all bundles')),
      rule('cc-ceremony', 'Community Center completion ceremony (2 pts)',
        !isJoja && ccCeremony, 2,
        isJoja ? 'Forfeit — chose the Joja path' : (ccCeremony ? 'Earned' : 'Attend the ceremony cutscene after completion')),
    ],
  }

  const jojaGroup = {
    id: 'joja',
    name: 'Joja Warehouse',
    active: isJoja,
    note: 'Choosing Joja forfeits all 3 Community Center points — no points are awarded for the warehouse.',
    rules: [],
  }

  return {
    id: 'community',
    name: 'Community',
    summary: isJoja ? 'On the Joja path — forfeited 3 CC points' : 'On the Community Center path',
    groups: [ccGroup, jojaGroup],
    pointsOverride: isJoja ? 0 : ccGroup.rules.reduce((s, r) => s + r.points, 0),
    maxPointsOverride: 3,
  }
}

function scoreKeys(save) {
  const mail = new Set(save.mailReceived ?? [])
  const skull = mail.has('HasSkullKey')
  const rusty = mail.has('HasRustyKey')
  return {
    id: 'keys',
    name: 'Keys',
    rules: [
      rule('key-skull', 'Skull Key (reach Mines floor 120)',
        skull, 1, skull ? 'Earned' : 'Reach the bottom of the Mines'),
      rule('key-rusty', 'Rusty Key (donate 60 items to museum)',
        rusty, 1, rusty ? 'Earned' : 'Donate 60 items to the museum'),
    ],
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function computeShrineScore(save) {
  if (!save) return null

  const categories = [
    scoreEarnings(save),
    scorePlayerLevel(save),
    scoreAchievements(save),
    scoreFriendship(save),
    scoreCommunity(save),
    scoreKeys(save),
  ]

  let computedTotal = 0
  let maxTotal = 0
  for (const cat of categories) {
    const groupRules = cat.groups?.flatMap(g => g.rules) ?? []
    const allRules = [...(cat.rules ?? []), ...groupRules]
    const earnedSum = allRules.reduce((s, r) => s + r.points, 0)
    const maxSum    = allRules.reduce((s, r) => s + r.maxPoints, 0)
    cat.earned = cat.pointsOverride ?? earnedSum
    cat.max    = cat.maxPointsOverride ?? maxSum
    computedTotal += cat.earned
    maxTotal      += cat.max
  }

  return {
    categories,
    computedTotal,
    maxTotal,
    gameScore: save.grandpaScore ?? null,
    candles: candlesForScore(computedTotal),
  }
}

/**
 * Candle thresholds per the wiki: 1=1, 4=2, 8=3, 12=4.
 */
export function candlesForScore(score) {
  if (score >= 12) return 4
  if (score >= 8)  return 3
  if (score >= 4)  return 2
  if (score >= 1)  return 1
  return 0
}

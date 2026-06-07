/**
 * Max hearts a villager can reach, given their current relationship status.
 *
 * Verified against save data:
 *   - Friendly + canBeRomanced → 8  (capped pre-bouquet)
 *   - Friendly + not romanceable → 10
 *   - Dating → 10  (bouquet given, not yet proposed)
 *   - Engaged / Married → 14
 *   - Divorced → 8  (capped, cannot recover)
 */
export function maxHeartsFor(canBeRomanced, status) {
  if (status === 'Married' || status === 'Engaged') return 14
  if (status === 'Divorced') return 8
  if (status === 'Dating') return 10
  // Friendly (default)
  return canBeRomanced ? 8 : 10
}

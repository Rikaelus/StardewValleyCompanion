/**
 * Collects items associated with a location (and optionally its descendants).
 *
 * @param {string}   locationId  Entity ID of the location to query
 * @param {Array}    allItems    Full flat items array from EntityContext
 * @param {Function} findById    Entity lookup from EntityContext
 * @param {Object}   [options]
 * @param {boolean}  [options.deep=true]  When true, traverses map- child locations recursively.
 *                                        When false, only items whose source locationId exactly
 *                                        matches locationId are returned.
 *
 * @returns {{
 *   fishEntries:    Array<{ item, src, subLocName }>,
 *   forageEntries:  Array<{ item, src, subLocName }>,
 *   tillingEntries: Array<{ item, src, subLocName }>,
 *   monsterEntries: Array<{ item, qualifier }>,
 *   otherList:      Array<item>,
 *   relevantIds:    Set<string>,
 * }}
 */
export function collectLocationItems(locationId, allItems, findById, { deep = true } = {}) {
  const relevantIds = new Set([locationId])

  if (deep) {
    const collectDescendants = (id) => {
      const entity = findById(id)
      if (!entity?.childLocations) return
      for (const childId of entity.childLocations) {
        if (!childId.startsWith('map-')) continue
        relevantIds.add(childId)
        collectDescendants(childId)
      }
    }
    collectDescendants(locationId)
  }

  const fishEntries = []
  const forageEntries = []
  const tillingEntries = []
  const otherItems = new Map()

  for (const item of allItems) {
    if (item.type === 'location') continue
    for (const src of item.sources || []) {
      if (!src.locationId || !relevantIds.has(src.locationId)) continue
      const subLocName = (src.locationId !== locationId)
        ? findById(src.locationId)?.name ?? null
        : null
      if (src.type === 'fish') {
        fishEntries.push({ item, src, subLocName })
      } else if (src.type === 'forage') {
        forageEntries.push({ item, src, subLocName })
      } else if (src.type === 'tilling') {
        tillingEntries.push({ item, src, subLocName })
      } else if (item.type !== 'monster' && !otherItems.has(item.id)) {
        otherItems.set(item.id, item)
      }
    }
  }

  const monsterEntries = allItems
    .filter(item => item.type === 'monster' && item.locations?.some(loc => relevantIds.has(loc.locationId)))
    .map(item => {
      const loc = item.locations.find(loc => relevantIds.has(loc.locationId))
      return { item, qualifier: loc?.qualifier }
    })
    .sort((a, b) => a.item.name.localeCompare(b.item.name))

  const otherList = [...otherItems.values()].sort((a, b) => a.name.localeCompare(b.name))

  return { fishEntries, forageEntries, tillingEntries, monsterEntries, otherList, relevantIds }
}

import { useMemo, useState, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import { usePlayer } from '../../contexts/PlayerContext'
import { useVillagers } from '../../contexts/VillagersContext'
import { useRelationalData } from '../../hooks/useRelationalData'
import UniversalModal from '../common/UniversalModal'
import { formatTime, getDifficultyColor } from '../../utils/formatters'
import {
  createIconColumn,
  createNameColumn,
  createSeasonColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function FishTable({ fish, allFish }) {
  const { player } = usePlayer()
  const { villagers } = useVillagers()
  const relationalData = useRelationalData()
  const [selectedFish, setSelectedFish] = useState(null)
  const professionsRef = useRef(player.professions)

  // Update ref when professions actually change
  useEffect(() => {
    professionsRef.current = player.professions
  }, [player.professions])

  const columns = useMemo(() => {
    // Don't build columns until relational data is loaded
    if (relationalData.loading) {
      return []
    }

    const baseColumns = [
      createIconColumn(),
      createNameColumn({
        cellRenderer: ({ row }) => (
          <strong>
            {row.original.contextTags?.includes('fish_legendary') && <span title="Legendary Fish">⭐ </span>}
            {row.original.name}
            {row.original.hasLocationNuance && <span className="nuance-indicator" title="Availability varies by location — click for details">*</span>}
          </strong>
        )
      }),
      {
        accessorKey: 'locations',
        header: 'Location',
        cell: ({ getValue }) => {
          const locations = getValue()
          if (!locations || locations.length === 0) return '—'

          return (
            <span className="cell-location-list">
              {locations.map((loc, i) => (
                <span key={i} className="cell-location-item">
                  {loc}{i < locations.length - 1 ? ',' : ''}
                </span>
              ))}
            </span>
          )
        },
      },
      createSeasonColumn(),
      {
        accessorKey: 'times',
        header: 'Time',
        cell: ({ getValue }) => {
          const times = getValue() || []
          if (times.length === 0) return '—'

          return times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')
        },
        enableSorting: false,
      },
      {
        accessorKey: 'weather',
        header: 'Weather',
        cell: ({ getValue }) => {
          const w = getValue()
          return w === 'rainy' ? '🌧' : w === 'sunny' ? '☀️' : '—'
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'behaviorType',
        header: 'Behavior',
        cell: ({ getValue }) => {
          const behavior = getValue()
          // Handle crab pot fish (have numeric spawn rates instead of behavior)
          if (!isNaN(behavior)) return 'Crab Pot'

          // Capitalize first letter
          return behavior.charAt(0).toUpperCase() + behavior.slice(1)
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'difficulty',
        header: 'Diff',
        cell: ({ getValue }) => {
          const diff = getValue()
          return (
            <span className="difficulty" style={{ color: getDifficultyColor(diff) }} title={`Difficulty: ${diff}`}>
              {diff}
            </span>
          )
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'minFishingLevel',
        header: 'Min Lvl',
        cell: ({ getValue }) => {
          const minLevel = getValue()
          if (!minLevel) return <span className="cell-muted">—</span>
          return (
            <span className="cell-level" title={`Minimum Fishing Level: ${minLevel}`}>
              {minLevel}
            </span>
          )
        },
        meta: { align: 'center' },
      },
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    const villagerColumns = createVillagerGiftColumns(villagers, relationalData)

    return [...baseColumns, ...villagerColumns]
  }, [villagers, relationalData])

  // Show loading state while data loads
  if (relationalData.loading || columns.length === 0) {
    return null
  }

  const nuancedFish = fish.filter(f => f.hasLocationNuance)

  return (
    <>
      <DataTable
        data={fish}
        columns={columns}
        pinnedColumns={2}
      />
      {nuancedFish.length > 0 && (
        <div className="nuance-note">
          * Seasons and locations shown are the full range of possibilities. Click on a fish marked with * to see exact availability per location.
        </div>
      )}
      <UniversalModal
        entity={selectedFish}
        isOpen={selectedFish !== null}
        onClose={() => setSelectedFish(null)}
      />
    </>
  )
}

export default FishTable

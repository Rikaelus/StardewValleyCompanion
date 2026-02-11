import { useMemo, useState, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import { usePlayer } from '../../contexts/PlayerContext'
import { useVillagers } from '../../contexts/VillagersContext'
import ItemModal from '../common/ItemModal'
import {
  createIconColumn,
  createNameColumn,
  createSeasonColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function FishTable({ fish }) {
  const { player } = usePlayer()
  const { villagers } = useVillagers()
  const [selectedFish, setSelectedFish] = useState(null)
  const professionsRef = useRef(player.professions)

  // Update ref when professions actually change
  useEffect(() => {
    professionsRef.current = player.professions
  }, [player.professions])
  const columns = useMemo(() => {
    const baseColumns = [
      createIconColumn(),
      createNameColumn({
        cellRenderer: ({ row }) => (
          <strong>
            {row.original.contextTags?.includes('fish_legendary') && <span title="Legendary Fish">⭐ </span>}
            {row.original.name}
            {row.original.notes && <span className="special-indicator" title="See Special Cases below">*</span>}
          </strong>
        )
      }),
      {
        accessorKey: 'location',
        header: 'Location',
        cell: ({ getValue }) => {
          const locations = getValue()
          if (!locations || locations.length === 0) return '—'

          return (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {locations.map((loc, i) => (
                <span key={i} style={{ whiteSpace: 'nowrap' }}>
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

          // Format military time to 12-hour with am/pm
          const formatTime = (militaryTime) => {
            const time = String(militaryTime).padStart(4, '0')
            let hours = parseInt(time.slice(0, -2))

            // Handle times past midnight (e.g., 2600 = 2:00am next day)
            if (hours >= 24) {
              hours -= 24
            }

            const period = hours >= 12 ? 'pm' : 'am'
            const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

            return `${displayHours}${period}`
          }

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
          const color = diff >= 80 ? '#d32f2f' :
                       diff >= 60 ? '#f57c00' :
                       diff >= 40 ? '#fbc02d' :
                       '#66bb6a'
          return (
            <span style={{ color, fontWeight: 'bold' }} title={`Difficulty: ${diff}`}>
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
          if (!minLevel) return <span style={{ color: '#999' }}>—</span>
          return (
            <span style={{ color: '#1976d2', fontWeight: 'bold' }} title={`Minimum Fishing Level: ${minLevel}`}>
              {minLevel}
            </span>
          )
        },
        meta: { align: 'center' },
      },
      createPriceColumn(professionsRef),
      createBundleColumn(),
    ]

    const villagerColumns = createVillagerGiftColumns(villagers)

    return [...baseColumns, ...villagerColumns]
  }, [villagers])

  return (
    <>
      <style>{`
        .special-indicator {
          color: #5c4a32;
          margin-left: 4px;
          font-size: 12px;
          cursor: help;
        }
      `}</style>
      <DataTable
        data={fish}
        columns={columns}
        pinnedColumns={2}
      />
      <ItemModal
        item={selectedFish}
        isOpen={selectedFish !== null}
        onClose={() => setSelectedFish(null)}
      />
    </>
  )
}

export default FishTable

import { useMemo, useState, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import GiftCell from '../common/GiftCell'
import ModalItemButton from '../common/ModalItemButton'
import ItemSellPrice, { createPriceSortingFn } from '../common/ItemSellPrice'
import { usePlayer } from '../../contexts/PlayerContext'
import FishModal from './FishModal'

function FishTable({ fish, villagers }) {
  const { player } = usePlayer()
  const [selectedFish, setSelectedFish] = useState(null)
  const professionsRef = useRef(player.professions)

  // Update ref when professions actually change
  useEffect(() => {
    professionsRef.current = player.professions
  }, [player.professions])
  const columns = useMemo(() => {
    const baseColumns = [
      {
        accessorKey: 'icon',
        header: '',
        cell: ({ row }) => (
          <ModalItemButton
            item={row.original}
            iconSize={24}
            stopPropagation={true}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <strong>
            {row.original.contextTags?.includes('fish_legendary') && <span title="Legendary Fish">⭐ </span>}
            {row.original.name}
            {row.original.notes && <span className="special-indicator" title="See Special Cases below">*</span>}
          </strong>
        ),
      },
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
      {
        accessorKey: 'seasons',
        header: 'Season',
        cell: ({ getValue }) => {
          const seasons = getValue() || []
          const allSeasons = ['Spring', 'Summer', 'Fall', 'Winter']
          return (
            <span className="season-badges">
              {allSeasons.map(s => (
                <span
                  key={s}
                  className={`season-badge season-${s.toLowerCase()} ${seasons.some(fs => fs.toLowerCase() === s.toLowerCase()) ? 'active' : 'inactive'}`}
                >
                  {s.slice(0, 2)}
                </span>
              ))}
            </span>
          )
        },
      },
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
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => <ItemSellPrice item={row.original} showQualities={true} />,
        sortingFn: (rowA, rowB) => createPriceSortingFn(professionsRef.current)(rowA, rowB),
        meta: { align: 'left' },
      },
      {
        accessorKey: 'bundleDetails',
        header: 'Bundles',
        cell: ({ getValue }) => {
          const bundleDetails = getValue() || []
          if (bundleDetails.length === 0) return <span style={{ color: '#999' }}>—</span>

          return (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {bundleDetails.map(bundle => (
                <span
                  key={bundle.id}
                  style={{
                    background: '#e3f2fd',
                    color: '#1976d2',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap'
                  }}
                  title={bundle.name}
                >
                  {bundle.name}
                </span>
              ))}
            </div>
          )
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) || []
          const b = rowB.getValue(columnId) || []
          // Sort by number of bundles first, then alphabetically by first bundle
          if (a.length !== b.length) return a.length - b.length
          if (a.length === 0) return 0
          return a[0].name.localeCompare(b[0].name)
        },
      },
    ]

    const villagerColumns = villagers.map(villager => ({
      id: `gift-${villager.id}`,
      accessorFn: row => {
        // Look for this villager in giftDetails
        const giftDetail = row.giftDetails?.find(g => g.villager.id === villager.id)
        return giftDetail?.preference
      },
      header: () => (
        <img
          src={villager.icon}
          alt={villager.name}
          title={villager.name}
          width={24}
          height={24}
        />
      ),
      cell: ({ getValue }) => <GiftCell preference={getValue()} />,
      sortingFn: (rowA, rowB, columnId) => {
        const order = { love: 0, like: 1, neutral: 2, dislike: 3, hate: 4 }
        const a = order[rowA.getValue(columnId)] ?? 5
        const b = order[rowB.getValue(columnId)] ?? 5
        return a - b
      },
    }))

    return [...baseColumns, ...villagerColumns]
  }, [villagers])

  return (
    <>
      <style>{`
        .season-badges { display: flex; gap: 2px; }
        .season-badge {
          display: inline-block;
          padding: 2px 4px;
          font-size: 10px;
          font-weight: bold;
          border-radius: 3px;
        }
        .season-badge.inactive {
          background: #f5f5f5;
          color: #ccc;
        }
        .season-spring.active { background: #c8e6c9; color: #2e7d32; }
        .season-summer.active { background: #fff9c4; color: #f57f17; }
        .season-fall.active { background: #ffe0b2; color: #e65100; }
        .season-winter.active { background: #bbdefb; color: #1565c0; }
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
      <FishModal
        fish={selectedFish}
        isOpen={selectedFish !== null}
        onClose={() => setSelectedFish(null)}
      />
    </>
  )
}

export default FishTable

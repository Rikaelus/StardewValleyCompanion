import { useMemo, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import { usePlayer } from '../../contexts/PlayerContext'
import { useVillagers } from '../../contexts/VillagersContext'
import { useRelationalData } from '../../hooks/useRelationalData'
import ItemSellPrice, { createPriceSortingFn } from '../common/ItemSellPrice'
import {
  createIconColumn,
  createNameColumn,
  createSeasonColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function CropsTable({ data }) {
  const { player } = usePlayer()
  const { villagers } = useVillagers()
  const relationalData = useRelationalData()
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
      createNameColumn(),
      createSeasonColumn(),
      {
        accessorKey: 'growthDays',
        header: 'Growth',
        cell: ({ row }) => {
          const { growthDays, regrowDays } = row.original
          if (!growthDays) return '—'
          if (regrowDays) {
            return `${growthDays}d (+${regrowDays}d)`
          }
          return `${growthDays}d`
        },
        enableSorting: true,
        meta: { align: 'center' },
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => (
          <ItemSellPrice
            item={row.original}
            showQualities={row.original.maxQuality !== 0}
          />
        ),
        sortingFn: (rowA, rowB) => createPriceSortingFn(professionsRef.current)(rowA, rowB),
        meta: { align: 'left' },
      },
      createBundleColumn(relationalData),
    ]

    const villagerColumns = createVillagerGiftColumns(villagers, relationalData)

    return [...baseColumns, ...villagerColumns]
  }, [villagers, relationalData])

  // Show loading state while data loads
  if (relationalData.loading || columns.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  return (
    <>
      <style>{`
        .crops-season-note {
          padding: 1rem;
          margin: 1rem 0;
          background: rgba(255, 248, 220, 0.95);
          border-left: 3px solid #5c4a32;
          font-size: 0.9rem;
          color: #5c4a32;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      <DataTable
        data={data}
        columns={columns}
        initialSortBy={[{ id: 'name', desc: false }]}
        itemsPerPage={25}
        syncUrlState={true}
      />
      <div className="crops-season-note">
        <strong>Note:</strong> Seasons listed above apply to mainland farming only. All crops can be planted year-round in the Greenhouse, in Garden Pots, and on Ginger Island.
      </div>
    </>
  )
}

export default CropsTable

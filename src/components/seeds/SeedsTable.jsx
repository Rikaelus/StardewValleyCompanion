import { useMemo, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import { usePlayer } from '../../contexts/PlayerContext'
import ItemSellPrice, { createPriceSortingFn } from '../common/ItemSellPrice'
import ModalItemButton from '../common/ModalItemButton'
import ShopSourceList from '../common/ShopSourceList'
import {
  createNameColumn,
  createSeasonColumn,
} from '../common/ItemTableFactory.jsx'

function SeedsTable({ data, cropsById }) {
  const { player } = usePlayer()
  const professionsRef = useRef(player.professions)

  useEffect(() => {
    professionsRef.current = player.professions
  }, [player.professions])

  const columns = useMemo(() => [
    createNameColumn(),
    {
      accessorKey: 'produces',
      header: 'Crop',
      cell: ({ row }) => {
        const produces = row.original.produces || []
        if (produces.length === 0) return '—'
        if (produces.length === 1) {
          const crop = cropsById.get(produces[0].cropId)
          if (!crop) return <strong>{produces[0].cropName}</strong>
          return <ModalItemButton item={crop} variant="inline" stopPropagation={true} />
        }
        // Multi-output: one per line
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {produces.map((p) => {
              const crop = cropsById.get(p.cropId)
              return (
                <div key={p.cropId}>
                  {crop
                    ? <ModalItemButton item={crop} variant="inline" stopPropagation={true} />
                    : <strong>{p.cropName}</strong>
                  }
                </div>
              )
            })}
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const nameA = rowA.original.produces?.[0]?.cropName ?? ''
        const nameB = rowB.original.produces?.[0]?.cropName ?? ''
        return nameA.localeCompare(nameB)
      },
    },
    { ...createSeasonColumn(), header: 'Growth Season' },
    {
      id: 'growthDays',
      header: 'Growth',
      cell: ({ row }) => {
        const produces = row.original.produces || []
        if (produces.length === 0) return '—'
        if (produces.length === 1) {
          const { growthDays, regrowDays } = produces[0]
          if (!growthDays) return '—'
          return regrowDays ? `${growthDays}d (+${regrowDays}d)` : `${growthDays}d`
        }
        // Multi-output: show range or list
        const days = produces.map(p => p.growthDays).filter(Boolean)
        if (days.length === 0) return '—'
        const min = Math.min(...days)
        const max = Math.max(...days)
        return min === max ? `${min}d` : `${min}–${max}d`
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const daysA = rowA.original.produces?.[0]?.growthDays ?? 0
        const daysB = rowB.original.produces?.[0]?.growthDays ?? 0
        return daysA - daysB
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'buyPrice',
      header: 'Buy Price',
      cell: ({ getValue }) => {
        const price = getValue()
        if (!price) return '—'
        return <span style={{ fontFamily: 'monospace' }}>{price.toLocaleString()}g</span>
      },
      enableSorting: true,
      meta: { align: 'right' },
    },
    {
      id: 'cropPrice',
      header: 'Crop Sells For',
      cell: ({ row }) => {
        const produces = row.original.produces || []
        if (produces.length === 0) return '—'
        if (produces.length === 1) {
          const crop = cropsById.get(produces[0].cropId)
          if (!crop) return '—'
          return <ItemSellPrice item={crop} showQualities={crop.maxQuality !== 0} />
        }
        // Multi-output: one per line
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {produces.map((p) => {
              const crop = cropsById.get(p.cropId)
              if (!crop) return null
              return (
                <div key={p.cropId}>
                  <ItemSellPrice item={crop} showQualities={crop.maxQuality !== 0} />
                </div>
              )
            })}
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const fn = createPriceSortingFn(professionsRef.current)
        const cropA = cropsById.get(rowA.original.produces?.[0]?.cropId) ?? { price: 0 }
        const cropB = cropsById.get(rowB.original.produces?.[0]?.cropId) ?? { price: 0 }
        const fakeA = { ...rowA, original: cropA }
        const fakeB = { ...rowB, original: cropB }
        return fn(fakeA, fakeB)
      },
      meta: { align: 'left' },
    },
    {
      accessorKey: 'sources',
      header: 'Where to Buy',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact />,
      enableSorting: false,
    },
  ], [cropsById])

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
        pinnedColumns={1}
        initialSortBy={[{ id: 'name', desc: false }]}
        itemsPerPage={25}
      />
      <div className="crops-season-note">
        <strong>Note:</strong> Seasons listed above apply to mainland farming only. All crops can be planted year-round in the Greenhouse, in Garden Pots, and on Ginger Island.
      </div>
    </>
  )
}

export default SeedsTable

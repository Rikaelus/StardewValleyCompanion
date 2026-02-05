import { useMemo, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import GiftCell from '../common/GiftCell'
import ModalItemButton from '../common/ModalItemButton'
import ItemSellPrice, { createPriceSortingFn } from '../common/ItemSellPrice'
import { usePlayer } from '../../contexts/PlayerContext'

function ArtisanTable({ artisanGoods, villagers }) {
  const { player } = usePlayer()
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
        cell: ({ row }) => <strong>{row.original.name}</strong>,
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => {
          const source = row.original.source || row.original.producedBy?.machine
          return source || '—'
        },
      },
      {
        id: 'processingTime',
        accessorFn: (row) => {
          // Calculate total hours for sorting
          const minutes = row.processingTimeMinutes || row.producedBy?.processingTimeMinutes;
          return minutes ? minutes / 60 : null;
        },
        header: 'Time',
        cell: ({ row }) => {
          const minutes = row.original.processingTimeMinutes || row.original.producedBy?.processingTimeMinutes;

          if (!minutes) return '—';

          const hours = minutes / 60;

          // Show in days if >= 24 hours
          if (hours >= 24) {
            const displayDays = Math.round(hours / 24 * 10) / 10; // Round to 1 decimal
            return `${displayDays}d`;
          }

          const displayHours = Math.round(hours * 10) / 10; // Round to 1 decimal
          return `${displayHours}h`;
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'agingDaysToIridium',
        header: 'Cask',
        cell: ({ getValue }) => {
          const days = getValue();
          if (!days) return '—';
          return `${days}d`;
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'prices',
        header: 'Sell Price',
        cell: ({ row }) => {
          if (!row.original.prices) return '—'
          return <ItemSellPrice item={row.original} showQualities={true} />
        },
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
          if (a.length !== b.length) return a.length - b.length
          if (a.length === 0) return 0
          return a[0].name.localeCompare(b[0].name)
        },
      },
    ]

    const villagerColumns = villagers.map(villager => ({
      id: `gift-${villager.id}`,
      accessorFn: row => {
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
    <DataTable
      data={artisanGoods}
      columns={columns}
      pinnedColumns={2}
    />
  )
}

export default ArtisanTable

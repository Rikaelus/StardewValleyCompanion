import { useMemo, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import { usePlayer } from '../../contexts/PlayerContext'
import { useVillagers } from '../../contexts/VillagersContext'
import { useRelationalData } from '../../hooks/useRelationalData'
import {
  createIconColumn,
  createNameColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function ArtisanTable({ artisanGoods }) {
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
      createPriceColumn(professionsRef),
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
    <DataTable
      data={artisanGoods}
      columns={columns}
      pinnedColumns={2}
    />
  )
}

export default ArtisanTable

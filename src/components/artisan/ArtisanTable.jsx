import { useMemo, useRef, useEffect } from 'react'
import DataTable from '../common/DataTable'
import ModalItemButton from '../common/ModalItemButton'
import { usePlayer } from '../../contexts/PlayerContext'
import { useEntities } from '../../contexts/EntityContext'
import {
  createNameColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function ArtisanTable({ artisanGoods, allArtisan }) {
  const { player } = usePlayer()
  const { villagers: { all: villagers }, ...relationalData } = useEntities()
  const professionsRef = useRef(player.professions)

  // Update ref when professions actually change
  useEffect(() => {
    professionsRef.current = player.professions
  }, [player.professions])

  // Detect whether we're showing generic items
  const isGenerics = artisanGoods.length > 0 && artisanGoods[0]?.isGeneric

  const columns = useMemo(() => {
    // Don't build columns until relational data is loaded
    if (relationalData.loading) {
      return []
    }

    if (isGenerics) {
      // Generic items: show Input Type, # Variations instead of Price
      return [
        createNameColumn(),
        {
          id: 'machine',
          accessorFn: (row) => row.sources?.find(s => s.type === 'machine')?.machine,
          header: 'Machine',
          cell: ({ row }) => row.original.sources?.find(s => s.type === 'machine')?.machine || '—',
        },
        {
          id: 'inputType',
          accessorFn: (row) => row.sources?.find(s => s.type === 'machine')?.inputType,
          header: 'Input Type',
          cell: ({ row }) => {
            const type = row.original.sources?.find(s => s.type === 'machine')?.inputType
            if (!type) return '—'
            if (type === 'specific') return 'Specific'
            // Check if inputType matches a generic artisan item we can link to
            const genericMatch = allArtisan?.find(i => i.id === type && i.isGeneric)
            if (genericMatch) {
              return <ModalItemButton item={genericMatch} variant="inline" />
            }
            return type.charAt(0).toUpperCase() + type.slice(1)
          },
        },
        {
          id: 'processingTime',
          accessorFn: (row) => row.processingTimeMinutes ? row.processingTimeMinutes / 60 : null,
          header: 'Time',
          cell: ({ row }) => {
            const minutes = row.original.processingTimeMinutes;
            if (!minutes) return '—';
            const hours = minutes / 60;
            if (hours >= 24) {
              const displayDays = Math.round(hours / 24 * 10) / 10;
              return `${displayDays}d`;
            }
            const displayHours = Math.round(hours * 10) / 10;
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
          id: 'variations',
          accessorFn: (row) => row.variations?.length || 0,
          header: 'Variations',
          cell: ({ row }) => row.original.variations?.length || 0,
          meta: { align: 'center' },
        },
        createBundleColumn(relationalData),
      ]
    }

    const baseColumns = [
      createNameColumn(),
      {
        id: 'source',
        accessorFn: (row) => {
          const machineSource = row.sources?.find(s => s.type === 'machine')
          const tapperSource = row.sources?.find(s => s.type === 'tapper')
          return machineSource?.machine || tapperSource?.treeName || null
        },
        header: 'Source',
        cell: ({ row }) => {
          const machineSource = row.original.sources?.find(s => s.type === 'machine')
          const tapperSource = row.original.sources?.find(s => s.type === 'tapper')
          return machineSource?.machine || tapperSource?.treeName || '—'
        },
      },
      {
        id: 'processingTime',
        accessorFn: (row) => row.processingTimeMinutes ? row.processingTimeMinutes / 60 : null,
        header: 'Time',
        cell: ({ row }) => {
          const minutes = row.original.processingTimeMinutes;

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
  }, [villagers, relationalData, isGenerics])

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

import { useMemo } from 'react'
import DataTable from '../common/DataTable'
import ShopSourceList from '../common/ShopSourceList'
import {
  createNameColumn,
} from '../common/ItemTableFactory.jsx'

function FurnitureTable({ data }) {
  const columns = useMemo(() => [
    createNameColumn(),
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue()
        if (!t) return '—'
        return t.charAt(0).toUpperCase() + t.slice(1)
      },
    },
    {
      accessorKey: 'price',
      header: 'Buy Price',
      cell: ({ getValue }) => {
        const price = getValue()
        if (!price) return '—'
        return <span style={{ fontFamily: 'monospace' }}>{price.toLocaleString()}g</span>
      },
      meta: { align: 'right' },
    },
    {
      accessorKey: 'sources',
      header: 'Where to Buy',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact />,
      enableSorting: false,
    },
  ], [])

  return (
    <DataTable
      data={data}
      columns={columns}
      pinnedColumns={1}
      initialSortBy={[{ id: 'name', desc: false }]}
      itemsPerPage={50}
    />
  )
}

export default FurnitureTable

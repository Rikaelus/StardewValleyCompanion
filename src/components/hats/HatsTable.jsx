import { useMemo } from 'react'
import DataTable from '../common/DataTable'
import ShopSourceList from '../common/ShopSourceList'
import {
  createNameColumn,
} from '../common/ItemTableFactory.jsx'

function HatsTable({ data }) {
  const columns = useMemo(() => [
    createNameColumn(),
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => {
        const desc = getValue()
        return desc || <span className="cell-muted">—</span>
      },
      enableSorting: false,
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
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

export default HatsTable

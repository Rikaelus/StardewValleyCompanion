import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import './DataTable.css'

/**
 * DataTable component with URL state synchronization
 *
 * URL Parameters (when syncUrlState=true):
 * - sortBy: Column ID to sort by (e.g., "name", "price")
 * - sortOrder: Sort direction ("asc" or "desc")
 * - page: Current page number (1-indexed, e.g., "1", "2", "3")
 *
 * Example URL: /fish?sortBy=price&sortOrder=desc&page=2
 */
function DataTable({
  data,
  columns,
  pinnedColumns = 0,
  onRowClick,
  initialSortBy = [{ id: 'name', desc: false }],
  enablePagination = true,
  syncUrlState = true // Enable URL state synchronization by default
}) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize sorting from URL or use default
  const getSortingFromUrl = () => {
    if (!syncUrlState) return initialSortBy

    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder')

    if (sortBy) {
      return [{ id: sortBy, desc: sortOrder === 'desc' }]
    }
    return initialSortBy
  }

  // Initialize pagination from URL or use default
  const getPaginationFromUrl = () => {
    if (!syncUrlState || !enablePagination) {
      return {
        pageIndex: 0,
        pageSize: enablePagination ? 10 : data.length,
      }
    }

    const page = parseInt(searchParams.get('page'), 10)
    return {
      pageIndex: !isNaN(page) && page > 0 ? page - 1 : 0, // URL is 1-indexed, state is 0-indexed
      pageSize: 10,
    }
  }

  const [sorting, setSorting] = useState(getSortingFromUrl)
  const [pagination, setPagination] = useState(getPaginationFromUrl)

  // Sync sorting and pagination to URL
  useEffect(() => {
    if (!syncUrlState) return

    const params = new URLSearchParams(searchParams)

    // Update sort parameters
    if (sorting.length > 0) {
      params.set('sortBy', sorting[0].id)
      params.set('sortOrder', sorting[0].desc ? 'desc' : 'asc')
    } else {
      params.delete('sortBy')
      params.delete('sortOrder')
    }

    // Update page parameter (convert 0-indexed to 1-indexed for URL)
    if (enablePagination && pagination.pageIndex > 0) {
      params.set('page', (pagination.pageIndex + 1).toString())
    } else {
      params.delete('page')
    }

    setSearchParams(params, { replace: true })
  }, [sorting, pagination, syncUrlState, enablePagination, setSearchParams, searchParams])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
    getRowId: (row) => row.id, // Use the data's id field for stable keys
  })

  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows

  // Show empty state message instead of table when no results
  if (rows.length === 0) {
    return (
      <div className="data-table-container">
        <div className="empty-results">
          <div className="empty-results-icon">🔍</div>
          <p className="empty-results-message">No items found matching your filters.</p>
          <p className="empty-results-hint">Try adjusting your search criteria or clearing filters.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="data-table-container">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => (
                  <th
                    key={header.id}
                    className={index < pinnedColumns ? 'pinned' : ''}
                    data-pinned-index={index < pinnedColumns ? index : undefined}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="th-content" style={{ justifyContent: header.column.columnDef.meta?.align === 'center' ? 'center' : 'flex-start' }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="sort-indicator">
                          {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted()] ?? ' ⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {row.getVisibleCells().map((cell, index) => (
                  <td
                    key={cell.id}
                    className={index < pinnedColumns ? 'pinned' : ''}
                    data-pinned-index={index < pinnedColumns ? index : undefined}
                    style={{ textAlign: cell.column.columnDef.meta?.align || 'left' }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enablePagination && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} rows
          </div>

          <div className="pagination-controls">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              ««
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </button>

            <span className="page-info">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </span>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              »»
            </button>
          </div>

          <div className="pagination-size">
            <label>
              Rows per page:
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItemData } from '../../hooks/useData'
import PagePanel from '../common/PagePanel'
import SeedsTable from './SeedsTable'

function SeedsPage() {
  const { data, loading, error } = useItemData('seeds')
  const { data: cropsData, loading: cropsLoading } = useItemData('crops')
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    seasons: searchParams.get('seasons')?.split(',').filter(Boolean) || [],
  })

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams)

    if (filters.search) {
      params.set('search', filters.search)
    } else {
      params.delete('search')
    }

    if (filters.type) {
      params.set('type', filters.type)
    } else {
      params.delete('type')
    }

    if (filters.seasons?.length > 0) {
      params.set('seasons', filters.seasons.join(','))
    } else {
      params.delete('seasons')
    }

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams, searchParams])

  const filterOptions = useMemo(() => {
    if (!data.items) return {}
    const types = [...new Set(data.items.flatMap(s => s.produces?.map(p => p.cropType) || []).filter(Boolean))].sort()
    return { types }
  }, [data.items])

  const filteredData = useMemo(() => {
    if (!data.items) return []

    return data.items.filter(item => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const cropNameMatch = item.produces?.some(p => p.cropName.toLowerCase().includes(q))
        if (!item.name.toLowerCase().includes(q) && !cropNameMatch) {
          return false
        }
      }

      if (filters.type) {
        const typeMatch = item.produces?.some(p => p.cropType === filters.type)
        if (!typeMatch) return false
      }

      if (filters.seasons.length > 0) {
        const itemSeasons = item.seasons?.map(s => s.toLowerCase()) || []
        if (!filters.seasons.every(s => itemSeasons.includes(s.toLowerCase()))) {
          return false
        }
      }

      return true
    })
  }, [data.items, filters])

  const cropsById = useMemo(() => {
    if (!cropsData.items) return new Map()
    return new Map(cropsData.items.map(c => [c.id, c]))
  }, [cropsData.items])

  if (loading || cropsLoading) {
    return (
      <PagePanel title="Seeds">
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </PagePanel>
    )
  }

  if (error) {
    return (
      <PagePanel title="Seeds">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          Error loading seeds: {error.message}
        </div>
      </PagePanel>
    )
  }

  return (
    <div className="seeds-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Seeds</h2>
        </PagePanel.Header>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Seed or crop name..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Season</label>
            <div className="checkbox-group">
              {['spring', 'summer', 'fall', 'winter'].map(season => (
                <label key={season} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.seasons.includes(season)}
                    onChange={() => {
                      const current = filters.seasons || []
                      const updated = current.includes(season)
                        ? current.filter(s => s !== season)
                        : [...current, season]
                      setFilters({ ...filters, seasons: updated })
                    }}
                  />
                  {season.charAt(0).toUpperCase() + season.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All Types</option>
              {filterOptions.types?.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <button
            className="clear-filters"
            onClick={() => setFilters({ search: '', type: '', seasons: [] })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <SeedsTable data={filteredData} cropsById={cropsById} />
    </div>
  )
}

export default SeedsPage

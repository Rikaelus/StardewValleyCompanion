import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItemData } from '../../hooks/useData'
import { useEntities } from '../../contexts/EntityContext'
import PagePanel from '../common/PagePanel'
import CropsTable from './CropsTable'

function CropsPage() {
  const { data, loading, error } = useItemData('crops')
  const { loading: relationalLoading, getBundle } = useEntities()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    seasons: searchParams.get('seasons')?.split(',').filter(Boolean) || [],
    bundle: searchParams.get('bundle') || '',
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

    if (filters.bundle) {
      params.set('bundle', filters.bundle)
    } else {
      params.delete('bundle')
    }

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams, searchParams])

  const filterOptions = useMemo(() => {
    if (!data.items || relationalLoading) return {}

    const types = [...new Set(data.items.map(c => c.type).filter(Boolean))].sort()

    // Get unique bundles that crops belong to
    const bundleIds = new Set()
    data.items.forEach(crop => {
      crop.bundles?.forEach(bundleId => bundleIds.add(bundleId))
    })

    // Resolve bundle IDs to full bundle objects
    const bundles = Array.from(bundleIds)
      .map(id => getBundle(id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))

    return { types, bundles }
  }, [data.items, relationalLoading, getBundle])

  const filteredData = useMemo(() => {
    if (!data.items) return []

    return data.items.filter(item => {
      if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }

      if (filters.type && item.type !== filters.type) {
        return false
      }

      if (filters.seasons.length > 0) {
        // Check if crop is available in ALL selected seasons
        const itemSeasons = item.seasons?.map(s => s.toLowerCase()) || []
        if (!filters.seasons.every(s => itemSeasons.includes(s.toLowerCase()))) {
          return false
        }
      }

      if (filters.bundle) {
        const inBundle = item.bundles?.includes(filters.bundle)
        if (!inBundle) {
          return false
        }
      }

      return true
    })
  }, [data.items, filters])

  if (loading || relationalLoading) {
    return (
      <PagePanel title="Crops">
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </PagePanel>
    )
  }

  if (error) {
    return (
      <PagePanel title="Crops">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          Error loading crops: {error.message}
        </div>
      </PagePanel>
    )
  }

  return (
    <div className="crops-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Crops</h2>
        </PagePanel.Header>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Crop name..."
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

          <div className="filter-group">
            <label className="filter-label">Bundle</label>
            <select
              value={filters.bundle}
              onChange={(e) => setFilters({ ...filters, bundle: e.target.value })}
            >
              <option value="">All Items</option>
              {filterOptions.bundles?.map(bundle => (
                <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
              ))}
            </select>
          </div>

          <button
            className="clear-filters"
            onClick={() => setFilters({ search: '', type: '', seasons: [], bundle: '' })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <CropsTable data={filteredData} />
    </div>
  )
}

export default CropsPage

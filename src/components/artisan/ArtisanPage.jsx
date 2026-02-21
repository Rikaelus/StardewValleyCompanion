import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useArtisanData } from '../../hooks/useData'
import { useDebounce } from '../../hooks/useDebounce'
import PagePanel from '../common/PagePanel'
import Tabs from '../common/Tabs'
import ArtisanTable from './ArtisanTable'
import './ArtisanPage.css'

function ArtisanPage() {
  const { data, loading, error } = useArtisanData()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Get state from URL
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || 'all',
    source: searchParams.get('source') || '',
    bundle: searchParams.get('bundle') || '',
  })

  // Debounce the search filter to avoid excessive re-renders while typing
  const debouncedSearch = useDebounce(filters.search, 300)

  // Update URL when filters change (use debounced search for URL to avoid spamming history)
  useEffect(() => {
    const params = new URLSearchParams(searchParams) // Preserve existing params (sort, page)

    // Update filter params
    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    } else {
      params.delete('search')
    }

    if (filters.category && filters.category !== 'all') {
      params.set('category', filters.category)
    } else {
      params.delete('category')
    }

    if (filters.source) {
      params.set('source', filters.source)
    } else {
      params.delete('source')
    }

    if (filters.bundle) {
      params.set('bundle', filters.bundle)
    } else {
      params.delete('bundle')
    }

    // Only update if params actually changed
    const currentParams = searchParams.toString()
    const newParams = params.toString()
    if (currentParams !== newParams) {
      setSearchParams(params, { replace: true })
    }
  }, [debouncedSearch, filters.category, filters.source, filters.bundle, setSearchParams])

  const filterOptions = useMemo(() => {
    if (!data.artisan) return {}

    // Extract unique sources (machine, animal, tree, etc.)
    const sources = [...new Set(data.artisan.map(a => a.source || a.producedBy?.machine).filter(Boolean))].sort()

    // Extract unique bundles from artisan bundleDetails
    const bundleMap = new Map()
    data.artisan.forEach(artisan => {
      artisan.bundleDetails?.forEach(bundle => {
        if (!bundleMap.has(bundle.id)) {
          bundleMap.set(bundle.id, bundle)
        }
      })
    })
    const bundles = Array.from(bundleMap.values())

    return {
      sources,
      bundles,
    }
  }, [data])

  // Define tabs (now just for UI, actual filtering happens in filteredArtisan)
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'animal', label: 'Animal Products' },
    { id: 'tree', label: 'Tree Products' },
    { id: 'machine', label: 'Machine Products' },
    { id: 'generics', label: 'Generics' },
  ]

  const filteredArtisan = useMemo(() => {
    if (!data.artisan) return []

    return data.artisan.filter(artisan => {
      // Category filter (replaces tab logic)
      if (filters.category === 'generics') {
        // Generics tab: only show generic items
        if (!artisan.isGeneric) return false
      } else {
        // All other tabs: hide generic items
        if (artisan.isGeneric) return false

        if (filters.category && filters.category !== 'all') {
          const source = artisan.source || artisan.producedBy?.machine

          if (filters.category === 'animal') {
            // Animal products: items with animal sources
            const animalSources = ['White Chicken', 'Brown Chicken', 'Cow', 'Goat', 'Sheep', 'Pig', 'Rabbit', 'Duck', 'Dinosaur', 'Ostrich']
            if (!animalSources.some(animal => source?.includes(animal))) return false
          } else if (filters.category === 'tree') {
            // Tree products: tapper outputs
            const treeSources = ['Oak Tree', 'Maple Tree', 'Pine Tree', 'Mahogany Tree', 'Mystic Tree']
            if (!treeSources.some(tree => source?.includes(tree))) return false
          } else if (filters.category === 'machine') {
            // Machine products: items made in machines (not from animals/trees)
            const machines = ['Keg', 'Preserves Jar', 'Mayonnaise Machine', 'Cheese Press', 'Loom', 'Oil Maker', 'Fish Smoker']
            if (!artisan.producedBy?.machine || !machines.some(m => artisan.producedBy.machine.includes(m))) return false
          }
        }
      }

      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase()
        if (!artisan.name.toLowerCase().includes(search)) return false
      }

      if (filters.source) {
        const itemSource = artisan.source || artisan.producedBy?.machine
        if (itemSource !== filters.source) return false
      }

      if (filters.bundle) {
        const artisanBundleIds = artisan.bundleDetails?.map(b => b.id) || []
        if (filters.bundle === 'none') {
          if (artisanBundleIds.length > 0) return false
        } else if (filters.bundle === 'any') {
          if (artisanBundleIds.length === 0) return false
        } else {
          if (!artisanBundleIds.includes(filters.bundle)) return false
        }
      }

      return true
    })
  }, [data.artisan, debouncedSearch, filters.category, filters.source, filters.bundle])

  if (loading) {
    return <div className="artisan-page"></div>
  }

  if (error) {
    return <div className="artisan-page"><p className="error">Error: {error}</p></div>
  }


  return (
    <div className="artisan-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Artisan Goods</h2>
        </PagePanel.Header>

        <PagePanel.Tabs>
          <Tabs
            tabs={tabs}
            activeTab={filters.category || 'all'}
            onTabChange={(tabId) => setFilters({ ...filters, category: tabId })}
          />
        </PagePanel.Tabs>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Item name..."
              value={filters.search || ''}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          {filterOptions.sources && (
            <div className="filter-group">
              <label className="filter-label">Source</label>
              <select
                value={filters.source || ''}
                onChange={e => setFilters({ ...filters, source: e.target.value })}
              >
                <option value="">All Sources</option>
                {filterOptions.sources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
          )}

          {filterOptions.bundles && (
            <div className="filter-group">
              <label className="filter-label">Bundle</label>
              <select
                value={filters.bundle || ''}
                onChange={e => setFilters({ ...filters, bundle: e.target.value })}
              >
                <option value="">All Items</option>
                <option value="any">Any Bundle</option>
                <option value="none">No Bundle</option>
                {filterOptions.bundles.map(bundle => (
                  <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            className="clear-filters"
            onClick={() => setFilters({ ...filters, search: '', source: '', bundle: '' })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <ArtisanTable
        artisanGoods={filteredArtisan}
        allArtisan={data.artisan}
      />
    </div>
  )
}

export default ArtisanPage

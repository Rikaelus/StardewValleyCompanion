import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useArtisanData } from '../../hooks/useData'
import PagePanel from '../common/PagePanel'
import Tabs from '../common/Tabs'
import ArtisanTable from './ArtisanTable'
import './ArtisanPage.css'

function ArtisanPage() {
  const { data, loading, error } = useArtisanData()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Get state from URL
  const activeTab = searchParams.get('tab') || 'goods'
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    source: searchParams.get('source') || '',
    bundle: searchParams.get('bundle') || '',
  })

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams) // Preserve existing params (sort, page)

    // Update tab param
    if (activeTab !== 'goods') {
      params.set('tab', activeTab)
    } else {
      params.delete('tab')
    }

    // Update filter params
    if (filters.search) {
      params.set('search', filters.search)
    } else {
      params.delete('search')
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

    setSearchParams(params, { replace: true })
  }, [activeTab, filters, setSearchParams, searchParams])

  const handleTabChange = (tabId) => {
    const params = new URLSearchParams(searchParams) // Preserve sort/page when changing tabs
    params.set('tab', tabId)
    setSearchParams(params)
    setFilters({ search: '', source: '', bundle: '' })
  }

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

  // Define tabs
  const tabs = [
    { id: 'goods', label: 'Goods' },
    { id: 'animal', label: 'Animal Products' },
    { id: 'tree', label: 'Tree Products' },
    { id: 'other', label: 'Other' },
  ]

  // Filter artisan goods by active tab
  const tabFilteredArtisan = useMemo(() => {
    if (!data.artisan) return []

    // For now, all items are in "goods" tab
    // Later we can categorize by tab if needed
    switch (activeTab) {
      case 'goods':
        return data.artisan // All artisan goods
      case 'animal':
        return [] // TODO: Add animal product artisan goods
      case 'tree':
        return [] // TODO: Add tree products (Maple Syrup, Oak Resin, Pine Tar, Honey)
      case 'other':
        return [] // TODO: Add other artisan goods
      default:
        return data.artisan
    }
  }, [data.artisan, activeTab])

  const filteredArtisan = useMemo(() => {
    return tabFilteredArtisan.filter(artisan => {
      if (filters.search) {
        const search = filters.search.toLowerCase()
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
  }, [tabFilteredArtisan, filters])

  if (loading) {
    return <div className="artisan-page"></div>
  }

  if (error) {
    return <div className="artisan-page"><p className="error">Error: {error}</p></div>
  }

  // Get filter configuration based on active tab
  const getFiltersForTab = () => {
    switch (activeTab) {
      case 'goods':
        return {
          searchPlaceholder: 'Item name...',
          customFilters: ['source']
        }
      case 'animal':
        return {
          searchPlaceholder: 'Product name...',
          customFilters: ['source']
        }
      case 'tree':
        return {
          searchPlaceholder: 'Product name...',
          customFilters: ['source']
        }
      case 'other':
        return {
          searchPlaceholder: 'Item name...',
          customFilters: ['source']
        }
      default:
        return {
          searchPlaceholder: 'Item name...',
          customFilters: []
        }
    }
  }

  const tabFilters = getFiltersForTab()

  return (
    <div className="artisan-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Artisan Goods Guide</h2>
        </PagePanel.Header>

        <PagePanel.Tabs>
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </PagePanel.Tabs>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder={tabFilters.searchPlaceholder}
              value={filters.search || ''}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          {tabFilters.customFilters.includes('source') && filterOptions.sources && (
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
            onClick={() => setFilters({})}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      {activeTab === 'goods' ? (
        <ArtisanTable
          artisanGoods={filteredArtisan}
        />
      ) : (
        <div className="empty-state">
          <div className="coming-soon">
            <h3>Coming Soon!</h3>
            <p>{tabs.find(t => t.id === activeTab)?.label} will be added in a future update.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArtisanPage

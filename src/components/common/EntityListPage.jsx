import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItemData } from '../../hooks/useData'
import { useEntities } from '../../contexts/EntityContext'
import { usePlayer } from '../../contexts/PlayerContext'
import { useDebounce } from '../../hooks/useDebounce'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import DataTable from './DataTable'
import PagePanel from './PagePanel'
import Tabs from './Tabs'
import { PAGE_CONFIGS } from './EntityPageConfigs'
import './EntityListPage.css'

function EntityListPage({ pageType }) {
  const config = PAGE_CONFIGS[pageType]
  if (!config) throw new Error(`Unknown page type: ${pageType}`)

  const { data, loading, error } = useItemData(config.dataType || pageType)
  const entities = useEntities()
  const { player } = usePlayer()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [searchParams, setSearchParams] = useSearchParams()

  const professionsRef = useRef(player.professions)
  useEffect(() => {
    professionsRef.current = player.professions
  }, [player.professions])

  // Build context object passed to config functions
  const ctx = useMemo(() => ({
    entities,
    player,
    progress,
    openModal,
    professionsRef,
    data,
  }), [entities, player, progress, openModal, data])

  // Initialize filters from URL
  const [filters, setFilters] = useState(() => {
    const initial = {}
    for (const f of config.filters) {
      if (f.type === 'seasons') {
        initial[f.key] = searchParams.get(f.key)?.split(',').filter(Boolean) || []
      } else {
        initial[f.key] = searchParams.get(f.key) || f.default || ''
      }
    }
    return initial
  })

  // Debounce search if config has a search filter
  const searchFilter = config.filters.find(f => f.type === 'search')
  const searchValue = searchFilter ? filters[searchFilter.key] : ''
  const debouncedSearch = useDebounce(searchValue, 300)

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams)

    for (const f of config.filters) {
      const value = f.type === 'search' ? debouncedSearch : filters[f.key]
      if (f.type === 'seasons') {
        if (value?.length > 0) {
          params.set(f.key, value.join(','))
        } else {
          params.delete(f.key)
        }
      } else if (f.type === 'tabs') {
        if (value && value !== (f.default || 'all')) {
          params.set(f.key, value)
        } else {
          params.delete(f.key)
        }
      } else {
        if (value) {
          params.set(f.key, value)
        } else {
          params.delete(f.key)
        }
      }
    }

    setSearchParams(params, { replace: true })
  }, [debouncedSearch, filters, setSearchParams])

  // Compute dynamic filter options
  const filterOptions = useMemo(() => {
    if (!data.items) return {}
    const opts = {}
    for (const f of config.filters) {
      if (f.getOptions) {
        opts[f.key] = f.getOptions(data.items, ctx)
      }
    }
    return opts
  }, [data.items, ctx])

  // Extra data (e.g. produceById for seeds)
  const extraData = useMemo(() => {
    if (!config.getExtraData) return {}
    return config.getExtraData(ctx)
  }, [ctx])

  // Apply filters
  const filteredData = useMemo(() => {
    if (!data.items) return []

    return data.items.filter(item => {
      for (const f of config.filters) {
        const value = f.type === 'search' ? debouncedSearch : filters[f.key]
        if (f.filterFn && !f.filterFn(item, value, ctx)) return false
      }
      return true
    })
  }, [data.items, debouncedSearch, filters, ctx])

  // Build columns
  const columns = useMemo(() => {
    if (entities.loading) return []
    return config.getColumns(ctx, extraData, filters)
  }, [entities.loading, ctx, extraData, filters])

  if (loading || entities.loading) {
    return <div className="entity-page"></div>
  }

  if (error) {
    return (
      <div className="entity-page">
        <p className="error" style={{ color: '#c62828', padding: '1rem', background: '#ffebee', borderRadius: '4px' }}>
          Error: {error}
        </p>
      </div>
    )
  }

  // Find tabs filter if any
  const tabsFilter = config.filters.find(f => f.type === 'tabs')

  // Build clear filters state
  const clearState = {}
  for (const f of config.filters) {
    if (f.type === 'seasons') clearState[f.key] = []
    else if (f.type === 'tabs') clearState[f.key] = filters[f.key] // keep tab selection on clear
    else clearState[f.key] = ''
  }

  const controlFilters = config.filters.filter(f => f.type !== 'tabs')

  return (
    <div className="entity-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>{config.title}</h2>
        </PagePanel.Header>

        {tabsFilter && (
          <PagePanel.Tabs>
            <Tabs
              tabs={tabsFilter.tabs}
              activeTab={filters[tabsFilter.key] || tabsFilter.default || 'all'}
              onTabChange={(tabId) => setFilters({ ...filters, [tabsFilter.key]: tabId })}
            />
          </PagePanel.Tabs>
        )}

        <PagePanel.Controls>
          {controlFilters.map(f => {
            if (f.type === 'search') {
              return (
                <div key={f.key} className="filter-group">
                  <label className="filter-label">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={filters[f.key] || ''}
                    onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}
                  />
                </div>
              )
            }

            if (f.type === 'seasons') {
              const seasonLabels = f.values || ['Spring', 'Summer', 'Fall', 'Winter']
              return (
                <div key={f.key} className="filter-group">
                  <label className="filter-label">{f.label}</label>
                  <div className="checkbox-group">
                    {seasonLabels.map(season => (
                      <label key={season} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={(filters[f.key] || []).includes(season)}
                          onChange={() => {
                            const current = filters[f.key] || []
                            const updated = current.includes(season)
                              ? current.filter(s => s !== season)
                              : [...current, season]
                            setFilters({ ...filters, [f.key]: updated })
                          }}
                        />
                        {season.charAt(0).toUpperCase() + season.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              )
            }

            if (f.type === 'select') {
              const options = filterOptions[f.key] || f.options || []
              return (
                <div key={f.key} className="filter-group">
                  <label className="filter-label">{f.label}</label>
                  <select
                    value={filters[f.key] || ''}
                    onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}
                  >
                    <option value="">{f.allLabel || 'All'}</option>
                    {f.extraOptions?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                    {options.map(opt => {
                      if (typeof opt === 'string') {
                        return <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                      }
                      return <option key={opt.value} value={opt.value}>{opt.label}</option>
                    })}
                  </select>
                </div>
              )
            }

            return null
          })}

          <button
            className="clear-filters"
            onClick={() => setFilters(clearState)}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      {columns.length > 0 && (
        <DataTable
          data={filteredData}
          columns={columns}
          pinnedColumns={config.pinnedColumns ?? 1}
          initialSortBy={config.initialSortBy}
          itemsPerPage={config.itemsPerPage}
        />
      )}

      {config.getFooter && config.getFooter(filteredData, data.items || [], ctx)}
    </div>
  )
}

export default EntityListPage

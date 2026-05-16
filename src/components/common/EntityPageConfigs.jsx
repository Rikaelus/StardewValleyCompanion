import UniversalModalButton from './UniversalModalButton'
import ItemSellPrice, { createPriceSortingFn } from './ItemSellPrice'
import ShopSourceList from './ShopSourceList'
import {
  createNameColumn,
  createSeasonColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns,
} from './ItemTableFactory'
import SeasonBadges from './SeasonBadges'
import { formatTime, getDifficultyColor, getLocationNames, getEntityLabels } from '../../utils/Formatters'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function nuanceNameColumn(ctx) {
  return createNameColumn({
    cellRenderer: ({ row }) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <UniversalModalButton item={row.original} showIcon showLabel iconSize={24} stopPropagation onNavigate={ctx.openModal} />
        {row.original.hasLocationNuance && <span className="nuance-indicator" title="Availability varies by location — click for details">*</span>}
      </span>
    ),
  })
}

function nuanceFooter(filteredData, _allData, _ctx) {
  const nuanced = filteredData.filter(f => f.hasLocationNuance)
  if (nuanced.length === 0) return null
  return (
    <div className="nuance-note">
      * Seasons and locations shown are the full range of possibilities. Click on an item marked with * to see exact availability per location.
    </div>
  )
}


function getLocationEntities(entity, findById) {
  const sources = entity?.sources || []
  const seen = new Set()
  const results = []
  for (const s of sources) {
    const locEntity = s.locationId && findById ? findById(s.locationId) : null
    const key = locEntity?.id || s.location
    if (key && !seen.has(key)) {
      seen.add(key)
      results.push(locEntity || { id: key, name: s.location })
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name))
}

function locationColumn(ctx) {
  return {
    id: 'locations',
    header: 'Location',
    accessorFn: row => getLocationNames(row, ctx.entities.findById),
    cell: ({ row }) => {
      const locs = getLocationEntities(row.original, ctx.entities.findById)
      if (locs.length === 0) return '—'
      return (
        <span className="cell-location-list">
          {locs.map((loc, i) => (
            <span key={loc.id} className="cell-location-item">
              {loc.type
                ? <UniversalModalButton item={loc} variant="table-inline" stopPropagation />
                : loc.name
              }
            </span>
          ))}
        </span>
      )
    },
  }
}

function getBundleOptions(items, ctx) {
  const bundleMap = new Map()
  items.forEach(item => {
    const bundleIds = item.bundles || []
    bundleIds.forEach(id => {
      if (!bundleMap.has(id)) {
        const bundle = ctx.entities.getBundle(id)
        if (bundle) bundleMap.set(id, bundle)
      }
    })
    })
  return Array.from(bundleMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(b => ({ value: b.id, label: b.name }))
}

function bundleFilterFn(item, value, _ctx) {
  if (!value) return true
  const bundleIds = item.bundles || []
  if (value === '__any__') return bundleIds.length > 0
  if (value === '__none__') return bundleIds.length === 0
  return bundleIds.includes(value)
}

function searchFilterFn(item, value) {
  if (!value) return true
  return item.name.toLowerCase().includes(value.toLowerCase())
}

function seasonsAllFilterFn(item, value) {
  if (!value || value.length === 0) return true
  const itemSeasons = item.seasons?.map(s => s.toLowerCase()) || []
  return value.every(s => itemSeasons.includes(s.toLowerCase()))
}

function seasonsAnyFilterFn(item, value) {
  if (!value || value.length === 0) return true
  const itemSeasons = item.seasons || []
  return value.some(s => itemSeasons.includes(s))
}

function subtypeFilterFn(item, value) {
  if (!value) return true
  return item.subtype === value
}

function getSubtypeOptions(items) {
  return [...new Set(items.map(i => i.subtype).filter(Boolean))].sort()
}

function getLocationOptions(items, ctx) {
  return [...new Set(items.flatMap(f => getLocationNames(f, ctx.entities.findById)))].sort()
}

// ─── Fish ──────────────────────────────────────────────────────────────────────

const FISH_CONFIG = {
  title: 'Fish',
  dataType: 'fish',
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Fish name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'seasons', type: 'seasons', label: 'Season',
      values: ['Spring', 'Summer', 'Fall', 'Winter'],
      filterFn: seasonsAllFilterFn,
    },
    {
      key: 'weather', type: 'select', label: 'Weather', allLabel: 'All Weather',
      options: [{ value: 'Sunny', label: 'Sunny' }, { value: 'Rain', label: 'Rain' }],
      filterFn: (item, value) => {
        if (!value) return true
        const fishWeather = item.weather?.toLowerCase()
        const normalized = value.toLowerCase() === 'rain' ? 'rainy' : value.toLowerCase()
        return fishWeather === normalized || fishWeather === 'both'
      },
    },
    {
      key: 'location', type: 'select', label: 'Location', allLabel: 'All Locations',
      getOptions: getLocationOptions,
      filterFn: (item, value, ctx) => {
        if (!value) return true
        return getLocationNames(item, ctx.entities.findById).includes(value)
      },
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Fish',
      extraOptions: [
        { value: '__any__', label: 'Any Bundle' },
        { value: '__none__', label: 'No Bundle' },
      ],
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, progress, openModal, professionsRef } = ctx
    const { villagers: { all: villagers }, findById, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn({
        cellRenderer: ({ row }) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {progress.hasSaveData && (
              <span
                className={`caught-indicator ${progress.isFishCaught(row.original.gameId) ? 'caught' : 'not-caught'}`}
                title={progress.isFishCaught(row.original.gameId) ? 'Caught' : 'Not caught'}
              >
                {progress.isFishCaught(row.original.gameId) ? '✓' : '○'}
              </span>
            )}
            <UniversalModalButton item={row.original} showIcon showLabel iconSize={24} stopPropagation onNavigate={openModal} />
            {row.original.contextTags?.includes('fish_legendary') && <span title="Legendary Fish">⭐</span>}
            {row.original.hasLocationNuance && <span className="nuance-indicator" title="Availability varies by location — click for details">*</span>}
          </span>
        ),
      }),
      locationColumn(ctx),
      createSeasonColumn(),
      {
        accessorKey: 'times',
        header: 'Time',
        cell: ({ getValue }) => {
          const times = getValue() || []
          if (times.length === 0) return '—'
          return times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')
        },
        enableSorting: false,
      },
      {
        accessorKey: 'weather',
        header: 'Weather',
        cell: ({ getValue }) => {
          const w = getValue()
          return w === 'rainy' ? '🌧' : w === 'sunny' ? '☀️' : '—'
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'behaviorType',
        header: 'Behavior',
        cell: ({ getValue }) => {
          const behavior = getValue()
          if (!isNaN(behavior)) return 'Crab Pot'
          return behavior.charAt(0).toUpperCase() + behavior.slice(1)
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'difficulty',
        header: 'Diff',
        cell: ({ getValue }) => {
          const diff = getValue()
          return (
            <span className="difficulty" style={{ color: getDifficultyColor(diff) }} title={`Difficulty: ${diff}`}>
              {diff}
            </span>
          )
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'minFishingLevel',
        header: 'Min Lvl',
        cell: ({ getValue }) => {
          const minLevel = getValue()
          if (!minLevel) return <span className="cell-muted">—</span>
          return (
            <span className="cell-level" title={`Minimum Fishing Level: ${minLevel}`}>
              {minLevel}
            </span>
          )
        },
        meta: { align: 'center' },
      },
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
  getFooter: nuanceFooter,
}

// ─── Crops ─────────────────────────────────────────────────────────────────────

const CROPS_CONFIG = {
  title: 'Crops',
  dataType: 'crops',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Crop name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'seasons', type: 'seasons', label: 'Season',
      values: ['spring', 'summer', 'fall', 'winter'],
      filterFn: seasonsAllFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: getSubtypeOptions,
      filterFn: subtypeFilterFn,
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, professionsRef } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      createSeasonColumn({ greenhouse: true, gingerIsland: true }),
      {
        accessorKey: 'growthDays',
        header: 'Growth',
        cell: ({ row }) => {
          const { growthDays, regrowDays } = row.original
          if (!growthDays) return '—'
          return regrowDays ? `${growthDays}d (+${regrowDays}d)` : `${growthDays}d`
        },
        enableSorting: true,
        meta: { align: 'center' },
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => (
          <ItemSellPrice item={row.original} showQualities={row.original.maxQuality !== 0} />
        ),
        sortingFn: (rowA, rowB) => createPriceSortingFn(professionsRef.current)(rowA, rowB),
        meta: { align: 'left' },
      },
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
}

// ─── Seeds ─────────────────────────────────────────────────────────────────────

const SEEDS_CONFIG = {
  title: 'Seeds',
  dataType: 'seeds',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Seed or crop name...',
      filterFn: (item, value) => {
        if (!value) return true
        const q = value.toLowerCase()
        const cropNameMatch = item.produces?.some(p => p.cropName.toLowerCase().includes(q))
        return item.name.toLowerCase().includes(q) || cropNameMatch
      },
    },
    {
      key: 'seasons', type: 'seasons', label: 'Season',
      values: ['spring', 'summer', 'fall', 'winter'],
      filterFn: seasonsAllFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: (items) => {
        return [...new Set(items.flatMap(s => s.produces?.map(p => p.cropType) || []).filter(Boolean))].sort()
      },
      filterFn: (item, value) => {
        if (!value) return true
        return item.produces?.some(p => p.cropType === value)
      },
    },
  ],
  getExtraData: (ctx) => {
    const { entities } = ctx
    const map = new Map()
    ;(entities.byType['crop'] || []).forEach(c => map.set(c.id, c))
    ;(entities.byType['forage'] || []).forEach(f => map.set(f.id, f))
    return { cropsById: map }
  },
  getColumns: (ctx, extraData) => {
    const { professionsRef } = ctx
    const { cropsById } = extraData

    return [
      createNameColumn(),
      {
        accessorKey: 'produces',
        header: 'Crop',
        cell: ({ row }) => {
          const produces = row.original.produces || []
          if (produces.length === 0) return '—'
          if (produces.length === 1) {
            const crop = cropsById.get(produces[0].cropId)
            if (!crop) return <strong>{produces[0].cropName}</strong>
            return <UniversalModalButton item={crop} variant="inline" stopPropagation />
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {produces.map(p => {
                const crop = cropsById.get(p.cropId)
                return (
                  <div key={p.cropId}>
                    {crop
                      ? <UniversalModalButton item={crop} variant="inline" stopPropagation />
                      : <strong>{p.cropName}</strong>
                    }
                  </div>
                )
              })}
            </div>
          )
        },
        sortingFn: (rowA, rowB) => {
          const nameA = rowA.original.produces?.[0]?.cropName ?? ''
          const nameB = rowB.original.produces?.[0]?.cropName ?? ''
          return nameA.localeCompare(nameB)
        },
      },
      { ...createSeasonColumn({ greenhouse: true, gingerIsland: true }), header: 'Growth Season' },
      {
        id: 'growthDays',
        header: 'Growth',
        cell: ({ row }) => {
          const produces = row.original.produces || []
          if (produces.length === 0) return '—'
          if (produces.length === 1) {
            const { growthDays, regrowDays } = produces[0]
            if (!growthDays) return '—'
            return regrowDays ? `${growthDays}d (+${regrowDays}d)` : `${growthDays}d`
          }
          const days = produces.map(p => p.growthDays).filter(Boolean)
          if (days.length === 0) return '—'
          const min = Math.min(...days)
          const max = Math.max(...days)
          return min === max ? `${min}d` : `${min}–${max}d`
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const daysA = rowA.original.produces?.[0]?.growthDays ?? 0
          const daysB = rowB.original.produces?.[0]?.growthDays ?? 0
          return daysA - daysB
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'buyPrice',
        header: 'Buy Price',
        cell: ({ getValue }) => {
          const price = getValue()
          if (!price) return '—'
          return <span style={{ fontFamily: 'monospace' }}>{price.toLocaleString()}g</span>
        },
        enableSorting: true,
        meta: { align: 'right' },
      },
      {
        id: 'cropPrice',
        header: 'Crop Sells For',
        cell: ({ row }) => {
          const produces = row.original.produces || []
          if (produces.length === 0) return '—'
          if (produces.length === 1) {
            const crop = cropsById.get(produces[0].cropId)
            if (!crop) return '—'
            return <ItemSellPrice item={crop} showQualities={crop.maxQuality !== 0} />
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {produces.map(p => {
                const crop = cropsById.get(p.cropId)
                if (!crop) return null
                return (
                  <div key={p.cropId}>
                    <ItemSellPrice item={crop} showQualities={crop.maxQuality !== 0} />
                  </div>
                )
              })}
            </div>
          )
        },
        sortingFn: (rowA, rowB) => {
          const fn = createPriceSortingFn(professionsRef.current)
          const cropA = cropsById.get(rowA.original.produces?.[0]?.cropId) ?? { price: 0 }
          const cropB = cropsById.get(rowB.original.produces?.[0]?.cropId) ?? { price: 0 }
          const fakeA = { ...rowA, original: cropA }
          const fakeB = { ...rowB, original: cropB }
          return fn(fakeA, fakeB)
        },
        meta: { align: 'left' },
      },
      {
        accessorKey: 'sources',
        header: 'Where to Buy',
        cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
        enableSorting: false,
      },
    ]
  },
}

// ─── Artisan ───────────────────────────────────────────────────────────────────

const ARTISAN_CONFIG = {
  title: 'Artisan Goods',
  dataType: 'artisan',
  filters: [
    {
      key: 'category', type: 'tabs', label: 'Category', default: 'all',
      tabs: [
        { id: 'all', label: 'All' },
        { id: 'tree', label: 'Tree Products' },
        { id: 'machine', label: 'Machine Products' },
        { id: 'generics', label: 'Generics' },
      ],
      filterFn: (item, value) => {
        if (value === 'generics') return item.isGeneric
        if (item.isGeneric) return false
        if (!value || value === 'all') return true
        const machineSource = item.sources?.find(s => s.type === 'machine')
        const tapperSource = item.sources?.find(s => s.type === 'tapper')
        if (value === 'tree') return !!tapperSource
        if (value === 'machine') return !!machineSource
        return true
      },
    },
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Item name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'source', type: 'select', label: 'Source', allLabel: 'All Sources',
      getOptions: (items, ctx) => {
        const ids = [...new Set(items.map(a => a.sources?.find(s => s.type === 'machine')?.id).filter(Boolean))].sort()
        return ids.map(id => ({ value: id, label: ctx.entities.findById(id)?.name ?? id }))
      },
      filterFn: (item, value) => {
        if (!value) return true
        return item.sources?.find(s => s.type === 'machine')?.id === value
      },
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      extraOptions: [
        { value: '__any__', label: 'Any Bundle' },
        { value: '__none__', label: 'No Bundle' },
      ],
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx, _extra, filters) => {
    const { entities, professionsRef, data } = ctx
    const { villagers: { all: villagers }, findById, ...relationalData } = entities
    const allArtisan = data.items || []
    const isGenerics = filters?.category === 'generics'

    if (relationalData.loading) return []

    const processingTimeCell = ({ row }) => {
      const minutes = row.original.processingTimeMinutes
      if (!minutes) return '—'
      const hours = minutes / 60
      if (hours >= 24) return `${Math.round(hours / 24 * 10) / 10}d`
      return `${Math.round(hours * 10) / 10}h`
    }

    const caskCell = ({ getValue }) => {
      const days = getValue()
      if (!days) return '—'
      return `${days}d`
    }

    if (isGenerics) {
      return [
        createNameColumn(),
        {
          id: 'machine',
          accessorFn: (row) => row.sources?.find(s => s.type === 'machine')?.id,
          header: 'Machine',
          cell: ({ row }) => {
            const src = row.original.sources?.find(s => s.type === 'machine')
            return src?.id ? (findById(src.id)?.name ?? src.id) : '—'
          },
        },
        {
          id: 'inputType',
          accessorFn: (row) => row.sources?.find(s => s.type === 'machine')?.inputType,
          header: 'Input Type',
          cell: ({ row }) => {
            const type = row.original.sources?.find(s => s.type === 'machine')?.inputType
            if (!type) return '—'
            if (type === 'specific') return 'Specific'
            const genericMatch = allArtisan.find(i => i.id === type && i.isGeneric)
            if (genericMatch) return <UniversalModalButton item={genericMatch} variant="inline" />
            return type.charAt(0).toUpperCase() + type.slice(1)
          },
        },
        {
          id: 'processingTime',
          accessorFn: (row) => row.processingTimeMinutes ? row.processingTimeMinutes / 60 : null,
          header: 'Time',
          cell: processingTimeCell,
          meta: { align: 'center' },
        },
        {
          accessorKey: 'agingDaysToIridium',
          header: 'Cask',
          cell: caskCell,
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

    const base = [
      createNameColumn(),
      {
        id: 'source',
        accessorFn: (row) => {
          const machineSource = row.sources?.find(s => s.type === 'machine')
          const tapperSource = row.sources?.find(s => s.type === 'tapper')
          return machineSource?.id || tapperSource?.treeName || null
        },
        header: 'Source',
        cell: ({ row }) => {
          const machineSource = row.original.sources?.find(s => s.type === 'machine')
          const tapperSource = row.original.sources?.find(s => s.type === 'tapper')
          if (machineSource?.id) return findById(machineSource.id)?.name ?? machineSource.id
          return tapperSource?.treeName || '—'
        },
      },
      {
        id: 'processingTime',
        accessorFn: (row) => row.processingTimeMinutes ? row.processingTimeMinutes / 60 : null,
        header: 'Time',
        cell: processingTimeCell,
        meta: { align: 'center' },
      },
      {
        accessorKey: 'agingDaysToIridium',
        header: 'Cask',
        cell: caskCell,
        meta: { align: 'center' },
      },
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
}

// ─── Forage ────────────────────────────────────────────────────────────────────

const FORAGE_CONFIG = {
  title: 'Foraged Items',
  dataType: 'forage',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Forage name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'seasons', type: 'seasons', label: 'Season',
      values: ['Spring', 'Summer', 'Fall', 'Winter'],
      filterFn: seasonsAnyFilterFn,
    },
    {
      key: 'location', type: 'select', label: 'Location', allLabel: 'All Locations',
      getOptions: getLocationOptions,
      filterFn: (item, value, ctx) => {
        if (!value) return true
        return getLocationNames(item, ctx.entities.findById).includes(value)
      },
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, openModal } = ctx
    const { villagers: { all: villagers }, findById, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      nuanceNameColumn(ctx),
      {
        id: 'locations',
        header: 'Locations',
        accessorFn: row => getLocationNames(row, findById),
        cell: ({ row }) => {
          const locs = getLocationEntities(row.original, findById)
          if (locs.length === 0) return <span style={{ color: '#999' }}>Unknown</span>
          return (
            <span className="cell-location-list">
              {locs.map((loc, i) => (
                <span key={loc.id} className="cell-location-item">
                  {loc.type
                    ? <UniversalModalButton item={loc} variant="table-inline" stopPropagation />
                    : loc.name
                  }
                    </span>
              ))}
            </span>
          )
        },
        enableSorting: false,
      },
      createSeasonColumn(),
      createPriceColumn(),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
  getFooter: nuanceFooter,
}

// ─── Furniture ─────────────────────────────────────────────────────────────────

const FURNITURE_CONFIG = {
  title: 'Furniture',
  dataType: 'furniture',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Furniture name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: getSubtypeOptions,
      filterFn: subtypeFilterFn,
    },
  ],
  getColumns: (ctx) => [
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
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Hats ──────────────────────────────────────────────────────────────────────

const HATS_CONFIG = {
  title: 'Hats',
  dataType: 'hats',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Hat name or description...',
      filterFn: (item, value) => {
        if (!value) return true
        const q = value.toLowerCase()
        return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
      },
    },
  ],
  getColumns: (ctx) => [
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
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Animal Products ──────────────────────────────────────────────────────────

const ANIMAL_PRODUCTS_CONFIG = {
  title: 'Animal Products',
  dataType: 'animal-products',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Product name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: getSubtypeOptions,
      filterFn: subtypeFilterFn,
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      extraOptions: [
        { value: '__any__', label: 'Any Bundle' },
        { value: '__none__', label: 'No Bundle' },
      ],
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, professionsRef } = ctx
    const { villagers: { all: villagers }, findById, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      {
        accessorKey: 'subtype',
        header: 'Type',
        cell: ({ getValue }) => {
          const t = getValue()
          return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
        },
      },
      {
        id: 'animal',
        header: 'Source',
        accessorFn: row => {
          const animalSources = row.sources?.filter(s => s.type === 'animal') || []
          return animalSources.map(s => findById(s.id)?.name ?? s.id).join(', ')
        },
        cell: ({ row }) => {
          const animalSources = row.original.sources?.filter(s => s.type === 'animal') || []
          if (animalSources.length === 0) return '—'
          return (
            <span className="cell-location-list">
              {animalSources.map(s => {
                const animal = findById(s.id)
                return (
                  <span key={s.id} className="cell-location-item">
                    {animal
                      ? <UniversalModalButton item={animal} variant="table-inline" stopPropagation />
                      : s.id}
                  </span>
                )
              })}
            </span>
          )
        },
        enableSorting: false,
      },
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
}

// ─── Tree Fruit ───────────────────────────────────────────────────────────────

const TREE_FRUIT_CONFIG = {
  title: 'Tree Fruit',
  dataType: 'tree-fruits',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Fruit name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'seasons', type: 'seasons', label: 'Season',
      values: ['Spring', 'Summer', 'Fall', 'Winter'],
      filterFn: seasonsAnyFilterFn,
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, professionsRef } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      createSeasonColumn({ greenhouse: true, gingerIsland: true }),
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
}

// ─── Trees ────────────────────────────────────────────────────────────────────

const TREES_CONFIG = {
  title: 'Trees',
  dataType: 'trees',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Tree name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      options: [
        { value: 'fruit-tree', label: 'Fruit Tree' },
        { value: 'wild-tree', label: 'Wild Tree' },
      ],
      filterFn: (item, value) => {
        if (!value) return true
        return item.subtype === value
      },
    },
  ],
  getColumns: (ctx) => {
    const { entities } = ctx

    return [
      createNameColumn(),
      {
        accessorKey: 'subtype',
        header: 'Type',
        cell: ({ getValue }) => getValue() === 'fruit-tree' ? 'Fruit Tree' : 'Wild Tree',
      },
      {
        accessorKey: 'seasons',
        header: 'Season',
        cell: ({ row }) => {
          const seasons = row.original.seasons || []
          const isFruitTree = row.original.subtype === 'fruit-tree'
          return <SeasonBadges seasons={seasons} greenhouse={isFruitTree} gingerIsland={isFruitTree} />
        },
      },
      {
        id: 'seed',
        header: 'Planted From',
        cell: ({ row }) => {
          const seedId = row.original.saplingId || row.original.seedId
          if (!seedId) return '—'
          const seed = entities.findById(seedId)
          if (!seed) return seedId
          return <UniversalModalButton item={seed} variant="table-inline" stopPropagation />
        },
        enableSorting: false,
      },
      {
        id: 'produces',
        header: 'Produces',
        cell: ({ row }) => {
          const o = row.original
          // Fruit trees produce fruit
          if (o.fruitId) {
            const fruit = entities.findById(o.fruitId)
            if (fruit) return <UniversalModalButton item={fruit} variant="table-inline" stopPropagation />
            return o.fruitName || '—'
          }
          // Wild trees produce tap items
          const tapItems = o.tapItems || []
          if (tapItems.length === 0) return o.dropsWood ? 'Wood' : '—'
          return (
            <span className="cell-location-list">
              {tapItems.map(t => {
                const item = entities.findById(t.id)
                return (
                  <span key={t.id} className="cell-location-item">
                    {item
                      ? <UniversalModalButton item={item} variant="table-inline" stopPropagation />
                      : t.name}
                    {t.daysUntilReady && <span className="cell-muted"> ({t.daysUntilReady}d)</span>}
                  </span>
                )
              })}
            </span>
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: 'daysToMature',
        header: 'Mature',
        cell: ({ getValue }) => {
          const d = getValue()
          return d ? `${d}d` : '—'
        },
        meta: { align: 'center' },
      },
    ]
  },
}

// ─── Bait ─────────────────────────────────────────────────────────────────────

const BAIT_CONFIG = {
  title: 'Bait',
  dataType: 'bait',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Bait name...',
      filterFn: searchFilterFn,
    },
  ],
  getColumns: (ctx) => [
    createNameColumn(),
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ getValue }) => {
        const price = getValue()
        if (!price) return '—'
        return <span style={{ fontFamily: 'monospace' }}>{price.toLocaleString()}g</span>
      },
      meta: { align: 'right' },
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Tackle ───────────────────────────────────────────────────────────────────

const TACKLE_CONFIG = {
  title: 'Tackle',
  dataType: 'tackle',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Tackle name...',
      filterFn: searchFilterFn,
    },
  ],
  getColumns: (ctx) => [
    createNameColumn(),
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ getValue }) => {
        const price = getValue()
        if (!price) return '—'
        return <span style={{ fontFamily: 'monospace' }}>{price.toLocaleString()}g</span>
      },
      meta: { align: 'right' },
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Minerals ─────────────────────────────────────────────────────────────────

const MINERALS_CONFIG = {
  title: 'Minerals',
  dataType: 'minerals',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Mineral name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: getSubtypeOptions,
      filterFn: subtypeFilterFn,
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      extraOptions: [
        { value: '__any__', label: 'Any Bundle' },
        { value: '__none__', label: 'No Bundle' },
      ],
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, professionsRef } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      {
        accessorKey: 'subtype',
        header: 'Type',
        cell: ({ getValue }) => {
          const t = getValue()
          return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
        },
      },
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
}

// ─── Resources ────────────────────────────────────────────────────────────────

const RESOURCES_CONFIG = {
  title: 'Resources',
  dataType: 'resources',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Resource name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, professionsRef } = ctx
    const { ...relationalData } = entities

    if (relationalData.loading) return []

    return [
      createNameColumn(),
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]
  },
}

// ─── Monsters ─────────────────────────────────────────────────────────────────

const MONSTERS_CONFIG = {
  title: 'Monsters',
  dataType: 'monsters',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Monster name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'location', type: 'select', label: 'Location', allLabel: 'All Locations',
      getOptions: (items, ctx) => {
        const locs = new Set()
        items.forEach(m => m.locations?.forEach(l => {
          const loc = ctx.entities.findById(l.locationId)
          if (loc) locs.add(loc.name)
        }))
        return [...locs].sort()
      },
      filterFn: (item, value, ctx) => {
        if (!value) return true
        return item.locations?.some(l => {
          const loc = ctx.entities.findById(l.locationId)
          return loc?.name === value
        })
      },
    },
  ],
  getColumns: (ctx) => {
    const { entities } = ctx
    const { findById } = entities

    return [
      createNameColumn(),
      {
        accessorKey: 'hp',
        header: 'HP',
        meta: { align: 'right' },
      },
      {
        accessorKey: 'damageToFarmer',
        header: 'Damage',
        meta: { align: 'right' },
      },
      {
        accessorKey: 'speed',
        header: 'Speed',
        meta: { align: 'center' },
      },
      {
        id: 'locations',
        header: 'Locations',
        accessorFn: row => (row.locations || []).map(l => findById(l.locationId)?.name ?? l.locationId).join(', '),
        cell: ({ row }) => {
          const locs = row.original.locations || []
          if (locs.length === 0) return '—'
          return (
            <span className="cell-location-list">
              {locs.map((l, i) => {
                const loc = findById(l.locationId)
                const qualifier = l.qualifier ? ` (${l.qualifier})` : ''
                return (
                  <span key={i} className="cell-location-item">
                    {loc
                      ? <><UniversalModalButton item={loc} variant="table-inline" stopPropagation />{qualifier}</>
                      : `${l.locationId}${qualifier}`}
                  </span>
                )
              })}
            </span>
          )
        },
        enableSorting: false,
      },
      {
        id: 'drops',
        header: 'Drops',
        cell: ({ row }) => {
          const monsterId = row.original.id
          const dropItems = entities.items
            .filter(item => item.sources?.some(s => s.type === 'monster-drop' && s.monsterId === monsterId))
            .slice(0, 5)
          if (dropItems.length === 0) return '—'
          const totalCount = entities.items.filter(item => item.sources?.some(s => s.type === 'monster-drop' && s.monsterId === monsterId)).length
          return (
            <span className="cell-location-list">
              {dropItems.map((item, i) => (
                <span key={i} className="cell-location-item">
                  <UniversalModalButton item={item} variant="table-inline" stopPropagation />
                </span>
              ))}
              {totalCount > 5 && <span className="cell-muted">+{totalCount - 5} more</span>}
            </span>
          )
        },
        enableSorting: false,
      },
    ]
  },
}

// ─── Weapons ──────────────────────────────────────────────────────────────────

const WEAPONS_CONFIG = {
  title: 'Weapons',
  dataType: 'weapons',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Weapon name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: getSubtypeOptions,
      filterFn: subtypeFilterFn,
    },
  ],
  getColumns: () => [
    createNameColumn(),
    {
      accessorKey: 'subtype',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue()
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
      },
    },
    {
      id: 'damage',
      header: 'Damage',
      accessorFn: row => row.minDamage ?? 0,
      cell: ({ row }) => {
        const { minDamage, maxDamage } = row.original
        if (minDamage == null) return '—'
        return `${minDamage}–${maxDamage}`
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'speed',
      header: 'Speed',
      cell: ({ getValue }) => {
        const v = getValue()
        if (v == null) return '—'
        return v > 0 ? `+${v}` : String(v)
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'defense',
      header: 'Def',
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? `+${v}` : '—'
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'critChance',
      header: 'Crit %',
      cell: ({ getValue }) => {
        const v = getValue()
        if (v == null) return '—'
        return `${Math.round(v * 100)}%`
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'critMultiplier',
      header: 'Crit ×',
      cell: ({ getValue }) => {
        const v = getValue()
        return v != null ? `${v}×` : '—'
      },
      meta: { align: 'center' },
    },
  ],
}

// ─── Boots ────────────────────────────────────────────────────────────────────

const BOOTS_CONFIG = {
  title: 'Boots',
  dataType: 'boots',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Boot name...',
      filterFn: searchFilterFn,
    },
  ],
  getColumns: (ctx) => [
    createNameColumn(),
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'defense',
      header: 'Defense',
      cell: ({ getValue }) => {
        const v = getValue()
        return v != null ? `+${v}` : '—'
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'immunity',
      header: 'Immunity',
      cell: ({ getValue }) => {
        const v = getValue()
        return v != null ? `+${v}` : '—'
      },
      meta: { align: 'center' },
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Rings ────────────────────────────────────────────────────────────────────

const RINGS_CONFIG = {
  title: 'Rings',
  dataType: 'rings',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Ring name...',
      filterFn: searchFilterFn,
    },
  ],
  getColumns: (ctx) => [
    createNameColumn(),
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ getValue }) => {
        const price = getValue()
        if (!price) return '—'
        return <span style={{ fontFamily: 'monospace' }}>{price.toLocaleString()}g</span>
      },
      meta: { align: 'right' },
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

const ARTIFACTS_CONFIG = {
  title: 'Artifacts',
  dataType: 'artifacts',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Artifact name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'bundle', type: 'select', label: 'Bundle', allLabel: 'All Items',
      getOptions: getBundleOptions,
      filterFn: bundleFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities, professionsRef } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      createPriceColumn(professionsRef),
      createBundleColumn(relationalData),
    ]

    return [...base, ...createVillagerGiftColumns(villagers, relationalData)]
  },
}

// ─── Clothing ─────────────────────────────────────────────────────────────────

const CLOTHING_CONFIG = {
  title: 'Clothing',
  dataType: 'clothing',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Clothing name...',
      filterFn: (item, value) => {
        if (!value) return true
        const q = value.toLowerCase()
        return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
      },
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: getSubtypeOptions,
      filterFn: subtypeFilterFn,
    },
  ],
  getColumns: (ctx) => [
    createNameColumn(),
    {
      accessorKey: 'subtype',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue()
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
      enableSorting: false,
    },
  ],
}

// ─── Villagers ────────────────────────────────────────────────────────────────

const VILLAGERS_CONFIG = {
  title: 'Villagers',
  dataType: 'villagers',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Villager name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'romance', type: 'select', label: 'Romance', allLabel: 'All',
      options: [
        { value: 'yes', label: 'Romanceable' },
        { value: 'no', label: 'Non-romanceable' },
      ],
      filterFn: (item, value) => {
        if (!value) return true
        return value === 'yes' ? item.canBeRomanced : !item.canBeRomanced
      },
    },
  ],
  getColumns: (ctx) => {
    const { entities } = ctx

    return [
      createNameColumn(),
      {
        id: 'birthday',
        header: 'Birthday',
        accessorFn: row => {
          if (!row.birthday) return ''
          const seasonOrder = { spring: 0, summer: 1, fall: 2, winter: 3 }
          return (seasonOrder[row.birthday.season] ?? 0) * 100 + row.birthday.day
        },
        cell: ({ row }) => {
          const b = row.original.birthday
          if (!b) return '—'
          return `${b.season.charAt(0).toUpperCase() + b.season.slice(1)} ${b.day}`
        },
      },
      {
        accessorKey: 'canBeRomanced',
        header: 'Romance',
        cell: ({ getValue }) => getValue() ? '💕' : '—',
        meta: { align: 'center' },
      },
      {
        id: 'home',
        header: 'Home',
        accessorFn: row => row.homeRegion || '',
        cell: ({ row }) => {
          const loc = row.original.homeLocation ? entities.findById(row.original.homeLocation) : null
          if (loc) return <UniversalModalButton item={loc} variant="table-inline" stopPropagation />
          return row.original.homeRegion || '—'
        },
      },
      {
        id: 'loves',
        header: 'Loves',
        enableSorting: false,
        cell: ({ row }) => {
          const gifts = entities.getVillagerGifts(row.original.id)
          const loved = gifts
            .filter(g => g.preference === 'love')
            .map(g => entities.findById(g.itemId))
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name))
          if (loved.length === 0) return '—'
          const showOwnership = ctx.progress.hasSaveData
          return (
            <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.2rem' }}>
              {loved.map(item => {
                const owned = showOwnership ? ctx.progress.getOwnedCount(item.gameId) : 0
                return (
                  <span
                    key={item.id}
                    title={showOwnership ? (owned > 0 ? `${item.name} — you have ${owned}` : `${item.name} — you don't have any`) : item.name}
                  >
                    <UniversalModalButton
                      item={item}
                      showIcon
                      showLabel={false}
                      iconSize={20}
                      stopPropagation
                    />
                  </span>
                )
              })}
            </span>
          )
        },
      },
    ]
  },
}

// ─── Breakables ──────────────────────────────────────────────────────────────

const BREAKABLES_CONFIG = {
  title: 'Breakables',
  dataType: 'breakables',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Breakable name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: (items) => {
        const subtypes = [...new Set(items.map(i => i.subtype).filter(Boolean))]
        return subtypes
          .map(s => ({ value: s, label: getEntityLabels({ type: 'breakable', subtype: s }).subtype || s }))
          .sort((a, b) => a.label.localeCompare(b.label))
      },
      filterFn: subtypeFilterFn,
    },
    {
      key: 'location', type: 'select', label: 'Location', allLabel: 'All Locations',
      getOptions: (items, ctx) => {
        const locs = new Set()
        items.forEach(b => b.locations?.forEach(locId => {
          const loc = ctx.entities.findById(locId)
          if (loc) locs.add(loc.name)
        }))
        return [...locs].sort()
      },
      filterFn: (item, value, ctx) => {
        if (!value) return true
        return item.locations?.some(locId => {
          const loc = ctx.entities.findById(locId)
          return loc?.name === value
        })
      },
    },
  ],
  getColumns: (ctx) => {
    const { entities } = ctx
    const { findById } = entities

    return [
      createNameColumn(),
      {
        accessorKey: 'subtype',
        header: 'Type',
        cell: ({ row }) => {
          const { subtype: label } = getEntityLabels(row.original)
          return label || '—'
        },
      },
      {
        accessorKey: 'tool',
        header: 'Tool',
      },
      {
        id: 'locations',
        header: 'Locations',
        accessorFn: row => (row.locations || []).map(locId => findById(locId)?.name ?? locId).join(', '),
        cell: ({ row }) => {
          const locs = row.original.locations || []
          if (locs.length === 0) return '—'
          return (
            <span className="cell-location-list">
              {locs.map((locId, i) => {
                const loc = findById(locId)
                return (
                  <span key={i} className="cell-location-item">
                    {loc
                      ? <UniversalModalButton item={loc} variant="table-inline" stopPropagation />
                      : locId}
                  </span>
                )
              })}
            </span>
          )
        },
        enableSorting: false,
      },
      {
        id: 'drops',
        header: 'Drops',
        cell: ({ row }) => {
          const breakableId = row.original.id
          const dropItems = entities.items
            .filter(item => item.sources?.some(s => s.type === 'breakable-drop' && s.breakableId === breakableId))
            .slice(0, 5)
          if (dropItems.length === 0) return '—'
          const totalCount = entities.items.filter(item => item.sources?.some(s => s.type === 'breakable-drop' && s.breakableId === breakableId)).length
          return (
            <span className="cell-location-list">
              {dropItems.map((item, i) => (
                <span key={i} className="cell-location-item">
                  <UniversalModalButton item={item} variant="table-inline" stopPropagation />
                </span>
              ))}
              {totalCount > 5 && <span className="cell-muted">+{totalCount - 5} more</span>}
            </span>
          )
        },
        enableSorting: false,
      },
    ]
  },
}

const GEODES_CONFIG = {
  title: 'Geodes',
  dataType: 'geodes',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Geode name...',
      filterFn: searchFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { entities } = ctx
    return [
      createNameColumn(),
      createPriceColumn(),
      {
        id: 'contents',
        header: 'Contents',
        accessorFn: row => row.geodeContents?.length ?? 0,
        cell: ({ row }) => {
          const geodeGameId = row.original.gameId
          const contentItems = entities.items
            .filter(item => item.sources?.some(s => s.type === 'geode' && s.geodeGameId === geodeGameId))
            .slice(0, 5)
          if (contentItems.length === 0) return '—'
          const totalCount = row.original.geodeContents?.length ?? 0
          return (
            <span className="cell-location-list">
              {contentItems.map((item, i) => (
                <span key={i} className="cell-location-item">
                  <UniversalModalButton item={item} variant="table-inline" stopPropagation />
                </span>
              ))}
              {totalCount > 5 && <span className="cell-muted">+{totalCount - 5} more</span>}
            </span>
          )
        },
        enableSorting: true,
      },
    ]
  },
}

// ─── Export ────────────────────────────────────────────────────────────────────

export const PAGE_CONFIGS = {
  fish: FISH_CONFIG,
  crops: CROPS_CONFIG,
  seeds: SEEDS_CONFIG,
  artisan: ARTISAN_CONFIG,
  forage: FORAGE_CONFIG,
  furniture: FURNITURE_CONFIG,
  hats: HATS_CONFIG,
  'animal-products': ANIMAL_PRODUCTS_CONFIG,
  'tree-fruits': TREE_FRUIT_CONFIG,
  trees: TREES_CONFIG,
  bait: BAIT_CONFIG,
  tackle: TACKLE_CONFIG,
  minerals: MINERALS_CONFIG,
  resources: RESOURCES_CONFIG,
  monsters: MONSTERS_CONFIG,
  weapons: WEAPONS_CONFIG,
  boots: BOOTS_CONFIG,
  rings: RINGS_CONFIG,
  artifacts: ARTIFACTS_CONFIG,
  breakables: BREAKABLES_CONFIG,
  geodes: GEODES_CONFIG,
  clothing: CLOTHING_CONFIG,
  villagers: VILLAGERS_CONFIG,
}

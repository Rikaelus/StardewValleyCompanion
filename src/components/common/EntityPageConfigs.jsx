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
import InfoTooltip from './InfoTooltip'
import { formatTime, getDifficultyColor, getLocationNames, getEntityLabels } from '../../utils/Formatters'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function createDonatedColumn(progress) {
  return {
    id: 'donated',
    header: 'Donated',
    accessorFn: row => progress.isMuseumDonated(row.gameId) ? 1 : 0,
    cell: ({ row }) => {
      const donated = progress.isMuseumDonated(row.original.gameId)
      return (
        <span
          className={`caught-indicator ${donated ? 'caught' : 'not-caught'}`}
          title={donated ? 'Donated' : 'Not donated'}
        >
          {donated ? '✓' : '○'}
        </span>
      )
    },
    meta: { align: 'center' },
  }
}

function createOwnedColumn(progress, { entity } = {}) {
  return {
    id: 'owned',
    header: 'Owned',
    accessorFn: row => progress.getOwnedCount(row.gameId, entity ? row : undefined),
    cell: ({ getValue }) => {
      const count = getValue()
      return (
        <span style={{ fontWeight: count > 0 ? 700 : 400, color: count > 0 ? '#3d6b1a' : '#aaa' }}>
          {count > 0 ? count : '0'}
        </span>
      )
    },
    meta: { align: 'center' },
  }
}

function buildNuanceTooltip(entity) {
  const fishSources = (entity.sources || []).filter(s => s.type === 'fish' && s.location)
  if (fishSources.length === 0) return 'Availability varies by location'
  const lines = fishSources.map(s => {
    const seasons = s.seasons?.length
      ? s.seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
      : 'All seasons'
    return `${s.location}: ${seasons}`
  }).join('\n')
  return `Seasons and locations shown are the full range of possibilities. Exact availability varies by location:\n\n${lines}`
}

function nuanceNameColumn(ctx) {
  return createNameColumn({
    cellRenderer: ({ row }) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <UniversalModalButton item={row.original} showIcon showLabel iconSize={24} stopPropagation onNavigate={ctx.openModal} />
        {row.original.hasLocationNuance && <InfoTooltip text={buildNuanceTooltip(row.original)} />}
      </span>
    ),
  })
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
            <UniversalModalButton item={row.original} showIcon showLabel iconSize={24} stopPropagation onNavigate={openModal} />
            {row.original.contextTags?.includes('fish_legendary') && <span title="Legendary Fish">⭐</span>}
            {row.original.hasLocationNuance && <InfoTooltip text="Availability varies by location — click for details" />}
          </span>
        ),
      }),
      ...(progress.hasSaveData ? [{
        id: 'caught',
        header: 'Caught',
        accessorFn: row => row.isTrapFish ? -1 : progress.isFishCaught(row.gameId) ? 1 : 0,
        cell: ({ row }) => {
          if (row.original.isTrapFish) return <span className="caught-indicator not-applicable" title="Caught via crab pot, not rod">—</span>
          const caught = progress.isFishCaught(row.original.gameId)
          return (
            <span
              className={`caught-indicator ${caught ? 'caught' : 'not-caught'}`}
              title={caught ? 'Caught' : 'Not caught'}
            >
              {caught ? '✓' : '○'}
            </span>
          )
        },
        meta: { align: 'center' },
      }] : []),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    const { entities, professionsRef, progress } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    const { professionsRef, progress } = ctx
    const { cropsById } = extraData

    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    const { entities, professionsRef, data, progress } = ctx
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
        ...(progress.hasSaveData ? [createOwnedColumn(progress, { entity: true })] : []),
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
      ...(progress.hasSaveData ? [createOwnedColumn(progress, { entity: true })] : []),
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
    const { entities, openModal, progress } = ctx
    const { villagers: { all: villagers }, findById, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      nuanceNameColumn(ctx),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
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
    const { entities, professionsRef, progress } = ctx
    const { villagers: { all: villagers }, findById, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    const { entities, professionsRef, progress } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
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
    const { entities, professionsRef, progress } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
      ...(progress.hasSaveData ? [createDonatedColumn(progress)] : []),
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
    const { entities, professionsRef, progress } = ctx
    const { ...relationalData } = entities

    if (relationalData.loading) return []

    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
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
    const { entities, professionsRef, progress } = ctx
    const { villagers: { all: villagers }, ...relationalData } = entities

    if (relationalData.loading) return []

    const base = [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
      ...(progress.hasSaveData ? [createDonatedColumn(progress)] : []),
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
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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
    ]
  },
}

// ─── Villager hearts renderer ─────────────────────────────────────────────────

export const STATUS_ICON = {
  Dating:   'assets/objects/Bouquet.png',
  Engaged:  'assets/objects/WeddingRing.png',
  Married:  'assets/objects/MermaidsPendant.png',
  Divorced: 'assets/objects/WiltedBouquet.png',
  Roommate: 'assets/objects/Farmhouse.png',
}

export function renderVillagerHearts({ hearts, status, canBeRomanced, isKrobus, size = '0.8rem' }) {
  const max = canBeRomanced || isKrobus ? 14 : 10
  const filled = Math.min(hearts, max)
  const isRomantic = status === 'Dating' || status === 'Engaged' || status === 'Married' || status === 'Roommate'
  const statusIcon = STATUS_ICON[status]

  const getColor = (i) => {
    if (i < filled) return '#e05c6a'
    if (canBeRomanced && i >= 8 && !isRomantic) return '#aaa'
    if (canBeRomanced && i >= 10 && status !== 'Married' && status !== 'Roommate') return '#aaa'
    if (isKrobus && i >= 10 && status !== 'Roommate') return '#aaa'
    return '#ddd'
  }

  const segments = canBeRomanced
    ? [
        { hearts: Array.from({ length: 8 }, (_, i) => i),        underline: '#2e9e50' },
        { hearts: Array.from({ length: 2 }, (_, i) => i + 8),    underline: '#e6b800' },
        { hearts: Array.from({ length: 4 }, (_, i) => i + 10),   underline: '#d63a5a' },
      ]
    : isKrobus
    ? [
        { hearts: Array.from({ length: 10 }, (_, i) => i),       underline: '#2e9e50' },
        { hearts: Array.from({ length: 4 }, (_, i) => i + 10),   underline: '#d63a5a' },
      ]
    : [
        { hearts: Array.from({ length: max }, (_, i) => i),      underline: '#2e9e50' },
      ]

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: size, lineHeight: 1 }}>
      {segments.map((seg, si) => (
        <span
          key={si}
          style={{
            display: 'inline-flex',
            gap: '1px',
            ...(seg.underline ? { borderBottom: `2px solid ${seg.underline}`, paddingBottom: '1px' } : {}),
          }}
        >
          {seg.hearts.map(i => (
            <span key={i} style={{ color: getColor(i) }}>♥</span>
          ))}
        </span>
      ))}
      {statusIcon && (
        <img src={statusIcon} alt={status} style={{ width: size === '0.9rem' ? 18 : 16, height: size === '0.9rem' ? 18 : 16, imageRendering: 'pixelated', marginLeft: 2 }} />
      )}
    </span>
  )
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
    const { entities, progress } = ctx

    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [{
        id: 'hearts',
        header: 'Hearts',
        accessorFn: row => {
          const hearts = progress.getFriendshipHearts(row.name)
          const max = row.canBeRomanced || row.name === 'Krobus' ? 14 : 10
          return hearts * 100 + max
        },
        cell: ({ row }) => {
          const hearts = progress.getFriendshipHearts(row.original.name)
          const status = progress.getFriendshipStatus(row.original.name)
          const title = status ? `${hearts}♥ — ${status}` : `${hearts} hearts`
          return (
            <span title={title}>
              {renderVillagerHearts({
                hearts,
                status,
                canBeRomanced: row.original.canBeRomanced,
                isKrobus: row.original.name === 'Krobus',
              })}
            </span>
          )
        },
        sortingFn: 'basic',
        meta: { align: 'left' },
      }] : []),
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
                const owned = showOwnership ? ctx.progress.getOwnedCount(item.gameId, item) : 0
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

// ─── Chests ──────────────────────────────────────────────────────────────────

const CHESTS_CONFIG = {
  title: 'Dungeon Chests',
  dataType: 'chests',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Chest name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'type', type: 'select', label: 'Type', allLabel: 'All Types',
      getOptions: (items) => {
        const subtypes = [...new Set(items.map(i => i.subtype).filter(Boolean))]
        return subtypes
          .map(s => ({ value: s, label: getEntityLabels({ type: 'chest', subtype: s }).subtype || s }))
          .sort((a, b) => a.label.localeCompare(b.label))
      },
      filterFn: subtypeFilterFn,
    },
    {
      key: 'layout', type: 'select', label: 'Mine Layout', allLabel: 'All Layouts',
      getOptions: (items) => {
        const layouts = [...new Set(items.map(i => i.layout).filter(Boolean))]
        return layouts.map(l => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) })).sort((a, b) => a.label.localeCompare(b.label))
      },
      filterFn: (item, value) => {
        if (!value) return true
        return item.layout === value
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
        id: 'location',
        header: 'Location',
        accessorFn: row => findById(row.location)?.name ?? row.location ?? '',
        cell: ({ row }) => {
          const loc = findById(row.original.location)
          return loc
            ? <UniversalModalButton item={loc} variant="table-inline" stopPropagation />
            : (row.original.location ?? '—')
        },
      },
      {
        accessorKey: 'floor',
        header: 'Floor',
        cell: ({ row }) => row.original.floor != null ? `Floor ${row.original.floor}` : '—',
      },
      {
        accessorKey: 'repeatable',
        header: 'Repeatable',
        cell: ({ row }) => row.original.repeatable ? 'Yes' : 'No',
      },
      {
        id: 'drops',
        header: 'Contents',
        cell: ({ row }) => {
          const chestId = row.original.id
          const dropItems = (row.original.computedDrops || [])
            .map(d => findById(d.entityId))
            .filter(Boolean)
            .slice(0, 5)
          if (dropItems.length === 0) return '—'
          const totalCount = (row.original.computedDrops || []).length
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
    const { entities, progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
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

// ─── Buildings ───────────────────────────────────────────────────────────────

const BUILDINGS_CONFIG = {
  title: 'Farm Buildings',
  dataType: 'buildings',
  itemsPerPage: 50,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Building name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'builder', type: 'select', label: 'Builder', allLabel: 'All Builders',
      options: [
        { value: 'robin', label: 'Robin' },
        { value: 'wizard', label: 'Wizard' },
      ],
      filterFn: (item, value) => {
        if (!value) return true
        if (value === 'robin') return item.builder === 'vil-robin'
        if (value === 'wizard') return item.magical === true
        return true
      },
    },
  ],
  getColumns: (ctx) => {
    const { entities, progress } = ctx

    const cols = [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
        enableSorting: false,
        meta: { wrap: true },
      },
      {
        id: 'builder',
        header: 'Builder',
        accessorFn: row => {
          if (row.magical) return 'Wizard'
          const builder = row.builder ? entities.findById(row.builder) : null
          return builder?.name ?? '—'
        },
        cell: ({ row }) => {
          if (row.original.magical) {
            const wiz = entities.findById('vil-wizard')
            return wiz
              ? <UniversalModalButton item={wiz} variant="table-inline" stopPropagation />
              : 'Wizard'
          }
          const builder = row.original.builder ? entities.findById(row.original.builder) : null
          if (!builder) return '—'
          return <UniversalModalButton item={builder} variant="table-inline" stopPropagation />
        },
      },
      {
        id: 'cost',
        header: 'Cost',
        accessorFn: row => row.buildCost ?? 0,
        cell: ({ row }) => {
          const { buildCost, buildMaterials } = row.original
          const parts = []
          if (buildCost > 0) parts.push(<span key="gold" style={{ fontFamily: 'monospace' }}>{buildCost.toLocaleString()}g</span>)
          if (buildMaterials?.length > 0) {
            buildMaterials.forEach(m => {
              const item = entities.findByGameId(m.gameId)
              parts.push(
                <span key={m.gameId}>
                  {item
                    ? <UniversalModalButton item={item} variant="table-inline" stopPropagation quantity={m.amount} />
                    : `${m.gameId} ×${m.amount}`
                  }
                </span>
              )
            })
          }
          if (parts.length === 0) return <span className="cell-muted">—</span>
          return <span style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>{parts}</span>
        },
        enableSorting: true,
      },
      {
        id: 'buildDays',
        header: 'Days',
        accessorFn: row => row.buildDays ?? 0,
        cell: ({ getValue }) => {
          const d = getValue()
          return d > 0 ? d : <span className="cell-muted">—</span>
        },
        meta: { align: 'center' },
      },
    ]

    return cols
  },
}

// ─── Food ─────────────────────────────────────────────────────────────────────

const BUFF_EFFECT_LABELS = {
  Attack: 'Attack',
  Defense: 'Defense',
  FarmingLevel: 'Farming',
  FishingLevel: 'Fishing',
  ForagingLevel: 'Foraging',
  LuckLevel: 'Luck',
  MagneticRadius: 'Magnetism',
  MaxStamina: 'Max Energy',
  MiningLevel: 'Mining',
  Speed: 'Speed',
}

function formatBuffEffects(buffs) {
  if (!buffs?.length) return null
  const effects = buffs[0]?.effects || {}
  return Object.entries(effects)
    .map(([k, v]) => `${BUFF_EFFECT_LABELS[k] ?? k} +${v}`)
    .join(', ')
}

function formatBuffDuration(buffs) {
  if (!buffs?.length) return null
  const secs = buffs[0]?.duration
  if (!secs) return null
  const mins = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${mins}m ${s}s` : `${mins}m`
}

const FOOD_CONFIG = {
  title: 'Food',
  dataType: 'food',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Food name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'buff', type: 'select', label: 'Buff', allLabel: 'All Food',
      options: Object.entries(BUFF_EFFECT_LABELS).map(([k, v]) => ({ value: k, label: v })),
      filterFn: (item, value) => {
        if (!value) return true
        return item.buffs?.some(b => b.effects && value in b.effects)
      },
    },
  ],
  getColumns: (ctx) => {
    const { professionsRef, progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
      {
        id: 'energy',
        header: 'Energy',
        accessorFn: row => row.edibility > 0 ? Math.floor(row.edibility * 2.5) : null,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? v : <span className="cell-muted">—</span>
        },
        meta: { align: 'center' },
      },
      {
        id: 'buffs',
        header: 'Buffs',
        accessorFn: row => formatBuffEffects(row.buffs) ?? '',
        cell: ({ row }) => {
          const text = formatBuffEffects(row.original.buffs)
          return text ?? <span className="cell-muted">—</span>
        },
        enableSorting: false,
      },
      {
        id: 'duration',
        header: 'Duration',
        accessorFn: row => row.buffs?.[0]?.duration ?? 0,
        cell: ({ row }) => {
          const text = formatBuffDuration(row.original.buffs)
          return text ?? <span className="cell-muted">—</span>
        },
        meta: { align: 'center' },
      },
      createPriceColumn(professionsRef),
    ]
  },
}

// ─── Cooking Recipes ───────────────────────────────────────────────────────────

// Stardew category IDs that appear in cooking/crafting ingredients
const INGREDIENT_CATEGORY_NAMES = {
  '-4': 'Any Fish',
  '-5': 'Any Egg',
  '-6': 'Any Milk',
  '-7': 'Any Vegetable',
  '-75': 'Any Vegetable',
  '-79': 'Any Fruit',
}

const UNLOCK_TYPE_LABELS = {
  friendship: 'Friendship',
  skill: 'Skill Level',
  level: 'Other',
}

function getCookingSource(item) {
  return item.sources?.find(s => s.type === 'cooking')
}

function formatUnlockCondition(cond) {
  if (!cond) return '—'
  if (cond.type === 'friendship') return `${cond.npc} (${cond.hearts}♥)`
  if (cond.type === 'skill') return `${cond.skill?.charAt(0).toUpperCase() + cond.skill?.slice(1)} Lv. ${cond.level}`
  if (cond.type === 'level') return cond.level >= 100 ? (cond.tvEntityId ? 'Queen of Sauce' : 'Special Unlock') : `Level ${cond.level}`
  return '—'
}

const COOKING_CONFIG = {
  title: 'Cooking Recipes',
  dataType: 'food',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Recipe name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'unlock', type: 'select', label: 'How to Learn', allLabel: 'All Recipes',
      options: [
        { value: 'friendship', label: 'Friendship' },
        { value: 'skill', label: 'Skill Level' },
        { value: 'tv', label: 'Queen of Sauce' },
        { value: 'shop', label: 'Shop' },
      ],
      filterFn: (item, value) => {
        if (!value) return true
        const src = getCookingSource(item)
        if (value === 'tv') {
          return !!(src?.unlockCondition?.tvEntityId ?? src?.tvEntityId)
        }
        if (value === 'shop') {
          return item.sources?.some(s => s.type === 'shop' && s.isRecipe)
        }
        return src?.unlockCondition?.type === value
      },
    },
  ],
  getColumns: (ctx) => {
    const { progress, entities } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [
        {
          id: 'known',
          header: 'Known',
          accessorFn: row => {
            const recipeName = getCookingSource(row)?.recipeName
            return recipeName && progress.isRecipeKnown(recipeName) ? 1 : 0
          },
          cell: ({ row }) => {
            const src = getCookingSource(row.original)
            const recipeName = src?.recipeName
            const known = recipeName && progress.isRecipeKnown(recipeName)
            return (
              <span
                className={`caught-indicator ${known ? 'caught' : 'not-caught'}`}
                title={known ? 'Known' : 'Unknown'}
              >
                {known ? '✓' : '○'}
              </span>
            )
          },
          meta: { align: 'center' },
        },
        {
          id: 'cooked',
          header: 'Cooked',
          accessorFn: row => row.gameId ? progress.getRecipeCookedCount(row.gameId) : 0,
          cell: ({ row }) => {
            const count = row.original.gameId ? progress.getRecipeCookedCount(row.original.gameId) : 0
            return count > 0
              ? <span className="caught-indicator caught">{count.toLocaleString()}</span>
              : <span className="cell-muted">0</span>
          },
          meta: { align: 'center' },
        },
      ] : []),
      {
        id: 'ingredients',
        header: 'Ingredients',
        accessorFn: row => getCookingSource(row)?.ingredientDetails?.map(i => i.name ?? INGREDIENT_CATEGORY_NAMES[String(i.gameId)] ?? `Category ${i.gameId}`).join(', ') ?? '',
        cell: ({ row }) => {
          const src = getCookingSource(row.original)
          const ingredients = src?.ingredientDetails
          if (!ingredients?.length) return <span className="cell-muted">—</span>
          return (
            <span className="cell-location-list">
              {ingredients.map((ing, i) => {
                const entity = ing.id ? entities.findById(ing.id) : null
                const catName = INGREDIENT_CATEGORY_NAMES[String(ing.gameId)]
                return (
                  <span key={i} className="cell-location-item">
                    {entity
                      ? <UniversalModalButton item={entity} variant="table-inline" stopPropagation quantity={ing.amount} />
                      : <>{catName ?? ing.name ?? `Category ${ing.gameId}`}{ing.amount > 1 ? ` ×${ing.amount}` : ''}</>
                    }
                  </span>
                )
              })}
            </span>
          )
        },
        enableSorting: false,
      },
      {
        id: 'unlock',
        header: 'How to Learn',
        accessorFn: row => formatUnlockCondition(getCookingSource(row)?.unlockCondition),
        cell: ({ row }) => {
          const item = row.original
          const src = getCookingSource(item)
          const cond = src?.unlockCondition
          const tvId = cond?.tvEntityId ?? src?.tvEntityId
          const tvShow = tvId ? entities.findById(tvId) : null
          const recipeSources = (item.sources || []).filter(s => s.type === 'shop' && s.isRecipe)

          const parts = []
          if (cond?.type === 'friendship') {
            const villager = entities.villagers.all.find(v => v.name === cond.npc)
            parts.push(villager
              ? <UniversalModalButton key="npc" item={villager} variant="table-inline" stopPropagation hearts={cond.hearts} />
              : <span key="npc">{cond.npc} (♥×{cond.hearts})</span>
            )
          } else if (cond?.type === 'skill') {
            parts.push(<span key="skill">{cond.skill.charAt(0).toUpperCase() + cond.skill.slice(1)} Lv. {cond.level}</span>)
          }
          if (tvShow) parts.push(<UniversalModalButton key="tv" item={tvShow} variant="table-inline" stopPropagation />)
          recipeSources.forEach((s, i) => {
            const store = entities.findById(s.id)
            if (store) parts.push(<UniversalModalButton key={`rs${i}`} item={store} variant="table-inline" stopPropagation />)
          })

          if (!parts.length) return <span className="cell-muted">—</span>
          if (parts.length === 1) return parts[0]
          return <span className="cell-location-list">{parts.map((p, i) => <span key={i} className="cell-location-item">{p}</span>)}</span>
        },
      },
    ]
  },
}

// ─── Crafting Recipes ──────────────────────────────────────────────────────────

function getCraftingSource(item) {
  return item.sources?.find(s => s.type === 'crafting')
}

const CRAFTING_CONFIG = {
  title: 'Crafting Recipes',
  dataType: 'crafted',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Recipe name...',
      filterFn: searchFilterFn,
    },
  ],
  getColumns: (ctx) => {
    const { professionsRef, progress, entities } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
      {
        id: 'ingredients',
        header: 'Ingredients',
        accessorFn: row => getCraftingSource(row)?.ingredientDetails?.map(i => i.name ?? INGREDIENT_CATEGORY_NAMES[String(i.gameId)] ?? `Category ${i.gameId}`).join(', ') ?? '',
        cell: ({ row }) => {
          const src = getCraftingSource(row.original)
          const ingredients = src?.ingredientDetails
          if (!ingredients?.length) return <span className="cell-muted">—</span>
          return (
            <span className="cell-location-list">
              {ingredients.map((ing, i) => {
                const entity = ing.id ? entities.findById(ing.id) : null
                const catName = INGREDIENT_CATEGORY_NAMES[String(ing.gameId)]
                return (
                  <span key={i} className="cell-location-item">
                    {entity
                      ? <UniversalModalButton item={entity} variant="table-inline" stopPropagation quantity={ing.amount} />
                      : <>{catName ?? ing.name ?? `Category ${ing.gameId}`}{ing.amount > 1 ? ` ×${ing.amount}` : ''}</>
                    }
                  </span>
                )
              })}
            </span>
          )
        },
        enableSorting: false,
      },
      {
        id: 'unlock',
        header: 'How to Learn',
        accessorFn: row => {
          const src = getCraftingSource(row)
          if (!src?.unlockCondition) return '—'
          const cond = src.unlockCondition
          if (cond.type === 'skill') return `${cond.skill?.charAt(0).toUpperCase() + cond.skill?.slice(1)} Lv. ${cond.level}`
          return '—'
        },
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      },
      createPriceColumn(professionsRef),
    ]
  },
}

// ─── Trinkets ─────────────────────────────────────────────────────────────────

const TRINKETS_CONFIG = {
  title: 'Trinkets',
  dataType: 'trinket',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Trinket name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'reforgeable', type: 'select', label: 'Reforgeable', allLabel: 'All Trinkets',
      options: [
        { value: 'yes', label: 'Reforgeable' },
        { value: 'no', label: 'Not reforgeable' },
      ],
      filterFn: (item, value) => {
        if (!value) return true
        return value === 'yes' ? item.canBeReforged : !item.canBeReforged
      },
    },
  ],
  getColumns: (ctx) => {
    const { progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createOwnedColumn(progress)] : []),
      {
        accessorKey: 'description',
        header: 'Effect',
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
        enableSorting: false,
      },
      {
        id: 'reforgeable',
        header: 'Reforgeable',
        accessorFn: row => row.canBeReforged ? 'Yes' : 'No',
        cell: ({ getValue }) => getValue(),
        meta: { align: 'center' },
      },
    ]
  },
}

function createReadColumn(progress) {
  return {
    id: 'read',
    header: 'Read',
    accessorFn: row => progress.isBookRead(row.gameId) ? 1 : 0,
    cell: ({ row }) => {
      const read = progress.isBookRead(row.original.gameId)
      return (
        <span
          className={`caught-indicator ${read ? 'caught' : 'not-caught'}`}
          title={read ? 'Read' : 'Not yet read'}
        >
          {read ? '✓' : '○'}
        </span>
      )
    },
    meta: { align: 'center' },
  }
}

// ─── Books ────────────────────────────────────────────────────────────────────

const BOOKS_CONFIG = {
  title: 'Books',
  dataType: 'book',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Book name...',
      filterFn: (item, value) => {
        if (!value) return true
        const q = value.toLowerCase()
        return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
      },
    },
  ],
  getColumns: (ctx) => {
    const { professionsRef, progress } = ctx
    return [
      createNameColumn(),
      ...(progress.hasSaveData ? [createReadColumn(progress), createOwnedColumn(progress)] : []),
      {
        accessorKey: 'description',
        header: 'Effect',
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
        enableSorting: false,
      },
      createPriceColumn(professionsRef),
      {
        accessorKey: 'sources',
        header: 'Sources',
        cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact findEntityById={ctx.entities.findById} />,
        enableSorting: false,
      },
    ]
  },
}

// ─── Powers ───────────────────────────────────────────────────────────────────

const POWERS_CONFIG = {
  title: 'Powers',
  dataType: 'power',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Power name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'subtype', type: 'select', label: 'Type', allLabel: 'All Powers',
      options: [
        { value: 'mastery', label: 'Mastery' },
        { value: 'unlock', label: 'Unlock' },
      ],
      filterFn: subtypeFilterFn,
    },
  ],
  getColumns: () => {
    return [
      createNameColumn(),
      {
        accessorKey: 'subtype',
        header: 'Type',
        cell: ({ getValue }) => {
          const t = getValue()
          return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
        enableSorting: false,
      },
    ]
  },
}

// ─── Concessions ──────────────────────────────────────────────────────────────

const CONCESSIONS_CONFIG = {
  title: 'Concessions',
  dataType: 'concession',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Concession name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'tag', type: 'select', label: 'Tag', allLabel: 'All Concessions',
      getOptions: (items) => {
        const tags = [...new Set(items.flatMap(i => i.tags || []))].sort()
        return tags.map(t => ({ value: t, label: t }))
      },
      filterFn: (item, value) => {
        if (!value) return true
        return (item.tags || []).includes(value)
      },
    },
  ],
  getColumns: () => {
    return [
      createNameColumn(),
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
        enableSorting: false,
      },
      {
        id: 'tags',
        header: 'Tags',
        accessorFn: row => (row.tags || []).join(', '),
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
        enableSorting: false,
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ getValue }) => {
          const p = getValue()
          return p != null ? <span style={{ fontFamily: 'monospace' }}>{p.toLocaleString()}g</span> : <span className="cell-muted">—</span>
        },
        meta: { align: 'right' },
      },
    ]
  },
}

// ─── Bundles ──────────────────────────────────────────────────────────────────

const BUNDLE_ROOMS = [
  'Pantry', 'Crafts Room', 'Fish Tank', 'Boiler Room',
  'Bulletin Board', 'Vault', 'Abandoned Joja Mart',
]

const BUNDLES_CONFIG = {
  title: 'Bundles',
  dataType: 'bundle',
  itemsPerPage: 25,
  filters: [
    {
      key: 'search', type: 'search', label: 'Search', placeholder: 'Bundle name...',
      filterFn: searchFilterFn,
    },
    {
      key: 'room', type: 'tabs', label: 'Room', default: 'all',
      tabs: [
        { id: 'all', label: 'All' },
        ...BUNDLE_ROOMS.map(r => ({ id: r, label: r })),
      ],
      filterFn: (item, value) => {
        if (!value || value === 'all') return true
        return item.room === value
      },
    },
  ],
  getColumns: (ctx) => {
    const { progress, entities, openModal } = ctx
    return [
      createNameColumn(),
      {
        accessorKey: 'room',
        header: 'Room',
        cell: ({ getValue }) => getValue() || <span className="cell-muted">—</span>,
      },
      {
        id: 'itemsRequired',
        header: 'Items Required',
        accessorFn: row => row.minItemsRequired ?? row.items?.length ?? 0,
        cell: ({ row }) => {
          const min = row.original.minItemsRequired
          const total = row.original.items?.length ?? 0
          if (min != null && min < total) return `${min} of ${total}`
          if (row.original.goldCost != null) return `${row.original.goldCost.toLocaleString()}g`
          return total
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'reward',
        header: 'Reward',
        cell: ({ getValue }) => {
          const r = getValue()
          if (!r) return <span className="cell-muted">—</span>
          // Format: "TYPE ID QTY" e.g. "O 220 3", "BO 10 1", "R 517 1"
          const parts = r.trim().split(/\s+/)
          if (parts.length >= 2) {
            const type = parts[0]
            const id = parts[1]
            const qty = parseInt(parts[2], 10) || 1
            const prefix = type === 'BO' ? '(BC)' : type === 'R' ? '(O)' : '(O)'
            const gameId = `${prefix}${id}`
            const item = entities.findByGameId(gameId)
            if (item) {
              return (
                <UniversalModalButton
                  item={item}
                  variant="inline"
                  quantity={qty}
                  onNavigate={openModal}
                />
              )
            }
          }
          return r
        },
        enableSorting: false,
      },
      ...(progress.hasSaveData ? [{
        id: 'completed',
        header: 'Completed',
        accessorFn: row => {
          const itemCount = row.goldCost ? 1 : (row.items?.length ?? 0)
          const bp = progress.getBundleProgress(row.bundleNumber, itemCount)
          return bp?.complete ? 1 : 0
        },
        cell: ({ row }) => {
          const itemCount = row.original.goldCost ? 1 : (row.original.items?.length ?? 0)
          const bp = progress.getBundleProgress(row.original.bundleNumber, itemCount)
          const done = bp?.complete
          return (
            <span
              className={`caught-indicator ${done ? 'caught' : 'not-caught'}`}
              title={done ? 'Completed' : 'Incomplete'}
            >
              {done ? '✓' : '○'}
            </span>
          )
        },
        meta: { align: 'center' },
      }] : []),
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
  chests: CHESTS_CONFIG,
  geodes: GEODES_CONFIG,
  clothing: CLOTHING_CONFIG,
  villagers: VILLAGERS_CONFIG,
  buildings: BUILDINGS_CONFIG,
  food: FOOD_CONFIG,
  cooking: COOKING_CONFIG,
  crafting: CRAFTING_CONFIG,
  trinket: TRINKETS_CONFIG,
  book: BOOKS_CONFIG,
  power: POWERS_CONFIG,
  concession: CONCESSIONS_CONFIG,
  bundle: BUNDLES_CONFIG,
}

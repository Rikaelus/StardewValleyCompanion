import { usePlayer } from '../../contexts/PlayerContext'
import InfoTooltip from './InfoTooltip'
import './ItemSellPrice.css'

// Profession key → multiplier (from profession-rules.json, kept here for runtime calculation)
const PROFESSION_MULTIPLIERS = {
  crop:       { tiller: 1.1 },
  fishing:    { angler: 1.5, fisher: 1.25 },
  artisan:    { artisan: 1.4 },
  rancher:    { rancher: 1.2 },
  tapper:     { tapper: 1.25 },
  blacksmith: { blacksmith: 1.5 },
  gemologist: { gemologist: 1.3 },
}

// Profession display labels
const PROFESSION_LABELS = {
  tiller: 'Tiller', fisher: 'Fisher', angler: 'Angler',
  artisan: 'Artisan', rancher: 'Rancher', tapper: 'Tapper',
  blacksmith: 'Blacksmith', gemologist: 'Gemologist',
}

// Fallback: derive professionCategory from gameCategory for synthetic items
// (e.g. input items in profit analysis that only have a gameCategory field)
const CATEGORY_TO_PROFESSION = {
  '-75': 'crop', '-79': 'crop',
  '-4': 'fishing',
  '-15': 'blacksmith',
  '-2': 'gemologist',
}

/**
 * Calculate profession multiplier for an item's sell price.
 * Uses pre-computed professionCategory when available, falls back to gameCategory lookup.
 * @param {Object} item - The item (or synthetic { gameCategory } object)
 * @param {Object} professions - Player professions object
 * @returns {number} Multiplier to apply to base price
 */
export function calculateProfessionMultiplier(item, professions) {
  if (!item || !professions) return 1.0

  // Use pre-computed professionCategory when available, else derive from gameCategory
  const profCat = item.professionCategory
    || CATEGORY_TO_PROFESSION[String(item.originalGameCategory ?? item.gameCategory)]

  if (!profCat) return 1.0

  const multipliers = PROFESSION_MULTIPLIERS[profCat]
  if (!multipliers) return 1.0

  // Check professions in priority order (higher multiplier first)
  for (const [key, mult] of Object.entries(multipliers)) {
    if (professions[key]) return mult
  }

  return 1.0
}

/**
 * Sorting function for item prices with profession modifiers
 * @param {Object} professions - Player professions object
 * @returns {Function} Sorting function for react-table
 */
export function createPriceSortingFn(professions) {
  return (rowA, rowB) => {
    const itemA = rowA.original
    const itemB = rowB.original

    const multiplierA = calculateProfessionMultiplier(itemA, professions)
    const multiplierB = calculateProfessionMultiplier(itemB, professions)

    const basePriceA = itemA.prices?.iridium || itemA.prices?.regular || itemA.price || 0
    const basePriceB = itemB.prices?.iridium || itemB.prices?.regular || itemB.price || 0

    const adjustedPriceA = Math.floor(basePriceA * multiplierA)
    const adjustedPriceB = Math.floor(basePriceB * multiplierB)

    return adjustedPriceA - adjustedPriceB
  }
}

/**
 * Get the name of the applied profession for an item
 * Uses pre-computed professionCategory field.
 */
function getAppliedProfession(item, professions) {
  if (!item || !professions) return null

  const profCat = item.professionCategory
    || CATEGORY_TO_PROFESSION[String(item.originalGameCategory ?? item.gameCategory)]

  if (!profCat) return null

  const multipliers = PROFESSION_MULTIPLIERS[profCat]
  if (!multipliers) return null

  for (const key of Object.keys(multipliers)) {
    if (professions[key]) return PROFESSION_LABELS[key]
  }

  return null
}

// Quality tier rendering helpers
const QUALITY_MULTIPLIERS = { silver: 1.25, gold: 1.5, iridium: 2.0 }
const QUALITY_LABELS = { regular: 'Regular Quality', silver: 'Silver Quality', gold: 'Gold Quality', iridium: 'Iridium Quality' }
const QUALITY_EXTRA_LABELS = {
  silver: { trapFish: ' (with Deluxe Bait)' },
  iridium: { food: " (Qi's Seasoning)" },
}

/**
 * Centralized sell price display component that applies profession modifiers
 *
 * Usage:
 *   <ItemSellPrice item={fish} />  // Shows qualities (default)
 *   <ItemSellPrice item={artisan} showQualities={true} />  // Force show qualities
 *   <ItemSellPrice item={fish} showQualities={false} />  // Force single price
 *   <ItemSellPrice item={fish} showProfession={true} />  // Show profession badge
 */
function ItemSellPrice({ item, showQualities = true, showProfession = false, className = '' }) {
  const { player } = usePlayer()

  if (!item) return null

  const multiplier = calculateProfessionMultiplier(item, player.professions)
  const appliedProfession = showProfession ? getAppliedProfession(item, player.professions) : null

  const hasQualityPrices = item.prices && typeof item.prices === 'object'
  const basePrice = hasQualityPrices ? item.prices.regular : (item.price || 0)
  const regularPrice = Math.floor(basePrice * multiplier)

  // Determine which quality tiers to show
  const tiers = showQualities && item.qualityTiers ? item.qualityTiers : ['regular']

  const professionBadge = appliedProfession && (
    <div className="profession-badge">
      +{Math.round((multiplier - 1) * 100)}% {appliedProfession}
      <InfoTooltip text="Applied from your character's professions (configure in Settings)" />
    </div>
  )

  if (tiers.length === 1) {
    return (
      <div className={`item-sell-price-container ${className}`}>
        <div className="item-sell-price item-sell-price-qualities">
          <span className="price-regular" title="Regular Quality">
            {regularPrice.toLocaleString()}g
          </span>
        </div>
        {professionBadge}
      </div>
    )
  }

  return (
    <div className={`item-sell-price-container ${className}`}>
      <div className="item-sell-price item-sell-price-qualities">
        {tiers.map(tier => {
          const price = tier === 'regular'
            ? regularPrice
            : hasQualityPrices && item.prices[tier]
              ? Math.floor(item.prices[tier] * multiplier)
              : Math.floor(basePrice * QUALITY_MULTIPLIERS[tier] * multiplier)

          const extraLabel = item.isTrapFish && QUALITY_EXTRA_LABELS[tier]?.trapFish
            || item.type === 'food' && QUALITY_EXTRA_LABELS[tier]?.food
            || ''

          return (
            <span key={tier} className={`price-${tier}`} title={`${QUALITY_LABELS[tier]}${extraLabel}`}>
              {price.toLocaleString()}g
            </span>
          )
        })}
      </div>
      {professionBadge}
    </div>
  )
}

export default ItemSellPrice

import { usePlayer } from '../../contexts/PlayerContext'
import InfoTooltip from './InfoTooltip'
import './ItemSellPrice.css'

/**
 * Calculate profession multiplier for an item's sell price
 * @param {Object} item - The item to calculate multiplier for
 * @param {Object} professions - Player professions object
 * @returns {number} Multiplier to apply to base price
 */
export function calculateProfessionMultiplier(item, professions) {
  if (!item || !professions) return 1.0

  // Get actual category (some items have originalCategory set)
  const actualCategory = item.originalCategory !== undefined ? item.originalCategory : item.category

  // Farming professions (crops)
  if (actualCategory === -75 || actualCategory === -79) {
    if (professions.tiller) return 1.1  // Tiller +10%
  }

  // Fishing professions (Angler replaces Fisher, doesn't stack)
  // Check both type and category - items can be forage type but Fish category
  if (item.type === 'fish' || actualCategory === -4) {
    if (professions.angler) return 1.5  // Angler +50%
    if (professions.fisher) return 1.25  // Fisher +25%
  }

  // Artisan goods (check if it's an artisan good and not an animal product)
  if (item.type === 'artisan') {
    const isAnimalProduct = item.source && ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(item.source)
    const isSyrup = item.contextTags && item.contextTags.includes('syrup_item')

    if (professions.tapper && isSyrup) {
      return 1.25  // Tapper +25%
    }
    if (professions.artisan && !isAnimalProduct && !isSyrup) {
      return 1.4  // Artisan +40%
    }
    if (professions.rancher && isAnimalProduct) {
      return 1.2  // Rancher +20%
    }
  }

  // Mining professions
  if (item.category === 'Bars' && professions.blacksmith) {
    return 1.5  // Blacksmith +50%
  }
  if (item.category === 'Gems' && professions.gemologist) {
    return 1.3  // Gemologist +30%
  }

  return 1.0  // No modifier
}

/**
 * Sorting function for item prices with profession modifiers
 * Usage in column definition: sortingFn: (rowA, rowB) => createPriceSortingFn(professions)(rowA, rowB)
 * @param {Object} professions - Player professions object
 * @returns {Function} Sorting function for react-table
 */
export function createPriceSortingFn(professions) {
  return (rowA, rowB) => {
    const itemA = rowA.original
    const itemB = rowB.original

    const multiplierA = calculateProfessionMultiplier(itemA, professions)
    const multiplierB = calculateProfessionMultiplier(itemB, professions)

    // Get base price - handle both simple price and prices object
    const basePriceA = itemA.prices?.iridium || itemA.prices?.regular || itemA.price || 0
    const basePriceB = itemB.prices?.iridium || itemB.prices?.regular || itemB.price || 0

    const adjustedPriceA = Math.floor(basePriceA * multiplierA)
    const adjustedPriceB = Math.floor(basePriceB * multiplierB)

    return adjustedPriceA - adjustedPriceB
  }
}

/**
 * Get the name of the applied profession for an item
 * @param {Object} item - The item to check
 * @param {Object} professions - Player professions object
 * @returns {string|null} Profession name or null if no profession applies
 */
function getAppliedProfession(item, professions) {
  if (!item || !professions) return null

  // Check both type and category - items can be forage type but Fish category
  const actualCategory = item.originalCategory !== undefined ? item.originalCategory : item.category

  // Crops
  if (actualCategory === -75 || actualCategory === -79) {
    if (professions.tiller) return 'Tiller'
  }

  if (item.type === 'fish' || actualCategory === -4) {
    if (professions.angler) return 'Angler'
    if (professions.fisher) return 'Fisher'
  }

  if (item.type === 'artisan') {
    const isAnimalProduct = item.source && ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(item.source)
    const isSyrup = item.contextTags && item.contextTags.includes('syrup_item')
    if (professions.tapper && isSyrup) return 'Tapper'
    if (professions.artisan && !isAnimalProduct && !isSyrup) return 'Artisan'
    if (professions.rancher && isAnimalProduct) return 'Rancher'
  }

  if (item.category === 'Bars' && professions.blacksmith) return 'Blacksmith'
  if (item.category === 'Gems' && professions.gemologist) return 'Gemologist'

  return null
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

  // Get base price or prices object
  const hasQualityPrices = item.prices && typeof item.prices === 'object'
  const basePrice = hasQualityPrices ? item.prices.regular : (item.price || 0)

  // Apply profession multiplier
  const regularPrice = Math.floor(basePrice * multiplier)

  // If we should show quality variants
  if (showQualities) {
    // Crab pot fish can only be normal or silver quality (with Deluxe Bait)
    if (item.isTrapFish) {
      return (
        <div className={`item-sell-price-container ${className}`}>
          <div className="item-sell-price item-sell-price-qualities">
            <span className="price-regular" title="Regular Quality">
              {regularPrice}g
            </span>
            <span className="price-silver" title="Silver Quality (with Deluxe Bait)">
              {Math.floor(basePrice * 1.25 * multiplier)}g
            </span>
          </div>
          {appliedProfession && (
            <div className="profession-badge">
              +{Math.round((multiplier - 1) * 100)}% {appliedProfession}
              <InfoTooltip text="Applied from your character's professions (configure in Settings)" />
            </div>
          )}
        </div>
      )
    }

    // If item has explicit quality prices, use those
    if (hasQualityPrices && item.prices.silver) {
      return (
        <div className={`item-sell-price-container ${className}`}>
          <div className="item-sell-price item-sell-price-qualities">
            <span className="price-regular" title="Regular Quality">
              {regularPrice}g
            </span>
            <span className="price-silver" title="Silver Quality">
              {Math.floor(item.prices.silver * multiplier)}g
            </span>
            <span className="price-gold" title="Gold Quality">
              {Math.floor(item.prices.gold * multiplier)}g
            </span>
            <span className="price-iridium" title="Iridium Quality">
              {Math.floor(item.prices.iridium * multiplier)}g
            </span>
          </div>
          {appliedProfession && (
            <div className="profession-badge">
              +{Math.round((multiplier - 1) * 100)}% {appliedProfession}
              <InfoTooltip text="Applied from your character's professions (configure in Settings)" />
            </div>
          )}
        </div>
      )
    }

    // Otherwise calculate quality variants using standard multipliers
    return (
      <div className={`item-sell-price-container ${className}`}>
        <div className="item-sell-price item-sell-price-qualities">
          <span className="price-regular" title="Regular Quality">
            {regularPrice}g
          </span>
          <span className="price-silver" title="Silver Quality">
            {Math.floor(basePrice * 1.25 * multiplier)}g
          </span>
          <span className="price-gold" title="Gold Quality">
            {Math.floor(basePrice * 1.5 * multiplier)}g
          </span>
          <span className="price-iridium" title="Iridium Quality">
            {Math.floor(basePrice * 2.0 * multiplier)}g
          </span>
        </div>
        {appliedProfession && (
          <div className="profession-badge">
            +{Math.round((multiplier - 1) * 100)}% {appliedProfession}
            <InfoTooltip text="Applied from your character's professions (configure in Settings)" />
          </div>
        )}
      </div>
    )
  }

  // Simple single price
  return (
    <div className={`item-sell-price-container ${className}`}>
      <div className="item-sell-price item-sell-price-qualities">
        <span className="price-regular" title="Regular Quality">
          {regularPrice}g
        </span>
      </div>
      {appliedProfession && (
        <div className="profession-badge">
          +{Math.round((multiplier - 1) * 100)}% {appliedProfession}
          <InfoTooltip text="Applied from your character's professions (configure in Settings)" />
        </div>
      )}
    </div>
  )
}

export default ItemSellPrice

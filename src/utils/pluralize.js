/**
 * Pluralize an item name using English rules + Stardew-specific exceptions.
 *
 * Returns the plural form of the last significant word in a compound name
 * (e.g. "Blueberry Seeds" → "Blueberry Seeds", "Blueberry" → "Blueberries").
 */

// Already plural or uncountable — return unchanged
const UNCHANGED = new Set([
  // Mass nouns / uncountable
  'Aged Roe', 'Amaranth', 'Beer', 'Cheese', 'Clay', 'Cloth', 'Coffee',
  'Coral', 'Corn', 'Fiber', 'Ginger', 'Goat Cheese', 'Goat Milk',
  'Green Tea', 'Hardwood', 'Honey', 'Juice', 'L. Goat Milk', 'Large Milk',
  'Mead', 'Milk', 'Moss', 'Mystic Syrup', 'Oak Resin', 'Oil', 'Pale Ale',
  'Pine Tar', 'Rhubarb', 'Rice Shoot', 'Roe', 'Sap', 'Seaweed', 'Slime',
  'Truffle Oil', 'Unmilled Rice', 'Vinegar', 'Void Essence', 'Wheat',
  'Wine', 'Wood', 'Wool',
  // Already plural
  'Cranberries', 'Dried Mushrooms', 'Hops', 'Mixed Seeds', 'Mixed Flower Seeds',
  'Pickles', 'Raisins',
  // Last-word matches for compound names — these suffixes are already plural
  'Seeds', 'Berries', 'Eggs', 'Bars', 'Crystals',
  // Fish — zero plural (ichthyological convention)
  'Albacore', 'Angler', 'Bream', 'Blobfish', 'Blue Discus', 'Bullhead',
  'Carp', 'Catfish', 'Chub', 'Crimsonfish', 'Dorado', 'Eel', 'Flounder',
  'Ghostfish', 'Glacierfish', 'Glacierfish Jr.', 'Goby', 'Halibut',
  'Herring', 'Ice Pip', 'Largemouth Bass', 'Lava Eel', 'Legend', 'Legend II',
  'Lingcod', 'Lionfish', 'Midnight Carp', 'Ms. Angler', 'Mutant Carp',
  'Perch', 'Pike', 'Pufferfish', 'Radioactive Carp', 'Rainbow Trout',
  'Salmon', 'Sandfish', 'Scorpion Carp', 'Shad', 'Shrimp', 'Slimejack',
  'Smallmouth Bass', 'Smoked Fish', 'Son of Crimsonfish', 'Spook Fish',
  'Squid', 'Stingray', 'Stonefish', 'Sturgeon', 'Tiger Trout', 'Tilapia',
  'Tuna', 'Void Salmon', 'Walleye', 'Woodskip',
  // Shellfish / crustaceans — zero plural
  'Clam', 'Cockle', 'Crab', 'Crayfish', 'Lobster', 'Mussel', 'Nautilus Shell',
  'Oyster', 'Periwinkle', 'Snail',
  // Other uncountable-in-context
  'Midnight Squid', 'Super Cucumber', 'Sea Cucumber',
])

// Explicit overrides for anything the rules would get wrong
const EXCEPTIONS = {
  'Anchovy': 'Anchovies',
  'Blackberry': 'Blackberries',
  'Blueberry': 'Blueberries',
  'Cherry': 'Cherries',
  'Cranberry': 'Cranberries',
  'Holly': 'Hollies',
  'Jelly': 'Jellies',
  'Mango': 'Mangoes',
  'Octopus': 'Octopuses',
  'Peach': 'Peaches',
  'Poppy': 'Poppies',
  'Potato': 'Potatoes',
  'Radish': 'Radishes',
  'Salmonberry': 'Salmonberries',
  'Strawberry': 'Strawberries',
  'Tomato': 'Tomatoes',
}

/**
 * Pluralize the last word of a string, leaving any preceding words intact.
 * e.g. "Spice Berry" → "Spice Berries", "Garlic Seeds" → "Garlic Seeds"
 */
function pluralizeWord(word) {
  if (EXCEPTIONS[word]) return EXCEPTIONS[word]

  // Already ends in s-sound → add "es"
  if (/(?:s|x|z|ch|sh)$/i.test(word)) return word + 'es'

  // Consonant + y → ies
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'

  // consonant + o → oes (mango/potato/tomato handled in exceptions above,
  // but catches any future additions)
  if (/[^aeiou]o$/i.test(word)) return word + 'es'

  return word + 's'
}

/**
 * Pluralize an item name. Handles compound names by pluralizing the last word.
 *
 * @param {string} name - The item name to pluralize
 * @returns {string} The pluralized name
 */
export function pluralize(name) {
  if (!name) return name
  if (UNCHANGED.has(name)) return name

  // Check full-name exceptions first
  if (EXCEPTIONS[name]) return EXCEPTIONS[name]

  // For compound names, pluralize the last word and rejoin.
  const words = name.split(' ')
  const last = words[words.length - 1]
  const rest = words.slice(0, -1)

  // If the last word is already plural (ends in s from a known plural suffix),
  // check the UNCHANGED set for just that word before applying rules.
  if (UNCHANGED.has(last)) return name

  const pluralLast = EXCEPTIONS[last] ?? pluralizeWord(last)
  return [...rest, pluralLast].join(' ')
}

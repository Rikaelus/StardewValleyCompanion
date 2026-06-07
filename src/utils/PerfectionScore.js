import perfectionRules from '../../data/rules/perfection.json'
import gameObjects from '../../data/game-exports/Objects.json'
import { FULL_SHIPMENT_NAMES } from './AchievementProgress'

// Items that appear in the Collections → Fish tab (the set the game scores for perfection)
const FISHING_COLLECTION_IDS = new Set(
  Object.entries(gameObjects)
    .filter(([, item]) =>
      !item.ExcludeFromFishingCollection &&
      (item.Category === -4 || item.Type === 'Fish' || (item.ContextTags ?? []).includes('counts_as_fish_catch'))
    )
    .map(([id]) => id)
)

const QUEST_GROUPS = [
  { targets: ['Green Slime', 'Frost Jelly', 'Sludge', 'Tiger Slime'] },
  { targets: ['Shadow Shaman', 'Shadow Brute', 'Shadow Sniper'] },
  { targets: ['Bat', 'Frost Bat', 'Lava Bat', 'Iridium Bat'] },
  { targets: ['Skeleton', 'Skeleton Mage'] },
  { targets: ['Grub', 'Fly', 'Bug'] },
  { targets: ['Duggy', 'Magma Duggy'] },
  { targets: ['Dust Spirit'] },
  { targets: ['Rock Crab', 'Lava Crab', 'Iridium Crab'] },
  { targets: ['Mummy'] },
  { targets: ['Pepper Rex'] },
  { targets: ['Serpent', 'Royal Serpent'] },
  { targets: ['Magma Sprite', 'Magma Sparker'] },
]

function bareId(gameId) {
  return String(gameId).replace(/^\(O\)/, '')
}

/**
 * Compute perfection score from entities + saveData.
 * Returns an array of category result objects, each with:
 *   { id, label, weight, done, total, pct, contribution, detail, linkPath, binary }
 * Also returns overallPct (0–100, weighted average).
 */
export function computePerfectionScore(items, saveData) {
  const hasSave = saveData != null

  // Build lookups
  const monsterByName = new Map()
  for (const item of items.filter(i => i.type === 'monster')) {
    if (item.internalName) monsterByName.set(item.internalName, item)
  }

  const categories = perfectionRules.categories.map(rule => {
    let done = 0
    let total = 0

    switch (rule.id) {
      case 'shipped': {
        const shippable = items.filter(i => FULL_SHIPMENT_NAMES.has(i.name) && i.type !== 'quest')
        total = shippable.length
        done = hasSave ? shippable.filter(i => (saveData.itemsShipped?.[i.gameId] ?? 0) > 0).length : 0
        break
      }

      case 'golden-clock': {
        total = 1
        done = hasSave && (saveData.inventory?.byGameId?.['(BLD)Gold Clock']?.totalCount ?? 0) > 0 ? 1 : 0
        break
      }

      case 'monster-slayer': {
        total = QUEST_GROUPS.length
        if (hasSave) {
          for (const group of QUEST_GROUPS) {
            const monsters = group.targets.map(t => monsterByName.get(t)).filter(Boolean)
            const questData = monsters.find(m => m.slayerQuest)?.slayerQuest ?? {}
            const required = questData.killCount ?? 0
            const kills = group.targets.reduce((sum, t) => sum + (saveData.monstersKilled?.[t] ?? 0), 0)
            if (required > 0 && kills >= required) done++
          }
        }
        break
      }

      case 'stardrops': {
        const flags = rule.mailFlags
        total = flags.length
        done = hasSave ? flags.filter(f => (saveData.mailReceived ?? []).includes(f)).length : 0
        break
      }

      case 'cooking': {
        const cookable = items.filter(i => i.capabilities?.cookable && i.sources?.some(s => s.type === 'cooking'))
        total = cookable.length
        done = hasSave ? cookable.filter(i => {
          const src = i.sources.find(s => s.type === 'cooking')
          return src &&
            src.recipeName in (saveData.cookingRecipes ?? {}) &&
            (saveData.recipesCooked?.[i.gameId] ?? 0) > 0
        }).length : 0
        break
      }

      case 'crafting': {
        const craftable = items.filter(i =>
          i.capabilities?.craftable &&
          i.sources?.some(s => s.type === 'crafting') &&
          i.name !== 'Wedding Ring'
        )
        total = craftable.length
        done = hasSave ? craftable.filter(i => {
          const src = i.sources.find(s => s.type === 'crafting')
          return src && (saveData.craftingRecipes?.[src.recipeName] ?? 0) > 0
        }).length : 0
        break
      }

      case 'fish': {
        const perfFish = items.filter(i => FISHING_COLLECTION_IDS.has(bareId(i.gameId)))
        total = perfFish.length
        done = hasSave ? perfFish.filter(f => {
          const key = String(f.gameId).startsWith('(') ? f.gameId : `(O)${f.gameId}`
          return key in (saveData.fishCaught ?? {})
        }).length : 0
        break
      }

      case 'friends': {
        const villagers = items.filter(i => i.type === 'villager')
        total = villagers.length
        if (hasSave) {
          for (const v of villagers) {
            const pts = saveData.friendships?.[v.name]?.points ?? 0
            const hearts = Math.floor(pts / 250)
            const maxHearts = v.canBeRomanced ? rule.romanceableMaxHearts : rule.nonRomanceableMaxHearts
            if (hearts >= maxHearts) done++
          }
        }
        break
      }

      case 'obelisks': {
        const buildings = rule.buildings
        total = buildings.length
        done = hasSave ? buildings.filter(b =>
          (saveData.inventory?.byGameId?.[`(BLD)${b}`]?.totalCount ?? 0) > 0
        ).length : 0
        break
      }

      case 'farmer-level': {
        total = rule.maxLevel
        if (hasSave && saveData.skills) {
          const s = saveData.skills
          const sum = (s.farming ?? 0) + (s.mining ?? 0) + (s.fishing ?? 0) + (s.foraging ?? 0) + (s.combat ?? 0)
          done = Math.min(Math.floor(sum / 2), rule.maxLevel)
        }
        break
      }

      case 'walnuts': {
        total = 130
        done = hasSave ? Math.min(saveData.goldenWalnuts ?? 0, total) : 0
        break
      }
    }

    // Contribution to overall % — binary categories are all-or-nothing
    let contribution
    if (rule.binary) {
      contribution = done >= total ? rule.weight : 0
    } else {
      contribution = total > 0 ? (done / total) * rule.weight : 0
    }

    return {
      id: rule.id,
      label: rule.label,
      weight: rule.weight,
      done,
      total,
      pct: total > 0 ? Math.floor((done / total) * 100) : 0,
      contribution,
      detail: rule.detail,
      linkPath: rule.linkPath ?? null,
      binary: rule.binary ?? false,
    }
  })

  const overallPct = Math.floor(categories.reduce((sum, c) => sum + c.contribution, 0))

  return { categories, overallPct }
}

import { useMemo } from 'react'
import { useEntities } from '../contexts/EntityContext'
import { useProgress } from './UseProgress'
import { usePlayer } from '../contexts/PlayerContext'
import { computeShrineScore } from '../utils/ShrineScore'
import upgradeRules from '../../data/rules/farmhouse-upgrades.json'
import {
  POLYCULTURE_NAMES,
  FULL_SHIPMENT_NAMES,
} from '../utils/AchievementProgress'

const PLACEHOLDER_GAME_IDS = new Set(['(O)0', '(O)2', '(O)10'])
const TOTAL_WALNUTS = 130
const TOTAL_RACCOON_FEEDINGS = 9
const TOTAL_CANDLES = 4
const TOTAL_FARMHOUSE_UPGRADES = upgradeRules.upgrades.length

/**
 * Returns a map of tracker route path → { done, total } for each tracker category.
 * Values are null when no save data is loaded (avoids misleading 0% for everything).
 */
export function useTrackerCompletion() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const { player } = usePlayer()
  const saveData = player.saveData

  return useMemo(() => {
    const empty = (path) => [path, null]

    if (loading || !progress.hasSaveData || !saveData) {
      return new Map([
        empty('/tracker/bundles'),
        empty('/tracker/shrine'),
        empty('/tracker/museum'),
        empty('/tracker/achievements'),
        empty('/tracker/fishing'),
        empty('/tracker/shipping'),
        empty('/tracker/full-shipment'),
        empty('/tracker/cooking'),
        empty('/tracker/crafting'),
        empty('/tracker/slayer'),
        empty('/tracker/rarecrows'),
        empty('/tracker/secret-notes'),
        empty('/tracker/well-read'),
        empty('/tracker/farmhouse'),
        empty('/tracker/raccoon-shop'),
        empty('/tracker/golden-walnuts'),
      ])
    }

    // ── Bundles ────────────────────────────────────────────────────────────────
    let bundlesDone = 0
    let bundlesTotal = 0
    for (const b of items.filter(i => i.type === 'bundle')) {
      bundlesTotal++
      const isGold = !!b.goldCost
      const realItemList = isGold ? [] : (b.items ?? []).filter(i => !PLACEHOLDER_GAME_IDS.has(i.gameId))
      const required = b.minItemsRequired ?? realItemList.length
      const prog = progress.getBundleProgress(b.bundleNumber, isGold ? 1 : realItemList.length)
      const complete = isGold ? !!prog?.complete : (prog ? prog.items.filter(Boolean).length >= required : false)
      if (complete) bundlesDone++
    }

    // ── Museum ─────────────────────────────────────────────────────────────────
    const donatable = items.filter(i => i.museumDonatable)
    const museumDone = donatable.filter(i => progress.isMuseumDonated(i.gameId)).length

    // ── Achievements ───────────────────────────────────────────────────────────
    const achievements = items.filter(i => i.type === 'achievement')
    const achievementsDone = achievements.filter(a => progress.hasAchievement(a.achievementId)).length

    // ── Fish Caught ────────────────────────────────────────────────────────────
    const fish = items.filter(i => i.type === 'fish')
    const fishDone = fish.filter(f => progress.isFishCaught(f.gameId)).length

    // ── Crops Shipped (Polyculture — shipped any of each polyculture crop) ──────
    const shippable = items.filter(i => i.type === 'crop' && POLYCULTURE_NAMES.has(i.name))
    const shippingDone = shippable.filter(i => progress.getItemShippedCount(i.gameId) > 0).length

    // ── Full Shipment ──────────────────────────────────────────────────────────
    const fullShipmentItems = items.filter(i => FULL_SHIPMENT_NAMES.has(i.name))
    const fullShipmentDone = fullShipmentItems.filter(i => progress.getItemShippedCount(i.gameId) > 0).length

    // ── Cooking Recipes ────────────────────────────────────────────────────────
    const cookable = items.filter(i => i.capabilities?.cookable && i.sources?.some(s => s.type === 'cooking'))
    const cookingDone = cookable.filter(i => {
      const src = i.sources.find(s => s.type === 'cooking')
      return src && progress.isRecipeKnown(src.recipeName) && progress.isRecipeCooked(i.gameId)
    }).length

    // ── Crafting Recipes ───────────────────────────────────────────────────────
    const craftable = items.filter(i => i.capabilities?.craftable && i.sources?.some(s => s.type === 'crafting'))
    const craftingDone = craftable.filter(i => {
      const src = i.sources.find(s => s.type === 'crafting')
      return src && progress.isCraftingRecipeKnown(src.recipeName) && progress.isCraftingRecipeCrafted(src.recipeName)
    }).length

    // ── Monster Slayer ─────────────────────────────────────────────────────────
    const QUEST_GROUPS = [
      { id: 'Slimes',       targets: ['Green Slime', 'Frost Jelly', 'Sludge', 'Tiger Slime'] },
      { id: 'Shadows',      targets: ['Shadow Shaman', 'Shadow Brute', 'Shadow Sniper'] },
      { id: 'Bats',         targets: ['Bat', 'Frost Bat', 'Lava Bat', 'Iridium Bat'] },
      { id: 'Skeletons',    targets: ['Skeleton', 'Skeleton Mage'] },
      { id: 'Insects',      targets: ['Grub', 'Fly', 'Bug'] },
      { id: 'Duggy',        targets: ['Duggy', 'Magma Duggy'] },
      { id: 'DustSpirits',  targets: ['Dust Spirit'] },
      { id: 'Crabs',        targets: ['Rock Crab', 'Lava Crab', 'Iridium Crab'] },
      { id: 'Mummies',      targets: ['Mummy'] },
      { id: 'Dinos',        targets: ['Pepper Rex'] },
      { id: 'Serpents',     targets: ['Serpent', 'Royal Serpent'] },
      { id: 'FlameSpirits', targets: ['Magma Sprite', 'Magma Sparker'] },
    ]
    const monsterByName = new Map()
    for (const item of items.filter(i => i.type === 'monster')) {
      if (item.internalName) monsterByName.set(item.internalName, item)
    }
    let slayerDone = 0
    for (const group of QUEST_GROUPS) {
      const monsters = group.targets.map(t => monsterByName.get(t)).filter(Boolean)
      const questData = monsters.find(m => m.slayerQuest)?.slayerQuest ?? {}
      const count = questData.killCount ?? 0
      const kills = group.targets.reduce((sum, t) => sum + progress.getMonsterKills(t), 0)
      if (count > 0 && kills >= count) slayerDone++
    }

    // ── Rarecrows ──────────────────────────────────────────────────────────────
    const rarecrows = items.filter(i => i.name === 'Rarecrow')
    const rarecrowsDone = rarecrows.filter(r => progress.isOwned(r.gameId)).length

    // ── Secret Notes ───────────────────────────────────────────────────────────
    const notes = items.filter(i => i.type === 'secret-note' || i.type === 'journal-scrap')
    const notesDone = notes.filter(n => progress.hasSecretNote(n.noteNumber)).length

    // ── Well-read ──────────────────────────────────────────────────────────────
    const books = items.filter(i => i.type === 'book')
    const booksDone = books.filter(b => progress.isBookRead(b.gameId)).length

    // ── Farmhouse (upgrades only, not renovations) ─────────────────────────────
    const farmhouseDone = progress.houseUpgradeLevel ?? 0

    // ── Giant Stump Shop (Raccoon) ─────────────────────────────────────────────
    const raccoonDone = progress.timesFedRaccoons ?? 0

    // ── Golden Walnuts ─────────────────────────────────────────────────────────
    const walnutsDone = saveData.goldenWalnuts ?? 0

    // ── Grandpa's Shrine ───────────────────────────────────────────────────────
    const candlesDone = computeShrineScore(saveData)?.candles ?? 0

    return new Map([
      ['/tracker/bundles',      { done: bundlesDone,      total: bundlesTotal }],
      ['/tracker/shrine',       { done: candlesDone,      total: TOTAL_CANDLES }],
      ['/tracker/museum',       { done: museumDone,        total: donatable.length }],
      ['/tracker/achievements', { done: achievementsDone, total: achievements.length }],
      ['/tracker/fishing',      { done: fishDone,          total: fish.length }],
      ['/tracker/shipping',     { done: shippingDone,      total: shippable.length }],
      ['/tracker/full-shipment',{ done: fullShipmentDone, total: fullShipmentItems.length }],
      ['/tracker/cooking',      { done: cookingDone,       total: cookable.length }],
      ['/tracker/crafting',     { done: craftingDone,      total: craftable.length }],
      ['/tracker/slayer',       { done: slayerDone,        total: QUEST_GROUPS.length }],
      ['/tracker/rarecrows',    { done: rarecrowsDone,     total: rarecrows.length }],
      ['/tracker/secret-notes', { done: notesDone,         total: notes.length }],
      ['/tracker/well-read',    { done: booksDone,         total: books.length }],
      ['/tracker/farmhouse',    { done: farmhouseDone,     total: TOTAL_FARMHOUSE_UPGRADES }],
      ['/tracker/raccoon-shop', { done: raccoonDone,       total: TOTAL_RACCOON_FEEDINGS }],
      ['/tracker/golden-walnuts',{ done: walnutsDone,      total: TOTAL_WALNUTS }],
    ])
  }, [items, loading, progress, saveData])
}

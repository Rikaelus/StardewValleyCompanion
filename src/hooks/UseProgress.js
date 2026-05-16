import { useMemo } from 'react'
import { usePlayer } from '../contexts/PlayerContext'

/**
 * Bridge between PlayerContext.saveData and entity lookups.
 * Provides helper functions to check progress from imported save data.
 * All functions return safe defaults when no save data is present.
 */
export function useProgress() {
  const { player } = usePlayer()
  const saveData = player.saveData

  return useMemo(() => {
    const hasSaveData = saveData != null

    function normalizeGameId(gameId) {
      if (!gameId) return null
      const str = String(gameId)
      return str.startsWith('(') ? str : `(O)${str}`
    }

    function isFishCaught(gameId) {
      if (!saveData?.fishCaught) return false
      const key = normalizeGameId(gameId)
      return key != null && key in saveData.fishCaught
    }

    function getFishCaughtCount(gameId) {
      if (!saveData?.fishCaught) return 0
      const key = normalizeGameId(gameId)
      return key != null ? (saveData.fishCaught[key]?.count ?? 0) : 0
    }

    function isItemShipped(gameId) {
      if (!saveData?.itemsShipped) return false
      const key = normalizeGameId(gameId)
      return key != null && key in saveData.itemsShipped
    }

    function getItemShippedCount(gameId) {
      if (!saveData?.itemsShipped) return 0
      const key = normalizeGameId(gameId)
      return key != null ? (saveData.itemsShipped[key] ?? 0) : 0
    }

    function getFriendshipHearts(villagerName) {
      if (!saveData?.friendships) return 0
      const friendship = saveData.friendships[villagerName]
      if (!friendship) return 0
      return Math.floor(friendship.points / 250)
    }

    function getFriendshipStatus(villagerName) {
      if (!saveData?.friendships) return null
      return saveData.friendships[villagerName]?.status ?? null
    }

    function isArtifactFound(gameId) {
      if (!saveData?.archaeologyFound) return false
      const key = normalizeGameId(gameId)
      return key != null && key in saveData.archaeologyFound
    }

    function isMineralFound(gameId) {
      if (!saveData?.mineralsFound) return false
      const key = normalizeGameId(gameId)
      return key != null && key in saveData.mineralsFound
    }

    function isMuseumDonated(gameId) {
      if (!saveData?.museumPieces) return false
      const key = normalizeGameId(gameId)
      return key != null && saveData.museumPieces.includes(key)
    }

    function isRecipeKnown(recipeName) {
      if (!saveData?.cookingRecipes) return false
      return recipeName in saveData.cookingRecipes
    }

    function isRecipeCooked(recipeName) {
      if (!saveData?.cookingRecipes) return false
      return (saveData.cookingRecipes[recipeName] ?? 0) > 0
    }

    function isCraftingRecipeKnown(recipeName) {
      if (!saveData?.craftingRecipes) return false
      return recipeName in saveData.craftingRecipes
    }

    function hasMailFlag(flag) {
      if (!saveData?.mailReceived) return false
      return saveData.mailReceived.includes(flag)
    }

    function hasAchievement(achievementId) {
      if (!saveData?.achievements) return false
      return saveData.achievements.includes(achievementId)
    }

    /**
     * Get bundle progress by bundle number (the integer key used in save files).
     * @param {number} bundleNumber - The bundle number from the entity
     * @param {number} itemCount - Number of items in the bundle (used to collapse quality slots)
     * Returns null if no bundle data, or { items: boolean[], complete: boolean }.
     *
     * The save file stores multiple boolean slots per item (typically 3 for quality tiers).
     * We collapse these into one boolean per item: true if any quality was turned in.
     */
    function getBundleProgress(bundleNumber, itemCount) {
      if (!saveData?.bundleProgress || bundleNumber == null) return null
      const raw = saveData.bundleProgress[String(bundleNumber)]
      if (!raw) return null

      // Collapse quality slots into per-item booleans.
      // Layout is transposed: [item0q0, item1q0, ..., itemNq0, item0q1, item1q1, ...]
      if (itemCount && itemCount > 0 && raw.length > itemCount) {
        const qualityLevels = Math.floor(raw.length / itemCount)
        const items = []
        for (let i = 0; i < itemCount; i++) {
          const turnedIn = Array.from({ length: qualityLevels }, (_, q) => raw[q * itemCount + i]).some(Boolean)
          items.push(turnedIn)
        }
        return {
          items,
          complete: items.every(Boolean),
        }
      }

      // Fallback: use raw booleans directly
      return {
        items: raw,
        complete: raw.every(Boolean),
      }
    }

    /**
     * Get completion status for any entity based on its type and save data.
     * Returns { completed: boolean, label: string } or null if not applicable / no save data.
     */
    function getEntityCompletion(entity) {
      if (!hasSaveData || !entity) return null

      switch (entity.type) {
        case 'bundle': {
          const itemCount = entity.goldCost ? 1 : (entity.items?.length ?? 0)
          const progress = getBundleProgress(entity.bundleNumber, itemCount)
          return progress?.complete ? { completed: true, label: 'Complete' } : null
        }
        case 'artifact':
          return isMuseumDonated(entity.gameId) ? { completed: true, label: 'Donated' } : null
        case 'mineral':
          return isMuseumDonated(entity.gameId) ? { completed: true, label: 'Donated' } : null
        default:
          return null
      }
    }

    function getOwnedRecord(gameId) {
      if (!saveData?.inventory?.byGameId) return null
      const key = normalizeGameId(gameId)
      if (key == null) return null
      return saveData.inventory.byGameId[key] ?? saveData.inventory.byGameId[gameId] ?? null
    }

    function getOwnedCount(gameId) {
      return getOwnedRecord(gameId)?.totalCount ?? 0
    }

    function isOwned(gameId) {
      return getOwnedCount(gameId) > 0
    }

    function getOwnedLocations(gameId) {
      return getOwnedRecord(gameId)?.locations ?? []
    }

    const isJojaRoute = hasSaveData && (saveData.mailReceived ?? []).includes('JojaMember')
    const isMissingBundleAvailable = hasSaveData && !isJojaRoute && (saveData.mailReceived ?? []).includes('communityCenter')

    return {
      hasSaveData,
      saveDate: saveData?.date ?? null,
      skills: saveData?.skills ?? null,
      grandpaScore: saveData?.grandpaScore ?? null,
      isJojaRoute,
      isMissingBundleAvailable,

      isFishCaught,
      getFishCaughtCount,
      isItemShipped,
      getItemShippedCount,
      getFriendshipHearts,
      getFriendshipStatus,
      isArtifactFound,
      isMineralFound,
      isMuseumDonated,
      isRecipeKnown,
      isRecipeCooked,
      isCraftingRecipeKnown,
      hasMailFlag,
      hasAchievement,
      getBundleProgress,
      getEntityCompletion,

      // Inventory
      isOwned,
      getOwnedCount,
      getOwnedLocations,
    }
  }, [saveData])
}

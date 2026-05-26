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

    function isFieldOfficeDonated(pieceIndex) {
      return saveData?.fieldOfficePieces?.piecesDonated?.[pieceIndex] === true
    }

    function isFieldOfficePlantRestored(side) {
      if (side === 'left') return saveData?.fieldOfficePieces?.plantsRestoredLeft === true
      if (side === 'right') return saveData?.fieldOfficePieces?.plantsRestoredRight === true
      return false
    }

    function isRecipeKnown(recipeName) {
      if (!saveData?.cookingRecipes) return false
      return recipeName in saveData.cookingRecipes
    }

    function isRecipeCooked(gameId) {
      if (!saveData?.recipesCooked) return false
      return (saveData.recipesCooked[gameId] ?? 0) > 0
    }

    function getRecipeCookedCount(gameId) {
      return saveData?.recipesCooked?.[gameId] ?? 0
    }

    function isCraftingRecipeKnown(recipeName) {
      if (!saveData?.craftingRecipes) return false
      return recipeName in saveData.craftingRecipes
    }

    function isCraftingRecipeCrafted(recipeName) {
      if (!saveData?.craftingRecipes) return false
      return (saveData.craftingRecipes[recipeName] ?? 0) > 0
    }

    function getMonsterKills(internalName) {
      if (!saveData?.monstersKilled) return 0
      return saveData.monstersKilled[internalName] ?? 0
    }

    function hasMailFlag(flag) {
      if (!saveData?.mailReceived) return false
      return saveData.mailReceived.includes(flag)
    }

    function hasAchievement(achievementId) {
      if (!saveData?.achievements) return false
      return saveData.achievements.includes(achievementId)
    }

    function isBookRead(gameId) {
      if (!saveData?.stats) return false
      // Books store their bare key in player stats with value 1 when read
      // e.g. "Book_Speed", "PurpleBook", "SkillBook_0"
      const bare = String(gameId).replace(/^\(O\)/, '')
      return (saveData.stats[bare] ?? 0) >= 1
    }

    function hasSecretNote(noteNumber) {
      if (!saveData?.secretNotesSeen) return false
      return saveData.secretNotesSeen.includes(noteNumber)
    }

    function hasSecretNoteReward(reward) {
      if (!reward) return false
      if (reward.mailFlag) return hasMailFlag(reward.mailFlag)
      if (reward.eventId) return new Set(saveData?.eventsSeen ?? []).has(reward.eventId)
      if (reward.gameId) return isOwned(reward.gameId)
      return false
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

    /**
     * Returns an array of { entity, reason, count } for every incomplete goal that needs this entity.
     * - reason: 'bundle' | 'museum'
     * - entity: the bundle entity (or null for museum)
     * - count: quantity required
     * Requires findById from EntityContext — pass it in from the call site.
     */
    function neededFor(entity, findById) {
      if (!hasSaveData || !entity?.gameId) return []
      const results = []

      if (entity.capabilities?.donatable && !isMuseumDonated(entity.gameId)) {
        results.push({ entity: null, reason: 'museum', count: 1 })
      }

      if (entity.capabilities?.bundleSlot && entity.bundles?.length && !isJojaRoute) {
        for (const bundleId of entity.bundles) {
          const bundle = findById(bundleId)
          if (!bundle) continue
          if (bundleId === 'bundle-the-missing' && !isMissingBundleAvailable) continue
          const itemCount = bundle.goldCost ? 1 : (bundle.items?.length ?? 0)
          const progress = getBundleProgress(bundle.bundleNumber, itemCount)
          if (progress?.complete) continue
          // Find how many of this item the bundle requires
          const slot = bundle.items?.find(i => i.gameId === entity.gameId)
          const count = slot?.quantity ?? 1
          results.push({ entity: bundle, reason: 'bundle', count })
        }
      }

      return results
    }

    function isNeeded(entity, findById) {
      return neededFor(entity, findById).length > 0
    }

    function getOwnedRecord(gameId, entity = null) {
      if (!saveData?.inventory?.byGameId) return null
      const key = normalizeGameId(gameId)
      if (key == null) return null

      // Artisan variants sharing a gameId (juice, wine, roe, etc.) need special handling.
      // A plain gameId lookup would report every variant as owned whenever you own any one.
      if (entity?.genericId) {
        if (entity.preserveType) {
          // Flavored items (juice, wine, roe, etc.) are identified by compound key:
          // "gameId:preserveType:inputGameId" — matches what the save parser emits.
          const machineSource = entity.sources?.find(s => s.type === 'machine')
          const inputGameId = machineSource?.inputGameId ? normalizeGameId(machineSource.inputGameId) : null
          if (inputGameId) {
            const compoundKey = `${key}:${entity.preserveType}:${inputGameId}`
            return saveData.inventory.byGameId[compoundKey] ?? null
          }
        }
        // genericId without preserveType (e.g. oil variants) — the game stores no
        // per-variant identity in the save file, so ownership can't be determined.
        return null
      }

      return saveData.inventory.byGameId[key] ?? saveData.inventory.byGameId[gameId] ?? null
    }

    function getOwnedCount(gameId, entity = null) {
      return getOwnedRecord(gameId, entity)?.totalCount ?? 0
    }

    function isOwned(gameId, entity = null) {
      return getOwnedCount(gameId, entity) > 0
    }

    function getOwnedLocations(gameId, entity = null) {
      return getOwnedRecord(gameId, entity)?.locations ?? []
    }

    const isJojaRoute = hasSaveData && (saveData.mailReceived ?? []).includes('JojaMember')
    const isMissingBundleAvailable = hasSaveData && !isJojaRoute && (saveData.mailReceived ?? []).includes('communityCenter')

    const totalMoneyEarned = saveData?.totalMoneyEarned ?? 0
    const currentMoney = saveData?.money ?? 0
    const houseUpgradeLevel = saveData?.houseUpgradeLevel ?? 0
    const timesFedRaccoons = saveData?.timesFedRaccoons ?? null
    const totalFishCaught = hasSaveData
      ? Object.values(saveData.fishCaught ?? {}).reduce((s, v) => s + (v.count ?? 0), 0)
      : 0
    const allFriendships = saveData?.friendships ?? {}

    return {
      hasSaveData,
      saveDate: saveData?.date ?? null,
      skills: saveData?.skills ?? null,
      grandpaScore: saveData?.grandpaScore ?? null,
      totalMoneyEarned,
      currentMoney,
      houseUpgradeLevel,
      timesFedRaccoons,
      totalFishCaught,
      allFriendships,
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
      isFieldOfficeDonated,
      isFieldOfficePlantRestored,
      isRecipeKnown,
      isRecipeCooked,
      getRecipeCookedCount,
      isCraftingRecipeKnown,
      isCraftingRecipeCrafted,
      getMonsterKills,
      hasMailFlag,
      hasAchievement,
      isBookRead,
      hasSecretNote,
      hasSecretNoteReward,
      getBundleProgress,
      getEntityCompletion,

      // Inventory
      isOwned,
      getOwnedCount,
      getOwnedLocations,

      // Need analysis
      neededFor,
      isNeeded,
    }
  }, [saveData])
}

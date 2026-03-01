import jsonLogic from 'json-logic-js'

/**
 * Evaluate a JSON Logic condition against a player data context.
 * Returns true/false if playerData is available, null otherwise.
 *
 * Expected playerData shape (populated from save file upload):
 * {
 *   player: {
 *     skills:      { farming, fishing, foraging, mining, combat },
 *     mastery:     { farming, fishing, foraging, mining, combat },
 *     hearts:      { [npcName]: number, anyDateable: number },
 *     mail:        string[],
 *     items:       string[],   // game IDs as strings
 *     achievements: number[],
 *     events:      number[],
 *     relationships: string[], // e.g. ['married', 'engaged']
 *     conversationTopics: string[],
 *     craftingRecipes: string[],
 *     mineDepth:   number,
 *     houseUpgrade: number,
 *     allAchievements: boolean,
 *     stats:       { [statName]: number },
 *   },
 *   world: {
 *     GoldenWalnutsFound: number,
 *     TimesFedRaccoons:   number,
 *     GoldenCoconutCracked: boolean,
 *     communityCenter:    boolean,
 *   },
 *   museum: {
 *     artifacts: number,
 *     minerals:  number,
 *   },
 * }
 */
export function evaluateCondition(condition, playerData) {
  if (!condition || !playerData) return null
  try {
    return jsonLogic.apply(condition, playerData)
  } catch {
    return null
  }
}

import { useMemo } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { useEntities } from '../../contexts/EntityContext'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import './GoldenWalnutPage.css'

const WALNUT_SOURCES = [
  // General
  { id: 'golden_coconut', label: 'Golden Coconut', description: 'Bring a Golden Coconut to Clint. The first one he opens contains a walnut.', count: 1, area: 'general', saveKey: 'mail:goldenCoconutHat' },
  { id: 'island_fishing', label: 'Island Fishing', description: 'Fish anywhere on Ginger Island. Each cast has a 15% chance for a walnut, up to 5 total.', count: 5, area: 'general', saveKey: 'limitedNutDrops:IslandFishing' },

  // Island East
  { id: 'east_bush_jungle', label: 'Jungle Bush', description: 'A walnut bush on the jungle path toward Leo\'s hut on Island East.', count: 1, area: 'east', saveKey: 'collectedNutTracker:Bush_IslandEast_17_37' },
  { id: 'east_banana_shrine', label: 'Banana Shrine', description: 'Place a Banana on the altar near Leo\'s hut stairs. A gorilla rewards 3 walnuts.', count: 3, area: 'east', saveKey: 'collectedNutTracker:BananaShrine' },
  { id: 'east_leo_hut_tree', label: 'Leo\'s Hut Tree', description: 'Hit the tree inside Leo\'s hut with an axe.', count: 1, area: 'east', saveKey: 'collectedNutTracker:TreeNut' },
  { id: 'east_gem_bird_path', label: 'Gem Bird Shrine Path', description: 'Follow the hidden eastern passage from Leo\'s stairs to the Gem Bird Shrine. A walnut sits south of the shrine.', count: 1, area: 'east', saveKey: 'collectedNutTracker:Bush_IslandShrine_23_34' },
  { id: 'east_gem_bird_puzzle', label: 'Gem Birds Puzzle', description: 'Place all four gems on the pedestals at the Island Shrine. Rewards 5 walnuts.', count: 5, area: 'east', saveKey: 'collectedNutTracker:IslandShrinePuzzle' },

  // Island West
  { id: 'west_farming', label: 'Island Farm Crops', description: 'Harvest crops on Ginger Island. Each harvest has a 5% chance for a walnut (non-regrowing crops only), up to 5 total.', count: 5, area: 'west', saveKey: 'limitedNutDrops:IslandFarming' },
  { id: 'west_gourmand_melon', label: 'Gourmand Frog: Melon', description: 'Talk to the Gourmand Frog in the cave south of the island farm. Grow a Melon and leave it for the frog. Rewards 5 walnuts.', count: 5, area: 'west', saveKey: 'collectedNutTracker:IslandGourmand1' },
  { id: 'west_gourmand_wheat', label: 'Gourmand Frog: Wheat', description: 'After the Melon, grow Wheat for the Gourmand Frog. Rewards 5 walnuts.', count: 5, area: 'west', saveKey: 'collectedNutTracker:IslandGourmand2' },
  { id: 'west_gourmand_garlic', label: 'Gourmand Frog: Garlic', description: 'After Wheat, grow Garlic for the Gourmand Frog. Rewards 5 walnuts.', count: 5, area: 'west', saveKey: 'collectedNutTracker:IslandGourmand3' },
  { id: 'west_buried_journal6', label: 'Buried: SE Beach Corner', description: 'Journal Scrap #6: SE corner of the beach where the eastern cliff meets the northern rock formation. Dig the corner tile.', count: 1, area: 'west', saveKey: 'limitedNutDrops:Island_W_BuriedTreasureNut2' },
  { id: 'west_mussel_nodes', label: 'Mussel Nodes', description: 'Mine Mussel Nodes on the beach. Each node has a 10% chance to yield a walnut, up to 5 total.', count: 5, area: 'west', saveKey: 'limitedNutDrops:MusselStone' },
  { id: 'west_shipwreck', label: 'Inside Shipwreck', description: 'Find the shipwreck at the SW beach south of the farm. Follow the hidden path at the west corner into the ship interior.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_CaptainRoom_2_4' },
  { id: 'west_sand_duggy', label: 'Sand Duggy', description: 'Find the mole at the SE beach south of Birdie\'s hut. Cover three holes with objects to trap it, then whack it.', count: 1, area: 'west', saveKey: 'collectedNutTracker:SandDuggy' },
  { id: 'west_buried_starfish_blue', label: 'Buried: Blue Starfish Triangle', description: 'Find the blue starfish triangle on the beach south of the farm. Dig up the center.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Buried_IslandWest_62_76' },
  { id: 'west_buried_starfish_diamond', label: 'Buried: Starfish Diamond', description: 'Find the starfish diamond near the tide pools (may be under a rock). Dig up the center.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Buried_IslandWest_43_74' },
  { id: 'west_buried_sand_x', label: 'Buried: X in Sand (Tide Pools)', description: 'Find the X marked in the sand in the tide pools. Dig up the center.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Buried_IslandWest_30_75' },
  { id: 'west_buried_sand_diamond', label: 'Buried: Diamond Indents near Ocean', description: 'Find a diamond of indents in the sand bottom-left of the tide pools near the ocean. Dig up the center.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Buried_IslandWest_21_81' },
  { id: 'west_pond_tree', label: 'Coconut Tree Bush (Pond)', description: 'A walnut bush behind a coconut tree by the pond west of the island farm.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_38_56' },
  { id: 'west_pirates_wife', label: 'Pirate\'s Wife Quest', description: 'Complete The Pirate\'s Wife quest by helping Birdie. Rewards 5 walnuts.', count: 5, area: 'west', saveKey: 'limitedNutDrops:Birdie' },
  { id: 'west_buried_journal4', label: 'Buried: North of Birdie\'s Hut', description: 'Journal Scrap #4: Dig in the sand north of Birdie\'s Hut to find a Quality Bobber and a walnut. (Yields nothing without the journal scrap.)', count: 1, area: 'west', saveKey: 'limitedNutDrops:Island_W_BuriedTreasureNut' },
  { id: 'west_coast_walnut_room', label: 'Bush near Qi\'s Walnut Room', description: 'Walk up the western coast toward Qi\'s Walnut Room. A walnut bush sits to the bottom-right near the cliff.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_25_30' },
  { id: 'west_ocean_past_walnut_room', label: 'Bush Past Qi\'s Room (in Ocean)', description: 'Walk through the ocean water past Qi\'s Walnut Room to find a walnut bush.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_15_3' },
  { id: 'west_tiger_slime', label: 'Tiger Slime Grove: Kill Slimes', description: 'Kill slimes in the Tiger Slime Grove for one Golden Walnut total.', count: 1, area: 'west', saveKey: 'limitedNutDrops:TigerSlimeNut' },
  { id: 'west_tiger_grove_mahogany', label: 'Behind Mahogany Tree (Tiger Grove)', description: 'A walnut is found behind a mahogany tree in the Tiger Slime Grove.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_31_24' },
  { id: 'west_tiger_grass_circle', label: 'Buried: Grass Circle (Tiger Grove)', description: 'Find a circle of grass in the Tiger Slime Grove, hidden behind a Mahogany Tree. Dig up the center.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Buried_IslandWest_39_24' },
  { id: 'west_parrot_bridge', label: 'Bush West of Parrot Express Bridge', description: 'From the Parrot Express, go west over the bridge. A walnut bush sits partially hidden by the southern wall.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_54_18' },
  { id: 'west_simon_says', label: 'Simon Says Cave Puzzle', description: 'Complete the Simon Says puzzle in the cave north of Tiger Slime Grove. Rewards 3 walnuts.', count: 3, area: 'west', saveKey: 'collectedNutTracker:IslandWestCavePuzzle' },
  { id: 'west_cliff_east', label: 'Bush at Eastern Cliff Edge', description: 'Go east from Tiger Slime Grove, follow the cliff edge destroying obstacles. A walnut bush is at the end.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_64_30' },
  { id: 'west_pebble_diamond', label: 'Buried: Diamond Pebbles (Parrot Express E)', description: 'East of the farm\'s Parrot Express station, dig the center of the diamond-shaped pebbles.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Buried_IslandWest_88_14' },
  { id: 'west_hidden_path_east', label: 'Bush at End of Eastern Hidden Path', description: 'East of the Parrot Express, follow the hidden path east then north. A walnut bush is at the far end.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_104_3' },
  { id: 'west_south_cliff', label: 'Bush on South Cliff (Farmhouse View)', description: 'South of the Parrot Express, go south along the cliff bending east over the farmhouse. A walnut bush at the end.', count: 1, area: 'west', saveKey: 'collectedNutTracker:Bush_IslandWest_75_29' },

  // Island North
  { id: 'north_buried_stone_circle_entrance', label: 'Buried: Stone Circle at Entrance', description: 'Atop the Island North stairs, turn west and dig the center of the stone circle.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_19_13' },
  { id: 'north_hidden_grove', label: 'Grove Bush (Hidden Passage West)', description: 'Atop the Island North stairs, take the hidden western passage to a secluded grove with a walnut bush.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_20_26' },
  { id: 'north_buried_flower_circle_1', label: 'Buried: First Flower Circle (NE)', description: 'Go northeast of the Island North entrance to the grassy area. Dig the center of the first circle of flowers.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_26_81' },
  { id: 'north_buried_flower_circle_2', label: 'Buried: Second Flower Circle (E)', description: 'Continue east from the first flower circle to another grassy area. Dig the center of the second circle of flowers.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_42_77' },
  { id: 'north_buried_sand_patch', label: 'Buried: Sand Patch (SE of Field Office)', description: 'Southeast of the Island Field Office, find the unusual sand texture and dig for the buried walnut.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_57_79' },
  { id: 'north_buried_dig_site_stone', label: 'Buried: Stone Circle at Dig Site', description: 'Up the north steps of the dig site, dig the center of the stone circle.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_62_54' },
  { id: 'north_dig_site_plant_w', label: 'Bush West of Dig Site', description: 'Up the north steps of the dig site, cross the bridge west to find a walnut plant.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_56_27' },
  { id: 'north_dig_site_plant_e1', label: 'Bush East of Dig Site (1)', description: 'Up the north steps of the dig site, go through the hidden eastern passage in the cliff. First walnut plant beyond the bridge.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_9_84' },
  { id: 'north_dig_site_plant_e2', label: 'Bush East of Dig Site (2)', description: 'Up the north steps of the dig site, go through the hidden eastern passage in the cliff. Second walnut plant beyond the bridge.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_13_33' },
  { id: 'north_field_office_large_animal', label: 'Field Office: Large Animal Collection', description: 'Donate all Large Animal skeleton pieces to the Island Field Office. Rewards 6 walnuts on completion.', count: 6, area: 'north', saveKey: 'collectedNutTracker:IslandCenterSkeletonRestored' },
  { id: 'north_field_office_snake', label: 'Field Office: Snake Collection', description: 'Donate all snake skeleton pieces to the Island Field Office. Rewards 3 walnuts on completion.', count: 3, area: 'north', saveKey: 'collectedNutTracker:IslandSnakeRestored' },
  { id: 'north_field_office_frog', label: 'Field Office: Mummified Frog', description: 'Donate a Mummified Frog to the Island Field Office.', count: 1, area: 'north', saveKey: 'collectedNutTracker:IslandFrogRestored' },
  { id: 'north_field_office_bat', label: 'Field Office: Mummified Bat', description: 'Donate a Mummified Bat to the Island Field Office.', count: 1, area: 'north', saveKey: 'collectedNutTracker:IslandBatRestored' },
  { id: 'north_field_office_survey_plants', label: 'Field Office: Purple Flowers Survey', description: 'Complete the Purple Flowers survey at the Field Office (answer: 22). Rewards 1 walnut.', count: 1, area: 'north', saveKey: 'collectedNutTracker:IslandLeftPlantRestored' },
  { id: 'north_field_office_survey_starfish', label: 'Field Office: Purple Starfish Survey', description: 'Complete the Purple Starfish survey at the Field Office (answer: 18). Rewards 1 walnut.', count: 1, area: 'north', saveKey: 'collectedNutTracker:IslandRightPlantRestored' },
  { id: 'north_volcano_plant_se', label: 'Bush SE of Volcano Entrance', description: 'Southeast of the Volcano Dungeon entrance, find the walnut plant hidden behind a tree.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_5_30' },
  { id: 'north_buried_volcano_sand', label: 'Buried: Sand Circle by Volcano', description: 'East of the Volcano Dungeon entrance, dig the sand circled by two bushes and an arc of stones.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_54_21' },
  { id: 'north_tree_slingshot', label: 'Tree Nut (Slingshot)', description: 'NE of the Volcano Dungeon entrance, a curved tree protrudes from the volcano. Use a Slingshot to knock down the walnut.', count: 1, area: 'north', saveKey: 'collectedNutTracker:TreeNutShot' },
  { id: 'north_buried_journal10', label: 'Buried: Curved Palm (SW of Volcano)', description: 'Journal Scrap #10: SW of the Volcano entrance, a curved palm grows from the cliff. Dig the tile inside the loop of the palm.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Buried_IslandNorth_19_39' },
  { id: 'north_buried_nw_stone', label: 'Buried: NW Stone Circle', description: 'At the extreme northwest of the map (where Leo sometimes stands), dig the center of the stone circle.', count: 1, area: 'north', saveKey: 'limitedNutDrops:Island_N_BuriedTreasureNut' },
  { id: 'north_hidden_nw_bush', label: 'Bush in NW Hidden Passage', description: 'At the extreme NW, go west along the wall and north through a hidden passage to find a secluded walnut bush.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_4_42' },
  { id: 'north_lava_watering_can_1', label: 'Lava Secret Area (Watering Can) 1', description: 'At the volcano lava river entrance, use a Watering Can to create a path westward and south to a landing. First walnut.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_45_38' },
  { id: 'north_lava_watering_can_2', label: 'Lava Secret Area (Watering Can) 2', description: 'At the volcano lava river entrance, use a Watering Can to create a path westward and south to a landing. Second walnut.', count: 1, area: 'north', saveKey: 'collectedNutTracker:Bush_IslandNorth_47_40' },

  // Volcano Dungeon
  { id: 'volcano_mining', label: 'Volcano: Mining', description: 'Mine rocks in the Volcano Dungeon. Up to 5 Golden Walnuts from mining.', count: 5, area: 'volcano', saveKey: 'limitedNutDrops:VolcanoMining' },
  { id: 'volcano_monsters', label: 'Volcano: Monster Drops', description: 'Kill monsters in the Volcano Dungeon. Up to 5 Golden Walnuts from combat.', count: 5, area: 'volcano', saveKey: 'limitedNutDrops:VolcanoMonsterDrop' },
  { id: 'volcano_barrels', label: 'Volcano: Barrels & Crates', description: 'Break barrels and crates in the Volcano Dungeon. Up to 5 Golden Walnuts.', count: 5, area: 'volcano', saveKey: 'limitedNutDrops:VolcanoBarrel' },
  { id: 'volcano_normal_chest', label: 'Volcano: Normal Chest', description: 'Open the normal chest found in the Volcano Dungeon.', count: 1, area: 'volcano', saveKey: 'limitedNutDrops:VolcanoNormalChest' },
  { id: 'volcano_rare_chest', label: 'Volcano: Rare Chest', description: 'Open the rare chest found in the Volcano Dungeon.', count: 1, area: 'volcano', saveKey: 'limitedNutDrops:VolcanoRareChest' },
  { id: 'volcano_forge_enter', label: 'Forge Entrance Bush', description: 'A walnut plant at the entrance to the Forge (top of Volcano Dungeon).', count: 1, area: 'volcano', saveKey: 'collectedNutTracker:Bush_Caldera_28_36' },
  { id: 'volcano_forge_exit', label: 'Forge Exit Bush', description: 'A walnut plant at the exit of the Forge.', count: 1, area: 'volcano', saveKey: 'collectedNutTracker:Bush_Caldera_9_34' },

  // Island South
  { id: 'south_upper_cliff', label: 'Island South Upper Cliff', description: 'From Island North stairs, turn east then go south through a hidden route behind a tree to reach the upper cliff walnut bush on Island South.', count: 1, area: 'south', saveKey: 'collectedNutTracker:Bush_IslandSouth_31_5' },

  // Island Southeast / Pirate Cove
  { id: 'southeast_fishing', label: 'Island SE: Starfish Tide Pool', description: 'Fish in the starfish-shaped tide pool on Island Southeast (requires beach resort). First cast here yields a walnut.', count: 1, area: 'southeast', saveKey: 'collectedNutTracker:StardropPool' },
  { id: 'southeast_buried_starfish', label: 'Buried: Yellow Starfish Diamond (SE)', description: 'On Island Southeast, find a diamond of yellow starfish and dig up the center.', count: 1, area: 'southeast', saveKey: 'collectedNutTracker:Buried_IslandSouthEast_25_17' },
  { id: 'southeast_mermaid', label: 'Mermaid Puzzle', description: 'Rainy day on Island SE: place a Flute Block on each of the five rocks matching the mermaid\'s notes. Rewards 5 walnuts.', count: 5, area: 'southeast', saveKey: 'collectedNutTracker:Mermaid' },
  { id: 'pirate_cove_darts', label: 'Pirate Cove: Darts', description: 'On even days after 8 PM (non-rainy), win at Pirate Cove darts. Up to 3 walnut prizes.', count: 3, area: 'southeast', saveKey: 'limitedNutDrops:Darts' },
  { id: 'pirate_cove_buried_sand', label: 'Buried: Pirate Cove Sand', description: 'In the Pirate Cove, dig the exposed sand patch among the barrels east of the water.', count: 1, area: 'southeast', saveKey: 'collectedNutTracker:Buried_IslandSouthEastCave_36_26' },
]

const AREA_ORDER = ['general', 'east', 'west', 'north', 'volcano', 'south', 'southeast']
const AREA_LABELS = {
  general: 'General (All Areas)',
  east: 'Island East',
  west: 'Island West',
  north: 'Island North',
  volcano: 'Volcano Dungeon',
  south: 'Island South',
  southeast: 'Island SE & Pirate Cove',
}

const PARROT_UPGRADES = [
  { cost: 1, label: 'Island North access', description: 'Unlock the north side of the island.' },
  { cost: 10, label: 'Island West access', description: 'Unlock the west side of the island.' },
  { cost: 20, label: 'Island Farmhouse', description: 'Unlock the farmhouse — sleep here to skip leaving the island.' },
  { cost: 5, label: 'Farmhouse Mailbox', description: 'Check your mail without leaving the island.' },
  { cost: 20, label: 'Farm Obelisk', description: 'Teleport back to your farm.' },
  { cost: 10, label: 'Dig Site Bridge', description: 'Repair the bridge to access the dig site.' },
  { cost: 10, label: 'Island Trader', description: 'Unlock the Island Trader shop.' },
  { cost: 5, label: 'Volcano Bridge', description: 'Permanent bridge into the Volcano (no watering can needed).' },
  { cost: 5, label: 'Volcano Exit Shortcut', description: 'Quick escape from level 5 of the Volcano Dungeon.' },
  { cost: 20, label: 'Beach Resort', description: 'Unlock the beach resort, Island Southeast, and Pirate Cove.' },
  { cost: 10, label: 'Parrot Express', description: 'Unlock fast travel around the island.' },
]
const TOTAL_PARROT_COST = PARROT_UPGRADES.reduce((s, u) => s + u.cost, 0)

function resolveSourceStatus(source, walnutData, mailReceived) {
  if (!walnutData) return { found: null, max: source.count }

  const key = source.saveKey
  if (!key) return { found: null, max: source.count }

  if (key.startsWith('mail:')) {
    const flag = key.slice(5)
    return { found: mailReceived?.includes(flag) ? source.count : 0, max: source.count }
  }

  if (key.startsWith('limitedNutDrops:')) {
    const val = walnutData.limitedNutDrops?.[key.slice(16)] ?? 0
    return { found: val, max: source.count }
  }

  if (key.startsWith('collectedNutTracker:')) {
    const trackerKey = key.slice(20)
    return { found: walnutData.collectedNutTracker?.has(trackerKey) ? source.count : 0, max: source.count }
  }

  return { found: null, max: source.count }
}

function SourceRow({ source, status, hasSaveData }) {
  const isComplete = hasSaveData && status.found != null && status.found >= status.max
  const isPartial = hasSaveData && status.found != null && status.found > 0 && !isComplete
  const isUntrackable = source.saveKey === null

  let rowClass = 'walnut-row'
  if (isComplete) rowClass += ' walnut-row--done'
  else if (isPartial) rowClass += ' walnut-row--partial'

  return (
    <div className={rowClass}>
      <div className="walnut-row-left">
        <span className={`walnut-check ${isComplete ? 'walnut-check--done' : isPartial ? 'walnut-check--partial' : 'walnut-check--empty'}`}>
          {isComplete ? '✓' : isPartial ? '…' : ''}
        </span>
        <div className="walnut-row-info">
          <span className="walnut-row-label">{source.label}</span>
          <span className="walnut-row-desc">{source.description}</span>
        </div>
      </div>
      <div className="walnut-row-right">
        {hasSaveData && !isUntrackable && status.found != null ? (
          <span className="walnut-count">
            {`${status.found}/${source.count}`}
          </span>
        ) : (
          <span className="walnut-count walnut-count--max">×{source.count}</span>
        )}
      </div>
    </div>
  )
}

function AreaSection({ area, sources, walnutData, mailReceived, hasSaveData }) {
  const statuses = sources.map(s => resolveSourceStatus(s, walnutData, mailReceived))
  const areaFound = hasSaveData
    ? statuses.reduce((sum, st) => sum + (st.found ?? 0), 0)
    : null
  const areaTotal = sources.reduce((sum, s) => sum + s.count, 0)

  return (
    <section className="walnut-area">
      <div className="walnut-area-header">
        <h2 className="walnut-area-title">{AREA_LABELS[area]}</h2>
        {hasSaveData && areaFound != null && (
          <span className="walnut-area-count">{areaFound} / {areaTotal}</span>
        )}
        {!hasSaveData && (
          <span className="walnut-area-count">{areaTotal} available</span>
        )}
      </div>
      <div className="walnut-area-rows">
        {sources.map((source, i) => (
          <SourceRow
            key={source.id}
            source={source}
            status={statuses[i]}
            hasSaveData={hasSaveData}
          />
        ))}
      </div>
    </section>
  )
}

function GoldenWalnutPage() {
  const { player } = usePlayer()
  const { items: allEntities } = useEntities()
  const saveData = player.saveData
  const hasSaveData = saveData != null

  const qiRoomEntity = useMemo(() => allEntities?.find(e => e.id === 'map-qinutroom') ?? null, [allEntities])

  const walnutData = useMemo(() => {
    const raw = saveData?.walnutData ?? null
    if (!raw) return null
    return {
      ...raw,
      collectedNutTracker: new Set(Array.isArray(raw.collectedNutTracker) ? raw.collectedNutTracker : []),
    }
  }, [saveData])
  const mailReceived = saveData?.mailReceived ?? []
  const totalFound = saveData?.goldenWalnuts ?? null

  const sourcesByArea = useMemo(() => {
    const grouped = {}
    for (const src of WALNUT_SOURCES) {
      if (!grouped[src.area]) grouped[src.area] = []
      grouped[src.area].push(src)
    }
    return grouped
  }, [])

  // Count trackable progress
  const trackableProgress = useMemo(() => {
    if (!hasSaveData || !walnutData) return null
    let found = 0
    let total = 0
    for (const src of WALNUT_SOURCES) {
      const status = resolveSourceStatus(src, walnutData, mailReceived)
      if (status.found != null) {
        found += status.found
        total += status.max
      }
    }
    return { found, total }
  }, [hasSaveData, walnutData, mailReceived])

  const TOTAL_WALNUTS = 130
  const pct = totalFound != null ? Math.min(1, totalFound / TOTAL_WALNUTS) : 0

  return (
    <PagePanel>
      <div className="walnut-page">
        <header className="walnut-header">
          <h1 className="walnut-title">Golden Walnuts</h1>
          <p className="walnut-subtitle">
            Ginger Island currency — 130 total, 129 individually trackable. Collecting 100 unlocks{' '}
            {qiRoomEntity ? <UniversalModalButton item={qiRoomEntity} variant="inline" showIcon /> : "Qi's Walnut Room"}.
          </p>

          {hasSaveData && totalFound != null && (
            <div className="walnut-progress-wrap">
              <div className="walnut-progress-label">
                <span>{totalFound} / {TOTAL_WALNUTS} found</span>
                {totalFound >= 100 && (
                  <span className="walnut-qi-unlocked">
                    {qiRoomEntity ? <UniversalModalButton item={qiRoomEntity} variant="inline" showIcon /> : "Qi's Walnut Room"} unlocked ✓
                  </span>
                )}
              </div>
              <div className="walnut-progress-bar">
                <div
                  className={`walnut-progress-fill ${totalFound >= TOTAL_WALNUTS ? 'walnut-progress-fill--done' : ''}`}
                  style={{ width: `${pct * 100}%` }}
                />
                <div className="walnut-progress-pip walnut-progress-pip--100" style={{ left: `${(100 / TOTAL_WALNUTS) * 100}%` }} title="100 — Qi's Walnut Room" />
              </div>
              {trackableProgress && (
                <p className="walnut-tracking-note">
                  {trackableProgress.found} / {trackableProgress.total} walnuts tracked from save data
                  ({TOTAL_WALNUTS - trackableProgress.total} come from exploration items not stored individually in your save)
                </p>
              )}
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="walnut-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track your walnut progress.
          </button>
        )}

        <div className="walnut-parrot-section">
          <h2 className="walnut-section-title">Parrot Upgrades</h2>
          <p className="walnut-parrot-intro">
            Spend walnuts to unlock island infrastructure. Total cost: <strong>{TOTAL_PARROT_COST} walnuts</strong>.
          </p>
          <div className="walnut-parrot-grid">
            {PARROT_UPGRADES.map(u => (
              <div key={u.label} className="walnut-parrot-card">
                <span className="walnut-parrot-cost">🌰 {u.cost}</span>
                <div>
                  <div className="walnut-parrot-label">{u.label}</div>
                  <div className="walnut-parrot-desc">{u.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="walnut-areas">
          {AREA_ORDER.map(area => sourcesByArea[area] && (
            <AreaSection
              key={area}
              area={area}
              sources={sourcesByArea[area]}
              walnutData={walnutData}
              mailReceived={mailReceived}
              hasSaveData={hasSaveData}
            />
          ))}
        </div>
      </div>
    </PagePanel>
  )
}

export default GoldenWalnutPage

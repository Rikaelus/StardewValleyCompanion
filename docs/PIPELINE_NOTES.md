# Pipeline Notes — Living Document

Long-form record of decisions, discoveries, and quirks about how `ProcessGameData.cjs` extracts and shapes data. **Append, don't rewrite.** Each entry should be timestamped and self-contained enough that a future session reading just this file can avoid re-deriving the conclusion.

This complements but doesn't replace CLAUDE.md (which holds project-wide principles and the high-level pipeline overview).

---

## Source extraction paths — full inventory

Each item's `sources[]` is built by `buildAcquisitionSources(gameId)`, which queries N maps. Adding a new mechanism means: build a new `Map`, add it to the array in `buildAcquisitionSources`, and emit rows with a unique `type` value. The full set as of 2026-05-14:

| Source `type` | Origin | Map name | Notes |
|---|---|---|---|
| `tilling` (per-location) | `Locations.json > ArtifactSpots[]` | `tillingSourcesByGameId` (first pass) | Specific per-location loot lists |
| `tilling` (per-object) | `Objects.json > ArtifactSpotChances{}` | `tillingSourcesByGameId` (second pass) | Generic "this item drops in these locations" — added 2026-05-14 |
| `geode` | `Objects.json > GeodeDrops[]` on the geode object | `geodeSourcesByGameId` | Includes Artifact Trove |
| `monster-drop` | `Monsters.json` + `extra-monsters.json` | `monsterDropsByGameId` | |
| `breakable-drop` | `data/rules/breakables.json` (hand-curated) | `breakableDropsByGameId` | Sourced from decompiled C# |
| `fish-pond` | `FishPondData.json` | `fishPondSourcesByGameId` | |
| `forage` | `Locations.json > Forage[]` | `forageSourcesByGameId` | |
| `garbage-can` | `GarbageCans.json` | `garbageCanSourcesByGameId` | |
| `crafting` | `CraftingRecipes.json` | `craftingSourcesByGameId` | Covers both `(O)` and `(BC)` outputs. Bug fixed 2026-05-23: lookup must use `qualifiedBCId` (e.g. `"(BC)9"`), not bare integer, for big-craftables. |
| `cooking` | `CookingRecipes.json` | `cookingSourcesByGameId` | |
| `tapper` | `data/rules/tapper-products.json` (hand-curated) | `tapperSourcesByGameId` | |
| `mail` | `mail.xnb` references in source code | `mailSourcesByGameId` | |
| `museum-reward` | `MuseumRewards.json` | `museumRewardSourcesByGameId` | |
| `island-field-office` | `data/rules/island-field-office-rewards.json` | `islandFieldOfficeRewardsByGameId` | |
| `slayer-reward` | `MonsterSlayerQuests.json` | `slayerRewardSourcesByGameId` | |
| `shop` | `Shops.json` + override rules | `shopSourcesByGameId` | 30+ shape variants — needs normalization |
| `animal` | `FarmAnimals.json > ProduceItemIds` | embedded in animal-product processing | |
| `quest-requirement` | `Quests.json` | embedded in quest processing | Not a true acquisition source |
| `fishing-chest` | `data/rules/fishing-chest-drops.json` (hand-curated) | `fishingChestSourcesByGameId` | Added 2026-05-14, hardcoded in C# |

## Hardcoded-in-source mechanisms

Stardew keeps some loot logic in C# code, not data files. These need hand-curated rules files:

- **`GameLocation.getFishingTreasure()`** — Fishing chest contents. Rules in `data/rules/fishing-chest-drops.json`. Sourced from wiki Fishing#Contents section.
- **`ResourceClump.performToolAction()`** — Bone Node rare artifact drops. Folded into `data/rules/breakables.json` `fossil-node` entry (added 2026-05-14).
- **`Tool.Pan.getPanItems()`** — Panning loot. Not currently extracted. Loot is mostly ores/gems already covered by other paths; not high-priority. If added later, would require similar hand-curated file.

## Known game-data inconsistencies we have to absorb

The game itself isn't normalized — these reflect how the game evolved over time, not bugs we should fix. Our pipeline accommodates them.

### ID namespaces

`(O)` Objects | `(BC)` BigCraftables | `(F)` Furniture | `(B)` Boots | `(T)` Tools | `(TR)` Trinkets | `(H)` Hats | `(S)` Shirts | `(P)` Pants

Same display name can collide across namespaces. Example: "Chicken Statue" exists as `(O)113`, `(BC)31`, `(F)1305`, all distinct items with different mechanics. Pipeline disambiguates via `getUniqueItemId()` in `ProcessGameData.cjs` which checks `data/rules/item-variants.json` for explicit overrides. Without an override, kebab-name is used and collisions silently merge during the cross-collection pass at `mergedEntitiesById`. Add a variant rule for any such collision.

### Numeric vs string IDs

1.6 introduced string IDs (`"Carrot"`, `"CalicoEgg"`, `"SpecificBait"`) alongside legacy numeric ones. Save files mix both. Parser must handle both. The `(O)` prefix is added uniformly so downstream code sees `(O)Carrot` and `(O)128` consistently.

### `Type` field overlap

`Objects.json > Type` field has overlapping meanings:
- `Arch` = museum-donatable artifact (per Museum logic)
- BUT some items have `Type: Arch, Category: 0` and are *also* treated as animal-products (Dinosaur Egg, classified by FarmAnimals.json's ProduceItemIds before the artifact pass runs)
- AND items with `Type: Arch` can be omitted from the artifact pass entirely if a prior pass claims their gameId in `alreadyProcessedGameIds`

**Implication:** Don't gate capability flags (like `museumDonatable`) on entity `type`. Derive them directly from raw game data. (Fixed for museum on 2026-05-14.)

### Save-file value type changed

`<museumPieces>` values: `<int>` in 1.5, `<string>` in 1.6 (because IDs can be non-numeric). Parser must accept both. Same likely applies to other dictionaries that store item IDs as values.

### `<museumPieces>` lives inside `ArchaeologyHouse` location, not at root

Easy to assume document-root path; isn't. Same pattern as bundle progress (inside CommunityCenter) and likely other location-scoped state. When parsing save data, walk `<locations>` first.

## Audit pattern

Run this when touching data-related code:

```js
const d = require('./public/data/entities.json')
const byType = {}
for (const it of d.items) {
  const t = it.type
  if (!byType[t]) byType[t] = { total: 0, empty: 0 }
  byType[t].total++
  if (!it.sources?.length) byType[t].empty++
}
// Surface types with high empty% and large totals
```

Investigate any "real item" type with >30% empty sources — that's almost always a missing extraction path. Reference taxonomy types (event, location, tag, quest, achievement, etc.) legitimately have no sources.

## Known un-fixed pipeline gaps

These are documented limitations that have been investigated but not yet fixed. Add to this list whenever you find one rather than re-investigating.

- **Furniture entities don't flow through `buildAcquisitionSources`.** Furniture has its own processing path that only picks up shop sources from the furniture catalogue. Items like Junimo Plush (which has a `secret-note-reward` source per `data/rules/secret-note-rewards.json`) silently miss the rule because the merge never happens. Same likely applies to other rule-based source maps. **Fix:** make furniture processing call `buildAcquisitionSources` like other item types do, or add a post-merge enrichment pass that applies all `*SourcesByGameId` maps to every entity regardless of type. Discovered 2026-05-14.
- **Source map application is type-coupled.** `buildAcquisitionSources` is called inline during each item type's processing block (fish, artifacts, geode-minerals, etc.). New item types that get added without the call lose all rule-based source enrichment. A post-merge pass would decouple this.

## ID format conventions across data sources

Three different conventions are at play. The pipeline must coerce each to the qualified `(X)id` form used in our `entities.json`. A common mistake is assuming one convention everywhere.

| Source | Convention | Coercion needed |
|---|---|---|
| **Save file** `<Item>` elements | Bare `<itemId>52</itemId>` or `<itemId>SteelPan</itemId>` | Map `xsi:type` → prefix via `XSI_TYPE_TO_PREFIX`. Check `<bigCraftable>true</bigCraftable>` to override `(O)` → `(BC)`. Check `<clothesType>` to choose `(S)` or `(P)` for `Clothing`. Then prepend prefix. |
| **Item-defining JSON files** (Objects.json, Tools.json, Hats.json, Boots.json, Furniture.json, Weapons.json, BigCraftables.json, Rings.json, Pants.json, Shirts.json) | Bare keys (`15`, `Pan`, `CalicoEgg`) | Prefix is **implicit by which file you read**. Prepend the appropriate prefix during processing. |
| **Modern cross-reference fields** (Locations.json `ItemId`, Objects.json `GeodeDrops`, Machines.json, etc.) | Already qualified `(O)15`, `(BC)128`, etc. | Use as-is. Watch for special-token `ItemId` values like `LOST_BOOK_OR_ITEM`, `LOCATION_FISH X Y Z`, `SECRET_NOTE_OR_ITEM`, `RANDOM_ARTIFACT_FOR_DIG_SPOT` — strip prefix or skip entirely. |
| **Legacy slash-format files** (CookingRecipes.json, CraftingRecipes.json, Bundles.json, Fish.json) | Bare numeric IDs in delimited strings | Parse the slash-delimited string. Items are implicitly `(O)` Objects unless the format spec includes an explicit namespace marker (e.g. Bundles use `O`/`BO`/`R`). |

**Key insight:** raw game data and save files **don't share an ID convention** — extracting from each requires distinct coercion rules. Get one wrong and entities silently fail to match (e.g. inventory tracking that always says "you don't have any" because the save uses `(BC)15` and we made `(O)15`).

## Save↔entity ID alignment

The save file uses one set of conventions; our entities use another. Mismatches mean inventory tracking, museum donations, etc. silently fail to match. **Run this check whenever the inventory parser is touched:**

```js
// node script in repo root
const fs = require('fs')
const xml = fs.readFileSync('/path/to/save', 'utf8')
const ent = require('./public/data/entities.json')
const ids = new Set(ent.items.filter(i => i.gameId).map(i => String(i.gameId)))

// (xsi:type → prefix mapping mirrored from SaveFileParser.XSI_TYPE_TO_PREFIX)
// ... walk every <Item> in the save, qualify its id, check against ids
// ... print unmatched
```

A clean save should have 0 unmatched. Any mismatch is either a parser-side namespace bug or a pipeline-side merge collision.

**Known mismatch patterns and their resolutions (2026-05-14):**

| Mismatch | Cause | Fix |
|---|---|---|
| `(O)15` "Preserves Jar" missing | Save serializes Big Craftables as `xsi:type="Object"` with `<bigCraftable>true</bigCraftable>`. Our entities have them under `(BC)`. | `extractItemRecord` checks `<bigCraftable>` and overrides prefix to `(BC)`. |
| `(T)SteelPan`, `(T)Pan` etc. missing | Pans appear in both `Tools.json` (canonical) and `Hats.json` (because they're worn visually). The Hat-source entity and Tool-source entity collided on kebab-id `steel-pan` during the merge step, dropping the Tool form. | Variant rules in `item-variants.json` give the Tool form distinct unique ids (`steel-pan-tool`, etc.). Tool processing must call `getUniqueItemId(gameId, name)` rather than `toKebabCase(name)` directly to read the variant. |
| `Clothing` items unprefixed | Save's `xsi:type="Clothing"` is ambiguous between shirt and pants. | `clothingPrefix()` reads `<clothesType>` ("SHIRT"→`(S)`, "PANTS"→`(P)`). |

**Pattern to watch for:** if our entities have `type: 'X'` but `gameId` in some other namespace's prefix (e.g. `type: 'tool'` but `(H)foo`), that's a merge collision. Run the survey script:

```js
const expected = { weapon: '(W)', boot: '(B)', ring: '(O)', tool: '(T)', furniture: '(F)', 'big-craftable': '(BC)' }
for (const e of items) {
  const exp = expected[e.type]
  const m = String(e.gameId||'').match(/^(\([A-Z]+\))/)
  if (exp && m && m[1] !== exp) console.log('mismatch:', e.gameId, e.type, e.name)
}
```

As of 2026-05-14, after fixes: 4 Pan-as-Hat mismatches remain (the Hat forms exist alongside the Tool forms — they're the cosmetic representation, not a bug); 7 furniture/(BC) mismatches remain in Seasonal Decor / Seasonal Plant variants (similar Hat↔BC collision pattern, lower priority).

## Discoveries log

Append-only. Date | discovery | how we found it | what we changed.

- **2026-05-14** — Cross-checked the user's save inventory against `entities.json`. Initial run: 2 distinct unmatched IDs out of 300 items. Both were pipeline bugs: (1) Big Craftables in inventory serialize as `xsi:type="Object"` + `<bigCraftable>true</bigCraftable>` — fixed in parser; (2) Pans were merged out of existence under their Tool namespace, surviving only as Hat-namespace entities — fixed via variant rules + tool processing using `getUniqueItemId`. After fixes: 0 unmatched. **The cross-check methodology is documented in "Save↔entity ID alignment" — re-run when touching the inventory parser.**

- **2026-05-14** — Player inventory and chest contents are extractable from the main save. Player items live in `<player><items>` plus equipped slots `<hat>` `<shirtItem>` `<pantsItem>` `<boots>` `<leftRing>` `<rightRing>`. Chests are `<Object xsi:type="Chest">` inside each location's `<objects>` collection, each carrying their own `<items>` sub-element. **Implementation:** `extractPlayerInventory` + `extractChestContents` in SaveFileParser.js produce a flat record list; `buildInventoryAggregate` rolls them up into `{ items: [...], byGameId: { [gameId]: { totalCount, locations } } }`. **xsi:type → namespace prefix mapping** is hand-curated in `XSI_TYPE_TO_PREFIX` (Object/ColoredObject/Ring → `(O)`, MeleeWeapon/Slingshot → `(W)`, Boots → `(B)`, Hat → `(H)`, Furniture variants → `(F)`, Tools → `(T)`). Surfaced via `useProgress.isOwned/getOwnedCount/getOwnedLocations`.
  - **Clothing** uses xsi:type "Clothing" for both shirts and pants — disambiguated by reading `<clothesType>` ("SHIRT" → `(S)`, "PANTS" → `(P)`). Handled separately in `clothingPrefix()`.
  - **Mini-Fridges and Mini-Shipping Bins** are also `xsi:type="Chest"` — they share the chest path. Distinguished by their `<name>` field, which the parser stores as `container` so the modal can render `Mini-Fridge (FarmHouse)` etc.
  - **Building-attached chests** (Junimo Hut output, Mill, Stable storage in 1.6) live inside `<Building><buildingChests><Chest>` elements, NOT in the location's `<objects>` collection. Walked via the second pass in `extractChestContents`. Container label uses the building's `<buildingType>` since these chests don't have meaningful names.

- **2026-05-14** — Secret notes 13, 15, 16, 17, 18 give deterministic item rewards (Pearl, Treasure Chest, both Strange Dolls, Junimo Plush). The dig-spot logic is hardcoded in `GameLocation.digUpArtifactSpot()`. **Fix:** `data/rules/secret-note-rewards.json` + `secretNoteSourcesByGameId` map. Renderer shows them as "Secret Note #N" labels in the Museum source list. NOTE: Junimo Plush wired in the rule file but doesn't appear because furniture processing skips `buildAcquisitionSources` — see Known Gaps.
- **2026-05-14** — `Objects.json > ArtifactSpotChances{}` is a generic per-object alternative to `Locations.json > ArtifactSpots[]`. 33 items use it (most artifacts). Pipeline was reading the per-location field but not the per-object one, leaving Strange Doll/Chicken Statue/Dinosaur Egg with no tilling sources. Found by user pushing back on the assumption that panning was the only possible source for the Strange Dolls. **Fix:** added second pass in `ProcessGameData.cjs` reading `obj.ArtifactSpotChances`.

- **2026-05-14** — Fishing chest contents are hardcoded in `GameLocation.getFishingTreasure()` (not data-driven). Wiki has the canonical list. **Fix:** `data/rules/fishing-chest-drops.json` + `fishingChestSourcesByGameId` map.

- **2026-05-14** — Bone Node rare artifact drops (Skeletal Tail, Trilobite, etc., 0.8% each) are hardcoded. Wiki lists 11 prehistoric/skeletal/fossil artifacts that drop. **Fix:** added to `breakables.json > fossil-node > drops`.

- **2026-05-14** — `museumDonatable` was being gated on `entity.type === 'artifact' || entity.type === 'mineral'`. Dinosaur Egg (type=`animal-product`) was missed; Chicken Statue (entity didn't exist as an Object due to id collision) was missed. **Fix:** derive `museumDonatable` from raw `Objects.json > Type === 'Arch' || Type === 'Minerals'`.

- **2026-05-14** — Strange Doll variants `(O)126` and `(O)127` shared kebab-id `strange-doll`. The cross-collection merge at `mergedEntitiesById` keyed on `entity.id` and silently merged them, dropping one. **Fix:** added variant rules in `data/rules/item-variants.json` giving each a unique id and dedicated icon filename. Same fix applied to Chicken Statue `(O)113` (was colliding with `(BC)31`).

- **2026-05-13** — Save parser was looking for `<museumPieces>` at the document root; in 1.6 it's inside the `ArchaeologyHouse` GameLocation. Also, values shifted from `<int>` to `<string>` in 1.6. **Fix:** walk `<locations>` to find ArchaeologyHouse, accept both value formats.

## Audit-suspicious entity types as of 2026-05-14

From the coverage audit run today. Each is worth investigating during the data-model refactor:

- `tree-fruit` — 88% empty (7/8). Should derive from `FruitTrees.json`.
- `big-craftable` — 68% empty (84/123). Should derive from `CraftingRecipes.json` (verify the existing crafting extraction handles `(BC)` outputs).
- `tool` — 67% empty (24/36). Tools come from upgrades (`Tools.json > UpgradeFrom`/`ConventionalUpgradeFrom`). New `upgrade` source type would help.
- `book` — 50% empty. Skill books from fishing chests (now covered after today's fix); lore books from quests/Gunther.
- `boot` — 50% empty. Mix of fishing chests, monster drops, quests. Some now covered.
- `ring` — 39% empty. Crafted (combined ring), monster drops, shops.
- `trinket` — 100% empty (8/8). 1.6 trinkets, dropped by Skull Cavern monsters.
- `metal-bar` — 50% empty. Comes from furnace via `data/rules/smelting-recipes.json` — verify it's wired as a source.
- `misc` — 31% empty. Heterogeneous; case-by-case.

## Audit-suspicious entity types as of 2026-05-23 (updated after BC fix)

Full re-run after the 2026-05-23 BC crafting-source bug fix. Updated numbers:

- `big-craftable` — **was 68% empty (84/123); now ~15% empty after fix** (BC crafting lookup used wrong key — see Discoveries log 2026-05-23).
- `trinket` — **100% empty (8/8)**. Trinket drops are hardcoded in C# (`MeleeWeapon.cs` / `SlingshotProjectile.cs`). No data file. Would require a `data/rules/trinket-drops.json` hand-curated rules file (same pattern as `breakables.json`). Wiki has the canonical monster-to-trinket mapping.
- `tool` — **67% empty (24/36)**. Tool upgrades flow through Clint's shop via the `TOOL_UPGRADES` special token in `Shops.json`. This is a single shop entry expanding to all tool upgrades, not parseable per-item from current exports. Would require either (a) expanding the TOOL_UPGRADES token during shop parsing, or (b) a `data/rules/tool-upgrades.json` mapping tool → upgrade cost/source.
- `tree-fruit` — **7/8 empty**. Fruit tree fruits have no `sources[]` — they should derive `{ type: 'fruit-tree', treeId }` from `FruitTrees.json`. The data is available; the pipeline just doesn't wire it up.
- `metal-bar` — **by design**: metal bars intentionally use `producedBy` (pointing at the furnace entity) rather than `sources[]`. The copper/iron bars incidentally have quest sources from Quests.json. This is a data model divergence — `producedBy` was used before `sources[]` was the standard. Either migrate bars to `sources[]` or treat `producedBy` as an alias during display.
- `tree` — **expected empty**. Tree entities represent world objects (Oak, Maple, Pine, etc.), not obtainable items. `sources[]` doesn't apply; they're encountered in the world, not collected.
- `calico-egg` — 0 sources. Calico Eggs are a barter currency used during Stardew Valley Fair, not obtained through a standard source. By design.

- **2026-05-23** — Comprehensive sources audit run across all 2493 obtainable-item-type entities. Confirmed: `crafting` source type in `buildAcquisitionSources` was being called for big-craftables, but the lookup key was wrong — see bug below.

- **2026-05-23** — **BC crafting source bug**: `craftingSourcesByGameId` is keyed on qualified IDs like `"(BC)9"` (set during the CraftingRecipes parsing pass via `normalizeItemId()`). But the big-craftable processing loop called `buildAcquisitionSources(id)` where `id` was the bare integer parsed by `parseGameId(rawId)` (e.g. `9`). The map lookup used the bare integer, which never matched a key in the `(BC)9`-keyed map. Result: ~62 big-craftables (Keg, Bee House, Chest, Cask, Furnace, etc.) had no crafting source even though their recipes exist. **Fix (2026-05-23):** changed the lookup in the big-craftable processing block to use `qualifiedBCId` (e.g. `"(BC)9"`) instead of the bare `id`. Verified by running `node scripts/ProcessGameData.cjs` — pipeline completed successfully and big-craftable sources populated correctly. Location in `ProcessGameData.cjs`: big-craftable processing block, `buildAcquisitionSources` call site (~line 3002 before fix).

# Data Model Audit (Phase 1 Findings)

**Date:** 2026-05-14
**Status:** Complete. Feeds Phase 2 (source row normalization) and Phase 3 (capabilities derivation).
**Scope:** Every `entity.type` / `entityType` check and every `source.type` consumer in `src/`.

---

## Summary metrics

| Metric | Count |
|---|---|
| `entity.type === / !== ` checks | **152** |
| `entityType === / !== ` checks (UniversalModal-derived) | **33** |
| `source.type === ` checks | **66** (subset of the 152) |
| Distinct files touching `.type` | **16** |
| Distinct source-row shapes in `entities.json` | **84** (after dedup of 5,500+ rows) |
| Source-id field names in use | **8** (`id`, `monsterId`, `breakableId`, `geodeGameId`, `locationId`, `treeId`, `seedId`, `inputId`, `fishId`) |
| Source rows with `type: undefined` | **69** (real bug — investigate in Phase 5) |

---

## Categorization

Every type check classified as one of:

- 🟢 **Presentational** — drives layout/routing/icon. Type IS the right question. Keep.
- 🔵 **Capability** — really asking "can this entity do X?" Should become `hasCapability(entity, X)`.
- 🟡 **Join** — looking up related entities by type. Often the right answer is "filter by capability or by inverse relationship."
- 🔴 **Source-row shape** — depends on which source `type` the row carries. Resolved by Phase 2 normalization.

### 🟢 Presentational — keep as-is (~25 occurrences)

These ask "what kind of thing is this for layout purposes?" Type is the right discriminator.

| File:line | Check | Reasoning |
|---|---|---|
| `EntityContext.jsx:72-101` | The big `byType` map for routing pages | Pages route by type; this is the canonical mapping |
| `UniversalModal.jsx:148-152` | `entityType` derivation (festival, location, villager...) | Drives modal layout choice |
| `UniversalModal.jsx:332-1918` | Section-rendering blocks (`entityType === 'breakable'`, `'monster'`, `'festival'`, etc.) | Each section has a layout that only makes sense for that taxonomy |
| `BundleRequirementsSection.jsx:8` | `entityType !== 'bundle'` early return | Component is bundle-specific |
| `BundleRewardSection.jsx:5` | `entityType !== 'bundle' && entityType !== 'museum-reward'` | Same — render guard |
| `FishingInfoSection.jsx:7` | `entity.type !== 'fish'` early return | Section is fish-specific |
| `SeedProducesSection.jsx:7` | `entity.type !== 'seed'` early return | Section is seed-specific |
| `MachineOutputsSection.jsx:22` | `entity.type === 'animal'` branch | Animal section is a different rendering path |
| `useData.js:34-115` | `TYPE_MAP` for page-type → entity-type lookup | Routing infrastructure |

### 🔵 Capability — replace with capability check (~30 occurrences)

These bug-fertile checks should ask about *what the entity can do*, not what its type label is. Each is a candidate for the Phase 3 capabilities pass.

| File:line | Current check | Proposed capability | Notes |
|---|---|---|---|
| `UniversalModal.jsx:311` | `entityType !== 'bundle' && !== 'location' && !== 'machine' && !== 'festival' && displayEntity.type !== 'furniture' && entityType !== 'weapon' && entityType !== 'boot' && entityType !== 'trinket' && entityType !== 'tool' && entityType !== 'building' && (price \|\| prices)` | `hasSellingPrice(entity)` | Currently a 10-clause negation listing entity types that DON'T have sell prices. Inverted as a capability: massive readability win. |
| `UniversalModal.jsx:1721` | `entityType === 'weapon' \|\| 'boot' \|\| 'trinket' \|\| 'tool'` (`isEquipment`) | `isEquippable(entity)` | Already a derived constant; just give it a name |
| `UniversalModal.jsx:67` | `item.type === 'location'` (skip in collect) | `isLocation` (or special-case in pipeline output, not consumer) | Filtering noise from a join |
| `UniversalModal.jsx:86` | `item.type === 'monster'` (filter for location modal) | Same, presentational fence |
| `EntityContext.jsx:74` | `entity.sources?.some(s => s.type === 'seed')` | `isCrop(entity)` | Already deriving from sources rather than type — good; formalize as capability |
| `EntityContext.jsx:81` | `entity.type === 'seed' \|\| entity.id === 'coffee-bean'` | `isSeed(entity)` | The `coffee-bean` carve-out is a smoking gun for capability needed |
| `EntityContext.jsx:86` | `entity.type === 'clothing' && entity.subtype === 'hat'` | `isHat(entity)` | Multi-criteria typing disguised as type+subtype |
| `MuseumPage.jsx:14-18` | `entity.type === 'mineral' && entity.subtype === 'gem'` etc. | `museumCategory(entity)` returning `'gem' \| 'crystal' \| 'geode' \| 'artifact'` | Page-specific bucketing, but right concept for a "museum" capability namespace |
| `LocationAvailabilitySection.jsx:91-92` | Type-based greenhouse/island flags using `['crop', 'tree-fruit', 'fruit-tree-sapling'].includes(entity.type) \|\| (entity.type === 'tree' && entity.subtype === 'fruit-tree')` | `growsInGreenhouse(entity)`, `growsOnGingerIsland(entity)` | Classic capability clusters |
| `UniversalModal.jsx:1611, 1637, 1658` | `s.type === 'breakable-drop' && s.breakableId === X` patterns | Phase 2 normalization makes these `s.entityId === X` |
| `UseProgress.js:144` | `switch (entity.type) { case 'bundle': ... case 'artifact': ... case 'mineral': ... }` for completion markers | `getCompletionStatus(entity)` driven by capabilities (e.g. `donatable` → check museumPieces) | Already partially refactored away from this in earlier turn but reverted |
| `RecipeEntryList.jsx:29` | `ingEntity?.type === 'tag'` | `isTag(entity)` | Trivial alias, but normalizes the question |
| `UniversalModal.jsx:1411, 1485` | `a.type === 'animal' && a.harvestTool === ...` and `a.validBuildingGameIds?.includes(...)` | `isAnimal(entity)` is fine; the deeper join is the right shape |

### 🟡 Join — review during Phase 4 (~15 occurrences)

These cases iterate `allItems` and filter by type to find related entities. The pattern itself is fine; the question is whether the relationship should be precomputed instead of recomputed every render.

| File:line | Current check | Suggested action |
|---|---|---|
| `UniversalModal.jsx:1611, 1637, 1658, 1671, 1714, 1256, 1259` | `items.filter(i => i.sources?.some(s => s.type === 'X' && s.fooId === currentId))` | These compute the inverse relationship at render time. Phase 2 normalization helps (uniform `s.entityId`), and Phase 4 may want precomputed inverse arrays on the related entity (e.g. `monster.drops`, `breakable.drops`, `geode.drops`) so consumers can read instead of scan. |
| `UniversalModal.jsx:1214` | `allItems.filter(i => i.type === 'location' && i.operator === displayEntity.id)` | `villager.runsLocations` precomputed |
| `UniversalModal.jsx:1269` | `allItems.filter(i => i.type === 'quest' && i.targetNpc?.toLowerCase() === displayEntity.name?.toLowerCase())` | `villager.quests` precomputed |
| `UniversalModal.jsx:1411` | `allItems.filter(a => a.type === 'animal' && a.harvestTool === displayEntity.id)` | `tool.harvestedAnimals` precomputed |
| `UniversalModal.jsx:1485` | `allItems.some(a => a.type === 'animal' && a.validBuildingGameIds?.includes(...))` | `building.compatibleAnimals` precomputed |
| `TreeConnectionsSection.jsx:155, 176` | `i.type === 'tree' && (i.saplingId === entity.id \|\| i.seedId === entity.id)` | `seed.producesTree`, `sapling.producesTree`, `treeFruit.fromTree` precomputed |

Each precomputed inverse moves work from per-render to once-at-build. Unblocks future feature pages (e.g. "all items obtainable from this monster") cheaply.

### 🔴 Source-row shape — resolved by Phase 2 (~50 occurrences)

Every `source.type` switch and every reach for a source-id field falls in this bucket. The proposed normalized shape (`{ type, entityId, entityGameId, qualifiers }`) means consumers stop needing the switch.

The 8 distinct source-id field names today:

| Source `type` | Current id field(s) | Phase 2 → `entityId` resolves to |
|---|---|---|
| `monster-drop` | `monsterId` | the monster entity |
| `breakable-drop` | `breakableId` | the breakable entity |
| `geode` | `geodeGameId` (gameId, not friendly id) | the geode entity (resolved via `findByGameId`) |
| `tilling` | `locationId` | the location entity |
| `forage` | `locationId` | the location entity |
| `garbage-can` | `locationId` | the location entity |
| `shop` | `id` | the shop/location entity |
| `fish-pond` | `fishId` | the fish entity |
| `tapper` | `treeId` | the tree entity |
| `animal` | `id` | the animal entity |
| `machine` | `id`, `inputId` | the machine entity (and input ingredient) |
| `seed` | `seedId`, `seedGameId` | the seed entity |
| `crafting` / `cooking` | (no entity id; recipe is an inline concept) | leave as-is, `entityId: null` |
| `mail` | `mailKey` (string, not entity) | leave as-is, `entityId: null` |
| `fishing-chest` | (no entity id) | leave as-is, `entityId: null`, render as label |
| `quest-requirement` | `questId` | the quest entity (but not a true acquisition source — consider removing) |
| `museum-reward` | (the reward is the entity itself) | inverse on the museum reward |
| `reward` | `id`, `rewardSource` | the rewarding entity |
| `location` | `locationId` | the location entity |

**The rich `qualifiers` payload** (chance, condition, seasons, price, days, stock, tradeItem*, processingTimeMinutes, etc.) is preserved; consumers move from `s.chance` to `s.qualifiers.chance`. Type-specific fields stay type-specific; only the "what entity does this point to" question is normalized.

---

## Specific findings worth calling out

1. **The `coffee-bean` carve-out** in `EntityContext.jsx:81` (`entity.type === 'seed' \|\| entity.id === 'coffee-bean'`) is the single most concrete proof that type is too narrow. Coffee beans are *both* seeds and harvested products; the type system can't express "both." Capabilities can.

2. **The 10-clause negation at `UniversalModal.jsx:311`** for "should we show selling price?" is an extreme symptom. `hasSellingPrice` capability would replace it with a single positive question.

3. **`UseProgress.js:144` switch on entity type for completion markers** was already refactored once during the markers experiment, then reverted. The capability layer makes this trivially correct: each completion type is its own capability + lookup pair.

4. **Render-time inverse joins in `UniversalModal`** (filtering `allItems` to find drops on monsters, breakables, geodes, etc.) are O(n) per render and run on every modal open. Precomputing these inverses during Phase 4 would be a measurable perf improvement on top of the cleanup win.

5. **69 source rows have `type: undefined`** — these slipped past every type-switch consumer, which is why nothing crashed. Identifying their origin is a small Phase 5 task.

6. **Shop rows have 30+ shape variants.** Every combination of `condition`, `days`, `seasons`, `tradeItem*`, `shopCurrency*`, `stock`, `stockLimit`, `quantity`, `yearUnlock`, etc. The diversity is real (shops genuinely have all those features), but a single normalized shape with optional fields would reduce consumer fragility from 30 cases to 1 schema.

7. **Source `type: 'fish'` vs entity `type: 'fish'`** share the namespace and mean different things (mechanism vs taxonomy). Phase 2 doesn't fix this (rename source types to be unambiguous? `catch-fishing-rod`? out of scope), but it's worth flagging.

---

## Proposed capability vocabulary (draft for Phase 3)

Based on the audit, the capabilities to derive look like:

**Acquisition / sourcing capabilities** (derived from `sources[]`):
- `obtainableFromGeode` (has `geode` source)
- `obtainableFromMonsters` (has `monster-drop` source)
- `obtainableFromBreakables` (has `breakable-drop` source)
- `obtainableFromTilling` (has `tilling` source)
- `obtainableFromFishingChest` (has `fishing-chest` source)
- `obtainableFromShop` (has `shop` source)
- `obtainableFromForage` (has `forage` source)

**Use capabilities** (derived from raw flags or recipe references):
- `donatable` (raw `Type === 'Arch' \|\| 'Minerals'`) — already added 2026-05-14
- `giftable` (raw `CanBeGivenAsGift`)
- `cookable` (used as cooking ingredient OR is a cooking output)
- `craftable` (is a crafting output)
- `shippable` (in `basicShipped` tracking — derive from raw `ExcludeFromShippingCollection`)
- `edible` (raw `Edibility > -300`)
- `equippable` (is `weapon \| boot \| ring \| trinket \| tool \| clothing`)
- `ageable` (has aging rule in `aging-rules.json`)
- `stackable` (raw `Stackable`)
- `tradeable` (appears as shop trade-in target somewhere)

**Game-flag capabilities** (mirror raw fields the pipeline currently drops):
- `excludeFromFishing` / `includeInFishingCollection`
- `excludeFromRandomSale`
- `canBeTrashed` (raw `CanBeTrashed`)
- `canBeLostOnDeath` (raw)

**Pricing capabilities**:
- `hasSellingPrice` (replaces the 10-clause negation)
- `hasMultipleQualityPrices` (i.e. `prices` field is a map)

**Progress-tracking capabilities** (drives `UseProgress`):
- `trackable.caught` (catchable fish)
- `trackable.shipped`
- `trackable.donated`
- `trackable.cooked` (recipe known)
- `trackable.crafted` (recipe known)
- `trackable.bundleSlot` (used in a bundle)

This is a draft — Phase 3 finalizes the vocabulary based on actual replacement needs found in Phase 4.

---

## Recommended Phase 2 sequencing

1. Define the canonical source-row shape (the converter) in code; write a single transform pass at the end of `ProcessGameData.cjs`.
2. Verify by running the pipeline + the existing site — keep the old fields under `qualifiers` for back-compat, so consumers continue to work without changes.
3. Migrate `MuseumPage.jsx` first (smallest consumer, most direct payoff — its `sourceEntityId` switch goes away).
4. Migrate `LocationAvailabilitySection.jsx` next (largest consumer; its 25+ source-type filters become a single grouping helper).
5. Migrate `UniversalModal.jsx` inverse-lookup blocks — these benefit from both the normalized id field AND the precomputed inverses (Phase 4 dependency).
6. Drop the old fields from `entities.json` once nothing reads them.

---

## What this audit does NOT do

- Doesn't write any code
- Doesn't make architecture decisions (those go in `DATA_MODEL_REFACTOR_PLAN.md` decision log)
- Doesn't fix individual bugs (the 69 undefined-typed rows, shop variance, etc.) — those are separate Phase 5 items
- Doesn't enumerate every line — focuses on patterns. Specific occurrences are findable by re-running the audit greps.

## Audit blind spots (and how to compensate)

A bottom-up audit only catches what it knows to look for. Documented here so the gaps are visible:

- **Audits enumerate; they don't evaluate.** An item with a `sources[]` array of length 7 looks "covered" to a coverage audit, even when those 7 entries are a misleading lottery and the real source is a deterministic puzzle the audit never thought to look for. Both Strange Doll variants were such a case (their tilling sources are real but ~0.001% chance per location, while the deterministic Secret Note path is 100%).
- **Audits don't see silent omissions in the pipeline.** Furniture entities skip `buildAcquisitionSources` entirely — the audit, which reads only `entities.json` output, can't see that the rule files never reach them. This kind of gap surfaces only when a curated rule "should" land on an entity and doesn't.
- **Audits assume their own pattern set is complete.** The grep for "type === X" found 152 cases. It would have missed type checks expressed as `[X, Y].includes(t)` if I hadn't manually broadened the pattern. Each new pattern must be added explicitly.

**Compensation strategy:** treat top-down observations from the user as a different signal class than audits, not a redundant one. When a user observation exposes a gap an audit missed:

1. Fix the specific case AND ask "what general pattern does this expose?"
2. Record the discovery in `PIPELINE_NOTES.md` discoveries log AND, if it exposes a structural gap, in "Known un-fixed pipeline gaps"
3. Add the new pattern to the audit's check list and re-run with the broader lens
4. Distinguish "fixed the symptom" from "generalized the lesson" — the latter is the actual completion bar

## Audit re-run command

For regression checks during Phases 2–5, re-run:

```bash
grep -rn "\.type ===\|\.type !==\|entityType ===\|entityType !==" src --include="*.jsx" --include="*.js" 2>/dev/null | wc -l
```

The number should drop steadily as capability checks replace type checks.

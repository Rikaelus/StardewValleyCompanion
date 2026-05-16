# Entity Capabilities Vocabulary (Phase 3)

Every entity in `entities.json` now carries a `capabilities` object — a flat namespace of boolean flags describing what the entity *can do*. Replaces scattered `entity.type === X` checks with `entity.capabilities.X` reads.

**Derived in:** `scripts/ProcessGameData.cjs`, "Deriving capabilities (Phase 3)" pass.
**Vocabulary owner:** this file. Add entries here when extending the pass.

## Why capabilities, not type

Type is the right answer for *presentational* questions ("what page does this go on?", "what modal layout?"). It's the wrong answer for *behavioral* questions ("can this be donated?", "does this have a sell price?"). Type is a single slot; behaviors are many. Coffee Bean is both a seed and a harvested product — type can express only one. Dinosaur Egg is an animal product, an artifact, a museum donation, a tailoring ingredient, and a hatchable item — type, again, expresses only one.

The capabilities namespace gives each behavior its own dedicated flag, sourced from raw data + sources presence. See `docs/DATA_MODEL_REFACTOR_PLAN.md` Phase 3 for the broader rationale.

## The vocabulary

### Acquisition — "this item can be obtained via …"

Derived from presence of source-row types in the entity's `sources[]`.

| Capability | Truthy when |
|---|---|
| `obtainableFromGeode` | A `geode` source exists (geode, frozen geode, magma geode, omni geode, artifact trove) |
| `obtainableFromMonsters` | A `monster-drop` source exists |
| `obtainableFromBreakables` | A `breakable-drop` source exists (mining/forage nodes) |
| `obtainableFromTilling` | A `tilling` source exists (artifact spots in any location) |
| `obtainableFromFishing` | A `fish` source exists (catchable with a fishing rod) |
| `obtainableFromFishingChest` | A `fishing-chest` source exists (treasure chest while fishing) |
| `obtainableFromForage` | A `forage` source exists (spawned forageable item in a location) |
| `obtainableFromShop` | A `shop` source exists |
| `obtainableFromMail` | A `mail` source exists |
| `obtainableFromGarbage` | A `garbage-can` source exists |
| `obtainableFromAnimal` | An `animal`, `hatch`, or `pregnancy` source exists (animal product, egg hatching, livestock breeding) |
| `obtainableFromTapping` | A `tapper` source exists (tree tapping) |
| `obtainableFromQuest` | A `quest-requirement` or `reward` source exists |
| `obtainableFromSecretNote` | A `secret-note-reward` source exists (Notes 13/15/16/17/18) |
| `obtainableFromMachine` | A `machine` source exists (Keg, Preserves Jar, etc. produce this item) |
| `obtainableFromSeed` | A `seed` source exists (planting a seed produces this) |

### Recipe outputs — "the player can make this via …"

Derived from entity type + recipe references.

| Capability | Truthy when |
|---|---|
| `cookable` | Entity is `type: 'food'` OR has a `cooking` source |
| `craftable` | Entity is `type: 'crafted'` OR has a `crafting` source |
| `tailorable` | Entity is referenced as the output of a tailoring recipe (extracted from recipeId suffix `(S)X`/`(P)X`/`(H)X`/`(B)X`) |

### Recipe inputs — "this item is used as an ingredient in …"

Derived from `usedInRecipes` arrays on each entity.

| Capability | Truthy when |
|---|---|
| `usableInCooking` | Listed as a cooking-recipe ingredient |
| `usableInCrafting` | Listed as a crafting-recipe ingredient |
| `usableInTailoring` | Listed as a tailoring-recipe ingredient |

### Use capabilities

| Capability | Truthy when |
|---|---|
| `donatable` | `museumDonatable` flag set (raw `Type: "Arch" \|\| "Minerals"`) |
| `giftable` | Raw `CanBeGivenAsGift` flag, OR appears as an item in any villager-gift relationship |
| `edible` | Raw `Edibility > -300` |
| `equippable` | Entity type is one of weapon/boot/ring/trinket/tool/clothing/hat |
| `bundleSlot` | Listed as a required item in any bundle |
| `hasSellingPrice` | Has a `price > 0` (or `prices` map) AND type isn't in the never-sellable list (bundles, locations, tools, weapons, etc.) |
| `hasQualityTiers` | `qualityTiers` array has more than one tier |
| `isHat` | `type === 'clothing' && subtype === 'hat'` (Stardew quirk: hats live in the clothing namespace) |

## Conventions

- **Naming**: `obtainableFrom*` for sourcing, `usableIn*` for ingredient roles, `<adjective>` (`donatable`, `giftable`, `edible`) for use capabilities.
- **All flags are booleans**: no tri-state, no enums. If a "yes/no/conditional" answer is needed, lift the conditional to a separate flag.
- **Don't use capabilities for taxonomic questions.** "Is this a fish?" stays as `entity.type === 'fish'`. Capabilities are for "can this fish be donated", not "is this a fish."
- **Add cautiously.** Each new capability should replace at least one `entity.type === X` check that's actually capability-flavored, per the Phase 1 audit. New flags without consumers create maintenance burden.

## Known imprecisions / improvements deferred

- **Tailoring linkage** is heuristic. Tailoring recipes encode the output gameId in the recipeId suffix; we extract via regex. If the recipe naming convention ever changes upstream, this breaks silently. A proper output-mapping pass during recipe processing would be more robust.
- **`giftable` over-fires** for entities that show up in `relationships` even though the game wouldn't let the player gift them (most normal items do let you, so the false positives are rare).
- **`obtainableFromAnimal` conflates** three mechanisms (animal produce, egg hatching, breeding/pregnancy). Splitting would be straightforward if a consumer needs the distinction.
- **`cookable`/`craftable`/`tailorable`** for items that are *also* obtainable other ways (e.g. Wine: machine + tailorable) correctly fires both flags; consumers should treat capabilities as additive, not exclusive.

## Audit hook

Re-run after each capability change to catch unintended fire patterns:

```js
const d = require('./public/data/entities.json')
for (const cap of Object.keys(d.items[0].capabilities)) {
  const count = d.items.filter(i => i.capabilities?.[cap]).length
  console.log(cap, count)
}
```

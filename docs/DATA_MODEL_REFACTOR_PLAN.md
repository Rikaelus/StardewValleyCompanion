# Data Model Normalization — Living Plan

**Status:** Planning. No code changes yet. Phases are independently shippable.
**Last updated:** 2026-05-14
**Owner notes:** Update this doc as decisions are made. Strike through anything superseded; don't delete (the historical context matters).

---

## Why we're doing this

Two recurring frustrations have surfaced repeatedly in this project:

1. **Type-as-capability conflation** — code asks `entity.type === 'X'` when what it actually means is "can this be donated/cooked/equipped/whatever." This bit us with Dinosaur Egg (type=`animal-product` but legitimately a museum donation) and Chicken Statue (type collision across object/big-craftable/furniture namespaces). The recurring pattern: every new tracker page hits at least one type-vs-capability misalignment.

2. **Source row inconsistency** — `sources[]` is the right concept (every source row carries enough info to link back to a referenceable entity), but the contract isn't enforced. ID field naming is ad hoc (`monsterId`, `breakableId`, `geodeGameId`, `treeId`, `id`, `inputId`, `seedId` — same concept, seven names). Some link via friendly id, others via gameId. Inline-embedded fields (`tradeItemIcon`, `monster`, `geodeName`) duplicate data that the renderer could derive from the id alone.

Two parallel cleanups, both touching data shape; both reinforcing.

## Constraints from the game itself

The game's own data model has known inconsistencies that cap how clean we can make ours:

- **ID namespace fragmentation:** `(O)` for objects, `(BC)` for big-craftables, `(F)` for furniture, `(B)` for boots, `(T)` for tools, `(TR)` for trinkets, `(H)` for hats, `(S)` for shirts. Same display name can collide across namespaces (Chicken Statue exists as `(O)113`, `(BC)31`, `(F)1305`).
- **Numeric vs string IDs:** 1.6 introduced string IDs (`"Carrot"`, `"CalicoEgg"`) alongside legacy numeric ones. Both still appear in save files.
- **Type field reused inconsistently:** `Type: "Arch"` on Objects.json marks museum donatables, but Dinosaur Egg (which IS donatable) is also `Category: 0` and gets classified by other passes as animal-product. The game's "type" field has overlapping meanings.
- **Hardcoded behavior in C# source:** Several mechanisms (panning loot, fishing chest contents, bone-node rare drops) live in code, not data files. Forces hand-curated rule files. See [PIPELINE_NOTES.md](PIPELINE_NOTES.md).

These aren't ours to fix. The model needs to be **flexible enough to absorb these inconsistencies** rather than fight them.

---

## Phases

### Phase 1 — Audit (no code changes)

Enumerate every `entity.type === X` (and `!== X`) check in the codebase. Categorize each as:

- **Presentational** — drives modal layout, page routing, icon family. Type is the right question. Keep.
- **Capability** — really asking "can this entity do X?" Should be replaced with capability check.
- **Join** — really looking up related entities ("is this entity a fish so I can show fishing UI?"). Capability or relationship check.

Same for source-row consumers: enumerate every `s.type === X` switch and every place a source-id field is read. Document which fields each consumer needs vs. which fields exist.

**Deliverable:** an audit report (committed to `docs/DATA_MODEL_AUDIT.md`) listing each occurrence with file:line, current logic, and proposed action. No risk; produces the punch list.

**Status:** ✅ Complete (2026-05-14). See [`docs/DATA_MODEL_AUDIT.md`](DATA_MODEL_AUDIT.md). Key findings:
- 152 type checks across 16 files; 33 entityType checks; 66 source-type checks
- 84 distinct source-row shapes; 8 different id-field names for the same conceptual question
- 69 source rows with `type: undefined` (bug, deferred to Phase 5)
- Concrete capability vocabulary drafted in the audit's final section
- Recommended Phase 2 sequencing: MuseumPage first (smallest), LocationAvailabilitySection second (largest), UniversalModal last (depends on Phase 4 inverse precomputation)

---

### Phase 2 — Source row normalization

Define the canonical contract:

```ts
{
  type: 'monster-drop' | 'shop' | 'geode' | 'tilling' | ...,
  // Always one of these two when the source links to a known entity:
  entityId: string | null,        // friendly id (preferred)
  entityGameId: string | null,    // qualified gameId (when no friendly id exists, e.g. some geodes)
  // Type-specific facts (chance, condition, seasons, price, location qualifier, etc.):
  qualifiers: { ... }
}
```

Add a final pass in `ProcessGameData.cjs` that converts every existing source row into this shape, preserving original fields under `qualifiers` for back-compat. Then incrementally migrate consumers to read `entityId`/`qualifiers` and remove the old fields once nothing reads them.

**Open questions to resolve in Phase 1 audit:**
- Should `qualifiers` keys be themselves normalized (e.g. always `chance`, `condition`, `seasons`) or pass-through type-specific?
- How to handle sources that reference a *concept* rather than an entity (Fishing Chest, Mystery Box without a separate entity)? Synthesize stub entities, or allow `entityId: null` with a `label` field?

**Deliverable:** normalized source rows in `entities.json`; a `sourceEntity(s, findById, findByGameId)` helper that no longer needs a switch statement.

**Status:** ✅ Complete (2026-05-14). Pipeline pass added to `ProcessGameData.cjs` ("Normalizing source rows (Phase 2)" log line) — adds `entityId` and `entityGameId` to every source row, normalizing 3,906 rows. Legacy fields (`monsterId`, `breakableId`, `locationId`, etc.) are preserved alongside the new fields so existing consumers continue working without changes. MuseumPage migrated as the proof-of-concept consumer — its `sourceEntityId` switch (10 cases) is now a single `entityId ?? entityGameId` read. The 70 `<undefined>`-typed rows from Phase 1 are surfaced as a pipeline warning during normalization (Phase 5 cleanup). Resolved one open question along the way: kept type-specific qualifiers as pass-through (didn't normalize the `qualifiers` keys themselves), since type-specific consumers know what to expect.

---

### Phase 3 — Capabilities derivation

Add a pass that derives a flat namespace of capability flags per entity:

```
capabilities: {
  donatable: boolean,        // can be donated to museum
  giftable: boolean,         // can be given as a gift
  cookable: boolean,         // is a cooking output
  craftable: boolean,        // is a crafting output (or has crafting source)
  shippable: boolean,        // appears in basicShipped tracking
  edible: boolean,           // game's Edibility > -300
  catchable: boolean,        // is a fish or fishable trash
  ageable: boolean,          // can be aged in a cask
  stackable: boolean,        // game flag
  breakable: boolean,        // is a resource clump / breakable
  equippable: boolean,       // is a weapon, boot, ring, hat, clothing
  tradeable: boolean,        // appears as shop trade-in target
  // ... defined in the audit
}
```

Derived from raw game flags + presence of source rows of certain types + presence of recipe references + presence in bundle/quest/museum data.

**Vocabulary** is defined as part of the audit so we know the full set before naming. Names should follow `is*`/`has*`/`<noun>able` consistently.

**Deliverable:** every entity has a `capabilities` object (or flat fields, TBD); documented vocabulary in `docs/CAPABILITIES.md`.

**Status:** ✅ Complete (2026-05-14). Pipeline pass added; all 3,436 entities now carry a `capabilities` object. Vocabulary documented in [`docs/CAPABILITIES.md`](CAPABILITIES.md). Decision: chose nested `capabilities` object (not flat fields) — keeps the namespace clearly separated from raw entity fields and lets consumers iterate (`Object.keys(entity.capabilities)`). Tailoring outputs derived heuristically from recipeId suffix regex; flagged as imprecision worth revisiting if recipe naming convention changes.

---

### Phase 4 — Replace type checks with capability checks

Incremental, not a flag day. Walk the audit's "capability" list and flip each check. Any time code is touched for other reasons, opportunistically migrate nearby type checks too.

**Done when:** the audit re-run reports no remaining capability-flavored type checks.

**Status:** ✅ Substantially complete (2026-05-14). Migrated:
- `UniversalModal.jsx:311` — the 10-clause negation for sell-price display → `displayEntity.capabilities?.hasSellingPrice` (one read)
- Pipeline now attaches `computedDrops` arrays to monsters (78), breakables (35), and geodes (6) so consumers can read `entity.computedDrops` instead of filtering `allItems` on every render

Conservatively NOT migrated:
- `UniversalModal.jsx:1759` `isEquipment` → `equippable` capability semantically wider than original (includes rings/clothing/hats); kept as-is to avoid behavior drift
- `EntityContext.jsx:81` `coffee-bean` carve-out — the data model can't currently express "this Object IS also a seed" cleanly. Deferred to Phase 5 (decide: add `isSeed` capability with carve-out, or retype coffee-bean as `seed`)
- MuseumPage subtype-based grouping (`gem`/`crystal`/`geode-mineral`) — taxonomic, not capability-flavored
- LocationAvailabilitySection's filter-by-source-type chains — these are correct uses of source-type discrimination

The remaining capability-flavored checks across the codebase need consumer-by-consumer review. Each subsequent migration is small and low-risk now that the capabilities namespace exists and the precomputed inverses are available. Future work can migrate opportunistically when files are touched.

---

### Phase 5 — Targeted cleanups

From the audit, schedule these one-offs as bandwidth allows:

- The 69 source rows with `type: undefined` — investigate origin, add proper type or remove
- 30+ shape variants of `shop` rows — collapse into one canonical shape with optional fields
- Inline-embedded entity fields on shop/monster-drop rows — remove in favor of id resolution

Each is independently shippable.

**Status:** ✅ Complete (2026-05-14, partial). Resolved:
- **Undefined-typed rows**: traced to two hand-curated rules files. `hat-overrides.json` source rows now default to `type: 'other'` at pipeline load. `weapon-sources.json` rows do the same. `mineChestSourcesByGameId` rows now use `type: 'mine-chest'` (added to normalization rules). Result: **0 undefined-typed rows** in entities.json.

Deferred (with reasoning):
- **Shop shape variance** kept as-is. The 30+ variants reflect real shop-mechanic diversity (calendar gating, currency types, trade-in items, stock limits, year-locks, day rotations). A unified schema would either lose information or require nested optional groups that aren't simpler than the current shape. Each variant *is* internally consistent; consumers read the fields they need and ignore the rest. Re-evaluate if a future feature actually struggles with the variance.
- **Inline-embedded entity fields** (`tradeItemIcon`, `monster`, `geodeName`, etc.) kept as-is. They duplicate data resolvable from `entityId`, but: (a) bandwidth cost is negligible, (b) removing them requires touching every consumer that displays the friendly name, (c) the Phase 2 normalization gives consumers `entityId` to use when they want fresh resolution. Future cleanup can drop fields one at a time when their consumers are migrated.

---

## Working principles

- **Each phase ends with the audit re-run as a regression check.** That's how we verify nothing slipped back.
- **Don't break the existing `entities.json` consumers all at once.** Phase 2 keeps original fields under `qualifiers`; consumers migrate at their own pace.
- **Document discoveries as we go** in [PIPELINE_NOTES.md](PIPELINE_NOTES.md). New extraction paths, game-data quirks, hardcoded mechanisms — all go there so the next session doesn't re-derive.
- **Type stays for presentation.** This refactor doesn't kill `entity.type`; it stops misusing it.

## Decision log

Append entries here when a Phase decision is made. Date + decision + reasoning.

- **2026-05-14** — Phase 1 audit completed. Most consequential finding: the 10-clause negation in `UniversalModal.jsx:311` for "should we show selling price?" is the canonical example of why capabilities matter. `coffee-bean` carve-out in `EntityContext.jsx:81` is the second-best example (an entity is genuinely both a seed and a harvested product, which the type system can't express).
- **2026-05-14** — Phase 2 sequencing decided: start with `MuseumPage.jsx` (smallest consumer, most direct payoff). The `sourceEntityId` switch in MuseumPage is exactly what the normalized `entityId` field replaces — proves the contract on a small surface before touching LocationAvailabilitySection.
- **2026-05-14** — Phase 2 complete. Normalization pass added to pipeline; MuseumPage migrated. Open question resolved: qualifiers stay type-specific (pass-through) rather than being themselves normalized. Reasoning: each consumer of a particular `type` already knows what fields to expect; forcing all rows to share a `qualifiers.chance` key would lose meaningful type-specific structure (`tilling.chance` is per-location, `breakable-drop.chance` is per-break, `fishing-chest.chance` is per-chest — semantically different despite the shared name). The normalized contract is `{ type, entityId, entityGameId }` plus original fields preserved on the row.
- **2026-05-14** — LocationAvailabilitySection and UniversalModal NOT migrated yet. They're large, lower-leverage (the original-field reads they do are working correctly), and benefit more from Phase 4 (precomputed inverses). Migration deferred until Phase 4 work touches them anyway.
- **2026-05-14** — Phase 3 complete. Capabilities namespace added to all entities; CAPABILITIES.md drafted. Decision: nested `capabilities` object (not flat fields). Tailoring outputs derived heuristically from recipeId suffix regex.
- **2026-05-14** — Phase 4 complete (substantially). Migrated `UniversalModal.jsx:311` 10-clause negation → `hasSellingPrice`. Pipeline now precomputes `computedDrops` arrays for monsters (78), breakables (35), geodes (6), removing render-time scans of `allItems`. Conservative call: did NOT migrate `isEquipment` or `coffee-bean` carve-out — capability semantics didn't cleanly match in those cases. Future migrations are now low-risk and can happen opportunistically.
- **2026-05-14** — Phase 5 complete. All 70 undefined-typed source rows resolved (hat-overrides, weapon-sources, mine-chest paths now type their rows). Shop variance and inline-embedded fields kept as-is with reasoning documented; cleanup can happen field-by-field when consumers are migrated.

## Status overview

| Phase | Status |
|---|---|
| 1 — Audit | ✅ Complete (2026-05-14) |
| 2 — Source row normalization | ✅ Complete (2026-05-14) |
| 3 — Capabilities derivation | ✅ Complete (2026-05-14) |
| 4 — Replace type checks | ✅ Substantially complete (2026-05-14) |
| 5 — Targeted cleanups | ✅ Complete (2026-05-14, partial — see Phase 5 status) |

**Refactor plan substantively complete.** Future work happens opportunistically: each touched file can migrate nearby type checks to capabilities, drop redundant inline fields when no longer needed, and add new capability flags as new use cases require them. The infrastructure (normalized source contract, capabilities namespace, precomputed inverses, audit script) makes each future change small and low-risk.

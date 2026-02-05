# Stardew Valley Tracker - Architecture Documentation

## Project Overview

A web application for tracking progress in Stardew Valley. Users can view fish, bundles, and other collectibles, with plans to support save file uploads for automatic progress tracking.

## Core Architectural Decisions

### Data Architecture: Compiled Page-Specific JSON

**Decision**: Use build-time compilation to generate optimized, pre-joined JSON files for each page.

**Rationale**:
- Data is controlled by developers (not user-uploaded), so build-time processing is free
- Every data change requires a rebuild/redeploy anyway
- Users get faster page loads with fewer HTTP requests
- Components become simpler without runtime join logic
- Scales better as more data types are added

**Trade-offs**:
- Adds build complexity (mitigated: already building for deployment)
- Data duplication in compiled files (acceptable: still smaller than multiple source files)
- Need to maintain source → compiled pipeline (automated via Vite plugin)

### Dual ID Strategy

**Critical Decision**: All items must have BOTH friendly IDs and game IDs.

```json
{
  "id": "largemouth-bass",  // Friendly ID for URLs, cross-references
  "gameId": 136,             // Numeric ID from Stardew Valley save files
  "name": "Largemouth Bass"
}
```

**Why Both IDs Are Required**:

1. **Friendly IDs (`id`)**:
   - Human-readable URLs: `/fish/largemouth-bass`
   - Easy cross-referencing in source data
   - Better developer experience
   - Consistent naming across the app

2. **Game IDs (`gameId`)**:
   - Save files use numeric IDs: `<item>136</item>`
   - Required for save file upload feature
   - Authoritative reference from game data
   - Enables O(1) lookups when matching save data

**Example Save File Matching**:
```javascript
// Save file contains: <item>136</item>
const caughtFishIds = [136, 143, 698] // Extracted from save

// Use gameIdIndex for fast lookup
const fishName = fishData.gameIdIndex[136] // "largemouth-bass"

// Mark as caught
fishData.items.forEach(fish => {
  fish.caught = caughtFishIds.includes(fish.gameId)
})
```

### Directory Structure

```
/data/game-exports/        # Raw game data from SMAPI mod (gitignored)
  ├── Objects.json
  ├── Fish.json
  └── ...

/data/rules/             # Rules game mechanics (tracked in git)
  ├── price-formulas.json  # Artisan price calculations
  ├── aging-rules.json     # Cask aging times
  ├── locations.json       # Location name mappings
  └── ...

/data/processing/          # Intermediate files (gitignored)
  └── extracted-locations.json  # Debugging output from extraction scripts

/data/processed/           # Final processed data (tracked in git)
  ├── items/
  │   ├── fish.json        # All fish with gameId, bundle refs, gift refs
  │   ├── crops.json       # All crops with gameId, bundle refs
  │   └── artisan.json     # All artisan goods with recipes
  ├── collections/
  │   └── bundles.json     # Bundles with item refs
  └── reference/
      └── villagers.json   # Shared reference data

/public/data/              # Compiled page data (gitignored, generated at build)
  ├── pages/
  │   ├── fish.json        # Pre-joined: fish + bundles + villagers
  │   ├── bundles.json     # Pre-joined: bundles + full item objects
  │   └── artisan.json     # Pre-joined: artisan + bundles + gifts
  └── reference/
      └── villagers.json   # Copied from processed/

/scripts/
  ├── process-game-data.cjs     # game-exports + rules → processed
  ├── extract-fish-locations.cjs # Helper for fish location extraction
  └── compileData.cjs           # processed → public/data (runs at build)
```

### Build Process

**Flow**:
1. Developer edits files in `data/processed/`
2. Run `npm run dev` or `npm run build`
3. Vite plugin triggers `compileData.js` before build
4. Script reads source files and generates optimized page files
5. App loads pre-joined data from `public/data/pages/`

**Automation**:
- Vite plugin runs compilation automatically on every build
- No manual step required
- Compiled files are generated fresh each build

### Data Cross-Referencing Pattern

**In Source Files** (use friendly IDs):
```json
// data/processed/items/fish.json
{
  "id": "largemouth-bass",
  "gameId": 136,
  "bundles": ["river-fish"],           // Reference by bundle ID
  "gifts": { "willy": "love" }         // Reference by villager ID
}
```

**In Compiled Files** (embed full objects):
```json
// public/data/pages/fish.json
{
  "items": [{
    "id": "largemouth-bass",
    "gameId": 136,
    "bundleDetails": [{
      "id": "river-fish",
      "name": "River Fish Bundle",
      "room": "Fish Tank",
      // ... full bundle object
    }],
    "giftDetails": [{
      "villager": { "id": "willy", "name": "Willy", /* ... */ },
      "preference": "love"
    }]
  }],
  "gameIdIndex": { "136": "largemouth-bass" }  // Fast save file lookup
}
```

### Component Data Loading Pattern

**Before** (runtime joins):
```javascript
// Load multiple files, join manually
const { data } = useData(['fish.json', 'bundles.json', 'villagers.json'])
// ... complex join logic ...
```

**After** (pre-compiled):
```javascript
// Load one optimized file, render directly
const { data } = useData(['pages/fish.json'])
// Data arrives pre-joined and ready to use
```

## Future Features Enabled by This Architecture

### Save File Upload
- Parse XML save file
- Extract caught fish (numeric game IDs)
- Use `gameIdIndex` for O(1) matching
- Mark items as caught/completed
- Display progress overlay

### Multiple Item Types
- Add new source files (crops.json, artisan.json, etc.)
- Update compileData.js to include them
- Automatically compiled into relevant pages
- No component changes needed

### Complex Filters
- All related data already joined
- No need for client-side lookups
- Fast filtering across properties
- Example: "All spring fish needed for bundles"

### Recipes and Crafting
- Pre-join recipes with ingredient items
- Include where to get each ingredient
- Show which villagers gift the recipe

## Game ID Resources

Official item IDs can be found at:
- https://stardewids.com/ (1.5 item list)
- https://mateusaquino.github.io/stardewids/ (1.6 item list)
- Stardew Valley Wiki data dumps

## Development Guidelines

### Critical Principle: Data-Driven Approach

**ALWAYS prefer parsing data from game exports over hardcoding.**

When adding or modifying data:
1. **First**: Check if the data exists in game export files (`data/game-exports/`)
2. **Parse it**: Write parsing logic in `process-game-data.cjs` to extract the data
3. **Only hardcode**: Game mechanics/formulas that aren't in export files (e.g., quality multipliers, specific floor mappings)

**Examples of proper data sourcing:**
- ✅ Fish locations: Parsed from `Locations.json` spawn rules
- ✅ Artisan items: Should be parsed from `Machines.json` (1.6 data-driven system)
- ✅ Crop data: Parsed from `Crops.json` and `Objects.json`
- ❌ Don't hardcode: Individual fish, items, recipes, machine inputs/outputs
- ✅ Can hardcode: Quality price formulas (1.25x, 1.5x, 2x), aging times (if not in exports)

**Why this matters:**
- Game updates automatically reflected when re-exporting
- Mods that add items/recipes are automatically included
- Less maintenance burden
- Single source of truth (the game itself)

### Adding New Data

1. **Check game exports first** in `data/game-exports/`
2. **Add parsing logic** to `process-game-data.cjs` to extract from exports
3. **Include both IDs**: `id` (friendly) and `gameId` (numeric)
4. **Use ID references**: Don't embed full objects in source
5. **Update compileData.js**: Add compilation logic for new data type
6. **Test**: Run build and verify compiled output

### Editing Existing Data

1. **Check if data is hardcoded** - if so, consider moving to parsed approach
2. **ONLY edit** files in `data/processed/` for manual data
3. **NEVER edit** files in `public/data/` (regenerated on build)
4. **Run dev server** to trigger recompilation
5. **Verify output** in browser

### Data Validation

Each source file should validate:
- All items have both `id` and `gameId`
- IDs are unique within their type
- Cross-references use valid IDs
- gameIds match official Stardew Valley data

## Performance Targets

| Metric | Target | Warning | Action |
|--------|--------|---------|--------|
| Compiled file size | < 200KB | 200-500KB | Review data structure |
| Initial page load | < 1s | 1-2s | Optimize compilation |
| Time to interactive | < 2s | 2-3s | Code splitting |
| Build time | < 10s | 10-30s | Optimize compile script |

## Build Script Architecture

### Compilation Phases

1. **Load**: Read all source JSON files
2. **Index**: Create lookup maps (by id and gameId)
3. **Join**: Resolve cross-references
4. **Optimize**: Generate page-specific files
5. **Copy**: Copy reference data
6. **Write**: Output to `public/data/`

### Lookup Map Strategy

```javascript
// Create bidirectional maps for fast joins
const itemsById = new Map(items.map(i => [i.id, i]))
const itemsByGameId = new Map(items.map(i => [i.gameId, i]))

// Include reverse index in compiled output
const compiled = {
  items: [...],
  gameIdIndex: Object.fromEntries(
    items.map(i => [i.gameId, i.id])
  )
}
```

### Error Handling

The build script should fail loudly if:
- Source file is missing or malformed
- Cross-reference points to non-existent ID
- Duplicate IDs found
- Missing required fields (id, gameId, name)

## Data Update Workflow

### When Game Updates

1. **Re-export game data**:
   ```bash
   # Launch Stardew Valley with SMAPI
   # Load any save file
   # Data automatically exports to: Mods/DataExporter/exported/
   ```

2. **Copy exported data**:
   ```bash
   cp "/path/to/Stardew Valley/Mods/DataExporter/exported/"*.json data/game-exports/
   ```

3. **Process into source files**:
   ```bash
   node scripts/process-game-data.cjs
   ```
   This automatically:
   - Parses fish data from `Fish.json`
   - **Extracts ALL locations automatically (74/74 fish, 100%)**:
     - From `Locations.json` spawn rules (62 fish)
     - From `Fish.json` "trap" format (10 crab pot fish)
     - From `Fish.json` MinLevel field (2 mines fish)
   - Handles both numeric game IDs (136) and string IDs ("Goby")
   - **Auto-generates special case notes** for fish with location-based variations
     - Detects when same fish has different seasons by location
     - Example: "Ocean: Summer, Winter. Ginger Island: all seasons."
     - Currently generates notes for 9 fish automatically

4. **Compilation happens automatically**:
   - Run `npm run dev` or `npm run build`
   - Vite plugin runs `compileData.cjs` before build
   - Compiled files generated in `public/data/pages/`

### Location Data Extraction

**74/74 fish have FULLY AUTOMATIC location extraction:**

1. **Rod-caught fish (62)**: From `Locations.json` spawn data
   - Maps internal location IDs to friendly names (e.g., "Mountain" → "Mountain Lake")
   - Filters out interior/temp locations
   - Handles farm type variations
   - Supports string game IDs (Goby, future 1.6+ fish)

2. **Crab pot fish (10)**: From `Fish.json` "trap" format
   - Parses water type from position 4: "ocean" or "freshwater"
   - Converts to user-friendly: "Ocean (Crab Pot)" or "Freshwater (Crab Pot)"
   - Examples: Lobster, Crab, Crayfish, Snail, etc.

3. **Mines fish (7)**: From `Fish.json` MinLevel field with hardcoded mapping
   - Parses MinLevel from position 12 and maps to known floors
   - **Freshwater zones** (floors 20, 60): Ghostfish, Green Algae, White Algae
   - **Specific floors** by MinLevel: 3→20 (Stonefish), 5→60 (Ice Pip), 7→100 (Lava Eel)
   - Logic: Floor 100+ has lava, not water - freshwater fish/algae excluded from there
   - Smart filtering: Only applies to fish with no locations OR already in mines/volcano
   - Replaces generic "Mines" from Locations.json with specific floors
   - Examples: Green Algae (Floors 20, 60), Stonefish (Floor 20), Lava Eel (Floor 100 + Volcano)

**No hardcoded exceptions needed** - all patterns are parsed automatically from game data.

### Special Case Notes Generation

**Fully automatic detection and generation** (9 fish):
- Analyzes spawn rules from `Locations.json` to detect location-based variations
- Generates human-readable notes when same fish has different seasonal restrictions by location
- Examples:
  - "Ocean: Summer, Winter. Ginger Island South, Ginger Island Southeast, Ginger Island Pirate Cove, Ginger Island West: all seasons."
  - "Mountain Lake: Fall, Spring, Summer. Sewers, Mutant Bug Lair, Secret Woods: all seasons."
  - "Ocean: Fall, Winter. Night Market: all seasons."
- Implemented in `scripts/generate-special-cases.cjs`
- Integrated into `process-game-data.cjs` pipeline
- No manual curation needed

### Adding New Item Types

**Always parse from game exports first!**

1. **Identify the data source**:
   - Check `data/game-exports/` for relevant files
   - For machines/recipes: Use `Machines.json` (1.6 data-driven)
   - For items: Use `Objects.json`, `BigCraftables.json`
   - For crops: Use `Crops.json`

2. **Update process-game-data.cjs**:
   - Add parsing logic to extract from game exports
   - Avoid hardcoding item lists, recipes, or formulas that exist in exports
   - Only hardcode game mechanics not present in exports
   - Create source file in `data/processed/items/`

3. **Update compileData.cjs**:
   - Add compilation logic for new item type
   - Generate page-specific file in `public/data/pages/`

4. **Update components**:
   - Use `useData(['pages/your-new-type.json'])`

**Anti-pattern to avoid:**
```javascript
// ❌ DON'T: Hardcode item lists and recipes
const artisanRules = [
  { gameId: 348, name: 'Wine', inputType: 'fruit', ... },
  { gameId: 350, name: 'Juice', inputType: 'vegetable', ... },
  // ... 40+ hardcoded entries
]
```

**Preferred pattern:**
```javascript
// ✅ DO: Parse from game export
const machines = loadJson('Machines.json')
for (const [machineId, machineData] of Object.entries(machines)) {
  for (const rule of machineData.OutputRules) {
    // Extract recipe data from game
  }
}
```

## File Structure

```
/data/
  ├── game-exports/        # Raw exports from SMAPI mod (gitignored)
  │   ├── Objects.json
  │   ├── Fish.json
  │   └── ...
  └── source/              # Source of truth (edit these)
      ├── items/
      │   └── fish.json    # 74 fish with gameId + friendly ID
      ├── collections/
      │   └── bundles.json # 31 bundles
      └── reference/
          └── villagers.json # 34 villagers

/public/data/              # Generated at build (never edit)
  ├── pages/
  │   ├── fish.json        # Pre-joined: fish + bundles + villagers
  │   └── bundles.json     # Pre-joined: bundles + full item objects
  └── reference/
      └── villagers.json   # Copied from source

/scripts/
  ├── process-game-data.cjs      # Converts game exports → source files
  ├── extract-fish-locations.cjs # Extracts locations from Locations.json
  ├── generate-special-cases.cjs # Auto-generates special case notes
  └── compileData.cjs            # Converts source files → compiled pages
```

## Version History

- **2026-02-03**: Initial architecture established
  - Dual ID strategy defined and implemented
  - Build-time compilation approach chosen
  - Directory structure created
  - SMAPI data exporter mod created and working
  - Automatic compilation integrated into Vite build
  - Documentation written

## Related Documentation

- `/scripts/process-game-data.cjs` - Game export processing
- `/scripts/compileData.cjs` - Build-time compilation
- `/vite.config.js` - Build configuration with data plugin
- `/src/hooks/useData.js` - Data loading hook
- `/Mods/DataExporter/` - SMAPI mod for game data export (in game install)

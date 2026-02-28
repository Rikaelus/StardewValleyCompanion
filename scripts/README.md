# Data Processing Scripts

This directory contains scripts for the data pipeline that transforms raw game data into optimized application data.

## Pipeline Overview

```
Game Files (XNB)
    ↓
[SMAPI DataExporter Mod]
    ↓
Raw Game Exports (JSON)
    ↓
[ProcessGameData.cjs]
    ↓
Source Data (Structured)
    ↓
[CompileData.cjs] ← Runs automatically on build
    ↓
Compiled Page Data (Optimized)
```

## Scripts

### 1. DataExporter Mod (C#)

**Location**: `Mods/DataExporter/` (in Stardew Valley install)

**Purpose**: Exports raw game data to JSON format

**Files**:
- `DataExporter-ModEntry.cs` - Mod source code
- `DataExporter-manifest.json` - SMAPI manifest
- `build-data-exporter.sh` - Build script

**Usage**:
```bash
# Rebuild mod if you made changes
bash scripts/build-data-exporter.sh

# Then launch Stardew Valley and load a save
# Data exports to: Mods/DataExporter/exported/
```

**Exports**:
- `Objects.json` - All game objects (807 items)
- `Fish.json` - Fish-specific data (74 fish)
- `Bundles.json` - Community Center bundles
- `NPCGiftTastes.json` - Villager gift preferences
- `Crops.json`, `Weapons.json`, etc.

### 2. ProcessGameData.cjs

**Purpose**: Converts raw game exports into structured source files

**Input**: `data/game-exports/*.json`
**Output**: `data/processed/` (items, collections, reference)

**Usage**:
```bash
# After exporting game data
node scripts/ProcessGameData.cjs
```

**What it does**:
- Parses Stardew Valley's pipe-delimited data formats
- Creates friendly IDs (kebab-case) from names
- Maintains game IDs (numeric) for save file matching
- Resolves cross-references (fish ↔ bundles, fish ↔ villagers)
- Structures data for easy maintenance

**Output Files**:
- `data/processed/items/fish.json` - 74 fish with full metadata
- `data/processed/collections/bundles.json` - 31 bundles with item refs
- `data/processed/reference/villagers.json` - 34 villagers

### 3. CompileData.cjs

**Purpose**: Compiles source files into optimized page-specific JSON

**Input**: `data/processed/**/*.json`
**Output**: `public/data/pages/*.json`

**Usage**:
```bash
# Manual run
node scripts/CompileData.cjs

# Automatic (runs on every build via Vite plugin)
npm run dev
npm run build
```

**What it does**:
- Pre-joins related data (fish + bundles + villagers)
- Creates fast lookup indices (gameId → id)
- Generates metadata (compilation time, counts)
- Optimizes for page-specific needs

**Output Files**:
- `public/data/pages/fish.json` - Fish with pre-joined bundle & gift data
- `public/data/pages/bundles.json` - Bundles with full item objects
- `public/data/reference/villagers.json` - Shared villager data

## Data Flow Example

### Fish Data Transformation

**1. Raw Game Export** (`data/game-exports/Fish.json`):
```json
{
  "128": "Pufferfish/80/floater/1/36/1200 1600/summer/sunny/690 .4 685 .1/4/.3/.5/0/true"
}
```

**2. Source File** (`data/processed/items/fish.json`):
```json
{
  "id": "pufferfish",
  "gameId": 128,
  "name": "Pufferfish",
  "difficulty": 80,
  "seasons": ["summer"],
  "bundles": ["specialty-fish"],
  "gifts": { "abigail": "love" }
}
```

**3. Compiled Page** (`public/data/pages/fish.json`):
```json
{
  "items": [{
    "id": "pufferfish",
    "gameId": 128,
    "name": "Pufferfish",
    "bundleDetails": [{
      "id": "specialty-fish",
      "name": "Specialty Fish Bundle",
      "reward": "O 242 5",
      "items": [...]
    }],
    "giftDetails": [{
      "villager": {
        "id": "abigail",
        "name": "Abigail",
        "icon": "assets/villagers/Abigail.png"
      },
      "preference": "love"
    }]
  }],
  "gameIdIndex": { "128": "pufferfish", ... }
}
```

## Maintenance Tasks

### Update Game Data (After Stardew Valley Patch)

```bash
# 1. Launch game with DataExporter mod installed
# 2. Load any save file
# 3. Copy exported files
cp "/path/to/Stardew Valley/Mods/DataExporter/exported/"*.json data/game-exports/

# 4. Process into source files
node scripts/ProcessGameData.cjs

# 5. Build will auto-compile
npm run build
```

### Add New Item Type (e.g., Crops)

1. **Update ProcessGameData.cjs**:
   ```javascript
   // Add crop processing
   const crops = processCrops(gameData.crops, gameData.objects);
   writeJson('data/processed/items/crops.json', crops);
   ```

2. **Update CompileData.cjs**:
   ```javascript
   // Add crop compilation
   const compiledCrops = compileCropsPage(sourceData.crops);
   writeJson('public/data/pages/crops.json', compiledCrops);
   ```

3. **Use in component**:
   ```javascript
   const { data } = useData(['pages/crops.json']);
   ```

## Troubleshooting

### "Item not found" warnings during compilation

These are normal! Bundles contain many non-fish items (crops, artisan goods, minerals). The compiler only has fish data currently.

**Solution**: Expand `ProcessGameData.cjs` to handle more item types.

### SMAPI mod not exporting data

1. Check SMAPI console for errors
2. Verify mod is in `Mods/DataExporter/` directory
3. Ensure `DataExporter.dll` and `manifest.json` exist
4. Check SMAPI log at `ErrorLogs/SMAPI-latest.txt`

### Compilation fails during build

```bash
# Test compilation manually
node scripts/CompileData.cjs

# Check for missing source files
ls -la data/processed/items/
ls -la data/processed/collections/
ls -la data/processed/reference/
```

## Performance Notes

- **ProcessGameData.cjs**: Runs once per game update (~1-2 seconds)
- **CompileData.cjs**: Runs on every build (~300ms)
- **Compiled file sizes**: fish.json (~52KB), bundles.json (~32KB)
- **Build time impact**: Adds ~500ms to total build time

## Future Enhancements

- [ ] Add more item types (crops, artisan goods, minerals)
- [ ] Process all bundle items, not just fish
- [ ] Add fishing location data compilation
- [ ] Generate TypeScript types from compiled schemas
- [ ] Add data validation and schema checking
- [ ] Create watch mode for source file changes

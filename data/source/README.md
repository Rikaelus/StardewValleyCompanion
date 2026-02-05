# Source Data Files

This directory contains structured source data files that have been processed from raw game exports.

## What's Here

These JSON files are the "source of truth" for the application's data, organized into:

- **items/** - Game items (fish, crops, artisan goods, etc.)
- **collections/** - Game collections (bundles, etc.)
- **reference/** - Shared reference data (villagers, etc.)

## Data Flow

```
Game Exports (raw)         →  Source Files (structured)  →  Compiled Pages (optimized)
data/game-exports/*.json       data/source/**/*.json         public/data/pages/*.json
[NOT in repo]                  [IN repo - derived work]      [NOT in repo - generated]
```

## How These Are Created

1. Export game data using the DataExporter SMAPI mod
2. Run `node scripts/process-game-data.cjs`
3. Script parses raw exports and generates these structured files

## How These Are Used

At build time, `scripts/compileData.cjs` reads these files and:
- Resolves cross-references (fish → bundles, items → villagers)
- Pre-joins related data for faster loading
- Generates optimized page-specific JSON files

## Editing

These files are **generated** from game exports. Manual edits will be overwritten when re-processing game data. To modify:

1. Update the game export source, OR
2. Update the parsing logic in `scripts/process-game-data.cjs`

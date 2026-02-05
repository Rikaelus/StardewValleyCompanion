# Processed Data Files

This directory contains structured, processed data files generated from raw game exports and rules game mechanics.

## What's Here

These JSON files serve as the input for page compilation, organized into:

- **items/** - Game items (fish, crops, artisan goods, etc.)
- **collections/** - Game collections (bundles, etc.)
- **reference/** - Shared reference data (villagers, etc.)

## Data Flow

```
Game Exports + Curated Data  →  Processed Files     →  Compiled Pages
data/game-exports/*.json         data/processed/         public/data/pages/*.json
data/rules/*.json              [IN repo]               [NOT in repo]
[NOT in repo]
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

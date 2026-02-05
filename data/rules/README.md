# Game Rules and Mechanics

This directory contains **game rules and formulas** that define mechanics not present in game exports, or that need human-readable mappings.

## Purpose

These files bridge the gap between raw game exports and our processed data:

```
Game Exports (raw) + Rules (our mechanics) → Processing Scripts → Processed Files
data/game-exports/   data/rules/                scripts/*.cjs        data/processed/
```

## What Goes Here

**Rules and mechanics include:**
- Game mechanics not present in exports (price formulas, quality multipliers)
- Human-readable mappings (internal location IDs → display names)
- Hardcoded game rules (mine floor ranges, aging times)
- Item categorization (tapper products, flavored items)

**What does NOT go here:**
- Individual items, fish, crops, recipes (those come from game exports)
- User-generated content or save file data
- Compiled/generated data (that goes in `public/data/`)

## Version Control

⚠️ **These files SHOULD be tracked in git** - they represent our knowledge of game mechanics.

Unlike `data/game-exports/` (which is gitignored), these files are:
- Manually curated by developers
- Stable across game versions (mostly)
- Essential for data processing pipeline

## Sources

Game mechanics in these files come from:
- [Stardew Valley Wiki](https://stardewvalleywiki.com/)
- Game code decompilation
- Community data mining (stardewids.com)
- Manual testing and observation

## Maintenance

When game updates:
1. Re-export game data → `data/game-exports/`
2. Check if curated mechanics still apply
3. Update curated files if mechanics changed
4. Run processing pipeline: `node scripts/process-game-data.cjs`

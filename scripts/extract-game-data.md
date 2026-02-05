# Game Data Extraction Guide

Since XNB extraction tools have compatibility issues, here are alternative approaches:

## Option 1: Use Stardew Valley Wiki Data (Recommended - Fastest)

The wiki maintains complete, accurate data that's easier to access than parsing XNB files:

- Fish data: https://stardewvalleywiki.com/Fish
- Objects data: https://stardewvalleywiki.com/Objects
- Bundle data: https://stardewvalleywiki.com/Bundles

We can scrape this or use community-maintained JSON exports.

## Option 2: Create a Simple SMAPI Mod

Create a mod that dumps game data to JSON at runtime:

1. Create mod directory: `Mods/DataExporter`
2. Add manifest.json
3. Add ModEntry.cs that calls `Game1.objectInformation` and exports to JSON
4. Load game, mod runs, data exported

## Option 3: Use Community Data Repositories

Many modders have already extracted this data:
- https://github.com/StardewModders/mod-dump
- Stardew Predictor data files
- Content Patcher mod data

## Current Issue

- `xnb-extract` doesn't exist as a Python package
- `xnbcli` fails to build with Node v24 (native module incompatibility)
- StardewXnbHack downloads aren't working

## Recommendation

Let me use the manual fish ID mapping I already found from the Steam guide, which is accurate for the base game fish. We can add more IDs as needed, or use wiki data for complete coverage.

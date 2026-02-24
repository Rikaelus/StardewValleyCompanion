#!/usr/bin/env node

/**
 * Download item icons from Stardew Valley Wiki
 * All icons go into public/assets/objects/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OBJECTS_DIR = path.join(__dirname, '../public/assets/objects');
const PROCESSED_DIR = path.join(__dirname, '../data/processed/items');

fs.mkdirSync(OBJECTS_DIR, { recursive: true });

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(); });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

function getWikiImageUrl(wikiName) {
  return new Promise((resolve, reject) => {
    const url = `https://stardewvalleywiki.com/${wikiName.replace(/\s+/g, '_').replace(/'/g, '%27')}`;
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Wiki page not found: ${response.statusCode}`));
        return;
      }
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        const safeName = wikiName.replace(/\s+/g, '_').replace(/'/g, '%27');
        // Escape special regex characters in the item name before building pattern
        const escapedName = safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const imgPattern = new RegExp(`/mediawiki/images/[0-9a-f]/[0-9a-f]{2}/${escapedName}\\.png`, 'i');
        const match = data.match(imgPattern);
        if (match) {
          resolve(`https://stardewvalleywiki.com${match[0]}`);
        } else {
          reject(new Error('Image URL not found in wiki page'));
        }
      });
    }).on('error', reject);
  });
}

async function downloadIcons(label, items) {
  console.log(`\nDownloading ${label} (${items.length} items)...`);
  let success = 0, skipped = 0, failed = 0;

  for (const item of items) {
    const wikiName = item.wikiName || item.fruitName || item.name;
    const fileName = `${wikiName.replace(/'/g, '').replace(/\s+/g, '_')}.png`;
    const outputPath = path.join(OBJECTS_DIR, fileName);

    if (fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }

    try {
      const imageUrl = await getWikiImageUrl(wikiName);
      await downloadFile(imageUrl, outputPath);
      success++;
      process.stdout.write('.');
    } catch (error) {
      failed++;
      process.stdout.write('x');
      console.error(`\n  Failed: ${wikiName} — ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n  ✓ Downloaded: ${success}  ⊘ Skipped: ${skipped}${failed ? `  ✗ Failed: ${failed}` : ''}`);
}

function loadItems(file) {
  const p = path.join(PROCESSED_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('📥 Downloading icons to assets/objects/ ...');

  // Items loaded from processed data files
  const processedTypes = [
    { label: 'seeds',        file: 'seeds.json' },
    { label: 'forage',       file: 'forage.json' },
    { label: 'crops',        file: 'crops.json' },
    { label: 'fish',         file: 'fish.json' },
    { label: 'fruit-trees',  file: 'fruit-trees.json', nameKey: 'fruitName' },
    { label: 'tree-fruits',  file: 'tree-fruits.json' },
    { label: 'minerals',     file: 'minerals.json' },
    { label: 'metal-bars',   file: 'metal-bars.json' },
    { label: 'monster-loot', file: 'monster-loot.json' },
    { label: 'resources',    file: 'resources.json' },
    { label: 'artisan',      file: 'artisan.json' },
    { label: 'big-craftables', file: 'big-craftables.json' },
    { label: 'furniture',    file: 'furniture.json' },
    { label: 'hats',         file: 'hats.json' },
  ];

  for (const { label, file, nameKey } of processedTypes) {
    const items = loadItems(file);
    if (!items.length) { console.log(`⊘ Skipping ${label}: not found`); continue; }
    // Some types use a different field for the wiki name
    const mapped = nameKey ? items.map(i => ({ ...i, wikiName: i[nameKey] || i.name })) : items;
    await downloadIcons(label, mapped);
  }

  // Currency/trade items not covered by any processed type
  const currencyItems = [
    { name: 'Calico Egg' },
    { name: 'Qi Gem' },
    { name: 'Cinder Shard' },
    { name: 'Omni Geode' },
    { name: 'Coal' },
    { name: 'Bone Fragment' },
    { name: 'Moss' },
    { name: 'Void Essence' },
    { name: 'Bat Wing' },
    { name: 'Mixed Seeds' },
    { name: 'Fiber' },
    { name: 'Sap' },
    { name: 'Cave Carrot' },
    { name: 'Maple Seed' },
    { name: 'Pine Cone' },
    { name: 'Pearl' },
    { name: 'Golden Walnut' },
    { name: 'Mystery Box' },
    { name: 'Golden Mystery Box' },
    { name: 'Mystic Syrup' },
  ];
  await downloadIcons('currencies', currencyItems);

  console.log('\n✅ Icon download complete!');
}

main().catch(console.error);

#!/usr/bin/env node

/**
 * Download item icons from Stardew Valley Wiki
 * Icons are stored in public/assets/{type}/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ASSETS_DIR = path.join(__dirname, '../public/assets');

// Helper to download a file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirects
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

// Helper to fetch wiki page and extract image URL
function getWikiImageUrl(itemName) {
  return new Promise((resolve, reject) => {
    const wikiName = itemName.replace(/\s+/g, '_');
    const wikiUrl = `https://stardewvalleywiki.com/${wikiName}`;

    https.get(wikiUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Wiki page not found: ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        // Look for the image URL in the infobox or first occurrence
        // Pattern: /mediawiki/images/{hash}/{filename}.png
        const imgPattern = new RegExp(`/mediawiki/images/[0-9a-f]/[0-9a-f]{2}/${wikiName}\\.png`, 'i');
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

// Helper to encode item name for wiki URL
function encodeWikiName(name) {
  return name
    .replace(/\s+/g, '_')
    .replace(/'/g, '%27');
}

async function downloadIcons(itemType, items) {
  const typeDir = path.join(ASSETS_DIR, itemType);
  fs.mkdirSync(typeDir, { recursive: true });

  console.log(`\nDownloading ${items.length} ${itemType} icons...`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    // For fruit trees, use the fruit name for wiki lookup and filename
    const wikiLookupName = item.fruitName || item.name;
    const fileName = `${wikiLookupName.replace(/\s+/g, '_')}.png`;
    const outputPath = path.join(typeDir, fileName);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }

    try {
      // First, get the actual image URL from the wiki page
      const imageUrl = await getWikiImageUrl(wikiLookupName);
      // Then download the image
      await downloadFile(imageUrl, outputPath);
      success++;
      process.stdout.write('.');
    } catch (error) {
      failed++;
      process.stdout.write('x');
      console.error(`\n  Failed to download ${item.name}: ${error.message}`);
    }

    // Rate limit to be nice to the wiki
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n  ✓ Downloaded: ${success}`);
  console.log(`  ⊘ Skipped (exists): ${skipped}`);
  if (failed > 0) console.log(`  ✗ Failed: ${failed}`);
}

// Main function
async function main() {
  console.log('📥 Downloading icons from Stardew Valley Wiki...\n');

  // Load processed data files
  const PROCESSED_DIR = path.join(__dirname, '../data/processed/items');

  const itemTypes = [
    { type: 'forage', file: 'forage.json' },
    { type: 'fruit-trees', file: 'fruit-trees.json' },
    { type: 'tree-fruits', file: 'tree-fruits.json' },
    { type: 'minerals', file: 'minerals.json' },
    { type: 'metal-bars', file: 'metal-bars.json' },
    { type: 'monster-loot', file: 'monster-loot.json' },
    { type: 'resources', file: 'resources.json' }
  ];

  for (const { type, file } of itemTypes) {
    const filePath = path.join(PROCESSED_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⊘ Skipping ${type}: ${file} not found`);
      continue;
    }

    const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await downloadIcons(type, items);
  }

  console.log('\n✅ Icon download complete!');
}

main().catch(console.error);

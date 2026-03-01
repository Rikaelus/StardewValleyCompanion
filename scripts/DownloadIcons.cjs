#!/usr/bin/env node

/**
 * Download item icons from Stardew Valley Wiki.
 *
 * Source of truth: public/data/entities.json
 * Every item with an `icon` field that is missing from disk gets downloaded.
 * No hardcoded item lists — adding new entity types automatically picks them up.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PUBLIC_DIR = path.join(__dirname, '../public');
const ENTITIES_PATH = path.join(PUBLIC_DIR, 'data/entities.json');
const OVERRIDES_PATH = path.join(__dirname, '../data/rules/icon-overrides.json');

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

// Encode a wiki name to a URL-safe page/file name.
// Spaces → underscores; special chars percent-encoded except for chars wiki allows unencoded.
function toWikiPath(name) {
  return name.split('').map(c => {
    if (/[A-Za-z0-9_.\-]/.test(c)) return c;
    if (c === ' ') return '_';
    if (c === "'") return '%27';
    if (c === '(') return '%28';
    if (c === ')') return '%29';
    if (c === ',') return '%2C';
    return encodeURIComponent(c);
  }).join('');
}

// Fetch the direct image URL by hitting the File: page, which redirects to the actual image.
// This works for any image name regardless of which article it appears on.
function getWikiImageUrlDirect(imageName) {
  return new Promise((resolve, reject) => {
    const filePath = toWikiPath(imageName);
    const url = `https://stardewvalleywiki.com/File:${filePath}.png`;
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`File page not found: ${response.statusCode}`));
        return;
      }
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        // The File: page contains a link to the actual image in /mediawiki/images/
        // The image URL may percent-encode special chars (e.g. ( → %28), so match loosely.
        const imgPattern = /\/mediawiki\/images\/[0-9a-f]\/[0-9a-f]{2}\/[^\s"]+\.png/i;
        const match = data.match(imgPattern);
        if (match) {
          resolve(`https://stardewvalleywiki.com${match[0]}`);
        } else {
          reject(new Error('Image URL not found on File page'));
        }
      });
    }).on('error', reject);
  });
}

function getWikiImageUrl(wikiName) {
  return getWikiImageUrlDirect(wikiName);
}

// Derive the wiki image name for an item.
// Priority: icon-overrides.json > item.name > PascalCase-split of icon filename.
function wikiNameForItem(item, overrides) {
  if (overrides[item.id]) return overrides[item.id];
  if (item.name) return item.name;
  // Fallback: split PascalCase icon filename
  const filename = path.basename(item.icon, '.png');
  return filename.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

async function main() {
  if (!fs.existsSync(ENTITIES_PATH)) {
    console.error('entities.json not found — run CompileData.cjs first');
    process.exit(1);
  }

  const entities = JSON.parse(fs.readFileSync(ENTITIES_PATH, 'utf8'));
  const allItems = entities.items || [];
  const overrides = fs.existsSync(OVERRIDES_PATH)
    ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8')).overrides || {}
    : {};

  // Collect items that need icons downloaded
  const toDownload = [];
  let alreadyPresent = 0;
  let noIconField = 0;

  for (const item of allItems) {
    if (!item.icon) {
      noIconField++;
      continue;
    }
    const fullPath = path.join(PUBLIC_DIR, item.icon);
    if (fs.existsSync(fullPath)) {
      alreadyPresent++;
    } else {
      toDownload.push(item);
    }
  }

  console.log(`📦 entities.json: ${allItems.length} items`);
  console.log(`  ✓ Already on disk: ${alreadyPresent}`);
  console.log(`  ⊘ No icon field:   ${noIconField}`);
  console.log(`  ↓ Need download:   ${toDownload.length}\n`);

  if (toDownload.length === 0) {
    console.log('✅ All icons already downloaded.');
    return;
  }

  // Group by output directory so we can log progress per directory
  const byDir = {};
  for (const item of toDownload) {
    const dir = path.dirname(item.icon); // e.g. "assets/objects" or "assets/buffs"
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(item);
  }

  let totalSuccess = 0, totalFailed = 0;
  const failed = [];

  for (const [dir, items] of Object.entries(byDir)) {
    console.log(`📥 ${dir}/ (${items.length} missing)...`);
    fs.mkdirSync(path.join(PUBLIC_DIR, dir), { recursive: true });

    let success = 0;
    for (const item of items) {
      const wikiName = wikiNameForItem(item, overrides);
      const outputPath = path.join(PUBLIC_DIR, item.icon);

      try {
        const imageUrl = await getWikiImageUrl(wikiName);
        await downloadFile(imageUrl, outputPath);
        success++;
        totalSuccess++;
        process.stdout.write('.');
      } catch (err) {
        totalFailed++;
        failed.push({ item: item.id, wikiName, error: err.message });
        process.stdout.write('x');
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`\n  ✓ ${success}/${items.length}`);
  }

  console.log(`\n✅ Done. Downloaded: ${totalSuccess}  Failed: ${totalFailed}`);

  if (failed.length > 0) {
    console.log('\n⚠️  Failed items (may need manual download or wiki name override):');
    for (const { item, wikiName, error } of failed) {
      console.log(`  ${item} (wiki: "${wikiName}") — ${error}`);
    }
  }
}

main().catch(console.error);

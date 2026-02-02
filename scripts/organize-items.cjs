#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

const ITEMS_DIR = './src/data/items';
const FOLDERS = {
  equip: 'equip',
  consume: 'consume',
  etc: 'etc'
};

// ============================================================================
// Main Processing
// ============================================================================

function organizeItems() {
  const files = fs.readdirSync(ITEMS_DIR).filter(f => f.endsWith('.json') && f !== 'index.ts');

  console.log(`Organizing ${files.length} items into folders...`);

  let counts = { equip: 0, consume: 0, etc: 0 };

  files.forEach(file => {
    try {
      const filePath = path.join(ITEMS_DIR, file);
      const itemData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const itemType = itemData.type;
      const targetFolder = FOLDERS[itemType];

      if (!targetFolder) {
        console.warn(`⚠ Unknown type "${itemType}" for ${file}`);
        return;
      }

      const targetPath = path.join(ITEMS_DIR, targetFolder, file);

      // 파일 이동
      fs.renameSync(filePath, targetPath);

      counts[itemType]++;
      console.log(`✓ ${file} → ${targetFolder}/`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  });

  console.log(`\nComplete:`);
  console.log(`  - equip: ${counts.equip} items`);
  console.log(`  - consume: ${counts.consume} items`);
  console.log(`  - etc: ${counts.etc} items`);
}

organizeItems();

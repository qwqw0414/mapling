#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

const USE_DIR = './src/data/items/use';

// ============================================================================
// Main Processing
// ============================================================================

function updateTypeToUse() {
  const files = fs.readdirSync(USE_DIR).filter(f => f.endsWith('.json'));

  console.log(`Updating ${files.length} files to type: "use"...`);

  let successCount = 0;

  files.forEach(file => {
    try {
      const filePath = path.join(USE_DIR, file);
      const itemData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (itemData.type === 'consume') {
        itemData.type = 'use';

        fs.writeFileSync(
          filePath,
          JSON.stringify(itemData, null, 2) + '\n',
          'utf8'
        );

        console.log(`✓ ${file}`);
        successCount++;
      }
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  });

  console.log(`\nComplete: ${successCount} files updated`);
}

updateTypeToUse();

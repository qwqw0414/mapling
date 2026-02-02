#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

const TEMP_DIR = './temp_items';
const OUTPUT_DIR = './src/data/items';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * typeInfo를 기반으로 아이템 타입을 결정합니다.
 */
function determineItemType(typeInfo) {
  if (!typeInfo) return 'etc';

  const { overallCategory } = typeInfo;

  if (overallCategory === 'Equip') return 'equip';
  if (overallCategory === 'Use') return 'consume';
  return 'etc';
}

/**
 * typeInfo를 기반으로 카테고리를 결정합니다.
 */
function determineCategory(typeInfo, itemType) {
  if (!typeInfo) return 'other';

  const { category, subCategory } = typeInfo;

  if (itemType === 'equip') {
    if (category === 'Weapon') return 'weapon';
    if (category === 'Armor') {
      if (subCategory === 'Hat') return 'hat';
      if (subCategory === 'Top' || subCategory === 'Bottom' || subCategory === 'Overall') return 'armor';
      if (subCategory === 'Glove') return 'glove';
      if (subCategory === 'Shoes') return 'shoes';
      return 'armor';
    }
    return 'accessory';
  }

  if (itemType === 'consume') {
    if (subCategory === 'Potion') return 'potion';
    if (subCategory === 'Food') return 'food';
    return 'consumable';
  }

  if (subCategory === 'Monster Drop') return 'monster-drop';
  if (subCategory === 'Rare Ore' || subCategory === 'Ore') return 'ore';
  if (subCategory === 'Rare Gem' || subCategory === 'Gem') return 'jewel';
  if (category === 'Crafting') return 'material';
  if (subCategory === 'Arrow') return 'projectile';
  if (subCategory === 'Upgrade') return 'scroll';

  return 'other';
}

/**
 * typeInfo를 기반으로 슬롯을 결정합니다.
 */
function determineSlot(typeInfo) {
  if (!typeInfo || typeInfo.overallCategory !== 'Equip') return null;

  const { category, subCategory } = typeInfo;

  if (category === 'Weapon') return 'weapon';
  if (subCategory === 'Hat') return 'hat';
  if (subCategory === 'Top') return 'top';
  if (subCategory === 'Bottom') return 'bottom';
  if (subCategory === 'Overall') return 'overall';
  if (subCategory === 'Glove') return 'glove';
  if (subCategory === 'Shoes') return 'shoes';
  if (subCategory === 'Cape') return 'cape';
  if (subCategory === 'Ring') return 'ring';
  if (subCategory === 'Pendant') return 'pendant';
  if (subCategory === 'Belt') return 'belt';
  if (subCategory === 'Shoulder') return 'shoulder';
  if (subCategory === 'Face Accessory') return 'face';
  if (subCategory === 'Eye Accessory') return 'eye';
  if (subCategory === 'Earring') return 'earring';

  return 'accessory';
}

/**
 * 희귀도를 결정합니다.
 */
function determineRarity() {
  return 'common';
}

/**
 * 스탯 객체를 생성합니다.
 */
function buildStats(apiData) {
  const stats = {};

  const statFields = [
    'incSTR', 'incDEX', 'incINT', 'incLUK',
    'incHP', 'incMP',
    'incPAD', 'incMAD',
    'incPDD', 'incMDD',
    'incEVA', 'incACC',
    'incSpeed', 'incJump'
  ];

  statFields.forEach(field => {
    if (apiData[field] != null && apiData[field] !== 0) {
      stats[field] = apiData[field];
    }
  });

  return Object.keys(stats).length > 0 ? stats : undefined;
}

/**
 * API 데이터를 ItemData 형식으로 변환합니다.
 */
function convertToItemData(apiData) {
  const itemType = determineItemType(apiData.typeInfo);
  const category = determineCategory(apiData.typeInfo, itemType);
  const slot = determineSlot(apiData.typeInfo);
  const rarity = determineRarity();

  const itemData = {
    id: apiData.id,
    name: apiData.name || '',
    description: (apiData.description || '').replace(/\\n/g, ' '),
    type: itemType,
    category: category,
    rarity: rarity,
    price: apiData.price || 0,
    sellable: apiData.notSale !== true,
    tradeable: apiData.tradeBlock !== true,
    stackSize: itemType === 'equip' ? 1 : 100,
  };

  if (slot) {
    itemData.slot = slot;
  }

  if (apiData.reqLevel != null) {
    itemData.requiredLevel = apiData.reqLevel;
  }

  if (apiData.reqJob != null) {
    itemData.requiredJob = apiData.reqJob;
  }

  const stats = buildStats(apiData);
  if (stats) {
    itemData.stats = stats;
  }

  return itemData;
}

/**
 * 파일명을 생성합니다.
 */
function generateFilename(itemData) {
  const safeName = itemData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${itemData.id}_${safeName}.json`;
}

// ============================================================================
// Main Processing
// ============================================================================

function processItems() {
  if (!fs.existsSync(TEMP_DIR)) {
    console.error(`Error: ${TEMP_DIR} directory not found`);
    process.exit(1);
  }

  const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.json'));

  console.log(`Processing ${files.length} items...`);

  let successCount = 0;
  let errorCount = 0;

  files.forEach(file => {
    try {
      const inputPath = path.join(TEMP_DIR, file);
      const apiData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

      const itemData = convertToItemData(apiData);
      const outputFilename = generateFilename(itemData);
      const outputPath = path.join(OUTPUT_DIR, outputFilename);

      fs.writeFileSync(
        outputPath,
        JSON.stringify(itemData, null, 2) + '\n',
        'utf8'
      );

      console.log(`✓ ${itemData.id}: ${itemData.name} → ${outputFilename}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
      errorCount++;
    }
  });

  console.log(`\nComplete: ${successCount} success, ${errorCount} errors`);
}

processItems();

#!/usr/bin/env tsx

/**
 * 아이템 데이터를 DB + API + WZ에서 가져와 JSON 파일로 저장하는 스크립트
 *
 * 데이터 소스 전략:
 *   - DB: 한글 이름/설명, NPC 구매가, 장비 스탯 (주 데이터)
 *   - API: 카테고리/분류, 영문 이름(파일명), 아이콘 URL
 *   - WZ API: 소비 아이템 효과 (포션 회복량, 주문서 성공률/스탯, 투사체 공격력)
 *
 * 실행 방법:
 *   npm run fetch-items -- [옵션] [아이템ID...]
 *   npx tsx fetch-items.ts [옵션] [아이템ID...]
 *
 * 예시:
 *   npx tsx fetch-items.ts 2000000 2000001           # 특정 아이템
 *   npx tsx fetch-items.ts --range=2000000-2000100   # ID 범위 지정
 *   npx tsx fetch-items.ts --type=use                # 소비 아이템 전체
 *   npx tsx fetch-items.ts --type=use --limit=50     # 소비 아이템 50개
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

// ============================================================================
// Types
// ============================================================================

interface DbItemRow {
  itemid: number;
  name: string | null;
  msg: string | null;
  desc: string | null;
  slotMax: number;
  price: string;
  wholePrice: number;
  karma: number;
  questId: number;
}

interface DbEquipStat {
  key: string;
  value: number;
}

interface ApiItemResponse {
  id: number;
  description: {
    name: string;
    description: string;
  };
  metaInfo: {
    price?: number;
    reqLevel?: number;
    reqJob?: number;
    slotMax?: number;
    tuc?: number;
    cash: boolean;
    only?: boolean;
    quest?: boolean;
    tradeBlock?: boolean;
    notSale?: boolean;
    incSTR?: number;
    incDEX?: number;
    incINT?: number;
    incLUK?: number;
    incPAD?: number;
    incMAD?: number;
    incPDD?: number;
    incMDD?: number;
    incEVA?: number;
    incACC?: number;
    incSpeed?: number;
    incJump?: number;
    incMHP?: number;
    incMMP?: number;
  };
  typeInfo: {
    overallCategory: string;
    category: string;
    subCategory: string;
  };
}

interface WzNode {
  children: string[];
  type: number;
  value?: number | string;
}

type ItemType = 'equip' | 'use' | 'setup' | 'etc' | 'cash';

// 소비 아이템 효과 타입
interface UseEffect {
  // 포션 효과
  hp?: number; // HP 고정 회복
  mp?: number; // MP 고정 회복
  hpR?: number; // HP % 회복
  mpR?: number; // MP % 회복
  // 버프 효과
  pad?: number; // 공격력 증가
  mad?: number; // 마력 증가
  pdd?: number; // 물리 방어력 증가
  mdd?: number; // 마법 방어력 증가
  acc?: number; // 명중 증가
  eva?: number; // 회피 증가
  speed?: number; // 이동속도 증가
  jump?: number; // 점프력 증가
  time?: number; // 지속시간 (ms)
  // 주문서 효과
  success?: number; // 성공률 (%)
  incSTR?: number;
  incDEX?: number;
  incINT?: number;
  incLUK?: number;
  incPAD?: number;
  incMAD?: number;
  incPDD?: number;
  incMDD?: number;
  incACC?: number;
  incEVA?: number;
  incMHP?: number;
  incMMP?: number;
  incSpeed?: number;
  incJump?: number;
  // 투사체 (표창/화살)
  attackPower?: number; // 공격력
}

interface ItemData {
  id: number;
  name: string;
  nameEn?: string;
  description: string;
  type: ItemType;
  category: string;
  subCategory?: string;
  slot?: string;
  rarity: string;
  price: number;
  sellable: boolean;
  tradeable: boolean;
  stackSize: number;
  upgradeSlots?: number;
  only?: boolean;
  quest?: boolean;
  isCash?: boolean;
  requiredLevel?: number;
  requiredJob?: number;
  icon?: string;
  stats?: Record<string, number>;
  effect?: UseEffect; // 소비 아이템 효과
}

// ============================================================================
// Constants
// ============================================================================

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'maplestory'
};

const API_BASE_URL = 'https://maplestory.io/api/gms/62/item';
const WZ_API_BASE_URL = 'https://maplestory.io/api/wz/gms/62/Item/Consume';
const ITEMS_DIR = './src/data/items';

// ============================================================================
// Helper Functions - Type/Category from API
// ============================================================================

function determineItemTypeFromApi(typeInfo: ApiItemResponse['typeInfo']): ItemType {
  const { overallCategory } = typeInfo;

  switch (overallCategory) {
    case 'Equip':
      return 'equip';
    case 'Use':
      return 'use';
    case 'Setup':
      return 'setup';
    case 'Cash':
      return 'cash';
    default:
      return 'etc';
  }
}

function determineCategoryFromApi(
  typeInfo: ApiItemResponse['typeInfo'],
  itemType: ItemType
): { category: string; subCategory?: string; slot?: string } {
  const { category, subCategory } = typeInfo;

  // Equip
  if (itemType === 'equip') {
    if (
      category === 'Weapon' ||
      category === 'One-Handed Weapon' ||
      category === 'Two-Handed Weapon' ||
      category.includes('Weapon')
    ) {
      if (category === 'Secondary Weapon') {
        return { category: 'secondary', subCategory, slot: 'secondary' };
      }
      return { category: 'weapon', subCategory, slot: 'weapon' };
    }

    if (category === 'Armor') {
      if (subCategory === 'Hat') return { category: 'hat', subCategory, slot: 'hat' };
      if (subCategory === 'Top') return { category: 'armor', subCategory, slot: 'top' };
      if (subCategory === 'Bottom') return { category: 'armor', subCategory, slot: 'bottom' };
      if (subCategory === 'Overall') return { category: 'armor', subCategory, slot: 'overall' };
      if (subCategory === 'Glove') return { category: 'glove', subCategory, slot: 'glove' };
      if (subCategory === 'Shoes') return { category: 'shoes', subCategory, slot: 'shoes' };
      if (subCategory === 'Cape') return { category: 'cape', subCategory, slot: 'cape' };
      if (subCategory === 'Shield') return { category: 'shield', subCategory, slot: 'shield' };
      return { category: 'armor', subCategory, slot: 'armor' };
    }

    if (category === 'Accessory') {
      if (subCategory === 'Ring') return { category: 'ring', subCategory, slot: 'ring' };
      if (subCategory === 'Pendant') return { category: 'pendant', subCategory, slot: 'pendant' };
      if (subCategory === 'Belt') return { category: 'belt', subCategory, slot: 'belt' };
      if (subCategory === 'Earring' || subCategory === 'Earrings')
        return { category: 'earring', subCategory, slot: 'earring' };
      if (subCategory === 'Face Accessory') return { category: 'face', subCategory, slot: 'face' };
      if (subCategory === 'Eye Decoration' || subCategory === 'Eye Accessory')
        return { category: 'eye', subCategory, slot: 'eye' };
      if (subCategory === 'Shoulder Accessory')
        return { category: 'shoulder', subCategory, slot: 'shoulder' };
      if (subCategory === 'Medal') return { category: 'medal', subCategory, slot: 'medal' };
      if (subCategory === 'Badge') return { category: 'badge', subCategory, slot: 'badge' };
      if (subCategory === 'Pocket Item') return { category: 'pocket', subCategory, slot: 'pocket' };
      return { category: 'accessory', subCategory, slot: 'accessory' };
    }

    return { category: 'accessory', subCategory };
  }

  // Use
  if (itemType === 'use') {
    if (subCategory === 'Potion') return { category: 'potion', subCategory };
    if (subCategory === 'Food and Drink' || subCategory === 'Food')
      return { category: 'food', subCategory };
    if (subCategory === 'Arrow' || subCategory === 'Crossbow Bolt')
      return { category: 'projectile', subCategory };
    if (subCategory === 'Thrown' || subCategory === 'Bullet')
      return { category: 'projectile', subCategory };
    if (category && category.includes('Scroll')) return { category: 'scroll', subCategory };
    if (category === 'Special Scroll') return { category: 'scroll', subCategory };
    if (subCategory === 'Mastery Book') return { category: 'mastery-book', subCategory };
    if (category === 'Recipe') return { category: 'recipe', subCategory };
    if (category === 'Projectile') return { category: 'projectile', subCategory };
    return { category: 'consumable', subCategory };
  }

  // Setup
  if (itemType === 'setup') {
    if (subCategory === 'Chair') return { category: 'chair', subCategory };
    if (subCategory === 'Title') return { category: 'title', subCategory };
    if (category === 'Nebulite') return { category: 'nebulite', subCategory };
    return { category: 'setup', subCategory };
  }

  // Cash
  if (itemType === 'cash') {
    if (category === 'Pet') return { category: 'pet', subCategory };
    if (category === 'Appearance') return { category: 'appearance', subCategory };
    if (category === 'Random Reward') return { category: 'gacha', subCategory };
    return { category: 'cash', subCategory };
  }

  // Etc
  if (subCategory === 'Monster Drop') return { category: 'monster-drop', subCategory };
  if (subCategory === 'Mineral Ore' || subCategory === 'Ore') return { category: 'ore', subCategory };
  if (subCategory === 'Rare Ore') return { category: 'ore', subCategory };
  if (subCategory === 'Mineral Processed') return { category: 'mineral', subCategory };
  if (subCategory === 'Rare Processed Ore') return { category: 'jewel', subCategory };
  if (subCategory === 'Herb') return { category: 'herb', subCategory };
  if (subCategory === 'Herb Oil') return { category: 'oil', subCategory };
  if (category === 'Crafting') return { category: 'material', subCategory };
  if (subCategory === 'Quest Item') return { category: 'quest', subCategory };
  if (subCategory === 'Coin') return { category: 'coin', subCategory };

  return { category: 'other', subCategory };
}

// Fallback: ID 기반 타입 결정 (API 실패 시)
function determineItemTypeFromId(itemId: number): ItemType {
  if (itemId >= 1000000 && itemId < 2000000) return 'equip';
  if (itemId >= 2000000 && itemId < 3000000) return 'use';
  if (itemId >= 3000000 && itemId < 4000000) return 'setup';
  if (itemId >= 4000000 && itemId < 5000000) return 'etc';
  if (itemId >= 5000000) return 'cash';
  return 'etc';
}

// Fallback: ID 기반 카테고리 결정 (API 실패 시)
function determineCategoryFromId(itemId: number): { category: string; slot?: string } {
  const prefix = Math.floor(itemId / 10000);

  // Equip
  if (itemId >= 1000000 && itemId < 2000000) {
    if (prefix >= 100 && prefix <= 104) return { category: 'hat', slot: 'hat' };
    if (prefix === 105) return { category: 'armor', slot: 'overall' };
    if (prefix === 106) return { category: 'armor', slot: 'bottom' };
    if (prefix === 107) return { category: 'shoes', slot: 'shoes' };
    if (prefix === 108) return { category: 'glove', slot: 'glove' };
    if (prefix === 109) return { category: 'shield', slot: 'shield' };
    if (prefix === 110) return { category: 'cape', slot: 'cape' };
    if (prefix >= 130 && prefix <= 170) return { category: 'weapon', slot: 'weapon' };
    return { category: 'accessory', slot: 'accessory' };
  }

  // Use
  if (itemId >= 2000000 && itemId < 3000000) {
    if (prefix >= 200 && prefix <= 201) return { category: 'potion' };
    if (prefix === 204) return { category: 'scroll' };
    if (prefix === 206 || prefix === 207) return { category: 'projectile' };
    return { category: 'consumable' };
  }

  // Setup
  if (itemId >= 3000000 && itemId < 4000000) {
    if (prefix === 301) return { category: 'chair' };
    return { category: 'setup' };
  }

  // Etc
  if (itemId >= 4000000 && itemId < 5000000) {
    if (prefix === 400) return { category: 'monster-drop' };
    if (prefix === 401) return { category: 'ore' };
    if (prefix === 402) return { category: 'jewel' };
    return { category: 'other' };
  }

  // Cash
  if (itemId >= 5000000) {
    return { category: 'cash' };
  }

  return { category: 'other' };
}

function getIconUrl(itemId: number): string {
  return `https://maplestory.io/api/gms/62/item/${itemId}/icon`;
}

function generateFilename(itemId: number, englishName: string): string {
  const safeName = (englishName || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${itemId}_${safeName || 'unknown'}.json`;
}

// WZ 파일 경로 계산 (아이템 ID 기반)
function getWzPath(itemId: number): string {
  // 2000001 -> 0200.img/02000001
  const prefix = Math.floor(itemId / 10000)
    .toString()
    .padStart(4, '0');
  const fullId = itemId.toString().padStart(8, '0');
  return `${prefix}.img/${fullId}`;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchFromApi(itemId: number): Promise<ApiItemResponse | null> {
  try {
    const url = `${API_BASE_URL}/${itemId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// WZ API Functions (소비 아이템 효과)
// ============================================================================

async function fetchWzNode(path: string): Promise<WzNode | null> {
  try {
    const url = `${WZ_API_BASE_URL}/${path}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWzValue(path: string): Promise<number | null> {
  const node = await fetchWzNode(path);
  if (node && node.value != null && typeof node.value === 'number') {
    return node.value;
  }
  return null;
}

async function fetchUseItemEffect(itemId: number): Promise<UseEffect | null> {
  const wzPath = getWzPath(itemId);
  const effect: UseEffect = {};
  let hasEffect = false;

  // 1. spec 노드 확인 (포션 효과)
  const specNode = await fetchWzNode(`${wzPath}/spec`);
  if (specNode && specNode.children.length > 0) {
    const specFields = [
      { key: 'hp', field: 'hp' },
      { key: 'mp', field: 'mp' },
      { key: 'hpR', field: 'hpR' },
      { key: 'mpR', field: 'mpR' },
      { key: 'pad', field: 'pad' },
      { key: 'mad', field: 'mad' },
      { key: 'pdd', field: 'pdd' },
      { key: 'mdd', field: 'mdd' },
      { key: 'acc', field: 'acc' },
      { key: 'eva', field: 'eva' },
      { key: 'speed', field: 'speed' },
      { key: 'jump', field: 'jump' },
      { key: 'time', field: 'time' }
    ];

    for (const { key, field } of specFields) {
      if (specNode.children.includes(key)) {
        const value = await fetchWzValue(`${wzPath}/spec/${key}`);
        if (value != null) {
          (effect as Record<string, number>)[field] = value;
          hasEffect = true;
        }
      }
    }
  }

  // 2. info 노드 확인 (주문서/투사체 효과)
  const infoNode = await fetchWzNode(`${wzPath}/info`);
  if (infoNode && infoNode.children.length > 0) {
    const infoFields = [
      { key: 'success', field: 'success' },
      { key: 'incSTR', field: 'incSTR' },
      { key: 'incDEX', field: 'incDEX' },
      { key: 'incINT', field: 'incINT' },
      { key: 'incLUK', field: 'incLUK' },
      { key: 'incPAD', field: 'incPAD' },
      { key: 'incMAD', field: 'incMAD' },
      { key: 'incPDD', field: 'incPDD' },
      { key: 'incMDD', field: 'incMDD' },
      { key: 'incACC', field: 'incACC' },
      { key: 'incEVA', field: 'incEVA' },
      { key: 'incMHP', field: 'incMHP' },
      { key: 'incMMP', field: 'incMMP' },
      { key: 'incSpeed', field: 'incSpeed' },
      { key: 'incJump', field: 'incJump' }
    ];

    for (const { key, field } of infoFields) {
      if (infoNode.children.includes(key)) {
        const value = await fetchWzValue(`${wzPath}/info/${key}`);
        if (value != null) {
          (effect as Record<string, number>)[field] = value;
          hasEffect = true;
        }
      }
    }

    // 투사체 공격력 (incPAD를 attackPower로 복사)
    if (effect.incPAD && !effect.success) {
      effect.attackPower = effect.incPAD;
      delete effect.incPAD;
    }
  }

  return hasEffect ? effect : null;
}

// ============================================================================
// DB Functions
// ============================================================================

interface DbItemData {
  name: string;
  description: string;
  price: number;
  stackSize: number;
  tradeable: boolean;
  questId: number;
  stats?: Record<string, number>;
  upgradeSlots?: number;
  requiredLevel?: number;
  requiredJob?: number;
  isCash?: boolean;
}

async function fetchFromDb(conn: mysql.Connection, itemId: number): Promise<DbItemData | null> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT * FROM wz_itemdata WHERE itemid = ?',
    [itemId]
  );

  if (rows.length === 0) {
    return null;
  }

  const dbItem = rows[0] as DbItemRow;
  const itemType = determineItemTypeFromId(itemId);

  const result: DbItemData = {
    name: dbItem.name || '',
    description: (dbItem.desc || '').replace(/\\n/g, ' ').replace(/\\r/g, ''),
    price: dbItem.wholePrice || 0,
    stackSize: itemType === 'equip' ? 1 : dbItem.slotMax || 100,
    tradeable: dbItem.karma !== 1,
    questId: dbItem.questId || 0
  };

  // 장비 스탯 조회 (장비 아이템만)
  if (itemType === 'equip') {
    const [statRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT `key`, value FROM wz_itemequipdata WHERE itemid = ?',
      [itemId]
    );

    const stats: Record<string, number> = {};
    const statMapping: Record<string, string> = {
      STR: 'incSTR',
      DEX: 'incDEX',
      INT: 'incINT',
      LUK: 'incLUK',
      PAD: 'incPAD',
      MAD: 'incMAD',
      PDD: 'incPDD',
      MDD: 'incMDD',
      ACC: 'incACC',
      EVA: 'incEVA',
      MHP: 'incMHP',
      MMP: 'incMMP',
      Speed: 'incSpeed',
      Jump: 'incJump'
    };

    for (const row of statRows as DbEquipStat[]) {
      if (row.key === 'tuc') {
        result.upgradeSlots = row.value;
      } else if (row.key === 'reqLevel') {
        result.requiredLevel = row.value;
      } else if (row.key === 'reqJob') {
        result.requiredJob = row.value;
      } else if (row.key === 'cash' && row.value === 1) {
        result.isCash = true;
      } else if (statMapping[row.key]) {
        stats[statMapping[row.key]] = row.value;
      }
    }

    if (Object.keys(stats).length > 0) {
      result.stats = stats;
    }
  }

  return result;
}

async function fetchItemIdsFromDb(
  conn: mysql.Connection,
  options: {
    type?: ItemType;
    range?: { min: number; max: number };
    limit?: number;
  }
): Promise<number[]> {
  let query = "SELECT itemid FROM wz_itemdata WHERE name IS NOT NULL AND name != ''";
  const params: (number | string)[] = [];

  if (options.type) {
    const typeRanges: Record<ItemType, [number, number]> = {
      equip: [1000000, 2000000],
      use: [2000000, 3000000],
      setup: [3000000, 4000000],
      etc: [4000000, 5000000],
      cash: [5000000, 10000000]
    };
    const [min, max] = typeRanges[options.type];
    query += ' AND itemid >= ? AND itemid < ?';
    params.push(min, max);
  }

  if (options.range) {
    query += ' AND itemid >= ? AND itemid <= ?';
    params.push(options.range.min, options.range.max);
  }

  query += ' ORDER BY itemid';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const [rows] = await conn.query<mysql.RowDataPacket[]>(query, params);
  return rows.map((row) => row.itemid);
}

// ============================================================================
// Merge Logic: DB + API + WZ
// ============================================================================

async function fetchAndMergeItem(
  conn: mysql.Connection,
  itemId: number
): Promise<{ itemData: ItemData; filename: string } | null> {
  // 1. DB에서 기본 데이터 가져오기
  const dbData = await fetchFromDb(conn, itemId);

  // 2. API에서 분류/영문명 가져오기
  const apiData = await fetchFromApi(itemId);

  // 둘 다 없으면 실패
  if (!dbData && !apiData) {
    return null;
  }

  // 3. 타입/카테고리 결정 (API 우선, 없으면 ID 기반)
  let itemType: ItemType;
  let category: string;
  let subCategory: string | undefined;
  let slot: string | undefined;

  if (apiData) {
    itemType = determineItemTypeFromApi(apiData.typeInfo);
    const categoryInfo = determineCategoryFromApi(apiData.typeInfo, itemType);
    category = categoryInfo.category;
    subCategory = categoryInfo.subCategory;
    slot = categoryInfo.slot;
  } else {
    itemType = determineItemTypeFromId(itemId);
    const categoryInfo = determineCategoryFromId(itemId);
    category = categoryInfo.category;
    slot = categoryInfo.slot;
  }

  // 4. 영문 이름 (API에서, 없으면 빈 문자열)
  const englishName = apiData?.description.name || '';

  // 5. 데이터 병합 (DB 우선)
  const itemData: ItemData = {
    id: itemId,
    name: dbData?.name || apiData?.description.name || '',
    description: dbData?.description || apiData?.description.description?.replace(/\\n/g, ' ') || '',
    type: itemType,
    category,
    rarity: 'common',
    price: dbData?.price ?? apiData?.metaInfo.price ?? 0,
    sellable: apiData ? apiData.metaInfo.notSale !== true : true,
    tradeable: dbData?.tradeable ?? (apiData ? apiData.metaInfo.tradeBlock !== true : true),
    stackSize: dbData?.stackSize ?? (itemType === 'equip' ? 1 : apiData?.metaInfo.slotMax ?? 100),
    icon: getIconUrl(itemId)
  };

  // 영문 이름 추가 (한글과 다를 경우)
  if (englishName && englishName !== itemData.name) {
    itemData.nameEn = englishName;
  }

  // subCategory
  if (subCategory) {
    itemData.subCategory = subCategory;
  }

  // slot
  if (slot) {
    itemData.slot = slot;
  }

  // upgradeSlots (DB 우선, API fallback)
  const upgradeSlots = dbData?.upgradeSlots ?? apiData?.metaInfo.tuc;
  if (upgradeSlots != null && upgradeSlots > 0) {
    itemData.upgradeSlots = upgradeSlots;
  }

  // only (API)
  if (apiData?.metaInfo.only === true) {
    itemData.only = true;
  }

  // quest (DB 우선, API fallback)
  if ((dbData?.questId && dbData.questId > 0) || apiData?.metaInfo.quest === true) {
    itemData.quest = true;
  }

  // isCash (DB 우선, API fallback)
  if (dbData?.isCash === true || apiData?.metaInfo.cash === true) {
    itemData.isCash = true;
  }

  // requiredLevel (DB 우선, API fallback)
  const reqLevel = dbData?.requiredLevel ?? apiData?.metaInfo.reqLevel;
  if (reqLevel != null && reqLevel > 0) {
    itemData.requiredLevel = reqLevel;
  }

  // requiredJob (DB 우선, API fallback)
  const reqJob = dbData?.requiredJob ?? apiData?.metaInfo.reqJob;
  if (reqJob != null) {
    itemData.requiredJob = reqJob;
  }

  // stats (장비 아이템: DB 우선, API fallback)
  if (itemType === 'equip') {
    let stats = dbData?.stats;
    if (!stats && apiData) {
      const apiStats: Record<string, number> = {};
      const statFields = [
        'incSTR',
        'incDEX',
        'incINT',
        'incLUK',
        'incPAD',
        'incMAD',
        'incPDD',
        'incMDD',
        'incACC',
        'incEVA',
        'incSpeed',
        'incJump',
        'incMHP',
        'incMMP'
      ];

      statFields.forEach((field) => {
        const value = apiData.metaInfo[field as keyof typeof apiData.metaInfo] as number | undefined;
        if (value != null && value !== 0) {
          apiStats[field] = value;
        }
      });

      if (Object.keys(apiStats).length > 0) {
        stats = apiStats;
      }
    }

    if (stats) {
      itemData.stats = stats;
    }
  }

  // 6. 소비 아이템 효과 (WZ API)
  if (itemType === 'use') {
    const effect = await fetchUseItemEffect(itemId);
    if (effect) {
      itemData.effect = effect;
    }
  }

  // 7. 파일명 생성 (영문 이름 사용)
  const filename = generateFilename(itemId, englishName);

  return { itemData, filename };
}

// ============================================================================
// File Operations
// ============================================================================

function itemFileExists(itemId: number): boolean {
  const type = determineItemTypeFromId(itemId);
  const typeFolder = path.join(ITEMS_DIR, type);
  if (!fs.existsSync(typeFolder)) return false;

  const files = fs.readdirSync(typeFolder);
  return files.some((f) => f.startsWith(`${itemId}_`) && f.endsWith('.json'));
}

function saveItemData(itemData: ItemData, filename: string): string {
  const typeFolder = path.join(ITEMS_DIR, itemData.type);

  if (!fs.existsSync(typeFolder)) {
    fs.mkdirSync(typeFolder, { recursive: true });
  }

  const outputPath = path.join(typeFolder, filename);
  fs.writeFileSync(outputPath, JSON.stringify(itemData, null, 2) + '\n', 'utf8');

  return outputPath;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  let itemType: ItemType | undefined;
  let range: { min: number; max: number } | undefined;
  let fetchAll = false;
  let limit: number | undefined;
  let skipExisting = false;
  const itemIds: number[] = [];

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
아이템 데이터 Fetcher (DB + API + WZ 병합)

데이터 병합 전략:
  - DB (주): 한글 이름/설명, NPC 구매가, 장비 스탯
  - API (보조): 카테고리/분류, 영문 이름(파일명), 아이콘 URL
  - WZ API: 소비 아이템 효과 (포션, 주문서, 투사체)

소비 아이템 효과 (effect 필드):
  - 포션: hp, mp, hpR, mpR, pad, mad, time 등
  - 주문서: success, incSTR, incDEX, incPAD, incPDD 등
  - 투사체: attackPower (표창/화살 공격력)

사용법:
  npx tsx fetch-items.ts [옵션] [아이템ID...]

필터 옵션:
  --type=TYPE       타입별 전체 (equip/use/setup/etc/cash)
  --range=MIN-MAX   ID 범위 지정 (예: --range=2000000-2000100)
  --limit=N         최대 N개만 가져오기
  --all             전체 아이템 (주의: 17,000개+)

예시:
  npx tsx fetch-items.ts 2000000 2000001       # 특정 아이템
  npx tsx fetch-items.ts --type=use --limit=10 # 소비 아이템 10개
  npx tsx fetch-items.ts --range=2040000-2040010  # 주문서 범위
  npx tsx fetch-items.ts --type=use --skip-existing  # 기존 파일 스킵
      `);
      return;
    }

    if (arg.startsWith('--type=')) {
      itemType = arg.split('=')[1] as ItemType;
    } else if (arg.startsWith('--range=')) {
      const [min, max] = arg.split('=')[1].split('-').map(Number);
      range = { min, max };
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all') {
      fetchAll = true;
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    } else {
      const id = parseInt(arg, 10);
      if (!isNaN(id)) {
        itemIds.push(id);
      }
    }
  }

  if (itemIds.length === 0 && !itemType && !range && !fetchAll) {
    console.log('옵션 없이 실행됨. --help 로 사용법을 확인하세요.');
    return;
  }

  console.log('\n[데이터 병합 모드] DB (한글) + API (분류/영문명) + WZ (소비 효과)\n');

  let conn: mysql.Connection | null = null;
  let targetIds: number[] = [];

  try {
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('DB 연결 완료');

    if (itemIds.length > 0) {
      targetIds = itemIds;
    } else {
      targetIds = await fetchItemIdsFromDb(conn, {
        type: itemType,
        range,
        limit: fetchAll ? undefined : limit
      });
    }

    console.log(`대상 아이템: ${targetIds.length}개\n`);

    if (targetIds.length === 0) {
      console.log('가져올 아이템이 없습니다.');
      return;
    }

    if (targetIds.length > 100) {
      console.log(`[주의] ${targetIds.length}개 아이템 처리 예정 (API/WZ 호출 포함)...`);
      console.log('API 부하 방지를 위해 요청 간 300ms 딜레이 적용\n');
    }

    let successCount = 0;
    let failCount = 0;
    let effectCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const itemId = targetIds[i];

      // 기존 파일 스킵
      if (skipExisting && itemFileExists(itemId)) {
        skippedCount++;
        continue;
      }

      try {
        const result = await fetchAndMergeItem(conn, itemId);

        if (result) {
          const { itemData, filename } = result;
          const outputPath = saveItemData(itemData, filename);
          successCount++;

          if (itemData.effect) {
            effectCount++;
          }

          if (targetIds.length > 100 && (i + 1) % 50 === 0) {
            console.log(`진행: ${i + 1}/${targetIds.length}`);
          } else if (targetIds.length <= 100) {
            const effectStr = itemData.effect ? ' [effect]' : '';
            console.log(`[${itemId}] ${itemData.name}${effectStr} -> ${outputPath}`);
          }
        } else {
          failCount++;
          console.log(`[${itemId}] 데이터 없음 (DB/API 모두 실패)`);
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        failCount++;
        console.error(`[${itemId}] 오류:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`\n========================================`);
    console.log(`완료: 총 ${targetIds.length}개`);
    console.log(`  - 성공: ${successCount}개`);
    if (skippedCount > 0) console.log(`  - 스킵: ${skippedCount}개`);
    if (failCount > 0) console.log(`  - 실패: ${failCount}개`);
    if (effectCount > 0) console.log(`  - 효과 데이터: ${effectCount}개`);
    console.log(`========================================`);
  } finally {
    if (conn) {
      await conn.end();
      console.log('DB 연결 종료');
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

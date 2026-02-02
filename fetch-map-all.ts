#!/usr/bin/env tsx

/**
 * 맵 기반 전체 데이터 Fetcher
 *
 * 맵 ID를 입력하면 다음을 순차적으로 생성:
 *   1. 맵 데이터 JSON
 *   2. 해당 맵에 스폰되는 몬스터 JSON
 *   3. 각 몬스터가 드롭하는 아이템 JSON
 *
 * 실행 방법:
 *   npx tsx fetch-map-all.ts --map=104010001
 *   npx tsx fetch-map-all.ts --map=104010001,100000000
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

// ============================================================================
// Types
// ============================================================================

// Map Types
interface ApiMapSearchResult {
  id: number;
  name: string;
  streetName: string;
}

interface ApiMapDetail {
  id?: number;
  name?: string;
  streetName?: string;
  backgroundMusic?: string;
  isTown?: boolean;
  returnMap?: number;
  mobs?: { id: number }[];
}

interface MapData {
  id: number;
  name: string;
  nameEn?: string;
  streetName: string;
  mapMark?: string;
  isTown?: boolean;
  bgm?: string;
  spawns?: {
    normal: {
      mobs: { mobId: number; weight: number }[];
    };
  };
}

// Mob Types
interface ApiMobResponse {
  id: number;
  name?: string;
  description?: string;
  meta?: {
    isBodyAttack?: boolean;
    level?: number;
    maxHP?: number;
    maxMP?: number;
    physicalDamage?: number;
    physicalDefense?: number;
    magicDamage?: number;
    magicDefense?: number;
    accuracy?: number;
    evasion?: number;
    exp?: number;
    speed?: number;
  };
  framebooks?: Record<string, number>;
  foundAt?: number[];
}

interface MobData {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  meta: {
    level: number;
    maxHp: number;
    maxMp: number;
    exp: number;
    speed: number;
    physicalDamage: number;
    physicalDefense: number;
    magicDamage: number;
    magicDefense: number;
    accuracy: number;
    evasion: number;
    isBoss: boolean;
    isBodyAttack: boolean;
  };
  canJump?: boolean;
  meso?: { amount: number; chance: number };
  drops: { itemId: number; name: string; chance: number; minQuantity?: number; maxQuantity?: number }[];
  foundAt?: number[];
}

// Item Types
type ItemType = 'equip' | 'use' | 'setup' | 'etc' | 'cash';

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
  icon?: string;
  stats?: Record<string, number>;
  effect?: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = 'https://maplestory.io/api/gms/62';
const WZ_API_BASE_URL = 'https://maplestory.io/api/wz/gms/62/Item/Consume';
const MAPS_DIR = './src/data/maps';
const MOBS_DIR = './src/data/mobs';
const ITEMS_DIR = './src/data/items';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'maplestory'
};

const REGION_MARKS: Record<string, string> = {
  'Victoria Road': '빅토리아 아일랜드',
  Henesys: '헤네시스',
  Perion: '페리온',
  Ellinia: '엘리니아',
  'Kerning City': '커닝시티',
  Lith: '리스항구',
  Sleepywood: '슬리피우드',
  'Ant Tunnel': '개미굴',
  Ossyria: '오시리아',
  'El Nath': '엘나스',
  Orbis: '오르비스',
  Ludibrium: '루디브리움',
  'Omega Sector': '오메가 섹터',
  'Korean Folk Town': '코리아 타운',
  'Aqua Road': '아쿠아리움',
  'Mu Lung': '무릉',
  'Herb Town': '백초마을',
  'Nihal Desert': '니할 사막',
  Magatia: '마가티아'
};

const BOSS_IDS = new Set([
  8800000, 8800001, 8800002, // 자쿰
  8810000, 8810001, // 혼테일
  8820000, 8820001, // 핑크빈
  9300003, 9300012, // 킹슬라임
  6130101, // 좀비 머쉬맘
  6300005 // 타이머
]);

// ============================================================================
// Database Connection
// ============================================================================

let dbConnection: mysql.Connection | null = null;

async function getDbConnection(): Promise<mysql.Connection> {
  if (!dbConnection) {
    dbConnection = await mysql.createConnection(DB_CONFIG);
  }
  return dbConnection;
}

async function closeDbConnection(): Promise<void> {
  if (dbConnection) {
    await dbConnection.end();
    dbConnection = null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMapMark(streetName: string): string {
  if (REGION_MARKS[streetName]) return REGION_MARKS[streetName];
  for (const [key, value] of Object.entries(REGION_MARKS)) {
    if (streetName.includes(key) || key.includes(streetName)) return value;
  }
  return streetName;
}

function generateFilename(id: number, name: string): string {
  const safeName = (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${id}_${safeName || 'unknown'}.json`;
}

function determineItemType(itemId: number): ItemType {
  const prefix = Math.floor(itemId / 1000000);
  if (prefix === 1) return 'equip';
  if (prefix === 2) return 'use';
  if (prefix === 3) return 'setup';
  if (prefix === 4) return 'etc';
  if (prefix === 5) return 'cash';
  return 'etc';
}

function getItemSubDir(type: ItemType): string {
  return type;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Map Functions
// ============================================================================

async function fetchMapDetail(mapId: number): Promise<ApiMapDetail | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/map/${mapId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchMapSearch(mapId: number): Promise<ApiMapSearchResult | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/map?searchFor=${mapId}&count=1`);
    if (!response.ok) return null;
    const results = await response.json();
    return results.find((m: ApiMapSearchResult) => m.id === mapId) || null;
  } catch {
    return null;
  }
}

function saveMapData(mapData: MapData): string {
  if (!fs.existsSync(MAPS_DIR)) {
    fs.mkdirSync(MAPS_DIR, { recursive: true });
  }
  const filename = generateFilename(mapData.id, mapData.nameEn || mapData.name);
  const outputPath = path.join(MAPS_DIR, filename);
  fs.writeFileSync(outputPath, JSON.stringify(mapData, null, 2) + '\n', 'utf8');
  return outputPath;
}

function loadExistingMapData(mapId: number): MapData | null {
  // 기존 맵 파일 검색
  if (!fs.existsSync(MAPS_DIR)) return null;

  const files = fs.readdirSync(MAPS_DIR);
  const mapFile = files.find((f) => f.startsWith(`${mapId}_`) && f.endsWith('.json'));

  if (mapFile) {
    try {
      const content = fs.readFileSync(path.join(MAPS_DIR, mapFile), 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

async function processMap(mapId: number): Promise<{ mapData: MapData | null; mobIds: number[] }> {
  console.log(`\n[Map] ${mapId} 처리 중...`);

  // 1. 먼저 기존 파일에서 몬스터 정보 확인
  const existingMap = loadExistingMapData(mapId);
  if (existingMap && existingMap.spawns && existingMap.spawns.normal.mobs.length > 0) {
    const mobIds = existingMap.spawns.normal.mobs.map((m) => m.mobId);
    console.log(`  [Map] ${mapId} 기존 파일 사용 (몬스터: ${mobIds.length}개)`);
    return { mapData: existingMap, mobIds };
  }

  // 2. API에서 새로 가져오기
  const detail = await fetchMapDetail(mapId);
  const search = await fetchMapSearch(mapId);

  if (!detail && !search) {
    console.log(`  [Map] ${mapId} - API에서 정보를 찾을 수 없음`);
    return { mapData: null, mobIds: [] };
  }

  const mapData: MapData = {
    id: mapId,
    name: search?.name || detail?.name || `Map ${mapId}`,
    streetName: getMapMark(search?.streetName || detail?.streetName || '')
  };

  if (search?.name) mapData.nameEn = search.name;
  mapData.mapMark = getMapMark(search?.streetName || detail?.streetName || '');
  if (detail?.isTown) mapData.isTown = true;
  if (detail?.backgroundMusic) mapData.bgm = detail.backgroundMusic;

  // 몬스터 스폰 정보
  const mobIds: number[] = [];
  if (detail?.mobs && detail.mobs.length > 0) {
    const mobCounts: Record<number, number> = {};
    for (const mob of detail.mobs) {
      mobCounts[mob.id] = (mobCounts[mob.id] || 0) + 1;
    }

    const totalSpawns = detail.mobs.length;
    const mobWeights = Object.entries(mobCounts).map(([id, count]) => ({
      mobId: parseInt(id, 10),
      weight: Math.round((count / totalSpawns) * 100)
    }));
    mobWeights.sort((a, b) => b.weight - a.weight);

    mapData.spawns = { normal: { mobs: mobWeights } };
    mobIds.push(...mobWeights.map((m) => m.mobId));
  }

  const outputPath = saveMapData(mapData);
  console.log(`  [Map] ${mapId} -> ${outputPath} (몬스터: ${mobIds.length}개)`);

  return { mapData, mobIds };
}

// ============================================================================
// Mob Functions
// ============================================================================

async function fetchMobFromApi(mobId: number): Promise<ApiMobResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/mob/${mobId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchDropsFromDb(mobId: number): Promise<{
  drops: { itemId: number; name: string; chance: number; minQuantity?: number; maxQuantity?: number }[];
  meso?: { amount: number; chance: number };
  itemIds: number[];
}> {
  const conn = await getDbConnection();
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT d.itemid, d.minimum_quantity, d.maximum_quantity, d.questid, d.chance, i.name as itemName
     FROM drop_data d
     LEFT JOIN wz_itemdata i ON d.itemid = i.itemid
     WHERE d.dropperid = ?
     ORDER BY d.chance DESC`,
    [mobId]
  );

  const drops: { itemId: number; name: string; chance: number; minQuantity?: number; maxQuantity?: number }[] = [];
  const itemIds: number[] = [];
  let meso: { amount: number; chance: number } | undefined;

  for (const row of rows) {
    if (row.itemid === 0) {
      meso = {
        amount: Math.round((row.minimum_quantity + row.maximum_quantity) / 2),
        chance: Math.round((row.chance / 1000000) * 100)
      };
      continue;
    }
    if (row.questid > 0) continue;

    const drop: { itemId: number; name: string; chance: number; minQuantity?: number; maxQuantity?: number } = {
      itemId: row.itemid,
      name: row.itemName || `Unknown Item ${row.itemid}`,
      chance: parseFloat(((row.chance / 1000000) * 100).toFixed(3))
    };

    if (row.minimum_quantity !== 1 || row.maximum_quantity !== 1) {
      drop.minQuantity = row.minimum_quantity;
      drop.maxQuantity = row.maximum_quantity;
    }

    drops.push(drop);
    itemIds.push(row.itemid);
  }

  return { drops, meso, itemIds };
}

function saveMobData(mobData: MobData): string {
  if (!fs.existsSync(MOBS_DIR)) {
    fs.mkdirSync(MOBS_DIR, { recursive: true });
  }
  const filename = generateFilename(mobData.id, mobData.nameEn || mobData.name);
  const outputPath = path.join(MOBS_DIR, filename);

  // 기존 파일이 있으면 한글 이름 유지
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (existing.name && existing.name !== mobData.nameEn) {
        mobData.name = existing.name;
      }
    } catch {
      // ignore
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(mobData, null, 2) + '\n', 'utf8');
  return outputPath;
}

async function processMob(mobId: number): Promise<{ mobData: MobData | null; itemIds: number[] }> {
  const apiData = await fetchMobFromApi(mobId);
  if (!apiData) {
    console.log(`  [Mob] ${mobId} - API에서 정보를 찾을 수 없음`);
    return { mobData: null, itemIds: [] };
  }

  const { drops, meso, itemIds } = await fetchDropsFromDb(mobId);
  const meta = apiData.meta || {};

  const mobData: MobData = {
    id: apiData.id,
    name: apiData.name || `Monster ${apiData.id}`,
    meta: {
      level: meta.level || 1,
      maxHp: meta.maxHP || 1,
      maxMp: meta.maxMP || 0,
      exp: meta.exp || 0,
      speed: meta.speed || 0,
      physicalDamage: meta.physicalDamage || 0,
      physicalDefense: meta.physicalDefense || 0,
      magicDamage: meta.magicDamage || 0,
      magicDefense: meta.magicDefense || 0,
      accuracy: meta.accuracy || 0,
      evasion: meta.evasion || 0,
      isBoss: BOSS_IDS.has(apiData.id),
      isBodyAttack: meta.isBodyAttack || false
    },
    drops
  };

  if (apiData.name) mobData.nameEn = apiData.name;
  if (apiData.framebooks && 'jump' in apiData.framebooks) mobData.canJump = true;
  if (apiData.description) {
    mobData.description = apiData.description
      .replace(/Lv\. :\s*\d+\\n/g, '')
      .replace(/Form :\s*\w+\\n\\n/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  }
  if (meso) mobData.meso = meso;
  if (apiData.foundAt && apiData.foundAt.length > 0) {
    mobData.foundAt = [...new Set(apiData.foundAt)].slice(0, 10);
  }

  const outputPath = saveMobData(mobData);
  console.log(`  [Mob] ${mobId} ${apiData.name} -> ${outputPath} (드롭: ${itemIds.length}개)`);

  return { mobData, itemIds };
}

// ============================================================================
// Item Functions
// ============================================================================

async function fetchItemFromApi(itemId: number): Promise<{
  name?: string;
  description?: { name?: string; description?: string } | string;
  typeInfo?: { category?: string; subCategory?: string; overallCategory?: string };
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/item/${itemId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function getApiItemName(apiData: { name?: string; description?: { name?: string; description?: string } | string } | null): string | undefined {
  if (!apiData) return undefined;
  // name 필드가 있으면 사용
  if (apiData.name) return apiData.name;
  // description 객체 내의 name 사용
  if (apiData.description && typeof apiData.description === 'object' && apiData.description.name) {
    return apiData.description.name;
  }
  return undefined;
}

function getApiItemDescription(apiData: { description?: { name?: string; description?: string } | string } | null): string | undefined {
  if (!apiData) return undefined;
  if (typeof apiData.description === 'string') return apiData.description;
  if (apiData.description && typeof apiData.description === 'object' && apiData.description.description) {
    return apiData.description.description;
  }
  return undefined;
}

async function fetchItemFromDb(itemId: number): Promise<{
  name?: string;
  desc?: string;
  price?: number;
} | null> {
  const conn = await getDbConnection();
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT name, `desc`, price FROM wz_itemdata WHERE itemid = ?',
    [itemId]
  );
  return rows[0] || null;
}

// WZ 파일 경로 계산 (아이템 ID 기반)
function getWzPath(itemId: number): string {
  // 2000001 -> 0200.img/02000001
  const prefix = Math.floor(itemId / 10000).toString().padStart(4, '0');
  const fullId = itemId.toString().padStart(8, '0');
  return `${prefix}.img/${fullId}`;
}

async function fetchUseItemEffect(itemId: number): Promise<Record<string, number> | undefined> {
  const type = determineItemType(itemId);
  if (type !== 'use') return undefined;

  try {
    const wzPath = getWzPath(itemId);
    const effect: Record<string, number> = {};

    // 1. spec 노드 확인 (포션 효과)
    const specUrl = `${WZ_API_BASE_URL}/${wzPath}/spec`;
    const specResponse = await fetch(specUrl);

    if (specResponse.ok) {
      const specData = await specResponse.json();
      if (specData && typeof specData === 'object' && !specData.error && specData.children) {
        const specKeys = ['hp', 'mp', 'hpR', 'mpR', 'pad', 'mad', 'pdd', 'mdd', 'acc', 'eva', 'speed', 'jump', 'time'];
        for (const key of specKeys) {
          if (specData.children.includes(key)) {
            const valueResponse = await fetch(`${WZ_API_BASE_URL}/${wzPath}/spec/${key}`);
            if (valueResponse.ok) {
              const valueData = await valueResponse.json();
              if (valueData && valueData.value !== undefined) {
                effect[key] = valueData.value;
              }
            }
          }
        }
      }
    }

    // 2. info 노드 확인 (주문서/투사체 효과)
    const infoUrl = `${WZ_API_BASE_URL}/${wzPath}/info`;
    const infoResponse = await fetch(infoUrl);

    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      if (infoData && typeof infoData === 'object' && !infoData.error && infoData.children) {
        const infoKeys = [
          'success',
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
          'incMHP',
          'incMMP',
          'incSpeed',
          'incJump'
        ];
        for (const key of infoKeys) {
          if (infoData.children.includes(key)) {
            const valueResponse = await fetch(`${WZ_API_BASE_URL}/${wzPath}/info/${key}`);
            if (valueResponse.ok) {
              const valueData = await valueResponse.json();
              if (valueData && valueData.value !== undefined) {
                effect[key] = valueData.value;
              }
            }
          }
        }
        // 투사체: incPAD를 attackPower로 변환 (success가 없는 경우만)
        if (effect.incPAD !== undefined && effect.success === undefined) {
          effect.attackPower = effect.incPAD;
          delete effect.incPAD;
        }
      }
    }

    if (Object.keys(effect).length > 0) return effect;
  } catch {
    // ignore
  }

  return undefined;
}

function saveItemData(itemData: ItemData): string {
  const subDir = path.join(ITEMS_DIR, getItemSubDir(itemData.type));
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }

  const filename = generateFilename(itemData.id, itemData.nameEn || itemData.name);
  const outputPath = path.join(subDir, filename);

  // 기존 파일이 있으면 한글 이름 유지
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (existing.name && existing.name !== itemData.nameEn) {
        itemData.name = existing.name;
      }
    } catch {
      // ignore
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(itemData, null, 2) + '\n', 'utf8');
  return outputPath;
}

async function processItem(itemId: number): Promise<boolean> {
  const [apiData, dbData] = await Promise.all([fetchItemFromApi(itemId), fetchItemFromDb(itemId)]);

  if (!apiData && !dbData) {
    return false;
  }

  const apiName = getApiItemName(apiData);
  const apiDesc = getApiItemDescription(apiData);

  const type = determineItemType(itemId);
  const itemData: ItemData = {
    id: itemId,
    name: dbData?.name || apiName || `Item ${itemId}`,
    description: dbData?.desc || apiDesc || '',
    type,
    category: apiData?.typeInfo?.category || type,
    rarity: 'common',
    price: dbData?.price || 0,
    sellable: true,
    tradeable: true,
    stackSize: type === 'equip' ? 1 : 100
  };

  if (apiName) itemData.nameEn = apiName;
  if (apiData?.typeInfo?.subCategory) itemData.subCategory = apiData.typeInfo.subCategory;
  itemData.icon = `https://maplestory.io/api/gms/62/item/${itemId}/icon`;

  // 소비 아이템 효과
  if (type === 'use') {
    const effect = await fetchUseItemEffect(itemId);
    if (effect) itemData.effect = effect;
  }

  const outputPath = saveItemData(itemData);
  console.log(`  [Item] ${itemId} ${itemData.name} -> ${outputPath}`);

  return true;
}

// ============================================================================
// Main
// ============================================================================

function mobFileExists(mobId: number): boolean {
  if (!fs.existsSync(MOBS_DIR)) return false;
  const files = fs.readdirSync(MOBS_DIR);
  return files.some((f) => f.startsWith(`${mobId}_`) && f.endsWith('.json'));
}

function itemFileExists(itemId: number): boolean {
  const type = determineItemType(itemId);
  const subDir = path.join(ITEMS_DIR, type);
  if (!fs.existsSync(subDir)) return false;
  const files = fs.readdirSync(subDir);
  return files.some((f) => f.startsWith(`${itemId}_`) && f.endsWith('.json'));
}

async function main() {
  const args = process.argv.slice(2);

  let mapIds: number[] = [];
  let manualMobIds: number[] = [];
  let skipExisting = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
맵 기반 전체 데이터 Fetcher

맵 ID를 입력하면 다음을 순차적으로 생성:
  1. 맵 데이터 JSON
  2. 해당 맵에 스폰되는 몬스터 JSON
  3. 각 몬스터가 드롭하는 아이템 JSON

사용법:
  npx tsx fetch-map-all.ts --map=MAP_ID [--mobs=MOB_ID,...]

옵션:
  --map=ID[,ID...]    맵 ID (필수)
  --mobs=ID[,ID...]   몬스터 ID 수동 지정 (API에서 몹 정보 없을 때)
  --skip-existing     기존 파일 스킵

예시:
  npx tsx fetch-map-all.ts --map=104010001
  npx tsx fetch-map-all.ts --map=105050300 --mobs=2110200,3210100,3210200
  npx tsx fetch-map-all.ts --map=104010001 --skip-existing

출력 경로:
  맵: ${MAPS_DIR}/{mapId}_{name}.json
  몹: ${MOBS_DIR}/{mobId}_{name}.json
  아이템: ${ITEMS_DIR}/{type}/{itemId}_{name}.json
      `);
      return;
    }

    if (arg.startsWith('--map=')) {
      mapIds = arg
        .split('=')[1]
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    } else if (arg.startsWith('--mobs=')) {
      manualMobIds = arg
        .split('=')[1]
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    }
  }

  if (mapIds.length === 0) {
    console.log('맵 ID를 지정해주세요. --help 로 사용법을 확인하세요.');
    return;
  }

  console.log('\n========================================');
  console.log(' 맵 기반 전체 데이터 Fetcher');
  console.log('========================================');
  console.log(`대상 맵: ${mapIds.join(', ')}`);
  if (manualMobIds.length > 0) {
    console.log(`수동 지정 몬스터: ${manualMobIds.join(', ')}`);
  }
  console.log('');

  const allMobIds = new Set<number>();
  const allItemIds = new Set<number>();

  let mapCount = 0;
  let mobCount = 0;
  let itemCount = 0;
  let mobSkipped = 0;
  let itemSkipped = 0;

  try {
    // 1단계: 맵 처리
    console.log('--- 1단계: 맵 데이터 ---');
    for (const mapId of mapIds) {
      const { mobIds } = await processMap(mapId);
      if (mobIds.length > 0) {
        mapCount++;
        mobIds.forEach((id) => allMobIds.add(id));
      }
      await delay(300);
    }

    // 수동 지정 몬스터 추가
    if (manualMobIds.length > 0) {
      console.log(`\n수동 지정 몬스터 ${manualMobIds.length}개 추가`);
      manualMobIds.forEach((id) => allMobIds.add(id));
    }

    // 2단계: 몬스터 처리
    console.log('\n--- 2단계: 몬스터 데이터 ---');
    console.log(`대상 몬스터: ${allMobIds.size}개\n`);

    for (const mobId of allMobIds) {
      // 기존 파일 스킵
      if (skipExisting && mobFileExists(mobId)) {
        mobSkipped++;
        // 드롭 아이템은 여전히 수집 (기존 몹 파일에서)
        const existingMobPath = fs.readdirSync(MOBS_DIR).find((f) => f.startsWith(`${mobId}_`));
        if (existingMobPath) {
          try {
            const existingMob = JSON.parse(fs.readFileSync(path.join(MOBS_DIR, existingMobPath), 'utf8'));
            if (existingMob.drops) {
              existingMob.drops.forEach((d: { itemId: number }) => allItemIds.add(d.itemId));
            }
          } catch { /* ignore */ }
        }
        continue;
      }

      const { itemIds } = await processMob(mobId);
      if (itemIds.length > 0) {
        mobCount++;
        itemIds.forEach((id) => allItemIds.add(id));
      }
      await delay(300);
    }

    // 3단계: 아이템 처리
    console.log('\n--- 3단계: 아이템 데이터 ---');
    console.log(`대상 아이템: ${allItemIds.size}개\n`);

    let processedItems = 0;
    for (const itemId of allItemIds) {
      // 기존 파일 스킵
      if (skipExisting && itemFileExists(itemId)) {
        itemSkipped++;
        continue;
      }

      const success = await processItem(itemId);
      if (success) {
        itemCount++;
        processedItems++;
      }
      // 진행 상황 표시 (20개마다)
      if (processedItems % 20 === 0 && processedItems > 0) {
        console.log(`  ... ${processedItems}/${allItemIds.size - itemSkipped} 처리 완료`);
      }
      await delay(100);
    }
  } finally {
    await closeDbConnection();
  }

  console.log('\n========================================');
  console.log(' 완료');
  console.log('========================================');
  console.log(`  맵: ${mapCount}개`);
  console.log(`  몬스터: ${mobCount}개` + (mobSkipped > 0 ? ` (스킵: ${mobSkipped})` : ''));
  console.log(`  아이템: ${itemCount}개` + (itemSkipped > 0 ? ` (스킵: ${itemSkipped})` : ''));
  console.log('========================================\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeDbConnection();
  process.exit(1);
});

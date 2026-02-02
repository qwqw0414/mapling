#!/usr/bin/env tsx

/**
 * 몬스터 데이터 Fetcher
 *
 * 데이터 소스:
 *   - REST API: 기본 스탯, 영문 이름, 설명
 *   - DB (drop_data): 드롭 아이템, 메소 드롭, 한글 아이템명
 *
 * 실행 방법:
 *   npx tsx fetch-mobs.ts [옵션]
 *
 * 예시:
 *   npx tsx fetch-mobs.ts --id=1210100                # 단일 몬스터
 *   npx tsx fetch-mobs.ts --id=1210100,1210101        # 여러 몬스터
 *   npx tsx fetch-mobs.ts --range=1210100-1210110     # ID 범위
 *   npx tsx fetch-mobs.ts --search="Slime"            # 이름 검색
 *   npx tsx fetch-mobs.ts --level=1-20                # 레벨 범위 (API)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

// ============================================================================
// Types
// ============================================================================

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

interface DbDropRow {
  itemid: number;
  minimum_quantity: number;
  maximum_quantity: number;
  questid: number;
  chance: number;
  itemName: string | null;
}

interface MobDrop {
  itemId: number;
  name: string;
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
}

interface MobMeso {
  amount: number;
  chance: number;
}

interface MobMeta {
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
}

interface MobData {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  meta: MobMeta;
  canJump?: boolean;
  meso?: MobMeso;
  drops: MobDrop[];
  foundAt?: number[];
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = 'https://maplestory.io/api/gms/62';
const MOBS_DIR = './src/data/mobs';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'maplestory'
};

// 보스 몬스터 ID 목록 (예시)
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
// API Functions
// ============================================================================

async function fetchMobFromApi(mobId: number): Promise<ApiMobResponse | null> {
  try {
    const url = `${API_BASE_URL}/mob/${mobId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

async function searchMobsFromApi(query: string, count: number = 50): Promise<ApiMobResponse[]> {
  try {
    const url = `${API_BASE_URL}/mob?searchFor=${encodeURIComponent(query)}&count=${count}`;
    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch {
    return [];
  }
}

// ============================================================================
// Database Functions
// ============================================================================

async function fetchDropsFromDb(mobId: number): Promise<{ drops: MobDrop[]; meso?: MobMeso }> {
  const conn = await getDbConnection();

  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `
    SELECT d.itemid, d.minimum_quantity, d.maximum_quantity, d.questid, d.chance, i.name as itemName
    FROM drop_data d
    LEFT JOIN wz_itemdata i ON d.itemid = i.itemid
    WHERE d.dropperid = ?
    ORDER BY d.chance DESC
    `,
    [mobId]
  );

  const drops: MobDrop[] = [];
  let meso: MobMeso | undefined;

  for (const row of rows as DbDropRow[]) {
    // 메소 드롭 (itemid = 0)
    if (row.itemid === 0) {
      // chance는 1,000,000 기준
      meso = {
        amount: Math.round((row.minimum_quantity + row.maximum_quantity) / 2),
        chance: Math.round((row.chance / 1000000) * 100)
      };
      continue;
    }

    // 퀘스트 아이템 제외 (옵션)
    if (row.questid > 0) {
      continue;
    }

    // 일반 드롭 아이템
    const drop: MobDrop = {
      itemId: row.itemid,
      name: row.itemName || `Unknown Item ${row.itemid}`,
      chance: parseFloat(((row.chance / 1000000) * 100).toFixed(3))
    };

    // 수량이 1이 아닌 경우만 표시
    if (row.minimum_quantity !== 1 || row.maximum_quantity !== 1) {
      drop.minQuantity = row.minimum_quantity;
      drop.maxQuantity = row.maximum_quantity;
    }

    drops.push(drop);
  }

  return { drops, meso };
}

// ============================================================================
// Data Conversion
// ============================================================================

function convertToMobData(api: ApiMobResponse, dbDrops: { drops: MobDrop[]; meso?: MobMeso }): MobData {
  const meta = api.meta || {};

  const mobData: MobData = {
    id: api.id,
    name: api.name || `Monster ${api.id}`,
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
      isBoss: BOSS_IDS.has(api.id),
      isBodyAttack: meta.isBodyAttack || false
    },
    drops: dbDrops.drops
  };

  // 영문 이름 저장
  if (api.name) {
    mobData.nameEn = api.name;
  }

  // 점프 가능 여부 (framebooks에 jump 키가 있으면 점프 가능)
  if (api.framebooks && 'jump' in api.framebooks) {
    mobData.canJump = true;
  }

  // 설명
  if (api.description) {
    // 설명에서 불필요한 부분 정리
    mobData.description = api.description
      .replace(/Lv\. :\s*\d+\\n/g, '')
      .replace(/Form :\s*\w+\\n\\n/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  }

  // 메소 드롭
  if (dbDrops.meso) {
    mobData.meso = dbDrops.meso;
  }

  // 출현 맵 (최대 10개)
  if (api.foundAt && api.foundAt.length > 0) {
    // 중복 제거
    const uniqueMaps = [...new Set(api.foundAt)];
    mobData.foundAt = uniqueMaps.slice(0, 10);
  }

  return mobData;
}

// ============================================================================
// File Operations
// ============================================================================

function generateFilename(mobId: number, name: string): string {
  const safeName = (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${mobId}_${safeName || 'unknown'}.json`;
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
      // 기존 파일 파싱 실패 시 무시
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(mobData, null, 2) + '\n', 'utf8');

  return outputPath;
}

// ============================================================================
// Main Functions
// ============================================================================

async function fetchAndSaveMob(mobId: number): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // API에서 기본 정보 가져오기
    const apiData = await fetchMobFromApi(mobId);
    if (!apiData) {
      return { success: false, error: 'API data not found' };
    }

    // DB에서 드롭 정보 가져오기
    const dbDrops = await fetchDropsFromDb(mobId);

    // 데이터 변환
    const mobData = convertToMobData(apiData, dbDrops);

    // 파일 저장
    const outputPath = saveMobData(mobData);

    return { success: true, path: outputPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function mobFileExists(mobId: number): boolean {
  if (!fs.existsSync(MOBS_DIR)) return false;
  const files = fs.readdirSync(MOBS_DIR);
  return files.some((f) => f.startsWith(`${mobId}_`) && f.endsWith('.json'));
}

async function main() {
  const args = process.argv.slice(2);

  let mobIds: number[] = [];
  let searchQuery: string | undefined;
  let skipExisting = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
몬스터 데이터 Fetcher

데이터 소스:
  - REST API: 기본 스탯, 영문 이름, 설명, 출현 맵
  - DB (drop_data): 드롭 아이템, 메소 드롭, 한글 아이템명

사용법:
  npx tsx fetch-mobs.ts [옵션]

옵션:
  --id=ID[,ID...]       특정 몬스터 ID(들) 가져오기
  --range=START-END     ID 범위로 가져오기
  --search=QUERY        이름으로 검색 (API)

예시:
  npx tsx fetch-mobs.ts --id=1210100
  npx tsx fetch-mobs.ts --id=1210100,1210101,100100
  npx tsx fetch-mobs.ts --range=1210100-1210110
  npx tsx fetch-mobs.ts --search="Slime"
  npx tsx fetch-mobs.ts --search="Mushroom" --skip-existing

출력 경로:
  ${MOBS_DIR}/{mobId}_{name}.json

참고:
  - 한글 이름은 자동 생성되지 않습니다 (기존 파일이 있으면 유지)
  - 드롭 확률은 % 단위로 변환됩니다
  - 퀘스트 아이템은 드롭 목록에서 제외됩니다
      `);
      return;
    }

    if (arg.startsWith('--id=')) {
      mobIds = arg
        .split('=')[1]
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    } else if (arg.startsWith('--range=')) {
      const range = arg.split('=')[1];
      const [start, end] = range.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          mobIds.push(i);
        }
      }
    } else if (arg.startsWith('--search=')) {
      searchQuery = arg.split('=').slice(1).join('=');
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    }
  }

  // 검색 쿼리가 있으면 API 검색
  if (searchQuery) {
    console.log(`\n검색 중: "${searchQuery}"\n`);
    const searchResults = await searchMobsFromApi(searchQuery);

    if (searchResults.length === 0) {
      console.log('검색 결과가 없습니다.');
      return;
    }

    console.log(`검색 결과: ${searchResults.length}개\n`);
    mobIds = searchResults.map((m) => m.id);
  }

  if (mobIds.length === 0) {
    console.log('옵션을 지정해주세요. --help 로 사용법을 확인하세요.');
    return;
  }

  console.log('\n[몬스터 데이터 Fetcher]\n');
  console.log(`대상: ${mobIds.length}개 몬스터\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  try {
    for (let i = 0; i < mobIds.length; i++) {
      const mobId = mobIds[i];

      // 기존 파일 스킵
      if (skipExisting && mobFileExists(mobId)) {
        skippedCount++;
        continue;
      }

      const result = await fetchAndSaveMob(mobId);

      if (result.success) {
        console.log(`[${mobId}] OK -> ${result.path}`);
        successCount++;
      } else {
        console.log(`[${mobId}] FAIL: ${result.error}`);
        failCount++;
      }

      // API 부하 방지
      if (i < mobIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  } finally {
    await closeDbConnection();
  }

  console.log(`\n========================================`);
  console.log(`완료: 총 ${mobIds.length}개`);
  console.log(`  - 성공: ${successCount}개`);
  if (skippedCount > 0) console.log(`  - 스킵: ${skippedCount}개`);
  if (failCount > 0) console.log(`  - 실패: ${failCount}개`);
  console.log(`========================================`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeDbConnection();
  process.exit(1);
});

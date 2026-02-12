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

import * as path from 'path';
import {
  MOBS_DIR,
  BOSS_IDS,
  type ApiMobResponse,
  type MobData,
  type MobDrop,
  type MobMeso,
  fetchMobFromApi,
  searchMobsFromApi,
  fetchDropsFromDb,
  closeDbConnection,
  delay,
  generateFilename,
  ensureDir,
  saveJson,
  fileExists,
} from './scripts/lib/index.js';

// ============================================================================
// Data Conversion
// ============================================================================

function convertToMobData(
  api: ApiMobResponse,
  dbDrops: { drops: MobDrop[]; meso?: MobMeso },
): MobData {
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
      isBodyAttack: meta.isBodyAttack || false,
    },
    drops: dbDrops.drops,
  };

  if (api.name) {
    mobData.nameEn = api.name;
  }

  if (api.framebooks && 'jump' in api.framebooks) {
    mobData.canJump = true;
  }

  if (api.description) {
    mobData.description = api.description
      .replace(/Lv\. :\s*\d+\\n/g, '')
      .replace(/Form :\s*\w+\\n\\n/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  }

  if (dbDrops.meso) {
    mobData.meso = dbDrops.meso;
  }

  if (api.foundAt && api.foundAt.length > 0) {
    const uniqueMaps = [...new Set(api.foundAt)];
    mobData.foundAt = uniqueMaps.slice(0, 10);
  }

  return mobData;
}

// ============================================================================
// Public API - processMob (used by fetch-map-all.ts)
// ============================================================================

/**
 * 단일 몬스터를 처리한다: API 조회 -> DB 드롭 조회 -> 변환 -> 저장
 * fetch-map-all.ts에서 재사용한다.
 *
 * @param mobId - 몬스터 ID
 * @returns 몬스터 데이터와 드롭 아이템 ID 목록
 */
export async function processMob(mobId: number): Promise<{ mobData: MobData | null; itemIds: number[] }> {
  const apiData = await fetchMobFromApi(mobId);
  if (!apiData) {
    console.log(`  [Mob] ${mobId} - API에서 정보를 찾을 수 없음`);
    return { mobData: null, itemIds: [] };
  }

  const { drops, meso, itemIds } = await fetchDropsFromDb(mobId);
  const mobData = convertToMobData(apiData, { drops, meso });

  // 저장
  ensureDir(MOBS_DIR);
  const filename = generateFilename(mobData.id, mobData.nameEn || mobData.name);
  const outputPath = path.join(MOBS_DIR, filename);
  saveJson(outputPath, mobData as unknown as Record<string, unknown>, true);

  console.log(`  [Mob] ${mobId} ${apiData.name} -> ${outputPath} (드롭: ${itemIds.length}개)`);

  return { mobData, itemIds };
}

// ============================================================================
// Main (CLI)
// ============================================================================

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

      if (skipExisting && fileExists(MOBS_DIR, mobId)) {
        skippedCount++;
        continue;
      }

      const result = await processMob(mobId);

      if (result.mobData) {
        successCount++;
      } else {
        failCount++;
      }

      if (i < mobIds.length - 1) {
        await delay(300);
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

// CLI 직접 실행 시에만 main 호출 (import 시에는 실행하지 않음)
const isDirectRun = process.argv[1]?.replace(/\.ts$/, '') === import.meta.url.replace(/^file:\/\//, '').replace(/\.ts$/, '');
if (isDirectRun) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    closeDbConnection();
    process.exit(1);
  });
}

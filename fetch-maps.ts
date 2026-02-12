#!/usr/bin/env tsx

/**
 * MapleStory.IO API에서 맵 데이터를 검색하고 JSON 파일로 저장하는 스크립트
 *
 * 실행 방법:
 *   npx tsx fetch-maps.ts [옵션]
 *
 * 예시:
 *   npx tsx fetch-maps.ts --search="Henesys"          # 이름으로 검색
 *   npx tsx fetch-maps.ts --search="Victoria Road"   # 지역명으로 검색
 *   npx tsx fetch-maps.ts --id=100000000             # ID로 단일 맵 가져오기
 *   npx tsx fetch-maps.ts --id=100000000,104010001   # 여러 ID
 */

import * as path from 'path';
import {
  MAPS_DIR,
  type ApiMapSearchResult,
  type ApiMapDetail,
  type MapData,
  fetchMapDetail,
  fetchMapSearch,
  searchMaps,
  delay,
  getMapMark,
  generateFilename,
  ensureDir,
  saveJson,
  fileExists,
  loadExistingJson,
} from './scripts/lib/index.js';

// ============================================================================
// Map-Specific Helpers
// ============================================================================

function estimateRecommendedLevel(mobs: { id: number }[]): { min: number; max: number } | undefined {
  if (!mobs || mobs.length === 0) {
    return undefined;
  }

  const minMobId = Math.min(...mobs.map((m) => m.id));

  if (minMobId < 200000) return { min: 1, max: 10 };
  if (minMobId < 1000000) return { min: 5, max: 20 };
  if (minMobId < 2000000) return { min: 10, max: 30 };
  if (minMobId < 3000000) return { min: 20, max: 50 };

  return { min: 10, max: 30 };
}

// ============================================================================
// Conversion
// ============================================================================

function convertToMapData(
  searchResult: ApiMapSearchResult,
  detail: ApiMapDetail | null,
): MapData {
  const mapData: MapData = {
    id: searchResult.id,
    name: searchResult.name,
    streetName: getMapMark(searchResult.streetName),
  };

  if (searchResult.name) {
    mapData.nameEn = searchResult.name;
  }

  mapData.mapMark = getMapMark(searchResult.streetName);

  if (detail) {
    if (detail.isTown === true) {
      mapData.isTown = true;
    }

    if (detail.backgroundMusic) {
      mapData.bgm = detail.backgroundMusic;
    }

    if (detail.mobs && detail.mobs.length > 0) {
      const mobCounts: Record<number, number> = {};
      for (const mob of detail.mobs) {
        mobCounts[mob.id] = (mobCounts[mob.id] || 0) + 1;
      }

      const totalSpawns = detail.mobs.length;
      const mobWeights = Object.entries(mobCounts).map(([id, count]) => ({
        mobId: parseInt(id, 10),
        weight: Math.round((count / totalSpawns) * 100),
      }));

      mobWeights.sort((a, b) => b.weight - a.weight);

      mapData.spawns = {
        normal: {
          mobs: mobWeights,
        },
      };

      const recommendedLevel = estimateRecommendedLevel(detail.mobs);
      if (recommendedLevel) {
        mapData.recommendedLevel = recommendedLevel;
      }
    }
  }

  return mapData;
}

// ============================================================================
// Public API - processMap (used by fetch-map-all.ts)
// ============================================================================

/**
 * 단일 맵을 처리한다: 기존 파일 확인 -> API 조회 -> 변환 -> 저장
 * fetch-map-all.ts에서 재사용한다.
 *
 * @param mapId - 맵 ID
 * @returns 맵 데이터와 해당 맵에 스폰되는 몬스터 ID 목록
 */
export async function processMap(mapId: number): Promise<{ mapData: MapData | null; mobIds: number[] }> {
  console.log(`\n[Map] ${mapId} 처리 중...`);

  // 1. 기존 파일에서 몬스터 정보 확인
  const existingMap = loadExistingJson<MapData>(MAPS_DIR, mapId);
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

  // 검색 결과를 기반으로 MapData 변환
  const searchResult: ApiMapSearchResult = {
    id: mapId,
    name: search?.name || detail?.name || `Map ${mapId}`,
    streetName: search?.streetName || detail?.streetName || '',
  };

  const mapData = convertToMapData(searchResult, detail);

  // 몬스터 ID 수집
  const mobIds = mapData.spawns?.normal.mobs.map((m) => m.mobId) || [];

  // 저장
  ensureDir(MAPS_DIR);
  const filename = generateFilename(mapData.id, mapData.nameEn || mapData.name);
  const outputPath = path.join(MAPS_DIR, filename);
  saveJson(outputPath, mapData as unknown as Record<string, unknown>);

  console.log(`  [Map] ${mapId} -> ${outputPath} (몬스터: ${mobIds.length}개)`);

  return { mapData, mobIds };
}

// ============================================================================
// Main (CLI)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  let searchQuery: string | undefined;
  let mapIds: number[] = [];
  let count = 50;
  let skipTowns = false;
  let skipNoMobs = false;
  let skipExisting = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
맵 데이터 Fetcher

사용법:
  npx tsx fetch-maps.ts [옵션]

검색 옵션:
  --search=QUERY    맵 이름 또는 지역명으로 검색
  --id=ID[,ID...]   특정 맵 ID(들) 가져오기
  --count=N         검색 결과 최대 개수 (기본: 50)

필터 옵션:
  --skip-towns      마을(isTown) 제외
  --skip-no-mobs    몬스터 없는 맵 제외
  --skip-existing   기존 파일 스킵

예시:
  npx tsx fetch-maps.ts --search="Henesys"
  npx tsx fetch-maps.ts --search="Victoria Road" --skip-towns
  npx tsx fetch-maps.ts --search="Hunting" --skip-no-mobs
  npx tsx fetch-maps.ts --id=100000000
  npx tsx fetch-maps.ts --id=100000000,104010001,104040000

출력 경로:
  ${MAPS_DIR}/{mapId}_{name}.json
      `);
      return;
    }

    if (arg.startsWith('--search=')) {
      searchQuery = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--id=')) {
      mapIds = arg
        .split('=')[1]
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    } else if (arg.startsWith('--count=')) {
      count = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--skip-towns') {
      skipTowns = true;
    } else if (arg === '--skip-no-mobs') {
      skipNoMobs = true;
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    }
  }

  if (!searchQuery && mapIds.length === 0) {
    console.log('옵션을 지정해주세요. --help 로 사용법을 확인하세요.');
    return;
  }

  console.log('\n[맵 데이터 Fetcher]\n');

  let targetMaps: ApiMapSearchResult[] = [];

  if (searchQuery) {
    targetMaps = await searchMaps(searchQuery, count);
    console.log(`검색 결과: ${targetMaps.length}개 맵\n`);
  } else if (mapIds.length > 0) {
    for (const id of mapIds) {
      const detail = await fetchMapDetail(id);
      if (detail && detail.name) {
        targetMaps.push({
          id,
          name: detail.name,
          streetName: detail.streetName || '',
        });
      } else {
        targetMaps.push({
          id,
          name: `Map ${id}`,
          streetName: '',
        });
      }
      await delay(300);
    }
  }

  if (targetMaps.length === 0) {
    console.log('검색 결과가 없습니다.');
    return;
  }

  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (let i = 0; i < targetMaps.length; i++) {
    const searchResult = targetMaps[i];

    try {
      if (skipExisting && fileExists(MAPS_DIR, searchResult.id)) {
        skippedCount++;
        continue;
      }

      const detail = await fetchMapDetail(searchResult.id);

      if (skipTowns && detail?.isTown === true) {
        skippedCount++;
        continue;
      }

      if (skipNoMobs && (!detail?.mobs || detail.mobs.length === 0)) {
        skippedCount++;
        continue;
      }

      const mapData = convertToMapData(searchResult, detail);

      ensureDir(MAPS_DIR);
      const filename = generateFilename(mapData.id, mapData.nameEn || mapData.name);
      const outputPath = path.join(MAPS_DIR, filename);
      saveJson(outputPath, mapData as unknown as Record<string, unknown>);

      const mobCount = mapData.spawns?.normal.mobs.length || 0;
      const townStr = mapData.isTown ? ' [Town]' : '';
      const mobStr = mobCount > 0 ? ` [Mobs: ${mobCount}]` : '';

      console.log(`[${searchResult.id}] ${searchResult.name}${townStr}${mobStr} -> ${outputPath}`);
      successCount++;

      await delay(300);
    } catch (error) {
      failCount++;
      console.error(`[${searchResult.id}] 오류:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n========================================`);
  console.log(`완료: 총 ${targetMaps.length}개`);
  console.log(`  - 저장: ${successCount}개`);
  if (skippedCount > 0) console.log(`  - 스킵: ${skippedCount}개`);
  if (failCount > 0) console.log(`  - 실패: ${failCount}개`);
  console.log(`========================================`);
}

// CLI 직접 실행 시에만 main 호출 (import 시에는 실행하지 않음)
const isDirectRun = process.argv[1]?.replace(/\.ts$/, '') === import.meta.url.replace(/^file:\/\//, '').replace(/\.ts$/, '');
if (isDirectRun) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

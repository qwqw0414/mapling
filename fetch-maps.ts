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

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

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
  mobs?: ApiMobSpawn[];
  npcs?: unknown[];
}

interface ApiMobSpawn {
  id: number;
  mobTime?: number;
  x?: number;
  y?: number;
}

interface MapData {
  id: number;
  name: string;
  nameEn?: string;
  streetName: string;
  mapMark?: string;
  isTown?: boolean;
  recommendedLevel?: {
    min: number;
    max: number;
  };
  bgm?: string;
  spawns?: {
    normal: {
      mobs: {
        mobId: number;
        weight: number;
      }[];
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = 'https://maplestory.io/api/gms/62';
const MAPS_DIR = './src/data/maps';

// 지역 마크 매핑 (streetName -> mapMark)
const REGION_MARKS: Record<string, string> = {
  'Victoria Road': '빅토리아 아일랜드',
  Henesys: '헤네시스',
  Perion: '페리온',
  Ellinia: '엘리니아',
  'Kerning City': '커닝시티',
  Lith: '리스항구',
  'Sleepywood': '슬리피우드',
  'Ant Tunnel': '개미굴',
  'Ossyria': '오시리아',
  'El Nath': '엘나스',
  'Orbis': '오르비스',
  'Ludibrium': '루디브리움',
  'Omega Sector': '오메가 섹터',
  'Korean Folk Town': '코리아 타운',
  'Aqua Road': '아쿠아리움',
  'Mu Lung': '무릉',
  'Herb Town': '백초마을',
  'Nihal Desert': '니할 사막',
  'Magatia': '마가티아'
};

// ============================================================================
// Helper Functions
// ============================================================================

function getMapMark(streetName: string): string {
  // 정확한 매칭
  if (REGION_MARKS[streetName]) {
    return REGION_MARKS[streetName];
  }

  // 부분 매칭
  for (const [key, value] of Object.entries(REGION_MARKS)) {
    if (streetName.includes(key) || key.includes(streetName)) {
      return value;
    }
  }

  return streetName;
}

function generateFilename(mapId: number, name: string): string {
  const safeName = (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${mapId}_${safeName || 'unknown'}.json`;
}

function estimateRecommendedLevel(mobs: ApiMobSpawn[]): { min: number; max: number } | undefined {
  if (!mobs || mobs.length === 0) {
    return undefined;
  }

  // 몬스터 ID 범위로 추정 (정확하지 않음)
  // 실제 레벨은 몬스터 데이터에서 가져와야 함
  const minMobId = Math.min(...mobs.map((m) => m.id));

  // 대략적인 추정
  if (minMobId < 200000) return { min: 1, max: 10 };
  if (minMobId < 1000000) return { min: 5, max: 20 };
  if (minMobId < 2000000) return { min: 10, max: 30 };
  if (minMobId < 3000000) return { min: 20, max: 50 };

  return { min: 10, max: 30 };
}

// ============================================================================
// API Functions
// ============================================================================

async function searchMaps(query: string, count: number = 50): Promise<ApiMapSearchResult[]> {
  const url = `${API_BASE_URL}/map?searchFor=${encodeURIComponent(query)}&count=${count}`;
  console.log(`검색 중: ${query}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return response.json();
}

async function fetchMapDetail(mapId: number): Promise<ApiMapDetail | null> {
  try {
    const url = `${API_BASE_URL}/map/${mapId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// Conversion
// ============================================================================

function convertToMapData(
  searchResult: ApiMapSearchResult,
  detail: ApiMapDetail | null
): MapData {
  const mapData: MapData = {
    id: searchResult.id,
    name: searchResult.name, // 영문 이름 (한글 이름은 수동으로 추가 필요)
    streetName: getMapMark(searchResult.streetName)
  };

  // 영문 이름 저장 (추후 한글화 시 참조용)
  if (searchResult.name) {
    mapData.nameEn = searchResult.name;
  }

  // 지역 마크
  mapData.mapMark = getMapMark(searchResult.streetName);

  // 상세 정보가 있으면 추가
  if (detail) {
    // 마을 여부
    if (detail.isTown === true) {
      mapData.isTown = true;
    }

    // BGM
    if (detail.backgroundMusic) {
      mapData.bgm = detail.backgroundMusic;
    }

    // 몬스터 스폰 정보
    if (detail.mobs && detail.mobs.length > 0) {
      // 몬스터별 등장 횟수 계산
      const mobCounts: Record<number, number> = {};
      for (const mob of detail.mobs) {
        mobCounts[mob.id] = (mobCounts[mob.id] || 0) + 1;
      }

      // 총 스폰 수
      const totalSpawns = detail.mobs.length;

      // weight 계산 (등장 비율 * 100)
      const mobWeights = Object.entries(mobCounts).map(([id, count]) => ({
        mobId: parseInt(id, 10),
        weight: Math.round((count / totalSpawns) * 100)
      }));

      // weight 순으로 정렬
      mobWeights.sort((a, b) => b.weight - a.weight);

      mapData.spawns = {
        normal: {
          mobs: mobWeights
        }
      };

      // 추천 레벨 추정
      const recommendedLevel = estimateRecommendedLevel(detail.mobs);
      if (recommendedLevel) {
        mapData.recommendedLevel = recommendedLevel;
      }
    }
  }

  return mapData;
}

// ============================================================================
// File Operations
// ============================================================================

function mapFileExists(mapId: number): boolean {
  if (!fs.existsSync(MAPS_DIR)) return false;
  const files = fs.readdirSync(MAPS_DIR);
  return files.some((f) => f.startsWith(`${mapId}_`) && f.endsWith('.json'));
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

// ============================================================================
// Main
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

  // 검색 또는 ID로 맵 목록 가져오기
  if (searchQuery) {
    targetMaps = await searchMaps(searchQuery, count);
    console.log(`검색 결과: ${targetMaps.length}개 맵\n`);
  } else if (mapIds.length > 0) {
    // ID로 직접 지정된 경우, 검색 결과 형식으로 변환
    for (const id of mapIds) {
      const detail = await fetchMapDetail(id);
      if (detail && detail.name) {
        targetMaps.push({
          id,
          name: detail.name,
          streetName: detail.streetName || ''
        });
      } else {
        // 상세 정보가 없어도 ID만으로 추가
        targetMaps.push({
          id,
          name: `Map ${id}`,
          streetName: ''
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
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
      // 기존 파일 스킵
      if (skipExisting && mapFileExists(searchResult.id)) {
        skippedCount++;
        continue;
      }

      // 상세 정보 가져오기
      const detail = await fetchMapDetail(searchResult.id);

      // 필터링
      if (skipTowns && detail?.isTown === true) {
        skippedCount++;
        continue;
      }

      if (skipNoMobs && (!detail?.mobs || detail.mobs.length === 0)) {
        skippedCount++;
        continue;
      }

      // 변환 및 저장
      const mapData = convertToMapData(searchResult, detail);
      const outputPath = saveMapData(mapData);

      const mobCount = mapData.spawns?.normal.mobs.length || 0;
      const townStr = mapData.isTown ? ' [Town]' : '';
      const mobStr = mobCount > 0 ? ` [Mobs: ${mobCount}]` : '';

      console.log(`[${searchResult.id}] ${searchResult.name}${townStr}${mobStr} -> ${outputPath}`);
      successCount++;

      // API 부하 방지
      await new Promise((resolve) => setTimeout(resolve, 300));
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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

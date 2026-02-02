// ============================================================================
// Map Data Index
// ============================================================================

import type { MapInfo, MapSpawnConfig, MobSpawnWeight, LevelRange } from '@/types/map';

// re-export types
export type { MapInfo, MapSpawnConfig, MobSpawnWeight, LevelRange };

// 확장 타입: API에서 가져온 영문 이름 포함
export interface MapData extends Omit<MapInfo, 'recommendedLevel' | 'bgm' | 'spawns'> {
  nameEn?: string;
  recommendedLevel?: LevelRange;
  bgm?: string;
  spawns?: MapSpawnConfig;
}

// ============================================================================
// Auto-import all JSON files
// ============================================================================

// Vite의 import.meta.glob을 사용하여 모든 JSON 파일 자동 로드
const mapModules = import.meta.glob<MapData>('./*.json', {
  eager: true,
  import: 'default'
});

// MapData 레코드 생성
export const MAPS: Record<number, MapData> = {};

for (const path in mapModules) {
  const map = mapModules[path];
  MAPS[map.id] = map;
}

// ============================================================================
// Getter Functions
// ============================================================================

export function getMapById(mapId: number): MapData | undefined {
  return MAPS[mapId];
}

export function getMapsByStreetName(streetName: string): MapData[] {
  return Object.values(MAPS).filter((map) => map.streetName === streetName);
}

export function getMapsByMapMark(mapMark: string): MapData[] {
  return Object.values(MAPS).filter((map) => map.mapMark === mapMark);
}

export function getHuntingMaps(): MapData[] {
  return Object.values(MAPS).filter(
    (map) => !map.isTown && map.spawns && map.spawns.normal.mobs.length > 0
  );
}

// getFieldMaps는 getHuntingMaps의 별칭
export const getFieldMaps = getHuntingMaps;

export function getTownMaps(): MapData[] {
  return Object.values(MAPS).filter((map) => map.isTown === true);
}

export function getMapsByLevelRange(level: number): MapData[] {
  return Object.values(MAPS).filter((map) => {
    if (!map.recommendedLevel) return false;
    return level >= map.recommendedLevel.min && level <= map.recommendedLevel.max;
  });
}

export function getAllMaps(): MapData[] {
  return Object.values(MAPS);
}

export function getMapCount(): number {
  return Object.keys(MAPS).length;
}

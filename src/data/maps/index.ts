import type { MapInfo } from '@/types/map';

// ============================================================================
// Map JSON Imports
// ============================================================================

import snailHuntingData from './100010000_snail-hunting.json';
import westRockyMountain4Data from './102020300_west-rocky-mountain4.json';
import westRockyPassData from './102030000_west-rocky-pass.json';
import kerningConstructionData from './103010000_kerning-construction.json';
import swampRegion1Data from './103020000_swamp-region1.json';
import subwayB3Data from './103000909_subway-b3.json';
import threeWayRoadData from './104010000_three-way-road.json';
import pigBeachData from './104010001_pig-beach.json';
import antTunnel2Data from './105050100_ant-tunnel2.json';

// ============================================================================
// Map Registry
// ============================================================================

const mapRegistry: Map<number, MapInfo> = new Map();

/**
 * JSON 데이터를 MapInfo 타입으로 변환
 */
function registerMap(data: unknown): void {
  const map = data as MapInfo;
  mapRegistry.set(map.id, map);
}

// 맵 등록
registerMap(snailHuntingData);
registerMap(westRockyMountain4Data);
registerMap(westRockyPassData);
registerMap(kerningConstructionData);
registerMap(swampRegion1Data);
registerMap(subwayB3Data);
registerMap(threeWayRoadData);
registerMap(pigBeachData);
registerMap(antTunnel2Data);

// ============================================================================
// Public API
// ============================================================================

/**
 * 맵 ID로 맵 정보 조회
 */
export function getMapById(mapId: number): MapInfo | undefined {
  return mapRegistry.get(mapId);
}

/**
 * 레벨에 맞는 사냥 가능 맵 목록 조회
 * - 캐릭터 레벨 +5까지만 입장 가능
 */
export function getAvailableMaps(characterLevel: number): MapInfo[] {
  const maxLevel = characterLevel + 5;
  return Array.from(mapRegistry.values()).filter(
    (map) => !map.isTown && map.recommendedLevel.min <= maxLevel
  );
}

/**
 * 레벨에 적합한 추천 맵 목록 조회
 */
export function getRecommendedMaps(characterLevel: number): MapInfo[] {
  return Array.from(mapRegistry.values()).filter(
    (map) =>
      !map.isTown &&
      characterLevel >= map.recommendedLevel.min &&
      characterLevel <= map.recommendedLevel.max
  );
}

/**
 * 모든 맵 목록 조회
 */
export function getAllMaps(): MapInfo[] {
  return Array.from(mapRegistry.values());
}

/**
 * 필드 맵만 조회 (타운 제외)
 */
export function getFieldMaps(): MapInfo[] {
  return Array.from(mapRegistry.values()).filter((map) => !map.isTown);
}

/**
 * 맵 개수 조회
 */
export function getMapCount(): number {
  return mapRegistry.size;
}

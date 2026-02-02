// ============================================================================
// Map Types
// ============================================================================

/**
 * 맵 기본 정보 (JSON 스키마와 일치)
 */
export interface MapInfo {
  id: number;
  name: string;
  streetName?: string;
  mapMark?: string;
  recommendedLevel?: LevelRange;
  bgm?: string;
  spawns?: MapSpawnConfig;
  isTown?: boolean;
}

// ============================================================================
// Level Range
// ============================================================================

/**
 * 적정 사냥 레벨 범위
 */
export interface LevelRange {
  min: number;
  max: number;
}

// ============================================================================
// Spawn Types
// ============================================================================

/**
 * 맵 전체 스폰 설정
 */
export interface MapSpawnConfig {
  normal: GradeSpawnConfig;
  elite?: GradeSpawnConfig;
  boss?: GradeSpawnConfig;
}

/**
 * 등급별 스폰 설정
 */
export interface GradeSpawnConfig {
  mobs: MobSpawnWeight[];
}

/**
 * 몬스터 스폰 가중치
 */
export interface MobSpawnWeight {
  mobId: number;
  weight: number;
}

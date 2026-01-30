// ============================================================================
// Game Configuration
// ============================================================================

export const GAME_CONFIG = {
  // Display (initial values, will be updated on resize)
  WIDTH: 1280,
  HEIGHT: 720,
  BACKGROUND_COLOR: 0x000000, // Black background

  // API
  API_BASE_URL: 'https://maplestory.io/api',
  API_REGION: 'GMS',
  API_VERSION: '62',

  // Combat
  BASE_ATTACK_SPEED: 1.5,

  // Progression
  STAT_POINTS_PER_LEVEL: 5,
  SKILL_POINTS_PER_LEVEL: 3,
  DEATH_EXP_PENALTY: 0.1,

  // Storage
  STORAGE_KEY: 'mapling_save',
  AUTO_SAVE_INTERVAL: 30000,
};

// ============================================================================
// Map Configuration (동적으로 업데이트됨)
// ============================================================================

export const MAP_CONFIG = {
  // 맵 크기 (반응형으로 업데이트됨)
  WIDTH: 1280,
  HEIGHT: 720,

  // 캐릭터 위치 (좌측 고정, 비율로 계산)
  CHARACTER_X: 200,

  // 몬스터 스폰 영역 (비율로 계산)
  SPAWN_AREA: {
    MIN_X: 100,
    MAX_X: 1180,
  },

  // 층(플랫폼) 기본 Y 좌표 (비율로 계산)
  PLATFORM_Y: {
    FLOOR_1: 620,
    FLOOR_2: 460,
    FLOOR_3: 300,
  },

  // 층 간 이동 시간 (ms)
  PLATFORM_MOVE_TIME: 500,
};

/**
 * Update map size based on container dimensions
 */
export function updateMapSize(width: number, height: number): void {
  MAP_CONFIG.WIDTH = width;
  MAP_CONFIG.HEIGHT = height;
  GAME_CONFIG.WIDTH = width;
  GAME_CONFIG.HEIGHT = height;

  // Update spawn area (10% margin from edges)
  MAP_CONFIG.SPAWN_AREA.MIN_X = Math.round(width * 0.08);
  MAP_CONFIG.SPAWN_AREA.MAX_X = Math.round(width * 0.92);

  // Update character position (left side)
  MAP_CONFIG.CHARACTER_X = Math.round(width * 0.15);

  // Update platform Y positions (relative to height)
  MAP_CONFIG.PLATFORM_Y.FLOOR_1 = Math.round(height * 0.86);
  MAP_CONFIG.PLATFORM_Y.FLOOR_2 = Math.round(height * 0.64);
  MAP_CONFIG.PLATFORM_Y.FLOOR_3 = Math.round(height * 0.42);
}

// ============================================================================
// Spawn Configuration
// ============================================================================

export const SPAWN_CONFIG = {
  // 맵당 최대 몬스터 수
  MAX_MONSTERS: 10,

  // 초기 스폰 비율 (시작 시 MAX_MONSTERS의 몇 %를 스폰할지)
  INITIAL_SPAWN_RATIO: 0.5,

  // 등급별 스폰 주기 (ms)
  NORMAL_INTERVAL: 2500,
  ELITE_INTERVAL: 60000,
  BOSS_INTERVAL: 300000,

  // 등급별 스폰 확률 (일반 몬스터 스폰 시)
  ELITE_CHANCE: 0.05,

  // 사망 후 리스폰 딜레이 (ms)
  RESPAWN_DELAY: 1000,
} as const;

// ============================================================================
// Monster Behavior Configuration
// ============================================================================

export const MONSTER_BEHAVIOR_CONFIG = {
  // 페이드인 시간 (ms)
  FADE_IN_DURATION: 1000,

  // 행동 변경 주기 (ms)
  ACTION_CHANGE_MIN: 1000,
  ACTION_CHANGE_MAX: 3000,

  // 이동 속도 (기본값, 몬스터별 speed로 조절됨)
  BASE_MOVE_SPEED: 1.2,

  // 점프 관련
  JUMP_VELOCITY: -8,
  GRAVITY: 0.4,

  // 체력바 표시 시간 (ms) - 피격 후 이 시간이 지나면 숨김
  HP_BAR_DISPLAY_DURATION: 3000,
} as const;

// ============================================================================
// Monster Grade Multipliers
// ============================================================================

export const MONSTER_GRADE_CONFIG = {
  normal: {
    hpMultiplier: 1,
    expMultiplier: 1,
    dropMultiplier: 1,
  },
  elite: {
    hpMultiplier: 5,
    expMultiplier: 2,
    dropMultiplier: 2,
  },
  boss: {
    hpMultiplier: 50,
    expMultiplier: 10,
    dropMultiplier: 10,
  },
} as const;

// ============================================================================
// Level Difference Penalties
// ============================================================================

export const LEVEL_PENALTY_CONFIG = [
  { minDiff: -2, maxDiff: 2, expRate: 1.0, dropRate: 1.0 },
  { minDiff: -5, maxDiff: -3, expRate: 0.5, dropRate: 1.0 },
  { minDiff: -10, maxDiff: -6, expRate: 0.1, dropRate: 0.5 },
  { minDiff: -Infinity, maxDiff: -11, expRate: 0.01, dropRate: 0.1 },
] as const;

// ============================================================================
// Audio Configuration
// ============================================================================

export const AUDIO_CONFIG = {
  // 기본 BGM 볼륨 (0.0 - 1.0)
  DEFAULT_BGM_VOLUME: 0.5,

  // 페이드 인/아웃 시간 (ms)
  FADE_DURATION: 1000,
} as const;

// ============================================================================
// Main Layout Configuration
// ============================================================================

export const LAYOUT_CONFIG = {
  // 헤더 영역 (맵 정보, 메소)
  HEADER: {
    HEIGHT: 50,
    PADDING: 15,
  },

  // 캐릭터 슬롯 영역
  PARTY_AREA: {
    HEIGHT_RATIO: 0.30, // 전체 높이의 30%
    PADDING: 10,
    SLOT_GAP: 15,
    MAX_SLOTS: 4,
  },

  // 사냥 필드 영역
  FIELD_AREA: {
    HEIGHT_RATIO: 0.55, // 전체 높이의 55%
    PADDING: 10,
  },

  // 로그 영역
  LOG_AREA: {
    HEIGHT_RATIO: 0.15, // 전체 높이의 15%
    PADDING: 10,
    MAX_ENTRIES: 10,
    FADE_START_MS: 3000,
    FADE_DURATION_MS: 2000,
  },
} as const;

export const SLOT_CONFIG = {
  // 슬롯 크기 (최소값)
  MIN_WIDTH: 180,
  MIN_HEIGHT: 180,

  // 내부 패딩
  PADDING: 10,

  // 캐릭터 스프라이트 영역
  SPRITE_HEIGHT_RATIO: 0.50,

  // 스탯 바 영역
  STAT_BAR: {
    HEIGHT: 12,
    GAP: 4,
    LABEL_WIDTH: 24,
  },

  // 스킬 슬롯 영역
  SKILL_BAR: {
    SLOT_SIZE: 28,
    SLOT_GAP: 2,
    SLOT_COUNT: 8,
  },

  // 빈 슬롯 스타일
  EMPTY_SLOT: {
    BORDER_COLOR: 0x444444,
    BACKGROUND_COLOR: 0x1a1a1a,
    PLUS_COLOR: 0x666666,
    PLUS_SIZE: 40,
  },
} as const;

// ============================================================================
// Game Configuration
// ============================================================================

export const GAME_CONFIG = {
  // Display (fixed 1280x720)
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
// Map Configuration (1280x720 고정)
// ============================================================================

export const MAP_CONFIG = {
  WIDTH: 1280,
  HEIGHT: 720,

  // 캐릭터 위치 (좌측 15%)
  CHARACTER_X: 192,

  // 몬스터 스폰 영역 (8% ~ 92%)
  SPAWN_AREA: {
    MIN_X: 102,
    MAX_X: 1178,
  },

  // 층(플랫폼) Y 좌표
  PLATFORM_Y: {
    FLOOR_1: 619,
    FLOOR_2: 461,
    FLOOR_3: 302,
  },

  // 층 간 이동 시간 (ms)
  PLATFORM_MOVE_TIME: 500,
} as const;

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
// Main Layout Configuration (좌우 7:3 분할)
// ============================================================================

export const LAYOUT_CONFIG = {
  // 좌측 패널 - 사냥터 필드 (70%)
  LEFT_PANEL: {
    WIDTH_RATIO: 0.70,
    PADDING: 15,
  },

  // 우측 패널 - 인벤토리 + 파티 (30%)
  RIGHT_PANEL: {
    WIDTH_RATIO: 0.30,
    PADDING: 10,
    // 인벤토리 영역 (우측 상단)
    INVENTORY_HEIGHT_RATIO: 0.35,
    // 파티 영역 (우측 하단)
    PARTY_HEIGHT_RATIO: 0.65,
  },

  // 맵이동 버튼 (필드 좌측 상단 오버레이)
  MAP_BUTTON: {
    PADDING: 15,
  },

  // 로그 (필드 우측 상단 오버레이)
  LOG: {
    PADDING: 10,
    MAX_WIDTH: 300,
    MAX_ENTRIES: 8,
    FADE_START_MS: 3000,
    FADE_DURATION_MS: 2000,
  },

  // 파티 슬롯 (2x2 그리드)
  PARTY_AREA: {
    PADDING: 8,
    SLOT_GAP: 8,
    MAX_SLOTS: 4,
    GRID_COLUMNS: 2,
    GRID_ROWS: 2,
  },
} as const;

export const SLOT_CONFIG = {
  // 슬롯 크기
  WIDTH: 180,
  HEIGHT: 180,

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
    SLOT_COUNT: 6,
  },

  // 빈 슬롯 스타일
  EMPTY_SLOT: {
    BORDER_COLOR: 0x444444,
    BACKGROUND_COLOR: 0x1a1a1a,
    PLUS_COLOR: 0x666666,
    PLUS_SIZE: 40,
  },
} as const;

// ============================================================================
// Inventory Configuration
// ============================================================================

export const INVENTORY_CONFIG = {
  // 탭 영역
  TAB_HEIGHT: 32,
  TAB_PADDING: 4,

  // 그리드 설정
  GRID_COLUMNS: 5,
  GRID_ROWS: 5,
  SLOT_SIZE: 36,
  SLOT_GAP: 2,

  // 레이아웃
  PADDING: 8,

  // 스타일
  BACKGROUND_COLOR: 0x1a1a1a,
  BORDER_COLOR: 0x333333,
  TAB_ACTIVE_COLOR: 0x4488ff,
  TAB_INACTIVE_COLOR: 0x444444,
  SLOT_BACKGROUND_COLOR: 0x222222,
  SLOT_BORDER_COLOR: 0x444444,

  // 메소 표시
  MESO_COLOR: 0xFFD700,
} as const;

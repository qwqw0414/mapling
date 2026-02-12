// ============================================================================
// Shared Constants for Fetch Scripts
// ============================================================================

// ============================================================================
// Database Configuration
// ============================================================================

export const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'maplestory',
};

// ============================================================================
// API URLs
// ============================================================================

export const API_BASE_URL = 'https://maplestory.io/api/gms/62';
export const WZ_API_BASE_URL = 'https://maplestory.io/api/wz/gms/62/Item/Consume';

// ============================================================================
// Output Directories
// ============================================================================

export const MAPS_DIR = './src/data/maps';
export const MOBS_DIR = './src/data/mobs';
export const ITEMS_DIR = './src/data/items';

// ============================================================================
// Region Marks (streetName -> mapMark)
// ============================================================================

export const REGION_MARKS: Record<string, string> = {
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
  Magatia: '마가티아',
};

// ============================================================================
// Boss Monster IDs
// ============================================================================

export const BOSS_IDS = new Set([
  8800000, 8800001, 8800002, // 자쿰
  8810000, 8810001,          // 혼테일
  8820000, 8820001,          // 핑크빈
  9300003, 9300012,          // 킹슬라임
  6130101,                   // 좀비 머쉬맘
  6300005,                   // 타이머
]);

// ============================================================================
// DB Stat Mapping (DB key -> JSON key)
// ============================================================================

export const STAT_MAPPING: Record<string, string> = {
  STR: 'incSTR',
  DEX: 'incDEX',
  INT: 'incINT',
  LUK: 'incLUK',
  PAD: 'incPAD',
  MAD: 'incMAD',
  PDD: 'incPDD',
  MDD: 'incMDD',
  ACC: 'incACC',
  EVA: 'incEVA',
  MHP: 'incMHP',
  MMP: 'incMMP',
  Speed: 'incSpeed',
  Jump: 'incJump',
};

// ============================================================================
// API Stat Fields (for metaInfo)
// ============================================================================

export const API_STAT_FIELDS = [
  'incSTR', 'incDEX', 'incINT', 'incLUK',
  'incPAD', 'incMAD', 'incPDD', 'incMDD',
  'incACC', 'incEVA', 'incSpeed', 'incJump',
  'incMHP', 'incMMP',
] as const;

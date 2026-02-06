// ============================================================================
// Monster Data Types (JSON Schema)
// ============================================================================

/**
 * 몬스터 기본 데이터 (JSON 파일 구조)
 */
export interface MobData {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  meta: MobMeta;
  canJump?: boolean;
  meso?: MesoDrop;
  drops: MobDrop[];
  foundAt?: number[];
}

/**
 * 몬스터 스탯 정보
 */
export interface MobMeta {
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

/**
 * 메소 드롭 정보
 */
export interface MesoDrop {
  amount: number;
  chance: number;
}

/**
 * 아이템 드롭 정보
 */
export interface MobDrop {
  itemId: number;
  name?: string;
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
}

// ============================================================================
// Monster Grade Types
// ============================================================================

export type MonsterGrade = 'normal' | 'elite' | 'boss';

// ============================================================================
// Monster Entity Types (Runtime Instance)
// ============================================================================

/**
 * 몬스터 스폰 정보 (런타임 인스턴스)
 */
export interface MonsterInfo {
  id: number;
  name: string;
  level: number;
  maxHp: number;
  grade: MonsterGrade;
}

/**
 * 필드 위 몬스터 인스턴스 상태
 */
export interface MonsterInstance {
  info: MonsterInfo;
  x: number;
  y: number;
  currentHp: number;
}

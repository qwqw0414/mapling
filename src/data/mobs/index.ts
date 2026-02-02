// ============================================================================
// Mob Data Index
// ============================================================================

import type { MobData, MobMeta, MesoDrop, MobDrop } from '@/types/monster';

// re-export types
export type { MobData, MobMeta, MesoDrop, MobDrop };

// ============================================================================
// Auto-import all JSON files
// ============================================================================

// Vite의 import.meta.glob을 사용하여 모든 JSON 파일 자동 로드
const mobModules = import.meta.glob<MobData>('./*.json', {
  eager: true,
  import: 'default'
});

// MobData 레코드 생성
export const MOBS: Record<number, MobData> = {};

for (const path in mobModules) {
  const mob = mobModules[path];
  MOBS[mob.id] = mob;
}

// ============================================================================
// Getter Functions
// ============================================================================

/**
 * 몬스터 ID로 몬스터 데이터 조회
 */
export function getMobById(mobId: number): MobData | undefined {
  return MOBS[mobId];
}

/**
 * 모든 몬스터 목록 조회
 */
export function getAllMobs(): MobData[] {
  return Object.values(MOBS);
}

/**
 * 레벨 범위로 몬스터 조회
 */
export function getMobsByLevelRange(minLevel: number, maxLevel: number): MobData[] {
  return Object.values(MOBS).filter(
    (mob) => mob.meta.level >= minLevel && mob.meta.level <= maxLevel
  );
}

/**
 * 보스 몬스터만 조회
 */
export function getBossMobs(): MobData[] {
  return Object.values(MOBS).filter((mob) => mob.meta.isBoss);
}

/**
 * 일반 몬스터만 조회
 */
export function getNormalMobs(): MobData[] {
  return Object.values(MOBS).filter((mob) => !mob.meta.isBoss);
}

/**
 * 몬스터 개수 조회
 */
export function getMobCount(): number {
  return Object.keys(MOBS).length;
}

/**
 * 몬스터 스탠드 이미지 URL 조회
 */
export function getMobStandUrl(mobId: number): string {
  return `https://maplestory.io/api/gms/62/mob/${mobId}/render/stand`;
}

/**
 * 몬스터 아이콘 URL 조회
 */
export function getMobIconUrl(mobId: number): string {
  return `https://maplestory.io/api/gms/62/mob/${mobId}/icon`;
}

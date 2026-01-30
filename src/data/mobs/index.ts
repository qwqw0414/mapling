import type { MobData } from '@/types/monster';

// ============================================================================
// Mob JSON Imports
// ============================================================================

import snailData from './100100_snail.json';
import blueSnailData from './100101_blue-snail.json';
import stumpData from './130100_stump.json';
import redSnailData from './130101_red-snail.json';
import greenMushroomData from './1110100_green-mushroom.json';
import octopusData from './1120100_octopus.json';
import axeStumpData from './1130100_axe-stump.json';
import pigData from './1210100_pig.json';
import ribbonPigData from './1210101_ribbon-pig.json';
import orangeMushroomData from './1210102_orange-mushroom.json';
import slimeData from './210100_slime.json';
import blackAntData from './2110200_black-ant.json';
import stoneGolemData from './2130100_stone-golem.json';
import hornyMushroomData from './2230101_horny-mushroom.json';
import lupinData from './2230102_lupin.json';
import timerData from './3230300_timer.json';
import plateonData from './3230301_plateon.json';
import rionerData from './4230102_rioner.json';

// ============================================================================
// Mob Registry
// ============================================================================

const mobRegistry: Map<number, MobData> = new Map();

/**
 * JSON 데이터를 MobData 타입으로 등록
 */
function registerMob(data: unknown): void {
  const mob = data as MobData;
  mobRegistry.set(mob.id, mob);
}

// 몬스터 등록
registerMob(snailData);
registerMob(blueSnailData);
registerMob(stumpData);
registerMob(redSnailData);
registerMob(greenMushroomData);
registerMob(octopusData);
registerMob(axeStumpData);
registerMob(pigData);
registerMob(ribbonPigData);
registerMob(orangeMushroomData);
registerMob(slimeData);
registerMob(blackAntData);
registerMob(stoneGolemData);
registerMob(hornyMushroomData);
registerMob(lupinData);
registerMob(timerData);
registerMob(plateonData);
registerMob(rionerData);

// ============================================================================
// Public API
// ============================================================================

/**
 * 몬스터 ID로 몬스터 데이터 조회
 */
export function getMobById(mobId: number): MobData | undefined {
  return mobRegistry.get(mobId);
}

/**
 * 모든 몬스터 목록 조회
 */
export function getAllMobs(): MobData[] {
  return Array.from(mobRegistry.values());
}

/**
 * 레벨 범위로 몬스터 조회
 */
export function getMobsByLevelRange(minLevel: number, maxLevel: number): MobData[] {
  return Array.from(mobRegistry.values()).filter(
    (mob) => mob.meta.level >= minLevel && mob.meta.level <= maxLevel
  );
}

/**
 * 몬스터 개수 조회
 */
export function getMobCount(): number {
  return mobRegistry.size;
}

/**
 * 몬스터 아이콘 URL 조회
 */
export function getMobIconUrl(mobId: number): string {
  const mob = mobRegistry.get(mobId);
  return mob?.imageUrls.icon ?? '';
}

/**
 * 몬스터 렌더 URL 조회
 */
export function getMobRenderUrl(mobId: number, animation: 'stand' | 'move' | 'hit' | 'die' = 'stand'): string {
  const mob = mobRegistry.get(mobId);
  return mob?.imageUrls[animation] ?? '';
}

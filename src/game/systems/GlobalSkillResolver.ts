import { useGlobalSkillStore } from '@/stores/globalSkillStore';
import { SPAWN_CONFIG } from '@/constants/config';

// ============================================================================
// Private Helper
// ============================================================================

function getLevel(skillId: string): number {
  return useGlobalSkillStore.getState().getSkillLevel(skillId);
}

// ============================================================================
// Field Skills
// ============================================================================

/**
 * Maximum number of monsters on the field at once.
 * Base: SPAWN_CONFIG.MAX_MONSTERS (10) + 1 per level
 */
export function getMaxMonsters(): number {
  return SPAWN_CONFIG.MAX_MONSTERS + getLevel('maxMonsters');
}

/**
 * Number of monsters to spawn per spawn tick.
 * Base: 1 + 1 per level
 */
export function getBatchSpawnCount(): number {
  return 1 + getLevel('batchSpawn');
}

/**
 * Spawn interval in milliseconds.
 * Base: SPAWN_CONFIG.NORMAL_INTERVAL (2500) - 100ms per level
 * Minimum: 500ms
 */
export function getSpawnInterval(): number {
  const reduced = SPAWN_CONFIG.NORMAL_INTERVAL - getLevel('spawnInterval') * 100;
  return Math.max(500, reduced);
}

/**
 * Initial spawn ratio when entering a map.
 * Base: SPAWN_CONFIG.INITIAL_SPAWN_RATIO (0.5) + 0.1 per level
 * Maximum: 1.0
 */
export function getInitialSpawnRatio(): number {
  const ratio = SPAWN_CONFIG.INITIAL_SPAWN_RATIO + getLevel('initialSpawnRatio') * 0.1;
  return Math.min(1.0, ratio);
}

// ============================================================================
// Reward Skills
// ============================================================================

/**
 * EXP gain multiplier.
 * Base: 1.0, +5% per level
 */
export function getExpMultiplier(): number {
  return 1.0 + getLevel('expRate') * 0.05;
}

/**
 * Meso gain multiplier.
 * Base: 1.0, +5% per level
 */
export function getMesoMultiplier(): number {
  return 1.0 + getLevel('mesoRate') * 0.05;
}

/**
 * Equip item drop rate multiplier.
 * Base: 1.0, +3% per level
 */
export function getEquipDropMultiplier(): number {
  return 1.0 + getLevel('equipDropRate') * 0.03;
}

/**
 * Use item drop rate multiplier.
 * Base: 1.0, +3% per level
 */
export function getUseDropMultiplier(): number {
  return 1.0 + getLevel('useDropRate') * 0.03;
}

/**
 * Etc item drop rate multiplier.
 * Base: 1.0, +3% per level
 */
export function getEtcDropMultiplier(): number {
  return 1.0 + getLevel('etcDropRate') * 0.03;
}

/**
 * Additional meso drop chance (additive, in percentage points).
 * Base: 0, +2% per level
 */
export function getMesoDropChanceBonus(): number {
  return getLevel('mesoDropChance') * 2;
}


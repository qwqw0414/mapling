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
 * Base: SPAWN_CONFIG.MAX_MONSTERS (5) + 1 per level (max Lv20 = 25)
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
 * Base: SPAWN_CONFIG.NORMAL_INTERVAL (10000) - 300ms per level
 * Minimum: 4000ms (max Lv20 = 10000 - 6000 = 4000)
 */
export function getSpawnInterval(): number {
  const reduced = SPAWN_CONFIG.NORMAL_INTERVAL - getLevel('spawnInterval') * 300;
  return Math.max(4000, reduced);
}

// ============================================================================
// Reward Skills
// ============================================================================

/**
 * EXP gain multiplier.
 * Base: 1.0, +50% per level (max Lv100 = x51.0)
 */
export function getExpMultiplier(): number {
  return 1.0 + getLevel('expRate') * 0.50;
}

/**
 * Meso gain multiplier.
 * Base: 1.0, +10% per level (max Lv100 = x11.0)
 */
export function getMesoMultiplier(): number {
  return 1.0 + getLevel('mesoRate') * 0.10;
}

/**
 * Equip item drop rate multiplier.
 * Base: 1.0, +50% per level (max Lv100 = x51.0)
 */
export function getEquipDropMultiplier(): number {
  return 1.0 + getLevel('equipDropRate') * 0.50;
}

/**
 * Use item drop rate multiplier.
 * Base: 1.0, +50% per level (max Lv100 = x51.0)
 */
export function getUseDropMultiplier(): number {
  return 1.0 + getLevel('useDropRate') * 0.50;
}

/**
 * Etc item drop rate multiplier.
 * Base: 1.0, +50% per level (max Lv100 = x51.0)
 */
export function getEtcDropMultiplier(): number {
  return 1.0 + getLevel('etcDropRate') * 0.50;
}

/**
 * Additional meso drop chance (additive, in percentage points).
 * Base: 0, +2% per level
 */
export function getMesoDropChanceBonus(): number {
  return getLevel('mesoDropChance') * 2;
}


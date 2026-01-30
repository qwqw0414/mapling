import { GAME_CONFIG } from '@/constants/config';
import { LEVEL_PENALTY_CONFIG } from '@/constants/config';

// ============================================================================
// Progression System
// ============================================================================

export class ProgressionSystem {
  // ============================================================================
  // Experience Calculation
  // ============================================================================

  getExpForLevel(_level: number): number {
    // TODO: Implement exp curve
    return 0;
  }

  calculateExpGain(
    baseExp: number,
    characterLevel: number,
    monsterLevel: number
  ): number {
    const levelDiff = monsterLevel - characterLevel;
    const penalty = this.getLevelPenalty(levelDiff);
    return Math.floor(baseExp * penalty.expRate);
  }

  // ============================================================================
  // Drop Rate Calculation
  // ============================================================================

  calculateDropRate(
    baseRate: number,
    characterLevel: number,
    monsterLevel: number,
    bonusDropRate: number
  ): number {
    const levelDiff = monsterLevel - characterLevel;
    const penalty = this.getLevelPenalty(levelDiff);
    return baseRate * penalty.dropRate * bonusDropRate;
  }

  // ============================================================================
  // Level Up
  // ============================================================================

  processLevelUp(currentLevel: number): {
    newLevel: number;
    statPoints: number;
    skillPoints: number;
  } {
    return {
      newLevel: currentLevel + 1,
      statPoints: GAME_CONFIG.STAT_POINTS_PER_LEVEL,
      skillPoints: GAME_CONFIG.SKILL_POINTS_PER_LEVEL,
    };
  }

  // ============================================================================
  // Death Penalty
  // ============================================================================

  calculateDeathPenalty(currentExp: number, expForLevel: number): number {
    const penalty = Math.floor(expForLevel * GAME_CONFIG.DEATH_EXP_PENALTY);
    return Math.max(0, currentExp - penalty);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getLevelPenalty(
    levelDiff: number
  ): { expRate: number; dropRate: number } {
    for (const penalty of LEVEL_PENALTY_CONFIG) {
      if (levelDiff >= penalty.minDiff && levelDiff <= penalty.maxDiff) {
        return { expRate: penalty.expRate, dropRate: penalty.dropRate };
      }
    }
    return { expRate: 1, dropRate: 1 };
  }
}

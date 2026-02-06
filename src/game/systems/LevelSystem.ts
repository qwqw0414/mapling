import type { PartyCharacter } from '@/types/party';
import { getRequiredExp, getMaxLevel } from '@/data/expTable';
import { getJobData } from '@/data/jobs';

// ============================================================================
// Types
// ============================================================================

export interface LevelUpResult {
  characterId: string;
  oldLevel: number;
  newLevel: number;
  hpGained: number;
  mpGained: number;
  statPointsGained: number;
  skillPointsGained: number;
}

export interface ExpDistributionResult {
  /** EXP each character received */
  expPerCharacter: number;
  /** Characters that leveled up */
  levelUps: LevelUpResult[];
}

// ============================================================================
// Level System
// ============================================================================

export class LevelSystem {
  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Distribute monster EXP equally among combat-mode party members
   * Processes level ups for each character
   */
  distributeExp(
    partyMembers: PartyCharacter[],
    totalExp: number,
  ): ExpDistributionResult {
    const combatMembers = partyMembers.filter((c) => c.mode === 'combat');
    if (combatMembers.length === 0) {
      return { expPerCharacter: 0, levelUps: [] };
    }

    const expPerCharacter = Math.floor(totalExp / combatMembers.length);
    const levelUps: LevelUpResult[] = [];

    for (const character of combatMembers) {
      const result = this.addExp(character, expPerCharacter);
      if (result !== null) {
        levelUps.push(result);
      }
    }

    return { expPerCharacter, levelUps };
  }

  /**
   * Add EXP to a single character and process level ups
   * Mutates the character object directly
   * @returns LevelUpResult if leveled up, null otherwise
   */
  addExp(character: PartyCharacter, amount: number): LevelUpResult | null {
    if (character.level >= getMaxLevel()) return null;

    const oldLevel = character.level;
    character.exp += amount;

    let totalHpGained = 0;
    let totalMpGained = 0;
    let totalStatPoints = 0;
    let totalSkillPoints = 0;

    // Process multiple level ups
    let requiredExp = getRequiredExp(character.level);
    while (character.exp >= requiredExp && character.level < getMaxLevel()) {
      character.exp -= requiredExp;
      character.level++;

      const gains = this.processLevelUp(character);
      totalHpGained += gains.hpGained;
      totalMpGained += gains.mpGained;
      totalStatPoints += gains.statPointsGained;
      totalSkillPoints += gains.skillPointsGained;

      requiredExp = getRequiredExp(character.level);
    }

    // Cap exp at required if max level
    if (character.level >= getMaxLevel()) {
      character.exp = 0;
    }

    if (character.level > oldLevel) {
      return {
        characterId: character.id,
        oldLevel,
        newLevel: character.level,
        hpGained: totalHpGained,
        mpGained: totalMpGained,
        statPointsGained: totalStatPoints,
        skillPointsGained: totalSkillPoints,
      };
    }

    return null;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Process a single level up: increase HP, MP, stat/skill points
   * Mutates the character object directly
   */
  private processLevelUp(
    character: PartyCharacter,
  ): {
    hpGained: number;
    mpGained: number;
    statPointsGained: number;
    skillPointsGained: number;
  } {
    const jobData = getJobData(character.job);

    // Random HP gain within job's range
    const [hpMin, hpMax] = jobData.hpGainRange;
    const hpGained = this.randomInRange(hpMin, hpMax);

    // Random MP gain within job's range + INT bonus
    const [mpMin, mpMax] = jobData.mpGainRange;
    const intBonus = Math.floor(character.stats.int / 10);
    const mpGained = this.randomInRange(mpMin, mpMax) + intBonus;

    // Apply gains
    character.maxHp += hpGained;
    character.maxMp += mpGained;
    character.hp = character.maxHp;
    character.mp = character.maxMp;
    character.statPoints += jobData.statPointsPerLevel;
    character.skillPoints += jobData.skillPointsPerLevel;

    return {
      hpGained,
      mpGained,
      statPointsGained: jobData.statPointsPerLevel,
      skillPointsGained: jobData.skillPointsPerLevel,
    };
  }

  /**
   * Generate a random integer in [min, max] inclusive
   */
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

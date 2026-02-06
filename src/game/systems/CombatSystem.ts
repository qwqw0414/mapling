import type { PartyCharacter } from '@/types/party';
import type { MobMeta } from '@/types/monster';
import { getJobData, isMagicJob } from '@/data/jobs';

// ============================================================================
// Constants
// ============================================================================

/** Default weapon attack for characters without equipment */
const DEFAULT_WEAPON_ATTACK = 15;

/** Default magic attack for characters without equipment */
const DEFAULT_MAGIC_ATTACK = 15;

/** Level difference penalty threshold */
const LEVEL_PENALTY_THRESHOLD = 5;

/** Miss rate increase per level below monster */
const MISS_RATE_PER_LEVEL = 0.05;

// ============================================================================
// Combat System (Post-Big Bang Damage Formula)
// ============================================================================

/**
 * Unified Post-BB damage formula:
 *   MaxDamage = WeaponMultiplier * ((4 * PrimaryStat) + SecondaryStat) * (Attack / 100)
 *   MinDamage = MaxDamage * Mastery
 *   FinalDamage = random(MinDamage, MaxDamage)
 */
export class CombatSystem {
  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Calculate damage dealt by a character to a monster
   * @returns damage amount and whether it was a critical hit
   */
  calculateAttackDamage(
    attacker: PartyCharacter,
    monsterMeta: MobMeta,
  ): { damage: number; isCritical: boolean; isMiss: boolean } {
    // Check for miss
    if (this.isMiss(attacker, monsterMeta)) {
      return { damage: 0, isCritical: false, isMiss: true };
    }

    const jobData = getJobData(attacker.job);
    const isMagic = isMagicJob(attacker.job);

    // Get stats
    const primaryStat = attacker.stats[jobData.primaryStat];
    const secondaryStat = attacker.stats[jobData.secondaryStat];
    const attack = isMagic
      ? (attacker.magicAttack || DEFAULT_MAGIC_ATTACK)
      : (attacker.weaponAttack || DEFAULT_WEAPON_ATTACK);

    // Post-BB formula: WeaponMultiplier * ((4 * Primary) + Secondary) * (Attack / 100)
    const maxDamage = jobData.weaponMultiplier
      * (4 * primaryStat + secondaryStat)
      * (attack / 100);

    const minDamage = maxDamage * jobData.baseMastery;

    // Random damage between min and max
    let damage = Math.floor(
      minDamage + Math.random() * (maxDamage - minDamage)
    );

    // Critical hit check
    const isCritical = Math.random() < attacker.combatStats.criticalChance;
    if (isCritical) {
      damage = Math.floor(damage * (attacker.combatStats.criticalDamage / 100));
    }

    // Apply monster defense reduction
    damage = this.applyDefenseReduction(damage, monsterMeta, isMagic);

    // Minimum 1 damage
    damage = Math.max(1, damage);

    return { damage, isCritical, isMiss: false };
  }

  /**
   * Get the attack delay for a character based on their job
   */
  getAttackDelay(character: PartyCharacter): number {
    return getJobData(character.job).attackDelay;
  }

  /**
   * Get effective attack power for display purposes
   */
  getEffectiveAttack(character: PartyCharacter): number {
    const isMagic = isMagicJob(character.job);
    return isMagic
      ? (character.magicAttack || DEFAULT_MAGIC_ATTACK)
      : (character.weaponAttack || DEFAULT_WEAPON_ATTACK);
  }

  /**
   * Calculate damage range for display (min~max)
   */
  getDamageRange(character: PartyCharacter): { min: number; max: number } {
    const jobData = getJobData(character.job);
    const isMagic = isMagicJob(character.job);

    const primaryStat = character.stats[jobData.primaryStat];
    const secondaryStat = character.stats[jobData.secondaryStat];
    const attack = isMagic
      ? (character.magicAttack || DEFAULT_MAGIC_ATTACK)
      : (character.weaponAttack || DEFAULT_WEAPON_ATTACK);

    const max = Math.floor(
      jobData.weaponMultiplier * (4 * primaryStat + secondaryStat) * (attack / 100)
    );
    const min = Math.floor(max * jobData.baseMastery);

    return { min: Math.max(1, min), max: Math.max(1, max) };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Check if the attack misses based on accuracy vs evasion
   */
  private isMiss(attacker: PartyCharacter, monsterMeta: MobMeta): boolean {
    const accuracy = attacker.combatStats.accuracy;
    const evasion = monsterMeta.evasion;

    // Hit rate = 100 + sqrt(accuracy) - sqrt(evasion)
    let hitRate = 100 + Math.sqrt(accuracy) - Math.sqrt(evasion);

    // Level penalty: -5% per level below monster
    const levelDiff = monsterMeta.level - attacker.level;
    if (levelDiff > LEVEL_PENALTY_THRESHOLD) {
      hitRate -= (levelDiff - LEVEL_PENALTY_THRESHOLD) * (MISS_RATE_PER_LEVEL * 100);
    }

    // Clamp hit rate between 1% and 100%
    hitRate = Math.max(1, Math.min(100, hitRate));

    return Math.random() * 100 > hitRate;
  }

  /**
   * Reduce damage based on monster defense
   * Post-BB: monsters have a percentage-based defense reduction
   */
  private applyDefenseReduction(
    damage: number,
    monsterMeta: MobMeta,
    isMagic: boolean,
  ): number {
    const defense = isMagic ? monsterMeta.magicDefense : monsterMeta.physicalDefense;

    // Simple percentage reduction: defense acts as flat reduction
    // Cap defense reduction at 50% to prevent zero damage
    const reduction = Math.min(defense, damage * 0.5);
    return Math.floor(damage - reduction);
  }
}

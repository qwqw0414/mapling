import type { PartyCharacter } from '@/types/party';
import type { MonsterState } from './MonsterSystem';
import type { MobData } from '@/types/monster';
import { CombatSystem } from './CombatSystem';
import { LevelSystem } from './LevelSystem';
import { getExpMultiplier } from './GlobalSkillResolver';
import type { LevelUpResult } from './LevelSystem';

// ============================================================================
// Types
// ============================================================================

export interface AttackEvent {
  characterId: string;
  targetInstanceId: string;
  damage: number;
  isCritical: boolean;
  isMiss: boolean;
}

export interface MonsterDeathEvent {
  instanceId: string;
  mobData: MobData;
  killerCharacterId: string;
}

export interface AutoCombatCallbacks {
  /** Get all alive monsters from MonsterSystem */
  getAliveMonsters: () => Map<string, MonsterState>;
  /** Get MobData by mob ID */
  getMobData: (mobId: number) => MobData | null;
  /** Called when a character attacks a monster */
  onAttack: (event: AttackEvent) => void;
  /** Called when a monster dies */
  onMonsterDeath: (event: MonsterDeathEvent) => void;
  /** Called when a character levels up */
  onLevelUp: (result: LevelUpResult) => void;
}

// ============================================================================
// Per-Character Combat State
// ============================================================================

interface CharacterCombatState {
  characterId: string;
  lastAttackTime: number;
}

// ============================================================================
// Auto Combat System
// ============================================================================

/**
 * Manages automatic combat for all party characters individually.
 * Each character in combat mode attacks at their own delay interval.
 * Target selection: random alive monster, persist until target dies.
 */
export class AutoCombatSystem {
  private readonly combatSystem: CombatSystem;
  private readonly levelSystem: LevelSystem;
  private readonly callbacks: AutoCombatCallbacks;
  private readonly combatStates: Map<string, CharacterCombatState> = new Map();

  constructor(callbacks: AutoCombatCallbacks) {
    this.combatSystem = new CombatSystem();
    this.levelSystem = new LevelSystem();
    this.callbacks = callbacks;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Main update loop - called every frame with current timestamp
   * Checks each combat-mode character and triggers attacks when ready
   */
  update(partyMembers: PartyCharacter[], currentTime: number): void {
    for (const character of partyMembers) {
      if (character.mode !== 'combat') {
        // Clear target when switching to idle
        character.targetMonsterId = null;
        this.combatStates.delete(character.id);
        continue;
      }

      this.updateCharacterCombat(character, currentTime);
    }
  }

  /**
   * Toggle character between idle and combat mode
   * @returns the new mode
   */
  toggleMode(character: PartyCharacter): 'idle' | 'combat' {
    if (character.mode === 'combat') {
      character.mode = 'idle';
      character.targetMonsterId = null;
      character.currentAnimation = 'stand';
      this.combatStates.delete(character.id);
    } else {
      character.mode = 'combat';
      this.combatStates.set(character.id, {
        characterId: character.id,
        lastAttackTime: 0,
      });
    }
    return character.mode;
  }

  /**
   * Set all characters to idle mode (e.g., when changing maps)
   */
  setAllIdle(partyMembers: PartyCharacter[]): void {
    for (const character of partyMembers) {
      character.mode = 'idle';
      character.targetMonsterId = null;
      character.currentAnimation = 'stand';
    }
    this.combatStates.clear();
  }

  /**
   * Notify that a monster has died (clear targeting for all characters)
   */
  notifyMonsterDeath(instanceId: string, partyMembers: PartyCharacter[]): void {
    for (const character of partyMembers) {
      if (character.targetMonsterId === instanceId) {
        character.targetMonsterId = null;
      }
    }
  }

  /**
   * Process EXP distribution when a monster dies
   */
  processMonsterRewards(
    partyMembers: PartyCharacter[],
    mobData: MobData,
  ): void {
    const totalExp = Math.floor(mobData.meta.exp * getExpMultiplier());
    const result = this.levelSystem.distributeExp(partyMembers, totalExp);

    for (const levelUp of result.levelUps) {
      this.callbacks.onLevelUp(levelUp);
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.combatStates.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Process combat for a single character
   */
  private updateCharacterCombat(
    character: PartyCharacter,
    currentTime: number,
  ): void {
    // Ensure combat state exists
    let state = this.combatStates.get(character.id);
    if (!state) {
      state = { characterId: character.id, lastAttackTime: 0 };
      this.combatStates.set(character.id, state);
    }

    // Check attack delay
    const attackDelay = this.combatSystem.getAttackDelay(character);
    if (currentTime - state.lastAttackTime < attackDelay) return;

    // Find or validate target
    const target = this.resolveTarget(character);
    if (!target) return;

    // Get mob data for defense calculation
    const mobData = this.callbacks.getMobData(target.mobId);
    if (!mobData) return;

    // Calculate and apply damage
    const { damage, isCritical, isMiss } = this.combatSystem.calculateAttackDamage(
      character,
      mobData.meta,
    );

    // Update attack timing
    state.lastAttackTime = currentTime;
    character.lastAttackTime = currentTime;
    character.currentAnimation = 'attack';

    // Reset to stand animation after short delay
    setTimeout(() => {
      if (character.mode === 'combat') {
        character.currentAnimation = 'stand';
      }
    }, 300);

    // Fire attack event (visual effects handled by callback)
    this.callbacks.onAttack({
      characterId: character.id,
      targetInstanceId: target.instanceId,
      damage,
      isCritical,
      isMiss,
    });

    // Check if monster died
    if (!isMiss && target.currentHp - damage <= 0) {
      this.callbacks.onMonsterDeath({
        instanceId: target.instanceId,
        mobData,
        killerCharacterId: character.id,
      });
    }
  }

  /**
   * Resolve target for a character:
   * - If current target is alive, keep it
   * - If no target or target died, pick a random alive monster
   */
  private resolveTarget(character: PartyCharacter): MonsterState | null {
    const aliveMonsters = this.callbacks.getAliveMonsters();

    // Check if current target is still valid
    if (character.targetMonsterId) {
      const currentTarget = aliveMonsters.get(character.targetMonsterId);
      if (currentTarget && !currentTarget.isDying) {
        return currentTarget;
      }
      // Target is dead or gone, clear it
      character.targetMonsterId = null;
    }

    // Pick a new random target from alive, non-dying monsters
    const validTargets: MonsterState[] = [];
    for (const monster of aliveMonsters.values()) {
      if (!monster.isDying) {
        validTargets.push(monster);
      }
    }

    if (validTargets.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * validTargets.length);
    const newTarget = validTargets[randomIndex];
    character.targetMonsterId = newTarget.instanceId;

    return newTarget;
  }
}

// ============================================================================
// Global Skill Types
// ============================================================================

export type SkillGroupId = 'field' | 'reward';

export type SkillEffectType = 'additive' | 'multiplicative';

// ============================================================================
// Skill Definition (Static Data)
// ============================================================================

export interface GlobalSkillDef {
  /** Unique skill identifier */
  id: string;

  /** Which group this skill belongs to */
  groupId: SkillGroupId;

  /** Display name */
  name: string;

  /** Effect description shown in UI */
  description: string;

  /** Maximum level this skill can reach */
  maxLevel: number;

  /** Meso cost per level-up (fixed 10000) */
  costPerLevel: number;

  /** How the effect stacks: additive or multiplicative */
  effectType: SkillEffectType;

  /** Numeric change per level */
  effectPerLevel: number;

  /** Display unit (e.g. "%", "마리", "ms") */
  unit: string;
}

// ============================================================================
// Skill Group Definition
// ============================================================================

export interface SkillGroupDef {
  id: SkillGroupId;
  name: string;
  color: number;
}

// ============================================================================
// Persisted State
// ============================================================================

/**
 * Map of skillId -> current level.
 * Missing keys are treated as level 0.
 */
export interface GlobalSkillState {
  [skillId: string]: number;
}

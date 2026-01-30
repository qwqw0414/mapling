import type { JobId } from './character';

// ============================================================================
// Skill Types
// ============================================================================

export type SkillType = 'passive' | 'active';

export type SkillTarget = 'self' | 'single_enemy' | 'all_enemies' | 'party';

export interface SkillLevelData {
  level: number;
  mpCost: number;
  damage: number;
  duration?: number;
  cooldown?: number;
  effectValue?: number;
}

export interface SkillInfo {
  id: number;
  name: string;
  description: string;
  type: SkillType;
  target: SkillTarget;
  job: JobId;
  maxLevel: number;
  requiredLevel: number;
  requiredSkills: { skillId: number; level: number }[];
  levelData: SkillLevelData[];
  iconUrl: string;
}

// ============================================================================
// Skill Instance (Character's learned skill)
// ============================================================================

export interface LearnedSkill {
  skillId: number;
  currentLevel: number;
}

// ============================================================================
// Skill Effect (Runtime)
// ============================================================================

export interface ActiveSkillEffect {
  skillId: number;
  remainingDuration: number;
  effectValue: number;
}

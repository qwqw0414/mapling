import { createStore } from 'zustand/vanilla';
import { getGlobalSkillById, getSkillLevelUpCost } from '@/data/globalSkills';
import { useCharacterStore } from './characterStore';
import type { GlobalSkillState } from '@/types/globalSkill';

// ============================================================================
// Store Types
// ============================================================================

interface GlobalSkillStoreState {
  skillLevels: GlobalSkillState;
}

interface GlobalSkillStoreActions {
  /**
   * Attempt to level up a skill by spending meso.
   * @returns true if successful, false if insufficient meso or already max level
   */
  levelUpSkill: (skillId: string) => boolean;

  /** Get the current level of a skill (0 if not learned) */
  getSkillLevel: (skillId: string) => number;

  /** Bulk-set skill levels (used when loading save data) */
  setSkillLevels: (levels: GlobalSkillState) => void;

  /** Reset all skill levels to 0 */
  reset: () => void;
}

type GlobalSkillStore = GlobalSkillStoreState & GlobalSkillStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: GlobalSkillStoreState = {
  skillLevels: {},
};

// ============================================================================
// Global Skill Store
// ============================================================================

export const useGlobalSkillStore = createStore<GlobalSkillStore>((set, get) => ({
  ...initialState,

  levelUpSkill: (skillId: string): boolean => {
    const skillDef = getGlobalSkillById(skillId);
    if (!skillDef) return false;

    const currentLevel = get().skillLevels[skillId] ?? 0;
    if (currentLevel >= skillDef.maxLevel) return false;

    // TODO: 테스트 완료 후 메소 차감 로직 복원할 것
    const cost = getSkillLevelUpCost(skillId, currentLevel);
    const charStore = useCharacterStore.getState();
    if (charStore.meso >= cost) {
      charStore.spendMeso(cost);
    }

    set((state) => ({
      skillLevels: {
        ...state.skillLevels,
        [skillId]: currentLevel + 1,
      },
    }));

    return true;
  },

  getSkillLevel: (skillId: string): number => {
    return get().skillLevels[skillId] ?? 0;
  },

  setSkillLevels: (levels: GlobalSkillState) => {
    set({ skillLevels: { ...levels } });
  },

  reset: () => set({ ...initialState, skillLevels: {} }),
}));

import { createStore } from 'zustand/vanilla';
import type { CharacterState, JobId, Stats } from '@/types/character';

// ============================================================================
// Character Store Types
// ============================================================================

interface CharacterStoreState {
  character: CharacterState | null;
  meso: number;
}

interface CharacterStoreActions {
  createCharacter: (name: string) => void;
  setCharacter: (character: CharacterState) => void;
  updateStats: (stats: Partial<Stats>) => void;
  setJob: (job: JobId) => void;
  addExp: (amount: number) => void;
  setHp: (hp: number) => void;
  setMp: (mp: number) => void;
  addMeso: (amount: number) => void;
  spendMeso: (amount: number) => boolean;
  useStatPoint: (stat: keyof Stats) => void;
  reset: () => void;
}

type CharacterStore = CharacterStoreState & CharacterStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: CharacterStoreState = {
  character: null,
  meso: 0,
};

const createInitialCharacter = (name: string): CharacterState => ({
  name,
  level: 1,
  exp: 0,
  job: 'beginner',
  stats: { str: 4, dex: 4, int: 4, luk: 4 },
  combatStats: {
    accuracy: 100,
    evasion: 0,
    criticalChance: 0,
    criticalDamage: 150,
    dropRate: 100,
  },
  statPoints: 0,
  skillPoints: 0,
  hp: 50,
  maxHp: 50,
  mp: 5,
  maxMp: 5,
});

// ============================================================================
// Character Store
// ============================================================================

export const useCharacterStore = createStore<CharacterStore>((set, get) => ({
  ...initialState,

  createCharacter: (name) =>
    set({ character: createInitialCharacter(name) }),

  setCharacter: (character) => set({ character }),

  updateStats: (stats) =>
    set((state) => {
      if (!state.character) return state;
      return {
        character: {
          ...state.character,
          stats: { ...state.character.stats, ...stats },
        },
      };
    }),

  setJob: (job) =>
    set((state) => {
      if (!state.character) return state;
      return { character: { ...state.character, job } };
    }),

  addExp: (amount) =>
    set((state) => {
      if (!state.character) return state;
      // TODO: Implement level up logic
      return {
        character: { ...state.character, exp: state.character.exp + amount },
      };
    }),

  setHp: (hp) =>
    set((state) => {
      if (!state.character) return state;
      return {
        character: {
          ...state.character,
          hp: Math.max(0, Math.min(hp, state.character.maxHp)),
        },
      };
    }),

  setMp: (mp) =>
    set((state) => {
      if (!state.character) return state;
      return {
        character: {
          ...state.character,
          mp: Math.max(0, Math.min(mp, state.character.maxMp)),
        },
      };
    }),

  addMeso: (amount) => set((state) => ({ meso: state.meso + amount })),

  spendMeso: (amount) => {
    const state = get();
    if (state.meso < amount) return false;
    set({ meso: state.meso - amount });
    return true;
  },

  useStatPoint: (stat) =>
    set((state) => {
      if (!state.character || state.character.statPoints <= 0) return state;
      return {
        character: {
          ...state.character,
          stats: {
            ...state.character.stats,
            [stat]: state.character.stats[stat] + 1,
          },
          statPoints: state.character.statPoints - 1,
        },
      };
    }),

  reset: () => set(initialState),
}));

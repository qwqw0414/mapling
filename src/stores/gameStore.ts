import { create } from 'zustand';

// ============================================================================
// Game State Types
// ============================================================================

export type GameState = 'loading' | 'title' | 'town' | 'hunting';

interface GameStoreState {
  currentState: GameState;
  currentMapId: number | null;
  isPaused: boolean;
  playTime: number;
}

interface GameStoreActions {
  setGameState: (state: GameState) => void;
  setCurrentMap: (mapId: number | null) => void;
  setPaused: (paused: boolean) => void;
  addPlayTime: (seconds: number) => void;
  reset: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: GameStoreState = {
  currentState: 'loading',
  currentMapId: null,
  isPaused: false,
  playTime: 0,
};

// ============================================================================
// Game Store
// ============================================================================

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setGameState: (state) => set({ currentState: state }),

  setCurrentMap: (mapId) => set({ currentMapId: mapId }),

  setPaused: (paused) => set({ isPaused: paused }),

  addPlayTime: (seconds) =>
    set((state) => ({ playTime: state.playTime + seconds })),

  reset: () => set(initialState),
}));

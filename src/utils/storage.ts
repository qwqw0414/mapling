import { GAME_CONFIG } from '@/constants/config';
import type { CharacterState } from '@/types/character';
import type { Equipment, InventorySlot } from '@/types/item';

// ============================================================================
// Save Data Types
// ============================================================================

export interface SaveData {
  version: string;
  timestamp: number;
  character: CharacterState | null;
  meso: number;
  equipment: Equipment;
  equipInventory: InventorySlot[];
  useInventory: InventorySlot[];
  etcInventory: InventorySlot[];
  settings: GameSettings;
  statistics: GameStatistics;
}

export interface GameSettings {
  autoPotionHpThreshold: number;
  autoPotionType: string | null;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface GameStatistics {
  totalKills: number;
  totalDeaths: number;
  playTime: number;
  highestLevel: number;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultSettings: GameSettings = {
  autoPotionHpThreshold: 30,
  autoPotionType: null,
  soundEnabled: true,
  musicEnabled: true,
};

const defaultStatistics: GameStatistics = {
  totalKills: 0,
  totalDeaths: 0,
  playTime: 0,
  highestLevel: 1,
};

// ============================================================================
// Storage Utilities
// ============================================================================

export function saveGame(data: Partial<SaveData>): boolean {
  try {
    const existingData = loadGame();
    const saveData: SaveData = {
      ...existingData,
      ...data,
      version: '0.1.0',
      timestamp: Date.now(),
    };

    localStorage.setItem(GAME_CONFIG.STORAGE_KEY, JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error('[Storage] Failed to save game:', error);
    return false;
  }
}

export function loadGame(): SaveData {
  try {
    const raw = localStorage.getItem(GAME_CONFIG.STORAGE_KEY);
    if (!raw) {
      return createEmptySaveData();
    }

    const data = JSON.parse(raw) as SaveData;
    return data;
  } catch (error) {
    console.error('[Storage] Failed to load game:', error);
    return createEmptySaveData();
  }
}

export function deleteSave(): void {
  localStorage.removeItem(GAME_CONFIG.STORAGE_KEY);
}

export function hasSaveData(): boolean {
  return localStorage.getItem(GAME_CONFIG.STORAGE_KEY) !== null;
}

// ============================================================================
// Private Helper Methods
// ============================================================================

function createEmptySaveData(): SaveData {
  return {
    version: '0.1.0',
    timestamp: 0,
    character: null,
    meso: 0,
    equipment: {
      weapon: null,
      hat: null,
      top: null,
      bottom: null,
      overall: null,
      shoes: null,
      gloves: null,
      cape: null,
      accessory: null,
      shield: null,
    },
    equipInventory: [],
    useInventory: [],
    etcInventory: [],
    settings: { ...defaultSettings },
    statistics: { ...defaultStatistics },
  };
}

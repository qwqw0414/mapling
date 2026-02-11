import { GAME_CONFIG } from '@/constants/config';
import type { CharacterState, JobId, Stats, CombatStats } from '@/types/character';
import type { Equipment, InventorySlot } from '@/types/item';
import type { PartyCharacter } from '@/types/party';
import type { LearnedSkill } from '@/types/skill';
import type { CharacterLook } from '@/data/characterLook';

// ============================================================================
// Constants
// ============================================================================

const CURRENT_SAVE_VERSION = '0.2.0';
const DEFAULT_MAP_ID = 104010001;

// ============================================================================
// Save Data Types
// ============================================================================

/**
 * Persisted character data (runtime-only fields excluded)
 * Excluded: mode, targetMonsterId, lastAttackTime, currentAnimation, isActive
 */
export interface SavedCharacter {
  id: string;
  name: string;
  level: number;
  exp: number;
  job: JobId;
  stats: Stats;
  combatStats: CombatStats;
  statPoints: number;
  skillPoints: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  weaponAttack: number;
  magicAttack: number;
  look: CharacterLook;
  equipment: Equipment;
  learnedSkills: LearnedSkill[];
  equippedSkillSlots: Array<number | null>;
}

export interface SaveData {
  version: string;
  timestamp: number;

  /** Party members (max 4, runtime fields excluded) */
  party: SavedCharacter[];

  /** Shared currency */
  meso: number;

  /** Last hunting map ID (restored on load) */
  lastMapId: number;

  /** Shared inventory */
  equipInventory: InventorySlot[];
  useInventory: InventorySlot[];
  etcInventory: InventorySlot[];

  /** User preferences */
  settings: GameSettings;

  /** Accumulated play statistics */
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
// Legacy Save Data (v0.1.0) for Migration
// ============================================================================

interface LegacySaveDataV01 {
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

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: GameSettings = {
  autoPotionHpThreshold: 30,
  autoPotionType: null,
  soundEnabled: true,
  musicEnabled: true,
};

const DEFAULT_STATISTICS: GameStatistics = {
  totalKills: 0,
  totalDeaths: 0,
  playTime: 0,
  highestLevel: 1,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Save game state to localStorage.
 * Merges partial data with existing save, then writes.
 * @returns true on success, false on failure
 */
export function saveGame(data: Partial<SaveData>): boolean {
  try {
    const existingData = loadGame();
    const saveData: SaveData = {
      ...existingData,
      ...data,
      version: CURRENT_SAVE_VERSION,
      timestamp: Date.now(),
    };

    localStorage.setItem(GAME_CONFIG.STORAGE_KEY, JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error('[Storage] Failed to save game:', error);
    return false;
  }
}

/**
 * Load game state from localStorage.
 * Applies version migration if the saved data is outdated.
 * @returns SaveData (empty defaults if no save exists or parse fails)
 */
export function loadGame(): SaveData {
  try {
    const raw = localStorage.getItem(GAME_CONFIG.STORAGE_KEY);
    if (!raw) {
      return createEmptySaveData();
    }

    const parsed = JSON.parse(raw);
    return migrateSaveData(parsed);
  } catch (error) {
    console.error('[Storage] Failed to load game:', error);
    return createEmptySaveData();
  }
}

/**
 * Delete all saved game data from localStorage
 */
export function deleteSave(): void {
  localStorage.removeItem(GAME_CONFIG.STORAGE_KEY);
}

/**
 * Check if any save data exists in localStorage
 */
export function hasSaveData(): boolean {
  return localStorage.getItem(GAME_CONFIG.STORAGE_KEY) !== null;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Convert a runtime PartyCharacter to a persistable SavedCharacter.
 * Strips runtime-only fields: mode, targetMonsterId, lastAttackTime, currentAnimation, isActive
 */
export function toSavedCharacter(character: PartyCharacter): SavedCharacter {
  return {
    id: character.id,
    name: character.name,
    level: character.level,
    exp: character.exp,
    job: character.job,
    stats: { ...character.stats },
    combatStats: { ...character.combatStats },
    statPoints: character.statPoints,
    skillPoints: character.skillPoints,
    hp: character.hp,
    maxHp: character.maxHp,
    mp: character.mp,
    maxMp: character.maxMp,
    weaponAttack: character.weaponAttack,
    magicAttack: character.magicAttack,
    look: { ...character.look, equipItemIds: [...character.look.equipItemIds] },
    equipment: { ...character.equipment },
    learnedSkills: character.learnedSkills.map((s) => ({ ...s })),
    equippedSkillSlots: [...character.equippedSkillSlots],
  };
}

/**
 * Convert a persisted SavedCharacter back to a runtime PartyCharacter.
 * All characters restore in idle mode with no combat target.
 */
export function toPartyCharacter(saved: SavedCharacter): PartyCharacter {
  return {
    ...saved,
    stats: { ...saved.stats },
    combatStats: { ...saved.combatStats },
    look: { ...saved.look, equipItemIds: [...saved.look.equipItemIds] },
    equipment: { ...saved.equipment },
    learnedSkills: saved.learnedSkills.map((s) => ({ ...s })),
    equippedSkillSlots: [...saved.equippedSkillSlots],
    // Runtime defaults -- all characters load in idle state
    isActive: true,
    mode: 'idle',
    targetMonsterId: null,
    lastAttackTime: 0,
    currentAnimation: 'stand',
  };
}

// ============================================================================
// Version Migration
// ============================================================================

/**
 * Detect save version and apply migrations as needed.
 * Supports: v0.1.0 (legacy single-character) -> v0.2.0 (party system)
 */
function migrateSaveData(raw: Record<string, unknown>): SaveData {
  const version = (raw.version as string) ?? '0.1.0';

  if (version === CURRENT_SAVE_VERSION) {
    return raw as unknown as SaveData;
  }

  if (version === '0.1.0') {
    console.log('[Storage] Migrating save data: v0.1.0 -> v0.2.0');
    return migrateV01ToV02(raw as unknown as LegacySaveDataV01);
  }

  // Unknown version -- return empty to avoid corruption
  console.warn(`[Storage] Unknown save version: [version]=[${version}], resetting`);
  return createEmptySaveData();
}

/**
 * Migrate v0.1.0 (single character + separate equipment) to v0.2.0 (party array)
 */
function migrateV01ToV02(old: LegacySaveDataV01): SaveData {
  const party: SavedCharacter[] = [];

  if (old.character) {
    const savedChar: SavedCharacter = {
      id: `char_migrated_${Date.now()}`,
      name: old.character.name,
      level: old.character.level,
      exp: old.character.exp,
      job: old.character.job,
      stats: { ...old.character.stats },
      combatStats: { ...old.character.combatStats },
      statPoints: old.character.statPoints,
      skillPoints: old.character.skillPoints,
      hp: old.character.hp,
      maxHp: old.character.maxHp,
      mp: old.character.mp,
      maxMp: old.character.maxMp,
      weaponAttack: old.character.weaponAttack,
      magicAttack: old.character.magicAttack,
      look: { skinId: 2000, hairId: 30000, faceId: 20000, equipItemIds: [] },
      equipment: old.equipment ?? createEmptyEquipment(),
      learnedSkills: [],
      equippedSkillSlots: [null, null, null, null, null, null],
    };
    party.push(savedChar);
  }

  return {
    version: CURRENT_SAVE_VERSION,
    timestamp: Date.now(),
    party,
    meso: old.meso ?? 0,
    lastMapId: DEFAULT_MAP_ID,
    equipInventory: old.equipInventory ?? [],
    useInventory: old.useInventory ?? [],
    etcInventory: old.etcInventory ?? [],
    settings: old.settings ?? { ...DEFAULT_SETTINGS },
    statistics: old.statistics ?? { ...DEFAULT_STATISTICS },
  };
}

// ============================================================================
// Private Helper Methods
// ============================================================================

function createEmptySaveData(): SaveData {
  return {
    version: CURRENT_SAVE_VERSION,
    timestamp: 0,
    party: [],
    meso: 0,
    lastMapId: DEFAULT_MAP_ID,
    equipInventory: [],
    useInventory: [],
    etcInventory: [],
    settings: { ...DEFAULT_SETTINGS },
    statistics: { ...DEFAULT_STATISTICS },
  };
}

function createEmptyEquipment(): Equipment {
  return {
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
  };
}

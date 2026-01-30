import type { CharacterState } from './character';
import type { LearnedSkill } from './skill';

// ============================================================================
// Party Types
// ============================================================================

/**
 * Party member character data
 * Extends CharacterState with additional runtime/UI data
 */
export interface PartyCharacter extends CharacterState {
  id: string;
  isActive: boolean;
  learnedSkills: LearnedSkill[];
  equippedSkillSlots: Array<number | null>;
  lastAttackTime: number;
  currentAnimation: 'stand' | 'attack' | 'hit' | 'die';
}

/**
 * Party state (max 4 characters)
 */
export interface PartyState {
  characters: Array<PartyCharacter | null>;
  sharedMeso: number;
  maxSize: number;
}

/**
 * Character slot UI state
 */
export interface CharacterSlotData {
  slotIndex: number;
  character: PartyCharacter | null;
  isHovered: boolean;
  isSelected: boolean;
}

/**
 * Create empty party state
 */
export function createEmptyParty(): PartyState {
  return {
    characters: [null, null, null, null],
    sharedMeso: 0,
    maxSize: 4,
  };
}

/**
 * Add character to party at specific slot
 */
export function addCharacterToParty(
  party: PartyState,
  character: PartyCharacter,
  slotIndex: number
): boolean {
  if (slotIndex < 0 || slotIndex >= party.maxSize) {
    return false;
  }
  
  if (party.characters[slotIndex] !== null) {
    return false;
  }
  
  party.characters[slotIndex] = character;
  return true;
}

/**
 * Remove character from party
 */
export function removeCharacterFromParty(party: PartyState, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= party.maxSize) {
    return false;
  }
  
  if (party.characters[slotIndex] === null) {
    return false;
  }
  
  party.characters[slotIndex] = null;
  return true;
}

/**
 * Get active party members (non-null)
 */
export function getActivePartyMembers(party: PartyState): PartyCharacter[] {
  return party.characters.filter((char): char is PartyCharacter => char !== null);
}

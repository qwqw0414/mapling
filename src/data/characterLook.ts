// ============================================================================
// Character Look & Animation Definitions
// ============================================================================

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * All available character animations from maplestory.io API
 * Organized by category for easy reference
 */
export const CHARACTER_ANIMATIONS = {
  // Idle / Standing
  stand1: 'stand1',
  stand2: 'stand2',
  alert: 'alert',

  // Movement (unused - reserved for future)
  // walk1: 'walk1',
  // walk2: 'walk2',
  // jump: 'jump',
  // ladder: 'ladder',
  // rope: 'rope',
  // fly: 'fly',

  // One-handed weapon attacks (swing)
  swingO1: 'swingO1',
  swingO2: 'swingO2',
  swingO3: 'swingO3',
  swingOF: 'swingOF',

  // Two-handed weapon attacks (swing)
  swingT1: 'swingT1',
  swingT2: 'swingT2',
  swingT3: 'swingT3',
  swingTF: 'swingTF',

  // Polearm attacks (swing)
  swingP1: 'swingP1',
  swingP2: 'swingP2',
  swingPF: 'swingPF',

  // One-handed stab attacks
  stabO1: 'stabO1',
  stabO2: 'stabO2',
  stabOF: 'stabOF',

  // Two-handed stab attacks
  stabT1: 'stabT1',
  stabT2: 'stabT2',
  stabTF: 'stabTF',

  // Ranged attacks
  shoot1: 'shoot1',
  shoot2: 'shoot2',
  shootF: 'shootF',

  // Other (unused - reserved for future)
  // sit: 'sit',
  // prone: 'prone',
  // proneStab: 'proneStab',
} as const;

export type CharacterAnimation = (typeof CHARACTER_ANIMATIONS)[keyof typeof CHARACTER_ANIMATIONS];

// ============================================================================
// Priority Animations (loaded first for immediate use)
// ============================================================================

/**
 * Core animations loaded immediately when a character is created
 * Weapon-specific attack animations are loaded separately via getWeaponPreloadAnimations()
 */
export const CORE_ANIMATIONS: CharacterAnimation[] = [
  'stand1',
  'stand2',
  'alert',
];

// ============================================================================
// Character Look Types
// ============================================================================

/**
 * Visual appearance of a character
 * Used to construct API URL for rendering
 */
export interface CharacterLook {
  /** Skin color ID (2000~2013) */
  skinId: number;
  /** Hair style ID (3xxxx) */
  hairId: number;
  /** Face style ID (2xxxx) */
  faceId: number;
  /** Equipped item IDs for visual display */
  equipItemIds: number[];
}

// ============================================================================
// Skin Data
// ============================================================================

export const SKIN_OPTIONS = [
  { id: 2000, name: 'Light', nameKr: '밝은 피부' },
  { id: 2001, name: 'Tanned', nameKr: '구릿빛 피부' },
  { id: 2002, name: 'Dark', nameKr: '검은 피부' },
  { id: 2003, name: 'Pale', nameKr: '창백한 피부' },
  { id: 2004, name: 'Blue', nameKr: '푸른 피부' },
  { id: 2005, name: 'White', nameKr: '하얀 피부' },
] as const;

// ============================================================================
// Default Hair / Face Options (GMS v62 era)
// ============================================================================

export const DEFAULT_HAIR_OPTIONS = [
  { id: 30030, name: 'Toben', nameKr: '토벤 헤어' },
  { id: 30020, name: 'Sammy', nameKr: '새미 헤어' },
  { id: 30000, name: 'Buzz', nameKr: '버즈 헤어' },
  { id: 31000, name: 'Sophie', nameKr: '소피 헤어' },
  { id: 31040, name: 'Calla', nameKr: '칼라 헤어' },
  { id: 31050, name: 'Ariel', nameKr: '에리얼 헤어' },
] as const;

export const DEFAULT_FACE_OPTIONS = [
  { id: 20000, name: 'Motivated Look', nameKr: '의욕적인 얼굴' },
  { id: 20001, name: 'Perplexed Stare', nameKr: '당황한 얼굴' },
  { id: 20002, name: 'Leisure Look', nameKr: '여유로운 얼굴' },
  { id: 21000, name: 'Meh Face', nameKr: '무표정한 얼굴' },
  { id: 21001, name: 'Oh! Face', nameKr: '놀란 얼굴' },
  { id: 21002, name: 'Starry Eyes', nameKr: '반짝이는 얼굴' },
] as const;

// ============================================================================
// Default Beginner Outfit
// ============================================================================

/** Default beginner equipment (no weapon visual for bare hands) */
const BEGINNER_OUTFIT = {
  top: 1040002,     // White Undershirt
  bottom: 1060002,  // Blue Jean Shorts
  shoes: 1072005,   // Blue Sneakers
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a default beginner look with random hair/face
 */
export function createDefaultLook(): CharacterLook {
  const randomHair = DEFAULT_HAIR_OPTIONS[Math.floor(Math.random() * DEFAULT_HAIR_OPTIONS.length)];
  const randomFace = DEFAULT_FACE_OPTIONS[Math.floor(Math.random() * DEFAULT_FACE_OPTIONS.length)];

  return {
    skinId: 2000,
    hairId: randomHair.id,
    faceId: randomFace.id,
    equipItemIds: [
      BEGINNER_OUTFIT.top,
      BEGINNER_OUTFIT.bottom,
      BEGINNER_OUTFIT.shoes,
    ],
  };
}

/**
 * Create a beginner look with specific hair/face choices
 */
export function createLookWithChoices(hairId: number, faceId: number): CharacterLook {
  return {
    skinId: 2000,
    hairId,
    faceId,
    equipItemIds: [
      BEGINNER_OUTFIT.top,
      BEGINNER_OUTFIT.bottom,
      BEGINNER_OUTFIT.shoes,
    ],
  };
}

/**
 * Build the items string for the maplestory.io Character API
 * Format: "{hairId},{faceId},{equipItem1},{equipItem2},..."
 */
export function buildItemsString(look: CharacterLook): string {
  const ids = [look.hairId, look.faceId, ...look.equipItemIds];
  return ids.join(',');
}

/**
 * Build a unique cache key for a character look + animation
 */
export function buildLookCacheKey(look: CharacterLook, animation: CharacterAnimation): string {
  const itemsStr = buildItemsString(look);
  return `char_v4_${look.skinId}_${itemsStr}_${animation}`;
}

// ============================================================================
// Animation Sprite Offset (per-animation position correction)
// ============================================================================

/**
 * Per-animation X/Y offset to correct sprite position shift
 * when switching between animations with different GIF sizes.
 *
 * Usage:
 *   1. Set offsets in ANIMATION_SPRITE_OFFSETS below
 *   2. Positive X = move right, Negative X = move left
 *   3. Positive Y = move down,  Negative Y = move up
 *   4. Unregistered animations use { x: 0, y: 0 } (no correction)
 */
export interface AnimationSpriteOffset {
  /** Horizontal offset in pixels (positive = right) */
  x: number;
  /** Vertical offset in pixels (positive = down) */
  y: number;
}

/**
 * Offset map for each animation type.
 * Adjust values here to fix position jumps between animations.
 *
 * Example: if swingO1 appears 5px too far right and 3px too high,
 *          set swingO1: { x: -5, y: 3 }
 */
const ANIMATION_SPRITE_OFFSETS: Partial<Record<CharacterAnimation, AnimationSpriteOffset>> = {
  // -- Idle / Standing --
  // stand1: { x: 0, y: 0 },
  // stand2: { x: 0, y: 0 },
  // alert:  { x: 0, y: 0 },

  // -- One-handed swing --
  // swingO1: { x: 0, y: 0 },
  // swingO2: { x: 0, y: 0 },
  // swingO3: { x: 0, y: 0 },
  // swingOF: { x: 0, y: 0 },

  // -- Two-handed swing --
  // swingT1: { x: 0, y: 0 },
  // swingT2: { x: 0, y: 0 },
  // swingT3: { x: 0, y: 0 },
  // swingTF: { x: 0, y: 0 },

  // -- Polearm swing --
  // swingP1: { x: 0, y: 0 },
  // swingP2: { x: 0, y: 0 },
  // swingPF: { x: 0, y: 0 },

  // -- One-handed stab --
  // stabO1: { x: 0, y: 0 },
  // stabO2: { x: 0, y: 0 },
  // stabOF: { x: 0, y: 0 },

  // -- Two-handed stab --
  // stabT1: { x: 0, y: 0 },
  // stabT2: { x: 0, y: 0 },
  // stabTF: { x: 0, y: 0 },

  // -- Ranged --
  // shoot1: { x: 0, y: 0 },
  // shoot2: { x: 0, y: 0 },
  // shootF: { x: 0, y: 0 },
};

/** Default offset when no specific offset is registered */
const DEFAULT_SPRITE_OFFSET: AnimationSpriteOffset = { x: 0, y: 0 };

/**
 * Get the sprite position offset for a given animation.
 * Returns { x: 0, y: 0 } if no offset is registered.
 * @param animation - Animation name
 */
export function getAnimationSpriteOffset(animation: CharacterAnimation): AnimationSpriteOffset {
  return ANIMATION_SPRITE_OFFSETS[animation] ?? DEFAULT_SPRITE_OFFSET;
}

// ============================================================================
// Animation Selectors (delegated to weaponAnimations.ts)
// ============================================================================

export {
  getRandomAttackAnimation,
  getWeaponIdleAnimation,
  getWeaponAnimationDef,
  getWeaponPreloadAnimations,
} from './weaponAnimations';

/**
 * Get the idle animation
 * stand1 = weaponless idle, stand2 = weapon-holding idle
 * @param hasWeapon - Whether the character has a weapon equipped
 */
export function getIdleAnimation(hasWeapon: boolean = false): CharacterAnimation {
  return hasWeapon ? 'stand2' : 'stand1';
}

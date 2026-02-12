import type { CharacterAnimation } from './characterLook';

// ============================================================================
// Constants
// ============================================================================

/** Default unarmed attack animation */
const DEFAULT_ATTACK_ANIMATION: CharacterAnimation = 'swingO1';

/** Default unarmed idle animation */
const DEFAULT_IDLE_ANIMATION: CharacterAnimation = 'stand1';

// ============================================================================
// Types
// ============================================================================

/**
 * Defines the available animations for a specific weapon category
 * Each weapon category has a distinct idle pose and set of attack motions
 */
export interface WeaponAnimationDef {
  /** Human-readable category name */
  category: string;
  /** Idle/standing animation for this weapon type */
  idleAnimation: CharacterAnimation;
  /** Available attack animations (randomly selected during combat) */
  attackAnimations: CharacterAnimation[];
}

// ============================================================================
// Weapon Animation Data
// ============================================================================

/**
 * Weapon animation definitions mapped by 4-digit item ID prefix
 *
 * MapleStory weapon ID structure: {prefix}{suffix}
 *   prefix = Math.floor(itemId / 10000)
 *   130x: One-Handed Sword      137x: Wand
 *   131x: One-Handed Axe        138x: Staff
 *   132x: One-Handed Blunt      140x: Two-Handed Sword
 *   133x: Dagger                141x: Two-Handed Axe
 *   134x: (unused)              142x: Two-Handed Blunt
 *   135x: (unused)              143x: Spear
 *   136x: (unused)              144x: Polearm
 *   145x: Bow                   147x: Claw
 *   146x: Crossbow              148x: Knuckle
 *   149x: Gun
 */
const WEAPON_ANIMATION_MAP: Record<number, WeaponAnimationDef> = {
  // ---- One-Handed Weapons (stand1, swingO series) ----
  130: {
    category: 'one-handed-sword',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingO3', 'swingOF'],
  },
  131: {
    category: 'one-handed-axe',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingO3', 'swingOF'],
  },
  132: {
    category: 'one-handed-blunt',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingO3', 'swingOF'],
  },
  133: {
    category: 'dagger',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingO3', 'stabO1', 'stabO2'],
  },

  // ---- Wand / Staff (stand1, swingO series) ----
  137: {
    category: 'wand',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingOF'],
  },
  138: {
    category: 'staff',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingOF'],
  },

  // ---- Two-Handed Weapons (stand2, swingT series) ----
  140: {
    category: 'two-handed-sword',
    idleAnimation: 'stand2',
    attackAnimations: ['swingT1', 'swingT2', 'swingT3', 'swingTF'],
  },
  141: {
    category: 'two-handed-axe',
    idleAnimation: 'stand2',
    attackAnimations: ['swingT1', 'swingT2', 'swingT3', 'swingTF'],
  },
  142: {
    category: 'two-handed-blunt',
    idleAnimation: 'stand2',
    attackAnimations: ['swingT1', 'swingT2', 'swingT3', 'swingTF'],
  },

  // ---- Spear / Polearm (stand2, swingP or swingT series) ----
  143: {
    category: 'spear',
    idleAnimation: 'stand2',
    attackAnimations: ['stabT1', 'stabT2', 'stabTF'],
  },
  144: {
    category: 'polearm',
    idleAnimation: 'stand2',
    attackAnimations: ['swingP1', 'swingP2', 'swingPF'],
  },

  // ---- Ranged Weapons ----
  145: {
    category: 'bow',
    idleAnimation: 'stand2',
    attackAnimations: ['shoot1', 'shoot2', 'shootF'],
  },
  146: {
    category: 'crossbow',
    idleAnimation: 'stand2',
    attackAnimations: ['shoot1', 'shoot2', 'shootF'],
  },
  147: {
    category: 'claw',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingOF'],
  },
  148: {
    category: 'knuckle',
    idleAnimation: 'stand1',
    attackAnimations: ['swingO1', 'swingO2', 'swingOF'],
  },
  149: {
    category: 'gun',
    idleAnimation: 'stand2',
    attackAnimations: ['shoot1', 'shoot2', 'shootF'],
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Look up the animation definition for a weapon by item ID
 * @param weaponId - Weapon item ID (e.g. 1402001)
 * @returns Animation definition, or null if not found
 */
export function getWeaponAnimationDef(weaponId: number | null): WeaponAnimationDef | null {
  if (!weaponId) return null;

  const prefix = Math.floor(weaponId / 10000);
  return WEAPON_ANIMATION_MAP[prefix] ?? null;
}

/**
 * Get the idle animation for a weapon
 * stand1 for one-handed / unarmed, stand2 for two-handed / ranged
 * @param weaponId - Weapon item ID (null for unarmed)
 */
export function getWeaponIdleAnimation(weaponId: number | null): CharacterAnimation {
  const def = getWeaponAnimationDef(weaponId);
  return def?.idleAnimation ?? DEFAULT_IDLE_ANIMATION;
}

/**
 * Get a random attack animation appropriate for the equipped weapon
 * Each call may return a different animation from the weapon's pool
 * @param weaponId - Weapon item ID (null for unarmed)
 */
export function getRandomAttackAnimation(weaponId: number | null): CharacterAnimation {
  const def = getWeaponAnimationDef(weaponId);
  if (!def) return DEFAULT_ATTACK_ANIMATION;

  const animations = def.attackAnimations;
  // const index = Math.floor(Math.random() * animations.length);
  const index = 0;
  return animations[index];
}

/**
 * Check if a weapon uses stand2 (weapon-holding) idle animation
 */
export function isWeaponStand2(weaponId: number | null): boolean {
  const def = getWeaponAnimationDef(weaponId);
  return def?.idleAnimation === 'stand2';
}

/**
 * Get all unique attack animations across all weapon categories
 * Used for preloading animations
 */
export function getAllAttackAnimations(): CharacterAnimation[] {
  const animationSet = new Set<CharacterAnimation>();

  for (const def of Object.values(WEAPON_ANIMATION_MAP)) {
    for (const anim of def.attackAnimations) {
      animationSet.add(anim);
    }
  }

  return Array.from(animationSet);
}

/**
 * Build a minimal preload list for a specific weapon
 * Returns only the idle + attack animations the weapon actually uses,
 * instead of loading all 20+ attack animations for every weapon type
 * @param weaponId - Weapon item ID (null for unarmed)
 * @returns Array of animations to preload for this weapon
 */
export function getWeaponPreloadAnimations(weaponId: number | null): CharacterAnimation[] {
  const def = getWeaponAnimationDef(weaponId);
  if (!def) return [];

  const animations: CharacterAnimation[] = [def.idleAnimation, ...def.attackAnimations];

  // Deduplicate (idleAnimation might overlap, though unlikely with attack anims)
  return Array.from(new Set(animations));
}

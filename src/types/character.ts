// ============================================================================
// Character Types
// ============================================================================

export interface Stats {
  str: number;
  dex: number;
  int: number;
  luk: number;
}

export interface CombatStats {
  accuracy: number;
  evasion: number;
  criticalChance: number;
  criticalDamage: number;
  dropRate: number;
}

/** Character interaction mode */
export type CharacterMode = 'idle' | 'combat';

export interface CharacterState {
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
  /** Base weapon attack power (from equipment, or default if none) */
  weaponAttack: number;
  /** Base magic attack power (from equipment, or default if none) */
  magicAttack: number;
}

// ============================================================================
// Job Types
// ============================================================================

export type JobBranch = 'warrior' | 'magician' | 'archer' | 'thief' | 'pirate';

export type JobId =
  // Beginner
  | 'beginner'
  // Warrior
  | 'warrior'
  | 'fighter'
  | 'crusader'
  | 'hero'
  | 'page'
  | 'knight'
  | 'paladin'
  | 'spearman'
  | 'dragon_knight'
  | 'dark_knight'
  // Magician
  | 'magician'
  | 'wizard_fp'
  | 'mage_fp'
  | 'archmage_fp'
  | 'wizard_il'
  | 'mage_il'
  | 'archmage_il'
  | 'cleric'
  | 'priest'
  | 'bishop'
  // Archer
  | 'archer'
  | 'hunter'
  | 'ranger'
  | 'bowmaster'
  | 'crossbowman'
  | 'sniper'
  | 'marksman'
  // Thief
  | 'thief'
  | 'assassin'
  | 'hermit'
  | 'night_lord'
  | 'bandit'
  | 'chief_bandit'
  | 'shadower'
  // Pirate
  | 'pirate'
  | 'infighter'
  | 'buccaneer'
  | 'viper'
  | 'gunslinger'
  | 'valkyrie'
  | 'captain';

export interface JobInfo {
  id: JobId;
  name: string;
  branch: JobBranch | null;
  advancement: number;
  requiredLevel: number;
  primaryStat: keyof Stats;
  previousJob: JobId | null;
}

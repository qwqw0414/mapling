// ============================================================================
// Shared Types for Fetch Scripts
// ============================================================================

import type * as mysql from 'mysql2/promise';

// ============================================================================
// Common Types
// ============================================================================

export type ItemType = 'equip' | 'use' | 'setup' | 'etc' | 'cash';

// ============================================================================
// Map Types
// ============================================================================

export interface ApiMapSearchResult {
  id: number;
  name: string;
  streetName: string;
}

export interface ApiMapDetail {
  id?: number;
  name?: string;
  streetName?: string;
  backgroundMusic?: string;
  isTown?: boolean;
  returnMap?: number;
  mobs?: { id: number; mobTime?: number; x?: number; y?: number }[];
  npcs?: unknown[];
}

export interface MapData {
  id: number;
  name: string;
  nameEn?: string;
  streetName: string;
  mapMark?: string;
  isTown?: boolean;
  recommendedLevel?: { min: number; max: number };
  bgm?: string;
  spawns?: {
    normal: {
      mobs: { mobId: number; weight: number }[];
    };
  };
}

// ============================================================================
// Mob Types
// ============================================================================

export interface ApiMobResponse {
  id: number;
  name?: string;
  description?: string;
  meta?: {
    isBodyAttack?: boolean;
    level?: number;
    maxHP?: number;
    maxMP?: number;
    physicalDamage?: number;
    physicalDefense?: number;
    magicDamage?: number;
    magicDefense?: number;
    accuracy?: number;
    evasion?: number;
    exp?: number;
    speed?: number;
  };
  framebooks?: Record<string, number>;
  foundAt?: number[];
}

export interface MobDrop {
  itemId: number;
  name: string;
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface MobMeso {
  amount: number;
  chance: number;
}

export interface MobMeta {
  level: number;
  maxHp: number;
  maxMp: number;
  exp: number;
  speed: number;
  physicalDamage: number;
  physicalDefense: number;
  magicDamage: number;
  magicDefense: number;
  accuracy: number;
  evasion: number;
  isBoss: boolean;
  isBodyAttack: boolean;
}

export interface MobData {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  meta: MobMeta;
  canJump?: boolean;
  meso?: MobMeso;
  drops: MobDrop[];
  foundAt?: number[];
}

// ============================================================================
// Item Types
// ============================================================================

export interface ApiItemResponse {
  id: number;
  name?: string;
  description?: { name?: string; description?: string } | string;
  metaInfo?: {
    price?: number;
    reqLevel?: number;
    reqJob?: number;
    slotMax?: number;
    tuc?: number;
    cash?: boolean;
    only?: boolean;
    quest?: boolean;
    tradeBlock?: boolean;
    notSale?: boolean;
    incSTR?: number;
    incDEX?: number;
    incINT?: number;
    incLUK?: number;
    incPAD?: number;
    incMAD?: number;
    incPDD?: number;
    incMDD?: number;
    incEVA?: number;
    incACC?: number;
    incSpeed?: number;
    incJump?: number;
    incMHP?: number;
    incMMP?: number;
  };
  typeInfo?: {
    overallCategory?: string;
    category?: string;
    subCategory?: string;
  };
}

export interface UseEffect {
  hp?: number;
  mp?: number;
  hpR?: number;
  mpR?: number;
  pad?: number;
  mad?: number;
  pdd?: number;
  mdd?: number;
  acc?: number;
  eva?: number;
  speed?: number;
  jump?: number;
  time?: number;
  success?: number;
  incSTR?: number;
  incDEX?: number;
  incINT?: number;
  incLUK?: number;
  incPAD?: number;
  incMAD?: number;
  incPDD?: number;
  incMDD?: number;
  incACC?: number;
  incEVA?: number;
  incMHP?: number;
  incMMP?: number;
  incSpeed?: number;
  incJump?: number;
  attackPower?: number;
}

export interface ItemData {
  id: number;
  name: string;
  nameEn?: string;
  description: string;
  type: ItemType;
  category: string;
  subCategory?: string;
  slot?: string;
  rarity: string;
  price: number;
  sellable: boolean;
  tradeable: boolean;
  stackSize: number;
  upgradeSlots?: number;
  only?: boolean;
  quest?: boolean;
  isCash?: boolean;
  requiredLevel?: number;
  requiredJob?: number;
  icon?: string;
  stats?: Record<string, number>;
  effect?: UseEffect | Record<string, number>;
}

// ============================================================================
// DB Types
// ============================================================================

export interface DbItemRow {
  itemid: number;
  name: string | null;
  msg: string | null;
  desc: string | null;
  slotMax: number;
  price: string;
  wholePrice: number;
  karma: number;
  questId: number;
}

export interface DbEquipStat {
  key: string;
  value: number;
}

export interface DbItemData {
  name: string;
  description: string;
  price: number;
  stackSize: number;
  tradeable: boolean;
  questId: number;
  stats?: Record<string, number>;
  upgradeSlots?: number;
  requiredLevel?: number;
  requiredJob?: number;
  isCash?: boolean;
}

export interface DbDropRow {
  itemid: number;
  minimum_quantity: number;
  maximum_quantity: number;
  questid: number;
  chance: number;
  itemName: string | null;
}

export interface WzNode {
  children: string[];
  type: number;
  value?: number | string;
}

// ============================================================================
// Re-export mysql types for convenience
// ============================================================================

export type { mysql };

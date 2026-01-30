import type { Stats, CombatStats } from './character';

// ============================================================================
// Item Types
// ============================================================================

export type ItemCategory = 'equip' | 'use' | 'etc';

export type EquipSlot =
  | 'weapon'
  | 'hat'
  | 'top'
  | 'bottom'
  | 'overall'
  | 'shoes'
  | 'gloves'
  | 'cape'
  | 'accessory'
  | 'shield';

export type ItemGrade = 'common' | 'rare' | 'epic' | 'unique';

// ============================================================================
// Item Interfaces
// ============================================================================

export interface BaseItem {
  id: number;
  name: string;
  description: string;
  category: ItemCategory;
  iconUrl: string;
  sellPrice: number;
}

export interface EquipItem extends BaseItem {
  category: 'equip';
  slot: EquipSlot;
  grade: ItemGrade;
  requiredLevel: number;
  requiredJob: string[];
  stats: Partial<Stats>;
  combatStats: Partial<CombatStats>;
  attackPower: number;
  magicPower: number;
  defense: number;
  upgradeSlots: number;
  usedSlots: number;
}

export interface UseItem extends BaseItem {
  category: 'use';
  effect: ItemEffect;
  maxStack: number;
}

export interface EtcItem extends BaseItem {
  category: 'etc';
  maxStack: number;
}

export type Item = EquipItem | UseItem | EtcItem;

// ============================================================================
// Item Effects
// ============================================================================

export interface ItemEffect {
  type: 'heal_hp' | 'heal_mp' | 'heal_both' | 'buff';
  value: number;
  duration?: number;
}

// ============================================================================
// Scroll Types
// ============================================================================

export interface ScrollItem extends EtcItem {
  successRate: number;
  statBonus: Partial<Stats & { attackPower: number; magicPower: number; defense: number }>;
  canDestroy: boolean;
  targetSlot: EquipSlot;
}

// ============================================================================
// Inventory Types
// ============================================================================

export interface InventorySlot {
  item: Item;
  quantity: number;
}

export interface Equipment {
  weapon: EquipItem | null;
  hat: EquipItem | null;
  top: EquipItem | null;
  bottom: EquipItem | null;
  overall: EquipItem | null;
  shoes: EquipItem | null;
  gloves: EquipItem | null;
  cape: EquipItem | null;
  accessory: EquipItem | null;
  shield: EquipItem | null;
}

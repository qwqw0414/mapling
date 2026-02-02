import { createStore } from 'zustand/vanilla';
import type { Item, Equipment, EquipItem, EquipSlot, InventorySlot } from '@/types/item';

// ============================================================================
// Inventory Store Types
// ============================================================================

interface InventoryStoreState {
  equipment: Equipment;
  equipInventory: InventorySlot[];
  useInventory: InventorySlot[];
  etcInventory: InventorySlot[];
  maxSlots: number;
}

interface InventoryStoreActions {
  equipItem: (item: EquipItem) => EquipItem | null;
  unequipItem: (slot: EquipSlot) => boolean;
  addItem: (item: Item, quantity?: number) => boolean;
  removeItem: (itemId: number, quantity?: number) => boolean;
  getItem: (itemId: number) => InventorySlot | undefined;
  hasItem: (itemId: number, quantity?: number) => boolean;
  reset: () => void;
}

type InventoryStore = InventoryStoreState & InventoryStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialEquipment: Equipment = {
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

const initialState: InventoryStoreState = {
  equipment: { ...initialEquipment },
  equipInventory: [],
  useInventory: [],
  etcInventory: [],
  maxSlots: 24,
};

// ============================================================================
// Inventory Store
// ============================================================================

export const useInventoryStore = createStore<InventoryStore>((set, get) => ({
  ...initialState,

  equipItem: (item) => {
    const state = get();
    const previousItem = state.equipment[item.slot];

    set((s) => ({
      equipment: { ...s.equipment, [item.slot]: item },
      equipInventory: s.equipInventory.filter((slot) => slot.item.id !== item.id),
    }));

    return previousItem;
  },

  unequipItem: (slot) => {
    const state = get();
    const item = state.equipment[slot];
    if (!item) return false;

    if (state.equipInventory.length >= state.maxSlots) return false;

    set((s) => ({
      equipment: { ...s.equipment, [slot]: null },
      equipInventory: [...s.equipInventory, { item, quantity: 1 }],
    }));

    return true;
  },

  addItem: (item, quantity = 1) => {
    const state = get();
    const inventory =
      item.category === 'equip'
        ? 'equipInventory'
        : item.category === 'use'
          ? 'useInventory'
          : 'etcInventory';

    const existingSlot = state[inventory].find((slot) => slot.item.id === item.id);

    if (existingSlot && item.category !== 'equip') {
      set((s) => ({
        [inventory]: s[inventory].map((slot) =>
          slot.item.id === item.id
            ? { ...slot, quantity: slot.quantity + quantity }
            : slot
        ),
      }));
      return true;
    }

    if (state[inventory].length >= state.maxSlots) return false;

    set((s) => ({
      [inventory]: [...s[inventory], { item, quantity }],
    }));

    return true;
  },

  removeItem: (itemId, quantity = 1) => {
    const state = get();

    for (const inventoryKey of ['equipInventory', 'useInventory', 'etcInventory'] as const) {
      const inventory = state[inventoryKey];
      const slotIndex = inventory.findIndex((slot) => slot.item.id === itemId);

      if (slotIndex !== -1) {
        const slot = inventory[slotIndex];
        if (slot.quantity < quantity) return false;

        set((s) => ({
          [inventoryKey]:
            slot.quantity === quantity
              ? s[inventoryKey].filter((_, i) => i !== slotIndex)
              : s[inventoryKey].map((s, i) =>
                i === slotIndex ? { ...s, quantity: s.quantity - quantity } : s
              ),
        }));

        return true;
      }
    }

    return false;
  },

  getItem: (itemId) => {
    const state = get();
    for (const inventoryKey of ['equipInventory', 'useInventory', 'etcInventory'] as const) {
      const slot = state[inventoryKey].find((s) => s.item.id === itemId);
      if (slot) return slot;
    }
    return undefined;
  },

  hasItem: (itemId, quantity = 1) => {
    const slot = get().getItem(itemId);
    return slot !== undefined && slot.quantity >= quantity;
  },

  reset: () => set(initialState),
}));

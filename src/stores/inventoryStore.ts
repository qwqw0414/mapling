import { createStore } from 'zustand/vanilla';
import type { Item, Equipment, EquipItem, EquipSlot, InventorySlot } from '@/types/item';

// ============================================================================
// Inventory Store Types
// ============================================================================

// Fixed-size inventory array with null for empty slots
type InventoryArray = (InventorySlot | null)[];

interface InventoryStoreState {
  equipment: Equipment;
  equipInventory: InventoryArray;
  useInventory: InventoryArray;
  etcInventory: InventoryArray;
  maxSlots: number;
}

interface InventoryStoreActions {
  equipItem: (item: EquipItem) => EquipItem | null;
  unequipItem: (slot: EquipSlot) => boolean;
  addItem: (item: Item, quantity?: number) => boolean;
  removeItem: (itemId: number, quantity?: number) => boolean;
  getItem: (itemId: number) => InventorySlot | undefined;
  hasItem: (itemId: number, quantity?: number) => boolean;
  swapItems: (category: 'equip' | 'use' | 'etc', fromIndex: number, toIndex: number) => void;
  getInventoryItems: (category: 'equip' | 'use' | 'etc') => InventorySlot[];
  reset: () => void;
}

type InventoryStore = InventoryStoreState & InventoryStoreActions;

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyInventory(size: number): InventoryArray {
  return new Array(size).fill(null);
}

function findFirstEmptySlot(inventory: InventoryArray): number {
  return inventory.findIndex((slot) => slot === null);
}

function findItemSlot(inventory: InventoryArray, itemId: number): number {
  return inventory.findIndex((slot) => slot !== null && slot.item.id === itemId);
}

// ============================================================================
// Initial State
// ============================================================================

const MAX_SLOTS = 24;

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
  equipInventory: createEmptyInventory(MAX_SLOTS),
  useInventory: createEmptyInventory(MAX_SLOTS),
  etcInventory: createEmptyInventory(MAX_SLOTS),
  maxSlots: MAX_SLOTS,
};

// ============================================================================
// Inventory Store
// ============================================================================

export const useInventoryStore = createStore<InventoryStore>((set, get) => ({
  ...initialState,

  equipItem: (item) => {
    const state = get();
    const previousItem = state.equipment[item.slot];

    // Find and remove item from inventory
    const slotIndex = findItemSlot(state.equipInventory, item.id);

    set((s) => {
      const newInventory = [...s.equipInventory];
      if (slotIndex !== -1) {
        newInventory[slotIndex] = null;
      }
      return {
        equipment: { ...s.equipment, [item.slot]: item },
        equipInventory: newInventory,
      };
    });

    return previousItem;
  },

  unequipItem: (slot) => {
    const state = get();
    const item = state.equipment[slot];
    if (!item) return false;

    const emptySlot = findFirstEmptySlot(state.equipInventory);
    if (emptySlot === -1) return false;

    set((s) => {
      const newInventory = [...s.equipInventory];
      newInventory[emptySlot] = { item, quantity: 1 };
      return {
        equipment: { ...s.equipment, [slot]: null },
        equipInventory: newInventory,
      };
    });

    return true;
  },

  addItem: (item, quantity = 1) => {
    const state = get();
    const inventoryKey =
      item.category === 'equip'
        ? 'equipInventory'
        : item.category === 'use'
          ? 'useInventory'
          : 'etcInventory';

    const inventory = state[inventoryKey];

    // For stackable items, try to find existing stack first
    if (item.category !== 'equip') {
      const existingSlotIndex = findItemSlot(inventory, item.id);
      if (existingSlotIndex !== -1) {
        set((s) => {
          const newInventory = [...s[inventoryKey]];
          const existing = newInventory[existingSlotIndex];
          if (existing) {
            newInventory[existingSlotIndex] = {
              ...existing,
              quantity: existing.quantity + quantity,
            };
          }
          return { [inventoryKey]: newInventory };
        });
        return true;
      }
    }

    // Find first empty slot
    const emptySlot = findFirstEmptySlot(inventory);
    if (emptySlot === -1) return false;

    set((s) => {
      const newInventory = [...s[inventoryKey]];
      newInventory[emptySlot] = { item, quantity };
      return { [inventoryKey]: newInventory };
    });

    return true;
  },

  removeItem: (itemId, quantity = 1) => {
    const state = get();

    for (const inventoryKey of ['equipInventory', 'useInventory', 'etcInventory'] as const) {
      const inventory = state[inventoryKey];
      const slotIndex = findItemSlot(inventory, itemId);

      if (slotIndex !== -1) {
        const slot = inventory[slotIndex];
        if (!slot || slot.quantity < quantity) return false;

        set((s) => {
          const newInventory = [...s[inventoryKey]];
          if (slot.quantity === quantity) {
            newInventory[slotIndex] = null;
          } else {
            newInventory[slotIndex] = {
              ...slot,
              quantity: slot.quantity - quantity,
            };
          }
          return { [inventoryKey]: newInventory };
        });

        return true;
      }
    }

    return false;
  },

  getItem: (itemId) => {
    const state = get();
    for (const inventoryKey of ['equipInventory', 'useInventory', 'etcInventory'] as const) {
      const slot = state[inventoryKey].find((s) => s !== null && s.item.id === itemId);
      if (slot) return slot;
    }
    return undefined;
  },

  hasItem: (itemId, quantity = 1) => {
    const slot = get().getItem(itemId);
    return slot !== undefined && slot.quantity >= quantity;
  },

  swapItems: (category, fromIndex, toIndex) => {
    const inventoryKey =
      category === 'equip'
        ? 'equipInventory'
        : category === 'use'
          ? 'useInventory'
          : 'etcInventory';

    set((state) => {
      const inventory = [...state[inventoryKey]];
      const maxSlots = state.maxSlots;

      // Validate indices
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= maxSlots || toIndex >= maxSlots) {
        return state;
      }

      // Same position, nothing to do
      if (fromIndex === toIndex) {
        return state;
      }

      // fromIndex must have an item
      if (inventory[fromIndex] === null) {
        return state;
      }

      // Swap (works with null too)
      const temp = inventory[fromIndex];
      inventory[fromIndex] = inventory[toIndex];
      inventory[toIndex] = temp;

      return {
        [inventoryKey]: inventory,
      };
    });
  },

  // Get non-null items as array (for compatibility)
  getInventoryItems: (category) => {
    const state = get();
    const inventoryKey =
      category === 'equip'
        ? 'equipInventory'
        : category === 'use'
          ? 'useInventory'
          : 'etcInventory';

    return state[inventoryKey].filter((slot): slot is InventorySlot => slot !== null);
  },

  reset: () => set({
    ...initialState,
    equipInventory: createEmptyInventory(MAX_SLOTS),
    useInventory: createEmptyInventory(MAX_SLOTS),
    etcInventory: createEmptyInventory(MAX_SLOTS),
  }),
}));

// ============================================================================
// Shared Item Helper Functions for Fetch Scripts
// ============================================================================

import { REGION_MARKS } from './constants.js';
import type { ItemType, ApiItemResponse } from './types.js';

// ============================================================================
// Type / Category from ID (Fallback)
// ============================================================================

/**
 * 아이템 ID 기반으로 타입을 결정한다. (API 실패 시 fallback)
 */
export function determineItemTypeFromId(itemId: number): ItemType {
  if (itemId >= 1000000 && itemId < 2000000) return 'equip';
  if (itemId >= 2000000 && itemId < 3000000) return 'use';
  if (itemId >= 3000000 && itemId < 4000000) return 'setup';
  if (itemId >= 4000000 && itemId < 5000000) return 'etc';
  if (itemId >= 5000000) return 'cash';
  return 'etc';
}

/**
 * API typeInfo의 overallCategory 기반으로 아이템 타입을 결정한다.
 */
export function determineItemTypeFromApi(
  typeInfo: NonNullable<ApiItemResponse['typeInfo']>,
): ItemType {
  const { overallCategory } = typeInfo;

  switch (overallCategory) {
    case 'Equip':
      return 'equip';
    case 'Use':
      return 'use';
    case 'Setup':
      return 'setup';
    case 'Cash':
      return 'cash';
    default:
      return 'etc';
  }
}

/**
 * ID prefix 기반으로 카테고리와 슬롯을 결정한다. (API 실패 시 fallback)
 */
export function determineCategoryFromId(itemId: number): { category: string; slot?: string } {
  const prefix = Math.floor(itemId / 10000);

  // Equip
  if (itemId >= 1000000 && itemId < 2000000) {
    if (prefix >= 100 && prefix <= 104) return { category: 'hat', slot: 'hat' };
    if (prefix === 105) return { category: 'armor', slot: 'overall' };
    if (prefix === 106) return { category: 'armor', slot: 'bottom' };
    if (prefix === 107) return { category: 'shoes', slot: 'shoes' };
    if (prefix === 108) return { category: 'glove', slot: 'gloves' };
    if (prefix === 109) return { category: 'shield', slot: 'shield' };
    if (prefix === 110) return { category: 'cape', slot: 'cape' };
    if (prefix >= 130 && prefix <= 170) return { category: 'weapon', slot: 'weapon' };
    return { category: 'accessory', slot: 'accessory' };
  }

  // Use
  if (itemId >= 2000000 && itemId < 3000000) {
    if (prefix >= 200 && prefix <= 201) return { category: 'potion' };
    if (prefix === 204) return { category: 'scroll' };
    if (prefix === 206 || prefix === 207) return { category: 'projectile' };
    return { category: 'consumable' };
  }

  // Setup
  if (itemId >= 3000000 && itemId < 4000000) {
    if (prefix === 301) return { category: 'chair' };
    return { category: 'setup' };
  }

  // Etc
  if (itemId >= 4000000 && itemId < 5000000) {
    if (prefix === 400) return { category: 'monster-drop' };
    if (prefix === 401) return { category: 'ore' };
    if (prefix === 402) return { category: 'jewel' };
    return { category: 'other' };
  }

  // Cash
  if (itemId >= 5000000) {
    return { category: 'cash' };
  }

  return { category: 'other' };
}

// ============================================================================
// Category from API
// ============================================================================

/**
 * API typeInfo를 기반으로 category/subCategory/slot을 결정한다.
 * 장비, 소비, 설치, 캐시, 기타 아이템 모두 처리한다.
 */
export function determineCategoryFromApi(
  typeInfo: NonNullable<ApiItemResponse['typeInfo']>,
  itemType: ItemType,
): { category: string; subCategory?: string; slot?: string } {
  const { category, subCategory } = typeInfo;

  // Equip
  if (itemType === 'equip') {
    if (
      category === 'Weapon' ||
      category === 'One-Handed Weapon' ||
      category === 'Two-Handed Weapon' ||
      (category && category.includes('Weapon'))
    ) {
      if (category === 'Secondary Weapon') {
        return { category: 'secondary', subCategory, slot: 'secondary' };
      }
      return { category: 'weapon', subCategory, slot: 'weapon' };
    }

    if (category === 'Armor') {
      if (subCategory === 'Hat') return { category: 'hat', subCategory, slot: 'hat' };
      if (subCategory === 'Top') return { category: 'armor', subCategory, slot: 'top' };
      if (subCategory === 'Bottom') return { category: 'armor', subCategory, slot: 'bottom' };
      if (subCategory === 'Overall') return { category: 'armor', subCategory, slot: 'overall' };
      if (subCategory === 'Glove') return { category: 'glove', subCategory, slot: 'gloves' };
      if (subCategory === 'Shoes') return { category: 'shoes', subCategory, slot: 'shoes' };
      if (subCategory === 'Cape') return { category: 'cape', subCategory, slot: 'cape' };
      if (subCategory === 'Shield') return { category: 'shield', subCategory, slot: 'shield' };
      return { category: 'armor', subCategory, slot: 'armor' };
    }

    if (category === 'Accessory') {
      if (subCategory === 'Ring') return { category: 'ring', subCategory, slot: 'ring' };
      if (subCategory === 'Pendant') return { category: 'pendant', subCategory, slot: 'pendant' };
      if (subCategory === 'Belt') return { category: 'belt', subCategory, slot: 'belt' };
      if (subCategory === 'Earring' || subCategory === 'Earrings')
        return { category: 'earring', subCategory, slot: 'earring' };
      if (subCategory === 'Face Accessory') return { category: 'face', subCategory, slot: 'face' };
      if (subCategory === 'Eye Decoration' || subCategory === 'Eye Accessory')
        return { category: 'eye', subCategory, slot: 'eye' };
      if (subCategory === 'Shoulder Accessory')
        return { category: 'shoulder', subCategory, slot: 'shoulder' };
      if (subCategory === 'Medal') return { category: 'medal', subCategory, slot: 'medal' };
      if (subCategory === 'Badge') return { category: 'badge', subCategory, slot: 'badge' };
      if (subCategory === 'Pocket Item') return { category: 'pocket', subCategory, slot: 'pocket' };
      return { category: 'accessory', subCategory, slot: 'accessory' };
    }

    return { category: 'accessory', subCategory };
  }

  // Use
  if (itemType === 'use') {
    if (subCategory === 'Potion') return { category: 'potion', subCategory };
    if (subCategory === 'Food and Drink' || subCategory === 'Food')
      return { category: 'food', subCategory };
    if (subCategory === 'Arrow' || subCategory === 'Crossbow Bolt')
      return { category: 'projectile', subCategory };
    if (subCategory === 'Thrown' || subCategory === 'Bullet')
      return { category: 'projectile', subCategory };
    if (category && category.includes('Scroll')) return { category: 'scroll', subCategory };
    if (category === 'Special Scroll') return { category: 'scroll', subCategory };
    if (subCategory === 'Mastery Book') return { category: 'mastery-book', subCategory };
    if (category === 'Recipe') return { category: 'recipe', subCategory };
    if (category === 'Projectile') return { category: 'projectile', subCategory };
    return { category: 'consumable', subCategory };
  }

  // Setup
  if (itemType === 'setup') {
    if (subCategory === 'Chair') return { category: 'chair', subCategory };
    if (subCategory === 'Title') return { category: 'title', subCategory };
    if (category === 'Nebulite') return { category: 'nebulite', subCategory };
    return { category: 'setup', subCategory };
  }

  // Cash
  if (itemType === 'cash') {
    if (category === 'Pet') return { category: 'pet', subCategory };
    if (category === 'Appearance') return { category: 'appearance', subCategory };
    if (category === 'Random Reward') return { category: 'gacha', subCategory };
    return { category: 'cash', subCategory };
  }

  // Etc
  if (subCategory === 'Monster Drop') return { category: 'monster-drop', subCategory };
  if (subCategory === 'Mineral Ore' || subCategory === 'Ore') return { category: 'ore', subCategory };
  if (subCategory === 'Rare Ore') return { category: 'ore', subCategory };
  if (subCategory === 'Mineral Processed') return { category: 'mineral', subCategory };
  if (subCategory === 'Rare Processed Ore') return { category: 'jewel', subCategory };
  if (subCategory === 'Herb') return { category: 'herb', subCategory };
  if (subCategory === 'Herb Oil') return { category: 'oil', subCategory };
  if (category === 'Crafting') return { category: 'material', subCategory };
  if (subCategory === 'Quest Item') return { category: 'quest', subCategory };
  if (subCategory === 'Coin') return { category: 'coin', subCategory };

  return { category: 'other', subCategory };
}

// ============================================================================
// Slot from ID (Fallback)
// ============================================================================

/**
 * ID prefix 기반으로 장비 슬롯을 결정한다. (API 실패 시 fallback)
 */
export function determineSlotFromId(itemId: number): string | undefined {
  const prefix = Math.floor(itemId / 10000);

  if (prefix >= 100 && prefix <= 104) return 'hat';
  if (prefix === 105) return 'overall';
  if (prefix === 106) return 'bottom';
  if (prefix === 107) return 'shoes';
  if (prefix === 108) return 'gloves';
  if (prefix === 109) return 'shield';
  if (prefix === 110) return 'cape';
  if (prefix >= 130 && prefix <= 170) return 'weapon';

  return undefined;
}

// ============================================================================
// WZ Path
// ============================================================================

/**
 * 아이템 ID로 WZ 파일 경로를 계산한다.
 * 예: 2000001 -> 0200.img/02000001
 */
export function getWzPath(itemId: number): string {
  const prefix = Math.floor(itemId / 10000)
    .toString()
    .padStart(4, '0');
  const fullId = itemId.toString().padStart(8, '0');
  return `${prefix}.img/${fullId}`;
}

// ============================================================================
// Map Mark
// ============================================================================

/**
 * streetName을 한글 지역 마크로 변환한다.
 * 정확한 매칭 -> 부분 매칭 -> 원본 반환 순으로 시도한다.
 */
export function getMapMark(streetName: string): string {
  // 정확한 매칭
  if (REGION_MARKS[streetName]) {
    return REGION_MARKS[streetName];
  }

  // 부분 매칭
  for (const [key, value] of Object.entries(REGION_MARKS)) {
    if (streetName.includes(key) || key.includes(streetName)) {
      return value;
    }
  }

  return streetName;
}

// ============================================================================
// API Item Name/Description Extractors
// ============================================================================

/**
 * API 응답에서 아이템 이름을 추출한다.
 * name 필드 또는 description.name 필드에서 가져온다.
 */
export function getApiItemName(apiData: ApiItemResponse | null): string | undefined {
  if (!apiData) return undefined;
  if (apiData.name) return apiData.name;
  if (apiData.description && typeof apiData.description === 'object' && apiData.description.name) {
    return apiData.description.name;
  }
  return undefined;
}

/**
 * API 응답에서 아이템 설명을 추출한다.
 */
export function getApiItemDescription(apiData: ApiItemResponse | null): string | undefined {
  if (!apiData) return undefined;
  if (typeof apiData.description === 'string') return apiData.description;
  if (apiData.description && typeof apiData.description === 'object' && apiData.description.description) {
    return apiData.description.description;
  }
  return undefined;
}

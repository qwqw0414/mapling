// ============================================================================
// Shared API Functions for Fetch Scripts
// ============================================================================

import { API_BASE_URL, WZ_API_BASE_URL } from './constants.js';
import type {
  ApiMapSearchResult,
  ApiMapDetail,
  ApiMobResponse,
  ApiItemResponse,
  UseEffect,
  WzNode,
} from './types.js';
import { getWzPath } from './itemHelpers.js';

// ============================================================================
// Utility
// ============================================================================

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Map API Functions
// ============================================================================

/**
 * 맵 상세 정보를 API에서 조회한다.
 */
export async function fetchMapDetail(mapId: number): Promise<ApiMapDetail | null> {
  try {
    const url = `${API_BASE_URL}/map/${mapId}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * 맵 검색 결과에서 특정 맵 ID의 정보를 조회한다.
 */
export async function fetchMapSearch(mapId: number): Promise<ApiMapSearchResult | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/map?searchFor=${mapId}&count=1`);
    if (!response.ok) return null;
    const results = await response.json();
    return results.find((m: ApiMapSearchResult) => m.id === mapId) || null;
  } catch {
    return null;
  }
}

/**
 * 맵 이름/지역으로 검색한다.
 */
export async function searchMaps(query: string, count: number = 50): Promise<ApiMapSearchResult[]> {
  const url = `${API_BASE_URL}/map?searchFor=${encodeURIComponent(query)}&count=${count}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// Mob API Functions
// ============================================================================

/**
 * 몬스터 정보를 API에서 조회한다.
 */
export async function fetchMobFromApi(mobId: number): Promise<ApiMobResponse | null> {
  try {
    const url = `${API_BASE_URL}/mob/${mobId}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * 몬스터를 이름으로 검색한다.
 */
export async function searchMobsFromApi(query: string, count: number = 50): Promise<ApiMobResponse[]> {
  try {
    const url = `${API_BASE_URL}/mob?searchFor=${encodeURIComponent(query)}&count=${count}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

// ============================================================================
// Item API Functions
// ============================================================================

/**
 * 아이템 정보를 API에서 조회한다.
 */
export async function fetchItemFromApi(itemId: number): Promise<ApiItemResponse | null> {
  try {
    const url = `${API_BASE_URL}/item/${itemId}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 아이템 아이콘 URL을 생성한다.
 */
export function getIconUrl(itemId: number): string {
  return `${API_BASE_URL}/item/${itemId}/icon`;
}

// ============================================================================
// WZ API Functions (소비 아이템 효과)
// ============================================================================

async function fetchWzNode(wzPath: string): Promise<WzNode | null> {
  try {
    const url = `${WZ_API_BASE_URL}/${wzPath}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWzValue(wzPath: string): Promise<number | null> {
  const node = await fetchWzNode(wzPath);
  if (node && node.value != null && typeof node.value === 'number') {
    return node.value;
  }
  return null;
}

/**
 * 소비 아이템의 효과를 WZ API에서 조회한다.
 * spec 노드(포션 효과)와 info 노드(주문서/투사체 효과)를 모두 확인한다.
 *
 * @param itemId - 소비 아이템 ID
 * @returns 효과 데이터 또는 null
 */
export async function fetchUseItemEffect(itemId: number): Promise<UseEffect | null> {
  const wzPath = getWzPath(itemId);
  const effect: UseEffect = {};
  let hasEffect = false;

  // 1. spec 노드 확인 (포션 효과)
  const specNode = await fetchWzNode(`${wzPath}/spec`);
  if (specNode && specNode.children.length > 0) {
    const specFields = [
      { key: 'hp', field: 'hp' },
      { key: 'mp', field: 'mp' },
      { key: 'hpR', field: 'hpR' },
      { key: 'mpR', field: 'mpR' },
      { key: 'pad', field: 'pad' },
      { key: 'mad', field: 'mad' },
      { key: 'pdd', field: 'pdd' },
      { key: 'mdd', field: 'mdd' },
      { key: 'acc', field: 'acc' },
      { key: 'eva', field: 'eva' },
      { key: 'speed', field: 'speed' },
      { key: 'jump', field: 'jump' },
      { key: 'time', field: 'time' },
    ];

    for (const { key, field } of specFields) {
      if (specNode.children.includes(key)) {
        const value = await fetchWzValue(`${wzPath}/spec/${key}`);
        if (value != null) {
          (effect as Record<string, number>)[field] = value;
          hasEffect = true;
        }
      }
    }
  }

  // 2. info 노드 확인 (주문서/투사체 효과)
  const infoNode = await fetchWzNode(`${wzPath}/info`);
  if (infoNode && infoNode.children.length > 0) {
    const infoFields = [
      { key: 'success', field: 'success' },
      { key: 'incSTR', field: 'incSTR' },
      { key: 'incDEX', field: 'incDEX' },
      { key: 'incINT', field: 'incINT' },
      { key: 'incLUK', field: 'incLUK' },
      { key: 'incPAD', field: 'incPAD' },
      { key: 'incMAD', field: 'incMAD' },
      { key: 'incPDD', field: 'incPDD' },
      { key: 'incMDD', field: 'incMDD' },
      { key: 'incACC', field: 'incACC' },
      { key: 'incEVA', field: 'incEVA' },
      { key: 'incMHP', field: 'incMHP' },
      { key: 'incMMP', field: 'incMMP' },
      { key: 'incSpeed', field: 'incSpeed' },
      { key: 'incJump', field: 'incJump' },
    ];

    for (const { key, field } of infoFields) {
      if (infoNode.children.includes(key)) {
        const value = await fetchWzValue(`${wzPath}/info/${key}`);
        if (value != null) {
          (effect as Record<string, number>)[field] = value;
          hasEffect = true;
        }
      }
    }

    // 투사체 공격력 (incPAD를 attackPower로 복사, success 없는 경우만)
    if (effect.incPAD && !effect.success) {
      effect.attackPower = effect.incPAD;
      delete effect.incPAD;
    }
  }

  return hasEffect ? effect : null;
}

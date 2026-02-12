#!/usr/bin/env tsx

/**
 * 아이템 데이터를 DB + API + WZ에서 가져와 JSON 파일로 저장하는 스크립트
 *
 * 데이터 소스 전략:
 *   - DB: 한글 이름/설명, NPC 구매가, 장비 스탯 (주 데이터)
 *   - API: 카테고리/분류, 영문 이름(파일명), 아이콘 URL
 *   - WZ API: 소비 아이템 효과 (포션 회복량, 주문서 성공률/스탯, 투사체 공격력)
 *
 * 실행 방법:
 *   npm run fetch-items -- [옵션] [아이템ID...]
 *   npx tsx fetch-items.ts [옵션] [아이템ID...]
 *
 * 예시:
 *   npx tsx fetch-items.ts 2000000 2000001           # 특정 아이템
 *   npx tsx fetch-items.ts --range=2000000-2000100   # ID 범위 지정
 *   npx tsx fetch-items.ts --type=use                # 소비 아이템 전체
 *   npx tsx fetch-items.ts --type=use --limit=50     # 소비 아이템 50개
 */

import * as path from 'path';
import * as mysql from 'mysql2/promise';
import {
  DB_CONFIG,
  ITEMS_DIR,
  API_STAT_FIELDS,
  type ItemType,
  type ItemData,
  type DbItemData,
  type ApiItemResponse,
  fetchItemFromApi,
  fetchUseItemEffect,
  fetchItemFromDb,
  fetchItemIdsFromDb,
  getIconUrl,
  delay,
  determineItemTypeFromId,
  determineItemTypeFromApi,
  determineCategoryFromApi,
  determineCategoryFromId,
  determineSlotFromId,
  getApiItemName,
  getApiItemDescription,
  generateFilename,
  ensureDir,
  saveJson,
  fileExists,
} from './scripts/lib/index.js';

// ============================================================================
// Merge Logic: DB + API + WZ
// ============================================================================

async function fetchAndMergeItem(
  conn: mysql.Connection,
  itemId: number,
): Promise<{ itemData: ItemData; filename: string } | null> {
  // 1. DB에서 기본 데이터 가져오기
  const dbData = await fetchItemFromDb(itemId, conn);

  // 2. API에서 분류/영문명 가져오기
  const apiData = await fetchItemFromApi(itemId);

  if (!dbData && !apiData) {
    return null;
  }

  // 3. 타입/카테고리 결정 (API 우선, 없으면 ID 기반)
  let itemType: ItemType;
  let category: string;
  let subCategory: string | undefined;
  let slot: string | undefined;

  if (apiData?.typeInfo) {
    itemType = determineItemTypeFromApi(apiData.typeInfo);
    const categoryInfo = determineCategoryFromApi(apiData.typeInfo, itemType);
    category = categoryInfo.category;
    subCategory = categoryInfo.subCategory;
    slot = categoryInfo.slot;
  } else {
    itemType = determineItemTypeFromId(itemId);
    const categoryInfo = determineCategoryFromId(itemId);
    category = categoryInfo.category;
    slot = categoryInfo.slot;
  }

  // 4. 영문 이름 (API에서, 없으면 빈 문자열)
  const englishName = getApiItemName(apiData) || '';

  // 5. 데이터 병합 (DB 우선)
  const itemData: ItemData = {
    id: itemId,
    name: dbData?.name || getApiItemName(apiData) || '',
    description: dbData?.description || getApiItemDescription(apiData)?.replace(/\\n/g, ' ') || '',
    type: itemType,
    category,
    rarity: 'common',
    price: dbData?.price ?? apiData?.metaInfo?.price ?? 0,
    sellable: apiData ? apiData.metaInfo?.notSale !== true : true,
    tradeable: dbData?.tradeable ?? (apiData ? apiData.metaInfo?.tradeBlock !== true : true),
    stackSize: dbData?.stackSize ?? (itemType === 'equip' ? 1 : apiData?.metaInfo?.slotMax ?? 100),
    icon: getIconUrl(itemId),
  };

  // 영문 이름 추가 (한글과 다를 경우)
  if (englishName && englishName !== itemData.name) {
    itemData.nameEn = englishName;
  }

  if (subCategory) {
    itemData.subCategory = subCategory;
  }

  if (slot) {
    itemData.slot = slot;
  }

  // upgradeSlots (DB 우선, API fallback)
  const upgradeSlots = dbData?.upgradeSlots ?? apiData?.metaInfo?.tuc;
  if (upgradeSlots != null && upgradeSlots > 0) {
    itemData.upgradeSlots = upgradeSlots;
  }

  // only (API)
  if (apiData?.metaInfo?.only === true) {
    itemData.only = true;
  }

  // quest (DB 우선, API fallback)
  if ((dbData?.questId && dbData.questId > 0) || apiData?.metaInfo?.quest === true) {
    itemData.quest = true;
  }

  // isCash (DB 우선, API fallback)
  if (dbData?.isCash === true || apiData?.metaInfo?.cash === true) {
    itemData.isCash = true;
  }

  // requiredLevel (DB 우선, API fallback)
  const reqLevel = dbData?.requiredLevel ?? apiData?.metaInfo?.reqLevel;
  if (reqLevel != null && reqLevel > 0) {
    itemData.requiredLevel = reqLevel;
  }

  // requiredJob (DB 우선, API fallback)
  const reqJob = dbData?.requiredJob ?? apiData?.metaInfo?.reqJob;
  if (reqJob != null) {
    itemData.requiredJob = reqJob;
  }

  // stats (장비 아이템: DB 우선, API fallback)
  if (itemType === 'equip') {
    let stats = dbData?.stats;
    if (!stats && apiData?.metaInfo) {
      const apiStats: Record<string, number> = {};

      API_STAT_FIELDS.forEach((field) => {
        const value = apiData.metaInfo?.[field as keyof NonNullable<ApiItemResponse['metaInfo']>] as number | undefined;
        if (value != null && value !== 0) {
          apiStats[field] = value;
        }
      });

      if (Object.keys(apiStats).length > 0) {
        stats = apiStats;
      }
    }

    if (stats) {
      itemData.stats = stats;
    }
  }

  // 6. 소비 아이템 효과 (WZ API)
  if (itemType === 'use') {
    const effect = await fetchUseItemEffect(itemId);
    if (effect) {
      itemData.effect = effect;
    }
  }

  // 7. 파일명 생성 (영문 이름 사용)
  const filename = generateFilename(itemId, englishName);

  return { itemData, filename };
}

// ============================================================================
// Public API - processItem (used by fetch-map-all.ts)
// ============================================================================

/**
 * 단일 아이템을 처리한다: API + DB 조회 -> 병합 -> 저장
 * fetch-map-all.ts에서 재사용한다.
 *
 * @param itemId - 아이템 ID
 * @param conn - 외부에서 전달된 DB 커넥션 (없으면 내부 싱글턴 사용)
 * @returns 성공 여부
 */
export async function processItem(itemId: number, conn?: mysql.Connection): Promise<boolean> {
  const [apiData, dbData] = await Promise.all([
    fetchItemFromApi(itemId),
    fetchItemFromDb(itemId, conn),
  ]);

  if (!apiData && !dbData) {
    return false;
  }

  const apiName = getApiItemName(apiData);
  const apiDesc = getApiItemDescription(apiData);

  // 타입/카테고리/슬롯 결정 (API 우선, ID fallback)
  let itemType: ItemType;
  let category: string;
  let subCategory: string | undefined;
  let slot: string | undefined;

  if (apiData?.typeInfo) {
    itemType = determineItemTypeFromApi(apiData.typeInfo);
    const categoryInfo = determineCategoryFromApi(apiData.typeInfo, itemType);
    category = categoryInfo.category;
    subCategory = categoryInfo.subCategory;
    slot = categoryInfo.slot;
  } else {
    itemType = determineItemTypeFromId(itemId);
    const categoryInfo = determineCategoryFromId(itemId);
    category = categoryInfo.category;
    slot = categoryInfo.slot;
  }

  const itemData: ItemData = {
    id: itemId,
    name: dbData?.name || apiName || `Item ${itemId}`,
    description: dbData?.description || apiDesc || '',
    type: itemType,
    category,
    rarity: 'common',
    price: dbData?.price || 0,
    sellable: true,
    tradeable: true,
    stackSize: itemType === 'equip' ? 1 : 100,
    icon: getIconUrl(itemId),
  };

  if (apiName) itemData.nameEn = apiName;
  if (subCategory) itemData.subCategory = subCategory;
  if (slot) itemData.slot = slot;

  // 장비 아이템: 스탯/upgradeSlots/requiredLevel (DB 우선, API fallback)
  if (itemType === 'equip') {
    let stats = dbData?.stats;
    if (!stats && apiData?.metaInfo) {
      const apiStats: Record<string, number> = {};
      API_STAT_FIELDS.forEach((field) => {
        const value = apiData.metaInfo?.[field as keyof NonNullable<ApiItemResponse['metaInfo']>] as number | undefined;
        if (value != null && value !== 0) {
          apiStats[field] = value;
        }
      });
      if (Object.keys(apiStats).length > 0) {
        stats = apiStats;
      }
    }
    if (stats) itemData.stats = stats;

    const upgradeSlots = dbData?.upgradeSlots ?? apiData?.metaInfo?.tuc;
    if (upgradeSlots != null && upgradeSlots > 0) itemData.upgradeSlots = upgradeSlots;

    const reqLevel = dbData?.requiredLevel ?? apiData?.metaInfo?.reqLevel;
    if (reqLevel != null && reqLevel > 0) itemData.requiredLevel = reqLevel;

    const reqJob = dbData?.requiredJob ?? apiData?.metaInfo?.reqJob;
    if (reqJob != null) itemData.requiredJob = reqJob;
  }

  // 소비 아이템 효과 (WZ API)
  if (itemType === 'use') {
    const effect = await fetchUseItemEffect(itemId);
    if (effect) itemData.effect = effect;
  }

  // 저장
  const typeFolder = path.join(ITEMS_DIR, itemType);
  ensureDir(typeFolder);
  const filename = generateFilename(itemId, apiName || itemData.name);
  const outputPath = path.join(typeFolder, filename);
  saveJson(outputPath, itemData as unknown as Record<string, unknown>, true);

  console.log(`  [Item] ${itemId} ${itemData.name} -> ${outputPath}`);

  return true;
}

// ============================================================================
// Main (CLI)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  let itemType: ItemType | undefined;
  let range: { min: number; max: number } | undefined;
  let fetchAll = false;
  let limit: number | undefined;
  let skipExisting = false;
  const itemIds: number[] = [];

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
아이템 데이터 Fetcher (DB + API + WZ 병합)

데이터 병합 전략:
  - DB (주): 한글 이름/설명, NPC 구매가, 장비 스탯
  - API (보조): 카테고리/분류, 영문 이름(파일명), 아이콘 URL
  - WZ API: 소비 아이템 효과 (포션, 주문서, 투사체)

소비 아이템 효과 (effect 필드):
  - 포션: hp, mp, hpR, mpR, pad, mad, time 등
  - 주문서: success, incSTR, incDEX, incPAD, incPDD 등
  - 투사체: attackPower (표창/화살 공격력)

사용법:
  npx tsx fetch-items.ts [옵션] [아이템ID...]

필터 옵션:
  --type=TYPE       타입별 전체 (equip/use/setup/etc/cash)
  --range=MIN-MAX   ID 범위 지정 (예: --range=2000000-2000100)
  --limit=N         최대 N개만 가져오기
  --all             전체 아이템 (주의: 17,000개+)

예시:
  npx tsx fetch-items.ts 2000000 2000001       # 특정 아이템
  npx tsx fetch-items.ts --type=use --limit=10 # 소비 아이템 10개
  npx tsx fetch-items.ts --range=2040000-2040010  # 주문서 범위
  npx tsx fetch-items.ts --type=use --skip-existing  # 기존 파일 스킵
      `);
      return;
    }

    if (arg.startsWith('--type=')) {
      itemType = arg.split('=')[1] as ItemType;
    } else if (arg.startsWith('--range=')) {
      const [min, max] = arg.split('=')[1].split('-').map(Number);
      range = { min, max };
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all') {
      fetchAll = true;
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    } else {
      const id = parseInt(arg, 10);
      if (!isNaN(id)) {
        itemIds.push(id);
      }
    }
  }

  if (itemIds.length === 0 && !itemType && !range && !fetchAll) {
    console.log('옵션 없이 실행됨. --help 로 사용법을 확인하세요.');
    return;
  }

  console.log('\n[데이터 병합 모드] DB (한글) + API (분류/영문명) + WZ (소비 효과)\n');

  let conn: mysql.Connection | null = null;
  let targetIds: number[] = [];

  try {
    conn = await mysql.createConnection(DB_CONFIG);
    console.log('DB 연결 완료');

    if (itemIds.length > 0) {
      targetIds = itemIds;
    } else {
      targetIds = await fetchItemIdsFromDb({
        type: itemType,
        range,
        limit: fetchAll ? undefined : limit,
      }, conn);
    }

    console.log(`대상 아이템: ${targetIds.length}개\n`);

    if (targetIds.length === 0) {
      console.log('가져올 아이템이 없습니다.');
      return;
    }

    if (targetIds.length > 100) {
      console.log(`[주의] ${targetIds.length}개 아이템 처리 예정 (API/WZ 호출 포함)...`);
      console.log('API 부하 방지를 위해 요청 간 300ms 딜레이 적용\n');
    }

    let successCount = 0;
    let failCount = 0;
    let effectCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i];
      const itemTypeForId = determineItemTypeFromId(id);
      const typeFolder = path.join(ITEMS_DIR, itemTypeForId);

      if (skipExisting && fileExists(typeFolder, id)) {
        skippedCount++;
        continue;
      }

      try {
        // CLI 모드에서는 fetchAndMergeItem을 사용 (더 상세한 병합)
        const result = await fetchAndMergeItem(conn!, id);

        if (result) {
          const { itemData, filename } = result;
          const outFolder = path.join(ITEMS_DIR, itemData.type);
          ensureDir(outFolder);
          const outputPath = path.join(outFolder, filename);
          saveJson(outputPath, itemData as unknown as Record<string, unknown>, true);
          successCount++;

          if (itemData.effect) {
            effectCount++;
          }

          if (targetIds.length > 100 && (i + 1) % 50 === 0) {
            console.log(`진행: ${i + 1}/${targetIds.length}`);
          } else if (targetIds.length <= 100) {
            const effectStr = itemData.effect ? ' [effect]' : '';
            console.log(`[${id}] ${itemData.name}${effectStr} -> ${outputPath}`);
          }
        } else {
          failCount++;
          console.log(`[${id}] 데이터 없음 (DB/API 모두 실패)`);
        }

        await delay(300);
      } catch (error) {
        failCount++;
        console.error(`[${id}] 오류:`, error instanceof Error ? error.message : error);
      }
    }

    console.log(`\n========================================`);
    console.log(`완료: 총 ${targetIds.length}개`);
    console.log(`  - 성공: ${successCount}개`);
    if (skippedCount > 0) console.log(`  - 스킵: ${skippedCount}개`);
    if (failCount > 0) console.log(`  - 실패: ${failCount}개`);
    if (effectCount > 0) console.log(`  - 효과 데이터: ${effectCount}개`);
    console.log(`========================================`);
  } finally {
    if (conn) {
      await conn.end();
      console.log('DB 연결 종료');
    }
  }
}

// CLI 직접 실행 시에만 main 호출 (import 시에는 실행하지 않음)
const isDirectRun = process.argv[1]?.replace(/\.ts$/, '') === import.meta.url.replace(/^file:\/\//, '').replace(/\.ts$/, '');
if (isDirectRun) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

#!/usr/bin/env tsx

/**
 * 맵 기반 전체 데이터 Fetcher (오케스트레이터)
 *
 * 맵 ID를 입력하면 다음을 순차적으로 생성:
 *   1. 맵 데이터 JSON      (processMap from fetch-maps.ts)
 *   2. 해당 맵의 몬스터 JSON  (processMob from fetch-mobs.ts)
 *   3. 드롭 아이템 JSON      (processItem from fetch-items.ts)
 *
 * 자체 처리 로직 없이 개별 스크립트의 process 함수를 재사용한다.
 *
 * 실행 방법:
 *   npx tsx fetch-map-all.ts --map=104010001
 *   npx tsx fetch-map-all.ts --map=104010001,100000000
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  MAPS_DIR,
  MOBS_DIR,
  ITEMS_DIR,
  delay,
  closeDbConnection,
  fileExists,
  loadExistingJson,
  determineItemTypeFromId,
} from './scripts/lib/index.js';
import type { MobData } from './scripts/lib/index.js';
import { processMap } from './fetch-maps.js';
import { processMob } from './fetch-mobs.js';
import { processItem } from './fetch-items.js';

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  let mapIds: number[] = [];
  let manualMobIds: number[] = [];
  let skipExisting = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
맵 기반 전체 데이터 Fetcher

맵 ID를 입력하면 다음을 순차적으로 생성:
  1. 맵 데이터 JSON
  2. 해당 맵에 스폰되는 몬스터 JSON
  3. 각 몬스터가 드롭하는 아이템 JSON

사용법:
  npx tsx fetch-map-all.ts --map=MAP_ID [--mobs=MOB_ID,...]

옵션:
  --map=ID[,ID...]    맵 ID (필수)
  --mobs=ID[,ID...]   몬스터 ID 수동 지정 (API에서 몹 정보 없을 때)
  --skip-existing     기존 파일 스킵

예시:
  npx tsx fetch-map-all.ts --map=104010001
  npx tsx fetch-map-all.ts --map=105050300 --mobs=2110200,3210100,3210200
  npx tsx fetch-map-all.ts --map=104010001 --skip-existing

출력 경로:
  맵: ${MAPS_DIR}/{mapId}_{name}.json
  몹: ${MOBS_DIR}/{mobId}_{name}.json
  아이템: ${ITEMS_DIR}/{type}/{itemId}_{name}.json
      `);
      return;
    }

    if (arg.startsWith('--map=')) {
      mapIds = arg
        .split('=')[1]
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    } else if (arg.startsWith('--mobs=')) {
      manualMobIds = arg
        .split('=')[1]
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    }
  }

  if (mapIds.length === 0) {
    console.log('맵 ID를 지정해주세요. --help 로 사용법을 확인하세요.');
    return;
  }

  console.log('\n========================================');
  console.log(' 맵 기반 전체 데이터 Fetcher');
  console.log('========================================');
  console.log(`대상 맵: ${mapIds.join(', ')}`);
  if (manualMobIds.length > 0) {
    console.log(`수동 지정 몬스터: ${manualMobIds.join(', ')}`);
  }
  console.log('');

  const allMobIds = new Set<number>();
  const allItemIds = new Set<number>();

  let mapCount = 0;
  let mobCount = 0;
  let itemCount = 0;
  let mobSkipped = 0;
  let itemSkipped = 0;

  try {
    // ======================================================================
    // 1단계: 맵 데이터
    // ======================================================================
    console.log('--- 1단계: 맵 데이터 ---');
    for (const mapId of mapIds) {
      const { mobIds } = await processMap(mapId);
      if (mobIds.length > 0) {
        mapCount++;
        mobIds.forEach((id) => allMobIds.add(id));
      }
      await delay(300);
    }

    // 수동 지정 몬스터 추가
    if (manualMobIds.length > 0) {
      console.log(`\n수동 지정 몬스터 ${manualMobIds.length}개 추가`);
      manualMobIds.forEach((id) => allMobIds.add(id));
    }

    // ======================================================================
    // 2단계: 몬스터 데이터
    // ======================================================================
    console.log('\n--- 2단계: 몬스터 데이터 ---');
    console.log(`대상 몬스터: ${allMobIds.size}개\n`);

    for (const mobId of allMobIds) {
      if (skipExisting && fileExists(MOBS_DIR, mobId)) {
        mobSkipped++;
        // 기존 몹 파일에서 드롭 아이템 ID 수집
        const existingMob = loadExistingJson<MobData>(MOBS_DIR, mobId);
        if (existingMob?.drops) {
          existingMob.drops.forEach((d) => allItemIds.add(d.itemId));
        }
        continue;
      }

      const { itemIds } = await processMob(mobId);
      if (itemIds.length > 0) {
        mobCount++;
        itemIds.forEach((id) => allItemIds.add(id));
      }
      await delay(300);
    }

    // ======================================================================
    // 3단계: 아이템 데이터
    // ======================================================================
    console.log('\n--- 3단계: 아이템 데이터 ---');
    console.log(`대상 아이템: ${allItemIds.size}개\n`);

    let processedItems = 0;
    for (const itemId of allItemIds) {
      const itemTypeFolder = path.join(ITEMS_DIR, determineItemTypeFromId(itemId));
      if (skipExisting && fileExists(itemTypeFolder, itemId)) {
        itemSkipped++;
        continue;
      }

      const success = await processItem(itemId);
      if (success) {
        itemCount++;
        processedItems++;
      }

      // 진행 상황 표시 (20개마다)
      if (processedItems % 20 === 0 && processedItems > 0) {
        console.log(`  ... ${processedItems}/${allItemIds.size - itemSkipped} 처리 완료`);
      }
      await delay(100);
    }
  } finally {
    await closeDbConnection();
  }

  console.log('\n========================================');
  console.log(' 완료');
  console.log('========================================');
  console.log(`  맵: ${mapCount}개`);
  console.log(`  몬스터: ${mobCount}개` + (mobSkipped > 0 ? ` (스킵: ${mobSkipped})` : ''));
  console.log(`  아이템: ${itemCount}개` + (itemSkipped > 0 ? ` (스킵: ${itemSkipped})` : ''));
  console.log('========================================\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeDbConnection();
  process.exit(1);
});

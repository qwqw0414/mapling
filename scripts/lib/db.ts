// ============================================================================
// Shared Database Functions for Fetch Scripts
// ============================================================================

import * as mysql from 'mysql2/promise';
import { DB_CONFIG, STAT_MAPPING } from './constants.js';
import type {
  ItemType,
  DbItemRow,
  DbItemData,
  DbDropRow,
  MobDrop,
  MobMeso,
} from './types.js';
import { determineItemTypeFromId } from './itemHelpers.js';

// ============================================================================
// Connection Management
// ============================================================================

let dbConnection: mysql.Connection | null = null;

export async function getDbConnection(): Promise<mysql.Connection> {
  if (!dbConnection) {
    dbConnection = await mysql.createConnection(DB_CONFIG);
  }
  return dbConnection;
}

export async function closeDbConnection(): Promise<void> {
  if (dbConnection) {
    await dbConnection.end();
    dbConnection = null;
  }
}

// ============================================================================
// Item DB Functions
// ============================================================================

/**
 * DB에서 아이템 기본 정보 + 장비 스탯을 조회한다.
 *
 * @param itemId - 아이템 ID
 * @param conn - 외부에서 전달된 DB 커넥션 (없으면 내부 싱글턴 사용)
 * @returns 아이템 데이터 또는 null
 */
export async function fetchItemFromDb(
  itemId: number,
  conn?: mysql.Connection,
): Promise<DbItemData | null> {
  const connection = conn ?? await getDbConnection();

  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT * FROM wz_itemdata WHERE itemid = ?',
    [itemId],
  );

  if (rows.length === 0) {
    return null;
  }

  const dbItem = rows[0] as DbItemRow;
  const itemType = determineItemTypeFromId(itemId);

  const result: DbItemData = {
    name: dbItem.name || '',
    description: (dbItem.desc || '').replace(/\\n/g, ' ').replace(/\\r/g, ''),
    price: dbItem.wholePrice || 0,
    stackSize: itemType === 'equip' ? 1 : dbItem.slotMax || 100,
    tradeable: dbItem.karma !== 1,
    questId: dbItem.questId || 0,
  };

  // 장비 아이템이면 스탯 조회
  if (itemType === 'equip') {
    const [statRows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT `key`, value FROM wz_itemequipdata WHERE itemid = ?',
      [itemId],
    );

    const stats: Record<string, number> = {};

    for (const row of statRows) {
      if (row.key === 'tuc') {
        result.upgradeSlots = row.value;
      } else if (row.key === 'reqLevel') {
        result.requiredLevel = row.value;
      } else if (row.key === 'reqJob') {
        result.requiredJob = row.value;
      } else if (row.key === 'cash' && row.value === 1) {
        result.isCash = true;
      } else if (STAT_MAPPING[row.key] && row.value !== 0) {
        stats[STAT_MAPPING[row.key]] = row.value;
      }
    }

    if (Object.keys(stats).length > 0) {
      result.stats = stats;
    }
  }

  return result;
}

// ============================================================================
// Drop DB Functions
// ============================================================================

export interface DropResult {
  drops: MobDrop[];
  meso?: MobMeso;
  itemIds: number[];
}

/**
 * DB에서 몬스터 드롭 데이터를 조회한다.
 *
 * @param mobId - 몬스터 ID
 * @param conn - 외부에서 전달된 DB 커넥션 (없으면 내부 싱글턴 사용)
 * @returns 드롭 목록, 메소 드롭, 아이템 ID 목록
 */
export async function fetchDropsFromDb(
  mobId: number,
  conn?: mysql.Connection,
): Promise<DropResult> {
  const connection = conn ?? await getDbConnection();

  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT d.itemid, d.minimum_quantity, d.maximum_quantity, d.questid, d.chance, i.name as itemName
     FROM drop_data d
     LEFT JOIN wz_itemdata i ON d.itemid = i.itemid
     WHERE d.dropperid = ?
     ORDER BY d.chance DESC`,
    [mobId],
  );

  const drops: MobDrop[] = [];
  const itemIds: number[] = [];
  let meso: MobMeso | undefined;

  for (const row of rows as DbDropRow[]) {
    // 메소 드롭 (itemid = 0)
    if (row.itemid === 0) {
      meso = {
        amount: Math.round((row.minimum_quantity + row.maximum_quantity) / 2),
        chance: Math.round((row.chance / 1000000) * 100),
      };
      continue;
    }

    // 퀘스트 아이템 제외
    if (row.questid > 0) {
      continue;
    }

    const drop: MobDrop = {
      itemId: row.itemid,
      name: row.itemName || `Unknown Item ${row.itemid}`,
      chance: parseFloat(((row.chance / 1000000) * 100).toFixed(3)),
    };

    if (row.minimum_quantity !== 1 || row.maximum_quantity !== 1) {
      drop.minQuantity = row.minimum_quantity;
      drop.maxQuantity = row.maximum_quantity;
    }

    drops.push(drop);
    itemIds.push(row.itemid);
  }

  return { drops, meso, itemIds };
}

// ============================================================================
// Item ID Query
// ============================================================================

/**
 * DB에서 조건에 맞는 아이템 ID 목록을 조회한다.
 *
 * @param options - 필터 옵션 (type, range, limit)
 * @param conn - 외부에서 전달된 DB 커넥션 (없으면 내부 싱글턴 사용)
 * @returns 아이템 ID 배열
 */
export async function fetchItemIdsFromDb(
  options: {
    type?: ItemType;
    range?: { min: number; max: number };
    limit?: number;
  },
  conn?: mysql.Connection,
): Promise<number[]> {
  const connection = conn ?? await getDbConnection();

  let query = "SELECT itemid FROM wz_itemdata WHERE name IS NOT NULL AND name != ''";
  const params: (number | string)[] = [];

  if (options.type) {
    const typeRanges: Record<ItemType, [number, number]> = {
      equip: [1000000, 2000000],
      use: [2000000, 3000000],
      setup: [3000000, 4000000],
      etc: [4000000, 5000000],
      cash: [5000000, 10000000],
    };
    const [min, max] = typeRanges[options.type];
    query += ' AND itemid >= ? AND itemid < ?';
    params.push(min, max);
  }

  if (options.range) {
    query += ' AND itemid >= ? AND itemid <= ?';
    params.push(options.range.min, options.range.max);
  }

  query += ' ORDER BY itemid';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const [rows] = await connection.query<mysql.RowDataPacket[]>(query, params);
  return rows.map((row) => row.itemid);
}

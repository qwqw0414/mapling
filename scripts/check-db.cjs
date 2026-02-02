const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'maplestory'
  });

  console.log('Connected to MySQL!\n');

  // 현재 프로젝트에서 사용하는 아이템 ID들
  const projectItems = [
    2000000, 2000001, 2000002, 2000003, // 포션
    4000000, 4000001, 4000002, 4000003, // 몬스터 드롭
    1002008, 1002185, // 모자
    1402001, // 무기
  ];

  console.log('=== Project Items in DB ===');
  const [items] = await connection.query(
    `SELECT itemid, name, \`desc\`, slotMax, price, wholePrice 
     FROM wz_itemdata 
     WHERE itemid IN (?)`,
    [projectItems]
  );
  console.table(items);

  // 포션 데이터 확인 (2000000 ~ 2000100)
  console.log('\n=== Potions (2000000-2000100) ===');
  const [potions] = await connection.query(
    `SELECT itemid, name, \`desc\`, slotMax, price 
     FROM wz_itemdata 
     WHERE itemid >= 2000000 AND itemid < 2000100
     ORDER BY itemid
     LIMIT 20`
  );
  console.table(potions);

  // 몬스터 드롭 확인 (4000000 ~ 4000100)
  console.log('\n=== Monster Drops (4000000-4000100) ===');
  const [drops] = await connection.query(
    `SELECT itemid, name, \`desc\`, slotMax, price 
     FROM wz_itemdata 
     WHERE itemid >= 4000000 AND itemid < 4000100
     ORDER BY itemid
     LIMIT 20`
  );
  console.table(drops);

  // 장비 샘플 (모자 1000000-1003000)
  console.log('\n=== Hats Sample (1000000-1003000) ===');
  const [hats] = await connection.query(
    `SELECT itemid, name, \`desc\`, price 
     FROM wz_itemdata 
     WHERE itemid >= 1000000 AND itemid < 1003000 AND name IS NOT NULL AND name != ''
     ORDER BY itemid
     LIMIT 15`
  );
  console.table(hats);

  // 다른 테이블 목록 확인
  console.log('\n=== Other Tables ===');
  const [tables] = await connection.query(`
    SELECT TABLE_NAME, TABLE_ROWS 
    FROM information_schema.tables 
    WHERE TABLE_SCHEMA = 'maplestory'
    ORDER BY TABLE_NAME
  `);
  console.table(tables);

  await connection.end();
  console.log('\nConnection closed.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

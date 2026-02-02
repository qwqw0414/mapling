const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'maplestory'
  });

  // 아이템 유형별 통계
  console.log('=== DB Item Type Distribution ===');
  const [stats] = await conn.query(`
    SELECT 
      CASE 
        WHEN itemid >= 1000000 AND itemid < 2000000 THEN 'Equip (1xxxxxx)'
        WHEN itemid >= 2000000 AND itemid < 3000000 THEN 'Use (2xxxxxx)'
        WHEN itemid >= 3000000 AND itemid < 4000000 THEN 'Setup (3xxxxxx)'
        WHEN itemid >= 4000000 AND itemid < 5000000 THEN 'Etc (4xxxxxx)'
        WHEN itemid >= 5000000 THEN 'Cash (5xxxxxx)'
        ELSE 'Other'
      END as type,
      COUNT(*) as count,
      SUM(CASE WHEN name IS NOT NULL AND name != '' THEN 1 ELSE 0 END) as with_name,
      SUM(CASE WHEN \`desc\` IS NOT NULL AND \`desc\` != '' THEN 1 ELSE 0 END) as with_desc
    FROM wz_itemdata 
    GROUP BY type
    ORDER BY type
  `);
  console.table(stats);

  // wz_itemequipdata 스탯 키 종류
  console.log('\n=== Available Stat Keys in wz_itemequipdata ===');
  const [keys] = await conn.query(`
    SELECT \`key\`, COUNT(*) as count 
    FROM wz_itemequipdata 
    GROUP BY \`key\`
    ORDER BY count DESC
    LIMIT 30
  `);
  console.table(keys);

  // 가격 샘플 비교
  console.log('\n=== Price Comparison (price vs wholePrice) ===');
  const [prices] = await conn.query(`
    SELECT itemid, name, price, wholePrice 
    FROM wz_itemdata 
    WHERE price != CAST(wholePrice AS CHAR) 
    AND wholePrice > 0
    LIMIT 10
  `);
  console.table(prices);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

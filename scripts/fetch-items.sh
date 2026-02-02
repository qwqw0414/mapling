#!/bin/bash

# 아이템 ID 목록
ITEM_IDS=(
  1002008 1002067 1040011 1040013 1402001 1422000 1472000
  2000000 2000001 2000002 2000003 2010009 2040002 2041001 2060000 2061000
  4000000 4000001 4000002 4000003 4000004 4000006 4000010 4000012 4000013 4000014
  4000016 4000017 4000018 4000019 4000021 4000061 4000062 4000089 4003004
  4010000 4010001 4010002 4010004 4010006
  4020000 4020001 4020004 4020006
)

# 결과 저장 디렉토리
OUTPUT_DIR="./temp_items"
mkdir -p "$OUTPUT_DIR"

# 각 아이템 데이터 가져오기
for item_id in "${ITEM_IDS[@]}"; do
  echo "Fetching item $item_id..."
  curl -s "https://maplestory.io/api/gms/62/item/$item_id" | \
    jq '{
      id, 
      name: .description.name, 
      description: .description.description,
      typeInfo: .typeInfo,
      price: .metaInfo.price, 
      reqLevel: .metaInfo.reqLevel, 
      reqJob: .metaInfo.reqJob,
      tuc: .metaInfo.tuc,
      cash: .metaInfo.cash,
      tradeBlock: .metaInfo.tradeBlock,
      notSale: .metaInfo.notSale,
      incSTR: .metaInfo.incSTR, 
      incDEX: .metaInfo.incDEX, 
      incINT: .metaInfo.incINT, 
      incLUK: .metaInfo.incLUK,
      incHP: .metaInfo.incHP,
      incMP: .metaInfo.incMP,
      incPAD: .metaInfo.incPAD, 
      incMAD: .metaInfo.incMAD, 
      incPDD: .metaInfo.incPDD, 
      incMDD: .metaInfo.incMDD,
      incEVA: .metaInfo.incEVA,
      incACC: .metaInfo.incACC,
      incSpeed: .metaInfo.incSpeed,
      incJump: .metaInfo.incJump
    }' > "$OUTPUT_DIR/${item_id}.json"
  sleep 0.5  # API 부하 방지
done

echo "All items fetched successfully!"

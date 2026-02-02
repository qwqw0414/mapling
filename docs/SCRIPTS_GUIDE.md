# 데이터 Fetch 스크립트 가이드

게임 데이터(아이템, 몬스터, 맵)를 MapleStory.IO API와 로컬 DB에서 가져와 JSON 파일로 저장하는 스크립트들입니다.

## 데이터 소스

| 소스 | 설명 | 제공 데이터 |
|------|------|------------|
| **REST API** | MapleStory.IO GMS/62 | 영문 이름, 카테고리, 스탯, 이미지 URL |
| **Local DB** | MySQL (maplestory) | 한글 이름/설명, 드롭 정보, 가격 |
| **WZ API** | MapleStory.IO WZ | 소비 아이템 효과 (포션, 주문서) |

## 스크립트 목록

| 스크립트 | 설명 | npm 명령어 |
|----------|------|------------|
| `fetch-items.ts` | 아이템 데이터 생성 | `npm run fetch-items` |
| `fetch-mobs.ts` | 몬스터 데이터 생성 | `npm run fetch-mobs` |
| `fetch-maps.ts` | 맵 데이터 생성 | `npm run fetch-maps` |
| `fetch-map-all.ts` | 맵 기반 전체 데이터 일괄 생성 | `npm run fetch-map-all` |

---

## fetch-items.ts

아이템 데이터를 DB + API + WZ API에서 병합하여 JSON 파일로 저장합니다.

### 데이터 병합 전략

- **DB (주)**: 한글 이름/설명, NPC 구매가, 장비 스탯
- **API (보조)**: 카테고리/분류, 영문 이름(파일명), 아이콘 URL
- **WZ API**: 소비 아이템 효과 (포션, 주문서, 투사체)

### 사용법

```bash
npx tsx fetch-items.ts [아이템ID...] [옵션]
```

### 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `아이템ID` | 특정 아이템 ID (공백 구분) | `2000000 2000001` |
| `--type=TYPE` | 아이템 타입 필터 (equip/use/etc/setup/cash) | `--type=use` |
| `--range=MIN-MAX` | 아이템 ID 범위 | `--range=2040000-2040010` |
| `--limit=N` | 최대 개수 제한 | `--limit=10` |
| `--all` | 전체 아이템 (주의: 대량) | `--all` |
| `--skip-existing` | 기존 파일 스킵 | `--skip-existing` |

### 예시

```bash
# 특정 아이템
npx tsx fetch-items.ts 2000000 2000001

# 소비 아이템 10개
npx tsx fetch-items.ts --type=use --limit=10

# 주문서 범위
npx tsx fetch-items.ts --range=2040000-2040010

# 기존 파일 스킵
npx tsx fetch-items.ts --type=use --skip-existing
```

### 출력 경로

```
src/data/items/{type}/{itemId}_{name}.json
```

- `type`: equip, use, etc, setup, cash

### 생성 JSON 예시

```json
{
  "id": 2000001,
  "name": "주황 포션",
  "nameEn": "Orange Potion",
  "description": "붉은 약초의 농축 물약이다. HP를 약 150 회복시킨다.",
  "type": "use",
  "category": "Consumable",
  "subCategory": "Potion",
  "rarity": "common",
  "price": 80,
  "sellable": true,
  "tradeable": true,
  "stackSize": 100,
  "icon": "https://maplestory.io/api/gms/62/item/2000001/icon",
  "effect": {
    "hp": 150
  }
}
```

---

## fetch-mobs.ts

몬스터 데이터를 API + DB에서 병합하여 JSON 파일로 저장합니다.

### 데이터 병합 전략

- **API**: 스탯, 영문 이름, 설명, 출현 맵, 점프 가능 여부
- **DB (drop_data)**: 드롭 아이템, 메소 드롭, 한글 아이템명

### 사용법

```bash
npx tsx fetch-mobs.ts [옵션]
```

### 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `--id=ID[,ID...]` | 특정 몬스터 ID | `--id=1210100` |
| `--range=START-END` | ID 범위 | `--range=1210100-1210110` |
| `--search=QUERY` | 이름 검색 (API) | `--search="Slime"` |
| `--skip-existing` | 기존 파일 스킵 | `--skip-existing` |

### 예시

```bash
# 단일 몬스터
npx tsx fetch-mobs.ts --id=1210100

# 여러 몬스터
npx tsx fetch-mobs.ts --id=1210100,1210101,100100

# ID 범위
npx tsx fetch-mobs.ts --range=1210100-1210110

# 이름 검색
npx tsx fetch-mobs.ts --search="Slime"

# 기존 파일 스킵
npx tsx fetch-mobs.ts --search="Mushroom" --skip-existing
```

### 출력 경로

```
src/data/mobs/{mobId}_{name}.json
```

### 생성 JSON 예시

```json
{
  "id": 1210100,
  "name": "돼지",
  "nameEn": "Pig",
  "description": "A very speedy monster...",
  "meta": {
    "level": 7,
    "maxHp": 80,
    "maxMp": 10,
    "exp": 12,
    "speed": 0,
    "physicalDamage": 25,
    "physicalDefense": 5,
    "magicDamage": 19,
    "magicDefense": 20,
    "accuracy": 10,
    "evasion": 0,
    "isBoss": false,
    "isBodyAttack": true
  },
  "canJump": true,
  "meso": {
    "amount": 16,
    "chance": 65
  },
  "drops": [
    { "itemId": 4000021, "name": "동물의 가죽", "chance": 1.5 },
    { "itemId": 2000000, "name": "빨간 포션", "chance": 1 }
  ],
  "foundAt": [100030310, 120010000, 120010100]
}
```

---

## fetch-maps.ts

맵 데이터를 API에서 가져와 JSON 파일로 저장합니다.

### 사용법

```bash
npx tsx fetch-maps.ts [옵션]
```

### 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `--search=QUERY` | 맵 이름/지역명 검색 | `--search="Henesys"` |
| `--id=ID[,ID...]` | 특정 맵 ID | `--id=100000000` |
| `--count=N` | 검색 결과 최대 개수 (기본: 50) | `--count=100` |
| `--skip-towns` | 마을(isTown) 제외 | `--skip-towns` |
| `--skip-no-mobs` | 몬스터 없는 맵 제외 | `--skip-no-mobs` |
| `--skip-existing` | 기존 파일 스킵 | `--skip-existing` |

### 예시

```bash
# 맵 이름 검색
npx tsx fetch-maps.ts --search="Henesys"

# 지역명 검색
npx tsx fetch-maps.ts --search="Victoria Road"

# 특정 맵 ID
npx tsx fetch-maps.ts --id=100000000

# 여러 ID
npx tsx fetch-maps.ts --id=100000000,104010001

# 마을 제외
npx tsx fetch-maps.ts --search="Henesys" --skip-towns

# 기존 파일 스킵
npx tsx fetch-maps.ts --search="Henesys" --skip-existing
```

### 출력 경로

```
src/data/maps/{mapId}_{name}.json
```

### 생성 JSON 예시

```json
{
  "id": 100000000,
  "name": "Henesys",
  "nameEn": "Henesys",
  "streetName": "헤네시스",
  "mapMark": "헤네시스",
  "isTown": true,
  "bgm": "Bgm00/FloralLife"
}
```

---

## fetch-map-all.ts

맵 ID를 입력하면 **맵 → 몬스터 → 드롭 아이템**을 순차적으로 일괄 생성합니다.

### 처리 흐름

```
1단계: 맵 데이터
  └─ 기존 파일 있으면 재사용
  └─ spawns.normal.mobs에서 몬스터 ID 추출

2단계: 몬스터 데이터
  └─ API (스탯, 영문명, 점프 여부)
  └─ DB (드롭 아이템, 메소, 한글 아이템명)
  └─ 드롭 목록에서 아이템 ID 추출

3단계: 아이템 데이터
  └─ API (영문명, 카테고리)
  └─ DB (한글명, 가격)
  └─ WZ API (소비 아이템 효과)
  └─ type별 폴더 분류 (equip/use/etc)
```

### 사용법

```bash
npx tsx fetch-map-all.ts --map=MAP_ID [옵션]
```

### 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `--map=ID[,ID...]` | 맵 ID (필수) | `--map=104010001` |
| `--mobs=ID[,ID...]` | 몬스터 ID 수동 지정 | `--mobs=2110200,3210100` |
| `--skip-existing` | 기존 파일 스킵 | `--skip-existing` |

### 예시

```bash
# 단일 맵 전체 데이터
npx tsx fetch-map-all.ts --map=104010001

# 여러 맵
npx tsx fetch-map-all.ts --map=104010001,104040000

# 몬스터 수동 지정 (API에서 몹 정보 없을 때)
npx tsx fetch-map-all.ts --map=105050300 --mobs=2110200,2230101

# 기존 파일 스킵
npx tsx fetch-map-all.ts --map=104010001 --skip-existing
```

### 출력 경로

```
맵:     src/data/maps/{mapId}_{name}.json
몬스터: src/data/mobs/{mobId}_{name}.json
아이템: src/data/items/{type}/{itemId}_{name}.json
```

### 실행 결과 예시

```
========================================
 맵 기반 전체 데이터 Fetcher
========================================
대상 맵: 104010001

--- 1단계: 맵 데이터 ---
[Map] 104010001 기존 파일 사용 (몬스터: 3개)

--- 2단계: 몬스터 데이터 ---
대상 몬스터: 3개
[Mob] 1210100 Pig -> src/data/mobs/1210100_pig.json (드롭: 19개)
[Mob] 1210101 Ribbon Pig -> src/data/mobs/1210101_ribbon-pig.json (드롭: 19개)
[Mob] 130101 Red Snail -> src/data/mobs/130101_red-snail.json (드롭: 18개)

--- 3단계: 아이템 데이터 ---
대상 아이템: 46개
[Item] 4000021 동물의 가죽 -> src/data/items/etc/4000021_leather.json
...

========================================
 완료
========================================
  맵: 1개
  몬스터: 3개
  아이템: 46개
========================================
```

---

## 공통 사항

### DB 설정

로컬 MySQL 데이터베이스 연결 정보 (스크립트 내 하드코딩):

```typescript
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'maplestory'
};
```

### API 버전

모든 스크립트는 **GMS/62** (빅뱅 이전) 버전을 사용합니다.

```
https://maplestory.io/api/gms/62/...
```

### 한글 이름 유지

기존 JSON 파일이 있고 한글 이름이 설정되어 있으면, 새로 가져온 데이터로 덮어쓸 때 한글 이름은 유지됩니다.

### API 부하 방지

요청 간 300ms 딜레이가 적용되어 있습니다.

---

## 주요 맵 ID 참고

| 맵 ID | 이름 |
|-------|------|
| 100000000 | Henesys (마을) |
| 104010001 | 돼지의 해안가 |
| 105010300 | Ant Tunnel Square 1 |
| 105050000~105050300 | 개미굴 I~IV |
| 105060100 | Deep Ant Tunnel I |

---

## 주요 몬스터 ID 참고

| 몬스터 ID | 이름 |
|-----------|------|
| 100100 | Snail (달팽이) |
| 1210100 | Pig (돼지) |
| 1210101 | Ribbon Pig (리본돼지) |
| 2110200 | Horny Mushroom (뿔버섯) |
| 2230101 | Zombie Mushroom (좀비버섯) |

# 데이터 추가 가이드

맵, 몬스터 등 게임 데이터를 추가하는 방법을 설명합니다.

---

## 1. 맵 추가하기

### 1.1 맵 정보 수집

MapleStory.IO API에서 맵 정보를 조회합니다.

```
https://maplestory.io/api/GMS/62/map/{mapId}
```

**필요한 정보:**
- `id`: 맵 ID
- `name`: 맵 이름 (영문)
- `streetName`: 대륙/지역 이름
- `mapMark`: 마을/타운 이름
- `backgroundMusic`: BGM 경로

**API 응답 예시:**

```json
{
  "id": 100010000,
  "name": "The Hill East of Henesys",
  "streetName": "Victoria Road",
  "mapMark": "Henesys",
  "backgroundMusic": "Bgm00/RestNPeace",
  // ... 기타 필드
}
```

**지역 이름 한글 변환 예시:**
- `Victoria Road` → "빅토리아 아일랜드"
- `Hidden Street` → "히든 스트리트"
- `Henesys` → "헤네시스"
- `Rith` → "리스 항구"

### 1.2 JSON 파일 생성

`src/data/maps/` 폴더에 JSON 파일을 생성합니다.

**파일명 규칙:** `{mapId}_{영문이름}.json`

예: `104010001_pig-beach.json`

**JSON 구조:**

```json
{
  "id": 104010001,
  "name": "돼지의 해안가",
  "streetName": "히든 스트리트",
  "mapMark": "리스 항구",
  "recommendedLevel": {
    "min": 7,
    "max": 15
  },
  "bgm": "Bgm02/AboveTheTreetops",
  "spawns": {
    "normal": {
      "mobs": [
        { "mobId": 1210100, "weight": 40 },
        { "mobId": 1210101, "weight": 50 },
        { "mobId": 130101, "weight": 10 }
      ]
    }
  }
}
```

**필드 설명:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | 맵 ID (MapleStory 원본 ID) |
| `name` | string | 맵 이름 (한글) |
| `streetName` | string (선택) | 대륙/지역 이름 (예: "빅토리아 아일랜드") |
| `mapMark` | string (선택) | 마을/타운 이름 (예: "헤네시스") |
| `recommendedLevel.min` | number | 적정 레벨 최소 |
| `recommendedLevel.max` | number | 적정 레벨 최대 |
| `bgm` | string | BGM 경로 (`{폴더}/{파일명}` 형식) |
| `spawns.normal.mobs` | array | 일반 몬스터 스폰 목록 |
| `spawns.normal.mobs[].mobId` | number | 몬스터 ID |
| `spawns.normal.mobs[].weight` | number | 스폰 가중치 (합계 100 권장) |

### 1.3 BGM 경로 확인

MapleStory.IO WZ API에서 BGM 목록을 확인합니다.

```
https://maplestory.io/api/wz/GMS/62/Sound
```

BGM 폴더 예시:
- `Bgm00`: 빅토리아 아일랜드
- `Bgm01`: 오르비스
- `Bgm02`: 루디브리엄 등

### 1.4 맵 등록

`src/data/maps/index.ts` 파일을 수정합니다.

**1) Import 추가:**

```typescript
import newMapData from './{mapId}_{name}.json';
```

**2) 등록 추가:**

```typescript
registerMap(newMapData);
```

### 1.5 몬스터 등록 확인

맵에서 사용하는 몬스터가 `src/data/mobs/`에 등록되어 있는지 확인합니다.
없다면 아래 "2. 몬스터 추가하기"를 참고하여 먼저 등록합니다.

---

## 2. 몬스터 추가하기

### 2.1 몬스터 정보 수집

**기본 정보 (MapleStory.IO):**

```
https://maplestory.io/api/GMS/62/mob/{mobId}
```

**드롭 정보 (MapleDB.kr):**

```
https://mapledb.kr/search.php?q={mobId}&t=mob
```

### 2.2 JSON 파일 생성

`src/data/mobs/` 폴더에 JSON 파일을 생성합니다.

**파일명 규칙:** `{mobId}_{영문이름}.json`

예: `1210100_pig.json`

**JSON 구조:**

```json
{
  "id": 1210100,
  "name": "돼지",
  "meta": {
    "level": 6,
    "maxHp": 60,
    "maxMp": 20,
    "exp": 8,
    "speed": 3,
    "physicalDamage": 35,
    "physicalDefense": 5,
    "magicDamage": 0,
    "magicDefense": 15,
    "accuracy": 20,
    "evasion": 1,
    "isBoss": false,
    "isBodyAttack": true
  },
  "canJump": true,
  "meso": {
    "amount": 15,
    "chance": 60
  },
  "drops": [
    { "itemId": 4000001, "name": "돼지의 가죽", "chance": 50.0 },
    { "itemId": 2000000, "name": "빨간 포션", "chance": 5.0 }
  ]
}
```

**필드 설명:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | 몬스터 ID |
| `name` | string | 몬스터 이름 (한글) |
| `meta.level` | number | 레벨 |
| `meta.maxHp` | number | 최대 HP |
| `meta.maxMp` | number | 최대 MP |
| `meta.exp` | number | 처치 시 경험치 |
| `meta.speed` | number | 이동 속도 (1~10) |
| `meta.physicalDamage` | number | 물리 공격력 |
| `meta.physicalDefense` | number | 물리 방어력 |
| `meta.magicDamage` | number | 마법 공격력 |
| `meta.magicDefense` | number | 마법 방어력 |
| `meta.accuracy` | number | 명중률 |
| `meta.evasion` | number | 회피율 |
| `meta.isBoss` | boolean | 보스 여부 |
| `meta.isBodyAttack` | boolean | 접촉 공격 여부 |
| `canJump` | boolean | 점프 가능 여부 |
| `meso.amount` | number | 메소 드롭 기본량 |
| `meso.chance` | number | 메소 드롭 확률 (%) |
| `drops` | array | 아이템 드롭 목록 |
| `drops[].itemId` | number | 아이템 ID |
| `drops[].name` | string | 아이템 이름 |
| `drops[].chance` | number | 드롭 확률 (%) |

### 2.3 몬스터 등록

`src/data/mobs/index.ts` 파일을 수정합니다.

**1) Import 추가:**

```typescript
import newMobData from './{mobId}_{name}.json';
```

**2) 등록 추가:**

```typescript
registerMob(newMobData);
```

---

## 3. API 참고 자료

### MapleStory.IO API

| 용도 | URL |
|------|-----|
| 맵 정보 | `https://maplestory.io/api/GMS/62/map/{mapId}` |
| 몬스터 정보 | `https://maplestory.io/api/GMS/62/mob/{mobId}` |
| 아이템 정보 | `https://maplestory.io/api/GMS/62/item/{itemId}` |
| 몬스터 이미지 | `https://maplestory.io/api/GMS/62/mob/{mobId}/render/{animation}` |
| 아이템 아이콘 | `https://maplestory.io/api/GMS/62/item/{itemId}/icon` |
| BGM (WZ) | `https://maplestory.io/api/wz/GMS/62/Sound/{folder}.img/{name}` |
| 몬스터 사운드 | `https://maplestory.io/api/wz/GMS/62/Sound/Mob.img/{mobId7digit}/{type}` |

**참고:** 몬스터 사운드 ID는 7자리로 앞에 0을 패딩합니다.
- 예: `130101` → `0130101`

### MapleDB.kr

| 용도 | URL |
|------|-----|
| 몬스터 드롭 | `https://mapledb.kr/search.php?q={mobId}&t=mob` |
| 아이템 검색 | `https://mapledb.kr/search.php?q={keyword}&t=item` |

---

## 4. 체크리스트

### 맵 추가 체크리스트

- [ ] MapleStory.IO에서 맵 정보 확인 (`id`, `name`, `streetName`, `mapMark`)
- [ ] BGM 경로 확인 (`backgroundMusic`)
- [ ] 지역/마을 이름 한글 변환
- [ ] 스폰 몬스터 목록 결정
- [ ] 스폰 몬스터가 mobs에 등록되어 있는지 확인
- [ ] JSON 파일 생성 (`src/data/maps/{id}_{name}.json`)
- [ ] `src/data/maps/index.ts`에 import 및 등록 추가
- [ ] 게임에서 맵 선택 UI로 테스트

### 몬스터 추가 체크리스트

- [ ] MapleStory.IO에서 몬스터 기본 정보 확인
- [ ] MapleDB.kr에서 드롭 정보 확인
- [ ] JSON 파일 생성 (`src/data/mobs/{id}_{name}.json`)
- [ ] `src/data/mobs/index.ts`에 import 및 등록 추가
- [ ] 애니메이션 GIF 로드 테스트 (stand, move, hit1, die1)
- [ ] 사운드 로드 테스트 (Damage, Die)
- [ ] 게임에서 테스트

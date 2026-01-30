# MapleStory.IO API Reference

MapleStory.IO는 메이플스토리 게임 데이터를 제공하는 비공식 API입니다.

## Base URL

```
https://maplestory.io/api
```

## URL 구조

```
https://maplestory.io/api/{REGION}/{VERSION}/{ENDPOINT}
```

| 파라미터 | 설명 | 예시 |
|---------|------|------|
| REGION | 게임 리전 | GMS, KMS, JMS, CMS, SEA, TMS |
| VERSION | 게임 버전 | 62, 83, 389, latest |
| ENDPOINT | API 엔드포인트 | /mob, /item, /quest, /map, /npc, /pet, /job, /character |

## 지원 리전 및 버전

### GMS (Global MapleStory)

| 버전 | 설명 | 비고 |
|------|------|------|
| 62 | 빅뱅 이전 (2010년 이전) | 영어 데이터 |
| 83 | 빅뱅 이후 초기 | 영어 데이터 |
| latest | 최신 버전 | 영어 데이터 |

### KMS (Korea MapleStory)

| 버전 | 설명 | 비고 |
|------|------|------|
| 284~389 | 지원 버전 범위 | 한글 데이터 |
| latest | **미지원** | 특정 버전 필요 |

## API 리소스 요약

| 리소스 | 검색 | 상세 | 아이콘 | 렌더/이미지 | 비고 |
|--------|:----:|:----:|:------:|:-----------:|------|
| Mob (몬스터) | O | O | O | O | 애니메이션 지원 |
| Item (아이템) | O | O | O | - | 카테고리 조회 지원 |
| Quest (퀘스트) | O | O | - | - | 조건/보상 정보 포함 |
| Map (맵) | O | O | O | O | 미니맵, 전체 렌더 |
| NPC | O | O | O | - | 대화, 관련 퀘스트 포함 |
| Pet (펫) | O | O | - | - | 애니메이션 프레임 포함 |
| Job (직업) | - | - | - | - | 목록만 제공 |
| Character | - | - | - | - | 스킨 목록만 제공 |
| Skill (스킬) | - | - | - | - | WZ API 사용 필요 |

## API Endpoints

### Mob (몬스터)

#### 몬스터 검색

```
GET /mob?searchFor={name}&minLevelFilter={min}&maxLevelFilter={max}&count={count}
```

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| searchFor | string | N | 검색할 몬스터 이름 (부분 일치) |
| minLevelFilter | number | N | 최소 레벨 필터 |
| maxLevelFilter | number | N | 최대 레벨 필터 |
| count | number | N | 반환할 최대 개수 |

**Response:**

```json
[
  {
    "id": 100100,
    "name": "Snail",
    "mobType": "Unknown",
    "level": 1,
    "isBoss": false
  }
]
```

#### 몬스터 상세 정보

```
GET /mob/{mobId}
```

**Response:**

```json
{
  "id": 100100,
  "name": "Snail",
  "meta": {
    "level": 1,
    "maxHP": 8,
    "maxMP": 0,
    "exp": 3,
    "physicalDamage": 12,
    "physicalDefense": 0,
    "magicDamage": 0,
    "magicDefense": 0,
    "accuracy": 20,
    "evasion": 0,
    "speed": -65,
    "isUndead": false,
    "isBoss": false,
    "minimumPushDamage": 1
  },
  "description": "...",
  "foundAt": [40000, 40001, ...]
}
```

#### 몬스터 이미지

```
GET /mob/{mobId}/icon
GET /mob/{mobId}/render/{animation}
```

**Animation 옵션:**
- `stand`: 서있는 자세
- `move`: 움직이는 자세
- `hit1`: 피격 모션
- `die1`: 사망 모션

### Item (아이템)

#### 아이템 검색

```
GET /item?searchFor={name}&overallCategoryFilter={category}&minLevelFilter={min}&maxLevelFilter={max}&count={count}
```

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| searchFor | string | N | 검색할 아이템 이름 |
| overallCategoryFilter | string | N | 대분류 (Equip, Use, Etc, Cash) |
| categoryFilter | string | N | 중분류 (Armor, Weapon 등) |
| subCategoryFilter | string | N | 소분류 (Hat, Sword 등) |
| minLevelFilter | number | N | 최소 착용 레벨 |
| maxLevelFilter | number | N | 최대 착용 레벨 |
| cashFilter | boolean | N | 캐시 아이템 여부 |
| count | number | N | 반환할 최대 개수 |

**Response:**

```json
[
  {
    "id": 2070006,
    "name": "Ilbi Throwing-Stars",
    "desc": "...",
    "requiredLevel": 10,
    "isCash": false,
    "typeInfo": {
      "overallCategory": "Use",
      "category": "Projectile",
      "subCategory": "Thrown"
    }
  }
]
```

#### 아이템 상세 정보

```
GET /item/{itemId}
```

**Response:**

```json
{
  "id": 2070006,
  "description": {
    "id": 2070006,
    "name": "Ilbi Throwing-Stars",
    "description": "A throwing-star made out of steel..."
  },
  "metaInfo": {
    "cash": false,
    "reqLevel": 10,
    "incPAD": 27,
    "price": 20000,
    "slotMax": 800
  },
  "typeInfo": {
    "overallCategory": "Use",
    "category": "Projectile",
    "subCategory": "Thrown"
  }
}
```

#### 아이템 카테고리 목록

```
GET /item/category
```

**Response:**

```json
[
  {
    "overallCategory": "Equip",
    "categories": [
      {
        "category": "Armor",
        "subCategories": ["Hat", "Top", "Bottom", "Overall", "Shoes", "Gloves", "Cape", "Shield"]
      },
      {
        "category": "Weapon",
        "subCategories": ["One-Handed Sword", "Two-Handed Sword", "Bow", "Crossbow", ...]
      }
    ]
  }
]
```

#### 아이템 아이콘

```
GET /item/{itemId}/icon
```

### Quest (퀘스트)

#### 퀘스트 검색

```
GET /quest?searchFor={name}&count={count}
```

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| searchFor | string | N | 검색할 퀘스트 이름 |
| count | number | N | 반환할 최대 개수 |

**Response:**

```json
[
  {
    "id": 1037,
    "name": "Help Hunt the Snails"
  },
  {
    "id": 2153,
    "name": "The Old Snail",
    "minLevel": 20
  }
]
```

#### 퀘스트 상세 정보

```
GET /quest/{questId}
```

**Response:**

```json
{
  "id": 1037,
  "name": "Help Hunt the Snails",
  "area": 20,
  "messages": [
    "Sam asked me to take care of some snails...",
    "I told Maria I took care of the snails."
  ],
  "requirementToStart": {
    "id": 1037,
    "jobs": [0],
    "levelMaximum": 10,
    "npcId": 2005,
    "state": 0
  },
  "requirementToComplete": {
    "id": 1037,
    "mobs": [
      { "count": 10, "id": 100100 }
    ],
    "npcId": 2103,
    "state": 1
  },
  "rewardOnComplete": {
    "id": 1037,
    "exp": 60,
    "state": 1
  },
  "questsAvailableOnComplete": [...]
}
```

### NPC

#### NPC 검색

```
GET /npc?searchFor={name}&count={count}
```

**Response:**

```json
[
  {
    "id": 9010000,
    "name": "Maple Administrator"
  },
  {
    "id": 9201030,
    "name": "Maple Claws"
  }
]
```

#### NPC 상세 정보

```
GET /npc/{npcId}
```

**Response:**

```json
{
  "id": 9010000,
  "name": "Maple Administrator",
  "isShop": false,
  "isComponentNPC": false,
  "dialogue": {
    "n0": "Hello, there! How's the traveling?",
    "d0": "Hello! Make sure to check www.nexon.net for the Events schedule!"
  },
  "framebooks": {
    "stand": 4,
    "say0": 18
  },
  "foundAt": [
    { "id": 0 },
    { "id": 1 }
  ],
  "relatedQuests": [8245, 8247, 8700, ...]
}
```

#### NPC 아이콘

```
GET /npc/{npcId}/icon
```

### Pet (펫)

#### 펫 목록/검색

```
GET /pet?searchFor={name}&count={count}
```

**Response:**

```json
[
  {
    "id": 5000000,
    "name": "Brown Kitty"
  },
  {
    "id": 5000028,
    "name": "Dragon"
  }
]
```

#### 펫 상세 정보

```
GET /pet/{petId}
```

**Response:** 펫의 애니메이션 프레임 데이터 (이미지 base64 포함)

### Map (맵)

#### 맵 검색

```
GET /map?searchFor={name}&count={count}
```

**Response:**

```json
[
  {
    "name": "Henesys",
    "streetName": "Victoria Road",
    "id": 100000000
  }
]
```

#### 맵 상세 정보

```
GET /map/{mapId}
```

**Response:**

```json
{
  "id": 100000000,
  "name": "Henesys",
  "streetName": "Victoria Road",
  "backgroundMusic": "Bgm00/FloralLife",
  "isTown": true,
  "returnMap": 100000000,
  "portals": [...],
  "npcs": [...],
  "mobs": [...],
  "miniMap": {...}
}
```

#### 월드맵

```
GET /map/world
```

**Response:** 월드맵 데이터

#### 맵 이미지

```
GET /map/{mapId}/icon       # 맵 아이콘
GET /map/{mapId}/minimap    # 미니맵 이미지
GET /map/{mapId}/render     # 전체 맵 렌더링 (시간 소요)
```

### Character (캐릭터)

#### 캐릭터 스킨 목록

```
GET /character
```

**Response:**

```json
[2000, 2001, 2002, 2003, 2004, 2009]
```

캐릭터 스킨 ID 목록을 반환합니다.

### Job (직업)

#### 직업 목록 조회

```
GET /job
```

**Response:**

```json
[
  {
    "id": 100,
    "name": "Swordsman (1st)"
  },
  {
    "id": 110,
    "name": "Fighter (2nd)"
  },
  {
    "id": 111,
    "name": "Crusader (3rd)"
  },
  {
    "id": 112,
    "name": "Hero (4th)"
  }
]
```

**직업 ID 체계:**

| ID 범위 | 직업 계열 |
|---------|----------|
| 0 | Beginner |
| 100~132 | Warrior (전사) |
| 200~232 | Magician (마법사) |
| 300~322 | Archer (궁수) |
| 400~422 | Thief (도적) |
| 500~522 | Pirate (해적) |

**전직 단계:**
- x00: 1차 전직
- x10, x20: 2차 전직
- x11, x21: 3차 전직
- x12, x22: 4차 전직

### Skill (스킬) - WZ API 사용

스킬 전용 REST API는 없지만, **WZ API**를 통해 스킬 데이터에 접근할 수 있습니다.

#### 직업별 스킬 목록 조회

```
GET /wz/{REGION}/{VERSION}/Skill/{jobId}.img/skill
```

**예시:** Cleric(230) 스킬 목록

```
GET /wz/GMS/83/Skill/230.img/skill
```

**Response:**

```json
{
  "children": [
    "2300000",
    "2301001",
    "2301002",
    "2301003",
    "2301004",
    "2301005"
  ],
  "type": 13
}
```

#### 스킬 이름/설명 조회

```
GET /wz/{REGION}/{VERSION}/String/Skill.img/{skillId}/name
GET /wz/{REGION}/{VERSION}/String/Skill.img/{skillId}/desc
```

**예시:** Heal(2301002) 스킬 정보

```
GET /wz/GMS/83/String/Skill.img/2301002/name
```

**Response:**

```json
{
  "children": [],
  "type": 8,
  "value": "Heal"
}
```

```
GET /wz/GMS/83/String/Skill.img/2301002/desc
```

**Response:**

```json
{
  "children": [],
  "type": 8,
  "value": "[Master Level : 30]\\nRecovers the HP of all party members..."
}
```

#### 스킬 레벨별 데이터 조회

```
GET /wz/{REGION}/{VERSION}/Skill/{jobId}.img/skill/{skillId}/level/{level}
```

**스킬 ID 체계:**

| ID 패턴 | 설명 |
|---------|------|
| 23xxxxx | Cleric/Priest/Bishop 스킬 |
| 11xxxxx | Fighter/Crusader/Hero 스킬 |
| 21xxxxx | Wizard(F/P) 스킬 |

- 앞 2~3자리: 직업 ID
- 나머지: 스킬 순번

#### 스킬 아이콘

```
GET /wz/{REGION}/{VERSION}/Skill/{jobId}.img/skill/{skillId}/icon
```

**참고:** WZ API는 원시 WZ 파일 구조를 그대로 반환하므로, 데이터 파싱이 필요합니다.

## 이미지 URL 패턴

### 몬스터 이미지

```
# 아이콘 (작은 이미지)
https://maplestory.io/api/{REGION}/{VERSION}/mob/{mobId}/icon

# 렌더 이미지 (큰 이미지, 애니메이션)
https://maplestory.io/api/{REGION}/{VERSION}/mob/{mobId}/render/{animation}
```

### 아이템 이미지

```
https://maplestory.io/api/{REGION}/{VERSION}/item/{itemId}/icon
```

## 사용 예시

### cURL

```bash
# 몬스터 검색
curl "https://maplestory.io/api/GMS/62/mob?searchFor=Snail&count=5"

# 아이템 검색
curl "https://maplestory.io/api/GMS/62/item?searchFor=Ilbi&count=5"

# 퀘스트 검색
curl "https://maplestory.io/api/GMS/62/quest?searchFor=snail&count=5"
```

### JavaScript/TypeScript

```typescript
const BASE_URL = 'https://maplestory.io/api';
const REGION = 'GMS';
const VERSION = '62';

async function searchMobs(name: string) {
  const url = `${BASE_URL}/${REGION}/${VERSION}/mob?searchFor=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  return response.json();
}

async function getMobInfo(mobId: number) {
  const url = `${BASE_URL}/${REGION}/${VERSION}/mob/${mobId}`;
  const response = await fetch(url);
  return response.json();
}
```

## WZ API (원시 데이터)

REST API에서 제공하지 않는 데이터는 WZ API를 통해 직접 접근할 수 있습니다.

### Base URL

```
https://maplestory.io/api/wz/{REGION}/{VERSION}/{WZ_FILE}
```

### WZ 파일 구조

**메인 WZ 파일:**

| WZ 파일 | 내용 |
|---------|------|
| Base | 기본 데이터 |
| Character | 캐릭터 장비, 헤어, 페이스 데이터 |
| Effect | 이펙트 데이터 |
| Etc | 기타 데이터 |
| Item | 아이템 원본 데이터 |
| Map | 맵 원본 데이터 |
| Mob | 몬스터 원본 데이터 |
| Morph | 변신 데이터 |
| Npc | NPC 원본 데이터 |
| Quest | 퀘스트 원본 데이터 (QuestInfo.img, Act.img, Check.img, Say.img) |
| Reactor | 리액터 데이터 |
| Skill | 스킬 데이터 (레벨별 효과, 아이콘 등) |
| Sound | 사운드/BGM 데이터 |
| TamingMob | 라이딩 데이터 |
| UI | UI 리소스 |

**String.wz (이름/설명 데이터):**

| 파일 | 내용 |
|------|------|
| String/Skill.img | 스킬 이름, 설명 |
| String/Mob.img | 몬스터 이름 |
| String/Npc.img | NPC 이름 |
| String/Pet.img | 펫 이름 |
| String/Map.img | 맵 이름 |
| String/Eqp.img | 장비 이름 |
| String/Consume.img | 소비 아이템 이름 |
| String/Etc.img | 기타 아이템 이름 |
| String/Cash.img | 캐시 아이템 이름 |

### 응답 구조

WZ API는 트리 구조로 응답합니다:

```json
{
  "children": ["child1", "child2"],  // 하위 노드 목록
  "type": 13,                         // 노드 타입
  "value": "..."                      // 값 (리프 노드인 경우)
}
```

**타입 코드:**

| type | 의미 |
|------|------|
| 0 | 디렉토리 |
| 8 | 문자열 값 |
| 13 | 컨테이너 (하위 노드 있음) |

### 사용 예시

```bash
# Skill.wz 루트 조회
curl "https://maplestory.io/api/wz/GMS/83/Skill"

# Cleric 스킬 목록
curl "https://maplestory.io/api/wz/GMS/83/Skill/230.img/skill"

# Heal 스킬 이름
curl "https://maplestory.io/api/wz/GMS/83/String/Skill.img/2301002/name"
```

## 주의사항

1. **비공식 API**: 공식적으로 지원되는 API가 아니므로 언제든 변경될 수 있습니다.
2. **Rate Limiting**: 과도한 요청은 제한될 수 있습니다.
3. **버전별 데이터 차이**: 버전에 따라 사용 가능한 데이터가 다릅니다.
4. **KMS latest 미지원**: KMS 리전은 `latest` 버전을 지원하지 않으며, 특정 버전 번호(284~389)를 사용해야 합니다.
5. **검색어 인코딩**: 한글 검색 시 URL 인코딩이 필요합니다.
6. **WZ API 복잡성**: WZ API는 원시 데이터를 반환하므로 파싱 로직 구현이 필요합니다.

## 참고 링크

- [MapleStory.IO 웹사이트](https://maplestory.io/)
- [WZ Explorer](https://maplestory.io/wz) - WZ 파일 탐색기

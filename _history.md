# Mapling - 개발 히스토리

[2026-02-10] [FEAT] Electron 데스크톱 앱 지원: vite-plugin-electron 연동, 메인/프리로드 프로세스, electron-builder 패키징 설정(mac/win/linux)
[2026-02-10] [CONFIG] 화면 1280x720 고정: Electron 창 리사이징 비활성화, 반응형 레이아웃 코드 전면 제거(updateMapSize/onResize/resize 등)
[2026-02-06] 캐릭터 스프라이트: maplestory.io Character API 연동, 32종 모션 GIF(stand/walk/attack/stab/shoot 등), L1/L2 캐싱, 외형(CharacterLook) 시스템
[2026-02-06] 자동전투 시스템: AutoCombatSystem(캐릭터별 개별딜레이/타겟팅), Post-BB 데미지 공식, LevelSystem(EXP분배/레벨업/HP/MP성장), 전투/대기 토글 버튼
[2026-02-06] 직업/EXP 데이터: jobs.ts(5대직업 4차전직 전체 30종), expTable.ts(Lv1-200 필요경험치)
[2026-02-06] 타입 확장: CharacterState에 weaponAttack/magicAttack, PartyCharacter에 mode/targetMonsterId 추가
[2026-02-06] 전체 메모리 누수/성능 최적화: blob URL 해제, rAF 추적/취소, 엔티티 destroy 추가, 이벤트 리스너 정리, 필드 경계 캐싱
[2026-02-06] AssetManager 2단 캐시: L1(메모리)+L2(IndexedDB) 영속 캐시, LRU eviction, QuotaExceeded 폴백
[2026-02-05] 인벤토리 드래그앤드롭: 아이템 슬롯 위치 이동/교환 기능, 드래그 고스트/하이라이트 UI
[2026-02-05] 인벤토리 아이템 툴팁: 호버 시 이름/설명/효과/스탯 표시, 카테고리별 색상 구분
[2026-02-05] 몬스터 처치 시 드랍 아이템 인벤토리 자동 추가: DropSystem에 onItemPickup 콜백, ItemData->Item 변환 함수, 인벤토리 아이콘 표시
[2026-02-02] docs/SCRIPTS_GUIDE.md 생성: fetch 스크립트 사용법/옵션 가이드
[2026-02-02] 모든 스크립트에 --skip-existing 옵션 추가 (기존 파일 스킵)
[2026-02-02] API 버전 GMS/220 -> GMS/62 통일 (빅뱅 이전 버전, 모든 스크립트 및 JSON 반영)
[2026-02-02] fetch-map-all.ts: 맵ID로 맵+몬스터+드롭아이템 일괄 생성 (npm run fetch-map-all --map=ID)
[2026-02-02] fetch-mobs.ts 스크립트: API(스탯)+DB(드롭) 병합, 검색/ID/범위 지원 (npm run fetch-mobs)
[2026-02-02] fetch-maps.ts 스크립트: API 기반 맵 검색/저장 도구 (npm run fetch-maps --search="지역명")
[2026-02-02] fetch-items.ts WZ API 추가: 소비 아이템 effect 필드 (포션 hp/hpR, 주문서 success/incPDD, 표창 attackPower)
[2026-02-02] fetch-items.ts DB+API+WZ 병합: DB(한글/가격/스탯) + API(분류/영문명) + WZ(소비효과)
[2026-02-02] 아이템 데이터 스키마 확장: setup/cash 타입 추가, subCategory/upgradeSlots/icon/only/quest/isCash 필드 추가
[2026-02-02] 아이템 타입 명칭 변경: consume → use (API 응답 overallCategory "Use"와 일치)
[2026-02-02] 아이템 데이터 폴더 구조화: equip/use/setup/etc/cash 폴더 구조, import.meta.glob 패턴 업데이트
[2026-02-02] 아이템 데이터 API 동기화: 전체 44종 아이템을 MapleStory.IO API에서 조회하여 정확한 정보로 업데이트 (가격/능력치/설명/타입 등)
[2026-02-02] 아이템 자동 로드: import.meta.glob 사용, JSON 추가만으로 자동 등록되도록 개선
[2026-02-02] 인벤토리 UI 추가: 파티영역 고정너비 인벤토리(220px), 좌측 파티슬롯/우측 가방, 탭(장비/소비/기타)+메소+동적그리드 스크롤
[2026-02-02] MainScene 대규모 리팩토링: 2008줄→850줄, MonsterSystem/DamageSystem/DropSystem/LogSystem/FieldView로 분리
[2026-02-02] Scene 정리: 미사용 HuntingScene(1243줄)/TownScene(34줄) 삭제, MainScene만 유지
[2026-02-02] 타입 오류 수정: MonsterInfo → MobData (monster.ts 실제 export 타입과 일치)
[2026-01-30] 맵 데이터 재구성: 몬스터 중복 제거, 개미굴/지하철/불타는산 추가, 총 9맵 18몬스터로 정리
[2026-01-30] 맵 데이터 검증/수정: API 기반 BGM 및 스폰 몬스터 검증, MapInfo 타입 isTown 필드 추가
[2026-01-30] 맵 선택 UI 스크롤: 마우스 휠 스크롤 기능, 마스크 처리, 패널 높이 600px로 증가
[2026-01-30] 사냥터 대규모 확장: 리스항구/커닝시티/페리온/엘리니아/슬리피우드 맵 10개, 몬스터 6종 추가
[2026-01-30] 달팽이 전용 위치 버그 수정: 사망 시 spriteContainer.y 명시적 리셋 추가
[2026-01-30] 한 방 사망 시 위치 버그 수정: 데미지 숫자 표시 전 위치 리셋, HP바 표시 조건 개선
[2026-01-30] 점프 중 사망 버그 수정: 몬스터 사망 시 점프 상태/위치 리셋, 공중 부유 방지
[2026-01-30] BGM 끊김 문제 수정: playBgm에서 stopBgm await 추가, state 즉시 초기화로 race condition 방지
[2026-01-30] 맵 선택 UI 아이콘: 지역별 색상/이모지 아이콘 추가, 시각적 구분 강화
[2026-01-30] 맵 계층 구조: streetName/mapMark 필드 추가, 지역>마을 그룹핑 표시
[2026-01-30] docs/DATA_GUIDE.md: 맵/몬스터 JSON 추가 절차 가이드 작성
[2026-01-30] 스킬 슬롯 개수 변경: 8개 → 6개
[2026-01-30] 캐릭터 생성 UI: 이름 입력, 능력치 분배(기본4/총30포인트), 키보드 입력 지원
[2026-01-30] 캐릭터 추가 버튼 헤더 고정: 메소 좌측에 원형 + 버튼 배치 (1명 이상일 때)
[2026-01-30] 캐릭터 추가 버튼 개선: 1명 이상일 때 우측 상단 작은 원형 + 버튼으로 변경
[2026-01-30] 파티 슬롯 동적 렌더링: 캐릭 없으면 생성버튼만, 있으면 고정너비 중앙정렬, 최대4개
[2026-01-30] 클릭 공격 범위 제한: 사냥 필드 영역에만 적용 (fieldLayer 이벤트)
[2026-01-30] 파티 슬롯 UI 컴포넌트: PartySlot/StatusBar/SkillBar, HP/MP/EXP 바, 스킬 슬롯 8개, 클릭 이벤트
[2026-01-30] MainScene 생성: 헤더(맵/메소)/파티슬롯(4개)/필드/로그 4개 영역 분리 레이아웃
[2026-01-30] 기획 변경: 단일 페이지 레이아웃 + 파티 시스템(4인) + 상단 캐릭터/하단 필드 구조
[2026-01-30] 데미지 폰트 메이플 스타일 적용: 주황색(일반)/분홍색(크리티컬), 개별 숫자 바운스, 스태킹
[2026-01-30] 사운드 시스템: BGM, 몬스터 피격/사망, 아이템 획득 효과음
[2026-01-30] 로그 시스템: 경험치/아이템/메소 획득 로그, 최대 10개, 페이드아웃
[2026-01-30] 전투 데모: 클릭 공격, 크리티컬(30%), 데미지 스태킹
[2026-01-30] 사냥터 필드 데모: 몬스터 스폰/페이드인, 랜덤 행동, HP바/이름표
[2026-01-30] JSON 명명규칙: {id}_{name}.json, mapledb.kr 기반 드롭 정보
[2026-01-30] 프로젝트 초기 구조: Vite+TypeScript+PixiJS+Zustand

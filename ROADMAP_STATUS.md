# 우선순위 로드맵 진행 현황

마지막 갱신: 2026-07-11 · v3.4.0

"우선순위 로드맵" 9개 항목의 진행 상태를 기록한다. 다음 작업자는 이 문서로 어디까지 됐는지, 무엇이 남았는지 먼저 확인할 것.

## 상태 요약

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | /manage 색상 토큰 통일 (파랑→브랜드 앰버) | ✅ 완료 | master의 기존 디자인 작업을 Natural_Fox에 동기화하며 반영 |
| 2 | /manage에 다크모드 연결 | ✅ 완료 | 상동 |
| 3 | 계약관리·자산실사현황 등 상단 요약 스탯 타일 | ✅ 완료 | 계약관리(ContractPanel)는 기존에 이미 있었음. 자산실사현황(PcScanPanel)에 신규 추가 |
| 4 | D-day/상태 기반 행·카드 배경 틴트 | ✅ 완료 | 계약관리는 기존에 이미 있었음. 수리트래커(HwRepairPanel/RepairPanel)에 신규 추가 |
| 5 | 공용 필터 컴포넌트 접기/펼치기 | 🟡 부분 완료 | **컴포넌트만 신규 개발**(`components/admin/shared/FilterBar.tsx`). 기존 패널(SwPanel, RepairPanel 등) 리팩터링/적용은 아직 안 함 |
| 6 | /manage 상단 탭 → 좌측 사이드바 | ✅ 완료 | master 동기화로 반영 |
| 7 | 수리트래커·자산흐름에 단계별 요약 바 | ✅ 완료 | RepairPanel은 기존에 이미 있었음. HwRepairPanel·ExchangeReturnPanel에 신규 추가 |
| 8 | 포털 홈 "내 현황" 개인화 요약 카드 | ⏸️ 보류 | 일반 포털에 로그인/세션 체계가 전혀 없어(완전 공개 익명 접근) 사용자 식별 방법부터 결정 필요. 이번 라운드 범위에서 제외 |
| 9 | 주요 지표에 전월 대비 추세(스파크라인) | 🟡 부분 완료(파일럿) | 인프라(Redis 일별 스냅샷) + `DashboardHome`의 HW 전체 자산 **1곳에만** 파일럿 적용. 다른 지표로 확장 안 함 |

## 다음 작업자를 위한 메모

### 5번 — FilterBar 적용 대상 정하기
`components/admin/shared/FilterBar.tsx` 컴포넌트는 완성됐지만 아직 어느 패널에도 연결되지 않았다. 기존에 인라인 chip 필터를 쓰는 화면들(`app/manage/page.tsx`의 `SwPanel`, `RepairPanel.tsx`, `HwRepairPanel.tsx` 등)을 이 컴포넌트로 교체할지, 한다면 어떤 순서로 할지 사용자와 먼저 정할 것.

### 9번 — 스냅샷 데이터 축적 대기 + 롤아웃 범위 결정
- `.github/workflows/snapshot-daily.yml`이 매일 00:10 UTC에 `snapshot:YYYY-MM-DD` 키로 Redis에 저장을 시작한다(2026-07-11 배포 기준 첫 스냅샷은 다음 cron 실행부터). **전월 대비 추세가 화면에 보이려면 최소 한 달치 스냅샷이 쌓여야 한다** — 그 전까지 `DashboardHome`의 추세 배지는 조용히 숨겨진 상태가 정상이다.
- 현재는 HW 전체 자산 수치 1곳(`app/api/hw/stats/route.ts` → `DashboardHome.tsx`)에만 적용됨. SW 라이선스 등 다른 지표로 확장하려면 `lib/metrics-snapshot.ts`의 `getMonthOverMonthTrend()`를 재사용하면 된다(이미 `swTotal`도 스냅샷에 같이 저장되고 있음 — 조회 lib만 붙이면 됨).

### 8번 — 착수 전 결정 필요
포털 사용자 식별 방식(이메일 입력 기반 간단 조회 / 정식 로그인 도입 / 보류 유지) 결정부터 필요. 결정되면 별도 계획 수립부터 다시 시작할 것.

## 관련 커밋

- 베이스 동기화(master 디자인 작업 → Natural_Fox): `731415c`
- 3번(자산실사 스탯 타일): `c9b2d15`
- 5번(FilterBar 신규): `c979e06`
- 4+7번(수리트래커·자산흐름 배경틴트/요약카드): `94555c2`
- 9번(스냅샷 인프라+파일럿): `ad3fb0e`
- 통합 병합: `993e716` (Natural_Fox → TEST → master)

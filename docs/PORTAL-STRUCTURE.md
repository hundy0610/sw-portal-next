# SW Portal — 전체 구조 가이드

> 이 문서는 **"이 포털에 어떤 페이지/기능이 있고, 무엇이 무엇을 호출하는가"** 에 대한
> 단일 진실 소스다. 데이터 저장 아키텍처(맥북 Postgres + Notion 백업)의 상세는
> **[docs/ARCHITECTURE-4.0.md](ARCHITECTURE-4.0.md)**, 작업 시 반드시 지킬 규칙 요약은
> **[AGENTS.md](../AGENTS.md)** 를 참고한다. 이 문서는 그 둘을 전제로, **화면/라우트/권한**
> 관점에서 전체 그림을 보여준다.

작성 시점 기준(2026-07-24, `master` HEAD 기준)이며, 이후 페이지가 추가/삭제되면
이 문서도 같이 갱신해야 한다.

---

## 1. 이 앱은 무엇인가

- Next.js 14+ App Router, 단일 Vercel 프로젝트(레포 1개, 배포 1개)로 여러 도메인에서
  서비스된다: **`swportal.vercel.app`**, **`assetify-desk.vercel.app`**(및 그 파생 별칭들)
  등은 전부 **같은 배포를 가리키는 커스텀 도메인**이다 — 별도 앱이 아니다.
  - `assetify-desk`라는 이름이 남은 이유는 역사적이다: `/request/*` 서브트리(§4.3)가
    원래 "Assetify Desk"라는 **별도 프로젝트**였던 것을 이 레포로 통합했기 때문.
    통합 후에도 다른 화면들의 "IT 지원 문의" 버튼은 여전히 옛 단독 배포 URL
    (`https://assetify-desk-main.vercel.app`)을 가리키는 곳이 있다 — 의도된 링크가
    맞는지, 계속 이 URL이어야 하는지는 확인이 필요하다.
- 사내 IT 자산관리 포털: SW 라이선스/HW 자산/헬프데스크/자산실사/회의실 대여 등을
  하나의 코드베이스에서 관리한다.
- 데이터는 **맥북 한 대에서 자체 호스팅하는 Supabase(Postgres)** 가 메인이고,
  **Notion은 5분 주기 단방향 백업**이다 (§3, 상세는 ARCHITECTURE-4.0.md).

---

## 2. 전체 URL 지도 (한눈에)

```
/                          ─ 직원 포털 (홈/교육센터/SW검색 탭) — 공개
/resources                 ─ 자료실 (설치파일/문서) — 공개
/declaration                ─ SW 자산 실사 신고 — 공개(본인 식별)
/asset-audit                ─ 실사 프로그램 다운로드 안내 — 공개
/asset-audit/manager        ─ 직책자용 실사 진행률·독려 — OTP 인증
/survey                     ─ 번역툴 수요조사 — 공개
/event, /event/result       ─ 사내 이벤트(토토) 참여/결과 — 공개
/event/admin                ─ 이벤트 관리 — 슈퍼 어드민 전용

/inquiry, /inquiry/feedback/[id]      ─ (구) IT 문의 접수 — 공개
/request, /request/inquiry, /request/repair, /request/meeting-rental (+ /ticket/[id])
                                       ─ (신) "Assetify Desk" 통합 접수창구 — 공개

/manage                      ─ 포털 콘텐츠 CMS(공지/교육/자료실/SW검색/매뉴얼) — 슈퍼 전용
/admin/login                 ─ 관리자 로그인
/admin/change-password       ─ 최초 로그인 비밀번호 변경
/admin                       ─ 관리자 데스크탑 대시보드 (25개 섹션) — 로그인 필요
/admin/mobile                ─ 관리자 모바일 앱 (5개 핵심 뷰) — 모바일 기기 자동 리다이렉트
```

---

## 3. 데이터 아키텍처 (요약 — 전체는 ARCHITECTURE-4.0.md)

- **메인 저장소**: 맥북 1대에서 도는 자체 호스팅 Supabase(Postgres). Vercel → 맥북은
  **Tailscale Funnel(HTTPS)** 로만 연결(`SUPABASE_URL`/`SUPABASE_KEY` env).
- **Notion**: 더 이상 실시간 소스가 아니다. **단방향 백업**(맥북 launchd 잡이 5분마다
  Postgres의 `dirty=true` 행만 Notion에 반영). 앱 코드는 Notion에 직접 쓰지 않는다.
- **접근 계층**:
  - 범용 엔티티(HW 제외 전부): `lib/repo/mirror.ts` → `entity_store` 테이블
    (`readEntity`/`readEntityOne`/`upsertEntity`/`deleteEntity`).
  - HW 전용: `lib/repo/hw.ts` → `public.hw` 테이블.
  - 단순 KV(공지/강의/계정/감사로그 등): `lib/kv-store.ts` → `public.kv` 테이블
    (예전 Upstash Redis 자리를 대체. **Redis/Upstash는 완전히 제거됨** — 되살리지 말 것).
- **파일 첨부**: Vercel Blob(`lib/blob-store.ts`)이 원본. 백업 잡이 Notion으로 재업로드.
- ⚠️ **알려진 함정 — 전송 경로 캐싱**: 맥북 Funnel 경로 어딘가(Tailscale/Kong)에서
  페이지네이션(Range 헤더) 응답을 캐싱하는 문제가 실제로 발견됐다(2026-07-24). 모든
  Supabase 클라이언트 생성 시 `Cache-Control: no-store, no-cache, must-revalidate` +
  `Pragma: no-cache` 헤더를 명시적으로 넣어야 한다(`lib/kv-store.ts`, `lib/repo/hw.ts`,
  `lib/repo/mirror.ts`에 이미 적용됨 — 새 Supabase 클라이언트를 추가할 때도 동일하게 넣을 것).
- ⚠️ **알려진 함정 — 읽기 경로가 안 옮겨진 곳**: v4.0 전환이 "쓰기"부터 Postgres로 옮기고
  "읽기"는 파일마다 따로 옮겨졌기 때문에, 일부 라우트가 아직 예전 `hw:all` KV 캐시
  (GitHub Actions 크론이 30분~2시간마다만 갱신)나 Notion 직접조회를 쓰고 있을 수 있다.
  새 코드를 작성/리뷰할 때 **"이 읽기가 Postgres를 우선 조회하는가"** 를 항상 확인한다
  (패턴: `getHwAllFromPostgres()`/`readEntity()` 우선 → 실패/미설정 시에만 KV 폴백).
- ⚠️ **임시 진단 라우트**: `app/api/diag-pg-check/route.ts`는 위 캐싱 버그를 확인하려고
  만든 **임시 디버그 엔드포인트**다. 원인 확인이 끝나면 삭제할 것(작성자 본인 코멘트).

---

## 4. 페이지별 상세

### 4.1 직원 포털 (공개, 로그인 불필요)

| 경로 | 목적 | 주요 API |
|---|---|---|
| `/` | 홈(공지사항+바로가기) / 교육센터 / SW검색 3탭. 사이드바에 "관리자" 링크 | `/api/notices`, `/api/courses`, `/api/sw-db` |
| `/resources` | 자료실 — SW 버전별 설치파일/설치안내/규정 문서, 규정 확인 체크 후 다운로드 잠금해제 | `/api/sw-versions`, `/api/sw-docs`, `/api/sw-docs/{id}/file` |
| `/declaration` | 이름+법인으로 본인 식별 후 사용 중 SW 신고(자산실사) | `/api/declaration`, `/api/declaration/history` |
| `/asset-audit` | 실사 프로그램(Win/Mac) 다운로드 안내·참여 동의 | `/api/asset-audit/config` |
| `/asset-audit/manager` | 직책자 전용 — 이메일 OTP 인증(8h 토큰) 후 담당 조직 실사 진행률 조회 + 미완료자 독려메일 | `/api/asset-audit/manager-auth`, `-verify`, `-tree`, `-remind` |
| `/survey` | 실시간 번역툴 수요조사 | `/api/survey` |
| `/event` | 사내 이벤트(점수예측) 참여 | `/api/event/employees`, `/api/event/config`, `/api/event/submit` |
| `/event/result` | 이벤트 결과 발표 | `/api/event/result` |
| `/inquiry`, `/inquiry/feedback/[id]` | (구버전) IT 문의 접수 + 만족도 평가 | `/api/inquiry`, `/api/feedback` |

### 4.2 `/manage` — 포털 콘텐츠 CMS (슈퍼 전용)

`middleware.ts`가 `/manage/*`를 세션 확인 + `role==="super"` 로 보호한다(⚠️ `.env.example`의
`MANAGE_SECRET_KEY`/`MANAGE_PASSWORD`는 **레거시 — 코드 어디서도 참조되지 않는다.** URL
시크릿+비번 방식은 지금 안 쓰이고, 관리자 세션 쿠키+role 체크로 완전히 대체됐다).

탭: 공지사항 / 교육과정 / SW 자료실(버전+파일) / SW 검색(화이트/블랙리스트) / 매뉴얼.
`/`(공지·교육·SW검색)과 `/resources`(SW자료실)에 뜨는 콘텐츠를 여기서 편집한다.

### 4.3 `/request` — "Assetify Desk" 통합 접수창구 (공개)

| 경로 | 목적 |
|---|---|
| `/request` | 문의하기 / 모니터 수리 접수 / 회의실 무선장비 대여신청 메뉴 허브 |
| `/request/inquiry` (+ `/ticket/[id]`) | 문의 접수 폼 + 티켓 상세(매뉴얼 추천 포함) |
| `/request/repair` (+ `/ticket/[id]`) | 모니터 수리 접수 폼 + 티켓 상세 |
| `/request/meeting-rental` (+ `/ticket/[id]`) | 회의실 장비 대여신청 폼 + 티켓 상세 |

**`/request/inquiry` vs `/inquiry` — 왜 두 개인가**: 같은 "IT 문의 접수" 기능의 **신·구
버전**이다. `/inquiry`는 폼+상태를 한 파일에 담은 가볍고 오래된 단독 버전(`/api/inquiry`
하나만 호출, 티켓 조회 없음). `/request/inquiry`는 원래 별도 배포였던 "Assetify Desk"를
통합한 신규 버전으로, 옵션조회/제출/티켓상세까지 갖추고 `/api/request/*` 네임스페이스를
쓰며 독자적 디자인 시스템(`assetify-root`, 액센트 `#ED8B00`)을 가진다. **정리(deprecate)할
지, 용도가 나뉘어 있는지는 코드만으로는 알 수 없으니 팀에 확인이 필요하다.**

### 4.4 `/admin` — 관리자 데스크탑 대시보드

`app/admin/page.tsx` 하나가 세션 조회(`/api/admin/auth`) 후 사이드바 + `renderPanel()`
스위치로 아래 컴포넌트를 `dynamic(..., {ssr:false})` 로 로드한다.

**권한 모델** (`lib/session.ts`의 `AdminSession.role`):
- `super`: 전체 법인 데이터 + 전체 섹션 접근.
- `company`: 자기 법인 데이터만(`companyScope()`), `SUPER_ONLY_PAGES` 접근 불가(`<AccessDenied/>`).
- `general`("총무관리자"): `company`와 동일하게 제한.
- `SUPER_ONLY_PAGES` (14개): `credentials, swdb, accounts, contracts, rental-hw, hw-repair, exchange-return, work-feedback, worktracker, meeting-rental, pc-scan, pc-register, asset-audit-settings, org-chart, asset-audit-dashboard`.
- 쿠키의 role/이름은 로그인 시점 스냅샷이라, 서버 라우트들은 매번 `resolveCurrentRole()`/
  `resolveCurrentName()`으로 최신 계정 DB 값을 다시 조회해 검증한다(계정 관리에서 권한을
  바꿔도 재로그인 없이 즉시 반영되게 하기 위함).

**상단 헤더**: 사이드바 토글 · 직원 포털로 이동 · 역할 배지(SA/AD) · "Notion 연동 중" 표시 ·
갱신 알림 벨(`RenewalAlertModal`) · 다크모드 토글 · 로그아웃.

**사이드바 섹션** (그룹: 하드웨어 자산 / 소프트웨어 자산 / 사용자 지원 / 관리):

| 섹션명 | pageId | 컴포넌트 | 권한 | 설명 |
|---|---|---|---|---|
| 대시보드 | `home` | `DashboardHome.tsx` | 전체 | 전사 현황 요약 |
| 자산 흐름 관리 | `exchange-return` | `ExchangeReturnPanel.tsx` | 슈퍼 | 교체·반납·신규지급·임대 트래커(7단계) |
| 노트북/데스크탑 자산관리 | `hw` | `HwPanel.tsx` | 전체(법인필터) | HW 마스터 — 내부 10탭(대시보드/출고/반납/검색/이력/업로드/불출이력/등록로그/라벨/법인별재고) |
| PC 신규 등록 | `pc-register` | `PcRegisterPanel.tsx` | 슈퍼 | 실사 수집 데이터로 신규 등록 |
| 수리/과실청구 트래커 | `hw-repair` | `HwRepairPanel.tsx` | 슈퍼 | 외부 수리·과실 청구 |
| 임대노트북 현황 관리 | `rental-hw` | `RentalHwPanel.tsx` | 슈퍼 | 임시 PC 대여·반납 |
| 스마트오피스 모니터 관리 | `assetmap` | `AssetMapPanel.tsx` | 전체 | 인터랙티브 자산 맵·모니터 요청 처리 |
| 온라인 자산 실사 | `pc-scan` | `PcScanPanel.tsx` | 슈퍼 | 실사 에이전트 PC 수집 데이터 |
| └ 실사 프로그램 배포 설정 | `asset-audit-settings` | `AssetAuditSettingsPanel.tsx` | 슈퍼 | 안내문·버전·공개여부 |
| └ 조직도 관리 | `org-chart` | `OrgChartPanel.tsx` | 슈퍼 | 사업부/본부/센터/팀·직책자 |
| └ 실사 진행률 대시보드 | `asset-audit-dashboard` | `AssetAuditDashboardPanel.tsx` | 슈퍼 | 계약 수량 대비 달성률 |
| 전사 라이선스 현황 | `overview` | `OverviewPanel.tsx` | 전체(법인필터) | 요약 대시보드 |
| 상용 라이선스 자산관리 | `license` | `LicensePanel.tsx` | 전체(법인필터) | 영구·구독 통합 관리(복제 기능 포함) |
| 계정 관리 | `credentials` | `CredentialsPanel.tsx` | 슈퍼 | ID/PW 보관함(암호화) |
| 라이선스 설치 정책 관리 | `swdb` | `SwDbPanel.tsx` | 슈퍼 | 승인/금지 목록 |
| 구독형 라이선스 현황 | `report` | `ReportPanel.tsx` | 전체(법인필터) | 현황 분석·만료 알림 |
| 문의 접수 현황 | `helpdesk` | `HelpDeskPanel.tsx` | 전체 | 유형·법인별 분석 — 내부 9탭 |
| 모니터 수리 접수 내역 | `repair` | `RepairPanel.tsx` | 전체(법인필터) | 모니터 수리 접수·처리 |
| 회의실 장비 대여 관리 | `meeting-rental` | `MeetingRentalPanel.tsx` | 슈퍼 | 신청 티켓·장비 현황 — 내부 2탭 |
| 업무 툴 수요조사 | `survey-demand` | `SurveyDemandPanel.tsx` | 전체 | 번역 툴 수요 응답 |
| 계정 권한 설정 | `accounts` | `AccountsPanel.tsx` | 슈퍼 | 담당자 계정 관리 |
| 계약 관리 | `contracts` | `ContractPanel.tsx` | 슈퍼 | PC/OA 유지보수 계약 |
| 업무 피드백 | `work-feedback` | `WorkFeedbackPanel.tsx` | 슈퍼 | 연/월/주간 목표 — 내부 3탭 |
| 버그리포트 | `bugreport` | `BugReportPanel.tsx` | 전체 | 버그·개선요청 칸반 |
| 작업 트래커 | `worktracker` | `WorkTrackerPanel.tsx` | 슈퍼 | 개인 작업 칸반 |

전역 모달: `RenewalAlertModal`. 스위치에 직접 안 걸리는 보조 컴포넌트:
`AssetModal.tsx`, `MonitorAssetSection.tsx`, `FloorMapEditor/View.tsx`, `FloorSketches.tsx`,
`LabelPrintTab.tsx`, `TicketPanel.tsx`, `shared/{FilterBar,BulkEditBar,BulkEditModal,AssetFlowSync}.tsx`.

### 4.5 `/admin/mobile` — 관리자 모바일 앱

`middleware.ts`가 모바일 User-Agent로 `/admin` 접속 시 자동 리다이렉트한다. 데스크탑
대비 **5개 핵심 뷰만** 제공(PWA, `ServiceWorkerRegistrar.tsx`):

| 모바일 탭 | 컴포넌트 | 데스크탑 대응 |
|---|---|---|
| 홈 | `mobile/MobileDashboard.tsx` | home |
| 자산흐름 | `mobile/MobileExchangeReturn.tsx` (슈퍼 전용) | exchange-return |
| HW자산 | `mobile/MobileHw.tsx` | hw |
| SW자산 | `mobile/MobileSw.tsx` | overview + license |
| 헬프데스크 | `mobile/MobileHelpDesk.tsx` | helpdesk |

나머지 20개 데스크탑 섹션(수리/회의실대여/수요조사/계정관리/정책관리/현황분석/계정권한/
계약관리/업무피드백/버그리포트/작업트래커/자산맵/임대HW/수리트래커/PC등록/온라인실사 등)은
**모바일 화면이 없다** — 필요 시 데스크탑 뷰로 안내해야 한다.

### 4.6 `/event/admin`

이벤트(사내 토토) 관리 전용, 슈퍼 어드민만 접근(`middleware.ts`에서 별도 가드).
마감/회차/참여제한 설정 + 참여현황·분포 대시보드. `/api/event/config`, `/api/event/submissions`.

---

## 5. 인증 흐름 요약

- **관리자 세션**: `admin_session` 쿠키(HMAC 서명, `lib/session.ts`/`middleware.ts` 양쪽에
  각자 검증 로직이 있다 — Edge 미들웨어는 Web Crypto, 서버 라우트는 Node `crypto`를 쓰므로
  **서명 로직을 바꿀 땐 두 곳 다 고쳐야 한다**). `SESSION_SECRET` 미설정 시 로그인 전부 거부.
- **역할 재조회**: 쿠키는 로그인 시점 스냅샷 — `resolveCurrentRole`/`resolveCurrentName`이
  매 민감 요청마다 최신 계정 DB(Postgres `kv` 테이블의 `sw:accounts`)를 다시 조회한다.
  미들웨어는 Edge에서 매 요청 실행되므로 5초짜리 짧은 인메모리 캐시를 둔다(`_accountsCache`).
- **미들웨어 보호 대상** (`middleware.ts`의 `matcher`): `/admin/:path*`, `/event/admin/:path*`,
  `/manage/:path*` 뿐이다. 다른 모든 페이지(공개 페이지, `/request/*` 등)는 미들웨어를
  거치지 않고, 필요하면 각 API 라우트 안에서 개별적으로 세션을 검사한다.
- **`/asset-audit/manager`**: 관리자 세션이 아니라 **별도의 이메일 OTP** 방식(8시간 토큰).

---

## 6. 자동화 (GitHub Actions — `.github/workflows/`)

| 워크플로 | 주기 | 역할 |
|---|---|---|
| `deploy-vercel.yml` | `master` push 시 | `npx vercel --prod` 로 프로덕션 배포 트리거 |
| `warm-helpdesk.yml` | 5분 | `helpdesk:tickets` KV 캐시(TTL 5분) 상시 웜업 |
| `kv-cleanup.yml` | 15분 | 만료된 `public.kv` 행 정리 |
| `warm-hw.yml` | 30분 | Notion → (레거시 경로) HW 캐시 웜업 — Postgres 전환 후에도 남아있는 보조 경로 |
| `warm-cache.yml` | 10분 | 기타 KV 캐시 상시 웜업 |
| `helpdesk-escalation-cron.yml` | 30분 | 30분 이상 "시작 전" 상태인 문의 에스컬레이션 알림 |
| `send-feedback-cron.yml` | 1시간 | 만족도 평가 메일 발송 안전망(주 트리거는 Notion 웹훅) |
| `cleanup-expired.yml` | 매일 09:00 KST | 만료 라이선스 등 정리 |
| `close-registered-pc.yml` | 매일 10:00 KST | 전월 이전 등록완료 PC 신규등록 건 종료 처리 |
| `snapshot-daily.yml` | 매일 00:10 UTC | 캐시 기반 일일 스냅샷 저장(`getMonthOverMonthTrend` 등에 사용) |
| `seed-portal.yml` | 수동(workflow_dispatch) | 포털 초기 데이터 시딩 |

`vercel.json`은 `{}`(빈 설정)이다 — Vercel 자체 cron 기능은 안 쓰고 전부 GitHub Actions로 처리한다.

---

## 7. 알려진 레거시/확인 필요 사항

- `.env.example`의 `MANAGE_SECRET_KEY`/`MANAGE_PASSWORD`, `ADMIN_PASSWORD`, `RESEND_*` —
  코드에서 더 이상 참조되지 않는 **죽은 설정값**으로 보인다. 지우기 전에 실제로 아무 데도
  안 쓰이는지 한 번 더 grep 확인 권장.
  - `ADMIN_PASSWORD`: `lib/session.ts`/`admin/auth` 어디서도 미참조 확인됨(계정은
    `sw:accounts` KV + `SUPER_ADMIN_ID`/`SUPER_ADMIN_PW` ENV 슈퍼어드민 방식으로 대체).
- `app/api/licenses/*`, `app/api/subscriptions/route.ts` — 홈 화면 카드 등에서 쓰던
  **레거시 라이선스 트래커**로 보인다(별도 Notion DB 직접조회, Postgres 미러 미적용).
  실제 라이선스 관리는 `license`/`overview` 섹션(`/api/sw-records`, `/api/sw/*`)이 담당하니,
  `/api/licenses`가 여전히 화면에서 쓰이는지 확인 후 정리 대상인지 판단할 것.
- `app/api/diag-pg-check/route.ts` — Funnel 캐싱 버그 진단용 임시 라우트. 삭제 예정.
- `/request/*`의 "IT 지원 문의" 외부 링크가 옛 단독 배포 도메인
  (`assetify-desk-main.vercel.app`)을 가리키는 곳들 — 통합이 끝난 지금도 맞는 링크인지 확인 필요.
- `/inquiry` vs `/request/inquiry` 중복 — 어느 한쪽을 deprecate할 계획이 있는지 팀 확인 필요.

---

## 8. 새로 합류한 개발자를 위한 순서

1. **[AGENTS.md](../AGENTS.md)** 로 데이터 아키텍처 30초 요약 + 하지 말아야 할 것 확인.
2. 이 문서(§2 URL 지도)로 전체 화면 감 잡기.
3. 실제로 만질 기능이 있으면 §4의 해당 표에서 컴포넌트 파일 + API 경로 확인 후 코드 진입.
4. 쓰기 경로를 만들 땐 반드시 `lib/repo/mirror.ts`(`upsertEntity`/`deleteEntity`) 또는
   `lib/repo/hw.ts`를 거칠 것 — Notion 직접 쓰기 금지, Redis/Upstash 재도입 금지.
5. 커밋/푸시/머지/프로덕션 배포는 **명시적 승인 후**에만 진행한다(브랜치: 기능브랜치 →
   `TEST`(sw-portal-next-test.vercel.app) → `master`(프로덕션)).

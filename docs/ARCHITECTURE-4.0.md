# SW-PORTAL 아키텍처 가이드 (맥북 중앙 Postgres)

> **TL;DR (English):** The MacBook is the single central data host. It runs self-hosted
> Supabase (Postgres) in Docker, exposed to Vercel **only** over an HTTPS Tailscale Funnel
> (port 8000). Postgres is the **only** read/write store — the Notion integration was removed
> in 2026-09 (code, backup runner, and dependency all gone). Backups are the weekly `pg_dump`
> job on the MacBook. Redis/Upstash is **removed** — KV lives in Postgres. Never expose the
> DB port (5432) to the internet, never commit secrets/`.env`.

이 문서는 3.x → **4.0** 대규모 구조 변경의 단일 진실 소스다. 다른 PC(대부분 Claude Code)에서
작업할 때 반드시 이 구조를 따른다.

---

## 1. 큰 그림 (Big picture)

```
[사용자] ──► [Vercel 앱 (Next.js)] ──HTTPS(Tailscale Funnel)──► [맥북]
                                                                 ├─ Supabase/Postgres (Docker, 127.0.0.1:8000)
                                                                 └─ launchd 주간 pg_dump 백업
```

- **앱**: Vercel에서 그대로 구동(Next.js).
- **데이터 호스트**: 이 **맥북 한 대**가 중앙 DB. 자체 호스팅 Supabase(Postgres)를 Docker로 구동.
- **연결**: Vercel → 맥북은 **Tailscale Funnel(HTTPS)** 로만 접근한다.
  - 공개 주소: `https://userui-macbookpro.tailc11f42.ts.net` → 내부 `http://127.0.0.1:8000`(Kong/PostgREST).
  - **DB 포트 5432는 절대 인터넷에 노출하지 않는다.** 오직 HTTPS 8000만 Funnel로 나간다.
- **보안**: PostgREST + RLS + `service_role` 키. 키가 없으면 데이터 접근이 거부된다(401). Funnel은 공개 경로이므로 `SUPABASE_KEY`(service_role) 보관이 곧 보안이다. 선택적으로 `SWP_DB_SECRET`(→ `x-swp-secret` 헤더)로 한 겹 더 보강.

---

## 2. 데이터 모델: Postgres 하나

- **Postgres 가 유일한 저장소**다. 예전에는 Notion 이 원본이었고, 4.0 에서 Postgres 를 메인으로
  올린 뒤에도 5분마다 Notion 으로 단방향 백업하는 launchd 잡이 돌았다.
- **2026-09 에 Notion 연동을 전부 걷어냈다** — 백업 러너(`scripts/backup-to-notion.ts`),
  매핑(`lib/backup/notion-map.ts`), 폴백 읽기 경로, `@notionhq/client` 의존성, launchd plist
  까지 모두 제거했다. 레코드의 `notionUrl` 필드만 과거 잔재로 남아 있고 신규 건은 빈 문자열이다.
- **백업은 주간 `pg_dump`** 다 — 맥북의 `scripts/backup-weekly.sh` 가 전체 덤프 + Vercel Blob
  첨부 원본 + 매니페스트를 뜬다(assetify-for-desktop 저장소).
- `entity_store` 의 `dirty` · `synced_at` · `notion_id` 컬럼은 더 이상 쓰이지 않는다. 되돌릴
  여지를 남기려고 컬럼 자체는 지우지 않았다.

## 3. KV / 캐시: Redis/Upstash 제거됨 ⚠️

- **Upstash/Redis는 런타임에서 완전히 제거**됐다. KV는 이제 **Postgres `public.kv`** (`lib/kv-store.ts`)를 쓴다.
- `kvGet/kvSet/memGet/memSet` 등 예전 헬퍼는 **사라졌다.** 새 코드에서 **Redis/Upstash를 다시 도입하지 말 것.**
- ⚠️ 주의: `TEST`/`master`에는 과거 "Redis 관련 긴급 수정" 커밋들이 있다. 4.0 위에서 작업할 때 그 패턴(존재하지 않는 `REDIS_URL` 체크 등)을 되살리지 말 것.
- 기존 Upstash 데이터 1회 이관은 `scripts/seed-kv.ts` 참고(이관 시에만 Upstash 자격증명 사용).

---

## 4. 미러 패턴 (엔티티 저장 방식)

- **제네릭 미러 테이블**: `public.entity_store` — HW·모니터를 뺀 모든 엔티티를 담는다.
  - 접근은 `lib/repo/mirror.ts`로만: `readEntity` / `readEntityOne` / `upsertEntity` / `deleteEntity`. 전부 서버 전용 `service_role`.
  - 컬럼: `entity, id, data(jsonb), deleted, updated_at` (+ 안 쓰는 잔재 `notion_id · dirty · synced_at`).
- **HW는 전용 테이블** `public.hw` (`lib/repo/hw.ts`)를 쓴다(대용량 자산 데이터).
- **⚠️ 읽기 규칙 (중요)**: `readEntity()`는 미러가 **미설정**일 때만 `null` 을 준다(데이터가 없으면 빈 배열). 호출부는 `null` 이면 폴백하지 않고 오류를 던진다 — 조용히 빈 목록을 보여주지 않기 위해서다.
  - **따라서 전환(cutover) 전에 반드시 미러를 시드해야 한다.** 시드 안 하면 앱에 "빈 목록"이 뜬다(데이터 유실 아님, 표시만 비어 보임).

### 현재 미러에 올라간 엔티티 (11종) + HW
`entity_store`: `meeting-equipment`, `exchange-return`, `contracts`, `pc-scan`,
`pc-register`, `sw`, `hw-repair`, `helpdesk`, `repair`, `meeting-rental`, `credentials`,
`survey-demand`(원본이 비어 0건) — 그리고 별도 테이블 `public.hw`.

`rental-hw`(임대노트북 현황 관리)는 걷어냈다 — 임대 자산의 원본은 HWDB 하나이고, 법인명이
`임대용`이고 상태가 `재고`인 자산이 임대 재고다(데스크탑 앱 v1.30.0). `entity_store` 의 기존
31건은 지우지 않고 남겨뒀지만 읽지도 쓰지도 않는다.

---

## 6. 알림 (Notifications)

- **신규 접수 알림은 앱이 직접 이메일로 발송**한다(`lib/mail.ts`, nodemailer + Gmail).
  - 대상: 헬프데스크 신규 문의, 수리 신규 접수, 회의실 대여 신규 요청.
- 기존 Notion Automation 웹훅 라우트는 **전부 삭제**했다. 알림은 앱이 직접 보낸다.
- 메일 전송에는 `GMAIL_USER`, `GMAIL_APP_PASSWORD`가 필요하다. (참고: `.env.example`의 `RESEND_*`는 레거시이며 현재 전송 경로에서 사용하지 않는다.)

---

## 7. 환경변수

> 비밀값은 **절대 커밋/문서화하지 않는다.** 아래는 이름과 용도만. 값은 각 환경에서 관리한다.

### (i) Vercel (Preview / Production) — 앱 런타임
| 변수 | 용도 |
|---|---|
| `DATA_SOURCE=postgres` | Postgres를 1차 소스로 사용 |
| `SUPABASE_URL` | 맥북 Funnel 주소 (`https://userui-macbookpro.tailc11f42.ts.net`) |
| `SUPABASE_KEY` | Supabase **service_role** 키(서버 전용, RLS 우회) |
| `SWP_DB_SECRET` | (선택) 공유 시크릿, `x-swp-secret` 헤더 검증 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 파일 저장 (Storage 연결 시 자동 주입) |
| `SESSION_SECRET` | 관리자 세션 서명(미설정 시 로그인 전부 거부) |
| `SUPER_ADMIN_ID` / `SUPER_ADMIN_PW` | ENV 슈퍼어드민 로그인 |
| `CREDENTIALS_ENC_KEY` | 계정보관함 암복호화 (⚠️ **모든 환경에서 동일 값**이어야 기존 암호문 복호화 가능) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | 신규 접수 알림·피드백 메일 발송 |
| `NEXT_PUBLIC_APP_URL` | 메일 링크·notify origin |
| `ADMIN_PASSWORD`, `MANAGE_SECRET_KEY`, `MANAGE_PASSWORD`, `CRON_SECRET` | 기존 관리/크론 보호값 |

### (ii) 맥북 로컬 `.env` (git 제외) — 백업 러너 + 시드 스크립트 전용
| 변수 | 용도 |
|---|---|
| `PGHOST` / `PGPORT` / `PGUSER` / `PGDATABASE` / `PGPASSWORD` (또는 `DATABASE_URL`) | 로컬 Postgres 직결 |
| `BLOB_READ_WRITE_TOKEN` | 파일 엔티티 시드 시 Blob 업로드 |
| `SUPABASE_URL` / `SUPABASE_KEY` | (미러 접근이 필요한 스크립트용) |

---

## 8. 다른 PC에서 작업하기 (Claude Code 워크플로우)

- 중앙 Postgres는 **맥북에만** 있다. 다른 PC는 **코드 작업만** 한다 — 로컬 DB를 새로 띄우지 말 것.
- 앱을 로컬에서 중앙 데이터로 돌려보려면 로컬 `.env`에:
  - `DATA_SOURCE=postgres`
  - `SUPABASE_URL=https://userui-macbookpro.tailc11f42.ts.net`
  - `SUPABASE_KEY=<service_role 키>`
  - (쓰기 알림 테스트가 필요하면 `GMAIL_*`, 파일 테스트면 `BLOB_READ_WRITE_TOKEN`)
  - 맥북의 Supabase/Funnel이 켜져 있어야 접근된다.
- **5분 백업 launchd 잡은 맥북에서만** 돈다. 다른 PC에 설치 금지.
- **마이그레이션**: 스키마 변경은 `scripts/sql/NNN_*.sql`에 추가하고 `npm run migrate`를 **중앙 DB 대상**으로 실행(공유 상태 변경이므로 사전 합의 필요).
- **시드**: `npm run seed:entities` / `npm run seed:hw`는 **중앙 DB 1회성** 작업(맥북에서).

### 자주 쓰는 명령 (맥북)
```bash
npm run migrate                 # scripts/sql/*.sql 순서대로 적용
npm run seed:hw                 # HW → public.hw 초기 적재
npm run seed:entities           # 전체 미러 엔티티 초기 적재
npm run seed:entities -- sw helpdesk   # 특정 엔티티만
```

### 가용성 / 잠들지 않게 유지 (Availability / keep-awake)

맥북이 잠들면 Funnel(HTTPS 8000)과 로컬 Supabase가 도달 불가가 되어, 배포된 앱이
미러를 못 읽어 관리자 화면이 오류를 띄운다. 이를 막기 위해:

1. **idle 슬립 방지 (sudo 불필요, 유저 레벨 launchd + `caffeinate -s`)**
```bash
cp deploy/com.swportal.keepawake.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.swportal.keepawake.plist 2>/dev/null
launchctl load  ~/Library/LaunchAgents/com.swportal.keepawake.plist
launchctl list | grep -i swportal     # com.swportal.keepawake 로드 확인
pmset -g assertions | grep PreventSystemSleep   # caffeinate assertion 확인
```
2. **클램셸(뚜껑 닫힘) 슬립 방지** — `caffeinate -s`로는 못 막는다. 뚜껑을 닫고
   운용하려면 관리자 권한으로:
```bash
sudo pmset -c disablesleep 1     # AC 전원에서 슬립 완전 비활성(클램셸 포함)
sudo pmset -c womp 1 powernap 0  # (선택) 네트워크 웨이크 유지, powernap 끄기
```
   되돌리기: `sudo pmset -c disablesleep 0`
3. **Tailscale Funnel 재기동** — tailscaled가 시스템 데몬(`/Library/LaunchDaemons/com.tailscale.tailscaled.plist`)으로
   돌면 재부팅 후 serve/funnel 설정이 복원된다. 매핑이 없으면(확인: `tailscale funnel status`):
```bash
tailscale funnel --bg 8000       # sudo 불필요(tailscaled 떠 있으면)
```
4. **Supabase Docker 자동 기동** — 컨테이너 restart 정책은 `unless-stopped`(부팅 시 자동 복구).
   단, **Docker Desktop 자체가 로그인 시 실행**되어야 한다:
   Docker Desktop → Settings → General → *Start Docker Desktop when you sign in* 체크.

---

## 9. 브랜치 & 안전 규칙

- 브랜치: 기능작업 → 해당 브랜치, **`TEST` → `sw-portal-next-test.vercel.app`**, **`master` → 프로덕션**.
- **커밋 / 푸시 / 머지 / 프로덕션 배포는 명시적 승인 필요.**
- **DB 포트를 인터넷에 노출 금지.** 오직 Funnel(HTTPS 8000)만.
- **비밀값 커밋 금지.** `.env`는 git 제외. 문서/로그/코드에 실제 키를 남기지 말 것.
- 불확실하면 **묻는다.**

---

## 10. 핵심 파일 맵

| 파일 | 역할 |
|---|---|
| `lib/repo/mirror.ts` | 제네릭 미러(`entity_store`) 접근 (service_role) |
| `lib/repo/hw.ts` | HW 전용 테이블(`public.hw`) 접근 + 소스 스위치 |
| `scripts/seed-kv.ts` | (1회) Upstash → Postgres KV 이관 |
| `scripts/migrate.ts` | `scripts/sql/*.sql` 마이그레이션 러너 |
| `scripts/sql/001_hw.sql` `002_kv.sql` `003_entity_store.sql` | 스키마 정의 |
| `lib/kv-store.ts` | KV(공지/설정 등) — Postgres `public.kv` |
| `lib/blob-store.ts` | Vercel Blob 업로드 |
| `lib/mail.ts` | 이메일(nodemailer + Gmail) |
| `deploy/com.swportal.keepawake.plist` | idle 슬립 방지 launchd 유닛(`caffeinate -s`) — Funnel/DB 24/7 도달성 유지 |

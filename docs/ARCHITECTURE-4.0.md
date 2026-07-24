# SW-PORTAL 4.0 아키텍처 가이드 (맥북 중앙 Postgres + Notion 백업)

> **TL;DR (English):** The MacBook is the single central data host. It runs self-hosted
> Supabase (Postgres) in Docker, exposed to Vercel **only** over an HTTPS Tailscale Funnel
> (port 8000). Postgres is the **main** read/write store for every entity that used to live
> in Notion; **Notion is now a one-way backup** synced every 5 minutes by a launchd job that
> runs **only on the MacBook**. Redis/Upstash is **removed** — KV lives in Postgres. Never
> expose the DB port (5432) to the internet, never commit secrets/`.env`.

이 문서는 3.x → **4.0** 대규모 구조 변경의 단일 진실 소스다. 다른 PC(대부분 Claude Code)에서
작업할 때 반드시 이 구조를 따른다.

---

## 1. 큰 그림 (Big picture)

```
[사용자] ──► [Vercel 앱 (Next.js)] ──HTTPS(Tailscale Funnel)──► [맥북]
                                                                 ├─ Supabase/Postgres (Docker, 127.0.0.1:8000)
                                                                 └─ launchd 5분 백업 잡 ──► [Notion (백업, 읽기전용성격)]
```

- **앱**: Vercel에서 그대로 구동(Next.js).
- **데이터 호스트**: 이 **맥북 한 대**가 중앙 DB. 자체 호스팅 Supabase(Postgres)를 Docker로 구동.
- **연결**: Vercel → 맥북은 **Tailscale Funnel(HTTPS)** 로만 접근한다.
  - 공개 주소: `https://userui-macbookpro.tailc11f42.ts.net` → 내부 `http://127.0.0.1:8000`(Kong/PostgREST).
  - **DB 포트 5432는 절대 인터넷에 노출하지 않는다.** 오직 HTTPS 8000만 Funnel로 나간다.
- **보안**: PostgREST + RLS + `service_role` 키. 키가 없으면 데이터 접근이 거부된다(401). Funnel은 공개 경로이므로 `SUPABASE_KEY`(service_role) 보관이 곧 보안이다. 선택적으로 `SWP_DB_SECRET`(→ `x-swp-secret` 헤더)로 한 겹 더 보강.

---

## 2. 데이터 모델: Postgres 메인 / Notion 백업

- **Postgres가 메인(읽기+쓰기)** 이다. 예전에 Notion에 직접 읽고 쓰던 모든 엔티티가 이제 Postgres를 1차 소스로 사용한다.
- **Notion은 단방향 백업**이다. 앱이 Postgres에 쓰면 해당 행이 `dirty=true`로 표시되고, **5분마다** launchd 잡(`scripts/backup-to-notion.ts`)이 dirty 행만 Notion으로 반영한다.
  - **낙관적 잠금**: 백업은 `updated_at`을 확인해 백업 도중 새 수정이 들어온 행은 다음 주기로 미룬다(덮어쓰기 방지).
  - **소프트 삭제**: `deleted=true`인 행은 백업 시 Notion 페이지를 **archive** 처리한다.
  - 백업 성공 시에만 `dirty=false` + `synced_at` 기록.
- **파일 첨부**는 Vercel Blob이 소스(`lib/blob-store.ts`). 백업 잡이 Blob 파일을 Notion으로 **재업로드**한다(노션 원본 URL은 ~1시간 후 만료되므로 Blob이 내구 저장소).

### 백업 잡은 맥북에서만 돈다
- launchd 유닛: `deploy/com.swportal.backup-notion.plist` → `~/Library/LaunchAgents/`에 설치, `StartInterval=300`(5분).
- **다른 PC에는 절대 설치하지 않는다.** 중앙 DB(맥북)에서만 백업이 돌아야 한다.

---

## 3. KV / 캐시: Redis/Upstash 제거됨 ⚠️

- **Upstash/Redis는 런타임에서 완전히 제거**됐다. KV는 이제 **Postgres `public.kv`** (`lib/kv-store.ts`)를 쓴다.
- `kvGet/kvSet/memGet/memSet` 등 예전 헬퍼는 **사라졌다.** 새 코드에서 **Redis/Upstash를 다시 도입하지 말 것.**
- ⚠️ 주의: `TEST`/`master`에는 과거 "Redis 관련 긴급 수정" 커밋들이 있다. 4.0 위에서 작업할 때 그 패턴(존재하지 않는 `REDIS_URL` 체크 등)을 되살리지 말 것.
- 기존 Upstash 데이터 1회 이관은 `scripts/seed-kv.ts` 참고(이관 시에만 Upstash 자격증명 사용).

---

## 4. 미러 패턴 (엔티티 저장 방식)

- **제네릭 미러 테이블**: `public.entity_store` — 모든(HW 제외) Notion 연동 엔티티를 담는다.
  - 접근은 `lib/repo/mirror.ts`로만: `readEntity` / `readEntityOne` / `upsertEntity` / `deleteEntity`. 전부 서버 전용 `service_role`.
  - 컬럼: `entity, id, notion_id, data(jsonb), deleted, dirty, updated_at, synced_at`.
- **HW는 전용 테이블** `public.hw` (`lib/repo/hw.ts`)를 쓴다(대용량 자산 데이터).
- **⚠️ 읽기 규칙 (중요)**: `readEntity()`는 미러가 켜져 있으면 데이터가 없어도 **빈 배열 `[]`** 을 돌려준다. 호출부는 `const m = await readEntity(...); if (m) return m; ...Notion폴백` 패턴이라 `[]`도 truthy → **미러가 켜지면 Notion으로 폴백하지 않는다.**
  - **따라서 전환(cutover) 전에 반드시 미러를 시드해야 한다.** 시드 안 하면 앱에 "빈 목록"이 뜬다(데이터 유실 아님, 표시만 비어 보임).

### 현재 미러에 올라간 엔티티 (12종) + HW
`entity_store`: `meeting-equipment`, `exchange-return`, `rental-hw`, `contracts`, `pc-scan`,
`pc-register`, `sw`, `hw-repair`, `helpdesk`, `repair`, `meeting-rental`, `credentials`,
`survey-demand`(원본이 비어 0건) — 그리고 별도 테이블 `public.hw`.

---

## 5. 새 Notion 연동 엔티티 추가하는 법

1. **`lib/backup/notion-map.ts`에 등록** (두 곳):
   - `entityRegistry[<key>]`: 백업용 `buildProperties`(앱 data → Notion 프로퍼티 매핑). 파일 첨부가 있으면 `files` 설정. 대상 DB는 `databaseId`(대부분) 또는 `dataSourceId`(신규 API 데이터소스 부모).
   - `seedRegistry[<key>]`: 초기 이관용 `fetch()`(Notion → 미러 레코드). 반드시 Notion에서 **직접** 읽는 `*FromNotion` 함수를 감쌀 것(미러 우선 래퍼를 쓰면 빈 배열이 돌아온다).
2. **lib/route에서 미러 사용**: 읽기는 `readEntity/readEntityOne`, 쓰기는 `upsertEntity`(자동으로 `dirty=true`), 삭제는 `deleteEntity`(소프트 삭제).
3. **파일 첨부**: `lib/blob-store.ts`로 Vercel Blob 업로드 → 저장 데이터엔 Blob URL 보관. 백업 잡이 `files` 설정을 보고 Notion으로 재업로드.
4. **맥북 `.env`에 그 엔티티의 `NOTION_DB_*`(또는 `*_DATA_SOURCE_ID`) 추가** — 없으면 백업/시드에서 "id 미설정 → 건너뜀".
5. 초기 데이터 적재: `npm run seed:entities -- <key>` (맥북에서 1회).

---

## 6. 알림 (Notifications)

- **신규 접수 알림은 앱이 직접 이메일로 발송**한다(`lib/mail.ts`, nodemailer + Gmail).
  - 대상: 헬프데스크 신규 문의, 수리 신규 접수, 회의실 대여 신규 요청.
- 이 항목들의 **기존 Notion 웹훅은 무력화(no-op)** 됐다 — 5분 백업 지연 때문에 즉시성이 필요한 알림은 앱에서 바로 보낸다.
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
| `NOTION_TOKEN` + `NOTION_DB_*` | 폴백/시드 참조용 |
| `SESSION_SECRET` | 관리자 세션 서명(미설정 시 로그인 전부 거부) |
| `SUPER_ADMIN_ID` / `SUPER_ADMIN_PW` | ENV 슈퍼어드민 로그인 |
| `CREDENTIALS_ENC_KEY` | 계정보관함 암복호화 (⚠️ **모든 환경에서 동일 값**이어야 기존 암호문 복호화 가능) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | 신규 접수 알림·피드백 메일 발송 |
| `NEXT_PUBLIC_APP_URL` | 메일 링크·notify origin |
| `ADMIN_PASSWORD`, `MANAGE_SECRET_KEY`, `MANAGE_PASSWORD`, `CRON_SECRET` | 기존 관리/크론 보호값 |

### (ii) 맥북 로컬 `.env` (git 제외) — 백업 러너 + 시드 스크립트 전용
| 변수 | 용도 |
|---|---|
| `NOTION_TOKEN` | Notion API |
| 모든 `NOTION_DB_*` / `*_DATA_SOURCE_ID` | 백업/시드 대상 DB id들 |
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
npm run backup:notion           # 백업 1회 수동 실행(평소엔 launchd가 5분마다)
```

### launchd 백업 잡 (맥북)
```bash
mkdir -p ~/Library/LaunchAgents
cp deploy/com.swportal.backup-notion.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.swportal.backup-notion.plist 2>/dev/null
launchctl load  ~/Library/LaunchAgents/com.swportal.backup-notion.plist
launchctl list | grep swportal        # 종료코드 0 확인
cat /tmp/swportal-backup-notion.out   # 실행 로그
```

### 가용성 / 잠들지 않게 유지 (Availability / keep-awake)

맥북이 잠들면 Funnel(HTTPS 8000)과 로컬 Supabase가 도달 불가가 되어, 배포된 앱이
미러를 못 읽고 **5분 지연된 Notion 백업으로 조용히 폴백**한다(방금 저장한 최신
문의 항목이 목록에서 누락되는 증상). 이를 막기 위해:

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
| `lib/backup/notion-map.ts` | 백업 매핑(`entityRegistry`) + 초기 시드 소스(`seedRegistry`) |
| `scripts/backup-to-notion.ts` | dirty 행 → Notion 반영 (launchd 5분) |
| `scripts/seed-entities.ts` | Notion → `entity_store` 초기 적재 |
| `scripts/seed-hw.ts` | Notion → `public.hw` 초기 적재 |
| `scripts/seed-kv.ts` | (1회) Upstash → Postgres KV 이관 |
| `scripts/migrate.ts` | `scripts/sql/*.sql` 마이그레이션 러너 |
| `scripts/sql/001_hw.sql` `002_kv.sql` `003_entity_store.sql` | 스키마 정의 |
| `lib/kv-store.ts` | KV(공지/설정 등) — Postgres `public.kv` |
| `lib/blob-store.ts` | Vercel Blob 업로드 |
| `lib/mail.ts` | 이메일(nodemailer + Gmail) |
| `deploy/com.swportal.backup-notion.plist` | 5분 백업 launchd 유닛 |
| `deploy/com.swportal.keepawake.plist` | idle 슬립 방지 launchd 유닛(`caffeinate -s`) — Funnel/DB 24/7 도달성 유지 |

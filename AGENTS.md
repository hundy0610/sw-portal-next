# AGENTS.md — SW-PORTAL 4.0 개발/에이전트 가이드

이 저장소는 **4.0 대규모 구조 변경** 상태다. 작업 전 이 문서를 반드시 읽는다.
전체 상세는 **[docs/ARCHITECTURE-4.0.md](docs/ARCHITECTURE-4.0.md)** 참고.

## 30초 요약
- **맥북 한 대가 중앙 DB.** 자체 호스팅 Supabase(Postgres, Docker)를 **Tailscale Funnel(HTTPS)** 로 노출: `https://userui-macbookpro.tailc11f42.ts.net` → `127.0.0.1:8000`.
- **Postgres가 메인(읽기+쓰기).** Notion은 **단방향 백업**(맥북 launchd 잡이 5분마다 dirty 행만 반영).
- **Redis/Upstash 제거됨.** KV는 Postgres `public.kv`(`lib/kv-store.ts`). 다시 도입 금지.
- **DB 포트(5432) 인터넷 노출 금지.** 오직 Funnel(8000)만.

## 데이터 접근 규칙
- 엔티티(HW 제외) 저장소: `public.entity_store` ← **`lib/repo/mirror.ts`** (`readEntity`/`readEntityOne`/`upsertEntity`/`deleteEntity`, 전부 `service_role`).
- HW: 전용 테이블 `public.hw` ← `lib/repo/hw.ts`.
- 쓰기는 `upsertEntity`(→ `dirty=true` 자동). 삭제는 `deleteEntity`(소프트 삭제 → 백업이 Notion archive).
- ⚠️ `readEntity()`는 미러가 켜지면 빈 배열 `[]`(truthy)을 반환 → **Notion 폴백 안 함.** 전환 전 반드시 `seed:entities`로 미러를 채운다.

## 새 Notion 연동 엔티티 추가
`lib/backup/notion-map.ts`에 `entityRegistry`(백업 `buildProperties`, 필요 시 `files`) + `seedRegistry`(`*FromNotion`로 초기 적재) 등록 → lib/route에서 미러 사용 → 파일은 `lib/blob-store.ts`(Vercel Blob) → 맥북 `.env`에 그 DB의 `NOTION_DB_*` 추가.

## 알림
신규 헬프데스크/수리/회의실대여 알림은 **앱이 직접 이메일 발송**(`lib/mail.ts`, Gmail: `GMAIL_USER`/`GMAIL_APP_PASSWORD`). 관련 Notion 웹훅은 무력화(no-op).

## 명령 (중앙 DB = 맥북에서)
```bash
npm run migrate          # scripts/sql/*.sql 적용
npm run seed:hw          # HW 초기 적재
npm run seed:entities    # 미러 엔티티 초기 적재 ( -- <key> 로 일부만 )
npm run backup:notion    # 백업 1회 수동(평소 launchd 5분)
```
launchd 백업 잡(`deploy/com.swportal.backup-notion.plist`)은 **맥북에서만** 설치/구동한다. 다른 PC 설치 금지.

## 다른 PC(주로 Claude Code)에서
- 로컬 DB 띄우지 말 것. 중앙(맥북) Postgres를 쓴다.
- 로컬 `.env`: `DATA_SOURCE=postgres`, `SUPABASE_URL=<Funnel 주소>`, `SUPABASE_KEY=<service_role>` (+ 필요 시 `GMAIL_*`, `BLOB_READ_WRITE_TOKEN`). 맥북 Supabase/Funnel이 켜져 있어야 한다.
- 스키마 변경은 `scripts/sql/NNN_*.sql` + `npm run migrate`(중앙 DB, 사전 합의).

## 안전 규칙 (엄수)
- **커밋/푸시/머지/프로덕션 배포는 명시적 승인 필요.**
- 브랜치: `TEST` → 테스트 배포(`sw-portal-next-test.vercel.app`), `master` → 프로덕션.
- **비밀값 커밋 금지**, `.env`는 git 제외. 문서/로그/코드에 실제 키 남기지 말 것.
- **DB 포트 인터넷 노출 금지.** 불확실하면 묻는다.

## 환경변수
전체 목록/용도는 [docs/ARCHITECTURE-4.0.md §7](docs/ARCHITECTURE-4.0.md) 참고. 핵심: `DATA_SOURCE`, `SUPABASE_URL`, `SUPABASE_KEY`(service_role), `BLOB_READ_WRITE_TOKEN`, `NOTION_TOKEN`+`NOTION_DB_*`, `SESSION_SECRET`, `CREDENTIALS_ENC_KEY`(모든 환경 동일), `GMAIL_USER`/`GMAIL_APP_PASSWORD`.

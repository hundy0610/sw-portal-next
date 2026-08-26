# CLAUDE.md

> 이 프로젝트의 개발 가이드는 **[AGENTS.md](AGENTS.md)** 에 있다. 작업 전 반드시 먼저 읽을 것.
> 전체 상세 아키텍처는 **[docs/ARCHITECTURE-4.0.md](docs/ARCHITECTURE-4.0.md)**.

## 반드시 지킬 핵심 (4.0)

1. **맥북 한 대가 중앙 DB다.** 자체 호스팅 Supabase(Postgres)를 Tailscale Funnel(HTTPS)로 노출:
   `https://userui-macbookpro.tailc11f42.ts.net` → `127.0.0.1:8000`. **DB 포트 5432를 인터넷에 노출하지 말 것.**
2. **Postgres = 메인(읽기+쓰기). Notion = 단방향 백업**(맥북 launchd 잡이 5분마다 dirty 행만 반영). 앱 코드에서 Notion에 직접 쓰지 말고 미러를 통해 쓴다.
3. **Redis/Upstash는 제거됐다.** KV는 Postgres `public.kv`(`lib/kv-store.ts`). `kvGet/kvSet/memGet/memSet`를 되살리거나 `REDIS_URL`/Upstash를 다시 도입하지 말 것. (TEST/master의 과거 Redis 수정 패턴을 4.0에서 부활시키지 말 것.)
4. **데이터 접근**: 엔티티는 `lib/repo/mirror.ts`(`entity_store`), HW는 `lib/repo/hw.ts`(`public.hw`). 쓰기는 `upsertEntity`(자동 `dirty=true`), 삭제는 `deleteEntity`(소프트).
5. ⚠️ `readEntity()`는 미러가 켜지면 빈 배열도 반환하므로 **Notion 폴백이 안 된다.** 전환 전 반드시 `npm run seed:entities`로 미러를 채운다.
6. **신규 접수 알림은 앱이 직접 이메일 발송**(`lib/mail.ts`, Gmail `GMAIL_USER`/`GMAIL_APP_PASSWORD`). 관련 Notion 웹훅은 no-op.
7. **파일 첨부는 Vercel Blob**(`lib/blob-store.ts`)이 소스, 백업 잡이 Notion으로 재업로드.

## 하지 말 것 (Do NOT)
- 사용자 승인 없이 **커밋/푸시/머지/프로덕션 배포** 하지 말 것.
- **비밀값을 코드/문서/로그/커밋에 남기지 말 것.** `.env`는 git 제외.
- 다른 PC에서 **로컬 DB를 새로 띄우거나 launchd 백업 잡을 설치**하지 말 것(백업은 맥북에서만).
- 확실하지 않으면 **추측하지 말고 물어볼 것.**

## 자주 쓰는 명령 (중앙 DB = 맥북)
```bash
npm run migrate          # scripts/sql/*.sql 적용 (공유 상태 변경 — 사전 합의)
npm run seed:entities    # 미러 초기 적재 ( -- <key> 로 일부만 )
npm run seed:hw          # HW 초기 적재
npm run backup:notion    # 백업 1회 수동 (평소엔 launchd가 5분마다)
```

## 브랜치
`TEST` → `sw-portal-next-test.vercel.app`, `master` → 프로덕션. 배포/머지는 승인 후.

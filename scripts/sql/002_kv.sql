-- SW-PORTAL 4.0verMACBOOK — KV 저장소 (Upstash Redis 대체)
-- lib/kv-store.ts 의 kvGet/kvSet/kvSetPermanent/kvMGet/kvDel 백엔드.
--   value      : jsonb (앱이 저장하던 객체/배열/원시값을 그대로 보관)
--   expires_at : null 이면 영구(kvSetPermanent), 값이 있으면 TTL 만료 시각(kvSet)
-- 조회 시 만료분은 앱에서 제외하고, 실제 삭제는 kv-cleanup 크론이 수행한다.

create table if not exists public.kv (
  "key"        text primary key,
  "value"      jsonb,
  "expires_at" timestamptz,
  "updated_at" timestamptz default now()
);

-- 만료 스윕(delete where expires_at < now()) 및 만료 제외 조회 최적화
create index if not exists kv_expires_at_idx on public.kv ("expires_at");

-- 보안: KV 는 전부 서버 전용(service_role)으로만 접근한다.
-- 공개 Funnel 로 오는 anon/authenticated 에는 어떤 권한도 주지 않는다(계정·설정 변조 방지).
alter table public.kv enable row level security;
revoke all on public.kv from anon, authenticated;
grant all on public.kv to service_role;

-- PostgREST 스키마 캐시 즉시 리로드
notify pgrst, 'reload schema';

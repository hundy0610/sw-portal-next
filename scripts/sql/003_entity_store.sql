-- SW-PORTAL 4.0verMACBOOK — 제네릭 엔티티 미러 저장소
-- 맥북 Postgres 를 모든 Notion 연동 엔티티의 메인(읽기/쓰기)으로 쓰고,
-- 5분마다 dirty 행만 Notion 으로 단방향 백업한다(백업 러너: 맥북 launchd).
--
--   entity     : 엔티티 키 (예: 'sw','helpdesk','repair','rental-hw' ...)
--   id         : 앱 레코드 id (기존 데이터는 Notion page id, 신규 생성은 로컬 uuid)
--   notion_id  : 백업된 Notion page id (신규 생성건은 백업 성공 후 기록)
--   data       : 앱 레코드 전체(jsonb) — 읽기 시 그대로 반환
--   deleted    : 소프트 삭제(백업 시 Notion 페이지 archive)
--   dirty      : 마지막 백업 이후 변경됨 → 백업 대상
--   updated_at : 최종 변경 시각
--   synced_at  : 마지막 Notion 백업 성공 시각

create table if not exists public.entity_store (
  "entity"     text        not null,
  "id"         text        not null,
  "notion_id"  text,
  "data"       jsonb       not null,
  "deleted"    boolean     not null default false,
  "dirty"      boolean     not null default true,
  "updated_at" timestamptz not null default now(),
  "synced_at"  timestamptz,
  primary key ("entity", "id")
);

-- 엔티티 전체 조회(읽기) 및 백업 대상(dirty) 조회 최적화
create index if not exists entity_store_entity_idx       on public.entity_store ("entity");
create index if not exists entity_store_entity_dirty_idx on public.entity_store ("entity", "dirty");

-- HW 는 기존 typed hw 테이블 유지 + 백업 추적 컬럼만 추가(읽기 스위치는 이미 동작).
alter table public.hw add column if not exists "dirty"     boolean     not null default false;
alter table public.hw add column if not exists "deleted"   boolean     not null default false;
alter table public.hw add column if not exists "notion_id" text;
alter table public.hw add column if not exists "synced_at" timestamptz;
-- 기존 HW 행은 Notion 에서 이관된 것이므로 notion_id = id (page id) 로 backfill.
update public.hw set "notion_id" = "id" where "notion_id" is null;
create index if not exists hw_dirty_idx on public.hw ("dirty");

-- 보안: 미러/HW 모두 서버 전용 service_role 로만 접근. anon/authenticated 차단.
alter table public.entity_store enable row level security;
revoke all on public.entity_store from anon, authenticated;
grant all on public.entity_store to service_role;

-- PostgREST 스키마 캐시 즉시 리로드
notify pgrst, 'reload schema';

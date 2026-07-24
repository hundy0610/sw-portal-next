-- SW-PORTAL 4.0verMACBOOK — HW 파일럿 테이블
-- 컬럼명은 앱의 HwRecord(lib/hw.ts) 키와 동일하게 맞춰, repo 계층에서 별도 매핑 없이
-- select * 결과가 그대로 HwRecord 형태가 되도록 한다(UI 무수정 목표).
-- 날짜류는 Notion이 문자열("YYYY-MM-DD" 또는 "")로 주는 값을 그대로 저장해 정합성 드리프트를 막는다.

create table if not exists public.hw (
  "id"             text primary key,          -- Notion page id
  "notionUrl"      text,
  "user"           text,
  "assetNo"        text,
  "model"          text,
  "serial"         text,
  "maker"          text,
  "cpu"            text,
  "ram"            text,
  "company"        text,
  "dept"           text,
  "location"       text,
  "status"         text,
  "returnDue"      text,
  "returnDate"     text,
  "purchaseDate"   text,
  "useDate"        text,
  "price"          numeric default 0,
  "residualValue"  numeric default 0,
  "note"           text,
  "docNo"          text,
  "mac"            text,
  "email"          text,
  "verified"       boolean default false,
  "duplicated"     boolean default false,
  "lastModifiedBy" text,
  "lastModifiedAt" text,
  "changeLog"      text,
  "updated_at"     timestamptz default now()
);

create index if not exists hw_company_idx on public.hw ("company");
create index if not exists hw_status_idx  on public.hw ("status");
create index if not exists hw_assetno_idx on public.hw ("assetNo");
create index if not exists hw_user_idx    on public.hw ("user");
create index if not exists hw_serial_idx  on public.hw ("serial");

-- RLS: 공개 Funnel 경로로 오는 anon 키는 읽기만 허용(보완책). 쓰기 권한은 부여하지 않는다.
-- 초기 이관/운영 쓰기는 맥북 로컬에서 service_role 키(RLS 우회)로 수행한다.
alter table public.hw enable row level security;

drop policy if exists hw_anon_read on public.hw;
create policy hw_anon_read on public.hw
  for select to anon, authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.hw to anon, authenticated;

-- PostgREST 스키마 캐시 즉시 리로드
notify pgrst, 'reload schema';

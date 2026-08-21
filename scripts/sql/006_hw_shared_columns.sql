-- ─────────────────────────────────────────────────────────────────────────────
-- public.hw 에 공용 자산 두 컬럼 (공용PC 표시)
--
--   isShared    공용 자산 여부   실사 수집의 [공용] 체크 · 자산 상세에서 켠다
--   sharedName  공용 용도/위치   예: "3층 회의실"
--
-- 왜 사용자 이름이 아니라 별도 플래그인가: 예전에는 공용PC 를 이름 규칙으로 구분했다
-- ("용도_담당자이름_공용"). 사람 칸에 사람 아닌 값이 들어가 실사 진행률 대조(조직도
-- 명단 vs 제출)가 어긋났고, hw 의 "user" 컬럼도 오염됐다. 이제 담당자 이름은 그대로
-- 받고 공용 여부는 이 플래그로 둔다.
--
-- **Assetify Desktop 1.39.0 배포보다 먼저 적용해야 한다.** 그 앱의 core/repo/hw.ts 는
-- 컬럼을 하나하나 명시해서 select 하므로, 없는 컬럼을 요청하면 조회 하나가 아니라 HW
-- 전체 조회가 실패한다(하이드레이션 실패 → 자산 화면이 통째로 빈다).
-- 데스크탑 저장소에도 같은 내용이 문서로 있다(scripts/sql/002_hw_shared_column.sql).
--
-- 되돌리기:
--   alter table public.hw drop column if exists "isShared", drop column if exists "sharedName";
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.hw
  add column if not exists "isShared"   boolean not null default false,
  add column if not exists "sharedName" text    not null default '';

comment on column public.hw."isShared"   is '공용 자산 여부. 실사 수집의 [공용] 체크 또는 자산 상세에서 켠다.';
comment on column public.hw."sharedName" is '공용 용도/위치. 예: 3층 회의실';

---
version: alpha
name: SW-PORTAL
description: 사내 SW 자산 포털. Portal(일반 사용자) / Admin(관리자) / Request(자산·티켓 신청) 세 서브시스템이 타이포·간격 스케일은 각자 유지하되, 액센트 색과 현황·상태 색만은 2026-07부터 하나의 공유 토큰으로 통일한다.
colors:
  # ── 공유 토큰 (Portal + Admin 공통, Request는 자체 세맨틱 변수 유지) ──
  brand: "#D97706"           # 유일한 인터랙션 액센트 — 버튼·링크·활성 탭·포커스. Admin의 admin-accent가 이 값을 참조한다.
  brand-soft: "#FCEEDA"
  state-positive: "#2F6B44"       # 사용중·완료·승인
  state-progress: "#1D4ED8"       # 진행중·처리중
  state-caution: "#9C6B1E"        # 갱신필요·대기성 단계
  state-risk: "#A6392C"           # 만료·불일치·미설치
  state-neutral: "#6B7280"        # 재고·대기·해당없음
  portal-bg: "#fef3d0"
  portal-border: "#fde68a"
  portal-text-heading: "#1c1006"
  portal-text-body: "#44403c"
  portal-text-sub: "#6B778C"
  admin-sidebar: "#18181B"
  admin-bg: "#FAFAFA"
  admin-surface: "#FFFFFF"
  admin-surface-sunken: "#F4F4F5"
  admin-border: "#E4E4E7"
  admin-text-primary: "#18181B"
  admin-text-secondary: "#52525B"
  admin-accent: "{colors.brand}"   # 인디고(#4F46E5)에서 브랜드 앰버로 전환 — Portal과 동일한 액센트를 공유
  admin-dark-bg: "#09090B"
  admin-dark-surface: "#18181B"
  request-accent: "#ED8B00"
  request-bg-standard: "#FAFAFA"
  request-content-primary: "#292A2E"
typography:
  portal-heading:
    fontFamily: Manrope
    fontWeight: 800
  portal-body:
    fontFamily: Inter
    fontWeight: 400
  request-display:
    fontFamily: Wanted Sans Variable
    fontSize: 48px
    lineHeight: 64px
    letterSpacing: -1.44px
  request-title:
    fontFamily: Wanted Sans Variable
    fontSize: 24px
    lineHeight: 32px
    letterSpacing: -0.48px
  request-heading:
    fontFamily: Wanted Sans Variable
    fontSize: 20px
    lineHeight: 28px
    letterSpacing: -0.4px
  request-body:
    fontFamily: Wanted Sans Variable
    fontSize: 16px
    lineHeight: 24px
    letterSpacing: -0.32px
  request-label:
    fontFamily: Wanted Sans Variable
    fontSize: 14px
    lineHeight: 22px
    letterSpacing: -0.28px
  request-footnote:
    fontFamily: Wanted Sans Variable
    fontSize: 12px
    lineHeight: 20px
    letterSpacing: -0.24px
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
---

## Overview

SW-PORTAL은 사내 SW 자산/라이선스 관리 포털로, 서로 다른 시기에 만들어진 세 개의 서브시스템이 한 저장소 안에 공존한다. **2026-07 디자인 체계 통일**로 Portal과 Admin은 색 토큰을 하나로 합쳤다 — 인터랙션 액센트는 `brand`(앰버) 하나만 쓰고, 현황·상태 표시는 `state-*` 5토큰(positive/progress/caution/risk/neutral)만 쓴다. 타이포그래피·spacing·rounded 스케일은 세 서브시스템이 계속 각자 유지한다(구조 변경 비용 대비 실익이 낮아 이번 통일 범위에서 제외).

1. **Portal** (`app/page.tsx`, `app/resources`, `app/sw-files` 등 일반 사용자 페이지) — Notion 문서를 닮은 따뜻한 앰버 톤. 친근하고 문서 중심적인 톤앤매너. `brand` 토큰이 곧 이 앰버.
2. **Admin** (`app/admin/**`, `components/admin/**`) — 데이터 테이블·폼 중심의 실무형 대시보드. Linear/Vercel류의 **Modern Neutral**: 중립 존(zinc) 서피스 + Portal과 동일한 `brand` 액센트(과거 인디고에서 전환), 플랫한 헤어라인 위계. 라이트/다크 모드(`.admin-dark` 클래스) 지원.
3. **Request** (`app/request/**`, `shared/components/**`, 일명 assetify-desk 디자인 시스템) — 세맨틱 토큰(`background-standard-*`, `content-standard-*`, `components-fill-*` 등, `app/globals.css`의 CSS 변수)과 `text-display/title/heading/body/label/footnote/caption` Tailwind 스케일을 쓰는 별도의 정교한 시스템. 라이트/다크는 `prefers-color-scheme`로 자동 전환된다. 색 통일 범위 밖 — 자체 액센트(`request-accent` #ED8B00)를 유지한다.

## Colors

- **공유 액센트 (Portal + Admin)**: `brand`(#D97706, 앰버) 하나만 버튼·링크·활성 탭·포커스링에 쓴다. Admin의 `admin-accent`는 이제 `{colors.brand}`를 그대로 참조하는 alias이며, 별도 인디고 값을 갖지 않는다. 새 UI에 파랑(blue-600 등)이나 인디고를 브랜드 액션 색으로 새로 쓰지 않는다.
- **공유 상태색 (Portal + Admin)**: 현황·배지·차트 상태 표시는 `state-positive`(사용중·완료·승인) / `state-progress`(진행중·처리중) / `state-caution`(갱신필요·대기성 단계) / `state-risk`(만료·불일치·미설치) / `state-neutral`(재고·대기·해당없음) 5개로 고정한다. 카테고리 배지·다중 계열 차트처럼 5개 초과로 색을 구분해야 하는 데이터 시각화(예: SW 카테고리별 분포)는 이 통일 대상이 아니며 기존 다색 팔레트를 유지해도 된다 — 통일 대상은 "지금 무슨 상태인가"를 나타내는 색이다.
- **Portal**: 배경은 `portal-bg`(#fef3d0), 헤딩 텍스트는 `portal-text-heading`(#1c1006), 본문은 `portal-text-body`.
- **Admin**: 사이드바는 라이트/다크 공통으로 중립 다크 레일(`admin-sidebar` #18181B, 다크 모드에서는 `admin-dark-bg` #09090B)로 고정 — 네이비를 쓰지 않는다. 콘텐츠 영역은 라이트 모드에서 `admin-bg`(#FAFAFA) 배경 + `admin-surface`(#FFFFFF) 카드, 다크 모드(`.admin-dark`)에서는 `admin-dark-bg`(#09090B) + `admin-dark-surface`(#18181B)로 전환한다.
- **Request**: 강조색은 `request-accent`(#ED8B00, CSS 변수 `--core-accent`) — 공유 `brand`와는 별개로 유지한다. 나머지는 `background-standard-*`, `content-standard-*`, `line-divider/outline`, `components-fill-*` 세맨틱 토큰을 직접 참조하며 라이트/다크가 자동 반전된다. 신규 컴포넌트는 하드코딩 hex 대신 이 CSS 변수를 사용한다.

## Typography

- **Portal**: 헤딩은 Manrope(600~800, extrabold 위주), 본문/UI는 Inter. `fontFamily: "Manrope, sans-serif"`를 인라인 style로 직접 지정하는 관례가 많다.
- **Request**: Wanted Sans Variable 단일 패밀리. Tailwind의 커스텀 `fontSize` 스케일(`display/title/heading/body/label/footnote/caption`)을 항상 클래스명(`text-display`, `text-title` 등)으로 사용하고, 임의의 px 값을 새로 만들지 않는다.
- **Admin**: 별도 스케일 없이 시스템 폰트(Inter 상속) + Tailwind 기본 `text-sm/text-xs` 등을 사용하는 실용적 스타일.

## Layout

Request 서브시스템은 `spacing-50`~`spacing-1000`(2px~80px, tailwind.config.ts `spacing`) 스케일을 쓴다. Portal/Admin은 별도 스페이싱 스케일 없이 Tailwind 기본값(4px 배수)을 그대로 사용한다. 새 컴포넌트를 Request 영역에 추가할 때만 커스텀 spacing 토큰을 쓰고, Portal/Admin에는 억지로 도입하지 않는다.

## Elevation & Depth

세 시스템 모두 무거운 그림자보다 **경계선과 배경 대비**로 위계를 표현한다. Admin의 테이블/카드는 `border` 색상 변화가 주된 구분 수단이며, 다크 모드 그림자는 `shadow-sm` 정도로 최소화한다(`box-shadow: 0 1px 3px rgba(0,0,0,0.4)`). Request는 `components-fill-standard/secondary/tertiary` 3단계 명도차로 레이어를 구분한다.

## Shapes

Request는 `rounded-100`~`rounded-800`(4px~24px) + `rounded-full` 스케일을 명시적으로 쓴다. Admin은 카드/인풋/버튼에 Tailwind `rounded-lg`(8px)를 기본으로 통일하고, 큰 컨테이너는 `.admin-root` CSS 레이어에서 `rounded-xl`→10px, `rounded-2xl`→12px로 살짝 축소해 플랫한 인상을 준다. Portal은 Tailwind 기본 `rounded-md`/`rounded-lg`/`rounded-xl`을 상황에 맞게 쓰되, 같은 화면 안에서 각지고 둥근 모서리를 섞지 않는다.

## Do's and Don'ts

- Do: 새 화면을 만들기 전에 그 화면이 Portal/Admin/Request 중 어디에 속하는지 먼저 정하고, 타이포·spacing·rounded는 해당 서브시스템 스케일을 따른다.
- Do: Portal·Admin의 새 버튼·링크·활성 탭·포커스 요소는 공유 액센트 `brand`(앰버)를 쓴다 — Admin이라고 별도 인디고를 새로 쓰지 않는다.
- Do: Portal·Admin의 현황·상태 배지는 `state-positive/progress/caution/risk/neutral` 5개 중에서만 고른다. 새 상태 색이 필요해 보여도 이 5개 중 가장 가까운 의미로 매핑한다.
- Do: Request 영역은 하드코딩 hex 대신 `globals.css`의 세맨틱 CSS 변수(`var(--content-standard-primary)` 등)를 참조한다.
- Do: Admin은 라이트/다크 모두 네이비가 아니라 중립 존(zinc) 계열을 유지한다(`admin-dark` 규칙).
- Do: WCAG AA 대비(본문 텍스트 4.5:1 이상)를 지킨다.
- Don't: 카테고리 배지·다중 계열 차트(5개 초과 구분이 필요한 데이터 시각화)에까지 억지로 `state-*` 5색을 욱여넣지 않는다 — 그 용도는 별도 팔레트를 써도 된다.
- Don't: Portal의 앰버 팔레트와 Request의 세맨틱 토큰을 한 컴포넌트 안에서 섞지 않는다.
- Don't: 서브시스템마다 이미 정의된 폰트(Manrope/Inter/Wanted Sans)가 있는데 임의로 새 폰트를 도입하지 않는다.
- Don't: 새로운 spacing/rounded 값을 임의로 추가하기보다, 위에 정의된 스케일 안에서 가장 가까운 값을 쓴다.

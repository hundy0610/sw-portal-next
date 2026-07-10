---
version: alpha
name: SW-PORTAL
description: 사내 SW 자산 포털. Portal(일반 사용자) / Admin(관리자) / Request(자산·티켓 신청) 세 서브시스템이 서로 다른 팔레트를 쓰는 멀티 디자인 시스템.
colors:
  portal-primary: "#F59E0B"
  portal-primary-dark: "#D97706"
  portal-bg: "#fef3d0"
  portal-border: "#fde68a"
  portal-text-heading: "#1c1006"
  portal-text-body: "#44403c"
  portal-text-sub: "#6B778C"
  success: "#006644"
  success-bg: "#E3FCEF"
  warning: "#974F0C"
  warning-bg: "#FFFAE6"
  danger: "#BF2600"
  danger-bg: "#FFEBE6"
  admin-sidebar: "#18181B"
  admin-bg: "#FAFAFA"
  admin-surface: "#FFFFFF"
  admin-surface-sunken: "#F4F4F5"
  admin-border: "#E4E4E7"
  admin-text-primary: "#18181B"
  admin-text-secondary: "#52525B"
  admin-accent: "#4F46E5"
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

SW-PORTAL은 사내 SW 자산/라이선스 관리 포털로, 서로 다른 시기에 만들어진 세 개의 서브시스템이 한 저장소 안에 공존한다. 신규 UI를 만들 때는 **어떤 서브시스템에 속하는지 먼저 판단**하고, 그 서브시스템의 기존 팔레트·토큰을 그대로 따라야 한다. 세 시스템을 한 화면에서 섞어 쓰지 않는다.

1. **Portal** (`app/page.tsx`, `app/resources`, `app/sw-files` 등 일반 사용자 페이지) — Notion 문서를 닮은 따뜻한 앰버 톤. 친근하고 문서 중심적인 톤앤매너.
2. **Admin** (`app/admin/**`, `components/admin/**`) — 데이터 테이블·폼 중심의 실무형 대시보드. Linear/Vercel류의 **Modern Neutral**: 중립 존(zinc) 서피스 + 단일 인디고 액센트, 플랫한 헤어라인 위계. 라이트/다크 모드(`.admin-dark` 클래스) 지원.
3. **Request** (`app/request/**`, `shared/components/**`,일명 assetify-desk 디자인 시스템) — 세맨틱 토큰(`background-standard-*`, `content-standard-*`, `components-fill-*` 등, `app/globals.css`의 CSS 변수)과 `text-display/title/heading/body/label/footnote/caption` Tailwind 스케일을 쓰는 별도의 정교한 시스템. 라이트/다크는 `prefers-color-scheme`로 자동 전환된다.

## Colors

- **Portal**: `portal-primary`(#F59E0B)가 유일한 강조색. 배경은 `portal-bg`(#fef3d0), 헤딩 텍스트는 `portal-text-heading`(#1c1006), 본문은 `portal-text-body`. `success/warning/danger`는 Atlassian 스타일의 저채도 배지 색상으로 상태 표시에만 쓴다.
- **Admin**: 사이드바는 라이트/다크 공통으로 중립 다크 레일(`admin-sidebar` #18181B, 다크 모드에서는 `admin-dark-bg` #09090B)로 고정 — 네이비를 쓰지 않는다. 콘텐츠 영역은 라이트 모드에서 `admin-bg`(#FAFAFA) 배경 + `admin-surface`(#FFFFFF) 카드, 다크 모드(`.admin-dark`)에서는 `admin-dark-bg`(#09090B) + `admin-dark-surface`(#18181B)로 전환한다. 액센트는 파랑 계열을 전부 인디고(`admin-accent` #4F46E5)로 수렴한 **단일 액센트**다 — 새 UI에 파랑(blue-600 등)을 브랜드 액션 색으로 새로 쓰지 않는다. 단, 카테고리 배지·다중 계열 차트처럼 여러 색을 동시에 구분해야 하는 데이터 시각화 색상은 액센트 통일 대상이 아니며 원래 색상 그대로 둔다 — 액센트 통일은 버튼·링크·포커스링 등 브랜드 액션 요소에만 적용한다.
- **Request**: 강조색은 `request-accent`(#ED8B00, CSS 변수 `--core-accent`). 나머지는 `background-standard-*`, `content-standard-*`, `line-divider/outline`, `components-fill-*` 세맨틱 토큰을 직접 참조하며 라이트/다크가 자동 반전된다. 신규 컴포넌트는 하드코딩 hex 대신 이 CSS 변수를 사용한다.

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

- Do: 새 화면을 만들기 전에 그 화면이 Portal/Admin/Request 중 어디에 속하는지 먼저 정하고, 해당 팔레트·폰트·토큰만 사용한다.
- Do: Request 영역은 하드코딩 hex 대신 `globals.css`의 세맨틱 CSS 변수(`var(--content-standard-primary)` 등)를 참조한다.
- Do: Admin은 라이트/다크 모두 네이비가 아니라 중립 존(zinc) 계열을 유지한다(`admin-dark` 규칙).
- Do: Admin의 새 버튼·링크·포커스 요소는 인디고 단일 액센트(`admin-accent`)를 쓴다 — 파랑(blue-600 등)을 새로 브랜드 액션 색으로 쓰지 않는다.
- Do: WCAG AA 대비(본문 텍스트 4.5:1 이상)를 지킨다.
- Don't: Portal의 앰버 팔레트와 Request의 세맨틱 토큰을 한 컴포넌트 안에서 섞지 않는다.
- Don't: 서브시스템마다 이미 정의된 폰트(Manrope/Inter/Wanted Sans)가 있는데 임의로 새 폰트를 도입하지 않는다.
- Don't: 새로운 spacing/rounded 값을 임의로 추가하기보다, 위에 정의된 스케일 안에서 가장 가까운 값을 쓴다.

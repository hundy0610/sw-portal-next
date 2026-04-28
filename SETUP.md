# SW 자산관리 포털 — 설치 및 배포 가이드

## 1단계: Notion Integration 생성

1. https://www.notion.so/my-integrations 접속
2. **New integration** 클릭
3. 이름 입력 (예: `SW Portal`)
4. 권한: **Read content**, **Update content**, **Insert content** 체크
5. **Submit** → **Internal Integration Token** 복사

## 2단계: Notion 데이터베이스 연결

각 데이터베이스 페이지 오른쪽 상단 `...` → **Connections** → 방금 만든 Integration 추가

**DB ID 추출 방법:**
```
https://www.notion.so/workspace/[DATABASE_ID]?v=...
```
URL의 `?v=` 앞 32자리가 DB ID입니다.

## 3단계: 로컬 실행

```bash
# 1. 프로젝트 폴더로 이동
cd sw-portal-next

# 2. 패키지 설치
npm install

# 3. 환경변수 파일 생성
cp .env.example .env.local

# 4. .env.local 파일 편집
# NOTION_TOKEN, NOTION_DB_SWDB 등 입력

# 5. 개발 서버 실행
npm run dev

# http://localhost:3000 에서 확인
# http://localhost:3000/admin 에서 관리자 대시보드 확인
```

## 4단계: Vercel 배포 (무료)

### 방법 A: GitHub 연동 (권장)

```bash
# GitHub에 올리기
git init
git add .
git commit -m "init: SW portal next.js"
git remote add origin https://github.com/your-id/sw-portal-next.git
git push -u origin main
```

1. https://vercel.com 로그인 (GitHub 계정 연동)
2. **New Project** → GitHub 저장소 선택
3. **Environment Variables** 섹션에서 `.env.local` 값들 입력:
   - `NOTION_TOKEN`
   - `NOTION_DB_SWDB`
   - `NOTION_DB_SUBSCRIPTIONS`
   - `NOTION_DB_LICENSES`
   - `NOTION_DB_TICKETS`
   - `NEXT_PUBLIC_NOTION_TRACKER_URL`
   - `NEXT_PUBLIC_NOTION_SUBSCRIBE_URL`
4. **Deploy** 클릭 → 1~2분 후 URL 발급

### 방법 B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Notion 컬럼명 매핑

`lib/notion.ts`에서 프로퍼티 이름을 실제 노션 DB 컬럼명으로 수정하세요.

### SW DB 예시
| 코드에서 찾는 이름 | 실제 노션 컬럼명 예시 |
|---|---|
| `Name` | `소프트웨어명` |
| `Status` | `승인 상태` |
| `라이선스 수` | `라이선스 수` |
| `Category` | `카테고리` |

> `getPropText(p, "Name") \|\| getPropText(p, "소프트웨어명")` 처럼
> 여러 이름을 fallback으로 처리하고 있으니, 실제 컬럼명을 추가만 하면 됩니다.

## 캐시 설정

각 API Route 파일 상단의 `revalidate` 값으로 캐시 주기를 조정합니다:
- `sw-db/route.ts`: 60초 (기본)
- `tickets/route.ts`: 30초 (티켓은 더 자주 갱신)

## 페이지 구조

| URL | 설명 |
|---|---|
| `/` | 직원 포털 (홈, SW 검색, SW 신청, 티켓 접수) |
| `/admin` | 관리자 대시보드 (대시보드, 라이선스, 구독, 티켓, SW DB) |

## 데이터 흐름

```
Notion DB → API Route (서버, 60초 캐시) → 클라이언트 컴포넌트
직원 입력 → API Route (POST) → Notion DB에 즉시 생성
```

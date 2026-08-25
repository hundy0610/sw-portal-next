# SaaS 사용 현황 수집 스크립트

설치형 SW가 아니라 브라우저(Chrome/Edge)로 접속해서 쓰는 웹 기반 SaaS를 추적하기 위한
독립 수집 스크립트다. 기존 PC 자산실사 에이전트(WPF, `windows_recreate`)와는 완전히
무관하게 동작한다 — 소스 접근 권한이 없는 별도 저장소라 그쪽에 손댈 수 없어서, 작업
스케줄러로 배포하는 별도 스크립트로 만들었다.

## 무엇을 수집하는가

- Chrome/Edge의 로컬 방문기록(History)에서 **도메인 + 방문수 + 최근 방문시각**만 추출한다.
- URL 전체 경로, 쿼리스트링, 페이지 제목은 **절대 수집하지 않는다.**
- 서버는 이걸 관리 중인 SaaS 도메인 정책(승인/금지/조건부/예외)과 대조해서 분류할 뿐,
  원본 방문기록 자체를 쌓지 않는다 — "지금 이 PC가 어떤 SaaS를 쓰는가"라는 현재 상태만
  누적 관리한다.

## 의존성 — sqlite3.exe

PowerShell에는 SQLite를 읽는 기능이 기본 내장돼 있지 않다. `Collect-SaasUsage.ps1`은
Chrome/Edge의 History 파일(SQLite DB)을 읽기 위해 `sqlite3.exe`를 셸아웃으로 호출한다.

1. https://sqlite.org/download.html 의 **Precompiled Binaries for Windows** →
   `sqlite-tools-win-x64-*.zip` (공개 도메인 소프트웨어)을 배포 담당자가 직접 받는다.
   (이 저장소·스크립트는 실행파일을 내려받거나 포함하지 않는다 — 출처가 다른 실행파일을
   그대로 신뢰하고 배포하는 것은 보안상 지양해야 한다.)
2. 압축 해제 후 `sqlite3.exe`를 `Collect-SaasUsage.ps1`과 같은 폴더에 둔다.
3. 버전은 3.33 이상이어야 한다(`-json` 출력 옵션 필요). `sqlite3.exe -version`으로 확인.

## 배포 전 설정

`Collect-SaasUsage.ps1` 상단 파라미터 기본값을 실제 값으로 교체하거나, 작업 스케줄러
액션의 인자로 넘긴다.

| 파라미터      | 설명                                                              |
| ------------- | ----------------------------------------------------------------- |
| `ReportUrl`   | `https://<포털 도메인>/api/saas-usage`                             |
| `IngestKey`   | 서버 환경변수 `SAAS_SCAN_INGEST_KEY`와 동일한 값                    |
| `Corp`        | (선택) 이 PC가 속한 법인명 — 비워두면 나중에 HW 자산 대장과 수동 대조 |

서버(Vercel) 쪽에는 `SAAS_SCAN_INGEST_KEY` 환경변수를 새로 추가해야 한다. 기존 PC
자산실사가 쓰는 `SCAN_INGEST_KEY`와 **일부러 분리**했다 — 이 스크립트 배포본에서 키가
유출돼도 자산실사 데이터 자체에는 영향이 없도록 신뢰 경계를 나눈 것이다.

## 배포 — 그룹 정책(GPO) + 작업 스케줄러

1. 스크립트 폴더(`Collect-SaasUsage.ps1` + `sqlite3.exe`)를 사내 공유 배포 경로
   (예: `\\fileserver\deploy\saas-usage-collector\`)에 올린다.
2. GPO로 예약 작업을 생성한다(그룹 정책 관리 편집기 → 컴퓨터 구성 → 기본 설정 →
   제어판 설정 → 예약 작업, 또는 `Register-ScheduledTask`를 시작 스크립트로 배포).
   - **트리거**: 매일 1회(예: 로그온 후 30분 뒤, 또는 매일 09:00)
   - **동작**: 프로그램 시작
     - 프로그램: `powershell.exe`
     - 인수: `-NoProfile -ExecutionPolicy Bypass -File "\\fileserver\deploy\saas-usage-collector\Collect-SaasUsage.ps1"`
   - **실행 계정**: `NT AUTHORITY\SYSTEM`, "사용자 로그온 여부에 관계없이 실행"
     - SYSTEM으로 실행해야 이 PC에 로그온한 모든 사용자 프로필의 방문기록을 읽을 수
       있다(회의실 PC 등 여러 사람이 쓰는 공용PC 대응). 특정 사용자 계정으로만
       실행하면 그 계정의 방문기록만 잡힌다.
3. 배포 후 아무 PC에서나 작업을 수동으로 한 번 실행해 `C:\ProgramData\SaasUsageCollector\collector.log`
   에 "전송 성공"이 찍히는지 확인한다.

## 확인

관리자 포털 → 관리자 페이지 → 소프트웨어 자산 → **SaaS 사용 현황**에서 PC별 집계와
미확인 도메인 목록을 볼 수 있다. SaaS 도메인 정책 자체(승인/금지/조건부/예외 등록)는
관리 페이지(`/manage`) → **SaaS 도메인 정책** 탭에서 관리한다.

## 왜 기존 자산실사 에이전트에 통합하지 않았는가

기존 WPF 자산실사 에이전트(`windows_recreate`)는 별도 비공개 저장소라 소스 접근 권한이
없다. 통합하려면 그쪽 개발자에게 스펙을 전달하고 별도 개발 일정을 기다려야 한다 — 이
스크립트는 그와 무관하게 독립적으로 동작하도록 만들어, 기존 자산실사 배포 주기와
관계없이 바로 배포할 수 있게 했다. 나중에 두 에이전트를 하나로 합치고 싶다면, 이
스크립트의 수집 로직(History 읽기 → 도메인 추출 → POST)을 그대로 참고해서 옮기면 된다.

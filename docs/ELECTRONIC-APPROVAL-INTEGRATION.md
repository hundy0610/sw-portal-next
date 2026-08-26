# 전자결재 연동 인터페이스 정의서 (F7 — 설계 단계)

> **상태: 설계만. 구현 착수 전.**
> 전자결재 운영 부서의 API/웹훅 지원 여부가 확인되지 않아 실제 연동 코드는 작성하지
> 않았다. 이 문서는 "지원한다면 어떤 데이터를 어떤 형태로 받을 것인가"를 미리 못박아
> 두어, 담당 부서와 협의할 때 그대로 들고 갈 수 있게 하는 것이 목적이다.

---

## 1. 목적

전자결재에서 **"SaaS/구독 SW 구매 기안"이 최종 승인**되면, 그 결과를 포털이 자동으로
받아 구독 목록에 반영한다. 기존 기안·결재·결제 프로세스는 그대로 두고, **결과 데이터만
수집하는 계층**을 붙이는 것이 이번 프로젝트의 방향이다.

지금은 승인된 기안 내용을 담당자가 포털에 수기로 다시 입력하고 있어, 누락되거나 금액·
갱신일이 실제 기안과 어긋나는 일이 생긴다.

---

## 2. 받아야 할 최소 데이터

전자결재 → 포털 방향으로 필요한 항목. **굵은 항목은 필수**이며, 없으면 구독 레코드를
만들 수 없다.

| 필드 | 타입 | 예시 | 포털 매핑 (`SwDbRecord`) | 비고 |
|---|---|---|---|---|
| **기안번호** | string | `2026-IT-00841` | (신규 필드 `approvalDocNo`) | 중복 수신 방지 키로도 사용 |
| **기안자** | string | `권정훈` | `user` | 실제 사용자와 다를 수 있음(§5 참고) |
| **기안자 사번/ID** | string | `jeokwon94` | — | 계정 매칭용 |
| **부서** | string | `자산관리파트` | `department` | |
| **법인** | string | `IdsTrust` | `company` | 포털 표준 법인명과 표기 통일 필요 |
| **SW/벤더명** | string | `Claude Team Plan` | `swCategory` / `swDetail` | |
| **예상 금액** | number | `1200000` | `monthlyKrw` 또는 `annualKrw` | 통화·주기와 함께 와야 의미가 있음 |
| **통화** | `"KRW" \| "USD"` | `USD` | `monthlyUsd` / `monthlyKrw` 분기 | |
| **결제주기** | `"월" \| "연" \| "일회성"` | `연` | `renewalCycle` | |
| **결재완료일자** | date | `2026-08-11` | `paymentDate` 초기값 | 환율 환산 기준일(F3)로 사용 |
| 계약 시작일 | date | `2026-09-01` | `usageDate` | 선택 |
| 계약 종료일 / 갱신일 | date | `2027-08-31` | `renewalDate` | 있으면 갱신 알림(F5)이 자동 동작 |
| 구매처 | string | `MS Korea` | `vendor` | 선택 |
| 결제수단 | string | `법인카드 1234` | `billingType` | 있으면 카드명세(F4) 대사에 도움 |
| 기안 문서 URL | string | `https://…` | `draftDocument` | 선택 |

---

## 3. 연동 방식 — 두 가지 안

### 안 A. 웹훅 (권장)

전자결재 쪽에서 **결재 완료 시점에** 포털로 POST 한다.

```
POST https://<portal-domain>/api/integrations/approval/webhook
Content-Type: application/json
X-Approval-Signature: <HMAC-SHA256(body, SHARED_SECRET)>
```

```jsonc
{
  "eventType": "approval.completed",
  "docNo": "2026-IT-00841",
  "approvedAt": "2026-08-11T09:12:00+09:00",
  "drafter":   { "name": "권정훈", "employeeId": "jeokwon94", "department": "자산관리파트", "company": "IdsTrust" },
  "item":      { "swName": "Claude Team Plan", "vendor": "Anthropic", "docUrl": "https://…" },
  "amount":    { "value": 1200000, "currency": "KRW", "cycle": "연" },
  "contract":  { "startDate": "2026-09-01", "endDate": "2027-08-31" },
  "payment":   { "method": "법인카드", "cardLast4": "1234" }
}
```

**포털 응답 규약**
- `200 {"ok":true,"recordId":"..."}` — 정상 수신·반영
- `200 {"ok":true,"skipped":true,"reason":"duplicate"}` — 이미 처리된 `docNo`
- `4xx` — 데이터 형식 오류(재전송해도 실패). 전자결재 쪽에서 재시도 불필요
- `5xx` — 포털 일시 장애. **재시도 필요**(권장: 지수 백오프, 최대 24시간)

**보안**: 공유 시크릿 기반 HMAC 서명 헤더를 검증한다. 이 레포에는 이미
`app/api/webhooks/notion/*`에 웹훅 라우트 패턴이 있으므로 그 구조를 따른다.

### 안 B. 폴링 (웹훅을 못 받는 경우 대안)

전자결재가 조회 API만 제공하는 경우, 포털이 주기적으로 승인 목록을 가져온다.

```
GET https://<eapproval-host>/api/v1/approvals
      ?status=completed
      &category=SW구매
      &from=2026-08-01T00:00:00%2B09:00
      &to=2026-08-11T23:59:59%2B09:00
Authorization: Bearer <API_TOKEN>
```

- 마지막으로 성공한 조회 시각을 커서로 저장하고(`kv: integration:approval:cursor`),
  다음 실행에서 `from`으로 사용한다.
- **주기 결정 시 주의**: 이 레포의 GitHub Actions 크론은 도메인 리다이렉트 문제로
  2026-07-29에 4종이 삭제된 이력이 있다(`4178562`). 폴링을 도입한다면 트리거를
  어디에 둘지(맥북 launchd 잡 / 복구된 GitHub Actions / Vercel Cron)부터 정해야 한다.

**권장**: 실시간성과 운영 부담 모두 웹훅(안 A)이 유리하다. 폴링은 웹훅 미지원이
확정될 때만 선택한다.

---

## 4. 중복 처리 (필수)

같은 기안이 두 번 들어와도 구독 레코드가 두 개 생기면 안 된다.

- `docNo`를 **멱등 키**로 사용한다.
- 처리 완료 시 `kv: integration:approval:processed:<docNo>` 에 기록하고, 수신 시 먼저 조회한다.
- ⚠️ 이 저장이 실패했는데 성공으로 처리하면 중복 생성이 발생한다. 이 레포는 과거
  동일한 무음 쓰기 실패로 중복 메일 발송 사고를 겪은 이력이 있으므로, `kvSetPermanent`의
  **반환값을 반드시 확인**하고 실패 시 5xx로 응답해 재시도를 유도한다.

---

## 5. 협의가 필요한 항목 (담당 부서 확인 사항)

1. **웹훅 지원 여부** — 안 A 가능한가? 불가하면 조회 API 스펙과 인증 방식은?
2. **"SW 구매 기안"을 식별하는 방법** — 기안 양식 코드/카테고리 값이 따로 있는가?
   (모든 기안이 들어오면 포털에서 걸러내야 해서 필터 기준이 필요)
3. **기안자 ≠ 실제 사용자** 문제 — 기안은 팀장이 올리고 실사용자는 팀원인 경우가 많다.
   기안 양식에 "실제 사용자" 항목이 있는가? 없다면 포털에서 수기 보정이 필요하다.
4. **법인·부서명 표기** — 전자결재의 조직 명칭이 포털 표준 표기와 일치하는가?
   다르면 매핑 테이블이 추가로 필요하다.
5. **금액의 의미** — "예상 금액"이 부가세 포함인가? 월/연 중 무엇 기준인가?
6. **결재 취소·반려 후 재상신** 시 이벤트가 어떻게 오는가? (취소 이벤트도 받아야
   잘못 생성된 구독을 정리할 수 있다)

---

## 6. 구현 시 예상 작업 범위 (착수 승인 후)

| 항목 | 내용 |
|---|---|
| 신규 라우트 | `app/api/integrations/approval/webhook/route.ts` (안 A) 또는 동기화 라우트(안 B) |
| 신규 lib | `lib/integrations/approval.ts` — 페이로드 검증, 표준 레코드 매핑, 멱등 처리 |
| 타입 확장 | `SwDbRecord`에 `approvalDocNo` 추가 (F3에서 추가한 `paymentDate`와 동일 방식) |
| 저장 | 기존 미러 경로 그대로 — `upsertEntity("sw", id, record)` |
| 화면 | 상용 라이선스 목록에 "전자결재 연동 생성" 배지 + 기안번호 표시 |
| 환경변수 | `EAPPROVAL_WEBHOOK_SECRET` 또는 `EAPPROVAL_API_TOKEN` |

---

## 7. 현재 상태

- [x] 필요한 데이터 항목 정의
- [x] 웹훅/폴링 두 방식 인터페이스 설계
- [x] 중복 처리 방식 정의
- [ ] 전자결재 담당 부서와 §5 협의 — **선행 필요**
- [ ] 구현 착수 — 협의 완료 후 별도 승인

다음 SW 자산 정보를 파싱하여 노션 데이터베이스에 등록하세요.

## 입력 정보
$ARGUMENTS

## 파싱 규칙

아래 필드를 텍스트에서 추출하여 JSON 객체를 구성하세요. 명시되지 않은 선택 필드는 빈 문자열 `""` 또는 `0`으로 설정합니다.

| 필드 | 설명 | 예시 |
|------|------|------|
| user | 사용자 이름 (필수) | 홍길동 |
| swCategory | SW 대분류 | Microsoft, Adobe, Google |
| swDetail | SW 소분류/에디션 | Office 365, Photoshop CC |
| version | 버전 (쉼표 구분) | 2021,2024 |
| status | 상태 | 사용중 / 재고 / 갱신필요 / 만료 / 신규등록 (기본값) |
| company | 법인명 | IdsTrust |
| licenseType | 라이선스 유형 | 영구 / 구독(업체) / 구독(웹) |
| department | 부서 | DX추진팀 |
| usageDate | 사용일자 YYYY-MM-DD | 2024-01-01 |
| renewalDate | 갱신필요일 YYYY-MM-DD | 2025-12-31 |
| purchaseDate | 구매일자 YYYY-MM-DD | 2024-01-01 |
| accountType | 계정유형 | 법인 / 개인 |
| renewalCycle | 갱신주기 | 연 / 월 |
| licenseKey | 인증키 또는 인증계정 | XXXXX-XXXXX |
| vendor | 구매처 | MS Korea |
| workType | SW 사용직군 | 사무직 |
| billingType | 결제방식 | 법인카드 / 개인카드 / 계좌이체 |
| monthlyKrw | 월 비용 KRW (숫자) | 50000 |
| monthlyUsd | 월 비용 USD (숫자) | 30 |

## 처리 절차

1. 위 필드를 파싱하여 아래와 같은 JSON 형태로 구성하고 사용자에게 보여주세요:
```json
{
  "user": "...",
  "swCategory": "...",
  "swDetail": "...",
  "version": "...",
  "status": "신규등록",
  "company": "...",
  "licenseType": "...",
  "department": "...",
  "usageDate": "",
  "renewalDate": "",
  "purchaseDate": "",
  "accountType": "",
  "renewalCycle": "",
  "licenseKey": "",
  "vendor": "",
  "workType": "",
  "billingType": "",
  "monthlyKrw": 0,
  "monthlyUsd": 0
}
```

2. 파싱한 내용을 사용자에게 확인받으세요. 수정이 필요하면 반영하세요.

3. 확인되면 PowerShell을 사용하여 API에 등록하세요:
```powershell
$row = @{
  user = "..."
  # ... 나머지 필드
}
$body = @{ rows = @($row) } | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri "https://swportal.vercel.app/api/sw/upload" -Method POST -Body $body -ContentType "application/json; charset=utf-8"
$response | ConvertTo-Json
```

4. 결과를 한국어로 보고하세요 (성공/실패, 등록된 항목 수).

## 여러 건 동시 등록

여러 건의 정보가 전달된 경우 `rows` 배열에 모두 담아 한 번에 POST 하세요. 최대 200건까지 가능합니다.

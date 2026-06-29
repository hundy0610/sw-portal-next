import * as XLSX from "xlsx";

// SW 등록 양식 엑셀 컬럼 — admin 엑셀 업로드(SW_COL_MAP)와 동일한 헤더를 사용한다.
export const SW_TEMPLATE_HEADERS = [
  "사용자", "SW대분류", "SW소분류", "버전(쉼표구분)", "상태",
  "법인명", "라이선스유형", "부서", "사용일자", "갱신필요일", "구매일자",
  "계정유형", "갱신주기", "인증키/인증계정", "구매처", "SW사용직군", "결제방식",
  "월비용KRW", "월비용USD",
];

const SAMPLE_ROW: (string | number)[] = [
  "홍길동", "MS Office", "Office 365", "2021,2024", "사용중",
  "대웅제약", "영구", "IT팀", "2024-01-01", "2025-12-31", "2024-01-01",
  "법인", "연", "XXXXX-XXXXX-XXXXX", "MS Korea", "사무직", "법인카드",
  0, 0,
];

const NOTE_LINES = [
  "※ 사용자·SW대분류는 필수 입력",
  "상태: 사용중/재고/갱신필요/만료/신규등록",
  "라이선스유형: 영구/구독(업체)/구독(웹)",
  "버전: 쉼표로 구분 (예: 2021,2024)",
  "날짜: YYYY-MM-DD 형식",
];

// 법인명/부서를 미리 채운 SW 등록 양식 엑셀 파일을 생성해 다운로드한다.
export function downloadSwTemplate(prefill?: { company?: string; department?: string }) {
  const sample = [...SAMPLE_ROW];
  if (prefill?.company) sample[5] = prefill.company; // 법인명 컬럼
  if (prefill?.department) sample[7] = prefill.department; // 부서 컬럼

  const ws = XLSX.utils.aoa_to_sheet([SW_TEMPLATE_HEADERS, sample]);
  ws["!cols"] = SW_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));

  const noteWs = XLSX.utils.aoa_to_sheet(NOTE_LINES.map(n => [n]));
  noteWs["!cols"] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SW등록양식");
  XLSX.utils.book_append_sheet(wb, noteWs, "입력안내");
  XLSX.writeFile(wb, "SW자산_등록양식.xlsx");
}

// 4.0verMACBOOK: 공개 자산 수정(QR) 요청 body → typed hw 테이블 컬럼(HwRecord 키) 매핑.
// 자산 자가서비스 DB == HWDB(hw 테이블)이므로 hw 단일 소스로 write-through 한다.
// 외부 클라이언트는 두 형태 중 하나를 보낸다:
//   1) 한글 키 → 원시값        예: { "사용자": "홍길동", "위치": "3층" }
//   2) { properties: {...} }   구 Notion 프로퍼티 형태(title/rich_text/select/status/date/number 등)
// 어느 쪽이든 한글 키 → 원시값으로 정규화한 뒤 hw 컬럼으로 변환한다.
// HWDB 에 없는 워크플로 표시필드(출고진행상황/반납 진행 상황/수리진행상황/수리담당자/
// 수리 작업 유형/반납사유/누락 사항/수리일자)는 무시(드롭)한다.

/* eslint-disable @typescript-eslint/no-explicit-any */
type NotionProp = Record<string, any>;

// Notion 프로퍼티 객체 하나에서 원시값을 추출한다.
function extractNotionValue(prop: NotionProp): unknown {
  if (prop == null || typeof prop !== "object") return prop;
  if (Array.isArray(prop.title))        return prop.title.map((t: any) => t?.text?.content ?? t?.plain_text ?? "").join("");
  if (Array.isArray(prop.rich_text))    return prop.rich_text.map((t: any) => t?.text?.content ?? t?.plain_text ?? "").join("");
  if (prop.select !== undefined)        return prop.select?.name ?? "";
  if (prop.status !== undefined)        return prop.status?.name ?? "";
  if (prop.date !== undefined)          return prop.date?.start ?? "";
  if (prop.number !== undefined)        return prop.number ?? 0;
  if (Array.isArray(prop.multi_select)) return prop.multi_select.map((o: any) => o?.name ?? String(o)).filter(Boolean);
  if (Array.isArray(prop.people))       return prop.people.map((pp: any) => pp?.id ?? String(pp)).filter(Boolean);
  if (prop.email !== undefined)         return prop.email ?? "";
  if (prop.checkbox !== undefined)      return !!prop.checkbox;
  if (prop.url !== undefined)           return prop.url ?? "";
  return "";
}

// 한글 키 → 원시값 맵으로 정규화(둘 중 어떤 입력 형태든).
function normalizeBody(body: Record<string, any>): Record<string, unknown> {
  const isProps = body?.properties && typeof body.properties === "object";
  const src = isProps ? body.properties : body;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (v === null || v === undefined) continue;
    out[k] = isProps ? extractNotionValue(v as NotionProp) : v;
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// 한글 키 → hw 컬럼(HwRecord 키). HWDB 에 있는 편집 가능한 필드만 매핑.
const KEY_MAP: Record<string, string> = {
  "자산번호": "assetNo",
  "사용자": "user",
  "법인명": "company",
  "부서": "dept",
  "위치": "location",
  "제조사": "maker",
  "모델명": "model",
  "시리얼 넘버": "serial",
  "CPU": "cpu",
  "RAM": "ram",
  "기타": "note",
  "사용/재고/폐기/기타": "status",
  "구매일자": "purchaseDate",
  "사용일자": "useDate",
  "반납일자": "returnDate",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertToHwFields(body: Record<string, any>): Record<string, unknown> {
  const norm = normalizeBody(body);
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(norm)) {
    if (key === "단가") {
      fields.price = Number(value) || 0;
      continue;
    }
    const col = KEY_MAP[key];
    if (col) fields[col] = String(value);
    // KEY_MAP 에 없는 키(워크플로 표시필드 등)는 무시(드롭).
  }

  return fields;
}

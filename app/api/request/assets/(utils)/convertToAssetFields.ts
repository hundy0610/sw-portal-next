import type { AssetUpdateFields } from "@/lib/asset-selfservice";

// 4.0verMACBOOK: 공개 자산 수정(QR) 요청 body → asset-selfservice 미러 레코드 필드 매핑.
// 외부 클라이언트는 두 형태 중 하나를 보낸다:
//   1) 한글 키 → 원시값        예: { "사용자": "홍길동", "수리 작업 유형": ["부품교체"] }
//   2) { properties: {...} }   구 Notion 프로퍼티 형태(title/rich_text/select/status/date/number/multi_select/people)
// 어느 쪽이든 한글 키 → 원시값으로 정규화한 뒤 미러 필드로 변환한다.

/* eslint-disable @typescript-eslint/no-explicit-any */
type NotionProp = Record<string, any>;

// Notion 프로퍼티 객체 하나에서 원시값을 추출한다.
function extractNotionValue(prop: NotionProp): unknown {
  if (prop == null || typeof prop !== "object") return prop;
  if (Array.isArray(prop.title))       return prop.title.map((t: any) => t?.text?.content ?? t?.plain_text ?? "").join("");
  if (Array.isArray(prop.rich_text))   return prop.rich_text.map((t: any) => t?.text?.content ?? t?.plain_text ?? "").join("");
  if (prop.select !== undefined)       return prop.select?.name ?? "";
  if (prop.status !== undefined)       return prop.status?.name ?? "";
  if (prop.date !== undefined)         return prop.date?.start ?? "";
  if (prop.number !== undefined)       return prop.number ?? 0;
  if (Array.isArray(prop.multi_select))return prop.multi_select.map((o: any) => o?.name ?? String(o)).filter(Boolean);
  if (Array.isArray(prop.people))      return prop.people.map((pp: any) => pp?.id ?? String(pp)).filter(Boolean);
  if (prop.email !== undefined)        return prop.email ?? "";
  if (prop.checkbox !== undefined)     return !!prop.checkbox;
  if (prop.url !== undefined)          return prop.url ?? "";
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

const toArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(x => String(x).trim()).filter(Boolean)
    : String(v ?? "").split(",").map(s => s.trim()).filter(Boolean);

// 한글 키 → 미러 레코드 필드(문자열 스칼라).
const KEY_MAP: Record<string, keyof AssetUpdateFields> = {
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
  "구매일자": "purchaseDate",
  "사용일자": "useDate",
  "반납일자": "returnDate",
  "수리일자": "repairDate",
  "사용/재고/폐기/기타": "status",
  "출고진행상황": "shipStatus",
  "반납 진행 상황": "returnStatus",
  "수리진행상황": "repairStatus",
  "반납사유": "returnReason",
  "기타": "note",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertToAssetFields(body: Record<string, any>): AssetUpdateFields {
  const norm = normalizeBody(body);
  const fields: AssetUpdateFields = {};

  for (const [key, value] of Object.entries(norm)) {
    switch (key) {
      case "단가":
        fields.price = Number(value) || 0;
        break;
      case "수리 작업 유형":
        fields.repairTypes = toArray(value);
        break;
      case "누락 사항":
        fields.missingItems = toArray(value);
        break;
      case "수리담당자": {
        const ids = toArray(value);
        fields.repairAssigneeId = ids[0] ?? "";
        break;
      }
      default: {
        const col = KEY_MAP[key];
        if (col) (fields as Record<string, unknown>)[col] = String(value);
        break;
      }
    }
  }

  return fields;
}

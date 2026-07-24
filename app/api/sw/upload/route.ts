import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { upsertEntity, isMirrorEnabled } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";

// 엑셀 1행 → SwDbRecord 컬럼 매핑용 인터페이스
export interface SwUploadRow {
  user:         string;   // 사용자 (title, 필수)
  swCategory:   string;   // SW대분류
  swDetail:     string;   // SW소분류
  version:      string;   // 버전 (쉼표 구분 → multi_select)
  status:       string;   // 상태 (사용중/재고/갱신필요/만료/신규등록)
  company:      string;   // 법인명
  licenseType:  string;   // 영구/구독(업체)/구독(웹)
  department:   string;   // 부서
  usageDate:    string;   // 사용일자 YYYY-MM-DD
  renewalDate:  string;   // 갱신필요일 YYYY-MM-DD
  purchaseDate: string;   // 구매일자 YYYY-MM-DD
  accountType:  string;   // 계정유형
  renewalCycle: string;   // 갱신주기 (연/월)
  licenseKey:   string;   // 인증키/인증계정
  vendor:       string;   // 구매처
  workType:     string;   // SW사용직군
  billingType:  string;   // 결제방식
  monthlyKrw:   number;   // 월비용(KRW)
  monthlyUsd:   number;   // 월비용(USD)
  certificateFileUploadId?: string; // 증서 Blob 공개 URL (선택)
  draftDocFileUploadId?: string;    // 기안문서 Blob 공개 URL (선택)
}

// ISO 날짜 정규화 (YYYY-MM-DD / YYYY.MM.DD / Excel serial)
function toIsoDate(val: string | number | undefined): string {
  if (!val) return "";
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return "";
}

function rowToRecord(row: SwUploadRow, modifiedBy: string, modifiedAt: string): SwDbRecord {
  const versions = row.version
    ? row.version.split(",").map(v => v.trim()).filter(Boolean)
    : [];
  const monthlyKrw = row.monthlyKrw > 0 ? row.monthlyKrw : 0;
  const monthlyUsd = row.monthlyUsd > 0 ? row.monthlyUsd : 0;
  return {
    id: crypto.randomUUID(),
    user: row.user || "",
    swCategory: row.swCategory || "",
    swDetail: row.swDetail || "",
    version: versions,
    status: row.status || "신규등록",
    company: row.company || "",
    licenseType: row.licenseType || "",
    department: row.department || "",
    usageDate: toIsoDate(row.usageDate),
    renewalDate: toIsoDate(row.renewalDate),
    purchaseDate: toIsoDate(row.purchaseDate),
    returnDate: "",
    shipStatus: "",
    accountType: row.accountType || "",
    renewalCycle: row.renewalCycle || "",
    licenseKey: row.licenseKey || "",
    vendor: row.vendor || "",
    usageCount: 0,
    certificate: row.certificateFileUploadId || "",
    draftDocument: row.draftDocFileUploadId || "",
    workType: row.workType || "",
    billingType: row.billingType || "",
    lastModifiedBy: modifiedBy,
    lastModifiedAt: modifiedAt,
    monthlyUsd,
    monthlyKrw,
    annualUsd: monthlyUsd * 12,
    annualKrw: monthlyKrw * 12,
    notionUrl: "",
  };
}

export async function POST(req: NextRequest) {
  if (!isMirrorEnabled()) {
    return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const { rows }: { rows: SwUploadRow[] } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "등록할 데이터가 없습니다." }, { status: 400 });
    }
    if (rows.length > 200) {
      return NextResponse.json({ ok: false, error: "한 번에 최대 200개까지 등록할 수 있습니다." }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (scope && rows.some(r => (r.company || "").trim() !== scope)) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 등록할 수 있습니다." }, { status: 403 });
    }
    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    const results: { index: number; user: string; sw: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const record = rowToRecord(row, modifiedBy, modifiedAt);
      const ok = await upsertEntity(SW_ENTITY, record.id, record);
      results.push({ index: i, user: row.user, sw: row.swCategory, ok, error: ok ? undefined : "저장 실패(Postgres)" });
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /sw/upload]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

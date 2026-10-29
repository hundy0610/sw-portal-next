import { errorMessage } from "@/lib/api-error";
import { insertEntity } from "@/lib/repo/mirror";
import type { SwDbRecord } from "@/types";

// v2 전환 뒤 SW 신고 — **조회 없이 신고만**(10-29 결정). 직원이 적은 SW 를 신고 행으로 잠가 추가만 하고,
// 관리자가 데스크탑 앱에서 SW 자산과 맞춰 반영한다. 예전의 이름으로 SW 조회(라이선스 키 포함)·상태 수정·
// 팀(부서) 신고·제출 이력은 없앴다 — 전환 뒤 포털은 SW 행을 읽거나 고칠 수 없다(암호문).
const SW_DECLARATION_ENTITY = "sw-declaration";

// ─── 신규 등록 레코드 → 미러 레코드 생성 ──────────────────────────────────────
interface DeclarationCreateRecord {
  user: string; company: string; department: string;
  swCategory: string; swDetail?: string;
  licenseType: string; workType: string; billingType: string;
  accountType?: string; renewalCycle?: string;
  version?: string[];
  monthlyKrw?: number; monthlyUsd?: number;
  licenseKey?: string;
  // 팀 엑셀 업로드에서만 채워지는 선택 필드 (양식의 추가 컬럼)
  status?: string; vendor?: string;
  usageDate?: string; renewalDate?: string; purchaseDate?: string;
}

function toRecord(r: DeclarationCreateRecord): SwDbRecord {
  const monthlyKrw = (r.monthlyKrw ?? 0) > 0 ? r.monthlyKrw! : 0;
  const monthlyUsd = (r.monthlyUsd ?? 0) > 0 ? r.monthlyUsd! : 0;
  return {
    id: crypto.randomUUID(),
    user: r.user || "",
    swCategory: r.swCategory || "",
    swDetail: r.swDetail || "",
    version: r.version ?? [],
    status: r.status || "신규등록",
    company: r.company || "",
    licenseType: r.licenseType || "",
    department: r.department || "",
    usageDate: r.usageDate || "",
    renewalDate: r.renewalDate || "",
    purchaseDate: r.purchaseDate || "",
    returnDate: "",
    shipStatus: "",
    accountType: r.accountType || "",
    renewalCycle: r.renewalCycle || "",
    licenseKey: r.licenseKey || "",
    vendor: r.vendor || "",
    usageCount: 0,
    certificate: "",
    draftDocument: "",
    workType: r.workType || "",
    billingType: r.billingType || "",
    lastModifiedBy: "자가신고",
    lastModifiedAt: new Date().toISOString(),
    monthlyUsd,
    monthlyKrw,
    annualUsd: monthlyUsd * 12,
    annualKrw: monthlyKrw * 12,
    notionUrl: "",
  };
}

// ─── POST /api/declaration ────────────────────────────────────────────────────
// Body: { reporter: { company, department, name }, records: [{ ...SW 추가 양식, usage: "사용중" | "반납예정" }] }
// 신고 한 건 = 신고 행 하나: { reporter, usage, record(SW 자산 모양 — 앱이 그대로 등록할 수 있게), submittedAt }
const MAX_RECORDS = 50;

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      reporter?: { company?: string; department?: string; name?: string };
      records?: (DeclarationCreateRecord & { usage?: string })[];
    };
    const reporter = {
      company: String(body.reporter?.company ?? "").trim(),
      department: String(body.reporter?.department ?? "").trim(),
      name: String(body.reporter?.name ?? "").trim(),
    };
    if (!reporter.company || !reporter.department || !reporter.name) {
      return Response.json({ ok: false, error: "법인명·부서·이름을 입력해주세요." }, { status: 400 });
    }
    const records = body.records;
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ ok: false, error: "신고할 SW 가 없습니다." }, { status: 400 });
    }
    if (records.length > MAX_RECORDS) {
      return Response.json({ ok: false, error: `한 번에 ${MAX_RECORDS}건까지 신고할 수 있습니다.` }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();
    let count = 0;
    for (const r of records) {
      const usage = r.usage === "반납예정" ? "반납예정" : "사용중";
      const record = toRecord({
        ...r,
        user: reporter.name, company: reporter.company, department: reporter.department,
        status: usage === "반납예정" ? "반납예정" : "신규등록",
      });
      if (await insertEntity(SW_DECLARATION_ENTITY, crypto.randomUUID(), { reporter, usage, record, submittedAt })) count++;
    }
    if (count < records.length) {
      return Response.json({ ok: false, error: `${records.length}건 중 ${count}건만 저장됐습니다. 다시 시도해주세요.`, count }, { status: 500 });
    }
    return Response.json({ ok: true, count });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { fetchSwDatabase } from "@/lib/notion";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";
import type { SwDbRecord } from "@/types";

// 4.0verMACBOOK: SW 자가신고 플로우도 맥북 Postgres 미러(메인)를 읽고 쓴다.
// (생성/수정은 dirty 로 표시 → 5분 백업 러너가 Notion 에 반영)

// ─── GET /api/declaration?name=...&company=... ────────────────────────────────
// 이름 + 법인명 기준으로 기존 등록 SW 조회
// scope=team인 경우 법인명 + 부서 기준으로 전체 조회
export async function GET(req: NextRequest) {
  try {
    const sp         = new URL(req.url).searchParams;
    const scope       = sp.get("scope")?.trim() ?? "";
    const name        = sp.get("name")?.trim()    ?? "";
    const company     = sp.get("company")?.trim() ?? "";
    const department  = sp.get("department")?.trim() ?? "";

    const all = await fetchSwDatabase();

    let matched: SwDbRecord[];
    if (scope === "team") {
      if (!company || !department)
        return Response.json({ ok: false, error: "법인명과 부서를 입력해주세요." }, { status: 400 });
      matched = all.filter(r => r.company === company && (r.department ?? "").includes(department));
    } else {
      if (!name || !company)
        return Response.json({ ok: false, error: "이름과 법인명을 입력해주세요." }, { status: 400 });
      matched = all.filter(r => r.company === company && (r.user ?? "").includes(name));
    }

    const records = matched.slice(0, 100).map(r => ({
      id:           r.id,
      notionUrl:    r.notionUrl || "",
      user:         r.user,
      swCategory:   r.swCategory,
      swDetail:     r.swDetail,
      version:      r.version,
      status:       r.status,
      licenseType:  r.licenseType,
      workType:     r.workType,
      billingType:  r.billingType ?? "",
      accountType:  r.accountType,
      renewalCycle: r.renewalCycle,
      monthlyKrw:   r.monthlyKrw,
      monthlyUsd:   r.monthlyUsd,
      licenseKey:   r.licenseKey,
      renewalDate:  r.renewalDate,
      usageDate:    r.usageDate,
    }));

    return Response.json({ ok: true, records });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

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
// type:"update"     → 기존 레코드 상태 변경
// type:"create"     → 신규 SW 신고
// type:"createMany" → 신규 SW 일괄 신고
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type === "update") {
      const { pageId, status } = body as { pageId: string; status: string };
      const base = await readEntityOne<SwDbRecord>(SW_ENTITY, pageId);
      if (!base) return Response.json({ ok: false, error: "레코드를 찾을 수 없습니다." }, { status: 404 });
      const ok = await upsertEntity(SW_ENTITY, pageId, { ...base, status, lastModifiedAt: new Date().toISOString() });
      return Response.json({ ok });
    }

    if (body.type === "create") {
      const rec = toRecord(body.record as DeclarationCreateRecord);
      const ok = await upsertEntity(SW_ENTITY, rec.id, rec);
      return Response.json({ ok, id: rec.id });
    }

    if (body.type === "createMany") {
      const records = body.records as DeclarationCreateRecord[];
      if (!Array.isArray(records) || records.length === 0)
        return Response.json({ ok: false, error: "등록할 항목이 없습니다." }, { status: 400 });

      const ids: string[] = [];
      for (const r of records) {
        const rec = toRecord(r);
        const ok = await upsertEntity(SW_ENTITY, rec.id, rec);
        if (ok) ids.push(rec.id);
      }
      return Response.json({ ok: true, ids });
    }

    return Response.json({ ok: false, error: "Invalid type" }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

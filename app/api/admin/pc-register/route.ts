import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { fetchPcScans, matchPcScansWithHw, updatePcScan, deletePcScan, type PcScanEditFields } from "@/lib/pc-scan";
import { type HwRecord } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// PC 신규 등록(자산 실사 방식) 수집 데이터 조회/수정/삭제.
// /api/admin/pc-scan과 동일한 로직이되, 별도 DB(NOTION_DB_PC_REGISTER)를 대상으로 한다.

async function requireSuper(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await requireSuper(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [scans, hwAll] = await Promise.all([
      fetchPcScans("NOTION_DB_PC_REGISTER"),
      kvGet<HwRecord[]>("hw:all"),
    ]);

    if (!hwAll) triggerWarmHw().catch(console.warn);

    const data = matchPcScansWithHw(scans, hwAll ?? []);
    return NextResponse.json({ ok: true, data, masterCacheWarming: !hwAll });
  } catch (e) {
    console.error("[GET /api/admin/pc-register]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// PATCH /api/admin/pc-register  body: { id, fields }  — 수집 레코드 필드 수정
export async function PATCH(req: NextRequest) {
  if (!(await requireSuper(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, fields } = await req.json() as { id: string; fields: PcScanEditFields };
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }

    await updatePcScan(id, fields);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/admin/pc-register]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/admin/pc-register?id=xxx  — 수집 레코드 소프트 삭제(archive)
export async function DELETE(req: NextRequest) {
  if (!(await requireSuper(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }

    await deletePcScan(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/admin/pc-register]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

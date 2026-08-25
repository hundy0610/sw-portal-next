import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { fetchPcScans, matchPcScansWithHw, updatePcScan, deletePcScan, type PcScanEditFields } from "@/lib/pc-scan";
import { getHwAllFromPostgres } from "@/lib/repo/hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

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
    // HW 마스터 대조는 맥북 Postgres에서(항상 최신). 미설정(로컬 dev 등) 시에만 null —
    // 조회 실패 시엔 getHwAllFromPostgres가 throw해 바깥 catch가 처리한다.
    const [scans, hwAll] = await Promise.all([
      fetchPcScans(),
      getHwAllFromPostgres(),
    ]);

    const data = matchPcScansWithHw(scans, hwAll ?? []);
    return NextResponse.json({ ok: true, data, masterCacheWarming: !hwAll });
  } catch (e) {
    console.error("[GET /api/admin/pc-scan]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// PATCH /api/admin/pc-scan  body: { id, fields }  — 스캔 레코드 필드 수정
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
    console.error("[PATCH /api/admin/pc-scan]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/admin/pc-scan?id=xxx  — 스캔 레코드 소프트 삭제(archive)
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
    console.error("[DELETE /api/admin/pc-scan]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

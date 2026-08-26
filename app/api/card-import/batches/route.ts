import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import {
  listBatches, saveBatch, deleteBatch, getBatchRows, annotateWarnings,
  type BatchMeta, type CardRow,
} from "@/lib/card-import";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

async function requireSuper(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if ((await resolveCurrentRole(session)) !== "super") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// GET /api/card-import/batches            — 업로드 이력 목록
// GET /api/card-import/batches?id=xxx     — 특정 배치의 표준화된 행 전체
export async function GET(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const rows = await getBatchRows(id);
      if (!rows) return NextResponse.json({ ok: false, error: "해당 업로드 건을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ ok: true, rows });
    }
    return NextResponse.json({ ok: true, batches: await listBatches() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/card-import/batches — 미리보기에서 확인한 표준 데이터를 최종 저장
export async function POST(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      company: string; source: string; fileName: string;
      rows: Omit<CardRow, "warnings">[];
    };
    const company = (body.company ?? "").trim();
    const source  = (body.source ?? "").trim();
    if (!company || !source) {
      return NextResponse.json({ ok: false, error: "법인과 소스명은 필수입니다." }, { status: 400 });
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "저장할 데이터가 없습니다." }, { status: 400 });
    }
    if (body.rows.length > MAX_ROWS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_ROWS}행까지 저장할 수 있습니다.` }, { status: 400 });
    }

    // 경고는 서버에서 다시 계산한다 — 클라이언트가 보낸 값을 그대로 믿지 않기 위함.
    const rows = annotateWarnings(body.rows);
    const now = new Date();
    const meta: BatchMeta = {
      id: crypto.randomUUID(),
      company,
      source,
      fileName: (body.fileName ?? "").trim(),
      rowCount: rows.length,
      totalAmount: rows.reduce((s, r) => s + (r.amount || 0), 0),
      warningCount: rows.filter(r => r.warnings.length > 0).length,
      uploadedAt: now.toISOString(),
      uploadedBy: `${await resolveCurrentName(gate.session!)} (${gate.session!.userId})`,
    };

    if (!(await saveBatch(meta, rows))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, batch: meta });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/card-import/batches?id=... — 업로드 건 삭제
export async function DELETE(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!(await deleteBatch(id))) {
      return NextResponse.json({ ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

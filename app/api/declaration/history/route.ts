import { NextRequest } from "next/server";
import { appendDeclarationLog, getDeclarationLogs } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";

// ─── GET /api/declaration/history?company=&name=       → 개인 실사 이력
// ─── GET /api/declaration/history?company=&department= → 팀 실사 이력
export async function GET(req: NextRequest) {
  try {
    const sp         = new URL(req.url).searchParams;
    const company     = sp.get("company")?.trim()    ?? "";
    const name        = sp.get("name")?.trim()       ?? "";
    const department  = sp.get("department")?.trim() ?? "";

    if (!company || (!name && !department))
      return Response.json({ ok: false, error: "법인명과 이름(또는 부서)을 입력해주세요." }, { status: 400 });

    const logs = await getDeclarationLogs({ company, name, department });
    return Response.json({ ok: true, logs });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// ─── POST /api/declaration/history ─────────────────────────────
// 실사 완료 시점에 이력 1건을 기록한다 (개인 완료 / 팀 확인 완료)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, company, department, name, count } = body as {
      type: "personal" | "team"; company: string; department: string; name?: string; count: number;
    };

    if (!type || !company || !department)
      return Response.json({ ok: false, error: "필수 값이 누락되었습니다." }, { status: 400 });

    await appendDeclarationLog({
      type, company, department,
      name: name?.trim() || undefined,
      count: Number(count) || 0,
      timestamp: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

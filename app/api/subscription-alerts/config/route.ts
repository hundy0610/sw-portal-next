import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import {
  getBudgets, saveBudgets, getDeadlines, saveDeadlines,
  type BudgetConfig, type DeadlineConfig,
} from "@/lib/subscription-alerts";

export const dynamic = "force-dynamic";

// 예산 상한·제출기한은 그룹 전체 기준값이라 슈퍼어드민만 수정할 수 있다.
async function requireSuper(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if ((await resolveCurrentRole(session)) !== "super") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// GET /api/subscription-alerts/config — 예산 상한 + 제출기한 설정 조회
export async function GET(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const [budgets, deadlines] = await Promise.all([getBudgets(), getDeadlines()]);
    return NextResponse.json({ ok: true, budgets, deadlines });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/subscription-alerts/config — 전체 교체 저장
export async function POST(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as { budgets?: BudgetConfig[]; deadlines?: DeadlineConfig[] };

    if (body.budgets) {
      const cleaned = body.budgets
        .map(b => ({
          company: (b.company ?? "").trim(),
          department: (b.department ?? "").trim(),
          monthlyLimitKrw: Math.max(0, Math.round(Number(b.monthlyLimitKrw) || 0)),
        }))
        .filter(b => b.company && b.monthlyLimitKrw > 0);
      if (!(await saveBudgets(cleaned))) {
        return NextResponse.json({ ok: false, error: "예산 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
      }
    }

    if (body.deadlines) {
      const cleaned = body.deadlines
        .map(d => ({
          company: (d.company ?? "").trim(),
          dayOfMonth: Math.min(31, Math.max(1, Math.round(Number(d.dayOfMonth) || 1))),
        }))
        .filter(d => d.company);
      if (!(await saveDeadlines(cleaned))) {
        return NextResponse.json({ ok: false, error: "제출기한 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
      }
    }

    const [budgets, deadlines] = await Promise.all([getBudgets(), getDeadlines()]);
    return NextResponse.json({ ok: true, budgets, deadlines });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

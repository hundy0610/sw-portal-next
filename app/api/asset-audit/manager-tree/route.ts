import { NextRequest, NextResponse } from "next/server";
import { verifyManagerToken } from "@/lib/asset-audit-token";
import { fetchOrgUnits, buildOrgTree, findSubtree } from "@/lib/org-chart";
import { fetchAllHwRecords } from "@/lib/hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.nextUrl.searchParams.get("token");
}

// GET /api/asset-audit/manager-tree?token=... — 인증된 직책자의 관할 조직 서브트리 + 진행률
export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const payload = token ? verifyManagerToken(token) : null;
    if (!payload) {
      return NextResponse.json({ ok: false, error: "인증이 만료되었습니다. 다시 로그인해주세요." }, { status: 401 });
    }

    const [units, hwRecords] = await Promise.all([fetchOrgUnits(), fetchAllHwRecords()]);
    const tree = buildOrgTree(units, hwRecords);
    const subtree = findSubtree(tree, payload.unitId);
    if (!subtree) {
      return NextResponse.json({ ok: false, error: "조직 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, unit: subtree, managerName: payload.name });
  } catch (e) {
    console.error("[manager-tree GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

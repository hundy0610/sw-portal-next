import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv-store";
import { memGet } from "@/lib/mem-cache";
import type { SwDbRecord } from "@/types";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

// 월간: 14일 전 / 연간: 30일 전 알림
const ALERT_DAYS: Record<string, number> = {
  "월": 14,
  "연": 30,
};

export async function GET(request: NextRequest) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const scope = companyScope(session);

  try {
    const { searchParams } = new URL(request.url);
    const filterCompany = scope ?? (searchParams.get("company")?.trim() || "");

    // 캐시에서 SW 데이터 조회
    let data = memGet<SwDbRecord[]>("sw:all");
    if (!data) {
      const compact = await kvGet<Partial<SwDbRecord>[]>("sw:all");
      data = compact as SwDbRecord[] | null;
    }
    if (!data) return NextResponse.json({ ok: true, groups: [], total: 0 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 알림 대상 필터 (월간 14일 이내 / 연간 30일 이내)
    const expiring = data.filter(r => {
      const cycle = r.renewalCycle ?? "";
      if (!ALERT_DAYS[cycle]) return false;           // 갱신주기 없으면 제외
      if (r.status !== "사용중") return false;
      if (!r.renewalDate) return false;
      if (filterCompany && r.company !== filterCompany) return false;

      const rd = new Date(r.renewalDate);
      const alertBefore = ALERT_DAYS[cycle];
      const alertFrom = new Date(today);
      alertFrom.setDate(alertFrom.getDate() + alertBefore);

      // today <= renewalDate <= today + alertDays
      return rd >= today && rd <= alertFrom;
    });

    // 법인 + 부서 + 갱신주기 + 갱신일 기준 그룹핑
    const groupMap = new Map<string, {
      company: string; department: string;
      renewalDate: string; cycle: string;
      ids: string[]; sw: string[];
    }>();

    for (const r of expiring) {
      const key = `${r.company}||${r.department || ""}||${r.renewalDate}||${r.renewalCycle}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          company: r.company || "",
          department: r.department || "",
          renewalDate: r.renewalDate!,
          cycle: r.renewalCycle ?? "",
          ids: [], sw: [],
        });
      }
      const g = groupMap.get(key)!;
      g.ids.push(r.id);
      if (!g.sw.includes(r.swCategory)) g.sw.push(r.swCategory);
    }

    const groups = [...groupMap.values()]
      .map(g => ({ ...g, count: g.ids.length }))
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));

    return NextResponse.json({ ok: true, groups, total: expiring.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

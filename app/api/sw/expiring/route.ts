import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv-store";
import { memGet } from "@/lib/mem-cache";
import type { SwDbRecord } from "@/types";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

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
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    // 월간 구독 + 사용중 + 7일 이내 갱신
    const expiring = data.filter(r => {
      if ((r.renewalCycle ?? "") !== "월") return false;
      if (r.status !== "사용중") return false;
      if (!r.renewalDate) return false;
      if (filterCompany && r.company !== filterCompany) return false;
      const rd = new Date(r.renewalDate);
      return rd >= today && rd <= in7Days;
    });

    // 법인 + 부서 + 갱신일 기준 그룹핑
    const groupMap = new Map<string, {
      company: string; department: string; renewalDate: string;
      ids: string[]; sw: string[];
    }>();

    for (const r of expiring) {
      const key = `${r.company}||${r.department || ""}||${r.renewalDate}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          company: r.company || "",
          department: r.department || "",
          renewalDate: r.renewalDate!,
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

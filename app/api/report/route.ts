import { unstable_cache } from "next/cache";
import { fetchSwDatabase } from "@/lib/notion";

// Notion DB 전체 조회 결과를 5분간 서버 캐시
// → 같은 Vercel 인스턴스 내에서는 Notion API를 재호출하지 않음
const getCachedSwDatabase = unstable_cache(
  () => fetchSwDatabase(),
  ["sw-database-all"],
  { revalidate: 300 }
);

// ─── 공개 타입 (ReportPanel 에서 import type 사용) ───────────────────────

export interface SubRow {
  id: string;
  company: string;
  department: string;
  swName: string;
  licenseType: string;
  user: string;
  renewalDate: string;
  monthlyKrw: number;
  annualKrw: number;
}

export interface SwInDept {
  swName: string;
  licenseCount: number;
  monthlyKrw: number;
  annualKrw: number;
}

export interface DeptSummary {
  company: string;
  department: string;
  swCount: number;
  licenseCount: number;
  monthlyKrw: number;
  annualKrw: number;
  swList: SwInDept[];
}

export interface ReportData {
  rows: SubRow[];
  deptSummary: DeptSummary[];
  filters: {
    companies: string[];
    departments: string[];
  };
  totalMonthlyKrw: number;
  totalAnnualKrw: number;
  hasCostData: boolean;
  generatedAt: string;
}

// ─── GET /api/report ──────────────────────────────────────────────────────
// company / department 필터는 클라이언트에서 처리하므로 서버는 항상 전체 반환

export async function GET(_req: Request) {
  try {
    const allRecords = await getCachedSwDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 구독 타입만, 만료/반납 제외 ─────────────────────────────────────
    const subRecords = allRecords.filter(r => {
      const isSub      = r.licenseType.includes("구독");
      const notExpired = r.status !== "만료" && r.status !== "반납";
      const renewalOk  = !r.renewalDate || new Date(r.renewalDate) >= today;
      return isSub && notExpired && renewalOk;
    });

    // ── 필터 옵션 (전체 구독 레코드 기준) ─────────────────────────────
    const companies   = [...new Set(subRecords.map(r => r.company).filter(Boolean))].sort();
    const filterDepts = [...new Set(subRecords.map(r => r.department).filter(Boolean))].sort();

    // ── 행 목록 (전체 반환 — 필터는 클라이언트에서 처리) ────────────────
    const rows: SubRow[] = subRecords.map(r => ({
      id:          r.id,
      company:     r.company,
      department:  r.department,
      swName:      r.swCategory || r.swDetail || "미입력",
      licenseType: r.licenseType,
      user:        r.user,
      renewalDate: r.renewalDate,
      monthlyKrw:  r.monthlyKrw,
      annualKrw:   r.monthlyKrw * 12,
    }));

    // ── 부서별 집계 (전체 기준) ─────────────────────────────────────────
    const deptMap = new Map<string, DeptSummary>();

    for (const row of rows) {
      const key = `${row.company}__${row.department}`;
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          company:      row.company,
          department:   row.department,
          swCount:      0,
          licenseCount: 0,
          monthlyKrw:   0,
          annualKrw:    0,
          swList:       [],
        });
      }
      const s = deptMap.get(key)!;
      s.licenseCount++;
      s.monthlyKrw += row.monthlyKrw;
      s.annualKrw  += row.annualKrw;

      const existing = s.swList.find(sw => sw.swName === row.swName);
      if (existing) {
        existing.licenseCount++;
        existing.monthlyKrw += row.monthlyKrw;
        existing.annualKrw  += row.annualKrw;
      } else {
        s.swList.push({
          swName:       row.swName,
          licenseCount: 1,
          monthlyKrw:   row.monthlyKrw,
          annualKrw:    row.annualKrw,
        });
        s.swCount++;
      }
    }

    const deptSummary = [...deptMap.values()]
      .sort((a, b) => b.monthlyKrw - a.monthlyKrw || a.department.localeCompare(b.department));

    deptSummary.forEach(d => d.swList.sort((a, b) => b.monthlyKrw - a.monthlyKrw));

    const totalMonthlyKrw = rows.reduce((s, r) => s + r.monthlyKrw, 0);
    const totalAnnualKrw  = rows.reduce((s, r) => s + r.annualKrw,  0);
    const hasCostData     = rows.some(r => r.monthlyKrw > 0);

    const data: ReportData = {
      rows,
      deptSummary,
      filters: { companies, departments: filterDepts },
      totalMonthlyKrw,
      totalAnnualKrw,
      hasCostData,
      generatedAt: new Date().toISOString(),
    };

    return Response.json({ ok: true, data });
  } catch (e: unknown) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

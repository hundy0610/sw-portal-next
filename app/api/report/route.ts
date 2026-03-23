import { unstable_cache } from "next/cache";
import { fetchSwDatabase } from "@/lib/notion";
import { mapCategory } from "@/lib/reportTypes";
import type { SubRow, DeptSummary, ReportData } from "@/lib/reportTypes";

// Notion DB 전체 조회 결과를 5분간 서버 캐시
const getCachedSwDatabase = unstable_cache(
  () => fetchSwDatabase(),
  ["sw-database-all"],
  { revalidate: 300 }
);

// ─── GET /api/report ──────────────────────────────────────────────────────
// 필터는 클라이언트에서 처리 — 서버는 항상 전체 반환

export async function GET(_req: Request) {
  try {
    const allRecords = await getCachedSwDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 구독 타입만, 만료/반납 제외
    const subRecords = allRecords.filter(r => {
      const isSub      = r.licenseType.includes("구독");
      const notExpired = r.status !== "만료" && r.status !== "반납";
      const renewalOk  = !r.renewalDate || new Date(r.renewalDate) >= today;
      return isSub && notExpired && renewalOk;
    });

    const companies   = [...new Set(subRecords.map(r => r.company).filter(Boolean))].sort();
    const filterDepts = [...new Set(subRecords.map(r => r.department.trim()).filter(Boolean))].sort();

    // 행 목록 — workType(SW사용직군) 우선, 없으면 regex 폴백
    const rows: SubRow[] = subRecords.map(r => ({
      id:          r.id,
      company:     r.company,
      department:  r.department.trim(),
      swName:      r.swCategory || r.swDetail || "미입력",
      category:    r.workType || mapCategory(r.swCategory, r.swDetail),
      licenseType: r.licenseType,
      user:        r.user,
      renewalDate: r.renewalDate,
      annualUsd:   r.annualUsd ?? 0,
      annualKrw:   r.annualKrw > 0 ? r.annualKrw : (r.monthlyKrw ? r.monthlyKrw * 12 : 0),
      notionUrl:   r.notionUrl,
    }));

    // 카테고리 목록 (실제 존재하는 카테고리만, 정해진 순서로)
    const CAT_ORDER = ["사무", "문서작성", "정부", "설계", "디자인", "AI", "개발", "협업", "원격", "RPA", "기타"];
    const usedCats  = new Set(rows.map(r => r.category));
    const categories = CAT_ORDER.filter(c => usedCats.has(c));

    // 부서별 집계
    const deptMap = new Map<string, DeptSummary>();
    for (const row of rows) {
      const key = `${row.company}__${row.department}`;
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          company:      row.company,
          department:   row.department,
          swCount:      0,
          licenseCount: 0,
          annualUsd:    0,
          annualKrw:    0,
          swList:       [],
        });
      }
      const s = deptMap.get(key)!;
      s.licenseCount++;
      s.annualUsd += row.annualUsd;
      s.annualKrw += row.annualKrw;

      const existing = s.swList.find(sw => sw.swName === row.swName);
      if (existing) {
        existing.licenseCount++;
        existing.annualUsd += row.annualUsd;
        existing.annualKrw += row.annualKrw;
      } else {
        s.swList.push({
          swName:       row.swName,
          licenseCount: 1,
          annualUsd:    row.annualUsd,
          annualKrw:    row.annualKrw,
        });
        s.swCount++;
      }
    }

    // 정렬: KRW 연간 비용 내림차순 → USD 연간 비용 내림차순
    const deptSummary = [...deptMap.values()].sort((a, b) =>
      b.annualKrw - a.annualKrw || b.annualUsd - a.annualUsd || a.department.localeCompare(b.department)
    );
    deptSummary.forEach(d =>
      d.swList.sort((a, b) => b.annualKrw - a.annualKrw || b.annualUsd - a.annualUsd)
    );

    const totalAnnualUsd = rows.reduce((s, r) => s + r.annualUsd, 0);
    const totalAnnualKrw = rows.reduce((s, r) => s + r.annualKrw, 0);
    const hasUsdData     = rows.some(r => r.annualUsd > 0);
    const hasKrwData     = rows.some(r => r.annualKrw > 0);

    const data: ReportData = {
      rows,
      deptSummary,
      filters: { companies, departments: filterDepts, categories },
      totalAnnualUsd,
      totalAnnualKrw,
      hasUsdData,
      hasKrwData,
      generatedAt: new Date().toISOString(),
    };

    return Response.json({ ok: true, data });
  } catch (e: unknown) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

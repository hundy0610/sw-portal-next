import { fetchSwDatabase } from "@/lib/notion";
import { mapCategory } from "@/lib/reportTypes";
import type { SubRow, DeptSummary, ReportData } from "@/lib/reportTypes";
import { kvGet, kvSet } from "@/lib/kv-store";
import type { SwDbRecord } from "@/types";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_SW_UNIFIED"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const filterCompany = searchParams.get("company")?.trim() || "";

    // ✅ KV에서 즉시 읽기 (sw:all 키 공유 - sw-records API와 동일 데이터)
    let allRecords = await kvGet<SwDbRecord[]>("sw:all");

    if (!allRecords) {
      // KV 미스: Notion fetch 후 KV 저장
      allRecords = await fetchSwDatabase();
      await kvSet("sw:all", allRecords);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 구독 타입만, 만료/반납 제외
    const subRecords = allRecords.filter(r => {
      const isSub = r.licenseType.includes("구독");
      const notExpired = r.status !== "만료" && r.status !== "반납";
      const renewalOk = !r.renewalDate || new Date(r.renewalDate) >= today;
      return isSub && notExpired && renewalOk;
    });

    const companies = [...new Set(subRecords.map(r => r.company).filter(Boolean))].sort();

    const filteredRecords = filterCompany
      ? subRecords.filter(r => r.company === filterCompany)
      : subRecords;

    const filterDepts = [...new Set(filteredRecords.map(r => r.department.trim()).filter(Boolean))].sort();

    const rows: SubRow[] = filteredRecords.map(r => ({
      id: r.id,
      company: r.company,
      department: r.department.trim(),
      swName: r.swCategory || r.swDetail || "미입력",
      category: r.workType || mapCategory(r.swCategory, r.swDetail),
      licenseType: r.licenseType,
      user: r.user,
      renewalDate: r.renewalDate,
      annualUsd: r.annualUsd > 0 ? r.annualUsd : (r.monthlyUsd ? r.monthlyUsd * 12 : 0),
      annualKrw: r.annualKrw > 0 ? r.annualKrw : (r.monthlyKrw ? r.monthlyKrw * 12 : 0),
      notionUrl: r.notionUrl,
      billingType: r.billingType ?? "",
    }));

    const CAT_ORDER = ["사무", "문서작성", "정부", "설계", "디자인", "AI", "개발", "협업", "원격", "RPA", "기타"];
    const usedCats = new Set(rows.map(r => r.category));
    const categories = CAT_ORDER.filter(c => usedCats.has(c));

    const deptMap = new Map<string, DeptSummary>();
    for (const row of rows) {
      const key = `${row.company}__${row.department}`;
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          company: row.company,
          department: row.department,
          swCount: 0,
          licenseCount: 0,
          annualUsd: 0,
          annualKrw: 0,
          swList: [],
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
          swName: row.swName,
          licenseCount: 1,
          annualUsd: row.annualUsd,
          annualKrw: row.annualKrw,
          billingType: row.billingType,
        });
        s.swCount++;
      }
    }

    const deptSummary = [...deptMap.values()].sort(
      (a, b) => b.annualKrw - a.annualKrw || b.annualUsd - a.annualUsd || a.department.localeCompare(b.department)
    );
    deptSummary.forEach(d =>
      d.swList.sort((a, b) => b.annualKrw - a.annualKrw || b.annualUsd - a.annualUsd)
    );

    const totalAnnualUsd = rows.reduce((s, r) => s + r.annualUsd, 0);
    const totalAnnualKrw = rows.reduce((s, r) => s + r.annualKrw, 0);
    const hasUsdData = rows.some(r => r.annualUsd > 0);
    const hasKrwData = rows.some(r => r.annualKrw > 0);

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

    return Response.json({ ok: true, data }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e: unknown) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

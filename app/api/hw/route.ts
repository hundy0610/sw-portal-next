import { NextRequest, NextResponse } from "next/server";
import { type HwRecord, fetchHwFiltered, parseChangeLog } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

// 변경이력에 남은 과거 사용자/부서 값(from/to)만 매칭 — "by"(변경한 사람) 등 다른 텍스트는
// 매칭 대상에서 제외해, 그 자산을 실제로 쓴 적 없는 관리자 이름이 검색결과에 섞이지 않게 한다.
function matchesPastUserOrDept(changeLogRaw: string, q: string): boolean {
  return parseChangeLog(changeLogRaw).some(ev =>
    ev.changes.some(c =>
      (c.field === "user" || c.field === "dept") &&
      (c.from.toLowerCase().includes(q) || c.to.toLowerCase().includes(q))
    )
  );
}

export async function GET(req: NextRequest) {
  if (!process.env.NOTION_TOKEN) return NextResponse.json({ missingEnv: "NOTION_TOKEN", error: "환경변수 NOTION_TOKEN 이 설정되지 않았습니다." }, { status: 503 });

  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search")?.trim()    || "";
  const company   = scope ?? (searchParams.get("company")?.trim() || "");
  const status    = searchParams.get("status")?.trim()    || "";
  const location  = searchParams.get("location")?.trim()  || "";
  const assetNo   = searchParams.get("assetNo")?.trim()   || "";
  const returnDue = searchParams.get("returnDue") === "1";
  const refresh   = searchParams.get("refresh") === "1";
  // 탭별 필터 직접 조회용 (KV cold miss 시 Notion 직접 쿼리)
  const statuses  = searchParams.get("statuses")?.split(",").map(s => s.trim()).filter(Boolean) ?? [];

  try {
    // hw:all + hw:deltas 병렬 조회
    const [records, deltas] = await Promise.all([
      kvGet<HwRecord[]>("hw:all"),
      kvGet<Record<string, Partial<HwRecord>>>("hw:deltas"),
    ]);

    if (!records) {
      // KV 미스
      if (statuses.length > 0 || returnDue || assetNo || search) {
        // 필터가 있으면 Notion 직접 조회 (결과 수십~백 건 → 1~3 호출, 타임아웃 안전)
        // search는 자산번호 정확 일치가 아니라 사용자/자산번호/모델/시리얼/부서 부분 일치
        // OR 검색이므로 assetNo와 분리해서 넘긴다 (fetchHwFiltered 참고)
        const filtered = await fetchHwFiltered({ statuses, returnDue, company, assetNo, search });
        return NextResponse.json({ ok: true, records: filtered });
      }
      // 전체 데이터 요청 — Vercel 10s 초과. GitHub Actions 트리거 (백그라운드)
      triggerWarmHw().catch(console.warn);
      return NextResponse.json({
        ok: true,
        records: [],
        warming: true,
        message: "HW 데이터 캐시를 갱신하고 있습니다. 잠시 후 자동으로 재시도합니다.",
      });
    }

    // deltas 적용 — hw:all 패치가 누락된 레코드를 최신값으로 덮어씌움
    const base = deltas
      ? records.map(r => (deltas[r.id] ? { ...r, ...deltas[r.id] } : r))
      : records;

    // 메모리 필터링 (추가 DB 호출 없음)
    let filtered = base;
    if (statuses.length > 0) filtered = filtered.filter(r => statuses.includes(r.status));
    if (assetNo)   filtered = filtered.filter(r => r.assetNo === assetNo);
    if (company)   filtered = filtered.filter(r => r.company === company);
    if (status)    filtered = filtered.filter(r => r.status === status);
    if (location)  filtered = filtered.filter(r => r.location.includes(location));
    if (returnDue) filtered = filtered.filter(r => !!r.returnDue);
    if (search) {
      // 쉼표로 구분된 여러 검색어를 OR 조건으로 처리 (예: "A001,김철수")
      const terms = search.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      filtered = filtered.filter(r =>
        terms.some(q =>
          r.user.toLowerCase().includes(q)      ||
          r.assetNo.toLowerCase().includes(q)   ||
          r.model.toLowerCase().includes(q)     ||
          r.serial.toLowerCase().includes(q)    ||
          r.dept.toLowerCase().includes(q)      ||
          matchesPastUserOrDept(r.changeLog || "", q)
        )
      );
    }
    if (returnDue) {
      filtered = [...filtered].sort((a, b) =>
        (a.returnDue || "9999") < (b.returnDue || "9999") ? -1 : 1
      );
    }

    return NextResponse.json({ ok: true, records: filtered });
  } catch (e) {
    console.error("[API /hw]", e);
    return NextResponse.json(
      { ok: false, error: errorMessage(e), records: [] },
      { status: 500 }
    );
  }
}

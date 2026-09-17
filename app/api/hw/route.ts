import { NextRequest, NextResponse } from "next/server";
import { type HwRecord, parseChangeLog } from "@/lib/hw";
import { getHwAllFromPostgres, isPostgresEnabled } from "@/lib/repo/hw";
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
  if (!isPostgresEnabled()) {
    return NextResponse.json({ missingEnv: "SUPABASE_URL", error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
  }

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
  const statuses  = searchParams.get("statuses")?.split(",").map(s => s.trim()).filter(Boolean) ?? [];

  try {
    // 유일한 소스: 맥북 Postgres(자체 Supabase, Tailscale Funnel 경유).
    // 조회가 실패하면 getHwAllFromPostgres 가 throw 하고 아래 catch 가 처리한다
    // (옛 hw:all KV 스냅샷 폴백은 4.0에서 제거 — 갱신 주체가 없어 영구히 얼어붙어 있었음).
    const records = await getHwAllFromPostgres();

    if (!records) {
      return NextResponse.json({
        ok: false,
        records: [],
        error: "데이터 저장소(Postgres)가 설정되지 않았습니다.",
      }, { status: 503 });
    }

    // 메모리 필터링 (추가 DB 호출 없음)
    let filtered = records;
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

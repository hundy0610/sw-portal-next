import { NextRequest, NextResponse } from "next/server";
import { fetchSaasCatalog } from "@/lib/saas-catalog";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * PC 스캐닝 프로그램이 자산실사 시 방문기록에서 어떤 도메인만 추출해도 되는지
 * 미리 받아가는 용도 — 카탈로그에 없는 도메인은 PC에서부터 아예 읽지 말라는 목록이다.
 *
 * 도메인 이름만 내려준다(카탈로그의 vendor/category/status 등 내부 정책 정보는
 * 노출하지 않는다) — 이 엔드포인트가 뭘 반환하는지가 새어나가도 피해가 "우리가
 * 추적 중인 SaaS 도메인 이름 목록" 정도로 제한되게 하기 위함이다.
 *
 * 인증은 PC 스캔 수집(/api/pc-scan)과 같은 x-scan-key를 재사용한다 — 이미 신뢰하는
 * 호출자(스캐닝 프로그램)이므로 별도 키를 새로 발급해 관리 부담을 늘리지 않는다.
 */
export async function GET(req: NextRequest) {
  const scanKey = process.env.SCAN_INGEST_KEY;
  if (!scanKey || req.headers.get("x-scan-key") !== scanKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const catalog = await fetchSaasCatalog();
    const domains = (catalog ?? [])
      .map(item => item.domain?.trim().toLowerCase())
      .filter((d): d is string => !!d);
    return NextResponse.json({ ok: true, domains: Array.from(new Set(domains)) });
  } catch (e) {
    console.error("[GET /api/saas-domains]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

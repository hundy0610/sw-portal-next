import { NextResponse } from "next/server";
import { getAssetAuditConfig } from "@/lib/asset-audit-config";

export const dynamic = "force-dynamic";

// 실사 프로그램 안내(직원 /asset-audit 화면) — 읽기만. 설정 저장·파일 업로드는 데스크탑 앱이 한다
// (v2 전환 뒤 포털 관리 화면을 없앴다, 10-29).
export async function GET() {
  const cfg = await getAssetAuditConfig();
  return NextResponse.json(cfg);
}

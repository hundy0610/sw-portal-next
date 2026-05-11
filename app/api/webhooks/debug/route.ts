import { NextRequest, NextResponse } from "next/server";
import { kvSetPermanent, kvGet } from "@/lib/kv-store";

export const dynamic = "force-dynamic";

// Notion이 실제로 보내는 페이로드 확인용 임시 엔드포인트
export async function POST(req: NextRequest) {
  const body = await req.json();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  await kvSetPermanent("webhook:debug:last", { body, headers, receivedAt: new Date().toISOString() });
  console.log("[webhook/debug] payload:", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const data = await kvGet("webhook:debug:last");
  return NextResponse.json(data ?? { message: "아직 수신된 페이로드 없음" });
}

import { NextRequest, NextResponse } from "next/server";
import { upsertPcScan, type PcScanPayload } from "@/lib/pc-scan";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// base64 문자열 상한 5MB → 실제 파일 ~3.7MB
const MAX_FILE_BASE64_BYTES = 5 * 1024 * 1024;
// 전체 요청 본문 상한 (base64 + JSON 메타)
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const scanKey = process.env.SCAN_INGEST_KEY;
  if (!scanKey || req.headers.get("x-scan-key") !== scanKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: PcScanPayload;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "요청 본문이 너무 큽니다 (최대 8MB)" },
        { status: 400 }
      );
    }
    body = JSON.parse(raw) as PcScanPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 파싱 오류" }, { status: 400 });
  }

  const serial = typeof body.serial === "string" ? body.serial.trim() : "";
  const pcName = typeof body.pcName === "string" ? body.pcName.trim() : "";
  if (!serial || !pcName) {
    return NextResponse.json(
      { ok: false, error: "serial, pcName은 필수입니다" },
      { status: 400 }
    );
  }

  if (
    typeof body.programsFileBase64 === "string" &&
    body.programsFileBase64.length > MAX_FILE_BASE64_BYTES
  ) {
    return NextResponse.json(
      { ok: false, error: "programsFileBase64는 최대 5MB까지 허용됩니다" },
      { status: 400 }
    );
  }

  const isDualOrShared = typeof body.isDualOrShared === "boolean" ? body.isDualOrShared : false;
  const originalCorp = typeof body.originalCorp === "string" ? body.originalCorp.trim() : "";

  try {
    const result = await upsertPcScan({ ...body, serial, pcName, isDualOrShared, originalCorp });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[POST /api/pc-scan]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

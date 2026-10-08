import { NextRequest, NextResponse } from "next/server";
import { upsertPcScan, type PcScanPayload } from "@/lib/pc-scan";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// base64 문자열 상한 5MB → 실제 파일 ~3.7MB
const MAX_FILE_BASE64_BYTES = 5 * 1024 * 1024;
// 전체 요청 본문 상한 (base64 + JSON 메타)
const MAX_BODY_BYTES = 8 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// 첨부 파일 고정 — 이 엔드포인트는 공유키 하나로 열린다.
//
// 그 키는 전 직원 PC 에 배포되는 실행 파일 안에 내장돼 있어 추출이 가능하다. 따라서
// "키가 맞는 요청" 을 보낸 쪽이 우리 에이전트라고 신뢰할 수 없다.
//
// 업로드된 파일은 lib/blob-store.ts 가 Vercel Blob 에 access:"public" 으로,
// **클라이언트가 지정한 Content-Type 그대로** 올려 영구 공개 URL 을 만든다.
// 검증이 없으면 이 엔드포인트가 "회사 스토리지에 임의 파일을 원하는 Content-Type 으로
// 호스팅해 주는 창구" 가 된다 (text/html 로 올리면 회사 스토리지에서 서빙되는 피싱 페이지).
//
// 에이전트가 올리는 것은 설치 프로그램 목록 xlsx 하나뿐이므로 거기에 맞춰 못 박는다.
// ─────────────────────────────────────────────────────────────────────────────
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * 내용이 실제로 xlsx 인지 확인한다. xlsx 는 zip 컨테이너라 `PK\x03\x04` 로 시작한다.
 * 확장자와 Content-Type 은 보내는 쪽이 정하는 값이라 근거가 되지 못한다.
 */
function isXlsxBase64(base64: string): boolean {
  // base64 4글자 = 3바이트. 8글자면 6바이트라 앞 4바이트를 보기에 충분하다.
  const head = Buffer.from(base64.replace(/\s/g, "").slice(0, 8), "base64");
  return head.length >= 4 && head.subarray(0, 4).toString("hex") === "504b0304";
}

/** 확장자를 .xlsx 로 고정한다 (경로 문자 제거는 blob-store 의 sanitize 가 한다). */
function forceXlsxName(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim().replace(/\.[^.]*$/, "") + ".xlsx";
}

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
  // 시리얼은 선택값이다 — pc-register(9ac1c9b)와 같은 이유. 조립 PC·VM 은 BIOS 가
  // "Default string" 같은 무의미 기본값을 돌려주고, 에이전트(NormalizeSerial)가 그 값을
  // 빈 값으로 바꿔 보낸다. 그 PC 들도 실사에 참여해야 하므로 pcName 만 필수로 둔다.
  //
  // 시리얼이 없으면 serialFuzzyMatch 가 늘 false 라 HW 자동 실사확인·연락처 보정은 일어나지
  // 않는다(대시보드에서 자산번호로 수동 확인). 기존 레코드 판정은 pcName 으로만 이뤄진다.
  if (!pcName) {
    return NextResponse.json(
      { ok: false, error: "pcName은 필수입니다" },
      { status: 400 }
    );
  }

  // ── 첨부 파일 검증 (위 XLSX_MIME 주석 참조) ────────────────────────────────
  // 통과한 값만 아래에서 명시적으로 넘긴다. 클라이언트가 보낸 Content-Type 은 쓰지 않는다.
  let programsFileBase64: string | undefined;
  let programsFileName: string | undefined;
  let programsContentType: string | undefined;

  if (typeof body.programsFileBase64 === "string" && body.programsFileBase64.length > 0) {
    if (body.programsFileBase64.length > MAX_FILE_BASE64_BYTES) {
      return NextResponse.json(
        { ok: false, error: "programsFileBase64는 최대 5MB까지 허용됩니다" },
        { status: 400 }
      );
    }
    if (!isXlsxBase64(body.programsFileBase64)) {
      return NextResponse.json(
        { ok: false, error: "설치 프로그램 목록은 xlsx 파일만 허용됩니다" },
        { status: 400 }
      );
    }
    programsFileBase64  = body.programsFileBase64;
    programsFileName    = forceXlsxName(body.programsFileName);
    programsContentType = XLSX_MIME;
  }

  const isDualOrShared = typeof body.isDualOrShared === "boolean" ? body.isDualOrShared : false;
  const originalCorp = typeof body.originalCorp === "string" ? body.originalCorp.trim() : "";
  // 공용PC — 예전 버전 에이전트는 이 필드를 안 보낸다(그때는 false, 기존과 동일 동작).
  const isShared = typeof body.isShared === "boolean" ? body.isShared : false;
  const sharedName = typeof body.sharedName === "string" ? body.sharedName.trim() : "";

  try {
    const result = await upsertPcScan({
      ...body, serial, pcName, isDualOrShared, originalCorp, isShared, sharedName,
      // 검증을 통과한 값으로 덮어쓴다 — body 의 원본 값이 그대로 흘러가지 않게 한다.
      programsFileBase64, programsFileName, programsContentType,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[POST /api/pc-scan]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

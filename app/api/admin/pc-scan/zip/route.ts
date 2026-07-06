import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { fetchPcScans } from "@/lib/pc-scan";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";
// Vercel 함수 최대 실행 시간 (초) — 파일 수에 따라 넉넉하게
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let ids: string[] = [];
  try {
    const body = await req.json();
    ids = Array.isArray(body.ids) ? body.ids : [];
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 파싱 오류" }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "ids가 비어있습니다" }, { status: 400 });
  }

  try {
    // 최신 Notion 데이터(signed URL 포함) 재조회
    const all = await fetchPcScans();
    const targets = ids.length > 0
      ? all.filter(r => ids.includes(r.id))
      : all;

    const withFile = targets.filter(r => r.programFileUrl);
    if (withFile.length === 0) {
      return NextResponse.json({ ok: false, error: "첨부 파일이 있는 항목이 없습니다" }, { status: 404 });
    }

    const zip = new JSZip();

    // 병렬 다운로드 (S3 signed URL은 1시간 유효)
    await Promise.all(
      withFile.map(async r => {
        try {
          const res = await fetch(r.programFileUrl);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const fname = r.programFileName || `${r.assetNo || r.serial || r.id}.xlsx`;
          // 파일명 중복 방지: 앞에 자산번호 prefix
          const prefix = r.assetNo || r.serial || r.id;
          zip.file(`${prefix}_${fname}`, buf);
        } catch {
          // 개별 파일 실패 시 스킵
        }
      })
    );

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `설치프로그램_${date}.zip`;

    return new NextResponse(zipBuf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        // Content-Disposition 헤더는 ByteString만 허용되어 한글을 직접 넣으면 undici가 예외를 던짐 (RFC 5987 인코딩 필요)
        "Content-Disposition": `attachment; filename="install-programs_${date}.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(zipBuf.byteLength),
      },
    });
  } catch (e) {
    console.error("[POST /api/admin/pc-scan/zip]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

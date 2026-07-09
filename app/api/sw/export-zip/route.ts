import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { fetchSwDatabase } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";
// Vercel 함수 최대 실행 시간 (초) — 파일 수에 따라 넉넉하게
export const maxDuration = 300;

// 파일명에 쓸 수 없는 문자 치환
function sanitizeSegment(s: string): string {
  const cleaned = (s || "").trim().replace(/[\\/:*?"<>|]/g, "_");
  return cleaned || "미지정";
}

function extFromUrl(url: string): string {
  try {
    const match = new URL(url).pathname.match(/\.[a-zA-Z0-9]+$/);
    return match ? match[0] : "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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
  if (ids.length > 200) {
    return NextResponse.json({ ok: false, error: "한 번에 최대 200건까지 다운로드할 수 있습니다." }, { status: 400 });
  }

  try {
    // Notion file 속성 URL은 발급 후 1시간이면 만료되므로 매번 최신 데이터를 재조회한다.
    const scope = companyScope(session);
    const all = await fetchSwDatabase();
    const targets = all.filter(r => ids.includes(r.id) && (!scope || r.company === scope));
    const withFile = targets.filter(r => r.certificate || r.draftDocument);
    if (withFile.length === 0) {
      return NextResponse.json({ ok: false, error: "다운로드할 파일이 있는 항목이 없습니다." }, { status: 404 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    // 법인_SW대분류_소분류_버전_부서_이름_증서(or 기안문서) 형식으로 파일명 생성, 중복 시 번호 부여
    function claimName(base: string, label: string, ext: string): string {
      let name = `${base}_${label}${ext}`;
      let n = 2;
      while (usedNames.has(name)) { name = `${base}_${label}_${n}${ext}`; n++; }
      usedNames.add(name);
      return name;
    }

    // 병렬 다운로드 (Notion signed URL은 1시간 유효)
    await Promise.all(withFile.flatMap(r => {
      const base = [r.company, r.swCategory, r.swDetail, (r.version ?? []).join(","), r.department, r.user]
        .map(sanitizeSegment).join("_");
      const tasks: Promise<void>[] = [];
      if (r.certificate) {
        tasks.push((async () => {
          try {
            const res = await fetch(r.certificate);
            if (!res.ok) return;
            const buf = await res.arrayBuffer();
            zip.file(claimName(base, "증서", extFromUrl(r.certificate)), buf);
          } catch { /* 개별 파일 실패 시 스킵 */ }
        })());
      }
      if (r.draftDocument) {
        tasks.push((async () => {
          try {
            const res = await fetch(r.draftDocument);
            if (!res.ok) return;
            const buf = await res.arrayBuffer();
            zip.file(claimName(base, "기안문서", extFromUrl(r.draftDocument)), buf);
          } catch { /* 개별 파일 실패 시 스킵 */ }
        })());
      }
      return tasks;
    }));

    if (Object.keys(zip.files).length === 0) {
      return NextResponse.json({ ok: false, error: "파일 다운로드에 모두 실패했습니다." }, { status: 502 });
    }

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `SW증서_기안문서_${date}.zip`;

    return new NextResponse(zipBuf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        // Content-Disposition 헤더는 ByteString만 허용되어 한글을 직접 넣으면 undici가 예외를 던짐 (RFC 5987 인코딩 필요)
        "Content-Disposition": `attachment; filename="sw-license-docs_${date}.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(zipBuf.byteLength),
      },
    });
  } catch (e) {
    console.error("[POST /api/sw/export-zip]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

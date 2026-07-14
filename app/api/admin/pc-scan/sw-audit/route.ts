import { NextRequest, NextResponse } from "next/server";
import { parseInstalledPrograms } from "@/lib/pc-scan";
import { matchProgramsAgainstSwDb, aggregateUnknownPrograms, type SwAuditEntry } from "@/lib/sw-audit";
import { getSwItems } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const MAX_FILES = 50;

interface FileTarget { recordId: string; pcName: string; fileUrl: string }

export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { files } = await req.json() as { files: FileTarget[] };
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ ok: false, error: "검사할 파일이 없습니다." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_FILES}건까지 검사할 수 있습니다. 필터로 범위를 좁혀주세요.` }, { status: 400 });
    }

    const swItems = await getSwItems();

    const perPc: { recordId: string; pcName: string; entries: SwAuditEntry[] }[] = [];
    const failed: { recordId: string; pcName: string; error: string }[] = [];

    for (const f of files) {
      try {
        const programs = await parseInstalledPrograms(f.fileUrl);
        const entries = matchProgramsAgainstSwDb(programs, swItems);
        perPc.push({ recordId: f.recordId, pcName: f.pcName, entries });
      } catch (e) {
        failed.push({ recordId: f.recordId, pcName: f.pcName, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const unknownAggregate = aggregateUnknownPrograms(perPc.map(p => ({ pcName: p.pcName, entries: p.entries })));

    const perPcSummary = perPc.map(p => ({
      recordId: p.recordId,
      pcName: p.pcName,
      total: p.entries.length,
      whitelist: p.entries.filter(e => e.status === "whitelist").length,
      blacklist: p.entries.filter(e => e.status === "blacklist").length,
      unknown: p.entries.filter(e => e.status === "unknown").length,
    }));

    return NextResponse.json({
      ok: true,
      checked: perPc.length,
      failed,
      perPcSummary,
      unknownAggregate,
    });
  } catch (e) {
    console.error("[API /admin/pc-scan/sw-audit]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

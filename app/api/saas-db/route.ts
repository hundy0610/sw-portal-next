import { NextRequest, NextResponse } from "next/server";
import { getSaasItems, saveSaasItems, appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import type { SaasItem } from "@/types";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

async function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") return null;
  return session;
}

export async function GET() {
  try {
    const data = await getSaasItems();
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (error) {
    console.error("[API /saas-db]", error);
    return NextResponse.json({ data: [], error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const items = await getSaasItems();
  const adminName = await resolveCurrentName(session);

  // 일괄 등록 — SaaS 사용 현황 조회에서 감지된 미확인 도메인을 블랙리스트로 일괄 등록
  if (body._action === "bulkCreate") {
    const domains: string[] = (body.domains ?? []).filter((d: unknown) => typeof d === "string" && d.trim());
    if (domains.length === 0) {
      return NextResponse.json({ error: "등록할 도메인이 없습니다." }, { status: 400 });
    }
    const status: SaasItem["status"] = body.status === "conditional" ? "conditional" : "banned";
    const newItems: SaasItem[] = domains.map((domain, i) => ({
      id: `saas_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      domain: domain.trim(),
      name: domain.trim(),
      vendor: "",
      category: "",
      status,
      alternatives: [],
      description: "SaaS 사용 현황에서 미확인 도메인으로 감지되어 일괄 등록됨",
    }));
    if (!(await saveSaasItems([...items, ...newItems]))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "SAASDB_SAVE_FAILED" }, { status: 500 });
    }
    await appendAuditLog({
      adminId: session.userId, adminName, action: "create", target: "saasdb",
      itemTitle: `${newItems.length}건 일괄등록`, detail: domains.join(", "), timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, created: newItems.length });
  }

  // 확장 목록 일괄 가져오기 — 큐레이션 시드 데이터
  if (body._action === "bulkImport") {
    const incoming: Partial<SaasItem>[] = Array.isArray(body.items) ? body.items : [];
    const existingDomains = new Set(items.map(i => i.domain.toLowerCase()));
    const toAdd: SaasItem[] = [];
    let skipped = 0;
    incoming.forEach((raw, i) => {
      const domain = typeof raw.domain === "string" ? raw.domain.trim() : "";
      if (!domain) return;
      if (existingDomains.has(domain.toLowerCase())) { skipped++; return; }
      existingDomains.add(domain.toLowerCase());
      toAdd.push({
        id: `saas_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        domain,
        name: raw.name || domain,
        vendor: raw.vendor || "",
        category: raw.category || "",
        status: raw.status ?? "conditional",
        alternatives: raw.alternatives ?? [],
        description: raw.description || "",
        officialUrl: raw.officialUrl || undefined,
      });
    });
    if (toAdd.length === 0) {
      return NextResponse.json({ ok: true, created: 0, skipped });
    }
    if (!(await saveSaasItems([...items, ...toAdd]))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "SAASDB_SAVE_FAILED" }, { status: 500 });
    }
    await appendAuditLog({
      adminId: session.userId, adminName, action: "create", target: "saasdb",
      itemTitle: `확장 목록 일괄 가져오기 (${toAdd.length}건, 중복 제외 ${skipped}건)`, timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, created: toAdd.length, skipped });
  }

  // 삭제
  if (body._action === "delete") {
    const target = items.find(i => i.id === body.id);
    const updated = items.filter(i => i.id !== body.id);
    if (!(await saveSaasItems(updated))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "SAASDB_SAVE_FAILED" }, { status: 500 });
    }
    await appendAuditLog({ adminId: session.userId, adminName, action: "delete", target: "saasdb", itemTitle: target?.name ?? body.id, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }

  // 수정
  if (body._action === "update") {
    const updated = items.map(i => i.id === body.id ? { ...i, ...body.data } : i);
    if (!(await saveSaasItems(updated))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "SAASDB_SAVE_FAILED" }, { status: 500 });
    }
    const target = items.find(i => i.id === body.id);
    const STATUS_LABEL: Record<string, string> = { approved: "승인", banned: "금지", conditional: "조건부", excluded: "예외" };
    const detail = summarizeChanges(target, body.data, [
      { key: "status", label: "상태", format: v => STATUS_LABEL[String(v)] ?? String(v) },
      { key: "domain", label: "도메인" },
      { key: "name",   label: "이름" },
    ]);
    await appendAuditLog({ adminId: session.userId, adminName, action: "update", target: "saasdb", itemTitle: target?.name ?? body.id, detail, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }

  // 등록
  const newItem: SaasItem = {
    id:           `saas_${Date.now()}`,
    domain:       body.domain       ?? "",
    name:         body.name         ?? "",
    vendor:       body.vendor       ?? "",
    category:     body.category     ?? "",
    status:       body.status       ?? "conditional",
    alternatives: body.alternatives ?? [],
    description:  body.description  ?? "",
    officialUrl:  body.officialUrl  || undefined,
  };
  if (!newItem.domain.trim()) {
    return NextResponse.json({ ok: false, error: "도메인은 필수입니다." }, { status: 400 });
  }
  if (!(await saveSaasItems([...items, newItem]))) {
    return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "SAASDB_SAVE_FAILED" }, { status: 500 });
  }
  await appendAuditLog({ adminId: session.userId, adminName, action: "create", target: "saasdb", itemTitle: newItem.name, timestamp: new Date().toISOString() });
  return NextResponse.json({ ok: true, id: newItem.id });
}

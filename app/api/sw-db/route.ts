import { NextRequest, NextResponse } from "next/server";
import { getSwItems, saveSwItems, appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import type { SwItem } from "@/types";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

async function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") return null;
  return session;
}

export async function GET() {
  try {
    const data = await getSwItems();
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (error) {
    console.error("[API /sw-db]", error);
    return NextResponse.json({ data: [], error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const items = await getSwItems();
  const adminName = await resolveCurrentName(session);

  // 일괄 등록 — 온라인 자산실사에서 감지된 미확인 SW를 블랙리스트로 일괄 등록
  if (body._action === "bulkCreate") {
    const names: string[] = (body.names ?? []).filter((n: unknown) => typeof n === "string" && n.trim());
    if (names.length === 0) {
      return NextResponse.json({ error: "등록할 SW명이 없습니다." }, { status: 400 });
    }
    const status: SwItem["status"] = body.status === "conditional" ? "conditional" : "banned";
    const newItems: SwItem[] = names.map((name, i) => ({
      id: `sw_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      vendor: "",
      category: "",
      status,
      alternatives: [],
      mandatory: false,
      description: "온라인 자산실사에서 미확인 SW로 감지되어 일괄 등록됨",
    }));
    await saveSwItems([...items, ...newItems]);
    await appendAuditLog({
      adminId: session.userId, adminName, action: "create", target: "swdb",
      itemTitle: `${newItems.length}건 일괄등록`, detail: names.join(", "), timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, created: newItems.length });
  }

  // 삭제
  if (body._action === "delete") {
    const target = items.find(i => i.id === body.id);
    const updated = items.filter(i => i.id !== body.id);
    await saveSwItems(updated);
    await appendAuditLog({ adminId: session.userId, adminName, action: "delete", target: "swdb", itemTitle: target?.name ?? body.id, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }

  // 수정
  if (body._action === "update") {
    const updated = items.map(i => i.id === body.id ? { ...i, ...body.data } : i);
    await saveSwItems(updated);
    const target = items.find(i => i.id === body.id);
    const STATUS_LABEL: Record<string, string> = { approved: "승인", banned: "금지", conditional: "조건부" };
    const detail = summarizeChanges(target, body.data, [
      { key: "status",    label: "상태", format: v => STATUS_LABEL[String(v)] ?? String(v) },
      { key: "mandatory", label: "필수 설치", format: v => (v ? "필수" : "선택") },
      { key: "name",      label: "이름" },
    ]);
    await appendAuditLog({ adminId: session.userId, adminName, action: "update", target: "swdb", itemTitle: target?.name ?? body.id, detail, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }

  // 등록
  const newItem: SwItem = {
    id:           `sw_${Date.now()}`,
    name:         body.name         ?? "",
    vendor:       body.vendor       ?? "",
    category:     body.category     ?? "",
    status:       body.status       ?? "conditional",
    alternatives: body.alternatives ?? [],
    mandatory:    body.mandatory    ?? false,
    description:  body.description  ?? "",
    officialUrl:  body.officialUrl  || undefined,
  };
  await saveSwItems([...items, newItem]);
  await appendAuditLog({ adminId: session.userId, adminName, action: "create", target: "swdb", itemTitle: newItem.name, timestamp: new Date().toISOString() });
  return NextResponse.json({ ok: true, id: newItem.id });
}

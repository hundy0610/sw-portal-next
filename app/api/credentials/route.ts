import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

// ── KV 키 ──────────────────────────────────────────────────
const KV_KEY = "sw:credentials";

export interface SwCredential {
  id: string;
  swName: string;
  siteUrl: string;
  accountId: string;
  password: string;
  memo: string;
}

// ── KV 읽기 (KV 미설정 시 빈 배열 반환) ──────────────────
async function readAll(): Promise<SwCredential[]> {
  if (!process.env.KV_REST_API_URL) return [];
  try {
    const data = await kv.get<SwCredential[]>(KV_KEY);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── KV 쓰기 ────────────────────────────────────────────────
async function writeAll(data: SwCredential[]): Promise<void> {
  if (!process.env.KV_REST_API_URL) {
    throw new Error("KV_REST_API_URL 환경변수가 설정되지 않았습니다.");
  }
  await kv.set(KV_KEY, data); // TTL 없음 — 영구 보존
}

// ── GET: 계정 목록 조회 ───────────────────────────────────
export async function GET() {
  try {
    const data = await readAll();
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}

// ── POST: 새 계정 추가 ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { swName, siteUrl = "", accountId, password = "", memo = "" } = body;

    if (!swName || !accountId) {
      return NextResponse.json({ error: "SW명과 아이디는 필수입니다." }, { status: 400 });
    }

    const all = await readAll();
    const newEntry: SwCredential = {
      id:        randomUUID(),
      swName:    String(swName).trim(),
      siteUrl:   String(siteUrl).trim(),
      accountId: String(accountId).trim(),
      password:  String(password).trim(),
      memo:      String(memo).trim(),
    };

    await writeAll([...all, newEntry]);
    return NextResponse.json({ ok: true, data: newEntry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: 계정 수정 ────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, swName, siteUrl, accountId, password, memo } = body;
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const all = await readAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "해당 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    all[idx] = {
      ...all[idx],
      ...(swName    !== undefined && { swName:    String(swName).trim() }),
      ...(siteUrl   !== undefined && { siteUrl:   String(siteUrl).trim() }),
      ...(accountId !== undefined && { accountId: String(accountId).trim() }),
      ...(password  !== undefined && { password:  String(password).trim() }),
      ...(memo      !== undefined && { memo:      String(memo).trim() }),
    };

    await writeAll(all);
    return NextResponse.json({ ok: true, data: all[idx] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: 계정 삭제 ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const all = await readAll();
    const updated = all.filter(c => c.id !== id);

    if (updated.length === all.length) {
      return NextResponse.json({ error: "해당 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    await writeAll(updated);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

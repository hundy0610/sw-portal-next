import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// ── 환경 변수 ───────────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_REPO  = process.env.GITHUB_REPO  ?? "hundy0610/sw-portal-next";
const FILE_PATH    = "data/credentials.json";
const BRANCH       = "main";

// GitHub raw URL (항상 최신 파일)
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}/${FILE_PATH}`;
// GitHub Contents API URL
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;

// ── 간단 캐시 (60초) ───────────────────────────────────────
let cache: { data: unknown; ts: number } | null = null;
const TTL = (Number(process.env.CACHE_TTL) || 60) * 1000;

// ── GitHub에서 현재 파일 메타(SHA) + 내용 읽기 ──────────────
async function fetchFromGitHub(): Promise<{ data: unknown[]; sha: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `token ${GITHUB_TOKEN}`;

  const res = await fetch(API_URL + `?ref=${BRANCH}&t=${Date.now()}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const meta = await res.json();
  const content = Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return { data: JSON.parse(content), sha: meta.sha };
}

// ── GitHub에 파일 커밋 ────────────────────────────────────
async function commitToGitHub(data: unknown[], sha: string, message: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `token ${GITHUB_TOKEN}`;

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const res = await fetch(API_URL, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content, sha, branch: BRANCH }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub commit failed: ${res.status}`);
  }
  return res.json();
}

// ── GET: 계정 목록 조회 ───────────────────────────────────
export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.ts < TTL) {
      return NextResponse.json({ data: cache.data, cached: true });
    }
    const { data } = await fetchFromGitHub();
    cache = { data, ts: now };
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
    const { swName, siteUrl = "", accountId, password, memo = "" } = body;

    if (!swName || !accountId) {
      return NextResponse.json({ error: "SW명과 아이디는 필수입니다." }, { status: 400 });
    }

    const { data, sha } = await fetchFromGitHub();
    const arr = Array.isArray(data) ? data : [];
    const newEntry = {
      id: randomUUID(),
      swName: String(swName).trim(),
      siteUrl: String(siteUrl).trim(),
      accountId: String(accountId).trim(),
      password: String(password ?? "").trim(),
      memo: String(memo).trim(),
    };
    const updated = [...arr, newEntry];

    await commitToGitHub(updated, sha, `feat: add credential entry for ${newEntry.swName}`);

    // 캐시 무효화
    cache = null;

    return NextResponse.json({ ok: true, data: newEntry });
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

    const { data, sha } = await fetchFromGitHub();
    const arr = Array.isArray(data) ? (data as { id: string }[]) : [];
    const updated = arr.filter((c) => c.id !== id);

    if (updated.length === arr.length) {
      return NextResponse.json({ error: "해당 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    await commitToGitHub(updated, sha, `feat: remove credential entry ${id}`);
    cache = null;

    return NextResponse.json({ ok: true });
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

    const { data, sha } = await fetchFromGitHub();
    const arr = Array.isArray(data) ? (data as Record<string, string>[]) : [];
    const idx = arr.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "해당 항목을 찾을 수 없습니다." }, { status: 404 });
    }
    arr[idx] = {
      ...arr[idx],
      ...(swName    !== undefined && { swName:    String(swName).trim() }),
      ...(siteUrl   !== undefined && { siteUrl:   String(siteUrl).trim() }),
      ...(accountId !== undefined && { accountId: String(accountId).trim() }),
      ...(password  !== undefined && { password:  String(password).trim() }),
      ...(memo      !== undefined && { memo:      String(memo).trim() }),
    };

    await commitToGitHub(arr, sha, `feat: update credential entry for ${arr[idx].swName}`);
    cache = null;

    return NextResponse.json({ ok: true, data: arr[idx] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

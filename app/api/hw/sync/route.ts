import { NextResponse } from "next/server";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/hw/sync
 * GitHub Actions warm-hw.yml 워크플로우를 즉시 디스패치.
 * Notion 직접 수정 후 포털에서 수동 동기화할 때 사용.
 */
export async function POST() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo  = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return NextResponse.json(
      { ok: false, error: "GITHUB_DISPATCH_TOKEN 또는 GITHUB_REPO 미설정" },
      { status: 503 }
    );
  }

  try {
    // 디바운스 우회: 직접 디스패치 (수동 트리거이므로 항상 실행)
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/warm-hw.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "master" }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: `GitHub API ${res.status}: ${text}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Notion 동기화 시작됨 (약 1~2분 소요)" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

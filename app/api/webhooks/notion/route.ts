import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvGet, kvSet } from "@/lib/kv-store";

// Notion 자동화(Automation) 웹훅 핸들러
// 설정: Notion DB → Automation → "상태가 완료로 변경될 때" → Webhook POST 전송
//
// 환경변수:
//   NOTION_WEBHOOK_SECRET  : 웹훅 검증용 시크릿 (선택, 빈 값이면 검증 생략)
//   NEXT_PUBLIC_APP_URL    : 앱 도메인 (피드백 URL 생성용)

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PROCESSED_KEY = (id: string) => `webhook_processed:${id}`;
const SENT_KEY      = (id: string) => `feedback_email_sent:${id}`;

export async function POST(req: NextRequest) {
  try {
    // 시크릿 검증 (설정된 경우)
    const secret = process.env.NOTION_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get("x-notion-signature") || req.headers.get("x-hub-signature-256");
      if (!sig?.includes(secret)) {
        return NextResponse.json({ error: "인증 실패" }, { status: 401 });
      }
    }

    const body = await req.json();

    // Notion Automation 웹훅 페이로드: { entity: { id: "page-id" }, ... }
    const pageId: string | undefined =
      body?.entity?.id ||
      body?.data?.entity?.id ||
      body?.page_id ||
      body?.id;

    if (!pageId) {
      console.warn("[webhook/notion] pageId 없음:", JSON.stringify(body).slice(0, 200));
      return NextResponse.json({ ok: true, skipped: "no pageId" });
    }

    // 중복 처리 방지 (5분 TTL)
    const processed = await kvGet<boolean>(PROCESSED_KEY(pageId));
    if (processed) return NextResponse.json({ ok: true, skipped: "already processed" });
    await kvSet(PROCESSED_KEY(pageId), true, 300);

    // 페이지 상세 조회
    const page = await notion.pages.retrieve({ page_id: pageId }) as any;
    const props = page.properties;

    // 상태 확인
    const status =
      props["상태"]?.select?.name ||
      props["상태"]?.status?.name ||
      props["Status"]?.select?.name ||
      props["Status"]?.status?.name || "";

    if (status !== "완료") {
      return NextResponse.json({ ok: true, skipped: `status is '${status}'` });
    }

    // 이미 발송됐는지 확인
    const alreadySent = await kvGet<boolean>(SENT_KEY(pageId));
    if (alreadySent) return NextResponse.json({ ok: true, skipped: "email already sent" });

    // 필요 데이터 추출
    const getEmail = (p: any) =>
      p?.["문의자 이메일"]?.email || p?.["문의자 이메일"]?.rich_text?.[0]?.plain_text ||
      p?.["이메일"]?.email       || p?.["이메일"]?.rich_text?.[0]?.plain_text ||
      p?.["Email"]?.email        || p?.["Email"]?.rich_text?.[0]?.plain_text || "";
    const getText = (p: any, key: string) =>
      p?.[key]?.rich_text?.[0]?.plain_text || p?.[key]?.title?.[0]?.plain_text || "";
    const getPeople = (p: any, key: string) =>
      p?.[key]?.people?.[0]?.name || "";

    const requesterEmail = getEmail(props);
    if (!requesterEmail) {
      console.warn("[webhook/notion] 이메일 없음 - pageId:", pageId);
      return NextResponse.json({ ok: true, skipped: "no requester email" });
    }

    const requesterName  = getText(props, "문의자") || getText(props, "Requester") || "고객";
    const ticketContent  = getText(props, "문의내용") || getText(props, "Description") || getText(props, "제목") || "";
    const assignee       = getPeople(props, "담당자") || getPeople(props, "Assignee") || "담당자";

    // 이메일 발송 API 호출
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://assetify-desk-main.vercel.app";
    const emailRes = await fetch(`${origin}/api/helpdesk/send-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: pageId, requesterEmail, requesterName, ticketContent, assignee }),
    });

    const emailJson = await emailRes.json();
    console.log("[webhook/notion] email result:", emailJson);

    // 헬프데스크 캐시 무효화 (다음 조회 시 최신 데이터 반영)
    const { kvDel } = await import("@/lib/kv-store");
    await kvDel("helpdesk:tickets");

    return NextResponse.json({ ok: true, emailSent: emailRes.ok });
  } catch (e) {
    console.error("[webhook/notion]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// Notion 웹훅 연결 확인용 (일부 서비스는 GET으로 헬스체크)
export async function GET() {
  return NextResponse.json({ ok: true, service: "notion-webhook-handler" });
}

import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import type { SwDbRecord } from "@/types";

// 알림 수신자 목록 – 환경변수 ALERT_EMAILS (쉼표로 구분)
// ex) ALERT_EMAILS=hong@ids.com,kim@ids.com
function getAlertEmails(): string[] {
  const raw = process.env.ALERT_EMAILS ?? "";
  return raw.split(",").map(e => e.trim()).filter(Boolean);
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export interface ExpiringRecord {
  id: string;
  swName: string;
  department: string;
  company: string;
  licenseType: string;
  status: string;
  renewalDate: string;
  daysLeft: number;
  vendor: string;
  user: string;
}

// ── GET: 30일 내 만료 예정 목록 반환 ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? "30");

    const all: SwDbRecord[] = await fetchSwDatabase();

    const expiring: ExpiringRecord[] = all
      .filter(r => {
        if (!r.renewalDate) return false;
        const d = daysUntil(r.renewalDate);
        return d >= 0 && d <= days;
      })
      .map(r => ({
        id:          r.id,
        swName:      r.swCategory || "기타",
        department:  r.department || "미지정",
        company:     r.company    || "미지정",
        licenseType: r.licenseType|| "—",
        status:      r.status     || "—",
        renewalDate: r.renewalDate,
        daysLeft:    daysUntil(r.renewalDate),
        vendor:      r.vendor     || "—",
        user:        r.user       || "—",
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    return NextResponse.json({
      data: expiring,
      count: expiring.length,
      alertEmails: getAlertEmails(),
      lastSynced: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── POST: 이메일 알림 발송 (Resend REST API) ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { records, customEmails }: { records: ExpiringRecord[]; customEmails?: string[] } = body;

    const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY 환경변수가 설정되지 않았습니다." }, { status: 400 });
    }

    const recipients = customEmails?.length ? customEmails : getAlertEmails();
    if (!recipients.length) {
      return NextResponse.json({ error: "수신자 이메일이 없습니다. ALERT_EMAILS 환경변수를 설정해 주세요." }, { status: 400 });
    }

    // 이메일 HTML 생성
    const tableRows = records.map(r => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;font-size:13px">${r.swName}</td>
        <td style="padding:8px 12px;font-size:13px">${r.company}</td>
        <td style="padding:8px 12px;font-size:13px">${r.department}</td>
        <td style="padding:8px 12px;font-size:13px">${r.user}</td>
        <td style="padding:8px 12px;font-size:13px;color:${r.daysLeft <= 7 ? "#ef4444" : r.daysLeft <= 14 ? "#f97316" : "#374151"};font-weight:600">
          D-${r.daysLeft} (${r.renewalDate})
        </td>
        <td style="padding:8px 12px;font-size:13px">${r.licenseType}</td>
      </tr>
    `).join("");

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1e40af;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">🔔 SW 라이선스 만료 예정 알림</h1>
      <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px">갱신 필요일이 <strong>${records.length > 0 ? Math.max(...records.map(r=>r.daysLeft)) : 30}일</strong> 이내인 라이선스 목록입니다.</p>
    </div>
    <div style="padding:24px 32px">
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e">
        ⚠️ 아래 <strong>${records.length}건</strong>의 라이선스가 곧 만료됩니다. 갱신 여부를 확인하고 필요 시 담당자에게 안내해 주세요.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">SW명</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">법인</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">부서</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">사용자</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">만료 예정</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">유형</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">
        이 메일은 IDS IT 자산관리 포털에서 자동 발송되었습니다.<br>
        발송 시각: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
      </p>
    </div>
  </div>
</body>
</html>`;

    // Resend REST API 호출
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IDS IT자산관리 <onboarding@resend.dev>",
        to: recipients,
        subject: `[IDS] SW 라이선스 만료 예정 알림 - ${records.length}건 (${new Date().toLocaleDateString("ko-KR")})`,
        html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      return NextResponse.json({ error: `Resend 발송 실패: ${resendData.message ?? JSON.stringify(resendData)}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sentTo: recipients,
      count: records.length,
      resendId: resendData.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

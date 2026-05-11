import nodemailer from "nodemailer";

export function buildHelpdeskNewInquiryEmail(opts: {
  requester: string;
  company: string;
  department: string;
  inquiryType: string;
  urgency: string;
  content: string;
  assetNo: string;
  adminUrl: string;
}): string {
  const { requester, company, department, inquiryType, urgency, content, assetNo, adminUrl } = opts;
  const urgencyEmoji = urgency === "매우 급합니다" ? "🔴" : urgency === "조금 급합니다" ? "🟡" : "🟢";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#0EA5E9;padding:28px 32px;">
    <div style="color:white;font-size:18px;font-weight:800;">IDS 자산관리파트 Help Desk</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">신규 문의가 접수되었습니다</div>
  </div>
  <div style="padding:28px 32px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;width:90px;">접수자</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${requester}</td>
      </tr>
      ${company ? `<tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">법인</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${company}</td>
      </tr>` : ""}
      ${department ? `<tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">부서</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${department}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">유형</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${inquiryType}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">긴급도</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${urgencyEmoji} ${urgency}</td>
      </tr>
      ${assetNo ? `<tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">자산번호</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${assetNo}</td>
      </tr>` : ""}
    </table>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:11px;color:#94A3B8;margin-bottom:6px;font-weight:600;letter-spacing:0.5px;">문의 내용</div>
      <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;white-space:pre-wrap;">${content}</p>
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${adminUrl}" target="_blank"
        style="display:inline-block;background:#0EA5E9;color:white;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        어드민 패널에서 확인하기
      </a>
    </div>
    <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">본 메일은 발신 전용입니다.</p>
  </div>
  <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;text-align:center;">
    <p style="font-size:11px;color:#CBD5E1;margin:0;">IDS 자산관리파트 · PC/OA 관리팀</p>
  </div>
</div>
</body>
</html>`;
}

export function buildRepairNewInquiryEmail(opts: {
  assetId: string;
  company: string;
  department: string;
  requester: string;
  workLocation: string;
  faultDesc: string;
  faultTypes: string;
  adminUrl: string;
}): string {
  const { assetId, company, department, requester, workLocation, faultDesc, faultTypes, adminUrl } = opts;
  const row = (label: string, value: string) =>
    value ? `<tr>
      <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;width:90px;">${label}</td>
      <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${value}</td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#DC2626;padding:28px 32px;">
    <div style="color:white;font-size:18px;font-weight:800;">IDS 자산관리파트 수리 접수</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">신규 수리 접수가 등록되었습니다</div>
  </div>
  <div style="padding:28px 32px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      ${row("자산번호", assetId)}
      ${row("법인", company)}
      ${row("부서", department)}
      ${row("문의자", requester)}
      ${row("근무 위치", workLocation)}
      ${row("고장 내역", faultTypes)}
    </table>
    ${faultDesc ? `<div style="background:#FFF7F7;border:1px solid #FECACA;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:11px;color:#94A3B8;margin-bottom:6px;font-weight:600;letter-spacing:0.5px;">고장 증상</div>
      <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;white-space:pre-wrap;">${faultDesc}</p>
    </div>` : ""}
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${adminUrl}" target="_blank"
        style="display:inline-block;background:#DC2626;color:white;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        어드민 패널에서 확인하기
      </a>
    </div>
    <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">본 메일은 발신 전용입니다.</p>
  </div>
  <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;text-align:center;">
    <p style="font-size:11px;color:#CBD5E1;margin:0;">IDS 자산관리파트 · PC/OA 관리팀</p>
  </div>
</div>
</body>
</html>`;
}

export function createMailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

export function buildWelcomeEmail(opts: {
  name: string;
  userId: string;
  tempPassword: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#7C3AED;padding:24px 32px;">
    <div style="color:white;font-size:17px;font-weight:800;">SW 자산관리 포털</div>
    <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">계정이 생성되었습니다</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#374151;margin:0 0 6px;">안녕하세요, <strong>${opts.name}</strong>님.</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      SW 자산관리 포털 계정이 생성되었습니다.<br>
      아래 임시 비밀번호로 로그인 후 반드시 비밀번호를 변경해주세요.
    </p>
    <div style="background:#F5F3FF;border:2px solid #7C3AED;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;width:90px;">아이디</td>
          <td style="font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${opts.userId}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:8px 0 4px;vertical-align:top;">임시 비밀번호</td>
          <td style="font-size:24px;font-weight:900;letter-spacing:4px;color:#7C3AED;font-family:monospace;padding-top:4px;">${opts.tempPassword}</td>
        </tr>
      </table>
    </div>
    <p style="font-size:12px;color:#EF4444;margin:0 0 20px;">
      ⚠️ 로그인 후 즉시 비밀번호를 변경해주세요. 임시 비밀번호를 그대로 사용하지 마세요.
    </p>
    <p style="font-size:11px;color:#94A3B8;margin:0;">본 메일을 요청하지 않으셨다면 관리자에게 문의하세요.</p>
  </div>
</div>
</body>
</html>`;
}

export function buildMonitorRepairEmail(opts: {
  building: string;
  floor: string;
  zone: string;
  seatId: string;
  requestType: "repair" | "replace";
  requestedBy: string;
  note?: string;
  appUrl: string;
}): string {
  const typeLabel = opts.requestType === "repair" ? "수리" : "교체";
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:520px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#059669;padding:24px 32px;">
    <div style="color:white;font-size:17px;font-weight:800;">🖥️ 모니터 ${typeLabel} 요청</div>
    <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">스마트오피스 자산관리</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      아래 위치의 모니터 <strong>${typeLabel} 요청</strong>이 접수되었습니다. 확인 후 조치해주세요.
    </p>
    <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:18px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;width:80px;">건물</td>
          <td style="font-size:14px;font-weight:700;color:#111827;">${opts.building}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">층</td>
          <td style="font-size:14px;font-weight:700;color:#111827;">${opts.floor}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">구역</td>
          <td style="font-size:14px;font-weight:700;color:#111827;">${opts.zone}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">모니터 ID</td>
          <td style="font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${opts.seatId}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">요청 유형</td>
          <td style="font-size:14px;font-weight:700;color:#059669;">${typeLabel}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">요청자</td>
          <td style="font-size:14px;color:#374151;">${opts.requestedBy}</td>
        </tr>
        ${opts.note ? `
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">비고</td>
          <td style="font-size:13px;color:#374151;">${opts.note}</td>
        </tr>` : ""}
      </table>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${opts.appUrl}/admin" target="_blank"
        style="display:inline-block;background:#059669;color:white;font-size:13px;font-weight:700;padding:11px 28px;border-radius:10px;text-decoration:none;">
        관리자 페이지에서 처리하기
      </a>
    </div>
    <p style="font-size:11px;color:#94A3B8;text-align:center;margin:0;">본 메일은 발신 전용입니다.</p>
  </div>
</div>
</body>
</html>`;
}

export function buildMonitorCompleteEmail(opts: {
  building: string;
  floor: string;
  zone: string;
  seatId: string;
  requestType: "repair" | "replace";
  completedBy: string;
  appUrl: string;
}): string {
  const typeLabel = opts.requestType === "repair" ? "수리" : "교체";
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:520px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#7C3AED;padding:24px 32px;">
    <div style="color:white;font-size:17px;font-weight:800;">✅ 모니터 ${typeLabel} 완료</div>
    <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">스마트오피스 자산관리</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      모니터 ${typeLabel} 요청이 <strong>${opts.completedBy}</strong>에 의해 처리 완료되었습니다.
    </p>
    <div style="background:#F5F3FF;border:1px solid #C4B5FD;border-radius:12px;padding:18px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;width:80px;">건물</td>
          <td style="font-size:14px;font-weight:700;color:#111827;">${opts.building}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">층</td>
          <td style="font-size:14px;font-weight:700;color:#111827;">${opts.floor}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">구역</td>
          <td style="font-size:14px;font-weight:700;color:#111827;">${opts.zone}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">모니터 ID</td>
          <td style="font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${opts.seatId}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6B7280;padding:4px 0;">처리자</td>
          <td style="font-size:14px;color:#374151;">${opts.completedBy}</td>
        </tr>
      </table>
    </div>
    <p style="font-size:11px;color:#94A3B8;text-align:center;margin:0;">본 메일은 발신 전용입니다.</p>
  </div>
</div>
</body>
</html>`;
}

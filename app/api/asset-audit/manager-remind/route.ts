import { NextRequest, NextResponse } from "next/server";
import { verifyManagerToken } from "@/lib/asset-audit-token";
import { fetchOrgUnits, buildOrgTree, findSubtree, collectUnitIds } from "@/lib/org-chart";
import { fetchAllHwRecords } from "@/lib/hw";
import { createMailTransporter } from "@/lib/mail";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function buildReminderEmail(name: string, assetNos: string[]): string {
  const list = assetNos.map(a => `<li style="padding:2px 0;">${a}</li>`).join("");
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#D97706;padding:24px 32px;">
    <div style="color:white;font-size:16px;font-weight:800;">자산 실사 참여 안내 (미완료)</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#1E293B;margin:0 0 6px;">안녕하세요, <strong>${name}</strong>님.</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.7;">
      아래 자산에 대한 자산 실사가 아직 확인되지 않았습니다.<br>
      안내된 실사 프로그램을 실행하여 참여를 완료해주세요.
    </p>
    <ul style="font-size:13px;color:#334155;background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;padding:14px 16px 14px 32px;margin:0 0 20px;">
      ${list}
    </ul>
    <p style="font-size:12px;color:#94A3B8;margin:0;">이미 참여를 완료하셨다면 본 메일은 무시하셔도 됩니다.</p>
  </div>
</div>
</body>
</html>`;
}

// POST /api/asset-audit/manager-remind — 관할 조직 내 미완료 대상자에게 독려 메일 발송
// Body: { token }
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const payload = token ? verifyManagerToken(token) : null;
    if (!payload) {
      return NextResponse.json({ ok: false, error: "인증이 만료되었습니다. 다시 로그인해주세요." }, { status: 401 });
    }

    const [units, hwRecords] = await Promise.all([fetchOrgUnits(), fetchAllHwRecords()]);
    const tree = buildOrgTree(units, hwRecords);
    const subtree = findSubtree(tree, payload.unitId);
    if (!subtree) {
      return NextResponse.json({ ok: false, error: "조직 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const scopeIds = new Set(collectUnitIds(subtree));
    const scopedDepts = new Set(units.filter(u => scopeIds.has(u.id)).flatMap(u => u.deptMapping));
    const unverified = hwRecords.filter(r => scopedDepts.has(r.dept) && !r.verified && r.email);

    const byEmail = new Map<string, { name: string; assets: string[] }>();
    for (const r of unverified) {
      const entry = byEmail.get(r.email) ?? { name: r.user || r.email, assets: [] };
      entry.assets.push(r.assetNo || r.model);
      byEmail.set(r.email, entry);
    }

    const transporter = createMailTransporter();
    let sent = 0;
    if (transporter) {
      for (const [emailAddr, info] of byEmail) {
        await transporter.sendMail({
          from:    `"SW 포털" <${process.env.GMAIL_USER}>`,
          to:      emailAddr,
          subject: "[SW 포털] 자산 실사 참여 안내 (미완료)",
          html:    buildReminderEmail(info.name, info.assets),
        });
        sent++;
      }
    }

    return NextResponse.json({ ok: true, targetCount: byEmail.size, sent });
  } catch (e) {
    console.error("[manager-remind POST]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

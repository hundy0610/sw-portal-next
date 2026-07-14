import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvDel } from "@/lib/kv-store";
import { fetchOrgUnits } from "@/lib/org-chart";
import { issueManagerToken } from "@/lib/asset-audit-token";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const OTP_KEY = (email: string) => `asset-audit:manager-otp:${email.toLowerCase()}`;

// POST /api/asset-audit/manager-verify — 인증코드 검증 후 조회용 토큰 발급
// Body: { email, code }
export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ ok: false, error: "이메일과 인증코드를 입력해주세요." }, { status: 400 });
    }

    const stored = await kvGet<{ code: string }>(OTP_KEY(email));
    if (!stored || stored.code !== code) {
      return NextResponse.json({ ok: false, error: "인증코드가 올바르지 않거나 만료되었습니다." }, { status: 400 });
    }

    const units = await fetchOrgUnits();
    const unit = units.find(u => u.managerEmail.toLowerCase() === String(email).toLowerCase());
    if (!unit) {
      return NextResponse.json({ ok: false, error: "담당 조직 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    await kvDel(OTP_KEY(email));
    const token = issueManagerToken(unit.id, unit.managerEmail, unit.managerName);

    return NextResponse.json({ ok: true, token, unitId: unit.id, unitName: unit.name });
  } catch (e) {
    console.error("[manager-verify POST]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

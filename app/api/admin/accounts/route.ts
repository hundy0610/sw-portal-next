import { NextResponse, type NextRequest } from "next/server";
import { decodeSession } from "@/lib/session";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { hashPassword } from "@/lib/crypto";
import { createMailTransporter, buildWelcomeEmail } from "@/lib/mail";
import crypto from "crypto";

// 임시 비밀번호 생성 (혼동하기 쉬운 문자 제외)
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[crypto.randomInt(chars.length)]).join("");
}

const ACCOUNTS_KEY    = "sw:accounts";
const GM_KEY          = "sw:general-managers";
const GM_DETAILS_KEY  = "sw:gm-details";

export interface Account {
  id: string;
  name: string;
  userId: string;
  password: string;        // PBKDF2 해시 (빈 문자열 = 미설정)
  email: string;
  department: string;
  company: string;
  role: "super" | "company" | "general";
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface GmDetail {
  userId: string;
  email: string;
  name: string;
}

function requireSuper(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return false;
  const session = decodeSession(token);
  return session?.role === "super";
}

async function getAccounts(): Promise<Account[]> {
  try {
    if (!process.env.REDIS_URL) return [];
    return (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  if (!process.env.REDIS_URL) return;
  await kvSetPermanent(ACCOUNTS_KEY, accounts);
}

async function syncGmLists(accounts: Account[]) {
  const generals = accounts.filter(a => a.role === "general" && a.active);
  const gmUserIds = generals.map(a => a.userId);
  const gmDetails: GmDetail[] = generals.map(a => ({
    userId: a.userId,
    email:  a.email,
    name:   a.name,
  }));
  await Promise.all([
    kvSetPermanent(GM_KEY, gmUserIds),
    kvSetPermanent(GM_DETAILS_KEY, gmDetails),
  ]);
}

// ── GET — 계정 목록 (슈퍼어드민만) ──────────────────────────
export async function GET(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  if (!process.env.REDIS_URL) {
    return NextResponse.json({ ok: true, accounts: [], missingEnv: true });
  }

  const accounts = await getAccounts();
  // 비밀번호 해시는 응답에서 제외
  const safe = accounts.map(({ password: _pw, ...rest }) => rest);
  return NextResponse.json({ ok: true, accounts: safe });
}

// ── POST — 계정 생성 (비밀번호 없음, mustChangePassword=true) ─
export async function POST(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  if (!process.env.REDIS_URL) {
    return NextResponse.json({ error: "REDIS_URL 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const { name, userId, email, department, company, role } = await request.json();
    if (!name || !userId || !email) {
      return NextResponse.json({ error: "이름, 아이디, 메일 주소는 필수입니다" }, { status: 400 });
    }

    const accounts = await getAccounts();

    if (accounts.find(a => a.userId === userId)) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다" }, { status: 409 });
    }

    const validRole: Account["role"] =
      role === "super" ? "super" : role === "general" ? "general" : "company";

    // 임시 비밀번호 생성 및 해시
    const tempPassword = generateTempPassword();

    const newAccount: Account = {
      id: `acc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      name,
      userId,
      password: hashPassword(tempPassword),
      email,
      department: department || "",
      company:    company    || "",
      role:       validRole,
      active:     true,
      mustChangePassword: true,
      createdAt:  new Date().toISOString(),
    };

    accounts.push(newAccount);
    await saveAccounts(accounts);

    if (validRole === "general") {
      await syncGmLists(accounts);
    }

    // 임시 비밀번호 이메일 발송
    const transporter = createMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from:    `"SW 포털" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: "[SW 포털] 계정이 생성되었습니다",
        html:    buildWelcomeEmail({ name, userId, tempPassword }),
      }).catch(e => console.error("[accounts] welcome mail error:", e));
    }

    const { password: _pw, ...safe } = newAccount;
    return NextResponse.json({ ok: true, account: safe });
  } catch (e) {
    console.error("[accounts POST]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ── PATCH — 계정 수정 / 임시 비밀번호 재발송 ─────────────────
export async function PATCH(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, userId, password, email, department, company, role, active, resendTemp } = body;
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

    const accounts = await getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
    }

    // ── 임시 비밀번호 재발송 ─────────────────────────────────
    if (resendTemp) {
      const acc = accounts[idx];
      const tempPassword = generateTempPassword();
      accounts[idx] = {
        ...acc,
        password:           hashPassword(tempPassword),
        mustChangePassword: true,
      };
      await saveAccounts(accounts);

      const transporter = createMailTransporter();
      if (transporter) {
        await transporter.sendMail({
          from:    `"SW 포털" <${process.env.GMAIL_USER}>`,
          to:      acc.email,
          subject: "[SW 포털] 임시 비밀번호가 발급되었습니다",
          html:    buildWelcomeEmail({ name: acc.name, userId: acc.userId, tempPassword }),
        }).catch(e => console.error("[accounts] resend temp mail error:", e));
      }

      return NextResponse.json({ ok: true });
    }

    // ── 일반 수정 ────────────────────────────────────────────
    const prev = accounts[idx];
    const updated: Account = {
      ...prev,
      ...(name       !== undefined && { name }),
      ...(userId     !== undefined && { userId }),
      ...(email      !== undefined && { email }),
      ...(department !== undefined && { department }),
      ...(company    !== undefined && { company }),
      ...(role       !== undefined && {
        role: (role === "super" ? "super" : role === "general" ? "general" : "company") as Account["role"],
      }),
      ...(active !== undefined && { active }),
    };

    if (password) {
      updated.password = hashPassword(password);
      updated.mustChangePassword = false;
    }

    accounts[idx] = updated;
    await saveAccounts(accounts);

    if (role !== undefined || active !== undefined) {
      await syncGmLists(accounts);
    }

    const { password: _pw, ...safe } = updated;
    return NextResponse.json({ ok: true, account: safe });
  } catch (e) {
    console.error("[accounts PATCH]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ── DELETE — 계정 비활성화 ───────────────────────────────────
export async function DELETE(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

    const accounts = await getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
    }

    accounts[idx] = { ...accounts[idx], active: false };
    await saveAccounts(accounts);
    await syncGmLists(accounts);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[accounts DELETE]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

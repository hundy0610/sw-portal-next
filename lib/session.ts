// ────────────────────────────────────────────────────────────
// 관리자 세션 유틸리티
// ────────────────────────────────────────────────────────────

import crypto from "crypto";
import { kvGet } from "@/lib/kv-store";

const ACCOUNTS_KEY = "sw:accounts";
const SESSION_SECRET = process.env.SESSION_SECRET;

function sign(payload: string): string {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET env var is not set");
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export interface AdminSession {
  notionPageId: string;      // Notion 계정 페이지 ID ("env-super" for ENV-based)
  userId: string;            // 로그인 아이디
  name: string;              // 담당자 이름
  email: string;             // 등록 이메일
  company: string;           // 법인명 ("" = 슈퍼어드민)
  department: string;        // 부서명
  role: "super" | "company" | "general"; // 권한 (general = 총무관리자)
  mustChangePassword?: boolean;          // 초기 비번 변경 필요 여부
}

export function encodeSession(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string): AdminSession | null {
  if (!SESSION_SECRET) return null;
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);

    const expected = sign(payload);
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const json = Buffer.from(payload, "base64").toString("utf-8");
    const s = JSON.parse(json) as AdminSession;
    if (!s.userId || !s.role) return null;
    // backward compat: fill missing fields
    if (!s.email) s.email = "";
    if (!s.department) s.department = "";
    return s;
  } catch {
    return null;
  }
}

// 쿠키의 이름은 로그인 시점 스냅샷이라 이후 계정관리에서 이름(닉네임)이
// 바뀌어도 갱신되지 않는다. 기록/표시 직전에 최신 이름을 다시 조회한다.
export async function resolveCurrentName(session: AdminSession): Promise<string> {
  try {
    const accounts = await kvGet<{ userId: string; name: string }[]>(ACCOUNTS_KEY);
    const found = accounts?.find(a => a.userId === session.userId);
    return found?.name ?? session.name;
  } catch {
    return session.name;
  }
}

// 쿠키의 role도 로그인 시점 스냅샷이라 이후 계정관리에서 권한이
// 바뀌어도 갱신되지 않는다. 검사 직전에 최신 권한을 다시 조회한다.
export async function resolveCurrentRole(session: AdminSession): Promise<AdminSession["role"]> {
  if (session.notionPageId === "env-super") return session.role; // ENV 슈퍼어드민은 계정 DB에 없음
  try {
    const accounts = await kvGet<{ userId: string; role: AdminSession["role"] }[]>(ACCOUNTS_KEY);
    const found = accounts?.find(a => a.userId === session.userId);
    return found?.role ?? session.role;
  } catch {
    return session.role;
  }
}

// super는 전체 법인 접근, 그 외(company/general)는 자기 법인으로 범위 제한
// null = 제한 없음(super), string = 이 법인으로만 제한
export function companyScope(session: AdminSession): string | null {
  return session.role === "super" ? null : session.company;
}

export function getSessionFromCookieHeader(cookieHeader: string | null): AdminSession | null {
  if (!cookieHeader) return null;

  const sessionMatch = cookieHeader.match(/admin_session=([^;]+)/);
  if (sessionMatch) {
    return decodeSession(decodeURIComponent(sessionMatch[1]));
  }

  return null;
}


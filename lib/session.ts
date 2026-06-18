// ────────────────────────────────────────────────────────────
// 관리자 세션 유틸리티
// ────────────────────────────────────────────────────────────

import { kvGet } from "@/lib/kv-store";

const ACCOUNTS_KEY = "sw:accounts";

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
  return Buffer.from(JSON.stringify(session)).toString("base64");
}

export function decodeSession(token: string): AdminSession | null {
  try {
    const json = Buffer.from(token, "base64").toString("utf-8");
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

export function getSessionFromCookieHeader(cookieHeader: string | null): AdminSession | null {
  if (!cookieHeader) return null;

  const sessionMatch = cookieHeader.match(/admin_session=([^;]+)/);
  if (sessionMatch) {
    return decodeSession(decodeURIComponent(sessionMatch[1]));
  }

  // 구버전 admin_key fallback
  const keyMatch = cookieHeader.match(/admin_key=([^;]+)/);
  if (keyMatch) {
    const key = decodeURIComponent(keyMatch[1]);
    const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";
    if (key === ADMIN_KEY) {
      return {
        notionPageId: "legacy",
        userId: "admin",
        name: "슈퍼 어드민",
        email: "",
        company: "",
        department: "",
        role: "super",
      };
    }
  }

  return null;
}

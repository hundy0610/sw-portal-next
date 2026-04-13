// ────────────────────────────────────────────────────────────
// 관리자 세션 유틸리티
// ────────────────────────────────────────────────────────────

export interface AdminSession {
  notionPageId: string;    // Notion 계정 페이지 ID ("env-super" for ENV-based)
  userId: string;          // 로그인 아이디
  name: string;            // 담당자 이름
  company: string;         // 법인명 ("" = 슈퍼어드민)
  role: "super" | "company"; // 권한
  mustChangePassword?: boolean; // 초기 비번 변경 필요 여부
}

/**
 * 세션 객체 → base64 인코딩 토큰
 */
export function encodeSession(session: AdminSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64");
}

/**
 * base64 토큰 → 세션 객체 (실패 시 null)
 */
export function decodeSession(token: string): AdminSession | null {
  try {
    const json = Buffer.from(token, "base64").toString("utf-8");
    const s = JSON.parse(json) as AdminSession;
    if (!s.userId || !s.role) return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * NextRequest 쿠키에서 세션 읽기
 * admin_session 쿠키 우선, 없으면 구버전 admin_key 쿠키로 fallback
 */
export function getSessionFromCookieHeader(cookieHeader: string | null): AdminSession | null {
  if (!cookieHeader) return null;

  // admin_session 쿠키 찾기
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
        company: "",
        role: "super",
      };
    }
  }

  return null;
}

import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET;
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8시간 — 재인증 없이 한 세션 동안 조회/독려 발송 가능

export interface ManagerTokenPayload {
  unitId: string; // 인증된 조직 단위 id (직책자가 관할하는 최상위 조직)
  email: string;
  name: string;
  expiresAt: number;
}

function sign(payload: string): string {
  if (!SECRET) throw new Error("SESSION_SECRET env var is not set");
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function issueManagerToken(unitId: string, email: string, name: string): string {
  const payload: ManagerTokenPayload = { unitId, email, name, expiresAt: Date.now() + TOKEN_TTL_MS };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${json}.${sign(json)}`;
}

export function verifyManagerToken(token: string): ManagerTokenPayload | null {
  if (!SECRET || !token) return null;
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
    const parsed = JSON.parse(json) as ManagerTokenPayload;
    if (!parsed.unitId || !parsed.email || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

import crypto from "crypto";

// "이 매뉴얼로 해결" 요청이 이 포털이 방금 접수한 문의에서 온 것인지 확인하는 서명.
// v2 전환 뒤 포털은 문의 행을 읽을 수 없어(암호문) 티켓이 있는지 DB 로 확인할 수 없다 — 대신 접수할 때 준
// 서명을 되받는다. 없으면 아무 ticketId 로나 매뉴얼 이력(helpdesk:manual:*)에 키워드를 쌓을 수 있게 된다.
function sign(ticketId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return crypto.createHmac("sha256", secret).update(`resolve:${ticketId}`).digest("hex").slice(0, 32);
}

export function resolveToken(ticketId: string): string {
  return sign(ticketId);
}

export function isValidResolveToken(ticketId: string, token: string): boolean {
  const expected = Buffer.from(sign(ticketId));
  const given = Buffer.from(token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

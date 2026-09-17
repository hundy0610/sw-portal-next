// 예상치 못한 에러는 일반화해서 내보낸다 — 스택·내부 경로가 응답으로 새어나가지 않게.
// 예전에는 Notion 클라이언트 에러만 구조화된 검증 메시지라 그대로 통과시켰는데,
// Notion 을 걷어내면서 그 예외가 사라져 항상 일반 문구가 나간다.
export function errorMessage(_e: unknown): string {
  return "서버 오류가 발생했습니다.";
}

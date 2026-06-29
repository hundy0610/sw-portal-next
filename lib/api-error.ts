import { isNotionClientError } from "@notionhq/client";

// Notion 에러는 구조화된 검증 메시지라 그대로 노출, 그 외 예상치 못한 에러는 일반화
export function errorMessage(e: unknown): string {
  if (isNotionClientError(e)) return e.message;
  return "서버 오류가 발생했습니다.";
}

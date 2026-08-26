import { put } from "@vercel/blob";

// ─────────────────────────────────────────────────────────────────────────────
// 파일 저장소 (4.0verMACBOOK) — Vercel Blob 을 파일의 소스오브트루스로 사용한다.
//
// "Postgres 메인" 구조에서 첨부파일은 jsonb 에 담을 수 없고, Notion 서명 URL 은 1시간 뒤
// 만료된다. 그래서 파일은 Vercel Blob(공개, 영구 URL)에 올리고, 미러 레코드에는 그 URL 을
// 저장한다. 5분 백업 러너가 Blob URL 의 파일을 Notion file_uploads 로 재업로드한다.
//
// 앱(Vercel)에서만 업로드하며 BLOB_READ_WRITE_TOKEN 이 필요하다(Vercel 에 자동 주입).
// 백업 러너(맥북)는 Blob URL 을 fetch 로 읽기만 하므로 토큰이 필요 없다.
// ─────────────────────────────────────────────────────────────────────────────

export function isBlobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function sanitize(name: string): string {
  return (name || "file").replace(/[^\w.\-가-힣]/g, "_").slice(0, 120);
}

/**
 * 버퍼를 Vercel Blob 에 업로드하고 공개 URL 을 반환한다.
 * prefix 로 엔티티별 폴더를 구분한다(예: "contracts", "hw-repair").
 */
export async function uploadToBlob(
  buffer: Buffer,
  filename: string,
  contentType: string,
  prefix: string,
): Promise<string> {
  const path = `${prefix}/${crypto.randomUUID()}-${sanitize(filename)}`;
  const { url } = await put(path, buffer, {
    access: "public",
    contentType: contentType || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return url;
}

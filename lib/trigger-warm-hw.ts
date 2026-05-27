/**
 * GitHub Actions warm-hw.yml 워크플로우를 디스패치하는 헬퍼.
 *
 * 환경변수:
 *   GITHUB_DISPATCH_TOKEN  — fine-grained PAT (actions:write 권한)
 *   GITHUB_REPO            — "owner/repo" 형식  예) hundy0610/sw-portal-next
 *
 * 두 값이 모두 설정된 경우에만 디스패치합니다.
 * 미설정 시 아무 동작도 하지 않습니다 (graceful degradation).
 *
 * 3분 디바운스 — 동일 인스턴스에서 연속 요청이 와도 한 번만 트리거.
 */

let _lastTriggered = 0;

export async function triggerWarmHw(): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo  = process.env.GITHUB_REPO;
  if (!token || !repo) return;

  const now = Date.now();
  if (now - _lastTriggered < 3 * 60 * 1000) return; // 3분 디바운스
  _lastTriggered = now;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/warm-hw.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "master" }),
      }
    );
    if (!res.ok) {
      console.warn(`[warm-hw dispatch] GitHub API ${res.status}:`, await res.text());
    } else {
      console.log("[warm-hw dispatch] warm-hw.yml 디스패치 완료");
    }
  } catch (e) {
    console.warn("[warm-hw dispatch] 실패:", e);
  }
}

// fetch 응답을 안전하게 JSON으로 파싱.
// 세션 만료(401) 또는 함수 타임아웃(502/503/504) 시 Vercel/브라우저가 HTML
// 에러 페이지를 돌려줘서 res.json()이 SyntaxError로 죽는 경우가 있었음 —
// 그 경우에도 항상 { ok:false, error } 형태로 정규화해서 반환한다.
export async function safeJson(res: Response): Promise<any> {
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  if (!isJson) {
    if (res.status === 401) {
      return { ok: false, error: "세션이 만료되었습니다. 다시 로그인해주세요." };
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return { ok: false, error: "서버 응답이 지연되어 시간이 초과되었습니다. 잠시 후 다시 시도해주세요." };
    }
    return { ok: false, error: `서버 오류가 발생했습니다 (${res.status})` };
  }

  try {
    return await res.json();
  } catch {
    return { ok: false, error: `서버 응답을 처리할 수 없습니다 (${res.status})` };
  }
}

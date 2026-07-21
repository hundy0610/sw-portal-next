"use client";

import { useEffect, useState } from "react";
import { safeJson } from "@/lib/fetch-json";

interface ManualMatch {
  id: string;
  title: string;
  url: string;
}

interface ManualSuggestionProps {
  content: string;
}

// 문의 접수가 끝나자마자, 작성한 문의 내용으로 바로 시도해볼 수 있는 매뉴얼이 있는지 확인해 보여준다.
// 매칭되면 서버에서 이미 담당자 미배정 상태로 완료 처리해두므로(상태와 무관하게) 항상 확인해 보여준다.
// 매칭이 안 되거나 요청이 실패해도 조용히 아무것도 렌더링하지 않는다 — 부가 기능이라 확인 화면 자체를 막으면 안 됨.
export default function ManualSuggestion({ content }: ManualSuggestionProps) {
  const [match, setMatch] = useState<ManualMatch | null>(null);

  useEffect(() => {
    if (!content) { setMatch(null); return; }
    let cancelled = false;
    fetch("/api/helpdesk/manuals/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
      .then(r => safeJson(r))
      .then(json => { if (!cancelled && json.ok) setMatch(json.match); })
      .catch(() => { /* 제안 실패는 조용히 무시 */ });
    return () => { cancelled = true; };
  }, [content]);

  if (!match) return null;

  return (
    <div className="flex w-full flex-col gap-spacing-300 rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400">
      <div className="flex flex-col gap-spacing-100">
        <span className="text-core-accent text-label font-semibold">💡 바로 시도해볼 수 있어요</span>
        <span className="text-content-standard-primary text-body">
          문의하신 내용은 <strong>&quot;{match.title}&quot;</strong> 매뉴얼로 해결해보실 수 있어요.
        </span>
        <span className="text-content-standard-tertiary text-label">
          매뉴얼로 해결되지 않으면 언제든 다시 문의를 남겨주세요.
        </span>
      </div>
      <a
        href={match.url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full rounded-radius-400 bg-core-accent px-spacing-500 py-spacing-400 text-center text-content-inverted-primary text-heading font-semibold duration-100 hover:opacity-75 active:scale-95"
      >
        매뉴얼 확인하기
      </a>
    </div>
  );
}

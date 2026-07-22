"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { safeJson } from "@/lib/fetch-json";

interface ManualMatch {
  id: string;
  title: string;
  url: string;
}

interface ManualSuggestionProps {
  ticketId: string;
  content: string;
}

type Choice = "pending" | "manual" | "assignee";

// 문의 접수가 끝나자마자, 작성한 문의 내용으로 바로 시도해볼 수 있는 매뉴얼이 있는지 확인해 보여주고,
// "매뉴얼로 해결" / "담당자에게 직접 지원" 중 사용자가 직접 고르게 한다.
// 매뉴얼로 해결을 고르면 그 자리에서 담당자 미배정으로 케이스가 종료되고, 담당자 지원을 고르면
// 일반 문의와 동일하게 접수 시점에 이미 나간 담당자 알림 메일로 처리된다.
// 매칭이 안 되거나 요청이 실패해도 조용히 아무것도 렌더링하지 않는다 — 부가 기능이라 확인 화면 자체를 막으면 안 됨.
export default function ManualSuggestion({ ticketId, content }: ManualSuggestionProps) {
  const queryClient = useQueryClient();
  const [match, setMatch] = useState<ManualMatch | null>(null);
  const [choice, setChoice] = useState<Choice>("pending");
  const [resolving, setResolving] = useState(false);
  const [resolveErrorCode, setResolveErrorCode] = useState<string | null>(null);

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

  const chooseManual = async () => {
    window.open(match.url, "_blank", "noopener,noreferrer");
    setResolving(true);
    setResolveErrorCode(null);
    try {
      const res = await fetch("/api/request/inquiry/resolve-with-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, manualId: match.id, content }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setChoice("manual");
        queryClient.invalidateQueries({ queryKey: ["inquiryTicket", ticketId] });
      } else {
        setResolveErrorCode(json.code || "RESOLVE_WITH_MANUAL_FAILED");
      }
    } catch {
      setResolveErrorCode("RESOLVE_WITH_MANUAL_FETCH_ERROR");
    } finally {
      setResolving(false);
    }
  };

  if (choice === "manual") {
    return (
      <div className="flex w-full flex-col gap-spacing-100 rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400">
        <span className="text-core-accent text-label font-semibold">✅ 매뉴얼로 처리 완료됐어요</span>
        <span className="text-content-standard-tertiary text-label">
          매뉴얼로 해결되지 않으면 언제든 다시 문의를 남겨주세요.
        </span>
      </div>
    );
  }

  if (choice === "assignee") {
    return (
      <div className="flex w-full flex-col gap-spacing-100 rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400">
        <span className="text-content-standard-primary text-body font-semibold">담당자가 확인 후 연락드릴게요.</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-spacing-300 rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400">
      <div className="flex flex-col gap-spacing-100">
        <span className="text-core-accent text-label font-semibold">💡 바로 시도해볼 수 있어요</span>
        <span className="text-content-standard-primary text-body">
          문의하신 내용은 <strong>&quot;{match.title}&quot;</strong> 매뉴얼로 해결 가능할 수도 있어요. 어떻게 도와드릴까요?
        </span>
      </div>
      <div className="flex w-full flex-col gap-spacing-200">
        <button
          type="button"
          onClick={chooseManual}
          disabled={resolving}
          className="w-full rounded-radius-400 bg-core-accent px-spacing-500 py-spacing-400 text-center text-content-inverted-primary text-heading font-semibold duration-100 hover:opacity-75 active:scale-95 disabled:opacity-50"
        >
          {resolving ? "처리 중…" : "매뉴얼로 해결해볼래요"}
        </button>
        <button
          type="button"
          onClick={() => setChoice("assignee")}
          disabled={resolving}
          className="w-full rounded-radius-400 border border-line-outline bg-components-fill-standard-secondary px-spacing-500 py-spacing-400 text-center text-content-standard-primary text-heading font-semibold duration-100 hover:opacity-75 active:scale-95 disabled:opacity-50"
        >
          담당자에게 직접 지원 받을래요
        </button>
      </div>
      {resolveErrorCode && (
        <span className="text-label text-red-500">처리에 실패했어요 (코드: {resolveErrorCode}) — 다시 시도해주세요.</span>
      )}
    </div>
  );
}

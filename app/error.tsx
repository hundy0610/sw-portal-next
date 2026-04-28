"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-2xl w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-red-600 text-lg">⚠</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">오류가 발생했습니다</h1>
            <p className="text-sm text-gray-500">아래 에러 정보를 개발자에게 전달해주세요</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wider">Error Message</div>
          <div className="font-mono text-sm text-red-800 break-all">{error.message || "Unknown error"}</div>
          {error.digest && (
            <div className="mt-2 text-xs text-red-500">Digest: {error.digest}</div>
          )}
        </div>

        {error.stack && (
          <details className="mb-4">
            <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 mb-2">
              Stack Trace 보기
            </summary>
            <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          </details>
        )}

        <button
          onClick={reset}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

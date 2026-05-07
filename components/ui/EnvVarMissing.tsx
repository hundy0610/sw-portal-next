"use client";

export default function EnvVarMissing({ varName }: { varName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="text-4xl">⚙️</div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 mb-1">환경변수가 설정되지 않았습니다</p>
        <p className="text-xs text-gray-400 mb-4">
          Vercel 대시보드 → Settings → Environment Variables 에서 아래 변수를 추가해주세요.
        </p>
        <code className="inline-block bg-gray-100 border border-gray-200 text-red-600 font-mono text-sm px-4 py-2 rounded-lg">
          {varName}
        </code>
      </div>
    </div>
  );
}

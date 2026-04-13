import DeclarationPanel from "@/components/DeclarationPanel";

// 독립형 실사 페이지 — 직접 링크 공유용
// 포털 내에서는 page.tsx의 "자산 실사" 탭으로도 접근 가능
export default function DeclarationPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F4F5F7" }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-extrabold text-xs">SW</span>
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 leading-tight">SW 자산 실사</div>
              <div className="text-xs text-gray-400">IT 자산관리파트</div>
            </div>
          </div>
          <a href="/" className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← 포털 홈
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <DeclarationPanel />
      </main>
    </div>
  );
}

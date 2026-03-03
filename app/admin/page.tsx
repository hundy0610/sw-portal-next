"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// 동적 임포트로 클라이언트 컴포넌트 로딩
const OverviewPanel      = dynamic(() => import("@/components/admin/OverviewPanel"),      { ssr: false });
const LicensePanel       = dynamic(() => import("@/components/admin/LicensePanel"),       { ssr: false });
const SubscriptionPanel  = dynamic(() => import("@/components/admin/SubscriptionPanel"),  { ssr: false });
const TicketPanel        = dynamic(() => import("@/components/admin/TicketPanel"),        { ssr: false });
const SwDbPanel          = dynamic(() => import("@/components/admin/SwDbPanel"),          { ssr: false });

type PageId = "overview" | "license" | "subscribe" | "tickets" | "swdb";

const MENU: { id: PageId; icon: string; label: string }[] = [
  { id: "overview",  icon: "▦", label: "대시보드" },
  { id: "license",   icon: "🔑", label: "라이선스 현황" },
  { id: "subscribe", icon: "💳", label: "구독 관리" },
  { id: "tickets",   icon: "🎫", label: "티켓 관리" },
  { id: "swdb",      icon: "🗄", label: "SW DB" },
];

export default function AdminPage() {
  const [page, setPage] = useState<PageId>("overview");
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  const panels: Record<PageId, React.ReactNode> = {
    overview:  <OverviewPanel />,
    license:   <LicensePanel />,
    subscribe: <SubscriptionPanel />,
    tickets:   <TicketPanel />,
    swdb:      <SwDbPanel />,
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 h-[52px] flex items-center px-5 gap-3 sticky top-0 z-40">
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          포털로 돌아가기
        </a>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-purple-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-xs">AD</span>
          </div>
          <div>
            <div className="font-bold text-xs text-gray-900">관리자 대시보드</div>
            <div className="text-xs text-gray-400" style={{ fontSize: 10 }}>IT 자산관리파트</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* 동기화 표시 */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Notion 연동 중
          </div>
          {/* 사용자 아바타 */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center font-bold text-xs text-purple-700">권</div>
            <div className="text-xs">
              <div className="font-semibold text-gray-900 leading-tight">권정훈</div>
              <div className="text-gray-400" style={{ fontSize: 10 }}>IT 자산관리파트</div>
            </div>
          </div>
          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
            title="로그아웃"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            로그아웃
          </button>
        </div>
      </header>

      {/* 사이드바 + 메인 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 다크 사이드바 */}
        <aside className="sidenav w-[220px] min-w-[220px] flex flex-col pt-4 pb-4 overflow-y-auto">
          <div className="sidenav-section">메뉴</div>
          {MENU.map((m) => (
            <div
              key={m.id}
              className={`sidenav-item${page === m.id ? " active" : ""}`}
              onClick={() => setPage(m.id)}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <span>{m.label}</span>
            </div>
          ))}
          <div className="mt-auto px-4 pt-4 border-t border-white/10">
            <div className="text-xs text-white/30">v2.0.0 · Notion 실시간 연동</div>
          </div>
        </aside>

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-7" style={{ background: "#F4F5F7" }}>
          <div className="slide-in">{panels[page]}</div>
        </main>
      </div>
    </div>
  );
}

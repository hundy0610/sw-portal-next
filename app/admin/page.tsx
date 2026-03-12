"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// 서버사이드 렌더링 없이 클라이언트에서만 로드
const OverviewPanel     = dynamic(() => import("@/components/admin/OverviewPanel"),     { ssr: false });
const LicensePanel      = dynamic(() => import("@/components/admin/LicensePanel"),      { ssr: false });
const CredentialsPanel  = dynamic(() => import("@/components/admin/CredentialsPanel"),  { ssr: false });
const SwDbPanel         = dynamic(() => import("@/components/admin/SwDbPanel"),         { ssr: false });

// 구독 관리는 라이선스 현황에 통합됨 (유형 필터로 영구/구독 선택)
type PageId = "overview" | "license" | "credentials" | "swdb";

const MENU: { id: PageId; icon: string; label: string; desc: string }[] = [
  { id: "overview",     icon: "⚡", label: "대시보드",      desc: "현황 요약"        },
  { id: "license",      icon: "🔑", label: "라이선스 현황", desc: "영구 · 구독 통합" },
  { id: "credentials",  icon: "🔐", label: "계정 관리",     desc: "ID / PW 목록"     },
  { id: "swdb",         icon: "🗄", label: "SW DB 관리",    desc: "승인 / 금지 목록" },
];

export default function AdminPage() {
  const [page, setPage] = useState<PageId>("overview");
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  const panels: Record<PageId, React.ReactNode> = {
    overview:    <OverviewPanel />,
    license:     <LicensePanel />,
    credentials: <CredentialsPanel />,
    swdb:        <SwDbPanel />,
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── 상단 헤더 ── */}
      <header className="bg-white border-b border-gray-200 h-[52px] flex items-center px-5 gap-3 sticky top-0 z-40">
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          직원 포털로 이동
        </a>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* 관리자 모드 뱃지 */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-purple-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-xs">AD</span>
          </div>
          <div>
            <div className="font-bold text-xs text-gray-900">관리자 모드 대시보드</div>
            <div className="text-xs text-gray-400" style={{ fontSize: 10 }}>IT 자산관리파트</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Notion 연동 상태 */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Notion 연동 중
          </div>

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 px-2 py-1.5 rounded hover:bg-red-50 transition-colors"
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

      {/* ── 사이드바 + 콘텐츠 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <aside className="sidenav w-[220px] min-w-[220px] flex flex-col pt-4 pb-4 overflow-y-auto">
          <div className="sidenav-section">메뉴</div>
          {MENU.map((m) => (
            <div
              key={m.id}
              className={`sidenav-item${page === m.id ? " active" : ""}`}
              onClick={() => setPage(m.id)}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <div className="flex flex-col leading-tight">
                <span>{m.label}</span>
                <span className="text-xs opacity-50">{m.desc}</span>
              </div>
            </div>
          ))}

          {/* 하단 Notion 바로가기 */}
          <div className="mt-auto mx-3 pt-4 border-t border-white/10">
            <div className="text-xs text-white/40 mb-2 px-1">Notion 바로가기</div>
            <a
              href={process.env.NEXT_PUBLIC_NOTION_TRACKER_URL || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>🗄</span> SW DB 편집
            </a>
            <a
              href={process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>📋</span> SW 데이터베이스
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>🎫</span> 티켓 처리 (Notion)
            </a>
          </div>

          <div className="px-4 pt-2">
            <div className="text-xs text-white/30">v2.1.0 · Notion 연동</div>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-7" style={{ background: "#F4F5F7" }}>
          <div className="slide-in">{panels[page]}</div>
        </main>
      </div>
    </div>
  );
}

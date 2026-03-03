"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const OverviewPanel   = dynamic(() => import("@/components/admin/OverviewPanel"),   { ssr: false });
const LicensePanel    = dynamic(() => import("@/components/admin/LicensePanel"),    { ssr: false });
const SubscribePanel  = dynamic(() => import("@/components/admin/SubscribePanel"),  { ssr: false });
const SwDbPanel       = dynamic(() => import("@/components/admin/SwDbPanel"),       { ssr: false });

type PageId = "overview" | "license" | "subscribe" | "swdb";

const MENU: { id: PageId; icon: string; label: string; desc: string }[] = [
  { id: "overview",  icon: "⚡", label: "대시보드",      desc: "현황 요약"        },
  { id: "license",   icon: "🔑", label: "라이선스 현황", desc: "사용 / 재고"      },
  { id: "subscribe", icon: "💳", label: "구독 관리",     desc: "구독 SW 목록"     },
  { id: "swdb",      icon: "🗄", label: "SW DB 관리",    desc: "승인 / 금지 목록" },
];

export default function AdminPage() {
  const [page, setPage] = useState<PageId>("overview");
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    window.location.href = "/admin/login";
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-60"} bg-gray-900 text-white flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-700">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">SW</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold leading-tight">SW 관리자</p>
              <p className="text-xs text-gray-400">Admin Portal</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-gray-400 hover:text-white text-xs"
          >{collapsed ? "▶" : "◀"}</button>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => setPage(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                page === m.id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <span className="text-lg shrink-0">{m.icon}</span>
              {!collapsed && (
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-gray-400">{m.desc}</p>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Notion quick links */}
        {!collapsed && (
          <div className="px-4 py-4 border-t border-gray-700 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Notion 바로가기</p>
            {[
              { label: "SW DB 편집",  href: "https://notion.so" },
              { label: "구독 관리",   href: "https://notion.so" },
              { label: "티켓 처리",   href: "https://notion.so" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors py-1"
              >
                <span className="text-gray-600">↗</span>
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Logout */}
        <div className="px-3 py-3 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
          >
            <span>🚪</span>
            {!collapsed && "로그아웃"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {MENU.find((m) => m.id === page)?.label ?? "관리자"}
            </h1>
            <p className="text-xs text-gray-500">
              {MENU.find((m) => m.id === page)?.desc}
            </p>
          </div>
          <a
            href="/"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            사용자 포털로
          </a>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {page === "overview"  && <OverviewPanel />}
          {page === "license"   && <LicensePanel />}
          {page === "subscribe" && <SubscribePanel />}
          {page === "swdb"      && <SwDbPanel />}
        </main>
      </div>
    </div>
  );
}

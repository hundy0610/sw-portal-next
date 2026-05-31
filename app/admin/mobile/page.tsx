"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const MobileDashboard     = dynamic(() => import("@/components/admin/mobile/MobileDashboard"),     { ssr: false });
const MobileExchangeReturn = dynamic(() => import("@/components/admin/mobile/MobileExchangeReturn"), { ssr: false });
const MobileHw            = dynamic(() => import("@/components/admin/mobile/MobileHw"),            { ssr: false });
const MobileHelpDesk      = dynamic(() => import("@/components/admin/mobile/MobileHelpDesk"),      { ssr: false });

export interface MobileSession {
  role: "super" | "company" | "general";
  company: string;
  name: string;
  userId: string;
}

type TabId = "home" | "exchange-return" | "hw" | "helpdesk" | "more";

const TABS: { id: TabId; label: string; icon: React.ReactElement }[] = [
  {
    id: "home", label: "홈",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    id: "exchange-return", label: "자산흐름",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
  },
  {
    id: "hw", label: "HW자산",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>,
  },
  {
    id: "helpdesk", label: "헬프데스크",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
  {
    id: "more", label: "더보기",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  },
];

export default function MobileAdminPage() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("home");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/auth")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok) { router.replace("/admin/login"); return; }
        if (data.mustChangePassword) { router.replace("/admin/change-password"); return; }
        setSession({ role: data.role, company: data.company ?? "", name: data.name ?? "", userId: data.userId ?? "" });
      })
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }
  if (!session) return null;

  const isSuper = session.role === "super";

  function renderContent() {
    switch (tab) {
      case "home":            return <MobileDashboard session={session!} onNavigate={t => setTab(t as TabId)} />;
      case "exchange-return": return isSuper ? <MobileExchangeReturn session={session!} /> : <AccessDenied />;
      case "hw":              return <MobileHw session={session!} />;
      case "helpdesk":        return <MobileHelpDesk session={session!} />;
      case "more":            return <MorePanel isSuper={isSuper} session={session!} onNavigate={t => setTab(t as TabId)} onLogout={handleLogout} />;
      default:                return null;
    }
  }

  const PAGE_TITLES: Record<TabId, string> = {
    "home": "대시보드",
    "exchange-return": "자산흐름 관리",
    "hw": "HW 자산관리",
    "helpdesk": "헬프데스크",
    "more": "더보기",
  };

  return (
    <div className="flex flex-col bg-gray-50" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <header className="bg-[#1C2B4A] text-white sticky top-0 z-40 flex items-center px-4 gap-3"
        style={{ height: 56, paddingTop: "env(safe-area-inset-top)" }}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${isSuper ? "bg-purple-500" : "bg-blue-500"}`}>
          {isSuper ? "SA" : "AD"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{PAGE_TITLES[tab]}</div>
          <div className="text-xs text-white/50 truncate">{session.name} · {isSuper ? "슈퍼어드민" : session.company}</div>
        </div>
        <a href="/admin" className="text-xs text-white/50 hover:text-white px-2 py-1 rounded flex-shrink-0">
          데스크탑
        </a>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        {renderContent()}
      </main>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${tab === t.id ? "text-blue-600" : "text-gray-400"}`}
          >
            {t.icon}
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
      <span className="text-4xl">🔒</span>
      <p className="text-sm font-medium">접근권한이 없습니다</p>
    </div>
  );
}

function MorePanel({ isSuper, session, onNavigate, onLogout }: {
  isSuper: boolean;
  session: MobileSession;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}) {
  const items: { id: string; icon: string; label: string; desc: string; superOnly?: boolean }[] = [
    { id: "home",            icon: "🏠", label: "대시보드",      desc: "전사 현황 요약" },
    { id: "exchange-return", icon: "📲", label: "자산흐름 관리", desc: "교체·반납 처리 관리", superOnly: true },
    { id: "hw",              icon: "💻", label: "HW 자산관리",   desc: "NT/DT 재고·현황 조회" },
    { id: "helpdesk",        icon: "🎫", label: "헬프데스크",    desc: "문의 접수 현황" },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">메뉴</div>
      {items.map(item => {
        const locked = item.superOnly && !isSuper;
        return (
          <button
            key={item.id}
            disabled={locked}
            onClick={() => !locked && onNavigate(item.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors
              ${locked ? "bg-gray-100 text-gray-300" : "bg-white shadow-sm active:bg-gray-50"}`}
          >
            <span className="text-2xl w-8 text-center">{locked ? "🔒" : item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold ${locked ? "text-gray-400" : "text-gray-900"}`}>{item.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{locked ? "슈퍼 어드민 전용" : item.desc}</div>
            </div>
            {!locked && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
        );
      })}

      <div className="pt-4 space-y-2">
        <a href="/admin"
          className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#1C2B4A] text-white text-sm font-semibold">
          💻 데스크탑 버전으로 이동
        </a>
        <button onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-red-50 text-red-600 text-sm font-semibold">
          로그아웃
        </button>
      </div>

      <div className="pt-2 text-center text-xs text-gray-300">
        v{process.env.NEXT_PUBLIC_APP_VERSION} · 모바일 관리자
      </div>
    </div>
  );
}

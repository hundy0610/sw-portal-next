"use client";

import DeclarationPanel from "@/components/DeclarationPanel";

const C = {
  brand:       "#D97706",
  primary:     "#F59E0B",
  primarySoft: "#FFFBEB",
  text1:       "#1c1006",
  text2:       "#44403c",
  text3:       "#64748b",
  text4:       "#94a3b8",
  border:      "#fde68a",
  bgPage:      "#fffdf8",
} as const;

const INQUIRY_URL = "https://assetify-desk-main.vercel.app";

function Icon({ n, s = 18 }: { n: string; s?: number }) {
  const P: Record<string, string[]> = {
    home:   ["M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4a1 1 0 0 1-1-1V9.5z"],
    edu:    ["M22 10v6M2 10l10-5 10 5-10 5z", "M6 12v5c3 3 9 3 12 0v-5"],
    folder: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
    search: ["M21 21l-4.35-4.35", "M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0"],
    clip:   ["M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2"],
    msg:    ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(P[n] ?? [""]).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const NAV = [
  { label: "홈",       icon: "home",   href: "/",          active: false, short: "홈"    },
  { label: "교육 센터", icon: "edu",    href: "/",          active: false, short: "교육"  },
  { label: "자료실",    icon: "folder", href: "/resources", active: false, short: "자료실" },
  { label: "SW 검색",  icon: "search", href: "/",          active: false, short: "SW"   },
  { label: "자산 실사", icon: "clip",   href: "/declaration", active: true, short: "실사"  },
];

export default function DeclarationPage() {
  return (
    <div className="flex min-h-screen" style={{ background: C.bgPage, color: C.text2 }}>

      {/* ── 사이드바 ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-white"
        style={{ width: 240, borderRight: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <img src="/logo.png" alt="로고" className="shrink-0"
            style={{ height: 32, width: "auto", maxWidth: 160, objectFit: "contain" }} />
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          {NAV.map(({ label, icon, href, active }) => (
            <a key={label} href={href}
              className="flex items-center gap-3 px-3.5 py-2.5 text-sm transition-all"
              style={{
                borderRadius: 10,
                background:     active ? C.primarySoft  : "transparent",
                color:          active ? C.primary      : C.text3,
                fontWeight:     active ? 700             : 500,
                textDecoration: "none",
              }}>
              <Icon n={icon} s={16} />
              {label}
            </a>
          ))}
        </nav>
        <div className="p-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-3 text-white text-sm font-bold w-full"
            style={{ borderRadius: 10, background: C.primary, textDecoration: "none" }}>
            <Icon n="msg" s={15} /> IT 지원 문의하기
          </a>
          <a href="/admin"
            className="mt-3 block text-center text-xs transition-opacity opacity-0 hover:opacity-100"
            style={{ color: C.text4, textDecoration: "none" }}>관리자</a>
        </div>
      </aside>

      {/* ── 모바일 헤더 ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 bg-white/90"
        style={{ height: 52, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)" }}>
        <img src="/logo.png" alt="로고" className="mr-3 shrink-0"
          style={{ height: 22, width: "auto", maxWidth: 120, objectFit: "contain" }} />
        <span className="font-bold text-sm" style={{ color: C.text1 }}>자산 실사</span>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 lg:ml-[240px] min-h-screen pb-20 lg:pb-10 pt-14 lg:pt-0">
        {/* 히어로 */}
        <div className="relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.primary} 100%)` }}>
          <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.65)" }}>SW 자산 관리</p>
            <h1 className="text-4xl font-extrabold text-white mb-2"
              style={{ fontFamily: "Manrope, sans-serif" }}>자산 실사</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              사용 중인 SW 현황을 확인하고 미등록 SW를 신고하세요.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <DeclarationPanel />
        </div>
      </main>

      {/* ── 모바일 바텀 네비 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-50 bg-white"
        style={{ height: 64, borderTop: `1px solid ${C.border}` }}>
        {NAV.map(({ label, icon, href, active, short }) => (
          <a key={label} href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: active ? C.primary : C.text4, textDecoration: "none" }}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: active ? C.primarySoft : "transparent" }}>
              <Icon n={icon} s={17} />
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600 }}>{short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

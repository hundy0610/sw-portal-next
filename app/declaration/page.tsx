"use client";

import DeclarationPanel from "@/components/DeclarationPanel";

const C = {
  brand:       "#D97706",
  primary:     "#D97706",
  primarySoft: "#FAEEDA",
  text1:       "#111111",
  text2:       "#374151",
  text3:       "#6B6B68",
  text4:       "#8A8A86",
  border:      "#EEEEEC",
  bgPage:      "#FAFAF8",
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
        <div className="flex items-center gap-3 px-6 py-5">
          <img src="/logo.png" alt="로고" className="shrink-0"
            style={{ height: 28, width: "auto", maxWidth: 160, objectFit: "contain" }} />
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV.map(({ label, icon, href, active }) => (
            <a key={label} href={href}
              className="flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors"
              style={{
                borderLeft: `2px solid ${active ? C.brand : "transparent"}`,
                color:          active ? C.text1 : C.text3,
                fontWeight:     active ? 600     : 500,
                textDecoration: "none",
              }}>
              <Icon n={icon} s={16} />
              {label}
            </a>
          ))}
        </nav>
        <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium w-full hover:brightness-105 transition-all"
            style={{ borderRadius: 10, background: C.brand, textDecoration: "none" }}>
            <Icon n="msg" s={14} /> IT 지원 문의
          </a>
          <a href="/admin"
            className="mt-3 block text-center text-xs hover:underline transition-colors"
            style={{ color: C.text4, textDecoration: "none" }}>관리자</a>
        </div>
      </aside>

      {/* ── 모바일 헤더 ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 bg-white/90"
        style={{ height: 52, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)" }}>
        <img src="/logo.png" alt="로고" className="mr-3 shrink-0"
          style={{ height: 22, width: "auto", maxWidth: 120, objectFit: "contain" }} />
        <span className="font-medium text-sm" style={{ color: C.text1 }}>자산 실사</span>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 lg:ml-[240px] min-h-screen pb-20 lg:pb-10 pt-14 lg:pt-0">
        <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
          {/* 헤드라인 */}
          <div className="mb-8 pb-6" style={{ borderBottom: `1px solid ${C.border}` }}>
            <p className="text-xs mb-1" style={{ color: C.text4, textTransform: "uppercase", letterSpacing: "0.04em" }}>SW 자산 관리</p>
            <h1 className="text-[28px] sm:text-[32px] font-bold mb-2" style={{ color: C.text1, letterSpacing: "-0.01em" }}>자산 실사</h1>
            <p className="text-sm" style={{ color: C.text3 }}>
              사용 중인 SW 현황을 확인하고 미등록 SW를 신고하세요.
            </p>
          </div>

          <DeclarationPanel />
        </div>
      </main>

      {/* ── 모바일 바텀 네비 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-50 bg-white"
        style={{ height: 64, borderTop: `1px solid ${C.border}` }}>
        {NAV.map(({ label, icon, href, active, short }) => (
          <a key={label} href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: active ? C.brand : C.text4, textDecoration: "none" }}>
            <Icon n={icon} s={18} />
            <span style={{ fontSize: 9.5, fontWeight: 500 }}>{short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

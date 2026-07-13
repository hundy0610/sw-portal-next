"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwItem } from "@/types";
import type { Notice, Course } from "@/types/portal";
import { safeJson } from "@/lib/fetch-json";

type Tab = "home" | "education" | "search";

const INQUIRY_URL = "https://assetify-desk-main.vercel.app";

/* ── 색상 토큰 — 에디토리얼 방향: 잉크블랙 텍스트 + 미세 보더, 앰버는 액션에만 ──
   CSS 변수 참조로 전환 — .portal-dark 클래스가 켜지면 자동으로 다크 팔레트로 전환됨 (app/globals.css 참고) */
const C = {
  brand:       "var(--brand)",
  primary:     "var(--brand)",
  primarySoft: "var(--brand-soft)",
  text1:       "var(--portal-text)",
  text2:       "var(--portal-text-2)",
  text3:       "var(--portal-text-3)",
  text4:       "var(--portal-text-4)",
  index:       "var(--portal-border)",
  border:      "var(--portal-border)",
  bg:          "var(--portal-bg)",
  bgPage:      "var(--portal-bg-page)",
} as const;

/* ── D-day 동적 계산 ── */
function calcDday(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff > 0 ? `D-${diff}` : "마감";
}

/* ── SVG 아이콘 (이모지 대체) ── */
function Icon({ n, s = 18 }: { n: string; s?: number }) {
  const P: Record<string, string[]> = {
    home:    ["M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4a1 1 0 0 1-1-1V9.5z"],
    edu:     ["M22 10v6M2 10l10-5 10 5-10 5z","M6 12v5c3 3 9 3 12 0v-5"],
    folder:  ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
    search:  ["M21 21l-4.35-4.35","M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0"],
    clip:    ["M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2"],
    msg:     ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
    dl:      ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
    chevron: ["M9 18l6-6-6-6"],
    x:       ["M18 6L6 18M6 6l12 12"],
    bell:    ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9","M13.73 21a2 2 0 0 1-3.46 0"],
    shield:  ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
    info:    ["M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z","M12 16v-4","M12 8h.01"],
    check:   ["M22 11.08V12a10 10 0 1 1-5.93-9.14","M22 4L12 14.01l-3-3"],
    users:   ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75","M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
    code:    ["M16 18l6-6-6-6","M8 6l-6 6 6 6"],
    brush:   ["M20.84 4.61a5.5 5.5 0 0 0-7.78 0L3 14.67V21h6.33l10.06-10.06a5.5 5.5 0 0 0 0-7.78z"],
    box:     ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96L12 12.01l8.73-5.05","M12 22.08V12"],
    file:    ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6"],
    upload:  ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M17 8l-5-5-5 5","M12 3v12"],
    alert:   ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z","M12 9v4","M12 17h.01"],
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(P[n] ?? [""]).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const NAV_ITEMS = [
  { id: "home"        as Tab, icon: "home",   label: "홈",       short: "홈",    href: undefined },
  { id: "education"   as Tab, icon: "edu",    label: "교육 센터", short: "교육",  href: undefined },
  { id: "resources",          icon: "folder", label: "자료실",    short: "자료실", href: "/resources" },
  { id: "search"      as Tab, icon: "search", label: "SW 검색",   short: "SW",   href: undefined },
  { id: "declaration",        icon: "clip",   label: "자산 실사",  short: "실사",  href: "/declaration" },
] as const;

/* ══════════════════════════════════════════════════════
   포털 메인
══════════════════════════════════════════════════════ */
export default function PortalPage() {
  // 자료실/자산실사 페이지의 "교육 센터"·"SW 검색" 링크가 ?tab= 쿼리로 진입시켜줌
  // (이 두 항목은 홈 화면 내부 탭이라 별도 라우트가 없음)
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "home";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "education" || t === "search" ? t : "home";
  });
  const currentNav = NAV_ITEMS.find(i => i.id === tab)!;

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("portal-dark");
    if (saved !== null) return saved === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("portal-dark", next ? "1" : "0");
      document.documentElement.classList.toggle("portal-dark", next);
      document.documentElement.classList.remove("admin-dark");
      window.dispatchEvent(new CustomEvent("portal-dark-change", { detail: next }));
      return next;
    });
  }

  return (
    <div className={`flex min-h-screen${darkMode ? " portal-dark" : ""}`} style={{ background: C.bgPage, color: C.text2 }}>

      {/* ── 사이드바 (데스크톱) ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-white"
        style={{ width: 240, borderRight: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 px-6 py-5">
          <img src="/logo.png" alt="로고" className="shrink-0" style={{ height: 28, width: "auto", maxWidth: 160, objectFit: "contain" }} />
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, icon, label, href }) => href ? (
            <a key={id} href={href}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left text-sm transition-colors"
              style={{ borderLeft: "2px solid transparent", color: C.text3, fontWeight: 500, textDecoration: "none" }}>
              <Icon n={icon} s={16} />
              {label}
            </a>
          ) : (
            <button key={id} onClick={() => setTab(id as Tab)}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left text-sm transition-colors"
              style={{
                borderLeft: `2px solid ${tab === id ? C.brand : "transparent"}`,
                color:      tab === id ? C.text1 : C.text3,
                fontWeight: tab === id ? 600     : 500,
              }}>
              <Icon n={icon} s={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium w-full hover:brightness-105 transition-all"
            style={{ borderRadius: 10, background: C.brand }}>
            <Icon n="msg" s={14} /> IT 지원 문의
          </a>
          <div className="mt-3 flex items-center justify-center gap-3">
            <a href="/admin"
              className="text-center text-xs hover:underline transition-colors"
              style={{ color: C.text4 }}>관리자</a>
            <span style={{ color: C.border }}>·</span>
            <button onClick={toggleDark}
              className="flex items-center gap-1 text-xs hover:underline transition-colors"
              style={{ color: C.text4 }}
              title={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}>
              {darkMode ? "라이트 모드" : "다크 모드"}
            </button>
          </div>
        </div>
      </aside>

      {/* ── 모바일 상단 헤더 ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 bg-white/90"
        style={{ height: 52, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)" }}>
        <img src="/logo.png" alt="로고" className="mr-3 shrink-0" style={{ height: 22, width: "auto", maxWidth: 120, objectFit: "contain" }} />
        <span className="font-medium text-sm" style={{ color: C.text1 }}>{currentNav.label}</span>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 lg:ml-[240px] min-h-screen pb-20 lg:pb-10 pt-14 lg:pt-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
          {tab === "home"      && <HomeTab onNavigate={setTab} />}
          {tab === "education" && <EducationTab />}
          {tab === "search"    && <SearchTab />}
        </div>
      </main>

      {/* ── 모바일 바텀 네비 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-50 bg-white"
        style={{ height: 64, borderTop: `1px solid ${C.border}` }}>
        {NAV_ITEMS.map(({ id, icon, short, href }) => href ? (
          <a key={id} href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: C.text4, textDecoration: "none" }}>
            <Icon n={icon} s={18} />
            <span style={{ fontSize: 9.5, fontWeight: 500 }}>{short}</span>
          </a>
        ) : (
          <button key={id} onClick={() => setTab(id as Tab)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: tab === id ? C.brand : C.text4 }}>
            <Icon n={icon} s={18} />
            <span style={{ fontSize: 9.5, fontWeight: 500 }}>{short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   홈 탭 — 에디토리얼: 큰 타이포 헤드라인 + 번호형 링크 + 얇은 보더
══════════════════════════════════════════════════════ */
function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch("/api/notices")
      .then(r => safeJson(r))
      .then(res => setNotices(res.data ?? []));
  }, []);

  const DEADLINES = [
    { deadline: "2026-03-31", label: "보안 교육 마감" },
    { deadline: "2026-06-30", label: "자산 실사 마감" },
  ];
  const nearest = [...DEADLINES].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
  const other = DEADLINES.find(d => d !== nearest)!;

  const SHORTCUTS: { tab: Tab | null; href?: string; title: string; desc: string }[] = [
    { tab: "education", title: "교육 센터", desc: "필수 이수 교육 및 SW 활용 자료" },
    { tab: "search",    title: "SW 검색",   desc: "승인·금지 SW 여부 즉시 확인" },
    { tab: null, href: "/resources",   title: "자료실",   desc: "설치 가이드, 정책 지침, 양식 서식" },
    { tab: null, href: "/declaration", title: "자산 실사", desc: "소프트웨어 자산 현황 신고하기" },
  ];

  return (
    <div className="fade-in grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
    <div className="xl:col-span-2">

      {/* 헤드라인 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-7">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-bold leading-[1.25] mb-3" style={{ color: C.text1, letterSpacing: "-0.01em" }}>
            오늘도 안전하게<br />SW 자산을 관리하세요
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: C.text3 }}>
            승인된 SW인지 확인하고, 실사를 완료해 컴플라이언스를 지켜주세요.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-xs mb-1" style={{ color: C.text4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{nearest.label}</p>
          <p className="text-[34px] font-bold leading-none" style={{ color: C.brand }}>{calcDday(nearest.deadline)}</p>
          <p className="text-xs mt-1.5" style={{ color: C.text4 }}>{other.label} {calcDday(other.deadline)}</p>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.border}` }} className="mb-7" />

      {/* 번호형 바로가기 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-8">
        {SHORTCUTS.map((s, i) => {
          const inner = (
            <>
              <span className="text-xl font-bold shrink-0" style={{ color: C.index, fontFeatureSettings: "'tnum'" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-[15px] font-semibold" style={{ color: C.text1 }}>{s.title}</span>
                <span className="block text-xs mt-0.5" style={{ color: C.text4 }}>{s.desc}</span>
              </span>
            </>
          );
          const cls = "flex items-baseline gap-3 text-left group";
          return s.href
            ? <a key={s.title} href={s.href} className={cls} style={{ textDecoration: "none" }}>{inner}</a>
            : <button key={s.title} onClick={() => s.tab && onNavigate(s.tab)} className={cls}>{inner}</button>;
        })}
      </div>

      <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium hover:brightness-105 transition-all"
        style={{ borderRadius: 10, background: C.brand, textDecoration: "none" }}>
        <Icon n="msg" s={14} /> IT 지원 문의하기
      </a>
    </div>

    {/* 공지사항 — 오른쪽 사이드레일 */}
    <div className="xl:sticky xl:top-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: C.text1 }}>공지사항</span>
        {notices.length > 0 && (
          <span className="text-xs" style={{ color: C.text4 }}>{notices.length}건</span>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }} />
      <div className="xl:max-h-[480px] xl:overflow-y-auto">
        {notices.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: C.text3 }}>등록된 공지사항이 없습니다</p>
            <p className="text-xs mt-0.5" style={{ color: C.text4 }}>새 소식이 있으면 이곳에 표시됩니다</p>
          </div>
        ) : notices.map(n => (
          <div key={n.id} className="py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold"
                style={{ color: n.urgent ? "var(--state-risk)" : C.text4 }}>
                {n.urgent ? "긴급" : "안내"}
              </span>
              <span className="text-[11px]" style={{ color: C.text4 }}>{n.date}</span>
            </div>
            <p className="text-sm" style={{ color: C.text2 }}>{n.title}</p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   교육 센터 탭
══════════════════════════════════════════════════════ */
function courseBadge(deadline: string): { text: string; bg: string; color: string } {
  if (!deadline) return { text: "NEW", bg: "var(--state-neutral-soft)", color: C.text3 };
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { text: "마감", bg: "var(--state-neutral-soft)", color: C.text4 };
  if (diff <= 7) return { text: `D-${diff}`, bg: "var(--state-risk-soft)", color: "var(--state-risk)" };
  if (diff <= 30) return { text: `D-${diff}`, bg: "var(--state-caution-soft)", color: "var(--state-caution)" };
  return { text: "진행중", bg: "var(--state-positive-soft)", color: "var(--state-positive)" };
}

/* "■" 구분 목록형 콘텐츠와 긴 평문을 모두 안전하게 표시 (긴 텍스트로 카드가 무너지는 문제 방지) */
function CourseDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const bulletItems = text.split("■").map(s => s.trim()).filter(Boolean);
  const isBulletList = bulletItems.length > 1;

  if (isBulletList) {
    const shown = expanded ? bulletItems : bulletItems.slice(0, 3);
    return (
      <div className="flex-1 mb-4">
        <ul className="space-y-1.5">
          {shown.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.text3 }}>
              <span className="shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: C.text4 }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {bulletItems.length > 3 && (
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="text-xs font-semibold mt-2 hover:underline" style={{ color: C.brand }}>
            {expanded ? "간략히 보기 ▲" : `${bulletItems.length - 3}개 항목 더 보기 ▼`}
          </button>
        )}
      </div>
    );
  }

  const isLong = text.length > 140;
  return (
    <div className="flex-1 mb-4">
      <p className={`text-sm leading-relaxed ${!expanded && isLong ? "line-clamp-4" : ""}`} style={{ color: C.text3 }}>
        {text}
      </p>
      {isLong && (
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="text-xs font-semibold mt-1.5 hover:underline" style={{ color: C.brand }}>
          {expanded ? "간략히 보기 ▲" : "더 보기 ▼"}
        </button>
      )}
    </div>
  );
}

function EducationTab() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetch("/api/courses")
      .then(r => safeJson(r))
      .then(res => setCourses(res.data ?? []));
  }, []);

  const required  = courses.filter(c => c.category === "required");
  const materials = courses.filter(c => c.category === "material");
  const policy    = courses.filter(c => c.category === "policy");

  return (
    <div className="fade-in">
      <div className="mb-9">
        <h1 className="text-[28px] sm:text-[32px] font-bold mb-2" style={{ color: C.text1, letterSpacing: "-0.01em" }}>교육 센터</h1>
        <p className="text-sm" style={{ color: C.text3 }}>소프트웨어 자산 관리 및 IT 보안 지침을 학습하세요.</p>
      </div>

      {/* 필수 교육 */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-5 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h2 className="text-lg font-semibold" style={{ color: C.text1 }}>필수 교육</h2>
          <span className="text-xs" style={{ color: C.text4 }}>{required.length}개 과정</span>
        </div>
        {required.length === 0 ? (
          <div className="text-center py-12" style={{ color: C.text4 }}>
            등록된 교육 과정이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {required.map(c => {
              const badge = courseBadge(c.deadline);
              return (
                <div key={c.id} className="bg-white p-5 flex flex-col hover:border-[var(--portal-text-4)] transition-colors"
                  style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                  </div>
                  <h3 className="text-base font-semibold leading-snug mb-2.5" style={{ color: C.text1 }}>{c.title}</h3>
                  {c.description && <CourseDescription text={c.description} />}
                  <div className="flex items-center gap-3 mb-4 text-xs" style={{ color: C.text4 }}>
                    {c.duration && <span>{c.duration}</span>}
                    {c.deadline && <span>{c.deadline}</span>}
                  </div>
                  {c.courseUrl && c.courseUrl !== "#" ? (
                    <a href={c.courseUrl} target="_blank" rel="noopener noreferrer"
                      className="w-full py-2.5 font-medium text-sm text-white text-center block hover:brightness-105 transition-all"
                      style={{ borderRadius: 10, background: C.brand }}>
                      교육 시작하기 →
                    </a>
                  ) : (
                    <button disabled className="w-full py-2.5 font-medium text-sm"
                      style={{ borderRadius: 10, background: C.bg, color: C.text4 }}>
                      준비 중
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SW 활용 자료 */}
      {materials.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-5 pb-3" style={{ color: C.text1, borderBottom: `1px solid ${C.border}` }}>SW 활용 자료</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {materials.map(m => (
              <a key={m.id} href={m.courseUrl && m.courseUrl !== "#" ? m.courseUrl : undefined}
                target="_blank" rel="noopener noreferrer"
                className="p-4 flex items-start gap-3.5 hover:border-[var(--portal-text-4)] transition-colors"
                style={{ borderRadius: 12, border: `1px solid ${C.border}`, textDecoration: "none" }}>
                {m.thumbnailUrl && (
                  <img src={m.thumbnailUrl} alt="" className="w-11 h-11 shrink-0 object-cover" style={{ borderRadius: 8 }} />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm block mb-1" style={{ color: C.text1 }}>{m.title}</span>
                  {m.description && (
                    <span className="text-xs leading-relaxed line-clamp-2" style={{ color: C.text3 }}>{m.description}</span>
                  )}
                  {m.courseUrl && m.courseUrl !== "#" && (
                    <span className="text-xs font-semibold mt-1.5 block" style={{ color: C.brand }}>자세히 보기 →</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* IT 정책 교육 */}
      {policy.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-end mb-5 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <h2 className="text-lg font-semibold" style={{ color: C.text1 }}>IT 정책 교육</h2>
            <span className="text-xs" style={{ color: C.text4 }}>{policy.length}개 과정</span>
          </div>
          <div>
            {policy.map((p, idx) => (
              <div key={p.id} className="flex items-start gap-5 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
                <span className="text-xl font-bold shrink-0" style={{ color: C.index }}>{String(idx + 1).padStart(2, "0")}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold leading-snug mb-2" style={{ color: C.text1 }}>{p.title}</h3>
                  {p.description && <CourseDescription text={p.description} />}
                  <div className="flex items-center gap-3 flex-wrap">
                    {p.duration && <span className="text-xs" style={{ color: C.text4 }}>{p.duration}</span>}
                    {p.courseUrl && p.courseUrl !== "#" && (
                      <a href={p.courseUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold hover:underline transition-all"
                        style={{ color: C.brand }}>
                        상세 보기 →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-start gap-3 p-4" style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
        <Icon n="info" s={18} />
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: C.text1 }}>교육 이수 확인 안내</p>
          <p className="text-sm" style={{ color: C.text3 }}>
            모든 동영상 시청 및 퀴즈 완료 후 &apos;완료 확인&apos; 버튼을 클릭해야 이수 처리가 완료됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   SW 검색 탭
══════════════════════════════════════════════════════ */
const QUICK_SEARCHES = ["LibreOffice", "7-Zip", "VLC", "GIMP", "VSCode", "uTorrent", "WinRAR", "TeamViewer"];

function catStyle() {
  return { bg: "var(--state-caution-soft)", color: "var(--state-caution)" };
}

function SearchTab() {
  const [items,    setItems]    = useState<SwItem[]>([]);
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"all" | "approved" | "banned" | "conditional">("all");
  const [selected, setSelected] = useState<SwItem | null>(null);
  const [catFilter, setCatFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/sw-db")
      .then(r => safeJson(r))
      .then(res => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const catCounts = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(s => {
      if (s.category) map.set(s.category, (map.get(s.category) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count }));
  }, [items]);

  const hasInput = query.trim().length >= 1 || filter !== "all" || catFilter !== "all";

  const filtered = hasInput ? items.filter(s => {
    if (filter !== "all" && s.status !== filter) return false;
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [s.name, s.vendor, s.category, ...s.alternatives].some(v => v.toLowerCase().includes(q));
  }) : [];

  const counts = {
    all:         items.length,
    approved:    items.filter(s => s.status === "approved").length,
    conditional: items.filter(s => s.status === "conditional").length,
    banned:      items.filter(s => s.status === "banned").length,
  };

  const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
    approved:    { color: "var(--state-positive)", bg: "var(--state-positive-soft)", border: "var(--state-positive)", label: "승인됨"  },
    conditional: { color: "var(--state-caution)",  bg: "var(--state-caution-soft)",  border: "var(--state-caution)",  label: "조건부"  },
    banned:      { color: "var(--state-risk)",     bg: "var(--state-risk-soft)",     border: "var(--state-risk)",     label: "금지됨"  },
  };

  const FILTER_LABELS: Record<string, string> = {
    all: "전체", approved: "승인됨", conditional: "조건부", banned: "금지됨",
  };

  return (
    <div className="fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-7 gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold mb-2" style={{ color: C.text1, letterSpacing: "-0.01em" }}>SW 검색</h1>
          <p className="text-sm" style={{ color: C.text3 }}>
            사내 승인된 SW와 사용이 금지된 SW 여부를 확인하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          {[
            { color: "var(--state-positive)", label: "승인됨"  },
            { color: "var(--state-caution)",  label: "조건부"  },
            { color: "var(--state-risk)",     label: "금지됨"  },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs font-medium" style={{ color: C.text3 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.text4 }}>
          <Icon n="search" s={18} />
        </span>
        <input
          className="w-full h-12 pl-11 pr-11 text-sm focus:outline-none bg-white"
          style={{
            color: C.text1, borderRadius: 10,
            border: `1px solid ${C.border}`, transition: "border-color 0.15s",
          }}
          onFocus={e  => (e.currentTarget.style.borderColor = C.brand)}
          onBlur={e   => (e.currentTarget.style.borderColor = C.border)}
          placeholder="소프트웨어명 검색... (예: Photoshop, Teams, 7-Zip)"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          autoFocus
        />
        {query && (
          <button className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-slate-600 transition-colors"
            style={{ color: C.text4 }}
            onClick={() => { setQuery(""); setFilter("all"); setCatFilter("all"); setSelected(null); }}>
            <Icon n="x" s={16} />
          </button>
        )}
      </div>

      {/* 상태 필터 칩 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["all", "approved", "conditional", "banned"] as const).map(key => (
          <button key={key} onClick={() => { setFilter(key); setSelected(null); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filter === key ? C.brand : C.bg,
              color:      filter === key ? "#fff"  : C.text3,
            }}>
            {FILTER_LABELS[key]}
            <span style={{ opacity: 0.6 }}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* 카테고리 필터 칩 */}
      {catCounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-7">
          <button
            onClick={() => { setCatFilter("all"); setSelected(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: catFilter === "all" ? C.brand : "transparent",
              color:      catFilter === "all" ? "#fff"  : C.text3,
              border: catFilter === "all" ? "none" : `1px solid ${C.border}`,
            }}>
            전체 <span style={{ opacity: 0.6 }}>{items.length}</span>
          </button>
          {catCounts.map(({ cat, count }) => (
            <button key={cat}
              onClick={() => { setCatFilter(cat); setSelected(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: catFilter === cat ? C.brand : "transparent",
                color:      catFilter === cat ? "#fff"  : C.text3,
                border: catFilter === cat ? "none" : `1px solid ${C.border}`,
              }}>
              {cat} <span style={{ opacity: 0.6 }}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20" style={{ color: C.text4 }}>불러오는 중...</div>

      ) : !hasInput ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 p-7" style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
            <h3 className="text-base font-semibold mb-5" style={{ color: C.text1 }}>
              빠른 검색
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {QUICK_SEARCHES.map(sw => (
                <button key={sw} onClick={() => setQuery(sw)}
                  className="px-3.5 py-2 text-sm font-medium hover:border-[var(--portal-text-4)] transition-colors"
                  style={{ color: C.text2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  {sw}
                </button>
              ))}
            </div>
          </div>
          <div className="p-7 flex flex-col" style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
            <h3 className="text-base font-semibold mb-1.5" style={{ color: C.text1 }}>카테고리 탐색</h3>
            <p className="text-xs mb-4" style={{ color: C.text4 }}>카테고리를 선택해 바로 확인하세요.</p>
            <div className="space-y-1 overflow-y-auto max-h-52">
              {catCounts.slice(0, 8).map(({ cat, count }) => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  className="flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--portal-bg)]"
                  style={{ borderRadius: 8, color: C.text2 }}>
                  <span>{cat}</span>
                  <span className="text-xs" style={{ color: C.text4 }}>{count}개</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      ) : (
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <h4 className="text-lg font-semibold mb-2" style={{ color: C.text1 }}>
                &apos;{query}&apos;에 대한 검색 결과가 없습니다
              </h4>
              <p className="text-sm mb-5" style={{ color: C.text4 }}>
                오타가 없는지 확인하거나 IT팀에 승인 요청을 보내세요.
              </p>
              <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderRadius: 10, border: `1px solid ${C.brand}`, color: C.brand }}>
                <Icon n="msg" s={14} /> IT팀에 사용 승인 요청하기
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: C.text4 }}>
                {filtered.length}개 결과{query && ` — "${query}"`}{catFilter !== "all" && ` — ${catFilter}`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(s => {
                  const ss = STATUS_STYLE[s.status];
                  const cs = catStyle();
                  const isOpen = selected?.id === s.id;
                  return (
                    <div key={s.id}
                      className="bg-white p-5 flex flex-col justify-between cursor-pointer transition-colors"
                      style={{ borderRadius: 12, border: isOpen ? `1px solid ${C.brand}` : `1px solid ${C.border}` }}
                      onClick={() => setSelected(isOpen ? null : s)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: cs.bg, color: cs.color }}>
                          {s.category.charAt(0)}
                        </div>
                        {ss && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                            style={{ color: ss.color, background: ss.bg }}>
                            {ss.label}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-base font-semibold mb-0.5" style={{ color: C.text1 }}>
                          {s.name}
                          {s.mandatory && (
                            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded align-middle"
                              style={{ background: C.bg, color: C.text3 }}>필수</span>
                          )}
                        </h4>
                        <p className="text-xs font-medium" style={{ color: C.text4 }}>{s.vendor}</p>
                        {s.description && (
                          <p className="text-xs mt-2 leading-relaxed line-clamp-3" style={{ color: C.text3 }}>{s.description}</p>
                        )}
                      </div>
                      <div className="mt-4 pt-4 flex items-center justify-between"
                        style={{ borderTop: `1px solid ${C.border}` }}>
                        <span className="text-xs" style={{ color: C.text4 }}>
                          {s.category}
                        </span>
                        <button className="text-xs font-semibold flex items-center gap-1" style={{ color: C.brand }}>
                          {isOpen ? "닫기 ▲" : "상세보기 →"}
                        </button>
                      </div>
                      {isOpen && ss && (
                        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                          {s.alternatives.length > 0 && (
                            <div className="mb-3 text-sm" style={{ color: C.text3 }}>
                              <span className="text-xs mr-1" style={{ color: C.text4 }}>대체 가능 SW:</span>
                              <span className="font-medium">{s.alternatives.join(", ")}</span>
                            </div>
                          )}
                          <div className="text-xs p-3" style={{ borderRadius: 10, background: ss.bg, color: ss.color }}>
                            {s.status === "approved"    && "사내 공식 승인된 소프트웨어입니다. 자유롭게 사용할 수 있습니다."}
                            {s.status === "banned"      && "사용이 금지된 소프트웨어입니다. 즉시 삭제하고 IT팀에 신고해주세요."}
                            {s.status === "conditional" && (
                              <span className="flex items-start justify-between gap-3">
                                <span>IT팀 사전 승인 후 사용 가능합니다.</span>
                                <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                                  className="font-semibold shrink-0 underline"
                                  onClick={e => e.stopPropagation()}>승인 요청 →</a>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 text-center py-6" style={{ borderTop: `1px solid ${C.border}` }}>
                <p className="text-sm mb-3" style={{ color: C.text3 }}>원하는 SW를 찾지 못하셨나요?</p>
                <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ borderRadius: 10, border: `1px solid ${C.brand}`, color: C.brand }}>
                  <Icon n="msg" s={14} /> IT팀에 문의하기 →
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

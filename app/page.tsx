"use client";

import { useEffect, useState } from "react";
import type { SwItem } from "@/types";
import type { Notice, Course, Resource, ResourceCategory } from "@/types/portal";
import DeclarationPanel from "@/components/DeclarationPanel";

type Tab    = "home" | "education" | "resources" | "search" | "declaration";
type ResTab = ResourceCategory | "all";

const INQUIRY_URL = "https://assetify-desk.vercel.app/inquiry";

/* ── 색상 토큰 (3종으로 통일) ── */
const C = {
  brand:       "#1E3A8A",
  primary:     "#2563EB",
  primarySoft: "#EFF6FF",
  text1:       "#0f172a",
  text2:       "#334155",
  text3:       "#64748b",
  text4:       "#94a3b8",
  border:      "#E2E8F0",
  bg:          "#f0f4f8",
  bgPage:      "#f6fafe",
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
  { id: "home"        as Tab, icon: "home",   label: "홈",       short: "홈"    },
  { id: "education"   as Tab, icon: "edu",    label: "교육 센터", short: "교육"  },
  { id: "resources"   as Tab, icon: "folder", label: "자료실",    short: "자료실" },
  { id: "search"      as Tab, icon: "search", label: "SW 검색",   short: "SW"   },
  { id: "declaration" as Tab, icon: "clip",   label: "자산 실사",  short: "실사"  },
];

/* ══════════════════════════════════════════════════════
   포털 메인
══════════════════════════════════════════════════════ */
export default function PortalPage() {
  const [tab, setTab] = useState<Tab>("home");
  const currentNav = NAV_ITEMS.find(i => i.id === tab)!;

  return (
    <div className="flex min-h-screen" style={{ background: C.bgPage, color: C.text2 }}>

      {/* ── 사이드바 (데스크톱) ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-white"
        style={{ width: 240, borderRight: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-center shrink-0 text-white font-black text-xs"
            style={{ width: 38, height: 38, borderRadius: 10, background: C.primary }}>SW</div>
          <div>
            <div className="font-extrabold text-sm leading-tight" style={{ color: C.text1 }}>SW 자산관리 포털</div>
            <div className="text-xs" style={{ color: C.text4 }}>IT 자산관리파트</div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left text-sm transition-all"
              style={{
                borderRadius: 10,
                background: tab === id ? C.primarySoft : "transparent",
                color:      tab === id ? C.primary    : C.text3,
                fontWeight: tab === id ? 700           : 500,
              }}>
              <Icon n={icon} s={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-3 text-white text-sm font-bold w-full"
            style={{ borderRadius: 10, background: C.primary }}>
            <Icon n="msg" s={15} /> IT 지원 문의하기
          </a>
          {/* N4: opacity-0으로 숨긴 관리자 링크 */}
          <a href="/admin"
            className="mt-3 block text-center text-xs transition-opacity opacity-0 hover:opacity-100"
            style={{ color: C.text4 }}>관리자</a>
        </div>
      </aside>

      {/* ── C3: 모바일 상단 헤더 ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 bg-white/90"
        style={{ height: 52, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)" }}>
        <div className="flex items-center justify-center shrink-0 text-white font-black text-[10px] mr-3"
          style={{ width: 28, height: 28, borderRadius: 7, background: C.primary }}>SW</div>
        <span className="font-bold text-sm" style={{ color: C.text1 }}>{currentNav.label}</span>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 lg:ml-[240px] min-h-screen pb-20 lg:pb-10 pt-14 lg:pt-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {tab === "home"        && <HomeTab onNavigate={setTab} />}
          {tab === "education"   && <EducationTab />}
          {tab === "resources"   && <ResourcesTab />}
          {tab === "search"      && <SearchTab />}
          {tab === "declaration" && <DeclarationPanel />}
        </div>
      </main>

      {/* ── 모바일 바텀 네비 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-50 bg-white"
        style={{ height: 64, borderTop: `1px solid ${C.border}` }}>
        {NAV_ITEMS.map(({ id, icon, short }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: tab === id ? C.primary : C.text4 }}>
            {/* N1: uppercase 제거 */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: tab === id ? C.primarySoft : "transparent" }}>
              <Icon n={icon} s={17} />
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600 }}>{short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   홈 탭
══════════════════════════════════════════════════════ */
function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch("/api/notices")
      .then(r => r.json())
      .then(res => setNotices(res.data ?? []));
  }, []);

  /* M5: 4개 균형 그리드 (자산 실사 추가) */
  const SHORTCUTS = [
    { tab: "education"   as Tab, icon: "edu",    title: "교육 센터", desc: "필수 이수 교육 및 SW 활용 자료",   bg: "#F3E8FF", color: "#7C3AED" },
    { tab: "resources"   as Tab, icon: "folder", title: "자료실",    desc: "설치 가이드, 정책 지침, 양식 서식", bg: "#FEF3C7", color: "#D97706" },
    { tab: "search"      as Tab, icon: "search", title: "SW 검색",   desc: "승인·금지 SW 여부 즉시 확인",      bg: "#DBEAFE", color: "#2563EB" },
    { tab: "declaration" as Tab, icon: "clip",   title: "자산 실사", desc: "소프트웨어 자산 현황 신고하기",     bg: "#D1FAE5", color: "#059669" },
  ];

  return (
    <div className="fade-in">
      {/* 히어로 */}
      <div className="rounded-[20px] text-white relative overflow-hidden mb-8 px-8 sm:px-10 py-10"
        style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.primary} 60%, #3B82F6 100%)` }}>
        <div className="absolute rounded-full pointer-events-none opacity-5"
          style={{ width: 360, height: 360, top: -120, right: -80, background: "#fff" }} />
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: 200, height: 200, bottom: -80, left: "40%", background: "rgba(255,255,255,0.04)" }} />

        <div className="relative flex flex-col sm:flex-row items-start justify-between gap-8">
          <div className="flex-1">
            <div className="text-3xl font-extrabold mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
              안녕하세요 👋
            </div>
            <div className="text-sm opacity-80 leading-relaxed mb-7 max-w-md">
              SW 자산관리 포털에 오신 것을 환영합니다.<br />
              SW 사용 정책을 확인하고 필요한 교육 자료를 이용하세요.
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => onNavigate("search")}
                className="flex items-center gap-2 font-extrabold text-sm px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
                style={{ background: "#fff", color: C.primary }}>
                <Icon n="search" s={14} /> SW 정책 확인하기
              </button>
              <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 font-semibold text-sm px-5 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }}>
                <Icon n="msg" s={14} /> IT 지원 문의
              </a>
            </div>
          </div>

          {/* M4: D-day 동적 계산 */}
          <div className="flex sm:flex-col gap-3 shrink-0">
            {[
              { deadline: "2026-03-31", label: "보안 교육 마감" },
              { deadline: "2026-06-30", label: "자산 실사 마감" },
            ].map(c => (
              <div key={c.label} className="text-center px-5 py-4 rounded-[16px]"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.12)", minWidth: 130 }}>
                <div className="text-2xl font-extrabold" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {calcDday(c.deadline)}
                </div>
                <div className="text-xs font-bold opacity-85 mt-1">{c.label}</div>
                <div className="text-xs opacity-50 mt-0.5">{c.deadline}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* M5: 4개 균형 바로가기 */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {SHORTCUTS.map(s => (
          <button key={s.tab} onClick={() => onNavigate(s.tab)}
            className="bg-white text-left rounded-[20px] p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            style={{ border: `1px solid ${C.border}` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3.5"
              style={{ background: s.bg, color: s.color }}>
              <Icon n={s.icon} s={22} />
            </div>
            <div className="font-extrabold text-sm mb-1.5"
              style={{ color: C.text1, fontFamily: "Manrope, sans-serif" }}>{s.title}</div>
            <div className="text-xs leading-relaxed" style={{ color: C.text3 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* M5: IT 지원 문의 — 별도 CTA 행 */}
      <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-4 bg-white rounded-[20px] px-6 py-5 mb-7 hover:shadow-md transition-all"
        style={{ border: `1px solid ${C.border}` }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: C.primarySoft, color: C.primary }}>
          <Icon n="msg" s={20} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm" style={{ color: C.text1 }}>IT 지원 문의하기</div>
          <div className="text-xs mt-0.5" style={{ color: C.text3 }}>SW 신청, 오류 신고, 기타 문의</div>
        </div>
        <span style={{ color: C.text4 }}><Icon n="chevron" s={16} /></span>
      </a>

      {/* 공지사항 */}
      <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 font-bold text-sm"
            style={{ color: C.text1, fontFamily: "Manrope, sans-serif" }}>
            <Icon n="bell" s={15} /> 공지사항
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: C.bg, color: C.text3 }}>{notices.length}건</span>
        </div>
        <div>
          {notices.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm" style={{ color: C.text4 }}>
              등록된 공지사항이 없습니다.
            </div>
          ) : notices.map(n => (
            <div key={n.id} className="flex items-center gap-3.5 px-6 py-3.5"
              style={{ borderBottom: "1px solid #f8fafc" }}>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                style={n.urgent
                  ? { background: "#FEE2E2", color: "#DC2626" }
                  : { background: "#f1f5f9", color: C.text3 }}>
                {n.urgent ? "긴급" : "안내"}
              </span>
              <span className="text-sm flex-1" style={{ color: C.text2 }}>{n.title}</span>
              <span className="text-xs shrink-0 hidden sm:block" style={{ color: C.text4 }}>{n.date}</span>
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
  if (!deadline) return { text: "NEW", bg: "#E2E8F0", color: "#475569" };
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { text: "마감", bg: "#E2E8F0", color: "#64748b" };
  if (diff <= 7) return { text: `D-${diff}`, bg: "#FECACA", color: "#B91C1C" };
  if (diff <= 30) return { text: `D-${diff}`, bg: "#FDE68A", color: "#B45309" };
  return { text: "진행중", bg: "#D1FAE5", color: "#065F46" };
}

function EducationTab() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetch("/api/courses")
      .then(r => r.json())
      .then(res => setCourses(res.data ?? []));
  }, []);

  const required  = courses.filter(c => c.category === "required");
  const materials = courses.filter(c => c.category === "material");
  const policy    = courses.filter(c => c.category === "policy");

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight mb-2"
          style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>교육 센터</h2>
        <p className="text-sm" style={{ color: C.text3 }}>소프트웨어 자산 관리 및 IT 보안 지침을 학습하세요.</p>
      </div>

      {/* 필수 교육 */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-6">
          <h3 className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif" }}>필수 교육</h3>
          <span className="text-sm font-semibold" style={{ color: C.primary }}>{required.length}개 과정</span>
        </div>
        {required.length === 0 ? (
          <div className="text-center py-12 rounded-[20px]" style={{ background: C.bg, color: C.text4 }}>
            등록된 교육 과정이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {required.map(c => {
              const badge = courseBadge(c.deadline);
              return (
                <div key={c.id} className="bg-white p-6 rounded-[20px] hover:-translate-y-1 transition-all"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                  <div className="flex justify-between items-start mb-8">
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                    <span style={{ color: C.text3 }}><Icon n="shield" s={28} /></span>
                  </div>
                  <h4 className="text-base font-bold leading-tight mb-2"
                    style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>{c.title}</h4>
                  {c.description && (
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: C.text4 }}>{c.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4 text-sm" style={{ color: C.text3 }}>
                    {c.duration && <span>⏱ {c.duration}</span>}
                    {c.deadline && <span>📅 {c.deadline}</span>}
                  </div>
                  {c.courseUrl ? (
                    <a href={c.courseUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-6 w-full py-3.5 rounded-xl font-bold text-sm text-white text-center block hover:brightness-110 transition-all"
                      style={{ background: C.brand }}>
                      교육 시작하기
                    </a>
                  ) : (
                    <button disabled className="mt-6 w-full py-3.5 rounded-xl font-bold text-sm"
                      style={{ background: C.bg, color: C.text4 }}>
                      URL 미등록
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
          <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>SW 활용 자료</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {materials.map(m => (
              <a key={m.id} href={m.courseUrl || "#"} target="_blank" rel="noopener noreferrer"
                className="p-6 rounded-xl flex flex-col items-center text-center cursor-pointer transition-colors hover:bg-[#e4e9ed]"
                style={{ background: C.bg, textDecoration: "none" }}>
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mb-4"
                  style={{ color: C.brand }}>
                  {m.thumbnailUrl
                    ? <img src={m.thumbnailUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    : <Icon n="box" s={24} />}
                </div>
                <span className="font-bold text-sm" style={{ color: C.text1 }}>{m.title}</span>
                {m.description && (
                  <span className="text-xs mt-1 font-medium" style={{ color: C.text3 }}>{m.description}</span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* IT 정책 교육 */}
      {policy.length > 0 && (
        <section className="mb-10">
          <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>IT 정책 교육</h3>
          <div className="space-y-4">
            {policy.map(p => (
              <div key={p.id} className="rounded-[20px] overflow-hidden flex flex-col lg:flex-row"
                style={{ background: C.bg }}>
                {p.thumbnailUrl && (
                  <div className="lg:w-1/2 h-56 lg:h-auto overflow-hidden">
                    <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={`${p.thumbnailUrl ? "lg:w-1/2" : "w-full"} p-8 flex flex-col justify-center`}>
                  <h4 className="text-2xl font-extrabold mb-4 leading-tight"
                    style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>{p.title}</h4>
                  {p.description && (
                    <p className="text-sm leading-relaxed mb-6" style={{ color: C.text3 }}>{p.description}</p>
                  )}
                  {p.courseUrl && (
                    <a href={p.courseUrl} target="_blank" rel="noopener noreferrer"
                      className="self-start px-8 py-4 rounded-xl text-white font-bold hover:shadow-lg transition-shadow"
                      style={{ background: C.brand }}>
                      정책 상세 보기
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="p-5 rounded-[16px] flex items-center gap-5"
        style={{ background: `${C.brand}0d`, border: `1px solid ${C.brand}1a` }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: C.brand }}>
          <Icon n="info" s={20} />
        </div>
        <div>
          <h4 className="font-bold mb-0.5" style={{ color: C.text1 }}>교육 이수 확인 안내</h4>
          <p className="text-sm" style={{ color: C.text3 }}>
            모든 동영상 시청 및 퀴즈 완료 후 &apos;완료 확인&apos; 버튼을 클릭해야 이수 처리가 완료됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   자료실 탭
══════════════════════════════════════════════════════ */
const CATEGORY_LABEL: Record<string, string> = {
  install:   "설치 가이드",
  installer: "설치 파일",
  patch:     "패치 파일",
  policy:    "정책 문서",
  forms:     "양식 서식",
  other:     "기타",
};

function ResourcesTab() {
  const [resTab,    setResTab]    = useState<ResTab>("all");
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    fetch("/api/resources")
      .then(r => r.json())
      .then(res => setResources(res.data ?? []));
  }, []);

  const FILES = resTab === "all" ? resources : resources.filter(r => r.category === resTab);

  const RECENT_TWO = [...resources]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 2);

  const FILE_STYLE: Record<string, { bg: string; color: string }> = {
    PDF:  { bg: "#FEE2E2", color: "#B91C1C" },
    XLSX: { bg: "#D1FAE5", color: "#065F46" },
    DOCX: { bg: "#DBEAFE", color: "#1E40AF" },
  };

  const RES_TABS: { key: ResTab; label: string }[] = [
    { key: "all",       label: "전체"     },
    { key: "install",   label: "설치 가이드" },
    { key: "installer", label: "설치 파일"   },
    { key: "patch",     label: "패치 파일"   },
    { key: "policy",    label: "정책 문서"   },
    { key: "forms",     label: "양식 서식"   },
    { key: "other",     label: "기타"         },
  ];

  return (
    <div className="fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          {/* C1: "Archive Library" → "자료 아카이브" */}
          <p className="text-sm font-semibold tracking-wider uppercase mb-1" style={{ color: C.primary }}>
            자료 아카이브
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight"
            style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>자료실</h2>
        </div>
        <div className="flex p-1.5 rounded-xl" style={{ background: C.bg }}>
          {RES_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setResTab(key)}
              className="px-4 py-2.5 rounded-lg text-sm transition-all"
              style={{
                background: resTab === key ? "#fff" : "transparent",
                color:      resTab === key ? C.brand  : C.text3,
                fontWeight: resTab === key ? 700      : 500,
                boxShadow:  resTab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-4 space-y-5">
          {/* 최근 업데이트 */}
          <div className="p-8 rounded-[20px] text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.primary})` }}>
            <div className="relative z-10">
              <span className="block mb-4 opacity-75"><Icon n="box" s={32} /></span>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>최근 업데이트</h3>
              {RECENT_TWO.length === 0 ? (
                <p className="text-sm leading-relaxed" style={{ color: "#90c0ff" }}>등록된 자료가 없습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {RECENT_TWO.map(f => (
                    <li key={f.id} className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.55)" }}>
                        {CATEGORY_LABEL[f.category] ?? f.category} · {f.updatedAt}
                      </span>
                      <span className="text-sm font-semibold leading-snug" style={{ color: "#fff" }}>
                        {f.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* M3: Storage 위젯 → 사용자 관련 현황 */}
          <div className="p-8 rounded-[20px]" style={{ background: C.bg }}>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: C.text3 }}>
              이번 달 현황
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: C.text3 }}>현재 탭 자료</span>
                <span className="text-xl font-extrabold"
                  style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>
                  {FILES.length}<span className="text-sm font-normal ml-0.5" style={{ color: C.text3 }}>건</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: C.text3 }}>총 자료 수</span>
                <span className="text-sm font-bold" style={{ color: C.text2 }}>{resources.length}건</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-8">
          {/* C1: "Recent Files" → "파일 목록" */}
          <div className="flex items-center justify-between px-1 mb-4">
            <h3 className="text-lg font-bold" style={{ fontFamily: "Manrope, sans-serif" }}>파일 목록</h3>
          </div>
          <div className="space-y-3">
            {FILES.length === 0 ? (
              <div className="text-center py-12 rounded-[16px]" style={{ background: C.bg, color: C.text4 }}>
                등록된 자료가 없습니다.
              </div>
            ) : FILES.map(file => {
              const fs = FILE_STYLE[file.fileType] ?? { bg: C.bg, color: C.text3 };
              return (
                <div key={file.id}
                  className="bg-white p-5 rounded-[16px] flex items-center justify-between hover:shadow-md transition-all"
                  style={{ border: `1px solid ${C.bg}` }}>
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: fs.bg, color: fs.color }}>
                      <Icon n="file" s={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm sm:text-base truncate" style={{ color: C.text1 }}>
                        {file.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: "#eaeef2", color: C.text3 }}>{file.fileType}</span>
                        {file.fileSize && <span className="text-xs" style={{ color: "#757682" }}>{file.fileSize}</span>}
                        {file.updatedAt && <span className="text-xs hidden sm:inline" style={{ color: "#757682" }}>· {file.updatedAt}</span>}
                      </div>
                    </div>
                  </div>
                  {file.fileUrl ? (
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 ml-3 transition-all"
                      style={{ background: C.bg, color: C.brand }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLAnchorElement).style.background = C.brand;
                        (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLAnchorElement).style.background = C.bg;
                        (e.currentTarget as HTMLAnchorElement).style.color = C.brand;
                      }}>
                      <Icon n="dl" s={16} />
                    </a>
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 ml-3"
                      style={{ background: C.bg, color: C.text4 }}>
                      <Icon n="dl" s={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <div className="p-6 rounded-[20px]"
              style={{ background: C.bg, border: "1px solid rgba(255,255,255,0.5)" }}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm"
                  style={{ color: C.text3 }}>
                  <Icon n="search" s={17} />
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded"
                  style={{ color: "#757682", background: "#e4e9ed" }}>문의하기</span>
              </div>
              <h5 className="font-bold text-lg mb-1"
                style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>자료가 없나요?</h5>
              <p className="text-sm mb-4" style={{ color: C.text3 }}>IT팀에 자료 추가 요청을 보내세요.</p>
              <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                className="text-sm font-bold flex items-center gap-1" style={{ color: C.brand }}>
                관리자에게 문의 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SW 검색 탭
══════════════════════════════════════════════════════ */
const QUICK_SEARCHES = ["Photoshop", "Teams", "Notion", "7-Zip", "ChatGPT", "VSCode", "Zoom", "Figma"];

/* N2: 카테고리별 색상 팔레트 */
const CAT_PALETTE = [
  { bg: "#EFF6FF", color: "#1D4ED8" },
  { bg: "#F0FDF4", color: "#15803D" },
  { bg: "#FDF4FF", color: "#7C3AED" },
  { bg: "#FFFBEB", color: "#D97706" },
  { bg: "#FFF1F2", color: "#E11D48" },
  { bg: "#F0FDFA", color: "#0F766E" },
  { bg: "#FEF3C7", color: "#92400E" },
];
function catStyle(cat: string) {
  const keyword: Record<string, number> = { 보안: 4, 협업: 0, 개발: 1, 디자인: 2, 생산성: 3, AI: 5 };
  for (const [k, i] of Object.entries(keyword)) {
    if (cat.includes(k)) return CAT_PALETTE[i];
  }
  return CAT_PALETTE[cat.charCodeAt(0) % CAT_PALETTE.length];
}

function SearchTab() {
  const [items,    setItems]    = useState<SwItem[]>([]);
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"all" | "approved" | "banned" | "conditional">("all");
  const [selected, setSelected] = useState<SwItem | null>(null);

  useEffect(() => {
    fetch("/api/sw-db")
      .then(r => r.json())
      .then(res => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const hasInput = query.trim().length >= 1 || filter !== "all";

  const filtered = hasInput ? items.filter(s => {
    if (filter !== "all" && s.status !== filter) return false;
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

  /* C1: 상태 레이블 한국어 */
  const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
    approved:    { color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", label: "✅ 승인됨"  },
    conditional: { color: "#78350f", bg: "#fffbeb", border: "#fde68a", label: "⚠️ 조건부"  },
    banned:      { color: "#7f1d1d", bg: "#fef2f2", border: "#fecaca", label: "🚫 금지됨"  },
  };

  /* C1: 필터 칩 레이블 */
  const FILTER_LABELS: Record<string, string> = {
    all: "전체", approved: "승인됨", conditional: "조건부", banned: "금지됨",
  };

  return (
    <div className="fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-2"
            style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>SW 검색</h2>
          <p className="text-lg" style={{ color: C.text3 }}>
            사내 승인된 SW와 사용이 금지된 SW 여부를 확인하세요.
          </p>
        </div>
        <div className="p-5 rounded-xl flex flex-wrap gap-5 items-center" style={{ background: C.bg }}>
          {[
            { color: "#22c55e", label: "승인됨"  },
            { color: "#f59e0b", label: "조건부"  },
            { color: "#ef4444", label: "금지됨"  },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative mb-8">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.text4 }}>
          <Icon n="search" s={20} />
        </span>
        <input
          className="w-full h-16 pl-14 pr-12 rounded-3xl text-lg focus:outline-none"
          style={{
            background: "#fff", color: C.text1,
            boxShadow: "0 12px 32px rgba(23,28,31,0.06)",
            border: "2px solid transparent", transition: "border-color 0.15s",
          }}
          onFocus={e  => (e.currentTarget.style.borderColor = C.primary)}
          onBlur={e   => (e.currentTarget.style.borderColor = "transparent")}
          placeholder="소프트웨어명 검색... (예: Photoshop, Teams, 7-Zip)"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          autoFocus
        />
        {query && (
          <button className="absolute right-5 top-1/2 -translate-y-1/2 hover:text-slate-600 transition-colors"
            style={{ color: C.text4 }}
            onClick={() => { setQuery(""); setFilter("all"); setSelected(null); }}>
            <Icon n="x" s={18} />
          </button>
        )}
      </div>

      {/* C1: 필터 칩 한국어 */}
      <div className="flex flex-wrap gap-3 mb-10">
        {(["all", "approved", "conditional", "banned"] as const).map(key => (
          <button key={key} onClick={() => { setFilter(key); setSelected(null); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
            style={{
              background: filter === key ? C.brand : "#e4e9ed",
              color:      filter === key ? "#fff"  : C.text3,
            }}>
            {FILTER_LABELS[key]}
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: filter === key ? "rgba(255,255,255,0.2)" : "#dfe3e7",
                color:      filter === key ? "#fff" : C.text3,
              }}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: C.text4 }}>불러오는 중...</div>

      ) : !hasInput ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* C1: "Quick Search" → "빠른 검색" */}
          <div className="md:col-span-2 p-8 rounded-3xl relative overflow-hidden" style={{ background: C.bg }}>
            <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-5 text-[120px]">⚡</div>
            <h3 className="text-xl font-bold mb-6 relative z-10" style={{ fontFamily: "Manrope, sans-serif" }}>
              빠른 검색
            </h3>
            <div className="flex flex-wrap gap-3 relative z-10">
              {QUICK_SEARCHES.map(sw => (
                <button key={sw} onClick={() => setQuery(sw)}
                  className="bg-white px-4 py-3 rounded-2xl hover:shadow-md transition-all text-sm font-semibold"
                  style={{ color: C.text1 }}>
                  {sw}
                </button>
              ))}
            </div>
          </div>
          {/* C1: "Browse by Category" → "카테고리 탐색" */}
          <div className="p-8 rounded-3xl text-white flex flex-col justify-between" style={{ background: C.brand }}>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>카테고리 탐색</h3>
              <p className="text-sm opacity-80">승인 여부를 카테고리별로 확인하세요.</p>
            </div>
            <div className="space-y-3 mt-6">
              {([
                { label: "승인 SW",   f: "approved"    as const },
                { label: "금지 SW",   f: "banned"      as const },
                { label: "조건부 SW", f: "conditional" as const },
              ]).map(({ label, f }) => (
                <button key={f} onClick={() => setFilter(f)}
                  className="flex items-center justify-between w-full p-3 rounded-xl text-sm font-medium transition-colors hover:bg-white/20"
                  style={{ background: "rgba(255,255,255,0.1)" }}>
                  <span>{label}</span>
                  <Icon n="chevron" s={14} />
                </button>
              ))}
            </div>
          </div>
        </div>

      ) : (
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">😕</div>
              <h4 className="text-lg font-extrabold mb-2"
                style={{ fontFamily: "Manrope, sans-serif", color: "#334155" }}>
                &apos;{query}&apos;에 대한 검색 결과가 없습니다
              </h4>
              <p className="text-sm mb-5" style={{ color: C.text4 }}>
                오타가 없는지 확인하거나 IT팀에 승인 요청을 보내세요.
              </p>
              <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border hover:bg-blue-50 transition-colors"
                style={{ borderColor: C.brand, color: C.brand }}>
                <Icon n="msg" s={14} /> IT팀에 사용 승인 요청하기
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm mb-5" style={{ color: C.text4 }}>
                {filtered.length}개 결과{query && ` — "${query}"`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map(s => {
                  const ss = STATUS_STYLE[s.status];
                  const cs = catStyle(s.category);
                  const isOpen = selected?.id === s.id;
                  return (
                    <div key={s.id}
                      className="bg-white p-6 rounded-3xl flex flex-col justify-between cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                      style={{ border: isOpen ? `2px solid ${C.brand}` : `1px solid ${C.bg}` }}
                      onClick={() => setSelected(isOpen ? null : s)}>
                      <div className="flex justify-between items-start mb-6">
                        {/* N2: 카테고리별 색상 아바타 */}
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black"
                          style={{ background: cs.bg, color: cs.color }}>
                          {s.category.charAt(0)}
                        </div>
                        {ss && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold border"
                            style={{ color: ss.color, borderColor: ss.border + "80" }}>
                            {ss.label}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold mb-1"
                          style={{ fontFamily: "Manrope, sans-serif", color: C.brand }}>
                          {s.name}
                          {s.mandatory && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold align-middle">
                              필수
                            </span>
                          )}
                        </h4>
                        <p className="text-sm font-medium" style={{ color: C.text3 }}>{s.vendor}</p>
                        {s.description && (
                          <p className="text-xs mt-1 truncate" style={{ color: C.text4 }}>{s.description}</p>
                        )}
                      </div>
                      <div className="mt-5 pt-5 flex items-center justify-between"
                        style={{ borderTop: `1px solid ${C.bg}` }}>
                        <span className="text-xs px-2 py-1 rounded" style={{ background: "#eaeef2", color: C.text3 }}>
                          {s.category}
                        </span>
                        <button className="text-sm font-bold flex items-center gap-1" style={{ color: C.primary }}>
                          {isOpen ? "닫기 ▲" : "상세보기 →"}
                        </button>
                      </div>
                      {isOpen && ss && (
                        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.bg}` }}>
                          {s.alternatives.length > 0 && (
                            <div className="mb-3 text-sm" style={{ color: C.text3 }}>
                              <span className="text-xs mr-1" style={{ color: C.text4 }}>대체 가능 SW:</span>
                              <span className="font-medium">{s.alternatives.join(", ")}</span>
                            </div>
                          )}
                          <div className="text-xs p-3.5 rounded-xl"
                            style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                            {s.status === "approved"    && "✅ 사내 공식 승인된 소프트웨어입니다. 자유롭게 사용할 수 있습니다."}
                            {s.status === "banned"      && "🚫 사용이 금지된 소프트웨어입니다. 즉시 삭제하고 IT팀에 신고해주세요."}
                            {s.status === "conditional" && (
                              <span className="flex items-start justify-between gap-3">
                                <span>⚠️ IT팀 사전 승인 후 사용 가능합니다.</span>
                                <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                                  className="font-bold shrink-0 underline"
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border font-bold text-sm hover:bg-blue-50 transition-colors"
                  style={{ borderColor: C.brand, color: C.brand }}>
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

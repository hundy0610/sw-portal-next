"use client";

import { useEffect, useState } from "react";
import type { SwItem } from "@/types";
import type { Notice, Course, Resource, ResourceCategory } from "@/types/portal";
import DeclarationPanel from "@/components/DeclarationPanel";

type Tab    = "home" | "education" | "resources" | "search" | "declaration";
type ResTab = ResourceCategory;

const INQUIRY_URL = "https://assetify-desk.vercel.app/inquiry";

/* ── 색상 토큰 — 그룹웨어(Bearworld/idsTrust) 기준 통일 ── */
const C = {
  brand:       "#B85510",   /* 오렌지 딥 */
  primary:     "#F47C20",   /* 브랜드 오렌지 */
  primaryDark: "#D9690F",   /* 호버 오렌지 */
  primarySoft: "#FEF4EC",   /* 연한 오렌지 틴트 */
  primarySoft2:"#FFF9F5",   /* 아주 연한 오렌지 */
  text1:       "#1A1A1A",   /* 헤딩 */
  text2:       "#3D3D3D",   /* 본문 */
  text3:       "#767676",   /* 보조 */
  text4:       "#AAAAAA",   /* 메타/힌트 */
  border:      "#E5E5E5",   /* 경계선 */
  borderLight: "#EFEFEF",   /* 약한 경계선 */
  bg:          "#F0F0F0",   /* 태그/칩 배경 */
  bgPage:      "#F5F6F8",   /* 페이지 배경 */
  surface:     "#FFFFFF",   /* 카드 표면 */
  sectionBg:   "#F9FAFB",   /* 섹션 배경 */
  success:     "#0D9488",
  successSoft: "#F0FDFA",
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
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-50"
        style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}` }}>

        {/* 로고 — 그룹웨어 스타일 */}
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: `1px solid ${C.borderLight}` }}>
          <div className="flex items-center justify-center shrink-0 text-white font-extrabold"
            style={{ width: 32, height: 32, borderRadius: 7, background: C.primary, fontSize: 10, letterSpacing: '-.3px' }}>SW</div>
          <div>
            <div className="font-bold text-[13px] leading-tight" style={{ color: C.text1 }}>SW 자산관리 포털</div>
            <div className="text-[11px] mt-0.5" style={{ color: C.text4 }}>IT 자산관리파트</div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 py-2 px-2 flex flex-col gap-px">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2.5 px-3 py-2.5 w-full text-left rounded-[6px] transition-all"
              style={{
                background: tab === id ? C.primarySoft : "transparent",
                color:      tab === id ? C.primary     : C.text3,
                fontWeight: tab === id ? 700            : 500,
                fontSize:   13.5,
                borderLeft: tab === id ? `2px solid ${C.primary}` : "2px solid transparent",
              }}>
              <Icon n={icon} s={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* 하단 CTA */}
        <div className="p-3" style={{ borderTop: `1px solid ${C.borderLight}` }}>
          <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 text-white text-[13px] font-bold w-full rounded-[7px] transition-all hover:opacity-90"
            style={{ background: C.primary, boxShadow: "0 2px 8px rgba(244,124,32,0.30)" }}>
            <Icon n="msg" s={14} /> IT 지원 문의하기
          </a>
          <a href="/admin"
            className="mt-2 block text-center text-[11px] py-1 opacity-0 hover:opacity-100 transition-opacity"
            style={{ color: C.text4 }}>관리자</a>
        </div>
      </aside>

      {/* ── 모바일 상단 헤더 ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4"
        style={{ height: 50, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-center shrink-0 text-white font-extrabold mr-3"
          style={{ width: 28, height: 28, borderRadius: 6, background: C.primary, fontSize: 10 }}>SW</div>
        <span className="font-bold text-[13px]" style={{ color: C.text1 }}>{currentNav.label}</span>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 lg:ml-[220px] min-h-screen pb-20 lg:pb-8 pt-[50px] lg:pt-0">
        <div className="max-w-[860px] mx-auto px-5 sm:px-6 py-6">
          {tab === "home"        && <HomeTab onNavigate={setTab} />}
          {tab === "education"   && <EducationTab />}
          {tab === "resources"   && <ResourcesTab />}
          {tab === "search"      && <SearchTab />}
          {tab === "declaration" && <DeclarationPanel />}
        </div>
      </main>

      {/* ── 모바일 바텀 네비 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-50"
        style={{ height: 58, background: C.surface, borderTop: `1px solid ${C.border}` }}>
        {NAV_ITEMS.map(({ id, icon, short }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: tab === id ? C.primary : C.text4 }}>
            <div className="flex items-center justify-center w-7 h-7 rounded-[6px] transition-all"
              style={{ background: tab === id ? C.primarySoft : "transparent" }}>
              <Icon n={icon} s={15} />
            </div>
            <span style={{ fontSize: 9, fontWeight: tab === id ? 700 : 500 }}>{short}</span>
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

  /* 바로가기 4개 — 그룹웨어 통일 오렌지 계열 */
  const SHORTCUTS = [
    { tab: "education"   as Tab, icon: "edu",    title: "교육 센터", desc: "필수 이수 교육 및 SW 활용 자료",   bg: "#FEF4EC", color: "#D9690F" },
    { tab: "resources"   as Tab, icon: "folder", title: "자료실",    desc: "설치 가이드, 정책 지침, 양식 서식", bg: "#FEF9EC", color: "#B45309" },
    { tab: "search"      as Tab, icon: "search", title: "SW 검색",   desc: "승인·금지 SW 여부 즉시 확인",      bg: "#EFF6FF", color: "#2563EB" },
    { tab: "declaration" as Tab, icon: "clip",   title: "자산 실사", desc: "소프트웨어 자산 현황 신고하기",     bg: "#F0FDF4", color: "#059669" },
  ];

  return (
    <div className="fade-in">
      {/* ── 히어로 배너 — 오렌지 브랜드 ── */}
      <div className="relative overflow-hidden rounded-[8px] text-white mb-5 px-7 py-8"
        style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.primary} 55%, #F5A042 100%)` }}>
        <div className="absolute pointer-events-none rounded-full"
          style={{ width: 280, height: 280, top: -90, right: -50, background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute pointer-events-none rounded-full"
          style={{ width: 160, height: 160, bottom: -55, left: '40%', background: 'rgba(255,255,255,0.05)' }} />

        <div className="relative flex flex-col sm:flex-row items-start justify-between gap-5">
          <div className="flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.65)' }}>idsTrust · IT 자산관리파트</p>
            <h1 className="text-[24px] font-extrabold mb-2 leading-tight tracking-tight">안녕하세요 👋</h1>
            <p className="text-[12.5px] leading-relaxed mb-5 max-w-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
              SW 사용 정책을 확인하고<br/>필요한 교육 자료를 이용하세요.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => onNavigate("search")}
                className="flex items-center gap-1.5 font-bold text-[12.5px] px-4 py-2.5 rounded-[6px] transition-all hover:opacity-90"
                style={{ background: C.surface, color: C.primary }}>
                <Icon n="search" s={12} /> SW 정책 확인
              </button>
              <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-semibold text-[12.5px] px-4 py-2.5 rounded-[6px] transition-all hover:bg-white/20"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}>
                <Icon n="msg" s={12} /> IT 지원 문의
              </a>
            </div>
          </div>

          {/* D-day 카운터 */}
          <div className="flex sm:flex-col gap-2 shrink-0">
            {[
              { deadline: "2026-03-31", label: "보안 교육 마감" },
              { deadline: "2026-06-30", label: "자산 실사 마감" },
            ].map(c => (
              <div key={c.label} className="text-center px-4 py-3 rounded-[6px]"
                style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.15)', minWidth: 110 }}>
                <div className="text-[21px] font-extrabold leading-none">{calcDday(c.deadline)}</div>
                <div className="text-[11px] font-medium mt-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{c.deadline}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 바로가기 4개 — 그룹웨어 카드 스타일 ── */}
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        {SHORTCUTS.map(s => (
          <button key={s.tab} onClick={() => onNavigate(s.tab)}
            className="text-left rounded-[8px] p-4.5 transition-all group"
            style={{ background: C.surface, border: `1px solid ${C.border}`,
              padding: '16px 18px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.primary; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(244,124,32,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
            <div className="w-9 h-9 rounded-[7px] flex items-center justify-center mb-2.5"
              style={{ background: s.bg, color: s.color }}>
              <Icon n={s.icon} s={17} />
            </div>
            <div className="font-bold text-[13px] mb-1" style={{ color: C.text1 }}>{s.title}</div>
            <div className="text-[11.5px] leading-relaxed" style={{ color: C.text3 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* ── IT 지원 문의 CTA ── */}
      <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-[8px] px-4 py-3.5 mb-4 transition-all"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.primary; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
        <div className="w-9 h-9 rounded-[7px] flex items-center justify-center shrink-0"
          style={{ background: C.primarySoft, color: C.primary }}>
          <Icon n="msg" s={17} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-[13px]" style={{ color: C.text1 }}>IT 지원 문의하기</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: C.text3 }}>SW 신청, 오류 신고, 기타 IT 문의</div>
        </div>
        <span style={{ color: C.text4 }}><Icon n="chevron" s={14} /></span>
      </a>

      {/* ── 공지사항 — 그룹웨어 테이블 스타일 ── */}
      <div className="rounded-[8px] overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.sectionBg }}>
          <div className="flex items-center gap-2 font-bold text-[13px]" style={{ color: C.text1 }}>
            <Icon n="bell" s={13} /> 공지사항
          </div>
          <button className="text-[11.5px] font-medium flex items-center gap-0.5" style={{ color: C.text4 }}>
            전체보기 <Icon n="chevron" s={12} />
          </button>
        </div>
        <div>
          {notices.length === 0 ? (
            <div className="px-4 py-7 text-center text-[13px]" style={{ color: C.text4 }}>
              등록된 공지사항이 없습니다.
            </div>
          ) : notices.map((n, idx) => (
            <div key={n.id} className="flex items-center gap-3 px-4 py-3 transition-colors"
              style={{ borderBottom: idx < notices.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.primarySoft2; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-[4px] shrink-0"
                style={n.urgent
                  ? { background: "#FEE2E2", color: "#DC2626" }
                  : { background: C.bg, color: C.text3 }}>
                {n.urgent ? "긴급" : "안내"}
              </span>
              <span className="text-[12.5px] flex-1 truncate" style={{ color: C.text2 }}>{n.title}</span>
              <span className="text-[11px] shrink-0 hidden sm:block" style={{ color: C.text4 }}>{n.date}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {required.map(c => {
              const badge = courseBadge(c.deadline);
              return (
                <div key={c.id} className="bg-white p-6 rounded-[20px] flex flex-col hover:-translate-y-1 transition-all"
                  style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: `1px solid ${C.border}` }}>
                  {/* 배지 + 아이콘 */}
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: C.primarySoft, color: C.primary }}>
                      <Icon n="shield" s={17} />
                    </div>
                  </div>
                  {/* 제목 */}
                  <h4 className="text-base font-bold leading-snug mb-3"
                    style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>{c.title}</h4>
                  {/* 설명 — 전체 표시 */}
                  {c.description && (
                    <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: C.text3 }}>{c.description}</p>
                  )}
                  {/* 메타 태그 */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {c.duration && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: C.bg, color: C.text3 }}>⏱ {c.duration}</span>
                    )}
                    {c.deadline && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: C.bg, color: C.text3 }}>📅 {c.deadline}</span>
                    )}
                  </div>
                  {/* 버튼 */}
                  {c.courseUrl && c.courseUrl !== "#" ? (
                    <a href={c.courseUrl} target="_blank" rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl font-bold text-sm text-white text-center block hover:brightness-110 transition-all"
                      style={{ background: C.brand }}>
                      교육 시작하기 →
                    </a>
                  ) : (
                    <button disabled className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ background: C.bg, color: C.text4 }}>
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
          <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>SW 활용 자료</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {materials.map(m => (
              <a key={m.id} href={m.courseUrl && m.courseUrl !== "#" ? m.courseUrl : undefined}
                target="_blank" rel="noopener noreferrer"
                className="bg-white p-5 rounded-[16px] flex items-start gap-4 hover:shadow-md transition-all"
                style={{ border: `1px solid ${C.border}`, textDecoration: "none" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: C.primarySoft, color: C.primary }}>
                  {m.thumbnailUrl
                    ? <img src={m.thumbnailUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                    : <Icon n="box" s={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm block mb-1" style={{ color: C.text1 }}>{m.title}</span>
                  {m.description && (
                    <span className="text-xs leading-relaxed line-clamp-2" style={{ color: C.text3 }}>{m.description}</span>
                  )}
                  {m.courseUrl && m.courseUrl !== "#" && (
                    <span className="text-xs font-bold mt-2 block" style={{ color: C.primary }}>자세히 보기 →</span>
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
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif" }}>IT 정책 교육</h3>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{policy.length}개 과정</span>
          </div>
          <div className="space-y-4">
            {policy.map((p, idx) => (
              <div key={p.id} className="bg-white rounded-[20px] p-6 flex items-start gap-5 hover:shadow-md transition-all"
                style={{ border: `1px solid ${C.border}` }}>
                {/* 번호 배지 */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{ background: C.brand }}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold leading-snug mb-2"
                    style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>{p.title}</h4>
                  {p.description && (
                    <p className="text-sm leading-relaxed mb-4" style={{ color: C.text3 }}>{p.description}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {p.duration && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: C.bg, color: C.text3 }}>⏱ {p.duration}</span>
                    )}
                    {p.courseUrl && p.courseUrl !== "#" && (
                      <a href={p.courseUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold flex items-center gap-1 hover:underline transition-all"
                        style={{ color: C.primary }}>
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
function ResourcesTab() {
  const [resTab,    setResTab]    = useState<ResTab>("install");
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    fetch("/api/resources")
      .then(r => r.json())
      .then(res => setResources(res.data ?? []));
  }, []);

  const FILES = resources.filter(r => r.category === resTab);

  const FILE_STYLE: Record<string, { bg: string; color: string }> = {
    PDF:  { bg: "#FEE2E2", color: "#B91C1C" },
    XLSX: { bg: "#D1FAE5", color: "#065F46" },
    DOCX: { bg: "#DBEAFE", color: "#1E40AF" },
  };

  const RES_TABS = [
    { key: "install" as ResTab, label: "설치 가이드" },
    { key: "policy"  as ResTab, label: "정책 문서"   },
    { key: "forms"   as ResTab, label: "양식 서식"   },
    { key: "other"   as ResTab, label: "기타"         },
  ];

  return (
    <div className="fade-in">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wider uppercase mb-1" style={{ color: C.primary }}>
          자료 아카이브
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight mb-6"
          style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>자료실</h2>
        {/* 탭 — 전체 너비 */}
        <div className="flex p-1.5 rounded-xl w-full" style={{ background: C.bg }}>
          {RES_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setResTab(key)}
              className="flex-1 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                background: resTab === key ? "#fff" : "transparent",
                color:      resTab === key ? C.brand : C.text3,
                fontWeight: resTab === key ? 700     : 500,
                boxShadow:  resTab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-4 space-y-5">
          {/* C1: "Resource Update" → "최근 업데이트" */}
          <div className="p-8 rounded-[20px] text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.primary})` }}>
            <div className="relative z-10">
              <span className="block mb-4 opacity-75"><Icon n="box" s={32} /></span>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>최근 업데이트</h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#90c0ff" }}>
                Q3 컴플라이언스 정책과 macOS 설치 스크립트가 업데이트되었습니다.
              </p>
              {/* C1: "Check History" → "변경 이력 보기" */}
              <button className="px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,0.12)" }}>
                변경 이력 보기
              </button>
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
              const isLink = file.fileType === "LINK";
              const fs = FILE_STYLE[file.fileType] ?? { bg: C.primarySoft, color: C.primary };
              return (
                <div key={file.id}
                  className="bg-white p-5 rounded-[16px] hover:shadow-md transition-all"
                  style={{ border: `1px solid ${C.border}` }}>
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: fs.bg, color: fs.color }}>
                      <Icon n={isLink ? "search" : "file"} s={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-bold text-sm sm:text-base leading-snug" style={{ color: C.text1 }}>
                          {file.title}
                        </h4>
                        {file.fileUrl && file.fileUrl !== "#" ? (
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 hover:brightness-110 transition-all"
                            style={{ background: C.brand, color: "#fff" }}>
                            {isLink ? "바로가기" : "다운로드"}
                          </a>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                            style={{ background: C.bg, color: C.text4 }}>준비중</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: "#eaeef2", color: C.text3 }}>{file.fileType}</span>
                        {file.fileSize && <span className="text-xs" style={{ color: C.text4 }}>{file.fileSize}</span>}
                        {file.updatedAt && <span className="text-xs hidden sm:inline" style={{ color: C.text4 }}>· {file.updatedAt}</span>}
                      </div>
                      {file.description && (
                        <p className="text-xs mt-2 leading-relaxed" style={{ color: C.text3 }}>{file.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {[
              /* C1: "Support/Missing a resource?" → "문의하기/자료가 없나요?" */
              { icon: "search", label: "문의하기",  title: "자료가 없나요?",
                desc: "IT팀에 자료 추가 요청을 보내세요.", linkLabel: "관리자에게 문의", linkColor: C.brand },
              /* C1: "Action/Submit Resource" → "제출하기/자료 제출하기" */
              { icon: "upload", label: "제출하기",  title: "자료 제출하기",
                desc: "내부 문서를 업로드하여 검토받으세요.", linkLabel: "업로드 시작", linkColor: C.primary },
            ].map(card => (
              <div key={card.title} className="p-6 rounded-[20px]"
                style={{ background: C.bg, border: "1px solid rgba(255,255,255,0.5)" }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm"
                    style={{ color: C.text3 }}>
                    <Icon n={card.icon} s={17} />
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded"
                    style={{ color: "#757682", background: "#e4e9ed" }}>{card.label}</span>
                </div>
                <h5 className="font-bold text-lg mb-1"
                  style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>{card.title}</h5>
                <p className="text-sm mb-4" style={{ color: C.text3 }}>{card.desc}</p>
                <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-bold flex items-center gap-1" style={{ color: card.linkColor }}>
                  {card.linkLabel} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SW 검색 탭
══════════════════════════════════════════════════════ */
const QUICK_SEARCHES = ["LibreOffice", "7-Zip", "VLC", "GIMP", "VSCode", "uTorrent", "WinRAR", "TeamViewer"];

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                          <p className="text-xs mt-2 leading-relaxed line-clamp-3" style={{ color: C.text3 }}>{s.description}</p>
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

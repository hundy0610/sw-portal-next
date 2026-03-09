"use client";

import { useEffect, useState } from "react";
import type { SwItem } from "@/types";
import { Badge } from "@/components/ui/Badge";

type Tab = "home" | "education" | "resources" | "search";

const INQUIRY_URL = "https://assetify-desk.vercel.app/inquiry";

export default function PortalPage() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="min-h-screen" style={{ background: "#F4F5F7" }}>
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          {/* 로고 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">SW</span>
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 leading-tight">SW 자산관리 포털</div>
              <div className="text-xs text-gray-400">IT 자산관리파트</div>
            </div>
          </div>

          {/* 탭 */}
          <nav className="flex gap-0.5 ml-6">
            {([
              { id: "home",      label: "홈",      icon: "🏠" },
              { id: "education", label: "교육 센터", icon: "🎓" },
              { id: "resources", label: "자료실",   icon: "📁" },
              { id: "search",    label: "SW 검색",  icon: "🔍" },
            ] as { id: Tab; label: string; icon: string }[]).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                <span style={{ fontSize: 13 }}>{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* 우측: 문의하기 + 숨겨진 관리자 링크 */}
          <div className="ml-auto flex items-center gap-3">
            <a
              href={INQUIRY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              💬 IT 지원 문의
            </a>
            <a
              href="/admin"
              className="text-gray-200 hover:text-gray-400 transition-colors select-none"
              style={{ fontSize: 8, lineHeight: 1 }}
              title=""
            >●</a>
          </div>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "home"      && <HomeTab onNavigate={setTab} />}
        {tab === "education" && <EducationTab />}
        {tab === "resources" && <ResourcesTab />}
        {tab === "search"    && <SearchTab />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   홈 탭 (리디자인)
═══════════════════════════════════════════════════════ */
function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const shortcuts = [
    {
      icon: "🎓", title: "교육 센터",
      desc: "필수 이수 교육 및 SW 활용 자료",
      tab: "education" as Tab,
      iconBg: "bg-purple-100",
      color: "hover:border-purple-200 hover:bg-purple-50",
    },
    {
      icon: "📁", title: "자료실",
      desc: "설치 가이드, 정책 지침, 양식 서식",
      tab: "resources" as Tab,
      iconBg: "bg-amber-100",
      color: "hover:border-amber-200 hover:bg-amber-50",
    },
    {
      icon: "🔍", title: "SW 검색",
      desc: "사내 승인·금지 SW 여부 즉시 확인",
      tab: "search" as Tab,
      iconBg: "bg-blue-100",
      color: "hover:border-blue-200 hover:bg-blue-50",
    },
  ];

  const notices = [
    { title: "Q1 필수 보안 교육 마감 안내",     date: "2026-03-31", tag: "긴급", urgent: true  },
    { title: "어도비 CC 라이선스 갱신 완료",     date: "2026-02-20", tag: "안내", urgent: false },
    { title: "보안 SW 필수 설치 공지",           date: "2026-02-10", tag: "긴급", urgent: true  },
    { title: "SW 사용 정책 개정 안내 (v2.0)",   date: "2026-01-15", tag: "안내", urgent: false },
  ];

  return (
    <div className="fade-in">
      {/* ── 메인 배너 ── */}
      <div
        className="rounded-2xl p-7 mb-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #3b82f6 100%)" }}
      >
        {/* 배경 데코 */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white opacity-5 pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 w-56 h-56 rounded-full bg-white opacity-5 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-bold mb-1">안녕하세요 👋</div>
            <div className="text-sm opacity-80 mb-5 leading-relaxed max-w-md">
              SW 자산관리 포털에 오신 것을 환영합니다.<br />
              SW 사용 정책을 확인하고, 교육 자료와 가이드를 이용하세요.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onNavigate("search")}
                className="bg-white text-blue-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
              >
                🔍 SW 정책 확인하기
              </button>
              <a
                href={INQUIRY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/20 text-white border border-white/30 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
              >
                💬 IT 지원 문의하기
              </a>
            </div>
          </div>

          {/* 퀵 스탯 칩 */}
          <div className="flex gap-3 shrink-0">
            {[
              { label: "보안 교육", value: "D-21", sub: "3월 31일 마감" },
              { label: "SW 정책",   value: "v2.0", sub: "2026.01 개정" },
            ].map((s) => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[88px] border border-white/10">
                <div className="text-xl font-extrabold">{s.value}</div>
                <div className="text-xs font-semibold mt-0.5">{s.label}</div>
                <div className="text-xs opacity-60 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 바로가기 카드 (4개) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {shortcuts.map((s) => (
          <button
            key={s.tab}
            onClick={() => onNavigate(s.tab)}
            className={`bg-white border border-gray-200 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${s.color}`}
          >
            <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center text-xl mb-3`}>
              {s.icon}
            </div>
            <div className="font-bold text-sm text-gray-900 mb-1">{s.title}</div>
            <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
          </button>
        ))}

        {/* 문의하기 카드 */}
        <a
          href={INQUIRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer hover:border-emerald-200 hover:bg-emerald-50"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl mb-3">
            💬
          </div>
          <div className="font-bold text-sm text-gray-900 mb-1">IT 지원 문의</div>
          <div className="text-xs text-gray-500 leading-relaxed mb-2">SW 신청, 오류 신고, 기타 문의</div>
          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            문의 접수 바로가기
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </a>
      </div>

      {/* ── 공지사항 ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="font-bold text-sm text-gray-900">📢 공지사항</div>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            {notices.length}건
          </span>
        </div>
        <div className="divide-y divide-gray-50">
          {notices.map((n) => (
            <div
              key={n.title}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer group"
            >
              <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                n.urgent ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
              }`}>
                {n.tag}
              </span>
              <span className="text-sm text-gray-800 flex-1 group-hover:text-blue-700 transition-colors">
                {n.title}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{n.date}</span>
              <svg className="text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   교육 센터 탭
═══════════════════════════════════════════════════════ */
function EducationTab() {
  const categories = [
    {
      title: "필수 이수 교육",
      icon: "🔴",
      items: [
        { title: "개인정보보호 및 정보보안 교육 2026",  type: "온라인", duration: "2시간", deadline: "2026-03-31", required: true  },
        { title: "SW 라이선스 준수 및 저작권 교육",    type: "온라인", duration: "1시간", deadline: "2026-03-31", required: true  },
        { title: "악성코드·랜섬웨어 예방 교육",        type: "온라인", duration: "30분",  deadline: "2026-04-30", required: true  },
        { title: "피싱 메일 대응 훈련",                type: "실습",   duration: "1시간", deadline: "2026-04-30", required: true  },
      ],
    },
    {
      title: "SW 활용 교육",
      icon: "💻",
      items: [
        { title: "Microsoft 365 업무 활용 가이드",    type: "자료", duration: "자율", deadline: "", required: false },
        { title: "Adobe CC 기초 사용법",              type: "자료", duration: "자율", deadline: "", required: false },
        { title: "협업 도구 (Jira / Notion) 입문",    type: "자료", duration: "자율", deadline: "", required: false },
        { title: "보안 솔루션(V3/DLP) 사용 매뉴얼",   type: "자료", duration: "자율", deadline: "", required: false },
        { title: "원격접속(VPN) 사용 가이드",          type: "자료", duration: "자율", deadline: "", required: false },
      ],
    },
    {
      title: "IT 정책 교육",
      icon: "📋",
      items: [
        { title: "SW 구매 및 신청 절차 안내",          type: "자료", duration: "자율", deadline: "", required: false },
        { title: "인터넷 · 이메일 보안 수칙",          type: "자료", duration: "자율", deadline: "", required: false },
        { title: "클라우드 서비스 이용 정책",           type: "자료", duration: "자율", deadline: "", required: false },
        { title: "오픈소스 SW 사용 허가 기준",          type: "자료", duration: "자율", deadline: "", required: false },
      ],
    },
  ];

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">교육 센터</h2>
        <p className="text-sm text-gray-500">IT 필수 교육 이수 현황과 SW 교육 자료를 확인하세요.</p>
      </div>

      <div className="flex flex-col gap-5">
        {categories.map((cat) => (
          <div key={cat.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <span>{cat.icon}</span>
              <span className="font-bold text-sm text-gray-900">{cat.title}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {cat.items.map((item) => (
                <div
                  key={item.title}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                        {item.title}
                      </span>
                      {item.required && (
                        <span className="text-xs font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span>
                      )}
                    </div>
                    {item.deadline && (
                      <span className="text-xs text-red-500 mt-0.5 block">마감: {item.deadline}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{item.type}</span>
                    <span>{item.duration}</span>
                    <svg className="text-gray-300 group-hover:text-blue-400 transition-colors"
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        💡 교육 자료 접근 및 이수 확인은 IT팀 또는 Notion 교육 페이지를 통해 진행됩니다.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   자료실 탭
═══════════════════════════════════════════════════════ */
function ResourcesTab() {
  const categories = [
    {
      title: "설치 가이드",
      icon: "📦",
      items: [
        { title: "사내 필수 SW 일괄 설치 가이드",         type: "PDF",  size: "2.1MB",  date: "2026-02-01" },
        { title: "VPN 클라이언트 설치 및 설정 방법",       type: "PDF",  size: "1.3MB",  date: "2026-01-20" },
        { title: "보안 솔루션(V3/DLP) 설치 가이드",        type: "PDF",  size: "890KB",  date: "2026-01-10" },
        { title: "Microsoft 365 초기 설정 가이드",         type: "PDF",  size: "3.5MB",  date: "2025-12-15" },
        { title: "Adobe Creative Cloud 설치 방법",         type: "PDF",  size: "1.7MB",  date: "2025-12-01" },
      ],
    },
    {
      title: "정책 및 지침서",
      icon: "📋",
      items: [
        { title: "SW 자산관리 정책서 v2.0",               type: "PDF",  size: "1.8MB",  date: "2026-01-01" },
        { title: "개인정보보호 지침서",                    type: "PDF",  size: "2.4MB",  date: "2025-11-01" },
        { title: "클라우드 서비스 이용 지침",              type: "PDF",  size: "1.1MB",  date: "2025-10-15" },
        { title: "오픈소스 SW 사용 정책",                  type: "PDF",  size: "760KB",  date: "2025-09-01" },
        { title: "사내 승인 SW 목록 (최신)",               type: "XLSX", size: "120KB",  date: "2026-02-15" },
      ],
    },
    {
      title: "양식 및 서식",
      icon: "📝",
      items: [
        { title: "SW 구매 신청서 양식",                   type: "XLSX", size: "45KB",   date: "2026-01-01" },
        { title: "IT 자산 반납 확인서",                   type: "DOCX", size: "38KB",   date: "2025-12-01" },
        { title: "라이선스 이관 신청서",                  type: "DOCX", size: "42KB",   date: "2025-11-01" },
        { title: "개인정보 처리 동의서",                  type: "DOCX", size: "55KB",   date: "2025-10-01" },
      ],
    },
  ];

  const typeColors: Record<string, string> = {
    PDF:  "bg-red-50 text-red-600",
    XLSX: "bg-green-50 text-green-600",
    DOCX: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">자료실</h2>
        <p className="text-sm text-gray-500">설치 가이드, 정책 문서, 각종 양식을 확인하세요.</p>
      </div>

      <div className="flex flex-col gap-5">
        {categories.map((cat) => (
          <div key={cat.title} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <span>{cat.icon}</span>
              <span className="font-bold text-sm text-gray-900">{cat.title}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {cat.items.map((item) => (
                <div
                  key={item.title}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer group"
                >
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                    <span className={`px-2 py-0.5 rounded font-semibold ${typeColors[item.type] || "bg-gray-100 text-gray-600"}`}>
                      {item.type}
                    </span>
                    <span>{item.size}</span>
                    <span>{item.date}</span>
                    <svg className="text-gray-300 group-hover:text-blue-400 transition-colors"
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SW 검색 탭
═══════════════════════════════════════════════════════ */
function SearchTab() {
  const [items, setItems]     = useState<SwItem[]>([]);
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "approved" | "banned" | "conditional">("all");
  const [selected, setSelected] = useState<SwItem | null>(null);

  useEffect(() => {
    fetch("/api/sw-db")
      .then((r) => r.json())
      .then((res) => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [s.name, s.vendor, s.category, ...s.alternatives].some((v) =>
      v.toLowerCase().includes(q)
    );
  });

  const counts = {
    all:         items.length,
    approved:    items.filter(s => s.status === "approved").length,
    conditional: items.filter(s => s.status === "conditional").length,
    banned:      items.filter(s => s.status === "banned").length,
  };

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">SW 검색</h2>
        <p className="text-sm text-gray-500">
          사내 승인된 SW와 사용이 금지된 SW 여부를 확인하세요.
        </p>
      </div>

      {/* 안내 배너 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-800">
          <span className="font-bold">✅ 승인</span><br/>회사에서 공식 승인된 SW입니다.
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-800">
          <span className="font-bold">⚠️ 조건부</span><br/>IT팀 사전 승인 훈 사용 가능합니다.
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">
          <span className="font-bold">🚫 금지</span><br/>사용 금지 SW입니다. 즉시 삭제 바랍니다.
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="form-input pl-10 w-full"
          style={{ height: 42 }}
          placeholder="소프트웨어명, 벤더, 카테고리 검색... (예: Photoshop, 7-Zip)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {([
          { key: "all",         label: "전체",     count: counts.all         },
          { key: "approved",    label: "✅ 승인",   count: counts.approved    },
          { key: "conditional", label: "⚠️ 조건부", count: counts.conditional },
          { key: "banned",      label: "🚫 금지",   count: counts.banned      },
        ] as { key: typeof filter; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filter === key
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              filter === key ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-2">🔍</div>
              <div className="mb-3">검색 결과가 없습니다.</div>
              <a
                href={INQUIRY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                💬 찾는 SW가 없으신가요? IT팀에 문의하기 →
              </a>
            </div>
          ) : filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-gray-900">{s.name}</span>
                    <Badge value={s.status} />
                    {s.mandatory && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">필수</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{s.vendor} · {s.category}</div>
                  {s.description && (
                    <div className="text-xs text-gray-400 mt-1 truncate">{s.description}</div>
                  )}
                </div>
                <div className="text-gray-400 text-xs shrink-0">
                  {selected?.id === s.id ? "▲" : "▼"}
                </div>
              </div>

              {selected?.id === s.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {s.alternatives.length > 0 && (
                    <div className="mb-2.5 text-sm">
                      <span className="text-xs text-gray-400 mr-1">대체 가능 SW:</span>
                      <span className="font-medium text-gray-700">{s.alternatives.join(", ")}</span>
                    </div>
                  )}
                  {s.status === "approved" && (
                    <div className="text-xs text-green-800 bg-green-50 border border-green-100 px-3 py-2.5 rounded-lg">
                      ✅ 사내 공식 승인된 소프트웨어입니다. 자유롭게 사용할 수 있습니다.
                    </div>
                  )}
                  {s.status === "banned" && (
                    <div className="text-xs text-red-800 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                      🚫 사용이 <strong>금지된</strong> 소프트웨어입니다. 즉시 삭제하고
                      <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer" className="underline ml-1 font-semibold">IT팀에 신고</a>해주세요.
                    </div>
                  )}
                  {s.status === "conditional" && (
                    <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-100 px-3 py-2.5 rounded-lg flex items-start justify-between gap-3">
                      <span>⚠️ 조건부 승인 소프트웨어입니다. 사용 전 반드시 IT팀의 사전 승인을 받아야 합니다.</span>
                      <a
                        href={INQUIRY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-bold text-yellow-700 underline hover:text-yellow-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        승인 요청 →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 하단 문의 유도 */}
      {!loading && filtered.length > 0 && (
        <div className="mt-6 text-center py-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">원하는 SW를 찾지 못하셨나요?</p>
          <a
            href={INQUIRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold"
          >
            💬 IT팀에 문의하기 →
          </a>
        </div>
      )}
    </div>
  );
}

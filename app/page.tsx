"use client";

import { useEffect, useState } from "react";
import type { SwItem } from "@/types";
import { Badge } from "@/components/ui/Badge";

// ── 사용자 포털 탭 타입 (티켓/신청 제거)
type Tab = "home" | "education" | "resources" | "search";

export default function PortalPage() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="min-h-screen" style={{ background: "#F4F5F7" }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">SW</span>
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 leading-tight">SW 자산관리 포털</div>
              <div className="text-xs text-gray-400">IT 자산관리파트</div>
            </div>
          </div>

          {/* 탭 */}
          <nav className="flex gap-1 ml-6">
            {([
              { id: "home",      label: "홈" },
              { id: "education", label: "교육 센터" },
              { id: "resources", label: "자료실" },
              { id: "search",    label: "SW 검색" },
            ] as { id: Tab; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* 숨겨진 관리자 접근 포인트 (우측 하단 점) */}
          <a
            href="/admin"
            className="ml-auto text-gray-200 hover:text-gray-400 transition-colors select-none"
            style={{ fontSize: 8, lineHeight: 1 }}
            title=""
          >
            ●
          </a>
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
   홈 탭
═══════════════════════════════════════════════════════ */
function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const shortcuts = [
    { icon: "🎓", title: "교육 센터",  desc: "필수 교육 이수 및 SW 교육 자료",    tab: "education" as Tab },
    { icon: "📁", title: "자료실",     desc: "설치 가이드, 정책 문서, 양식 모음",  tab: "resources" as Tab },
    { icon: "🔍", title: "SW 검색",    desc: "승인 SW · 금지 SW 여부 즉시 확인",  tab: "search"    as Tab },
  ];

  const notices = [
    { title: "Q1 필수 보안 교육 마감 안내",           date: "2026-03-31", urgent: true  },
    { title: "어도비 CC 라이선스 갱신 완료",           date: "2026-02-20", urgent: false },
    { title: "보안 SW 필수 설치 공지",                date: "2026-02-10", urgent: true  },
    { title: "SW 사용 정책 개정 안내 (v2.0)",         date: "2026-01-15", urgent: false },
  ];

  return (
    <div className="fade-in">
      {/* 배너 */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-xl p-6 mb-6 text-white">
        <div className="text-xl font-bold mb-1">안녕하세요 👋</div>
        <div className="text-sm opacity-85 mb-4">
          사용 가능한 SW를 검색하거나, 교육 자료 및 문서를 확인하세요.
        </div>
        <button
          onClick={() => onNavigate("search")}
          className="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          SW 검색하기 →
        </button>
      </div>

      {/* 바로가기 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {shortcuts.map((s) => (
          <button
            key={s.tab}
            onClick={() => onNavigate(s.tab)}
            className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="font-bold text-gray-900 mb-1">{s.title}</div>
            <div className="text-sm text-gray-500">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* 공지사항 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="font-bold text-sm text-gray-900 mb-3">📢 공지사항</div>
        <div className="flex flex-col gap-2">
          {notices.map((n) => (
            <div key={n.title} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              {n.urgent && (
                <span className="text-xs font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded shrink-0">긴급</span>
              )}
              <span className="text-sm text-gray-800 flex-1">{n.title}</span>
              <span className="text-xs text-gray-400 shrink-0">{n.date}</span>
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
          <div key={cat.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                    <svg
                      className="text-gray-300 group-hover:text-blue-400 transition-colors"
                      width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6"/>
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
          <div key={cat.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                    <svg
                      className="text-gray-300 group-hover:text-blue-400 transition-colors"
                      width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                    >
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
   SW 검색 탭  ─  승인/금지 여부만 표시 (재고·사용 현황 비공개)
═══════════════════════════════════════════════════════ */
function SearchTab() {
  const [items, setItems]   = useState<SwItem[]>([]);
  const [query, setQuery]   = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "approved" | "banned" | "conditional">("all");
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
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-xs text-green-800">
          <span className="font-bold">✅ 승인</span> — 회사에서 공식 승인된 SW입니다.
        </div>
        <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800">
          <span className="font-bold">⚠️ 조건부</span> — IT팀 사전 승인 후 사용 가능합니다.
        </div>
        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800">
          <span className="font-bold">🚫 금지</span> — 사용 금지 SW입니다. 즉시 삭제 바랍니다.
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="form-input pl-10"
          style={{ height: 42 }}
          placeholder="소프트웨어명, 벤더, 카테고리 검색... (예: Photoshop, 7-Zip)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {([
          { key: "all",         label: "전체",        count: counts.all         },
          { key: "approved",    label: "✅ 승인",      count: counts.approved    },
          { key: "conditional", label: "⚠️ 조건부",    count: counts.conditional },
          { key: "banned",      label: "🚫 금지",      count: counts.banned      },
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
              <div>검색 결과가 없습니다.</div>
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
                      <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                        필수
                      </span>
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
                      🚫 사용이 <strong>금지된</strong> 소프트웨어입니다. 설치되어 있다면 즉시 삭제하고 IT팀(내선: 1234)에 보고해주세요.
                    </div>
                  )}
                  {s.status === "conditional" && (
                    <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-100 px-3 py-2.5 rounded-lg">
                      ⚠️ 조건부 승인 소프트웨어입니다. 사용 전 반드시 IT팀의 사전 승인을 받아야 합니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

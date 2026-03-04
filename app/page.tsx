"use client";
import { useState, useEffect } from "react";

type Tab = "home" | "education" | "resources" | "search";

interface SW {
  id: string;
  name: string;
  category: string;
  status: "approved" | "banned" | "conditional";
  description?: string;
  vendor?: string;
  note?: string;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">SW</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SW 자산 관리 포털</h1>
            <p className="text-xs text-gray-500">소프트웨어 정책 · 교육 · 자료실</p>
          </div>
          <a
            href="/admin"
            className="ml-auto text-gray-200 hover:text-gray-400 transition-colors select-none"
            style={{ fontSize: 8, lineHeight: 1 }}
            title=""
          >●</a>
        </div>

        {/* Tab Nav */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1">
            {([
              { id: "home",      label: "🏠 홈" },
              { id: "education", label: "📚 교육 센터" },
              { id: "resources", label: "📁 자료실" },
              { id: "search",    label: "🔍 SW 검색" },
            ] as { id: Tab; label: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {tab === "home"      && <HomeTab onNavigate={setTab} />}
        {tab === "education" && <EducationTab />}
        {tab === "resources" && <ResourcesTab />}
        {tab === "search"    && <SearchTab />}
      </main>
    </div>
  );
}

/* ───────────────── HOME ───────────────── */
function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">SW 자산 관리 포털에 오신 것을 환영합니다</h2>
        <p className="text-blue-100 text-sm">사내 소프트웨어 정책을 확인하고, 교육 자료와 가이드를 이용하세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: "📚", title: "교육 센터", desc: "필수 이수 교육 및 SW 활용 교육 자료", tab: "education" as Tab, color: "blue" },
          { icon: "📁", title: "자료실", desc: "설치 가이드, 정책 지침, 양식 서식", tab: "resources" as Tab, color: "green" },
          { icon: "🔍", title: "SW 검색", desc: "사내 승인/금지 소프트웨어 정책 확인", tab: "search" as Tab, color: "purple" },
        ].map((card) => (
          <button
            key={card.tab}
            onClick={() => onNavigate(card.tab)}
            className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left"
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-900 mb-3">📢 공지사항</h3>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex gap-2"><span className="text-amber-400">▸</span> SW 신청 및 티켓 처리는 <strong>Notion</strong>을 통해 진행됩니다.</li>
          <li className="flex gap-2"><span className="text-amber-400">▸</span> 미승인 소프트웨어 설치 시 보안 정책에 따라 제재될 수 있습니다.</li>
          <li className="flex gap-2"><span className="text-amber-400">▸</span> 교육 이수 현황은 IT팀에 문의하세요.</li>
        </ul>
      </div>
    </div>
  );
}

/* ───────────────── EDUCATION ───────────────── */
function EducationTab() {
  const categories = [
    {
      title: "필수 이수 교육",
      icon: "📋",
      color: "red",
      items: [
        { title: "정보보안 인식 교육", duration: "30분", deadline: "매년 12월", tag: "필수" },
        { title: "개인정보 보호 교육", duration: "20분", deadline: "매년 6월", tag: "필수" },
        { title: "SW 자산 관리 정책 교육", duration: "15분", deadline: "입사 후 1개월", tag: "필수" },
      ],
    },
    {
      title: "SW 활용 교육",
      icon: "💻",
      color: "blue",
      items: [
        { title: "Microsoft 365 기본 활용", duration: "1시간", deadline: "상시", tag: "권장" },
        { title: "Slack 업무 활용법", duration: "30분", deadline: "상시", tag: "권장" },
        { title: "Notion 프로젝트 관리", duration: "45분", deadline: "상시", tag: "권장" },
        { title: "보안 소프트웨어 사용법", duration: "20분", deadline: "상시", tag: "권장" },
      ],
    },
    {
      title: "IT 정책 교육",
      icon: "🛡️",
      color: "green",
      items: [
        { title: "사내 IT 보안 정책 안내", duration: "25분", deadline: "상시", tag: "참고" },
        { title: "외부 소프트웨어 설치 절차", duration: "15분", deadline: "상시", tag: "참고" },
        { title: "라이선스 위반 예방 가이드", duration: "20분", deadline: "상시", tag: "참고" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">교육 센터</h2>
        <p className="text-sm text-gray-500">필수 교육 및 SW 활용 교육 자료를 확인하세요.</p>
      </div>

      {categories.map((cat) => (
        <div key={cat.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <span className="text-lg">{cat.icon}</span>
            <h3 className="font-semibold text-gray-900">{cat.title}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {cat.items.map((item) => (
              <div key={item.title} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">소요 시간: {item.duration} · 이수 기한: {item.deadline}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  item.tag === "필수" ? "bg-red-100 text-red-700" :
                  item.tag === "권장" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {item.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        💡 교육 자료 접근 및 이수 확인은 IT팀 또는 Notion 교육 페이지를 통해 진행됩니다.
      </div>
    </div>
  );
}

/* ───────────────── RESOURCES ───────────────── */
function ResourcesTab() {
  const sections = [
    {
      title: "설치 가이드",
      icon: "📥",
      items: [
        { title: "Microsoft 365 설치 가이드", format: "PDF", size: "2.1MB" },
        { title: "VPN 설치 및 설정 방법", format: "PDF", size: "1.4MB" },
        { title: "보안 솔루션 (EDR) 설치 가이드", format: "PDF", size: "3.2MB" },
        { title: "개발 환경 설정 가이드 (Mac/Windows)", format: "PDF", size: "4.5MB" },
      ],
    },
    {
      title: "정책 지침",
      icon: "📜",
      items: [
        { title: "사내 소프트웨어 사용 정책", format: "PDF", size: "1.8MB" },
        { title: "개인정보 처리 지침", format: "PDF", size: "2.3MB" },
        { title: "IT 보안 정책 v3.0", format: "PDF", size: "3.0MB" },
        { title: "라이선스 관리 규정", format: "PDF", size: "1.2MB" },
      ],
    },
    {
      title: "양식 서식",
      icon: "📝",
      items: [
        { title: "SW 도입 신청서", format: "DOCX", size: "0.3MB" },
        { title: "IT 장비 반납 신청서", format: "DOCX", size: "0.2MB" },
        { title: "보안 예외 승인 요청서", format: "DOCX", size: "0.4MB" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">자료실</h2>
        <p className="text-sm text-gray-500">설치 가이드, 정책 지침, 양식 서식을 다운로드하세요.</p>
      </div>

      {sections.map((sec) => (
        <div key={sec.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <span className="text-lg">{sec.icon}</span>
            <h3 className="font-semibold text-gray-900">{sec.title}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {sec.items.map((item) => (
              <div key={item.title} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                    item.format === "PDF" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                  }`}>
                    {item.format}
                  </span>
                  <span className="text-sm text-gray-800">{item.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{item.size}</span>
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors">
                    다운로드
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        📌 자료 업데이트 또는 추가 요청은 IT팀에 문의하세요.
      </div>
    </div>
  );
}

/* ───────────────── SW SEARCH ───────────────── */
function SearchTab() {
  const [query, setQuery] = useState("");
  const [swList, setSwList] = useState<SW[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "approved" | "conditional" | "banned">("all");

  useEffect(() => {
    fetch("/api/sw-db")
      .then((r) => r.json())
      .then((data) => {
        setSwList(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = swList.filter((s) => {
    const matchQuery =
      !query ||
      s.name?.toLowerCase().includes(query.toLowerCase()) ||
      s.category?.toLowerCase().includes(query.toLowerCase()) ||
      s.vendor?.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "all" || s.status === filter;
    return matchQuery && matchFilter;
  });

  const statusConfig = {
    approved:    { label: "✅ 승인",     bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200" },
    conditional: { label: "⚠️ 조건부",  bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
    banned:      { label: "🚫 금지",     bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200" },
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">SW 검색</h2>
        <p className="text-sm text-gray-500">사내 소프트웨어 승인/금지 정책을 확인하세요.</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="소프트웨어명, 카테고리, 제조사 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "all",         label: "전체" },
          { key: "approved",    label: "✅ 승인" },
          { key: "conditional", label: "⚠️ 조건부" },
          { key: "banned",      label: "🚫 금지" },
        ] as { key: typeof filter; label: string }[]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1 opacity-70">
                ({swList.filter((s) => s.status === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🔍</p>
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{filtered.length}개 소프트웨어</p>
          {filtered.map((s) => {
            const cfg = statusConfig[s.status] ?? statusConfig.conditional;
            return (
              <div key={s.id} className={`bg-white rounded-xl border ${cfg.border} p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{s.name}</span>
                      {s.vendor && (
                        <span className="text-xs text-gray-400">by {s.vendor}</span>
                      )}
                    </div>
                    {s.category && (
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mb-2">
                        {s.category}
                      </span>
                    )}
                    {s.description && (
                      <p className="text-sm text-gray-600">{s.description}</p>
                    )}
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Status notice — NO usage/inventory data shown */}
                <div className="mt-3">
                  {s.status === "approved" && (
                    <div className={`text-xs ${cfg.text} ${cfg.bg} rounded-lg px-3 py-2`}>
                      ✅ 사내 공식 승인된 소프트웨어입니다. 정상적으로 사용 가능합니다.
                      {s.note && <span className="ml-1">({s.note})</span>}
                    </div>
                  )}
                  {s.status === "banned" && (
                    <div className={`text-xs ${cfg.text} ${cfg.bg} rounded-lg px-3 py-2`}>
                      🚫 사용이 금지된 소프트웨어입니다. 즉시 삭제하거나 IT팀에 문의하세요.
                      {s.note && <span className="ml-1">({s.note})</span>}
                    </div>
                  )}
                  {s.status === "conditional" && (
                    <div className={`text-xs ${cfg.text} ${cfg.bg} rounded-lg px-3 py-2`}>
                      ⚠️ 조건부 승인 소프트웨어입니다. IT팀의 사전 승인 후 사용 가능합니다.
                      {s.note && <span className="ml-1">({s.note})</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

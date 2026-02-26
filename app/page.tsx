"use client";

import { useEffect, useState, useRef } from "react";
import type { SwItem } from "@/types";
import { Badge } from "@/components/ui/Badge";

// ── 직원 포털 탭 타입
type Tab = "home" | "search" | "request" | "ticket";

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
              { id: "home", label: "홈" },
              { id: "search", label: "SW 검색" },
              { id: "request", label: "SW 신청" },
              { id: "ticket", label: "티켓 접수" },
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

          <a
            href="/admin"
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            관리자
          </a>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "home" && <HomeTab onNavigate={setTab} />}
        {tab === "search" && <SearchTab />}
        {tab === "request" && <RequestTab />}
        {tab === "ticket" && <TicketTab />}
      </main>
    </div>
  );
}

// ── 홈 탭
function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const shortcuts = [
    { icon: "🔍", title: "SW 검색", desc: "사용 가능한 소프트웨어를 검색하세요", tab: "search" as Tab },
    { icon: "📋", title: "SW 신청", desc: "필요한 소프트웨어를 신청하세요", tab: "request" as Tab },
    { icon: "🎫", title: "IT 지원 요청", desc: "설치 오류, 라이선스 문제를 접수하세요", tab: "ticket" as Tab },
  ];

  const notices = [
    { title: "Q1 필수 교육 마감 안내", date: "2026-03-31", urgent: true },
    { title: "어도비 CC 라이선스 갱신 완료", date: "2026-02-20", urgent: false },
    { title: "보안 SW 필수 설치 공지", date: "2026-02-10", urgent: true },
  ];

  return (
    <div className="fade-in">
      {/* 배너 */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-xl p-6 mb-6 text-white">
        <div className="text-xl font-bold mb-1">안녕하세요 👋</div>
        <div className="text-sm opacity-85 mb-4">필요한 소프트웨어를 신청하거나 IT 지원을 요청하세요.</div>
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

// ── SW 검색 탭
function SearchTab() {
  const [items, setItems] = useState<SwItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SwItem | null>(null);

  useEffect(() => {
    fetch("/api/sw-db")
      .then((r) => r.json())
      .then((res) => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [s.name, s.vendor, s.category, ...s.alternatives].some((v) =>
      v.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">SW 검색</h2>
        <p className="text-sm text-gray-500">회사에서 사용 가능한 소프트웨어를 검색하세요.</p>
      </div>

      {/* 검색창 */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="form-input pl-10"
          style={{ height: 42 }}
          placeholder="소프트웨어명, 벤더, 카테고리 검색... (예: Photoshop, 7-Zip)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-2">🔍</div>
              <div>"{query}"에 대한 검색 결과가 없습니다.</div>
            </div>
          ) : filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
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
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">라이선스</div>
                      <div className="font-medium text-gray-800">
                        {s.totalLicenses < 999 ? `${s.usedLicenses}/${s.totalLicenses}석 사용 중` : "무제한"}
                      </div>
                    </div>
                    {s.alternatives.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">대체 가능</div>
                        <div className="font-medium text-gray-800">{s.alternatives.join(", ")}</div>
                      </div>
                    )}
                  </div>
                  {s.status === "approved" && (
                    <div className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                      ✓ 이 소프트웨어는 회사에서 공식 승인된 제품입니다.
                    </div>
                  )}
                  {s.status === "banned" && (
                    <div className="text-xs text-red-700 bg-red-50 px-3 py-2 rounded-lg">
                      ✕ 이 소프트웨어는 사용이 금지되어 있습니다. IT 부서에 문의하세요.
                    </div>
                  )}
                  {s.status === "conditional" && (
                    <div className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
                      ⚠ 조건부 승인 소프트웨어입니다. 사용 전 IT 부서 승인이 필요합니다.
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

// ── SW 신청 탭
function RequestTab() {
  const [swDb, setSwDb] = useState<SwItem[]>([]);
  const [form, setForm] = useState({ swName: "", requester: "", reason: "", urgency: "중간" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sw-db").then(r => r.json()).then(res => setSwDb(res.data ?? []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.swName || !form.requester || !form.reason) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/sw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("신청 실패");
      setSuccess(true);
      setForm({ swName: "", requester: "", reason: "", urgency: "중간" });
    } catch {
      setError("신청 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">SW 신청</h2>
        <p className="text-sm text-gray-500">필요한 소프트웨어 구매 또는 라이선스를 신청합니다.</p>
      </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-bold text-green-800 text-lg mb-1">신청이 접수되었습니다!</div>
          <div className="text-sm text-green-600 mb-4">담당자 검토 후 노션에서 처리 현황을 확인할 수 있습니다.</div>
          <button onClick={() => setSuccess(false)} className="text-sm font-medium bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            추가 신청하기
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">소프트웨어명 <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                placeholder="예: Adobe Photoshop, VS Code"
                value={form.swName}
                onChange={e => setForm({ ...form, swName: e.target.value })}
                list="sw-suggestions"
              />
              <datalist id="sw-suggestions">
                {swDb.filter(s => s.status === "approved").map(s => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">신청자 <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                placeholder="흴름 (예: 홍길동)"
                value={form.requester}
                onChange={e => setForm({ ...form, requester: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">긴급도</label>
              <select
                className="form-input"
                value={form.urgency}
                onChange={e => setForm({ ...form, urgency: e.target.value })}
              >
                {["높음", "중간", "낮음"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">신청 사유 <span className="text-red-500">*</span></label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="업무에 필요한 이유, 예상 사용 기간 등을 설명해주세요."
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                style={{ resize: "vertical" }}
              />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "신청 중..." : "신청 제출"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── 티켓 접수 탭
function TicketTab() {
  const [form, setForm] = useState({
    title: "",
    category: "설치/실행 오류",
    priority: "중간",
    description: "",
    requester: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const categories = [
    "설치/실행 오류", "라이선스 문제", "SW 신청", "사용법 문의", "네트워크 오류", "기타"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.requester) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("접수 실패");
      setSuccess(true);
      setForm({ title: "", category: "설치/실행 오류", priority: "중간", description: "", requester: "" });
    } catch {
      setError("접수 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">IT 지원 티켓 접수</h2>
        <p className="text-sm text-gray-500">설치 오류, 라이선스 문제 등 IT 지원이 필요한 사항을 접수하세요.</p>
      </div>

      {success ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🎫</div>
          <div className="font-bold text-blue-800 text-lg mb-1">티켓이 접수되었습니다!</div>
          <div className="text-sm text-blue-600 mb-4">담당자 배정 후 처리가 시작됩니다.</div>
          <button onClick={() => setSuccess(false)} className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            추가 접수하기
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목 <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                placeholder="예: VS Code 라이선스 인증 실패"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {["높음", "중간", "낮음"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">요청자 <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                placeholder="이름 (예: 홍길동)"
                value={form.requester}
                onChange={e => setForm({ ...form, requester: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용 <span className="text-red-500">*</span></label>
              <textarea
                className="form-input"
                rows={5}
                placeholder="증상, 발생 시점, 오류 메시지, 스크린샷 경로 등을 입력해주세요."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ resize: "vertical" }}
              />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "접수 중..." : "티켓 접수"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

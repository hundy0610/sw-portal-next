"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import type { SwDbRecord } from "@/types";
import EnvVarMissing from "@/components/ui/EnvVarMissing";
import { scGet, scSet, scDel } from "@/lib/session-cache";
import { safeJson } from "@/lib/fetch-json";

const SC_SWREC_LP = (co: string) => `sc:lp:swrec${co ? `:${co}` : ""}`;
const TTL_SWREC_LP = 5 * 60 * 1000;

const PAGE_SIZE = 30;

// ── SW 매크로 카테고리 (Notion DB 실제 분류 기준) ────────────────────────
const SW_CAT_RULES: {
  label: string; icon: string; color: string; bg: string; keywords: string[];
}[] = [
  {
    label: "문서/오피스", icon: "📄", color: "text-blue-700", bg: "bg-blue-50",
    keywords: ["office","hancom","pdf","ezpdf","nspdf"],
  },
  {
    label: "AI 툴", icon: "🤖", color: "text-violet-700", bg: "bg-violet-50",
    keywords: ["gpt","claude","copilot","cursor","google ai"],
  },
  {
    label: "개발 툴", icon: "💻", color: "text-emerald-700", bg: "bg-emerald-50",
    keywords: ["jetbrains","postman","sendbird"],
  },
  {
    label: "협업 툴", icon: "🤝", color: "text-orange-700", bg: "bg-orange-50",
    keywords: ["notion","slack","confluence","jira","채널"],
  },
  {
    label: "디자인/그래픽", icon: "🎨", color: "text-pink-700", bg: "bg-pink-50",
    keywords: ["figma","keyshot","adobe"],
  },
  {
    label: "설계/CAD", icon: "📐", color: "text-cyan-700", bg: "bg-cyan-50",
    keywords: ["cad","zwcad","sketch up","sketchup","cadian"],
  },
  {
    label: "RPA/자동화", icon: "⚙️", color: "text-amber-700", bg: "bg-amber-50",
    keywords: ["robot","uipath"],
  },
];

const EXTRA_CAT = { label: "기타", icon: "📦", color: "text-gray-700", bg: "bg-gray-50" };

function getSwMacroCategory(swName: string) {
  if (!swName) return EXTRA_CAT;
  const lower = swName.toLowerCase();
  for (const rule of SW_CAT_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule;
  }
  return EXTRA_CAT;
}

// ── 상태 스타일 ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "사용중":     { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"   },
  "재고":       { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  },
  "갱신필요":   { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  "만료":       { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400"   },
  "신규등록":   { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  "반납예정":   { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  "출고준비중": { bg: "bg-cyan-50",   text: "text-cyan-700",   dot: "bg-cyan-400"   },
  "임시지급":   { bg: "bg-sky-50",    text: "text-sky-700",    dot: "bg-sky-400"    },
  "미확인":     { bg: "bg-gray-50",   text: "text-gray-400",   dot: "bg-gray-300"   },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status || "—"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    "영구":       "bg-blue-50 text-blue-700",
    "구독(업체)": "bg-purple-50 text-purple-700",
    "구독(웹)":   "bg-cyan-50 text-cyan-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type] ?? "bg-gray-100 text-gray-500"}`}>
      {type || "—"}
    </span>
  );
}

function fmtDate(d?: string) { return d ? d.slice(0, 10) : "—"; }
function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function daysLeft(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ── 클립보드 복사 버튼 ──────────────────────────────────────────────────
function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-all ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
      }`}
      title={`${label} 복사`}
    >
      {copied ? "✓ 복사됨" : `📋 ${label}`}
    </button>
  );
}

// ── 컬럼 드롭다운 필터 ──────────────────────────────────────────────────
function ColFilter({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const active = value !== "전체";
  return (
    <div className="relative inline-flex items-center gap-0.5">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none pr-3.5 py-0 text-xs font-semibold bg-transparent border-none cursor-pointer focus:outline-none ${active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
      >
        <option value="전체">{label}</option>
        {options.filter(o => o !== "전체").map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className={`pointer-events-none absolute right-0 text-[10px] ${active ? "text-blue-500" : "text-gray-400"}`}>▾</span>
    </div>
  );
}

// ── 페이지네이션 ────────────────────────────────────────────────────────
function Pagination({ total, page, size, onChange }: {
  total: number; page: number; size: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (totalPages <= 1) return null;
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, total);
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = "w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-colors";
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-gray-400">{start}–{end} / {total}건</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className={`${btn} border border-gray-200 ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>‹</button>
        {pages.map((p, i) => p === "…"
          ? <span key={`e${i}`} className="w-8 text-center text-xs text-gray-400">…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className={`${btn} ${page === p ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-100 text-gray-600"}`}>
              {p}
            </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className={`${btn} border border-gray-200 ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>›</button>
      </div>
    </div>
  );
}

// ── SW 인라인 편집 모달 ─────────────────────────────────────────────────
const SW_STATUS_OPTIONS = ["사용중","재고","갱신필요","만료","신규등록","반납예정","출고준비중","임시지급","미확인"];
const SW_LICENSE_OPTIONS = ["영구","구독(업체)","구독(웹)"];

function SwEditModal({
  record,
  onSave,
  onClose,
}: {
  record: SwDbRecord;
  onSave: (id: string, fields: Partial<SwDbRecord>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<SwDbRecord>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      status:      record.status,
      user:        record.user,
      department:  record.department,
      company:     record.company,
      licenseType: record.licenseType,
      licenseKey:  record.licenseKey,
      swDetail:    record.swDetail,
      renewalDate: record.renewalDate,
      vendor:      record.vendor,
      billingType: record.billingType,
      monthlyKrw:  record.monthlyKrw,
      monthlyUsd:  record.monthlyUsd,
    });
  }, [record]);

  function set<K extends keyof SwDbRecord>(key: K, val: SwDbRecord[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await onSave(record.id, form);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-5 py-4 bg-blue-600 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-base">SW 정보 수정</div>
            <div className="text-xs opacity-80 mt-0.5">{record.swCategory} · {record.user || "재고"}</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none ml-4">✕</button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* 상태 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">상태</label>
            <select value={String(form.status ?? "")} onChange={e => set("status", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {SW_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          {/* 사용자 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">사용자</label>
            <input value={String(form.user ?? "")} onChange={e => set("user", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 부서 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">부서</label>
            <input value={String(form.department ?? "")} onChange={e => set("department", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 법인명 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">법인명</label>
            <input value={String(form.company ?? "")} onChange={e => set("company", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 라이선스 유형 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">라이선스 유형</label>
            <select value={String(form.licenseType ?? "")} onChange={e => set("licenseType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {SW_LICENSE_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          {/* SW 소분류 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">SW 소분류 (버전/에디션)</label>
            <input value={String(form.swDetail ?? "")} onChange={e => set("swDetail", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 인증키 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">인증키 / 인증계정</label>
            <input value={String(form.licenseKey ?? "")} onChange={e => set("licenseKey", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 갱신필요일 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">갱신필요일</label>
            <div className="flex items-center gap-1">
              <input type="date" value={String(form.renewalDate ?? "")} onChange={e => set("renewalDate", e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              {form.renewalDate && <button type="button" onClick={() => set("renewalDate", "")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
            </div>
          </div>
          {/* 구매처 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">구매처</label>
            <input value={String(form.vendor ?? "")} onChange={e => set("vendor", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 결제 방식 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">결제 방식</label>
            <input value={String(form.billingType ?? "")} onChange={e => set("billingType", e.target.value as SwDbRecord["billingType"])}
              placeholder="예) 법인카드, 계좌이체, 개인결제"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* 월 비용 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">월 비용</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number" min="0" step="1"
                  value={form.monthlyKrw ?? ""}
                  onChange={e => set("monthlyKrw", e.target.value === "" ? 0 : Number(e.target.value) as SwDbRecord["monthlyKrw"])}
                  placeholder="0"
                  className="w-full px-3 py-2 pr-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">KRW</span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="number" min="0" step="0.01"
                  value={form.monthlyUsd ?? ""}
                  onChange={e => set("monthlyUsd", e.target.value === "" ? 0 : Number(e.target.value) as SwDbRecord["monthlyUsd"])}
                  placeholder="0.00"
                  className="w-full px-3 py-2 pr-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">USD</span>
              </div>
            </div>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? "저장 중…" : "✓ Notion에 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 카테고리 아코디언 뷰 ────────────────────────────────────────────────
interface SwGroup {
  swName: string; records: SwDbRecord[];
  using: number; stock: number; expired: number; renewal: number;
  urgent: number; minDays: number | null;
}

function CategoryView({ records, onEdit }: { records: SwDbRecord[]; onEdit: (r: SwDbRecord) => void }) {
  const [expandedSw, setExpandedSw] = useState<string | null>(null);

  const catGroups = useMemo(() => {
    const catMap: Record<string, SwDbRecord[]> = {};
    for (const r of records) {
      const { label } = getSwMacroCategory(r.swCategory);
      if (!catMap[label]) catMap[label] = [];
      catMap[label].push(r);
    }
    const ORDER = ["문서/오피스", "AI 툴", "개발 툴", "협업 툴", "디자인/그래픽", "설계/CAD", "RPA/자동화", "기타"];
    return ORDER.filter(label => catMap[label]).map(label => {
      const info = label === "기타" ? EXTRA_CAT : (SW_CAT_RULES.find(r => r.label === label) ?? EXTRA_CAT);
      const recs = catMap[label];
      const swMap: Record<string, SwDbRecord[]> = {};
      for (const r of recs) {
        const key = r.swCategory || "알 수 없음";
        if (!swMap[key]) swMap[key] = [];
        swMap[key].push(r);
      }
      const swGroups: SwGroup[] = Object.entries(swMap).map(([swName, swRecs]) => {
        const using   = swRecs.filter(r => r.status === "사용중" || r.status === "신규등록").length;
        const stock   = swRecs.filter(r => r.status === "재고" || r.status === "출고준비중").length;
        const expired = swRecs.filter(r => r.status === "만료").length;
        const renewal = swRecs.filter(r => r.status === "갱신필요").length;
        const days    = swRecs.map(r => daysLeft(r.renewalDate)).filter((d): d is number => d !== null && d >= 0);
        const urgent  = days.filter(d => d <= 30).length;
        const minDays = days.length > 0 ? Math.min(...days) : null;
        return { swName, records: swRecs, using, stock, expired, renewal, urgent, minDays };
      }).sort((a, b) => (b.using + b.stock) - (a.using + a.stock));
      return {
        label, icon: info.icon, color: info.color, bg: info.bg, swGroups,
        totalRecs: recs.length,
        usingRecs: recs.filter(r => r.status === "사용중" || r.status === "신규등록").length,
        urgentRecs: recs.filter(r => { const d = daysLeft(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length,
      };
    });
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-3xl mb-2">📋</div>
        <div>조건에 맞는 데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {catGroups.map(cat => (
        <div key={cat.label}>
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-t-xl border border-b-0 ${cat.bg}`}
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{cat.icon}</span>
              <span className={`font-bold text-sm ${cat.color}`}>{cat.label}</span>
              <span className="text-xs text-gray-400">{cat.swGroups.length}종</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">총 <strong>{cat.totalRecs}</strong>건</span>
              <span className="text-blue-600">사용중 <strong>{cat.usingRecs}</strong></span>
              {cat.urgentRecs > 0 && (
                <span className="text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  ⚠ 갱신임박 {cat.urgentRecs}건
                </span>
              )}
            </div>
          </div>
          <div className="border border-gray-200 rounded-b-xl overflow-hidden bg-white">
            {cat.swGroups.map((sw, idx) => {
              const isExpanded = expandedSw === `${cat.label}::${sw.swName}`;
              const key = `${cat.label}::${sw.swName}`;
              return (
                <div key={sw.swName} className={idx > 0 ? "border-t border-gray-100" : ""}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group"
                    onClick={() => setExpandedSw(isExpanded ? null : key)}
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors shrink-0" />
                    <span className="font-semibold text-sm text-gray-900 flex-1 min-w-0 truncate">{sw.swName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sw.using > 0 && <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">사용중 {sw.using}</span>}
                      {sw.stock > 0 && <span className="text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-semibold">재고 {sw.stock}</span>}
                      {sw.renewal > 0 && <span className="text-xs text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full font-semibold">갱신필요 {sw.renewal}</span>}
                      {sw.expired > 0 && <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">만료 {sw.expired}</span>}
                      {sw.minDays !== null && sw.minDays <= 30 && sw.minDays >= 0 && (
                        <span className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">D-{sw.minDays}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right shrink-0">{sw.records.length}건</span>
                    <svg className={`text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                      <div className="text-xs text-gray-500 font-semibold mb-2.5">📋 세부 내역 ({sw.records.length}건)</div>
                      <div className="flex flex-col gap-2">
                        {sw.records.map(r => {
                          const days = daysLeft(r.renewalDate);
                          const isUrgent = days !== null && days >= 0 && days <= 30;
                          const isPermanent = r.licenseType === "영구";
                          return (
                            <div key={r.id}
                              className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-lg text-xs ${isUrgent ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100"}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <StatusBadge status={r.status} />
                                <TypeBadge type={r.licenseType} />
                                <span className="font-semibold text-gray-800">{r.user || "재고"}</span>
                                <span className="text-gray-400">{r.department || "—"}</span>
                                <span className="text-gray-400">{r.company || "—"}</span>
                                <div className="ml-auto flex items-center gap-2">
                                  {r.swDetail && <span className="text-gray-400">{r.swDetail}</span>}
                                  {r.renewalDate && (
                                    <span className={isUrgent ? "text-red-600 font-semibold" : "text-gray-400"}>
                                      {isUrgent && days !== null ? `D-${days} · ` : ""}{fmtDate(r.renewalDate)}
                                    </span>
                                  )}
                                  {r.notionUrl && (
                                    <a href={r.notionUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 underline"
                                      onClick={e => e.stopPropagation()}>노션 보기</a>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); onEdit(r); }}
                                    className="text-xs text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2 py-0.5 rounded transition-colors"
                                    title="수정"
                                  >✏️ 수정</button>
                                </div>
                              </div>
                              {/* 영구 라이선스 키 표시 */}
                              {isPermanent && r.licenseKey && (
                                <div className="flex items-center gap-2 mt-1 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                  <span className="text-blue-600 font-semibold text-xs shrink-0">🔑 인증키</span>
                                  <span className="font-mono text-xs text-gray-700 flex-1 break-all">{r.licenseKey}</span>
                                  <CopyButton text={r.licenseKey} label="키 복사" />
                                </div>
                              )}
                              {isPermanent && !r.licenseKey && (
                                <div className="text-xs text-gray-400 italic mt-0.5 pl-1">🔑 인증키 없음</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SW 직접 등록 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

// 단일 선택 + 새 항목 추가 드롭다운
function AddableSelect({ value, initOptions, onChange, placeholder }: {
  value: string; initOptions: string[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(initOptions);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setSearch("");
  }, [open]);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !options.some(o => o.toLowerCase() === search.trim().toLowerCase());

  function select(v: string) { onChange(v); setOpen(false); setSearch(""); }

  function createNew() {
    const v = search.trim();
    if (!v) return;
    setOptions(prev => [...prev, v]);
    select(v);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-300">
        <span className={value ? "text-gray-900" : "text-gray-400"}>{value || placeholder || "선택"}</span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canCreate) createNew(); }}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="검색..." />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && !canCreate && <p className="px-3 py-2 text-xs text-gray-400">일치하는 항목 없음</p>}
            {filtered.map(o => (
              <button key={o} type="button"
                className={`w-full px-3 py-2 text-sm text-left hover:bg-indigo-50 transition-colors ${value === o ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700"}`}
                onClick={() => select(o)}>
                {o}
              </button>
            ))}
          </div>
          {canCreate && (
            <div className="border-t border-gray-100 p-1.5">
              <button type="button" onClick={createNew}
                className="w-full px-3 py-2 text-xs text-left text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors">
                + 새로운 항목 만들기 &ldquo;{search.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 다중 선택 + 새 항목 추가 드롭다운 (버전용)
function AddableMultiSelect({ value, initOptions, onChange }: {
  value: string[]; initOptions: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(initOptions);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setSearch("");
  }, [open]);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !options.some(o => o.toLowerCase() === search.trim().toLowerCase());

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  }

  function createNew() {
    const v = search.trim();
    if (!v) return;
    if (!options.includes(v)) setOptions(prev => [...prev, v]);
    if (!value.includes(v)) onChange([...value, v]);
    setSearch("");
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white flex items-start justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[38px]">
        <div className="flex flex-wrap gap-1 flex-1">
          {value.length === 0
            ? <span className="text-gray-400">버전 선택</span>
            : value.map(v => (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                {v}
                <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }}
                  className="hover:text-red-500 leading-none">✕</button>
              </span>
            ))
          }
        </div>
        <span className="text-gray-400 text-xs shrink-0 mt-0.5">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canCreate) createNew(); }}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="검색..." />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && !canCreate && <p className="px-3 py-2 text-xs text-gray-400">일치하는 항목 없음</p>}
            {filtered.map(o => (
              <button key={o} type="button"
                className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-indigo-50 transition-colors ${value.includes(o) ? "text-indigo-700" : "text-gray-700"}`}
                onClick={() => toggle(o)}>
                <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-xs font-bold
                  ${value.includes(o) ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"}`}>
                  {value.includes(o) && "✓"}
                </span>
                {o}
              </button>
            ))}
          </div>
          {canCreate && (
            <div className="border-t border-gray-100 p-1.5">
              <button type="button" onClick={createNew}
                className="w-full px-3 py-2 text-xs text-left text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors">
                + 새로운 항목 만들기 &ldquo;{search.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  user: "", swCategory: "", swDetail: "", status: "신규등록",
  company: "", licenseType: "", department: "", usageDate: "", renewalDate: "",
  purchaseDate: "", accountType: "", renewalCycle: "", licenseKey: "", vendor: "",
  workType: "", billingType: "", monthlyKrw: 0, monthlyUsd: 0,
};

interface SwManualAddProps {
  onClose: () => void;
  onSuccess: () => void;
  swCategoryOptions: string[];
  versionOptions: string[];
  companyOptions: string[];
  accountTypeOptions: string[];
  workTypeOptions: string[];
  billingTypeOptions: string[];
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SwManualAdd({ onClose, onSuccess, swCategoryOptions, versionOptions, companyOptions, accountTypeOptions, workTypeOptions, billingTypeOptions }: SwManualAddProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [error, setError] = useState("");
  const certFileRef = useRef<HTMLInputElement>(null);

  function set(key: keyof typeof EMPTY_FORM, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.user.trim()) { setError("사용자는 필수 입력입니다."); return; }
    if (!form.swCategory.trim()) { setError("SW대분류는 필수 입력입니다."); return; }
    setError("");
    setSubmitting(true);
    try {
      let certificateFileUploadId: string | undefined;

      if (certFile) {
        setSubmitStatus("증서 파일 업로드 중…");
        const fd = new FormData();
        fd.append("file", certFile);
        const uploadRes = await fetch("/api/sw/cert-upload", { method: "POST", body: fd });
        const uploadJson = await safeJson(uploadRes);
        if (!uploadJson.ok) throw new Error(uploadJson.error ?? "증서 파일 업로드 실패");
        certificateFileUploadId = uploadJson.fileUploadId;
      }

      setSubmitStatus("Notion에 등록 중…");
      const res = await fetch("/api/sw/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [{ ...form, version: selectedVersions.join(","), certificateFileUploadId }] }),
      });
      const json = await safeJson(res);
      if (!json.ok || json.failed > 0) throw new Error(json.results?.[0]?.error ?? "등록 실패");
      onSuccess();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300";
  const selectCls = inputCls + " bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="font-bold text-base">✏️ SW 자산 직접 등록</div>
            <div className="text-xs opacity-80 mt-0.5">항목을 직접 입력하여 Notion에 등록합니다</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="사용자" required>
              <input className={inputCls} value={form.user} onChange={e => set("user", e.target.value)} placeholder="홍길동" />
            </Field>
            <Field label="SW대분류" required>
              <AddableSelect value={form.swCategory} initOptions={swCategoryOptions}
                onChange={v => set("swCategory", v)} placeholder="SW 선택 또는 추가" />
            </Field>
            <Field label="SW소분류">
              <input className={inputCls} value={form.swDetail} onChange={e => set("swDetail", e.target.value)} placeholder="Office 365" />
            </Field>
            <Field label="버전">
              <AddableMultiSelect value={selectedVersions} initOptions={versionOptions} onChange={setSelectedVersions} />
            </Field>
            <Field label="상태">
              <select className={selectCls} value={form.status} onChange={e => set("status", e.target.value)}>
                {["신규등록","사용중","재고","갱신필요","만료","반납예정","출고준비중","임시지급"].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="라이선스 유형">
              <select className={selectCls} value={form.licenseType} onChange={e => set("licenseType", e.target.value)}>
                <option value="">선택 안 함</option>
                {["영구","구독(업체)","구독(웹)"].map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="법인명">
              <AddableSelect value={form.company} initOptions={companyOptions}
                onChange={v => set("company", v)} placeholder="법인 선택 또는 추가" />
            </Field>
            <Field label="부서">
              <input className={inputCls} value={form.department} onChange={e => set("department", e.target.value)} placeholder="IT팀" />
            </Field>
            <Field label="계정유형">
              <select className={selectCls} value={form.accountType} onChange={e => set("accountType", e.target.value)}>
                <option value="">선택 안 함</option>
                {accountTypeOptions.map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="갱신주기">
              <select className={selectCls} value={form.renewalCycle} onChange={e => set("renewalCycle", e.target.value)}>
                <option value="">선택 안 함</option>
                <option>연</option>
                <option>월</option>
              </select>
            </Field>
            <Field label="사용일자">
              <input type="date" className={inputCls} value={form.usageDate} onChange={e => set("usageDate", e.target.value)} />
            </Field>
            <Field label="갱신필요일">
              <input type="date" className={inputCls} value={form.renewalDate} onChange={e => set("renewalDate", e.target.value)} />
            </Field>
            <Field label="구매일자">
              <input type="date" className={inputCls} value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
            </Field>
            <Field label="구매처">
              <input className={inputCls} value={form.vendor} onChange={e => set("vendor", e.target.value)} placeholder="MS Korea" />
            </Field>
            <div className="col-span-2">
              <Field label="인증키 / 인증계정">
                <input className={inputCls} value={form.licenseKey} onChange={e => set("licenseKey", e.target.value)} placeholder="XXXXX-XXXXX-XXXXX" />
              </Field>
            </div>
            <Field label="SW사용직군">
              <select className={selectCls} value={form.workType} onChange={e => set("workType", e.target.value)}>
                <option value="">선택 안 함</option>
                {workTypeOptions.map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="결재방식">
              <select className={selectCls} value={form.billingType} onChange={e => set("billingType", e.target.value)}>
                <option value="">선택 안 함</option>
                {billingTypeOptions.map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="월비용 KRW">
              <input type="number" className={inputCls} value={form.monthlyKrw || ""} min={0}
                onChange={e => set("monthlyKrw", Number(e.target.value))} placeholder="0" />
            </Field>
            <Field label="월비용 USD">
              <input type="number" className={inputCls} value={form.monthlyUsd || ""} min={0}
                onChange={e => set("monthlyUsd", Number(e.target.value))} placeholder="0" />
            </Field>

            {/* 증서 파일 */}
            <div className="col-span-2">
              <Field label="증서 파일 (선택)">
                <input ref={certFileRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
                {certFile ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm border border-indigo-300 bg-indigo-50 rounded-lg">
                    <span className="text-indigo-600">📎</span>
                    <span className="flex-1 truncate text-indigo-700 font-medium">{certFile.name}</span>
                    <button type="button" onClick={() => { setCertFile(null); if (certFileRef.current) certFileRef.current.value = ""; }}
                      className="text-gray-400 hover:text-red-500 text-xs font-bold">✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => certFileRef.current?.click()}
                    className="w-full px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors text-left">
                    📎 파일 선택 (PDF, 이미지)
                  </button>
                )}
              </Field>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm">
            {submitting ? (submitStatus || "등록 중…") : "🚀 Notion에 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SW 엑셀 업로드 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

// 엑셀 헤더 ↔ SwUploadRow 키 매핑 (다양한 표기 허용)
const SW_COL_MAP: { key: string; aliases: string[] }[] = [
  { key: "user",         aliases: ["사용자","user"] },
  { key: "swCategory",   aliases: ["sw대분류","sw분류","swcategory","대분류"] },
  { key: "swDetail",     aliases: ["sw소분류","소분류","swdetail","에디션","버전명"] },
  { key: "version",      aliases: ["버전","version","ver","버전(쉼표구분)","버전(대표버전구성)"] },
  { key: "status",       aliases: ["상태","status"] },
  { key: "company",      aliases: ["법인명","법인","company"] },
  { key: "licenseType",  aliases: ["라이선스유형","영구/구독","licensetype","유형","라이선스"] },
  { key: "department",   aliases: ["부서","department","dept"] },
  { key: "usageDate",    aliases: ["사용일자","사용날짜","usagedate","use_date"] },
  { key: "renewalDate",  aliases: ["갱신필요일","갱신일","renewaldate","renewal_date"] },
  { key: "purchaseDate", aliases: ["구매일자","구매날짜","purchasedate","purchase_date"] },
  { key: "accountType",  aliases: ["계정유형","accounttype","계정"] },
  { key: "renewalCycle", aliases: ["갱신주기","renewalcycle","주기"] },
  { key: "licenseKey",   aliases: ["인증키/인증계정","인증키","인증계정","licensekey","key","license_key"] },
  { key: "vendor",       aliases: ["구매처","vendor","공급사"] },
  { key: "workType",     aliases: ["sw사용직군","직군","worktype","work_type"] },
  { key: "billingType",  aliases: ["결제방식","결재방식","billingtype","billing"] },
  { key: "monthlyKrw",   aliases: ["월비용krw","월비용(krw)","월비용_krw","krw","월금액(krw)"] },
  { key: "monthlyUsd",   aliases: ["월비용usd","월비용(usd)","월비용_usd","usd","월금액(usd)"] },
];

// 엑셀 날짜 시리얼 → YYYY-MM-DD 문자열
function excelDateToStr(val: string | number): string {
  if (typeof val === "number") {
    return new Date((val - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  return String(val ?? "").trim();
}

// 헤더 행으로부터 컬럼 인덱스 맵 생성
function buildSwColIndex(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().replace(/\s+/g, "");
    for (const { key, aliases } of SW_COL_MAP) {
      if (aliases.some(a => a.replace(/\s+/g, "") === norm)) {
        idx[key] = i;
        break;
      }
    }
  });
  return idx;
}

interface SwUploadRowClient {
  user: string; swCategory: string; swDetail: string; version: string;
  status: string; company: string; licenseType: string; department: string;
  usageDate: string; renewalDate: string; purchaseDate: string;
  accountType: string; renewalCycle: string; licenseKey: string;
  vendor: string; workType: string; billingType: string;
  monthlyKrw: number; monthlyUsd: number;
}

type UploadResult = { index: number; user: string; sw: string; ok: boolean; error?: string };

function SwExcelUpload({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [rows,      setRows]      = useState<SwUploadRowClient[]>([]);
  const [fileName,  setFileName]  = useState("");
  const [parseErr,  setParseErr]  = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [results,   setResults]   = useState<UploadResult[] | null>(null);
  const [summary,   setSummary]   = useState<{ success: number; failed: number } | null>(null);

  // ── 양식 다운로드 ─────────────────────────────────────────────────────────
  function downloadTemplate() {
    const headers = [
      "사용자","SW대분류","SW소분류","버전(쉼표구분)","상태",
      "법인명","라이선스유형","부서","사용일자","갱신필요일","구매일자",
      "계정유형","갱신주기","인증키/인증계정","구매처","SW사용직군","결제방식",
      "월비용KRW","월비용USD",
    ];
    const sample = [
      "홍길동","MS Office","Office 365","2021,2024","사용중",
      "대웅제약","영구","IT팀","2024-01-01","2025-12-31","2024-01-01",
      "법인","연","XXXXX-XXXXX-XXXXX","MS Korea","사무직","법인카드",
      0, 0,
    ];
    const note = [
      "※ 사용자·SW대분류는 필수 입력",
      "상태: 사용중/재고/갱신필요/만료/신규등록",
      "라이선스유형: 영구/구독(업체)/구독(웹)",
      "버전: 쉼표로 구분 (예: 2021,2024)",
      "날짜: YYYY-MM-DD 형식",
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);

    // 컬럼 너비 설정
    ws["!cols"] = headers.map(() => ({ wch: 18 }));

    // 안내 시트 추가
    const noteWs = XLSX.utils.aoa_to_sheet(note.map(n => [n]));
    noteWs["!cols"] = [{ wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SW등록양식");
    XLSX.utils.book_append_sheet(wb, noteWs, "입력안내");
    XLSX.writeFile(wb, "SW자산_등록양식.xlsx");
  }

  // ── 파일 파싱 ─────────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setParseErr(""); setRows([]); setResults(null); setSummary(null);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
      if (raw.length < 2) throw new Error("데이터 행이 없습니다 (헤더 + 최소 1행 필요)");

      const headers  = (raw[0] as unknown[]).map(h => String(h ?? ""));
      const colIdx   = buildSwColIndex(headers);
      const parsed: SwUploadRowClient[] = [];

      for (let i = 1; i < raw.length; i++) {
        const r = raw[i] as unknown[];
        const user = String(r[colIdx["user"] ?? -1] ?? "").trim();
        if (!user) continue; // 빈 행 스킵

        const get = (key: string) => String(r[colIdx[key] ?? -1] ?? "").trim();
        const getNum = (key: string) => {
          const v = r[colIdx[key] ?? -1];
          return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
        };

        parsed.push({
          user,
          swCategory:   get("swCategory"),
          swDetail:     get("swDetail"),
          version:      get("version"),
          status:       get("status") || "신규등록",
          company:      get("company"),
          licenseType:  get("licenseType"),
          department:   get("department"),
          usageDate:    excelDateToStr(r[colIdx["usageDate"] ?? -1] as string | number),
          renewalDate:  excelDateToStr(r[colIdx["renewalDate"] ?? -1] as string | number),
          purchaseDate: excelDateToStr(r[colIdx["purchaseDate"] ?? -1] as string | number),
          accountType:  get("accountType"),
          renewalCycle: get("renewalCycle"),
          licenseKey:   get("licenseKey"),
          vendor:       get("vendor"),
          workType:     get("workType"),
          billingType:  get("billingType"),
          monthlyKrw:   getNum("monthlyKrw"),
          monthlyUsd:   getNum("monthlyUsd"),
        });
      }

      if (parsed.length === 0) throw new Error("유효한 데이터 행이 없습니다. '사용자' 컬럼을 확인해 주세요.");
      if (parsed.length > 200) throw new Error("한 번에 최대 200건까지 업로드 가능합니다.");

      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setParseErr(String(e));
    }
  }

  // ── Notion 업로드 ─────────────────────────────────────────────────────────
  async function doUpload() {
    setUploading(true); setProgress(0); setResults(null); setSummary(null);
    try {
      const timer = setInterval(() => setProgress(p => Math.min(p + Math.random() * 10, 88)), 500);
      const res   = await fetch("/api/sw/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await safeJson(res);
      clearInterval(timer);
      setProgress(100);
      if (!json.ok) throw new Error(json.error);
      setResults(json.results);
      setSummary({ success: json.success, failed: json.failed });
      // 캐시 무효화 → 목록 갱신
      await fetch("/api/sw-records/cache-clear", { method: "POST" });
      if (json.failed === 0) {
        setTimeout(() => { onSuccess(); onClose(); }, 2000);
      }
    } catch (e) {
      setParseErr(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="font-bold text-base">📂 SW 자산 엑셀 등록</div>
            <div className="text-xs opacity-80 mt-0.5">양식을 다운로드 후 작성하여 업로드하세요</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* 안내 + 양식 다운로드 */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1 text-xs text-indigo-700 space-y-1">
              <p className="font-semibold text-sm text-indigo-800">📋 업로드 순서</p>
              <p>① 아래 <strong>양식 다운로드</strong> → ② 엑셀에 데이터 입력 → ③ 파일 업로드 → ④ Notion 자동 등록</p>
              <p className="text-indigo-500">필수 컬럼: <strong>사용자</strong> · <strong>SW대분류</strong> / 최대 200건</p>
            </div>
            <button onClick={downloadTemplate}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
              ⬇️ 양식 다운로드
            </button>
          </div>

          {/* 파일 업로드 영역 */}
          {rows.length === 0 && !parseErr && (
            <div
              className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
              <div className="text-4xl mb-3">📂</div>
              <p className="text-sm font-semibold text-gray-700">엑셀 파일을 드래그하거나 클릭하여 선택</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx · .xls 지원</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* 파싱 오류 */}
          {parseErr && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">⚠️ 오류</p>
              <p>{parseErr}</p>
              <button onClick={() => { setParseErr(""); setRows([]); }}
                className="mt-2 text-xs underline text-red-600">다시 시도</button>
            </div>
          )}

          {/* 파싱 완료 — 프리뷰 */}
          {rows.length > 0 && !results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  📄 <span className="text-gray-500 font-normal">{fileName}</span> —
                  <span className="text-indigo-600 font-bold ml-1">{rows.length}건</span> 파싱됨
                </p>
                <button onClick={() => { setRows([]); setFileName(""); }}
                  className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors">
                  × 다시 선택
                </button>
              </div>

              {/* 프리뷰 테이블 */}
              <div className="border border-gray-200 rounded-xl overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {["#","사용자","SW대분류","SW소분류","상태","법인명","유형","사용일자","갱신필요일"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap border-b border-gray-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-indigo-50/30">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.user}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.swCategory || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.swDetail || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{r.status}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.company || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.licenseType || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.usageDate || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.renewalDate || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr><td colSpan={9} className="px-3 py-2 text-center text-gray-400 text-xs">… 외 {rows.length - 50}건 (미리보기 50건만 표시)</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 업로드 버튼 */}
              {!uploading && (
                <button onClick={doUpload}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                  🚀 Notion에 {rows.length}건 등록
                </button>
              )}
            </div>
          )}

          {/* 업로드 진행 중 */}
          {uploading && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Notion 등록 중… {Math.round(progress)}%</p>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Notion API 속도 제한으로 건당 약 0.35초 소요됩니다.</p>
            </div>
          )}

          {/* 결과 */}
          {results && summary && (
            <div className={`rounded-xl border p-4 ${summary.failed === 0 ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
              <p className={`font-bold text-base mb-2 ${summary.failed === 0 ? "text-green-700" : "text-orange-700"}`}>
                {summary.failed === 0 ? "✅ 등록 완료!" : `⚠️ 일부 오류 발생`}
              </p>
              <p className="text-sm text-gray-600">
                성공 <strong className="text-green-600">{summary.success}건</strong>
                {summary.failed > 0 && <> · 실패 <strong className="text-red-600">{summary.failed}건</strong></>}
              </p>
              {summary.failed > 0 && (
                <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                  {results.filter(r => !r.ok).map((r, i) => (
                    <p key={i} className="text-xs text-red-600">#{r.index + 1} {r.user} — {r.error}</p>
                  ))}
                </div>
              )}
              {summary.failed === 0 && <p className="text-xs text-green-500 mt-1">잠시 후 목록이 자동 갱신됩니다…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LicensePanel({ company = "" }: { company?: string }) {
  const [records,    setRecords]    = useState<SwDbRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<"category" | "list">("list");
  const [editRecord, setEditRecord] = useState<SwDbRecord | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const maSwCategoryOptions  = useMemo(() => [...new Set(records.map(r => r.swCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")), [records]);
  const maVersionOptions     = useMemo(() => [...new Set(records.flatMap(r => r.version ?? []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")), [records]);
  const maCompanyOptions     = useMemo(() => [...new Set(records.map(r => r.company).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")), [records]);
  const maAccountTypeOptions = useMemo(() => [...new Set(records.map(r => r.accountType).filter(Boolean))], [records]);
  const maWorkTypeOptions    = useMemo(() => [...new Set(records.map(r => r.workType).filter(Boolean))], [records]);
  const maBillingTypeOptions = useMemo(() => [...new Set(records.map(r => r.billingType).filter((v): v is string => !!v))], [records]);

  const handleUploadSuccess = useCallback(() => {
    const url = company ? `/api/sw-records?company=${encodeURIComponent(company)}` : "/api/sw-records";
    // 업로드 후 sessionStorage 무효화
    scDel(SC_SWREC_LP(company));
    fetch(url)
      .then(r => safeJson(r))
      .then(res => {
        if (!res.missingEnv) {
          setRecords(res.data ?? []);
          scSet(SC_SWREC_LP(company), res.data ?? [], TTL_SWREC_LP);
        }
      });
  }, [company]);

  const handleUpdate = useCallback(async (id: string, fields: Partial<SwDbRecord>) => {
    const res  = await fetch("/api/sw/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fields }),
    });
    const json = await safeJson(res);
    if (!json.ok) throw new Error(json.error ?? "Notion 업데이트 실패");
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
  }, []);

  // 필터 상태
  const [search,           setSearch]           = useState("");
  const [filterMacrocat,   setFilterMacrocat]   = useState("전체");
  const [filterSwName,     setFilterSwName]     = useState("전체");   // SW대분류 정확값
  const [filterVersion,    setFilterVersion]    = useState("전체");   // 버전
  const [filterStatus,     setFilterStatus]     = useState("전체");
  const [filterType,       setFilterType]       = useState("전체");   // 영구 / 구독(업체) / 구독(웹)
  const [filterCompany,    setFilterCompany]    = useState("전체");   // company prop 있으면 데이터가 이미 필터됨
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);

  // 페이지
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const url = company ? `/api/sw-records?company=${encodeURIComponent(company)}` : "/api/sw-records";
    const cacheKey = SC_SWREC_LP(company);

    const cached = scGet<SwDbRecord[]>(cacheKey);
    if (cached) {
      setRecords(cached);
      setLoading(false);
      // 백그라운드 재검증
      fetch(url).then(r => safeJson(r)).then(res => {
        if (res.missingEnv) return;
        setRecords(res.data ?? []);
        scSet(cacheKey, res.data ?? [], TTL_SWREC_LP);
      }).catch(() => {});
      return;
    }

    fetch(url)
      .then(r => safeJson(r))
      .then(res => {
        if (res.missingEnv) { setMissingEnv(res.missingEnv); return; }
        setRecords(res.data ?? []);
        scSet(cacheKey, res.data ?? [], TTL_SWREC_LP);
      })
      .finally(() => setLoading(false));
  }, [company]); // eslint-disable-line react-hooks/exhaustive-deps

  // filterMacrocat 변경 시 SW명 필터 초기화
  useEffect(() => { setFilterSwName("전체"); }, [filterMacrocat]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMacrocat, filterSwName, filterVersion, filterStatus, filterType, filterCompany, showExpiringSoon]);

  // ── 드롭다운 옵션 ───────────────────────────────────────────────────
  const statusOptions  = useMemo(() => ["전체", ...Array.from(new Set(records.map(r => r.status).filter(Boolean)))], [records]);
  const companyOptions = useMemo(() => ["전체", ...Array.from(new Set(records.map(r => r.company).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"))], [records]);
  const macroCatOptions = useMemo(() => {
    const cats = Array.from(new Set(records.map(r => getSwMacroCategory(r.swCategory).label)));
    return ["전체", ...["문서/오피스","AI 툴","개발 툴","협업 툴","디자인/그래픽","설계/CAD","RPA/자동화","기타"].filter(c => cats.includes(c))];
  }, [records]);
  // SW명: 매크로 분류 선택 시 해당 분류의 SW만 표시
  const swNameOptions = useMemo(() => {
    const relevant = filterMacrocat === "전체"
      ? records
      : records.filter(r => getSwMacroCategory(r.swCategory).label === filterMacrocat);
    return ["전체", ...Array.from(new Set(relevant.map(r => r.swCategory).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"))];
  }, [records, filterMacrocat]);
  const versionOptions = useMemo(() => {
    const all = records.flatMap(r => r.version ?? []).filter(Boolean);
    return ["전체", ...Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, "ko"))];
  }, [records]);

  // ── 필터링 ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => records.filter(r => {
    if (filterType      !== "전체" && r.licenseType !== filterType)    return false;
    if (filterStatus    !== "전체" && r.status      !== filterStatus)  return false;
    if (filterCompany   !== "전체" && r.company     !== filterCompany) return false;
    if (filterMacrocat  !== "전체" && getSwMacroCategory(r.swCategory).label !== filterMacrocat) return false;
    if (filterSwName    !== "전체" && r.swCategory  !== filterSwName)  return false;
    if (filterVersion   !== "전체" && !(r.version ?? []).includes(filterVersion)) return false;
    if (showExpiringSoon) {
      const d = daysLeft(r.renewalDate);
      if (d === null || d < 0 || d > 30) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (![r.swCategory, r.swDetail, r.user, r.department, r.company, r.licenseType, r.status]
        .filter(Boolean).some(v => v.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [records, filterType, filterStatus, filterCompany, filterMacrocat, filterSwName, filterVersion, showExpiringSoon, search]);

  const paginated = useMemo(() =>
    filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const activeFilters = [
    { label: `분류: ${filterMacrocat}`,   active: filterMacrocat !== "전체",  clear: () => setFilterMacrocat("전체")  },
    { label: `SW: ${filterSwName}`,        active: filterSwName   !== "전체",  clear: () => setFilterSwName("전체")    },
    { label: `버전: ${filterVersion}`,     active: filterVersion  !== "전체",  clear: () => setFilterVersion("전체")   },
    { label: `상태: ${filterStatus}`,      active: filterStatus   !== "전체",  clear: () => setFilterStatus("전체")    },
    { label: `법인: ${filterCompany}`,     active: filterCompany  !== "전체",  clear: () => setFilterCompany("전체")   },
    { label: "갱신임박 30일",               active: showExpiringSoon,            clear: () => setShowExpiringSoon(false) },
  ].filter(f => f.active);

  function resetFilters() {
    setSearch(""); setFilterMacrocat("전체"); setFilterSwName("전체"); setFilterVersion("전체");
    setFilterStatus("전체"); setFilterCompany("전체"); setShowExpiringSoon(false);
  }

  // ── 빠른 통계 ──────────────────────────────────────────────────────
  const quickStats = useMemo(() => ({
    total:    records.length,
    byType: {
      "영구":       records.filter(r => r.licenseType === "영구").length,
      "구독(업체)": records.filter(r => r.licenseType === "구독(업체)").length,
      "구독(웹)":   records.filter(r => r.licenseType === "구독(웹)").length,
    },
    using:    records.filter(r => r.status === "사용중" || r.status === "신규등록").length,
    expiring: records.filter(r => { const d = daysLeft(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length,
  }), [records]);

  const thS = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap";

  if (loading) return <div className="text-center py-20 text-gray-400">Notion 데이터 로딩 중...</div>;
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  return (
    <div className="fade-in">
      {/* ── 헤더 ── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">라이선스 현황</h2>
          <p className="text-sm text-gray-500">영구 · 구독 통합 SW 라이선스 검색 (Notion 실시간 연동)</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowManualAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-300 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
          >
            ✏️ 직접 등록
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            📂 엑셀 등록
          </button>
        </div>
      </div>

      {/* ── 라이선스 유형 탭 ── */}
      <div className="flex gap-1.5 p-1.5 bg-gray-100 rounded-xl mb-4">
        {([
          { value: "전체",      label: "전체",         count: quickStats.total,              color: "text-gray-800"   },
          { value: "영구",      label: "영구라이선스",  count: quickStats.byType["영구"],      color: "text-blue-700"   },
          { value: "구독(업체)", label: "구독형(업체)", count: quickStats.byType["구독(업체)"], color: "text-purple-700" },
          { value: "구독(웹)",  label: "구독형(웹)",   count: quickStats.byType["구독(웹)"],   color: "text-cyan-700"   },
        ] as const).map(tab => (
          <button key={tab.value} onClick={() => setFilterType(tab.value)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              filterType === tab.value
                ? `bg-white shadow-sm ${tab.color}`
                : "text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              filterType === tab.value ? "bg-gray-100" : "bg-gray-200 text-gray-500"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── 빠른 통계 뱃지 ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          { label: "사용중",    value: quickStats.using,     accent: "bg-blue-50 text-blue-600",  active: filterStatus === "사용중",  onClick: () => setFilterStatus(v => v === "사용중" ? "전체" : "사용중") },
          { label: "⏰ 갱신임박", value: quickStats.expiring, accent: quickStats.expiring > 0 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-400", active: showExpiringSoon, onClick: () => setShowExpiringSoon(v => !v) },
        ] as const).map(s => (
          <button key={s.label} onClick={s.onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              s.active
                ? "border-blue-500 ring-1 ring-blue-400 " + s.accent
                : "border-transparent " + s.accent + " hover:border-gray-300"
            }`}>
            {s.label}
            <span className="font-bold">{s.value}</span>
          </button>
        ))}
        {activeFilters.length > 0 && (
          <button onClick={resetFilters}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
            × 초기화
          </button>
        )}
      </div>

      {/* ── 필터 영역 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="SW명, 사용자, 부서, 법인 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "분류",  value: filterMacrocat, options: macroCatOptions, setter: setFilterMacrocat, show: true     },
            { label: "SW명",  value: filterSwName,   options: swNameOptions,   setter: setFilterSwName,   show: true     },
            { label: "버전",  value: filterVersion,  options: versionOptions,  setter: setFilterVersion,  show: true     },
            { label: "상태",  value: filterStatus,   options: statusOptions,   setter: setFilterStatus,   show: true     },
            { label: "법인",  value: filterCompany,  options: companyOptions,  setter: setFilterCompany,  show: !company },
          ].filter(f => f.show).map(({ label, value, options, setter }) => (
            <div key={label} className="relative">
              <select value={value} onChange={e => setter(e.target.value)}
                className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${
                  value !== "전체"
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-600"
                }`}>
                <option value="전체">{label}: 전체</option>
                {options.filter(o => o !== "전체").map(o => <option key={o}>{o}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
            </div>
          ))}
          {activeFilters.length > 0 && (
            <button onClick={resetFilters}
              className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
              × 필터 초기화
            </button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400 mr-1">적용된 필터:</span>
            {activeFilters.map(f => (
              <span key={f.label} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                {f.label}
                <button onClick={f.clear} className="hover:text-blue-900 font-bold text-blue-500">×</button>
              </span>
            ))}
            <span className="ml-auto text-xs text-gray-400 font-medium">{filtered.length}건</span>
          </div>
        )}
        {activeFilters.length === 0 && (
          <div className="text-right text-xs text-gray-400">{records.length}건 전체</div>
        )}
      </div>

      {/* ── 뷰 토글 ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {([["category", "📂 카테고리별"], ["list", "📋 전체 목록"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setDetailView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                detailView === v
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{filtered.length}건 조회됨</span>
      </div>

      {/* ── 직접 등록 모달 ── */}
      {showManualAdd && (
        <SwManualAdd
          onClose={() => setShowManualAdd(false)}
          onSuccess={handleUploadSuccess}
          swCategoryOptions={maSwCategoryOptions}
          versionOptions={maVersionOptions}
          companyOptions={maCompanyOptions}
          accountTypeOptions={maAccountTypeOptions}
          workTypeOptions={maWorkTypeOptions}
          billingTypeOptions={maBillingTypeOptions}
        />
      )}

      {/* ── 엑셀 업로드 모달 ── */}
      {showUpload && (
        <SwExcelUpload
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* ── 수정 모달 ── */}
      {editRecord && (
        <SwEditModal
          record={editRecord}
          onSave={handleUpdate}
          onClose={() => setEditRecord(null)}
        />
      )}

      {/* ── 카테고리별 뷰 ── */}
      {detailView === "category" && <CategoryView records={filtered} onEdit={setEditRecord} />}

      {/* ── 전체 목록 뷰 ── */}
      {detailView === "list" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">
                    <ColFilter label="SW 분류" value={filterMacrocat} options={macroCatOptions} onChange={setFilterMacrocat} />
                  </th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">
                    <ColFilter label="유형" value={filterType} options={["전체","영구","구독(업체)","구독(웹)"]} onChange={setFilterType} />
                  </th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">
                    <ColFilter label="버전" value={filterVersion} options={versionOptions} onChange={setFilterVersion} />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">사용자</th>
                  <th className={thS}>부서</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">
                    <ColFilter label="법인" value={filterCompany} options={companyOptions} onChange={setFilterCompany} />
                  </th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">
                    <ColFilter label="상태" value={filterStatus} options={statusOptions} onChange={setFilterStatus} />
                  </th>
                  <th className={thS}>갱신일</th>
                  <th className={thS}>인증키</th>
                  <th className={thS}>노션</th>
                  <th className={thS}>최종수정</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-gray-400">검색 결과가 없습니다</td>
                  </tr>
                ) : paginated.map(r => {
                  const days = daysLeft(r.renewalDate);
                  const isExpiring = days !== null && days >= 0 && days <= 30;
                  const isPermanent = r.licenseType === "영구";
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-900 text-xs">{r.swCategory || "—"}</div>
                        {r.swDetail && <div className="text-xs text-gray-400">{r.swDetail}</div>}
                      </td>
                      <td className="px-3 py-3"><TypeBadge type={r.licenseType} /></td>
                      <td className="px-3 py-3 text-xs text-gray-600">{(r.version ?? []).length > 0 ? r.version.join(", ") : "—"}</td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-900">{r.user || "재고"}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{r.department || "—"}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">{r.company || "—"}</td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {r.renewalDate ? (
                          <span className={
                            r.status === "만료" ? "text-gray-400" :
                            isExpiring ? "text-red-600 font-semibold" : "text-gray-600"
                          }>
                            {fmtDate(r.renewalDate)}
                            {isExpiring && days !== null && (
                              <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-xs">D-{days}</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {isPermanent && r.licenseKey ? (
                          <CopyButton text={r.licenseKey} label="키" />
                        ) : isPermanent ? (
                          <span className="text-xs text-gray-300">없음</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {r.notionUrl
                          ? <a href={r.notionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 text-xs underline">보기</a>
                          : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {r.lastModifiedBy ? (
                          <div className="text-[11px]">
                            <div className="text-gray-700 font-medium">{r.lastModifiedBy}</div>
                            <div className="text-gray-400">{fmtDateTime(r.lastModifiedAt)}</div>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setEditRecord(r)}
                          className="text-xs text-gray-400 hover:text-blue-600 border border-gray-100 hover:border-blue-300 px-2 py-0.5 rounded transition-colors"
                        >✏️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination total={filtered.length} page={currentPage} size={PAGE_SIZE} onChange={setCurrentPage} />
        </>
      )}
    </div>
  );
}

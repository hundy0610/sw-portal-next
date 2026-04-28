"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contract } from "@/types/contract";

const UNIT_PRICE_DEFAULT = 6000;
const MAX_PDF_MB = 4; // Vercel 서버리스 request body 한도 4.5MB 이내로 여유 설정

// ── 유틸 ──────────────────────────────────────────────────────
function fmt(d: string) {
  return d ? d.replace(/-/g, ".") : "-";
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}
function isExpiringSoon(c: Contract) {
  return c.status === "active" && daysUntil(c.endDate) <= 60 && daysUntil(c.endDate) > 0;
}
function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

// ── 이메일 복사 버튼 ─────────────────────────────────────────
function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  if (!email) return <span className="text-gray-300 text-xs">-</span>;
  return (
    <button
      className="group flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(email).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      title="클릭하여 복사"
    >
      <span className="underline underline-offset-2 decoration-dotted">{email}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
      {copied && <span className="text-green-600 font-medium">복사됨</span>}
    </button>
  );
}

// ── 상태 뱃지 ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: Contract["status"] }) {
  const m = {
    active:  { bg: "#E3FCEF", color: "#006644", label: "진행중" },
    expired: { bg: "#FFEBE6", color: "#BF2600", label: "만료"   },
    pending: { bg: "#FFFAE6", color: "#974F0C", label: "예정"   },
  }[status];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

// ── 빈 폼 ─────────────────────────────────────────────────────
type FormState = {
  company: string;
  contactName: string;
  contactEmail: string;
  startDate: string;
  endDate: string;
  quantity: number;
  unitPrice: number;
  notes: string;
};

const EMPTY: FormState = {
  company: "", contactName: "", contactEmail: "",
  startDate: "", endDate: "", quantity: 1,
  unitPrice: UNIT_PRICE_DEFAULT, notes: "",
};

// ═════════════════════════════════════════════════════════════
export default function ContractPanel() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Contract | null>(null);
  const [form,  setForm]  = useState<FormState>({ ...EMPTY });
  const [pdfFile,  setPdfFile]  = useState<File | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [filter,   setFilter]   = useState<"all" | "active" | "expired" | "pending">("all");
  const [search,   setSearch]   = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 백스페이스 → 브라우저 뒤로가기 방지 ─────────────────────
  useEffect(() => {
    if (!showModal) return;

    // 히스토리 상태 push: 뒤로가기 버튼이 여기서 잡힘
    history.pushState({ contractModal: true }, "");

    function onPopState() {
      // 뒤로가기 발생 → 모달이 열린 채이면 닫지 않고 다시 push
      if (showModal) history.pushState({ contractModal: true }, "");
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Backspace") return;
      const el = e.target as HTMLElement;
      const tag = el.tagName.toLowerCase();
      // 입력 필드가 아닌 곳에서의 Backspace는 브라우저 뒤로가기 → 차단
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        el.isContentEditable;
      if (!isEditable) e.preventDefault();
    }

    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showModal]);

  // ── 데이터 로드 ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/contracts");
      const data = await res.json();
      if (data.ok) setContracts(data.contracts ?? []);
      else showToast("데이터 로드 실패", "err");
    } catch {
      showToast("데이터 로드 실패", "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 토스트 ────────────────────────────────────────────────────
  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── 모달 오픈 ────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY });
    setPdfFile(null);
    setShowModal(true);
  }

  function openEdit(c: Contract) {
    setEditTarget(c);
    setForm({
      company:      c.company,
      contactName:  c.contactName,
      contactEmail: c.contactEmail,
      startDate:    c.startDate,
      endDate:      c.endDate,
      quantity:     c.quantity,
      unitPrice:    c.unitPrice,
      notes:        c.notes,
    });
    setPdfFile(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setPdfFile(null);
  }

  // ── 저장 (FormData → multipart) ─────────────────────────────
  async function handleSave() {
    if (!form.company || !form.contactName || !form.startDate || !form.endDate) {
      showToast("법인명, 담당자, 계약기간은 필수입니다", "err");
      return;
    }
    if (pdfFile && pdfFile.size > MAX_PDF_MB * 1024 * 1024) {
      showToast(`PDF 파일은 ${MAX_PDF_MB}MB 이하만 업로드 가능합니다`, "err");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("company",      form.company);
      fd.append("contactName",  form.contactName);
      fd.append("contactEmail", form.contactEmail);
      fd.append("startDate",    form.startDate);
      fd.append("endDate",      form.endDate);
      fd.append("quantity",     String(form.quantity));
      fd.append("unitPrice",    String(form.unitPrice));
      fd.append("notes",        form.notes);
      if (pdfFile) fd.append("pdf", pdfFile);

      const url    = editTarget ? `/api/contracts/${editTarget.id}` : "/api/contracts";
      const method = editTarget ? "PUT" : "POST";
      const res    = await fetch(url, { method, body: fd });
      const data   = await res.json();

      if (data.ok) {
        showToast(editTarget ? "계약이 수정되었습니다" : "계약이 등록되었습니다", "ok");
        closeModal();
        await load();
      } else {
        showToast(data.error ?? "저장 실패", "err");
      }
    } catch {
      showToast("저장 중 오류가 발생했습니다", "err");
    } finally {
      setSaving(false);
    }
  }

  // ── 삭제 ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    try {
      const res  = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("계약이 삭제되었습니다", "ok");
        setDeleteId(null);
        await load();
      } else {
        showToast(data.error ?? "삭제 실패", "err");
      }
    } catch {
      showToast("삭제 중 오류가 발생했습니다", "err");
    }
  }

  // ── KPI ──────────────────────────────────────────────────────
  const active         = contracts.filter((c) => c.status === "active");
  const totalQty       = active.reduce((s, c) => s + c.quantity, 0);
  const monthlyRevenue = active.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const expiringSoon   = contracts.filter(isExpiringSoon);

  // ── 필터 ─────────────────────────────────────────────────────
  const filtered = contracts
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) => !search || c.company.includes(search) || c.contactName.includes(search))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  // ── 입력 헬퍼 ────────────────────────────────────────────────
  function field<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.type === "number" ? (Number(e.target.value) as FormState[K]) : (e.target.value as FormState[K]);
      setForm((prev) => ({ ...prev, [key]: v }));
    };
  }

  // ── 만료 알림 배너 ───────────────────────────────────────────
  const AlertBanner = expiringSoon.length > 0 && (
    <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg border"
      style={{ background: "#FFFAE6", borderColor: "#FFE380" }}>
      <span className="text-xl mt-0.5">⚠️</span>
      <div>
        <div className="font-semibold text-sm" style={{ color: "#974F0C" }}>
          계약 만료 임박 알림 — {expiringSoon.length}건
        </div>
        <div className="text-xs mt-1 space-y-0.5" style={{ color: "#974F0C" }}>
          {expiringSoon.map((c) => (
            <div key={c.id}>
              · <strong>{c.company}</strong> — {fmt(c.endDate)} 만료 ({daysUntil(c.endDate)}일 후)
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ═════════════════════════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto fade-in">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">계약 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">PC/OA 유지보수 서비스 계약 현황</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: "#0052CC" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0747A6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#0052CC")}
        >
          <span className="text-base">+</span> 계약 등록
        </button>
      </div>

      {AlertBanner}

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "진행중 계약",  value: `${active.length}건`,            icon: "📋", bg: "#E9F2FF", tc: "#0052CC" },
          { label: "총 관리 PC",   value: `${totalQty.toLocaleString()}대`, icon: "💻", bg: "#E3FCEF", tc: "#006644" },
          { label: "월 수익",      value: won(monthlyRevenue),              icon: "💰", bg: "#FFFAE6", tc: "#974F0C" },
          { label: "연 수익",      value: won(monthlyRevenue * 12),         icon: "📈", bg: "#FFEBE6", tc: "#BF2600" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: k.bg }}>{k.icon}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: k.tc }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 필터 + 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-1">
            {(["all", "active", "expired", "pending"] as const).map((f) => {
              const cnt = f === "all" ? contracts.length : contracts.filter((c) => c.status === f).length;
              const labels = { all: "전체", active: "진행중", expired: "만료", pending: "예정" };
              return (
                <button key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filter === f ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}>
                  {labels[f]} ({cnt})
                </button>
              );
            })}
          </div>
          <input
            className="form-input w-48"
            placeholder="법인명 · 담당자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {contracts.length === 0 ? "등록된 계약이 없습니다." : "검색 결과가 없습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>법인명</th>
                  <th>담당자</th>
                  <th>이메일</th>
                  <th>계약기간</th>
                  <th>PC 수량</th>
                  <th>월 수익</th>
                  <th>상태</th>
                  <th>계약서</th>
                  <th style={{ width: 90 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const expiring = isExpiringSoon(c);
                  const monthly  = c.quantity * c.unitPrice;
                  return (
                    <tr key={c.id} style={expiring ? { background: "#FFFDF0" } : undefined}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{c.company}</span>
                          {expiring && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: "#FFE380", color: "#974F0C" }}>만료임박</span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm text-gray-900">{c.contactName}</td>
                      <td><CopyEmail email={c.contactEmail} /></td>
                      <td className="whitespace-nowrap">
                        <div className="text-sm">{fmt(c.startDate)}</div>
                        <div className="text-xs text-gray-400">~ {fmt(c.endDate)}</div>
                        {c.status === "active" && daysUntil(c.endDate) > 0 && (
                          <div className="text-xs text-gray-400">{daysUntil(c.endDate)}일 남음</div>
                        )}
                      </td>
                      <td className="text-right font-medium">{c.quantity.toLocaleString()}대</td>
                      <td className="text-right font-medium" style={{ color: "#0052CC" }}>
                        {won(monthly)}
                        <div className="text-xs text-gray-400 font-normal">연 {won(monthly * 12)}</div>
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        {c.pdfUrl ? (
                          <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            📄 {c.pdfName || "보기"}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">없음</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(c)}
                            className="px-2 py-1 text-xs rounded text-blue-600 hover:bg-blue-50 transition-colors font-medium">
                            수정
                          </button>
                          <button onClick={() => setDeleteId(c.id)}
                            className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50 transition-colors font-medium">
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>총 {filtered.length}건</span>
            <span>
              조회된 계약 월 수익:{" "}
              <strong className="text-gray-700">
                {won(filtered.reduce((s, c) => s + (c.status === "active" ? c.quantity * c.unitPrice : 0), 0))}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* ══ 등록 / 수정 모달 ══ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onMouseDown={(e) => {
            // 백드롭 클릭 시 닫기 — 단, 입력 중 실수 클릭 방지를 위해 mousedown 기준
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-base">
                {editTarget ? "계약 수정" : "계약 등록"}
              </h2>
              <button onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100">
                ×
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="px-6 py-5 space-y-4">

              {/* 법인명 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  법인명 <span className="text-red-500">*</span>
                </label>
                <input className="form-input" placeholder="예) 베어월드 주식회사"
                  value={form.company} onChange={field("company")} />
              </div>

              {/* 담당자 + 이메일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    담당자명 <span className="text-red-500">*</span>
                  </label>
                  <input className="form-input" placeholder="홍길동"
                    value={form.contactName} onChange={field("contactName")} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    이메일
                    <span className="ml-1 text-gray-400 font-normal">(목록에서 복사 가능)</span>
                  </label>
                  <input className="form-input" placeholder="hong@company.com"
                    value={form.contactEmail} onChange={field("contactEmail")} />
                </div>
              </div>

              {/* 계약 기간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    계약 시작일 <span className="text-red-500">*</span>
                  </label>
                  <input type="date" className="form-input"
                    value={form.startDate} onChange={field("startDate")} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    계약 종료일 <span className="text-red-500">*</span>
                  </label>
                  <input type="date" className="form-input"
                    value={form.endDate} onChange={field("endDate")} />
                </div>
              </div>

              {/* PC 수량 + 단가 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">PC 수량 (대)</label>
                  <input type="number" min={1} className="form-input"
                    value={form.quantity} onChange={field("quantity")} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">단가 (원/대/월)</label>
                  <input type="number" min={0} className="form-input"
                    value={form.unitPrice} onChange={field("unitPrice")} />
                </div>
              </div>

              {/* 수익 미리보기 */}
              {form.quantity > 0 && form.unitPrice > 0 && (
                <div className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm"
                  style={{ background: "#E9F2FF" }}>
                  <div>
                    <span className="text-gray-500 text-xs">월 수익</span>
                    <div className="font-bold text-blue-700">{won(form.quantity * form.unitPrice)}</div>
                  </div>
                  <div className="w-px h-8 bg-blue-200" />
                  <div>
                    <span className="text-gray-500 text-xs">연 수익</span>
                    <div className="font-bold text-blue-700">{won(form.quantity * form.unitPrice * 12)}</div>
                  </div>
                </div>
              )}

              {/* 계약서 PDF 업로드 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  계약서 PDF
                  <span className="ml-1 text-gray-400 font-normal">(최대 {MAX_PDF_MB}MB)</span>
                </label>

                {/* 기존 파일 표시 (수정 모드) */}
                {editTarget?.pdfUrl && !pdfFile && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                    <span className="text-base">📄</span>
                    <a href={editTarget.pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex-1 truncate">
                      {editTarget.pdfName || "계약서 파일"}
                    </a>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50">
                      교체
                    </button>
                  </div>
                )}

                {/* 새 파일 선택됨 */}
                {pdfFile && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
                    <span className="text-base">📄</span>
                    <span className="text-xs text-green-700 flex-1 truncate">{pdfFile.name}</span>
                    <span className="text-xs text-gray-400">
                      {(pdfFile.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <button
                      onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-100 hover:bg-red-50">
                      제거
                    </button>
                  </div>
                )}

                {/* 파일 선택 버튼 (기존 파일 없거나 새로 교체할 때) */}
                {!pdfFile && !(editTarget?.pdfUrl) && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    PDF 파일 선택
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPdfFile(f);
                  }}
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">메모</label>
                <textarea className="form-input resize-none" rows={2}
                  placeholder="특이사항, 추가 정보 등"
                  value={form.notes} onChange={field("notes")} />
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={closeModal}
                className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors font-medium">
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-colors disabled:opacity-60"
                style={{ background: "#0052CC" }}
                onMouseEnter={(e) => !saving && (e.currentTarget.style.background = "#0747A6")}
                onMouseLeave={(e) => !saving && (e.currentTarget.style.background = "#0052CC")}
              >
                {saving ? "저장 중..." : editTarget ? "수정 완료" : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 삭제 확인 모달 ══ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="font-bold text-gray-900 mb-1">계약을 삭제하시겠습니까?</h3>
              <p className="text-sm text-gray-500 mb-5">이 작업은 되돌릴 수 없습니다.</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 font-medium border border-gray-200">
                  취소
                </button>
                <button onClick={() => handleDelete(deleteId)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg text-white font-semibold bg-red-500 hover:bg-red-600 transition-colors">
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ 토스트 ══ */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 fade-in"
          style={{ background: toast.type === "ok" ? "#006644" : "#BF2600" }}
        >
          {toast.type === "ok" ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}

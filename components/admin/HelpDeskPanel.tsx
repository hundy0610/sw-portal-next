"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { HelpDeskTicket } from "@/lib/notion";
import type { FeedbackEntry } from "@/app/api/feedback/route";
import EnvVarMissing from "@/components/ui/EnvVarMissing";
import { AssetModalInner, HwRecord, HW_STATUSES } from "@/components/admin/AssetModal";
import { safeJson } from "@/lib/fetch-json";
import { useAdminDarkMode } from "@/lib/use-admin-dark-mode";
import { ACTION_TREE, ALL_TREE_KEYS } from "@/lib/action-categories";
import { classifyActionCategory } from "@/lib/helpdesk-action-classifier";
import type { HelpDeskManual } from "@/lib/helpdesk-manuals";

// ── Color configs ── 통합 토큰(--state-*) 참조: 긍정/진행/주의/위험/중립 5의미만 사용 ──
const URGENCY: Record<string, { bg: string; text: string; bar: string }> = {
  "매우 급합니다":    { bg: "var(--state-risk-soft)",     text: "var(--state-risk)",     bar: "var(--state-risk)"     },
  "조금 급합니다":     { bg: "var(--state-caution-soft)",  text: "var(--state-caution)",  bar: "var(--state-caution)"  },
  "기다릴 수 있어요":  { bg: "var(--state-positive-soft)", text: "var(--state-positive)", bar: "var(--state-positive)" },
};

const STATUS: Record<string, { bg: string; text: string }> = {
  "시작 전": { bg: "var(--state-neutral-soft)",  text: "var(--state-neutral)"  },
  "진행 중": { bg: "var(--state-progress-soft)", text: "var(--state-progress)" },
  "완료":    { bg: "var(--state-positive-soft)", text: "var(--state-positive)" },
};

const TYPE_COLORS = [
  "#3B82F6","#8B5CF6","#F59E0B","#EF4444",
  "#10B981","#6366F1","#EC4899","#0EA5E9","#6B7280",
];

// ── Helpers ──────────────────────────────────────────────────
function last6Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y.slice(2)}/${m}`;
}

function processingDays(submittedAt: string, lastEditedAt: string): number {
  const diff = new Date(lastEditedAt).getTime() - new Date(submittedAt).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

// ── 문의 내용 기반 세부 분류기 ────────────────────────────────
interface SubCategory {
  id: string;
  label: string;
  color: string;
  keywords: string[];
}

const SW_SUBCATS: SubCategory[] = [
  { id: "ms-office",    label: "MS Office (Excel·Word·PPT)", color: "#22C55E",
    keywords: ["엑셀","excel","워드","word","파워포인트","ppt","powerpoint","오피스","office","한글","hwp","한컴"] },
  { id: "ms-outlook",   label: "Outlook·이메일",             color: "#3B82F6",
    keywords: ["아웃룩","outlook","메일","이메일","email","받은편지","발송","첨부파일"] },
  { id: "ms-teams",     label: "Teams·화상회의",             color: "#6366F1",
    keywords: ["팀즈","teams","화상","회의","미팅","meeting","zoom","웹엑스","webex","구글미트"] },
  { id: "security",     label: "보안·인증·VPN",              color: "#EF4444",
    keywords: ["백신","바이러스","vpn","인증서","비밀번호","패스워드","password","로그인","2차인증","otp","보안","방화벽","악성"] },
  { id: "os-windows",   label: "Windows·OS",                 color: "#F97316",
    keywords: ["윈도우","windows","업데이트","블루스크린","부팅","재부팅","시스템오류","오류","오류코드","드라이버","레지스트리"] },
  { id: "groupware",    label: "그룹웨어·ERP·결재",          color: "#A855F7",
    keywords: ["그룹웨어","erp","sap","결재","품의","전자결재","인사","급여","회계","팝빌"] },
  { id: "browser-net",  label: "인터넷·브라우저",            color: "#0EA5E9",
    keywords: ["인터넷","브라우저","크롬","chrome","엣지","edge","접속","사이트","웹","홈페이지"] },
  { id: "install",      label: "SW 설치·라이선스",           color: "#10B981",
    keywords: ["설치","install","라이선스","license","활성화","인증키","키","버전","업그레이드"] },
];

const HW_SUBCATS: SubCategory[] = [
  { id: "monitor",      label: "모니터·디스플레이",          color: "#3B82F6",
    keywords: ["모니터","화면","디스플레이","해상도","꺼짐","깜빡","번짐","선명","노이즈","듀얼","멀티","출력포트","hdmi","dp"] },
  { id: "keyboard-mouse", label: "키보드·마우스·주변기기",   color: "#8B5CF6",
    keywords: ["키보드","마우스","입력","키","클릭","스크롤","패드","터치패드","무선"] },
  { id: "performance",  label: "성능·속도·과열",            color: "#F59E0B",
    keywords: ["느림","느려요","속도","버벅","렉","lag","과열","팬","발열","뜨겁","메모리","ram","cpu"] },
  { id: "battery-power","label": "배터리·전원",              color: "#EF4444",
    keywords: ["배터리","충전","전원","꺼짐","종료","안꺼짐","재시작","전원버튼","ac","어댑터"] },
  { id: "printer",      label: "프린터·복합기",              color: "#10B981",
    keywords: ["프린터","인쇄","복합기","출력","잼","카트리지","토너","스캔","팩스"] },
  { id: "storage",      label: "저장장치·USB",               color: "#6366F1",
    keywords: ["하드","hdd","ssd","usb","저장","드라이브","디스크","용량","백업","포맷"] },
  { id: "camera-audio", label: "카메라·마이크·스피커",       color: "#EC4899",
    keywords: ["카메라","웹캠","webcam","마이크","스피커","소리","오디오","이어폰","헤드셋","블루투스"] },
  { id: "network-hw",   label: "네트워크·인터넷 연결",       color: "#0EA5E9",
    keywords: ["와이파이","wifi","무선","랜","lan","케이블","인터넷연결","연결","핫스팟","공유기"] },
];

const OTHER_SUBCAT: SubCategory = { id: "other", label: "기타", color: "#9CA3AF", keywords: [] };

/** 문의 내용 텍스트에서 메인 카테고리와 세부 카테고리를 분류 */
function classifyContent(ticket: HelpDeskTicket): { mainCat: "SW" | "HW" | "기타"; subCat: SubCategory } {
  const text = [ticket.content, ticket.title, ticket.inquiryType].join(" ").toLowerCase();
  const typeStr = (ticket.inquiryType || "").toLowerCase();

  // 메인 카테고리 판별 (inquiryType 우선, 내용 보완)
  const isSwType = /sw|소프트웨어|프로그램|앱|application/.test(typeStr);
  const isHwType = /hw|하드웨어|장비|기기|노트북|데스크탑|pc/.test(typeStr);

  const swKeyHit = SW_SUBCATS.some(c => c.keywords.some(k => text.includes(k)));
  const hwKeyHit = HW_SUBCATS.some(c => c.keywords.some(k => text.includes(k)));

  const mainCat: "SW" | "HW" | "기타" =
    isSwType || (!isHwType && swKeyHit && !hwKeyHit) ? "SW" :
    isHwType || (!isSwType && hwKeyHit && !swKeyHit) ? "HW" :
    swKeyHit ? "SW" : hwKeyHit ? "HW" : "기타";

  const cats = mainCat === "SW" ? SW_SUBCATS : mainCat === "HW" ? HW_SUBCATS : [];

  // 세부 카테고리: 키워드 히트 수 가장 많은 항목 선택
  let bestCat: SubCategory | null = null;
  let bestHits = 0;
  for (const cat of cats) {
    const hits = cat.keywords.filter(k => text.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; bestCat = cat; }
  }

  return { mainCat, subCat: bestCat ?? OTHER_SUBCAT };
}

function getMonthRange(start: string, end: string): string[] {
  const result: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return result;
}

function nowYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Inline Table Cells ───────────────────────────────────────
function InlineStatusCell({
  ticket,
  statuses,
  onUpdated,
}: {
  ticket: HelpDeskTicket;
  statuses: string[];
  onUpdated: (id: string, fields: Partial<HelpDeskTicket>) => void;
}) {
  const dark = useAdminDarkMode();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "done" | "error">("idle");

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setSaving(true); setResult("idle");
    try {
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { status: newStatus } }),
      });
      const json = await safeJson(res);
      if (json.ok) { onUpdated(ticket.id, { status: newStatus }); setResult("done"); }
      else setResult("error");
    } catch { setResult("error"); }
    finally { setSaving(false); setTimeout(() => setResult("idle"), 2000); }
  };

  const c = STATUS[ticket.status] ?? { bg: "#F4F4F5", text: "#71717A" };
  return (
    <div className="flex items-center gap-1">
      <select
        value={ticket.status}
        onChange={handleChange}
        disabled={saving}
        style={{ background: dark ? "#18181B" : c.bg, color: c.text }}
        className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-transparent focus:outline-none focus:ring-1 focus:ring-amber-200 cursor-pointer disabled:opacity-50 appearance-none"
      >
        {/* 현재 상태가 목록에 없는 경우 fallback */}
        {ticket.status && !statuses.includes(ticket.status) && (
          <option value={ticket.status}>{ticket.status}</option>
        )}
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {saving && (
        <svg className="animate-spin w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
      )}
      {result === "done"  && <span className="text-[9px] text-green-600 flex-shrink-0">✓</span>}
      {result === "error" && <span className="text-[9px] text-red-500 flex-shrink-0">!</span>}
    </div>
  );
}

function InlineAssigneeCell({
  ticket,
  assigneeList,
  onUpdated,
}: {
  ticket: HelpDeskTicket;
  assigneeList: { id: string; name: string }[];
  onUpdated: (id: string, fields: Partial<HelpDeskTicket>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "done" | "error">("idle");

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newName = e.target.value;
    setSaving(true); setResult("idle");
    try {
      const found = assigneeList.find(u => u.name === newName);
      const updateFields: Record<string, string> = {};
      if (newName === "") updateFields.assigneeId = "";
      else if (found?.id) updateFields.assigneeId = found.id;
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: updateFields }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        onUpdated(ticket.id, { assignee: newName || undefined, assigneeId: found?.id ?? undefined });
        setResult("done");
      } else setResult("error");
    } catch { setResult("error"); }
    finally { setSaving(false); setTimeout(() => setResult("idle"), 2000); }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={ticket.assignee ?? ""}
        onChange={handleChange}
        disabled={saving}
        className="text-xs text-gray-600 border border-transparent hover:border-gray-200 bg-transparent focus:outline-none focus:ring-1 focus:ring-amber-200 rounded-lg px-1 py-0.5 cursor-pointer disabled:opacity-50 max-w-[96px]"
      >
        <option value="">미배정</option>
        {ticket.assignee && !assigneeList.find(u => u.name === ticket.assignee) && (
          <option value={ticket.assignee}>{ticket.assignee}</option>
        )}
        {assigneeList.map(u => <option key={u.id || u.name} value={u.name}>{u.name}</option>)}
      </select>
      {saving && (
        <svg className="animate-spin w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
      )}
      {result === "done"  && <span className="text-[9px] text-green-600 flex-shrink-0">✓</span>}
      {result === "error" && <span className="text-[9px] text-red-500 flex-shrink-0">!</span>}
    </div>
  );
}

// ── Action Category Tree ─────────────────────────────────────
function IndeterminateCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="rounded border-gray-300 text-amber-600 focus:ring-amber-200 cursor-pointer" />
  );
}

function ActionCategoryTree({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(ACTION_TREE.map(g => [g.label, false]))
  );
  const childKey = (parent: string, child: string) => `${parent} > ${child}`;
  const toggleChild = (parent: string, child: string) => {
    const key = childKey(parent, child);
    onChange(selected.includes(key) ? selected.filter(s => s !== key) : [...selected, key]);
  };
  const toggleParent = (parent: string, children: string[]) => {
    const keys = children.map(c => childKey(parent, c));
    const allSelected = keys.every(k => selected.includes(k));
    onChange(allSelected ? selected.filter(s => !keys.includes(s)) : [...selected, ...keys.filter(k => !selected.includes(k))]);
  };
  const legacy = selected.filter(s => !ALL_TREE_KEYS.includes(s));
  return (
    <div className="space-y-0.5">
      {ACTION_TREE.map(group => {
        const keys = group.children.map(c => childKey(group.label, c));
        const selectedCount = keys.filter(k => selected.includes(k)).length;
        const allSelected = selectedCount === keys.length;
        const someSelected = selectedCount > 0 && !allSelected;
        return (
          <div key={group.label}>
            <div className="flex items-center gap-2 py-1.5">
              <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected}
                onChange={() => toggleParent(group.label, group.children)} />
              <button type="button"
                onClick={() => setExpanded(p => ({ ...p, [group.label]: !p[group.label] }))}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform flex-shrink-0 ${expanded[group.label] ? "rotate-90" : ""}`}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {group.label}
                {selectedCount > 0 && (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full leading-none">{selectedCount}</span>
                )}
              </button>
            </div>
            {expanded[group.label] && (
              <div className="ml-6 space-y-0.5 pb-1">
                {group.children.map(child => {
                  const key = childKey(group.label, child);
                  return (
                    <label key={key} className="flex items-center gap-2 py-1 cursor-pointer select-none group">
                      <input type="checkbox" checked={selected.includes(key)} onChange={() => toggleChild(group.label, child)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-200" />
                      <span className="text-sm text-gray-600 group-hover:text-gray-800">{child}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {legacy.length > 0 && (
        <div className="pt-1 flex flex-wrap gap-1.5">
          {legacy.map(s => (
            <span key={s} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
              {s}
              <button type="button" onClick={() => onChange(selected.filter(x => x !== s))}
                className="text-gray-400 hover:text-gray-600 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 매뉴얼 관리 탭 ─────────────────────────────────────────────
function ManualsTab({
  tickets, manuals, manualsError, onSaved, presetCategory, onConsumePreset,
}: {
  tickets: HelpDeskTicket[];
  manuals: HelpDeskManual[];
  manualsError?: string | null;
  onSaved: () => void;
  presetCategory?: string | null;
  onConsumePreset?: () => void;
}) {
  const MAX_MANUAL_FILE_BYTES = 5 * 1024 * 1024; // 5MB
  const blankForm = () => ({ id: null as string | null, categories: [] as string[], keywords: "", title: "", contentType: "html" as "html" | "url", body: "" });
  const [form,    setForm]    = useState(blankForm);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveResult, setSaveResult] = useState<"idle" | "done" | "error">("idle");
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);
  const [deleteErrorCode, setDeleteErrorCode] = useState<string | null>(null);

  // 반복 문의 알림에서 "매뉴얼 만들기"로 넘어온 경우 새 매뉴얼 폼에 소분류를 미리 채워줌
  useEffect(() => {
    if (!presetCategory) return;
    setForm({ id: null, categories: [presetCategory], keywords: "", title: presetCategory, contentType: "html", body: "" });
    setFileName(null); setFileError(null);
    setSaveResult("idle");
    onConsumePreset?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCategory]);

  const loadForEdit = (m: HelpDeskManual) => {
    setForm({ id: m.id, categories: m.categories, keywords: m.keywords.join(", "), title: m.title, contentType: m.contentType, body: m.body });
    setFileName(null); setFileError(null);
    setSaveResult("idle");
  };

  const switchContentType = (contentType: "html" | "url") => {
    if (contentType === form.contentType) return;
    setForm(f => ({ ...f, contentType, body: "" }));
    setFileName(null); setFileError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_MANUAL_FILE_BYTES) {
      setFileError(`파일이 너무 큽니다 (최대 ${MAX_MANUAL_FILE_BYTES / 1024 / 1024}MB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, body: String(reader.result ?? "") }));
      setFileName(file.name);
    };
    reader.onerror = () => setFileError("파일을 읽지 못했습니다.");
    reader.readAsText(file);
  };

  // 저장된 HTML 매뉴얼은 실제 발송용 URL로, 아직 저장 전인 첨부 파일은 임시 Blob URL로,
  // URL 링크 매뉴얼은 입력된 주소를 그대로 새 탭에서 미리보기
  const previewManual = () => {
    if (form.contentType === "url") {
      if (form.body) window.open(form.body, "_blank");
      return;
    }
    if (form.id) {
      window.open(`/api/helpdesk/manuals/view?id=${encodeURIComponent(form.id)}`, "_blank");
    } else if (form.body) {
      const url = URL.createObjectURL(new Blob([form.body], { type: "text/html" }));
      window.open(url, "_blank");
    }
  };

  const matchingCounts = useMemo(
    () => form.categories.map(cat => ({
      category: cat,
      count: tickets.filter(t => t.actionCategory?.includes(cat)).length,
    })),
    [tickets, form.categories]
  );
  const matchingNotes = useMemo(
    () => tickets
      .filter(t => t.actionNote && form.categories.some(cat => t.actionCategory?.includes(cat)))
      .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "")),
    [tickets, form.categories]
  );

  const handleSave = async () => {
    if (!form.body.trim() || form.categories.length === 0) return;
    setSaving(true); setSaveResult("idle"); setSaveErrorCode(null);
    try {
      const res = await fetch("/api/helpdesk/manuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id ?? undefined,
          title: form.title || form.categories[0],
          contentType: form.contentType,
          body: form.body,
          categories: form.categories,
          keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
        }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setSaveResult("done");
        if (!form.id) setForm(f => ({ ...f, id: json.manual.id }));
        onSaved();
      } else {
        console.error("[ManualsTab.handleSave]", json.code, json);
        setSaveResult("error"); setSaveErrorCode(json.code || "MANUAL_SAVE_FAILED");
      }
    } catch (e) {
      console.error("[ManualsTab.handleSave] MANUAL_SAVE_FETCH_ERROR", e);
      setSaveResult("error"); setSaveErrorCode("MANUAL_SAVE_FETCH_ERROR");
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 매뉴얼을 삭제할까요?")) return;
    setDeleteErrorCode(null);
    try {
      const res = await fetch("/api/helpdesk/manuals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        if (form.id === id) setForm(blankForm());
        onSaved();
      } else {
        console.error("[ManualsTab.handleDelete]", json.code, json);
        setDeleteErrorCode(json.code || "MANUAL_DELETE_FAILED");
      }
    } catch (e) {
      console.error("[ManualsTab.handleDelete] MANUAL_DELETE_FETCH_ERROR", e);
      setDeleteErrorCode("MANUAL_DELETE_FETCH_ERROR");
    }
  };

  return (
    <div className="space-y-3">
      {manualsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
          매뉴얼 목록을 불러오지 못했습니다. (코드: {manualsError})
        </div>
      )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* 좌: 작성 폼 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">{form.id ? "매뉴얼 수정" : "새 매뉴얼 등록"}</h3>
          {form.id && (
            <button onClick={() => { setForm(blankForm()); setFileName(null); setFileError(null); }} className="text-xs text-gray-400 hover:text-gray-600">
              + 새로 작성
            </button>
          )}
        </div>
        <div>
          <span className="text-xs text-gray-500 font-semibold block mb-1.5">
            이 매뉴얼로 처리 가능한 조치분류 <span className="font-normal text-gray-400">(복수 선택 가능)</span>
          </span>
          <div className="border border-gray-200 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
            <ActionCategoryTree selected={form.categories} onChange={v => setForm(f => ({ ...f, categories: v }))} />
          </div>
        </div>

        {form.categories.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <span className="text-[11px] text-gray-400 font-semibold">참고: 과거 처리 건수</span>
            {matchingCounts.map(({ category, count }) => (
              <p key={category} className="text-xs text-gray-600">{category} — <strong>{count}건</strong></p>
            ))}
            {matchingNotes.length > 0 && (
              <div className="pt-1.5 border-t border-gray-200">
                <span className="text-[11px] text-gray-400 font-semibold">과거 처리결과 전체 ({matchingNotes.length}건)</span>
                <div className="mt-1.5 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {matchingNotes.map(t => (
                    <div key={t.id} className="bg-white rounded-lg border border-gray-100 p-2">
                      <div className="text-[10px] text-gray-400 mb-1">
                        {(t.submittedAt || "").slice(0, 10)} · {[t.company, t.requester].filter(Boolean).join(" · ")}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{t.actionNote}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <span className="text-xs text-gray-500 font-semibold block mb-1.5">제목</span>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white form-field-white focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <div>
          <span className="text-xs text-gray-500 font-semibold block mb-1.5">
            검색 키워드 <span className="font-normal text-gray-400">(쉼표로 구분, 담당자가 검색할 때 사용됨)</span>
          </span>
          <input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
            placeholder="예: 한글, hwp, 라이선스 인증"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white form-field-white focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 font-semibold">매뉴얼 (문의자에게 이 내용이 그대로 발송됩니다)</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => switchContentType("html")}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${form.contentType === "html" ? "bg-amber-600 text-white" : "bg-white text-gray-500 hover:text-gray-700"}`}>
                HTML 첨부
              </button>
              <button type="button" onClick={() => switchContentType("url")}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${form.contentType === "url" ? "bg-amber-600 text-white" : "bg-white text-gray-500 hover:text-gray-700"}`}>
                URL 링크
              </button>
            </div>
          </div>

          {form.contentType === "html" ? (
            <>
              <input
                type="file"
                accept=".html,.htm,text/html"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-700 file:text-xs file:font-semibold hover:file:bg-amber-100"
              />
              {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
              {form.body && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{fileName ?? "첨부된 HTML 파일 있음"}</span>
                  <button type="button" onClick={previewManual} className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>
                    미리보기
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <input
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="https://..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white form-field-white focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              {form.body && !/^https?:\/\//.test(form.body) && (
                <p className="text-xs text-red-500 mt-1">http:// 또는 https:// 로 시작하는 주소여야 합니다.</p>
              )}
              {form.body && /^https?:\/\//.test(form.body) && (
                <button type="button" onClick={previewManual} className="text-xs font-semibold hover:underline mt-2" style={{ color: "var(--brand)" }}>
                  미리보기
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || !form.body.trim() || form.categories.length === 0 || (form.contentType === "url" && !/^https?:\/\//.test(form.body))}
            className="text-sm px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {saving ? "저장 중…" : form.id ? "매뉴얼 수정" : "매뉴얼 등록"}
          </button>
          {saveResult === "done"  && <span className="text-xs text-green-600">저장됨 ✓</span>}
          {saveResult === "error" && <span className="text-xs text-red-500">저장 실패{saveErrorCode ? ` (코드: ${saveErrorCode})` : ""}</span>}
        </div>
      </div>

      {/* 우: 등록된 매뉴얼 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">등록된 매뉴얼 ({manuals.length}건)</h3>
          {deleteErrorCode && <span className="text-xs text-red-500">삭제 실패 (코드: {deleteErrorCode})</span>}
        </div>
        {manuals.length === 0 ? (
          <p className="text-xs text-gray-400">아직 등록된 매뉴얼이 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {manuals.map(m => (
              <div key={m.id} className="border border-gray-100 rounded-lg p-3 hover:border-amber-200 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => loadForEdit(m)} className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.contentType === "url" ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-500"}`}>
                        {m.contentType === "url" ? "URL" : "HTML"}
                      </span>
                      <div className="text-sm font-medium text-gray-800 truncate">{m.title}</div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.categories.map(c => (
                        <span key={c} className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  </button>
                  <button onClick={() => handleDelete(m.id)}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ── HelpDesk Ticket Detail Modal ─────────────────────────────
const HELPDESK_EDIT_STATUSES = ["시작 전", "진행 중", "완료"] as const;
const ACTION_NOTE_MIN_LEN = 10;

// ── 조치내용 작성 가이드 팝업 ──────────────────────────────────
function ActionNoteGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">조치내용 작성 가이드</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            나중에 같은 문제가 재발했을 때 바로 참고할 수 있도록, 아래 4가지를 포함해 구체적으로 작성해주세요.
            (최소 {ACTION_NOTE_MIN_LEN}자 이상)
          </p>
          <div className="space-y-3">
            {[
              { label: "① 증상/현상", desc: "사용자가 겪은 문제를 구체적으로 (에러 메시지, 발생 시점 등)" },
              { label: "② 원인", desc: "확인된 원인 (파악되지 않았다면 그 사실도 기재)" },
              { label: "③ 조치 방법", desc: "실제로 수행한 조치 (설정 변경, 재설치, 교체 등)" },
              { label: "④ 결과 확인", desc: "조치 후 정상 동작을 확인했는지, 사용자에게 안내했는지" },
            ].map(item => (
              <div key={item.label} className="flex gap-3">
                <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color: "var(--brand)" }}>{item.label}</span>
                <span className="text-xs text-gray-500">{item.desc}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--brand-soft)" }}>
            <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--brand)" }}>예시</div>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
              {"outlook 메일 수신 오류(0x8004xxx) 발생. 계정 프로필 손상이 원인으로 확인됨. 프로필 재생성 후 재설정 진행. 사용자 확인 하에 정상 수신 확인 완료."}
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: "var(--brand)" }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpDeskTicketFloating({
  ticket,
  assigneeList,
  statuses,
  manuals,
  onClose,
  onUpdated,
  currentUserName = "",
}: {
  ticket: HelpDeskTicket;
  assigneeList: { id: string; name: string }[];
  statuses: string[];
  manuals: HelpDeskManual[];
  onClose: () => void;
  onUpdated?: (id: string, fields: Partial<HelpDeskTicket>) => void;
  currentUserName?: string;
}) {
  const [selectedStatus,   setSelectedStatus]   = useState(ticket.status);
  const [selectedAssignee, setSelectedAssignee] = useState(ticket.assignee ?? "");
  const [saving,    setSaving]    = useState<"status" | "assignee" | null>(null);
  const [saveResult,setSaveResult]= useState<Record<string, "done" | "error">>({});
  const [copied,    setCopied]    = useState(false);
  const [editingNote,       setEditingNote]       = useState(false);
  const [noteValue,         setNoteValue]         = useState(ticket.actionNote ?? "");
  const [noteSaving,        setNoteSaving]        = useState(false);
  const [noteSaveResult,    setNoteSaveResult]    = useState<"idle" | "done" | "error">("idle");
  const [showNoteGuide,     setShowNoteGuide]     = useState(false);
  const noteGuideShownRef = useRef(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(ticket.actionCategory ?? []);
  const [categorySaving,     setCategorySaving]     = useState(false);
  const [categorySaveResult, setCategorySaveResult] = useState<"idle" | "done" | "error">("idle");
  const [selectedMethod,     setSelectedMethod]     = useState(ticket.actionMethod ?? "");
  const [methodSaving,       setMethodSaving]       = useState(false);
  const [methodSaveResult,   setMethodSaveResult]   = useState<"idle" | "done" | "error">("idle");
  const [allSaving,          setAllSaving]          = useState(false);
  const [allSaveResult,      setAllSaveResult]      = useState<"idle" | "done" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [assetData,       setAssetData]       = useState<HwRecord | null>(null);
  const [assetState,      setAssetState]      = useState<"idle" | "loading" | "found" | "notfound" | "error">("idle");
  const [assetStatus,     setAssetStatus]     = useState("");
  const [assetSaving,     setAssetSaving]     = useState(false);
  const [assetSaveResult, setAssetSaveResult] = useState<"idle" | "done" | "error">("idle");

  // 매뉴얼 검색 (담당자가 문의 내용을 보고 직접 검색해서 선택)
  const suggestedCategory = useMemo(
    () => classifyActionCategory(ticket.content || "", ticket.title || "", ticket.inquiryType || ""),
    [ticket.content, ticket.title, ticket.inquiryType]
  );
  const [manualQuery,     setManualQuery]     = useState("");
  const [selectedManual,  setSelectedManual]  = useState<HelpDeskManual | null>(null);
  const [manualEditTitle, setManualEditTitle] = useState("");
  const [manualReplyState, setManualReplyState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [manualReplyErrorCode, setManualReplyErrorCode] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/helpdesk/send-manual-reply?id=${encodeURIComponent(ticket.id)}`)
      .then(r => safeJson(r))
      .then(json => {
        if (json.sent) setManualReplyState("sent");
        else if (!json.ok) console.error("[HelpDeskTicketFloating] MANUAL_MAIL_STATUS_CHECK", json.code, json);
      })
      .catch(e => console.error("[HelpDeskTicketFloating] MANUAL_MAIL_STATUS_FETCH_ERROR", e));
  }, [ticket.id]);

  // 검색어 매칭 + 예상 조치분류(참고용 제안) 우선순위로 정렬
  const manualResults = useMemo(() => {
    const q = manualQuery.trim().toLowerCase();
    const scored = manuals
      .map(m => {
        const haystack = [m.title, ...m.categories, ...m.keywords].join(" ").toLowerCase();
        if (q && !haystack.includes(q)) return null;
        const score = suggestedCategory && m.categories.includes(suggestedCategory.category) ? 1 : 0;
        return { manual: m, score };
      })
      .filter((x): x is { manual: HelpDeskManual; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
      .map(x => x.manual);
    return scored.slice(0, 8);
  }, [manuals, manualQuery, suggestedCategory]);

  const selectManual = (m: HelpDeskManual) => {
    setSelectedManual(m);
    setManualEditTitle(m.title);
  };

  const previewSelectedManual = () => {
    if (!selectedManual) return;
    window.open(`/api/helpdesk/manuals/view?id=${encodeURIComponent(selectedManual.id)}`, "_blank");
  };

  const sendManualReply = async () => {
    if (!ticket.requesterEmail || !selectedManual) return;
    setManualReplyState("sending"); setManualReplyErrorCode(null);
    try {
      const res = await fetch("/api/helpdesk/send-manual-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requester || "고객",
          ticketContent: ticket.content || ticket.title || "",
          manualId: selectedManual.id,
          manualTitle: manualEditTitle,
          assignee: selectedAssignee || "담당자",
        }),
      });
      const json = await safeJson(res);
      if (json.ok) setManualReplyState("sent");
      else {
        console.error("[HelpDeskTicketFloating.sendManualReply]", json.code, json);
        setManualReplyState("error"); setManualReplyErrorCode(json.code || "MANUAL_MAIL_SEND_FAILED");
      }
    } catch (e) {
      console.error("[HelpDeskTicketFloating.sendManualReply] MANUAL_MAIL_FETCH_ERROR", e);
      setManualReplyState("error"); setManualReplyErrorCode("MANUAL_MAIL_FETCH_ERROR");
    }
  };

  // 매뉴얼 회신 발송 시 조치분류를 채우고, 조치내용엔 어떤 매뉴얼을 안내했는지 남겨 완료 처리 폼 열기
  const applyManualToCompleteForm = () => {
    if (!selectedManual) return;
    setSelectedCategories(prev => {
      const merged = new Set(prev);
      selectedManual.categories.forEach(c => merged.add(c));
      return [...merged];
    });
    setNoteValue(prev => prev.trim().length > 0 ? prev : `매뉴얼 "${manualEditTitle}" 안내 발송`);
    setShowCompleteForm(true);
  };

  // 워크플로우 UI 상태
  const [showOtherAssignee, setShowOtherAssignee] = useState(false);
  const [showCompleteForm,  setShowCompleteForm]  = useState(false);
  const [assignSaving,      setAssignSaving]      = useState(false);

  // "내가 담당" 매칭
  const myAssignee = assigneeList.find(u => u.name === currentUserName);

  // 담당자 배정 + 진행 중 전환 통합 함수
  const assignAndStart = async (assigneeName: string) => {
    const found = assigneeList.find(u => u.name === assigneeName);
    if (!found?.id) return;
    setAssignSaving(true);
    try {
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { status: "진행 중", assigneeId: found.id } }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setSelectedStatus("진행 중");
        setSelectedAssignee(assigneeName);
        setShowOtherAssignee(false);
        onUpdated?.(ticket.id, { status: "진행 중", assignee: assigneeName, assigneeId: found.id });
      }
    } catch { /* silent */ }
    finally { setAssignSaving(false); }
  };

  // 완료 처리 통합 함수
  const completeTicket = async () => {
    setAllSaving(true); setAllSaveResult("idle");
    try {
      const found = assigneeList.find(u => u.name === selectedAssignee);
      const noteText = noteValue;
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          fields: {
            status: "완료",
            assigneeId: found?.id || undefined,
            actionCategory: selectedCategories,
            actionMethod: selectedMethod,
            actionNote: noteText,
          },
        }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setNoteValue(noteText);
        setSelectedStatus("완료");
        setShowCompleteForm(false);
        setAllSaveResult("done");
        onUpdated?.(ticket.id, { status: "완료", assignee: selectedAssignee, actionCategory: selectedCategories, actionMethod: selectedMethod, actionNote: noteText });
      } else setAllSaveResult("error");
    } catch { setAllSaveResult("error"); }
    finally { setAllSaving(false); }
  };

  const canComplete = selectedCategories.length > 0 && selectedMethod !== "" && noteValue.trim().length >= ACTION_NOTE_MIN_LEN;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyRequester = () => {
    navigator.clipboard.writeText(ticket.requester || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadAsset = () => {
    if (!ticket.assetNo || assetState === "loading") return;
    setAssetState("loading");
    fetch(`/api/hw?search=${encodeURIComponent(ticket.assetNo)}`)
      .then(r => safeJson(r))
      .then(json => {
        const match = (json.records as HwRecord[])?.find(
          r => r.assetNo.toLowerCase() === ticket.assetNo.toLowerCase()
        );
        if (match) { setAssetData(match); setAssetStatus(match.status); setAssetState("found"); }
        else setAssetState("notfound");
      })
      .catch(() => setAssetState("error"));
  };

  const saveAssetStatus = async () => {
    if (!assetData || assetStatus === assetData.status) return;
    setAssetSaving(true); setAssetSaveResult("idle");
    try {
      const res = await fetch("/api/hw/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assetData.id, fields: { status: assetStatus } }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setAssetData(prev => prev ? { ...prev, status: assetStatus } : prev); setAssetSaveResult("done");
        if (assetStatus === "교체요청" && assetData) {
          fetch("/api/exchange-return/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "교체", assetId: assetData.assetNo,
              company: assetData.company, department: assetData.dept, user: assetData.user,
              stage: "교체요청", requestedAt: new Date().toISOString().slice(0, 10),
            }),
          }).catch(console.error);
        }
      } else setAssetSaveResult("error");
    } catch { setAssetSaveResult("error"); }
    finally { setAssetSaving(false); }
  };

  const saveNote = async () => {
    const value = noteValue;
    if (value.trim().length < ACTION_NOTE_MIN_LEN) { setNoteSaveResult("error"); return; }
    setNoteSaving(true); setNoteSaveResult("idle");
    try {
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { actionNote: value } }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setNoteValue(value);
        setNoteSaveResult("done");
        setEditingNote(false);
        onUpdated?.(ticket.id, { actionNote: value });
      } else setNoteSaveResult("error");
    } catch { setNoteSaveResult("error"); }
    finally { setNoteSaving(false); }
  };

  const saveCategory = async () => {
    setCategorySaving(true); setCategorySaveResult("idle");
    try {
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { actionCategory: selectedCategories } }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setCategorySaveResult("done");
        onUpdated?.(ticket.id, { actionCategory: selectedCategories });
      } else setCategorySaveResult("error");
    } catch { setCategorySaveResult("error"); }
    finally { setCategorySaving(false); }
  };

  const saveMethod = async (method: string) => {
    setMethodSaving(true); setMethodSaveResult("idle");
    try {
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { actionMethod: method } }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setMethodSaveResult("done");
        onUpdated?.(ticket.id, { actionMethod: method });
        setTimeout(() => setMethodSaveResult("idle"), 2000);
      } else setMethodSaveResult("error");
    } catch { setMethodSaveResult("error"); }
    finally { setMethodSaving(false); }
  };

  const saveAll = async () => {
    setAllSaving(true); setAllSaveResult("idle");
    try {
      const found = assigneeList.find(u => u.name === selectedAssignee);
      const noteText = textareaRef.current?.value ?? noteValue;
      const assigneeIdField = selectedAssignee === "" ? "" : (found?.id || undefined);
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          fields: {
            status: selectedStatus,
            assigneeId: assigneeIdField,
            actionCategory: selectedCategories,
            actionMethod: selectedMethod,
            actionNote: noteText,
          },
        }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setNoteValue(noteText);
        setAllSaveResult("done");
        onUpdated?.(ticket.id, { status: selectedStatus, assignee: selectedAssignee, actionCategory: selectedCategories, actionMethod: selectedMethod, actionNote: noteText });
        setTimeout(() => setAllSaveResult("idle"), 2500);
      } else setAllSaveResult("error");
    } catch { setAllSaveResult("error"); }
    finally { setAllSaving(false); }
  };

  const saveField = async (field: "status" | "assignee") => {
    setSaving(field);
    setSaveResult(prev => ({ ...prev, [field]: undefined as unknown as "done" }));
    try {
      const fields: Record<string, string> = {};
      if (field === "status") {
        fields.status = selectedStatus;
      } else {
        const found = assigneeList.find(u => u.name === selectedAssignee);
        if (selectedAssignee === "") fields.assigneeId = "";
        else if (found?.id) fields.assigneeId = found.id;
      }
      const res = await fetch("/api/helpdesk/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setSaveResult(prev => ({ ...prev, [field]: "done" }));
        if (field === "status")   onUpdated?.(ticket.id, { status: selectedStatus });
        if (field === "assignee") onUpdated?.(ticket.id, { assignee: selectedAssignee });
      } else setSaveResult(prev => ({ ...prev, [field]: "error" }));
    } catch { setSaveResult(prev => ({ ...prev, [field]: "error" })); }
    finally { setSaving(null); }
  };

  const allStatuses = [...new Set([...HELPDESK_EDIT_STATUSES, ...statuses])];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {showNoteGuide && <ActionNoteGuideModal onClose={() => setShowNoteGuide(false)} />}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">문의 처리</h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">
            ×
          </button>
        </div>

        {/* Body: 좌/우 분할 */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-0">
            {/* ── 좌측: 정보 영역 ── */}
            <div className="px-7 py-5 md:border-r border-gray-100 space-y-5">
              {/* 1행: 법인 · 부서 · 문의자 · 자산번호 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">법인</span>
                  <span className="text-sm font-medium text-gray-800">{ticket.company || "—"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">부서</span>
                  <span className="text-sm font-medium text-gray-800">{ticket.department || "—"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">문의자</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={copyRequester}
                      className="text-sm font-medium text-gray-800 hover:text-amber-600 transition-colors flex items-center gap-1 group" title="클릭하여 복사">
                      {ticket.requester || "—"}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className="opacity-30 group-hover:opacity-70">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    </button>
                    {copied && <span className="text-[10px] text-green-600">복사됨</span>}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block mb-0.5">자산번호</span>
                  {ticket.assetNo ? (
                    <button onClick={loadAsset}
                      className="text-sm font-mono text-amber-600 hover:underline hover:text-amber-700 transition-colors">
                      {ticket.assetNo}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>

              {/* 자산 상세 (로드 시) */}
              {assetState === "loading" && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                  </svg>
                  자산 정보 불러오는 중...
                </div>
              )}
              {assetState === "notfound" && <p className="text-xs text-gray-400">트래커 DB에서 찾을 수 없습니다.</p>}
              {assetState === "error" && <p className="text-xs text-red-400">자산 조회 중 오류가 발생했습니다.</p>}
              {assetState === "found" && assetData && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  {([["사용자", assetData.user], ["모델명", assetData.model], ["시리얼", assetData.serial],
                      ["제조사", assetData.maker], ["CPU", assetData.cpu], ["RAM", assetData.ram],
                  ] as [string, string][]).map(([label, value]) => value ? (
                    <div key={label} className="flex gap-3">
                      <span className="text-xs text-gray-400 w-14 shrink-0">{label}</span>
                      <span className="text-gray-700">{value}</span>
                    </div>
                  ) : null)}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-gray-400 w-14 shrink-0">상태</span>
                    <select value={assetStatus} onChange={e => { setAssetStatus(e.target.value); setAssetSaveResult("idle"); }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                      {HW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={saveAssetStatus} disabled={assetSaving || assetStatus === assetData.status}
                      className="text-xs px-2.5 py-1 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed">
                      {assetSaving ? "저장 중…" : "저장"}
                    </button>
                    {assetSaveResult === "done" && <span className="text-xs text-green-600">✓</span>}
                    {assetSaveResult === "error" && <span className="text-xs text-red-500">실패</span>}
                  </div>
                </div>
              )}

              {/* 2행: 유형 · 긴급도 · 상태 배지 + 접수일 */}
              <div className="flex items-center gap-2 flex-wrap">
                {ticket.inquiryType && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {ticket.inquiryType}
                  </span>
                )}
                {ticket.urgency && <UrgencyBadge urgency={ticket.urgency} />}
                <StatusBadge status={selectedStatus} />
                {ticket.submittedAt && (
                  <span className="text-[11px] text-gray-400 ml-auto">{formatDateTime(ticket.submittedAt)}</span>
                )}
              </div>

              {/* 하단: 문의 내용 */}
              <div>
                <span className="text-[11px] text-gray-400 block mb-1.5">문의 내용</span>
                <div className="bg-gray-50 rounded-xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {ticket.content || ticket.title || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* ── 우측: 처리 워크플로우 ── */}
            <div className="px-7 py-5 flex flex-col">
              {/* ━━ 시작 전 ━━ */}
              {selectedStatus === "시작 전" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <p className="text-sm text-gray-500 mb-2">담당자를 배정하면 자동으로 <strong>진행 중</strong>으로 전환됩니다.</p>

                  {/* 내가 담당 */}
                  <button
                    onClick={() => assignAndStart(currentUserName)}
                    disabled={assignSaving || !myAssignee?.id}
                    className="w-full max-w-xs py-4 rounded-xl bg-amber-600 text-white font-bold text-base hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {assignSaving ? (
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                      </svg>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        내가 담당
                      </>
                    )}
                  </button>
                  {!myAssignee?.id && currentUserName && (
                    <p className="text-xs text-amber-600 text-center">담당자 목록에 본인({currentUserName})을 먼저 등록하세요.</p>
                  )}

                  {/* 다른 담당자 배정 */}
                  {!showOtherAssignee ? (
                    <button
                      onClick={() => setShowOtherAssignee(true)}
                      className="w-full max-w-xs py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-base hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      다른 담당자 배정
                    </button>
                  ) : (
                    <div className="w-full max-w-xs space-y-2">
                      <select
                        value={selectedAssignee}
                        onChange={e => setSelectedAssignee(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="">담당자 선택</option>
                        {assigneeList.map(u => <option key={u.id || u.name} value={u.name}>{u.name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => assignAndStart(selectedAssignee)}
                          disabled={assignSaving || !selectedAssignee}
                          className="flex-1 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {assignSaving ? "배정 중…" : "배정"}
                        </button>
                        <button
                          onClick={() => setShowOtherAssignee(false)}
                          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ━━ 진행 중 ━━ */}
              {selectedStatus === "진행 중" && (
                <div className="flex-1 flex flex-col gap-4">
                  {/* 담당자 표시 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">담당자</span>
                    <span className="text-sm font-semibold text-gray-800">{selectedAssignee || "미배정"}</span>
                    <select
                      value={selectedAssignee}
                      onChange={e => { setSelectedAssignee(e.target.value); setSaveResult(p => ({ ...p, assignee: undefined as unknown as "done" })); }}
                      className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white focus:outline-none ml-auto"
                    >
                      <option value="">미배정</option>
                      {ticket.assignee && !assigneeList.find(u => u.name === ticket.assignee) && (
                        <option value={ticket.assignee}>{ticket.assignee}</option>
                      )}
                      {assigneeList.map(u => <option key={u.id || u.name} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>

                  {/* 매뉴얼 검색 → 선택 → 회신 */}
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                      📋 매뉴얼로 안내 회신하기
                    </div>
                    {manuals.length === 0 ? (
                      <p className="text-[11px] text-sky-700/70">등록된 매뉴얼이 아직 없습니다. "매뉴얼 관리" 탭에서 먼저 등록해주세요.</p>
                    ) : (
                      <>
                        <input
                          value={manualQuery}
                          onChange={e => { setManualQuery(e.target.value); }}
                          placeholder={suggestedCategory ? `검색 (예상 유형: ${suggestedCategory.category})` : "제목·조치분류·키워드로 검색"}
                          className="w-full text-sm border border-sky-200 rounded-lg px-2.5 py-1.5 bg-white form-field-white focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                        {manualResults.length > 0 && (
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {manualResults.map(m => (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => selectManual(m)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition-colors ${
                                  selectedManual?.id === m.id ? "border-sky-400 bg-white" : "border-transparent bg-white/60 hover:bg-white"
                                }`}
                              >
                                <div className="text-xs font-semibold text-gray-800 truncate">{m.title}</div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {m.categories.map(c => (
                                    <span key={c} className="text-[10px] text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">{c}</span>
                                  ))}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {manualQuery.trim() && manualResults.length === 0 && (
                          <p className="text-[11px] text-sky-700/70">검색 결과가 없습니다.</p>
                        )}
                      </>
                    )}

                    {selectedManual && (
                      <div className="space-y-2 pt-1 border-t border-sky-200">
                        <div className="flex items-center gap-2">
                          <input
                            value={manualEditTitle}
                            onChange={e => setManualEditTitle(e.target.value)}
                            className="flex-1 text-sm font-semibold border border-sky-200 rounded-lg px-2.5 py-1.5 bg-white form-field-white focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                          <button type="button" onClick={previewSelectedManual}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-sky-300 text-sky-700 font-medium hover:bg-sky-100 transition-colors whitespace-nowrap">
                            미리보기
                          </button>
                        </div>
                        {!ticket.requesterEmail && (
                          <p className="text-[11px] text-amber-600">문의자 이메일이 없어 회신을 보낼 수 없습니다.</p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={sendManualReply}
                            disabled={!ticket.requesterEmail || manualReplyState === "sending" || manualReplyState === "sent"}
                            className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {manualReplyState === "sending" ? "발송 중…" : manualReplyState === "sent" ? "발송됨 ✓" : "메일로 회신 보내기"}
                          </button>
                          <button
                            onClick={applyManualToCompleteForm}
                            className="text-xs px-3 py-1.5 rounded-lg border border-sky-300 text-sky-700 font-medium hover:bg-sky-100 transition-colors"
                          >
                            이 내용으로 완료 처리 열기
                          </button>
                          {manualReplyState === "error" && (
                            <span className="text-[11px] text-red-500">발송 실패{manualReplyErrorCode ? ` (코드: ${manualReplyErrorCode})` : ""}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!showCompleteForm ? (
                    <div className="flex-1 flex items-center justify-center">
                      <button
                        onClick={() => setShowCompleteForm(true)}
                        className="w-full max-w-xs py-4 rounded-xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        완료 처리
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1 overflow-y-auto">
                      {/* 조치분류 */}
                      <div>
                        <span className="text-xs text-gray-500 font-semibold block mb-1.5">조치분류</span>
                        <ActionCategoryTree
                          selected={selectedCategories}
                          onChange={v => { setSelectedCategories(v); setCategorySaveResult("idle"); }}
                        />
                      </div>

                      {/* 조치방법 */}
                      <div>
                        <span className="text-xs text-gray-500 font-semibold block mb-1.5">조치방법</span>
                        <div className="flex flex-wrap gap-2">
                          {(["원격", "방문", "메신저/메일", "기타"] as const).map(m => (
                            <button key={m} type="button"
                              onClick={() => setSelectedMethod(selectedMethod === m ? "" : m)}
                              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                                selectedMethod === m
                                  ? "bg-amber-600 border-amber-600 text-white"
                                  : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600"
                              }`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 조치내용 */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-500 font-semibold">조치내용</span>
                          <button type="button" onClick={() => setShowNoteGuide(true)}
                            className="text-[11px] font-semibold hover:underline" style={{ color: "var(--brand)" }}>
                            작성 가이드 보기
                          </button>
                        </div>
                        <textarea
                          ref={textareaRef}
                          value={noteValue}
                          onChange={e => setNoteValue(e.target.value)}
                          onFocus={() => {
                            if (!noteGuideShownRef.current && noteValue.trim().length === 0) {
                              noteGuideShownRef.current = true;
                              setShowNoteGuide(true);
                            }
                          }}
                          rows={4}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
                          placeholder="조치 내역을 입력하세요 (최소 10자)"
                        />
                        <div className="flex justify-end mt-1">
                          <span className={`text-[11px] ${noteValue.trim().length < ACTION_NOTE_MIN_LEN ? "text-gray-400" : "text-emerald-600"}`}>
                            {noteValue.trim().length}자 {noteValue.trim().length < ACTION_NOTE_MIN_LEN && `(최소 ${ACTION_NOTE_MIN_LEN}자)`}
                          </span>
                        </div>
                      </div>

                      {/* 완료 처리 버튼 */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={completeTicket}
                          disabled={allSaving || !canComplete}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {allSaving ? "처리 중…" : "완료 처리"}
                        </button>
                        <button
                          onClick={() => setShowCompleteForm(false)}
                          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                      {!canComplete && (
                        <p className="text-xs text-amber-600">
                          조치분류, 조치방법을 선택하고 조치내용을 {ACTION_NOTE_MIN_LEN}자 이상 작성해주세요.
                        </p>
                      )}
                      {allSaveResult === "error" && <p className="text-xs text-red-500">완료 처리 실패</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ━━ 완료 ━━ */}
              {selectedStatus === "완료" && (
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">완료</span>
                    {selectedAssignee && (
                      <span className="text-sm text-gray-600">담당: {selectedAssignee}</span>
                    )}
                  </div>
                  {/* 조치분류 */}
                  {selectedCategories.length > 0 && (
                    <div>
                      <span className="text-[11px] text-gray-400 block mb-1">조치분류</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedCategories.map(c => (
                          <span key={c} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 조치방법 */}
                  {selectedMethod && (
                    <div>
                      <span className="text-[11px] text-gray-400 block mb-1">조치방법</span>
                      <span className="text-sm text-gray-700">{selectedMethod}</span>
                    </div>
                  )}
                  {/* 조치내용 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-400">조치내용</span>
                      {editingNote && (
                        <button type="button" onClick={() => setShowNoteGuide(true)}
                          className="text-[11px] font-semibold hover:underline" style={{ color: "var(--brand)" }}>
                          작성 가이드 보기
                        </button>
                      )}
                    </div>
                    {editingNote ? (
                      <div className="space-y-2">
                        <textarea
                          ref={textareaRef}
                          value={noteValue}
                          onChange={e => setNoteValue(e.target.value)}
                          rows={4}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
                          placeholder="조치 내역을 입력하세요 (최소 10자)"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={saveNote} disabled={noteSaving || noteValue.trim().length < ACTION_NOTE_MIN_LEN}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            {noteSaving ? "저장 중…" : "저장"}
                          </button>
                          <button onClick={() => { setEditingNote(false); setNoteSaveResult("idle"); }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                            취소
                          </button>
                          <span className={`text-[11px] ${noteValue.trim().length < ACTION_NOTE_MIN_LEN ? "text-gray-400" : "text-emerald-600"}`}>
                            {noteValue.trim().length}자{noteValue.trim().length < ACTION_NOTE_MIN_LEN && ` (최소 ${ACTION_NOTE_MIN_LEN}자)`}
                          </span>
                          {noteSaveResult === "error" && <span className="text-xs text-red-500">저장 실패 — {ACTION_NOTE_MIN_LEN}자 이상 입력했는지 확인해주세요</span>}
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => { setEditingNote(true); setNoteSaveResult("idle"); }}
                        className="group cursor-pointer rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors min-h-[2.5rem] flex items-start gap-2 bg-gray-50">
                        <p className="text-sm leading-relaxed text-gray-700 flex-1 whitespace-pre-wrap">
                          {noteValue || <span className="text-gray-400 italic">클릭하여 편집</span>}
                        </p>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 시작 전 / 진행 중 / 완료 이외 상태 — 기본 편집 UI */}
              {selectedStatus !== "시작 전" && selectedStatus !== "진행 중" && selectedStatus !== "완료" && (
                <div className="flex-1 space-y-4">
                  <div>
                    <span className="text-xs text-gray-500 font-semibold block mb-1">상태</span>
                    <div className="flex items-center gap-2">
                      <select value={selectedStatus}
                        onChange={e => { setSelectedStatus(e.target.value); setSaveResult(p => ({ ...p, status: undefined as unknown as "done" })); }}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200">
                        {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => saveField("status")} disabled={saving === "status" || selectedStatus === ticket.status}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {saving === "status" ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-semibold block mb-1">담당자</span>
                    <div className="flex items-center gap-2">
                      <select value={selectedAssignee}
                        onChange={e => { setSelectedAssignee(e.target.value); setSaveResult(p => ({ ...p, assignee: undefined as unknown as "done" })); }}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200">
                        <option value="">미배정</option>
                        {assigneeList.map(u => <option key={u.id || u.name} value={u.name}>{u.name}</option>)}
                      </select>
                      <button onClick={() => saveField("assignee")} disabled={saving === "assignee" || selectedAssignee === (ticket.assignee ?? "")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {saving === "assignee" ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {ticket.notionUrl && (
              <a href={ticket.notionUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                노션에서 보기
              </a>
            )}
          </div>
          <button onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c = STATUS[status] ?? { bg: "var(--state-neutral-soft)", text: "var(--state-neutral)" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {status || "—"}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const c = URGENCY[urgency] ?? { bg: "var(--state-neutral-soft)", text: "var(--state-neutral)", bar: "var(--state-neutral)" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {urgency || "—"}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

// ── Monthly Line Chart (SVG) ─────────────────────────────────
function MonthlyLineChart({ data }: { data: { month: string; count: number }[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(...data.map(d => d.count), 1);
  const W = width, H = 240, PAD_X = 44, PAD_TOP = 24, PAD_BOT = 32;
  const chartH = H - PAD_TOP - PAD_BOT;
  const chartW = W - PAD_X * 2;
  const n = data.length;

  const xOf = (i: number) => PAD_X + (i / Math.max(n - 1, 1)) * chartW;
  const yOf = (v: number) => PAD_TOP + chartH * (1 - v / max);

  const points = data.map((d, i) => `${xOf(i)},${yOf(d.count)}`).join(" ");
  const areaPoints = [
    `${xOf(0)},${PAD_TOP + chartH}`,
    ...data.map((d, i) => `${xOf(i)},${yOf(d.count)}`),
    `${xOf(n - 1)},${PAD_TOP + chartH}`,
  ].join(" ");

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div ref={containerRef} style={{ height: H, position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = PAD_TOP + chartH * (1 - pct);
          const val = Math.round(max * pct);
          return (
            <g key={pct}>
              <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#F1F1F2" strokeWidth={1} />
              <text x={PAD_X - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#A1A1AA">{val}</text>
            </g>
          );
        })}

        {/* Area fill */}
        {n > 1 && <polygon points={areaPoints} fill="url(#lineGrad)" />}

        {/* Line */}
        {n > 1 && (
          <polyline points={points} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Hover crosshair */}
        {hovered && (
          <line x1={xOf(hoverIdx!)} y1={PAD_TOP} x2={xOf(hoverIdx!)} y2={PAD_TOP + chartH}
            stroke="var(--brand)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        )}

        {/* Dots + x-axis + hit targets */}
        {data.map((d, i) => {
          const cx = xOf(i), cy = yOf(d.count);
          const isLast = i === n - 1;
          const isHover = hoverIdx === i;
          return (
            <g key={d.month}>
              <circle cx={cx} cy={cy} r={isHover ? 6 : 4} fill="white" stroke="var(--brand)" strokeWidth={2} style={{ transition: "r .1s" }} />
              {(isLast || isHover) && (
                <text x={cx} y={cy - 12} textAnchor="middle" fontSize={12} fontWeight="700" fill="var(--brand)">
                  {d.count}
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#8A8A8E">
                {monthLabel(d.month)}
              </text>
              {/* invisible wider hit area for hover */}
              <rect x={cx - chartW / Math.max(n, 1) / 2} y={PAD_TOP} width={chartW / Math.max(n, 1)} height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: "pointer" }} />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div style={{
          position: "absolute", top: 4, right: 4, background: "var(--admin-surface, #fff)",
          border: "1px solid var(--admin-border, #E4E4E7)", borderRadius: 8, padding: "6px 10px",
          fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,.08)", pointerEvents: "none",
        }}>
          <div style={{ fontWeight: 700, color: "var(--admin-text-primary, #18181B)" }}>{monthLabel(hovered.month)}</div>
          <div style={{ color: "var(--brand)", fontWeight: 700 }}>{hovered.count}건</div>
        </div>
      )}
    </div>
  );
}

// ── Horizontal Bar ───────────────────────────────────────────
function HBar({ label, count, total, color, note }: {
  label: string; count: number; total: number; color: string; note?: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, count > 0 ? 1.5 : 0) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="font-medium text-gray-700 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="text-gray-400">{note ?? `${count}건 · ${total > 0 ? Math.round(count / total * 100) : 0}%`}</span>
      </div>
      <div className="h-5 bg-gray-100 rounded-lg overflow-hidden">
        <div className="h-full rounded-lg flex items-center pl-2 transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}>
          {count > 0 && <span className="text-white text-[9px] font-bold">{count}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Star display ─────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ color: s <= rating ? "var(--brand)" : "#D1D5DB", fontSize: 13 }}>★</span>
      ))}
    </span>
  );
}

// ── HTML Report Generator ────────────────────────────────────
function generateReportHTML(opts: {
  company: string;
  startMonth: string;
  endMonth: string;
  tickets: HelpDeskTicket[];
  feedbacks: Record<string, FeedbackEntry>;
}): string {
  const { company, startMonth, endMonth, tickets, feedbacks } = opts;
  const months = getMonthRange(startMonth, endMonth);

  const filtered = tickets.filter(t => {
    const inRange = (t.submittedAt || "").slice(0, 7) >= startMonth
                 && (t.submittedAt || "").slice(0, 7) <= endMonth;
    const inCompany = company === "all" || t.company === company;
    return inRange && inCompany;
  });

  const total     = filtered.length;
  const done      = filtered.filter(t => t.status === "완료").length;
  const inProg    = filtered.filter(t => t.status === "진행 중").length;
  const completed = filtered.filter(t => t.status === "완료");
  const avgDays   = completed.length > 0
    ? Math.round(completed.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / completed.length)
    : null;

  const byType: Record<string, number> = {};
  filtered.forEach(t => { if (t.inquiryType) byType[t.inquiryType] = (byType[t.inquiryType] ?? 0) + 1; });
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  // 조치 분석 데이터
  const completedFiltered = filtered.filter(t => t.status === "완료");
  const withMethod   = completedFiltered.filter(t => !!t.actionMethod).length;
  const withCategory = completedFiltered.filter(t => (t.actionCategory ?? []).length > 0).length;
  const withNote     = completedFiltered.filter(t => !!t.actionNote).length;

  const methodCounts: Record<string, number> = {};
  filtered.forEach(t => {
    if (t.actionMethod) methodCounts[t.actionMethod] = (methodCounts[t.actionMethod] ?? 0) + 1;
  });
  const methodRows = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);
  const totalMethodCount = Object.values(methodCounts).reduce((s, v) => s + v, 0);

  const catCounts: Record<string, number> = {};
  filtered.forEach(t => {
    (t.actionCategory ?? []).forEach(cat => {
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    });
  });
  const catRows = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const totalCatCount = Object.values(catCounts).reduce((s, v) => s + v, 0);


  const monthly = months.map(m => ({
    label: monthLabel(m),
    count: filtered.filter(t => (t.submittedAt || "").startsWith(m)).length,
  }));

  const fbList = filtered.map(t => feedbacks[t.id]).filter(Boolean) as FeedbackEntry[];
  const avgRating = fbList.length > 0
    ? (fbList.reduce((s, f) => s + f.rating, 0) / fbList.length).toFixed(1)
    : null;

  const periodLabel = startMonth === endMonth ? monthLabel(startMonth)
    : `${monthLabel(startMonth)} ~ ${monthLabel(endMonth)}`;
  const companyLabel = company === "all" ? "전체 법인" : company;
  const today = new Date().toLocaleDateString("ko-KR");

  const maxMonthly = Math.max(...monthly.map(m => m.count), 1);
  const chartH = 120, chartW = 520, padX = 40, padY = 20;
  const n = monthly.length;
  const xOf = (i: number) => padX + (i / Math.max(n - 1, 1)) * (chartW - padX * 2);
  const yOf = (v: number) => padY + (chartH - padY * 2) * (1 - v / maxMonthly);
  const linePoints = monthly.map((m, i) => `${xOf(i)},${yOf(m.count)}`).join(" ");


  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>문의 접수 현황 보고서 · ${companyLabel} · ${periodLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background: #FAFAFA; color: #1E293B; }
  .page { max-width: 1000px; margin: 0 auto; padding: 40px 32px; }
  .cover { text-align: center; padding: 60px 0 40px; border-bottom: 2px solid #E4E4E7; margin-bottom: 32px; }
  .cover h1 { font-size: 28px; font-weight: 800; color: #1E293B; margin-bottom: 8px; }
  .cover .meta { font-size: 14px; color: #71717A; margin-top: 6px; }
  .cover .period { display: inline-block; background: var(--brand); color: white; padding: 4px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-top: 12px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 15px; font-weight: 700; color: #334155; border-left: 4px solid var(--brand); padding-left: 10px; margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: white; border: 1px solid #E4E4E7; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-card .value { font-size: 26px; font-weight: 800; color: var(--brand); }
  .stat-card .label { font-size: 11px; color: #A1A1AA; margin-top: 4px; }
  .chart-box { background: white; border: 1px solid #E4E4E7; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .chart-title { font-size: 13px; font-weight: 600; color: #52525B; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #E4E4E7; font-size: 12px; }
  thead th { background: #F4F4F5; padding: 10px 12px; text-align: left; font-weight: 600; color: #52525B; border-bottom: 1px solid #E4E4E7; white-space: nowrap; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #FAFAFA; color: #334155; vertical-align: top; }
  tbody tr:hover td { background: #FAFAFA; }
  .footer { text-align: center; padding: 24px 0 8px; font-size: 11px; color: #CBD5E1; border-top: 1px solid #E4E4E7; margin-top: 40px; }
  .action-rate { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .rate-card { background: white; border: 1px solid #E4E4E7; border-radius: 12px; padding: 16px; text-align: center; }
  .rate-card .rate { font-size: 24px; font-weight: 800; }
  .rate-card .rate-label { font-size: 11px; color: #A1A1AA; margin-top: 4px; }
  .rate-card .rate-sub { font-size: 10px; color: #CBD5E1; margin-top: 2px; }
  @media print { body { background: white; } .page { padding: 20px; } }
</style>
</head>
<body>
<div class="page">

  <div class="cover">
    <h1>문의 접수 현황 보고서</h1>
    <div class="meta">IDS 자산관리파트 Help Desk · ${companyLabel}</div>
    <div><span class="period">${periodLabel}</span></div>
    <div class="meta" style="margin-top:10px;">작성일: ${today}</div>
  </div>

  <!-- 요약 -->
  <div class="section">
    <div class="section-title">요약 통계</div>
    <div class="stats">
      <div class="stat-card"><div class="value">${total}</div><div class="label">전체 접수</div></div>
      <div class="stat-card"><div class="value" style="color:var(--state-progress)">${inProg}</div><div class="label">진행 중</div></div>
      <div class="stat-card"><div class="value" style="color:var(--state-positive)">${done}</div><div class="label">완료</div></div>
      <div class="stat-card"><div class="value" style="color:#B45309">${avgDays !== null ? avgDays + "일" : "—"}</div><div class="label">평균 처리일</div></div>
      <div class="stat-card"><div class="value" style="color:var(--brand)">${avgRating ? "★ " + avgRating : "—"}</div><div class="label">평균 만족도</div></div>
    </div>
  </div>

  <!-- 월별 추이 -->
  <div class="section">
    <div class="section-title">월별 접수 추이</div>
    <div class="chart-box">
      <svg viewBox="0 0 ${chartW} ${chartH}" width="100%" style="overflow:visible">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${[0,0.25,0.5,0.75,1].map(p => {
          const y = padY + (chartH - padY*2) * (1 - p);
          return `<line x1="${padX}" y1="${y}" x2="${chartW - padX}" y2="${y}" stroke="#F4F4F5" stroke-width="1"/>
                  <text x="${padX - 5}" y="${y + 4}" text-anchor="end" font-size="9" fill="#A1A1AA">${Math.round(maxMonthly * p)}</text>`;
        }).join("")}
        ${n > 1 ? `<polygon points="${padX},${chartH - padY} ${linePoints} ${xOf(n-1)},${chartH - padY}" fill="url(#g)"/>` : ""}
        ${n > 1 ? `<polyline points="${linePoints}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
        ${monthly.map((m, i) => {
          const cx = xOf(i), cy = yOf(m.count);
          return `<circle cx="${cx}" cy="${cy}" r="4" fill="white" stroke="var(--brand)" stroke-width="2"/>
                  ${m.count > 0 ? `<text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="9" font-weight="700" fill="#5B21B6">${m.count}</text>` : ""}
                  <text x="${cx}" y="${chartH - 2}" text-anchor="middle" font-size="9" fill="#A1A1AA">${m.label}</text>`;
        }).join("")}
      </svg>
    </div>
  </div>

  <!-- 유형별 현황 -->
  ${typeRows.length > 0 ? `
  <div class="section">
    <div class="section-title">문의유형별 현황</div>
    <div class="chart-box">
      ${typeRows.map(([type, count]) => {
        const pct = total > 0 ? Math.max((count / total) * 100, count > 0 ? 2 : 0) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="color:#52525B;font-weight:600">${type}</span>
            <span style="color:#A1A1AA">${count}건 · ${Math.round(count/total*100)}%</span>
          </div>
          <div style="background:#F4F4F5;border-radius:6px;height:20px;overflow:hidden">
            <div style="width:${pct}%;background:var(--brand);height:100%;border-radius:6px;display:flex;align-items:center;padding-left:8px">
              <span style="color:white;font-size:10px;font-weight:700">${count}</span>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>` : ""}

  <!-- 조치 처리 분석 -->
  ${completedFiltered.length > 0 ? `
  <div class="section">
    <div class="section-title">조치 처리 분석 (완료 ${completedFiltered.length}건)</div>

    <div class="action-rate">
      <div class="rate-card">
        <div class="rate" style="color:var(--brand)">${completedFiltered.length > 0 ? Math.round(withMethod / completedFiltered.length * 100) : 0}%</div>
        <div class="rate-label">조치방법 입력률</div>
        <div class="rate-sub">${withMethod} / ${completedFiltered.length}건</div>
      </div>
      <div class="rate-card">
        <div class="rate" style="color:var(--brand)">${completedFiltered.length > 0 ? Math.round(withCategory / completedFiltered.length * 100) : 0}%</div>
        <div class="rate-label">조치분류 입력률</div>
        <div class="rate-sub">${withCategory} / ${completedFiltered.length}건</div>
      </div>
      <div class="rate-card">
        <div class="rate" style="color:var(--brand)">${completedFiltered.length > 0 ? Math.round(withNote / completedFiltered.length * 100) : 0}%</div>
        <div class="rate-label">조치내용 입력률</div>
        <div class="rate-sub">${withNote} / ${completedFiltered.length}건</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="chart-box" style="margin:0">
        <div class="chart-title">조치방법별 현황</div>
        ${methodRows.length > 0 ? methodRows.map(([method, count]) => {
          const pct = totalMethodCount > 0 ? Math.max((count / totalMethodCount) * 100, 2) : 0;
          const color = ({ "원격": "#6366F1", "방문": "var(--brand)", "메신저/메일": "#0EA5E9", "기타": "#9CA3AF" } as Record<string,string>)[method] ?? "var(--brand)";
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
              <span style="color:#52525B;font-weight:600">${method}</span>
              <span style="color:#A1A1AA">${count}건 · ${Math.round(count / totalMethodCount * 100)}%</span>
            </div>
            <div style="background:#F4F4F5;border-radius:6px;height:20px;overflow:hidden">
              <div style="width:${pct}%;background:${color};height:100%;border-radius:6px;display:flex;align-items:center;padding-left:8px">
                <span style="color:white;font-size:10px;font-weight:700">${count}</span>
              </div>
            </div>
          </div>`;
        }).join("") : '<p style="color:#CBD5E1;text-align:center;padding:20px;font-size:12px">데이터 없음</p>'}
      </div>
      <div class="chart-box" style="margin:0">
        <div class="chart-title">조치분류별 현황 (상위 12항목)</div>
        ${catRows.length > 0 ? catRows.map(([cat, count]) => {
          const pct = totalCatCount > 0 ? Math.max((count / totalCatCount) * 100, 2) : 0;
          const label = cat.split(" > ")[1] ?? cat;
          return `<div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
              <span style="color:#52525B;font-weight:600">${label}</span>
              <span style="color:#A1A1AA">${count}건</span>
            </div>
            <div style="background:#F4F4F5;border-radius:5px;height:16px;overflow:hidden">
              <div style="width:${pct}%;background:var(--brand);height:100%;border-radius:5px"></div>
            </div>
          </div>`;
        }).join("") : '<p style="color:#CBD5E1;text-align:center;padding:20px;font-size:12px">데이터 없음</p>'}
      </div>
    </div>

  </div>` : ""}


  <div class="footer">IDS 자산관리파트 · PC/OA 관리팀 · 본 보고서는 자동 생성되었습니다.</div>
</div>
</body>
</html>`;
}

// ── Main Panel ───────────────────────────────────────────────
type Tab = "overview" | "type" | "company" | "list" | "status_list" | "report" | "assignee" | "analysis" | "manuals";

export default function HelpDeskPanel({ company: companyFilter = "", typeFilter = "", currentUserName = "" }: { company?: string; typeFilter?: string; currentUserName?: string }) {
  const dark = useAdminDarkMode();
  const [tickets,    setTickets]    = useState<HelpDeskTicket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [tab, setTab]               = useState<Tab>("overview");
  const [feedbacks, setFeedbacks]   = useState<Record<string, FeedbackEntry>>({});
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [copiedRequesterId, setCopiedRequesterId] = useState<string | null>(null);
  const [modalAssetId, setModalAssetId] = useState<string | null>(null);
  const [floatingTicket, setFloatingTicket] = useState<HelpDeskTicket | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(new Set());

  // 반복 문의 매뉴얼 관리
  const [manuals, setManuals] = useState<HelpDeskManual[]>([]);
  const [manualsError, setManualsError] = useState<string | null>(null);
  const [pendingManualCategory, setPendingManualCategory] = useState<string | null>(null);
  const loadManuals = useCallback(() => {
    fetch("/api/helpdesk/manuals")
      .then(r => safeJson(r))
      .then(res => {
        if (res.ok) { setManuals(res.manuals ?? []); setManualsError(null); }
        else { console.error("[loadManuals] MANUAL_LIST_FAILED", res); setManualsError(res.code || "MANUAL_LIST_FAILED"); }
      })
      .catch(e => { console.error("[loadManuals] MANUAL_LIST_FETCH_ERROR", e); setManualsError("MANUAL_LIST_FETCH_ERROR"); });
  }, []);

  // 완료 처리된 문의의 조치분류를 집계해 "반복되는데 아직 매뉴얼이 없는" 유형을 찾아냄
  const REPEAT_ALERT_THRESHOLD = 3;
  const repeatAlerts = useMemo(() => {
    const counts = new Map<string, number>();
    tickets.forEach(t => {
      if (t.status !== "완료") return;
      (t.actionCategory ?? []).forEach(cat => counts.set(cat, (counts.get(cat) ?? 0) + 1));
    });
    return [...counts.entries()]
      .filter(([cat, count]) => count >= REPEAT_ALERT_THRESHOLD && !manuals.some(m => m.categories.includes(cat)))
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [tickets, manuals]);

  const goCreateManualFor = (category: string) => {
    setPendingManualCategory(category);
    setTab("manuals");
  };

  // 신규 문의 알림 이메일 관리
  const [notifyEmails,    setNotifyEmails]    = useState<string[]>([]);
  const [notifyInput,     setNotifyInput]     = useState("");
  const [notifyOpen,      setNotifyOpen]      = useState(false);
  const [notifySaving,    setNotifySaving]    = useState(false);
  const [notifyMsg,       setNotifyMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [listFilter, setListFilter] = useState({
    status: "all", type: "all", company: "all", urgency: "all", assignee: "all", search: "",
  });
  const [assetHistoryOpen, setAssetHistoryOpen] = useState<string | null>(null);
  const assetHistoryRef = useRef<HTMLDivElement | null>(null);

  // 담당자 리스트 관리 상태
  const [storedAssignees,   setStoredAssignees]   = useState<{ id: string; name: string }[]>([]);
  const [assigneeListOpen,  setAssigneeListOpen]  = useState(false);
  const [assigneeInput,     setAssigneeInput]     = useState("");
  const [assigneeSaving,    setAssigneeSaving]    = useState(false);
  const [assigneeMsg,       setAssigneeMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const assigneeList = useMemo(() => {
    const EXCLUDED = ["이상목", "조성빈"];
    const map = new Map<string, string>();
    // 저장된 담당자 리스트 (최우선)
    storedAssignees.forEach(u => map.set(u.id || `name:${u.name}`, u.name));
    // 기존 티켓에서 추출한 담당자 (UUID 있는 경우만)
    tickets.forEach(t => {
      if (t.assignee && t.assigneeId && !map.has(t.assigneeId)) map.set(t.assigneeId, t.assignee);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id: id.startsWith("name:") ? "" : id, name }))
      .filter(({ name }) => !EXCLUDED.includes(name))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [tickets, storedAssignees]);

  const uniqueStatuses = useMemo(() => {
    const fromData = [...new Set(tickets.map(t => t.status).filter(Boolean))].sort();
    const defaults = ["시작 전", "진행 중", "완료"];
    return [...new Set([...defaults, ...fromData])];
  }, [tickets]);

  const handleTicketUpdated = useCallback((id: string, fields: Partial<HelpDeskTicket>) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
  }, []);

  // Report state
  const [reportCompany,    setReportCompany]    = useState("all");
  const [reportStartMonth, setReportStartMonth] = useState(oneYearAgo);
  const [reportEndMonth,   setReportEndMonth]   = useState(nowYearMonth);

  // 이전 폴링의 티켓 상태를 기억 — "완료" 전환 감지용
  const prevStatusRef  = useRef<Map<string, string>>(new Map());
  const isFirstLoadRef = useRef(true);

  // 완료 전환 티켓에 이메일 자동 발송 (UI 로딩 없이 조용히 처리)
  const autoSendEmail = useCallback((ticket: HelpDeskTicket) => {
    if (!ticket.requesterEmail) return;
    fetch("/api/helpdesk/send-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId:       ticket.id,
        requesterEmail: ticket.requesterEmail,
        requesterName:  ticket.requester  || "고객",
        ticketContent:  ticket.content    || ticket.title || "",
        assignee:       ticket.assignee   || "담당자",
      }),
    })
      .then(r => safeJson(r))
      .then(json => {
        if (json.ok || json.skipped)
          setEmailSentIds(prev => new Set([...prev, ticket.id]));
      })
      .catch(e => console.error("[autoSendEmail]", e));
  }, []);

  const load = useCallback((force = false) => {
    if (!force) { setLoading(true); setError(null); }
    if (force) setRefreshing(true);
    fetch(`/api/helpdesk${force ? "?refresh=1" : ""}`)
      .then(r => safeJson(r))
      .then(res => {
        if (res.missingEnv) { setMissingEnv(res.missingEnv); return; }
        if (res.error) { if (!force) setError(res.error); return; }
        const newTickets: HelpDeskTicket[] = res.data ?? [];

        // 첫 로드가 아닐 때만 상태 변화 감지 → 자동 이메일
        if (!isFirstLoadRef.current) {
          newTickets.forEach(ticket => {
            if (
              ticket.status === "완료" &&
              ticket.requesterEmail &&
              prevStatusRef.current.get(ticket.id) !== "완료"
            ) {
              autoSendEmail(ticket);
            }
          });
        }

        // 현재 상태 저장
        prevStatusRef.current = new Map(newTickets.map(t => [t.id, t.status]));
        isFirstLoadRef.current = false;

        setTickets(newTickets);
        setLastSynced(res.lastSynced ?? null);
      })
      .catch(e => { if (!force) setError(e.message); })
      .finally(() => { if (!force) setLoading(false); else setRefreshing(false); });
  }, [autoSendEmail]);

  // 초기 로드
  useEffect(() => { load(); }, [load]);

  // 저장된 담당자 목록 로드
  useEffect(() => {
    fetch("/api/helpdesk/assignees")
      .then(r => safeJson(r))
      .then(res => { if (res.ok) setStoredAssignees(res.assignees ?? []); })
      .catch(() => {});
  }, []);

  // 알림 이메일 목록 로드
  useEffect(() => {
    fetch("/api/helpdesk/notify-emails")
      .then(r => safeJson(r))
      .then(res => { if (res.ok) setNotifyEmails(res.emails); })
      .catch(() => {});
  }, []);

  // 매뉴얼 목록 로드
  useEffect(() => { loadManuals(); }, [loadManuals]);

  const handleNotifyAdd = () => {
    const email = notifyInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (notifyEmails.includes(email)) { setNotifyInput(""); return; }
    setNotifyEmails(prev => [...prev, email]);
    setNotifyInput("");
  };

  const handleNotifyRemove = (email: string) => {
    setNotifyEmails(prev => prev.filter(e => e !== email));
  };

  const handleNotifySave = async () => {
    setNotifySaving(true); setNotifyMsg(null);
    try {
      const res = await fetch("/api/helpdesk/notify-emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: notifyEmails }),
      });
      const json = await safeJson(res);
      if (json.ok) setNotifyMsg({ type: "ok", text: "저장되었습니다." });
      else setNotifyMsg({ type: "err", text: json.error || "저장 실패" });
    } catch {
      setNotifyMsg({ type: "err", text: "저장 실패" });
    } finally {
      setNotifySaving(false);
      setTimeout(() => setNotifyMsg(null), 3000);
    }
  };

  // 담당자 리스트 핸들러
  const handleAssigneeAdd = () => {
    const name = assigneeInput.trim();
    if (!name) return;
    if (storedAssignees.some(a => a.name === name)) { setAssigneeInput(""); return; }
    // 현재 티켓 데이터에서 UUID 조회
    const fromTicket = tickets.find(t => t.assignee === name && t.assigneeId);
    setStoredAssignees(prev => [...prev, { id: fromTicket?.assigneeId ?? "", name }]);
    setAssigneeInput("");
  };

  const handleAssigneeRemove = (name: string) => {
    setStoredAssignees(prev => prev.filter(a => a.name !== name));
  };

  const handleAssigneeSave = async () => {
    setAssigneeSaving(true); setAssigneeMsg(null);
    try {
      const res = await fetch("/api/helpdesk/assignees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: storedAssignees }),
      });
      const json = await safeJson(res);
      if (json.ok) setAssigneeMsg({ type: "ok", text: "저장되었습니다." });
      else setAssigneeMsg({ type: "err", text: json.error || "저장 실패" });
    } catch {
      setAssigneeMsg({ type: "err", text: "저장 실패" });
    } finally {
      setAssigneeSaving(false);
      setTimeout(() => setAssigneeMsg(null), 3000);
    }
  };

  // 30초마다 자동 새로고침 (Notion 최신 데이터 반영)
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!assetHistoryOpen) return;
    const handler = (e: MouseEvent) => {
      if (assetHistoryRef.current && !assetHistoryRef.current.contains(e.target as Node)) {
        setAssetHistoryOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [assetHistoryOpen]);

  // 완료 티켓의 피드백 + 이메일 발송 여부를 단 1번의 배치 요청으로 로드 (N+1 → O(1))
  useEffect(() => {
    const completed = tickets.filter(t => t.status === "완료");
    if (completed.length === 0) return;
    const ids = completed.map(t => t.id).join(",");
    fetch(`/api/helpdesk/ticket-status?ids=${ids}`)
      .then(r => safeJson(r))
      .then(res => {
        if (res.feedbacks)  setFeedbacks(res.feedbacks);
        if (res.emailSent)  setEmailSentIds(new Set(Object.keys(res.emailSent)));
      })
      .catch(() => {/* Redis 미설정 시 조용히 무시 */});
  }, [tickets]);

  const months = useMemo(() => last6Months(), []);

  const displayTickets = useMemo(() => {
    let result = companyFilter ? tickets.filter(t => t.company === companyFilter) : tickets;
    if (typeFilter) result = result.filter(t => t.inquiryType === typeFilter);
    return result;
  }, [tickets, companyFilter, typeFilter]);

  // ── Analytics ────────────────────────────────────────────
  const total      = displayTickets.length;
  const inProgress = displayTickets.filter(t => t.status === "진행 중").length;
  const done       = displayTickets.filter(t => t.status === "완료").length;

  const completedTickets = displayTickets.filter(t => t.status === "완료");
  const avgProcessDays = completedTickets.length > 0
    ? Math.round(completedTickets.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / completedTickets.length)
    : null;

  const fbList     = Object.values(feedbacks);
  const avgRating  = fbList.length > 0
    ? (fbList.reduce((s, f) => s + f.rating, 0) / fbList.length).toFixed(1)
    : null;

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    displayTickets.forEach(t => { if (t.inquiryType) m.set(t.inquiryType, (m.get(t.inquiryType) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({ type, count, color: TYPE_COLORS[i % TYPE_COLORS.length] }));
  }, [displayTickets]);

  const byCompany = useMemo(() => {
    const m = new Map<string, number>();
    displayTickets.forEach(t => { if (t.company) m.set(t.company, (m.get(t.company) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [displayTickets]);


  const monthlyTotal = useMemo(() =>
    months.map(m => ({ month: m, count: displayTickets.filter(t => (t.submittedAt || "").startsWith(m)).length })),
    [displayTickets, months]);

  const companyMonthly = useMemo(() => {
    const companies = [...new Set(displayTickets.map(t => t.company).filter(Boolean))].sort();
    return companies.map(company => ({
      company,
      monthlyCounts: months.map(m => displayTickets.filter(t => t.company === company && (t.submittedAt || "").startsWith(m)).length),
      total: displayTickets.filter(t => t.company === company).length,
    })).sort((a, b) => b.total - a.total);
  }, [displayTickets, months]);

  // ── 자산번호별 티켓 그룹핑 (반복 문의 감지) ─────────────
  const assetTicketsMap = useMemo(() => {
    const m = new Map<string, HelpDeskTicket[]>();
    displayTickets.forEach(t => {
      if (!t.assetNo) return;
      const key = t.assetNo.toLowerCase();
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    });
    return m;
  }, [displayTickets]);

  // ── List filters ─────────────────────────────────────────
  const uniqueTypes     = [...new Set(displayTickets.map(t => t.inquiryType).filter(Boolean))].sort();
  const uniqueCompanies = [...new Set(displayTickets.map(t => t.company).filter(Boolean))].sort();
  const uniqueUrgencies = ["매우 급합니다", "조금 급합니다", "기다릴 수 있어요"].filter(u => displayTickets.some(t => t.urgency === u));

  const filteredList = useMemo(() => displayTickets.filter(t => {
    if (listFilter.status  !== "all" && t.status      !== listFilter.status)  return false;
    if (listFilter.type    !== "all" && t.inquiryType !== listFilter.type)    return false;
    if (listFilter.company !== "all" && t.company     !== listFilter.company) return false;
    if (listFilter.urgency !== "all" && t.urgency     !== listFilter.urgency) return false;
    if (listFilter.assignee !== "all" && t.assignee   !== listFilter.assignee) return false;
    if (listFilter.search) {
      const q = listFilter.search.toLowerCase();
      return (t.content || t.title || "").toLowerCase().includes(q)
        || (t.requester || "").toLowerCase().includes(q)
        || (t.department || "").toLowerCase().includes(q);
    }
    return true;
  }), [displayTickets, listFilter]);

  // ── Feedback link copy ───────────────────────────────────
  const copyFeedbackLink = (id: string) => {
    const url = `${window.location.origin}/inquiry/feedback/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ── Send feedback email ───────────────────────────────────
  const sendFeedbackEmail = async (ticket: HelpDeskTicket) => {
    if (!ticket.requesterEmail) return;
    setSendingEmail(ticket.id);
    try {
      const res = await fetch("/api/helpdesk/send-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requester || "고객",
          ticketContent: ticket.content || ticket.title || "",
          assignee: ticket.assignee || "담당자",
        }),
      });
      const data = await safeJson(res);
      if (res.ok || data.skipped) {
        setEmailSentIds(prev => new Set([...prev, ticket.id]));
      }
    } catch (e) {
      console.error("email send failed", e);
    } finally {
      setSendingEmail(null);
    }
  };

  // ── HTML Report download ─────────────────────────────────
  const downloadReport = () => {
    const html = generateReportHTML({
      company: reportCompany,
      startMonth: reportStartMonth,
      endMonth: reportEndMonth,
      tickets,
      feedbacks,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const compTag = reportCompany === "all" ? "전체" : reportCompany;
    a.download = `헬프데스크_보고서_${compTag}_${reportStartMonth}~${reportEndMonth}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Render ───────────────────────────────────────────────
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-2">
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        헬프데스크 데이터 불러오는 중...
      </div>
    );
  }

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">문의 접수 현황</h2>
          <p className="text-sm text-gray-500">
            IDS 자산관리파트 Help Desk{companyFilter ? ` · ${companyFilter}` : ""} · 전체 {total}건
            {lastSynced && (
              <span className="ml-2 text-gray-300 text-[10px]">
                {new Date(lastSynced).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 동기화
              </span>
            )}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="text-xs font-medium px-3 py-1.5 rounded border bg-white text-gray-600 border-gray-300 hover:border-gray-400 flex items-center gap-1 transition-colors disabled:opacity-50">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={refreshing ? "animate-spin" : ""}>
            <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          새로고침
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          {error.includes("NOTION_DB_HELPDESK") && (
            <p className="mt-1 text-xs text-red-500">Vercel 환경변수에 <code className="bg-red-100 px-1 rounded">NOTION_DB_HELPDESK</code>를 추가해주세요.</p>
          )}
        </div>
      )}

      {/* ── 신규 문의 알림 이메일 관리 ── */}
      <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setNotifyOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700">
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            신규 문의 알림 수신자 관리
            <span className="text-xs font-normal text-gray-400">({notifyEmails.length}명)</span>
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: notifyOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {notifyOpen && (
          <div className="px-4 py-4 bg-white space-y-3">
            <p className="text-xs text-gray-500">신규 문의가 접수될 때 아래 이메일로 알림을 발송합니다.</p>

            {/* 이메일 추가 입력 */}
            <div className="flex gap-2">
              <input
                type="email"
                value={notifyInput}
                onChange={e => setNotifyInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleNotifyAdd(); } }}
                placeholder="알림 받을 이메일 입력"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
              />
              <button
                onClick={handleNotifyAdd}
                className="px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors">
                추가
              </button>
            </div>

            {/* 이메일 목록 */}
            {notifyEmails.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {notifyEmails.map(email => (
                  <span key={email} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
                    {email}
                    <button onClick={() => handleNotifyRemove(email)}
                      className="text-amber-500 hover:text-amber-700 transition-colors leading-none">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">수신자가 없습니다</p>
            )}

            {/* 저장 버튼 */}
            <div className="flex items-center justify-end gap-3">
              {notifyMsg && (
                <span className={`text-xs font-medium ${notifyMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                  {notifyMsg.text}
                </span>
              )}
              <button
                onClick={handleNotifySave}
                disabled={notifySaving}
                className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {notifySaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 담당자 리스트 관리 ── */}
      <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setAssigneeListOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700">
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            담당자 리스트 관리
            <span className="text-xs font-normal text-gray-400">({storedAssignees.length}명)</span>
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: assigneeListOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {assigneeListOpen && (
          <div className="px-4 py-4 bg-white space-y-3">
            <p className="text-xs text-gray-500">
              담당자 드롭다운에 표시될 인원을 관리합니다.
              Notion DB에 있는 사람 이름을 그대로 입력하세요.
            </p>

            {/* 추가 입력 */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  list="assignee-suggestions"
                  value={assigneeInput}
                  onChange={e => setAssigneeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAssigneeAdd(); } }}
                  placeholder="담당자 이름 입력 또는 목록에서 선택"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                />
                <datalist id="assignee-suggestions">
                  {tickets
                    .filter(t => t.assignee && !storedAssignees.some(a => a.name === t.assignee))
                    .reduce<string[]>((acc, t) => acc.includes(t.assignee!) ? acc : [...acc, t.assignee!], [])
                    .sort((a, b) => a.localeCompare(b, "ko"))
                    .map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
              <button
                onClick={handleAssigneeAdd}
                disabled={!assigneeInput.trim()}
                className="px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors">
                추가
              </button>
            </div>

            {/* 담당자 목록 */}
            {storedAssignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {storedAssignees.map(a => (
                  <span key={a.name} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
                    {a.name}
                    {!a.id && <span className="text-[9px] text-gray-400 font-normal">(ID 없음)</span>}
                    <button onClick={() => handleAssigneeRemove(a.name)}
                      className="text-amber-500 hover:text-amber-700 transition-colors leading-none">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">등록된 담당자가 없습니다</p>
            )}

            {/* 저장 버튼 */}
            <div className="flex items-center justify-end gap-3">
              {assigneeMsg && (
                <span className={`text-xs font-medium ${assigneeMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                  {assigneeMsg.text}
                </span>
              )}
              <button
                onClick={handleAssigneeSave}
                disabled={assigneeSaving}
                className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {assigneeSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="전체 접수"  value={total}                                                    color="var(--state-neutral)" />
        <StatCard label="진행 중"    value={inProgress}                                               color="var(--state-progress)" />
        <StatCard label="완료"       value={done}                                                     color="var(--state-positive)" />
        <StatCard label="평균 처리일" value={avgProcessDays !== null ? `${avgProcessDays}일` : "—"}  color="var(--brand)" />
        <StatCard label="평균 만족도" value={avgRating ? `★ ${avgRating}` : "—"}                     color="var(--brand)" />
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ["overview",  "개요"],
          ["type",      "유형분석"],
          ["company",   "법인현황"],
          ["assignee",  "담당자"],
          ["analysis",  "분석"],
          ["manuals",   "매뉴얼 관리"],
          ["list",      "목록"],
          ["status_list", "접수 현황"],
          ["report",    "보고서"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {label}
            {id === "status_list" && repeatAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {repeatAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════ Tab: 개요 */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              월별 접수 추이
              <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
            </h3>
            <MonthlyLineChart data={monthlyTotal} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                미완료된 건
                <span className="text-xs font-normal text-gray-400 ml-1">최신 5건</span>
              </h3>
              <div className="space-y-1">
                {displayTickets
                  .filter(t => t.status !== "완료")
                  .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
                  .slice(0, 5)
                  .map(t => (
                    <div key={t.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                      <StatusBadge status={t.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {t.content || t.title || "(내용 없음)"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {[t.company, t.requester, t.submittedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                {displayTickets.filter(t => t.status !== "완료").length === 0 && (
                  <p className="text-xs text-gray-300 text-center py-4">미완료 건 없음</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                최근 접수
                <span className="text-xs font-normal text-gray-400 ml-1">최신 5건</span>
              </h3>
              <div className="space-y-1">
                {displayTickets.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                    <StatusBadge status={t.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {t.content || t.title || "(내용 없음)"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {[t.company, t.requester, t.submittedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {t.urgency && <UrgencyBadge urgency={t.urgency} />}
                  </div>
                ))}
                {tickets.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
              </div>
            </div>
          </div>

          {/* 만족도 요약 */}
          {fbList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                만족도 평가 현황
                <span className="text-xs font-normal text-gray-400 ml-2">{fbList.length}건 수집</span>
              </h3>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-amber-500">{avgRating}</div>
                  <Stars rating={Math.round(Number(avgRating))} />
                  <div className="text-[10px] text-gray-400 mt-1">평균 평점</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(s => {
                    const cnt = fbList.filter(f => f.rating === s).length;
                    const pct = fbList.length > 0 ? (cnt / fbList.length) * 100 : 0;
                    return (
                      <div key={s} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-gray-400 text-right">{s}</span>
                        <span className="text-amber-400 text-[11px]">★</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-gray-400 text-right">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ Tab: 유형분석 */}
      {tab === "type" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">문의유형별 현황</h3>
            <div className="space-y-3">
              {byType.map(({ type, count, color }) => (
                <HBar key={type} label={type} count={count} total={total} color={color} />
              ))}
              {byType.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">유형 × 긴급도 교차 분석</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-5 text-gray-500 font-semibold">문의유형</th>
                    {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => (
                      <th key={u} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">{u}</th>
                    ))}
                    <th className="text-center py-2.5 px-4 text-gray-700 font-bold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map(({ type, count, color }) => (
                    <tr key={type} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                          <span className="font-medium text-gray-700">{type}</span>
                        </span>
                      </td>
                      {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => {
                        const n = tickets.filter(t => t.inquiryType === type && t.urgency === u).length;
                        const c = URGENCY[u];
                        return (
                          <td key={u} className="text-center py-2.5 px-4">
                            {n > 0
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: c?.bg, color: c?.text }}>{n}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                        );
                      })}
                      <td className="text-center py-2.5 px-4 font-bold text-gray-800">{count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="py-2.5 pr-5 text-gray-700">합계</td>
                    {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => (
                      <td key={u} className="text-center py-2.5 px-4 text-gray-700">
                        {tickets.filter(t => t.urgency === u).length || "—"}
                      </td>
                    ))}
                    <td className="text-center py-2.5 px-4 text-gray-900">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════ Tab: 법인현황 */}
      {tab === "company" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              법인별 월간 접수 현황
              <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
            </h3>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-6 text-gray-500 font-semibold whitespace-nowrap">법인</th>
                    {months.map(m => (
                      <th key={m} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="text-center py-2.5 px-4 text-gray-700 font-bold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {companyMonthly.map(({ company, monthlyCounts, total: compTotal }) => {
                    const colMax = Math.max(...monthlyCounts, 1);
                    return (
                      <tr key={company} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-6 font-semibold text-gray-700 whitespace-nowrap">{company}</td>
                        {monthlyCounts.map((cnt, i) => {
                          const intensity = cnt > 0 ? 0.3 + (cnt / colMax) * 0.7 : 0;
                          return (
                            <td key={i} className="text-center py-3 px-4">
                              {cnt > 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-[11px] font-bold"
                                  style={{ background: `rgba(124,58,237,${intensity})` }}>
                                  {cnt}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-center py-3 px-4 font-bold text-gray-800">{compTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="py-2.5 pr-6 font-bold text-gray-700">합계</td>
                    {monthlyTotal.map(({ month, count }) => (
                      <td key={month} className="text-center py-2.5 px-4 font-bold text-gray-700">{count || "—"}</td>
                    ))}
                    <td className="text-center py-2.5 px-4 font-bold text-gray-900">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">법인별 접수 총계</h3>
            <div className="space-y-3">
              {byCompany.map(([company, count], i) => (
                <HBar key={company} label={company} count={count} total={total}
                  color={TYPE_COLORS[i % TYPE_COLORS.length]} />
              ))}
              {byCompany.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
            </div>
          </div>
        </div>
      )}

      {/* ════ Tab: 목록 */}
      {tab === "list" && (
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-2.5 items-center">
            <input type="text" placeholder="내용 · 요청자 · 부서 검색..."
              value={listFilter.search}
              onChange={e => setListFilter(f => ({ ...f, search: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-52" />

            {([
              { key: "status",  opts: ["all","진행 중","완료"],   label: "상태" },
              { key: "type",    opts: ["all",...uniqueTypes],       label: "유형" },
              { key: "company", opts: ["all",...uniqueCompanies],   label: "법인" },
              { key: "urgency", opts: ["all",...uniqueUrgencies],   label: "긴급도" },
              { key: "assignee", opts: ["all",...assigneeList.map(a => a.name)], label: "담당자" },
            ] as { key: string; opts: string[]; label: string }[]).map(({ key, opts, label }) => (
              <select key={key}
                value={(listFilter as Record<string, string>)[key]}
                onChange={e => setListFilter(f => ({ ...f, [key]: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-gray-700">
                <option value="all">{label} 전체</option>
                {opts.filter(o => o !== "all").map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            <span className="ml-auto text-xs text-gray-400">{filteredList.length}건</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                  {["상태","유형","긴급도","법인","부서","문의자","문의내용","접수일","담당자","만족도",""].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-gray-300">조건에 맞는 데이터가 없습니다</td></tr>
                ) : filteredList.map(t => {
                  const fb = feedbacks[t.id];
                  return (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-amber-50/20 transition-colors">
                      <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {t.inquiryType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><UrgencyBadge urgency={t.urgency} /></td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.company}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.department}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.requester}</td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <p className="truncate text-gray-700" title={t.content || t.title}>
                          {t.content || t.title || "—"}
                        </p>
                        {t.actionNote && (
                          <p className="truncate text-[10px] text-gray-400 mt-0.5" title={t.actionNote}>{t.actionNote}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                        {(t.submittedAt || "").slice(0, 10) || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.assignee || "—"}</td>
                      <td className="px-3 py-2.5">
                        {fb ? (
                          <div className="flex flex-col gap-0.5">
                            <Stars rating={fb.rating} />
                            {fb.comment && <p className="text-[9px] text-gray-400 max-w-[100px] truncate" title={fb.comment}>{fb.comment}</p>}
                          </div>
                        ) : t.status === "완료" ? (
                          <span className="text-[10px] text-gray-300">미평가</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {t.notionUrl && (
                            <a href={t.notionUrl} target="_blank" rel="noopener noreferrer"
                              className="text-amber-500 hover:text-amber-600 transition-colors" title="노션에서 보기">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                          )}
                          {t.status === "완료" && !fb && (
                            <button onClick={() => copyFeedbackLink(t.id)}
                              title="평가 링크 복사"
                              className="text-amber-500 hover:text-amber-600 transition-colors text-[10px] font-medium whitespace-nowrap">
                              {copiedId === t.id ? "복사됨" : "평가링크"}
                            </button>
                          )}
                          {t.status === "완료" && t.requesterEmail && !emailSentIds.has(t.id) && (
                            <button onClick={() => sendFeedbackEmail(t)}
                              disabled={sendingEmail === t.id}
                              title={`만족도 평가 이메일 발송 → ${t.requesterEmail}`}
                              className="text-amber-500 hover:text-amber-600 transition-colors text-[10px] font-medium whitespace-nowrap disabled:opacity-40 flex items-center gap-0.5">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                              {sendingEmail === t.id ? "발송중..." : "이메일"}
                            </button>
                          )}
                          {t.status === "완료" && !t.requesterEmail && !fb && (
                            <span className="text-gray-300 text-[10px] whitespace-nowrap" title="이메일 없음">이메일 없음</span>
                          )}
                          {t.status === "완료" && emailSentIds.has(t.id) && (
                            <span className="text-green-500 text-[10px] whitespace-nowrap flex items-center gap-0.5">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              발송됨
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ Tab: 접수 현황 */}
      {tab === "status_list" && (
        <div className="space-y-3">
          {manualsError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              매뉴얼 데이터를 불러오지 못해 반복 문의 알림이 정확하지 않을 수 있습니다. (코드: {manualsError})
            </div>
          )}
          {repeatAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                🔁 반복되는 문의 유형이 있습니다 — 매뉴얼 제작을 검토해주세요
              </div>
              <p className="text-xs text-amber-700/80">
                완료 처리 시 등록된 조치분류를 기준으로, {REPEAT_ALERT_THRESHOLD}건 이상 반복됐지만 아직 매뉴얼이 없는 유형입니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {repeatAlerts.map(({ category, count }) => (
                  <div key={category} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg pl-3 pr-1.5 py-1.5">
                    <span className="text-xs text-gray-700">{category}</span>
                    <span className="text-xs font-bold text-amber-700">{count}건</span>
                    <button onClick={() => goCreateManualFor(category)}
                      className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md px-2 py-1 transition-colors">
                      매뉴얼 만들기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="내용 · 요청자 · 부서 검색..."
              value={listFilter.search}
              onChange={e => setListFilter(f => ({ ...f, search: e.target.value }))}
              className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            {([
              { key: "status",  opts: ["all","진행 중","완료"],   label: "전체 상태" },
              { key: "type",    opts: ["all",...uniqueTypes],       label: "전체 유형" },
              { key: "company", opts: ["all",...uniqueCompanies],   label: "전체 법인" },
              { key: "urgency", opts: ["all",...uniqueUrgencies],   label: "전체 긴급도" },
              { key: "assignee", opts: ["all",...assigneeList.map(a => a.name)], label: "전체 담당자" },
            ] as { key: string; opts: string[]; label: string }[]).map(({ key, opts, label }) => (
              <select key={key}
                value={(listFilter as Record<string, string>)[key]}
                onChange={e => setListFilter(f => ({ ...f, [key]: e.target.value }))}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                <option value="all">{label}</option>
                {opts.filter(o => o !== "all").map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            {(listFilter.status !== "all" || listFilter.type !== "all" || listFilter.company !== "all" || listFilter.urgency !== "all" || listFilter.assignee !== "all" || listFilter.search) && (
              <button
                onClick={() => setListFilter({ status: "all", type: "all", company: "all", urgency: "all", assignee: "all", search: "" })}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                초기화
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filteredList.length}건</span>
            <button onClick={() => load(true)} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors disabled:opacity-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={refreshing ? "animate-spin" : ""}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              새로고침
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["상태","유형","법인","부서","문의자","자산번호","문의내용","긴급도","담당자","접수일"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr><td colSpan={10} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
                ) : filteredList.map(t => (
                  <tr key={t.id}>
                    {/* 상태 */}
                    <td><InlineStatusCell ticket={t} statuses={uniqueStatuses} onUpdated={handleTicketUpdated} /></td>
                    {/* 유형 */}
                    <td>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                        {t.inquiryType || "—"}
                      </span>
                    </td>
                    {/* 법인 */}
                    <td className="text-sm text-gray-600 whitespace-nowrap">{t.company || "—"}</td>
                    {/* 부서 */}
                    <td className="text-sm text-gray-500 max-w-[7rem]">
                      <p className="truncate" title={t.department}>{t.department || "—"}</p>
                    </td>
                    {/* 문의자 */}
                    <td>
                      {t.requester ? (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(t.requester);
                            setCopiedRequesterId(t.id);
                            setTimeout(() => setCopiedRequesterId(prev => prev === t.id ? null : prev), 2000);
                          }}
                          className="text-sm text-gray-600 hover:text-amber-600 transition-colors flex items-center gap-1 group"
                          title="클릭하여 복사"
                        >
                          {t.requester}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                          </svg>
                          {copiedRequesterId === t.id && (
                            <span className="text-[9px] text-green-600 font-medium">복사됨</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    {/* 자산번호 */}
                    <td className="text-sm font-mono">
                      {t.assetNo ? (() => {
                        const history = assetTicketsMap.get(t.assetNo.toLowerCase()) || [];
                        const count = history.length;
                        const isOpen = assetHistoryOpen === `${t.id}:${t.assetNo}`;
                        return (
                          <div className="relative flex items-center gap-1.5">
                            <button
                              onClick={() => setModalAssetId(t.assetNo)}
                              className="text-amber-600 hover:underline hover:text-amber-700 transition-colors"
                            >
                              {t.assetNo}
                            </button>
                            {count >= 2 && (
                              <button
                                onClick={() => setAssetHistoryOpen(isOpen ? null : `${t.id}:${t.assetNo}`)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap"
                                title={`동일 자산 문의 ${count}건`}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>
                                  <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                                </svg>
                                {count}
                              </button>
                            )}
                            {isOpen && (
                              <div ref={assetHistoryRef}
                                className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-0 min-w-[340px] max-h-[320px] overflow-auto"
                                style={{ maxWidth: "420px" }}>
                                <div className="sticky top-0 bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-700">
                                    자산 {t.assetNo} 문의 이력 ({count}건)
                                  </span>
                                  <button onClick={() => setAssetHistoryOpen(null)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  </button>
                                </div>
                                <div className="divide-y divide-gray-50">
                                  {[...history].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "")).map(h => (
                                    <button key={h.id}
                                      onClick={() => { setAssetHistoryOpen(null); setFloatingTicket(h); }}
                                      className={`w-full text-left px-4 py-2.5 hover:bg-amber-50/40 transition-colors ${h.id === t.id ? "bg-amber-50/60" : ""}`}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                          style={{ background: dark ? "#18181B" : STATUS[h.status]?.bg || "#FAFAFA", color: STATUS[h.status]?.text || "#71717A" }}>
                                          {h.status}
                                        </span>
                                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                          {h.inquiryType || "—"}
                                        </span>
                                        <span className="text-[10px] text-gray-400 ml-auto">{(h.submittedAt || "").slice(0, 10)}</span>
                                      </div>
                                      <p className="text-xs text-gray-700 truncate">{h.content || h.title || "—"}</p>
                                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                                        <span>{h.requester || "—"}</span>
                                        <span>·</span>
                                        <span>{h.department || "—"}</span>
                                        {h.assignee && <><span>·</span><span>담당: {h.assignee}</span></>}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    {/* 문의내용 */}
                    <td className="max-w-xs">
                      <button
                        onClick={e => { e.stopPropagation(); setFloatingTicket(t); }}
                        className="text-left w-full hover:text-amber-600 transition-colors"
                      >
                        <p className="truncate text-gray-700 text-sm underline decoration-dotted underline-offset-2" title={t.content || t.title}>
                          {t.content || t.title || "—"}
                        </p>
                        {t.actionNote && (
                          <p className="truncate text-xs text-gray-400 mt-0.5" title={t.actionNote}>{t.actionNote}</p>
                        )}
                      </button>
                    </td>
                    {/* 긴급도 */}
                    <td><UrgencyBadge urgency={t.urgency} /></td>
                    {/* 담당자 */}
                    <td><InlineAssigneeCell ticket={t} assigneeList={assigneeList} onUpdated={handleTicketUpdated} /></td>
                    {/* 접수일 (24시간제 HH:mm:ss) */}
                    <td className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDateTime(t.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAssetId && (
        <AssetModalInner assetId={modalAssetId} onClose={() => setModalAssetId(null)} />
      )}
      {floatingTicket && (
        <HelpDeskTicketFloating
          ticket={floatingTicket}
          assigneeList={assigneeList}
          statuses={uniqueStatuses}
          manuals={manuals}
          onClose={() => setFloatingTicket(null)}
          onUpdated={handleTicketUpdated}
          currentUserName={currentUserName}
        />
      )}

      {/* ════ Tab: 담당자 */}
      {tab === "assignee" && (() => {
        // 담당자별 평가 데이터 집계
        const now = new Date();
        const thisYear = now.getFullYear();

        // 평가가 있는 완료 티켓만 대상
        const ratedTickets = displayTickets.filter(t => t.status === "완료" && feedbacks[t.id] && t.assignee);
        // 전체 배정 티켓 (처리 통계용)
        const assignedTickets = displayTickets.filter(t => t.assignee);

        // 담당자 목록: 저장된 리스트 우선, 없으면 티켓 기반 전체
        const assigneeNames = storedAssignees.length > 0
          ? storedAssignees.map(a => a.name)
          : [...new Set(assignedTickets.map(t => t.assignee))].sort() as string[];

        if (assigneeNames.length === 0) return (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 text-sm">
            배정된 담당자가 없습니다.<br />
            <span className="text-xs text-gray-300 mt-1 block">담당자 리스트 관리에서 인원을 추가해주세요.</span>
          </div>
        );

        // 최근 6개월 라벨
        const recentMonths = last6Months();

        // 담당자별 통계 계산
        const assigneeStats = assigneeNames.map(name => {
          const myRated   = ratedTickets.filter(t => t.assignee === name);
          const myAll     = assignedTickets.filter(t => t.assignee === name);
          const myDone    = myAll.filter(t => t.status === "완료");
          const ratings   = myRated.map(t => feedbacks[t.id].rating);

          // 처리 통계
          const allCount      = myAll.length;
          const doneCount     = myDone.length;
          const completionRate = allCount > 0 ? Math.round((doneCount / allCount) * 100) : 0;
          const avgDays = myDone.length > 0
            ? Math.round(myDone.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / myDone.length)
            : null;

          // 만족도 평균
          const totalAvg = ratings.length > 0
            ? (ratings.reduce((s, r) => s + r, 0) / ratings.length)
            : null;

          // 연평균 (올해)
          const yearRatings = myRated
            .filter(t => new Date(t.lastEditedAt).getFullYear() === thisYear)
            .map(t => feedbacks[t.id].rating);
          const yearAvg = yearRatings.length > 0
            ? (yearRatings.reduce((s, r) => s + r, 0) / yearRatings.length)
            : null;

          // 월별 평균 (최근 6개월)
          const monthlyAvg = recentMonths.map(m => {
            const mRatings = myRated
              .filter(t => (t.lastEditedAt || "").startsWith(m))
              .map(t => feedbacks[t.id].rating);
            const mDoneCount = myDone
              .filter(t => (t.lastEditedAt || "").startsWith(m))
              .length;
            return {
              month: m,
              avg: mRatings.length > 0
                ? (mRatings.reduce((s, r) => s + r, 0) / mRatings.length)
                : null,
              count: mRatings.length,
              doneCount: mDoneCount,
            };
          });

          const yearDoneCount = myDone.filter(t => new Date(t.lastEditedAt).getFullYear() === thisYear).length;
          return { name, totalAvg, yearAvg, monthlyAvg, totalCount: ratings.length, yearCount: yearRatings.length, yearDoneCount, allCount, doneCount, completionRate, avgDays };
        }).sort((a, b) => b.allCount - a.allCount);

        const fmtAvg = (v: number | null) =>
          v !== null ? v.toFixed(1) : "—";

        const ratingColor = (v: number | null) => {
          if (v === null) return "var(--state-neutral)";
          if (v >= 4.5) return "var(--state-positive)";
          if (v >= 3.5) return "var(--state-progress)";
          if (v >= 2.5) return "var(--state-caution)";
          return "var(--state-risk)";
        };

        return (
          <div className="space-y-4">

            {/* 담당자별 종합 카드 */}
            <div className="grid grid-cols-1 gap-3">
              {assigneeStats.map(({ name, totalAvg, yearAvg, totalCount, allCount, doneCount, completionRate, avgDays }) => (
                <div key={name} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-600">{name.slice(0, 1)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm">{name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">평가 수집 {totalCount}건</div>
                  </div>
                  <div className="flex gap-5 flex-wrap">
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-gray-800">{allCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">총 배정</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-green-600">{doneCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">완료</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: completionRate >= 80 ? "var(--state-positive)" : completionRate >= 50 ? "var(--state-caution)" : "var(--state-risk)" }}>
                        {completionRate}%
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">완료율</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-amber-600">
                        {avgDays !== null ? `${avgDays}일` : "—"}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">평균 처리일</div>
                    </div>
                    <div className="w-px bg-gray-100 self-stretch mx-1" />
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: ratingColor(yearAvg) }}>
                        {fmtAvg(yearAvg)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{thisYear}년 만족도</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: ratingColor(totalAvg) }}>
                        {fmtAvg(totalAvg)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">전체 만족도</div>
                    </div>
                    {totalCount > 0 && (
                      <div className="text-center">
                        <Stars rating={Math.round(yearAvg ?? totalAvg ?? 0)} />
                        <div className="text-[10px] text-gray-400 mt-0.5">별점</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 처리 통계 요약 테이블 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">담당자별 처리 통계</h3>
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2.5 pr-4 text-gray-500 font-semibold">담당자</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">총 배정</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">완료</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">진행 중</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">완료율</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">평균 처리일</th>
                      <th className="text-center py-2.5 px-3 text-gray-700 font-bold">만족도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map(({ name, allCount, doneCount, completionRate, avgDays, totalAvg }) => (
                      <tr key={name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-amber-100 inline-flex items-center justify-center text-[10px] font-bold text-amber-600 flex-shrink-0">
                              {name.slice(0, 1)}
                            </span>
                            <span className="font-medium text-gray-700">{name}</span>
                          </span>
                        </td>
                        <td className="text-center py-2.5 px-3 font-bold text-gray-800">{allCount}</td>
                        <td className="text-center py-2.5 px-3 font-bold text-green-600">{doneCount}</td>
                        <td className="text-center py-2.5 px-3 text-amber-600 font-medium">{allCount - doneCount}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className="font-bold" style={{ color: completionRate >= 80 ? "var(--state-positive)" : completionRate >= 50 ? "var(--state-caution)" : "var(--state-risk)" }}>
                            {completionRate}%
                          </span>
                        </td>
                        <td className="text-center py-2.5 px-3 text-amber-600 font-medium">
                          {avgDays !== null ? `${avgDays}일` : "—"}
                        </td>
                        <td className="text-center py-2.5 px-3">
                          <span className="font-extrabold text-[13px]" style={{ color: ratingColor(totalAvg) }}>
                            {fmtAvg(totalAvg)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 월별 평균 테이블 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                담당자별 월평균 만족도
                <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2.5 pr-6 text-gray-500 font-semibold whitespace-nowrap">담당자</th>
                      {recentMonths.map(m => (
                        <th key={m} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">
                          {monthLabel(m)}
                        </th>
                      ))}
                      <th className="text-center py-2.5 px-4 text-gray-500 font-semibold">{thisYear}년</th>
                      <th className="text-center py-2.5 px-4 text-gray-700 font-bold">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map(({ name, monthlyAvg, yearAvg, totalAvg, yearCount, yearDoneCount, totalCount, doneCount }) => (
                      <tr key={name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-6 font-semibold text-gray-700 whitespace-nowrap flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-100 inline-flex items-center justify-center text-[10px] font-bold text-amber-600 flex-shrink-0">
                            {name.slice(0, 1)}
                          </span>
                          {name}
                        </td>
                        {monthlyAvg.map(({ month, avg, count, doneCount: mDone }) => (
                          <td key={month} className="text-center py-3 px-4">
                            {avg !== null || mDone > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-[13px]" style={{ color: ratingColor(avg) }}>
                                  {avg !== null ? avg.toFixed(1) : "—"}
                                </span>
                                <span className="text-[9px] text-gray-400">{mDone}건 / 응답 {count}건</span>
                                <span className="text-[9px] text-gray-400">응답률 {mDone > 0 ? Math.round((count / mDone) * 100) : 0}%</span>
                              </div>
                            ) : <span className="text-gray-200">—</span>}
                          </td>
                        ))}
                        <td className="text-center py-3 px-4">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-[13px]" style={{ color: ratingColor(yearAvg) }}>
                              {fmtAvg(yearAvg)}
                            </span>
                            <span className="text-[9px] text-gray-400">{yearDoneCount}건 / 응답 {yearCount}건</span>
                            <span className="text-[9px] text-gray-400">응답률 {yearDoneCount > 0 ? Math.round((yearCount / yearDoneCount) * 100) : 0}%</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-extrabold text-[14px]" style={{ color: ratingColor(totalAvg) }}>
                              {fmtAvg(totalAvg)}
                            </span>
                            <span className="text-[9px] text-gray-400">{doneCount}건 / 응답 {totalCount}건</span>
                            <span className="text-[9px] text-gray-400">응답률 {doneCount > 0 ? Math.round((totalCount / doneCount) * 100) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 최근 피드백 코멘트 */}
            {(() => {
              const comments = ratedTickets
                .filter(t => feedbacks[t.id]?.comment)
                .sort((a, b) => (feedbacks[b.id].submittedAt > feedbacks[a.id].submittedAt ? 1 : -1))
                .slice(0, 10);
              if (comments.length === 0) return null;
              return (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">최근 피드백 코멘트</h3>
                  <div className="space-y-3">
                    {comments.map(t => {
                      const fb = feedbacks[t.id];
                      return (
                        <div key={t.id} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600 flex-shrink-0 mt-0.5">
                            {t.assignee.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-700">{t.assignee}</span>
                              <Stars rating={fb.rating} />
                              <span className="text-[10px] text-gray-300 ml-auto">
                                {fb.submittedAt.slice(0, 10)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">{fb.comment}</p>
                            <p className="text-[10px] text-gray-300 mt-1">
                              {[t.company, t.requester].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ════ Tab: 분석 */}
      {tab === "analysis" && (() => {
        // ── 조치 분석 변수 ────────────────────────────────────
        const METHOD_COLORS: Record<string, string> = {
          "원격": "#6366F1", "방문": "var(--brand)", "메신저/메일": "#0EA5E9", "기타": "#9CA3AF",
        };
        const METHODS = ["원격", "방문", "메신저/메일", "기타"];

        const methodCounts = new Map<string, number>();
        displayTickets.forEach(t => {
          if (t.actionMethod) methodCounts.set(t.actionMethod, (methodCounts.get(t.actionMethod) ?? 0) + 1);
        });
        const byMethod = METHODS.filter(m => methodCounts.has(m))
          .map(m => ({ method: m, count: methodCounts.get(m)!, color: METHOD_COLORS[m] }));
        const totalMethodActions = byMethod.reduce((s, m) => s + m.count, 0);
        const unfilledMethod = displayTickets.filter(t => !t.actionMethod).length;

        const mainCatCounts: Record<string, number> = { "하드웨어": 0, "소프트웨어": 0, "기타": 0 };
        const detailCounts = new Map<string, number>();
        displayTickets.forEach(t => {
          (t.actionCategory ?? []).forEach(cat => {
            const main = cat.split(" > ")[0];
            if (main in mainCatCounts) mainCatCounts[main]++;
            detailCounts.set(cat, (detailCounts.get(cat) ?? 0) + 1);
          });
        });
        const MAIN_COLORS: Record<string, string> = { "하드웨어": "#6366F1", "소프트웨어": "#10B981", "기타": "#9CA3AF" };
        const totalCatActions = Object.values(mainCatCounts).reduce((s, v) => s + v, 0);

        const byDetail = [...detailCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, count], i) => ({ label, count, color: TYPE_COLORS[i % TYPE_COLORS.length] }));

        const withMethod   = completedTickets.filter(t => !!t.actionMethod).length;
        const withCategory = completedTickets.filter(t => (t.actionCategory ?? []).length > 0).length;
        const withNote     = completedTickets.filter(t => !!t.actionNote).length;
        const completedCount = completedTickets.length;

        // ── 반복 문의 매뉴얼 커버리지 ──────────────────────────
        const manualCoveredCategories = new Set(manuals.flatMap(m => m.categories)).size;
        const manualTotalCategories   = ALL_TREE_KEYS.length;
        const manualMatchedOpenCount = tickets.filter(t => {
          if (t.status === "완료") return false;
          const matched = classifyActionCategory(t.content || "", t.title || "", t.inquiryType || "");
          return !!matched && manuals.some(m => m.categories.includes(matched.category));
        }).length;

        const recentCompleted = [...completedTickets]
          .sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime())
          .slice(0, 10);

        // ── 반복 분석 변수 ────────────────────────────────────
        const recentMonths = last6Months();

        // ── 문의 내용 기반 분류 집계 ─────────────────────────
        const classified = displayTickets.map(t => ({ ...t, ...classifyContent(t) }));

        // SW 세부 집계
        const swTickets  = classified.filter(t => t.mainCat === "SW");
        const hwTickets  = classified.filter(t => t.mainCat === "HW");
        const etcTickets = classified.filter(t => t.mainCat === "기타");

        function buildSubStats(tickets: typeof classified, cats: SubCategory[]) {
          return cats.map(cat => {
            const matched = tickets.filter(t => t.subCat.id === cat.id);
            const counts  = recentMonths.map(m =>
              matched.filter(t => (t.submittedAt || "").startsWith(m)).length
            );
            const total   = matched.length;
            const lastIdx = counts.length - 1;
            const cur     = counts[lastIdx];
            const prev    = counts[lastIdx - 1] ?? 0;
            const prevAvg = counts.slice(0, lastIdx).reduce((s, c) => s + c, 0) / Math.max(lastIdx, 1);
            const isSpike = cur >= 2 && prevAvg > 0 && cur >= prevAvg * 2;
            const trend   = cur > prev ? "up" : cur < prev ? "down" : "flat";
            return { ...cat, counts, total, cur, prev, prevAvg, isSpike, trend, tickets: matched };
          }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
        }

        const swStats  = buildSubStats(swTickets,  SW_SUBCATS);
        const hwStats  = buildSubStats(hwTickets,  HW_SUBCATS);
        const allStats = [...swStats, ...hwStats].sort((a, b) => b.total - a.total);
        const spikes   = allStats.filter(c => c.isSpike);

        // ── 공통 테이블 렌더 ─────────────────────────────────
        function SubCatTable({ stats, mainLabel }: { stats: ReturnType<typeof buildSubStats>; mainLabel: string }) {
          if (stats.length === 0) return (
            <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>
          );
          return (
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-4 text-gray-500 font-semibold whitespace-nowrap">세부 항목</th>
                    {recentMonths.map(m => (
                      <th key={m} className="text-center py-2.5 px-3 text-gray-500 font-semibold whitespace-nowrap">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">전월비</th>
                    <th className="text-center py-2.5 px-3 text-gray-700 font-bold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(({ id, label, color, counts, total, cur, prev, isSpike, trend }) => {
                    const maxCnt = Math.max(...counts, 1);
                    return (
                      <tr key={id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isSpike ? "bg-red-50/40" : ""}`}>
                        <td className="py-2.5 pr-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                            <span className="font-medium text-gray-700 whitespace-nowrap">{label}</span>
                            {isSpike && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">급증</span>}
                          </span>
                        </td>
                        {counts.map((cnt, i) => {
                          const alpha = cnt > 0 ? Math.round((0.3 + (cnt / maxCnt) * 0.7) * 255).toString(16).padStart(2,"0") : "00";
                          return (
                            <td key={i} className="text-center py-2.5 px-3">
                              {cnt > 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-[11px] font-bold"
                                  style={{ background: `${color}${alpha}` }}>
                                  {cnt}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-center py-2.5 px-3">
                          <span className={`text-sm font-bold ${trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-gray-300"}`}>
                            {trend === "up" ? `↑${cur - prev}` : trend === "down" ? `↓${prev - cur}` : "→"}
                          </span>
                        </td>
                        <td className="text-center py-2.5 px-3 font-bold text-gray-800">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div className="space-y-5">

            {/* ══ 조치 분석 ══════════════════════════════════════ */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">조치 현황</p>

            {/* 입력률 카드 */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "조치방법 입력률 (완료)", filled: withMethod,   color: "var(--brand)" },
                { label: "조치분류 입력률 (완료)", filled: withCategory, color: "var(--brand)" },
                { label: "조치내용 입력률 (완료)", filled: withNote,     color: "var(--brand)" },
              ] as { label: string; filled: number; color: string }[]).map(({ label, filled, color }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-2xl font-extrabold" style={{ color }}>
                    {completedCount > 0 ? `${Math.round(filled / completedCount * 100)}%` : "—"}
                  </div>
                  <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{filled} / {completedCount}건</div>
                </div>
              ))}
            </div>

            {/* 반복 문의 매뉴얼 커버리지 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-2xl font-extrabold" style={{ color: "#0EA5E9" }}>
                  {manualCoveredCategories} / {manualTotalCategories}
                </div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">매뉴얼 보유 조치분류 (소분류)</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-2xl font-extrabold" style={{ color: "#0EA5E9" }}>{manualMatchedOpenCount}건</div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">매뉴얼로 안내 가능할 것으로 추정되는 미해결 문의</div>
              </div>
            </div>

            {/* 조치방법 + 조치분류 대분류 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">조치방법별 분포</h3>
                <div className="space-y-3">
                  {byMethod.map(({ method, count, color }) => (
                    <HBar key={method} label={method} count={count} total={totalMethodActions} color={color} />
                  ))}
                  {byMethod.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
                </div>
                {unfilledMethod > 0 && (
                  <p className="text-[10px] text-gray-300 mt-3">미입력 {unfilledMethod}건 제외</p>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">조치분류 대분류</h3>
                <div className="space-y-3">
                  {(Object.entries(mainCatCounts) as [string, number][])
                    .filter(([, cnt]) => cnt > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, count]) => (
                      <HBar key={label} label={label} count={count} total={totalCatActions} color={MAIN_COLORS[label]} />
                    ))}
                  {totalCatActions === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
                </div>
              </div>
            </div>

            {/* 조치분류 세부 항목 */}
            {byDetail.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">
                  조치분류 세부 항목
                  <span className="text-xs font-normal text-gray-400 ml-2">총 {totalCatActions}건</span>
                </h3>
                <div className="space-y-2.5">
                  {byDetail.slice(0, 15).map(({ label, count, color }) => (
                    <HBar key={label} label={label} count={count} total={totalCatActions} color={color} />
                  ))}
                </div>
              </div>
            )}

            {/* 최근 완료 처리 내역 */}
            {recentCompleted.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">
                  최근 완료 처리 내역
                  <span className="text-xs font-normal text-gray-400 ml-2">최신 10건</span>
                </h3>
                <div className="overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-100">
                        <th className="text-left py-2.5 pr-3 text-gray-500 font-semibold">문의 내용</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-semibold whitespace-nowrap">조치방법</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-semibold whitespace-nowrap">조치분류</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-semibold">조치내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCompleted.map(t => (
                        <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 pr-3">
                            <div className="max-w-[160px] truncate font-medium text-gray-700" title={t.content || t.title}>
                              {t.content || t.title || "—"}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {[t.company, t.requester].filter(Boolean).join(" · ")}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {t.actionMethod ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: `${METHOD_COLORS[t.actionMethod] ?? "#9CA3AF"}22`, color: METHOD_COLORS[t.actionMethod] ?? "#9CA3AF" }}>
                                {t.actionMethod}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {(t.actionCategory ?? []).length > 0
                                ? (t.actionCategory ?? []).map(c => (
                                    <span key={c} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                                      {c.split(" > ")[1] ?? c}
                                    </span>
                                  ))
                                : <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                              {t.actionNote || <span className="text-gray-300 italic">미입력</span>}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── 구분선 ── */}
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">반복 유형 분석</p>
            </div>

            {/* ── 메인 카테고리 분포 요약 ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "SW 문의", count: swTickets.length,  color: "#6366F1", bg: "#EEF2FF" },
                { label: "HW 문의", count: hwTickets.length,  color: "#F59E0B", bg: "#FFFBEB" },
                { label: "기타",    count: etcTickets.length, color: "#6B7280", bg: "#F9FAFB" },
              ].map(item => (
                <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <div>
                    <div className="text-xl font-extrabold" style={{ color: item.color }}>{item.count}건</div>
                    <div className="text-xs text-gray-500 font-medium">{item.label}</div>
                    <div className="text-[10px] text-gray-300">{displayTickets.length > 0 ? Math.round(item.count / displayTickets.length * 100) : 0}%</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── 급증 경보 ── */}
            {spikes.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-red-700 mb-2">이번 달 급증 항목 감지</h3>
                <div className="space-y-1.5">
                  {spikes.map(({ label, color, cur, prevAvg }) => (
                    <div key={label} className="text-xs text-red-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                      <span className="font-bold">{label}</span>
                      <span>— 이번 달 <strong>{cur}건</strong></span>
                      <span className="text-red-400">
                        (월평균 {prevAvg.toFixed(1)}건 대비 {Math.round(cur / Math.max(prevAvg, 0.1))}배)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SW 세부 분석 ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                SW 문의 세부 분류
                <span className="text-xs font-normal text-gray-400 ml-1">내용 분석 기반 · {swTickets.length}건</span>
              </h3>
              <p className="text-[11px] text-gray-400 mb-4">어떤 소프트웨어·프로그램 문의가 많이 접수되는지 파악</p>
              <SubCatTable stats={swStats} mainLabel="SW" />
            </div>

            {/* ── HW 세부 분석 ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                HW 문의 세부 분류
                <span className="text-xs font-normal text-gray-400 ml-1">내용 분석 기반 · {hwTickets.length}건</span>
              </h3>
              <p className="text-[11px] text-gray-400 mb-4">어떤 하드웨어·장비 문제가 반복 접수되는지 파악</p>
              <SubCatTable stats={hwStats} mainLabel="HW" />
            </div>

            {/* ── 전체 세부 항목 미니 카드 ── */}
            {allStats.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">
                  세부 항목 추이 (최근 6개월)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {allStats.slice(0, 8).map(({ id, label, color, counts }) => {
                    const maxVal = Math.max(...counts, 1);
                    return (
                      <div key={id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                          <span className="text-[11px] font-bold text-gray-700 truncate">{label}</span>
                        </div>
                        <div className="flex items-end gap-1 h-12">
                          {counts.map((cnt, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                              {cnt > 0 && <span className="text-[8px] text-gray-400">{cnt}</span>}
                              <div className="w-full rounded-t-sm"
                                style={{
                                  height: `${Math.max((cnt / maxVal) * 100, cnt > 0 ? 10 : 0)}%`,
                                  background: color,
                                  opacity: 0.3 + (cnt / maxVal) * 0.7,
                                }} />
                              <span className="text-[8px] text-gray-300">
                                {monthLabel(recentMonths[i]).slice(-2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 미분류 샘플 (기타) ── */}
            {etcTickets.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  미분류 문의 <span className="text-xs font-normal text-gray-400">({etcTickets.length}건 · 키워드 미매칭)</span>
                </h3>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {etcTickets.slice(0, 10).map(t => (
                    <div key={t.id} className="text-[11px] text-gray-500 flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-300 flex-shrink-0">{(t.submittedAt || "").slice(0,10)}</span>
                      <span className="truncate">{t.content || t.title || "(내용 없음)"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ════ Tab: 매뉴얼 관리 */}
      {tab === "manuals" && (
        <ManualsTab
          tickets={tickets}
          manuals={manuals}
          manualsError={manualsError}
          onSaved={loadManuals}
          presetCategory={pendingManualCategory}
          onConsumePreset={() => setPendingManualCategory(null)}
        />
      )}

      {/* ════ Tab: 보고서 */}
      {tab === "report" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">보고서 옵션</h3>
            <div className="flex flex-wrap gap-4 items-end">

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">시작 월</label>
                <input type="month" value={reportStartMonth}
                  onChange={e => setReportStartMonth(e.target.value)}
                  max={reportEndMonth}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">종료 월</label>
                <input type="month" value={reportEndMonth}
                  onChange={e => setReportEndMonth(e.target.value)}
                  min={reportStartMonth}
                  max={nowYearMonth()}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">법인</label>
                <select value={reportCompany} onChange={e => setReportCompany(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-gray-700">
                  <option value="all">전체 법인</option>
                  {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 빠른 기간 선택 */}
              <div className="flex gap-1.5">
                {[
                  { label: "이번 달", fn: () => { setReportStartMonth(nowYearMonth()); setReportEndMonth(nowYearMonth()); } },
                  { label: "최근 3개월", fn: () => {
                    const d = new Date(); d.setMonth(d.getMonth() - 2);
                    setReportStartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
                    setReportEndMonth(nowYearMonth());
                  }},
                  { label: "최근 6개월", fn: () => {
                    const d = new Date(); d.setMonth(d.getMonth() - 5);
                    setReportStartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
                    setReportEndMonth(nowYearMonth());
                  }},
                  { label: "올해", fn: () => {
                    setReportStartMonth(`${new Date().getFullYear()}-01`);
                    setReportEndMonth(nowYearMonth());
                  }},
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 미리보기 요약 */}
          {(() => {
            const previewTickets = tickets.filter(t => {
              const m = (t.submittedAt || "").slice(0, 7);
              const inRange = m >= reportStartMonth && m <= reportEndMonth;
              const inCo = reportCompany === "all" || t.company === reportCompany;
              return inRange && inCo;
            });
            const previewDone = previewTickets.filter(t => t.status === "완료").length;
            const previewFbs  = previewTickets.map(t => feedbacks[t.id]).filter(Boolean) as FeedbackEntry[];
            const previewAvgR = previewFbs.length > 0
              ? (previewFbs.reduce((s,f) => s + f.rating, 0) / previewFbs.length).toFixed(1)
              : null;

            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-amber-800 mb-3">
                  보고서 미리보기
                  <span className="text-xs font-normal text-amber-600 ml-2">
                    {reportCompany === "all" ? "전체 법인" : reportCompany} · {monthLabel(reportStartMonth)}~{monthLabel(reportEndMonth)}
                  </span>
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "접수 건수", value: previewTickets.length, color: "var(--brand)" },
                    { label: "완료",      value: previewDone,            color: "var(--state-positive)" },
                    { label: "진행 중",   value: previewTickets.length - previewDone, color: "var(--state-progress)" },
                    { label: "평균 만족도", value: previewAvgR ? `★ ${previewAvgR}` : "—", color: "var(--brand)" },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-lg p-3 text-center border border-amber-100">
                      <div className="text-xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-amber-600">
                  {previewTickets.length > 0
                    ? `총 ${previewTickets.length}건의 데이터가 포함된 HTML 보고서를 생성합니다.`
                    : "선택한 조건에 해당하는 데이터가 없습니다."}
                </p>
              </div>
            );
          })()}

          <button onClick={downloadReport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--brand)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            HTML 보고서 다운로드
          </button>

          {/* 만족도 평가 안내 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">만족도 평가 링크 안내</h3>
            <p className="text-xs text-gray-500 mb-3">
              문의 처리 완료 후 <strong>목록 탭</strong>에서 완료된 티켓의 <span className="text-amber-600 font-semibold">평가링크</span> 버튼을 눌러 링크를 복사한 뒤 사용자에게 전달하세요.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 font-mono text-[11px] text-amber-700 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/inquiry/feedback/[티켓ID]
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

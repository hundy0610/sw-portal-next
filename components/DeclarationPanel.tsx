"use client";
import { useState, useMemo, useRef } from "react";
import { safeJson } from "@/lib/fetch-json";
import { downloadSwTemplate, parseSwExcelFile, type SwExcelRow } from "@/lib/sw-template";

// ─────────────────────────────────────────────────────────────────────────────
// Notion 스키마 기반 실제 선택지
// ─────────────────────────────────────────────────────────────────────────────
const COMPANIES = [
  "대웅제약","대웅바이오","대웅","대웅개발","대웅개발본부","대웅_임상개발센터",
  "대웅재단","대웅경영개발원","대웅펫","대웅이엔지","대웅_개발본부",
  "한올바이오파마","시지바이오","IdsTrust","디엔코스메틱스","디엔컴퍼니",
  "더편한샵","페이지원","엠서클","애디테라","노바메디텍","에이하나",
  "다나아데이터","클리슈어리서치","유와이즈원","DNC","석천나눔재단",
  "HR코리아","힐리언스코어센터","블루넷","힐리언스",
];

const SW_CATEGORIES = [
  "OFFICE","MAC OFFICE","HANCOM","MAC HANCOM","EZPdf","Adobe PDF","nspdf",
  "Adobe","Figma","CAD","ZWCAD","Cadian","keyshot","sketch up",
  "Chat GPT","Claude","Copilot","CURSOR Ai","Github Copilot",
  "Notion","Slack","Confluence","JIRA","Jira Service Management","Postman",
  "JETBRAINS","Sparrow SAST",
  "UIPath Developer","Unattended Robot","Attended Robot",
  "SeetrolView","기타",
];

const SW_WORKTYPE_HINT: Record<string, string> = {
  "OFFICE":"사무","MAC OFFICE":"사무","HANCOM":"사무","MAC HANCOM":"사무",
  "EZPdf":"사무","Adobe PDF":"사무","nspdf":"사무",
  "Adobe":"디자인","Figma":"디자인","keyshot":"디자인","sketch up":"디자인",
  "CAD":"설계","ZWCAD":"설계","Cadian":"설계",
  "Chat GPT":"AI","Claude":"AI","Copilot":"AI","CURSOR Ai":"AI","Github Copilot":"AI",
  "Notion":"협업","Slack":"협업","Confluence":"협업","JIRA":"협업",
  "Jira Service Management":"협업","Postman":"개발","JETBRAINS":"개발","Sparrow SAST":"개발",
  "UIPath Developer":"RPA","Unattended Robot":"RPA","Attended Robot":"RPA",
  "SeetrolView":"원격",
};

const WORK_TYPES     = ["사무","정부","개발","설계","디자인","협업","AI","원격","RPA","기타"];
const LICENSE_TYPES  = ["구독(웹)","구독(업체)","영구"];
const BILLING_TYPES  = ["법인카드","개인지불 후 청구","쉐어드 청구","기타"];
const ACCOUNT_TYPES  = ["개인","법인","공용"];
const RENEWAL_CYCLES = ["월","연"];
const COMMON_VERSIONS = [
  "Pro","Pro Plus","Standard","비즈니스","365",
  "2026","2025","2024","2023","2022","2021",
  "CC","Team","Enterprise","MAX","Business","plus",
];

// 라이선스 유형 설명
const LICENSE_TYPE_DESC: Record<string, string> = {
  "구독(웹)":  "부서 또는 개인이 웹사이트에서 직접 카드로 결제하는 SW입니다.\n예: ChatGPT, Claude, Figma 등\nIT팀이 아닌 사용자가 직접 구매합니다.",
  "구독(업체)":"자산관리파트를 통해 파트너사에서 구매하는 SW입니다.\n증서 또는 라이선스 키가 발급되며 IT팀이 관리합니다.",
  "영구":      "한 번 구매하면 기간 제한 없이 사용하는 SW입니다.\n예: MS Office 2021 영구판, AutoCAD 영구 라이선스 등",
};

// 계정 유형 설명
const ACCOUNT_TYPE_TOOLTIP =
  "개인: 개인 이메일(Gmail, Naver 등)로 등록된 계정\n" +
  "법인: 회사 도메인 이메일(예: @daewoong.co.kr)로 등록된 계정\n" +
  "공용: 여러 팀원이 함께 사용하는 공유 계정";

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────
interface UserInfo { company: string; department: string; name: string; }
interface SwRecord {
  id: string; notionUrl: string; user: string;
  swCategory: string; swDetail: string; version: string[];
  status: string; licenseType: string; workType: string;
  billingType: string; accountType: string; renewalCycle: string;
  monthlyKrw: number; monthlyUsd: number; licenseKey: string;
  renewalDate: string;
}
interface NewSwForm {
  swCategory: string; swDetail: string; licenseType: string;
  workType: string; billingType: string; billingCompany: string; accountType: string;
  renewalCycle: string; version: string[]; customVersion: string;
  monthlyKrw: number; monthlyUsd: number; licenseKey: string;
}
// 아직 Notion에 등록되지 않고 로컬에 대기 중인 신규 SW 항목 (실사 완료 시 일괄 등록)
interface PendingSwRecord {
  swCategory: string; swDetail: string; version: string[];
  licenseType: string; workType: string;
  billingType: string; accountType: string; renewalCycle: string;
  monthlyKrw: number; monthlyUsd: number; licenseKey: string;
}

const EMPTY_FORM: NewSwForm = {
  swCategory:"", swDetail:"", licenseType:"",
  workType:"", billingType:"", billingCompany:"", accountType:"",
  renewalCycle:"", version:[], customVersion:"",
  monthlyKrw:0, monthlyUsd:0, licenseKey:"",
};

const STATUS_COLOR: Record<string, string> = {
  "사용중":   "bg-green-100 text-green-700",
  "신규등록": "bg-amber-100 text-amber-700",
  "갱신필요": "bg-yellow-100 text-yellow-700",
  "반납예정": "bg-gray-100 text-gray-500",
  "만료":     "bg-red-100 text-red-600",
  "미확인":   "bg-orange-100 text-orange-600",
};

// ─────────────────────────────────────────────────────────────────────────────
// 툴팁 컴포넌트 — ? 아이콘 hover/click 시 설명 표시
// ─────────────────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold inline-flex items-center justify-center hover:bg-amber-100 hover:text-amber-600 transition-colors leading-none"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 left-0 top-5 w-64 bg-gray-800 text-white text-xs rounded-xl p-3 shadow-2xl leading-relaxed whitespace-pre-line pointer-events-none">
          {text}
          {/* 말풍선 꼬리 */}
          <div className="absolute -top-1.5 left-2 w-3 h-3 bg-gray-800 rotate-45" />
        </div>
      )}
    </span>
  );
}

// 라이선스 유형 선택 전용 (각 옵션마다 설명 표시)
function LicenseTypeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-2">
        라이선스 유형<span className="text-red-400 ml-0.5">*</span>
      </label>
      <div className="flex flex-col gap-2">
        {LICENSE_TYPES.map(type => (
          <label key={type}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
              value === type
                ? "border-amber-500 bg-amber-50"
                : "border-gray-200 bg-white hover:border-amber-300 hover:bg-gray-50"
            }`}>
            <input type="radio" name="licenseType" value={type}
              checked={value === type} onChange={() => onChange(type)}
              className="mt-0.5 accent-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">{type}</p>
              <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line leading-relaxed">
                {LICENSE_TYPE_DESC[type]}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 UI
// ─────────────────────────────────────────────────────────────────────────────
function Sel({ label, required, value, options, onChange, hint, tooltip }: {
  label: string; required?: boolean; value: string;
  options: string[]; onChange: (v: string) => void; hint?: string; tooltip?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {tooltip   && <Tooltip text={tooltip} />}
        {hint      && <span className="ml-1 text-[11px] font-normal text-gray-400">({hint})</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300">
        <option value="">선택</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Inp({ label, required, value, onChange, placeholder, type = "text", hint, tooltip }: {
  label: string; required?: boolean; value: string | number;
  onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string; tooltip?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {tooltip   && <Tooltip text={tooltip} />}
        {hint      && <span className="ml-1 text-[11px] font-normal text-gray-400">({hint})</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300" />
    </div>
  );
}

function VerChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-amber-500 text-white border-amber-500"
          : "bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600"
      }`}>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — 본인 확인
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ onNext }: { onNext: (info: UserInfo, records: SwRecord[]) => void }) {
  const [company, setCompany] = useState("");
  const [dept,    setDept]    = useState("");
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const submit = async () => {
    if (!company || !dept.trim() || !name.trim()) {
      setError("모든 항목을 입력해주세요."); return;
    }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/declaration?name=${encodeURIComponent(name.trim())}&company=${encodeURIComponent(company)}`);
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      onNext({ company, department: dept.trim(), name: name.trim() }, json.records);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-extrabold">SW</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">본인 확인</h2>
            <p className="text-xs text-gray-500 mt-0.5">법인명 + 이름으로 등록된 SW를 조회합니다</p>
          </div>
        </div>

        <div className="space-y-3">
          <Sel label="법인명" required value={company} options={COMPANIES} onChange={setCompany} />
          <Inp label="부서"   required value={dept}    onChange={setDept}    placeholder="예: 포털팀" />
          <Inp label="이름"   required value={name}    onChange={setName}    placeholder="예: 홍길동" />
        </div>

        {error && <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

        <button onClick={submit} disabled={loading}
          className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {loading ? "조회 중…" : "SW 현황 조회 →"}
        </button>
        <p className="mt-3 text-xs text-center text-gray-400">
          이름은 메신저 상의 이름과 동일해야 합니다
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 신규 SW 추가 폼
// ─────────────────────────────────────────────────────────────────────────────
function AddSwForm({ userInfo, onAdd, onCancel }: {
  userInfo: UserInfo;
  onAdd: (rec: PendingSwRecord) => void;
  onCancel: () => void;
}) {
  const [form,  setForm]  = useState<NewSwForm>({ ...EMPTY_FORM, billingCompany: userInfo.company });
  const [error, setError] = useState("");

  const isSub = form.licenseType.startsWith("구독");
  const set   = <K extends keyof NewSwForm>(k: K, v: NewSwForm[K]) => setForm(f => ({ ...f, [k]: v }));

  // 결재방식 최종값: 쉐어드 청구 선택 시 "법인명 쉐어드청구" 형태로 변환
  const getFinalBillingType = () => {
    if (form.billingType === "쉐어드 청구") {
      return `${form.billingCompany || userInfo.company} 쉐어드청구`;
    }
    return form.billingType;
  };

  const onCatChange = (v: string) => {
    set("swCategory", v);
    const hint = SW_WORKTYPE_HINT[v];
    if (hint && !form.workType) set("workType", hint);
  };

  const toggleVer = (v: string) =>
    set("version", form.version.includes(v) ? form.version.filter(x => x !== v) : [...form.version, v]);

  // 최종 제출 시 version 배열에 customVersion 병합
  const getFinalVersions = () => {
    const custom = form.customVersion.trim();
    if (!custom) return form.version;
    // 쉼표로 구분된 여러 값 허용
    const extras = custom.split(",").map(v => v.trim()).filter(Boolean);
    return [...new Set([...form.version, ...extras])];
  };

  // Notion에는 바로 등록하지 않고, 부모(Step2)의 대기 목록에만 담아둔다.
  // 실제 등록은 "실사 완료" 클릭 시 대기 목록 전체를 한번에 처리한다.
  const submit = () => {
    if (!form.swCategory || !form.licenseType || !form.workType || !form.billingType) {
      setError("SW대분류 · 라이선스유형 · 사용직군 · 결재방식은 필수입니다."); return;
    }
    if (form.billingType === "쉐어드 청구" && !form.billingCompany) {
      setError("쉐어드 청구 법인을 선택해주세요."); return;
    }
    setError("");
    onAdd({
      swCategory: form.swCategory, swDetail: form.swDetail, version: getFinalVersions(),
      licenseType: form.licenseType, workType: form.workType,
      billingType: getFinalBillingType(), accountType: form.accountType,
      renewalCycle: form.renewalCycle, monthlyKrw: form.monthlyKrw,
      monthlyUsd: form.monthlyUsd, licenseKey: form.licenseKey,
    });
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-3">
      <h3 className="text-sm font-bold text-amber-900 mb-5 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">+</span>
        새 SW 신고
      </h3>

      <div className="space-y-5">

        {/* ── 1. SW 정보 ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Sel label="SW 대분류" required value={form.swCategory}
            options={SW_CATEGORIES} onChange={onCatChange} />
          <Inp label="SW 소분류" value={form.swDetail}
            onChange={v => set("swDetail", v)}
            placeholder="예: MS Office 365 Business" hint="세부 명칭" />
        </div>

        {/* ── 2. 라이선스 유형 (라디오 + 설명) ──────────── */}
        <LicenseTypeField value={form.licenseType} onChange={v => set("licenseType", v)} />

        {/* ── 3. 사용직군 / 결재방식 ──────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Sel label="SW 사용직군" required value={form.workType}
            options={WORK_TYPES} onChange={v => set("workType", v)} />
          <div className="flex flex-col gap-2">
            <Sel label="결재방식" required value={form.billingType}
              options={BILLING_TYPES} onChange={v => {
                set("billingType", v);
                // 쉐어드청구 선택 시 법인 초기화 (기본값: 본인 법인)
                if (v === "쉐어드 청구" && !form.billingCompany) {
                  set("billingCompany", userInfo.company);
                }
              }} />
            {form.billingType === "쉐어드 청구" && (
              <div>
                <Sel label="쉐어드 청구 법인" required value={form.billingCompany}
                  options={COMPANIES} onChange={v => set("billingCompany", v)} />
                <p className="text-[11px] text-gray-400 mt-1">
                  ▸ Notion 저장값: <span className="font-medium text-gray-600">{form.billingCompany || "법인 선택 필요"} 쉐어드청구</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. 계정 유형 ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Sel label="계정 유형" value={form.accountType}
            options={ACCOUNT_TYPES} onChange={v => set("accountType", v)}
            tooltip={ACCOUNT_TYPE_TOOLTIP} />

          {/* ── 5. 구독 시 추가 필드 ── */}
          {isSub && (
            <Sel label="갱신 주기" value={form.renewalCycle}
              options={RENEWAL_CYCLES} onChange={v => set("renewalCycle", v)} />
          )}
        </div>

        {isSub && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Inp label="월 비용 (KRW)" type="number"
              value={form.monthlyKrw || ""} onChange={v => set("monthlyKrw", Number(v))}
              placeholder="0" hint="원" />
            <Inp label="월 비용 (USD)" type="number"
              value={form.monthlyUsd || ""} onChange={v => set("monthlyUsd", Number(v))}
              placeholder="0" hint="달러" />
          </div>
        )}

        {/* ── 6. 사용 계정 (이메일) ───────────────────────── */}
        <Inp label="사용 계정" value={form.licenseKey}
          onChange={v => set("licenseKey", v)}
          placeholder="예: hong.gildong@daewoong.co.kr (선택)"
          hint="이메일 주소" />

        {/* ── 7. 버전 chip + 직접 입력 ────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">
            버전 / 플랜 <span className="font-normal text-gray-400">(선택, 중복 가능)</span>
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_VERSIONS.map(v => (
              <VerChip key={v} label={v} active={form.version.includes(v)} onClick={() => toggleVer(v)} />
            ))}
          </div>
          <Inp
            label="그 외 버전 / 플랜 직접 입력"
            value={form.customVersion}
            onChange={v => set("customVersion", v)}
            placeholder="예: v3.5, Starter, Free 등 (여러 개는 쉼표로 구분)"
          />
        </div>
      </div>

      {error && <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

      <div className="flex gap-3 mt-5">
        <button onClick={submit}
          className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">
          목록에 추가
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — SW 현황 확인 & 신규 신고
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ userInfo, initialRecords, onComplete }: {
  userInfo: UserInfo;
  initialRecords: SwRecord[];
  onComplete: (records: SwRecord[], added: SwRecord[]) => void;
}) {
  const [records,    setRecords]    = useState<SwRecord[]>(initialRecords);
  const [pending,    setPending]    = useState<PendingSwRecord[]>([]);
  const [openForms,  setOpenForms]  = useState<number[]>([]);
  const [updating,   setUpdating]   = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const nextFormId = useRef(0);

  // "+ 새 SW 추가" 클릭 시마다 폼을 추가로 펼친다 (여러 건을 동시에 작성 가능)
  const openNewForm  = () => { nextFormId.current += 1; setOpenForms(f => [...f, nextFormId.current]); };
  const closeForm    = (formId: number) => setOpenForms(f => f.filter(id => id !== formId));

  const updateStatus = async (id: string, status: string) => {
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      await fetch("/api/declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "update", pageId: id, status }),
      });
      setRecords(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    } finally {
      setUpdating(u => ({ ...u, [id]: false }));
    }
  };

  const removePending = (idx: number) => setPending(p => p.filter((_, i) => i !== idx));

  // 대기 중인 신규 SW를 한번에 Notion에 등록한 뒤 다음 단계로 진행한다.
  const handleComplete = async () => {
    if (pending.length === 0) {
      onComplete(records, []);
      return;
    }
    setSubmitting(true); setSubmitError("");
    try {
      const res = await fetch("/api/declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "createMany",
          records: pending.map(p => ({
            ...p,
            user: userInfo.name, company: userInfo.company, department: userInfo.department,
          })),
        }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      const added: SwRecord[] = pending.map((p, i) => ({
        id: json.ids[i], notionUrl: `https://www.notion.so/${json.ids[i].replace(/-/g, "")}`,
        user: userInfo.name,
        swCategory: p.swCategory, swDetail: p.swDetail, version: p.version,
        status: "신규등록", licenseType: p.licenseType, workType: p.workType,
        billingType: p.billingType, accountType: p.accountType,
        renewalCycle: p.renewalCycle, monthlyKrw: p.monthlyKrw,
        monthlyUsd: p.monthlyUsd, licenseKey: p.licenseKey, renewalDate: "",
      }));
      onComplete(records, added);
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const fmtKrw = (n: number) => n > 0 ? `₩${n.toLocaleString("ko-KR")}` : null;
  const fmtUsd = (n: number) => n > 0 ? `$${n}` : null;

  return (
    <div className="max-w-3xl mx-auto space-y-3">

      {/* 사용자 배너 */}
      <div className="bg-amber-500 text-white rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">👤</div>
        <div className="flex-1">
          <p className="font-bold text-sm">{userInfo.name}</p>
          <p className="text-xs opacity-80">{userInfo.company} · {userInfo.department}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-70">등록 SW</p>
          <p className="font-bold text-lg">{records.length}개</p>
        </div>
      </div>

      {/* 기존 SW 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">등록된 SW 현황 확인</h3>
          <p className="text-xs text-gray-500 mt-0.5">각 항목의 현재 사용 여부를 선택해주세요</p>
        </div>

        {records.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-400 text-sm">조회된 SW가 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">아래에서 새 SW를 추가해주세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {records.map(r => {
              const shared = r.billingType?.includes("쉐어드");
              const cost   = fmtKrw(r.monthlyKrw) ?? fmtUsd(r.monthlyUsd);
              return (
                <li key={r.id} className={`px-5 py-4 flex items-center gap-3 ${shared ? "bg-amber-50/40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <button type="button"
                      onClick={() => setExpandedId(id => id === r.id ? null : r.id)}
                      className="flex items-center gap-2 flex-wrap text-left hover:opacity-70 transition-opacity">
                      <span className="font-semibold text-gray-900 text-sm">{r.swCategory}</span>
                      {r.swDetail && <span className="text-xs text-gray-400">{r.swDetail}</span>}
                      {r.version.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {r.version.join(" · ")}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-300">{expandedId === r.id ? "▲" : "▼"}</span>
                    </button>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.status}
                      </span>
                      {r.licenseType && <span className="text-xs text-gray-400">{r.licenseType}</span>}
                      {r.workType    && <span className="text-xs text-gray-400">· {r.workType}</span>}
                      {shared ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          🔗 {r.billingType}
                        </span>
                      ) : (
                        cost && <span className="text-xs text-amber-600 font-medium">{cost}/월</span>
                      )}
                      {shared && cost && (
                        <span className="text-xs text-amber-500 font-medium line-through opacity-60">{cost}/월</span>
                      )}
                    </div>
                    {expandedId === r.id && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {r.accountType  && <span><span className="text-gray-400">계정유형</span> · {r.accountType}</span>}
                        {r.renewalCycle && <span><span className="text-gray-400">갱신주기</span> · {r.renewalCycle}</span>}
                        {r.renewalDate  && <span><span className="text-gray-400">갱신필요일</span> · {r.renewalDate}</span>}
                        {!r.accountType && !r.renewalCycle && !r.renewalDate && (
                          <span className="text-gray-300">추가 정보가 없습니다</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                    <button onClick={() => updateStatus(r.id, "사용중")} disabled={updating[r.id]}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        r.status === "사용중"
                          ? "bg-green-500 text-white shadow-sm"
                          : "bg-white text-green-700 border border-green-300 hover:bg-green-50"
                      }`}>
                      ✓ 사용 중
                    </button>
                    <button onClick={() => updateStatus(r.id, "반납예정")} disabled={updating[r.id]}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        r.status === "반납예정"
                          ? "bg-gray-400 text-white shadow-sm"
                          : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                      }`}>
                      ✗ 반납예정
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 미등록 SW 신고 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">미등록 SW 추가 신고</h3>
          <p className="text-xs text-gray-500 mt-0.5">위 목록에 없는 SW를 추가해주세요 (실사 완료 시 한번에 등록됩니다)</p>
        </div>
        <div className="p-5">
          {pending.length > 0 && (
            <div className="mb-3 space-y-2">
              {pending.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <span className="font-semibold text-amber-800 text-sm">{r.swCategory}</span>
                    {r.swDetail    && <span className="text-amber-600 text-xs ml-1.5">{r.swDetail}</span>}
                    {r.licenseType && <span className="text-xs text-amber-500 ml-1.5">· {r.licenseType}</span>}
                  </div>
                  <button onClick={() => removePending(i)}
                    className="text-xs text-gray-400 hover:text-red-500 font-medium">삭제</button>
                </div>
              ))}
            </div>
          )}

          {openForms.length > 0 && (
            <div className="space-y-3 mb-3">
              {openForms.map(formId => (
                <AddSwForm key={formId}
                  userInfo={userInfo}
                  onAdd={rec => { setPending(p => [...p, rec]); closeForm(formId); }}
                  onCancel={() => closeForm(formId)}
                />
              ))}
            </div>
          )}

          <button onClick={openNewForm}
            className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-500 text-sm font-semibold hover:bg-amber-50 transition-colors">
            + 새 SW 추가
          </button>
        </div>
      </div>

      {/* 하단 고정 바 */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-white/95 backdrop-blur border-t border-gray-200">
        {submitError && <div className="mb-2 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{submitError}</div>}
        <button onClick={handleComplete} disabled={submitting}
          className="w-full py-3.5 rounded-2xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-md">
          {submitting ? "등록 중…" : "✓ 실사 완료"}
        </button>
        <p className="mt-1.5 text-xs text-center text-gray-400">완료 후에는 수정이 어렵습니다.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — 완료
// ─────────────────────────────────────────────────────────────────────────────
function Step3({ userInfo, records, added, onReset }: {
  userInfo: UserInfo; records: SwRecord[]; added: SwRecord[];
  onReset?: () => void;
}) {
  const active    = records.filter(r => r.status === "사용중").length;
  const returned  = records.filter(r => r.status === "반납예정").length;
  const untouched = records.length - active - returned;

  // 비용 계산: 사용 중 + 신규 등록 항목 기준
  const allActive = [
    ...records.filter(r => r.status === "사용중"),
    ...added,
  ];
  const isShared = (r: SwRecord) => !!r.billingType?.includes("쉐어드");

  const ownItems    = allActive.filter(r => !isShared(r));
  const sharedItems = allActive.filter(r =>  isShared(r));

  const ownKrw    = ownItems.reduce((s, r)    => s + (r.monthlyKrw || 0), 0);
  const ownUsd    = ownItems.reduce((s, r)    => s + (r.monthlyUsd || 0), 0);
  const sharedKrw = sharedItems.reduce((s, r) => s + (r.monthlyKrw || 0), 0);
  const sharedUsd = sharedItems.reduce((s, r) => s + (r.monthlyUsd || 0), 0);

  const hasCost = ownKrw > 0 || ownUsd > 0 || sharedKrw > 0 || sharedUsd > 0;

  const fmtKrw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
  const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

  // 쉐어드청구 항목을 법인별로 그룹핑
  const sharedByCompany: Record<string, { krw: number; usd: number; count: number }> = {};
  sharedItems.forEach(r => {
    const key = r.billingType ?? "기타 쉐어드청구";
    if (!sharedByCompany[key]) sharedByCompany[key] = { krw: 0, usd: 0, count: 0 };
    sharedByCompany[key].krw   += r.monthlyKrw || 0;
    sharedByCompany[key].usd   += r.monthlyUsd || 0;
    sharedByCompany[key].count += 1;
  });

  return (
    <div className="max-w-lg mx-auto space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">실사 완료!</h2>
        <p className="text-sm text-gray-500 mt-1">
          <span className="font-semibold text-gray-700">{userInfo.name}</span>님의 SW 자산 실사가 완료되었습니다
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{active}</p>
            <p className="text-xs text-green-700 mt-0.5 font-medium">사용 중 확인</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-500">{returned}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">반납 예정</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-amber-600">{added.length}</p>
            <p className="text-xs text-amber-700 mt-0.5 font-medium">신규 등록</p>
          </div>
          {untouched > 0 && (
            <div className="bg-yellow-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-yellow-600">{untouched}</p>
              <p className="text-xs text-yellow-700 mt-0.5 font-medium">미확인</p>
            </div>
          )}
        </div>

        {/* ── 구독 비용 리포트 ───────────────────────────────── */}
        {hasCost && (
          <div className="mt-5 text-left space-y-3">

            {/* 직접 부담 비용 */}
            {(ownKrw > 0 || ownUsd > 0) && (
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">💳 월 구독 비용 (직접 부담)</p>
                {ownKrw > 0 && (
                  <p className="text-lg font-bold text-amber-800">{fmtKrw(ownKrw)}<span className="text-xs font-normal text-amber-600 ml-1">/월</span></p>
                )}
                {ownUsd > 0 && (
                  <p className="text-lg font-bold text-amber-800">{fmtUsd(ownUsd)}<span className="text-xs font-normal text-amber-600 ml-1">/월</span></p>
                )}
                <p className="text-[11px] text-amber-500 mt-1">법인카드 · 개인지불 · 기타 결제 합산</p>
              </div>
            )}

            {/* 쉐어드청구 비용 (별도 표시) */}
            {sharedItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-semibold text-amber-700">🔗 쉐어드 청구 비용 (총액 제외)</p>
                  <Tooltip text={"쉐어드 청구는 서비스를 제공하는 법인에서 청구하는 비용으로,\n실제 지불 주체가 다르므로 총 비용에서 제외됩니다.\n\n해당 비용은 서비스 제공 법인에 문의하세요."} />
                </div>
                {(sharedKrw > 0 || sharedUsd > 0) && (
                  <div className="mb-2">
                    {sharedKrw > 0 && <p className="text-base font-bold text-amber-800">{fmtKrw(sharedKrw)}<span className="text-xs font-normal text-amber-500 ml-1">/월</span></p>}
                    {sharedUsd > 0 && <p className="text-base font-bold text-amber-800">{fmtUsd(sharedUsd)}<span className="text-xs font-normal text-amber-500 ml-1">/월</span></p>}
                  </div>
                )}
                {/* 법인별 쉐어드 내역 */}
                <div className="space-y-1">
                  {Object.entries(sharedByCompany).map(([company, val]) => (
                    <div key={company} className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 font-medium">{company}</span>
                      <span className="text-amber-600">
                        {val.count}개
                        {val.krw > 0 && ` · ${fmtKrw(val.krw)}`}
                        {val.usd > 0 && ` · ${fmtUsd(val.usd)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <div className="mt-5 bg-gray-50 rounded-xl p-4 text-left space-y-1">
          <p className="text-xs font-semibold text-gray-700">📋 처리 결과</p>
          <p className="text-xs text-gray-500">• 상태 변경 내용은 즉시 Notion에 반영되었습니다</p>
          <p className="text-xs text-gray-500">• 신규 SW는 IT팀 검토 후 최종 등록됩니다</p>
          {untouched > 0 && <p className="text-xs text-yellow-600">• 미확인 {untouched}건은 IT팀이 별도 확인합니다</p>}
        </div>

        {onReset && (
          <button onClick={onReset}
            className="mt-4 text-xs text-amber-500 hover:text-amber-700 underline underline-offset-2">
            처음으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모드 선택 — 개인 / 팀
// ─────────────────────────────────────────────────────────────────────────────
function ModeSelect({ onSelect }: { onSelect: (m: "personal" | "team") => void }) {
  return (
    <div className="max-w-lg mx-auto">
      <p className="text-center text-sm text-gray-500 mb-3">실사 방식을 선택해주세요</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => onSelect("personal")}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-base">개인 실사</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">본인 명의로 등록된 SW를 직접 확인하고 신고합니다</p>
          </div>
          <span className="text-amber-500 text-xs font-semibold">시작하기 →</span>
        </button>
        <button onClick={() => onSelect("team")}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-base">팀(부서) 실사</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">법인 + 부서 기준으로 소속 팀원 전체 현황을 한번에 확인합니다</p>
          </div>
          <span className="text-amber-500 text-xs font-semibold">시작하기 →</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 팀 플로우 — 법인+부서 조회 → 전체 표시 → 일괄 확인 / 엑셀 양식 다운로드
// ─────────────────────────────────────────────────────────────────────────────
function TeamFlow({ onBack }: { onBack: () => void }) {
  const [company,    setCompany]    = useState("");
  const [dept,       setDept]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [records,    setRecords]    = useState<SwRecord[] | null>(null);
  const [confirmed,  setConfirmed]  = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mismatchMode, setMismatchMode] = useState(false);
  const [mismatched,   setMismatched]   = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadRows,   setUploadRows]   = useState<SwExcelRow[] | null>(null);
  const [uploadFile,   setUploadFile]   = useState("");
  const [uploadErr,    setUploadErr]    = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [uploadResult, setUploadResult] = useState<number | null>(null);

  const handleUploadFile = async (file: File) => {
    setUploadErr(""); setUploadRows(null); setUploadResult(null);
    try {
      const parsed = await parseSwExcelFile(file);
      setUploadRows(parsed);
      setUploadFile(file.name);
    } catch (e) {
      setUploadErr(String(e));
    }
  };

  const submitUpload = async () => {
    if (!uploadRows) return;
    setUploading(true); setUploadErr("");
    try {
      const res = await fetch("/api/declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "createMany",
          records: uploadRows.map(r => ({
            user: r.user,
            company: r.company || company,
            department: r.department || dept,
            swCategory: r.swCategory, swDetail: r.swDetail,
            licenseType: r.licenseType, workType: r.workType, billingType: r.billingType,
            accountType: r.accountType, renewalCycle: r.renewalCycle,
            version: r.version ? r.version.split(",").map(v => v.trim()).filter(Boolean) : [],
            monthlyKrw: r.monthlyKrw, monthlyUsd: r.monthlyUsd, licenseKey: r.licenseKey,
            status: r.status, vendor: r.vendor,
            usageDate: r.usageDate, renewalDate: r.renewalDate, purchaseDate: r.purchaseDate,
          })),
        }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      setUploadResult(uploadRows.length);
      setUploadRows(null);
    } catch (e) {
      setUploadErr(String(e));
    } finally {
      setUploading(false);
    }
  };

  const toggleMismatch = (id: string) => setMismatched(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const lookup = async () => {
    if (!company || !dept.trim()) { setError("법인명과 부서를 입력해주세요."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/declaration?scope=team&company=${encodeURIComponent(company)}&department=${encodeURIComponent(dept.trim())}`);
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      setRecords(json.records);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SwRecord[]>();
    for (const r of records ?? []) {
      if (!map.has(r.user)) map.set(r.user, []);
      map.get(r.user)!.push(r);
    }
    return Array.from(map.entries());
  }, [records]);

  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">실사 완료!</h2>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-gray-700">{company} · {dept}</span> 부서의 SW 자산 현황 확인이 완료되었습니다
          </p>
          <p className="text-xs text-gray-400 mt-3">총 {records?.length ?? 0}건 확인</p>
          <button onClick={onBack}
            className="mt-5 text-xs text-amber-500 hover:text-amber-700 underline underline-offset-2">
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (records === null) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-extrabold">T</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">팀(부서) 확인</h2>
              <p className="text-xs text-gray-500 mt-0.5">법인명 + 부서로 등록된 팀 전체 SW를 조회합니다</p>
            </div>
          </div>

          <div className="space-y-4">
            <Sel label="법인명" required value={company} options={COMPANIES} onChange={setCompany} />
            <Inp label="부서" required value={dept} onChange={setDept} placeholder="예: 포털팀" />
          </div>

          {error && <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

          <button onClick={lookup} disabled={loading}
            className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors">
            {loading ? "조회 중…" : "SW 현황 조회 →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* 팀 배너 */}
      <div className="bg-amber-500 text-white rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <span className="text-sm font-extrabold">T</span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">{company} · {dept}</p>
          <p className="text-xs opacity-80">팀원 {grouped.length}명 · SW {records.length}개</p>
        </div>
        <button onClick={() => { setRecords(null); setConfirmed(false); setDownloaded(false); setMismatchMode(false); setMismatched(new Set()); setUploadRows(null); setUploadResult(null); }}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0">
          다시 조회
        </button>
      </div>

      {/* 팀 SW 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">팀 SW 현황 조회 결과</h3>
          <p className="text-xs text-gray-500 mt-0.5">전체 내용을 확인해주세요</p>
        </div>

        {records.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-400 text-sm">조회된 SW가 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {grouped.map(([user, items]) => (
              <div key={user} className="px-5 py-4">
                <p className="text-xs font-bold text-gray-400 mb-2">👤 {user}</p>
                <ul className="space-y-2">
                  {items.map(r => {
                    const cost = r.monthlyKrw > 0 ? `₩${r.monthlyKrw.toLocaleString("ko-KR")}` : (r.monthlyUsd > 0 ? `$${r.monthlyUsd}` : null);
                    const isMismatched = mismatched.has(r.id);
                    return (
                      <li key={r.id}
                        className={isMismatched ? "bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 -mx-2" : ""}>
                        <div className="flex items-start gap-2">
                          {mismatchMode && (
                            <input type="checkbox" checked={isMismatched} onChange={() => toggleMismatch(r.id)}
                              className="mt-1.5 accent-red-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <button type="button"
                              onClick={() => setExpandedId(id => id === r.id ? null : r.id)}
                              className="w-full flex items-center gap-2 flex-wrap text-sm text-left hover:opacity-70 transition-opacity">
                              <span className="font-semibold text-gray-800">{r.swCategory}</span>
                              {r.swDetail && <span className="text-xs text-gray-400">{r.swDetail}</span>}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {r.status}
                              </span>
                              {cost && <span className="text-xs text-amber-600 font-medium ml-auto">{cost}/월</span>}
                              <span className="text-[10px] text-gray-300">{expandedId === r.id ? "▲" : "▼"}</span>
                            </button>
                            {expandedId === r.id && (
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                {r.licenseType  && <span><span className="text-gray-400">라이선스</span> · {r.licenseType}</span>}
                                {r.accountType  && <span><span className="text-gray-400">계정유형</span> · {r.accountType}</span>}
                                {r.renewalCycle && <span><span className="text-gray-400">갱신주기</span> · {r.renewalCycle}</span>}
                                {r.renewalDate  && <span><span className="text-gray-400">갱신필요일</span> · {r.renewalDate}</span>}
                                {!r.licenseType && !r.accountType && !r.renewalCycle && !r.renewalDate && (
                                  <span className="text-gray-300">추가 정보가 없습니다</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 카드 1: 현황 확인 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">현황 확인</h4>
        <button onClick={() => setConfirmed(true)}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors">
          ✓ 모두 맞습니다 — 확인 완료
        </button>
        <button onClick={() => setMismatchMode(m => !m)}
          className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
          {mismatchMode ? "체크 종료" : "맞지 않는 내용이 있습니까?"}
        </button>
        {mismatchMode && (
          <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            위 목록에서 실제와 다른 항목을 체크해주세요{mismatched.size > 0 && ` (${mismatched.size}건 선택됨)`}.
            누락건에 대해서는 엑셀 등록 양식을 작성하여 자산관리파트로 공유해주시기 바랍니다.
          </div>
        )}
      </div>

      {/* 카드 2: 추가 등록 (엑셀) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">추가 등록</h4>
        <p className="text-xs text-gray-500">등록되지 않은 SW가 있다면 양식을 다운로드해 작성 후 업로드하세요.</p>
        <div className="flex gap-2">
          <button onClick={() => { downloadSwTemplate({ company, department: dept }); setDownloaded(true); }}
            className="flex-1 py-2.5 rounded-xl border border-amber-300 text-amber-600 text-sm font-semibold hover:bg-amber-50 transition-colors">
            ⬇️ 양식 다운로드
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }} />
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 py-2.5 rounded-xl border border-amber-300 text-amber-600 text-sm font-semibold hover:bg-amber-50 transition-colors">
            📤 파일 업로드
          </button>
        </div>
        {downloaded && (
          <p className="text-xs text-green-600">양식이 다운로드되었습니다.</p>
        )}
        {uploadErr && <div className="px-3 py-2 bg-red-50 rounded-lg text-xs text-red-600">{uploadErr}</div>}
        {uploadRows && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800">📄 {uploadFile} — {uploadRows.length}건</p>
            <ul className="text-xs text-amber-700 space-y-0.5 max-h-28 overflow-y-auto">
              {uploadRows.slice(0, 10).map((r, i) => (
                <li key={i}>{r.user} · {r.swCategory}{r.swDetail && ` (${r.swDetail})`}</li>
              ))}
              {uploadRows.length > 10 && <li className="text-amber-500">… 외 {uploadRows.length - 10}건</li>}
            </ul>
            <div className="flex gap-2">
              <button onClick={submitUpload} disabled={uploading}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {uploading ? "등록 중…" : `${uploadRows.length}건 일괄 등록`}
              </button>
              <button onClick={() => { setUploadRows(null); setUploadFile(""); }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs hover:bg-gray-50 transition-colors">
                취소
              </button>
            </div>
          </div>
        )}
        {uploadResult !== null && (
          <p className="text-xs text-green-600">✅ {uploadResult}건 등록 완료되었습니다.</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 스텝 인디케이터
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ["본인 확인", "SW 현황 확인", "완료"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            current > i + 1 ? "bg-green-500 text-white"
            : current === i + 1 ? "bg-amber-500 text-white"
            : "bg-gray-200 text-gray-400"
          }`}>
            {current > i + 1 ? "✓" : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:inline ${current === i + 1 ? "text-amber-600" : "text-gray-400"}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`w-10 h-px mx-1 ${current > i + 1 ? "bg-green-300" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 Export
// ─────────────────────────────────────────────────────────────────────────────
export default function DeclarationPanel() {
  const [mode,    setMode]     = useState<"personal" | "team" | null>(null);
  const [step,    setStep]     = useState(1);
  const [info,    setInfo]     = useState<UserInfo | null>(null);
  const [existing,setExisting] = useState<SwRecord[]>([]);
  const [final,   setFinal]    = useState<{ records: SwRecord[]; added: SwRecord[] } | null>(null);

  const reset = () => { setMode(null); setStep(1); setInfo(null); setExisting([]); setFinal(null); };

  return (
    <div>
      {/* 상단 인포 바 */}
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 mb-4">
        {mode !== null && (
          <button onClick={reset}
            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0 -ml-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-extrabold">SW</span>
        </div>
        <span className="font-bold text-amber-900 text-sm">SW 자산 실사</span>
        {mode !== null && (
          <span className="text-xs text-amber-500 ml-auto">{mode === "personal" ? "개인" : "팀(부서)"}</span>
        )}
      </div>

      {mode === null && <ModeSelect onSelect={setMode} />}

      {mode === "personal" && (
        <>
          <StepBar current={step} />

          {step === 1 && (
            <Step1 onNext={(userInfo, records) => {
              setInfo(userInfo); setExisting(records); setStep(2);
            }} />
          )}
          {step === 2 && info && (
            <Step2 userInfo={info} initialRecords={existing}
              onComplete={(records, added) => { setFinal({ records, added }); setStep(3); }}
            />
          )}
          {step === 3 && info && final && (
            <Step3 userInfo={info} records={final.records} added={final.added} onReset={reset} />
          )}
        </>
      )}

      {mode === "team" && <TeamFlow onBack={reset} />}
    </div>
  );
}

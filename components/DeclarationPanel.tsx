"use client";
import { useState } from "react";
import { safeJson } from "@/lib/fetch-json";

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
const BILLING_TYPES  = ["법인카드","개인지불 후 청구","쉐어드 청구","개인부담(회사청구없음)","기타"];
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

// 결재방식 설명 — "개인부담(회사청구없음)"은 회사에 비용 청구 없이
// IT 가시성 확보 목적으로만 등록되는 개인 구독 SW임을 안내
const BILLING_TYPE_TOOLTIP =
  "개인부담(회사청구없음): 본인이 직접 결제하고 회사에 비용을 청구하지 않는\n" +
  "개인 구독 SW입니다. 회사 비용 집계에서 제외되며, IT팀의 사내 SaaS 현황\n" +
  "파악을 위해서만 사용됩니다. (예: 개인 ChatGPT Plus, 개인 Notion 등)";

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────
interface UserInfo { company: string; department: string; name: string; }
/** 신고하는 SW 의 지금 상태 — 사용 중이거나, 더는 안 써서 반납할 것. */
type Usage = "사용중" | "반납예정";

interface NewSwForm {
  usage: Usage;
  swCategory: string; swDetail: string; licenseType: string;
  workType: string; billingType: string; billingCompany: string; accountType: string;
  renewalCycle: string; version: string[]; customVersion: string;
  monthlyKrw: number; monthlyUsd: number; licenseKey: string;
}
// 신고 목록에 담아 둔 항목 — [신고하기]를 누르면 한 번에 보낸다.
interface PendingSwRecord {
  usage: Usage;
  swCategory: string; swDetail: string; version: string[];
  licenseType: string; workType: string;
  billingType: string; accountType: string; renewalCycle: string;
  monthlyKrw: number; monthlyUsd: number; licenseKey: string;
}

const EMPTY_FORM: NewSwForm = {
  usage:"사용중",
  swCategory:"", swDetail:"", licenseType:"",
  workType:"", billingType:"", billingCompany:"", accountType:"",
  renewalCycle:"", version:[], customVersion:"",
  monthlyKrw:0, monthlyUsd:0, licenseKey:"",
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
// Step 1 — 본인 정보(조회 없음)
// ─────────────────────────────────────────────────────────────────────────────
// v2 전환 뒤 포털은 SW 자산을 읽을 수 없다(암호문) — 예전처럼 이름으로 등록된 SW 를 조회하지 않고,
// 신고하는 사람의 법인·부서·이름만 받는다. 관리자가 데스크탑 앱에서 SW 자산과 맞춘다.
function Step1({ onNext }: { onNext: (info: UserInfo) => void }) {
  const [company, setCompany] = useState("");
  const [dept,    setDept]    = useState("");
  const [name,    setName]    = useState("");
  const [error,   setError]   = useState("");

  const submit = () => {
    if (!company || !dept.trim() || !name.trim()) {
      setError("모든 항목을 입력해주세요."); return;
    }
    onNext({ company, department: dept.trim(), name: name.trim() });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-extrabold">SW</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">본인 정보</h2>
            <p className="text-xs text-gray-500 mt-0.5">신고하는 분의 법인·부서·이름을 적어주세요</p>
          </div>
        </div>

        <div className="space-y-3">
          <Sel label="법인명" required value={company} options={COMPANIES} onChange={setCompany} />
          <Inp label="부서"   required value={dept}    onChange={setDept}    placeholder="예: 포털팀" />
          <Inp label="이름"   required value={name}    onChange={setName}    placeholder="예: 홍길동" />
        </div>

        {error && <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

        <button onClick={submit}
          className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-base hover:bg-amber-600 transition-colors">
          다음 →
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

  // 부모(Step2)의 신고 목록에만 담아 둔다. 실제 신고는 [신고하기]를 누를 때 목록 전체를 한 번에 보낸다.
  const submit = () => {
    if (!form.swCategory || !form.licenseType || !form.workType || !form.billingType) {
      setError("SW대분류 · 라이선스유형 · 사용직군 · 결재방식은 필수입니다."); return;
    }
    if (form.billingType === "쉐어드 청구" && !form.billingCompany) {
      setError("쉐어드 청구 법인을 선택해주세요."); return;
    }
    setError("");
    onAdd({
      usage: form.usage,
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
        SW 신고 항목 추가
      </h3>

      <div className="space-y-5">

        {/* ── 0. 사용 상태 ────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">사용 상태 <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            {(["사용중", "반납예정"] as const).map(u => (
              <label key={u} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                form.usage === u ? "border-amber-400 bg-white font-semibold text-amber-800" : "border-gray-200 bg-white text-gray-600"
              }`}>
                <input type="radio" name="usage" value={u} checked={form.usage === u} onChange={() => set("usage", u)} />
                {u === "사용중" ? "사용 중" : "안 씀(반납)"}
              </label>
            ))}
          </div>
        </div>

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
              }}
              tooltip={BILLING_TYPE_TOOLTIP} />
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
// Step 2 — 신고 목록 만들기
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ userInfo, onComplete }: {
  userInfo: UserInfo;
  onComplete: (count: number) => void;
}) {
  const [pending,    setPending]    = useState<PendingSwRecord[]>([]);
  const [showForm,   setShowForm]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const submit = async () => {
    if (pending.length === 0) { setError("신고할 SW 를 하나 이상 추가해주세요."); return; }
    setSubmitting(true); setError("");
    try {
      const res  = await fetch("/api/declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporter: userInfo, records: pending }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      onComplete(json.count ?? pending.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 text-base">사용하는 SW 신고</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          <span className="font-semibold text-gray-700">{userInfo.name}</span>님이 쓰는(또는 더는 안 쓰는) SW 를 하나씩 추가한 뒤
          [신고하기]를 눌러주세요. 담당자가 확인해 자산에 반영합니다.
        </p>

        {pending.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 border border-gray-200 rounded-xl">
            {pending.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  r.usage === "사용중" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>{r.usage === "사용중" ? "사용 중" : "안 씀"}</span>
                <span className="flex-1 min-w-0 truncate text-gray-800">
                  {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}{r.version.length ? ` (${r.version.join(", ")})` : ""}
                </span>
                <button onClick={() => setPending(p => p.filter((_, j) => j !== i))}
                  className="text-xs text-gray-400 hover:text-red-500">빼기</button>
              </li>
            ))}
          </ul>
        )}

        {showForm ? (
          <AddSwForm userInfo={userInfo}
            onAdd={rec => { setPending(p => [...p, rec]); setShowForm(false); }}
            onCancel={() => setShowForm(false)} />
        ) : (
          <button onClick={() => setShowForm(true)}
            className="mt-3 w-full py-2 rounded-lg border border-dashed border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors">
            + SW 하나 더 추가
          </button>
        )}

        {error && <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

        <button onClick={submit} disabled={submitting || pending.length === 0}
          className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-base hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {submitting ? "신고 중…" : `신고하기 (${pending.length}건)`}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — 완료
// ─────────────────────────────────────────────────────────────────────────────
function Step3({ userInfo, count, onReset }: { userInfo: UserInfo; count: number; onReset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">신고 완료</h2>
        <p className="text-sm text-gray-500 mt-1">
          <span className="font-semibold text-gray-700">{userInfo.name}</span>님의 SW {count}건이 신고됐어요. 담당자가 확인해 반영합니다.
        </p>
        <button onClick={onReset}
          className="mt-5 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          처음으로
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 안내
// ─────────────────────────────────────────────────────────────────────────────
function ScopeExplainer() {
  return (
    <div className="max-w-2xl xl:max-w-3xl 2xl:max-w-4xl mx-auto mb-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 xl:p-6">
        <p className="text-sm font-bold text-gray-900 mb-3">이 실사는 어떤 부분을 확인하나요?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">✓</span>
            <div>
              <p className="font-semibold text-gray-700">PC에 설치된 SW는 자동 점검</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                하드웨어 사양과 PC에 설치된 프로그램 목록은 사내 점검 프로그램이 자동으로 수집해요. 따로 입력하실 필요 없습니다.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold">!</span>
            <div>
              <p className="font-semibold text-gray-700">구독형 SW(웹 서비스)는 본인 확인 필요</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                웹에서 로그인해서 쓰는 구독형 서비스는 PC에 설치되지 않아 점검 프로그램이 감지하지 못해요. 이 부분만 본인이 직접 확인해주시면 됩니다.
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
          지난 실사에서는 자가 진행 방식으로 참여율 86%를 달성했어요 — 본인 확인 한 번이면 대부분 끝납니다.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 단계 표시
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ["본인 정보", "SW 신고", "완료"];

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
// 메인 Export — 개인 신고 하나만(팀 신고·이력 조회는 없앴다, 10-29 결정)
// ─────────────────────────────────────────────────────────────────────────────
export default function DeclarationPanel() {
  const [step,  setStep]  = useState(1);
  const [info,  setInfo]  = useState<UserInfo | null>(null);
  const [count, setCount] = useState(0);

  const reset = () => { setStep(1); setInfo(null); setCount(0); };

  return (
    <div>
      {/* 상단 인포 바 */}
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-extrabold">SW</span>
        </div>
        <span className="font-bold text-amber-900 text-base">SW 자산 실사</span>
      </div>

      {step === 1 && <ScopeExplainer />}
      <StepBar current={step} />

      {step === 1 && <Step1 onNext={userInfo => { setInfo(userInfo); setStep(2); }} />}
      {step === 2 && info && <Step2 userInfo={info} onComplete={n => { setCount(n); setStep(3); }} />}
      {step === 3 && info && <Step3 userInfo={info} count={count} onReset={reset} />}
    </div>
  );
}

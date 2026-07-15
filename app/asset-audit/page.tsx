"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { AssetAuditConfig } from "@/lib/asset-audit-config";

const C = {
  brand:      "var(--brand)",
  brandSoft:  "var(--brand-soft)",
  text1:      "var(--portal-text)",
  text2:      "var(--portal-text-2)",
  text3:      "var(--portal-text-3)",
  text4:      "var(--portal-text-4)",
  border:     "var(--portal-border)",
  bg:         "var(--portal-bg)",
  bgPage:     "var(--portal-bg-page)",
  danger:       "var(--state-risk)",
  dangerSoft:   "var(--state-risk-soft)",
} as const;

// ── 타입 스케일 (임의 픽셀값 대신 고정된 단계만 사용 — 가독성을 위해 한 단계 상향) ──
const T = {
  h1: { fontSize: 30, fontWeight: 700 },
  h2: { fontSize: 20, fontWeight: 700 },
  h3: { fontSize: 16, fontWeight: 700 },
  body: { fontSize: 15, lineHeight: 1.7 },
  label: { fontSize: 14, fontWeight: 600 },
  caption: { fontSize: 13 },
} as const;

const balance = { textWrap: "balance" as const };
const pretty = { textWrap: "pretty" as const };

type OsKind = "windows" | "mac" | "unknown";

function detectOS(): OsKind {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "unknown";
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
}

// ── OS별 실행 방법 — 서명되지 않은 사내 프로그램이라 보안 경고가 뜨는 게
// 정상이라는 점과, 그걸 우회하는 정확한 방법을 안내한다. 캠페인과 무관하게
// 고정된 기술적 절차라 관리자 편집 항목이 아닌 코드에 고정한다.
const INSTALL_STEPS: Record<"windows" | "mac", string[]> = {
  windows: [
    "위 버튼을 누르면 새 탭에서 다운로드 페이지가 열립니다. 그 페이지에서 다운로드 버튼을 눌러 설치 파일(.exe)을 받습니다.",
    "다운로드한 파일을 더블클릭해서 실행합니다.",
    "\"Windows에서 PC를 보호했습니다\" 화면이 뜨면 \"추가 정보\"를 누른 뒤 \"실행\" 버튼을 눌러주세요.",
    "실행이 완료되면 자동으로 자산 정보가 수집되어 등록됩니다.",
  ],
  mac: [
    "위 버튼을 누르면 새 탭에서 다운로드 페이지가 열립니다. 그 페이지에서 다운로드 버튼을 눌러 설치 파일(.dmg)을 받습니다.",
    "다운로드한 파일을 더블클릭하면 설치 창이 열립니다.",
    "열린 창에서 앱 아이콘을 Applications 폴더로 드래그합니다.",
    "Applications 폴더에서 앱을 실행합니다. \"확인되지 않은 개발자\" 경고가 뜨면 아이콘을 우클릭한 뒤 \"열기\"를 선택해주세요.",
    "실행이 완료되면 자동으로 자산 정보가 수집되어 등록됩니다.",
  ],
};

// ── 자산실사를 진행하는 이유 — 캠페인과 무관하게 고정된 안내 문구 ──
const PURPOSE_ITEMS: { title: string; desc: string; icon: React.ReactNode }[] = [
  {
    title: "신속한 업무 지원",
    desc: "장애나 불편사항 접수 시, 자산 현황을 미리 파악하고 있으면 더 빠르고 정확하게 도와드릴 수 있습니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: "보안 관리 강화",
    desc: "회사 IT 자산의 위치와 사용 현황을 정확히 파악해 보안 사고를 예방하고, 발생 시에도 신속하게 조치합니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9.5 12l1.8 1.8L14.5 10" />
      </svg>
    ),
  },
  {
    title: "업무 환경 개선",
    desc: "실제 사용 현황을 파악해, 여러분이 더 나은 환경에서 일하실 수 있도록 개선점을 찾는 데 활용합니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 3.5a3 3 0 1 1 3 5.2L9 17.2l-4.5 1.3 1.3-4.5 8.7-8.7z" />
      </svg>
    ),
  },
  {
    title: "불필요한 지출 방지",
    desc: "실제 사용 중인 자산을 정확히 파악해 중복 구매나 불필요한 계약을 줄이고, 예산을 효율적으로 운영합니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "라이선스 사용 규정 준수",
    desc: "웹 구독형 SW는 제외하고 PC에 설치된 SW만 확인합니다. 제조사의 라이선스 위반 공문이 늘고 있어, 규정 위반 사용을 사전에 예방하기 위함입니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
];

export default function AssetAuditProgramPage() {
  const [cfg, setCfg]     = useState<AssetAuditConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consented, setConsented] = useState(false);
  const os = useMemo(detectOS, []);

  // 실사 페이지는 다크모드를 지원하지 않음 — 다른 포털 페이지에서 다크모드를
  // 켜둔 상태로 넘어와도 이 페이지에서는 항상 라이트 모드로 표시한다.
  useEffect(() => {
    document.documentElement.classList.remove("portal-dark");
  }, []);

  useEffect(() => {
    fetch("/api/asset-audit/config", { cache: "no-store" })
      .then(r => safeJson(r))
      .then(setCfg)
      .finally(() => setLoading(false));
  }, []);

  const steps = (cfg?.guide ?? "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  const noticeItems = (cfg?.dataCollectionNotice ?? "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  // 파일이 사내 클라우드(네이버웍스 드라이브 등) 공유 링크인 경우, 클릭 시 바로
  // 받아지지 않고 미리보기 페이지가 한 번 뜬 뒤 거기서 다시 다운로드해야 한다.
  // 버튼 문구를 그에 맞게 "다운로드 페이지로 이동"으로 표현한다.
  const primaryFile = os === "mac"
    ? { url: cfg?.macFileUrl, name: cfg?.macFileName, size: cfg?.macFileSize, label: "macOS용 다운로드 페이지로 이동" }
    : { url: cfg?.windowsFileUrl, name: cfg?.windowsFileName, size: cfg?.windowsFileSize, label: "Windows용 다운로드 페이지로 이동" };
  const otherFile = os === "mac"
    ? { url: cfg?.windowsFileUrl, label: "Windows용 다운로드 페이지로 이동" }
    : { url: cfg?.macFileUrl, label: "macOS용 다운로드 페이지로 이동" };

  const deadlineLabel = cfg?.deadline
    ? new Date(cfg.deadline).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
    : null;

  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>
      <header className="flex items-center justify-between px-4 sm:px-6 md:px-10 h-16 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="로고" className="shrink-0" style={{ height: 26, width: "auto", maxWidth: 160, objectFit: "contain" }} />
          <span className="hidden sm:inline truncate" style={{ ...T.label, color: C.text3 }}>자산 실사</span>
        </div>
      </header>

      <div className="px-4 sm:px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-2xl mx-auto">
          {/* ── 헤더 ── */}
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-[30px] sm:text-[38px] font-bold mb-3" style={{ ...balance, color: C.text1, letterSpacing: "-0.01em" }}>
              {loading ? " " : cfg?.title}
            </h1>
            <p className="max-w-xl mx-auto" style={{ ...T.body, ...pretty, fontSize: 16, color: C.text3 }}>
              {loading ? "" : cfg?.description}
            </p>
            {!loading && deadlineLabel && (
              <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ ...T.label, background: C.brandSoft, color: C.text2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                {deadlineLabel}까지 참여 부탁드립니다
              </span>
            )}
          </div>

          {!loading && !cfg?.open && (
            <div className="max-w-md mx-auto p-4 rounded-2xl text-center"
              style={{ ...T.body, fontWeight: 700, background: C.dangerSoft, color: C.danger, border: `1px solid ${C.border}` }}>
              현재 배포가 준비 중입니다. 잠시 후 다시 확인해 주세요.
            </div>
          )}

          {!loading && cfg?.open && (
            <div className="space-y-6">
              {/* ══ 참여 안내 및 동의 / 다운로드 — 실제로 해야 할 일을 최상단에 ══ */}
              <div>
                {!consented ? (
                  <div className="bg-white rounded-3xl p-7 md:p-9 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                    <h2 className="mb-4" style={{ ...T.h2, color: C.text1 }}>참여 안내 및 동의</h2>

                    {noticeItems.length > 0 && (
                      <div className="rounded-xl p-4 mb-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                        <p className="mb-2" style={{ ...T.label, color: C.text2 }}>수집되는 정보</p>
                        <ul className="space-y-1.5">
                          {noticeItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5" style={{ ...T.body, color: C.text2 }}>
                              <span className="shrink-0" style={{ color: C.brand }}>•</span>
                              <span style={pretty}>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {steps.length > 0 && (
                      <div className="mb-5">
                        <p className="mb-2" style={{ ...T.label, color: C.text2 }}>진행 절차</p>
                        <ol className="space-y-2">
                          {steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="shrink-0 w-6 h-6 rounded-full text-white flex items-center justify-center"
                                style={{ ...T.caption, fontWeight: 700, background: C.brand }}>{i + 1}</span>
                              <span className="pt-0.5" style={{ ...T.body, ...pretty, color: C.text2 }}>{step.replace(/^\d+[.)]\s*/, "")}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
                      <input type="checkbox" checked={consentChecked}
                        onChange={e => setConsentChecked(e.target.checked)}
                        className="mt-0.5 shrink-0 w-5 h-5 accent-current"
                        style={{ color: C.brand }} />
                      <span style={{ ...T.body, ...pretty, color: C.text2 }}>
                        위 수집 항목과 진행 절차를 확인했으며, 자산실사를 위한 정보 수집에 동의합니다.
                      </span>
                    </label>

                    <button
                      onClick={() => setConsented(true)}
                      disabled={!consentChecked}
                      className="w-full h-14 rounded-xl text-white flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40"
                      style={{ fontSize: 16, fontWeight: 700, background: C.brand }}
                    >
                      동의하고 계속하기
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-7 md:p-9 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                    <h2 className="mb-4" style={{ ...T.h2, color: C.text1 }}>프로그램 다운로드</h2>

                    {(cfg.version || cfg.updatedAt || primaryFile.size) && (
                      <div className="flex flex-wrap items-center gap-2 mb-5" style={{ ...T.label, fontWeight: 500, color: C.text3 }}>
                        {cfg.version && (
                          <span className="px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ fontWeight: 600, background: C.brandSoft, color: C.text2 }}>{cfg.version}</span>
                        )}
                        {primaryFile.size ? <span className="whitespace-nowrap">{formatBytes(primaryFile.size)}</span> : null}
                        {cfg.updatedAt && <span className="whitespace-nowrap">{new Date(cfg.updatedAt).toLocaleDateString("ko-KR")} 업데이트</span>}
                      </div>
                    )}

                    {os === "unknown" && (
                      <p className="text-center mb-3" style={{ ...T.label, fontWeight: 500, ...pretty, color: C.text3 }}>
                        운영체제를 자동으로 인식하지 못했습니다. 아래에서 사용 중인 OS를 선택해주세요.
                      </p>
                    )}

                    {primaryFile.url ? (
                      <a
                        href={primaryFile.url}
                        download={primaryFile.name ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full h-14 rounded-xl text-white flex items-center justify-center transition-opacity hover:opacity-90"
                        style={{ fontSize: 16, fontWeight: 700, background: C.brand, textDecoration: "none" }}
                      >
                        {primaryFile.label}
                      </a>
                    ) : (
                      <div className="w-full h-14 rounded-xl flex items-center justify-center"
                        style={{ fontSize: 16, fontWeight: 700, background: C.bg, color: C.text3 }}>
                        아직 업로드된 파일이 없습니다
                      </div>
                    )}

                    {otherFile.url && (
                      <a href={otherFile.url} download target="_blank" rel="noreferrer"
                        className="block text-center mt-3 hover:underline"
                        style={{ ...T.label, fontWeight: 500, color: C.text3, textDecoration: "none" }}>
                        {otherFile.label}
                      </a>
                    )}

                    <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
                      <p className="mb-3" style={{ ...T.label, color: C.text2 }}>다운로드 후 실행 방법</p>
                      <ol className="space-y-2 mb-4">
                        {(os === "mac" ? INSTALL_STEPS.mac : INSTALL_STEPS.windows).map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="shrink-0 w-6 h-6 rounded-full text-white flex items-center justify-center"
                              style={{ ...T.caption, fontWeight: 700, background: C.brand }}>{i + 1}</span>
                            <span className="pt-0.5" style={{ ...T.body, ...pretty, color: C.text2 }}>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="rounded-xl p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                        <p style={{ ...T.body, ...pretty, color: C.text3 }}>
                          보안 경고 화면이 뜨는 건 정상입니다 — 사내에서 자체 제작한 프로그램이라 별도 인증서가 없어 나타나는 안내이며, 위 방법대로 진행하시면 안전하게 실행됩니다.
                        </p>
                      </div>
                    </div>

                    <p className="text-center mt-4" style={{ ...T.caption, ...pretty, color: C.text3 }}>
                      문의사항은 자산관리파트로 연락 주세요.
                    </p>
                  </div>
                )}
              </div>

              {/* ══ 왜 자산실사를 진행하나요 + 양해 말씀 — 참고용 설명은 행동 카드 다음에 ══ */}
              <div className="space-y-5">
                <div className="bg-white rounded-3xl p-7 md:p-9 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                  <h2 className="mb-1" style={{ ...T.h2, color: C.text1 }}>왜 자산실사를 진행하나요?</h2>
                  <p className="mb-5" style={{ ...T.label, fontWeight: 500, color: C.text3 }}>이번 실사가 만들어내는 실질적인 운영상의 이점입니다.</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {PURPOSE_ITEMS.map(item => (
                      <div key={item.title} className="flex gap-3">
                        <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: C.brandSoft, color: C.brand }}>
                          {item.icon}
                        </div>
                        <div>
                          <p className="mb-0.5" style={{ ...T.h3, ...balance, color: C.text2 }}>{item.title}</p>
                          <p style={{ ...T.body, ...pretty, color: C.text3 }}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-5 md:p-6" style={{ background: C.brandSoft, border: `1px solid ${C.border}` }}>
                  <p style={{ ...T.body, ...pretty, color: C.text2 }}>
                    바쁘신 업무 중에도 잠시 시간을 내어 협조해 주셔서 진심으로 감사드립니다.
                    이번 실사는 여러분의 업무에 최대한 부담을 드리지 않도록, 프로그램 실행만으로 간단히 완료되게 준비했습니다.
                    위 목적을 위해 꼭 필요한 절차이니 너그러운 양해와 협조를 부탁드립니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

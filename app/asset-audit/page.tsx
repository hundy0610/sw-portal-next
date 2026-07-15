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
  caution:      "var(--state-caution)",
  cautionSoft:  "var(--state-caution-soft)",
  danger:       "var(--state-risk)",
  dangerSoft:   "var(--state-risk-soft)",
} as const;

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

// ── 자산실사를 진행하는 이유 — 캠페인과 무관하게 고정된 안내 문구 ──
const PURPOSE_ITEMS: { title: string; desc: string; icon: React.ReactNode }[] = [
  {
    title: "신속한 업무 지원",
    desc: "장애나 불편사항 접수 시, 자산 현황을 미리 파악하고 있으면 더 빠르고 정확하게 도와드릴 수 있습니다.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: "보안 관리 강화",
    desc: "회사 IT 자산의 위치와 사용 현황을 정확히 파악해 보안 사고를 예방하고, 발생 시에도 신속하게 조치합니다.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9.5 12l1.8 1.8L14.5 10" />
      </svg>
    ),
  },
  {
    title: "업무 환경 개선",
    desc: "실제 사용 현황을 파악해, 여러분이 더 나은 환경에서 일하실 수 있도록 개선점을 찾는 데 활용합니다.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 3.5a3 3 0 1 1 3 5.2L9 17.2l-4.5 1.3 1.3-4.5 8.7-8.7z" />
      </svg>
    ),
  },
  {
    title: "불필요한 지출 방지",
    desc: "실제 사용 중인 자산을 정확히 파악해 중복 구매나 불필요한 계약을 줄이고, 예산을 효율적으로 운영합니다.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
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

  const primaryFile = os === "mac"
    ? { url: cfg?.macFileUrl, name: cfg?.macFileName, size: cfg?.macFileSize, label: "macOS용 다운로드" }
    : { url: cfg?.windowsFileUrl, name: cfg?.windowsFileName, size: cfg?.windowsFileSize, label: "Windows용 다운로드" };
  const otherFile = os === "mac"
    ? { url: cfg?.windowsFileUrl, label: "Windows용 다운로드" }
    : { url: cfg?.macFileUrl, label: "macOS용 다운로드" };

  const deadlineLabel = cfg?.deadline
    ? new Date(cfg.deadline).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
    : null;

  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>
      <header className="flex items-center justify-between px-4 sm:px-6 md:px-10 h-16 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="로고" className="shrink-0" style={{ height: 26, width: "auto", maxWidth: 160, objectFit: "contain" }} />
          <span className="hidden sm:inline text-sm font-semibold truncate" style={{ color: C.text3 }}>자산 실사</span>
        </div>
      </header>

      <div className="px-4 sm:px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          {/* ── 헤더 ── */}
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-[28px] sm:text-[34px] font-bold mb-2.5" style={{ color: C.text1, letterSpacing: "-0.01em" }}>
              {loading ? " " : cfg?.title}
            </h1>
            <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: C.text3 }}>
              {loading ? "" : cfg?.description}
            </p>
            {!loading && deadlineLabel && (
              <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-[13px] font-semibold"
                style={{ background: C.cautionSoft, color: C.caution }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                {deadlineLabel}까지 참여 부탁드립니다
              </span>
            )}
          </div>

          {!loading && !cfg?.open && (
            <div className="max-w-md mx-auto p-4 rounded-2xl text-center font-bold text-[15px]"
              style={{ background: C.dangerSoft, color: C.danger, border: `1px solid ${C.border}` }}>
              현재 배포가 준비 중입니다. 잠시 후 다시 확인해 주세요.
            </div>
          )}

          {!loading && cfg?.open && (
            <div className="grid md:grid-cols-[1.05fr_1fr] gap-6 md:gap-8 items-start">
              {/* ══ 왼쪽: 목적/취지 + 양해 말씀 ══ */}
              <div className="space-y-5">
                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                  <h2 className="text-[17px] font-bold mb-1" style={{ color: C.text1 }}>왜 자산실사를 진행하나요?</h2>
                  <p className="text-[13px] mb-5" style={{ color: C.text4 }}>이번 실사가 만들어내는 실질적인 운영상의 이점입니다.</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {PURPOSE_ITEMS.map(item => (
                      <div key={item.title} className="flex gap-3">
                        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: C.brandSoft, color: C.brand }}>
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-[15px] font-bold mb-0.5" style={{ color: C.text2 }}>{item.title}</p>
                          <p className="text-[13.5px] leading-relaxed" style={{ color: C.text3 }}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-5 md:p-6" style={{ background: C.brandSoft, border: `1px solid ${C.border}` }}>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: C.text2 }}>
                    바쁘신 업무 중에도 잠시 시간을 내어 협조해 주셔서 진심으로 감사드립니다.
                    이번 실사는 여러분의 업무에 최대한 부담을 드리지 않도록, 프로그램 실행만으로 간단히 완료되게 준비했습니다.
                    위 목적을 위해 꼭 필요한 절차이니 너그러운 양해와 협조를 부탁드립니다.
                  </p>
                </div>
              </div>

              {/* ══ 오른쪽: 데이터 고지 + 절차 + 동의 / 다운로드 ══ */}
              <div className="md:sticky md:top-10">
                {!consented ? (
                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                    <h2 className="text-[16px] font-bold mb-4" style={{ color: C.text1 }}>참여 안내 및 동의</h2>

                    {noticeItems.length > 0 && (
                      <div className="rounded-xl p-4 mb-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                        <p className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>수집되는 정보</p>
                        <ul className="space-y-1.5">
                          {noticeItems.map((item, i) => (
                            <li key={i} className="text-[13.5px] flex items-start gap-1.5" style={{ color: C.text2 }}>
                              <span className="shrink-0" style={{ color: C.brand }}>•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {steps.length > 0 && (
                      <div className="mb-5">
                        <p className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>진행 절차</p>
                        <ol className="space-y-2">
                          {steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="shrink-0 w-5 h-5 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                                style={{ background: C.brand }}>{i + 1}</span>
                              <span className="text-[13.5px] pt-0.5" style={{ color: C.text2 }}>{step.replace(/^\d+[.)]\s*/, "")}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
                      <input type="checkbox" checked={consentChecked}
                        onChange={e => setConsentChecked(e.target.checked)}
                        className="mt-0.5 shrink-0" />
                      <span className="text-[13.5px]" style={{ color: C.text2 }}>
                        위 수집 항목과 진행 절차를 확인했으며, 자산실사를 위한 정보 수집에 동의합니다.
                      </span>
                    </label>

                    <button
                      onClick={() => setConsented(true)}
                      disabled={!consentChecked}
                      className="w-full h-12 rounded-xl font-bold text-[15px] text-white flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40"
                      style={{ background: C.brand }}
                    >
                      동의하고 계속하기
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                    <h2 className="text-[16px] font-bold mb-4" style={{ color: C.text1 }}>프로그램 다운로드</h2>

                    {(cfg.version || cfg.updatedAt || primaryFile.size) && (
                      <div className="flex flex-wrap items-center gap-2 mb-5 text-[13px]" style={{ color: C.text4 }}>
                        {cfg.version && (
                          <span className="px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: C.brandSoft, color: C.text2 }}>{cfg.version}</span>
                        )}
                        {primaryFile.size ? <span>{formatBytes(primaryFile.size)}</span> : null}
                        {cfg.updatedAt && <span>{new Date(cfg.updatedAt).toLocaleDateString("ko-KR")} 업데이트</span>}
                      </div>
                    )}

                    {os === "unknown" && (
                      <p className="text-[13px] text-center mb-3" style={{ color: C.text4 }}>
                        운영체제를 자동으로 인식하지 못했습니다. 아래에서 사용 중인 OS를 선택해주세요.
                      </p>
                    )}

                    {primaryFile.url ? (
                      <a
                        href={primaryFile.url}
                        download={primaryFile.name ?? undefined}
                        className="w-full h-12 rounded-xl font-bold text-[15px] text-white flex items-center justify-center transition-opacity hover:opacity-90"
                        style={{ background: C.brand, textDecoration: "none" }}
                      >
                        {primaryFile.label}
                      </a>
                    ) : (
                      <div className="w-full h-12 rounded-xl font-bold text-[15px] flex items-center justify-center"
                        style={{ background: C.bg, color: C.text4 }}>
                        아직 업로드된 파일이 없습니다
                      </div>
                    )}

                    {otherFile.url && (
                      <a href={otherFile.url} download
                        className="block text-center text-[13px] mt-3 hover:underline"
                        style={{ color: C.text4, textDecoration: "none" }}>
                        {otherFile.label}
                      </a>
                    )}

                    <p className="text-[12.5px] text-center mt-4 leading-relaxed" style={{ color: C.text4 }}>
                      실행 후 별도 입력 없이 자동으로 자산 정보가 등록됩니다. 문의사항은 자산관리파트로 연락 주세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

const codeStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 12.5,
  background: C.bg,
  padding: "2px 6px",
  borderRadius: 4,
  wordBreak: "break-all" as const,
};

// ── OS별 실행 방법 — 서명되지 않은 사내 프로그램이라 보안 경고가 뜨는 게
// 정상이라는 점과, 그걸 우회하는 정확한 방법, 그리고 실행 후 실제 등록까지
// 마치는 절차를 안내한다. OS마다 절차가 달라 캠페인과 무관하게 고정된
// 기술적 안내이므로 관리자 편집 항목이 아닌 코드에 고정한다.
const INSTALL_STEPS: Record<"windows" | "mac", React.ReactNode[]> = {
  windows: [
    <>
      프로그램 실행에는 <strong>.NET 8 Desktop Runtime</strong>이 필요합니다. 아직 설치하지 않았다면{" "}
      <a href="https://dotnet.microsoft.com/download/dotnet/8.0/runtime" target="_blank" rel="noreferrer" className="underline" style={{ color: C.brand }}>
        이 링크
      </a>
      에서 "Desktop Runtime"을 받아 설치해주세요 (이미 설치되어 있다면 건너뛰어도 됩니다).
    </>,
    "위 버튼을 누르면 새 탭에서 다운로드 페이지가 열립니다. 그 페이지에서 다운로드 버튼을 눌러 설치 파일(.exe)을 받습니다.",
    "다운로드한 파일을 더블클릭해서 실행합니다.",
    "\"Windows에서 PC를 보호했습니다\" 화면이 뜨면 \"추가 정보\"를 누른 뒤 \"실행\" 버튼을 눌러주세요.",
    "프로그램 좌측의 \"자산실사\" 탭으로 들어가 등록 정보를 입력한 후, 하단의 \"자산실사\" 버튼을 클릭해주세요.",
  ],
  mac: [
    "위 버튼을 누르면 새 탭에서 다운로드 페이지가 열립니다. 그 페이지에서 다운로드 버튼을 눌러 설치 파일(.dmg)을 받습니다.",
    "다운로드한 파일을 더블클릭하면 설치 창이 열립니다.",
    "열린 창에서 앱 아이콘을 Applications 폴더로 드래그합니다.",
    <>
      Applications에서 처음 실행하면 "확인되지 않은 개발자" 경고가 뜰 수 있습니다. 아이콘 우클릭(또는 Control+클릭) 후 "열기"를 선택하면 실행됩니다.
      그래도 안 열리면 터미널에서 아래 명령어를 입력한 뒤 다시 실행해주세요:{" "}
      <span style={codeStyle}>xattr -dr com.apple.quarantine "/Applications/대웅그룹 MAC OS 전용 자산실사 프로그램.app"</span>
    </>,
    "등록 정보를 입력한 후, 하단의 \"자산실사\" 버튼을 클릭해주세요.",
  ],
};

// ── 자산실사 목적 — 캠페인과 무관하게 고정된 공지성 안내 문구.
// 회사 공지문에서 흔히 쓰는 "항목 | 설명" 형식으로, 취지를 짧고 명확하게 전달한다.
const PURPOSE_LINES: { label: string; desc: string }[] = [
  { label: "신속한 지원", desc: "장애 발생 시 자산 현황을 미리 파악해 더 빠르고 정확하게 지원합니다." },
  { label: "보안 관리", desc: "IT 자산의 위치와 사용 현황을 파악해 보안 사고를 예방합니다." },
  { label: "라이선스 준수", desc: "PC에 설치된 SW만 확인하며(웹 구독형 제외), 규정 위반 사용을 사전에 예방합니다." },
  { label: "지출 절감", desc: "중복 구매 등 불필요한 지출을 줄여 예산을 효율적으로 운영합니다." },
];

export default function AssetAuditProgramPage() {
  const [cfg, setCfg]     = useState<AssetAuditConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showInstallSteps, setShowInstallSteps] = useState(false);
  // 자동 감지된 OS를 기본값으로 쓰되, 사용자가 직접 선택해서 바꿀 수 있게 한다
  // (자동 감지가 틀리거나, 동료 PC를 대신 설정해주는 경우 등).
  const detectedOs = useMemo(detectOS, []);
  const [os, setOs] = useState<OsKind>("unknown");
  useEffect(() => { setOs(detectedOs); }, [detectedOs]);

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
        </div>
      </header>

      <div className="px-4 sm:px-6 md:px-10 py-8 md:py-12">
        <div className="max-w-2xl mx-auto rounded-2xl bg-white p-6 sm:p-10 md:p-12 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          {/* ── 제목: 공문 톤의 굵은 밑줄 구분선 ── */}
          <div className="text-center pb-5 mb-6" style={{ borderBottom: `2px solid ${C.text1}` }}>
            <h1 className="text-[22px] sm:text-[26px] font-bold" style={{ ...balance, color: C.text1, letterSpacing: "-0.01em" }}>
              {loading ? " " : cfg?.title}
            </h1>
          </div>

          {!loading && !cfg?.open && (
            <div className="text-center p-5 rounded-xl"
              style={{ ...T.body, fontWeight: 700, background: C.dangerSoft, color: C.danger }}>
              현재 배포가 준비 중입니다. 잠시 후 다시 확인해 주세요.
            </div>
          )}

          {!loading && cfg?.open && (
            <>
              {/* ── 안내 인사말 ── */}
              <p className="mb-4" style={{ ...T.body, ...pretty, color: C.text2 }}>
                {cfg?.description}
              </p>
              {deadlineLabel && (
                <p className="mb-4" style={{ ...T.body, color: C.text2 }}>
                  참여 기한 : <strong style={{ color: C.text1 }}>{deadlineLabel}까지</strong>
                </p>
              )}

              {/* ── 자산실사 목적 — 참여 동의 섹션과 동일한 폰트/색상/크기로 통일 ── */}
              <ul className="mb-6 space-y-2">
                {PURPOSE_LINES.map(line => (
                  <li key={line.label} style={{ ...T.body, ...pretty, color: C.text2 }}>
                    {line.label} · {line.desc}
                  </li>
                ))}
              </ul>

              {/* ── 참여 동의 ── */}
              <h2 className="mb-4 pb-2.5" style={{ ...T.h3, color: C.text1, borderBottom: `1px solid ${C.border}` }}>
                참여 동의
              </h2>

              {noticeItems.length > 0 && (
                <div className="rounded-lg p-4 mb-4" style={{ background: C.bg, borderLeft: `3px solid ${C.brand}` }}>
                  <p className="mb-1.5" style={{ ...T.label, color: C.text1 }}>수집되는 정보</p>
                  <ul className="space-y-1">
                    {noticeItems.map((item, i) => (
                      <li key={i} style={{ ...T.body, ...pretty, color: C.text2 }}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {steps.length > 0 && (
                <ol className="mb-5 pl-5 space-y-1.5" style={{ listStyleType: "decimal" }}>
                  {steps.map((step, i) => (
                    <li key={i} style={{ ...T.body, ...pretty, color: C.text2 }}>
                      {step.replace(/^\d+[.)]\s*/, "")}
                    </li>
                  ))}
                </ol>
              )}

              <label className="flex items-start gap-2.5 mb-8 cursor-pointer">
                <input type="checkbox" checked={consentChecked}
                  onChange={e => setConsentChecked(e.target.checked)}
                  className="mt-0.5 shrink-0 w-5 h-5 accent-current"
                  style={{ color: C.brand }} />
                <span style={{ ...T.body, ...pretty, color: C.text2 }}>
                  위 수집 항목과 진행 절차를 확인했으며, 자산실사를 위한 정보 수집에 동의합니다.
                </span>
              </label>

              {/* ── 다운로드 ── */}
              <h2 className="mb-4 pb-2.5" style={{ ...T.h3, color: C.text1, borderBottom: `1px solid ${C.border}` }}>
                다운로드
              </h2>

              {(cfg.version || primaryFile.size) && (
                <div className="flex flex-wrap items-center gap-2 mb-4" style={{ ...T.label, fontWeight: 500, color: C.text3 }}>
                  {cfg.version && (
                    <span className="px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ fontWeight: 600, background: C.brandSoft, color: C.text2 }}>{cfg.version}</span>
                  )}
                  {primaryFile.size ? <span className="whitespace-nowrap">{formatBytes(primaryFile.size)}</span> : null}
                </div>
              )}

              <div className="mb-4">
                <p className="mb-2" style={{ ...T.caption, color: C.text3 }}>
                  {os === "unknown" ? "운영체제를 자동으로 인식하지 못했습니다 — 사용 중인 PC를 선택해주세요." : "다운로드할 운영체제를 선택하세요."}
                </p>
                <div className="flex gap-2">
                  {(["windows", "mac"] as const).map(kind => (
                    <button
                      key={kind}
                      onClick={() => setOs(kind)}
                      className="flex-1 h-10 rounded-lg transition-colors"
                      style={{
                        fontSize: 14, fontWeight: 700,
                        background: os === kind ? C.brand : C.bg,
                        color: os === kind ? "#fff" : C.text3,
                        border: `1px solid ${os === kind ? C.brand : C.border}`,
                      }}
                    >
                      {kind === "windows" ? "Windows" : "macOS"}
                    </button>
                  ))}
                </div>
              </div>

              {primaryFile.url ? (
                consentChecked ? (
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
                  <div className="w-full h-14 rounded-xl flex items-center justify-center cursor-not-allowed"
                    style={{ fontSize: 16, fontWeight: 700, background: C.bg, color: C.text4 }}>
                    {primaryFile.label}
                  </div>
                )
              ) : (
                <div className="w-full h-14 rounded-xl flex items-center justify-center"
                  style={{ fontSize: 16, fontWeight: 700, background: C.bg, color: C.text3 }}>
                  아직 업로드된 파일이 없습니다
                </div>
              )}
              {!consentChecked && (
                <p className="text-center mt-2" style={{ ...T.caption, color: C.text3 }}>
                  위 내용에 동의해야 다운로드할 수 있습니다.
                </p>
              )}

              {otherFile.url && consentChecked && (
                <a href={otherFile.url} download target="_blank" rel="noreferrer"
                  className="block text-center mt-3 hover:underline"
                  style={{ ...T.label, fontWeight: 500, color: C.text3, textDecoration: "none" }}>
                  {otherFile.label}
                </a>
              )}

              {/* ── 실행 방법 (기본 접힘 — 필요할 때만 펼쳐서 화면을 간결하게 유지) ── */}
              <button
                onClick={() => setShowInstallSteps(v => !v)}
                className="flex items-center gap-1.5 mt-5"
                style={{ ...T.label, color: C.text3 }}
              >
                다운로드 후 실행 방법 {showInstallSteps ? "숨기기" : "보기"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: showInstallSteps ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showInstallSteps && (
                <div className="mt-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <ol className="pl-5 mb-4 space-y-1.5" style={{ listStyleType: "decimal" }}>
                    {(os === "mac" ? INSTALL_STEPS.mac : INSTALL_STEPS.windows).map((step, i) => (
                      <li key={i} style={{ ...T.body, ...pretty, color: C.text2 }}>{step}</li>
                    ))}
                  </ol>
                  <div className="rounded-lg p-4" style={{ background: C.bg, borderLeft: `3px solid ${C.brand}` }}>
                    <p style={{ ...T.body, ...pretty, color: C.text3 }}>
                      보안 경고 화면이 뜨는 건 정상입니다 — 사내에서 자체 제작한 프로그램이라 별도 인증서가 없어 나타나는 안내이며, 위 방법대로 진행하시면 안전하게 실행됩니다.
                      일부 백신 프로그램이 오탐으로 차단할 수도 있는데, 안전한 파일이니 예외 처리 후 진행해주세요.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 하단 각주 — 공문 하단 서명란처럼 옅은 구분선으로 분리 ── */}
        {!loading && cfg?.open && (
          <div className="max-w-2xl mx-auto text-center mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <p style={{ ...T.caption, ...pretty, color: C.text3 }}>
              바쁘신 중에 시간 내어 협조해 주셔서 감사드리며, 업무에 부담 없도록 간단히{" "}준비했습니다.
            </p>
            <p className="mt-1" style={{ ...T.caption, color: C.text4 }}>
              문의사항은 자산관리파트로 연락 주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

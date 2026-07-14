"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { AssetAuditConfig } from "@/lib/asset-audit-config";

const C = {
  brand:   "#2563eb",
  primary: "#3b82f6",
  soft:    "#eff6ff",
  border:  "#bfdbfe",
  text1:   "#1e3a8a",
  text2:   "#1e40af",
  text3:   "#4b5563",
  text4:   "#9ca3af",
  bgPage:  "#f8fafc",
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

export default function AssetAuditProgramPage() {
  const [cfg, setCfg]     = useState<AssetAuditConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consented, setConsented] = useState(false);
  const os = useMemo(detectOS, []);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: C.bgPage }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: C.text1 }}>
            {loading ? "" : cfg?.title}
          </h1>
          <p className="text-sm" style={{ color: C.text3 }}>
            {loading ? "" : cfg?.description}
          </p>
        </div>

        {!loading && !cfg?.open && (
          <div className="p-4 rounded-2xl text-center font-bold"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            현재 배포가 준비 중입니다. 잠시 후 다시 확인해 주세요.
          </div>
        )}

        {/* ── 협조문 + 동의 단계 ── */}
        {!loading && cfg?.open && !consented && (
          <div className="bg-white rounded-3xl p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <h2 className="text-sm font-bold mb-2" style={{ color: C.text1 }}>자산실사 협조 안내</h2>
            <p className="text-xs leading-relaxed mb-4" style={{ color: C.text3 }}>
              전사 SW/HW 자산 현황 파악 및 라이선스 컴플라이언스 확보를 위해 자산실사 프로그램을 배포합니다.
              프로그램 설치 시 아래 정보가 수집되어 IT팀 서버(Notion)로 전송됩니다.
            </p>

            {noticeItems.length > 0 && (
              <div className="rounded-xl p-4 mb-4" style={{ background: C.soft, border: `1px solid ${C.border}` }}>
                <p className="text-xs font-semibold mb-2" style={{ color: C.text2 }}>수집되는 정보</p>
                <ul className="space-y-1.5">
                  {noticeItems.map((item, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: C.text2 }}>
                      <span className="shrink-0" style={{ color: C.brand }}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {steps.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2" style={{ color: C.text2 }}>진행 절차</p>
                <ol className="space-y-2">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                        style={{ background: C.brand }}>{i + 1}</span>
                      <span className="text-xs pt-0.5" style={{ color: C.text2 }}>{step.replace(/^\d+[.)]\s*/, "")}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
              <input type="checkbox" checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 shrink-0" />
              <span className="text-xs" style={{ color: C.text2 }}>
                위 수집 항목과 진행 절차를 확인했으며, 자산실사를 위한 정보 수집에 동의합니다.
              </span>
            </label>

            <button
              onClick={() => setConsented(true)}
              disabled={!consentChecked}
              className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: C.brand }}
            >
              동의하고 계속하기
            </button>
          </div>
        )}

        {/* ── 다운로드 단계 ── */}
        {!loading && cfg?.open && consented && (
          <div className="bg-white rounded-3xl p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            {(cfg.version || cfg.updatedAt || primaryFile.size) && (
              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs" style={{ color: C.text4 }}>
                {cfg.version && (
                  <span className="px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: C.soft, color: C.text2 }}>{cfg.version}</span>
                )}
                {primaryFile.size ? <span>{formatBytes(primaryFile.size)}</span> : null}
                {cfg.updatedAt && <span>{new Date(cfg.updatedAt).toLocaleDateString("ko-KR")} 업데이트</span>}
              </div>
            )}

            {os === "unknown" && (
              <p className="text-xs text-center mb-3" style={{ color: C.text4 }}>
                운영체제를 자동으로 인식하지 못했습니다. 아래에서 사용 중인 OS를 선택해주세요.
              </p>
            )}

            {primaryFile.url ? (
              <a
                href={primaryFile.url}
                download={primaryFile.name ?? undefined}
                className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center transition-opacity hover:opacity-90"
                style={{ background: C.brand, textDecoration: "none" }}
              >
                {primaryFile.label}
              </a>
            ) : (
              <div className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center"
                style={{ background: "#f3f4f6", color: C.text4 }}>
                아직 업로드된 파일이 없습니다
              </div>
            )}

            {otherFile.url && (
              <a href={otherFile.url} download
                className="block text-center text-xs mt-3 hover:underline"
                style={{ color: C.text4, textDecoration: "none" }}>
                {otherFile.label}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

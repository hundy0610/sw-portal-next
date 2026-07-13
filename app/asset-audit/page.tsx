"use client";

import { useEffect, useState } from "react";
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

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
}

export default function AssetAuditProgramPage() {
  const [cfg, setCfg]     = useState<AssetAuditConfig | null>(null);
  const [loading, setLoading] = useState(true);

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

        {!loading && cfg?.open && (
          <div className="bg-white rounded-3xl p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            {(cfg.version || cfg.updatedAt || cfg.fileSize) && (
              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs" style={{ color: C.text4 }}>
                {cfg.version && (
                  <span className="px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: C.soft, color: C.text2 }}>{cfg.version}</span>
                )}
                {cfg.fileSize ? <span>{formatBytes(cfg.fileSize)}</span> : null}
                {cfg.updatedAt && <span>{new Date(cfg.updatedAt).toLocaleDateString("ko-KR")} 업데이트</span>}
              </div>
            )}

            {steps.length > 0 && (
              <ol className="mb-6 space-y-3">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                      style={{ background: C.brand }}>{i + 1}</span>
                    <span className="text-sm pt-0.5" style={{ color: C.text2 }}>{step.replace(/^\d+[.)]\s*/, "")}</span>
                  </li>
                ))}
              </ol>
            )}

            {cfg.fileUrl ? (
              <a
                href={cfg.fileUrl}
                download={cfg.fileName ?? undefined}
                className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center transition-opacity hover:opacity-90"
                style={{ background: C.brand, textDecoration: "none" }}
              >
                프로그램 다운로드
              </a>
            ) : (
              <div className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center"
                style={{ background: "#f3f4f6", color: C.text4 }}>
                아직 업로드된 파일이 없습니다
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

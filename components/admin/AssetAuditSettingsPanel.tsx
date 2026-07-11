"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { safeJson } from "@/lib/fetch-json";
import type { AssetAuditConfig } from "@/lib/asset-audit-config";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
}

export default function AssetAuditSettingsPanel() {
  const [cfg, setCfg]         = useState<AssetAuditConfig | null>(null);
  const [draft, setDraft]     = useState({ title: "", description: "", guide: "", version: "" });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/asset-audit/config")
      .then(r => safeJson(r))
      .then((data: AssetAuditConfig) => {
        setCfg(data);
        setDraft({ title: data.title, description: data.description, guide: data.guide, version: data.version });
      });
  }, []);

  async function saveDraft() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/asset-audit/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await safeJson(res);
      if (json?.config) {
        setCfg(json.config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleOpen() {
    if (!cfg) return;
    setToggling(true);
    try {
      const res = await fetch("/api/asset-audit/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: !cfg.open }),
      });
      const json = await safeJson(res);
      if (json?.config) setCfg(json.config);
    } finally {
      setToggling(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    setUploadError("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/asset-audit/upload",
        onUploadProgress: ({ percentage }) => setUploadPct(percentage),
      });
      const res = await fetch("/api/asset-audit/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: blob.url,
          fileName: file.name,
          fileSize: file.size,
          updatedAt: new Date().toISOString(),
        }),
      });
      const json = await safeJson(res);
      if (json?.config) setCfg(json.config);
    } catch {
      setUploadError("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!cfg) return null;

  return (
    <div className="mb-4 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900">🚀 자산실사 프로그램 배포 관리</span>
          <span
            className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
            style={{
              background: cfg.open ? "#dcfce7" : "#f3f4f6",
              color:      cfg.open ? "#166534" : "#6b7280",
            }}
          >
            {cfg.open ? "공개중" : "비공개"}
          </span>
        </div>
        <span className="text-xs text-gray-400">{expanded ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
            <div className="text-xs text-gray-500">
              공개 페이지: <a href="/asset-audit" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">/asset-audit</a>
            </div>
            <button
              onClick={toggleOpen}
              disabled={toggling}
              className="px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
              style={{
                background: cfg.open ? "#fee2e2" : "#16a34a",
                color:      cfg.open ? "#991b1b" : "#fff",
              }}
            >
              {cfg.open ? "페이지 비공개로 전환" : "페이지 공개로 전환"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">제목</label>
              <input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">버전</label>
              <input
                value={draft.version}
                onChange={e => setDraft(d => ({ ...d, version: e.target.value }))}
                placeholder="예: v1.0.0"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">소개 문구</label>
            <input
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">설치 안내 (줄바꿈으로 구분)</label>
            <textarea
              value={draft.guide}
              onChange={e => setDraft(d => ({ ...d, guide: e.target.value }))}
              rows={4}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
            >
              {saving ? "저장 중…" : "텍스트 저장"}
            </button>
            {saved && <span className="text-xs text-green-600">저장됨</span>}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">설치 파일</label>
            {cfg.fileUrl ? (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 mb-2">
                <div className="text-xs text-gray-700">
                  📦 {cfg.fileName} ({formatBytes(cfg.fileSize)})
                  {cfg.updatedAt && <span className="text-gray-400"> · {new Date(cfg.updatedAt).toLocaleDateString("ko-KR")} 업로드</span>}
                </div>
                <a href={cfg.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">다운로드 확인</a>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-2">아직 업로드된 파일이 없습니다.</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              className="text-xs"
            />
            {uploading && <p className="text-xs text-blue-600 mt-1">업로드 중… {uploadPct}%</p>}
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

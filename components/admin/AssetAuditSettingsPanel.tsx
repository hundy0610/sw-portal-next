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

type OsKind = "windows" | "mac";

export default function AssetAuditSettingsPanel() {
  const [cfg, setCfg]         = useState<AssetAuditConfig | null>(null);
  const [draft, setDraft]     = useState({ title: "", description: "", guide: "", version: "", dataCollectionNotice: "", deadline: "" });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState<OsKind | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const windowsInputRef = useRef<HTMLInputElement>(null);
  const macInputRef     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/asset-audit/config")
      .then(r => safeJson(r))
      .then((data: AssetAuditConfig) => {
        setCfg(data);
        setDraft({ title: data.title, description: data.description, guide: data.guide, version: data.version, dataCollectionNotice: data.dataCollectionNotice, deadline: data.deadline ?? "" });
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

  async function handleFileChange(os: OsKind, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(os);
    setUploadPct(0);
    setUploadError("");
    try {
      // 브라우저가 .exe/.dmg의 file.type을 신뢰할 수 없게(대부분 빈 문자열로) 보고하는
      // 경우가 많아, 서버 허용 목록에 있는 범용 바이너리 타입으로 명시적으로 고정한다.
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/asset-audit/upload",
        contentType: "application/octet-stream",
        onUploadProgress: ({ percentage }) => setUploadPct(percentage),
      });
      const patch = os === "windows"
        ? { windowsFileUrl: blob.url, windowsFileName: file.name, windowsFileSize: file.size }
        : { macFileUrl: blob.url, macFileName: file.name, macFileSize: file.size };
      const res = await fetch("/api/asset-audit/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, updatedAt: new Date().toISOString() }),
      });
      const json = await safeJson(res);
      if (json?.config) setCfg(json.config);
    } catch (e) {
      console.error("[asset-audit upload]", e);
      setUploadError(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(null);
      const ref = os === "windows" ? windowsInputRef : macInputRef;
      if (ref.current) ref.current.value = "";
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
          <span className="font-bold text-sm text-gray-900">자산실사 프로그램 배포 관리</span>
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
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">참여 마감일 (선택 — 비워두면 상시 진행으로 표시)</label>
            <input
              type="date"
              value={draft.deadline}
              onChange={e => setDraft(d => ({ ...d, deadline: e.target.value }))}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg"
            />
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

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              수집 데이터 고지 (직원에게 반드시 안내 — 줄바꿈으로 구분)
            </label>
            <textarea
              value={draft.dataCollectionNotice}
              onChange={e => setDraft(d => ({ ...d, dataCollectionNotice: e.target.value }))}
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

          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Windows 설치 파일</label>
              {cfg.windowsFileUrl ? (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <div className="text-xs text-gray-700 truncate">
                    {cfg.windowsFileName} ({formatBytes(cfg.windowsFileSize)})
                  </div>
                  <a href={cfg.windowsFileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0 ml-2">확인</a>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-2">아직 업로드된 파일이 없습니다.</p>
              )}
              <input
                ref={windowsInputRef}
                type="file"
                onChange={e => handleFileChange("windows", e)}
                disabled={uploading !== null}
                className="text-xs"
              />
              {uploading === "windows" && <p className="text-xs text-blue-600 mt-1">업로드 중… {uploadPct}%</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">macOS 설치 파일</label>
              {cfg.macFileUrl ? (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <div className="text-xs text-gray-700 truncate">
                    {cfg.macFileName} ({formatBytes(cfg.macFileSize)})
                  </div>
                  <a href={cfg.macFileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0 ml-2">확인</a>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-2">아직 업로드된 파일이 없습니다.</p>
              )}
              <input
                ref={macInputRef}
                type="file"
                onChange={e => handleFileChange("mac", e)}
                disabled={uploading !== null}
                className="text-xs"
              />
              {uploading === "mac" && <p className="text-xs text-blue-600 mt-1">업로드 중… {uploadPct}%</p>}
            </div>
            {cfg.updatedAt && (
              <p className="col-span-2 text-[11px] text-gray-400">최종 업로드: {new Date(cfg.updatedAt).toLocaleDateString("ko-KR")}</p>
            )}
            {uploadError && <p className="col-span-2 text-xs text-red-600">{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

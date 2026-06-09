"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// ── 페이지별 기능 목록 ──────────────────────────────────────
const PAGE_FEATURES: Record<string, string[]> = {
  "메인":        ["공지사항", "검색", "배너", "SW 현황", "기타"],
  "SW 문서":     ["문서 목록", "버전 정보", "다운로드", "검색", "기타"],
  "문의/FAQ":    ["문의 접수", "FAQ 조회", "피드백", "기타"],
  "자료실":      ["자료 검색", "다운로드", "카테고리", "기타"],
  "Admin":       ["대시보드", "자산관리", "계정관리", "티켓", "기타"],
  "Automation":  ["자동화 작업", "기타"],
  "Declaration": ["신고서 작성", "기타"],
  "Manage":      ["공지관리", "교육관리", "자료관리", "SW DB", "기타"],
};

const URL_TO_PAGE: Record<string, string> = {
  "/":            "메인",
  "/sw-files":    "SW 문서",
  "/inquiry":     "문의/FAQ",
  "/resources":   "자료실",
  "/admin":       "Admin",
  "/automation":  "Automation",
  "/declaration": "Declaration",
  "/manage":      "Manage",
};

function detectPage(pathname: string): string {
  // 가장 긴 prefix 매칭
  const matched = Object.keys(URL_TO_PAGE)
    .filter(k => pathname === k || pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return matched ? URL_TO_PAGE[matched] : "메인";
}

// ── 스타일 상수 ────────────────────────────────────────────
const S = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "16px",
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto" as const,
    boxShadow: "0 20px 60px rgba(0,0,0,.2)",
    padding: "28px 28px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 6,
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 14,
    color: "#0f172a",
    background: "#fff",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 14,
    color: "#0f172a",
    resize: "vertical" as const,
    minHeight: 100,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  typeBtn: (active: boolean) => ({
    flex: 1,
    padding: "8px 0",
    border: `1.5px solid ${active ? "#2563EB" : "#e2e8f0"}`,
    borderRadius: 8,
    background: active ? "#EFF6FF" : "#fff",
    color: active ? "#2563EB" : "#64748b",
    fontWeight: active ? 700 : 500,
    fontSize: 14,
    cursor: "pointer",
  }),
};

export default function BugReportButton() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);

  const defaultPage = detectPage(pathname ?? "/");
  const [page, setPage]           = useState(defaultPage);
  const [feature, setFeature]     = useState(PAGE_FEATURES[defaultPage]?.[0] ?? "기타");
  const [type, setType]           = useState<"버그" | "개선요청">("버그");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // admin 여부 확인
  useEffect(() => {
    fetch("/api/admin/auth")
      .then(r => r.json())
      .then(d => setIsAdmin(d.ok === true))
      .catch(() => setIsAdmin(false));
  }, []);

  // 페이지 변경 시 기능 목록 초기화
  useEffect(() => {
    setFeature(PAGE_FEATURES[page]?.[0] ?? "기타");
  }, [page]);

  // 현재 URL 변경 시 페이지 자동 감지
  useEffect(() => {
    const detected = detectPage(pathname ?? "/");
    setPage(detected);
  }, [pathname]);

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setScreenshot(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setScreenshotPreview(url);
    } else {
      setScreenshotPreview(null);
    }
  }

  function resetForm() {
    const detected = detectPage(pathname ?? "/");
    setPage(detected);
    setFeature(PAGE_FEATURES[detected]?.[0] ?? "기타");
    setType("버그");
    setDescription("");
    setScreenshot(null);
    setScreenshotPreview(null);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      let fileUploadId: string | undefined;

      if (screenshot) {
        // 1. 업로드 세션 초기화
        const initRes = await fetch("/api/bug-report/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: screenshot.name, contentType: screenshot.type, size: screenshot.size }),
        });
        const { fileUploadId: uploadId } = await initRes.json();
        fileUploadId = uploadId;

        // 2. 파일 전송
        const fd = new FormData();
        fd.append("file", screenshot, screenshot.name);
        fd.append("fileUploadId", fileUploadId!);
        await fetch("/api/bug-report/upload", { method: "POST", body: fd });
      }

      await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, feature, type, description: description.trim(), fileUploadId }),
      });

      setDone(true);
    } catch {
      alert("제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <>
      {/* ── Floating 버튼 ── */}
      <button
        onClick={() => { setOpen(true); resetForm(); }}
        title="버그/개선사항 신고"
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9000,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#1E3A8A",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 22,
          boxShadow: "0 4px 16px rgba(30,58,138,.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🐛
      </button>

      {/* ── 모달 ── */}
      {open && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { setOpen(false); resetForm(); } }}>
          <div style={S.modal}>
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>버그 / 개선 신고</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>관리자에게 전달됩니다</div>
              </div>
              <button onClick={() => { setOpen(false); resetForm(); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>✕</button>
            </div>

            {done ? (
              /* 완료 화면 */
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>제출이 완료되었습니다</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>확인 후 처리하겠습니다. 감사합니다!</div>
                <button
                  onClick={() => { setOpen(false); resetForm(); }}
                  style={{ padding: "10px 28px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                {/* 유형 토글 */}
                <div>
                  <label style={S.label}>유형</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["버그", "개선요청"] as const).map(t => (
                      <button key={t} onClick={() => setType(t)} style={S.typeBtn(type === t)}>{t}</button>
                    ))}
                  </div>
                </div>

                {/* 페이지 선택 */}
                <div>
                  <label style={S.label}>페이지</label>
                  <select value={page} onChange={e => setPage(e.target.value)} style={S.select}>
                    {Object.keys(PAGE_FEATURES).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 기능 선택 */}
                <div>
                  <label style={S.label}>기능</label>
                  <select value={feature} onChange={e => setFeature(e.target.value)} style={S.select}>
                    {(PAGE_FEATURES[page] ?? ["기타"]).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* 설명 */}
                <div>
                  <label style={S.label}>설명 <span style={{ color: "#ef4444" }}>*</span></label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={type === "버그" ? "어떤 오류가 발생했나요? 재현 방법도 알려주세요." : "어떤 부분을 개선하면 좋을까요?"}
                    style={S.textarea}
                  />
                </div>

                {/* 스크린샷 */}
                <div>
                  <label style={S.label}>스크린샷 (선택)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1.5px dashed #cbd5e1",
                      borderRadius: 8,
                      background: "#f8fafc",
                      color: "#64748b",
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "center" as const,
                    }}
                  >
                    {screenshot ? `📎 ${screenshot.name}` : "클릭하여 이미지 첨부"}
                  </button>
                  {screenshotPreview && (
                    <div style={{ marginTop: 8, position: "relative", display: "inline-block" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshotPreview} alt="preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                      <button
                        onClick={() => { setScreenshot(null); setScreenshotPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.5)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 12, lineHeight: 1 }}
                      >✕</button>
                    </div>
                  )}
                </div>

                {/* 제출 버튼 */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !description.trim()}
                  style={{
                    padding: "12px",
                    background: submitting || !description.trim() ? "#cbd5e1" : "#2563EB",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: submitting || !description.trim() ? "not-allowed" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {submitting ? "제출 중..." : "제출하기"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

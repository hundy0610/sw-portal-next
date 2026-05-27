"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwFile } from "@/types/portal";

const C = {
  brand:       "#D97706",
  primary:     "#F59E0B",
  primarySoft: "#FFFBEB",
  text1:       "#1c1006",
  text2:       "#44403c",
  text3:       "#64748b",
  text4:       "#94a3b8",
  border:      "#fde68a",
  bg:          "#fef3d0",
  bgPage:      "#fffdf8",
} as const;

function Icon({ n, s = 18 }: { n: string; s?: number }) {
  const P: Record<string, string[]> = {
    dl:      ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
    file:    ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
    search:  ["M21 21l-4.35-4.35", "M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0"],
    chevron: ["M9 18l6-6-6-6"],
    home:    ["M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4a1 1 0 0 1-1-1V9.5z"],
    x:       ["M18 6L6 18M6 6l12 12"],
    box:     ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.27 6.96L12 12.01l8.73-5.05", "M12 22.08V12"],
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(P[n] ?? [""]).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const OS_COLORS: Record<string, { bg: string; color: string }> = {
  Windows: { bg: "#EFF6FF", color: "#1D4ED8" },
  macOS:   { bg: "#F0FDF4", color: "#15803D" },
  Linux:   { bg: "#FFF7ED", color: "#C2410C" },
};

export default function SwFilesPage() {
  const [files,   setFiles]   = useState<SwFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [osFilter,  setOsFilter]  = useState("전체");
  const [catFilter, setCatFilter] = useState("전체");

  useEffect(() => {
    fetch("/api/sw-files")
      .then(r => r.json())
      .then(res => setFiles(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const s = new Set(files.map(f => f.category).filter(Boolean));
    return ["전체", ...Array.from(s)];
  }, [files]);

  const osList = useMemo(() => {
    const s = new Set(files.flatMap(f => f.os));
    return ["전체", ...Array.from(s)];
  }, [files]);

  const filtered = files.filter(f => {
    if (osFilter  !== "전체" && !f.os.includes(osFilter))  return false;
    if (catFilter !== "전체" && f.category !== catFilter)   return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (![f.name, f.category, f.description].some(v => v.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: C.bgPage, color: C.text2 }}>
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm"
        style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
          <a href="/" className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity"
            style={{ color: C.text3 }}>
            <Icon n="home" s={15} />
            <span>포털 홈</span>
          </a>
          <span style={{ color: C.border }}>›</span>
          <span className="text-sm font-bold" style={{ color: C.text1 }}>SW 설치파일</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* 타이틀 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: C.primarySoft, color: C.brand }}>
              <Icon n="box" s={20} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>
              SW 설치파일
            </h1>
          </div>
          <p className="text-sm" style={{ color: C.text3 }}>
            사내 승인된 소프트웨어 설치파일 목록입니다.
          </p>
        </div>

        {/* 검색창 */}
        <div className="relative mb-5">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.text4 }}>
            <Icon n="search" s={17} />
          </span>
          <input
            className="w-full h-12 pl-11 pr-10 rounded-2xl text-sm focus:outline-none"
            style={{
              background: "#fff", color: C.text1,
              border: `1.5px solid ${C.border}`, transition: "border-color 0.15s",
            }}
            onFocus={e  => (e.currentTarget.style.borderColor = C.primary)}
            onBlur={e   => (e.currentTarget.style.borderColor = C.border)}
            placeholder="SW명 또는 설명으로 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ color: C.text4 }} onClick={() => setQuery("")}>
              <Icon n="x" s={16} />
            </button>
          )}
        </div>

        {/* OS 필터 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {osList.map(os => (
            <button key={os} onClick={() => setOsFilter(os)}
              className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
              style={{
                background: osFilter === os ? C.brand    : "#f1f5f9",
                color:      osFilter === os ? "#fff"     : C.text3,
              }}>
              {os}
            </button>
          ))}
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: catFilter === cat ? C.primarySoft : "#f8fafc",
                color:      catFilter === cat ? C.brand       : C.text4,
                border:     `1px solid ${catFilter === cat ? C.border : "transparent"}`,
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* 파일 목록 */}
        {loading ? (
          <div className="text-center py-20" style={{ color: C.text4 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: C.bg, color: C.text4 }}>
            {query ? `"${query}"에 대한 결과가 없습니다.` : "등록된 파일이 없습니다."}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs mb-4" style={{ color: C.text4 }}>{filtered.length}개</p>
            {filtered.map(file => (
              <div key={file.id}
                className="bg-white rounded-2xl p-5 hover:shadow-md transition-all"
                style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: C.primarySoft, color: C.brand }}>
                    <Icon n="file" s={19} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base leading-snug" style={{ color: C.text1 }}>
                          {file.name}
                          {file.version && (
                            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded"
                              style={{ background: "#f1f5f9", color: C.text3 }}>
                              v{file.version}
                            </span>
                          )}
                        </h3>
                        {file.description && (
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: C.text3 }}>
                            {file.description}
                          </p>
                        )}
                      </div>

                      {file.downloadUrl && file.downloadUrl !== "#" ? (
                        <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0 hover:brightness-110 transition-all"
                          style={{ background: C.brand, color: "#fff" }}>
                          <Icon n="dl" s={13} /> 다운로드
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0"
                          style={{ background: "#f1f5f9", color: C.text4 }}>
                          준비중
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {file.category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: C.bg, color: C.text3 }}>
                          {file.category}
                        </span>
                      )}
                      {file.os.map(os => (
                        <span key={os} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={OS_COLORS[os] ?? { bg: "#f1f5f9", color: C.text3 }}>
                          {os}
                        </span>
                      ))}
                      {file.fileSize && (
                        <span className="text-xs" style={{ color: C.text4 }}>{file.fileSize}</span>
                      )}
                      {file.updatedAt && (
                        <span className="text-xs hidden sm:inline" style={{ color: C.text4 }}>
                          · {file.updatedAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

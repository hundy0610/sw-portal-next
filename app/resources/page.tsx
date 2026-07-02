"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwVersion, SwDoc } from "@/types/portal";
import { safeJson } from "@/lib/fetch-json";

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

const INQUIRY_URL = "https://assetify-desk-main.vercel.app";

function Icon({ n, s = 18 }: { n: string; s?: number }) {
  const P: Record<string, string[]> = {
    home:    ["M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4a1 1 0 0 1-1-1V9.5z"],
    edu:     ["M22 10v6M2 10l10-5 10 5-10 5z", "M6 12v5c3 3 9 3 12 0v-5"],
    folder:  ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
    search:  ["M21 21l-4.35-4.35", "M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0"],
    clip:    ["M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2"],
    msg:     ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
    box:     ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.27 6.96L12 12.01l8.73-5.05", "M12 22.08V12"],
    chevron: ["M9 18l6-6-6-6"],
    dl:      ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
    file:    ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
    x:       ["M18 6L6 18M6 6l12 12"],
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(P[n] ?? [""]).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const NAV = [
  { label: "홈",        icon: "home",   href: "/",           active: false, short: "홈"    },
  { label: "교육 센터",  icon: "edu",    href: "/",           active: false, short: "교육"  },
  { label: "자료실",     icon: "folder", href: "/resources",  active: true,  short: "자료실" },
  { label: "SW 검색",   icon: "search", href: "/",           active: false, short: "SW"   },
  { label: "자산 실사",  icon: "clip",   href: "/declaration", active: false, short: "실사"  },
];

export default function ResourcesPage() {
  const [versions, setVersions]               = useState<SwVersion[]>([]);
  const [selectedSwName, setSelectedSwName]   = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<SwVersion | null>(null);
  const [docs, setDocs]                       = useState<SwDoc[]>([]);
  const [loadingDocs, setLoadingDocs]         = useState(false);
  const [openPreview, setOpenPreview]         = useState<string | null>(null);
  const [catFilter, setCatFilter]             = useState("전체");
  const [searchQ, setSearchQ]                 = useState("");
  const [regulationConfirmed, setRegulationConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/sw-versions").then(r => safeJson(r)).then(res => setVersions(res.data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedVersion) { setDocs([]); return; }
    setLoadingDocs(true);
    setOpenPreview(null);
    setRegulationConfirmed(false);
    fetch(`/api/sw-docs?versionId=${selectedVersion.id}`)
      .then(r => safeJson(r))
      .then(res => {
        const data: SwDoc[] = res.data ?? [];
        setDocs(data);
        setLoadingDocs(false);
        // 규정이 있으면 자동으로 첫 번째 규정 PDF 열기
        const firstReg = data.find(d => d.type === "규정");
        if (firstReg) setOpenPreview(firstReg.id);
      });
  }, [selectedVersion]);

  const swGroups = useMemo(() => {
    const map = new Map<string, SwVersion[]>();
    for (const v of versions) {
      if (!map.has(v.name)) map.set(v.name, []);
      map.get(v.name)!.push(v);
    }
    return map;
  }, [versions]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const v of versions) if (v.category) cats.add(v.category);
    return ["전체", ...Array.from(cats)];
  }, [versions]);

  const filteredSwNames = useMemo(() => {
    return Array.from(swGroups.keys()).filter(name => {
      const vers = swGroups.get(name)!;
      const matchCat = catFilter === "전체" || vers[0]?.category === catFilter;
      const matchSearch = !searchQ || name.toLowerCase().includes(searchQ.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [swGroups, catFilter, searchQ]);

  const docSections = useMemo(() => {
    const order = ["규정", "설치안내", "설치파일"];
    const map = new Map<string, SwDoc[]>();
    for (const doc of docs) {
      const key = doc.type || "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    const result: Array<{ type: string; docs: SwDoc[] }> = [];
    for (const t of order) if (map.has(t)) result.push({ type: t, docs: map.get(t)! });
    for (const [t, d] of map) if (!order.includes(t)) result.push({ type: t, docs: d });
    return result;
  }, [docs]);

  const hasRegulation = docSections.some(s => s.type === "규정");
  const canDownload   = !hasRegulation || regulationConfirmed;

  const swVersionList = selectedSwName ? (swGroups.get(selectedSwName) ?? []) : [];

  return (
    <div className="flex min-h-screen" style={{ background: C.bgPage, color: C.text2 }}>

      {/* ── 사이드바 ── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-white"
        style={{ width: 240, borderRight: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <img src="/logo.png" alt="로고" className="shrink-0"
            style={{ height: 32, width: "auto", maxWidth: 160, objectFit: "contain" }} />
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          {NAV.map(({ label, icon, href, active }) => (
            <a key={label} href={href}
              className="flex items-center gap-3 px-3.5 py-2.5 text-sm transition-all"
              style={{
                borderRadius: 10,
                background:     active ? C.primarySoft  : "transparent",
                color:          active ? C.primary      : C.text3,
                fontWeight:     active ? 700             : 500,
                textDecoration: "none",
              }}>
              <Icon n={icon} s={16} />
              {label}
            </a>
          ))}
        </nav>
        <div className="p-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <a href={INQUIRY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-3 text-white text-sm font-bold w-full"
            style={{ borderRadius: 10, background: C.primary, textDecoration: "none" }}>
            <Icon n="msg" s={15} /> IT 지원 문의하기
          </a>
          <a href="/admin"
            className="mt-3 block text-center text-xs hover:underline transition-colors"
            style={{ color: C.text4, textDecoration: "none" }}>관리자</a>
        </div>
      </aside>

      {/* ── 모바일 헤더 ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 bg-white/90"
        style={{ height: 52, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)" }}>
        <img src="/logo.png" alt="로고" className="mr-3 shrink-0"
          style={{ height: 22, width: "auto", maxWidth: 120, objectFit: "contain" }} />
        <span className="font-bold text-sm" style={{ color: C.text1 }}>자료실</span>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 lg:ml-[240px] min-h-screen pb-20 lg:pb-10 pt-14 lg:pt-0">

        {/* ════ 레벨 1: SW 목록 ════ */}
        {!selectedSwName && (
          <>
            {/* 히어로 */}
            <div className="relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.primary} 100%)` }}>
              <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: "rgba(255,255,255,0.65)" }}>SW 자료 아카이브</p>
                <h1 className="text-4xl font-extrabold text-white mb-2"
                  style={{ fontFamily: "Manrope, sans-serif" }}>자료실</h1>
                <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.8)" }}>
                  SW 설치 파일과 설치 안내, 규정 문서를 한 곳에서 확인하세요.
                </p>
                <div className="relative max-w-lg">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "rgba(255,255,255,0.6)" }}>
                    <Icon n="search" s={17} />
                  </span>
                  <input
                    className="w-full h-11 pl-11 pr-9 rounded-2xl text-sm focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
                    placeholder="SW 이름 검색..."
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                  />
                  {searchQ && (
                    <button className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                      onClick={() => setSearchQ("")}>
                      <Icon n="x" s={14} />
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                  총 {swGroups.size}개 SW 등록됨
                </p>
              </div>
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full"
                style={{ background: "rgba(255,255,255,0.05)" }} />
              <div className="absolute right-8 -bottom-8 w-40 h-40 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)" }} />
            </div>

            {/* 카테고리 필터 */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="max-w-4xl mx-auto px-6">
                <div className="flex gap-2 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setCatFilter(cat)}
                      className="shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                      style={{
                        background: catFilter === cat ? C.brand : C.bg,
                        color:      catFilter === cat ? "#fff"  : C.text3,
                      }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SW 카드 그리드 */}
            <div className="max-w-4xl mx-auto px-6 py-8">
              {filteredSwNames.length === 0 ? (
                <div className="text-center py-20 rounded-[20px]" style={{ background: C.bg, color: C.text4 }}>
                  {searchQ ? `"${searchQ}" 검색 결과가 없습니다.` : "등록된 SW가 없습니다."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredSwNames.map(name => {
                    const vers = swGroups.get(name)!;
                    const cat  = vers[0]?.category || "기타";
                    const allOs = Array.from(new Set(vers.flatMap(v => v.os)));
                    return (
                      <button key={name} onClick={() => setSelectedSwName(name)}
                        className="p-5 rounded-[20px] text-left transition-all group"
                        style={{ background: "#fff", border: `1px solid ${C.border}`,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)")}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)")}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background: C.primarySoft, color: C.brand }}>
                            <Icon n="box" s={22} />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: C.bg, color: C.text3 }}>{cat}</span>
                        </div>
                        <div className="font-bold text-base mb-0.5" style={{ color: C.text1 }}>{name}</div>
                        <div className="text-xs mb-3" style={{ color: C.text3 }}>{vers.length}개 버전 제공</div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1 flex-wrap">
                            {allOs.slice(0, 3).map(os => (
                              <span key={os} className="text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{ background: "#f1f5f9", color: C.text3 }}>{os}</span>
                            ))}
                          </div>
                          <span className="text-xs font-semibold flex items-center gap-0.5"
                            style={{ color: C.brand }}>
                            보기 <Icon n="chevron" s={12} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════ 레벨 2: 버전 목록 ════ */}
        {selectedSwName && !selectedVersion && (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <nav className="flex items-center gap-1.5 text-sm mb-8" style={{ color: C.text3 }}>
              <button onClick={() => setSelectedSwName(null)} className="hover:underline">자료실</button>
              <Icon n="chevron" s={13} />
              <span style={{ color: C.text1, fontWeight: 600 }}>{selectedSwName}</span>
            </nav>

            <div className="mb-8">
              <h1 className="text-3xl font-extrabold mb-1"
                style={{ fontFamily: "Manrope, sans-serif", color: C.text1 }}>{selectedSwName}</h1>
              <p className="text-sm" style={{ color: C.text3 }}>
                설치할 버전을 선택하세요.
              </p>
            </div>

            <div className="space-y-3">
              {swVersionList.map((ver, i) => (
                <button key={ver.id} onClick={() => setSelectedVersion(ver)}
                  className="w-full p-5 rounded-[16px] text-left transition-all flex items-center justify-between"
                  style={{ background: "#fff", border: `1px solid ${C.border}`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)")}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: i === 0 ? C.brand : C.bg, color: i === 0 ? "#fff" : C.text3 }}>
                      {i === 0 ? "최신" : `v${i + 1}`}
                    </div>
                    <div>
                      <div className="font-bold" style={{ color: C.text1 }}>버전 {ver.version}</div>
                      {ver.description && (
                        <p className="text-xs mt-0.5" style={{ color: C.text3 }}>{ver.description}</p>
                      )}
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {ver.os.map(os => (
                          <span key={os} className="text-[10px] px-2 py-0.5 rounded font-medium"
                            style={{ background: C.bg, color: C.text3 }}>{os}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Icon n="chevron" s={16} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════ 레벨 3: 파일 상세 ════ */}
        {selectedVersion && (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <nav className="flex items-center gap-1.5 text-sm mb-8" style={{ color: C.text3 }}>
              <button onClick={() => { setSelectedSwName(null); setSelectedVersion(null); }}
                className="hover:underline">자료실</button>
              <Icon n="chevron" s={13} />
              <button onClick={() => setSelectedVersion(null)} className="hover:underline">{selectedSwName}</button>
              <Icon n="chevron" s={13} />
              <span style={{ color: C.text1, fontWeight: 600 }}>버전 {selectedVersion.version}</span>
            </nav>

            {/* 버전 헤더 카드 */}
            <div className="p-6 rounded-[20px] mb-8 text-white relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.primary})` }}>
              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: "rgba(255,255,255,0.65)" }}>{selectedSwName}</p>
                <h1 className="text-2xl font-extrabold mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                  버전 {selectedVersion.version}
                </h1>
                {selectedVersion.description && (
                  <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {selectedVersion.description}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {selectedVersion.os.map(os => (
                    <span key={os} className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: "rgba(255,255,255,0.2)" }}>{os}</span>
                  ))}
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* 파일 목록 */}
            {loadingDocs ? (
              <div className="text-center py-16" style={{ color: C.text4 }}>불러오는 중...</div>
            ) : docs.length === 0 ? (
              <div className="text-center py-16 rounded-[20px]" style={{ background: C.bg, color: C.text4 }}>
                등록된 파일이 없습니다.
              </div>
            ) : (
              <div className="space-y-8">
                {docSections.map(({ type, docs: sectionDocs }) => {
                  const isInstall    = type === "설치파일";
                  const isRegulation = type === "규정";
                  return (
                    <section key={type}>
                      <h2 className="text-xs font-bold uppercase tracking-widest mb-3"
                        style={{ color: C.text3 }}>{type}</h2>
                      <div className="space-y-3">
                        {sectionDocs.map(doc => {
                          const isPdfOpen = openPreview === doc.id;
                          const locked    = isInstall && !canDownload;
                          return (
                            <div key={doc.id} className="rounded-[16px] overflow-hidden bg-white"
                              style={{ border: `1px solid ${locked ? "#fde68a" : C.border}`,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                              <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{
                                      background: locked ? "#FEF3C7" : C.primarySoft,
                                      color:      locked ? "#92400E" : C.brand,
                                    }}>
                                    <Icon n={isInstall ? (locked ? "shield" : "dl") : "file"} s={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-sm truncate" style={{ color: C.text1 }}>
                                      {doc.name}
                                    </div>
                                    {doc.description && (
                                      <div className="text-xs mt-0.5" style={{ color: C.text4 }}>
                                        {doc.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isInstall ? (
                                  locked ? (
                                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 ml-3"
                                      style={{ background: "#FEF3C7", color: "#92400E" }}>
                                      🔒 규정 확인 필요
                                    </div>
                                  ) : (
                                    <a href={`/api/sw-docs/${doc.id}/file?download=1`}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 ml-3"
                                      style={{ background: C.brand, color: "#fff", textDecoration: "none" }}>
                                      <Icon n="dl" s={13} /> 다운로드
                                    </a>
                                  )
                                ) : (
                                  <button
                                    onClick={() => setOpenPreview(isPdfOpen ? null : doc.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 ml-3 transition-all"
                                    style={{
                                      background: isPdfOpen ? C.bg      : C.primarySoft,
                                      color:      isPdfOpen ? C.text3   : C.brand,
                                    }}>
                                    {isPdfOpen ? "닫기" : "미리보기"}
                                  </button>
                                )}
                              </div>
                              {isPdfOpen && (
                                <div style={{ borderTop: `1px solid ${C.border}` }}>
                                  <iframe
                                    src={`/api/sw-docs/${doc.id}/file`}
                                    className="w-full border-0 block"
                                    style={{ height: "70vh" }}
                                    title={doc.name}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 규정 섹션 아래 확인 체크박스 */}
                      {isRegulation && (
                        <label className="flex items-center gap-3 mt-4 p-4 rounded-[14px] cursor-pointer"
                          style={{
                            background:   regulationConfirmed ? "#F0FDF4" : "#FFFBEB",
                            border:       `1px solid ${regulationConfirmed ? "#86EFAC" : "#FDE68A"}`,
                          }}>
                          <input
                            type="checkbox"
                            checked={regulationConfirmed}
                            onChange={e => {
                              setRegulationConfirmed(e.target.checked);
                              if (e.target.checked) {
                                const firstGuide = docSections.find(s => s.type === "설치안내")?.docs[0];
                                if (firstGuide) setOpenPreview(firstGuide.id);
                              }
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <span className="text-sm font-semibold"
                            style={{ color: regulationConfirmed ? "#15803D" : "#92400E" }}>
                            {regulationConfirmed
                              ? "✅ 규정을 확인하였습니다. 설치 파일을 다운로드할 수 있습니다."
                              : "위 규정을 모두 읽고 확인하였습니다. (체크 후 설치 파일 다운로드 가능)"}
                          </span>
                        </label>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── 모바일 바텀 네비 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-50 bg-white"
        style={{ height: 64, borderTop: `1px solid ${C.border}` }}>
        {NAV.map(({ label, icon, href, active, short }) => (
          <a key={label} href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: active ? C.primary : C.text4, textDecoration: "none" }}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: active ? C.primarySoft : "transparent" }}>
              <Icon n={icon} s={17} />
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600 }}>{short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

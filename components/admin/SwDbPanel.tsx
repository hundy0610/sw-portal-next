"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwItem } from "@/types";

const INQUIRY_URL = "https://assetify-desk.vercel.app/inquiry";

// ── 카테고리 정보 ──────────────────────────────────────────────────────
const CATEGORY_INFO: Record<string, { icon: string }> = {
  "문서작업용": { icon: "📝" },
  "AI 툴":      { icon: "🤖" },
  "개발 툴":    { icon: "💻" },
  "협업 툴":    { icon: "🤝" },
  "디자인 툴":  { icon: "🎨" },
  "보안/관리":  { icon: "🛡️" },
  "기타":       { icon: "📦" },
};

// ── 타입 정의 ──────────────────────────────────────────────────────────
interface WhiteItem {
  id: string;
  name: string;
  vendor: string;
  category: string;
  description: string;
  downloadUrl?: string;
  note?: string;
}
interface BlackItem {
  id: string;
  name: string;
  riskLevel: "high" | "medium";
  reason: string;
  detail: string;
  alternatives?: string[];
}

// ── 예시 화이트리스트 (Notion 미연동 시 표시) ─────────────────────────
const DEMO_WHITELIST: WhiteItem[] = [
  { id: "w1",  name: "Microsoft 365",      vendor: "Microsoft",       category: "문서작업용", description: "Word · Excel · PowerPoint · Teams 포함",          downloadUrl: "#", note: "사내 계정으로 로그인 후 사용" },
  { id: "w2",  name: "한컴오피스 NEO",     vendor: "한글과컴퓨터",    category: "문서작업용", description: "한글(HWP), 한셀, 한쇼 포함",                      downloadUrl: "#" },
  { id: "w3",  name: "Adobe Acrobat",      vendor: "Adobe",           category: "문서작업용", description: "PDF 생성·편집·전자서명",                           downloadUrl: "#", note: "팀 라이선스 IT팀 요청 필요" },
  { id: "w4",  name: "Notion",             vendor: "Notion Labs",     category: "협업 툴",   description: "문서·프로젝트·위키 통합 관리",                      note: "팀 워크스페이스 초대 필요 (IT팀 문의)" },
  { id: "w5",  name: "Slack",              vendor: "Salesforce",      category: "협업 툴",   description: "팀 메신저 및 협업 플랫폼" },
  { id: "w6",  name: "Zoom",              vendor: "Zoom Video",       category: "협업 툴",   description: "화상회의 플랫폼",                                   downloadUrl: "#", note: "기업 라이선스 계정으로만 사용" },
  { id: "w7",  name: "Microsoft Teams",   vendor: "Microsoft",        category: "협업 툴",   description: "화상회의 + 채팅 + 파일 공유 통합" },
  { id: "w8",  name: "GitHub (기업)",      vendor: "Microsoft",       category: "개발 툴",   description: "소스코드 형상관리 플랫폼",                           note: "조직 계정 초대 필요 (IT팀 문의)" },
  { id: "w9",  name: "VS Code",            vendor: "Microsoft",       category: "개발 툴",   description: "무료 코드 에디터 (오픈소스)",                        downloadUrl: "#" },
  { id: "w10", name: "IntelliJ IDEA",      vendor: "JetBrains",       category: "개발 툴",   description: "Java/Kotlin 전용 IDE",                              downloadUrl: "#", note: "라이선스 키 IT팀 문의" },
  { id: "w11", name: "Figma (기업)",        vendor: "Figma Inc.",      category: "디자인 툴", description: "UI/UX 협업 디자인 툴",                              note: "팀 플랜 초대 필요 (IT팀 문의)" },
  { id: "w12", name: "Adobe Creative Cloud", vendor: "Adobe",         category: "디자인 툴", description: "Photoshop, Illustrator, InDesign 등 포함",           downloadUrl: "#", note: "팀 라이선스 IT팀 요청 필요" },
  { id: "w13", name: "V3 Endpoint Security", vendor: "AhnLab",        category: "보안/관리", description: "백신·악성코드 방어 솔루션 (전 직원 필수 설치)",      downloadUrl: "#" },
  { id: "w14", name: "사내 VPN",            vendor: "IT팀 제공",       category: "보안/관리", description: "재택·외부 접속 시 필수 사용",                       downloadUrl: "#" },
  { id: "w15", name: "GitHub Copilot",      vendor: "Microsoft",      category: "AI 툴",    description: "AI 코딩 어시스턴트 (VS Code 연동)",                  note: "개인별 라이선스 신청 필요" },
  { id: "w16", name: "ChatGPT (기업)",      vendor: "OpenAI",         category: "AI 툴",    description: "AI 텍스트 생성·요약 도구",                           note: "기업용 계정 별도 신청 필요" },
  { id: "w17", name: "Postman",             vendor: "Postman Inc.",   category: "개발 툴",   description: "API 개발·테스트 도구",                               downloadUrl: "#" },
  { id: "w18", name: "DBeaver",             vendor: "DBeaver Corp.",  category: "개발 툴",   description: "DB 관리 도구 (무료·정품)",                           downloadUrl: "#" },
];

// ── 예시 블랙리스트 ───────────────────────────────────────────────────
const DEMO_BLACKLIST: BlackItem[] = [
  {
    id: "b1", name: "BitTorrent / uTorrent 등 P2P 프로그램",
    riskLevel: "high", reason: "저작권 침해 위험",
    detail: "P2P 파일 공유 프로그램은 불법 콘텐츠 유통 및 악성코드 감염 위험이 있어 사내 사용이 금지됩니다. 발견 시 즉시 삭제 바랍니다.",
    alternatives: ["사내 공유 드라이브", "SharePoint"],
  },
  {
    id: "b2", name: "개인 Google Drive / Dropbox (개인 계정)",
    riskLevel: "high", reason: "정보보안 위반",
    detail: "개인 클라우드 계정으로 사내 자료를 저�`하면 정보 유출 위험이 있습니다. 사내 OneDrive 또는 SharePoint를 이용하세요.",
    alternatives: ["사내 OneDrive", "SharePoint"],
  },
  {
    id: "b3", name: "Zoom (무료 개인 계정)",
    riskLevel: "medium", reason: "라이선스 컴플라이언스",
    detail: "기업 환경에서 무료 개인 계정 사용은 Zoom 약관 위반입니다. IT팀에 기업 라이선스를 신청하면 정품을 사용할 수 있습니다.",
    alternatives: ["Zoom (기업 라이선스)", "Microsoft Teams"],
  },
  {
    id: "b4", name: "CCleaner (구버전 / 비공식 배포본)",
    riskLevel: "medium", reason: "보안 취약점",
    detail: "특정 구버전 CCleaner에 악성코드 삽입 이력이 있어 사내 사용이 금지됩니다. V3 Endpoint Security로 대체하세요.",
    alternatives: ["V3 Endpoint Security"],
  },
  {
    id: "b5", name: "TeamViewer (무료 개인 라이선스)",
    riskLevel: "medium", reason: "라이선스 컴플라이언스",
    detail: "기업 환경에서의 무료 사용은 TeamViewer 약관 위반입니다. 원격접속이 필요하면 IT팀에 승인된 솔루션을 요청하세요.",
    alternatives: ["사내 VPN", "IT팀 승인 원격접속 솔루션"],
  },
  {
    id: "b6", name: "크랙·키젠을 사용한 모든 소프트웨어",
    riskLevel: "high", reason: "불법 소프트웨어",
    detail: "크랙·키젠을 이용한 불법 복제 SW 사용은 저작권법 위반으로 법적 책임이 발생할 수 있습니다. 정품 라이선스를 신청하세요.",
    alternatives: ["IT팀 정품 라이선스 신청"],
  },
  {
    id: "b7", name: "카카오톡 / 라인 (개인 메신저 업무 사용)",
    riskLevel: "medium", reason: "정보보안 지침 위반",
    detail: "개인 메신저를 통한 사내 자료 공유·업무 협의는 정보보안 지침에 위반됩니다. 사내 공식 협업 도구를 이용하세요.",
    alternatives: ["Slack", "Microsoft Teams"],
  },
];

type TabType = "white" | "black";

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
export default function SwDbPanel() {
  const [apiItems, setApiItems]       = useState<SwItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, seTTab]                 = useState<TabType>("white");
  const [query, setQuery]             = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [showRequest, setShowRequest] = useState(false);
  const [requestSwName, setRequestSwName] = useState("");

  useEffect(() => {
    fetch("/api/sw-db")
      .then(r => r.json())
      .then(res => setApiItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  // API 데이터가 있으면 사용, 없으면 예시 데이터
  const whitelist = useMemo<WhiteItem[]>(() => {
    const approved = apiItems.filter(s => s.status === "approved" || s.status === "conditional");
    if (approved.length > 0) {
      return approved.map(s => ({
        id: s.id, name: s.name, vendor: s.vendor,
        category: s.category || "기타", description: s.description || "",
        note: s.status === "conditional" ? "IT팀 사전 승인 필요" : undefined,
      }));
    }
    return DEMO_WHITELIST;
  }, [apiItems]);

  const blacklist = useMemo<BlackItem[]>(() => {
    const banned = apiItems.filter(s => s.status === "banned");
    if (banned.length > 0) {
      return banned.map(s => ({
        id: s.id, name: s.name, riskLevel: "high" as const,
        reason: "금지 소프트웨어", detail: s.description || "사내 사용이 금지된 소프트웨어입니다.",
        alternatives: s.alternatives,
      }));
    }
    return DEMO_BLACKLIST;
  }, [apiItems]);

  const isDemo = apiItems.filter(s => s.status === "approved" || s.status === "banned").length === 0;

  // 카테고리 목록
  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(whitelist.map(w => w.category)))],
    [whitelist]
  );

  // 화이트리스트 필터
  const filteredWhite = useMemo(() => {
    return whitelist.filter(w => {
      if (categoryFilter !== "전체" && w.category !== categoryFilter) return false;
      if (!query) return categoryFilter !== "전체";
      const q = query.toLowerCase();
      return w.name.toLowerCase().includes(q)
        || w.vendor.toLowerCase().includes(q)
        || w.category.toLowerCase().includes(q)
        || (w.description || "").toLowerCase().includes(q);
    });
  }, [whitelist, query, categoryFilter]);

  // 블랙리스트 필터
  const filteredBlack = useMemo(() => {
    if (!query) return blacklist;
    const q = query.toLowerCase();
    return blacklist.filter(b =>
      b.name.toLowerCase().includes(q) || b.reason.toLowerCase().includes(q)
    );
  }, [blacklist, query]);

  const showResults = query.length >= 1 || categoryFilter !== "전체";

  function openRequest(swName = "") {
    setRequestSwName(swName || query);
    setShowRequest(true);
  }

  if (loading) return <div className="text-center py-20 text-gray-400">로딩 중...</div>;

  return (
    <div className="fade-in">
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">SW 사용 승인 조회</h2>
          <p className="text-sm text-gray-500">사내 허용·금지 소프트웨어를 검색하고 사용 승인을 신청하세요.</p>
        </div>
        <button
          onClick={() => openRequest()}
          className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          ✏️ SW 사용 신청
        </button>
      </div>

      {/* 예시 데이터 안내 배너 */}
      {isDemo && (
        <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <span>📋</span>
          <span>현재 Notion SW DB 데이터가 없어 <strong>예시 데이터</strong>로 표시됩니다. 관리자가 Notion에 데이터를 추가하면 자동으로 반영됩니다.</span>
        </div>
      )}

      {/* ── 검색창 ── */}
      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          placeholder="소프트웨어명 검색... (예: Photoshop, 한컴, Zoom, GitHub)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("white")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
            tab === "white"
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
          }`}
        >
          ✅ 화이트리스트 ({whitelist.length})
        </button>
        <button
          onClick={() => setTab("black")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
            tab === "black"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-700"
          }`}
        >
          🚫 블랙리스트 ({blacklist.length})
        </button>
      </div>

      {/* ════════════ 화이트리스트 탭 ════════════ */}
      {tab === "white" && (
        <>
          {/* 카테고리 필터 칩 */}
          <div className="flex gap-2 flex-wrap mb-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategoryFilter(cat); setQuery(""); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  categoryFilter === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {cat === "전체"
                  ? "🔎 전체 보기"
                  : `${CATEGORY_INFO[cat]?.icon ?? "📦"} ${cat}`}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  categoryFilter === cat
                    ? "bg-white/25 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {cat === "전체"
                    ? whitelist.length
                    : whitelist.filter(w => w.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* 검색 전 랜딩 상태 */}
          {!showResults ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <div className="font-bold text-gray-800 text-lg mb-2">사용하고 싶은 SW를 검색하세요</div>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
                검색창에 소프트웨어명을 입력하거나<br/>카테고리를 선택하면 사내 승인 SW 목록을 확인할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {categories.filter(c => c !== "전체").map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {CATEGORY_INFO[cat]?.icon ?? "📦"} {cat}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400">
                찾는 SW가 목록에 없다면{" "}
                <button onClick={() => openRequest()} className="text-blue-600 font-semibold hover:underline">
                  사용 신청하기 →
                </button>
              </div>
            </div>
          ) : filteredWhite.length === 0 ? (
            /* 검색 결과 없음 */
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🤔</div>
              <div className="font-bold text-gray-800 mb-2">
                {query ? `"${query}" 검색 결과가 없습니다` : "이 카테고리에 등록된 SW가 없습니다"}
              </div>
              <p className="text-sm text-gray-500 mb-5">
                승인되지 않았거나 아직 목록에 없는 SW일 수 있습니다.<br/>
                IT팀에 사용 신청을 하면 검토 후 승인 여부를 안내드립니다.
              </p>
              <button
                onClick={() => openRequest()}
                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                ✏️ SW 사용 신청하기
              </button>
            </div>
          ) : (
            /* 결과 목록 */
            <div className="flex flex-col gap-3">
              {filteredWhite.map(w => {
                const catInfo = CATEGORY_INFO[w.category] ?? CATEGORY_INFO["기타"];
                return (
                  <div
                    key={w.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-green-200 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-lg shrink-0">
                        {catInfo.icon}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-gray-900">{w.name}</span>
                          <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">✅ 승인됨</span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{w.category}</span>
                        </div>
                        <div className="text-xs text-gray-400 mb-1">{w.vendor}</div>
                        <div className="text-xs text-gray-600">{w.description}</div>
                        {w.note && (
                          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                            <span>ℹ️</span>
                            <span>{w.note}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {w.downloadUrl && (
                          <a
                            href={w.downloadUrl}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            ⬇ 다운로드
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* 하단 신청 유도 */}
              <div className="text-center pt-2 pb-1">
                <p className="text-sm text-gray-400 mb-1.5">찾는 SW가 없으신가요?</p>
                <button
                  onClick={() => openRequest()}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold"
                >
                  ✏️ SW 사용 신청하기 →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════ 블랙리스트 탭 ════════════ */}
      {tab === "black" && (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800 mb-4">
            🚨 아래 소프트웨어는 <strong>보안 위험, 라이선스 위반, 법적 리스크</strong> 등의 이유로 사내 사용이 금지됩니다.
            현재 사용 중이라면 즉시 삭제하고 IT팀에 신고해주세요.
          </div>

          <div className="flex flex-col gap-3">
            {filteredBlack.map(b => (
              <div
                key={b.id}
                className={`bg-white rounded-xl p-4 border-2 ${b.riskLevel === "high" ? "border-red-200" : "border-orange-200"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                    b.riskLevel === "high"
                      ? "bg-red-50 border border-red-100"
                      : "bg-orange-50 border border-orange-100"
                  }`}>
                    🚫
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-bold text-gray-900">{b.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        b.riskLevel === "high"
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {b.riskLevel === "high" ? "🔴 고위험" : "🟡 주의"}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {b.reason}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-2 leading-relaxed">{b.detail}</div>
                    {b.alternatives && b.alternatives.length > 0 && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
                        ✅ <strong>대체 SW:</strong> {b.alternatives.join(", ")}
                      </div>
                    )}
                  </div>
                  <a
                    href={INQUIRY_URL}
                    target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    신고하기
                  </a>
                </div>
              </div>
            ))}

            {filteredBlack.length === 0 && (
              <div className="text-center py-10 text-gray-400">검색 결과가 없습니다.</div>
            )}
          </div>
        </>
      )}

      {/* ── SW 사용 신청 모달 ── */}
      {showRequest && (
        <RequestModal
          onClose={() => setShowRequest(false)}
          defaultSwName={requestSwName}
        />
      )}
    </div>
  );
}

// ── 신청 모달 컴포넌트 ─────────────────────────────────────────────────
function RequestModal({
  onClose,
  defaultSwName,
}: {
  onClose: () => void;
  defaultSwName: string;
}) {
  const [swName, setSwName]   = useState(defaultSwName);
  const [purpose, setPurpose] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!swName.trim()) return;
    const url = `${INQUIRY_URL}?sw=${encodeURIComponent(swName)}&purpose=${encodeURIComponent(purpose)}`;
    window.open(url, "_blank");
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
          <div>
            <div className="font-bold text-base">SW 사용 승인 신청</div>
            <div className="text-xs opacity-80 mt-0.5">IT팀 검토 후 3영업일 이내 회신드립니다.</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <div className="font-bold text-gray-900 text-lg mb-2">신청이 접수되었습니다</div>
            <p className="text-sm text-gray-500 mb-6">IT팀에서 검토 후 이메일 또는 메신저로 회신드리겠습니다.</p>
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                SW 이름 <span className="text-red-500">*</span>
              </label>
              <input
                value={swName}
                onChange={e => setSwName(e.target.value)}
                required
                placeholder="예: Adobe Photoshop, Slack, Zoom..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                사용 목적 / 요청 사유
              </label>
              <textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="어떤 업무에 사용하실 예정인지 간략히 적어주세요."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
              ℹ️ 신청 내용은 IT 지원 시스템에 접수되며, 승인 가능 여부 검토 후 회신드립니다.
              승인된 SW는 화이트리스트에 등록되어 자료실에서 다운로드 가능합니다.
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                신청하기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

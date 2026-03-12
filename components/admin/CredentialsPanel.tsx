"use client";

import { useEffect, useState, useMemo } from "react";

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
export interface SwCredential {
  id: string;
  swName: string;       // SW명
  siteUrl: string;      // 사이트 URL
  accountId: string;    // 아이디 / 계정
  password: string;     // 비밀번호
  memo: string;         // 비고
}

// ────────────────────────────────────────────────────────────
// SW 카테고리 매핑 (아이콘 표시용)
// ────────────────────────────────────────────────────────────
const SW_ICON_MAP: { keywords: string[]; icon: string }[] = [
  { keywords: ["office","365","microsoft","ms "], icon: "🪟" },
  { keywords: ["adobe","photoshop","illustrator","premiere","acrobat"], icon: "🎨" },
  { keywords: ["github","gitlab","git"], icon: "🐙" },
  { keywords: ["notion"], icon: "📓" },
  { keywords: ["slack"], icon: "💬" },
  { keywords: ["zoom"], icon: "📹" },
  { keywords: ["figma"], icon: "🎯" },
  { keywords: ["jetbrains","intellij","pycharm","webstorm","datagrip","rider"], icon: "🧠" },
  { keywords: ["aws","amazon"], icon: "☁️" },
  { keywords: ["google"], icon: "🔵" },
  { keywords: ["apple","mac"], icon: "🍎" },
  { keywords: ["한컴","hwp","한글"], icon: "🇰🇷" },
  { keywords: ["autocad","autodesk"], icon: "📐" },
  { keywords: ["vpn","보안","security"], icon: "🛡️" },
];

function getSwIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const { keywords, icon } of SW_ICON_MAP) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  return "💾";
}

// ────────────────────────────────────────────────────────────
// 클립보드 복사 버튼
// ────────────────────────────────────────────────────────────
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  if (!text) return <span className="text-xs text-gray-300">—</span>;
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all select-none ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
      }`}
      title={`${label} 복사`}
    >
      {copied ? "✓ 복사됨" : `📋 ${label}`}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function CredentialsPanel() {
  const [creds,   setCreds]   = useState<SwCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);  // 비밀번호 표시 중인 항목 ID

  useEffect(() => {
    fetch("/api/credentials")
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setCreds(res.data ?? []);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return creds;
    const q = search.toLowerCase();
    return creds.filter(c =>
      c.swName.toLowerCase().includes(q) ||
      c.accountId.toLowerCase().includes(q) ||
      c.memo.toLowerCase().includes(q)
    );
  }, [creds, search]);

  if (loading) return <div className="text-center py-20 text-gray-400">Notion 데이터 로딩 중...</div>;

  if (error) return (
    <div className="text-center py-20">
      <div className="text-3xl mb-3">⚠️</div>
      <div className="text-sm text-red-600 font-semibold mb-2">{error}</div>
      <p className="text-xs text-gray-400">
        .env.local에 <code className="bg-gray-100 px-1 rounded">NOTION_PAGE_CREDENTIALS</code> 페이지 ID가 설정되어 있는지 확인하세요.
      </p>
    </div>
  );

  return (
    <div className="fade-in">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">계정 관리 (ID/PW)</h2>
        <p className="text-sm text-gray-500">SW 관리 포털 계정 목록 — Notion 페이지 연동</p>
      </div>

      {/* ── 보안 안내 배너 ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-3">
        <span className="text-lg shrink-0">🔒</span>
        <div className="text-xs text-amber-800">
          <strong>관리자 전용 페이지입니다.</strong> 이 화면의 계정 정보는 내부망 또는 로그인된 관리자에게만 표시됩니다.
          비밀번호는 클릭 시 잠깐만 표시되며, 복사 후 바로 가려집니다.
        </div>
      </div>

      {/* ── 검색 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="SW명, 계정ID, 비고 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
          )}
        </div>
        <div className="text-right text-xs text-gray-400 mt-1.5">{filtered.length}개 계정</div>
      </div>

      {/* ── 빈 상태 ── */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm">{search ? "검색 결과가 없습니다." : "등록된 계정이 없습니다."}</div>
          {!search && (
            <p className="text-xs text-gray-400 mt-2">
              Notion ID/PW 페이지의 표에 데이터가 있는지 확인하세요.
            </p>
          )}
        </div>
      )}

      {/* ── 계정 카드 목록 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const icon = getSwIcon(c.swName);
          const isRevealed = revealId === c.id;
          return (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all hover:border-blue-200 flex flex-col gap-3"
            >
              {/* SW명 + 사이트 링크 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">{c.swName}</div>
                  {c.memo && <div className="text-xs text-gray-400 truncate mt-0.5">{c.memo}</div>}
                </div>
                {c.siteUrl && (
                  <a
                    href={c.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    title={`${c.swName} 관리 페이지 열기`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    사이트
                  </a>
                )}
              </div>

              {/* 구버선 */}
              <div className="border-t border-gray-100" />

              {/* 계정 ID */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12 shrink-0">아이디</span>
                <span className="flex-1 font-mono text-xs text-gray-800 truncate bg-gray-50 px-2 py-1 rounded border border-gray-100">
                  {c.accountId || "—"}
                </span>
                {c.accountId && <CopyBtn text={c.accountId} label="ID" />}
              </div>

              {/* 비밀번호 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12 shrink-0">비밀번호</span>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-mono text-xs px-2 py-1 rounded border flex-1 truncate select-none cursor-pointer transition-all ${
                      isRevealed
                        ? "bg-yellow-50 border-yellow-200 text-gray-800"
                        : "bg-gray-50 border-gray-100 text-gray-300 tracking-widest"
                    }`}
                    onClick={() => setRevealId(isRevealed ? null : c.id)}
                    title={isRevealed ? "클릭하여 숨기기" : "클릭하여 표시"}
                  >
                    {c.password ? (isRevealed ? c.password : "••••••••••") : "—"}
                  </span>
                  {c.password && (
                    <button
                      onClick={() => setRevealId(isRevealed ? null : c.id)}
                      className={`shrink-0 p-1.5 rounded-lg border text-xs transition-all ${
                        isRevealed
                          ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                          : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                      }`}
                      title={isRevealed ? "숨기기" : "보기"}
                    >
                      {isRevealed ? "🙈" : "👁"}
                    </button>
                  )}
                </div>
                {c.password && <CopyBtn text={c.password} label="PW" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 하단 안내 ── */}
      {creds.length > 0 && (
        <div className="mt-6 text-center text-xs text-gray-400">
          Notion ID/PW 페이지를 수정하면 다음 동기화 시 자동 반영됩니다.
        </div>
      )}
    </div>
  );
}

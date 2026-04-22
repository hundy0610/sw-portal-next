"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// 서버사이드 렌더링 없이 클라이언트에서만 로드
const OverviewPanel     = dynamic(() => import("@/components/admin/OverviewPanel"),     { ssr: false });
const LicensePanel      = dynamic(() => import("@/components/admin/LicensePanel"),      { ssr: false });
const CredentialsPanel  = dynamic(() => import("@/components/admin/CredentialsPanel"),  { ssr: false });
const SwDbPanel         = dynamic(() => import("@/components/admin/SwDbPanel"),         { ssr: false });
const ReportPanel       = dynamic(() => import("@/components/admin/ReportPanel"),       { ssr: false });
const HwPanel           = dynamic(() => import("@/components/admin/HwPanel"),           { ssr: false });
const AccountsPanel     = dynamic(() => import("@/components/admin/AccountsPanel"),     { ssr: false });
const AssetMapPanel     = dynamic(() => import("@/components/admin/AssetMapPanel"),     { ssr: false });

// ── 세션 타입 ──────────────────────────────────────────────────
interface SessionInfo {
  role: "super" | "company";
  company: string;
  name: string;
  userId: string;
  mustChangePassword?: boolean;
}

type PageId = "overview" | "license" | "credentials" | "swdb" | "report" | "hw" | "accounts" | "assetmap";

// ── 메뉴 정의 ──────────────────────────────────────────────────
const SUPER_MENU: { id: PageId; icon: string; label: string; desc: string }[] = [
  { id: "overview",   icon: "⚡", label: "대시보드",      desc: "현황 요약"              },
  { id: "license",    icon: "🔑", label: "라이선스 현황", desc: "영구 · 구독 통합"       },
  { id: "credentials",icon: "🔐", label: "계정 관리",     desc: "ID / PW 목록"           },
  { id: "swdb",       icon: "🗄", label: "SW DB 관리",    desc: "승인 / 금지 목록"       },
  { id: "report",     icon: "📊", label: "구독 리포트",   desc: "현황 분석 · 만료 알림"  },
  { id: "hw",         icon: "💻", label: "HW 자산 관리",  desc: "NT/DT 재고 · 반납 관리" },
  { id: "assetmap",   icon: "🗺", label: "스마트오피스 모니터 관리", desc: "인터랙티브 자산 맵"    },
  { id: "accounts",   icon: "👤", label: "계정 설정",     desc: "담당자 계정 관리"       },
];

const COMPANY_MENU: { id: PageId; icon: string; label: string; desc: string }[] = [
  { id: "hw",      icon: "💻", label: "HW 자산 관리",  desc: "NT/DT 재고 · 반납 관리" },
  { id: "license", icon: "🔑", label: "라이선스 현황", desc: "영구 · 구독 통합"       },
  { id: "report",  icon: "📊", label: "구독 리포트",   desc: "현황 분석 · 만료 알림"  },
];

export default function AdminPage() {
  const [session, setSession]   = useState<SessionInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState<PageId>("hw");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  // HW 통계 백그라운드 prefetch (경량 stats, ~수 KB)
  const [hwStatsPrefetch, setHwStatsPrefetch] = useState<any | null>(null);
  const hwFetchedRef = useRef(false);
  // 모니터 요청 알림 뱃지 (pending 건수)
  const [pendingMonitorCount, setPendingMonitorCount] = useState(0);
  const monitorPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // ── 세션 조회 ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/auth")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok) {
          router.replace("/admin/login");
          return;
        }
        // 비번 변경 필요 시 change-password 페이지로 이동
        if (data.mustChangePassword) {
          router.replace("/admin/change-password");
          return;
        }
        const s: SessionInfo = {
          role:    data.role,
          company: data.company ?? "",
          name:    data.name ?? "",
          userId:  data.userId ?? "",
        };
        setSession(s);
        // 법인 담당자 초기 페이지
        if (s.role === "company") setPage("hw");
        else setPage("overview");
        // HW 데이터 백그라운드 prefetch (stats + 전체 레코드 KV 워밍, 한 번만)
        if (!hwFetchedRef.current) {
          hwFetchedRef.current = true;
          // stats 먼저 (경량, KV 워밍 겸용 — 내부에서 hw:all도 함께 저장)
          fetch("/api/hw/stats")
            .then(r => r.json())
            .then(d => { if (d.ok && d.stats) setHwStatsPrefetch(d.stats); })
            .catch(() => {});
          // hw:all 별도 prefetch — stats KV 히트 시 hw:all은 안 채워지므로 병렬 요청
          fetch(`/api/hw${s.role === "company" && s.company ? `?company=${encodeURIComponent(s.company)}` : ""}`)
            .catch(() => {});
        }
      })
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // ── 모니터 요청 알림 폴링 (슈퍼어드민 / 총무 관리자용) ──────
  useEffect(() => {
    if (!session) return;

    function fetchPending() {
      fetch("/api/monitor-requests")
        .then(r => r.json())
        .then(data => {
          if (data.ok && Array.isArray(data.requests)) {
            const cnt = data.requests.filter((r: { status: string }) => r.status === "pending").length;
            setPendingMonitorCount(cnt);
          }
        })
        .catch(() => {});
    }

    fetchPending();
    monitorPollRef.current = setInterval(fetchPending, 60_000); // 1분마다 갱신
    return () => {
      if (monitorPollRef.current) clearInterval(monitorPollRef.current);
    };
  }, [session]);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  // Notion → Vercel KV 전체 동기화 (즉시 캐시 갱신)
  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setRefreshMsg(`✓ 동기화 완료 (${data.elapsed})`);
        // 패널 재로드를 위해 page를 잠깐 리셋 후 복원
        const cur = page;
        setPage("overview" as PageId);
        setTimeout(() => setPage(cur), 50);
      } else {
        setRefreshMsg("동기화 실패");
      }
    } catch {
      setRefreshMsg("동기화 실패");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 5000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F5F7" }}>
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!session) return null;

  const isSuper = session.role === "super";
  const menu    = isSuper ? SUPER_MENU : COMPANY_MENU;
  const company = session.company; // "" = 슈퍼어드민 (전체), "OO법인" = 법인 담당자

  // ── 패널 렌더링 ────────────────────────────────────────────
  function renderPanel() {
    switch (page) {
      case "overview":    return isSuper ? <OverviewPanel /> : null;
      case "license":     return <LicensePanel company={company} />;
      case "credentials": return isSuper ? <CredentialsPanel /> : null;
      case "swdb":        return isSuper ? <SwDbPanel /> : null;
      case "report":      return <ReportPanel company={company} />;
      case "hw":          return <HwPanel company={company} initialStats={hwStatsPrefetch} />;
      case "assetmap":    return <AssetMapPanel />;
      case "accounts":    return isSuper ? <AccountsPanel /> : null;
      default:            return null;
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── 상단 헤더 ── */}
      <header className="bg-white border-b border-gray-200 h-[52px] flex items-center px-5 gap-3 sticky top-0 z-40">
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          직원 포털로 이동
        </a>
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* 관리자 모드 뱃지 */}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${isSuper ? "bg-purple-600" : "bg-blue-600"}`}>
            <span className="text-white font-extrabold text-xs">{isSuper ? "SA" : "AD"}</span>
          </div>
          <div>
            <div className="font-bold text-xs text-gray-900">
              {isSuper ? "슈퍼 어드민" : `${company} 담당자`}
            </div>
            <div className="text-xs text-gray-400" style={{ fontSize: 10 }}>
              {session.name} ({session.userId})
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Notion 연동 상태 */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Notion 연동 중
          </div>

          {/* 새로고침 버튼 */}
          <div className="relative flex items-center">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
              title="Notion → KV 전체 데이터 동기화"
            >
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                className={refreshing ? "animate-spin" : ""}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {refreshing ? "동기화 중..." : "데이터 동기화"}
            </button>
            {refreshMsg && (
              <span className="absolute top-8 right-0 whitespace-nowrap text-xs bg-gray-800 text-white px-2 py-1 rounded shadow z-50">
                {refreshMsg}
              </span>
            )}
          </div>

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 px-2 py-1.5 rounded hover:bg-red-50 transition-colors"
            title="로그아웃"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            로그아웃
          </button>
        </div>
      </header>

      {/* ── 사이드바 + 콘텐츠 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <aside className="sidenav w-[220px] min-w-[220px] flex flex-col pt-4 pb-4 overflow-y-auto">
          <div className="sidenav-section">메뉴</div>
          {menu.map((m) => (
            <div
              key={m.id}
              className={`sidenav-item${page === m.id ? " active" : ""}`}
              onClick={() => {
                setPage(m.id);
                // 어사맵 진입 시 뱃지 즉시 숨김 (재진입 시 폴링이 갱신)
                if (m.id === "assetmap") setPendingMonitorCount(0);
              }}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <div className="flex flex-col leading-tight flex-1 min-w-0">
                <span>{m.label}</span>
                <span className="text-xs opacity-50">{m.desc}</span>
              </div>
              {/* 모니터 요청 대기 알림 뱃지 */}
              {m.id === "assetmap" && pendingMonitorCount > 0 && (
                <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                  {pendingMonitorCount > 99 ? "99+" : pendingMonitorCount}
                </span>
              )}
            </div>
          ))}

          {/* 법인 담당자: 소속 법인 표시 */}
          {!isSuper && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-white/10 border border-white/20">
              <div className="text-xs text-white/40 mb-1">소속 법인</div>
              <div className="text-sm font-bold text-white">{company}</div>
            </div>
          )}

          {/* 하단 Notion 바로가기 (슈퍼어드민만) */}
          {isSuper && (
            <div className="mt-auto mx-3 pt-4 border-t border-white/10">
              <div className="text-xs text-white/40 mb-2 px-1">Notion 바로가기</div>
              <a
                href={process.env.NEXT_PUBLIC_NOTION_TRACKER_URL || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>🗄</span> SW DB 편집
              </a>
              <a
                href={process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>📋</span> SW 데이터베이스
              </a>
              <a
                href="https://www.notion.so/29967f4bfdac8086b468ef3545b3e471"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>💻</span> NT/DT 트래커 (Notion)
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>🎫</span> 티켓 처리 (Notion)
              </a>
            </div>
          )}

          <div className="px-4 pt-2 mt-auto">
            <div className="text-xs text-white/30">v2.2.0 · 법인별 계정</div>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main
          className={`flex-1 overflow-y-auto ${page === "assetmap" ? "p-0" : "p-7"}`}
          style={{ background: page === "assetmap" ? "#F9FAFB" : "#F4F5F7" }}
        >
          <div className={page === "assetmap" ? "h-full" : "slide-in"}>{renderPanel()}</div>
        </main>
      </div>
    </div>
  );
}

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
const HelpDeskPanel     = dynamic(() => import("@/components/admin/HelpDeskPanel"),     { ssr: false });

// ── 세션 타입 ──────────────────────────────────────────────────
interface SessionInfo {
  role: "super" | "company";
  company: string;
  name: string;
  userId: string;
  mustChangePassword?: boolean;
}

type PageId = "overview" | "license" | "credentials" | "swdb" | "report" | "hw" | "accounts" | "assetmap" | "helpdesk";

// ── 메뉴 정의 ──────────────────────────────────────────────────
const SUPER_MENU: { id: PageId; icon: string; label: string; desc: string }[] = [
  { id: "overview",   icon: "⚡", label: "대시보드",      desc: "현황 요약"              },
  { id: "license",    icon: "🔑", label: "라이선스 현황", desc: "영구 · 구독 통합"       },
  { id: "credentials",icon: "🔐", label: "계정 관리",     desc: "ID / PW 목록"           },
  { id: "swdb",       icon: "🗄", label: "SW DB 관리",    desc: "승인 / 금지 목록"       },
  { id: "report",     icon: "📊", label: "구독 리포트",   desc: "현황 분석 · 만료 알림"  },
  { id: "hw",         icon: "💻", label: "HW 자산 관리",  desc: "NT/DT 재고 · 반납 관리" },
  { id: "assetmap",   icon: "🗺", label: "스마트오피스 모니터 관리", desc: "인터랙티브 자산 맵"    },
  { id: "helpdesk",   icon: "🎫", label: "문의 접수 현황", desc: "유형·법인별 분석"        },
  { id: "accounts",   icon: "👤", label: "계정 설정",     desc: "담당자 계정 관리"       },
];

const COMPANY_MENU: { id: PageId; icon: string; label: string; desc: string }[] = [
  { id: "overview",  icon: "⚡", label: "대시보드",      desc: "우리 법인 현황 요약"    },
  { id: "license",   icon: "🔑", label: "라이선스 현황", desc: "영구 · 구독 통합"       },
  { id: "report",    icon: "📊", label: "구독 리포트",   desc: "현황 분석 · 만료 알림"  },
  { id: "hw",        icon: "💻", label: "HW 자산 관리",  desc: "NT/DT 재고 · 반납 관리" },
  { id: "helpdesk",  icon: "🎫", label: "문의 접수 현황", desc: "우리 법인 문의 현황"   },
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
        // 초기 페이지: 둘 다 대시보드로 시작
        setPage("overview");
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

  // ── 모니터 요청 알림 폴링 (슈퍼어드민 전용) ─────────────────
  useEffect(() => {
    if (!session || session.role !== "super") return;

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-white font-extrabold text-[11px]"
            style={{ background: "var(--orange)" }}>SW</div>
          <div className="text-[13px] font-medium" style={{ color: "var(--text-4)" }}>로딩 중...</div>
        </div>
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
      case "overview":    return <OverviewPanel company={company} />;           // 슈퍼: company="" → 전체, 법인: company="OO" → 필터
      case "license":     return <LicensePanel company={company} />;
      case "credentials": return isSuper ? <CredentialsPanel /> : null;         // 슈퍼어드민 전용
      case "swdb":        return isSuper ? <SwDbPanel /> : null;                // 슈퍼어드민 전용
      case "report":      return <ReportPanel company={company} />;
      case "hw":          return <HwPanel company={company} initialStats={hwStatsPrefetch} />;
      case "assetmap":    return isSuper ? <AssetMapPanel /> : null;            // 슈퍼어드민 전용
      case "helpdesk":    return <HelpDeskPanel company={isSuper ? "" : company} />;
      case "accounts":    return isSuper ? <AccountsPanel /> : null;            // 슈퍼어드민 전용
      default:            return null;
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page-bg)" }}>

      {/* ── 사이드바 ── */}
      <aside className="sidenav flex flex-col w-[218px] min-w-[218px] fixed inset-y-0 left-0 z-40 overflow-y-auto">

        {/* 로고 영역 */}
        <div className="flex items-center gap-2.5 px-5 py-[17px]" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="sidenav-logo-mark">SW</div>
          <div>
            <div className="font-bold text-[12.5px] text-white leading-tight tracking-tight">관리자 포털</div>
            <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
              {isSuper ? "슈퍼 어드민" : `${company} 담당자`}
            </div>
          </div>
        </div>

        {/* 역할 배지 */}
        <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-[8px]" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[5px] flex items-center justify-center text-[10px] font-extrabold text-white"
              style={{ background: isSuper ? "#7C3AED" : "#1648CC" }}>
              {isSuper ? "SA" : "AD"}
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white leading-tight">{session.name}</div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.38)" }}>{session.userId}</div>
            </div>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="sidenav-section">메뉴</div>
        <div className="flex flex-col gap-px px-1">
          {menu.map((m) => (
            <div
              key={m.id}
              className={`sidenav-item${page === m.id ? " active" : ""}`}
              onClick={() => {
                setPage(m.id);
                if (m.id === "assetmap") setPendingMonitorCount(0);
              }}
            >
              <span className="sidenav-icon" style={{ fontSize: 13 }}>{m.icon}</span>
              <div className="flex flex-col leading-snug flex-1 min-w-0">
                <span className="text-[13px]">{m.label}</span>
                <span className="text-[10.5px]" style={{ color: "rgba(255,255,255,0.28)" }}>{m.desc}</span>
              </div>
              {m.id === "assetmap" && pendingMonitorCount > 0 && (
                <span className="ml-auto flex-shrink-0 min-w-[17px] h-[17px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                  {pendingMonitorCount > 99 ? "99+" : pendingMonitorCount}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 법인 담당자: 소속 법인 */}
        {!isSuper && (
          <div className="mx-4 mt-3 px-3 py-2.5 rounded-[8px]" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-[10px] font-semibold mb-1" style={{ color: "rgba(255,255,255,0.38)" }}>소속 법인</div>
            <div className="text-[13px] font-bold text-white">{company}</div>
          </div>
        )}

        {/* Notion 바로가기 (슈퍼어드민) */}
        {isSuper && (
          <div className="mt-auto mx-3 pt-3 pb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest px-2 mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>Notion</div>
            {[
              { href: process.env.NEXT_PUBLIC_NOTION_TRACKER_URL || "#", icon: "🗄", label: "SW DB 편집" },
              { href: process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#", icon: "📋", label: "SW 데이터베이스" },
              { href: "https://www.notion.so/29967f4bfdac8086b468ef3545b3e471", icon: "💻", label: "NT/DT 트래커" },
            ].map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-[11.5px] transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
              >
                <span>{link.icon}</span> {link.label}
              </a>
            ))}
          </div>
        )}

        <div className="px-5 py-3">
          <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>v2.2.0</div>
        </div>
      </aside>

      {/* ── 우측 영역 ── */}
      <div className="flex flex-col flex-1 ml-[218px]">

        {/* 상단 헤더 */}
        <header className="admin-header">
          <a href="/"
            className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-[6px] transition-colors"
            style={{ color: "var(--slate-500)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--slate-100)"; (e.currentTarget as HTMLElement).style.color = "var(--slate-900)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--slate-500)"; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            직원 포털
          </a>

          <div className="w-px h-4 mx-1" style={{ background: "var(--slate-200)" }} />

          <div className="text-[13px] font-semibold" style={{ color: "var(--slate-700)" }}>
            {menu.find(m => m.id === page)?.label ?? "대시보드"}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Notion 연동 */}
            <div className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-[6px]"
              style={{ color: "var(--slate-400)", background: "var(--slate-50)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Notion 연동
            </div>

            {/* 동기화 */}
            <div className="relative">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-ghost disabled:opacity-50"
                style={{ fontSize: 11.5 }}
                title="Notion → KV 전체 데이터 동기화"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={refreshing ? "animate-spin" : ""}>
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                {refreshing ? "동기화 중..." : "동기화"}
              </button>
              {refreshMsg && (
                <span className="absolute top-9 right-0 whitespace-nowrap text-[11px] px-2.5 py-1 rounded-[6px] shadow-lg z-50"
                  style={{ background: "var(--slate-900)", color: "#fff" }}>
                  {refreshMsg}
                </span>
              )}
            </div>

            {/* 로그아웃 */}
            <button onClick={handleLogout}
              className="flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1.5 rounded-[6px] transition-colors"
              style={{ color: "var(--slate-400)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; (e.currentTarget as HTMLElement).style.color = "#DC2626"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--slate-400)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              로그아웃
            </button>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main
          className={`flex-1 overflow-y-auto ${page === "assetmap" ? "p-0" : "p-6"}`}
          style={{ background: page === "assetmap" ? "var(--slate-50)" : "var(--page-bg)" }}
        >
          <div className={page === "assetmap" ? "h-full" : "slide-in"}>{renderPanel()}</div>
        </main>
      </div>
    </div>
  );
}

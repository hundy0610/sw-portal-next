"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { safeJson } from "@/lib/fetch-json";

// 서버사이드 렌더링 없이 클라이언트에서만 로드
const DashboardHome     = dynamic(() => import("@/components/admin/DashboardHome"),     { ssr: false });
const OverviewPanel     = dynamic(() => import("@/components/admin/OverviewPanel"),     { ssr: false });
const LicensePanel      = dynamic(() => import("@/components/admin/LicensePanel"),      { ssr: false });
const CredentialsPanel  = dynamic(() => import("@/components/admin/CredentialsPanel"),  { ssr: false });
const SwDbPanel         = dynamic(() => import("@/components/admin/SwDbPanel"),         { ssr: false });
const ReportPanel       = dynamic(() => import("@/components/admin/ReportPanel"),       { ssr: false });
const HwPanel           = dynamic(() => import("@/components/admin/HwPanel"),           { ssr: false });
const AccountsPanel     = dynamic(() => import("@/components/admin/AccountsPanel"),     { ssr: false });
const AssetMapPanel     = dynamic(() => import("@/components/admin/AssetMapPanel"),     { ssr: false });
const HelpDeskPanel     = dynamic(() => import("@/components/admin/HelpDeskPanel"),     { ssr: false });
const ContractPanel     = dynamic(() => import("@/components/admin/ContractPanel"),     { ssr: false });
const RepairPanel       = dynamic(() => import("@/components/admin/RepairPanel"),       { ssr: false });
const RentalHwPanel     = dynamic(() => import("@/components/admin/RentalHwPanel"),     { ssr: false });
const HwRepairPanel          = dynamic(() => import("@/components/admin/HwRepairPanel"),          { ssr: false });
const ExchangeReturnPanel    = dynamic(() => import("@/components/admin/ExchangeReturnPanel"),    { ssr: false });
const WorkFeedbackPanel      = dynamic(() => import("@/components/admin/WorkFeedbackPanel"),      { ssr: false });
const BugReportPanel         = dynamic(() => import("@/components/admin/BugReportPanel"),         { ssr: false });
const WorkTrackerPanel        = dynamic(() => import("@/components/admin/WorkTrackerPanel"),       { ssr: false });
const MeetingRentalPanel      = dynamic(() => import("@/components/admin/MeetingRentalPanel"),      { ssr: false });
const RenewalAlertModal       = dynamic(() => import("@/components/admin/RenewalAlertModal"),       { ssr: false });
const NotificationBell        = dynamic(() => import("@/components/admin/NotificationBell"),        { ssr: false });
const AuditLogPanel           = dynamic(() => import("@/components/admin/AuditLogPanel"),           { ssr: false });
const SurveyDemandPanel       = dynamic(() => import("@/components/admin/SurveyDemandPanel"),       { ssr: false });
const PcScanPanel             = dynamic(() => import("@/components/admin/PcScanPanel"),             { ssr: false });

// ── 세션 타입 ──────────────────────────────────────────────────
interface SessionInfo {
  role: "super" | "company" | "general";
  company: string;
  name: string;
  userId: string;
  mustChangePassword?: boolean;
}

type PageId = "home" | "overview" | "license" | "credentials" | "swdb" | "report" | "hw" | "rental-hw" | "accounts" | "assetmap" | "helpdesk" | "contracts" | "repair" | "hw-repair" | "exchange-return" | "work-feedback" | "worktracker" | "meeting-rental" | "audit" | "survey-demand" | "pc-scan";

// 슈퍼어드민 전용 페이지 (company 계정은 접근 불가)
const SUPER_ONLY_PAGES = new Set<PageId>(["credentials", "swdb", "accounts", "contracts", "rental-hw", "hw-repair", "exchange-return", "work-feedback", "worktracker", "meeting-rental", "audit", "pc-scan"]);

// ── 메뉴 정의 ──────────────────────────────────────────────────
type MenuItem = { id: PageId; icon: string; label: string; desc: string };
type MenuGroup = { label: string; items: MenuItem[] };

const SUPER_GROUPS: MenuGroup[] = [
  {
    label: "",
    items: [
      { id: "home",    icon: "",   label: "대시보드",  desc: "전사 현황 요약" },
    ],
  },
  {
    label: "하드웨어 자산",
    items: [
      { id: "exchange-return", icon: "",   label: "자산 흐름 관리",           desc: "기기 교체 · 반납 처리 관리" },
      { id: "hw",              icon: "",   label: "노트북/데스크탑 자산관리", desc: "NT/DT 재고 · 반납 관리"     },
      { id: "hw-repair",       icon: "",   label: "수리/과실청구 트래커",     desc: "외부 수리 · 과실 청구 관리" },
      { id: "rental-hw",       icon: "",   label: "임대노트북 현황 관리",     desc: "임시 PC 대여 · 반납 관리"   },
      { id: "assetmap",        icon: "",   label: "스마트오피스 모니터 관리", desc: "인터랙티브 자산 맵"         },
      { id: "pc-scan",         icon: "",   label: "온라인 자산 실사",         desc: "WPF 에이전트 PC 수집 데이터" },
    ],
  },
  {
    label: "소프트웨어 자산",
    items: [
      { id: "overview",    icon: "",   label: "전사 라이선스 현황",      desc: "현황 요약"             },
      { id: "license",     icon: "",   label: "상용 라이선스 자산관리",  desc: "영구 · 구독 통합"      },
      { id: "credentials", icon: "",   label: "계정 관리",               desc: "ID / PW 목록"          },
      { id: "swdb",        icon: "",   label: "라이선스 설치 정책 관리", desc: "승인 / 금지 목록"      },
      { id: "report",      icon: "",   label: "구독형 라이선스 현황",    desc: "현황 분석 · 만료 알림" },
    ],
  },
  {
    label: "사용자 지원",
    items: [
      { id: "helpdesk",   icon: "",   label: "문의 접수 현황",  desc: "유형·법인별 분석"       },
      { id: "repair",     icon: "",   label: "모니터 수리 접수 내역",  desc: "모니터 수리 접수 · 처리" },
      { id: "meeting-rental", icon: "", label: "회의실 장비 대여 관리", desc: "신청 티켓 · 장비 현황 통합 관리" },
      { id: "survey-demand", icon: "", label: "업무 툴 수요조사", desc: "번역 툴 수요 응답 관리" },
    ],
  },
  {
    label: "관리",
    items: [
      { id: "accounts",      icon: "",   label: "계정 권한 설정", desc: "담당자 계정 관리"    },
      { id: "contracts",     icon: "",   label: "계약 관리",       desc: "PC/OA 유지보수 계약" },
      { id: "work-feedback", icon: "",   label: "업무 피드백",     desc: "연/월/주간 목표 관리" },
      { id: "bugreport",     icon: "",   label: "버그리포트",      desc: "버그 및 개선요청 관리" },
      { id: "worktracker",   icon: "",   label: "작업 트래커",     desc: "개인 작업 칸반 관리"   },
      { id: "audit",         icon: "",   label: "감사 로그",       desc: "관리자 변경 이력"     },
    ],
  },
];

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
      <p className="text-sm font-medium">— 접근권한이 없습니다. —</p>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession]   = useState<SessionInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState<PageId>("home");

  const [renewalAlertOpen,  setRenewalAlertOpen]  = useState(false);
  const [renewalCount,      setRenewalCount]      = useState(0);

  const [darkMode,        setDarkMode]        = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("admin-dark");
    if (saved !== null) return saved === "1";
    // 저장된 설정이 없으면 기기의 다크모드 여부를 따른다
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("admin-sidebar-collapsed") === "1";
    return false;
  });
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
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
      .then(r => safeJson(r))
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
        // 초기 페이지: 홈 대시보드
        setPage("home");
        // HW 데이터 백그라운드 prefetch (stats + 전체 레코드 KV 워밍, 한 번만)
        if (!hwFetchedRef.current) {
          hwFetchedRef.current = true;
          const companyParam = s.role === "company" && s.company ? `?company=${encodeURIComponent(s.company)}` : "";
          // stats 먼저 (법인 담당자면 법인 필터 적용)
          fetch(`/api/hw/stats${companyParam}`)
            .then(r => safeJson(r))
            .then(d => { if (d.ok && d.stats) setHwStatsPrefetch(d.stats); })
            .catch(() => {});
          // hw:all 별도 prefetch — stats KV 히트 시 hw:all은 안 채워지므로 병렬 요청
          fetch(`/api/hw${companyParam}`)
            .catch(() => {});
        }
      })
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // ── 모니터 요청 알림 폴링 (슈퍼어드민 전용) ─────────────────
  useEffect(() => {
    if (!session || (session.role !== "super" && session.role !== "general")) return;

    function fetchPending() {
      fetch("/api/monitor-requests")
        .then(r => safeJson(r))
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


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAFA" }}>
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!session) return null;

  const isSuper = session.role === "super";
  const groups  = SUPER_GROUPS;
  const company = session.company;

  function canAccess(id: PageId) {
    return isSuper || !SUPER_ONLY_PAGES.has(id);
  } // "" = 슈퍼어드민 (전체), "OO법인" = 법인 담당자

  // ── 패널 렌더링 ────────────────────────────────────────────
  function renderPanel() {
    switch (page) {
      case "home":        return <DashboardHome company={company} initialHwStats={hwStatsPrefetch} onNavigate={(p) => setPage(p as PageId)} />;
      case "overview":    return <OverviewPanel company={company} />;           // 슈퍼: company="" → 전체, 법인: company="OO" → 필터
      case "license":     return <LicensePanel company={company} />;
      case "credentials": return canAccess("credentials") ? <CredentialsPanel /> : <AccessDenied />;
      case "swdb":        return canAccess("swdb")        ? <SwDbPanel />       : <AccessDenied />;
      case "report":      return <ReportPanel company={company} />;
      case "hw":          return <HwPanel company={company} initialStats={hwStatsPrefetch} isSuperAdmin={isSuper} />;
      case "rental-hw":   return canAccess("rental-hw") ? <RentalHwPanel /> : <AccessDenied />;
      case "meeting-rental": return canAccess("meeting-rental") ? <MeetingRentalPanel /> : <AccessDenied />;
      case "assetmap":    return <AssetMapPanel session={session} />;
      case "helpdesk":    return <HelpDeskPanel company={isSuper ? "" : company} currentUserName={session?.name ?? ""} />;
      case "repair":      return <RepairPanel company={company} />;
      case "hw-repair":        return canAccess("hw-repair")        ? <HwRepairPanel />        : <AccessDenied />;
      case "exchange-return":  return canAccess("exchange-return")  ? <ExchangeReturnPanel /> : <AccessDenied />;
      case "accounts":    return canAccess("accounts")    ? <AccountsPanel isSuperAdmin={session?.role === "super"} />   : <AccessDenied />;
      case "contracts":     return canAccess("contracts")   ? <ContractPanel />   : <AccessDenied />;
      case "audit":         return canAccess("audit")       ? <AuditLogPanel />   : <AccessDenied />;
      case "survey-demand": return <SurveyDemandPanel />;
      case "work-feedback": return canAccess("work-feedback") ? <WorkFeedbackPanel session={{ role: session.role, userId: session.userId, name: session.name }} /> : <AccessDenied />;
      case "bugreport":     return <BugReportPanel />;
      case "worktracker":   return canAccess("worktracker") ? <WorkTrackerPanel session={{ userId: session.userId, name: session.name }} /> : <AccessDenied />;
      case "pc-scan":       return canAccess("pc-scan") ? <PcScanPanel /> : <AccessDenied />;
      default:            return null;
    }
  }

  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("admin-dark", next ? "1" : "0");
      document.documentElement.classList.toggle("admin-dark", next);
      window.dispatchEvent(new CustomEvent("admin-dark-change", { detail: next }));
      return next;
    });
  }
  function toggleSidebar() {
    setSidebarCollapsed(c => {
      const next = !c;
      localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className={`admin-root flex flex-col min-h-screen${darkMode ? " admin-dark" : ""}`}>
      {/* ── 상단 헤더 ── */}
      <header className="admin-header bg-white border-b border-gray-200 h-[52px] flex items-center px-5 gap-3 sticky top-0 z-40">
        {/* 사이드바 토글 */}
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700 flex-shrink-0"
          title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {sidebarCollapsed ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              <polyline points="13 8 17 12 13 16"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              <polyline points="15 8 11 12 15 16"/>
            </svg>
          )}
        </button>

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

          {/* 갱신 알림 벨 */}
          <button
            onClick={() => setRenewalAlertOpen(true)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-amber-500"
            title="구독 갱신 알림"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {renewalCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5">
                {renewalCount > 99 ? "99+" : renewalCount}
              </span>
            )}
          </button>

          {/* 알림센터 (슈퍼어드민 전용) */}
          {isSuper && <NotificationBell onNavigate={(p) => setPage(p as PageId)} />}

          {/* 다크모드 토글 */}
          <button
            onClick={toggleDark}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors"
            title={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {darkMode ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            {darkMode ? "라이트" : "다크"}
          </button>


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
      <div className="flex flex-1 overflow-hidden relative">

        {/* 왼쪽 사이드바 */}
        <aside
          className="sidenav flex flex-col pt-4 pb-4 overflow-y-auto overflow-x-hidden flex-shrink-0"
          style={{
            width:      sidebarCollapsed ? 0 : 220,
            minWidth:   sidebarCollapsed ? 0 : 220,
            opacity:    sidebarCollapsed ? 0 : 1,
            visibility: sidebarCollapsed ? "hidden" : "visible",
            transition: "width 0.22s ease, min-width 0.22s ease, opacity 0.18s ease",
          }}
        >
          {groups.map((group, gi) => {
            const groupKey = group.label || "__home";
            const hasLabel = !!group.label;
            const isActiveGroup = group.items.some(m => m.id === page);
            const isExpanded = !hasLabel || isActiveGroup || hoveredGroup === groupKey;
            return (
              <div
                key={groupKey}
                onMouseEnter={() => hasLabel && setHoveredGroup(groupKey)}
                onMouseLeave={() => setHoveredGroup(null)}
              >
                {gi > 0 && !hasLabel && <div className="sidenav-divider" />}
                {hasLabel && (
                  <div className={`sidenav-section${gi > 0 ? " mt-1" : ""} cursor-default select-none`}>
                    {group.label}
                    <span className="ml-auto text-white/30 text-[10px] transition-transform duration-200"
                      style={{ display: "inline-block", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
                      ▾
                    </span>
                  </div>
                )}
                <div style={{
                  maxHeight: isExpanded ? `${group.items.length * 60}px` : "0px",
                  overflow: "hidden",
                  transition: "max-height 0.22s ease",
                }}>
                  {group.items.map((m) => {
                    const accessible = canAccess(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`sidenav-item${page === m.id ? " active" : ""}${!accessible ? " opacity-40" : ""}`}
                        title={accessible ? m.label : "접근권한이 없습니다"}
                        style={{ cursor: accessible ? "pointer" : "default" }}
                        onClick={() => {
                          setPage(m.id);
                          if (m.id === "assetmap") setPendingMonitorCount(0);
                        }}
                      >
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{accessible ? m.icon : ""}</span>
                        <div className="flex flex-col leading-tight flex-1 min-w-0">
                          <span className="truncate">{m.label}</span>
                          <span className="text-xs opacity-50 truncate">
                            {accessible ? m.desc : "접근권한이 없습니다"}
                          </span>
                        </div>
                        {accessible && m.id === "assetmap" && pendingMonitorCount > 0 && (
                          <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                            {pendingMonitorCount > 99 ? "99+" : pendingMonitorCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 법인 담당자: 소속 법인 표시 */}
          {!isSuper && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-white/10 border border-white/20">
              <div className="text-xs text-white/40 mb-1">소속 법인</div>
              <div className="text-sm font-bold text-white">{company}</div>
            </div>
          )}

          <div className="px-4 pt-2 mt-auto">
            <div className="text-xs text-white/30">
              v{process.env.NEXT_PUBLIC_APP_VERSION} · {isSuper ? "슈퍼 어드민" : session.role === "general" ? "총무관리자" : "법인 담당자"}
            </div>
          </div>
        </aside>

        {/* 사이드바 숨김 시 — 좌측 고정 열기 버튼 */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="absolute left-0 top-6 z-30 flex items-center justify-center w-5 h-10 rounded-r-lg border border-l-0 border-white/10 hover:border-white/25 transition-colors"
            style={{ background: "var(--sidebar-bg)" }}
            title="사이드바 열기"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}

        {/* 메인 콘텐츠 */}
        <main
          className={`admin-main flex-1 overflow-y-auto ${page === "assetmap" ? "p-0" : "p-7"}`}
          style={{ background: page === "assetmap" ? "#F9FAFB" : "var(--admin-content-bg, #F4F5F7)" }}
        >
          <div className={page === "assetmap" ? "h-full" : "slide-in"}>{renderPanel()}</div>
        </main>
      </div>

      {/* 전역 갱신 알림 모달 (헤더 벨 클릭 시 표시) */}
      <RenewalAlertModal
        company={session?.company || ""}
        open={renewalAlertOpen}
        onClose={() => setRenewalAlertOpen(false)}
        onCountChange={setRenewalCount}
      />
    </div>
  );
}

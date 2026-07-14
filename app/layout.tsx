import type { Metadata } from "next";
import "./globals.css";

// TEST 브랜치 Vercel 배포에서만 탭 제목 뒤에 "테스트"를 붙여 프로덕션과 구분한다.
const isTestDeploy = process.env.VERCEL_GIT_COMMIT_REF === "TEST";

export const metadata: Metadata = {
  title: isTestDeploy ? "IdsTrust 자산 관리 포털 테스트" : "IdsTrust 자산 관리 포털",
  description: "전사 소프트웨어 자산 관리 시스템",
  icons: {
    icon: "/favicon.svg",
  },
};

// 다크모드 클래스를 React 하이드레이션 전에 <html>에 미리 적용 — 그렇지 않으면
// 서버 렌더링(항상 라이트)과 클라이언트 첫 렌더 사이에 라이트→다크 깜빡임이 발생함.
const DARK_MODE_INIT_SCRIPT = `
(function () {
  try {
    function isDark(key) {
      var saved = localStorage.getItem(key);
      if (saved !== null) return saved === "1";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    // /admin과 포털(그 외 전체 경로)은 서로 독립된 다크모드 설정("admin-dark"/"portal-dark")을
    // 갖는데, 두 클래스를 동시에 <html>에 적용하면 각 클래스에 대응하는 전역 오버라이드
    // (.admin-dark .bg-white, .portal-dark .bg-white 등)가 서로 뒤섞여 매칭되어
    // 현재 페이지와 무관한 팔레트가 섞여 보이는 문제가 있었음 — 현재 경로에 해당하는
    // 클래스 하나만 적용해 두 다크모드 체계가 절대 동시에 활성화되지 않도록 함.
    var isAdminRoute = location.pathname.indexOf("/admin") === 0;
    var key = isAdminRoute ? "admin-dark" : "portal-dark";
    var cls = isAdminRoute ? "admin-dark" : "portal-dark";
    if (isDark(key)) document.documentElement.classList.add(cls);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

const isTest = process.env.VERCEL_GIT_COMMIT_REF === "TEST";

export const metadata: Metadata = {
  title: isTest ? "IdsTrust 자산 관리 포털-테스트" : "IdsTrust 자산 관리 포털",
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
    var cls = [];
    if (isDark("portal-dark")) cls.push("portal-dark");
    if (isDark("admin-dark")) cls.push("admin-dark");
    if (cls.length) document.documentElement.classList.add.apply(document.documentElement.classList, cls);
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

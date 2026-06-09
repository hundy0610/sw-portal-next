import type { Metadata } from "next";
import "./globals.css";
import BugReportButton from "@/components/BugReportButton";

export const metadata: Metadata = {
  title: "SW 자산관리 포털",
  description: "전사 소프트웨어 자산 관리 시스템",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <BugReportButton />
      </body>
    </html>
  );
}

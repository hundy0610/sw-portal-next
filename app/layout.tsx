import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SW 자산관리 포털",
  description: "전사 소프트웨어 자산 관리 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SW 자산관리 — 관리자",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SW Admin",
  },
  icons: {
    apple: [{ url: "/api/pwa-icon/180", sizes: "180x180", type: "image/png" }],
    icon:  [{ url: "/api/pwa-icon/192", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#18181B",
};

export default function MobileAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

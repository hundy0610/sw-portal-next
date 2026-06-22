import type { Metadata } from "next";
import { Providers } from "@/shared/lib/provider";

export const metadata: Metadata = {
  title: "Assetify Desk",
  description: "자산 관련 문의, 수리 요청, 재고조사 웹서비스",
};

export default function RequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="assetify-root">
      <Providers>{children}</Providers>
    </div>
  );
}

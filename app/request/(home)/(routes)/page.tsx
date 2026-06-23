"use client";

import MenuButton from "@/app/request/(home)/(components)/menuButton";
import { useStocktakingInfo } from "@/app/request/(home)/(hooks)/useStocktakingInfo";
import Container from "@/shared/components/common/container";
import Header from "@/shared/components/common/header";
import LoadingComponent from "@/shared/components/common/loadingComponent";

export default function Home() {
  const { data: stocktakingInfo, isLoading } = useStocktakingInfo();

  if (isLoading) {
    return <LoadingComponent />;
  }

  return (
    <Container className="items-center md:h-dvh md:justify-center">
      <Header title="Assetify" highlighted="Desk" />
      <div className="grid w-full max-w-3xl grid-cols-1 gap-spacing-400 md:grid-cols-2">
        <MenuButton
          href="/request/inquiry"
          title="문의하기"
          description="노트북, 데스크탑, 라이선스 등 문의를 접수할 수 있어요."
        />
        <MenuButton
          href="/request/repair"
          title="모니터 수리 접수"
          description="모니터 고장 시 수리를 접수할 수 있어요."
        />
        {stocktakingInfo && (
          <MenuButton
            href="/request/stocktaking"
            title={stocktakingInfo.실사제목 || "재고조사"}
            description={`${stocktakingInfo.시작날짜} ~ ${stocktakingInfo.끝날짜}`}
          />
        )}
        <MenuButton
          href="/request/meeting-rental"
          title="회의실 무선 장비 대여신청"
          description="회의실용 무선 장비 대여를 신청할 수 있어요."
        />
      </div>
    </Container>
  );
}

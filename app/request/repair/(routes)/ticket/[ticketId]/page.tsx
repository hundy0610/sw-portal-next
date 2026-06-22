"use client";

import { useAtomValue } from "jotai";
import {
  RepairTicketCreatedTimeAtom,
  RepairTicket건물명Atom,
  RepairTicket고장내역Atom,
  RepairTicket과실여부Atom,
  RepairTicket단가Atom,
  RepairTicket담당자Atom,
  RepairTicket모니터번호Atom,
  RepairTicket문의자Atom,
  RepairTicket법인Atom,
  RepairTicket부서Atom,
  RepairTicket상태Atom,
  RepairTicket세부내역Atom,
  RepairTicket수리일정Atom,
  RepairTicket수리진행상황Atom,
  RepairTicket조치내용Atom,
  RepairTicket층수Atom,
} from "@/app/request/repair/(atoms)/useRepairTicketStore";
import { useRepairTicket } from "@/app/request/repair/(hooks)/useRepairTicket";
import Container from "@/shared/components/common/container";
import ErrorComponent from "@/shared/components/common/errorComponent";
import Header from "@/shared/components/common/header";
import LoadingComponent from "@/shared/components/common/loadingComponent";
import CopyLinkButton from "@/shared/components/form/copyLinkButton";
import { FormFieldList } from "@/shared/components/form/form-fields";
import { TicketDetailCard, TicketDetailInfo, TicketDetailStatus } from "@/shared/components/form/ticketDetailCards";
import formatDateTime from "@/shared/utils/formatDateTime";
import formatPrice from "@/shared/utils/formatPrice";

export default function RepairTicket({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;
  const { isLoading, error } = useRepairTicket(ticketId);

  const 법인 = useAtomValue(RepairTicket법인Atom);
  const 부서 = useAtomValue(RepairTicket부서Atom);
  const 문의자 = useAtomValue(RepairTicket문의자Atom);
  const 건물명 = useAtomValue(RepairTicket건물명Atom);
  const 층수 = useAtomValue(RepairTicket층수Atom);
  const 모니터번호 = useAtomValue(RepairTicket모니터번호Atom);
  const 고장내역 = useAtomValue(RepairTicket고장내역Atom);
  const 세부내역 = useAtomValue(RepairTicket세부내역Atom);
  const 상태 = useAtomValue(RepairTicket상태Atom);
  const 조치내용 = useAtomValue(RepairTicket조치내용Atom);
  const 담당자 = useAtomValue(RepairTicket담당자Atom);
  const 과실여부 = useAtomValue(RepairTicket과실여부Atom);
  const 수리일정 = useAtomValue(RepairTicket수리일정Atom);
  const 단가 = useAtomValue(RepairTicket단가Atom);
  const 수리진행상황 = useAtomValue(RepairTicket수리진행상황Atom);
  const createdTime = useAtomValue(RepairTicketCreatedTimeAtom);

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return <ErrorComponent errorMessage={error.message} />;
  }

  return (
    <Container>
      <Header title="Repair" highlighted="Ticket" />
      <span className="flex flex-row flex-wrap items-center justify-center gap-x-spacing-200 text-center text-content-standard-secondary text-label">
        앞으로 이 링크로 수리 내용과 진행 상황을 확인할 수 있어요.
        <CopyLinkButton />
      </span>
      <FormFieldList>
        <div className="grid w-full gap-spacing-400 md:grid-cols-2">
          <TicketDetailStatus label="상태" value={상태} />
          <TicketDetailStatus label="담당자" value={담당자} />
        </div>
        <TicketDetailCard className="flex flex-col gap-spacing-100 divide-y divide-line-divider">
          <TicketDetailInfo label="수리 진행 상황" value={수리진행상황} />
          <TicketDetailInfo label="과실 여부" value={과실여부} />
          <TicketDetailInfo label="단가" value={formatPrice(단가)} />
          <TicketDetailInfo label="조치 내용" value={조치내용} />
          <TicketDetailInfo label="수리 일정" value={수리일정} />
        </TicketDetailCard>
        <TicketDetailCard className="flex flex-col gap-spacing-100 divide-y divide-line-divider">
          <TicketDetailInfo label="법인" value={법인} />
          <TicketDetailInfo label="부서" value={부서} />
          <TicketDetailInfo label="문의자" value={문의자} />
          <TicketDetailInfo label="건물명" value={건물명} />
          <TicketDetailInfo label="층수" value={층수} />
          <TicketDetailInfo label="모니터 번호" value={모니터번호} />
          <TicketDetailInfo label="고장 내역" value={고장내역} />
          <TicketDetailInfo label="세부 내역" value={세부내역} />
          <TicketDetailInfo label="제출 날짜" value={formatDateTime(createdTime)} />
        </TicketDetailCard>
      </FormFieldList>
    </Container>
  );
}

"use client";

import { useAtomValue } from "jotai";
import {
  InquiryTicketCreatedTimeAtom,
  InquiryTicket긴급도Atom,
  InquiryTicket담당자Atom,
  InquiryTicket문의내용Atom,
  InquiryTicket문의유형Atom,
  InquiryTicket문의자Atom,
  InquiryTicket법인Atom,
  InquiryTicket부서Atom,
  InquiryTicket상태Atom,
  InquiryTicket자산번호Atom,
} from "@/app/request/inquiry/(atoms)/useInquiryTicketStore";
import { useInquiryTicket } from "@/app/request/inquiry/(hooks)/useInquiryTicket";
import ManualSuggestion from "@/app/request/inquiry/(components)/manualSuggestion";
import Container from "@/shared/components/common/container";
import ErrorComponent from "@/shared/components/common/errorComponent";
import Header from "@/shared/components/common/header";
import LoadingComponent from "@/shared/components/common/loadingComponent";
import CopyLinkButton from "@/shared/components/form/copyLinkButton";
import { FormFieldList } from "@/shared/components/form/form-fields";
import { TicketDetailCard, TicketDetailInfo, TicketDetailStatus } from "@/shared/components/form/ticketDetailCards";
import formatDateTime from "@/shared/utils/formatDateTime";

export default function InquiryTicket({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;
  const { isLoading, error } = useInquiryTicket(ticketId);

  const 법인 = useAtomValue(InquiryTicket법인Atom);
  const 부서 = useAtomValue(InquiryTicket부서Atom);
  const 문의자 = useAtomValue(InquiryTicket문의자Atom);
  const 자산번호 = useAtomValue(InquiryTicket자산번호Atom);
  const 문의유형 = useAtomValue(InquiryTicket문의유형Atom);
  const 문의내용 = useAtomValue(InquiryTicket문의내용Atom);
  const 긴급도 = useAtomValue(InquiryTicket긴급도Atom);
  const 상태 = useAtomValue(InquiryTicket상태Atom);
  const 담당자 = useAtomValue(InquiryTicket담당자Atom);
  const createdTime = useAtomValue(InquiryTicketCreatedTimeAtom);

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return <ErrorComponent errorMessage={error.message} />;
  }

  return (
    <Container>
      <Header title="Inquiry" highlighted="Ticket" />
      <span className="flex flex-row flex-wrap items-center justify-center gap-x-spacing-200 text-center text-content-standard-secondary text-label">
        앞으로 이 링크로 문의 내용과 진행 상황을 확인할 수 있어요.
        <CopyLinkButton />
      </span>
      <ManualSuggestion content={문의내용} />
      <FormFieldList>
        <div className="grid w-full gap-spacing-400 md:grid-cols-2">
          <TicketDetailStatus label="상태" value={상태} />
          <TicketDetailStatus label="담당자" value={담당자} />
        </div>
        <TicketDetailCard className="flex flex-col gap-spacing-100 divide-y divide-line-divider">
          <TicketDetailInfo label="법인" value={법인} />
          <TicketDetailInfo label="부서" value={부서} />
          <TicketDetailInfo label="문의자" value={문의자} />
          <TicketDetailInfo label="자산 번호" value={자산번호} />
          <TicketDetailInfo label="문의 유형" value={문의유형} />
          <TicketDetailInfo label="문의 내용" value={문의내용} />
          <TicketDetailInfo label="긴급도" value={긴급도} />
          <TicketDetailInfo label="제출 날짜" value={formatDateTime(createdTime)} />
        </TicketDetailCard>
      </FormFieldList>
    </Container>
  );
}

"use client";

import { useAtomValue } from "jotai";
import {
  InquiryTicketCreatedTimeAtom,
  InquiryTicketResolveTokenAtom,
  InquiryTicket긴급도Atom,
  InquiryTicket문의내용Atom,
  InquiryTicket문의유형Atom,
  InquiryTicket문의자Atom,
  InquiryTicket법인Atom,
  InquiryTicket부서Atom,
  InquiryTicket자산번호Atom,
} from "@/app/request/inquiry/(atoms)/useInquiryTicketStore";
import ManualSuggestion from "@/app/request/inquiry/(components)/manualSuggestion";
import Container from "@/shared/components/common/container";
import Header from "@/shared/components/common/header";
import { FormFieldList } from "@/shared/components/form/form-fields";
import { TicketDetailCard, TicketDetailInfo } from "@/shared/components/form/ticketDetailCards";
import formatDateTime from "@/shared/utils/formatDateTime";

// 접수 완료 화면. v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없어(암호문) 방금 이 브라우저에서 적은 값으로만
// 보여 준다(useInquiryForm 이 채운다). 진행 상황 조회("내 접수 상태")는 없앴다(10-29 결정).
export default function InquiryTicket({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;

  const 법인 = useAtomValue(InquiryTicket법인Atom);
  const 부서 = useAtomValue(InquiryTicket부서Atom);
  const 문의자 = useAtomValue(InquiryTicket문의자Atom);
  const 자산번호 = useAtomValue(InquiryTicket자산번호Atom);
  const 문의유형 = useAtomValue(InquiryTicket문의유형Atom);
  const 문의내용 = useAtomValue(InquiryTicket문의내용Atom);
  const 긴급도 = useAtomValue(InquiryTicket긴급도Atom);
  const createdTime = useAtomValue(InquiryTicketCreatedTimeAtom);
  const resolveToken = useAtomValue(InquiryTicketResolveTokenAtom);

  if (!createdTime) {
    return (
      <Container>
        <Header title="Inquiry" highlighted="Ticket" />
        <span className="text-center text-content-standard-secondary text-label">접수 직후에만 볼 수 있는 화면이에요. 처리 결과는 담당자가 연락드려요.</span>
      </Container>
    );
  }

  return (
    <Container>
      <Header title="Inquiry" highlighted="Ticket" />
      <span className="text-center text-content-standard-secondary text-label">
        문의가 접수됐어요. 담당자가 확인 후 연락드려요.
      </span>
      <ManualSuggestion ticketId={ticketId} content={문의내용} resolveToken={resolveToken} />
      <FormFieldList>
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

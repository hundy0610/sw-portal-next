"use client";

import { useAtomValue } from "jotai";
import {
  MeetingRentalTicket법인명Atom,
  MeetingRentalTicket부서Atom,
  MeetingRentalTicket시작일시Atom,
  MeetingRentalTicket신청자Atom,
  MeetingRentalTicket이메일Atom,
  MeetingRentalTicket종료일시Atom,
  MeetingRentalTicketCreatedTimeAtom,
} from "@/app/request/meeting-rental/(atoms)/useMeetingRentalTicketStore";
import Container from "@/shared/components/common/container";
import Header from "@/shared/components/common/header";
import { FormFieldList } from "@/shared/components/form/form-fields";
import { TicketDetailCard, TicketDetailInfo } from "@/shared/components/form/ticketDetailCards";
import formatDateTime from "@/shared/utils/formatDateTime";

// 신청 완료 화면. v2 전환 뒤 포털은 신청 행을 다시 읽을 수 없어(암호문) 방금 이 브라우저에서 적은 값으로만
// 보여 준다(useMeetingRentalForm 이 채운다). 진행 상황 조회("내 접수 상태")는 없앴다(10-29 결정).
export default function MeetingRentalTicket() {
  const 법인명 = useAtomValue(MeetingRentalTicket법인명Atom);
  const 부서 = useAtomValue(MeetingRentalTicket부서Atom);
  const 신청자 = useAtomValue(MeetingRentalTicket신청자Atom);
  const 이메일 = useAtomValue(MeetingRentalTicket이메일Atom);
  const 시작일시 = useAtomValue(MeetingRentalTicket시작일시Atom);
  const 종료일시 = useAtomValue(MeetingRentalTicket종료일시Atom);
  const createdTime = useAtomValue(MeetingRentalTicketCreatedTimeAtom);

  if (!createdTime) {
    return (
      <Container>
        <Header title="Meeting" highlighted="Ticket" />
        <span className="text-center text-content-standard-secondary text-label">접수 직후에만 볼 수 있는 화면이에요. 처리 결과는 담당자가 연락드려요.</span>
      </Container>
    );
  }

  return (
    <Container>
      <Header title="Meeting" highlighted="Ticket" />
      <span className="text-center text-content-standard-secondary text-label">
        대여 신청이 접수됐어요. 담당자가 확인 후 연락드려요.
      </span>
      <FormFieldList>
        <TicketDetailCard className="flex flex-col gap-spacing-100 divide-y divide-line-divider">
          <TicketDetailInfo label="법인명" value={법인명} />
          <TicketDetailInfo label="부서" value={부서} />
          <TicketDetailInfo label="신청자" value={신청자} />
          <TicketDetailInfo label="신청자 이메일" value={이메일} />
          <TicketDetailInfo
            label="신청 기간"
            value={시작일시 && 종료일시 ? `${formatDateTime(시작일시)} ~ ${formatDateTime(종료일시)}` : "-"}
          />
          <TicketDetailInfo label="제출 날짜" value={formatDateTime(createdTime)} />
        </TicketDetailCard>
      </FormFieldList>
    </Container>
  );
}

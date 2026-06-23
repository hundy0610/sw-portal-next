"use client";

import { useAtomValue } from "jotai";
import {
  MeetingRentalTicket담당자Atom,
  MeetingRentalTicket법인명Atom,
  MeetingRentalTicket부서Atom,
  MeetingRentalTicket상태Atom,
  MeetingRentalTicket시작일시Atom,
  MeetingRentalTicket신청자Atom,
  MeetingRentalTicket이메일Atom,
  MeetingRentalTicket종료일시Atom,
  MeetingRentalTicketCreatedTimeAtom,
} from "@/app/request/meeting-rental/(atoms)/useMeetingRentalTicketStore";
import { useMeetingRentalTicket } from "@/app/request/meeting-rental/(hooks)/useMeetingRentalTicket";
import Container from "@/shared/components/common/container";
import ErrorComponent from "@/shared/components/common/errorComponent";
import Header from "@/shared/components/common/header";
import LoadingComponent from "@/shared/components/common/loadingComponent";
import CopyLinkButton from "@/shared/components/form/copyLinkButton";
import { FormFieldList } from "@/shared/components/form/form-fields";
import { TicketDetailCard, TicketDetailInfo, TicketDetailStatus } from "@/shared/components/form/ticketDetailCards";
import formatDateTime from "@/shared/utils/formatDateTime";

export default function MeetingRentalTicket({ params }: { params: { ticketId: string } }) {
  const { ticketId } = params;
  const { isLoading, error } = useMeetingRentalTicket(ticketId);

  const 법인명 = useAtomValue(MeetingRentalTicket법인명Atom);
  const 부서 = useAtomValue(MeetingRentalTicket부서Atom);
  const 신청자 = useAtomValue(MeetingRentalTicket신청자Atom);
  const 이메일 = useAtomValue(MeetingRentalTicket이메일Atom);
  const 시작일시 = useAtomValue(MeetingRentalTicket시작일시Atom);
  const 종료일시 = useAtomValue(MeetingRentalTicket종료일시Atom);
  const 상태 = useAtomValue(MeetingRentalTicket상태Atom);
  const 담당자 = useAtomValue(MeetingRentalTicket담당자Atom);
  const createdTime = useAtomValue(MeetingRentalTicketCreatedTimeAtom);

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (error) {
    return <ErrorComponent errorMessage={error.message} />;
  }

  return (
    <Container>
      <Header title="Meeting" highlighted="Ticket" />
      <span className="flex flex-row flex-wrap items-center justify-center gap-x-spacing-200 text-center text-content-standard-secondary text-label">
        앞으로 이 링크로 대여신청 내용과 진행 상황을 확인할 수 있어요.
        <CopyLinkButton />
      </span>
      <FormFieldList>
        <div className="grid w-full gap-spacing-400 md:grid-cols-2">
          <TicketDetailStatus label="상태" value={상태} />
          <TicketDetailStatus label="담당자" value={담당자} />
        </div>
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

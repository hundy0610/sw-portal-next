"use client";

import { useAtomValue } from "jotai";
import {
  RepairTicketCreatedTimeAtom,
  RepairTicket건물명Atom,
  RepairTicket고장내역Atom,
  RepairTicket모니터번호Atom,
  RepairTicket문의자Atom,
  RepairTicket법인Atom,
  RepairTicket부서Atom,
  RepairTicket세부내역Atom,
  RepairTicket층수Atom,
} from "@/app/request/repair/(atoms)/useRepairTicketStore";
import Container from "@/shared/components/common/container";
import Header from "@/shared/components/common/header";
import { FormFieldList } from "@/shared/components/form/form-fields";
import { TicketDetailCard, TicketDetailInfo } from "@/shared/components/form/ticketDetailCards";
import formatDateTime from "@/shared/utils/formatDateTime";

// 접수 완료 화면. v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없어(암호문) 방금 이 브라우저에서 적은 값으로만
// 보여 준다(useRepairForm 이 채운다). 진행 상황 조회("내 접수 상태")는 없앴다(10-29 결정).
export default function RepairTicket() {
  const 법인 = useAtomValue(RepairTicket법인Atom);
  const 부서 = useAtomValue(RepairTicket부서Atom);
  const 문의자 = useAtomValue(RepairTicket문의자Atom);
  const 건물명 = useAtomValue(RepairTicket건물명Atom);
  const 층수 = useAtomValue(RepairTicket층수Atom);
  const 모니터번호 = useAtomValue(RepairTicket모니터번호Atom);
  const 고장내역 = useAtomValue(RepairTicket고장내역Atom);
  const 세부내역 = useAtomValue(RepairTicket세부내역Atom);
  const createdTime = useAtomValue(RepairTicketCreatedTimeAtom);

  if (!createdTime) {
    return (
      <Container>
        <Header title="Repair" highlighted="Ticket" />
        <span className="text-center text-content-standard-secondary text-label">접수 직후에만 볼 수 있는 화면이에요. 처리 결과는 담당자가 연락드려요.</span>
      </Container>
    );
  }

  return (
    <Container>
      <Header title="Repair" highlighted="Ticket" />
      <span className="text-center text-content-standard-secondary text-label">
        수리 접수가 완료됐어요. 담당자가 확인 후 연락드려요.
      </span>
      <FormFieldList>
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

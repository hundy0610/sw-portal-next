import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
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
import { safeJson } from "@/lib/fetch-json";

interface TicketData {
  법인명: string;
  부서: string;
  신청자: string;
  이메일: string;
  시작일시: string;
  종료일시: string;
  상태: string;
  담당자: string;
  createdAt: string;
}

export const useMeetingRentalTicket = (ticketId: string) => {
  const set법인명 = useSetAtom(MeetingRentalTicket법인명Atom);
  const set부서 = useSetAtom(MeetingRentalTicket부서Atom);
  const set신청자 = useSetAtom(MeetingRentalTicket신청자Atom);
  const set이메일 = useSetAtom(MeetingRentalTicket이메일Atom);
  const set시작일시 = useSetAtom(MeetingRentalTicket시작일시Atom);
  const set종료일시 = useSetAtom(MeetingRentalTicket종료일시Atom);
  const set상태 = useSetAtom(MeetingRentalTicket상태Atom);
  const set담당자 = useSetAtom(MeetingRentalTicket담당자Atom);
  const setCreatedTime = useSetAtom(MeetingRentalTicketCreatedTimeAtom);

  return useQuery<TicketData>({
    queryKey: ["meetingRentalTicket", ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/request/meeting-rental/ticket/${ticketId}`, {
        method: "GET",
      });

      const data: TicketData = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    enabled: !!ticketId,
    select: (data) => {
      set법인명(data.법인명);
      set부서(data.부서);
      set신청자(data.신청자);
      set이메일(data.이메일);
      set시작일시(data.시작일시);
      set종료일시(data.종료일시);
      set상태(data.상태);
      set담당자(data.담당자);
      setCreatedTime(data.createdAt);

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

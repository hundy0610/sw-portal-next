import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
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
import { safeJson } from "@/lib/fetch-json";

interface TicketData {
  법인: string;
  부서: string;
  문의자: string;
  자산번호: string;
  문의유형: string;
  문의내용: string;
  긴급도: string;
  상태: string;
  담당자: string;
  createdAt: string;
}

export const useInquiryTicket = (ticketId: string) => {
  const set법인 = useSetAtom(InquiryTicket법인Atom);
  const set부서 = useSetAtom(InquiryTicket부서Atom);
  const set문의자 = useSetAtom(InquiryTicket문의자Atom);
  const set자산번호 = useSetAtom(InquiryTicket자산번호Atom);
  const set문의유형 = useSetAtom(InquiryTicket문의유형Atom);
  const set문의내용 = useSetAtom(InquiryTicket문의내용Atom);
  const set긴급도 = useSetAtom(InquiryTicket긴급도Atom);
  const set상태 = useSetAtom(InquiryTicket상태Atom);
  const set담당자 = useSetAtom(InquiryTicket담당자Atom);
  const setCreatedTime = useSetAtom(InquiryTicketCreatedTimeAtom);

  return useQuery<TicketData>({
    queryKey: ["inquiryTicket", ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/request/inquiry/ticket/${ticketId}`, {
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
      set법인(data.법인);
      set부서(data.부서);
      set문의자(data.문의자);
      set자산번호(data.자산번호);
      set문의유형(data.문의유형);
      set문의내용(data.문의내용);
      set긴급도(data.긴급도);
      set상태(data.상태);
      set담당자(data.담당자);
      setCreatedTime(data.createdAt);

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

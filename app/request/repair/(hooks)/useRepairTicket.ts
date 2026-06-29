import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
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
import { safeJson } from "@/lib/fetch-json";

interface TicketData {
  법인: string;
  부서: string;
  문의자: string;
  건물명: string;
  층수: string;
  모니터번호: string;
  고장내역: string;
  세부내역: string;
  상태: string;
  조치내용: string;
  담당자: string;
  과실여부: string;
  수리일정: string;
  단가: number;
  수리진행상황: string;
  createdAt: string;
}

export const useRepairTicket = (ticketId: string) => {
  const set법인 = useSetAtom(RepairTicket법인Atom);
  const set부서 = useSetAtom(RepairTicket부서Atom);
  const set문의자 = useSetAtom(RepairTicket문의자Atom);
  const set건물명 = useSetAtom(RepairTicket건물명Atom);
  const set층수 = useSetAtom(RepairTicket층수Atom);
  const set모니터번호 = useSetAtom(RepairTicket모니터번호Atom);
  const set고장내역 = useSetAtom(RepairTicket고장내역Atom);
  const set세부내역 = useSetAtom(RepairTicket세부내역Atom);
  const set상태 = useSetAtom(RepairTicket상태Atom);
  const set조치내용 = useSetAtom(RepairTicket조치내용Atom);
  const set담당자 = useSetAtom(RepairTicket담당자Atom);
  const set과실여부 = useSetAtom(RepairTicket과실여부Atom);
  const set수리일정 = useSetAtom(RepairTicket수리일정Atom);
  const set단가 = useSetAtom(RepairTicket단가Atom);
  const set수리진행상황 = useSetAtom(RepairTicket수리진행상황Atom);
  const setCreatedTime = useSetAtom(RepairTicketCreatedTimeAtom);

  return useQuery<TicketData>({
    queryKey: ["repairTicket", ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/request/repair/ticket/${ticketId}`, {
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
      set건물명(data.건물명);
      set층수(data.층수);
      set모니터번호(data.모니터번호);
      set고장내역(data.고장내역);
      set세부내역(data.세부내역);
      set상태(data.상태);
      set조치내용(data.조치내용);
      set담당자(data.담당자);
      set과실여부(data.과실여부);
      set수리일정(data.수리일정);
      set단가(data.단가);
      set수리진행상황(data.수리진행상황);
      setCreatedTime(data.createdAt);

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

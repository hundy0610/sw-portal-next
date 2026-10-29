import { useMutation } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  RepairForm건물명Atom,
  RepairForm고장내역Atom,
  RepairForm모니터번호Atom,
  RepairForm문의자Atom,
  RepairForm법인Atom,
  RepairForm부서Atom,
  RepairForm세부내역Atom,
  RepairForm층수Atom,
  RepairFormItemIdAtom,
} from "@/app/request/repair/(atoms)/useRepairFormStore";
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
import { safeJson } from "@/lib/fetch-json";

interface UseRepairFormReturn {
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
}

export const useRepairForm = (): UseRepairFormReturn => {
  const router = useRouter();

  const [법인, set법인] = useAtom(RepairForm법인Atom);
  const [부서, set부서] = useAtom(RepairForm부서Atom);
  const [문의자, set문의자] = useAtom(RepairForm문의자Atom);
  const [건물명, set건물명] = useAtom(RepairForm건물명Atom);
  const [층수, set층수] = useAtom(RepairForm층수Atom);
  const [모니터번호, set모니터번호] = useAtom(RepairForm모니터번호Atom);
  const [고장내역, set고장내역] = useAtom(RepairForm고장내역Atom);
  const [세부내역, set세부내역] = useAtom(RepairForm세부내역Atom);
  const [itemId, setItemId] = useAtom(RepairFormItemIdAtom);

  const setTicket법인 = useSetAtom(RepairTicket법인Atom);
  const setTicket부서 = useSetAtom(RepairTicket부서Atom);
  const setTicket문의자 = useSetAtom(RepairTicket문의자Atom);
  const setTicket건물명 = useSetAtom(RepairTicket건물명Atom);
  const setTicket층수 = useSetAtom(RepairTicket층수Atom);
  const setTicket모니터번호 = useSetAtom(RepairTicket모니터번호Atom);
  const setTicket고장내역 = useSetAtom(RepairTicket고장내역Atom);
  const setTicket세부내역 = useSetAtom(RepairTicket세부내역Atom);
  const setTicketCreatedTime = useSetAtom(RepairTicketCreatedTimeAtom);

  const resetForm = () => {
    set법인("");
    set부서("");
    set문의자("");
    set건물명("");
    set층수("");
    set모니터번호("");
    set고장내역("");
    set세부내역("");
    setItemId("");
  };

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("법인", 법인);
      formData.append("부서", 부서);
      formData.append("문의자", 문의자);
      formData.append("건물명", 건물명);
      formData.append("층수", 층수);
      formData.append("모니터번호", 모니터번호);
      formData.append("고장내역", 고장내역);
      formData.append("세부내역", 세부내역);
      if (itemId) formData.append("itemId", itemId);

      const response = await fetch("/api/request/repair", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    onSuccess: (data) => {
      // 접수 완료 화면은 방금 적은 값으로 보여 준다 — v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없다(암호문).
      setTicket법인(법인);
      setTicket부서(부서);
      setTicket문의자(문의자);
      setTicket건물명(건물명);
      setTicket층수(층수);
      setTicket모니터번호(모니터번호);
      setTicket고장내역(고장내역);
      setTicket세부내역(세부내역);
      setTicketCreatedTime(new Date().toISOString());
      resetForm();
      router.push(`/request/repair/ticket/${data.ticketId}`);
    },
  });

  const handleSubmit = async (): Promise<void> => {
    await mutateAsync();
  };

  return {
    isSubmitting: isPending,
    handleSubmit,
  };
};

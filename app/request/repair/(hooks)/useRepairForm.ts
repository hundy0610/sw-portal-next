import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
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
} from "@/app/request/repair/(atoms)/useRepairFormStore";
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

  const resetForm = () => {
    set법인("");
    set부서("");
    set문의자("");
    set건물명("");
    set층수("");
    set모니터번호("");
    set고장내역("");
    set세부내역("");
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

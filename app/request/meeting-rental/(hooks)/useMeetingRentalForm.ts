import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  MeetingRentalForm법인명Atom,
  MeetingRentalForm부서Atom,
  MeetingRentalForm시작일시Atom,
  MeetingRentalForm신청자Atom,
  MeetingRentalForm이메일Atom,
  MeetingRentalForm종료일시Atom,
} from "@/app/request/meeting-rental/(atoms)/useMeetingRentalFormStore";
import { safeJson } from "@/lib/fetch-json";

interface UseMeetingRentalFormReturn {
  isSubmitting: boolean;
  error: string | null;
  handleSubmit: () => Promise<void>;
}

export const useMeetingRentalForm = (): UseMeetingRentalFormReturn => {
  const router = useRouter();

  const [법인명, set법인명] = useAtom(MeetingRentalForm법인명Atom);
  const [부서, set부서] = useAtom(MeetingRentalForm부서Atom);
  const [신청자, set신청자] = useAtom(MeetingRentalForm신청자Atom);
  const [이메일, set이메일] = useAtom(MeetingRentalForm이메일Atom);
  const [시작일시, set시작일시] = useAtom(MeetingRentalForm시작일시Atom);
  const [종료일시, set종료일시] = useAtom(MeetingRentalForm종료일시Atom);

  const resetForm = () => {
    set법인명("");
    set부서("");
    set신청자("");
    set이메일("");
    set시작일시("");
    set종료일시("");
  };

  const { mutateAsync, isPending, error: mutationError } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("법인명", 법인명);
      formData.append("부서", 부서);
      formData.append("신청자", 신청자);
      formData.append("이메일", 이메일);
      formData.append("시작일시", 시작일시);
      formData.append("종료일시", 종료일시);

      const response = await fetch("/api/request/meeting-rental", {
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
      router.push(`/request/meeting-rental/ticket/${data.ticketId}`);
    },
  });

  const handleSubmit = async (): Promise<void> => {
    try {
      await mutateAsync();
    } catch {}
  };

  const error = mutationError
    ? (mutationError as any)?.message || "제출 중 오류가 발생했습니다. 다시 시도해 주세요."
    : null;

  return {
    isSubmitting: isPending,
    error,
    handleSubmit,
  };
};

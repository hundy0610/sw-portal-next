import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  InquiryForm긴급도Atom,
  InquiryForm문의내용Atom,
  InquiryForm문의유형Atom,
  InquiryForm문의자Atom,
  InquiryForm법인Atom,
  InquiryForm부서Atom,
  InquiryForm자산번호Atom,
  InquiryForm이메일Atom,
} from "@/app/request/inquiry/(atoms)/useInquiryFormStore";
import { safeJson } from "@/lib/fetch-json";

interface UseInquiryFormReturn {
  isSubmitting: boolean;
  error: string | null;
  handleSubmit: () => Promise<void>;
}

export const useInquiryForm = (): UseInquiryFormReturn => {
  const router = useRouter();

  const [법인, set법인] = useAtom(InquiryForm법인Atom);
  const [부서, set부서] = useAtom(InquiryForm부서Atom);
  const [문의자, set문의자] = useAtom(InquiryForm문의자Atom);
  const [자산번호, set자산번호] = useAtom(InquiryForm자산번호Atom);
  const [문의유형, set문의유형] = useAtom(InquiryForm문의유형Atom);
  const [문의내용, set문의내용] = useAtom(InquiryForm문의내용Atom);
  const [긴급도, set긴급도] = useAtom(InquiryForm긴급도Atom);
  const [이메일, set이메일] = useAtom(InquiryForm이메일Atom);

  const resetForm = () => {
    set법인("");
    set부서("");
    set문의자("");
    set자산번호("");
    set문의유형("");
    set문의내용("");
    set긴급도("");
    set이메일("");
  };

  const { mutateAsync, isPending, error: mutationError } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("법인", 법인);
      formData.append("부서", 부서);
      formData.append("문의자", 문의자);
      formData.append("자산번호", 자산번호);
      formData.append("문의유형", 문의유형);
      formData.append("문의내용", 문의내용);
      formData.append("긴급도", 긴급도);
      formData.append("이메일", 이메일);

      const response = await fetch("/api/request/inquiry", {
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
      router.push(`/request/inquiry/ticket/${data.ticketId}`);
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

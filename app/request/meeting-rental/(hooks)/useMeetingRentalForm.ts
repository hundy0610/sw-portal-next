import { useMutation } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  MeetingRentalForm법인명Atom,
  MeetingRentalForm부서Atom,
  MeetingRentalForm시작시각Atom,
  MeetingRentalForm시작일Atom,
  MeetingRentalForm신청자Atom,
  MeetingRentalForm이메일Atom,
  MeetingRentalForm종료시각Atom,
  MeetingRentalForm종료일Atom,
} from "@/app/request/meeting-rental/(atoms)/useMeetingRentalFormStore";
import {
  MeetingRentalTicket법인명Atom,
  MeetingRentalTicket부서Atom,
  MeetingRentalTicket시작일시Atom,
  MeetingRentalTicket신청자Atom,
  MeetingRentalTicket이메일Atom,
  MeetingRentalTicket종료일시Atom,
  MeetingRentalTicketCreatedTimeAtom,
} from "@/app/request/meeting-rental/(atoms)/useMeetingRentalTicketStore";
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
  const [시작일, set시작일] = useAtom(MeetingRentalForm시작일Atom);
  const [시작시각, set시작시각] = useAtom(MeetingRentalForm시작시각Atom);
  const [종료일, set종료일] = useAtom(MeetingRentalForm종료일Atom);
  const [종료시각, set종료시각] = useAtom(MeetingRentalForm종료시각Atom);

  const setTicket법인명 = useSetAtom(MeetingRentalTicket법인명Atom);
  const setTicket부서 = useSetAtom(MeetingRentalTicket부서Atom);
  const setTicket신청자 = useSetAtom(MeetingRentalTicket신청자Atom);
  const setTicket이메일 = useSetAtom(MeetingRentalTicket이메일Atom);
  const setTicket시작일시 = useSetAtom(MeetingRentalTicket시작일시Atom);
  const setTicket종료일시 = useSetAtom(MeetingRentalTicket종료일시Atom);
  const setTicketCreatedTime = useSetAtom(MeetingRentalTicketCreatedTimeAtom);

  const resetForm = () => {
    set법인명("");
    set부서("");
    set신청자("");
    set이메일("");
    set시작일("");
    set시작시각("");
    set종료일("");
    set종료시각("");
  };

  const { mutateAsync, isPending, error: mutationError } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("법인명", 법인명);
      formData.append("부서", 부서);
      formData.append("신청자", 신청자);
      formData.append("이메일", 이메일);
      formData.append("시작일시", 시작일 && 시작시각 ? `${시작일}T${시작시각}` : "");
      formData.append("종료일시", 종료일 && 종료시각 ? `${종료일}T${종료시각}` : "");

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
      // 접수 완료 화면은 방금 적은 값으로 보여 준다 — v2 전환 뒤 포털은 접수 행을 다시 읽을 수 없다(암호문).
      setTicket법인명(법인명);
      setTicket부서(부서);
      setTicket신청자(신청자);
      setTicket이메일(이메일);
      setTicket시작일시(시작일 && 시작시각 ? `${시작일}T${시작시각}` : "");
      setTicket종료일시(종료일 && 종료시각 ? `${종료일}T${종료시각}` : "");
      setTicketCreatedTime(new Date().toISOString());
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

import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  StocktakingFormAssetIdAtom,
  StocktakingFoundPageIdAtom,
  StocktakingManual법인명Atom,
  StocktakingManual부서Atom,
  StocktakingManual사용자Atom,
  StocktakingStepAtom,
} from "@/app/request/stocktaking/(atoms)/useStocktakingFormStore";
import { safeJson } from "@/lib/fetch-json";

interface UseStocktakingFormReturn {
  isConfirming: boolean;
  isSubmittingManual: boolean;
  confirmError: any;
  manualError: any;
  confirmAsset: () => Promise<void>;
  submitManual: () => Promise<void>;
  resetFlow: () => void;
}

export const useStocktakingForm = (): UseStocktakingFormReturn => {
  const router = useRouter();

  const assetId = useAtomValue(StocktakingFormAssetIdAtom);

  const pageId = useAtomValue(StocktakingFoundPageIdAtom);

  const 법인명 = useAtomValue(StocktakingManual법인명Atom);
  const 부서 = useAtomValue(StocktakingManual부서Atom);
  const 사용자 = useAtomValue(StocktakingManual사용자Atom);

  const setStep = useSetAtom(StocktakingStepAtom);
  const set자산번호 = useSetAtom(StocktakingFormAssetIdAtom);
  const set법인명 = useSetAtom(StocktakingManual법인명Atom);
  const set부서 = useSetAtom(StocktakingManual부서Atom);
  const set사용자 = useSetAtom(StocktakingManual사용자Atom);

  const resetFlow = () => {
    set자산번호("");
    set법인명("");
    set부서("");
    set사용자("");
    setStep("input");
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!assetId) throw new Error("자산 번호가 없습니다.");

      const formData = new FormData();
      formData.append("assetId", assetId);

      const response = await fetch(`/api/request/stocktaking/confirm/${pageId}`, {
        method: "PATCH",
        body: formData,
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    onSuccess: () => {
      alert("자산 실사가 완료되었습니다.");
      resetFlow();
      router.push("/request");
    },
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("자산번호", assetId);
      formData.append("법인명", 법인명);
      formData.append("부서", 부서);
      formData.append("사용자", 사용자);

      const response = await fetch("/api/request/stocktaking", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    onSuccess: () => {
      alert("정보가 성공적으로 제출되었습니다.");
      resetFlow();
      router.push("/request");
    },
  });

  const confirmAsset = async (): Promise<void> => {
    await confirmMutation.mutateAsync();
  };

  const submitManual = async (): Promise<void> => {
    await manualMutation.mutateAsync();
  };

  return {
    isConfirming: confirmMutation.isPending,
    isSubmittingManual: manualMutation.isPending,
    confirmError: confirmMutation.error,
    manualError: manualMutation.error,
    confirmAsset,
    submitManual,
    resetFlow,
  };
};

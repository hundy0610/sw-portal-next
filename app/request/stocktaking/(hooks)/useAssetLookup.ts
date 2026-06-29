import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  StocktakingFoundPageIdAtom,
  StocktakingFound법인명Atom,
  StocktakingFound부서Atom,
  StocktakingFound사용자Atom,
  StocktakingFound실사확인Atom,
  StocktakingFound제조사Atom,
  StocktakingStepAtom,
} from "@/app/request/stocktaking/(atoms)/useStocktakingFormStore";
import { safeJson } from "@/lib/fetch-json";

interface AssetLookupResponse {
  pageId: string;
  properties: {
    법인명: string;
    부서: string;
    사용자: string;
    제조사: string;
    실사확인: boolean;
  };
}

interface UseAssetLookupReturn {
  isLookingUp: boolean;
  error: any;
  lookupAsset: (assetId: string) => Promise<void>;
}

export const useAssetLookup = (): UseAssetLookupReturn => {
  const setPageId = useSetAtom(StocktakingFoundPageIdAtom);
  const set법인명 = useSetAtom(StocktakingFound법인명Atom);
  const set부서 = useSetAtom(StocktakingFound부서Atom);
  const set사용자 = useSetAtom(StocktakingFound사용자Atom);
  const set제조사 = useSetAtom(StocktakingFound제조사Atom);
  const set실사확인 = useSetAtom(StocktakingFound실사확인Atom);
  const setStep = useSetAtom(StocktakingStepAtom);

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (assetId: string) => {
      const formData = new FormData();
      formData.append("자산번호", assetId);

      const response = await fetch("/api/request/stocktaking/lookup", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data as AssetLookupResponse;
    },
    onSuccess: (data) => {
      setPageId(data.pageId);
      set법인명(data.properties.법인명);
      set부서(data.properties.부서);
      set사용자(data.properties.사용자);
      set제조사(data.properties.제조사);
      set실사확인(data.properties.실사확인);
      setStep("confirm");
    },
  });

  const lookupAsset = async (자산번호: string): Promise<void> => {
    await mutateAsync(자산번호);
  };

  return {
    isLookingUp: isPending,
    error,
    lookupAsset,
  };
};

import { useQuery } from "@tanstack/react-query";
import { safeJson } from "@/lib/fetch-json";

interface StocktakingInfoResponse {
  실사제목: string;
  시작날짜: string | null;
  끝날짜: string | null;
}

export const useStocktakingInfo = () => {
  return useQuery<StocktakingInfoResponse>({
    queryKey: ["stocktakingInfo"],
    queryFn: async () => {
      const response = await fetch("/api/request/stocktaking/info");
      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
};

import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  RepairOptions건물명Atom,
  RepairOptions고장내역Atom,
  RepairOptions법인Atom,
} from "@/app/request/repair/(atoms)/useRepairOptionsStore";
import { safeJson } from "@/lib/fetch-json";

interface RepairOptionsResponse {
  법인: string[];
  건물명: string[];
  고장내역: string[];
}

export const useRepairOptions = () => {
  const set법인 = useSetAtom(RepairOptions법인Atom);
  const set건물명 = useSetAtom(RepairOptions건물명Atom);
  const set고장내역 = useSetAtom(RepairOptions고장내역Atom);

  return useQuery<RepairOptionsResponse>({
    queryKey: ["repairOptions"],
    queryFn: async () => {
      const response = await fetch("/api/request/repair/options");
      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    select: (data) => {
      set법인(data.법인);
      set건물명(data.건물명);
      set고장내역(data.고장내역);

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

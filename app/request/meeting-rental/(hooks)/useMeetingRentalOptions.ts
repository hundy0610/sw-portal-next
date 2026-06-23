import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { MeetingRentalOptions법인명Atom } from "@/app/request/meeting-rental/(atoms)/useMeetingRentalOptionsStore";
import { safeJson } from "@/lib/fetch-json";

interface MeetingRentalOptionsResponse {
  법인명: string[];
}

export const useMeetingRentalOptions = () => {
  const set법인명 = useSetAtom(MeetingRentalOptions법인명Atom);

  return useQuery<MeetingRentalOptionsResponse>({
    queryKey: ["meetingRentalOptions"],
    queryFn: async () => {
      const response = await fetch("/api/request/meeting-rental/options");
      const data = await safeJson(response);

      if (!response.ok) {
        throw data;
      }

      return data;
    },
    select: (data) => {
      set법인명(data.법인명);

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

import { notionRequest } from "@/shared/lib/notion";

export async function validateStocktakingPeriod(): Promise<{
  isValid: boolean;
  message?: string;
}> {
  try {
    const notionResponse = await notionRequest<any>(
      `/data_sources/${process.env.STOCKTAKING_INFO_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: {
          page_size: 1,
        },
      },
    );

    if (notionResponse.results.length === 0) {
      return {
        isValid: false,
        message: "진행 중인 실사가 없습니다. IdsTrust 자산관리파트로 문의주세요.",
      };
    }

    const page = notionResponse.results[0];

    const 시작날짜 = page.properties.날짜?.date?.start ?? null;
    const 끝날짜 = page.properties.날짜?.date?.end ?? null;

    if (!시작날짜 || !끝날짜) {
      return {
        isValid: false,
        message: "진행 중인 실사가 없습니다. IdsTrust 자산관리파트로 문의주세요.",
      };
    }

    const today = new Date().toISOString().split("T")[0];
    if (today < 시작날짜 || today > 끝날짜) {
      return {
        isValid: false,
        message: "진행 중인 실사가 없습니다. IdsTrust 자산관리파트로 문의주세요.",
      };
    }

    return { isValid: true };
  } catch (_error) {
    return {
      isValid: false,
      message: "실사 기간 확인 중 오류가 발생했습니다.",
    };
  }
}

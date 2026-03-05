import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_SUBSCRIPTIONS ?? "2b767f4bfdac81a09910f01d7b335e3c";

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        property: "상태",
        status: { equals: "구독 중" },
      },
    });

    const items = response.results.map((page: any) => {
      const props = page.properties;

      const getName = (p: any): string => {
        if (!p) return "";
        if (p.type === "title" || p.title) return (p.title ?? []).map((t: any) => t.plain_text).join("");
        if (p.type === "rich_text" || p.rich_text) return (p.rich_text ?? []).map((t: any) => t.plain_text).join("");
        return "";
      };
      const getNumber = (p: any): number | null => p?.number ?? null;
      const getSelect = (p: any): string | null => p?.select?.name ?? null;
      const getText = (p: any): string => (p?.rich_text ?? []).map((t: any) => t.plain_text).join("");
      const getDate = (p: any): string | null => p?.date?.start ?? null;
      const getStatus = (p: any): string | null => p?.status?.name ?? null;

      return {
        id: page.id,
        name: getName(props["이름"]),
        status: getStatus(props["상태"]) ?? "구독 중",
        krw: getNumber(props["결제 금액(KRW)"]),
        usd: getNumber(props["결제 금액(USD)"]),
        cycle: getSelect(props["결제 주기"]),
        team: getText(props["팀명"]),
        division: getText(props["사업부"]),
        userCount: getNumber(props["개수"]),
        user: getText(props["사용자"]),
        startDate: getDate(props["결제 시작일"]),
        version: getText(props["버전"]),
        paymentMethod: getSelect(props["결재 방식"]),
      };
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("Notion subscription fetch error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

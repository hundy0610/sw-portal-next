import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = "38e67f4bfdac800fb862c4716ddc0cd7";

export async function GET() {
  try {
    await notion.databases.update({
      database_id: DB_ID,
      properties: {
        // 사용목적 → multi_select 로 변경
        "사용목적": {
          multi_select: {
            options: [
              { name: "화상회의",    color: "blue"   },
              { name: "오프라인 미팅", color: "green"  },
              { name: "기타",        color: "gray"   },
            ],
          },
        } as any,
        // 주요언어 신규 추가
        "주요언어": {
          multi_select: {
            options: [
              { name: "영어",       color: "blue"   },
              { name: "인도네시아어", color: "orange" },
              { name: "중국어",     color: "red"    },
              { name: "일본어",     color: "pink"   },
              { name: "스페인어",   color: "yellow" },
              { name: "프랑스어",   color: "purple" },
              { name: "포르투갈어", color: "green"  },
              { name: "아랍어",     color: "brown"  },
              { name: "기타",       color: "gray"   },
            ],
          },
        } as any,
      },
    });
    return NextResponse.json({ ok: true, message: "Notion DB 업데이트 완료" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

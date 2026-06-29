import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function GET() {
  try {
    const res = await notion.users.list({});
    const users = res.results
      .filter(u => u.type === "person")
      .map(u => ({ id: u.id, name: u.name ?? "" }))
      .filter(u => u.name)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("[API /hw-repair/assignees]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

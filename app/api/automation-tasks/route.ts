import { NextRequest, NextResponse } from "next/server";
import { fetchAutomationTasks, updateAutomationTask } from "@/lib/notion";

export const dynamic = "force-dynamic";

export type { AutomationTaskRecord as AutomationTask } from "@/lib/notion";

// GET /api/automation-tasks
export async function GET() {
  if (!process.env.NOTION_DB_AUTOMATION) {
    return NextResponse.json({ ok: false, missingEnv: "NOTION_DB_AUTOMATION", tasks: [] });
  }
  try {
    const tasks = await fetchAutomationTasks();
    return NextResponse.json({ ok: true, tasks });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), tasks: [] }, { status: 500 });
  }
}

// PATCH /api/automation-tasks  body: { id, status?, assignee? }
export async function PATCH(req: NextRequest) {
  try {
    const { id, status, assignee } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await updateAutomationTask(id, { status, assignee });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

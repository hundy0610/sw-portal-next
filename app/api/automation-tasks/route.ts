import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface AutomationTask {
  id:           string;
  taskName:     string;
  requester:    string;
  email:        string;
  department:   string;   // 주 업무 (인사/재무/계약관리)
  tools:        string;
  cycle:        string;
  weeklyHours:  string;
  currentFlow:  string;
  desiredFlow:  string;
  status:       string;   // 접수/검토 중/개발 중/완료/보류
  assignee:     string;
  submittedAt:  string;
  notionUrl:    string;
}

// GET /api/automation-tasks
export async function GET() {
  const dbId = process.env.NOTION_DB_AUTOMATION;
  if (!dbId) {
    return NextResponse.json(
      { ok: false, missingEnv: "NOTION_DB_AUTOMATION", tasks: [] },
      { status: 200 }
    );
  }

  // TODO: Notion DB 연동 (DB ID 설정 후 구현)
  return NextResponse.json({ ok: true, tasks: [] });
}

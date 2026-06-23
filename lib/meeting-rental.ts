import { notionRequest } from "@/shared/lib/notion";
import type { MeetingRentalTicket } from "@/types";

function mapPage(page: any): MeetingRentalTicket {
  const p = page.properties;
  return {
    id: page.id,
    requester: p.신청자?.title?.[0]?.plain_text ?? "",
    company: p.법인명?.select?.name ?? "",
    department: p.부서?.rich_text?.[0]?.plain_text ?? "",
    email: p["신청자 이메일"]?.email ?? "",
    startAt: p.신청기간?.date?.start ?? "",
    endAt: p.신청기간?.date?.end ?? "",
    status: (p.상태?.status?.name ?? "시작 전") as MeetingRentalTicket["status"],
    assignee: p.담당자?.people?.[0]?.name ?? "",
    assigneeId: p.담당자?.people?.[0]?.id ?? "",
    createdAt: page.created_time,
    notionUrl: page.url,
  };
}

export async function fetchMeetingRentalTickets(): Promise<MeetingRentalTicket[]> {
  const dataSourceId = process.env.MEETING_RENTAL_DATA_SOURCE_ID;
  if (!dataSourceId) throw new Error("MEETING_RENTAL_DATA_SOURCE_ID 환경변수가 설정되지 않았습니다.");

  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionRequest<any>(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: {
        start_cursor: cursor,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      },
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return results.map(mapPage);
}

export async function updateMeetingRentalTicket(id: string, fields: {
  status?: MeetingRentalTicket["status"];
  assigneeId?: string;
}): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (fields.status !== undefined) {
    properties["상태"] = { status: { name: fields.status } };
  }
  if (fields.assigneeId !== undefined) {
    properties["담당자"] = fields.assigneeId
      ? { people: [{ object: "user", id: fields.assigneeId }] }
      : { people: [] };
  }
  if (Object.keys(properties).length === 0) return;

  await notionRequest(`/pages/${id}`, {
    method: "PATCH",
    body: { properties },
  });
}

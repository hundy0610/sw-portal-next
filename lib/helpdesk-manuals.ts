import crypto from "crypto";
import { kvGet, kvSetPermanent, kvDel } from "@/lib/kv-store";

const INDEX_KEY = "helpdesk:manual:index";
const manualKey = (id: string) => `helpdesk:manual:${id}`;

export interface HelpDeskManual {
  id: string;
  title: string;
  // "html"이면 body에 첨부된 HTML 원문, "url"이면 body에 외부 URL이 들어있음
  contentType: "html" | "url";
  body: string;
  // 매뉴얼에 연결해둔 과거 티켓 id 목록 — 매뉴얼 작성 화면에서 "과거 처리결과 검색"으로 찾아
  // 직접 연결한 이력. 시간이 지나며 계속 추가될 수 있어 사실상 이 매뉴얼의 사례 DB 역할을 함
  linkedTicketIds: string[];
  // linkedTicketIds에 연결된 티켓들 각각의 문의내용+조치내용에서 뽑은 키워드 세트 (티켓 1건당 1개 배열).
  // 여러 건을 하나로 합치지 않고 건별로 보관해, 매칭 시 이 중 한 건과라도 충분히 겹치면 매칭으로 인정한다
  matchKeywords: string[][];
  updatedBy: string;
  updatedAt: string;
}

export async function listManuals(): Promise<HelpDeskManual[]> {
  let index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
  // Upstash 응답이 간헐적으로 비어 오는 경우가 관측돼(예외 없이 그냥 빈 값), 인덱스가 비어있으면
  // 한 번 더 확인한다 — 매뉴얼이 실제로 등록돼 있는데도 빈 목록으로 취급되면 매칭 기능 전체가 조용히 죽는다
  if (index.length === 0) {
    await new Promise(r => setTimeout(r, 250));
    index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
  }
  if (index.length === 0) return [];
  const manuals = await Promise.all(index.map(id => kvGet<HelpDeskManual>(manualKey(id))));
  return manuals.filter((m): m is HelpDeskManual => !!m);
}

export async function getManual(id: string): Promise<HelpDeskManual | null> {
  return kvGet<HelpDeskManual>(manualKey(id));
}

export async function saveManual(data: {
  id?: string;
  title: string;
  contentType: "html" | "url";
  body: string;
  linkedTicketIds?: string[];
  matchKeywords?: string[][];
  updatedBy: string;
}): Promise<HelpDeskManual> {
  const id = data.id || crypto.randomUUID();
  const manual: HelpDeskManual = {
    id,
    title: data.title,
    contentType: data.contentType,
    body: data.body,
    linkedTicketIds: data.linkedTicketIds ?? [],
    matchKeywords: data.matchKeywords ?? [],
    updatedBy: data.updatedBy,
    updatedAt: new Date().toISOString(),
  };
  await kvSetPermanent(manualKey(id), manual);

  const index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
  if (!index.includes(id)) {
    await kvSetPermanent(INDEX_KEY, [...index, id]);
  }
  return manual;
}

export async function deleteManual(id: string): Promise<void> {
  await kvDel(manualKey(id));
  const index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
  await kvSetPermanent(INDEX_KEY, index.filter(i => i !== id));
}

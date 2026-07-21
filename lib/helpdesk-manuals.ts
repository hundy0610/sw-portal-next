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
  // 반복 문의 클러스터에서 생성된 경우, 해당 클러스터 티켓들의 문의내용+조치내용에서 뽑은 이력 키워드
  // (문의 접수 시 자동 매칭에 제목과 함께 참고됨). 수동 등록 매뉴얼은 비어있을 수 있음
  matchKeywords: string[];
  updatedBy: string;
  updatedAt: string;
}

export async function listManuals(): Promise<HelpDeskManual[]> {
  const index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
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
  matchKeywords?: string[];
  updatedBy: string;
}): Promise<HelpDeskManual> {
  const id = data.id || crypto.randomUUID();
  const manual: HelpDeskManual = {
    id,
    title: data.title,
    contentType: data.contentType,
    body: data.body,
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

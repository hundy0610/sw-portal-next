import crypto from "crypto";
import { kvGet, kvSetPermanent, kvDel } from "@/lib/kv-store";

const INDEX_KEY = "helpdesk:manual:index";
const manualKey = (id: string) => `helpdesk:manual:${id}`;

export interface HelpDeskManual {
  id: string;
  title: string;
  body: string;
  // 이 매뉴얼로 처리 가능한 조치분류(소분류). 하나의 매뉴얼이 여러 소분류를 커버할 수 있음
  categories: string[];
  // 검색 매칭을 돕는 자유 키워드 (선택)
  keywords: string[];
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
  body: string;
  categories: string[];
  keywords: string[];
  updatedBy: string;
}): Promise<HelpDeskManual> {
  const id = data.id || crypto.randomUUID();
  const manual: HelpDeskManual = {
    id,
    title: data.title,
    body: data.body,
    categories: data.categories,
    keywords: data.keywords,
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

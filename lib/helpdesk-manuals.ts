import crypto from "crypto";
import { kvGet, kvSetPermanent, kvDel } from "@/lib/kv-store";

const INDEX_KEY = "helpdesk:manual:index";
const manualKey = (id: string) => `helpdesk:manual:${id}`;

// Redis 무료 티어 월 명령 한도(500K)를 넘겨 쓰고 있어(재시도를 늘리면 오히려 한도를 더 빨리
// 소진시켜 상황이 악화됨), 서버 인스턴스가 살아있는 동안은 잠깐 결과를 재사용해 명령 수 자체를 줄인다.
// 목록이 비어있는 결과는 캐시하지 않는다 — 진짜 등록된 매뉴얼이 있는데 일시적으로 빈 값을 받은
// 경우까지 캐시해버리면, 그 짧은 순간의 실패가 캐시 기간 내내 이어지게 된다.
let _cachedManuals: { data: HelpDeskManual[]; expiresAt: number } | null = null;
const MANUALS_CACHE_TTL_MS = 30_000;

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
  if (_cachedManuals && _cachedManuals.expiresAt > Date.now()) {
    return _cachedManuals.data;
  }

  // Upstash 응답이 예외 없이 간헐적으로 빈 값을 주는 경우가 관측돼(같은 DB/리전에서도 발생),
  // 인덱스가 비어있으면 한 번 더 확인한다. 다만 재시도 자체가 명령 사용량을 늘리므로 최소한으로만.
  let index: string[] = [];
  for (const delayMs of [0, 200]) {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
    if (index.length > 0) break;
  }
  if (index.length === 0) return [];

  const manuals = (await Promise.all(index.map(id => kvGet<HelpDeskManual>(manualKey(id)))))
    .filter((m): m is HelpDeskManual => !!m);
  _cachedManuals = { data: manuals, expiresAt: Date.now() + MANUALS_CACHE_TTL_MS };
  return manuals;
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
  _cachedManuals = null;
  return manual;
}

export async function deleteManual(id: string): Promise<void> {
  await kvDel(manualKey(id));
  const index = (await kvGet<string[]>(INDEX_KEY)) ?? [];
  await kvSetPermanent(INDEX_KEY, index.filter(i => i !== id));
  _cachedManuals = null;
}

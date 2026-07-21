import type { HelpDeskTicket } from "@/lib/notion";
import type { HelpDeskManual } from "@/lib/helpdesk-manuals";

// 조치내용/문의내용 텍스트에서 의미있는 키워드를 뽑아내는 공용 유틸.
// 관리자 화면의 반복 문의 클러스터링과, 문의 접수 화면의 매뉴얼 자동 제안이 이 로직을 공유한다.
const HELPDESK_STOPWORDS = new Set([
  "있습니다", "했습니다", "하였습니다", "되었습니다", "완료", "확인", "정상", "이후",
  "진행", "안내", "처리", "문의", "것으로", "합니다", "되어", "위해", "통해", "경우",
  "해결", "조치", "드립니다", "부탁드립니다", "확인함", "완료함", "관련", "문제",
]);

export function extractKeywords(text: string): string[] {
  return Array.from(new Set(
    text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !HELPDESK_STOPWORDS.has(w))
  ));
}

// 두 텍스트(둘 다 충분히 긴 자유 서술문)가 같은 유형인지 대칭적으로 비교 — 반복 문의 클러스터링에 사용
export function keywordsSimilar(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  const shared = a.filter(k => setB.has(k));
  if (shared.length < 2) return false;
  const minLen = Math.min(a.length, b.length);
  return shared.length / minLen >= 0.4;
}

export interface RepeatCluster {
  key: string;
  label: string;
  count: number;
  topKeywords: string[];
  tickets: HelpDeskTicket[];
}

// Union-Find로 조치내용 키워드가 겹치는 완료 티켓들을 그룹화
export function clusterByActionNote(tickets: HelpDeskTicket[], minCount: number): RepeatCluster[] {
  const completed = tickets.filter(t => t.status === "완료" && t.actionNote && t.actionNote.trim().length >= 10);
  const n = completed.length;
  const kw = completed.map(t => extractKeywords(t.actionNote));
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (keywordsSimilar(kw[i], kw[j])) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }

  const clusters: RepeatCluster[] = [];
  for (const idxs of groups.values()) {
    if (idxs.length < minCount) continue;
    const freq = new Map<string, number>();
    idxs.forEach(i => kw[i].forEach(k => freq.set(k, (freq.get(k) ?? 0) + 1)));
    const topKeywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    clusters.push({
      key: `cluster-${idxs[0]}`,
      label: topKeywords.length > 0 ? topKeywords.join(" · ") : "기타 반복 유형",
      count: idxs.length,
      topKeywords,
      tickets: idxs.map(i => completed[i]),
    });
  }
  return clusters.sort((a, b) => b.count - a.count);
}

// 매뉴얼에 연결된 티켓들 각각에서 개별 키워드 세트를 뽑는다.
// 여러 건을 하나로 합쳐 상위 N개만 남기면, 많이 연결될수록 흔한 표현(예: "sfc", "scannow")에
// 묻혀 드물지만 실제로 유효한 사례(예: "검은 화면")가 영영 매칭에서 밀려나는 문제가 생긴다.
// 그래서 티켓 단위로 따로 보관해두고, 매칭 시에는 "이 중 한 건과라도 충분히 비슷한지"로 판단한다.
export function extractPerTicketKeywordSets(tickets: HelpDeskTicket[]): string[][] {
  return tickets
    .map(t => extractKeywords(`${t.content || ""} ${t.actionNote || ""}`))
    .filter(set => set.length > 0);
}

// bank.length로만 나누면, 연결된 이력 티켓의 원문이 길고 인사말·잡담이 섞여 있을수록(예: 조치내용에
// "안녕하세요", "감사합니다" 같은 표현이 섞인 경우) 분모가 커져서 실제로 겹치는 핵심 단어가 있어도
// 점수가 희석된다. 새로 들어온 문의는 보통 이력 원문보다 훨씬 짧으므로, 문의 쪽 키워드 수와 이력
// 쪽 키워드 수 중 "더 작은 쪽"을 분모로 써서 — 문의에 있는 단어들이 이력과 얼마나 겹치는지로 판단한다.
function overlapScore(normalizedContent: string, contentKwCount: number, bank: string[]): number {
  if (bank.length === 0 || contentKwCount === 0) return 0;
  // 한국어는 "라이선스가"처럼 조사가 바로 붙으므로, 토큰 일치가 아니라 부분 문자열 포함으로 확인
  const hits = bank.filter(k => normalizedContent.includes(k.toLowerCase())).length;
  if (hits === 0) return 0;
  return hits / Math.min(bank.length, contentKwCount);
}

// 방금 접수된 문의 내용(긴 자유 서술문) ↔ 매뉴얼(제목 + 연결된 이력 티켓 각각)을 비대칭으로 비교.
// 연결된 이력 중 단 한 건과라도 충분히 겹치면 매칭으로 인정 — 문의 접수 완료 화면의 자동 제안에 사용
export function matchManualForContent(
  content: string,
  manuals: HelpDeskManual[]
): { manual: HelpDeskManual; score: number } | null {
  const normalizedContent = content.toLowerCase();
  if (!normalizedContent.trim()) return null;
  const contentKwCount = extractKeywords(content).length;

  let best: { manual: HelpDeskManual; score: number } | null = null;
  for (const m of manuals) {
    const titleKw = extractKeywords(m.title);
    const ticketSets = Array.isArray(m.matchKeywords) ? m.matchKeywords : [];

    // 이력이 전혀 없는 매뉴얼(수동 등록 등)은 기존처럼 제목만으로 매칭, 오탐 방지를 위해 기준을 엄격하게(50%) 유지
    const titleScore = overlapScore(normalizedContent, contentKwCount, titleKw);
    if (titleScore >= 0.5 && (!best || titleScore > best.score)) best = { manual: m, score: titleScore };

    // 연결된 이력 티켓들은 각각 독립적으로 평가 — 다른 이력이 아무리 많아도 이 한 건과의 비교에는 영향 없음
    for (const set of ticketSets) {
      const bank = Array.from(new Set([...titleKw, ...set]));
      const score = overlapScore(normalizedContent, contentKwCount, bank);
      if (score >= 0.35 && (!best || score > best.score)) best = { manual: m, score };
    }
  }
  return best;
}

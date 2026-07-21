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

// 반복 문의 클러스터를 매뉴얼로 만들 때, 그 클러스터에 속한 티켓들의 문의내용(사용자가 쓴 글)과
// 조치내용(엔지니어가 쓴 처리결과)을 모두 참고해 매칭용 키워드를 자동으로 뽑아낸다.
// 매뉴얼 제목 하나만으로는 실제 사용자들이 쓰는 표현을 다 담지 못하므로, 두 데이터를 함께 써서 매칭 정확도를 높인다.
export function extractClusterKeywords(tickets: HelpDeskTicket[], limit = 8): string[] {
  const freq = new Map<string, number>();
  for (const t of tickets) {
    const combined = new Set([...extractKeywords(t.content || ""), ...extractKeywords(t.actionNote || "")]);
    combined.forEach(k => freq.set(k, (freq.get(k) ?? 0) + 1));
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}

// 방금 접수된 문의 내용(긴 자유 서술문) ↔ 매뉴얼(제목 + 이력 키워드)을 비대칭으로 비교.
// 이력 키워드 중 몇 %가 문의 내용에 그대로 등장하는지로 판단 — 문의 접수 완료 화면의 자동 제안에 사용
export function matchManualForContent(
  content: string,
  manuals: HelpDeskManual[]
): { manual: HelpDeskManual; score: number } | null {
  const normalizedContent = content.toLowerCase();
  if (!normalizedContent.trim()) return null;

  let best: { manual: HelpDeskManual; score: number } | null = null;
  for (const m of manuals) {
    const titleKw = extractKeywords(m.title);
    const historyKw = m.matchKeywords ?? [];
    // 이력 키워드(과거 문의내용+조치내용)가 있으면 제목과 합쳐 더 넓은 근거로 매칭하고,
    // 없는 매뉴얼(수동 등록 등)은 기존처럼 제목만으로 매칭해 기존 동작을 그대로 유지한다.
    const bankKw = historyKw.length > 0 ? Array.from(new Set([...titleKw, ...historyKw])) : titleKw;
    if (bankKw.length === 0) continue;
    // 한국어는 "라이선스가"처럼 조사가 바로 붙으므로, 토큰 일치가 아니라 부분 문자열 포함으로 확인
    const hits = bankKw.filter(k => normalizedContent.includes(k.toLowerCase())).length;
    if (hits === 0) continue;
    const score = hits / bankKw.length;
    // 이력 키워드가 섞인 경우 근거 자체가 풍부하므로 기준을 조금 낮추고, 제목뿐인 경우는 오탐 방지를 위해 기존 기준(50%)을 유지
    const threshold = historyKw.length > 0 ? 0.35 : 0.5;
    if (score >= threshold && (!best || score > best.score)) {
      best = { manual: m, score };
    }
  }
  return best;
}

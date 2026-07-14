import type { SwItem } from "@/types";
import type { InstalledProgram } from "@/lib/pc-scan";

export type SwMatchStatus = "whitelist" | "blacklist" | "unknown";

export interface SwAuditEntry extends InstalledProgram {
  status: SwMatchStatus;
  matchedItem?: SwItem;
}

// 공백/하이픈/버전 표기 차이를 흡수하기 위한 느슨한 이름 정규화
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.()]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// "무료로 추정" 힌트용 큐레이션 목록 — 개인/기업 사용 모두에 라이선스 비용 없이
// 쓸 수 있다고 널리 알려진 것만 포함한다. 라이선스 조건이 애매하거나 개인만
// 무료인 SW(예: 일부 백신·압축 프로그램의 기업용 유료 정책)는 의도적으로
// 제외해 잘못된 확신을 주지 않도록 한다. 어디까지나 "확인 권장" 힌트이며
// 최종 판단은 관리자가 한다 — 이 목록에 있어도 블랙리스트 후보 목록에서
// 자동으로 빠지지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_FREE_SOFTWARE = [
  "7-zip", "7zip", "vlc media player", "vlc",
  "notepad++", "gimp", "libreoffice", "putty", "winscp", "filezilla",
  "obs studio", "git", "python", "node.js", "nodejs", "curl",
  "balenaetcher", "rufus", "google chrome", "mozilla firefox",
  "microsoft edge", "adobe acrobat reader dc", "adobe acrobat reader",
  "visual studio code", "notepad", "카카오톡", "나눔글꼴", "나눔고딕",
  "microsoft visual c++ redistributable", "microsoft .net", ".net runtime",
  "directx runtime", "windows terminal", "powertoys",
];

// Application Verifier 등 순수 Microsoft/Windows 부속 컴포넌트 판별용 게시자 키워드
const KNOWN_FREE_PUBLISHERS = ["mozilla", "the document foundation", "python software foundation", "openjs foundation"];

export function likelyFree(name: string, publisher: string): boolean {
  const n = normalize(name);
  if (KNOWN_FREE_SOFTWARE.some(k => n.includes(normalize(k)))) return true;
  const pub = publisher.toLowerCase();
  return KNOWN_FREE_PUBLISHERS.some(k => pub.includes(k));
}

// 관리 중인 SW DB(화이트리스트=approved/conditional, 블랙리스트=banned)와 대조해
// 각 설치 프로그램을 whitelist/blacklist/unknown 으로 분류한다.
export function matchProgramsAgainstSwDb(programs: InstalledProgram[], swItems: SwItem[]): SwAuditEntry[] {
  return programs.map(p => {
    const pn = normalize(p.name);
    if (!pn) return { ...p, status: "unknown" };
    const matched = swItems.find(item => {
      const in_ = normalize(item.name);
      if (!in_) return false;
      return pn === in_ || pn.includes(in_) || in_.includes(pn);
    });
    if (!matched) return { ...p, status: "unknown" };
    return { ...p, status: matched.status === "banned" ? "blacklist" : "whitelist", matchedItem: matched };
  });
}

export interface UnknownAggregateEntry {
  name: string;
  publisher: string;
  count: number;
  pcNames: string[];
  likelyFree: boolean; // 힌트일 뿐, 최종 판단은 관리자가 함
}

// 여러 PC의 "미확인" 목록을 프로그램명 기준으로 합쳐서 몇 대에서 발견됐는지 집계
export function aggregateUnknownPrograms(perPc: { pcName: string; entries: SwAuditEntry[] }[]): UnknownAggregateEntry[] {
  const map = new Map<string, UnknownAggregateEntry>();
  for (const { pcName, entries } of perPc) {
    for (const e of entries) {
      if (e.status !== "unknown") continue;
      const key = normalize(e.name);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        if (!existing.pcNames.includes(pcName)) { existing.pcNames.push(pcName); existing.count++; }
      } else {
        map.set(key, { name: e.name, publisher: e.publisher, count: 1, pcNames: [pcName], likelyFree: likelyFree(e.name, e.publisher) });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

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
        map.set(key, { name: e.name, publisher: e.publisher, count: 1, pcNames: [pcName] });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

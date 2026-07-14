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

// ─────────────────────────────────────────────────────────────────────────────
// "회사(상업용) 사용 시 별도 라이선스 확인 필요" 힌트용 큐레이션 목록 — 개인 사용은
// 무료지만 기업/상업적 사용에는 유료 라이선스가 필요하다고 널리 알려진 프리웨어만
// 포함한다(예: WinRAR 셰어웨어 정책, 백신/최적화 툴의 가정용 무료 정책 등).
// 실제 라이선스 조건은 버전·배포처에 따라 바뀔 수 있으므로 확정 판단이 아닌
// "확인 권장" 힌트다 — 최종 판단은 관리자가 한다.
// ─────────────────────────────────────────────────────────────────────────────
const COMMERCIAL_USE_RESTRICTED = [
  "winrar", "irfanview", "ccleaner",
  "avast free antivirus", "avast antivirus", "avg antivirus free", "avg antivirus",
  "malwarebytes", "advanced systemcare", "driver booster", "picpick",
];

export type CommercialUseHint = "generally-safe" | "verify-required" | "unknown";

export function likelyFree(name: string, publisher: string): boolean {
  return commercialUseHint(name, publisher) === "generally-safe";
}

// 상업용(회사) 환경에서 별도 라이선스 구매 없이 사용해도 무방하다고 추정되는지에
// 대한 힌트. "generally-safe"=오픈소스/기업배포 허용 프리웨어, "verify-required"=
// 개인용은 무료지만 기업 사용 시 유료 라이선스가 필요하다고 알려진 SW,
// "unknown"=자동으로 판단할 근거가 없어 관리자 확인이 필요한 나머지 전부.
export function commercialUseHint(name: string, publisher: string): CommercialUseHint {
  const n = normalize(name);
  const pub = publisher.toLowerCase();
  if (KNOWN_FREE_SOFTWARE.some(k => n.includes(normalize(k)))) return "generally-safe";
  if (KNOWN_FREE_PUBLISHERS.some(k => pub.includes(k))) return "generally-safe";
  if (COMMERCIAL_USE_RESTRICTED.some(k => n.includes(normalize(k)))) return "verify-required";
  return "unknown";
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
  commercialUseHint: CommercialUseHint; // 힌트일 뿐, 최종 판단은 관리자가 함
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
        map.set(key, {
          name: e.name, publisher: e.publisher, count: 1, pcNames: [pcName],
          likelyFree: likelyFree(e.name, e.publisher),
          commercialUseHint: commercialUseHint(e.name, e.publisher),
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

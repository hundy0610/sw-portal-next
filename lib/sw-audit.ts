import type { SwItem } from "@/types";
import type { InstalledProgram } from "@/lib/pc-scan";

export type SwMatchStatus = "whitelist" | "blacklist" | "unknown" | "excluded";

export interface SwAuditEntry extends InstalledProgram {
  status: SwMatchStatus;
  matchedItem?: SwItem;
}

// 공백/하이픈/버전 표기 차이를 흡수하기 위한 느슨한 이름 정규화
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.()]/g, "");
}

/**
 * 금지 정책인지 — "banned"와 "blocked" 둘 다 본다. SwItem 타입에는 "banned"만
 * 있었지만 실제 KV 데이터에는 과거에 등록된 "blocked" 값이 섞여 있다(포털
 * 코드 어디에도 "blocked"를 새로 쓰는 곳은 없다 — 이 코드가 쓰이기 전에
 * 들어간 값으로 보인다). 한쪽만 보면 그 데이터가 조용히 허용으로 분류된다.
 */
export function isBannedPolicy(status: SwItem["status"] | string): boolean {
  return status === "banned" || status === "blocked";
}

// ─────────────────────────────────────────────────────────────────────────────
// 자동 예외 판정 — SW DB에 등록돼 있지 않아도, 이름·게시자로 봤을 때 "사용자가
// 능동적으로 선택한 게 아닌" SW로 추정되면 "unknown"이 아니라 "excluded"로
// 분류한다. 은행·공공기관 보안모듈이나 드라이버는 버전·모델명이 기기마다
// 달라 하나하나 SW DB에 등록해서는 커버할 수 없어, 패턴으로 미리 걸러낸다.
//
// 게시자 목록은 "일반 사용자용 제품을 팔지 않는" 순수 보안 미들웨어/하드웨어
// 벤더만 넣는다. AhnLab처럼 V3 백신 같은 일반 사용자용 제품도 함께 파는
// 벤더는 여기 넣지 않는다 — 이름 패턴(EXCLUDED_NAME_PATTERNS)으로만 잡는다.
// ─────────────────────────────────────────────────────────────────────────────
const EXCLUDED_PUBLISHERS = [
  "initech", "raonsecure", "wizvera", "dreamsecurity", "softforum",
  "penta security", "ksign", "markany", "fasoo", "inca internet",
  "intel corporation", "nvidia corporation", "realtek semiconductor",
  "advanced micro devices", "synaptics incorporated",
];

const EXCLUDED_NAME_PATTERNS = [
  "visual c++", "vcredist", "vc_redist",
  ".net runtime", ".net desktop runtime", ".net framework",
  "directx", "webview2", "windows sdk",
  "안전거래", "safe transaction", // AhnLab Safe Transaction — 은행 접속 시 자동 설치
  "touchen", "inisafe", "veraport", "delfino", "magicline",
  "nprotect", "xecureweb", "isign", "anysign", "ipinside",
];

/** SW DB에 등록되지 않은 프로그램이 자동 예외 패턴에 해당하는지. */
function looksAutoExcluded(name: string, publisher: string): boolean {
  const n = normalize(name);
  const pub = publisher.toLowerCase();
  if (EXCLUDED_PUBLISHERS.some(k => pub.includes(k))) return true;
  if (EXCLUDED_NAME_PATTERNS.some(k => n.includes(normalize(k)))) return true;
  return false;
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

// 관리 중인 SW DB(화이트리스트=approved/conditional, 블랙리스트=banned/blocked,
// 예외=excluded)와 대조해 각 설치 프로그램을 whitelist/blacklist/excluded/unknown
// 으로 분류한다. SW DB에 없어도 자동 예외 패턴에 해당하면 excluded로 분류해
// "미확인" 큐가 드라이버·보안모듈로 영원히 채워지는 걸 막는다.
export function matchProgramsAgainstSwDb(programs: InstalledProgram[], swItems: SwItem[]): SwAuditEntry[] {
  return programs.map(p => {
    const pn = normalize(p.name);
    if (!pn) return { ...p, status: "unknown" };
    const matched = swItems.find(item => {
      const in_ = normalize(item.name);
      if (!in_) return false;
      return pn === in_ || pn.includes(in_) || in_.includes(pn);
    });
    if (matched) {
      if (isBannedPolicy(matched.status)) return { ...p, status: "blacklist", matchedItem: matched };
      if (matched.status === "excluded") return { ...p, status: "excluded", matchedItem: matched };
      return { ...p, status: "whitelist", matchedItem: matched };
    }
    if (looksAutoExcluded(p.name, p.publisher)) return { ...p, status: "excluded" };
    return { ...p, status: "unknown" };
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

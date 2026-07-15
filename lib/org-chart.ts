import { kvGet, kvSetPermanent } from "./kv-store";
import { fetchPcScans } from "./pc-scan";

// 조직도는 Notion 대신 KV(Upstash Redis)에 저장한다 — 계층형 relation을 Notion
// 스키마로 새로 만드는 대신, 이미 쓰고 있는 KV 저장소에 트리 전체를 하나의
// 값으로 두어 바로 편집 가능하게 한다.
const KV_KEY = "orgChart:units";

export type OrgLevel = "사업부" | "본부" | "센터" | "팀";

export interface OrgMember {
  name: string;
  email: string;
}

export interface OrgUnit {
  id: string;
  name: string;
  company: string;
  level: OrgLevel;
  parentId: string | null;
  managerEmail: string;
  managerName: string;
  // 이 조직 단위(주로 최하위 "팀")의 실제 소속 인원 명단 — 진행률은 이 명단의
  // 이메일이 PC 실사 제출 기록(PcScanRecord.email)에 존재하는지로 계산한다.
  // HW 자산 마스터 데이터(부서/사용자 필드)는 정확도가 보장되지 않아 기준으로 쓰지 않는다.
  members: OrgMember[];
  notionUrl: string; // KV 저장 방식에서는 사용하지 않음(항상 빈 문자열) — 기존 UI 타입 호환용
}

// "이름:이메일, 이름:이메일" 형식 텍스트 ↔ OrgMember[] 변환.
// 이름 없이 이메일만 적어도 허용한다("이메일" 단독 항목 → name: "").
export function parseMembers(raw: string): OrgMember[] {
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean).map(entry => {
    const idx = entry.indexOf(":");
    if (idx === -1) return { name: "", email: entry.toLowerCase() };
    return { name: entry.slice(0, idx).trim(), email: entry.slice(idx + 1).trim().toLowerCase() };
  }).filter(m => m.email);
}

export function serializeMembers(members: OrgMember[]): string {
  return members.map(m => (m.name ? `${m.name}:${m.email}` : m.email)).join(", ");
}

// ── 초기값 — idsTrust 경영지원팀 산하 자산관리파트 실제 구성.
// KV에 아직 아무 것도 저장되지 않은 최초 상태에서만 사용되며, 관리자 화면에서
// 조직을 추가/수정하는 순간부터는 KV에 저장된 값이 그대로 기준이 된다.
const DEFAULT_UNITS: OrgUnit[] = [
  {
    id: "org-mgmt-support", name: "경영지원팀", company: "idsTrust", level: "본부", parentId: null,
    managerEmail: "", managerName: "", members: [], notionUrl: "",
  },
  {
    id: "org-asset-part", name: "자산관리파트", company: "idsTrust", level: "팀", parentId: "org-mgmt-support",
    managerEmail: "jeokwon94@idstrust.com", managerName: "권정훈",
    members: [
      { name: "권용관", email: "kyk3146@idstrust.com" },
      { name: "백승윤", email: "qortmddbs33@idstrust.com" },
      { name: "이동경", email: "dongkyeong@idstrust.com" },
      { name: "권정훈", email: "jeokwon94@idstrust.com" },
    ],
    notionUrl: "",
  },
];

async function loadUnits(): Promise<OrgUnit[]> {
  const stored = await kvGet<OrgUnit[]>(KV_KEY);
  return stored ?? DEFAULT_UNITS;
}

export async function fetchOrgUnits(): Promise<OrgUnit[]> {
  return loadUnits();
}

export async function createOrgUnit(data: Omit<OrgUnit, "id" | "notionUrl">): Promise<string> {
  const units = await loadUnits();
  const id = `org_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await kvSetPermanent(KV_KEY, [...units, { ...data, id, notionUrl: "" }]);
  return id;
}

export async function updateOrgUnit(id: string, data: Partial<Omit<OrgUnit, "id" | "notionUrl">>): Promise<void> {
  const units = await loadUnits();
  const idx = units.findIndex(u => u.id === id);
  if (idx === -1) throw new Error("조직을 찾을 수 없습니다.");
  const next = [...units];
  next[idx] = { ...next[idx], ...data };
  await kvSetPermanent(KV_KEY, next);
}

// 삭제된 조직을 상위조직으로 참조하던 하위 조직은 buildOrgTree에서 자동으로
// 최상위 취급되므로(부모 id가 존재하지 않으면 root) 별도 정리가 필요 없다.
export async function archiveOrgUnit(id: string): Promise<void> {
  const units = await loadUnits();
  await kvSetPermanent(KV_KEY, units.filter(u => u.id !== id));
}

// 실사 제출 완료 여부 판단용 이메일 집합 — PC 실사 프로그램이 실행되면 그 시점의
// 실행자 이메일이 그대로 수집되므로, HW 자산 마스터(부서/사용자)와 무관하게
// "제출했는지"를 정확히 알 수 있다.
export async function fetchSubmittedEmails(): Promise<Set<string>> {
  const scans = await fetchPcScans();
  return new Set(scans.map(s => s.email.toLowerCase()).filter(Boolean));
}

// ─────────────────────────────────────────────────────────────────────────────
// 트리 구성 + 진행률 집계
// 진행률은 조직도상의 최상위 조직 아래 하위 조직 개수·깊이에 아무 제약이 없다 —
// parentId 기반으로만 구성되므로 계열사마다 구조가 달라도 그대로 반영된다.
// ─────────────────────────────────────────────────────────────────────────────
export interface OrgProgress { total: number; verified: number }
export interface OrgTreeNode extends OrgUnit {
  children: OrgTreeNode[];
  ownProgress: OrgProgress;   // 이 단위에 직접 등록된 인원만
  rollupProgress: OrgProgress; // 이 단위 + 모든 하위 단위 합산
}

// submittedEmails: PC 실사 제출 기록(PcScanRecord)에서 수집된 이메일 집합(소문자 정규화)
export function computeUnitProgress(unit: OrgUnit, submittedEmails: Set<string>): OrgProgress {
  if (unit.members.length === 0) return { total: 0, verified: 0 };
  const verified = unit.members.filter(m => submittedEmails.has(m.email.toLowerCase())).length;
  return { total: unit.members.length, verified };
}

export function buildOrgTree(units: OrgUnit[], submittedEmails: Set<string>): OrgTreeNode[] {
  const byId = new Map<string, OrgTreeNode>();
  for (const u of units) {
    byId.set(u.id, { ...u, children: [], ownProgress: computeUnitProgress(u, submittedEmails), rollupProgress: { total: 0, verified: 0 } });
  }
  const roots: OrgTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function rollup(node: OrgTreeNode): OrgProgress {
    let total = node.ownProgress.total;
    let verified = node.ownProgress.verified;
    for (const child of node.children) {
      const r = rollup(child);
      total += r.total;
      verified += r.verified;
    }
    node.rollupProgress = { total, verified };
    return node.rollupProgress;
  }
  roots.forEach(rollup);

  return roots;
}

// 특정 조직 단위(및 모든 하위 단위)를 트리에서 찾아 서브트리로 반환
export function findSubtree(tree: OrgTreeNode[], unitId: string): OrgTreeNode | null {
  for (const node of tree) {
    if (node.id === unitId) return node;
    const found = findSubtree(node.children, unitId);
    if (found) return found;
  }
  return null;
}

// 서브트리에 속한 모든 단위 id(자기 자신 포함) 나열
export function collectUnitIds(node: OrgTreeNode): string[] {
  return [node.id, ...node.children.flatMap(collectUnitIds)];
}

// 서브트리에 속한 모든 인원(자기 자신 조직 + 하위 조직 전체) 나열
export function collectMembers(node: OrgTreeNode): OrgMember[] {
  return [...node.members, ...node.children.flatMap(collectMembers)];
}

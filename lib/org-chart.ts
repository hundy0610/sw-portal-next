import { Client } from "@notionhq/client";
import { fetchPcScans } from "./pc-scan";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 조직도 Notion DB는 아직 실제 워크스페이스에 생성되지 않은 경우가 있다(Phase 3
// 신규 생성 항목). DB가 연결되기 전까지는 에러를 던지는 대신 샘플 데이터로
// 화면 구성을 미리 확인할 수 있게 하고, 편집 요청만 명확한 안내와 함께 막는다.
export function isOrgChartConfigured(): boolean {
  return !!process.env.NOTION_DB_ORG_CHART;
}

function getDbId(): string | null {
  return process.env.NOTION_DB_ORG_CHART ?? null;
}

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
  notionUrl: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function text(p: any, key: string): string {
  const v = p?.[key];
  if (!v) return "";
  if (v.type === "title")     return (v.title as { plain_text: string }[]).map(t => t.plain_text).join("");
  if (v.type === "rich_text") return (v.rich_text as { plain_text: string }[]).map(t => t.plain_text).join("");
  return "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function select(p: any, key: string): string {
  return p?.[key]?.type === "select" ? (p[key].select?.name ?? "") : "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function email(p: any, key: string): string {
  return p?.[key]?.type === "email" ? (p[key].email ?? "") : "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function relationFirst(p: any, key: string): string | null {
  const rel = p?.[key];
  if (rel?.type !== "relation" || !Array.isArray(rel.relation) || rel.relation.length === 0) return null;
  return rel.relation[0].id as string;
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

// ── 샘플 데이터 — NOTION_DB_ORG_CHART 연결 전, 화면 구성 미리보기용.
// 4단계(사업부/본부/센터/팀) 깊이와 진행률 편차(0%~100%)를 함께 보여준다.
const MOCK_ORG_UNITS: OrgUnit[] = [
  {
    id: "mock-biz-it", name: "IT 사업부", company: "대웅제약", level: "사업부", parentId: null,
    managerEmail: "hong.gd@example.com", managerName: "홍길동", members: [], notionUrl: "#",
  },
  {
    id: "mock-hq-dev", name: "개발본부", company: "대웅제약", level: "본부", parentId: "mock-biz-it",
    managerEmail: "kim.dev0@example.com", managerName: "김본부", members: [], notionUrl: "#",
  },
  {
    id: "mock-team-be", name: "백엔드팀", company: "대웅제약", level: "팀", parentId: "mock-hq-dev",
    managerEmail: "kim.dev1@example.com", managerName: "김개발",
    members: [
      { name: "김개발", email: "kim.dev1@example.com" },
      { name: "이백엔드", email: "kim.dev2@example.com" },
      { name: "박신입", email: "kim.dev3@example.com" },
    ],
    notionUrl: "#",
  },
  {
    id: "mock-team-fe", name: "프론트팀", company: "대웅제약", level: "팀", parentId: "mock-hq-dev",
    managerEmail: "park.fe1@example.com", managerName: "박프론트",
    members: [
      { name: "박프론트", email: "park.fe1@example.com" },
      { name: "최화면", email: "park.fe2@example.com" },
    ],
    notionUrl: "#",
  },
  {
    id: "mock-center-plan", name: "IT기획센터", company: "대웅제약", level: "센터", parentId: "mock-biz-it",
    managerEmail: "jung.plan@example.com", managerName: "정기획",
    members: [
      { name: "정기획", email: "plan1@example.com" },
      { name: "한전략", email: "plan2@example.com" },
      { name: "오예산", email: "plan3@example.com" },
      { name: "서관리", email: "plan4@example.com" },
    ],
    notionUrl: "#",
  },
  {
    id: "mock-biz-prod", name: "생산 사업부", company: "대웅바이오", level: "사업부", parentId: null,
    managerEmail: "yoon.biz@example.com", managerName: "윤사업", members: [], notionUrl: "#",
  },
  {
    id: "mock-hq-prod", name: "생산본부", company: "대웅바이오", level: "본부", parentId: "mock-biz-prod",
    managerEmail: "shin.hq@example.com", managerName: "신본부", members: [], notionUrl: "#",
  },
  {
    id: "mock-team-prod1", name: "생산1팀", company: "대웅바이오", level: "팀", parentId: "mock-hq-prod",
    managerEmail: "prod1@example.com", managerName: "장생산",
    members: [
      { name: "장생산", email: "prod1@example.com" },
      { name: "임공정", email: "prod2@example.com" },
      { name: "노설비", email: "prod3@example.com" },
    ],
    notionUrl: "#",
  },
  {
    id: "mock-team-prod2", name: "생산2팀", company: "대웅바이오", level: "팀", parentId: "mock-hq-prod",
    managerEmail: "prod4@example.com", managerName: "문품질",
    members: [
      { name: "문품질", email: "prod4@example.com" },
      { name: "구검사", email: "prod5@example.com" },
    ],
    notionUrl: "#",
  },
];

// 위 샘플 인원 중 "실사 제출 완료"로 간주할 이메일 — 진행률 0%/33%/67%/100%가
// 고르게 나타나도록 고정 구성한다.
const MOCK_SUBMITTED_EMAILS = [
  "kim.dev1@example.com", "kim.dev2@example.com", // 백엔드팀 2/3
  "park.fe1@example.com", "park.fe2@example.com", // 프론트팀 2/2
  "prod1@example.com",                            // 생산1팀 1/3
  "prod4@example.com", "prod5@example.com",       // 생산2팀 2/2
  // IT기획센터는 전원 미제출 — 0/4
];

export async function fetchOrgUnits(): Promise<OrgUnit[]> {
  const dbId = getDbId();
  if (!dbId) return MOCK_ORG_UNITS;

  const units: OrgUnit[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: dbId,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of res.results) {
      if (page.object !== "page" || !("properties" in page)) continue;
      const p = page.properties as Record<string, unknown>;
      units.push({
        id: page.id,
        name: text(p, "이름"),
        company: select(p, "법인"),
        level: (select(p, "레벨") || "팀") as OrgLevel,
        parentId: relationFirst(p, "상위조직"),
        managerEmail: email(p, "직책자이메일"),
        managerName: text(p, "직책자이름"),
        members: parseMembers(text(p, "소속인원")),
        notionUrl: (page as { url: string }).url,
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return units;
}

export async function createOrgUnit(data: Omit<OrgUnit, "id" | "notionUrl">): Promise<string> {
  const dbId = getDbId();
  if (!dbId) throw new Error("샘플 데이터 모드입니다 — 실제 조직도 Notion DB(NOTION_DB_ORG_CHART) 연결 후 편집할 수 있습니다.");
  const props: Record<string, unknown> = {
    "이름":       { title: [{ text: { content: data.name } }] },
    "법인":       { select: data.company ? { name: data.company } : null },
    "레벨":       { select: { name: data.level } },
    "직책자이메일": { email: data.managerEmail || null },
    "직책자이름":  { rich_text: [{ text: { content: data.managerName } }] },
    "소속인원":    { rich_text: [{ text: { content: serializeMembers(data.members) } }] },
  };
  if (data.parentId) props["상위조직"] = { relation: [{ id: data.parentId }] };
  const res = await notion.pages.create({ parent: { database_id: dbId }, properties: props as Parameters<typeof notion.pages.create>[0]["properties"] });
  return res.id;
}

export async function updateOrgUnit(id: string, data: Partial<Omit<OrgUnit, "id" | "notionUrl">>): Promise<void> {
  if (!isOrgChartConfigured()) throw new Error("샘플 데이터 모드입니다 — 실제 조직도 Notion DB(NOTION_DB_ORG_CHART) 연결 후 편집할 수 있습니다.");
  const props: Record<string, unknown> = {};
  if (data.name         !== undefined) props["이름"] = { title: [{ text: { content: data.name } }] };
  if (data.company      !== undefined) props["법인"] = { select: data.company ? { name: data.company } : null };
  if (data.level        !== undefined) props["레벨"] = { select: { name: data.level } };
  if (data.managerEmail !== undefined) props["직책자이메일"] = { email: data.managerEmail || null };
  if (data.managerName  !== undefined) props["직책자이름"]  = { rich_text: [{ text: { content: data.managerName } }] };
  if (data.members      !== undefined) props["소속인원"]    = { rich_text: [{ text: { content: serializeMembers(data.members) } }] };
  if (data.parentId     !== undefined) props["상위조직"]    = { relation: data.parentId ? [{ id: data.parentId }] : [] };
  await notion.pages.update({ page_id: id, properties: props as Parameters<typeof notion.pages.update>[0]["properties"] });
}

export async function archiveOrgUnit(id: string): Promise<void> {
  if (!isOrgChartConfigured()) throw new Error("샘플 데이터 모드입니다 — 실제 조직도 Notion DB(NOTION_DB_ORG_CHART) 연결 후 편집할 수 있습니다.");
  await notion.pages.update({ page_id: id, archived: true });
}

// 실사 제출 완료 여부 판단용 이메일 집합 — PC 실사 프로그램이 실행되면 그 시점의
// 실행자 이메일이 그대로 수집되므로, HW 자산 마스터(부서/사용자)와 무관하게
// "제출했는지"를 정확히 알 수 있다.
// 조직도 DB가 아직 연결되지 않은 샘플 모드에서는, 트리가 MOCK_ORG_UNITS이므로
// 진행률도 함께 고르게(0%~100%) 보이도록 샘플 제출 이메일을 섞어준다.
export async function fetchSubmittedEmails(): Promise<Set<string>> {
  const scans = await fetchPcScans();
  const emails = new Set(scans.map(s => s.email.toLowerCase()).filter(Boolean));
  if (!isOrgChartConfigured()) {
    for (const e of MOCK_SUBMITTED_EMAILS) emails.add(e);
  }
  return emails;
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

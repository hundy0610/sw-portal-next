import { Client } from "@notionhq/client";
import type { HwRecord } from "./hw";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getDbId(): string {
  const id = process.env.NOTION_DB_ORG_CHART;
  if (!id) throw new Error("NOTION_DB_ORG_CHART 환경변수가 설정되지 않았습니다.");
  return id;
}

export type OrgLevel = "사업부" | "본부" | "센터" | "팀";

export interface OrgUnit {
  id: string;
  name: string;
  company: string;
  level: OrgLevel;
  parentId: string | null;
  managerEmail: string;
  managerName: string;
  // 이 조직 단위(주로 최하위 "팀")에 속한 HW 자산의 실제 "부서" 필드값들
  // (콤마로 구분해 입력) — 진행률 계산 시 HwRecord.dept와 매칭한다.
  deptMapping: string[];
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

export async function fetchOrgUnits(): Promise<OrgUnit[]> {
  const dbId = getDbId();
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
      const mapping = text(p, "매핑부서명");
      units.push({
        id: page.id,
        name: text(p, "이름"),
        company: select(p, "법인"),
        level: (select(p, "레벨") || "팀") as OrgLevel,
        parentId: relationFirst(p, "상위조직"),
        managerEmail: email(p, "직책자이메일"),
        managerName: text(p, "직책자이름"),
        deptMapping: mapping ? mapping.split(",").map(s => s.trim()).filter(Boolean) : [],
        notionUrl: (page as { url: string }).url,
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return units;
}

export async function createOrgUnit(data: Omit<OrgUnit, "id" | "notionUrl">): Promise<string> {
  const dbId = getDbId();
  const props: Record<string, unknown> = {
    "이름":       { title: [{ text: { content: data.name } }] },
    "법인":       { select: data.company ? { name: data.company } : null },
    "레벨":       { select: { name: data.level } },
    "직책자이메일": { email: data.managerEmail || null },
    "직책자이름":  { rich_text: [{ text: { content: data.managerName } }] },
    "매핑부서명":  { rich_text: [{ text: { content: data.deptMapping.join(", ") } }] },
  };
  if (data.parentId) props["상위조직"] = { relation: [{ id: data.parentId }] };
  const res = await notion.pages.create({ parent: { database_id: dbId }, properties: props as Parameters<typeof notion.pages.create>[0]["properties"] });
  return res.id;
}

export async function updateOrgUnit(id: string, data: Partial<Omit<OrgUnit, "id" | "notionUrl">>): Promise<void> {
  const props: Record<string, unknown> = {};
  if (data.name         !== undefined) props["이름"] = { title: [{ text: { content: data.name } }] };
  if (data.company      !== undefined) props["법인"] = { select: data.company ? { name: data.company } : null };
  if (data.level        !== undefined) props["레벨"] = { select: { name: data.level } };
  if (data.managerEmail !== undefined) props["직책자이메일"] = { email: data.managerEmail || null };
  if (data.managerName  !== undefined) props["직책자이름"]  = { rich_text: [{ text: { content: data.managerName } }] };
  if (data.deptMapping  !== undefined) props["매핑부서명"]  = { rich_text: [{ text: { content: data.deptMapping.join(", ") } }] };
  if (data.parentId     !== undefined) props["상위조직"]    = { relation: data.parentId ? [{ id: data.parentId }] : [] };
  await notion.pages.update({ page_id: id, properties: props as Parameters<typeof notion.pages.update>[0]["properties"] });
}

export async function archiveOrgUnit(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 트리 구성 + 진행률 집계
// ─────────────────────────────────────────────────────────────────────────────
export interface OrgProgress { total: number; verified: number }
export interface OrgTreeNode extends OrgUnit {
  children: OrgTreeNode[];
  ownProgress: OrgProgress;   // 이 단위에 직접 매핑된 부서만
  rollupProgress: OrgProgress; // 이 단위 + 모든 하위 단위 합산
}

export function computeUnitProgress(unit: OrgUnit, hwRecords: HwRecord[]): OrgProgress {
  if (unit.deptMapping.length === 0) return { total: 0, verified: 0 };
  const matched = hwRecords.filter(r => unit.deptMapping.includes(r.dept));
  return { total: matched.length, verified: matched.filter(r => r.verified).length };
}

export function buildOrgTree(units: OrgUnit[], hwRecords: HwRecord[]): OrgTreeNode[] {
  const byId = new Map<string, OrgTreeNode>();
  for (const u of units) {
    byId.set(u.id, { ...u, children: [], ownProgress: computeUnitProgress(u, hwRecords), rollupProgress: { total: 0, verified: 0 } });
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

import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";
import type { Notice, Course, Resource } from "@/types/portal";
import type { SwItem } from "@/types";

const KV_NOTICES   = "portal:notices";
const KV_COURSES   = "portal:courses";
const KV_RESOURCES = "portal:resources";
const KV_SWDB      = "portal:swdb";
const KV_AUDIT     = "portal:audit_log";

// ─── Audit Log ──────────────────────────────────────────
export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: "create" | "update" | "delete";
  target: "notices" | "courses" | "resources" | "swdb";
  itemTitle: string;
  timestamp: string; // ISO
}

export async function appendAuditLog(entry: Omit<AuditLog, "id">): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    const logs = (await kvGet<AuditLog[]>(KV_AUDIT)) ?? [];
    const newLog: AuditLog = { id: `al_${Date.now()}`, ...entry };
    // 최대 500건 유지
    const trimmed = [newLog, ...logs].slice(0, 500);
    await kvSetPermanent(KV_AUDIT, trimmed);
  } catch (e) {
    console.warn("[audit] log failed:", e);
  }
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  if (!process.env.REDIS_URL) return [];
  try {
    const logs = (await kvGet<AuditLog[]>(KV_AUDIT)) ?? [];
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

// 인메모리 캐시 TTL: 60초 (포털 콘텐츠는 자주 바뀌지 않음)
const MEM_TTL = 60;

// ─── Notices ────────────────────────────────────────────
export async function getNotices(onlyVisible = true): Promise<Notice[]> {
  let data = memGet<Notice[]>(KV_NOTICES);
  if (!data) {
    data = (await kvGet<Notice[]>(KV_NOTICES)) ?? [];
    memSet(KV_NOTICES, data, MEM_TTL);
  }
  return onlyVisible ? data.filter(n => n.visible) : data;
}

export async function saveNotices(notices: Notice[]): Promise<void> {
  await kvSetPermanent(KV_NOTICES, notices);
  memSet(KV_NOTICES, notices, MEM_TTL); // 인메모리도 즉시 갱신
}

// ─── Courses ────────────────────────────────────────────
export async function getCourses(onlyVisible = true): Promise<Course[]> {
  let data = memGet<Course[]>(KV_COURSES);
  if (!data) {
    data = (await kvGet<Course[]>(KV_COURSES)) ?? [];
    memSet(KV_COURSES, data, MEM_TTL);
  }
  const list = onlyVisible ? data.filter(c => c.visible) : data;
  return list.sort((a, b) => a.order - b.order);
}

export async function saveCourses(courses: Course[]): Promise<void> {
  await kvSetPermanent(KV_COURSES, courses);
  memSet(KV_COURSES, courses, MEM_TTL);
}

// ─── Resources ──────────────────────────────────────────
export async function getResources(onlyVisible = true): Promise<Resource[]> {
  let data = memGet<Resource[]>(KV_RESOURCES);
  if (!data) {
    data = (await kvGet<Resource[]>(KV_RESOURCES)) ?? [];
    memSet(KV_RESOURCES, data, MEM_TTL);
  }
  const list = onlyVisible ? data.filter(r => r.visible) : data;
  return list.sort((a, b) => a.order - b.order);
}

export async function saveResources(resources: Resource[]): Promise<void> {
  await kvSetPermanent(KV_RESOURCES, resources);
  memSet(KV_RESOURCES, resources, MEM_TTL);
}

// ─── SW DB (화이트/블랙리스트) ───────────────────────────
export async function getSwItems(): Promise<SwItem[]> {
  let data = memGet<SwItem[]>(KV_SWDB);
  if (!data) {
    data = (await kvGet<SwItem[]>(KV_SWDB)) ?? [];
    memSet(KV_SWDB, data, MEM_TTL);
  }
  return data;
}

export async function saveSwItems(items: SwItem[]): Promise<void> {
  await kvSetPermanent(KV_SWDB, items);
  memSet(KV_SWDB, items, MEM_TTL);
}

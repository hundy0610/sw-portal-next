import { kv } from "@vercel/kv";
import type { Notice, Course, Resource } from "@/types/portal";

const KV_NOTICES   = "portal:notices";
const KV_COURSES   = "portal:courses";
const KV_RESOURCES = "portal:resources";

const kvAvailable = () => !!process.env.KV_REST_API_URL;

async function kvGetPermanent<T>(key: string): Promise<T | null> {
  if (!kvAvailable()) return null;
  try { return await kv.get<T>(key); } catch { return null; }
}

async function kvSetPermanent<T>(key: string, value: T): Promise<void> {
  if (!kvAvailable()) return;
  try { await kv.set(key, value); } catch (e) { console.warn("[portal-store] set failed:", e); }
}

// ─── Notices ────────────────────────────────────────────
export async function getNotices(onlyVisible = true): Promise<Notice[]> {
  const data = (await kvGetPermanent<Notice[]>(KV_NOTICES)) ?? [];
  return onlyVisible ? data.filter(n => n.visible) : data;
}

export async function saveNotices(notices: Notice[]): Promise<void> {
  await kvSetPermanent(KV_NOTICES, notices);
}

// ─── Courses ────────────────────────────────────────────
export async function getCourses(onlyVisible = true): Promise<Course[]> {
  const data = (await kvGetPermanent<Course[]>(KV_COURSES)) ?? [];
  const list = onlyVisible ? data.filter(c => c.visible) : data;
  return list.sort((a, b) => a.order - b.order);
}

export async function saveCourses(courses: Course[]): Promise<void> {
  await kvSetPermanent(KV_COURSES, courses);
}

// ─── Resources ──────────────────────────────────────────
export async function getResources(onlyVisible = true): Promise<Resource[]> {
  const data = (await kvGetPermanent<Resource[]>(KV_RESOURCES)) ?? [];
  const list = onlyVisible ? data.filter(r => r.visible) : data;
  return list.sort((a, b) => a.order - b.order);
}

export async function saveResources(resources: Resource[]): Promise<void> {
  await kvSetPermanent(KV_RESOURCES, resources);
}

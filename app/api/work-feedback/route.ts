import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader, resolveCurrentName } from "@/lib/session";
import type { Grade, AnnualGoal, MonthlyGoal, WeeklyEntry, WorkFeedbackStore } from "@/types/work-feedback";

export type { Grade, AnnualGoal, MonthlyGoal, WeeklyEntry, WorkFeedbackStore };

const KV_KEY = "work-feedback:all";

function emptyStore(): WorkFeedbackStore {
  return { annualGoals: [], monthlyGoals: [], weeklyEntries: [] };
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getSession(req: NextRequest) {
  return getSessionFromCookieHeader(req.headers.get("cookie"));
}

// GET /api/work-feedback
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const store = (await kvGet<WorkFeedbackStore>(KV_KEY)) ?? emptyStore();
  return NextResponse.json({ ok: true, data: store });
}

// POST /api/work-feedback  — create or update annual goal, monthly goal, or weekly entry
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, payload } = body as { type: string; payload: Record<string, unknown> };

  const store = (await kvGet<WorkFeedbackStore>(KV_KEY)) ?? emptyStore();
  const now = new Date().toISOString();

  if (type === "annualGoal") {
    const { id, userId, year, title, currentLevel, reason, businessEffect, teamEffect } = payload as AnnualGoal;
    // Only super or self
    if (session.role !== "super" && session.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (id) {
      const idx = store.annualGoals.findIndex(g => g.id === id);
      if (idx >= 0) {
        store.annualGoals[idx] = { ...store.annualGoals[idx], title, currentLevel, reason, businessEffect, teamEffect };
      }
    } else {
      store.annualGoals.push({ id: nanoid(), userId, year, title, currentLevel, reason, businessEffect, teamEffect, createdAt: now });
    }
  } else if (type === "monthlyGoal") {
    const { id, userId, year, month, annualGoalIds, content } = payload as MonthlyGoal;
    if (session.role !== "super" && session.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (id) {
      const idx = store.monthlyGoals.findIndex(g => g.id === id);
      if (idx >= 0) {
        store.monthlyGoals[idx] = { ...store.monthlyGoals[idx], annualGoalIds, content, updatedAt: now };
      }
    } else {
      store.monthlyGoals.push({ id: nanoid(), userId, year, month, annualGoalIds, content, createdAt: now, updatedAt: now });
    }
  } else if (type === "weeklyEntry") {
    const { id, userId, year, month, week, activities, concerns, feedbackNeeded } = payload as WeeklyEntry;
    if (session.role !== "super" && session.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (id) {
      const idx = store.weeklyEntries.findIndex(e => e.id === id);
      if (idx >= 0) {
        store.weeklyEntries[idx] = { ...store.weeklyEntries[idx], activities, concerns, feedbackNeeded, updatedAt: now };
      }
    } else {
      store.weeklyEntries.push({ id: nanoid(), userId, year, month, week, activities, concerns, feedbackNeeded, createdAt: now, updatedAt: now });
    }
  } else {
    return NextResponse.json({ ok: false, error: "Unknown type" }, { status: 400 });
  }

  await kvSetPermanent(KV_KEY, store);
  return NextResponse.json({ ok: true, data: store });
}

// PATCH /api/work-feedback  — update monthly evaluation (super only)
export async function PATCH(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== "super") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { monthlyGoalId, grade, comment } = await req.json() as { monthlyGoalId: string; grade: Grade; comment: string };
  const store = (await kvGet<WorkFeedbackStore>(KV_KEY)) ?? emptyStore();
  const idx = store.monthlyGoals.findIndex(g => g.id === monthlyGoalId);
  if (idx < 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  store.monthlyGoals[idx].evaluation = {
    grade,
    comment,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: (await resolveCurrentName(session)) || session.userId,
  };

  await kvSetPermanent(KV_KEY, store);
  return NextResponse.json({ ok: true, data: store });
}

// DELETE /api/work-feedback
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { type, id, userId } = await req.json() as { type: string; id: string; userId: string };
  if (session.role !== "super" && session.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const store = (await kvGet<WorkFeedbackStore>(KV_KEY)) ?? emptyStore();

  if (type === "annualGoal") {
    store.annualGoals = store.annualGoals.filter(g => g.id !== id);
    // cascade: remove monthly goals and their weekly entries linked to this annual goal
  } else if (type === "monthlyGoal") {
    store.monthlyGoals = store.monthlyGoals.filter(g => g.id !== id);
  } else if (type === "weeklyEntry") {
    store.weeklyEntries = store.weeklyEntries.filter(e => e.id !== id);
  }

  await kvSetPermanent(KV_KEY, store);
  return NextResponse.json({ ok: true, data: store });
}

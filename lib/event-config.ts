import { kvGet, kvSetPermanent } from "@/lib/kv-store";

const CONFIG_KEY = "event:config";
const PREV_PARTICIPANTS_KEY = "event:previousParticipants";

export type ParticipationMode = "all" | "employee_list" | "previous";

export interface EventConfig {
  open: boolean;
  closeAt: string | null;
  teamA: string;
  teamB: string;
  title: string;
  description: string;
  matchDate: string;
  participationMode: ParticipationMode;
  resultPublished: boolean;
  resultRevealAt: string | null;
  answerA: number | null;
  answerB: number | null;
}

const DEFAULT_CONFIG: EventConfig = {
  open: true,
  closeAt: null,
  teamA: "한국",
  teamB: "멕시코",
  title: "한국 vs 멕시코 토토",
  description: "정확한 점수를 맞추면 좋은 일이 생깁니다!",
  matchDate: "",
  participationMode: "all",
  resultPublished: false,
  resultRevealAt: null,
  answerA: null,
  answerB: null,
};

export async function getEventConfig(): Promise<EventConfig> {
  const stored = await kvGet<Partial<EventConfig>>(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...(stored ?? {}) };
}

export async function setEventConfig(patch: Partial<EventConfig>): Promise<EventConfig> {
  const current = await getEventConfig();
  const next = { ...current, ...patch };
  await kvSetPermanent(CONFIG_KEY, next);
  return next;
}

export function isEffectivelyOpen(cfg: EventConfig): boolean {
  if (!cfg.open) return false;
  if (cfg.closeAt && Date.now() >= new Date(cfg.closeAt).getTime()) return false;
  return true;
}

export function isResultRevealed(cfg: EventConfig): boolean {
  if (!cfg.resultPublished) return false;
  if (cfg.resultRevealAt && Date.now() < new Date(cfg.resultRevealAt).getTime()) return false;
  return true;
}

export async function getPreviousParticipants(): Promise<string[]> {
  return (await kvGet<string[]>(PREV_PARTICIPANTS_KEY)) ?? [];
}

export async function snapshotPreviousParticipants(names: string[]): Promise<void> {
  await kvSetPermanent(PREV_PARTICIPANTS_KEY, Array.from(new Set(names)));
}

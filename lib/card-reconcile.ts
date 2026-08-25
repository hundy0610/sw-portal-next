import type { CardRow } from "@/lib/card-import";

// ─────────────────────────────────────────────────────────────────────────────
// 카드명세 ↔ 등록된 구독 대사(reconciliation)
//
// "카드로 실제 나간 돈"과 "포털에 등록된 구독"을 맞춰본다. 목적은 두 가지 누락을
// 잡는 것:
//   1) 카드로는 나갔는데 포털에 등록이 없는 지출 (= 관리 사각지대, 새는 돈)
//   2) 포털엔 등록됐는데 이번 달 카드 지출이 안 잡힌 구독 (= 해지됐는데 남아있거나,
//      다른 결제수단이거나, 명세 누락)
//
// 카드명세에는 SW명이 그대로 찍히지 않는 경우가 많아(가맹점명이 "ANTHROPIC",
// "MICROSOFT*STORE" 식) 완전 자동 매칭은 불가능하다. 그래서 금액·부서 기반으로
// "확실/추정/불일치"만 나누고, 최종 판단은 담당자가 화면에서 하도록 한다.
// ─────────────────────────────────────────────────────────────────────────────

/** 대사 대상 구독 (report의 SubRow에서 필요한 것만) */
export interface ReconcileSub {
  id: string;
  company: string;
  department: string;
  swName: string;
  user: string;
  /** 월 환산 원화 금액(결제일 환율 적용 후) */
  monthlyKrw: number;
}

export type MatchStatus = "matched" | "probable" | "card-only" | "sub-only";

export interface ReconcileItem {
  status: MatchStatus;
  company: string;
  department: string;
  /** 카드 쪽 정보 (card-only / matched / probable) */
  card?: { paidAt: string; amount: number; cardLast4: string; note: string };
  /** 구독 쪽 정보 (sub-only / matched / probable) */
  sub?: { id: string; swName: string; user: string; monthlyKrw: number };
  /** 금액 차이(카드 - 구독). matched/probable에서만 의미 있음 */
  diff?: number;
  reason: string;
}

export interface ReconcileSummary {
  cardTotal: number;
  subTotal: number;
  matchedCount: number;
  probableCount: number;
  cardOnlyCount: number;
  subOnlyCount: number;
  cardOnlyAmount: number;
  subOnlyAmount: number;
}

/** 금액이 이 비율 이내로 차이나면 같은 건으로 본다(부가세·환율 변동 흡수) */
const AMOUNT_TOLERANCE = 0.1; // ±10%

function within(a: number, b: number, tol: number): boolean {
  if (a === 0 || b === 0) return false;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tol;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");

/**
 * 카드명세 행들과 구독 목록을 대사한다.
 *
 * 매칭 규칙(위에서부터 우선):
 *  1) matched  — 같은 법인·부서 + 금액이 오차범위 내
 *  2) probable — 같은 법인 + 금액이 오차범위 내 (부서가 다르거나 비어있음)
 *  3) card-only / sub-only — 짝을 못 찾은 나머지
 *
 * 한 건은 한 번만 매칭된다(이미 쓰인 구독/카드행은 재사용하지 않음).
 */
export function reconcile(cards: CardRow[], subs: ReconcileSub[]): {
  items: ReconcileItem[];
  summary: ReconcileSummary;
} {
  const usedSub = new Set<number>();
  const usedCard = new Set<number>();
  const items: ReconcileItem[] = [];

  const tryMatch = (requireDept: boolean, status: MatchStatus, reason: string) => {
    cards.forEach((c, ci) => {
      if (usedCard.has(ci)) return;
      const si = subs.findIndex((s, i) => {
        if (usedSub.has(i)) return false;
        if (norm(s.company) !== norm(c.company)) return false;
        if (requireDept && norm(s.department) !== norm(c.department)) return false;
        return within(c.amount, s.monthlyKrw, AMOUNT_TOLERANCE);
      });
      if (si === -1) return;
      const s = subs[si];
      usedCard.add(ci); usedSub.add(si);
      items.push({
        status,
        company: c.company,
        department: c.department || s.department,
        card: { paidAt: c.paidAt, amount: c.amount, cardLast4: c.cardLast4, note: c.note },
        sub:  { id: s.id, swName: s.swName, user: s.user, monthlyKrw: s.monthlyKrw },
        diff: c.amount - s.monthlyKrw,
        reason,
      });
    });
  };

  tryMatch(true,  "matched",  "법인·부서·금액 일치");
  tryMatch(false, "probable", "법인·금액은 일치하나 부서가 다름 — 확인 필요");

  cards.forEach((c, ci) => {
    if (usedCard.has(ci)) return;
    items.push({
      status: "card-only",
      company: c.company,
      department: c.department,
      card: { paidAt: c.paidAt, amount: c.amount, cardLast4: c.cardLast4, note: c.note },
      reason: "카드 지출은 있으나 등록된 구독을 찾지 못함 — 미등록 구독 가능성",
    });
  });

  subs.forEach((s, si) => {
    if (usedSub.has(si)) return;
    items.push({
      status: "sub-only",
      company: s.company,
      department: s.department,
      sub: { id: s.id, swName: s.swName, user: s.user, monthlyKrw: s.monthlyKrw },
      reason: "등록된 구독이나 이번 명세에 해당 지출이 없음 — 해지·타 결제수단·명세누락 확인",
    });
  });

  const rank: Record<MatchStatus, number> = { "card-only": 0, "sub-only": 1, probable: 2, matched: 3 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || (b.card?.amount ?? b.sub?.monthlyKrw ?? 0) - (a.card?.amount ?? a.sub?.monthlyKrw ?? 0));

  const summary: ReconcileSummary = {
    cardTotal: cards.reduce((s, c) => s + c.amount, 0),
    subTotal:  subs.reduce((s, x) => s + x.monthlyKrw, 0),
    matchedCount:   items.filter(i => i.status === "matched").length,
    probableCount:  items.filter(i => i.status === "probable").length,
    cardOnlyCount:  items.filter(i => i.status === "card-only").length,
    subOnlyCount:   items.filter(i => i.status === "sub-only").length,
    cardOnlyAmount: items.filter(i => i.status === "card-only").reduce((s, i) => s + (i.card?.amount ?? 0), 0),
    subOnlyAmount:  items.filter(i => i.status === "sub-only").reduce((s, i) => s + (i.sub?.monthlyKrw ?? 0), 0),
  };

  return { items, summary };
}

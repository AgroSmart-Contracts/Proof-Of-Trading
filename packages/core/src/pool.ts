// Reference model of the pool contract's NAV and redemption at term (docs/pool-contract-v1.md).
// The Tranche 1 contract must give the same numbers; these functions are its test oracle.
// Amounts are 7-decimal base units (bigint), rounded down.
export type ReceivableState = "funded" | "overdue" | "claim" | "loss" | "repaid";
export type Receivable = {
  key: string;
  /** Principal advanced (90% of face): the receivable's par value in NAV. */
  advanced: bigint;
  state: ReceivableState;
  /** Claim: the indemnity expected from the credit insurer. */
  expectedIndemnity?: bigint;
  /** Loss: what is still expected to be recovered after write-down (often 0). */
  recovery?: bigint;
};
export type Outstanding = { holder: string; amount: bigint };
export type Pool = {
  cash: bigint;
  shares: bigint;
  /** TruMarket's 1% reserve, applied to losses before holders. */
  reserve: bigint;
  receivables: Receivable[];
  /** Entitlements of holders who redeemed before all cash was collected, paid by settle(). */
  outstanding: Outstanding[];
};

/** NAV mark of one receivable: overdue at par, claims at expected indemnity, losses at recovery. */
export function mark(r: Receivable): bigint {
  switch (r.state) {
    case "funded":
    case "overdue":
      return r.advanced;
    case "claim":
      return r.expectedIndemnity ?? 0n;
    case "loss":
      return r.recovery ?? 0n;
    case "repaid":
      return 0n;
  }
}

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);
const minB = (a: bigint, b: bigint) => (a < b ? a : b);

/** Marked value of the receivables still held, with the reserve covering shortfalls first. */
export function nonCash(p: Pool): bigint {
  const open = p.receivables.filter((r) => r.state !== "repaid");
  const shortfall = sum(open.map((r) => r.advanced - mark(r)));
  return sum(open.map(mark)) + minB(p.reserve, shortfall);
}

/** NAV owed to current holders: cash plus marks, less what earlier redeemers are still owed. */
export const nav = (p: Pool) => p.cash + nonCash(p) - sum(p.outstanding.map((o) => o.amount));

/**
 * Redemption at term: the holder is entitled to their pro-rata NAV. The cash part is paid now; the
 * rest is recorded as an outstanding entitlement, paid by later settlements.
 */
export function redeem(p: Pool, holder: string, shares: bigint): { paid: bigint; outstanding: bigint; pool: Pool } {
  if (shares <= 0n || shares > p.shares) throw new Error("bad share amount");
  const entitlement = (nav(p) * shares) / p.shares;
  const paid = minB(entitlement, (p.cash * shares) / p.shares);
  const owed = entitlement - paid;
  return {
    paid,
    outstanding: owed,
    pool: {
      ...p,
      cash: p.cash - paid,
      shares: p.shares - shares,
      outstanding: owed > 0n ? [...p.outstanding, { holder, amount: owed }] : p.outstanding,
    },
  };
}

/**
 * Settlement of a receivable: the amount collected first pays outstanding entitlements, pro rata,
 * in proportion to their share of the non-cash value it replaces; the rest stays in the pool.
 */
export function settle(p: Pool, key: string, amount: bigint): { payouts: Outstanding[]; pool: Pool } {
  const r = p.receivables.find((x) => x.key === key);
  if (!r || r.state === "repaid") throw new Error("unknown or settled receivable");
  const owedTotal = sum(p.outstanding.map((o) => o.amount));
  const before = nonCash(p);
  const toOutstanding = owedTotal && before ? minB(owedTotal, (amount * owedTotal) / before) : 0n;
  const payouts = p.outstanding.map((o) => ({ holder: o.holder, amount: (toOutstanding * o.amount) / owedTotal }));
  const paid = sum(payouts.map((x) => x.amount));
  return {
    payouts,
    pool: {
      ...p,
      cash: p.cash + amount - paid,
      receivables: p.receivables.map((x) => (x.key === key ? { ...x, state: "repaid" } : x)),
      outstanding: p.outstanding
        .map((o, i) => ({ holder: o.holder, amount: o.amount - payouts[i].amount }))
        .filter((o) => o.amount > 0n),
    },
  };
}

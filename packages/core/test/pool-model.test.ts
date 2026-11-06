import { describe, expect, it } from "vitest";
import { accountHolder, alreadyAttested, attestationKey, metricsCsv, nav, paymentInstructionHash, pilotMetrics, redeem, settle, type Pool } from "../src/index.js";

const U = 10_000_000n; // 1 USD in base units
const base = (receivables: Pool["receivables"], cash: bigint): Pool => ({ cash, shares: 100n * U, reserve: 1n * U, receivables, outstanding: [] });

describe("pool NAV and redemption at term", () => {
  it("partial collection: pays the cash part now, records the rest, settle pays it later", () => {
    let p = base([{ key: "r1", advanced: 50n * U, state: "repaid" }, { key: "r2", advanced: 50n * U, state: "funded" }], 515n * U / 10n);
    expect(nav(p)).toBe(1015n * U / 10n); // 51.5 cash + 50 at par
    const r = redeem(p, "A", 60n * U);
    expect(r.paid).toBe(309n * U / 10n); // 60% of the cash
    expect(r.outstanding).toBe(30n * U); // 60.9 entitlement - 30.9 paid, recorded
    p = r.pool;
    const s = settle(p, "r2", 515n * U / 10n);
    expect(s.payouts).toEqual([{ holder: "A", amount: 30n * U }]); // the entitlement is paid in full
    expect(s.pool.outstanding).toEqual([]);
    expect(nav(s.pool)).toBe(421n * U / 10n); // what is left belongs to the 40 remaining shares
  });

  it("open claim: marked at expected indemnity, reserve applied first", () => {
    const p = base([{ key: "r1", advanced: 90n * U, state: "claim", expectedIndemnity: 72n * U }], 10n * U);
    expect(nav(p)).toBe(83n * U); // 10 cash + 72 indemnity + 1 reserve
    const overdue = base([{ key: "r1", advanced: 90n * U, state: "overdue" }], 10n * U);
    expect(nav(overdue)).toBe(100n * U); // overdue stays at par
  });

  it("write-down: a loss reduces NAV by what the reserve doesn't cover", () => {
    const p = base([{ key: "r1", advanced: 90n * U, state: "loss", recovery: 0n }], 10n * U);
    expect(nav(p)).toBe(11n * U);
    const r = redeem(p, "A", 100n * U);
    expect(r.paid).toBe(10n * U);
    expect(r.outstanding).toBe(1n * U);
  });
});

describe("attestation key", () => {
  const id = { exportDeclaration: "118-2026-40-001234", invoice: "F001-0042", buyerTaxId: "DE123456789" };
  it("is the same for the same receivable, whatever the spacing or case", () => {
    expect(attestationKey({ exportDeclaration: " 118-2026-40-001234 ", invoice: "f001-0042", buyerTaxId: "de 123456789" })).toBe(attestationKey(id));
    expect(attestationKey({ ...id, invoice: "F001-0043" })).not.toBe(attestationKey(id));
  });
  it("answers 'already attested?'", () => {
    expect(alreadyAttested(id, [attestationKey(id)])).toBe(true);
    expect(alreadyAttested({ ...id, buyerTaxId: "DE999" }, [attestationKey(id)])).toBe(false);
  });
  it("hashes the payment instruction, so a changed collection account is visible", () => {
    const pi = { accountHolder: "Agro Smart Contracts Lda", bank: "Bridge", account: "VA-001", reference: "F001-0042" };
    expect(paymentInstructionHash(pi)).toMatch(/^[0-9a-f]{64}$/);
    expect(paymentInstructionHash({ ...pi, account: "VA-002" })).not.toBe(paymentInstructionHash(pi));
  });
});

describe("account holder", () => {
  it("defaults to Agro Smart Contracts Lda and switches to the SPV", () => {
    expect(accountHolder({})).toEqual({ name: "Agro Smart Contracts Lda", kind: "operator" });
    expect(accountHolder({ ACCOUNT_HOLDER: "spv", SPV_LEGAL_NAME: "TRU3 Receivables SPV" })).toEqual({ name: "TRU3 Receivables SPV", kind: "spv" });
    expect(accountHolder({ ACCOUNT_HOLDER: "spv" }).name).toMatch(/updated when the SPV is incorporated/);
  });
});

describe("pilot metrics", () => {
  const launchAt = "2027-04-10T00:00:00Z";
  it("reports the T3 gate separately from the 60-day target", () => {
    const m = pilotMetrics({ launchAt, receivablesRepaid: 1, subscriptions: [{ wallet: "G1", institution: "I1", usd: 50_000, at: "2027-04-20T00:00:00Z" }] });
    expect(m.gate.met).toBe(true);
    expect(m.target).toEqual({ met: false, usdWithin60Days: 50_000, institutionalWallets: 1 });
    expect(metricsCsv(m)).toContain("t3_gate,,,true");
    expect(metricsCsv(m)).toContain("target,,,false");
  });
  it("needs a repaid receivable for the gate, and counts only the 60-day window for the target", () => {
    const subs = ["G1", "G2", "G3"].map((w, i) => ({ wallet: w, institution: `I${i}`, usd: 100_000, at: "2027-05-01T00:00:00Z" }));
    const late = { wallet: "G4", institution: "I4", usd: 100_000, at: "2027-07-01T00:00:00Z" };
    const m = pilotMetrics({ launchAt, receivablesRepaid: 0, subscriptions: [...subs, late] });
    expect(m.gate.met).toBe(false);
    expect(m.target).toEqual({ met: true, usdWithin60Days: 300_000, institutionalWallets: 3 });
  });
});

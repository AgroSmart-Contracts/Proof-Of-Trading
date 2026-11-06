// SCF #46 Tranche 3 reporting. The T3 gate and the 60-day target are reported separately.
//   Gate:   at least USD 50,000 from 1 institution, and at least 1 receivable repaid.
//   Target: at least USD 250,000 in USDC from at least 3 independent institutional wallets within 60 days of mainnet launch.
export type Subscription = { wallet: string; institution: string; usd: number; at: string };
export type MetricsInput = { launchAt: string; subscriptions: Subscription[]; receivablesRepaid: number };
export type Metrics = {
  gate: { met: boolean; largestInstitutionUsd: number; receivablesRepaid: number };
  target: { met: boolean; usdWithin60Days: number; institutionalWallets: number };
};

const DAY = 86_400_000;
export const GATE_USD = 50_000;
export const TARGET_USD = 250_000;
export const TARGET_WALLETS = 3;

export function pilotMetrics(m: MetricsInput): Metrics {
  const byInstitution = new Map<string, number>();
  for (const s of m.subscriptions) byInstitution.set(s.institution, (byInstitution.get(s.institution) ?? 0) + s.usd);
  const largest = Math.max(0, ...byInstitution.values());
  const end = Date.parse(m.launchAt) + 60 * DAY;
  const inWindow = m.subscriptions.filter((s) => Date.parse(s.at) >= Date.parse(m.launchAt) && Date.parse(s.at) <= end);
  const usd = inWindow.reduce((a, s) => a + s.usd, 0);
  const wallets = new Set(inWindow.map((s) => s.wallet)).size;
  return {
    gate: { met: largest >= GATE_USD && m.receivablesRepaid >= 1, largestInstitutionUsd: largest, receivablesRepaid: m.receivablesRepaid },
    target: { met: usd >= TARGET_USD && wallets >= TARGET_WALLETS, usdWithin60Days: usd, institutionalWallets: wallets },
  };
}

export function metricsCsv(x: Metrics): string {
  return [
    "metric,value,threshold,met",
    `t3_gate_largest_institution_usd,${x.gate.largestInstitutionUsd},${GATE_USD},${x.gate.largestInstitutionUsd >= GATE_USD}`,
    `t3_gate_receivables_repaid,${x.gate.receivablesRepaid},1,${x.gate.receivablesRepaid >= 1}`,
    `t3_gate,,,${x.gate.met}`,
    `target_usd_within_60_days,${x.target.usdWithin60Days},${TARGET_USD},${x.target.usdWithin60Days >= TARGET_USD}`,
    `target_institutional_wallets,${x.target.institutionalWallets},${TARGET_WALLETS},${x.target.institutionalWallets >= TARGET_WALLETS}`,
    `target,,,${x.target.met}`,
  ].join("\n") + "\n";
}

// Writes the public pilot reports for the dashboard, from the local step log (no network):
//   apps/dashboard/public/metrics.json and metrics.csv: the SCF #46 T3 gate and the 60-day target, reported separately
//   apps/dashboard/public/compliance-log.json: every freeze, unfreeze, revoke and clawback, with its reason code
// On testnet the inputs are the demo runs on the v0.3 contract (Circle testnet USDC), so the numbers are
// illustrative; on mainnet the same code reads the pilot's records. Usage: npm run report [-- --launch ISO-DATE]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, metricsCsv, pilotMetrics, type Subscription } from "@pot/core";
import { kp } from "./lib.js";
import { contracts, offerings } from "./offering/actions.js";

const v3 = contracts().offering_v3;
const i = process.argv.indexOf("--launch");
const launchAt = i >= 0 ? process.argv[i + 1] : v3?.deployed_at ?? new Date().toISOString();
const recs = Object.values(offerings()).filter((r) => v3 && r.contract_id === v3.contract_id);

const subscriptions: Subscription[] = recs.flatMap((r) =>
  r.steps
    .filter((s) => s.step.startsWith("subscribe "))
    .map((s) => {
      const [, who, usd] = s.step.split(" ");
      // One institution per wallet in the demo; the pilot maps wallets to institutions from KYB.
      return { wallet: kp(who).publicKey(), institution: who, usd: Number(usd), at: s.at };
    }),
);
const receivablesRepaid = recs.filter((r) => r.steps.some((s) => /^deposit_distribution .* outcome [12]$/.test(s.step))).length;
const metrics = pilotMetrics({ launchAt, subscriptions, receivablesRepaid });

// Compliance steps are logged as "compliance <action> <holder role> <REASON>" with the transaction.
const complianceLog = Object.values(offerings()).flatMap((r) =>
  r.steps
    .filter((s) => s.step.startsWith("compliance "))
    .map((s) => {
      const [, action, holder, reason] = s.step.split(" ");
      return { shipment_ref: r.shipment_ref, action, holder: kp(holder).publicKey(), reason, amount: s.detail?.amount ?? null, tx: s.tx, at: s.at };
    }),
);

const dir = path.join(REPO_ROOT, "apps/dashboard/public");
mkdirSync(dir, { recursive: true });
const network = "testnet";
writeFileSync(path.join(dir, "metrics.json"), JSON.stringify({ network, launch_at: launchAt, generated_at: new Date().toISOString(), ...metrics }, null, 2));
writeFileSync(path.join(dir, "metrics.csv"), `# network=${network} launch_at=${launchAt}\n` + metricsCsv(metrics));
writeFileSync(path.join(dir, "compliance-log.json"), JSON.stringify({ network, generated_at: new Date().toISOString(), actions: complianceLog }, null, 2));
console.log(`T3 gate ${metrics.gate.met ? "met" : "not met"} · target ${metrics.target.met ? "met" : "not met"} · ${complianceLog.length} compliance actions`);

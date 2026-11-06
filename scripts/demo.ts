// Happy path, end to end on one shipment (default SHP-0247):
// approve A and B, subscribe 60/40, close, fund, buyer pays in full, both redeem the investor amount fixed in the subscription agreement, sweep, outcome attested.
// Usage: npm run demo -- [SHP-xxxx] [--cap-usd N] [--deposit-usd N]
//   --cap-usd: raise less than the sample's face value (e.g. 100 for a run in faucet-sized Circle USDC)
import { loadSamples } from "./lib.js";
import * as act from "./offering/actions.js";

const ref = process.argv.slice(2).find((a) => a.startsWith("SHP-")) ?? "SHP-0247";
const sample = loadSamples().find((s) => s.shipment_ref === ref)!;
const c = process.argv.indexOf("--cap-usd");
const face = c >= 0 ? Number(process.argv[c + 1]) : sample.face_value_usd;
const i = process.argv.indexOf("--deposit-usd");
const deposit = i >= 0 ? Number(process.argv[i + 1]) : Math.ceil(face * 1.05); // buyer pays face + 5%: covers the investor amount fixed in the subscription agreement (12% for 120 days)

console.log(`\n== Happy path: ${ref}, face $${face}, terms ${sample.apy_bps / 100}% for ${sample.term_days} days ==`);
await act.deploy();
console.log("\n1. SAC admin handover + offering");
await act.handover(ref);
await act.create(ref, 120, face);
console.log("\n2. Trustlines + approvals (stand-in for KYB)");
await act.trustlines(ref);
await act.approve(ref, "a");
await act.approve(ref, "b");
console.log("\n3. Unapproved wallet tries to subscribe");
await act.expectFailure("unapproved subscribe", () => act.subscribe(ref, "unapproved", Math.min(1000, face * 0.1)));
console.log("\n4. Subscriptions 60/40 (shares minted automatically)");
await act.subscribe(ref, "a", face * 0.6);
await act.subscribe(ref, "b", face * 0.4);
await act.status(ref);
console.log("\n5. Fund the SPV");
await act.fund(ref);
console.log(`\n6. Buyer pays: treasury deposits $${deposit} (outcome 1, on time)`);
await act.distribute(ref, deposit, 1);
console.log("\n7. Investors redeem the investor amount fixed in the subscription agreement; shares burn");
await act.redeem(ref, "a");
await act.redeem(ref, "b");
console.log("\n8. Surplus back to the SPV, outcome attested");
await act.sweep(ref);
await act.attestOutcome(ref);
console.log("\nDone.");

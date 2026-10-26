// Insured failure on another shipment (default SHP-0251): subscribe 60/40, fund,
// insurer pays 90% of principal (outcome 4), investors redeem pro rata, outcome attested.
// Usage: npm run demo:failure -- [SHP-xxxx]
import { loadSamples } from "./lib.js";
import * as act from "./offering/actions.js";

const ref = process.argv.slice(2).find((a) => a.startsWith("SHP-")) ?? "SHP-0251";
const face = loadSamples().find((s) => s.shipment_ref === ref)!.face_value_usd;
const insured = face * 0.9;

console.log(`\n== Insured failure: ${ref}, face $${face}, insurer pays $${insured} ==`);
await act.deploy();
await act.handover(ref);
await act.create(ref);
await act.trustlines(ref);
await act.approve(ref, "a");
await act.approve(ref, "b");
await act.expectFailure("unapproved subscribe", () => act.subscribe(ref, "unapproved", 1000));
await act.subscribe(ref, "a", face * 0.6);
await act.subscribe(ref, "b", face * 0.4);
await act.fund(ref);
console.log(`\nShipment fails; insurer pays the SPV $${insured} (outcome 4)`);
await act.distribute(ref, insured, 4);
await act.redeem(ref, "a");
await act.redeem(ref, "b");
await act.expectFailure("sweep (nothing left: investors got everything collected)", () => act.sweep(ref));
await act.attestOutcome(ref);
console.log("\nDone.");

// Under-subscribed offering refunds (default SHP-0258): short deadline, one partial subscription,
// wait for the deadline, start_refunds, refund. Usage: npm run demo:refund -- [SHP-xxxx] [--deadline-mins N]
import * as act from "./offering/actions.js";

const ref = process.argv.slice(2).find((a) => a.startsWith("SHP-")) ?? "SHP-0258";
const i = process.argv.indexOf("--deadline-mins");
const mins = i >= 0 ? Number(process.argv[i + 1]) : 5;

console.log(`\n== Refund demo: ${ref}, ${mins}-minute deadline ==`);
await act.deploy();
await act.handover(ref);
await act.create(ref, mins);
await act.trustlines(ref, ["a"]);
await act.approve(ref, "a");
await act.subscribe(ref, "a", 10_000);
await act.status(ref);
const until = Date.now() + mins * 60_000 + 15_000;
console.log(`\nWaiting ${Math.round((until - Date.now()) / 1000)}s for the deadline to pass on-chain…`);
await new Promise((r) => setTimeout(r, until - Date.now()));
for (let attempt = 0; ; attempt++) {
  try {
    await act.startRefunds(ref);
    break;
  } catch (e) {
    if (attempt >= 6 || !act.explainError(e).includes("DeadlineNotPassed")) throw e;
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
await act.refund(ref, "a");
await act.status(ref);
console.log("\nDone.");

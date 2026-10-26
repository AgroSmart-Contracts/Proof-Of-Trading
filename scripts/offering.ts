// Offering contract CLI. Usage: npm run offering -- <command> [args]
//   deploy [--force] | handover <ref> | create <ref> [--deadline-mins N] | trustlines <ref>
//   approve <ref> <a|b|unapproved> | subscribe <ref> <a|b|unapproved> <usd> | fund <ref>
//   start-refunds <ref> | refund <ref> <who> | distribute <ref> <usd> <outcome 1-5>
//   redeem <ref> <who> | sweep <ref> | attest-outcome <ref> | status <ref> | hand-back <ref>| sweep <ref> | attest-outcome <ref> | status <ref>
import * as act from "./offering/actions.js";

const [cmd, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flagVal = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const need = (i: number, what: string) => {
  if (!rest[i]) throw new Error(`missing <${what}>`);
  return rest[i];
};

const commands: Record<string, () => Promise<unknown>> = {
  deploy: () => act.deploy(process.argv.includes("--force")),
  handover: () => act.handover(need(0, "ref")),
  create: () => act.create(need(0, "ref"), Number(flagVal("deadline-mins") ?? 120)),
  trustlines: () => act.trustlines(need(0, "ref")),
  approve: () => act.approve(need(0, "ref"), need(1, "investor")),
  subscribe: () => act.subscribe(need(0, "ref"), need(1, "investor"), Number(need(2, "usd"))),
  fund: () => act.fund(need(0, "ref")),
  "start-refunds": () => act.startRefunds(need(0, "ref")),
  refund: () => act.refund(need(0, "ref"), need(1, "investor")),
  distribute: () => act.distribute(need(0, "ref"), Number(need(1, "usd")), Number(need(2, "outcome"))),
  redeem: () => act.redeem(need(0, "ref"), need(1, "investor")),
  sweep: () => act.sweep(need(0, "ref")),
  "attest-outcome": () => act.attestOutcome(need(0, "ref")),
  status: () => act.status(need(0, "ref")),
  "hand-back": () => act.handBack(need(0, "ref")),
};

if (!cmd || !commands[cmd]) {
  console.log(`commands: ${Object.keys(commands).join(", ")}`);
  process.exit(cmd ? 1 : 0);
}
try {
  await commands[cmd]();
} catch (e) {
  console.error(`✗ ${cmd} failed: ${act.explainError(e)}`);
  process.exit(1);
}

// Moves an account (the issuer, which is also the offering contract's admin, and the SPV
// treasury) to a multisig and locks its master key. See docs/governance.md.
//
// Usage: governance-setup.ts <issuer|spv_treasury> [--submit]
//   GOV_SIGNERS=G...,G...,G...   signer public keys (weight 1 each), required
//   GOV_THRESHOLD=2              signatures needed for low/medium/high operations (default 2)
//
// One transaction, so it is all-or-nothing: add every signer, set the thresholds, then set the
// master key weight to 0. Without --submit it only prints the plan and simulates nothing.
//
// IRREVERSIBLE in practice: after this the master secret in .env can no longer sign. The script
// refuses to run unless the signers can still reach every threshold without the master key.
import { Operation, StrKey } from "@stellar/stellar-sdk";
import { optionalEnv, server, submitClassic } from "@pot/core";
import { kp } from "./lib.js";

const role = process.argv[2];
const submit = process.argv.includes("--submit");
if (role !== "issuer" && role !== "spv_treasury") {
  console.error("usage: governance-setup.ts <issuer|spv_treasury> [--submit]");
  process.exit(2);
}

const signers = (optionalEnv("GOV_SIGNERS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const threshold = Number(optionalEnv("GOV_THRESHOLD") ?? 2);
const account = kp(role);
const master = account.publicKey();

const problems: string[] = [];
if (!signers.length) problems.push("GOV_SIGNERS is empty");
for (const s of signers) if (!StrKey.isValidEd25519PublicKey(s)) problems.push(`not a public key: ${s}`);
if (new Set(signers).size !== signers.length) problems.push("GOV_SIGNERS has duplicates");
if (signers.includes(master)) problems.push("the account's own key cannot be one of the multisig signers");
if (!Number.isInteger(threshold) || threshold < 1) problems.push("GOV_THRESHOLD must be a positive integer");
if (threshold > signers.length) problems.push(`threshold ${threshold} is above the ${signers.length} signers: the account would be locked out`);
if (threshold < 2 && signers.length > 1) problems.push("a threshold of 1 lets any single signer act alone; use at least 2");
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}

const current = await server().getAccount(master).catch(() => null);
if (!current) {
  console.error(`✗ account ${master} not found`);
  process.exit(1);
}

const ops = [
  ...signers.map((key) => Operation.setOptions({ signer: { ed25519PublicKey: key, weight: 1 } })),
  Operation.setOptions({ lowThreshold: threshold, medThreshold: threshold, highThreshold: threshold, masterWeight: 0 }),
];

console.log(`${role} ${master}`);
console.log(`  add ${signers.length} signers (weight 1): ${signers.join(", ")}`);
console.log(`  thresholds low/medium/high = ${threshold} (${threshold}-of-${signers.length})`);
console.log("  master key weight → 0 (the .env secret can no longer sign)");
if (!submit) {
  console.log("\nDry run: nothing sent. Re-run with --submit to apply.");
  process.exit(0);
}
const tx = await submitClassic(account, ops);
console.log(`\n✓ applied in ${tx.hash}`);

// Spike: contract as SAC admin of an AUTH_REQUIRED asset (brief 1, section 3).
// Uses a fresh throwaway issuer + SPIKE01 asset each run. Writes data/store/spike.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import { Address, Asset, Keypair, Operation, nativeToScVal } from "@stellar/stellar-sdk";
import {
  REPO_ROOT, deployContract, deploySac, explorerTx, friendbot, invoke, setIssuerFlags, submitClassic, view, writeStore,
} from "@pot/core";
import { kp } from "./lib.js";

const addr = (a: string) => new Address(a).toScVal();
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const steps: { step: string; ok: boolean; tx?: string; error?: string }[] = [];

async function step(name: string, fn: () => Promise<{ hash: string } | void>, expectFail = false) {
  try {
    const r = await fn();
    steps.push({ step: name, ok: !expectFail, tx: r?.hash });
    console.log(`${expectFail ? "UNEXPECTED SUCCESS" : "OK  "} ${name}${r ? `  ${explorerTx(r.hash)}` : ""}`);
  } catch (e) {
    const msg = (e as Error).message.slice(0, 600);
    steps.push({ step: name, ok: expectFail, error: msg });
    console.log(`${expectFail ? "OK (failed as expected)" : "FAIL"} ${name}\n     ${msg.split("\n")[0]}`);
    if (!expectFail) throw e;
  }
}

const issuer = Keypair.random(); // throwaway, never the real issuer
await friendbot(issuer.publicKey());
const investorA = kp("investor_a");
const unapproved = kp("unapproved");
const SPIKE = new Asset("SPIKE01", issuer.publicKey());

await step("0a issuer flags AUTH_REQUIRED|REVOCABLE|CLAWBACK", async () => setIssuerFlags(issuer));
let sacId = "";
await step("0b deploy SPIKE01 SAC", async () => {
  const r = await deploySac(SPIKE, issuer);
  sacId = r.sacId;
  return r.tx;
});
const wasm = readFileSync(path.join(REPO_ROOT, "contracts/target/wasm32v1-none/release/share_admin_spike.wasm"));
let spikeId = "";
await step("0c deploy spike contract (admin = throwaway issuer)", async () => {
  const r = await deployContract(issuer, wasm, [addr(issuer.publicKey())]);
  spikeId = r.contractId;
  return r.tx;
});
await step("1 issuer: SAC set_admin(spike contract)", () => invoke(issuer, sacId, "set_admin", [addr(spikeId)]));
await step("2 investor_a trustline to SPIKE01", () => submitClassic(investorA, [Operation.changeTrust({ asset: SPIKE })]));
await step("3 spike.approve(investor_a)", () => invoke(issuer, spikeId, "approve", [addr(sacId), addr(investorA.publicKey())]));
await step("4 spike.mint(investor_a, 100)", () =>
  invoke(issuer, spikeId, "mint", [addr(sacId), addr(investorA.publicKey()), i128(100_0000000n)]));
await step("5a unapproved trustline to SPIKE01 (not authorized)", () =>
  submitClassic(unapproved, [Operation.changeTrust({ asset: SPIKE })]));
await step("5b spike.mint(unapproved, 100) must FAIL", () =>
  invoke(issuer, spikeId, "mint", [addr(sacId), addr(unapproved.publicKey()), i128(100_0000000n)]), true);
await step("6 investor_a burn_from_holder(10)", () =>
  invoke(investorA, spikeId, "burn_from_holder", [addr(sacId), addr(investorA.publicKey()), i128(10_0000000n)]));
const balance = await view(sacId, "balance", [addr(investorA.publicKey())]);
await step("7 spike.hand_over(issuer)", () => invoke(issuer, spikeId, "hand_over", [addr(sacId), addr(issuer.publicKey())]));
const adminAfter = await view(sacId, "admin");

const go = steps.every((s) => s.ok) && adminAfter === issuer.publicKey() && balance === 90_0000000n;
console.log(`\ninvestor_a SPIKE01 balance: ${Number(balance) / 1e7} (expected 90)`);
console.log(`SAC admin after hand_over: ${adminAfter} (${adminAfter === issuer.publicKey() ? "issuer" : "NOT issuer"})`);
console.log(`\nDECISION: ${go ? "GO (contract-minted shares)" : "FALLBACK (backend-minted shares)"}`);
writeStore("spike.json", {
  decision: go ? "GO" : "FALLBACK",
  throwaway_issuer: issuer.publicKey(), sac_id: sacId, spike_contract: spikeId,
  investor_a_balance: String(balance), admin_after: adminAfter, steps, ran_at: new Date().toISOString(),
});

// Issues TUSDC ("test USDC", our own testnet stablecoin), funds holders, deploys its SAC. Idempotent.
import { Asset, Operation } from "@stellar/stellar-sdk";
import { deploySac, explorerAsset, readStore, submitClassic, trustline, writeStore, type AssetsFile } from "@pot/core";
import { kp } from "./lib.js";

const issuer = kp("tusdc_issuer");
const TUSDC = new Asset("TUSDC", issuer.publicKey());
const grants: [string, string][] = [
  ["investor_a", "100000"],
  ["investor_b", "100000"],
  ["unapproved", "100000"],
  ["spv_treasury", "50000"],
];

for (const [role, amount] of grants) {
  const holder = kp(role);
  let tl = await trustline(holder.publicKey(), TUSDC);
  if (!tl) {
    await submitClassic(holder, [Operation.changeTrust({ asset: TUSDC })]);
    tl = { balance: 0n, authorized: true };
  }
  if (tl.balance === 0n) {
    const r = await submitClassic(issuer, [Operation.payment({ destination: holder.publicKey(), asset: TUSDC, amount })]);
    console.log(`minted ${amount} TUSDC -> ${role} (${r.hash})`);
  } else {
    console.log(`${role} already holds ${Number(tl.balance) / 1e7} TUSDC`);
  }
}

const { sacId, tx } = await deploySac(TUSDC, issuer);
console.log(`TUSDC SAC ${sacId}${tx ? ` deployed (${tx.hash})` : " (exists)"}`);
const assets = readStore<AssetsFile>("assets.json", { shares: [] });
assets.tusdc = { code: "TUSDC", issuer: issuer.publicKey(), sac_id: sacId };
writeStore("assets.json", assets);
console.log(explorerAsset("TUSDC", issuer.publicKey()));

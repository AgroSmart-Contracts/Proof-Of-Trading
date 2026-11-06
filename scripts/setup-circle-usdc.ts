// Testnet only. Gives the demo roles small amounts of Circle testnet USDC for a v0.3 run:
// adds the USDC trustline if missing, then buys the amount on the testnet DEX with testnet XLM
// (path payment, strict receive). Same asset as faucet.circle.com, without the browser captcha.
// Usage: setup-circle-usdc.ts [role=amount ...]   default: investor_a=60 investor_b=40 spv_treasury=10 unapproved=10
import { Asset, Operation } from "@stellar/stellar-sdk";
import { PASSPHRASE, explorerTx, settlementAsset, submitClassic, trustline } from "@pot/core";
import { kp } from "./lib.js";

if (PASSPHRASE().startsWith("Public")) throw new Error("testnet only");
const usdc = settlementAsset();
const asset = new Asset(usdc.code, usdc.issuer);
const MAX_XLM_PER_USDC = 20; // refuse a fill worse than this

const wanted = (process.argv.slice(2).length ? process.argv.slice(2) : ["investor_a=60", "investor_b=40", "spv_treasury=10", "unapproved=10"])
  .map((a) => a.split("=") as [string, string]);

for (const [role, amount] of wanted) {
  const k = kp(role);
  const pk = k.publicKey();
  const tl = await trustline(pk, asset);
  if (!tl) {
    const tx = await submitClassic(k, [Operation.changeTrust({ asset })]);
    console.log(`  ✓ ${role} trusts ${usdc.code}  ${explorerTx(tx.hash)}`);
  }
  const have = Number(tl?.balance ?? 0n) / 1e7;
  const need = Number(amount) - have;
  if (need <= 0) {
    console.log(`  · ${role} already holds ${have} ${usdc.code}`);
    continue;
  }
  const q = new URLSearchParams({
    source_assets: "native", destination_asset_type: "credit_alphanum4",
    destination_asset_code: usdc.code, destination_asset_issuer: usdc.issuer, destination_amount: need.toFixed(7),
  });
  const paths = (await fetch(`https://horizon-testnet.stellar.org/paths/strict-receive?${q}`).then((r) => r.json()))._embedded?.records ?? [];
  const best = paths.sort((a: any, b: any) => Number(a.source_amount) - Number(b.source_amount))[0];
  if (!best) throw new Error(`no DEX path to ${need} ${usdc.code}`);
  const sendMax = Number(best.source_amount) * 1.05;
  if (sendMax > need * MAX_XLM_PER_USDC) throw new Error(`price too high: ${best.source_amount} XLM for ${need} ${usdc.code}`);
  const path = best.path.map((p: any) => (p.asset_type === "native" ? Asset.native() : new Asset(p.asset_code, p.asset_issuer)));
  const tx = await submitClassic(k, [
    Operation.pathPaymentStrictReceive({ sendAsset: Asset.native(), sendMax: sendMax.toFixed(7), destination: pk, destAsset: asset, destAmount: need.toFixed(7), path }),
  ]);
  console.log(`  ✓ ${role} +${need} ${usdc.code} for ≤${sendMax.toFixed(2)} XLM  ${explorerTx(tx.hash)}`);
}

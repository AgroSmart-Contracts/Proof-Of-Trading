// One SPV share asset per financed shipment (TM + 4 digits), issuer flags set first, SAC deployed,
// linked to the shipment's financed_attested proof hash. Issuer stays SAC admin in v0.1. Idempotent.
import { Asset } from "@stellar/stellar-sdk";
import {
  accountFlags, deploySac, explorerAsset, readStore, setIssuerFlags, writeStore,
  type AssetsFile, type AttestationRecord,
} from "@pot/core";
import { kp, loadSamples, shareCode } from "./lib.js";

const issuer = kp("issuer");
const flagsTx = await setIssuerFlags(issuer);
console.log(`issuer flags: ${JSON.stringify(await accountFlags(issuer.publicKey()))}${flagsTx ? ` (set in ${flagsTx.hash})` : ""}`);

const attestations = readStore<AttestationRecord[]>("attestations.json", []);
const assets = readStore<AssetsFile>("assets.json", { shares: [] });

for (const s of loadSamples().filter((x) => x.financed && x.consented)) {
  const att = attestations.find((a) => a.shipment_ref === s.shipment_ref && a.event === "financed_attested");
  if (!att) {
    console.log(`skip ${s.shipment_ref}: no financed_attested record (run attest.ts first)`);
    continue;
  }
  const code = shareCode(s.shipment_ref);
  const { sacId, tx } = await deploySac(new Asset(code, issuer.publicKey()), issuer);
  const existing = assets.shares.find((a) => a.shipment_ref === s.shipment_ref);
  const record = {
    shipment_ref: s.shipment_ref, code, issuer: issuer.publicKey(), sac_id: sacId,
    proof_hash: att.proof_hash, attestation_tx: att.tx_hash,
    sac_deploy_tx: tx?.hash ?? existing?.sac_deploy_tx, created_at: existing?.created_at ?? new Date().toISOString(),
  };
  assets.shares = [...assets.shares.filter((a) => a.shipment_ref !== s.shipment_ref), record];
  writeStore("assets.json", assets);
  console.log(`${code} ${sacId}${tx ? " deployed" : " (exists)"}  proof ${att.proof_hash.slice(0, 16)}…\n  ${explorerAsset(code, issuer.publicKey())}`);
}

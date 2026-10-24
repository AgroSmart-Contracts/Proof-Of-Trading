// Attest every consented sample: MEMO_HASH payment from attestor -> sink. Idempotent per (shipment, event).
// Usage: attest.ts [--only SHP-xxxx] [--dry-run] [--force]
import { randomBytes } from "node:crypto";
import { Asset, Operation } from "@stellar/stellar-sdk";
import {
  ProofPayloadV1, env, explorerTx, proofHash, pseudonym, readDeal, readStore, sha256, submitClassic, toMemoHash, writeStore,
  type AttestationRecord,
} from "@pot/core";
import { flag, kp, loadSamples, opt, sampleFile } from "./lib.js";

const only = opt("only");
const dry = flag("dry-run");
const force = flag("force");
const secret = env("PSEUDONYM_SECRET");
const attestor = kp("attestor");
const sink = kp("attestation_sink").publicKey();
const records = readStore<AttestationRecord[]>("attestations.json", []);

for (const s of loadSamples()) {
  if (only && s.shipment_ref !== only) continue;
  if (!s.consented) {
    console.log(`skip ${s.shipment_ref}: exporter has not consented`);
    continue;
  }
  const event = s.financed ? "financed_attested" : "shipment_attested";
  if (!force && records.some((r) => r.shipment_ref === s.shipment_ref && r.event === event)) {
    console.log(`skip ${s.shipment_ref}: already ${event} (use --force)`);
    continue;
  }

  const customsRaw = sampleFile(s.customs_record_file);
  const customs = JSON.parse(customsRaw.toString("utf8"));
  const arc = s.financed ? await readDeal(s.arc_nft_id!) : undefined;
  const payload = ProofPayloadV1.parse({
    v: 1,
    event,
    shipment_ref: s.shipment_ref,
    epoch: s.epoch,
    exporter_pseudonym: pseudonym(secret, s.exporter_internal_id, s.epoch),
    buyer_pseudonym: pseudonym(secret, s.buyer_internal_id, s.epoch),
    customs: { record_id: customs.record_id, record_version: customs.record_version, record_digest: sha256(customsRaw).toString("hex") },
    ...(s.financed && {
      arc: { chain_id: arc!.chain_id, deals_manager: arc!.deals_manager, nft_id: arc!.nft_id },
      insurance: { assignment_digest: sampleFile(s.insurance_assignment_file!).toString("utf8").trim() },
      cram_band: s.cram_band,
    }),
    salt: randomBytes(16).toString("hex"),
  });
  const hash = proofHash(payload);

  if (dry) {
    console.log(`[dry-run] ${s.shipment_ref} ${event} ${hash.toString("hex")}`);
    continue;
  }
  const tx = await submitClassic(
    attestor,
    [Operation.payment({ destination: sink, asset: Asset.native(), amount: "0.0000001" })],
    { memo: toMemoHash(hash) },
  );
  records.push({
    shipment_ref: s.shipment_ref, event, payload, proof_hash: hash.toString("hex"),
    tx_hash: tx.hash, ledger: tx.ledger, envelope_xdr: tx.envelopeXdr, arc_stub: arc?.stub ?? false,
    created_at: new Date().toISOString(),
  });
  writeStore("attestations.json", records);
  console.log(`${s.shipment_ref} ${event} ${hash.toString("hex")}\n  ${explorerTx(tx.hash)}`);
}

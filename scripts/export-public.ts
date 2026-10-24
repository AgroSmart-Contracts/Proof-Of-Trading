// Writes the PUBLIC view of the store for the dashboard. Salts and raw files never leave data/store.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  ProofPayloadV1, REPO_ROOT, memoHashFromEnvelope, proofHash, publicView, readStore, type AssetsFile, type AttestationRecord,
} from "@pot/core";

const atts = readStore<AttestationRecord[]>("attestations.json", []);
const assets = readStore<AssetsFile>("assets.json", { shares: [] });
const spike = readStore<Record<string, unknown> | null>("spike.json", null);

const out = {
  generated_at: new Date().toISOString(),
  attestations: atts.map((r) => {
    const recomputed = proofHash(ProofPayloadV1.parse(r.payload)).toString("hex");
    return {
      shipment_ref: r.shipment_ref, event: r.event, payload: publicView(r.payload), proof_hash: r.proof_hash,
      tx_hash: r.tx_hash, ledger: r.ledger, arc_stub: r.arc_stub, created_at: r.created_at,
      verified: recomputed === r.proof_hash && memoHashFromEnvelope(r.envelope_xdr) === recomputed,
    };
  }),
  tusdc: assets.tusdc ?? null,
  shares: assets.shares,
  spike_decision: spike?.decision ?? null,
};
if (JSON.stringify(out).includes('"salt"')) throw new Error("salt leaked into public export");
const dir = path.join(REPO_ROOT, "apps/dashboard/public");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "public-store.json"), JSON.stringify(out, null, 2));
console.log(`exported ${out.attestations.length} attestations, ${out.shares.length} share assets`);

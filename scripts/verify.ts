// Recompute each stored proof hash and check it against the chain.
// Usage: verify.ts [SHP-xxxx]
//
// For each attestation the recomputed hash must equal the stored hash and the MEMO_HASH of the
// stored envelope. It is then matched against the first on-chain source available:
//   1. contract storage: the offering's proof_hash (financed attestations) or, on the v0.3
//      contract, the outcome Record's record_hash. This does not depend on RPC retention.
//   2. Horizon's copy of the transaction (testnet history, kept beyond RPC's ~7 days).
//   3. RPC getTransaction, while the transaction is still inside RPC retention.
import { nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { ProofPayloadV1, memoHashFromEnvelope, proofHash, readStore, server, view, type AttestationRecord } from "@pot/core";

const HORIZON = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
type Contracts = { offering?: { contract_id: string }; offering_v3?: { contract_id: string } };

const ref = process.argv[2];
const records = readStore<AttestationRecord[]>("attestations.json", []).filter((r) => !ref || r.shipment_ref === ref);
if (!records.length) {
  console.log("no attestation records found");
  process.exit(1);
}
const contracts = readStore<Contracts>("contracts.json", {});
const offeringId = (shipmentRef: string) => nativeToScVal(Number(shipmentRef.split("-")[1]), { type: "u32" });
const hex = (v: unknown) => (v instanceof Uint8Array ? Buffer.from(v).toString("hex") : null);

/** The hash this attestation should have in contract storage, or null if there is none to read. */
async function fromContract(r: AttestationRecord): Promise<{ hash: string; where: string } | null> {
  try {
    if (r.event === "financed_attested") {
      // Every offering on either contract stores the shipment's financed proof hash.
      for (const c of [contracts.offering_v3?.contract_id, contracts.offering?.contract_id]) {
        if (!c) continue;
        const o = (await view(c, "get_offering", [offeringId(r.shipment_ref)]).catch(() => null)) as { p?: { proof_hash?: Uint8Array } } | null;
        const h = hex(o?.p?.proof_hash);
        if (h) return { hash: h, where: "offering proof_hash in contract storage" };
      }
    }
    if (r.event === "outcome" && contracts.offering_v3) {
      const rec = (await view(contracts.offering_v3.contract_id, "get_record", [offeringId(r.shipment_ref)])) as { record_hash?: Uint8Array } | null;
      const h = hex(rec?.record_hash);
      if (h) return { hash: h, where: "outcome record in contract storage" };
    }
  } catch {
    /* fall through to the transaction */
  }
  return null;
}

async function fromHorizon(txHash: string): Promise<string | null> {
  try {
    const res = await fetch(`${HORIZON}/transactions/${txHash}`);
    if (!res.ok) return null;
    const t = (await res.json()) as { successful?: boolean; memo_type?: string; memo?: string };
    return t.successful && t.memo_type === "hash" && t.memo ? Buffer.from(t.memo, "base64").toString("hex") : null;
  } catch {
    return null;
  }
}

async function fromRpc(txHash: string): Promise<string | null> {
  const res = await server().getTransaction(txHash).catch(() => null);
  return res?.status === rpc.Api.GetTransactionStatus.SUCCESS ? memoHashFromEnvelope(res.envelopeXdr.toXDR("base64")) : null;
}

let failures = 0;
const sources: Record<string, number> = {};
for (const r of records) {
  const recomputed = proofHash(ProofPayloadV1.parse(r.payload)).toString("hex");
  const local = recomputed === r.proof_hash && memoHashFromEnvelope(r.envelope_xdr) === recomputed;

  let source = "none";
  let chainHash: string | null = null;
  const c = await fromContract(r);
  if (c) [source, chainHash] = [c.where, c.hash];
  else if ((chainHash = await fromHorizon(r.tx_hash))) source = "transaction memo (Horizon)";
  else if ((chainHash = await fromRpc(r.tx_hash))) source = "transaction memo (RPC)";

  const chainOk = chainHash === recomputed;
  const ok = local && chainOk;
  if (!ok) failures++;
  sources[source] = (sources[source] ?? 0) + 1;
  const detail = chainHash === null ? "not found on-chain" : chainOk ? `matches ${source}` : `MISMATCH with ${source}: ${chainHash}`;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.shipment_ref} ${r.event} ${recomputed.slice(0, 16)}… ${local ? "" : "(stored record or envelope differs) "}${detail}`);
}
console.log(`\n${records.length - failures}/${records.length} PASS`);
console.log(`checked against: ${Object.entries(sources).map(([k, v]) => `${k} ${v}`).join(", ")}`);
process.exit(failures ? 1 : 0);

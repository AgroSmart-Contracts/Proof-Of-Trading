// Recompute each stored proof hash and compare to the MEMO_HASH in the stored envelope and, if still retained, on-chain.
// Usage: verify.ts [SHP-xxxx]
import { rpc } from "@stellar/stellar-sdk";
import { ProofPayloadV1, memoHashFromEnvelope, proofHash, readStore, server, type AttestationRecord } from "@pot/core";

const ref = process.argv[2];
const records = readStore<AttestationRecord[]>("attestations.json", []).filter((r) => !ref || r.shipment_ref === ref);
if (!records.length) {
  console.log("no attestation records found");
  process.exit(1);
}
let failures = 0;
for (const r of records) {
  const recomputed = proofHash(ProofPayloadV1.parse(r.payload)).toString("hex");
  const envMemo = memoHashFromEnvelope(r.envelope_xdr);
  let chain = "out of RPC retention (envelope check only)";
  let chainOk = true;
  const res = await server().getTransaction(r.tx_hash);
  if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    const onChain = memoHashFromEnvelope(res.envelopeXdr.toXDR("base64"));
    chainOk = onChain === recomputed;
    chain = chainOk ? "on-chain memo matches" : `on-chain memo MISMATCH ${onChain}`;
  }
  const ok = recomputed === r.proof_hash && envMemo === recomputed && chainOk;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.shipment_ref} ${r.event} ${recomputed.slice(0, 16)}… ${chain}`);
}
console.log(`\n${records.length - failures}/${records.length} PASS`);
process.exit(failures ? 1 : 0);

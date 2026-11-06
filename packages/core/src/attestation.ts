// Pool attestation keys and payment-instruction hashes (docs/pool-contract-v1.md).
// No receivable is financed twice within the pool: the key is one export declaration + invoice +
// buyer tax ID, and the pool contract rejects a key it already holds.
import { canonicalJson, sha256 } from "./hash.js";

export type ReceivableId = { exportDeclaration: string; invoice: string; buyerTaxId: string };
export type PaymentInstruction = { accountHolder: string; bank: string; account: string; reference: string };

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

/** sha256(export declaration | invoice | buyer tax ID), normalized so spacing and case can't create a second key. */
export const attestationKey = (r: ReceivableId) =>
  sha256([r.exportDeclaration, r.invoice, r.buyerTaxId].map(norm).join("|")).toString("hex");

/** Hash of where the buyer is told to pay (the collection account), stored with each attestation. */
export const paymentInstructionHash = (p: PaymentInstruction) =>
  sha256(canonicalJson({ account: norm(p.account), account_holder: p.accountHolder.trim(), bank: p.bank.trim(), reference: norm(p.reference) })).toString("hex");

/** Verifier lookup: is this receivable already attested? */
export const alreadyAttested = (r: ReceivableId, attestedKeys: Iterable<string>) => new Set(attestedKeys).has(attestationKey(r));

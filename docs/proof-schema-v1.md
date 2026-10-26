# Proof payload schema v1

Source of truth: `packages/core/src/schema.ts` (zod, `.strict()`, so unknown fields such as names are rejected).

One payload per attestation event. On-chain we publish only `sha256(canonical_json(payload))` as the `MEMO_HASH` of a 1-stroop payment from the attestor account to the attestation sink. The payload itself, including its salt, stays off-chain with TruMarket.

```ts
{
  v: 1,
  event: "shipment_attested" | "financed_attested" | "outcome",
  shipment_ref: "SHP-0247",          // opaque internal ref, never a company name
  epoch: "2026-Q4",                   // reporting period
  exporter_pseudonym: hex32,          // HMAC-SHA256(PSEUDONYM_SECRET, internal_id + "|" + epoch)
  buyer_pseudonym: hex32,
  customs: { record_id, record_version, record_digest: hex32 },   // digest = sha256 of the raw record file
  arc?: { chain_id, deals_manager, nft_id },                       // financed only
  insurance?: { assignment_digest: hex32 },                        // financed only
  cram_band?: "A" | "B" | "C" | "D" | "E",                         // financed only
  outcome?: { code, amount_collected?, amount_owed?, redemption_confirmation_digest? }, // outcome only
  salt: hex16                                                      // private; prevents brute-forcing the hash
}
```
Outcome codes: 1 on time, 2 late, 3 disputed, 4 insurance paid, 5 uninsured loss.

Rules: `financed_attested` requires `arc`, `insurance` and `cram_band`; `outcome` requires `outcome`.

## Canonical JSON
RFC 8785 style: keys sorted at every level, no whitespace, UTF-8, `undefined` fields omitted. Numbers must be safe integers; amounts are decimal strings in base units. Test vectors are in `packages/core/test/core.test.ts`.

## Verifying a proof
Given a payload (disclosed by TruMarket to an authorized party, with its salt) and a transaction hash:
1. `hash = sha256(canonical_json(payload))`
2. Fetch the transaction and read its `MEMO_HASH`; check it equals `hash` and that the source is TruMarket's attestor account.

`npm run verify` does this for every stored record, against the stored envelope and, while within RPC retention, the live transaction.

## Privacy
- Pseudonyms rotate each epoch, so there is no permanent public trade graph. Ops can recompute them with the secret.
- The salt is never published, so low-entropy fields cannot be guessed and checked against the hash.
- Raw customs files and insurance documents never leave TruMarket; only their sha256 digests enter the payload.

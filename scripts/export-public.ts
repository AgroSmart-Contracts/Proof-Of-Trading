// Writes the PUBLIC view of the store for the dashboard. Salts and raw customs files never leave data/store.
// Offering state and balances are read live from testnet; investor positions combine on-chain balances
// with the step log. Agreements and certificates are synthetic placeholders and safe to publish.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Address } from "@stellar/stellar-sdk";
import {
  ProofPayloadV1, REPO_ROOT, STORE_DIR, memoHashFromEnvelope, proofHash, publicView, readStore, view,
  type AssetsFile, type AttestationRecord,
} from "@pot/core";
import { loadSamples, kp } from "./lib.js";
import { contracts, offerings, onChain, shareBalance, type OfferingRecord } from "./offering/actions.js";

const atts = readStore<AttestationRecord[]>("attestations.json", []);
const assets = readStore<AssetsFile>("assets.json", { shares: [] });
const spike = readStore<Record<string, unknown> | null>("spike.json", null);
const UNIT = 10_000_000n;
const json = (v: unknown): unknown =>
  typeof v === "bigint" ? v.toString()
    : Buffer.isBuffer(v) || v instanceof Uint8Array ? Buffer.from(v).toString("hex")
    : Array.isArray(v) ? v.map(json)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, json(x)]))
    : v;
const readDoc = (dir: string, file?: string) => {
  const p = file && path.join(STORE_DIR, dir, file);
  return p && existsSync(p) ? readFileSync(p, "utf8") : null;
};

// Personas: public keys and TUSDC balances (public information).
const PERSONAS = { A: "investor_a", B: "investor_b", U: "unapproved", treasury: "spv_treasury", issuer: "issuer", registrar: "attestor" };
const tusdcSac = assets.tusdc?.sac_id;
const accounts = Object.fromEntries(
  await Promise.all(
    Object.entries(PERSONAS).map(async ([label, role]) => {
      const pub = kp(role).publicKey();
      const bal = tusdcSac ? ((await view(tusdcSac, "balance", [new Address(pub).toScVal()]).catch(() => 0n)) as bigint) : 0n;
      return [label, { role, public_key: pub, tusdc: bal.toString() }];
    }),
  ),
);

async function exportOffering(rec: OfferingRecord) {
  const chain = await onChain(rec.shipment_ref).catch(() => null);
  const [balA, balB, balU] = chain
    ? await Promise.all(["a", "b", "unapproved"].map((w) => shareBalance(rec.shipment_ref, w).catch(() => 0n)))
    : [0n, 0n, 0n];
  // A classic asset's SAC has no total_supply: outstanding = sum of every demo holder's live balance.
  const outstanding = balA + balB + balU;
  const minted = chain ? BigInt(chain.sold_shares) : 0n;
  const investors: Record<string, unknown> = {};
  for (const [label, who, held] of [["A", "a", balA], ["B", "b", balB]] as const) {
    const mine = rec.steps.filter((s) => s.step.split(" ")[1] === `investor_${who}`);
    const subs = mine.filter((s) => s.step.startsWith("subscribe"));
    if (!subs.length) continue;
    const subscribed = subs.reduce((n, s) => n + Number(s.step.split(" ").pop()), 0);
    const sharesAtClose = chain ? BigInt(chain.shares_at_close) : 0n;
    const owed = chain && sharesAtClose > 0n ? (BigInt(subscribed) * UNIT * BigInt(chain.owed)) / sharesAtClose : null;
    const redeemed = mine.find((s) => s.step.startsWith("redeem"));
    const refunded = mine.find((s) => s.step.startsWith("refund"));
    investors[label] = {
      subscribed_usd: subscribed,
      shares_held: held.toString(),
      pct_of_spv: chain ? (subscribed / (Number(chain.p.cap_shares) / 1e7)) * 100 : null,
      owed_at_apy: owed?.toString() ?? null,
      payout: redeemed?.detail?.payout ?? null,
      refund: refunded?.detail?.usdc ?? null,
      agreements: subs.map((s) => ({ tx: s.tx, hash: s.detail?.agreement_hash, text: readDoc("agreements", s.detail?.agreement_file) })),
      certificates: mine
        .filter((s) => s.step.startsWith("certificate"))
        .map((s) => ({ tx: s.tx, hash: s.detail?.certificate_hash, entry: s.detail?.register_entry, text: readDoc("certificates", s.detail?.certificate_file) })),
      txs: mine.map((s) => ({ step: s.step, tx: s.tx })),
    };
  }
  return {
    shipment_ref: rec.shipment_ref,
    offering_id: rec.offering_id,
    share_code: rec.share_code,
    share_sac: rec.share_sac,
    on_chain: chain ? json(chain) : null,
    tokens: chain ? { minted: minted.toString(), outstanding: outstanding.toString(), burned: (minted - outstanding).toString() } : null,
    investors,
    steps: rec.steps,
  };
}

// Only offerings that were actually created (SHP-0263 was handed to a first deployment and never opened).
const created = Object.values(offerings()).filter((r) => r.steps.some((s) => s.step === "create_offering"));
const offeringsOut = await Promise.all(created.map(exportOffering));

// Financed deals with their public terms (what an investor sees before investing), with or without an offering.
const deals = loadSamples()
  .filter((s) => s.financed && s.consented)
  .map((s) => ({
    shipment_ref: s.shipment_ref,
    commodity: s.commodity,
    destination_region: s.destination_region,
    face_value_usd: s.face_value_usd,
    term_days: s.term_days,
    apy_bps: s.apy_bps,
    cram_band: s.cram_band,
    epoch: s.epoch,
    share: assets.shares.find((x) => x.shipment_ref === s.shipment_ref) ?? null,
    has_offering: created.some((r) => r.shipment_ref === s.shipment_ref),
    stuck: !!offerings()[s.shipment_ref] && !created.some((r) => r.shipment_ref === s.shipment_ref),
  }));

// Plain-language summary of every consented shipment, so the proof explorer can say what each record is.
const shipments = loadSamples()
  .filter((s) => s.consented)
  .map((s) => ({ shipment_ref: s.shipment_ref, commodity: s.commodity, destination_region: s.destination_region, epoch: s.epoch, financed: s.financed }));

const out = {
  generated_at: new Date().toISOString(),
  shipments,
  offering_contract: contracts().offering?.contract_id ?? null,
  accounts,
  deals,
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
  offerings: offeringsOut,
  spike_decision: spike?.decision ?? null,
};
const text = JSON.stringify(out, null, 2);
if (text.includes('"salt"')) throw new Error("salt leaked into public export");
const dir = path.join(REPO_ROOT, "apps/dashboard/public");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "public-store.json"), text);
console.log(`exported ${out.attestations.length} attestations, ${deals.length} deals, ${offeringsOut.length} offerings`);

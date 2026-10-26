// Offering contract actions shared by the offering CLI and the demo scripts.
// Every on-chain step prints an explorer link and is appended to data/store/offerings.json.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Address, Asset, Operation, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  ProofPayloadV1, REPO_ROOT, STORE_DIR, deployContract, env, explorerTx, invoke, proofHash, pseudonym, readStore,
  sha256, submitClassic, toMemoHash, trustline, view, writeStore,
  type AssetsFile, type AttestationRecord, type ShareAssetRecord, type Submitted,
} from "@pot/core";
import { kp, loadSamples, sampleFile } from "../lib.js";

export const UNIT = 10_000_000n;
export const usd = (n: number | string) => BigInt(Math.round(Number(n) * 100)) * (UNIT / 100n);
export const fmt = (base: bigint) => `${(Number(base) / 1e7).toLocaleString("en-US", { maximumFractionDigits: 7 })}`;

const addr = (a: string) => new Address(a).toScVal();
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const u64 = (n: bigint | number) => nativeToScVal(BigInt(n), { type: "u64" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const bytes = (hex: string) => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
const str = (s: string) => xdr.ScVal.scvString(s);
/** #[contracttype] struct = ScMap with symbol keys sorted by name. */
const struct = (fields: Record<string, xdr.ScVal>) =>
  xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map((k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: fields[k] })),
  );

export const OFFERING_ERRORS = [
  "", "AlreadyExists", "NotFound", "BadStatus", "DeadlinePassed", "DeadlineNotPassed", "CapExceeded", "BadAmount",
  "NotSacAdmin", "AlreadyRedeemed", "NothingToSweep", "Overflow",
];
const SAC_ERRORS: Record<number, string> = { 10: "BalanceError", 11: "BalanceDeauthorizedError (holder not approved)", 13: "TrustlineMissingError" };

/** Turn a HostError into "who raised what". */
export function explainError(e: unknown): string {
  const msg = (e as Error).message ?? String(e);
  const code = Number(msg.match(/Error\(Contract, #(\d+)\)/)?.[1]);
  if (!code) return msg.split("\n")[0];
  const offering = contracts().offering?.contract_id;
  const raisedBy = [...msg.matchAll(/contract:(C[A-Z2-7]{55})[^\n]*topics:\[error, Error\(Contract, #\d+\)\]/g)].map((m) => m[1]);
  const fromSac = raisedBy.some((c) => c !== offering);
  const name = fromSac ? `SAC ${SAC_ERRORS[code] ?? `#${code}`}` : `offering ${OFFERING_ERRORS[code] ?? `#${code}`}`;
  return `Error(Contract, #${code}) = ${name}`;
}

// ---------- store ----------
type ContractsFile = { offering?: { contract_id: string; wasm_hash: string; admin: string; deploy_tx: string; deployed_at: string } };
export type OfferingRecord = {
  shipment_ref: string;
  offering_id: number;
  share_code: string;
  share_sac: string;
  steps: { step: string; tx: string; at: string; detail?: Record<string, string> }[];
};
export const contracts = () => readStore<ContractsFile>("contracts.json", {});
export const offeringContract = () => {
  const c = contracts().offering?.contract_id;
  if (!c) throw new Error("offering contract not deployed (run: npm run offering -- deploy)");
  return c;
};
export const offerings = () => readStore<Record<string, OfferingRecord>>("offerings.json", {});

export function shareFor(ref: string): ShareAssetRecord {
  const s = readStore<AssetsFile>("assets.json", { shares: [] }).shares.find((x) => x.shipment_ref === ref);
  if (!s) throw new Error(`no share asset for ${ref} (run: npm run issue:shares)`);
  return s;
}
const tusdc = () => {
  const t = readStore<AssetsFile>("assets.json", { shares: [] }).tusdc;
  if (!t) throw new Error("TUSDC not set up (run: npm run setup:tusdc)");
  return t;
};
export const offeringId = (ref: string) => Number(ref.split("-")[1]);

function record(ref: string, step: string, tx: Submitted, detail?: Record<string, string>) {
  const all = offerings();
  const s = shareFor(ref);
  const rec = all[ref] ?? { shipment_ref: ref, offering_id: offeringId(ref), share_code: s.code, share_sac: s.sac_id, steps: [] };
  rec.steps.push({ step, tx: tx.hash, at: new Date().toISOString(), ...(detail && { detail }) });
  all[ref] = rec;
  writeStore("offerings.json", all);
  console.log(`  ✓ ${step}  ${explorerTx(tx.hash)}`);
}

// ---------- roles ----------
const ROLE: Record<string, string> = { a: "investor_a", b: "investor_b", unapproved: "unapproved", treasury: "spv_treasury" };
export const role = (name: string) => {
  const r = ROLE[name.toLowerCase()] ?? name;
  return { name: r, kp: kp(r) };
};

// ---------- actions ----------
export async function deploy(force = false) {
  const existing = contracts().offering;
  if (existing && !force) {
    console.log(`offering contract already deployed: ${existing.contract_id} (use --force to redeploy)`);
    return existing.contract_id;
  }
  const wasm = readFileSync(path.join(REPO_ROOT, "contracts/target/wasm32v1-none/release/offering.wasm"));
  const issuer = kp("issuer");
  const r = await deployContract(issuer, wasm, [addr(issuer.publicKey())]);
  writeStore("contracts.json", {
    ...contracts(),
    offering: { contract_id: r.contractId, wasm_hash: r.wasmHash, admin: issuer.publicKey(), deploy_tx: r.tx.hash, deployed_at: new Date().toISOString() },
  });
  console.log(`offering contract ${r.contractId}\n  ✓ deploy  ${explorerTx(r.tx.hash)}`);
  return r.contractId;
}

/** Issuer hands the share SAC admin role to the offering contract (GO path). */
export async function handover(ref: string) {
  const s = shareFor(ref);
  const c = offeringContract();
  if ((await view(s.sac_id, "admin")) === c) return console.log(`  · ${s.code} SAC admin is already the offering contract`);
  record(ref, "handover", await invoke(kp("issuer"), s.sac_id, "set_admin", [addr(c)]), { new_admin: c });
}

export async function create(ref: string, deadlineMins = 120) {
  const sample = loadSamples().find((x) => x.shipment_ref === ref);
  if (!sample?.financed) throw new Error(`${ref} is not a financed sample`);
  const s = shareFor(ref);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMins * 60);
  const params = struct({
    shipment_ref: str(ref),
    proof_hash: bytes(s.proof_hash),
    share_token: addr(s.sac_id),
    usdc_token: addr(tusdc().sac_id),
    treasury: addr(kp("spv_treasury").publicKey()),
    unit_price: i128(UNIT),
    cap_shares: i128(usd(sample.face_value_usd)),
    deadline: u64(deadline),
    term_secs: u64(sample.term_days * 86_400),
    apy_bps: u32(sample.apy_bps),
  });
  const tx = await invoke(kp("issuer"), offeringContract(), "create_offering", [u32(offeringId(ref)), params]);
  record(ref, "create_offering", tx, {
    cap_usd: String(sample.face_value_usd), apy_bps: String(sample.apy_bps), term_days: String(sample.term_days),
    deadline: new Date(Number(deadline) * 1000).toISOString(),
  });
}

/** Investors A, B and the unapproved wallet create trustlines to the share asset. */
export async function trustlines(ref: string, who = ["a", "b", "unapproved"]) {
  const s = shareFor(ref);
  const asset = new Asset(s.code, s.issuer);
  for (const w of who) {
    const { name, kp: k } = role(w);
    if (await trustline(k.publicKey(), asset)) {
      console.log(`  · ${name} already trusts ${s.code}`);
      continue;
    }
    record(ref, `trustline ${name}`, await submitClassic(k, [Operation.changeTrust({ asset })]));
  }
}

export async function approve(ref: string, who: string) {
  const { name, kp: k } = role(who);
  record(ref, `approve ${name}`, await invoke(kp("issuer"), offeringContract(), "approve_investor", [u32(offeringId(ref)), addr(k.publicKey())]));
}

export async function subscribe(ref: string, who: string, amountUsd: number) {
  const { name, kp: k } = role(who);
  const sample = loadSamples().find((x) => x.shipment_ref === ref)!;
  const s = shareFor(ref);
  // Placeholder subscription agreement in the investor's name; only its hash goes on-chain.
  const agreement = [
    "SUBSCRIPTION AGREEMENT (PLACEHOLDER: testnet demo, not a legal document)",
    `SPV: Proof of Trading SPV ${ref} (simulated; legal structure under counsel review)`,
    `Subscriber wallet: ${k.publicKey()}`,
    `Subscription: ${amountUsd} USD (paid in TUSDC) for ${amountUsd} ordinary shares at 1.00 USD each`,
    `Return: fixed ${sample.apy_bps / 100}% APY over ${sample.term_days} days, paid from collections; pro rata if less is collected`,
    `Underlying: receivable and insurance of shipment ${ref}; customs attestation proof hash ${s.proof_hash}`,
    `On-chain receipt: ${s.code} tokens (issuer ${s.issuer})`,
    `Nonce: ${randomBytes(8).toString("hex")}`,
  ].join("\n") + "\n";
  const agreementFile = `${ref}-${name}-${Date.now()}.txt`;
  mkdirSync(path.join(STORE_DIR, "agreements"), { recursive: true });
  writeFileSync(path.join(STORE_DIR, "agreements", agreementFile), agreement);
  const agreementHash = sha256(agreement).toString("hex");
  const tx = await invoke(k, offeringContract(), "subscribe", [u32(offeringId(ref)), addr(k.publicKey()), i128(usd(amountUsd)), bytes(agreementHash)]);
  record(ref, `subscribe ${name} ${amountUsd}`, tx, { agreement_hash: agreementHash, agreement_file: agreementFile, shares: fmt(usd(amountUsd)) });
  await issueCertificate(ref, name, k.publicKey(), amountUsd, tx.hash, agreementHash);
}

/**
 * The SPV issues the legal share off-chain, in the investor's name, and the registrar (the attestor
 * account) anchors the certificate's sha256 on-chain as a MEMO_HASH, so the holder can prove that the
 * certificate they hold is the one on record.
 */
async function issueCertificate(ref: string, name: string, holder: string, shares: number, subscribeTx: string, agreementHash: string) {
  const s = shareFor(ref);
  const entry = `${ref}-${String((offerings()[ref]?.steps.filter((x) => x.step.startsWith("certificate")).length ?? 0) + 1).padStart(3, "0")}`;
  const cert = [
    "SPV SHARE CERTIFICATE (PLACEHOLDER: testnet demo, not a legal document)",
    `Issuer: Proof of Trading SPV ${ref} (simulated)`,
    `Register entry: ${entry}`,
    `Registered holder: ${holder}`,
    `Shares: ${shares} ordinary shares, fully paid (1.00 USD each)`,
    `Subscription agreement sha256: ${agreementHash}`,
    `On-chain receipt: ${s.code} tokens minted in subscription tx ${subscribeTx}`,
    `Issued: ${new Date().toISOString()}`,
  ].join("\n") + "\n";
  const file = `${entry}-${name}.txt`;
  mkdirSync(path.join(STORE_DIR, "certificates"), { recursive: true });
  writeFileSync(path.join(STORE_DIR, "certificates", file), cert);
  const hash = sha256(cert);
  const tx = await submitClassic(
    kp("attestor"),
    [Operation.payment({ destination: kp("attestation_sink").publicKey(), asset: Asset.native(), amount: "0.0000001" })],
    { memo: toMemoHash(hash) },
  );
  record(ref, `certificate ${name}`, tx, { certificate_hash: hash.toString("hex"), certificate_file: file, register_entry: entry });
}

export async function fund(ref: string) {
  record(ref, "fund", await invoke(kp("issuer"), offeringContract(), "fund", [u32(offeringId(ref))]));
}

export async function startRefunds(ref: string) {
  record(ref, "start_refunds", await invoke(kp("issuer"), offeringContract(), "start_refunds", [u32(offeringId(ref))]));
}

export async function refund(ref: string, who: string) {
  const { name, kp: k } = role(who);
  const tx = await invoke(k, offeringContract(), "refund", [u32(offeringId(ref)), addr(k.publicKey())]);
  record(ref, `refund ${name}`, tx, { usdc: fmt(BigInt(scv(tx))) });
}

export async function distribute(ref: string, amountUsd: number, outcome: number) {
  const tx = await invoke(kp("spv_treasury"), offeringContract(), "deposit_distribution", [u32(offeringId(ref)), i128(usd(amountUsd)), u32(outcome)]);
  record(ref, `deposit_distribution ${amountUsd} outcome ${outcome}`, tx);
}

export async function redeem(ref: string, who: string) {
  const { name, kp: k } = role(who);
  const [shares, preview] = (await view(offeringContract(), "preview_redeem", [u32(offeringId(ref)), addr(k.publicKey())])) as bigint[];
  console.log(`  preview: ${name} redeems ${fmt(shares)} shares for ${fmt(preview)} TUSDC`);
  const tx = await invoke(k, offeringContract(), "redeem", [u32(offeringId(ref)), addr(k.publicKey())]);
  const [burned, payout] = scv(tx) as bigint[];
  record(ref, `redeem ${name}`, tx, { shares_burned: fmt(burned), payout: fmt(payout) });
}

export async function sweep(ref: string) {
  const tx = await invoke(kp("issuer"), offeringContract(), "sweep_surplus", [u32(offeringId(ref)), addr(kp("spv_treasury").publicKey())]);
  record(ref, "sweep_surplus", tx, { amount: fmt(BigInt(scv(tx))) });
}

const scv = (tx: Submitted) => scValToNative(tx.returnValue!);

/** On-chain state of an offering (no logging). */
export async function onChain(ref: string): Promise<Record<string, any>> {
  const o = (await view(offeringContract(), "get_offering", [u32(offeringId(ref))])) as Record<string, any>;
  const owed = (await view(offeringContract(), "owed_total", [u32(offeringId(ref))])) as bigint;
  return { ...o, status: Array.isArray(o.status) ? o.status[0] : o.status, owed };
}

export async function status(ref: string): Promise<Record<string, any>> {
  const o = await onChain(ref);
  console.log(`${ref} [${shareFor(ref).code}] status=${o.status} sold=${fmt(o.sold_shares)}/${fmt(o.p.cap_shares)} owed=${fmt(o.owed)} collected=${fmt(o.total_collected)} paid_out=${fmt(o.paid_out)} outcome=${o.outcome_code}`);
  return o;
}

/** Share balance of an investor for a shipment's share asset (base units). */
export const shareBalance = async (ref: string, who: string) =>
  (await view(shareFor(ref).sac_id, "balance", [addr(role(who).kp.publicKey())])) as bigint;

/** Outcome attestation: closes the loop on the proof layer, with the hash of the SPV's redemption confirmation. */
export async function attestOutcome(ref: string) {
  const o = await status(ref);
  const sample = loadSamples().find((x) => x.shipment_ref === ref)!;
  const steps = offerings()[ref]?.steps ?? [];
  const confirmation = [
    "PLACEHOLDER SPV redemption confirmation (testnet demo; real document is SCF M1)",
    `shipment: ${ref}`, `share asset: ${shareFor(ref).code}`, `outcome code: ${o.outcome_code}`,
    `collected: ${o.total_collected}`, `owed: ${o.owed}`, `paid out: ${o.paid_out}`,
    ...steps.filter((s) => s.step.startsWith("redeem")).map((s) => `${s.step}: ${s.tx}`),
  ].join("\n");
  mkdirSync(path.join(STORE_DIR, "docs"), { recursive: true });
  writeFileSync(path.join(STORE_DIR, "docs", `${ref}-redemption-confirmation.txt`), confirmation);

  const customsRaw = sampleFile(sample.customs_record_file);
  const customs = JSON.parse(customsRaw.toString("utf8"));
  const secret = env("PSEUDONYM_SECRET");
  const payload = ProofPayloadV1.parse({
    v: 1, event: "outcome", shipment_ref: ref, epoch: sample.epoch,
    exporter_pseudonym: pseudonym(secret, sample.exporter_internal_id, sample.epoch),
    buyer_pseudonym: pseudonym(secret, sample.buyer_internal_id, sample.epoch),
    customs: { record_id: customs.record_id, record_version: customs.record_version, record_digest: sha256(customsRaw).toString("hex") },
    outcome: {
      code: o.outcome_code, amount_collected: String(o.total_collected), amount_owed: String(o.owed),
      redemption_confirmation_digest: sha256(confirmation).toString("hex"),
    },
    salt: randomBytes(16).toString("hex"),
  });
  const hash = proofHash(payload);
  const tx = await submitClassic(
    kp("attestor"),
    [Operation.payment({ destination: kp("attestation_sink").publicKey(), asset: Asset.native(), amount: "0.0000001" })],
    { memo: toMemoHash(hash) },
  );
  const atts = readStore<AttestationRecord[]>("attestations.json", []);
  atts.push({
    shipment_ref: ref, event: "outcome", payload, proof_hash: hash.toString("hex"), tx_hash: tx.hash, ledger: tx.ledger,
    envelope_xdr: tx.envelopeXdr, arc_stub: false, created_at: new Date().toISOString(),
  });
  writeStore("attestations.json", atts);
  record(ref, `outcome attested (code ${o.outcome_code})`, tx, { proof_hash: hash.toString("hex") });
}

/** Run a step that must fail; print the decoded error. */
export async function expectFailure(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  ✗ UNEXPECTED SUCCESS: ${label}`);
    process.exitCode = 1;
  } catch (e) {
    console.log(`  ✓ ${label} rejected: ${explainError(e)}`);
  }
}

/** Offering contract hands the share SAC admin back to the issuer (e.g. after the demo, or before a redeploy). */
export async function handBack(ref: string) {
  const s = shareFor(ref);
  const tx = await invoke(kp("issuer"), offeringContract(), "transfer_share_admin", [addr(s.sac_id), addr(kp("issuer").publicKey())]);
  record(ref, "hand back SAC admin to issuer", tx);
}

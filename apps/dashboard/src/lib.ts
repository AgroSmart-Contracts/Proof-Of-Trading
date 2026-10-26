// Shared types and helpers for the dashboard.

export type Att = {
  shipment_ref: string;
  event: "shipment_attested" | "financed_attested" | "outcome";
  payload: Record<string, any>;
  proof_hash: string;
  tx_hash: string;
  ledger: number;
  arc_stub: boolean;
  created_at: string;
  verified: boolean;
};
export type Share = { shipment_ref: string; code: string; issuer: string; sac_id: string; proof_hash: string; attestation_tx: string };
export type Step = { step: string; tx: string; at: string; detail?: Record<string, string> };
export type Doc = { tx: string; hash?: string; entry?: string; text: string | null };
export type Position = {
  subscribed_usd: number;
  shares_held: string;
  pct_of_spv: number | null;
  owed_at_apy: string | null;
  payout: string | null;
  refund: string | null;
  agreements: Doc[];
  certificates: Doc[];
  txs: { step: string; tx: string }[];
};
export type Tokens = { minted: string; outstanding: string; burned: string };
export type Offering = {
  shipment_ref: string;
  offering_id: number;
  share_code: string;
  share_sac: string;
  on_chain: Record<string, any> | null;
  tokens: Tokens | null;
  investors: Record<string, Position>;
  steps: Step[];
};
export type Deal = {
  shipment_ref: string;
  commodity: string;
  destination_region: string;
  face_value_usd: number;
  term_days: number;
  apy_bps: number;
  cram_band: string;
  epoch: string;
  share: Share | null;
  has_offering: boolean;
  stuck: boolean;
};
export type Account = { role: string; public_key: string; tusdc: string };
export type ShipmentSummary = { shipment_ref: string; commodity: string; destination_region: string; epoch: string; financed: boolean };
export type Store = {
  generated_at: string;
  shipments: ShipmentSummary[];
  offering_contract: string | null;
  accounts: Record<string, Account>;
  deals: Deal[];
  attestations: Att[];
  shares: Share[];
  offerings: Offering[];
  tusdc: { code: string; issuer: string; sac_id: string } | null;
};

export type Persona = "A" | "B" | "U" | "ops";
export const PERSONAS: Record<Persona, string> = { A: "Investor A", B: "Investor B", U: "Unapproved wallet", ops: "TruMarket ops (SPV)" };
/** CLI name for an investor persona. */
export const who = (p: Persona) => (p === "A" ? "a" : p === "B" ? "b" : "unapproved");
export const stepName = (p: Persona) => (p === "A" ? "investor_a" : p === "B" ? "investor_b" : "unapproved");

export const X = "https://stellar.expert/explorer/testnet";
const RPC = "https://soroban-testnet.stellar.org";
export const OUTCOMES: Record<string, string> = {
  "1": "Buyer paid on time", "2": "Paid late", "3": "Disputed", "4": "Insurance paid", "5": "Uninsured loss",
};
export const CRAM: Record<string, string> = {
  A: "Lowest risk: repeat exporter and buyer, strong payment history",
  B: "Low risk: established counterparties, minor gaps in history",
  C: "Moderate risk: newer relationship or thinner history",
  D: "Elevated risk: limited history or concentration concerns",
  E: "High risk: priced and capped accordingly",
};
export const COMMODITY: Record<string, string> = { avocado: "Avocado", blueberry: "Blueberry", grape: "Table grape", mango: "Mango", asparagus: "Asparagus" };
export const REGION: Record<string, string> = { EU: "EU", US: "US", UK: "UK", ASIA: "Asia" };

export const short = (s: string, n = 6) => (s && s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-4)}` : s);
export const units = (base: string | number) => Number(base) / 1e7;
export const money = (n: number, dp = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp > 0 && n % 1 !== 0 ? 2 : 0, maximumFractionDigits: dp })}`;
export const usd = (base: string | number | null | undefined, dp = 2) => (base == null ? "–" : money(units(base), dp));
export const num = (base: string | number) => units(base).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const date = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const dateS = (secs: string | number) => new Date(Number(secs) * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export const statusChip = (status?: string, settled = false): [string, string] => {
  switch (status) {
    case "Open": return ["Open for subscription", "blue"];
    case "Closed": return ["Fully subscribed", "gold"];
    case "Funded": return ["Financing the shipment", "gold"];
    case "Distributing": return settled ? ["Completed: investors repaid", "green"] : ["Repaid: redeem now", "green"];
    case "Refunding": return settled ? ["Closed: refunded", ""] : ["Under-subscribed: refunds", "red"];
    default: return ["Coming soon", ""];
  }
};
/** Status label for an offering; "settled" once every minted share has been redeemed or refunded. */
export const offeringStatus = (o?: { on_chain: Record<string, any> | null; tokens: { outstanding: string } | null }): [string, string] =>
  statusChip(o?.on_chain?.status, !!o?.tokens && o.tokens.outstanding === "0" && o.on_chain?.sold_shares !== "0");

/** "Avocado shipment · Peru → EU" for any attested shipment. */
export function shipmentTitle(s: Store, ref: string): string {
  const x = s.shipments?.find((v) => v.shipment_ref === ref) ?? s.deals.find((d) => d.shipment_ref === ref);
  return x ? `${COMMODITY[x.commodity] ?? x.commodity} shipment · Peru → ${REGION[x.destination_region] ?? x.destination_region}` : ref;
}
export const offeringFor = (s: Store, ref: string) => s.offerings.find((o) => o.shipment_ref === ref);
export const dealFor = (s: Store, ref: string) => s.deals.find((d) => d.shipment_ref === ref);
export const isApproved = (o: Offering | undefined, p: Persona) => !!o?.steps.some((s) => s.step === `approve ${stepName(p)}`);
export const outcomeAttested = (s: Store, ref: string) => s.attestations.some((a) => a.shipment_ref === ref && a.event === "outcome");

/** Value of a position at the deal's fixed APY, accrued from funding up to the term (estimate, before collection). */
export function accruedValue(o: Offering, shares: number): number {
  const c = o.on_chain;
  if (!c || !Number(c.funded_at)) return shares;
  const termSecs = Number(c.p.term_secs);
  const elapsed = Math.min(Math.max(Date.now() / 1000 - Number(c.funded_at), 0), termSecs);
  return shares * (1 + (Number(c.p.apy_bps) / 10_000) * (elapsed / 31_536_000));
}

/** Expected redemption payout for `held` base units, mirroring the contract: held × min(owed, collected) / shares_at_close. */
export function previewPayout(o: Offering, held: bigint): bigint {
  const c = o.on_chain;
  if (!c || held === 0n || BigInt(c.shares_at_close) === 0n) return 0n;
  const owed = BigInt(c.owed);
  const collected = BigInt(c.total_collected);
  return (held * (owed < collected ? owed : collected)) / BigInt(c.shares_at_close);
}

/** "62,367.1232876" (CLI-formatted 7-decimal amount) → "$62,367.12". */
export const amount = (v?: string | null) => (v == null ? "?" : money(Number(v.replace(/,/g, ""))));

/** Plain-language label for an offering step. */
export function stepLabel(s: Step, code: string): string {
  const [verb, actor, qty] = s.step.split(" ");
  const investor = (actor ?? "").replace("investor_", "Investor ").replace(/ (a|b)$/, (m) => m.toUpperCase());
  switch (verb) {
    case "handover": return `Share issuance for ${code} handed to the offering contract: shares can now only be created when investors pay`;
    case "create_offering": return `Offering opened: up to ${Number(s.detail?.cap_usd ?? 0).toLocaleString("en-US")} ${code} at $1 each`;
    case "trustline": return `${investor} opens a ${code} trustline`;
    case "approve": return `${investor} approved to hold ${code} (KYB, simulated)`;
    case "subscribe": return `${investor} pays $${Number(qty).toLocaleString("en-US")} TUSDC → ${s.detail?.shares ?? qty} ${code} minted`;
    case "certificate": return `SPV share certificate ${s.detail?.register_entry ?? ""} issued off-chain to ${investor}; hash anchored on Stellar`;
    case "fund": return "Fully subscribed → escrowed TUSDC sent to the SPV treasury";
    case "deposit_distribution": return `SPV deposits $${Number(actor).toLocaleString("en-US")} collected (${OUTCOMES[s.step.split(" ").pop()!] ?? "outcome"})`;
    case "redeem": return `${investor} redeems → ${amount(s.detail?.payout)} paid, ${s.detail?.shares_burned ?? "?"} ${code} cancelled`;
    case "sweep_surplus": return `Surplus ${amount(s.detail?.amount)} returned to the SPV`;
    case "start_refunds": return "Deadline passed under cap → refunds open";
    case "refund": return `${investor} refunded ${amount(s.detail?.usdc)} → ${code} cancelled`;
    case "outcome": return `Outcome attested on the proof layer`;
    default: return s.step;
  }
}

// ---------- browser-side verification ----------

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Reads a transaction from Stellar RPC and returns its MEMO_HASH as hex. Minimal XDR walk for
 * ENVELOPE_TYPE_TX with an ed25519 source and time-bound preconditions, which is what our attestor sends.
 */
export async function memoHashOf(txHash: string): Promise<{ memo: string | null; ledger?: number; note?: string }> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: { hash: txHash } }),
  }).then((r) => r.json());
  const r = res.result;
  if (!r || r.status !== "SUCCESS") return { memo: null, note: r?.status === "NOT_FOUND" ? "outside RPC retention (~7 days); check the explorer" : "not found" };
  const b = Uint8Array.from(atob(r.envelopeXdr), (c) => c.charCodeAt(0));
  const dv = new DataView(b.buffer);
  let o = 0;
  const u32 = () => ((o += 4), dv.getUint32(o - 4));
  if (u32() !== 2) return { memo: null, note: "unexpected envelope type" };
  const muxed = u32();
  o += muxed === 0 ? 32 : 40;
  o += 4 + 8; // fee, sequence
  const cond = u32();
  if (cond === 1) o += 16;
  else if (cond !== 0) return { memo: null, note: "unsupported preconditions" };
  if (u32() !== 3) return { memo: null, note: "no MEMO_HASH" };
  const memo = [...b.slice(o, o + 32)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return { memo, ledger: r.ledger };
}

// ---------- demo API (local dev server only) ----------

export type ActionBody = { action: string; ref: string; who?: string; usd?: string; outcome?: string; deadlineMins?: string };
export async function postAction(body: ActionBody): Promise<{ ok: boolean; log: string }> {
  const r = await fetch("/api/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
export async function isInteractive(): Promise<boolean> {
  try {
    const r = await fetch("/api/health");
    return r.ok && (await r.json()).interactive === true;
  } catch {
    return false;
  }
}
export const txLinks = (log: string) => [...new Set([...log.matchAll(/tx\/([0-9a-f]{64})/g)].map((m) => m[1]))];

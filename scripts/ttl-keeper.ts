// Keeps the offering contract's ledger entries alive by extending their TTL.
// Usage: ttl-keeper.ts [--days N] [--ref SHP-xxxx] [--submit]
//
// Without --submit it only simulates: it prints each entry's remaining TTL and the rent (resource
// fee) the extension would cost, and sends nothing. With --submit it pays from the issuer account.
// Anyone can extend any entry's TTL; no contract auth is needed. Run it from cron, e.g. daily:
//   0 6 * * *  cd /path/to/proof-of-trading && npx tsx scripts/ttl-keeper.ts --days 120 --submit
//
// Entries covered, per offering in data/store/offerings.json:
//   contract instance + WASM code (shared), the share asset's SAC instance,
//   Offering(id), Record(id) (v0.3 only), Redeemed(id, investor) for the test investors.
// Archived entries (TTL already expired) cannot be extended directly: the keeper restores them first
// (RestoreFootprint, which brings them back with the network minimum TTL), then extends them.
// Missing entries (never written, e.g. a Redeemed flag for an investor who didn't subscribe) are skipped.
import {
  Account, Address, BASE_FEE, Keypair, Operation, SorobanDataBuilder, TransactionBuilder, nativeToScVal, rpc, xdr,
} from "@stellar/stellar-sdk";
import { PASSPHRASE, readStore, server } from "@pot/core";
import { kp } from "./lib.js";

const LEDGERS_PER_DAY = 17_280; // ~5 s ledgers
const STROOPS_PER_XLM = 10_000_000;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const days = Number(arg("--days") ?? 120);
const onlyRef = arg("--ref");
const submit = process.argv.includes("--submit");
if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");

type Contracts = { offering?: { contract_id: string; admin: string }; offering_v3?: { contract_id: string; admin: string } };
type Assets = { shares: { shipment_ref: string; code: string; sac_id: string }[] };
const contracts = readStore<Contracts>("contracts.json", {});
const current = contracts.offering_v3 ?? contracts.offering;
if (!current) throw new Error("no offering contract in data/store/contracts.json");
const isV3 = Boolean(contracts.offering_v3);
const shares = readStore<Assets>("assets.json", { shares: [] }).shares;
const offerings = Object.keys(readStore<Record<string, unknown>>("offerings.json", {})).filter((r) => !onlyRef || r === onlyRef);
const investors = ["investor_a", "investor_b"].map((role) => kp(role).publicKey());

const sym = (s: string) => xdr.ScVal.scvSymbol(s);
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const dataKey = (contract: string, key: xdr.ScVal) =>
  xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({ contract: new Address(contract).toScAddress(), key, durability: xdr.ContractDataDurability.persistent() }),
  );
const instanceKey = (contract: string) => dataKey(contract, xdr.ScVal.scvLedgerKeyContractInstance());

async function codeKey(contract: string): Promise<xdr.LedgerKey | null> {
  const r = await server().getLedgerEntries(instanceKey(contract));
  const exe = r.entries[0]?.val.contractData().val().instance().executable();
  return exe && exe.switch().name === "contractExecutableWasm"
    ? xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: exe.wasmHash() }))
    : null;
}

type State = "live" | "archived" | "missing";
/** Each key's state: live (with days left), archived (exists, TTL expired) or missing (never written). */
async function status(keys: { label: string; key: xdr.LedgerKey }[]) {
  const latest = (await server().getLatestLedger()).sequence;
  const res = await server().getLedgerEntries(...keys.map((k) => k.key));
  const found = new Map(res.entries.map((e) => [e.key.toXDR("base64"), e.liveUntilLedgerSeq ?? 0]));
  return keys.map((k) => {
    const until = found.get(k.key.toXDR("base64"));
    const state: State = until === undefined ? "missing" : until > latest ? "live" : "archived";
    return { ...k, state, left: state === "live" ? (until! - latest) / LEDGERS_PER_DAY : 0 };
  });
}

async function run(label: string, keys: xdr.LedgerKey[], kind: "restore" | "extend") {
  const sourceKey = submit ? kp("issuer") : null;
  const source = sourceKey
    ? await server().getAccount(sourceKey.publicKey())
    : new Account(current!.admin ?? Keypair.random().publicKey(), "0");
  const op = kind === "restore" ? Operation.restoreFootprint({}) : Operation.extendFootprintTtl({ extendTo: Math.round(days * LEDGERS_PER_DAY) });
  const footprint = kind === "restore" ? new SorobanDataBuilder().setReadWrite(keys) : new SorobanDataBuilder().setReadOnly(keys);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE() })
    .addOperation(op)
    .setSorobanData(footprint.build())
    .setTimeout(60)
    .build();
  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${label}: ${sim.error}`);
  const xlm = Number(sim.minResourceFee) / STROOPS_PER_XLM;
  if (!sourceKey) return { xlm, hash: null as string | null };
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(sourceKey);
  const sent = await server().sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${label}: send failed`);
  const done = await server().pollTransaction(sent.hash);
  if (done.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`${label}: ${done.status}`);
  return { xlm, hash: sent.hash };
}

console.log(`${submit ? "Extending" : "Simulating"} TTL to ~${days} days on ${isV3 ? "v0.3" : "v0.2"} contract ${current.contract_id}\n`);
const shared = [{ label: "contract instance", key: instanceKey(current.contract_id) }];
const code = await codeKey(current.contract_id);
if (code) shared.push({ label: "contract WASM", key: code });

let total = 0;
const groups: [string, { label: string; key: xdr.LedgerKey }[]][] = [["shared", shared]];
for (const ref of offerings) {
  const id = Number(ref.split("-")[1]);
  const keys = [{ label: `Offering(${id})`, key: dataKey(current.contract_id, xdr.ScVal.scvVec([sym("Offering"), u32(id)])) }];
  if (isV3) keys.push({ label: `Record(${id})`, key: dataKey(current.contract_id, xdr.ScVal.scvVec([sym("Record"), u32(id)])) });
  for (const inv of investors) {
    keys.push({
      label: `Redeemed(${id}, ${inv.slice(0, 4)}…)`,
      key: dataKey(current.contract_id, xdr.ScVal.scvVec([sym("Redeemed"), u32(id), new Address(inv).toScVal()])),
    });
  }
  const sac = shares.find((s) => s.shipment_ref === ref)?.sac_id;
  if (sac) keys.push({ label: `share SAC instance`, key: instanceKey(sac) });
  groups.push([ref, keys]);
}

const show = (k: { state: State; left: number }) => (k.state === "live" ? `${k.left.toFixed(1)} days left` : k.state);
for (const [name, keys] of groups) {
  const st = await status(keys);
  for (const k of st) console.log(`  ${name.padEnd(9)} ${k.label.padEnd(26)} ${show(k)}`);
  const archived = st.filter((k) => k.state === "archived").map((k) => k.key);
  const present = st.filter((k) => k.state !== "missing").map((k) => k.key);
  if (!present.length) continue;
  let line = `  ${name.padEnd(9)} →`;
  if (archived.length) {
    const rr = await run(name, archived, "restore");
    total += rr.xlm;
    line += ` restore ${rr.xlm.toFixed(2)} XLM${rr.hash ? ` (tx ${rr.hash})` : ""},`;
  }
  // A restored entry's extension can only be simulated once it is live again, so in a dry run
  // the extension is estimated for entries that are live now; archived ones get the same rate.
  const live = submit ? present : st.filter((k) => k.state === "live").map((k) => k.key);
  if (live.length) {
    const r = await run(name, live, "extend");
    total += r.xlm;
    line += ` extend ${r.xlm.toFixed(2)} XLM${r.hash ? ` (tx ${r.hash})` : ""}`;
  } else line += " extend: estimate after restore (run with --submit, or after a restore)";
  console.log(`${line}${submit ? "" : " (simulated)"}\n`);
}
console.log(`Total: ${total.toFixed(2)} XLM ${submit ? "paid" : "estimated"}.`);

// Writes the SEP-1 stellar.toml for the share-asset issuer from the public export.
// Usage: stellar-toml.ts [--out path]   (default: apps/dashboard/public/.well-known/stellar.toml)
//   ORG_OFFICIAL_EMAIL=...   optional, left out when unset
//
// Wallets and explorers read it from https://<home_domain>/.well-known/stellar.toml, so the issuer's
// home_domain must point at the domain serving it (a SetOptions from the issuer multisig; not done
// on testnet yet). Served with Access-Control-Allow-Origin: * (apps/dashboard/vercel.json).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PASSPHRASE, REPO_ROOT, optionalEnv, renderStellarToml, type TomlShare } from "@pot/core";

type PublicStore = {
  shares: { shipment_ref: string; code: string; issuer: string; sac_id: string; proof_hash: string }[];
  deals: { shipment_ref: string; face_value_usd: number; commodity: string; destination_region: string }[];
};
const i = process.argv.indexOf("--out");
const out = i >= 0 ? path.resolve(process.argv[i + 1]) : path.join(REPO_ROOT, "apps/dashboard/public/.well-known/stellar.toml");
const store = JSON.parse(readFileSync(path.join(REPO_ROOT, "apps/dashboard/public/public-store.json"), "utf8")) as PublicStore;
if (!store.shares.length) throw new Error("no share assets in the public export (run: npm run export)");

const shares: TomlShare[] = store.shares.map((s) => {
  const d = store.deals.find((x) => x.shipment_ref === s.shipment_ref);
  return { ...s, face_value_usd: d?.face_value_usd, commodity: d?.commodity, destination_region: d?.destination_region };
});
const toml = renderStellarToml({
  networkPassphrase: PASSPHRASE(),
  issuer: shares[0].issuer,
  status: PASSPHRASE().startsWith("Public") ? "live" : "test",
  org: {
    name: "TruMarket",
    url: "https://trumarket.tech",
    description:
      "Agri-export trade receivables from Peru, recorded on Stellar. On testnet: the v0.2 per-shipment prototype, " +
      "where each financed shipment is held by an SPV whose shares only approved investors can hold. " +
      "The pilot issues one pool share with an attestation per receivable.",
    email: optionalEnv("ORG_OFFICIAL_EMAIL"),
    github: "AgroSmart-Contracts",
  },
  shares,
});
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, toml);
console.log(`wrote ${path.relative(REPO_ROOT, out)} (${shares.length} share assets)`);

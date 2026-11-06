// Points the share-asset issuer's home_domain at the domain that serves its stellar.toml (SEP-1),
// so wallets and explorers can find the [[CURRENCIES]] entries. Testnet only; dry run by default.
// Usage: set-home-domain.ts [domain] [--submit]   (default domain: proof-of-trading.vercel.app)
import { Operation } from "@stellar/stellar-sdk";
import { PASSPHRASE, explorerTx, submitClassic } from "@pot/core";
import { kp } from "./lib.js";

if (PASSPHRASE().startsWith("Public")) throw new Error("testnet only: mainnet needs the issuer multisig");
const domain = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "proof-of-trading.vercel.app";
const issuer = kp("issuer");
const toml = await fetch(`https://${domain}/.well-known/stellar.toml`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
if (!toml?.includes(issuer.publicKey())) throw new Error(`https://${domain}/.well-known/stellar.toml does not list issuer ${issuer.publicKey()}`);
const current: string | undefined = (await fetch(`https://horizon-testnet.stellar.org/accounts/${issuer.publicKey()}`).then((r) => r.json())).home_domain;
console.log(`issuer ${issuer.publicKey()}\n  home_domain: ${current ?? "(none)"} → ${domain}`);
if (current === domain) process.exit(0);
if (!process.argv.includes("--submit")) {
  console.log("Dry run: nothing sent. Re-run with --submit to apply.");
  process.exit(0);
}
const tx = await submitClassic(issuer, [Operation.setOptions({ homeDomain: domain })]);
console.log(`  ✓ home_domain set  ${explorerTx(tx.hash)}`);

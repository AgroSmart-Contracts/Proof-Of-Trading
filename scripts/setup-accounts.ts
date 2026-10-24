// Generates and funds all testnet accounts. Idempotent. Prints public keys only, never secrets.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { Keypair } from "@stellar/stellar-sdk";
import { REPO_ROOT, accountExists, friendbot } from "@pot/core";

const ROLES = ["issuer", "spv_treasury", "investor_a", "investor_b", "unapproved", "attestor", "attestation_sink", "tusdc_issuer"];
const envFile = path.join(REPO_ROOT, ".env");
if (!existsSync(envFile)) copyFileSync(path.join(REPO_ROOT, ".env.example"), envFile);

let text = readFileSync(envFile, "utf8");
const get = (k: string) => text.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const set = (k: string, v: string) => {
  text = new RegExp(`^${k}=`, "m").test(text) ? text.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : `${text.trimEnd()}\n${k}=${v}\n`;
};

if (!get("PSEUDONYM_SECRET")) set("PSEUDONYM_SECRET", randomBytes(32).toString("hex"));

for (const role of ROLES) {
  const key = `${role.toUpperCase()}_SECRET`;
  let secret = get(key);
  if (!secret) {
    secret = Keypair.random().secret();
    set(key, secret);
    writeFileSync(envFile, text, { mode: 0o600 }); // persist before funding so a crash never loses a key
  }
  const pub = Keypair.fromSecret(secret).publicKey();
  if (await accountExists(pub)) {
    console.log(`${role.padEnd(17)} ${pub} (exists)`);
  } else {
    await friendbot(pub);
    console.log(`${role.padEnd(17)} ${pub} (funded by friendbot)`);
  }
}
writeFileSync(envFile, text, { mode: 0o600 });

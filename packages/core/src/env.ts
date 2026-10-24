import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(REPO_ROOT, ".env"), quiet: true } as never);

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name} (run scripts/setup-accounts.ts or edit .env)`);
  return v;
}

export const optionalEnv = (name: string): string | undefined => process.env[name] || undefined;

export const RPC_URL = () => optionalEnv("STELLAR_RPC_URL") ?? "https://soroban-testnet.stellar.org";
export const PASSPHRASE = () => optionalEnv("STELLAR_NETWORK_PASSPHRASE") ?? "Test SDF Network ; September 2015";

export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerAsset = (code: string, issuer: string) =>
  `https://stellar.expert/explorer/testnet/asset/${code}-${issuer}`;

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./env.js";
import type { ProofPayloadV1 } from "./schema.js";

export const STORE_DIR = path.join(REPO_ROOT, "data/store");

export function readStore<T>(name: string, fallback: T): T {
  const file = path.join(STORE_DIR, name);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

/** Atomic write: temp file + rename. */
export function writeStore(name: string, data: unknown): void {
  mkdirSync(STORE_DIR, { recursive: true });
  const file = path.join(STORE_DIR, name);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, file);
}

export type AttestationRecord = {
  shipment_ref: string;
  event: ProofPayloadV1["event"];
  payload: ProofPayloadV1; // includes the private salt; never publish this file as-is
  proof_hash: string;
  tx_hash: string;
  ledger: number;
  envelope_xdr: string;
  arc_stub: boolean;
  created_at: string;
};

export type ShareAssetRecord = {
  shipment_ref: string;
  code: string;
  issuer: string;
  sac_id: string;
  proof_hash: string;
  attestation_tx: string;
  sac_deploy_tx?: string;
  created_at: string;
};

export type AssetsFile = {
  tusdc?: { code: string; issuer: string; sac_id: string };
  shares: ShareAssetRecord[];
};

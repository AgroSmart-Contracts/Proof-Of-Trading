import { readFileSync } from "node:fs";
import path from "node:path";
import { Keypair } from "@stellar/stellar-sdk";
import { REPO_ROOT, SampleShipment, env } from "@pot/core";

export const SAMPLES_DIR = path.join(REPO_ROOT, "data/samples");

export function loadSamples(): SampleShipment[] {
  const raw = JSON.parse(readFileSync(path.join(SAMPLES_DIR, "shipments.json"), "utf8"));
  return (raw.shipments as unknown[]).map((s) => SampleShipment.parse(s));
}

export const sampleFile = (rel: string) => readFileSync(path.join(SAMPLES_DIR, rel));

export const kp = (role: string) => Keypair.fromSecret(env(`${role.toUpperCase()}_SECRET`));

export const args = process.argv.slice(2);
export const flag = (name: string) => args.includes(`--${name}`);
export const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** TM + 4-digit shipment number, e.g. SHP-0247 -> TM0247 */
export const shareCode = (ref: string) => `TM${ref.split("-")[1]}`;

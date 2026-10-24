import { createHash } from "node:crypto";
import { Memo } from "@stellar/stellar-sdk";
import type { ProofPayloadV1 } from "./schema.js";

/**
 * RFC 8785-style canonical JSON: keys sorted by UTF-16 code units at every level,
 * no whitespace, undefined fields omitted. Only safe integers are allowed as numbers
 * so number serialisation is unambiguous; amounts are carried as decimal strings.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(value)) throw new Error(`non-integer or unsafe number in canonical JSON: ${value}`);
      return String(value);
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
    }
    default:
      throw new Error(`unsupported type in canonical JSON: ${typeof value}`);
  }
}

export const sha256 = (data: Buffer | string): Buffer => createHash("sha256").update(data).digest();

export function proofHash(payload: ProofPayloadV1): Buffer {
  return sha256(Buffer.from(canonicalJson(payload), "utf8"));
}

export const toMemoHash = (hash: Buffer): Memo => Memo.hash(hash);

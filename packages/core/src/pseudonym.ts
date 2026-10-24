import { createHmac } from "node:crypto";

/** Per-epoch pseudonym: same entity gets an unlinkable ID each reporting period. */
export function pseudonym(secretHex: string, internalId: string, epoch: string): string {
  if (!/^[0-9a-f]{64}$/.test(secretHex)) throw new Error("PSEUDONYM_SECRET must be 32 bytes of lowercase hex");
  return createHmac("sha256", Buffer.from(secretHex, "hex")).update(`${internalId}|${epoch}`).digest("hex");
}

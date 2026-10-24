import { describe, expect, it } from "vitest";
import { canonicalJson, proofHash, sha256 } from "../src/hash.js";
import { pseudonym } from "../src/pseudonym.js";
import { ProofPayloadV1, publicView } from "../src/schema.js";

const SECRET = "11".repeat(32);
const H = (c: string) => c.repeat(64);

const base: ProofPayloadV1 = {
  v: 1,
  event: "shipment_attested",
  shipment_ref: "SHP-0247",
  epoch: "2026-Q4",
  exporter_pseudonym: H("a"),
  buyer_pseudonym: H("b"),
  customs: { record_id: "CUS-0247", record_version: 1, record_digest: H("c") },
  salt: "0".repeat(32),
};

describe("canonicalJson", () => {
  it("sorts keys at every level and strips whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });
  it("omits undefined fields but keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
  it("escapes strings like JSON and keeps UTF-8", () => {
    expect(canonicalJson({ s: 'q"\n€' })).toBe('{"s":"q\\"\\n€"}');
  });
  it("rejects non-integer numbers", () => {
    expect(() => canonicalJson({ x: 1.5 })).toThrow();
  });
  it("is insensitive to input key order", () => {
    const reordered = Object.fromEntries(Object.entries(base).reverse()) as ProofPayloadV1;
    expect(canonicalJson(reordered)).toBe(canonicalJson(base));
  });
});

describe("proofHash", () => {
  it("is sha256 of the canonical JSON (fixed vector)", () => {
    expect(sha256("abc").toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(proofHash(base).equals(sha256(canonicalJson(base)))).toBe(true);
    expect(proofHash(base)).toHaveLength(32);
  });
  it("changes when the salt changes", () => {
    expect(proofHash({ ...base, salt: "1".repeat(32) }).equals(proofHash(base))).toBe(false);
  });
});

describe("schema", () => {
  it("accepts a valid shipment payload", () => {
    expect(ProofPayloadV1.safeParse(base).success).toBe(true);
  });
  it("requires arc, insurance and cram_band for financed_attested", () => {
    const r = ProofPayloadV1.safeParse({ ...base, event: "financed_attested" });
    expect(r.success).toBe(false);
    const ok = ProofPayloadV1.safeParse({
      ...base,
      event: "financed_attested",
      arc: { chain_id: 5042002, deals_manager: "0xfA3D35C236CFe644786e9B360706eB97CF2836A7", nft_id: "stub-17" },
      insurance: { assignment_digest: H("d") },
      cram_band: "B",
    });
    expect(ok.success).toBe(true);
  });
  it("requires outcome for outcome events", () => {
    expect(ProofPayloadV1.safeParse({ ...base, event: "outcome" }).success).toBe(false);
    expect(ProofPayloadV1.safeParse({ ...base, event: "outcome", outcome: { code: 4 } }).success).toBe(true);
  });
  it("rejects unknown fields (no accidental PII)", () => {
    expect(ProofPayloadV1.safeParse({ ...base, exporter_name: "ACME SAC" }).success).toBe(false);
  });
  it("rejects malformed hex", () => {
    expect(ProofPayloadV1.safeParse({ ...base, salt: "xyz" }).success).toBe(false);
  });
  it("publicView drops the salt", () => {
    expect("salt" in publicView(base)).toBe(false);
  });
});

describe("pseudonym", () => {
  it("is deterministic", () => {
    expect(pseudonym(SECRET, "EXP-014", "2026-Q4")).toBe(pseudonym(SECRET, "EXP-014", "2026-Q4"));
    expect(pseudonym(SECRET, "EXP-014", "2026-Q4")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("rotates every epoch", () => {
    expect(pseudonym(SECRET, "EXP-014", "2026-Q4")).not.toBe(pseudonym(SECRET, "EXP-014", "2027-Q1"));
  });
  it("depends on the secret", () => {
    expect(pseudonym(SECRET, "EXP-014", "2026-Q4")).not.toBe(pseudonym("22".repeat(32), "EXP-014", "2026-Q4"));
  });
  it("rejects a malformed secret", () => {
    expect(() => pseudonym("short", "EXP-014", "2026-Q4")).toThrow();
  });
});

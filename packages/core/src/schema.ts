import { z } from "zod";

export enum OutcomeCode {
  ON_TIME = 1,
  LATE = 2,
  DISPUTED = 3,
  INSURANCE_PAID = 4,
  UNINSURED_LOSS = 5,
}

const hex = (bytes: number) =>
  z.string().regex(new RegExp(`^[0-9a-f]{${bytes * 2}}$`), `expected ${bytes}-byte lowercase hex`);

export const ProofPayloadV1 = z
  .object({
    v: z.literal(1),
    event: z.enum(["shipment_attested", "financed_attested", "outcome"]),
    shipment_ref: z.string().regex(/^SHP-\d{4}$/),
    epoch: z.string().regex(/^\d{4}-Q[1-4]$/),
    exporter_pseudonym: hex(32),
    buyer_pseudonym: hex(32),
    customs: z
      .object({
        record_id: z.string().min(1),
        record_version: z.number().int().nonnegative(),
        record_digest: hex(32),
      })
      .strict(),
    arc: z
      .object({
        chain_id: z.number().int().positive(),
        deals_manager: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        nft_id: z.string().min(1),
      })
      .strict()
      .optional(),
    insurance: z.object({ assignment_digest: hex(32) }).strict().optional(),
    cram_band: z.enum(["A", "B", "C", "D", "E"]).optional(),
    outcome: z
      .object({
        code: z.nativeEnum(OutcomeCode),
        amount_collected: z.string().regex(/^\d+$/).optional(),
        amount_owed: z.string().regex(/^\d+$/).optional(),
        redemption_confirmation_digest: hex(32).optional(),
      })
      .strict()
      .optional(),
    salt: hex(16),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.event === "financed_attested") {
      for (const k of ["arc", "insurance", "cram_band"] as const) {
        if (p[k] === undefined) ctx.addIssue({ code: "custom", path: [k], message: `${k} required for financed_attested` });
      }
    }
    if (p.event === "outcome" && p.outcome === undefined) {
      ctx.addIssue({ code: "custom", path: ["outcome"], message: "outcome required for outcome event" });
    }
  });

export type ProofPayloadV1 = z.infer<typeof ProofPayloadV1>;

/** Public view of a payload: everything except the salt. */
export function publicView(p: ProofPayloadV1): Omit<ProofPayloadV1, "salt"> {
  const { salt: _salt, ...rest } = p;
  return rest;
}

export const SampleShipment = z
  .object({
    shipment_ref: z.string().regex(/^SHP-\d{4}$/),
    data_basis: z.enum(["synthetic", "authorized"]),
    consented: z.boolean(),
    financed: z.boolean(),
    exporter_internal_id: z.string(),
    buyer_internal_id: z.string(),
    commodity: z.enum(["avocado", "blueberry", "grape", "mango", "asparagus"]),
    destination_region: z.enum(["EU", "US", "UK", "ASIA"]),
    face_value_usd: z.number().int().min(40_000).max(250_000),
    term_days: z.number().int().min(90).max(120),
    apy_bps: z.number().int().positive(),
    epoch: z.string().regex(/^\d{4}-Q[1-4]$/),
    customs_record_file: z.string(),
    arc_nft_id: z.string().optional(),
    insurance_assignment_file: z.string().optional(),
    cram_band: z.enum(["A", "B", "C", "D", "E"]).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.financed) {
      for (const k of ["arc_nft_id", "insurance_assignment_file", "cram_band"] as const) {
        if (s[k] === undefined) ctx.addIssue({ code: "custom", path: [k], message: `${k} required when financed` });
      }
    }
  });

export type SampleShipment = z.infer<typeof SampleShipment>;

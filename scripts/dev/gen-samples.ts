// One-off generator for SYNTHETIC sample data. Deterministic; no real names, companies or declarations.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, sha256 } from "@pot/core";

const S = path.join(REPO_ROOT, "data/samples");
mkdirSync(path.join(S, "customs"), { recursive: true });
mkdirSync(path.join(S, "insurance"), { recursive: true });

const HS = { avocado: "0804.40.00.00", blueberry: "0810.40.00.00", grape: "0806.10.00.00", mango: "0804.50.20.00", asparagus: "0709.20.00.00" } as const;
type C = keyof typeof HS;
const rows: [number, C, string, number, number, number, boolean, boolean, string?][] = [
  // ref, commodity, region, face, term, apy_bps, consented, financed, cram
  [247, "avocado", "EU", 100000, 120, 1200, true, true, "B"],
  [251, "blueberry", "US", 60000, 90, 1100, true, true, "A"],
  [258, "grape", "EU", 150000, 120, 1300, true, true, "C"],
  [263, "avocado", "US", 80000, 100, 1200, true, true, "B"],
  [270, "mango", "EU", 45000, 90, 1250, true, true, "B"],
  [212, "avocado", "EU", 120000, 120, 1200, true, false],
  [219, "blueberry", "UK", 95000, 90, 1150, true, false],
  [224, "grape", "US", 210000, 110, 1300, true, false],
  [229, "asparagus", "EU", 55000, 90, 1200, true, false],
  [233, "blueberry", "ASIA", 175000, 120, 1250, true, false],
  [238, "avocado", "US", 68000, 100, 1200, true, false],
  [241, "grape", "EU", 240000, 120, 1300, true, false],
  [205, "mango", "US", 52000, 90, 1200, false, false],
  [208, "avocado", "EU", 88000, 110, 1200, false, false],
];
const ports = ["PECLL", "PEPAI"]; // Callao, Paita (UN/LOCODE)

const shipments = rows.map(([n, commodity, region, face, term, apy, consented, financed, cram], i) => {
  const ref = `SHP-0${n}`;
  const customs = {
    data_basis: "synthetic",
    record_id: `CUS-0${n}`,
    record_version: 1,
    declaration_number: `118-2026-40-${String(100000 + n * 37).padStart(6, "0")}`, // pattern only, not a real DAM
    hs_code: HS[commodity],
    declared_net_weight_kg: Math.round(face / 3.2),
    port_of_loading: ports[i % 2],
    destination_region: region,
    shipment_date: `2026-${String(7 + (i % 3)).padStart(2, "0")}-${String(3 + i).padStart(2, "0")}`,
  };
  writeFileSync(path.join(S, "customs", `${ref}.json`), JSON.stringify(customs, null, 2) + "\n");
  const s: Record<string, unknown> = {
    shipment_ref: ref,
    data_basis: "synthetic",
    consented,
    financed,
    exporter_internal_id: `EXP-0${10 + (i % 6)}`,
    buyer_internal_id: `BUY-0${30 + (i % 5)}`,
    commodity,
    destination_region: region,
    face_value_usd: face,
    term_days: term,
    apy_bps: apy,
    epoch: "2026-Q4",
    customs_record_file: `customs/${ref}.json`,
  };
  if (financed) {
    s.arc_nft_id = `stub-${n}`;
    s.insurance_assignment_file = `insurance/${ref}.pdf.sha256`;
    s.cram_band = cram;
    const placeholder = `PLACEHOLDER insurance assignment for ${ref} (synthetic; real assignment is SCF M1)`;
    writeFileSync(path.join(S, "insurance", `${ref}.pdf.sha256`), sha256(placeholder).toString("hex") + "\n");
  }
  return s;
});
writeFileSync(
  path.join(S, "shipments.json"),
  JSON.stringify({ data_basis: "synthetic", note: "All records are synthetic. No real exporters, buyers or customs declarations.", shipments }, null, 2) + "\n",
);
console.log(`wrote ${shipments.length} synthetic shipments`);
